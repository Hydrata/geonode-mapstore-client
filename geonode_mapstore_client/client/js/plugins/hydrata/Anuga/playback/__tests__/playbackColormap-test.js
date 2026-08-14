/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2626 (W2.2, epic 2618) — playbackColormap tests.
 * The W0.3 spike's evenly-spaced buildColormapLUT/DEPTH_COLORMAP_STOPS
 * placeholder was REMOVED in TASK-2628 (W3.2) once the renderer switched to
 * the real SLD-derived quantity stops below (Phase 1.7 simplify pass, epic
 * 2618 W3 wave report) — buildQuantityColormapLUT is its replacement.
 */
import expect from 'expect';
import {
    uploadLUTTexture,
    DEPTH_SLD_STOPS,
    DEPTH_SLD_MAX,
    VELOCITY_SLD_STOPS,
    VELOCITY_SLD_MAX,
    DIV_SLD_STOPS,
    DIV_SLD_MAX,
    HAZARD_CLASS_COLORS,
    QUANTITY_RAMPS,
    buildQuantityColormapLUT,
    buildDiscreteColormapLUT,
    isRampNormalized,
    rampStopValues
} from '../playbackColormap';
import { QUANTITY_IDS, AIDR_HAZARD_CLASS_COUNT } from '../playbackDerivedQuantities';
import { MESH_FRAGMENT_SHADER } from '../playbackShaders';

/*
 * TASK-2788 (W7, epic 2706) — the dry-ground sheet's alpha must be PREMULTIPLIED
 * into its RGB.
 *
 * This is a SOURCE-level contract, deliberately. The invariant only shows up in
 * the compositor: the context takes the WebGL defaults `alpha: true` +
 * `premultipliedAlpha: true`, and the mesh pass draws with BLEND DISABLED
 * (blending is enabled only for the wireframe pass), so whatever the fragment
 * shader writes lands in the drawing buffer verbatim and the browser reads it
 * as premultiplied. Rendering that difference in karma would need a full
 * offscreen GL harness; the failure mode it guards is a one-line
 * "simplification" back to vec4(rgb, alpha), which a source assertion catches
 * exactly and cheaply.
 */
describe('MESH_FRAGMENT_SHADER dry-ground alpha — TASK-2788', () => {
    const body = MESH_FRAGMENT_SHADER.replace(/\/\/[^\n]*/g, '');

    it('declares the alpha as a uniform, not a literal', () => {
        expect(body).toContain('uniform float uBackgroundAlpha;');
    });

    it('multiplies the tint RGB by that alpha (premultiplied), never vec4(rgb, alpha)', () => {
        expect(body).toContain('vec3(0.16, 0.15, 0.13) * uBackgroundAlpha');
        expect(body).toNotContain('vec4(0.16, 0.15, 0.13, uBackgroundAlpha)');
        expect(body).toNotContain('vec4(0.16, 0.15, 0.13, 1.0)');
    });

    it('leaves the WET fragment fully opaque — only the dry ground fades', () => {
        expect(body).toContain('vec4(texture(uLUT, vec2(vValue, 0.5)).rgb, 1.0)');
    });
});

describe('playbackColormap', () => {
    describe('buildQuantityColormapLUT (TASK-2628 — real SLD stops, non-uniform spacing)', () => {
        it('texel 0 matches the first SLD stop exactly (value=0)', () => {
            const lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
            const [r, g, b] = DEPTH_SLD_STOPS[0].color;
            expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([r, g, b, 255]);
        });

        it('the last texel matches the last SLD stop exactly (value=colorMax)', () => {
            const lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
            const [r, g, b] = DEPTH_SLD_STOPS[DEPTH_SLD_STOPS.length - 1].color;
            const last = 255 * 4;
            expect([lut[last], lut[last + 1], lut[last + 2]]).toEqual([r, g, b]);
        });

        it('a value beyond the SLD max clamps to the saturated last colour (not extrapolated/black)', () => {
            // colorMax deliberately set BELOW the real store's valid_max (a
            // flood can exceed the SLD's fixed 6m cap) — every texel past the
            // last stop's own colorMax-relative position must saturate.
            const bigColorMax = 22; // e.g. a real 22m flood-depth store
            const lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, bigColorMax, 256);
            const [r, g, b] = DEPTH_SLD_STOPS[DEPTH_SLD_STOPS.length - 1].color;
            const last = 255 * 4;
            expect([lut[last], lut[last + 1], lut[last + 2]]).toEqual([r, g, b]);
        });

        it('respects the SLD non-uniform spacing: the near-zero bucket (0-0.1m of a 6m ramp) stays flat, not a 3/10 evenly-spread gradient', () => {
            const lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
            // 0.1m / 6m ~= 1.7% of the ramp -> texel index ~4; DEPTH_SLD_STOPS[0..2]
            // are all the SAME colour (#daffe4), so texels well within that
            // span must be identical, not already blending toward #b1f5ff.
            const texelAt = (value) => {
                const i = Math.round((value / DEPTH_SLD_MAX) * 255);
                return [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]];
            };
            expect(texelAt(0.02)).toEqual(DEPTH_SLD_STOPS[0].color);
            expect(texelAt(0.09)).toEqual(DEPTH_SLD_STOPS[0].color);
        });

        it('velocity ramp: interpolates correctly between two real stops', () => {
            const lut = buildQuantityColormapLUT(VELOCITY_SLD_STOPS, VELOCITY_SLD_MAX, 256);
            // Midpoint of [0, 0.5] (both m/s) -> exact midpoint of their colours.
            const i = Math.round((0.25 / VELOCITY_SLD_MAX) * 255);
            const expectedR = Math.round((VELOCITY_SLD_STOPS[0].color[0] + VELOCITY_SLD_STOPS[1].color[0]) / 2);
            expect(Math.abs(lut[i * 4] - expectedR) <= 1).toBe(true);
        });

        it('rejects a non-positive colorMax', () => {
            expect(() => buildQuantityColormapLUT(DEPTH_SLD_STOPS, 0, 256)).toThrow();
            expect(() => buildQuantityColormapLUT(DEPTH_SLD_STOPS, -1, 256)).toThrow();
        });
    });

    describe('uploadLUTTexture (minimal GL smoke check)', () => {
        it('uploads without throwing and returns a texture object, when WebGL2 is available', function() {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            if (!gl) {
                // SwiftShader/headless GL is not guaranteed in every CI sandbox —
                // the AC explicitly asks for MINIMAL GL smoke coverage here (the
                // real render path is live-verified in the browser); skip rather
                // than false-fail an environment with no GL2 context at all.
                this.skip();
                return;
            }
            const lut = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
            const tex = uploadLUTTexture(gl, lut, 256);
            expect(tex).toBeTruthy();
            expect(gl.getError()).toBe(gl.NO_ERROR);
        });

        it('accepts a `nearest` filter (used for the discrete hazard LUT) without a GL error', function() {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            if (!gl) {
                this.skip();
                return;
            }
            const lut = buildDiscreteColormapLUT(HAZARD_CLASS_COLORS, HAZARD_CLASS_COLORS.length - 1, 256);
            const tex = uploadLUTTexture(gl, lut, 256, 'nearest');
            expect(tex).toBeTruthy();
            expect(gl.getError()).toBe(gl.NO_ERROR);
        });
    });

    // TASK-2629 (W4.1)
    describe('DIV_SLD_STOPS (mirrors the real depth_integrated_velocity_5m2s.sld verbatim)', () => {
        it('starts at 0 (transparent-in-the-SLD, opaque here) and caps at 20 m²/s', () => {
            expect(DIV_SLD_STOPS[0].quantity).toBe(0);
            expect(DIV_SLD_STOPS[DIV_SLD_STOPS.length - 1].quantity).toBe(20);
            expect(DIV_SLD_MAX).toBe(20);
        });
    });

    describe('buildDiscreteColormapLUT (AC: "the legend must render discrete classes")', () => {
        it('every texel is EXACTLY one class colour — no interpolated blend between classes', () => {
            const lut = buildDiscreteColormapLUT(HAZARD_CLASS_COLORS, HAZARD_CLASS_COLORS.length - 1, 60);
            const seenColors = new Set();
            for (let i = 0; i < 60; i++) {
                seenColors.add(`${lut[i * 4]},${lut[i * 4 + 1]},${lut[i * 4 + 2]}`);
            }
            const validColors = new Set(HAZARD_CLASS_COLORS.map((c) => c.color.join(',')));
            seenColors.forEach((c) => expect(validColors.has(c)).toBe(true));
        });

        it('texel 0 is class 0 (H1) and the last texel is the last class (H6)', () => {
            const size = 256;
            const colorMax = HAZARD_CLASS_COLORS.length - 1;
            const lut = buildDiscreteColormapLUT(HAZARD_CLASS_COLORS, colorMax, size);
            expect([lut[0], lut[1], lut[2]]).toEqual(HAZARD_CLASS_COLORS[0].color);
            const lastIdx = (size - 1) * 4;
            expect([lut[lastIdx], lut[lastIdx + 1], lut[lastIdx + 2]]).toEqual(HAZARD_CLASS_COLORS[HAZARD_CLASS_COLORS.length - 1].color);
        });

        it('rejects a non-positive colorMax', () => {
            expect(() => buildDiscreteColormapLUT(HAZARD_CLASS_COLORS, 0, 256)).toThrow();
        });
    });

    describe('HAZARD_CLASS_COLORS (AC: discrete AIDR classes)', () => {
        it('has exactly AIDR_HAZARD_CLASS_COUNT (6, H1-H6) entries, in classIndex order', () => {
            expect(HAZARD_CLASS_COLORS.length).toBe(AIDR_HAZARD_CLASS_COUNT);
            expect(HAZARD_CLASS_COLORS.map((c) => c.classIndex)).toEqual([0, 1, 2, 3, 4, 5]);
            expect(HAZARD_CLASS_COLORS.map((c) => c.className)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
        });
    });

    describe('QUANTITY_RAMPS (single source both the renderer and the legend build colours from)', () => {
        it('has one entry per playbackDerivedQuantities.QUANTITY_IDS, each with stops + max', () => {
            QUANTITY_IDS.forEach((id) => {
                expect(QUANTITY_RAMPS[id]).toBeTruthy();
                expect(Array.isArray(QUANTITY_RAMPS[id].stops)).toBe(true);
                expect(QUANTITY_RAMPS[id].stops.length).toBeGreaterThan(0);
                expect(typeof QUANTITY_RAMPS[id].max).toBe('number');
            });
        });

        it('only `hazard` is marked discrete', () => {
            const discreteIds = QUANTITY_IDS.filter((id) => QUANTITY_RAMPS[id].discrete);
            expect(discreteIds).toEqual(['hazard']);
        });

        // TASK-2784 — `stage` is the one ramp whose stops were never physical
        // values. Mismarking any other ramp normalized would silently divorce
        // it from its SLD, so the set is pinned, not spot-checked.
        it('only `stage` is marked normalized — its stops are fractions, not metres', () => {
            const normalizedIds = QUANTITY_IDS.filter((id) => QUANTITY_RAMPS[id].normalized);
            expect(normalizedIds).toEqual(['stage']);
            expect(QUANTITY_RAMPS.stage.stops[QUANTITY_RAMPS.stage.stops.length - 1].quantity).toBe(1);
        });
    });

    /*
     * TASK-2784 (W7, epic 2706) — a ceiling the reader types must RESCALE the
     * ramp, not truncate it.
     *
     * RED on HEAD (measured, not asserted from theory): with the velocity
     * ceiling at 4 m/s the LUT's top texel was the SLD's 4 m/s magenta, so the
     * purple and dark-blue thirds of the ramp were unreachable and the render
     * carried a third less contrast than the reader had just asked for.
     */
    describe('normalized ramps — TASK-2784', () => {
        const rgbAt = (lut, i) => [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]];
        const firstStop = (stops) => stops[0].color;
        const lastStop = (stops) => stops[stops.length - 1].color;

        it('stretches the ramp so the LAST stop lands on colorMax, not on its own SLD value', () => {
            const lut = buildQuantityColormapLUT(VELOCITY_SLD_STOPS, 4, 256, { normalized: true });
            expect(rgbAt(lut, 0)).toEqual(firstStop(VELOCITY_SLD_STOPS));
            expect(rgbAt(lut, 255)).toEqual(lastStop(VELOCITY_SLD_STOPS));
        });

        it('is what the DEFAULT mode does not do — a 4 m/s ceiling truncates at the 4 m/s colour', () => {
            const truncated = buildQuantityColormapLUT(VELOCITY_SLD_STOPS, 4, 256);
            // the SLD's own 4 m/s stop, two stops short of the ramp's end
            expect(rgbAt(truncated, 255)).toEqual([176, 42, 143]);
            expect(rgbAt(truncated, 255)).toNotEqual(lastStop(VELOCITY_SLD_STOPS));
        });

        it('is INDEPENDENT of colorMax — the display range lives in the shader uniforms, not the LUT', () => {
            const a = buildQuantityColormapLUT(VELOCITY_SLD_STOPS, 4, 256, { normalized: true });
            const b = buildQuantityColormapLUT(VELOCITY_SLD_STOPS, 97.3, 256, { normalized: true });
            expect(Array.from(a)).toEqual(Array.from(b));
        });

        it('leaves the absolute mode byte-identical — SLD fidelity is the untouched default', () => {
            const before = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256);
            const explicit = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256, { normalized: false });
            expect(Array.from(before)).toEqual(Array.from(explicit));
            // ...and at the ramp's own span the two modes coincide, which is
            // why froude/shear/courant (colorMax === ramp.max always) cannot
            // change behaviour under this fix.
            const normalized = buildQuantityColormapLUT(DEPTH_SLD_STOPS, DEPTH_SLD_MAX, 256, { normalized: true });
            expect(Array.from(before)).toEqual(Array.from(normalized));
        });

        /*
         * The second defect this fixes, and the reason the flag lives on the
         * ramp rather than only on the override: STAGE_RAMP_STOPS are
         * fractions of the run's own elevation span, but the LUT read them as
         * absolute metres. On a 30 m span every texel past ~1 m clamped to the
         * top colour — 96.5% of the rendered range collapsed to one flat pink.
         */
        it('rescues `stage`, whose fractional stops collapsed to a flat sheet on any real elevation span', () => {
            const stage = QUANTITY_RAMPS.stage.stops;
            const distinct = (lut) => new Set(
                Array.from({ length: 256 }, (unused, i) => rgbAt(lut, i).join(','))
            ).size;

            const broken = buildQuantityColormapLUT(stage, 30, 256);
            expect(distinct(broken)).toBeLessThan(16);
            expect(rgbAt(broken, 128)).toEqual(lastStop(stage));

            const fixed = buildQuantityColormapLUT(stage, 30, 256, { normalized: true });
            expect(distinct(fixed)).toBeGreaterThan(200);
            expect(rgbAt(fixed, 0)).toEqual(firstStop(stage));
            expect(rgbAt(fixed, 255)).toEqual(lastStop(stage));
        });
    });

    describe('isRampNormalized — one answer for the renderer and the legend (TASK-2784)', () => {
        it('is true for `stage` whether or not a ceiling was set', () => {
            expect(isRampNormalized('stage', false)).toBe(true);
            expect(isRampNormalized('stage', true)).toBe(true);
        });

        it('is false for an SLD ramp until the reader sets a ceiling', () => {
            expect(isRampNormalized('speed', false)).toBe(false);
            expect(isRampNormalized('depth', undefined)).toBe(false);
            expect(isRampNormalized('speed', true)).toBe(true);
        });

        it('is never true for hazard — H1-H6 are classes, with no range to stretch', () => {
            expect(isRampNormalized('hazard', true)).toBe(false);
        });
    });

    describe('rampStopValues — the number the legend prints beside each swatch (TASK-2784)', () => {
        it('returns the stops\' own values when the ramp is not normalized', () => {
            const rows = rampStopValues('speed', { colorMin: 0, colorMax: 4, normalized: false });
            expect(rows.map((r) => r.value)).toEqual(VELOCITY_SLD_STOPS.map((s) => s.quantity));
        });

        it('rescales every stop onto [colorMin, colorMax] when it is', () => {
            const rows = rampStopValues('speed', { colorMin: 0, colorMax: 4, normalized: true });
            expect(rows.length).toBe(VELOCITY_SLD_STOPS.length);
            expect(rows[0].value).toBe(0);
            expect(rows[rows.length - 1].value).toBe(4);
            // 3 m/s of 6 -> half of 4
            expect(rows[4].value).toBe(2);
            // monotonic, and never above the ceiling — the TASK-2744 AC4
            // invariant, now held by relabelling rather than by clipping
            rows.forEach((row, i) => {
                expect(row.value).toBeLessThanOrEqualTo(4);
                if (i > 0) {
                    expect(row.value).toBeGreaterThan(rows[i - 1].value);
                }
            });
        });

        it('honours a non-zero colorMin, which is stage\'s whole shape', () => {
            const rows = rampStopValues('stage', { colorMin: 10, colorMax: 40, normalized: true });
            expect(rows[0].value).toBe(10);
            expect(rows[rows.length - 1].value).toBe(40);
        });

        it('keeps each stop\'s colour untouched — only the value is rescaled', () => {
            const rows = rampStopValues('speed', { colorMin: 0, colorMax: 4, normalized: true });
            expect(rows.map((r) => r.color)).toEqual(VELOCITY_SLD_STOPS.map((s) => s.color));
        });
    });
});

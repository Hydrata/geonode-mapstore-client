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
    buildDiscreteColormapLUT
} from '../playbackColormap';
import { QUANTITY_IDS, AIDR_HAZARD_CLASS_COUNT } from '../playbackDerivedQuantities';

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
    });
});

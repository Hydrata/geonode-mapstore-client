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
    buildQuantityColormapLUT
} from '../playbackColormap';

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
    });
});

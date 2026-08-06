/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* TASK-2626 (W2.2, epic 2618) — playbackColormap tests. */
import expect from 'expect';
import { DEPTH_COLORMAP_STOPS, buildColormapLUT, uploadLUTTexture } from '../playbackColormap';

describe('playbackColormap', () => {
    describe('buildColormapLUT', () => {
        it('produces an RGBA8 buffer of the requested size', () => {
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, 256);
            expect(lut.length).toBe(256 * 4);
            expect(lut instanceof Uint8Array).toBe(true);
        });

        it('the first texel matches the first stop exactly (t=0)', () => {
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, 256);
            const [r, g, b] = DEPTH_COLORMAP_STOPS[0];
            expect(lut[0]).toBe(r);
            expect(lut[1]).toBe(g);
            expect(lut[2]).toBe(b);
            expect(lut[3]).toBe(255);
        });

        it('the last texel matches the last stop exactly (t=1)', () => {
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, 256);
            const [r, g, b] = DEPTH_COLORMAP_STOPS[DEPTH_COLORMAP_STOPS.length - 1];
            const last = 255 * 4;
            expect(lut[last]).toBe(r);
            expect(lut[last + 1]).toBe(g);
            expect(lut[last + 2]).toBe(b);
        });

        it('alpha is always opaque (255)', () => {
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, 64);
            for (let i = 0; i < 64; i++) {
                expect(lut[i * 4 + 3]).toBe(255);
            }
        });

        it('is monotonically smooth: no two adjacent texels differ by more than one linear step could produce', () => {
            const size = 256;
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, size);
            // Max possible per-texel-step delta for any channel, across the
            // whole stop list (worst single segment jump / segment texel span).
            const nSeg = DEPTH_COLORMAP_STOPS.length - 1;
            let maxSegDelta = 0;
            for (let s = 0; s < nSeg; s++) {
                for (let c = 0; c < 3; c++) {
                    maxSegDelta = Math.max(maxSegDelta, Math.abs(DEPTH_COLORMAP_STOPS[s + 1][c] - DEPTH_COLORMAP_STOPS[s][c]));
                }
            }
            const texelsPerSeg = (size - 1) / nSeg;
            const maxStepDelta = Math.ceil(maxSegDelta / texelsPerSeg) + 1;
            for (let i = 1; i < size; i++) {
                for (let c = 0; c < 3; c++) {
                    const delta = Math.abs(lut[i * 4 + c] - lut[(i - 1) * 4 + c]);
                    expect(delta <= maxStepDelta).toBe(true, `channel ${c} jumped ${delta} at texel ${i} (max expected ${maxStepDelta})`);
                }
            }
        });

        it('rejects fewer than 2 stops', () => {
            expect(() => buildColormapLUT([[0, 0, 0]], 256)).toThrow();
            expect(() => buildColormapLUT([], 256)).toThrow();
        });

        it('rejects a size below 2', () => {
            expect(() => buildColormapLUT(DEPTH_COLORMAP_STOPS, 1)).toThrow();
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
            const lut = buildColormapLUT(DEPTH_COLORMAP_STOPS, 256);
            const tex = uploadLUTTexture(gl, lut, 256);
            expect(tex).toBeTruthy();
            expect(gl.getError()).toBe(gl.NO_ERROR);
        });
    });
});

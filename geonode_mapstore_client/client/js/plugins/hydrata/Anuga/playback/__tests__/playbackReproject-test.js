/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2626 (W2.2, epic 2618) — playbackReproject tests.
 *
 * The AC's ground-truth rule (memory: reference-anuga-sww-georef-
 * xllcorner-not-false-easting) is tested against a NONZERO xllcorner/
 * yllcorner fixture that also carries a DIFFERENT false_easting/
 * false_northing pair — a zero-xllcorner fixture would let a
 * "+false_easting" bug pass silently (feedback-prove-the-detector-before-
 * trusting-a-zero).
 */
import expect from 'expect';
import proj4 from 'proj4';
import {
    normalizeEpsgCode,
    isUtmWgs84Epsg,
    reprojectMeshVertices
} from '../playbackReproject';

describe('playbackReproject', () => {
    describe('normalizeEpsgCode', () => {
        it('accepts a bare number', () => {
            expect(normalizeEpsgCode(32756)).toBe('EPSG:32756');
        });
        it('accepts a bare numeric string', () => {
            expect(normalizeEpsgCode('32756')).toBe('EPSG:32756');
        });
        it('accepts an already-prefixed string', () => {
            expect(normalizeEpsgCode('EPSG:32756')).toBe('EPSG:32756');
        });
        it('returns null for garbage / null / undefined', () => {
            expect(normalizeEpsgCode('not-a-code')).toBe(null);
            expect(normalizeEpsgCode(null)).toBe(null);
            expect(normalizeEpsgCode(undefined)).toBe(null);
        });
    });

    describe('isUtmWgs84Epsg', () => {
        it('accepts the northern (326xx) and southern (327xx) UTM families', () => {
            expect(isUtmWgs84Epsg(32640)).toBe(true);
            expect(isUtmWgs84Epsg(32756)).toBe(true);
        });
        it('rejects a non-UTM code', () => {
            expect(isUtmWgs84Epsg(4326)).toBe(false);
            expect(isUtmWgs84Epsg(3857)).toBe(false);
        });
    });

    describe('reprojectMeshVertices', () => {
        // A synthetic "georef" where xllcorner/yllcorner are DELIBERATELY
        // different from false_easting/false_northing, so a "+false_easting"
        // regression produces a measurably different (wrong) result rather
        // than accidentally matching (most real W0 SWWs have xllcorner=0,
        // which is exactly why this rule hid for as long as it did).
        const epsg = 32756; // UTM zone 56S
        const xllcorner = 303517; // Towradgi-scale nonzero origin (memory's known-positive)
        const yllcorner = 6193140;
        const falseEasting = 500000; // standard UTM false easting (WRONG constant to add)
        const falseNorthing = 10000000; // standard southern-hemisphere false northing (WRONG constant to add)
        const localX = new Float32Array([0, 100, -50]);
        const localY = new Float32Array([0, 200, 75]);

        it('reprojects local + xllcorner/yllcorner, matching a direct proj4 call on the absolute coords', () => {
            const { x, y } = reprojectMeshVertices(localX, localY, { epsg, xllcorner, yllcorner });
            const transformer = proj4('EPSG:32756', 'EPSG:3857');
            for (let i = 0; i < localX.length; i++) {
                const [expectedX, expectedY] = transformer.forward([localX[i] + xllcorner, localY[i] + yllcorner]);
                expect(Math.abs(x[i] - expectedX) < 1e-6).toBe(true);
                expect(Math.abs(y[i] - expectedY) < 1e-6).toBe(true);
            }
        });

        it('does NOT match a (buggy) reprojection that adds false_easting/false_northing instead', () => {
            const { x, y } = reprojectMeshVertices(localX, localY, { epsg, xllcorner, yllcorner });
            const transformer = proj4('EPSG:32756', 'EPSG:3857');
            const [wrongX, wrongY] = transformer.forward([localX[0] + falseEasting, localY[0] + falseNorthing]);
            // The correct and "false_easting-instead" results must differ by
            // a large, unmistakable margin (hundreds of km), not a rounding
            // difference — proves this isn't an accidental near-match.
            expect(Math.abs(x[0] - wrongX) > 100000).toBe(true);
            expect(Math.abs(y[0] - wrongY) > 100000).toBe(true);
        });

        it('defaults xllcorner/yllcorner to 0 when absent (already-absolute SWW)', () => {
            const { x, y } = reprojectMeshVertices(localX, localY, { epsg });
            const transformer = proj4('EPSG:32756', 'EPSG:3857');
            const [expectedX, expectedY] = transformer.forward([localX[0], localY[0]]);
            expect(Math.abs(x[0] - expectedX) < 1e-6).toBe(true);
            expect(Math.abs(y[0] - expectedY) < 1e-6).toBe(true);
        });

        it('throws for an unusable epsg', () => {
            expect(() => reprojectMeshVertices(localX, localY, { epsg: 'nonsense' })).toThrow();
            expect(() => reprojectMeshVertices(localX, localY, {})).toThrow();
        });

        it('throws on a localX/localY length mismatch', () => {
            expect(() => reprojectMeshVertices(new Float32Array([1, 2]), new Float32Array([1]), { epsg })).toThrow();
        });
    });
});

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
    reprojectMeshVertices,
    reprojectMeshBounds
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

    // TASK-2726 (W5.5, epic 2706) — the EPSG:3857 extent behind "zoom to
    // results". The property that matters is AGREEMENT WITH THE FULL
    // REPROJECTION: this walks the native bbox perimeter instead of
    // reprojecting every vertex, precisely so it can answer a four-number
    // question without allocating two node-length Float64Arrays (54 MiB on the
    // Msimbazi store). A cheap approximation that disagreed with the exact
    // answer would be worse than the 54 MiB, so it is checked against it.
    describe('reprojectMeshBounds — TASK-2726', () => {
        // Msimbazi, EPSG:32737. Store-local coords with a zero-origin geo_ref,
        // i.e. ABSOLUTE UTM — the shape every prod store actually has
        // (memory: reference-sww-float32-absolute-utm-lattice).
        const GEOREF = { epsg: 32737, xllcorner: 0, yllcorner: 0 };
        const X0 = 527954.3125;
        const X1 = 531473.1875;
        const Y0 = 9245583;
        const Y1 = 9249317;

        // All FOUR native corners are seeded (i = 0..3) before the scatter.
        // That is not decoration: the function projects the native bounding
        // RECTANGLE, so it agrees with a per-vertex hull to sub-metre only when
        // the vertices actually reach that rectangle's corners. A mesh that
        // does not (an L-shaped catchment, say) gets a box that is CONSERVATIVE
        // — strictly containing, never cropping — which is the right failure
        // direction for a zoom control and is asserted separately below.
        function scatteredMesh(n) {
            const xs = new Float64Array(n);
            const ys = new Float64Array(n);
            const cornersX = [0, 1, 0, 1];
            const cornersY = [0, 0, 1, 1];
            for (let i = 0; i < n; i++) {
                const f = i < 4 ? cornersX[i] : ((i * 2654435761) % 1000) / 1000;
                const g = i < 4 ? cornersY[i] : ((i * 40503) % 997) / 997;
                xs[i] = X0 + (X1 - X0) * f;
                ys[i] = Y0 + (Y1 - Y0) * g;
            }
            return { xs, ys };
        }

        it('agrees with a full per-vertex reprojection to well under a metre', () => {
            const { xs, ys } = scatteredMesh(4000);
            const bounds = reprojectMeshBounds(xs, ys, GEOREF);
            const { x, y } = reprojectMeshVertices(xs, ys, GEOREF);
            let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
            for (let i = 0; i < x.length; i++) {
                if (x[i] < minX) { minX = x[i]; }
                if (x[i] > maxX) { maxX = x[i]; }
                if (y[i] < minY) { minY = y[i]; }
                if (y[i] > maxY) { maxY = y[i]; }
            }
            // The perimeter walk must CONTAIN the exact hull (never crop the
            // results out of view) and must not overshoot it by more than a
            // metre — sub-pixel at any zoom a user can reach.
            expect(bounds[0]).toBeLessThanOrEqualTo(minX);
            expect(bounds[1]).toBeLessThanOrEqualTo(minY);
            expect(bounds[2]).toBeGreaterThanOrEqualTo(maxX);
            expect(bounds[3]).toBeGreaterThanOrEqualTo(maxY);
            expect(bounds[2] - bounds[0] - (maxX - minX)).toBeLessThan(1);
            expect(bounds[3] - bounds[1] - (maxY - minY)).toBeLessThan(1);
        });

        it('is CONSERVATIVE — never crops — for a mesh that does not fill its own bbox corners', () => {
            // Only the SW and NE corners present. UTM -> Web Mercator stretches
            // easting with latitude, so the projected rectangle is wider than
            // the projected point pair; the box must still contain the pair.
            const xs = new Float64Array([X0, X1]);
            const ys = new Float64Array([Y0, Y1]);
            const bounds = reprojectMeshBounds(xs, ys, GEOREF);
            const { x, y } = reprojectMeshVertices(xs, ys, GEOREF);
            expect(bounds[0]).toBeLessThanOrEqualTo(Math.min(x[0], x[1]));
            expect(bounds[2]).toBeGreaterThanOrEqualTo(Math.max(x[0], x[1]));
            expect(bounds[1]).toBeLessThanOrEqualTo(Math.min(y[0], y[1]));
            expect(bounds[3]).toBeGreaterThanOrEqualTo(Math.max(y[0], y[1]));
            // The price of that safety, in the WORST case this store can
            // produce (two opposite corners and nothing else): measured
            // 0.118% of span = 4.2 m over 3,543 m. Asserted at 10 m absolute
            // because metres are what a reviewer can judge — that is one
            // building width on a 3.5 km domain, i.e. invisible at any zoom.
            const span = bounds[2] - bounds[0];
            expect(span - Math.abs(x[1] - x[0])).toBeLessThan(10);
        });

        it('lands inside the Msimbazi store extent the runbook records', () => {
            const { xs, ys } = scatteredMesh(500);
            const [minX, minY, maxX, maxY] = reprojectMeshBounds(xs, ys, GEOREF);
            // runbook 'Where the data actually is': lon/lat 39.25300,-6.82506
            // .. 39.28483,-6.79126 -> EPSG:3857 4369623.8,-761565.1 ..
            // 4373166.8,-757776.3. TASK-2726 AC7 asserts the map centre lands
            // inside this box; here we assert the SOURCE of that centre does.
            expect(minX).toBeGreaterThan(4369000);
            expect(maxX).toBeLessThan(4374000);
            expect(minY).toBeGreaterThan(-762000);
            expect(maxY).toBeLessThan(-757000);
            expect(maxX).toBeGreaterThan(minX);
            expect(maxY).toBeGreaterThan(minY);
        });

        it('honours a non-zero geo_reference origin rather than ignoring it', () => {
            const local = new Float64Array([0, 3518.875]);
            const localY = new Float64Array([0, 3734]);
            const shifted = reprojectMeshBounds(local, localY, { epsg: 32737, xllcorner: X0, yllcorner: Y0 });
            const absolute = reprojectMeshBounds(
                new Float64Array([X0, X1]), new Float64Array([Y0, Y1]), GEOREF
            );
            for (let i = 0; i < 4; i++) {
                expect(Math.abs(shifted[i] - absolute[i])).toBeLessThan(0.01);
            }
        });

        it('returns null rather than a bogus box for an unusable input', () => {
            const xs = new Float64Array([1, 2]);
            expect(reprojectMeshBounds(xs, new Float64Array([1, 2]), { epsg: 'nonsense' })).toBe(null);
            expect(reprojectMeshBounds(xs, new Float64Array([1]), GEOREF)).toBe(null);
            expect(reprojectMeshBounds(new Float64Array(0), new Float64Array(0), GEOREF)).toBe(null);
            expect(reprojectMeshBounds(null, null, GEOREF)).toBe(null);
        });
    });
});

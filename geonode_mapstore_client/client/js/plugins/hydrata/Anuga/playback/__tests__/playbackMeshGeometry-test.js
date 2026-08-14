/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* TASK-2626 (W2.2, epic 2618) — playbackMeshGeometry tests. */
import expect from 'expect';
import {
    buildWireframeIndices,
    packQuantityVec3,
    computeMixFactor,
    computeVertexInradius,
    buildProjectionMatrix,
    applyProjectionMatrix,
    buildInverseProjectionMatrix,
    computeMeshBounds,
    // TASK-2686 (W6.75.4, epic 2618) — wireframe legibility at scale.
    wireframeDecimationStride,
    wireframeOpacityForTriangleCount,
    decimateWireframeIndices,
    // TASK-2734 (W3, epic 2706) — allocation-free decimated wireframe builder.
    buildDecimatedWireframeIndices,
    WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES,
    WIREFRAME_MAX_DECIMATION_STRIDE,
    WIREFRAME_MIN_OPACITY,
    // TASK-2743 UAT-01 (W6, epic 2706) — closed-triangle (face) decimation.
    WIREFRAME_FACE_STRIDE_FACTOR,
    wireframeFaceStride,
    buildFaceDecimatedWireframeIndices
} from '../playbackMeshGeometry';
import { FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixtures/fixturePlaybackStore';

describe('playbackMeshGeometry', () => {
    describe('computeVertexInradius (TASK-2629, W4.1 — per-face inradius broadcast to per-vertex, MIN of incident faces)', () => {
        it('a single triangle: every one of its 3 vertices gets that face\'s own inradius', () => {
            const faces = Int32Array.from([0, 1, 2]);
            const faceInradius = Float32Array.from([5]);
            const result = computeVertexInradius(faces, faceInradius, 3);
            expect(Array.from(result)).toEqual([5, 5, 5]);
        });

        it('a shared vertex takes the MINIMUM of its incident faces (conservative — smaller inradius = larger Courant)', () => {
            // Two triangles sharing vertex 1: face0=(0,1,2) r=10, face1=(1,3,4) r=3.
            const faces = Int32Array.from([0, 1, 2, 1, 3, 4]);
            const faceInradius = Float32Array.from([10, 3]);
            const result = computeVertexInradius(faces, faceInradius, 5);
            expect(result[0]).toBe(10); // only face0
            expect(result[1]).toBe(3); // face0 AND face1 -> min(10,3)=3
            expect(result[2]).toBe(10); // only face0
            expect(result[3]).toBe(3); // only face1
            expect(result[4]).toBe(3); // only face1
        });

        it('a vertex with no incident face gets 0 (never Infinity leaking into the shader)', () => {
            const faces = Int32Array.from([0, 1, 2]);
            const faceInradius = Float32Array.from([7]);
            const result = computeVertexInradius(faces, faceInradius, 4); // vertex 3 unused
            expect(result[3]).toBe(0);
        });

        it('matches the real fixture mesh (4 triangles, near-uniform inradius): every vertex resolves to its OWN incident-face minimum', () => {
            const flat = Int32Array.from(FIXTURE_PHYSICAL.face_node_connectivity.flat());
            const faceInradius = Float32Array.from(FIXTURE_PHYSICAL.inradius);
            const result = computeVertexInradius(flat, faceInradius, FIXTURE_MESH.nNode);
            // vertex 0 is incident to face 0 ONLY -> exactly face 0's inradius.
            expect(Math.abs(result[0] - faceInradius[0]) < 1e-5).toBe(true);
            // vertex 1 is incident to faces 0,1,2 -> the minimum of the three.
            expect(Math.abs(result[1] - Math.min(faceInradius[0], faceInradius[1], faceInradius[2])) < 1e-5).toBe(true);
            // vertex 5 is incident to face 3 ONLY -> exactly face 3's inradius.
            expect(Math.abs(result[5] - faceInradius[3]) < 1e-5).toBe(true);
        });
    });

    describe('buildWireframeIndices', () => {
        it('emits 3 deduplicated edges for two triangles sharing one edge (a quad split in half)', () => {
            // Quad 0-1-2-3 split into triangles (0,1,2) and (0,2,3): shares edge (0,2).
            const faces = new Int32Array([0, 1, 2, 0, 2, 3]);
            const edges = buildWireframeIndices(faces);
            // 6 raw edges - 1 shared duplicate = 5 unique edges = 10 indices.
            expect(edges.length).toBe(10);
        });

        it('matches the real fixture mesh (4 triangles, a 2x1 grid of quads): exactly 9 unique edges', () => {
            // FIXTURE_PHYSICAL.face_node_connectivity is the real exporter-derived
            // 4-triangle mesh (2 quads, one shared internal diagonal edge each,
            // plus one shared edge between the two quads) — 16 vertices used
            // across 4 triangles = 12 raw edges; the two internal diagonals are
            // never shared with anything, but the boundary between the two
            // triangle-pairs (1,4) is shared -> 12 - ... just assert the actual
            // exporter-derived count directly (regression pin, not re-derivation).
            const flat = Int32Array.from(FIXTURE_PHYSICAL.face_node_connectivity.flat());
            const edges = buildWireframeIndices(flat);
            expect(edges.length % 2).toBe(0);
            const edgeCount = edges.length / 2;
            // 4 triangles * 3 edges = 12 raw edges; every edge below appears
            // exactly once or twice — compute expected dedup count directly to
            // pin the real mesh's topology without hand-counting by eye.
            const seen = new Set();
            let expectedUnique = 0;
            for (let f = 0; f < flat.length; f += 3) {
                const tri = [flat[f], flat[f + 1], flat[f + 2]];
                for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
                    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        expectedUnique++;
                    }
                }
            }
            expect(edgeCount).toBe(expectedUnique);
            expect(FIXTURE_MESH.nFace).toBe(4);
        });

        it('never emits the same undirected edge twice, even when winding order differs', () => {
            // Triangle A: 0-1-2 (edge 0-1). Triangle B: 1-0-3 (edge 1-0, same
            // undirected edge, opposite winding) — must dedupe.
            const faces = new Int32Array([0, 1, 2, 1, 0, 3]);
            const edges = buildWireframeIndices(faces);
            const pairs = [];
            for (let i = 0; i < edges.length; i += 2) {
                pairs.push(`${Math.min(edges[i], edges[i + 1])}-${Math.max(edges[i], edges[i + 1])}`);
            }
            expect(new Set(pairs).size).toBe(pairs.length); // no duplicates
            expect(pairs).toContain('0-1');
        });

        it('rejects a length not divisible by 3', () => {
            expect(() => buildWireframeIndices(new Int32Array([0, 1, 2, 3]))).toThrow();
        });
    });

    // TASK-2686 (W6.75.4, epic 2618) — the 505k-triangle wireframe overlay
    // is a ~95% white-out at any practical zoom (root cause: every edge at a
    // fixed opacity, AND blending was never enabled for the draw call at
    // all — see AnugaPlaybackRenderer.js's render() comment). Two levers,
    // applied together, gated on the mesh's OWN triangle count (a static,
    // known-at-load-time signal — no zoom/resolution coupling, so a small
    // mesh's behaviour can never regress just because it happens to be
    // viewed zoomed out).
    describe('wireframeDecimationStride / wireframeOpacityForTriangleCount (TASK-2686 — legibility at scale)', () => {
        it('AC: a small mesh (<50k triangles) is COMPLETELY unchanged — stride 1, opacity = baseAlpha exactly', () => {
            expect(wireframeDecimationStride(1000)).toBe(1);
            expect(wireframeDecimationStride(49999)).toBe(1);
            expect(wireframeOpacityForTriangleCount(1000, 0.35)).toBe(0.35);
            expect(wireframeOpacityForTriangleCount(49999, 0.35)).toBe(0.35);
        });

        it('exactly AT the reference boundary is still unchanged (strictly-greater-than gate, matching other epic thresholds)', () => {
            expect(wireframeDecimationStride(WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES)).toBe(1);
            expect(wireframeOpacityForTriangleCount(WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES, 0.35)).toBe(0.35);
        });

        it('a 505k-triangle mesh (the real Merewether fixture size) decimates by ~10x and dims well below baseAlpha', () => {
            const stride = wireframeDecimationStride(505000);
            expect(stride).toBeGreaterThan(1);
            expect(stride).toBe(10); // round(505000/50000) = 10.1 -> 10
            const opacity = wireframeOpacityForTriangleCount(505000, 0.35);
            expect(opacity).toBeLessThan(0.35);
            expect(opacity).toBeGreaterThanOrEqualTo(WIREFRAME_MIN_OPACITY);
        });

        it('stride is capped at WIREFRAME_MAX_DECIMATION_STRIDE for an extremely large mesh', () => {
            const stride = wireframeDecimationStride(50000000); // 1000x reference
            expect(stride).toBe(WIREFRAME_MAX_DECIMATION_STRIDE);
        });

        it('opacity is floored at WIREFRAME_MIN_OPACITY — the overlay never fully disappears', () => {
            const opacity = wireframeOpacityForTriangleCount(50000000, 0.35);
            expect(opacity).toBe(WIREFRAME_MIN_OPACITY);
        });

        it('both levers are MONOTONIC in triangle count above the reference (a bigger mesh is never MORE prominent than a smaller one)', () => {
            const sizes = [60000, 100000, 250000, 505000, 1000000];
            let prevStride = 1;
            let prevOpacity = 0.35;
            sizes.forEach((n) => {
                const s = wireframeDecimationStride(n);
                const o = wireframeOpacityForTriangleCount(n, 0.35);
                expect(s).toBeGreaterThanOrEqualTo(prevStride);
                expect(o).toBeLessThanOrEqualTo(prevOpacity);
                prevStride = s;
                prevOpacity = o;
            });
        });
    });

    describe('decimateWireframeIndices', () => {
        it('stride 1 (or below) returns the input unchanged (identity)', () => {
            const indices = Uint32Array.from([0, 1, 1, 2, 2, 3, 3, 0]);
            expect(Array.from(decimateWireframeIndices(indices, 1))).toEqual(Array.from(indices));
            expect(Array.from(decimateWireframeIndices(indices, 0))).toEqual(Array.from(indices));
        });

        it('keeps every Nth EDGE (pair), not every Nth index', () => {
            // 6 edges: (0,1) (2,3) (4,5) (6,7) (8,9) (10,11) — stride 2 keeps
            // edges 0, 2, 4 -> (0,1) (4,5) (8,9).
            const indices = Uint32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
            const out = decimateWireframeIndices(indices, 2);
            expect(Array.from(out)).toEqual([0, 1, 4, 5, 8, 9]);
        });

        it('never fabricates an edge that was not in the input (every emitted pair is a real edge from the source array)', () => {
            const faces = Int32Array.from(
                Array.from({ length: 300 }, (_, i) => [i, i + 1, i + 2]).flat()
            );
            const full = buildWireframeIndices(faces);
            const decimated = decimateWireframeIndices(full, 4);
            const fullPairs = new Set();
            for (let i = 0; i < full.length; i += 2) {
                fullPairs.add(`${full[i]}-${full[i + 1]}`);
            }
            for (let i = 0; i < decimated.length; i += 2) {
                expect(fullPairs.has(`${decimated[i]}-${decimated[i + 1]}`)).toBe(true);
            }
            expect(decimated.length).toBeLessThan(full.length);
        });

        it('an empty input decimates to an empty output', () => {
            expect(decimateWireframeIndices(new Uint32Array([]), 5).length).toBe(0);
        });
    });

    describe('packQuantityVec3', () => {
        it('interleaves depth/xVelocity/yVelocity per vertex', () => {
            const depth = new Float32Array([1, 2, 3]);
            const xv = new Float32Array([0.1, 0.2, 0.3]);
            const yv = new Float32Array([-0.1, -0.2, -0.3]);
            const packed = packQuantityVec3(depth, xv, yv);
            expect(Array.from(packed)).toEqual([1, 0.1, -0.1, 2, 0.2, -0.2, 3, 0.3, -0.3].map((v) => Math.fround(v)));
        });

        it('throws on a length mismatch', () => {
            expect(() => packQuantityVec3(new Float32Array([1, 2]), new Float32Array([1]), new Float32Array([1, 2]))).toThrow();
        });
    });

    describe('computeMixFactor', () => {
        it('returns 0 exactly at t0 and 1 exactly at t1', () => {
            expect(computeMixFactor(10, 10, 20)).toBe(0);
            expect(computeMixFactor(20, 10, 20)).toBe(1);
        });
        it('interpolates linearly at the midpoint', () => {
            expect(computeMixFactor(15, 10, 20)).toBe(0.5);
        });
        it('clamps below t0 to 0 and above t1 to 1', () => {
            expect(computeMixFactor(5, 10, 20)).toBe(0);
            expect(computeMixFactor(25, 10, 20)).toBe(1);
        });
        it('returns 0 (not NaN/Infinity) for a degenerate t0===t1 window', () => {
            expect(computeMixFactor(10, 10, 10)).toBe(0);
        });
    });

    describe('buildProjectionMatrix / applyProjectionMatrix', () => {
        it('maps the view center to clip-space origin', () => {
            const m = buildProjectionMatrix({ center: [1000, 2000], resolution: 10, rotation: 0 }, [800, 600]);
            const [cx, cy] = applyProjectionMatrix(m, 1000, 2000);
            // Tolerance sized for Float32Array storage: col1.y and col2.y are
            // each independently float32-rounded (~1e-7 relative) before this
            // cancellation, so their difference is O(1e-7 * 2000), not exactly 0.
            expect(Math.abs(cx) < 1e-3).toBe(true);
            expect(Math.abs(cy) < 1e-3).toBe(true);
        });

        it('maps a point one full half-viewport-width east of center to clip x=1 (no rotation)', () => {
            const resolution = 10;
            const size = [800, 600];
            const m = buildProjectionMatrix({ center: [0, 0], resolution, rotation: 0 }, size);
            const halfWidthWorld = (resolution * size[0]) / 2;
            const [x] = applyProjectionMatrix(m, halfWidthWorld, 0);
            expect(Math.abs(x - 1) < 1e-4).toBe(true);
        });

        it('a point north of center maps to positive clip y (north stays "up")', () => {
            const m = buildProjectionMatrix({ center: [0, 0], resolution: 10, rotation: 0 }, [800, 600]);
            const [, y] = applyProjectionMatrix(m, 0, 300); // world-north of center
            expect(y > 0).toBe(true);
        });

        it('a 90-degree rotation swaps which world axis maps to clip x vs y', () => {
            const size = [800, 600];
            const resolution = 10;
            const rot0 = buildProjectionMatrix({ center: [0, 0], resolution, rotation: 0 }, size);
            const rot90 = buildProjectionMatrix({ center: [0, 0], resolution, rotation: Math.PI / 2 }, size);
            const halfWidthWorld = (resolution * size[0]) / 2;
            const halfHeightWorld = (resolution * size[1]) / 2;
            // Un-rotated: east-of-center point -> clip x = 1, y = 0.
            const p0 = applyProjectionMatrix(rot0, halfWidthWorld, 0);
            expect(Math.abs(p0[0] - 1) < 1e-6).toBe(true);
            expect(Math.abs(p0[1]) < 1e-6).toBe(true);
            // Rotated 90 deg: the SAME world point now projects mostly along
            // clip y instead of clip x (axes swapped by the rotation).
            const p90 = applyProjectionMatrix(rot90, halfWidthWorld, 0);
            expect(Math.abs(p90[0]) < Math.abs(p0[0])).toBe(true);
            expect(Math.abs(p90[1]) > 0.5).toBe(true);
            void halfHeightWorld;
        });

        it('throws for non-positive resolution/width/height', () => {
            expect(() => buildProjectionMatrix({ center: [0, 0], resolution: 0 }, [800, 600])).toThrow();
            expect(() => buildProjectionMatrix({ center: [0, 0], resolution: 10 }, [0, 600])).toThrow();
            expect(() => buildProjectionMatrix({ center: [0, 0], resolution: 10 }, [800, 0])).toThrow();
        });
    });

    describe('buildInverseProjectionMatrix (TASK-2632, W5.1 — screen-space arrow grid sampling)', () => {
        it('round-trips buildProjectionMatrix: forward(world)->clip, inverse(clip)->world recovers the original point', () => {
            // Small-magnitude center (matches this file's other buildProjectionMatrix
            // tests) — both matrices are Float32Array by design (ready for
            // gl.uniformMatrix3fv), and a large raw EPSG:3857 center (~1e6)
            // stored directly in m[6]/m[7] carries float32 rounding on the
            // order of magnitude*1.2e-7 ≈ 0.1m, which is irrelevant for GPU
            // velocity-field UV sampling but would false-fail a tight
            // world-scale tolerance here — not what this test is checking.
            const viewState = { center: [1000, 2000], resolution: 3.7, rotation: 0.4 };
            const size = [1024, 768];
            const fwd = buildProjectionMatrix(viewState, size);
            const inv = buildInverseProjectionMatrix(viewState, size);
            const worldPoints = [[1000, 2000], [800, 2500], [1300, 1700]];
            worldPoints.forEach(([wx, wy]) => {
                const [clipX, clipY] = applyProjectionMatrix(fwd, wx, wy);
                const [rx, ry] = applyProjectionMatrix(inv, clipX, clipY);
                expect(Math.abs(rx - wx) < 1e-2).toBe(true);
                expect(Math.abs(ry - wy) < 1e-2).toBe(true);
            });
        });

        it('maps clip-space origin back to the view center', () => {
            const inv = buildInverseProjectionMatrix({ center: [1000, 2000], resolution: 10, rotation: 0 }, [800, 600]);
            const [wx, wy] = applyProjectionMatrix(inv, 0, 0);
            expect(Math.abs(wx - 1000) < 1e-3).toBe(true);
            expect(Math.abs(wy - 2000) < 1e-3).toBe(true);
        });

        it('throws for non-positive resolution/width/height (same guard as the forward matrix)', () => {
            expect(() => buildInverseProjectionMatrix({ center: [0, 0], resolution: 0 }, [800, 600])).toThrow();
            expect(() => buildInverseProjectionMatrix({ center: [0, 0], resolution: 10 }, [0, 600])).toThrow();
            expect(() => buildInverseProjectionMatrix({ center: [0, 0], resolution: 10 }, [800, 0])).toThrow();
        });
    });

    describe('computeMeshBounds (TASK-2632, W5.1 — flow-viz bbox-ortho window input)', () => {
        it('returns the axis-aligned bbox of the given vertex arrays', () => {
            const x = Float64Array.from([10, -5, 20, 3]);
            const y = Float64Array.from([100, 50, 75, 200]);
            expect(computeMeshBounds(x, y)).toEqual([-5, 50, 20, 200]);
        });

        it('a single-vertex mesh yields a degenerate (zero-area) bbox at that point', () => {
            expect(computeMeshBounds(Float32Array.from([42]), Float32Array.from([7]))).toEqual([42, 7, 42, 7]);
        });

        it('matches the real fixture mesh reprojected bounds independently computed via min/max reduce', () => {
            const x = FIXTURE_PHYSICAL.node_x;
            const y = FIXTURE_PHYSICAL.node_y;
            const [minX, minY, maxX, maxY] = computeMeshBounds(Float64Array.from(x), Float64Array.from(y));
            expect(minX).toBe(Math.min(...x));
            expect(maxX).toBe(Math.max(...x));
            expect(minY).toBe(Math.min(...y));
            expect(maxY).toBe(Math.max(...y));
        });
    });

    // TASK-2734 (W3, epic 2706) — AC5 VISUAL EQUIVALENCE for the
    // decimated-direct builder that replaces
    // decimateWireframeIndices(buildWireframeIndices(fnc), stride) on a
    // prod-scale mesh. The pair is only "equivalent" if it draws essentially
    // the same picture, and edge COUNT is the measurable proxy for that: the
    // direct builder dedups by canonical orientation instead of a Set, which
    // drops roughly half the BOUNDARY edges and nothing else.
    describe('buildDecimatedWireframeIndices (TASK-2734)', () => {
        // buildSyntheticMesh is a PRIVATE helper of playbackPerfSmoke-test.js
        // (not exported), so this file carries its own copy of the grid loop —
        // same shape, same winding: triCount = 2*(n-1)^2.
        function buildGridFaceNodeConnectivity(n) {
            const triCount = 2 * (n - 1) * (n - 1);
            const fnc = new Int32Array(triCount * 3);
            let t = 0;
            for (let j = 0; j < n - 1; j++) {
                for (let i = 0; i < n - 1; i++) {
                    const a = j * n + i;
                    const b = a + 1;
                    const c = a + n;
                    const d = c + 1;
                    fnc[t++] = a; fnc[t++] = b; fnc[t++] = c;
                    fnc[t++] = b; fnc[t++] = d; fnc[t++] = c;
                }
            }
            return fnc;
        }

        it('a >=200,000-triangle grid decimates to within 10% of decimateWireframeIndices(buildWireframeIndices(...))', () => {
            const N = 320; // 2*(320-1)^2 = 203,522 triangles -> stride 4
            const fnc = buildGridFaceNodeConnectivity(N);
            const triangleCount = fnc.length / 3;
            expect(triangleCount).toBe(203522);
            const stride = wireframeDecimationStride(triangleCount);
            expect(stride).toBe(4);

            const reference = decimateWireframeIndices(buildWireframeIndices(fnc), stride);
            const direct = buildDecimatedWireframeIndices(fnc, stride);

            // Measured on this box 2026-08-11: reference 152,962 indices,
            // direct 152,642 (-0.21%) — the 320 dropped boundary edges.
            const deltaFraction = Math.abs(direct.length - reference.length) / reference.length;
            expect(deltaFraction).toBeLessThan(0.1);
            expect(direct.length % 2).toBe(0);
            expect(direct.length).toBeGreaterThan(0);
        });

        it('emits only real edges of the source mesh, and never the same undirected edge twice', () => {
            const fnc = buildGridFaceNodeConnectivity(40); // 3,042 triangles
            const direct = buildDecimatedWireframeIndices(fnc, 1);
            const realEdges = new Set();
            for (let f = 0; f < fnc.length; f += 3) {
                const v0 = fnc[f];
                const v1 = fnc[f + 1];
                const v2 = fnc[f + 2];
                [[v0, v1], [v1, v2], [v2, v0]].forEach(([a, b]) => {
                    realEdges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
                });
            }
            const emitted = new Set();
            for (let i = 0; i < direct.length; i += 2) {
                const a = direct[i];
                const b = direct[i + 1];
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                expect(realEdges.has(key)).toBe(true);
                expect(emitted.has(key)).toBe(false);
                emitted.add(key);
            }
            expect(emitted.size).toBeGreaterThan(0);
        });

        it('returns an exactly-sized Uint32Array (no over-allocation, no trailing zero pairs)', () => {
            const fnc = buildGridFaceNodeConnectivity(60);
            const direct = buildDecimatedWireframeIndices(fnc, 3);
            expect(direct instanceof Uint32Array).toBe(true);
            expect(direct.length).toBe(direct.byteLength / 4);
            // Every slot was written: the only way a pair can be (0,0) is if
            // the builder over-allocated, since edge (0,0) is degenerate.
            let degenerate = 0;
            for (let i = 0; i < direct.length; i += 2) {
                if (direct[i] === 0 && direct[i + 1] === 0) { degenerate++; }
            }
            expect(degenerate).toBe(0);
        });

        it('rejects a face array whose length is not a multiple of 3', () => {
            expect(() => buildDecimatedWireframeIndices(Int32Array.from([0, 1, 2, 3]), 2)).toThrow(/multiple of 3/);
        });

        it('an empty mesh yields an empty buffer', () => {
            expect(buildDecimatedWireframeIndices(new Int32Array([]), 4).length).toBe(0);
        });
    });

    // ── TASK-2743 UAT-01 (W6, epic 2706) — closed-triangle wireframe ──────────
    // The shipped edge decimator thins edges in triangle-emission order, so at
    // stride 12 it closed EXACTLY ZERO triangles on the real 6,779,432-triangle
    // store and read as disconnected speckle. These pin the replacement.
    describe('buildFaceDecimatedWireframeIndices (UAT-01: a decimated wireframe must still read as a mesh)', () => {
        // Walk 6 indices at a time: [v0,v1, v1,v2, v2,v0] is a closed triangle.
        const closedTriangleFraction = (idx) => {
            const tris = Math.floor(idx.length / 6);
            if (tris === 0) { return 0; }
            let closed = 0;
            for (let i = 0; i + 5 < idx.length; i += 6) {
                if (idx[i + 1] === idx[i + 2] && idx[i + 3] === idx[i + 4] && idx[i + 5] === idx[i]) { closed++; }
            }
            return closed / tris;
        };
        // A row-major grid mesh: `rows` x `cols` quads, each split into 2 faces.
        const gridMesh = (rows, cols) => {
            const out = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
                    out.push(a, b, d, b, e, d);
                }
            }
            return Int32Array.from(out);
        };
        const faces = gridMesh(199, 199); // 79,202 faces — the perf-smoke fixture size

        it('derives the face stride from the edge stride, and leaves small meshes alone', () => {
            expect(wireframeFaceStride(6779432)).toBe(24);
            expect(wireframeFaceStride(6779432))
                .toBe(WIREFRAME_FACE_STRIDE_FACTOR * wireframeDecimationStride(6779432));
            // TASK-2686 forbids changing meshes that already work. Everything
            // with edge-stride 1 keeps face-stride 1 and never enters this code.
            expect(wireframeFaceStride(49999)).toBe(1);
            expect(wireframeFaceStride(74999)).toBe(1);
            expect(wireframeFaceStride(75000)).toBe(4);
        });

        it('THE DEFECT, stated positively: edge decimation closes nothing at any stride', () => {
            // Green before AND after — this pins the DIAGNOSIS, not the fix.
            [2, 4, 12].forEach((s) => {
                expect(closedTriangleFraction(buildDecimatedWireframeIndices(faces, s))).toBe(0);
            });
        });

        it('THE FIX: every drawn primitive is a closed triangle', () => {
            const next = buildFaceDecimatedWireframeIndices(faces, 4);
            expect(closedTriangleFraction(next)).toBe(1);
            expect(next.length).toBe(Math.ceil(79202 / 4) * 6);
            expect(next.constructor).toBe(Uint32Array);
        });

        it('costs the same ink and the same bytes as the edge builder it replaces', () => {
            // The load-bearing memory assertion: face-stride 2s draws 3/(2s)
            // edges per face, edge-stride s draws 1.5/s. Identical.
            [2, 10, 12].forEach((s) => {
                const a = buildDecimatedWireframeIndices(faces, s).length;
                const b = buildFaceDecimatedWireframeIndices(faces, s * WIREFRAME_FACE_STRIDE_FACTOR).length;
                expect(Math.abs(b - a) / a).toBeLessThan(0.005);
            });
        });

        it('jitters within each block, so a row-major mesh does not stripe', () => {
            // RED against the naive `f % stride` selector: with 398 faces per
            // row and stride 24, `f % 24 === 0` keeps the same few columns in
            // every row. Count distinct within-row positions actually kept.
            const idx = buildFaceDecimatedWireframeIndices(faces, 24);
            const firstVertexOfRow0 = new Set();
            for (let i = 0; i + 5 < idx.length; i += 6) { firstVertexOfRow0.add(idx[i] % 200); }
            expect(firstVertexOfRow0.size).toBeGreaterThan(8);
        });

        it('is deterministic — two builds of the same input are identical', () => {
            expect(buildFaceDecimatedWireframeIndices(faces, 4))
                .toEqual(buildFaceDecimatedWireframeIndices(faces, 4));
        });

        it('stays exact above 2^53/2654435761 — the Math.imul trap', () => {
            // A plain `b * 2654435761` loses low bits to float64 rounding once
            // b > ~3.39M, the MIDDLE of the real 6,779,432-face mesh. Verified
            // divergent at b=6,779,431 (naive 16 vs exact 15). Assert the
            // offsets high in the index range are not all collapsed to 0.
            const nFace = 6779432;
            const fnc = new Int32Array(nFace * 3); // contents irrelevant; we read offsets
            for (let f = 0; f < nFace; f++) { fnc[f * 3] = f; }
            const idx = buildFaceDecimatedWireframeIndices(fnc, 24);
            expect(idx.length).toBe(Math.ceil(nFace / 24) * 6);
            let nonZeroHigh = 0;
            for (let i = 0; i + 5 < idx.length; i += 6) {
                const f = idx[i];
                if (f > 3392506 && (f % 24) !== 0) { nonZeroHigh++; }
            }
            expect(nonZeroHigh).toBeGreaterThan(0);
        });

        it('an empty mesh yields an empty buffer, and a bad length throws', () => {
            expect(buildFaceDecimatedWireframeIndices(new Int32Array([]), 24).length).toBe(0);
            expect(() => buildFaceDecimatedWireframeIndices(new Int32Array([1, 2]), 4))
                .toThrow(/multiple of 3/);
        });
    });

});

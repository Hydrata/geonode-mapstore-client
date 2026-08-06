/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2628 (W3.2, epic 2618) — playbackIdentify spec: point-in-triangle
 * location, barycentric interpolation, and the frame0/frame1 mixT blend
 * (mirroring the renderer's own two-buffer shader math), against both a
 * hand-computable synthetic mesh and the REAL exporter-generated fixture
 * mesh (fixturePlaybackStore — same fixture playbackChunkFetcher-test.js
 * and playbackMeshGeometry-test.js already cross-verify against).
 */
import expect from 'expect';
import {
    computeBarycentric,
    locatePointInMesh,
    barycentricInterpolate,
    sampleFieldAtPoint
} from '../playbackIdentify';
import { FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixtures/fixturePlaybackStore';

// A 2x3 grid of nodes (two 10x10 squares, each split into 2 triangles) —
// the SAME layout as fixturePlaybackStore's synthetic mesh:
//   3(0,10) 4(10,10) 5(20,10)
//   0(0,0)  1(10,0)  2(20,0)
// faces: [0,1,3] [1,4,3] [1,2,4] [2,5,4]
const NODE_X = [0, 10, 20, 0, 10, 20];
const NODE_Y = [0, 0, 0, 10, 10, 10];
const FACES = new Int32Array([0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);

describe('playbackIdentify', () => {
    describe('computeBarycentric', () => {
        it('a point AT a triangle vertex gets weight 1 on that vertex, 0 on the others', () => {
            const bary = computeBarycentric(0, 0, 0, 0, 10, 0, 0, 10);
            expect(bary.u).toBe(1);
            expect(bary.v).toBe(0);
            expect(bary.w).toBe(0);
        });

        it('the centroid gets equal 1/3 weights', () => {
            const bary = computeBarycentric(10 / 3, 10 / 3, 0, 0, 10, 0, 0, 10);
            expect(Math.abs(bary.u - 1 / 3) < 1e-9).toBe(true);
            expect(Math.abs(bary.v - 1 / 3) < 1e-9).toBe(true);
            expect(Math.abs(bary.w - 1 / 3) < 1e-9).toBe(true);
        });

        it('a point outside the triangle returns null', () => {
            expect(computeBarycentric(100, 100, 0, 0, 10, 0, 0, 10)).toBe(null);
        });

        it('a degenerate (zero-area/collinear) triangle returns null, not NaN/Infinity', () => {
            expect(computeBarycentric(1, 0, 0, 0, 10, 0, 20, 0)).toBe(null);
        });

        it('a point exactly on a shared edge is treated as inside (epsilon-tolerant)', () => {
            // Midpoint of the (10,0)-(0,10) edge — shared by [0,1,3] and [1,4,3].
            const bary = computeBarycentric(5, 5, 0, 0, 10, 0, 0, 10);
            expect(bary).toBeTruthy();
        });
    });

    describe('barycentricInterpolate', () => {
        it('weighted-sums three vertex values', () => {
            expect(barycentricInterpolate({ u: 0.5, v: 0.3, w: 0.2 }, 10, 20, 30)).toBe(0.5 * 10 + 0.3 * 20 + 0.2 * 30);
        });
    });

    describe('locatePointInMesh (synthetic 2x3 grid)', () => {
        it('finds the correct face for a point inside it', () => {
            const hit = locatePointInMesh(NODE_X, NODE_Y, FACES, 10 / 3, 10 / 3);
            expect(hit.faceIndex).toBe(0);
            expect([hit.i0, hit.i1, hit.i2]).toEqual([0, 1, 3]);
        });

        it('finds the face on the far side of the grid', () => {
            // Centroid of face 3 ([2,5,4]): ((20+20+10)/3, (0+10+10)/3)
            const hit = locatePointInMesh(NODE_X, NODE_Y, FACES, 50 / 3, 20 / 3);
            expect(hit.faceIndex).toBe(3);
        });

        it('returns null for a point outside every face', () => {
            expect(locatePointInMesh(NODE_X, NODE_Y, FACES, -50, -50)).toBe(null);
        });
    });

    describe('sampleFieldAtPoint (synthetic, hand-computed)', () => {
        const mesh = { x3857: NODE_X, y3857: NODE_Y, faceNodeConnectivity: FACES };
        // Per-node depth, two frames.
        const frame0 = {
            depth: new Float32Array([1, 2, 3, 4, 5, 6]),
            xVelocity: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
            yVelocity: new Float32Array([0, 0, 0, 0, 0, 0])
        };
        const frame1 = {
            depth: new Float32Array([2, 4, 6, 8, 10, 12]),
            xVelocity: new Float32Array([0.2, 0.4, 0.6, 0.8, 1.0, 1.2]),
            yVelocity: new Float32Array([0, 0, 0, 0, 0, 0])
        };

        it('at mixT=0, exactly reproduces frame0 at a triangle vertex', () => {
            const r = sampleFieldAtPoint(mesh, frame0, frame1, 0, 0, 0); // node 0
            expect(r.located).toBe(true);
            expect(r.surface).toBe('vertex-smoothed');
            expect(r.depth).toBe(1);
            expect(Math.abs(r.xVelocity - 0.1) < 1e-6).toBe(true);
        });

        it('at mixT=1, exactly reproduces frame1 at a triangle vertex', () => {
            const r = sampleFieldAtPoint(mesh, frame0, frame1, 1, 0, 0);
            expect(r.depth).toBe(2);
        });

        it('at mixT=0.5, linearly blends frame0/frame1 at a triangle vertex', () => {
            const r = sampleFieldAtPoint(mesh, frame0, frame1, 0.5, 0, 0);
            expect(r.depth).toBe(1.5); // (1+2)/2
        });

        it('at a face centroid, averages the 3 vertex values (bary=1/3 each)', () => {
            // Face 0 = nodes [0,1,3] -> depth frame0 = [1,2,4]
            const r = sampleFieldAtPoint(mesh, frame0, frame1, 0, 10 / 3, 10 / 3);
            const expected = (1 + 2 + 4) / 3;
            expect(Math.abs(r.depth - expected) < 1e-6).toBe(true);
        });

        it('outside the mesh returns located:false with no numeric fields', () => {
            const r = sampleFieldAtPoint(mesh, frame0, frame1, 0, -100, -100);
            expect(r).toEqual({ located: false, surface: 'vertex-smoothed' });
        });

        it('below the wet threshold, zeroes velocity/speed but still reports depth', () => {
            const dryFrame0 = { depth: new Float32Array([0, 0, 0, 0, 0, 0]), xVelocity: new Float32Array([9, 9, 9, 9, 9, 9]), yVelocity: new Float32Array([9, 9, 9, 9, 9, 9]) };
            const r = sampleFieldAtPoint(mesh, dryFrame0, dryFrame0, 0, 0, 0, 1e-5);
            expect(r.wet).toBe(false);
            expect(r.depth).toBe(0);
            expect(r.xVelocity).toBe(0);
            expect(r.yVelocity).toBe(0);
            expect(r.speed).toBe(0);
        });

        it('speed is the vector magnitude of the blended x/y velocity', () => {
            const wetMesh = { x3857: NODE_X, y3857: NODE_Y, faceNodeConnectivity: FACES };
            const f = {
                depth: new Float32Array([1, 1, 1, 1, 1, 1]),
                xVelocity: new Float32Array([3, 3, 3, 3, 3, 3]),
                yVelocity: new Float32Array([4, 4, 4, 4, 4, 4])
            };
            const r = sampleFieldAtPoint(wetMesh, f, f, 0, 0, 0);
            expect(r.speed).toBe(5); // 3-4-5 triangle
        });
    });

    // TASK-2629 (W4.1) — the six derived-quantity fields sampleFieldAtPoint
    // adds when `geometry`/`constants` are supplied, mirroring
    // playbackDerivedQuantities' formulas exactly (both consume the SAME
    // exported functions, so this proves the wiring/gating, not the maths —
    // that is playbackDerivedQuantities-test.js's job).
    describe('sampleFieldAtPoint derived quantities (stage/div/froude/shear/courant/hazard)', () => {
        const mesh = { x3857: NODE_X, y3857: NODE_Y, faceNodeConnectivity: FACES };
        // Wet, uniform field for hand-checkable formula results at node 0
        // (bary weight 1): depth=4, speed=3 (xVelocity=3, yVelocity=0).
        const wetFrame = {
            depth: new Float32Array([4, 4, 4, 4, 4, 4]),
            xVelocity: new Float32Array([3, 3, 3, 3, 3, 3]),
            yVelocity: new Float32Array([0, 0, 0, 0, 0, 0])
        };
        const geometry = {
            elevation: new Float32Array([10, 10, 10, 10, 10, 10]),
            friction: new Float32Array([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]),
            inradius: new Float32Array([2, 2, 2, 2, 2, 2])
        };
        const constants = { g: 9.8, rhoW: 1023, dtSeconds: 1.5 };

        it('omits stage/shear/courant when geometry is not supplied (backward compatible with W3 callers)', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0);
            expect(r.stage).toBe(undefined);
            expect(r.shear).toBe(undefined);
            expect(r.courant).toBe(undefined);
            // div/froude/hazard need no geometry (depth+speed only) — always present.
            expect(typeof r.div).toBe('number');
            expect(typeof r.froude).toBe('number');
            expect(typeof r.hazardClass).toBe('string');
        });

        it('stage = elevation + depth at the sampled point', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0, 1e-5, geometry, constants);
            expect(r.stage).toBe(14); // elevation 10 + depth 4
        });

        it('div = depth * speed', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0, 1e-5, geometry, constants);
            expect(r.div).toBe(12); // depth 4 * speed 3
        });

        it('froude = speed / sqrt(g*depth)', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0, 1e-5, geometry, constants);
            const expected = 3 / Math.sqrt(9.8 * 4);
            expect(Math.abs(r.froude - expected) < 1e-6).toBe(true);
        });

        it('shear = rhoW*g*n^2*speed^2/depth^(1/3) when friction geometry is supplied', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0, 1e-5, geometry, constants);
            const expected = (1023 * 9.8 * 0.05 * 0.05 * 3 * 3) / Math.cbrt(4);
            // geometry.friction is a Float32Array (matches the real store's
            // per-vertex Manning n) — 0.05 has no exact float32
            // representation, and squaring it amplifies the ~7e-9 storage
            // error to ~4e-6 after the rhoW*g*speed^2 scale-up, so this
            // needs a looser tolerance than the plain-number-input formula
            // cases above (a real divergence would be orders of magnitude
            // bigger than float32 rounding, so 1e-3 stays a meaningful check).
            expect(Math.abs(r.shear - expected) < 1e-3).toBe(true);
        });

        it('courant = sqrt(g*depth)*dtSeconds/inradius when inradius geometry is supplied', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0, 1e-5, geometry, constants);
            const expected = (Math.sqrt(9.8 * 4) * 1.5) / 2;
            expect(Math.abs(r.courant - expected) < 1e-6).toBe(true);
        });

        it('hazardClass/hazardClassIndex are always present (no geometry required)', () => {
            const r = sampleFieldAtPoint(mesh, wetFrame, wetFrame, 0, 0, 0);
            expect(typeof r.hazardClass).toBe('string');
            expect(typeof r.hazardClassIndex).toBe('number');
        });

        it('courant is 0 on a dry cell (depth below wetThreshold) even though depth>0 (matches the shader\'s wet mask, not just computeCourant\'s own d<=0 guard)', () => {
            const barelyWetFrame = {
                depth: new Float32Array([0.001, 0.001, 0.001, 0.001, 0.001, 0.001]),
                xVelocity: new Float32Array([0, 0, 0, 0, 0, 0]),
                yVelocity: new Float32Array([0, 0, 0, 0, 0, 0])
            };
            // wetThreshold=0.005 > depth=0.001 -> dry, despite depth>0.
            const r = sampleFieldAtPoint(mesh, barelyWetFrame, barelyWetFrame, 0, 0, 0, 0.005, geometry, constants);
            expect(r.wet).toBe(false);
            expect(r.courant).toBe(0);
        });

        it('froude/shear are 0 on a dry cell (speed already zeroed by the existing wet gate)', () => {
            const dryFrame = { depth: new Float32Array([0, 0, 0, 0, 0, 0]), xVelocity: new Float32Array([9, 9, 9, 9, 9, 9]), yVelocity: new Float32Array([9, 9, 9, 9, 9, 9]) };
            const r = sampleFieldAtPoint(mesh, dryFrame, dryFrame, 0, 0, 0, 1e-5, geometry, constants);
            expect(r.froude).toBe(0);
            expect(r.shear).toBe(0);
        });

        it('stage is still reported on a dry cell (unmasked by wetness, per computeStage\'s own contract)', () => {
            const dryFrame = { depth: new Float32Array([0, 0, 0, 0, 0, 0]), xVelocity: new Float32Array([0, 0, 0, 0, 0, 0]), yVelocity: new Float32Array([0, 0, 0, 0, 0, 0]) };
            const r = sampleFieldAtPoint(mesh, dryFrame, dryFrame, 0, 0, 0, 1e-5, geometry, constants);
            expect(r.stage).toBe(10); // elevation only, depth clamped to 0
        });
    });

    describe('sampleFieldAtPoint against the REAL exporter-generated fixture mesh', () => {
        it('at a face centroid, matches a hand-averaged expectation from FIXTURE_PHYSICAL depth (t=5)', () => {
            const flatFaces = new Int32Array(FIXTURE_PHYSICAL.face_node_connectivity.flat());
            const mesh = { x3857: FIXTURE_PHYSICAL.node_x, y3857: FIXTURE_PHYSICAL.node_y, faceNodeConnectivity: flatFaces };
            const [i0, i1, i2] = FIXTURE_PHYSICAL.face_node_connectivity[0]; // face 0
            const cx = (FIXTURE_PHYSICAL.node_x[i0] + FIXTURE_PHYSICAL.node_x[i1] + FIXTURE_PHYSICAL.node_x[i2]) / 3;
            const cy = (FIXTURE_PHYSICAL.node_y[i0] + FIXTURE_PHYSICAL.node_y[i1] + FIXTURE_PHYSICAL.node_y[i2]) / 3;
            const depthAtT5 = FIXTURE_PHYSICAL.depth[5];
            const frame = { depth: Float32Array.from(depthAtT5), xVelocity: new Float32Array(FIXTURE_MESH.nNode), yVelocity: new Float32Array(FIXTURE_MESH.nNode) };
            const r = sampleFieldAtPoint(mesh, frame, frame, 0, cx, cy);
            const expected = (depthAtT5[i0] + depthAtT5[i1] + depthAtT5[i2]) / 3;
            expect(r.located).toBe(true);
            expect(Math.abs(r.depth - expected) < 1e-4).toBe(true);
        });
    });
});

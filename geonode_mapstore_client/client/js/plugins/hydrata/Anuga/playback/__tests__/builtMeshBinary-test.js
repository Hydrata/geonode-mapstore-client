/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2630 (W6.1, epic 2618) — builtMeshBinary decode/fetch/layer-options
 * tests, plus a WebGL2-gated smoke test proving the SAME anuga-playback
 * renderer accepts this feed in wireframe-only mode with zero renderer
 * changes (mirrors AnugaPlaybackLayer-test.js's webgl2Available() gate).
 */
import expect from 'expect';
import Layers from '@mapstore/framework/utils/openlayers/Layers';
import '@js/plugins/index'; // registers 'anuga-playback' (side effect)

import {
    decodeBuiltMeshBinary,
    fetchBuiltMeshBinary,
    buildBuiltMeshLayerOptions,
    loadBuiltMeshLayerOptions
} from '../builtMeshBinary';
import { LAYER_TYPE } from '../AnugaPlaybackLayer';

function webgl2Available() {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
}

/**
 * Hand-packs a wire-format buffer identical to Run.build_built_mesh_binary's
 * output, for a tiny 2-triangle mesh (4 nodes) — a small square split into
 * two triangles, matching the format's own docstring exactly (no
 * indirection through the BE at all: this is the pure wire-contract test).
 */
function packFixtureBuffer() {
    const nodeCount = 4;
    const faceCount = 2;
    const nodeX = [321000, 321100, 321100, 321000];
    const nodeY = [5812000, 5812000, 5812100, 5812100];
    const connectivity = [0, 1, 2, 0, 2, 3];

    const buffer = new ArrayBuffer(8 + nodeCount * 4 * 2 + faceCount * 3 * 4);
    const dv = new DataView(buffer);
    dv.setUint32(0, nodeCount, true);
    dv.setUint32(4, faceCount, true);
    let offset = 8;
    nodeX.forEach((v) => { dv.setFloat32(offset, v, true); offset += 4; });
    nodeY.forEach((v) => { dv.setFloat32(offset, v, true); offset += 4; });
    connectivity.forEach((v) => { dv.setInt32(offset, v, true); offset += 4; });
    return { buffer, nodeCount, faceCount, nodeX, nodeY, connectivity };
}

describe('builtMeshBinary', () => {
    describe('decodeBuiltMeshBinary', () => {
        it('decodes header + positions + connectivity from a hand-packed buffer', () => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);

            expect(decoded.nodeCount).toBe(4);
            expect(decoded.faceCount).toBe(2);
            expect(decoded.nodeX.length).toBe(4);
            expect(decoded.nodeY.length).toBe(4);
            expect(decoded.faceNodeConnectivity.length).toBe(6);
            // float32 represents these integer-metre values exactly (well
            // under the 24-bit mantissa's 2^24 exact-integer range).
            expect(decoded.nodeX[0]).toBe(321000);
            expect(decoded.nodeY[2]).toBe(5812100);
            expect(Array.from(decoded.faceNodeConnectivity)).toEqual([0, 1, 2, 0, 2, 3]);
        });

        it('returns typed arrays (Float32Array positions, Int32Array connectivity)', () => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            expect(decoded.nodeX instanceof Float32Array).toBe(true);
            expect(decoded.nodeY instanceof Float32Array).toBe(true);
            expect(decoded.faceNodeConnectivity instanceof Int32Array).toBe(true);
        });

        it('nodeX/nodeY have INDEPENDENT backing buffers (regression: postMessage transfer-list DataCloneError)', () => {
            // AnugaPlaybackLayer.reprojectMeshAsync's Worker path transfers
            // [mesh.nodeX.buffer, mesh.nodeY.buffer] — the SAME ArrayBuffer
            // listed twice throws a synchronous DataCloneError (see this
            // module's header + the WebGL smoke test below, which hung at
            // mocha's timeout before this was fixed). A single-response
            // wire format naturally produces co-located arrays unless the
            // decoder explicitly copies each one out.
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            expect(decoded.nodeX.buffer).toNotBe(decoded.nodeY.buffer);
            expect(decoded.nodeX.buffer).toNotBe(decoded.faceNodeConnectivity.buffer);
        });

        it('throws on a buffer too short for the header', () => {
            expect(() => decodeBuiltMeshBinary(new ArrayBuffer(4))).toThrow();
        });

        it('throws when the buffer length does not match the header-implied length (truncated/corrupt response)', () => {
            const fixture = packFixtureBuffer();
            const truncated = fixture.buffer.slice(0, fixture.buffer.byteLength - 4);
            expect(() => decodeBuiltMeshBinary(truncated)).toThrow();
        });

        it('round-trips a larger mesh (100 triangles) without precision loss beyond float32', () => {
            const nodeCount = 102;
            const faceCount = 100;
            const buffer = new ArrayBuffer(8 + nodeCount * 4 * 2 + faceCount * 3 * 4);
            const dv = new DataView(buffer);
            dv.setUint32(0, nodeCount, true);
            dv.setUint32(4, faceCount, true);
            let offset = 8;
            for (let i = 0; i < nodeCount; i++) {
                dv.setFloat32(offset, 321000 + i * 10, true);
                offset += 4;
            }
            for (let i = 0; i < nodeCount; i++) {
                dv.setFloat32(offset, 5812000 + (i % 2) * 10, true);
                offset += 4;
            }
            for (let f = 0; f < faceCount; f++) {
                dv.setInt32(offset, f, true); offset += 4;
                dv.setInt32(offset, f + 1, true); offset += 4;
                dv.setInt32(offset, f + 2, true); offset += 4;
            }
            const decoded = decodeBuiltMeshBinary(buffer);
            expect(decoded.nodeCount).toBe(nodeCount);
            expect(decoded.faceCount).toBe(faceCount);
            expect(decoded.faceNodeConnectivity[decoded.faceNodeConnectivity.length - 1]).toBe(faceCount + 1);
        });
    });

    describe('fetchBuiltMeshBinary', () => {
        it('GETs the run-scoped URL, reads the X-Mesh-Epsg header, and decodes the body', (done) => {
            const fixture = packFixtureBuffer();
            const fetchImpl = (url, options) => {
                expect(url).toBe('/api/v2/anuga/runs/42/built-mesh-binary/');
                expect(options.credentials).toBe('same-origin');
                return Promise.resolve(new Response(fixture.buffer, {
                    status: 200,
                    headers: { 'X-Mesh-Epsg': '32756' }
                }));
            };
            fetchBuiltMeshBinary(42, fetchImpl).then((decoded) => {
                expect(decoded.epsg).toBe('32756');
                expect(decoded.nodeCount).toBe(4);
                expect(decoded.faceCount).toBe(2);
                done();
            }).catch(done);
        });

        it('rejects on a non-ok response (e.g. run has no Built mesh, 404)', (done) => {
            const fetchImpl = () => Promise.resolve(new Response(null, { status: 404 }));
            fetchBuiltMeshBinary(1, fetchImpl).then(
                () => done(new Error('expected rejection')),
                () => done()
            );
        });
    });

    describe('buildBuiltMeshLayerOptions', () => {
        it('builds anuga-playback options with wireframe:true and zero-filled frames sized to nodeCount', () => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            decoded.epsg = '32756';

            const options = buildBuiltMeshLayerOptions(decoded);

            expect(options.type).toBe(LAYER_TYPE);
            expect(options.wireframe).toBe(true);
            expect(options.mesh.nodeX).toBe(decoded.nodeX);
            expect(options.mesh.nodeY).toBe(decoded.nodeY);
            expect(options.mesh.faceNodeConnectivity).toBe(decoded.faceNodeConnectivity);
            expect(options.mesh.epsg).toBe('32756');
            // No local-frame offset in this source (see this module's header) —
            // explicit 0, not omitted (playbackReproject applies it unconditionally).
            expect(options.mesh.xllcorner).toBe(0);
            expect(options.mesh.yllcorner).toBe(0);
            expect(options.mesh.elevation.length).toBe(decoded.nodeCount);
            expect(options.frame0.depth.length).toBe(decoded.nodeCount);
            expect(options.frame1.depth.length).toBe(decoded.nodeCount);
            expect(Array.from(options.frame0.depth)).toEqual([0, 0, 0, 0]);
        });

        /*
         * TASK-2788 (W7, epic 2706) — this preview asks for an OPAQUE dry-ground
         * sheet explicitly, because it is 100% dry by construction (zero frames
         * above) and that sheet is the entire picture.
         *
         * The playback layer's default became transparent in TASK-2788, which is
         * right for a results run and exactly wrong here: at the default this
         * preview renders nothing but its wireframe, and no control in the app
         * can restore the fill — the Background opacity slider dispatches against
         * the playback run's own layer id and this is a different layer with no
         * control bar. Caught by an adversarial review, not by a test, which is
         * why there is one now.
         */
        it('asks for an OPAQUE background — this preview IS the dry-ground sheet', () => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            const options = buildBuiltMeshLayerOptions(decoded);
            expect(options.backgroundOpacity).toBe(1);
            // the pairing that makes it load-bearing: every vertex is dry, so
            // every pixel of this layer takes the shader's dry branch
            expect(Array.from(options.frame0.depth).every((d) => d === 0)).toBe(true);
            expect(Array.from(options.frame1.depth).every((d) => d === 0)).toBe(true);
        });

        it('accepts a custom id/title', () => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            const options = buildBuiltMeshLayerOptions(decoded, { id: 'custom-id', title: 'Custom title' });
            expect(options.id).toBe('custom-id');
            expect(options.title).toBe('Custom title');
        });
    });

    describe('loadBuiltMeshLayerOptions (fetch + decode + build, one shot)', () => {
        it('resolves ready-to-dispatch layer options from a run id', (done) => {
            const fixture = packFixtureBuffer();
            const fetchImpl = () => Promise.resolve(new Response(fixture.buffer, {
                status: 200,
                headers: { 'X-Mesh-Epsg': '32756' }
            }));
            loadBuiltMeshLayerOptions(7, fetchImpl).then((options) => {
                expect(options.type).toBe(LAYER_TYPE);
                expect(options.mesh.epsg).toBe('32756');
                expect(options.mesh.nodeX.length).toBe(4);
                done();
            }).catch(done);
        });
    });

    describe('WebGL2 smoke: the SAME renderer accepts this feed in wireframe-only mode', function() {
        before(function() {
            if (!webgl2Available()) {
                this.skip();
            }
        });

        it('Layers.createLayer(anuga-playback, builtMeshLayerOptions) does not throw and marks the mesh ready', (done) => {
            const fixture = packFixtureBuffer();
            const decoded = decodeBuiltMeshBinary(fixture.buffer);
            decoded.epsg = '32756';
            const options = buildBuiltMeshLayerOptions(decoded);

            const layer = Layers.createLayer(LAYER_TYPE, options);
            expect(layer).toExist();
            const renderer = layer.__anugaPlaybackRenderer;
            // setMesh runs off a microtask (async reprojection, see
            // AnugaPlaybackLayer.loadMesh) — poll until it lands, same
            // pattern as AnugaPlaybackLayer-test.js's waitForMesh.
            const waitForMesh = () => {
                if (renderer.meshReady) {
                    expect(renderer.nIndices).toBe(fixture.connectivity.length);
                    layer.remove();
                    done();
                    return;
                }
                setTimeout(waitForMesh, 10);
            };
            waitForMesh();
        });
    });
});

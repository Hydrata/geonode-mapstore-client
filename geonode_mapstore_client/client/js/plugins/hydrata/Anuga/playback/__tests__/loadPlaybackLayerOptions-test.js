/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* TASK-2626 (W2.2, epic 2618) — loadPlaybackLayerOptions tests. */
import expect from 'expect';
import { loadPlaybackMesh, loadPlaybackFrame, loadPlaybackLayerOptions, loadPlaybackTime } from '../loadPlaybackLayerOptions';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
// TASK-2724 — loadPlaybackFrame no longer defaults its chunk length; every
// caller resolves it from the store it is reading (see playbackChunkShape-test
// for the both-chunk-lengths proof).
import { resolveChunkLengthT } from '../playbackChunkShape';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST, FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixtures/fixturePlaybackStore';

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function fixtureFetch(url) {
    const b64 = FIXTURE_STORE_FILES[url];
    if (!b64) {
        return Promise.resolve(new Response(null, { status: 404 }));
    }
    return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
}

describe('loadPlaybackLayerOptions', () => {
    describe('loadPlaybackMesh', () => {
        it('loads geometry + georef from the manifest\'s static arrays', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetch });
            loadPlaybackMesh(fetcher).then((mesh) => {
                expect(mesh.nodeX.length).toBe(FIXTURE_MESH.nNode);
                expect(mesh.faceNodeConnectivity.length).toBe(FIXTURE_MESH.nFace * 3);
                expect(mesh.epsg).toBe(FIXTURE_MANIFEST.schema_metadata.epsg);
                expect(mesh.xllcorner).toBe(FIXTURE_MANIFEST.schema_metadata.xllcorner);
                for (let i = 0; i < mesh.nodeX.length; i++) {
                    expect(Math.abs(mesh.nodeX[i] - FIXTURE_PHYSICAL.node_x[i]) < 1e-4).toBe(true);
                }
                done();
            }).catch(done);
        });
    });

    describe('loadPlaybackFrame', () => {
        it('slices out exactly one timestep row per vertex, matching FIXTURE_PHYSICAL', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetch });
            loadPlaybackFrame(fetcher, 5, FIXTURE_MESH.nNode, resolveChunkLengthT(FIXTURE_MANIFEST)).then((frame) => {
                expect(frame.depth.length).toBe(FIXTURE_MESH.nNode);
                const depthQ = FIXTURE_MANIFEST.quantization.depth;
                for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                    expect(Math.abs(frame.depth[n] - FIXTURE_PHYSICAL.depth[5][n]) <= depthQ.scale + 1e-6).toBe(true);
                }
                done();
            }).catch(done);
        });

        it('reads the correct row for a timestep in the SECOND time-chunk', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetch });
            loadPlaybackFrame(fetcher, 11, FIXTURE_MESH.nNode, resolveChunkLengthT(FIXTURE_MANIFEST)).then((frame) => {
                const depthQ = FIXTURE_MANIFEST.quantization.depth;
                for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                    expect(Math.abs(frame.depth[n] - FIXTURE_PHYSICAL.depth[11][n]) <= depthQ.scale + 1e-6).toBe(true);
                }
                done();
            }).catch(done);
        });
    });

    describe('loadPlaybackTime (TASK-2627, W3.1 controller seam extension)', () => {
        it('decodes the real per-timestep simulation-second array', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetch });
            loadPlaybackTime(fetcher).then((time) => {
                expect(time.length).toBe(FIXTURE_MESH.nTime);
                for (let i = 0; i < time.length; i++) {
                    expect(Math.abs(time[i] - FIXTURE_PHYSICAL.time[i]) < 1e-9).toBe(true);
                }
                // Strictly ascending — playbackController.findTimestepBracket
                // assumes this (schema §1: output timesteps are monotonic).
                for (let i = 1; i < time.length; i++) {
                    expect(time[i] > time[i - 1]).toBe(true);
                }
                done();
            }).catch(done);
        });
    });

    describe('loadPlaybackLayerOptions (end-to-end)', () => {
        it('resolves {mesh, frame0, frame1, mixT} ready for Layers.createLayer', (done) => {
            loadPlaybackLayerOptions(FIXTURE_MANIFEST, { fetchImpl: fixtureFetch }, 0).then((options) => {
                expect(options.mesh.nodeX.length).toBe(FIXTURE_MESH.nNode);
                expect(options.frame0.depth.length).toBe(FIXTURE_MESH.nNode);
                expect(options.frame1.depth.length).toBe(FIXTURE_MESH.nNode);
                expect(options.mixT).toBe(0);
                done();
            }).catch(done);
        });
    });
});

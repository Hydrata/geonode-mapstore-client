/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2627 (W3.1, epic 2618) — playbackEpics spec: the real fetch/timer/map
 * glue around the pure playbackController reducer. Uses the SAME real byte
 * fixture (fixturePlaybackStore, exporter-generated) the W2.1 chunk-fetcher
 * suite uses, stubbing only the global `fetch` (PlaybackChunkFetcher/
 * fetchPlaybackManifest's own injection points aren't reachable from inside
 * the epic, which constructs them itself — see playbackEpics.js's header).
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    playbackInitEpic,
    playbackBufferEpic,
    playbackTickEpic,
    playbackSyncLayerEpic,
    fetcherRegistry,
    TICK_INTERVAL_MS
} from '../playbackEpics';
import { ADD_LAYER, CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';
import { PlaybackChunkFetcher } from '../../playbackChunkFetcher';
import {
    playbackInit,
    playbackManifestLoaded,
    playbackPlay,
    playbackPause,
    playbackChunksBuffered,
    playbackTick,
    PLAYBACK_MANIFEST_LOADED,
    PLAYBACK_MANIFEST_FAILED,
    PLAYBACK_CHUNKS_BUFFERED,
    PLAYBACK_CHUNK_BUFFER_ERROR
} from '../../actions/playbackActions';
import { createInitialPlaybackState, playbackControllerReducer } from '../../playbackController';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST, FIXTURE_MESH, FIXTURE_PHYSICAL } from '../../__tests__/fixtures/fixturePlaybackStore';

const MANIFEST_URL = '/api/v2/anuga/runs/1/playback-manifest/';

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function stubGlobalFetch(handler) {
    const original = window.fetch;
    window.fetch = handler;
    return () => {
        window.fetch = original;
    };
}

function fixtureFetchHandler(url) {
    if (url === MANIFEST_URL) {
        return Promise.resolve(new Response(JSON.stringify(FIXTURE_MANIFEST), { status: 200 }));
    }
    const b64 = FIXTURE_STORE_FILES[url];
    if (!b64) {
        return Promise.resolve(new Response(null, { status: 404 }));
    }
    return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
}

// Mirrors the codebase's own epic-test harness (warmTilesEpic-test.js etc.):
// a Rx.Subject standing in for redux-observable's ActionsObservable, with a
// hand-rolled `.ofType`.
function makeActionsSubject() {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter((a) => types.includes(a.type));
    return { subject, action$ };
}

function makeStore(initialPlaybackState, extra = {}) {
    // NOT `state.playback` — MapStore2 core owns that key for its own
    // Timeline plugin; the real app registers this slice as `anugaPlayback`
    // (see playbackEpics.js's header note for how the collision was found).
    let state = { anugaPlayback: initialPlaybackState, layers: { flat: [] }, ...extra };
    return {
        getState: () => state,
        // test-only setter so a test can advance playback state between
        // dispatches without re-implementing the reducer.
        __setPlayback: (pb) => { state = { ...state, anugaPlayback: pb }; },
        __setLayers: (flat) => { state = { ...state, layers: { flat } }; }
    };
}

describe('playbackEpics', () => {
    afterEach(() => {
        fetcherRegistry.clear();
    });

    describe('playbackInitEpic', () => {
        it('adds a placeholder layer (when missing) and dispatches MANIFEST_LOADED with real decoded mesh+time', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (seen.some((x) => x.type === PLAYBACK_MANIFEST_LOADED || x.type === PLAYBACK_MANIFEST_FAILED)) {
                    restore();
                    try {
                        expect(seen.some((a2) => a2.type === ADD_LAYER && a2.layer.id === 'layer-1')).toBe(true);
                        const loaded = seen.find((a2) => a2.type === PLAYBACK_MANIFEST_LOADED);
                        expect(loaded).toBeTruthy();
                        expect(loaded.nTime).toBe(FIXTURE_MESH.nTime);
                        expect(loaded.nNode).toBe(FIXTURE_MESH.nNode);
                        expect(loaded.mesh.nodeX.length).toBe(FIXTURE_MESH.nNode);
                        expect(loaded.time.length).toBe(FIXTURE_MESH.nTime);
                        expect(fetcherRegistry.has(42)).toBe(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackInit(42, 'layer-1', MANIFEST_URL));
        });

        it('dispatches MANIFEST_FAILED when the manifest fetch errors', (done) => {
            const restore = stubGlobalFetch(() => Promise.resolve(new Response(null, { status: 500 })));
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type === PLAYBACK_MANIFEST_FAILED) {
                    restore();
                    expect(a.runId).toBe(9);
                    done();
                }
            }, done);
            subject.next(playbackInit(9, 'layer-9', MANIFEST_URL));
        });

        it('skips ADD_LAYER when the target layer already exists on the map', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            store.__setLayers([{ id: 'layer-1', type: 'anuga-playback' }]);
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    expect(seen.some((a2) => a2.type === ADD_LAYER)).toBe(false);
                    done();
                }
            }, done);
            subject.next(playbackInit(43, 'layer-1', MANIFEST_URL));
        });
    });

    describe('playbackBufferEpic', () => {
        function loadedPlaybackState() {
            return playbackControllerReducer(
                playbackControllerReducer(createInitialPlaybackState(), playbackInit(1, 'layer-1')),
                playbackManifestLoaded({
                    runId: 1, manifest: FIXTURE_MANIFEST, mesh: { nodeX: new Float32Array(FIXTURE_MESH.nNode) },
                    time: FIXTURE_PHYSICAL.time, nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode,
                    chunkLengthT: 10, totalChunks: 2, quantization: FIXTURE_MANIFEST.quantization
                })
            );
        }

        it('prefetches the required window and dispatches CHUNKS_BUFFERED once every array resolves', (done) => {
            // currentTimestep=0, chunkLengthT=10, default bufferWindowRadius=2,
            // totalChunks=2 -> getPrefetchWindow(0, 2, 2) covers BOTH chunks.
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(1, fetcher);
            const store = makeStore(loadedPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackBufferEpic(action$, store).subscribe((a) => {
                try {
                    if (a.type === PLAYBACK_CHUNKS_BUFFERED) {
                        restore();
                        expect(a.chunkIndices).toEqual([0, 1]);
                        done();
                    } else if (a.type === PLAYBACK_CHUNK_BUFFER_ERROR) {
                        restore();
                        done(new Error('unexpected buffer error: ' + a.error));
                    }
                } catch (e) {
                    restore();
                    done(e);
                }
            }, done);
            subject.next(playbackManifestLoaded({ runId: 1 })); // any trigger type in the ofType list
        });

        it('is a no-op once the required window is already buffered', (done) => {
            const store = makeStore({ ...loadedPlaybackState(), bufferedChunks: [0, 1] });
            const { subject, action$ } = makeActionsSubject();
            let fired = false;
            playbackBufferEpic(action$, store).subscribe(() => { fired = true; });
            subject.next(playbackManifestLoaded({ runId: 1 }));
            setTimeout(() => {
                expect(fired).toBe(false);
                done();
            }, 100);
        });
    });

    describe('playbackTickEpic', () => {
        it('emits TICK actions on an interval after PLAY and stops on PAUSE', (done) => {
            const { subject, action$ } = makeActionsSubject();
            const ticks = [];
            const sub = playbackTickEpic(action$).subscribe((a) => ticks.push(a));
            subject.next(playbackPlay());
            setTimeout(() => {
                const countAtPause = ticks.length;
                expect(countAtPause).toBeGreaterThan(0);
                subject.next(playbackPause());
                setTimeout(() => {
                    expect(ticks.length).toBe(countAtPause); // no further ticks after PAUSE
                    sub.unsubscribe();
                    done();
                }, TICK_INTERVAL_MS * 3);
            }, TICK_INTERVAL_MS * 3);
        });
    });

    describe('playbackSyncLayerEpic', () => {
        it('dispatches changeLayerProperties (CHANGE_LAYER_PROPERTIES) with frame0/frame1/mixT/colorMode/colorMax on a new timestep', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(1, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 1, layerId: 'layer-1', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, mixT: 0.25, quantity: 'depth', quantization: FIXTURE_MANIFEST.quantization
            };
            const store = makeStore(pb);
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                restore();
                try {
                    expect(a.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(a.layer).toBe('layer-1');
                    expect(a.newProperties.mesh).toBe(mesh);
                    expect(a.newProperties.mixT).toBe(0.25);
                    expect(a.newProperties.colorMode).toBe('depth');
                    expect(a.newProperties.frame0.depth.length).toBe(FIXTURE_MESH.nNode);
                    expect(a.newProperties.frame1.depth.length).toBe(FIXTURE_MESH.nNode);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackTick(1));
        });

        it('sends a cheap mixT-only update (no frame0/frame1 keys) once the timestep has already been synced', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(2, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode) };
            const basePb = {
                ...createInitialPlaybackState(),
                runId: 2, layerId: 'layer-2', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 3, mixT: 0, quantity: 'depth', quantization: FIXTURE_MANIFEST.quantization
            };
            const store = makeStore(basePb);
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (seen.length === 2) {
                    restore();
                    try {
                        expect(seen[1].newProperties.frame0).toBe(undefined);
                        expect(seen[1].newProperties.frame1).toBe(undefined);
                        expect(seen[1].newProperties.mixT).toBe(0.6);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            // First tick at the SAME timestep=3 primes lastSyncedTimestep.
            subject.next(playbackTick(1));
            setTimeout(() => {
                store.__setPlayback({ ...basePb, mixT: 0.6 });
                subject.next(playbackTick(2));
            }, 50);
        });
    });
});

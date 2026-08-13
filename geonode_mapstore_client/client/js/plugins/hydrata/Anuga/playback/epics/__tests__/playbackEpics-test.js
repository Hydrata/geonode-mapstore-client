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
    buildManifestRefreshUrl,
    playbackInitEpic,
    playbackBufferEpic,
    playbackTickEpic,
    playbackSyncLayerEpic,
    playbackIdentifyEpic,
    playbackSuppressIdentifyEpic,
    playbackDisposeEpic,
    disposeRun,
    countMeshObjects,
    fetcherRegistry,
    PLAYBACK_LAYER_OWNER,
    TICK_INTERVAL_MS
} from '../playbackEpics';
import { reprojectMeshVertices } from '../../playbackReproject';
// TASK-2744 AC19 — the playback layer moved off layers.flat onto
// `additionallayers` as an `overlay`, so ADD_LAYER/CHANGE_LAYER_PROPERTIES are
// no longer the actions under test.
import {
    UPDATE_ADDITIONAL_LAYER,
    MERGE_OPTIONS_BY_ID,
    REMOVE_ADDITIONAL_LAYER
} from '@mapstore/framework/actions/additionallayers';
import { CHANGE_MAPINFO_STATE } from '@mapstore/framework/actions/mapInfo';
import { PlaybackChunkFetcher } from '../../playbackChunkFetcher';
import {
    PLAYBACK_SET_IDENTIFY_RESULT,
    playbackSetIdentifyArmed,
    playbackSetWireframe,
    playbackInit,
    playbackManifestLoaded,
    playbackPlay,
    playbackPause,
    playbackTick,
    PLAYBACK_MANIFEST_LOADED,
    PLAYBACK_MANIFEST_FETCHED,
    PLAYBACK_LOAD_PROGRESS,
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

// TASK-2739 (W3, epic 2706) — the expired-presigned-URL harness. The
// re-signed manifest hands back the SAME relative keys under DIFFERENT urls
// (exactly what build_playback_manifest(force_refresh=True) does on prod,
// where every chunk_urls value is a freshly presigned S3 URL), so a retry
// that went to the stale url is distinguishable from one that went to the
// refreshed url.
const REFRESHED_CHUNK_PREFIX = 'refreshed/';
const REFRESH_URL_RE = /playback-manifest\/\?refresh=1$/;

function refreshedFixtureManifest() {
    const chunkUrls = {};
    Object.keys(FIXTURE_MANIFEST.chunk_urls).forEach((key) => {
        chunkUrls[key] = REFRESHED_CHUNK_PREFIX + FIXTURE_MANIFEST.chunk_urls[key];
    });
    return { ...FIXTURE_MANIFEST, chunk_urls: chunkUrls };
}

/**
 * Serves the fixture store, but answers the FIRST chunk GET with 403 —
 * the prod failure mode of TASK-2064 (IMDS instance-role credentials
 * rotating before the presigned urls' nominal ExpiresIn, killing every url
 * in the cached manifest mid-bucket). `calls` is the non-vacuity ledger:
 * a spec whose 403 branch never fires cannot pass on it.
 */
function makeExpiredUrlFetchHandler() {
    const calls = { manifest: [], chunk: [], forbidden: [], refreshServed: 0 };
    const handler = (url) => {
        if (url.indexOf(MANIFEST_URL) === 0) {
            calls.manifest.push(url);
            if (REFRESH_URL_RE.test(url)) {
                calls.refreshServed += 1;
                return Promise.resolve(new Response(JSON.stringify(refreshedFixtureManifest()), { status: 200 }));
            }
            return Promise.resolve(new Response(JSON.stringify(FIXTURE_MANIFEST), { status: 200 }));
        }
        calls.chunk.push(url);
        if (calls.forbidden.length === 0) {
            calls.forbidden.push(url);
            return Promise.resolve(new Response(null, { status: 403 }));
        }
        const key = url.indexOf(REFRESHED_CHUNK_PREFIX) === 0
            ? url.slice(REFRESHED_CHUNK_PREFIX.length)
            : url;
        const b64 = FIXTURE_STORE_FILES[key];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
    return { handler, calls };
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
    let state = { anugaPlayback: initialPlaybackState, layers: { flat: [] }, additionallayers: [], ...extra };
    return {
        getState: () => state,
        // test-only setter so a test can advance playback state between
        // dispatches without re-implementing the reducer.
        __setPlayback: (pb) => { state = { ...state, anugaPlayback: pb }; },
        __setLayers: (flat) => { state = { ...state, layers: { flat } }; },
        // TASK-2744 AC19 — the playback layer is an `additionallayers`
        // overlay now, so the epics probe/read HERE, not in layers.flat.
        // `options` is the layer object the overlay selector passes through.
        __setAdditionalLayers: (additionallayers) => { state = { ...state, additionallayers }; }
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
                        expect(seen.some((a2) => a2.type === UPDATE_ADDITIONAL_LAYER && a2.id === 'layer-1'
                            && a2.actionType === 'overlay' && a2.owner === PLAYBACK_LAYER_OWNER
                            && a2.options.id === 'layer-1' && a2.options.type === 'anuga-playback')).toBe(true);
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

        it('skips UPDATE_ADDITIONAL_LAYER when the target overlay already exists on the map', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            store.__setAdditionalLayers([{ id: 'layer-1', owner: PLAYBACK_LAYER_OWNER, actionType: 'overlay', options: { id: 'layer-1', type: 'anuga-playback' } }]);
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    expect(seen.some((a2) => a2.type === UPDATE_ADDITIONAL_LAYER)).toBe(false);
                    done();
                }
            }, done);
            subject.next(playbackInit(43, 'layer-1', MANIFEST_URL));
        });

        // TASK-2739 (W3, epic 2706) — AC3. The fetcher has documented a
        // `refreshManifest` option since W2.1 and the backend has answered
        // `?refresh=1` since 099303d, but NO production caller ever passed
        // one: a 403 from an expired presigned url died at
        // playbackChunkFetcher.js's "no refreshManifest available to retry"
        // throw, turning one credential rotation into a 30-minute outage for
        // every viewer sharing that manifest's cache bucket.
        it('refetches the manifest with ?refresh=1 and retries the chunk when a presigned url 403s', (done) => {
            const { handler, calls } = makeExpiredUrlFetchHandler();
            const restore = stubGlobalFetch(handler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                restore();
                try {
                    // (a) a SECOND manifest request went out, carrying ?refresh=1.
                    expect(calls.manifest.filter((u) => REFRESH_URL_RE.test(u)).length).toBe(1);
                    // (b) the 403'd chunk was retried against the REFRESHED
                    // manifest's url, not the stale one it just failed on.
                    expect(calls.chunk.some((u) => u === REFRESHED_CHUNK_PREFIX + calls.forbidden[0])).toBe(true);
                    // (c) the load completes, with NO failure action of either kind.
                    expect(seen.some((x) => x.type === PLAYBACK_MANIFEST_LOADED)).toBe(true);
                    expect(seen.some((x) => x.type === PLAYBACK_MANIFEST_FAILED)).toBe(false);
                    expect(seen.some((x) => x.type === PLAYBACK_CHUNK_BUFFER_ERROR)).toBe(false);
                    // (d) NON-VACUITY GUARD: the 403 really was served (exactly
                    // once) and the refresh callback really ran, so a spec whose
                    // 403 branch is never reached cannot pass green.
                    expect(calls.forbidden.length).toBe(1);
                    expect(calls.refreshServed).toBe(1);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(2739, 'layer-2739', MANIFEST_URL));
        });
    });

    // TASK-2739 (W3, epic 2706) — AC2. buildPlaybackManifestUrl
    // (anugaScenarioMenu.js) emits a bare path, but the playback control bar
    // lets an operator paste ANY manifest url, including a W0 rig fixture url
    // that already carries a query string.
    describe('buildManifestRefreshUrl', () => {
        it('appends ?refresh=1 to a bare manifest path', () => {
            expect(buildManifestRefreshUrl(MANIFEST_URL)).toBe('/api/v2/anuga/runs/1/playback-manifest/?refresh=1');
        });

        it('appends &refresh=1 to a url that already carries a query, keeping the existing params', () => {
            expect(buildManifestRefreshUrl('/fixtures/playback-manifest/?token=abc&v=2'))
                .toBe('/fixtures/playback-manifest/?token=abc&v=2&refresh=1');
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
        it('dispatches mergeOptionsById (MERGE_OPTIONS_BY_ID) with frame0/frame1/mixT/colorMode/colorMax on a new timestep', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(1, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
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
                    expect(a.type).toBe(MERGE_OPTIONS_BY_ID);
                    expect(a.id).toBe('layer-1');
                    // NOT the same reference (TASK-2628 live-verify fix): the
                    // layer's worker reprojection transfers/detaches
                    // nodeX/nodeY's buffers, so the epic hands it a CLONE and
                    // keeps `mesh` (== pb.mesh, Redux's own copy) intact for
                    // any other reader (e.g. playbackIdentifyEpic).
                    expect(a.options.mesh).toNotBe(mesh);
                    expect(a.options.mesh.nodeX.length).toBe(mesh.nodeX.length);
                    expect(mesh.nodeX.length).toBe(FIXTURE_MESH.nNode); // pb.mesh itself untouched
                    expect(a.options.mixT).toBe(0.25);
                    expect(a.options.colorMode).toBe('depth');
                    expect(a.options.frame0.depth.length).toBe(FIXTURE_MESH.nNode);
                    expect(a.options.frame1.depth.length).toBe(FIXTURE_MESH.nNode);
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
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
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
                        expect(seen[1].options.frame0).toBe(undefined);
                        expect(seen[1].options.frame1).toBe(undefined);
                        expect(seen[1].options.mixT).toBe(0.6);
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

        // TASK-2629 (W4.1) — the store-derived constants the shader's new
        // derived-quantity uniforms need, dispatched alongside
        // mesh/mixT/colorMode/colorMax exactly like those already were.
        it('dispatches colorMin/wetThreshold/g/rhoW/dt alongside the existing colorMode/colorMax props', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(4, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 4, layerId: 'layer-4', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, mixT: 0.25, quantity: 'stage', quantization: FIXTURE_MANIFEST.quantization,
                wetThreshold: 0.005, g: 9.8, rhoW: 1023, elevationMin: 1, elevationMax: 9,
                dtMs: Float32Array.from([NaN, 500, 500, 500]), currentTimestepDt: 2
            };
            const store = makeStore(pb);
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                restore();
                try {
                    expect(a.options.wetThreshold).toBe(0.005);
                    expect(a.options.g).toBe(9.8);
                    expect(a.options.rhoW).toBe(1023);
                    expect(a.options.colorMin).toBe(1); // stage's own elevationMin rescale
                    expect(typeof a.options.dt).toBe('number');
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackTick(1));
        });

        it('reuses the SAME cloned layer-mesh object across repeated dispatches (does not defeat AnugaPlaybackLayer\'s own re-reproject reference check)', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(3, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const basePb = {
                ...createInitialPlaybackState(), runId: 3, layerId: 'layer-3', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10, currentTimestep: 0, mixT: 0, quantization: FIXTURE_MANIFEST.quantization
            };
            const store = makeStore(basePb);
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (seen.length === 2) {
                    restore();
                    try {
                        expect(seen[1].options.mesh).toBe(seen[0].options.mesh);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackTick(1));
            setTimeout(() => {
                store.__setPlayback({ ...basePb, mixT: 0.4 }); // same timestep, mesh reference unchanged
                subject.next(playbackTick(2));
            }, 50);
        });

        // TASK-2656d (W6.5, epic 2618) — was hardcoded `false` here; now
        // reads the controller's own `wireframe` field, and a bare toggle
        // (no tick/seek/quantity change) must still reach the layer since
        // it's the only trigger available while PAUSED.
        it('passes pb.wireframe through to mergeOptionsById, and SET_WIREFRAME alone (no tick) triggers a dispatch', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(5, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 5, layerId: 'layer-5', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 0, mixT: 0, quantity: 'depth', quantization: FIXTURE_MANIFEST.quantization,
                wireframe: true
            };
            const store = makeStore(pb);
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                restore();
                try {
                    expect(a.type).toBe(MERGE_OPTIONS_BY_ID);
                    expect(a.options.wireframe).toBe(true);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            // No PLAYBACK_TICK/SEEK/SET_QUANTITY at all — only the wireframe
            // toggle itself, which must be its own trigger.
            subject.next(playbackSetWireframe(true));
        });

        // TASK-2706 (W1 review) — every fail-loud guard this wave added throws
        // inside loadPlaybackFrame, and `catch(() => Observable.empty())`
        // dispatched NOTHING at all: the layer went on rendering the PREVIOUS
        // timestep's water under the new timestep's label with no error
        // anywhere. Refusing to guess is only worth something if the refusal
        // reaches someone.
        it('emits PLAYBACK_CHUNK_BUFFER_ERROR (not silence) when a frame load is refused', (done) => {
            // The real production case named in the review: an all-fill
            // (dry lead-in) quantity chunk is never written by the exporter,
            // so the manifest carries no chunk_urls entry for it — the same
            // Zarr sparse-chunk optimisation playbackInitEpic already handles
            // for dt_ms.
            const manifestMissingChunk = { ...FIXTURE_MANIFEST, chunk_urls: { ...FIXTURE_MANIFEST.chunk_urls } };
            delete manifestMissingChunk.chunk_urls['depth/c/0/0'];
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: manifestMissingChunk, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(6, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 6, layerId: 'layer-6', manifest: manifestMissingChunk, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 0, mixT: 0, quantity: 'depth', quantization: manifestMissingChunk.quantization
            };
            const store = makeStore(pb);
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, store).subscribe((a) => {
                restore();
                try {
                    expect(a.type).toBe(PLAYBACK_CHUNK_BUFFER_ERROR);
                    expect(a.chunkIndex).toBe(0);
                    expect(a.error).toContain('chunk_urls');
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackTick(1));
        });
    });

    describe('playbackIdentifyEpic (TASK-2628, W3.2)', () => {
        // A tiny 4-node square (UTM zone 56S, matches the fixture's georef)
        // so the reprojected click point is hand-computable.
        const mesh = {
            nodeX: new Float32Array([0, 10, 0, 10]),
            nodeY: new Float32Array([0, 0, 10, 10]),
            faceNodeConnectivity: new Int32Array([0, 1, 2, 1, 3, 2]),
            epsg: 32756,
            xllcorner: 500000,
            yllcorner: 6900000
        };
        const frame0 = { depth: new Float32Array([1, 2, 3, 4]), xVelocity: new Float32Array([0, 0, 0, 0]), yVelocity: new Float32Array([0, 0, 0, 0]) };
        const frame1 = { depth: new Float32Array([2, 4, 6, 8]), xVelocity: new Float32Array([0, 0, 0, 0]), yVelocity: new Float32Array([0, 0, 0, 0]) };

        function makeIdentifyState({ armed = true } = {}) {
            return {
                anugaPlayback: { ...createInitialPlaybackState(), identifyArmed: armed, mesh, layerId: 'layer-id', currentTimestep: 0, quantity: 'depth' },
                additionallayers: [{ id: 'layer-id', owner: PLAYBACK_LAYER_OWNER, actionType: 'overlay', options: { id: 'layer-id', frame0, frame1, mixT: 0 } }]
            };
        }

        it('dispatches SET_IDENTIFY_RESULT with the interpolated smoothed-vertex value when a click lands on the mesh', (done) => {
            const { x, y } = reprojectMeshVertices(mesh.nodeX, mesh.nodeY, mesh);
            // Node 0's own reprojected position -> exact hit, bary weight 1 on node 0.
            const clickPoint = { rawPos: [x[0], y[0]] };
            const state = makeIdentifyState();
            const store = { getState: () => state };
            const { subject, action$ } = makeActionsSubject();
            playbackIdentifyEpic(action$, store).subscribe((a) => {
                try {
                    expect(a.type).toBe(PLAYBACK_SET_IDENTIFY_RESULT);
                    expect(a.result.located).toBe(true);
                    expect(a.result.surface).toBe('vertex-smoothed');
                    expect(a.result.depth).toBe(1); // frame0's node-0 value, mixT=0
                    expect(a.result.quantity).toBe('depth');
                    expect(a.result.timestepIndex).toBe(0);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next({ type: 'CLICK_ON_MAP', point: clickPoint });
        });

        it('is a no-op when identify is not armed', (done) => {
            const state = makeIdentifyState({ armed: false });
            const store = { getState: () => state };
            const { subject, action$ } = makeActionsSubject();
            let fired = false;
            playbackIdentifyEpic(action$, store).subscribe(() => { fired = true; });
            subject.next({ type: 'CLICK_ON_MAP', point: { rawPos: [0, 0] } });
            setTimeout(() => {
                expect(fired).toBe(false);
                done();
            }, 50);
        });

        it('dispatches located:false for a click well outside the mesh', (done) => {
            const state = makeIdentifyState();
            const store = { getState: () => state };
            const { subject, action$ } = makeActionsSubject();
            playbackIdentifyEpic(action$, store).subscribe((a) => {
                expect(a.result.located).toBe(false);
                done();
            }, done);
            subject.next({ type: 'CLICK_ON_MAP', point: { rawPos: [99999999, 99999999] } });
        });

        // TASK-2629 (W4.1) — geometry (elevation/friction/vertexInradius)
        // and constants (g/rhoW/dt) flow from `pb.mesh`/`pb` into
        // sampleFieldAtPoint, so the readout's six new fields are populated
        // via the SAME store-derived values the layer renders with.
        it('passes elevation/friction/vertexInradius + g/rhoW/dtSeconds through so stage/shear/courant are populated', (done) => {
            const meshWithGeometry = {
                ...mesh,
                elevation: new Float32Array([5, 5, 5, 5]),
                friction: new Float32Array([0.05, 0.05, 0.05, 0.05]),
                vertexInradius: new Float32Array([2, 2, 2, 2])
            };
            const state = {
                anugaPlayback: {
                    ...createInitialPlaybackState(), identifyArmed: true, mesh: meshWithGeometry,
                    layerId: 'layer-id', currentTimestep: 0, quantity: 'depth',
                    g: 9.8, rhoW: 1023, dtMs: Float32Array.from([NaN, 1000]), hasDt: true
                },
                additionallayers: [{ id: 'layer-id', owner: PLAYBACK_LAYER_OWNER, actionType: 'overlay', options: { id: 'layer-id', frame0, frame1, mixT: 0 } }]
            };
            const store = { getState: () => state };
            const { subject, action$ } = makeActionsSubject();
            const { x, y } = reprojectMeshVertices(meshWithGeometry.nodeX, meshWithGeometry.nodeY, meshWithGeometry);
            playbackIdentifyEpic(action$, store).subscribe((a) => {
                try {
                    expect(a.result.located).toBe(true);
                    expect(a.result.stage).toBe(6); // elevation 5 + depth 1 (frame0 node0)
                    expect(typeof a.result.shear).toBe('number');
                    expect(typeof a.result.courant).toBe('number');
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next({ type: 'CLICK_ON_MAP', point: { rawPos: [x[0], y[0]] } });
        });

        // TASK-2706 (W1 review) — the other half of the swallowed-refusal
        // defect: when a frame load is refused the layer keeps the OLD frames
        // while pb.currentTimestep keeps advancing, so stamping the playhead
        // on the readout published the old numbers under the new timestep.
        // The readout must label the frames it actually sampled.
        it('stamps the timestep the layer\'s frames were loaded for, not a playhead that ran ahead', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(77, fetcher);
            const syncPb = {
                ...createInitialPlaybackState(),
                runId: 77, layerId: 'layer-77', manifest: FIXTURE_MANIFEST,
                mesh: { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) },
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, mixT: 0, quantity: 'depth', quantization: FIXTURE_MANIFEST.quantization
            };
            const store = makeStore(syncPb);
            const { subject, action$ } = makeActionsSubject();
            // A real successful sync first — that is what records "the layer's
            // frames are timestep 2".
            playbackSyncLayerEpic(action$, store).subscribe(() => {
                restore();
                // Now the state a refused frame load leaves behind: playhead at
                // 7, layer still holding the timestep-2 frames.
                store.__setPlayback({ ...syncPb, mesh, identifyArmed: true, currentTimestep: 7 });
                store.__setAdditionalLayers([{ id: 'layer-77', owner: PLAYBACK_LAYER_OWNER, actionType: 'overlay', options: { id: 'layer-77', frame0, frame1, mixT: 0 } }]);
                const { x, y } = reprojectMeshVertices(mesh.nodeX, mesh.nodeY, mesh);
                playbackIdentifyEpic(action$, store).subscribe((a) => {
                    try {
                        expect(a.result.located).toBe(true);
                        expect(a.result.depth).toBe(1); // frame0's node-0 value — the OLD frames
                        expect(a.result.timestepIndex).toBe(2); // ...labelled as the OLD timestep
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, done);
                subject.next({ type: 'CLICK_ON_MAP', point: { rawPos: [x[0], y[0]] } });
            }, done);
            subject.next(playbackTick(1));
        });
    });

    // TASK-2656c (W6.5, epic 2618) — a playback Inspect click also fired the
    // generic MapStore GFI "Select a feature" popup over the identify
    // readout (UAT finding). onMapClick (web/client/epics/identify.js)
    // reacts to the same CLICK_ON_MAP action, gated on mapInfo.enabled.
    describe('playbackSuppressIdentifyEpic (TASK-2656c, W6.5)', () => {
        it('disables mapInfo when Inspect is armed', (done) => {
            const store = { getState: () => ({ mapInfo: { enabled: true } }) };
            const { subject, action$ } = makeActionsSubject();
            playbackSuppressIdentifyEpic(action$, store).subscribe((a) => {
                try {
                    expect(a.type).toBe(CHANGE_MAPINFO_STATE);
                    expect(a.enabled).toBe(false);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackSetIdentifyArmed(true));
        });

        it('restores mapInfo to whatever it was before arming, on disarm (AC: unaffected when playback inactive)', (done) => {
            const store = { getState: () => ({ mapInfo: { enabled: true } }) };
            const { subject, action$ } = makeActionsSubject();
            const results = [];
            playbackSuppressIdentifyEpic(action$, store).subscribe((a) => results.push(a));
            subject.next(playbackSetIdentifyArmed(true));
            subject.next(playbackSetIdentifyArmed(false));
            setTimeout(() => {
                try {
                    expect(results.length).toBe(2);
                    expect(results[0].enabled).toBe(false);
                    expect(results[1].enabled).toBe(true);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 20);
        });

        it('never turns mapInfo ON on disarm if it was already OFF before arming', (done) => {
            const store = { getState: () => ({ mapInfo: { enabled: false } }) };
            const { subject, action$ } = makeActionsSubject();
            const results = [];
            playbackSuppressIdentifyEpic(action$, store).subscribe((a) => results.push(a));
            subject.next(playbackSetIdentifyArmed(true));
            subject.next(playbackSetIdentifyArmed(false));
            setTimeout(() => {
                try {
                    expect(results[1].enabled).toBe(false);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 20);
        });
    });

    // TASK-2744 (AC2, epic 2706) — THE RUN MUST BE UNLOADABLE.
    //
    // RED on HEAD: `playbackReset()` had zero dispatchers in client/js outside
    // playbackController-test.js, and `fetcherRegistry` was `.set` at INIT,
    // read at the buffer/sync epics, and NEVER `.delete`d — so every stale run
    // stayed fully resident (~578 MiB at prod scale) and IDLE, the only status
    // that re-renders the manifest loader, was unreachable.
    describe('playbackDisposeEpic + disposeRun — TASK-2744 AC2', () => {
        function fakeFetcher() {
            let cleared = 0;
            return { cache: { clear: () => { cleared++; }, get clearedCount() { return cleared; } } };
        }

        it('disposeRun evicts the run from fetcherRegistry and clears its chunk cache', () => {
            const fetcher = fakeFetcher();
            fetcherRegistry.set('run-a', fetcher);
            expect(fetcherRegistry.size).toBe(1);

            const disposed = disposeRun('run-a');

            expect(disposed).toBe(true);
            expect(fetcherRegistry.size).toBe(0);
            expect(fetcherRegistry.has('run-a')).toBe(false);
            expect(fetcher.cache.clearedCount).toBe(1);
        });

        it('disposeRun is a no-op for a falsy runId or the run being kept', () => {
            fetcherRegistry.set('run-keep', fakeFetcher());
            expect(disposeRun(null)).toBe(false);
            expect(disposeRun('run-keep', 'run-keep')).toBe(false);
            expect(fetcherRegistry.has('run-keep')).toBe(true);
        });

        it('PLAYBACK_RESET frees the fetcher and removes the map overlay', (done) => {
            fetcherRegistry.set('run-b', fakeFetcher());
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackDisposeEpic(action$).subscribe((a) => seen.push(a));
            // The reducer has already returned initial state by the time an
            // epic sees PLAYBACK_RESET, so runId/layerId ride the ACTION.
            subject.next({ type: 'PLAYBACK:RESET', runId: 'run-b', layerId: 'layer-b' });
            setTimeout(() => {
                try {
                    expect(fetcherRegistry.has('run-b')).toBe(false);
                    expect(fetcherRegistry.size).toBe(0);
                    expect(seen.length).toBe(1);
                    expect(seen[0].type).toBe(REMOVE_ADDITIONAL_LAYER);
                    expect(seen[0].id).toBe('layer-b');
                    expect(seen[0].owner).toBe(PLAYBACK_LAYER_OWNER);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 20);
        });

        it('loading a SECOND store does not leave the first fetcher alive', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const first = fakeFetcher();
            fetcherRegistry.set(42, first);
            const store = makeStore({ ...createInitialPlaybackState(), runId: 42 });
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    try {
                        // the FIRST run is gone, the second is the only entry
                        expect(fetcherRegistry.has(42)).toBe(false);
                        expect(first.cache.clearedCount).toBe(1);
                        expect(fetcherRegistry.has(43)).toBe(true);
                        expect(fetcherRegistry.size).toBe(1);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackInit(43, 'layer-2', MANIFEST_URL));
        });
    });

    // TASK-2744 (AC18, epic 2706) — THE STATUS LABEL LIED FOR THE WHOLE LOAD.
    //
    // RED, measured on map 1461: status was sampled every 500 ms from the
    // click and produced exactly TWO transitions — 'loading-manifest' at
    // 247 ms and 'buffering' at 46,693 ms. One opaque 46.4-second block, zero
    // intermediate states, no progress element, while the manifest endpoint
    // hand-fetched during that stall answered in milliseconds.
    describe('load phases are observable — TASK-2744 AC18', () => {
        it('dispatches MANIFEST_FETCHED as soon as the manifest RESPONSE lands, before the mesh', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    try {
                        const fetchedAt = seen.findIndex((x) => x.type === PLAYBACK_MANIFEST_FETCHED);
                        const loadedAt = seen.findIndex((x) => x.type === PLAYBACK_MANIFEST_LOADED);
                        // it exists, and it STRICTLY PRECEDES the mesh landing
                        expect(fetchedAt).toNotBe(-1);
                        expect(fetchedAt < loadedAt).toBe(true);
                        expect(seen[fetchedAt].objectCount > 0).toBe(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackInit(51, 'layer-51', MANIFEST_URL));
        });

        it('emits determinate per-object progress during the mesh phase', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackInitEpic(action$, store).subscribe((a) => {
                seen.push(a);
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    try {
                        const progress = seen.filter((x) => x.type === PLAYBACK_LOAD_PROGRESS);
                        // RED on HEAD: the whole load was ONE promise, so this
                        // list was empty and nothing moved for the duration.
                        expect(progress.length > 0).toBe(true);
                        // monotonic, and it reports real bytes
                        progress.forEach((pgr, i) => {
                            expect(pgr.objectsLoaded).toBe(i + 1);
                            expect(pgr.objectCount > 0).toBe(true);
                        });
                        expect(progress[progress.length - 1].bytesLoaded > 0).toBe(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackInit(52, 'layer-52', MANIFEST_URL));
        });

        it('countMeshObjects only counts dt_ms when the manifest actually offers it', () => {
            const withDt = { chunk_urls: {
                'node_x/c/0': 'u', 'node_y/c/0': 'u', 'elevation/c/0': 'u', 'friction/c/0': 'u',
                'inradius/c/0': 'u', 'face_node_connectivity/c/0': 'u', 'time/c/0': 'u', 'dt_ms/c/0': 'u'
            } };
            expect(countMeshObjects(withDt)).toBe(8);
            // a has_dt=false store has NO dt_ms chunk (the exporter skips an
            // all-fill chunk), so counting it would stall progress one short
            // of its own total forever
            const noDt = { chunk_urls: { ...withDt.chunk_urls } };
            delete noDt.chunk_urls['dt_ms/c/0'];
            expect(countMeshObjects(noDt)).toBe(7);
            // an unrecognised manifest still gets an honest count, not 0
            expect(countMeshObjects({ chunk_urls: {} })).toBe(7);
        });
    });

    // TASK-2744 (AC20, epic 2706) — bufferedChunks must stop OVERSTATING
    // residency. RED on map 1461: state claimed [0,1,3] buffered while the
    // plan's affordableChunksPerQuantity was 2, because mergeBufferedChunks
    // only ever unioned and nothing removed an index on LRU eviction.
    describe('bufferedChunks reports real residency — TASK-2744 AC20', () => {
        it('the fetcher reports a chunk resident only when EVERY quantity array is cached', () => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST });
            fetcher.cache.set('depth/c/0/0', new Uint16Array(4));
            fetcher.cache.set('x_velocity/c/0/0', new Uint16Array(4));
            // chunk 0 is INCOMPLETE — two of three arrays
            expect(fetcher.residentChunkIndices(['depth', 'x_velocity', 'y_velocity'])).toEqual([]);
            fetcher.cache.set('y_velocity/c/0/0', new Uint16Array(4));
            expect(fetcher.residentChunkIndices(['depth', 'x_velocity', 'y_velocity'])).toEqual([0]);
        });

        it('an evicted chunk DROPS out of the resident set', () => {
            // a ceiling that fits one chunk-triple, so writing a second evicts
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST });
            ['depth', 'x_velocity', 'y_velocity'].forEach((q) => fetcher.cache.set(`${q}/c/0/0`, new Uint16Array(4)));
            expect(fetcher.residentChunkIndices(['depth', 'x_velocity', 'y_velocity'])).toEqual([0]);
            fetcher.cache.clear();
            // RED behaviour was that state kept claiming chunk 0 forever
            expect(fetcher.residentChunkIndices(['depth', 'x_velocity', 'y_velocity'])).toEqual([]);
        });

        it('cache.keys() does NOT promote to MRU (probing must not reorder eviction)', () => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST });
            fetcher.cache.set('depth/c/0/0', new Uint16Array(4));
            fetcher.cache.set('depth/c/1/0', new Uint16Array(4));
            const before = fetcher.cache.keys();
            fetcher.cache.keys();
            expect(fetcher.cache.keys()).toEqual(before);
        });

        it('an authoritative CHUNKS_BUFFERED REPLACES the set instead of unioning', () => {
            const withThree = playbackControllerReducer(
                { ...createInitialPlaybackState(), bufferedChunks: [0, 1, 3] },
                { type: PLAYBACK_CHUNKS_BUFFERED, chunkIndices: [1, 2], authoritative: true }
            );
            expect(withThree.bufferedChunks).toEqual([1, 2]);
            // a non-authoritative report still unions (hand-built test actions)
            const unioned = playbackControllerReducer(
                { ...createInitialPlaybackState(), bufferedChunks: [0] },
                { type: PLAYBACK_CHUNKS_BUFFERED, chunkIndices: [2] }
            );
            expect(unioned.bufferedChunks).toEqual([0, 2]);
        });
    });
});

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
    playbackIdentifyEpic,
    playbackSuppressIdentifyEpic,
    fetcherRegistry,
    TICK_INTERVAL_MS
} from '../playbackEpics';
import { reprojectMeshVertices } from '../../playbackReproject';
import { ADD_LAYER, CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';
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
                    expect(a.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(a.layer).toBe('layer-1');
                    // NOT the same reference (TASK-2628 live-verify fix): the
                    // layer's worker reprojection transfers/detaches
                    // nodeX/nodeY's buffers, so the epic hands it a CLONE and
                    // keeps `mesh` (== pb.mesh, Redux's own copy) intact for
                    // any other reader (e.g. playbackIdentifyEpic).
                    expect(a.newProperties.mesh).toNotBe(mesh);
                    expect(a.newProperties.mesh.nodeX.length).toBe(mesh.nodeX.length);
                    expect(mesh.nodeX.length).toBe(FIXTURE_MESH.nNode); // pb.mesh itself untouched
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
                    expect(a.newProperties.wetThreshold).toBe(0.005);
                    expect(a.newProperties.g).toBe(9.8);
                    expect(a.newProperties.rhoW).toBe(1023);
                    expect(a.newProperties.colorMin).toBe(1); // stage's own elevationMin rescale
                    expect(typeof a.newProperties.dt).toBe('number');
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
                        expect(seen[1].newProperties.mesh).toBe(seen[0].newProperties.mesh);
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
        it('passes pb.wireframe through to changeLayerProperties, and SET_WIREFRAME alone (no tick) triggers a dispatch', (done) => {
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
                    expect(a.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(a.newProperties.wireframe).toBe(true);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            // No PLAYBACK_TICK/SEEK/SET_QUANTITY at all — only the wireframe
            // toggle itself, which must be its own trigger.
            subject.next(playbackSetWireframe(true));
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
                layers: { flat: [{ id: 'layer-id', frame0, frame1, mixT: 0 }] }
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
                layers: { flat: [{ id: 'layer-id', frame0, frame1, mixT: 0 }] }
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
});

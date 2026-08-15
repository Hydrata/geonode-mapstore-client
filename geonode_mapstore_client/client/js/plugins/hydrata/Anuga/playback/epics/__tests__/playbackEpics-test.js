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
    warnIfOverBudget,
    fetcherRegistry,
    PLAYBACK_LAYER_OWNER,
    TICK_INTERVAL_MS
} from '../playbackEpics';
import {
    computePlaybackMemoryPlan,
    describePlan,
    PLAYBACK_BUDGET_WARN_PREFIX
} from '../../playbackMemoryPolicy';
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

/**
 * TASK-2732 (W3, epic 2706) — capture console.warn for the duration of a case.
 *
 * `budgetLines()` FILTERS on PLAYBACK_BUDGET_WARN_PREFIX and never counts raw
 * console.warn calls, because a shipped playback module already warns on this
 * exact load path: playbackEpics.js's reportMemoryScore (TASK-2744 AC20) emits
 * `[playback] <describeScore>` whenever a within-budget forecast is
 * contradicted by measurement. Counting every warn would measure the wrong
 * population in BOTH directions — an over-budget assertion could go green on
 * the AC20 line, and a "stays silent" assertion could go red on it.
 */
function stubConsoleWarn() {
    const original = console.warn;
    const calls = [];
    console.warn = (...args) => {
        calls.push(args);
    };
    return {
        calls,
        restore: () => {
            console.warn = original;
        },
        budgetLines: () => calls
            .map((args) => String(args[0]))
            .filter((line) => line.indexOf(PLAYBACK_BUDGET_WARN_PREFIX) === 0)
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

/**
 * TASK-2743 UAT-10 (W6, epic 2706) — holds chunk 1 open for 120 ms so chunk 0
 * is GUARANTEED to announce on its own first. Without the delay both chunks
 * can land in the same microtask drain, the epic announces once, and the
 * feedback loop under test never gets a second lap to run.
 */
function chunk1DelayedFetchHandler(url) {
    if (/\/c\/1\/0$/.test(String(url))) {
        return new Promise((resolve) => {
            setTimeout(() => resolve(fixtureFetchHandler(url)), 120);
        });
    }
    return fixtureFetchHandler(url);
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

    // TASK-2732 (W3, epic 2706) — `withinBudget` was computed and then thrown
    // away: the clamp to MIN_CHUNKS_PER_QUANTITY ships an over-budget store
    // anyway (deliberately — one chunk plus its neighbour is the minimum that
    // can play at all), but it did so in TOTAL SILENCE, so the 2618 freeze
    // experience arrived with no breadcrumb even though the client had
    // predicted it. Every count below filters on PLAYBACK_BUDGET_WARN_PREFIX.
    //
    // Every case uses its OWN runId: the once-per-run flag is module state that
    // deliberately outlives a single load.
    describe('warnIfOverBudget — TASK-2732', () => {
        // The manifest-time seam's own inputs: nNode 6,000,000, chunkLengthT 10
        // and NO totalChunks (the on-box fixture declares no
        // schema_metadata.n_time, so playbackInitEpic computes
        // totalChunks0 === undefined and hardMax falls to
        // MAX_CHUNKS_PER_QUANTITY). fixed 600,000,000 B + cache 720,000,000 B
        // = peak 1,320,000,000 B -> describePlan renders 'peak=1258.9 MiB'.
        const overBudgetPlan = () => computePlaybackMemoryPlan({ nNode: 6000000, chunkLengthT: 10 });

        it('warns once with describePlan when the structural floor blows the budget', () => {
            const plan = overBudgetPlan();
            expect(plan.withinBudget).toBe(false);
            const warn = stubConsoleWarn();
            let emitted;
            try {
                emitted = warnIfOverBudget(27321, plan);
            } finally {
                warn.restore();
            }
            expect(emitted).toBe(true);
            const lines = warn.budgetLines();
            expect(lines.length).toBe(1);
            // describePlan verbatim — every term an operator needs, and the
            // arithmetic the policy actually did, not a prose summary of it.
            expect(lines[0]).toContain('peak=1258.9 MiB');
            expect(lines[0]).toContain('budget 800.0 MiB');
            expect(lines[0]).toContain('nNode=6000000');
            expect(lines[0]).toBe(`${PLAYBACK_BUDGET_WARN_PREFIX} ${describePlan(plan)}`);
        });

        it('stays silent when the plan fits — run 1328s real shape', () => {
            // The shape playbackMemoryPolicy-test.js already pins at 711.8 MiB.
            const plan = computePlaybackMemoryPlan({
                nNode: 3393075, nFace: 6779432, chunkLengthT: 10, totalChunks: 4
            });
            expect(plan.withinBudget).toBe(true);
            expect(describePlan(plan)).toContain('peak=711.8 MiB');
            const warn = stubConsoleWarn();
            let emitted;
            try {
                emitted = warnIfOverBudget(27322, plan);
            } finally {
                warn.restore();
            }
            expect(emitted).toBe(false);
            expect(warn.budgetLines().length).toBe(0);
        });

        it('warns ONCE per run even when the manifest-time plan and the exact-nFace re-plan are both over budget', () => {
            // playbackInitEpic plans the same store twice — once from the
            // manifest with an ESTIMATED nFace, once from the decoded mesh with
            // the exact one. The operator must see one line, not two. Proven at
            // the helper, because the exact-nFace re-plan can never be driven
            // over budget on box: the only fixture mesh has six nodes.
            const estimated = overBudgetPlan();
            const exact = computePlaybackMemoryPlan({ nNode: 6000000, nFace: 11700000, chunkLengthT: 10 });
            expect(estimated.withinBudget).toBe(false);
            expect(exact.withinBudget).toBe(false);
            // NON-VACUITY: two genuinely different plans, so a guard that
            // silently ignored the second call for the wrong reason (an equal
            // plan, a falsy plan) could not pass this.
            expect(exact.nFace).toNotBe(estimated.nFace);
            const warn = stubConsoleWarn();
            let second;
            try {
                expect(warnIfOverBudget(27323, estimated)).toBe(true);
                second = warnIfOverBudget(27323, exact);
            } finally {
                warn.restore();
            }
            expect(second).toBe(false);
            const lines = warn.budgetLines();
            expect(lines.length).toBe(1);
            expect(lines[0]).toContain(`nFace=${estimated.nFace}`);
            // ...and a DIFFERENT run still gets its own line.
            const warn2 = stubConsoleWarn();
            try {
                expect(warnIfOverBudget(27324, exact)).toBe(true);
            } finally {
                warn2.restore();
            }
            expect(warn2.budgetLines().length).toBe(1);
        });

        // POSITIVE CONTROL for the three helper-level cases above: without
        // this, all of them would stay green if the helper were never wired
        // into the production seam at all.
        // TASK-2729 NOTE — why this spec's terminal action changed.
        //
        // The doctored manifest below declares a chunk node extent of 6,000,000
        // while the fixture mesh it is served with has 6 nodes. That is not a
        // store that could exist: it is a manifest lying about the bytes behind
        // it, and since TASK-2729 the client refuses exactly that rather than
        // slicing frames with one number against a chunk laid out in the other.
        // So this store now terminates in MANIFEST_FAILED.
        //
        // Both contracts this spec was written to hold are PRESERVED, and both
        // are still asserted below:
        //   1. the wiring contract (its stated purpose) — the over-budget
        //      warning is emitted from the real production seam, exactly once,
        //      with the exact peak. Unchanged, and it still fires: the budget
        //      warning happens at manifest time, before the mesh lands and
        //      therefore before the refusal.
        //   2. "shipping over budget is a deliberate choice, not a blocker" —
        //      still true, and now proved more sharply: the refusal that DOES
        //      happen is the node-extent one, by name. Being over budget did
        //      not stop this load; being an unreadable store did.
        // An over-budget store that is ALSO self-consistent cannot be built at
        // fixture scale — over budget requires a node count in the millions,
        // and a consistent store must ship a mesh that large — which is why
        // this fixture is doctored in the first place.
        it('is wired into playbackInitEpics manifest-time plan: an over-budget store announces itself once, before any refusal', (done) => {
            // Doctor ONLY chunk_shapes — readNodeCount reads
            // chunk_shapes[<array>][1], so this is the manifest-time nNode the
            // real seam sees. The mesh arrays are untouched, so the load itself
            // still completes against the real fixture bytes.
            //
            // TASK-2743 UAT-08 raised the node count from 6,000,000 to
            // 12,000,000. The budget is no longer a fixed 800 MiB — it is
            // sized to the machine, up to PLAYBACK_HEAP_BUDGET_MAX_BYTES
            // (2 GiB) — so a fixture that was over budget only at 800 MiB
            // stopped warning on a big host (caught by this very test: it
            // saw 0 lines on a workstation reporting a 4 GiB heap ceiling).
            // At 12M nodes the plan peaks at 2517.7 MiB, which is over budget
            // at EVERY budget the resolver can produce, so this case is now
            // independent of the machine it runs on.
            // TASK-2719: FIXTURE_MANIFEST.schema_metadata now declares its
            // OWN real n_node (6) from birth (the fixture is representative
            // of a v2 store). Left in place here it would trip
            // assertDeclaredNodeCountAgrees (manifest-time: schema n_node=6
            // vs the doctored chunk_shapes' 12,000,000) BEFORE the budget
            // warning this test targets ever runs — a different, earlier
            // refusal than the one this spec is written to prove. Strip it so
            // the doctored manifest models exactly what it always modelled: a
            // store whose schema_metadata says nothing about n_node and only
            // lies via chunk_shapes, caught by assertNodeExtentMatchesMesh at
            // MESH time instead.
            const { n_node, ...schemaWithoutNNode } = FIXTURE_MANIFEST.schema_metadata;
            const overBudgetManifest = {
                ...FIXTURE_MANIFEST,
                schema_metadata: schemaWithoutNNode,
                chunk_shapes: {
                    depth: [10, 12000000],
                    x_velocity: [10, 12000000],
                    y_velocity: [10, 12000000]
                }
            };
            const restore = stubGlobalFetch((url) => (url === MANIFEST_URL
                ? Promise.resolve(new Response(JSON.stringify(overBudgetManifest), { status: 200 }))
                : fixtureFetchHandler(url)));
            const warn = stubConsoleWarn();
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                restore();
                warn.restore();
                try {
                    const lines = warn.budgetLines();
                    expect(lines.length).toBe(1);
                    expect(lines[0]).toContain('peak=2517.7 MiB');
                    // Shipping over budget is the deliberate choice; the defect
                    // was that it was silent. Budget did NOT stop this load —
                    // TASK-2729 did, because this doctored manifest declares
                    // 6,000,000 nodes over a 6-node mesh. Assert the reason by
                    // name, so a future change that starts refusing on BUDGET
                    // cannot hide behind this expectation.
                    expect(a.type).toBe(PLAYBACK_MANIFEST_FAILED);
                    expect(String(a.error)).toContain('chunk node extent');
                    expect(String(a.error)).toContain('TASK-2729');
                    expect(String(a.error)).toNotContain('budget');
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(27325, 'layer-27325', MANIFEST_URL));
        });

        // NEGATIVE CONTROL for the case above: proves the single line it saw
        // came from the doctored nNode, not from merely loading a store.
        it('leaves no budget line at all when the ordinary fixture store loads', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const warn = stubConsoleWarn();
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                restore();
                warn.restore();
                try {
                    expect(a.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    expect(warn.budgetLines().length).toBe(0);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(27326, 'layer-27326', MANIFEST_URL));
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

        // TASK-2743 UAT-09 (W6, epic 2706) — this used to assert ONE
        // CHUNKS_BUFFERED carrying [0, 1], which was the batched contract:
        // prefetchWindow's Promise.all withheld every chunk until the window's
        // slowest member landed. The controller's readiness gate only ever
        // needs the chunk frame0/frame1 sit in, so batching made the deepest
        // prefetch the thing `buffering` waited on — a measured 7,954 ms cold
        // load on map 1461 with chunk 0 already decoded. The epic now reports
        // per chunk, so the resident set is announced as it GROWS.
        it('prefetches the required window and announces each chunk as it lands, converging on the full window', (done) => {
            // currentTimestep=0, chunkLengthT=10, default bufferWindowRadius=2,
            // totalChunks=2 -> getPrefetchWindow(0, 2, 2) covers BOTH chunks.
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(1, fetcher);
            const store = makeStore(loadedPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const announced = [];
            playbackBufferEpic(action$, store).subscribe((a) => {
                try {
                    if (a.type === PLAYBACK_CHUNK_BUFFER_ERROR) {
                        restore();
                        done(new Error('unexpected buffer error: ' + a.error));
                        return;
                    }
                    if (a.type !== PLAYBACK_CHUNKS_BUFFERED) {
                        return;
                    }
                    announced.push(a.chunkIndices);
                    if (a.chunkIndices.length < 2) {
                        // The first announcement must NOT already be the whole
                        // window — that is the batching this replaced.
                        expect(a.chunkIndices).toEqual([0]);
                        return;
                    }
                    restore();
                    expect(a.chunkIndices).toEqual([0, 1]);
                    // and it got there incrementally, not in one shot
                    expect(announced.length).toBe(2);
                    done();
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

        // TASK-2743 UAT-10 (W6, epic 2706) — found LIVE on map 1461, NOT by
        // this suite, and caused by UAT-09's own per-chunk announcement.
        // PLAYBACK_CHUNKS_BUFFERED is in this epic's ofType list, so every
        // announcement re-enters the switchMap, kills the still-open merge and
        // re-issues the window; a cache-resident chunk 0 then re-resolves in a
        // microtask and announces again, forever. Six minutes at 100-310% CPU,
        // never leaving `buffering`.
        //
        // Every OTHER case in this describe drives the epic with a bare
        // Subject and DISCARDS its output, so none of them can ever see a
        // self-trigger — that harness gap is exactly why karma was green while
        // the browser was locked solid. This case restores the missing half of
        // real redux-observable: reduce the emitted action into the store, then
        // feed it back into action$.
        it('does not re-announce an unchanged resident set when its own CHUNKS_BUFFERED feeds back', (done) => {
            const restore = stubGlobalFetch(chunk1DelayedFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: chunk1DelayedFetchHandler });
            fetcherRegistry.set(1, fetcher);
            const store = makeStore(loadedPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            const announced = [];
            const sub = playbackBufferEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_CHUNKS_BUFFERED) {
                    return;
                }
                announced.push(a.chunkIndices);
                // Circuit-breaker: stop feeding a LOOPING epic so the case can
                // still finish and report, instead of hanging the runner.
                if (announced.length > 6) {
                    return;
                }
                store.__setPlayback({ ...store.getState().anugaPlayback, bufferedChunks: a.chunkIndices });
                subject.next(a);
            });
            subject.next(playbackManifestLoaded({ runId: 1 }));
            setTimeout(() => {
                sub.unsubscribe();
                restore();
                try {
                    // Two chunks in the window, announced as the set GROWS:
                    // exactly two announcements, never a third for a set that
                    // did not change.
                    expect(announced.length).toBe(2);
                    expect(announced[0]).toEqual([0]);
                    expect(announced[1]).toEqual([0, 1]);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 700);
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

        // TASK-2784 (W7, epic 2706) — the ramp MODE has to reach the layer, or
        // the LUT cannot know whether to stretch. RED on HEAD: baseProps
        // carried colorMax but nothing said WHY it had that value, so a ceiling
        // the reader typed was indistinguishable from a store-derived default
        // and the renderer truncated the ramp in both cases.
        it('dispatches colorRescaled — the flag that separates a typed ceiling from a store-derived one', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(9, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const basePb = {
                ...createInitialPlaybackState(),
                runId: 9, layerId: 'layer-9', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, quantity: 'speed', quantization: FIXTURE_MANIFEST.quantization
            };
            const seen = [];
            const run = (pb, next) => {
                const { subject, action$ } = makeActionsSubject();
                playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                    seen.push(a.options);
                    next();
                }, done);
                subject.next(playbackTick(1));
            };
            run(basePb, () => {
                run({ ...basePb, colorMaxOverride: { speed: 4 } }, () => {
                    restore();
                    try {
                        expect(seen[0].colorRescaled).toBe(false, 'a store-derived max is not a ceiling');
                        expect(seen[1].colorRescaled).toBe(true);
                        expect(seen[1].colorMax).toBe(4);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });

        // TASK-2788 (W7, epic 2706) — the dry-ground alpha has to reach the
        // layer, and SET_BACKGROUND_OPACITY has to be one of the epic's own
        // triggers: the drawer is usually worked while PAUSED, so without the
        // trigger the change would sit invisible until the next play/seek.
        it('dispatches backgroundOpacity, and re-syncs on SET_BACKGROUND_OPACITY alone (no tick)', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(11, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 11, layerId: 'layer-11', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, quantization: FIXTURE_MANIFEST.quantization,
                backgroundOpacity: 0.35
            };
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                restore();
                try {
                    expect(a.options.backgroundOpacity).toBe(0.35);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            // the ONLY action fired — no playbackTick
            subject.next({ type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: 0.35 });
        });

        it('defaults backgroundOpacity to 0 on the layer — dry ground starts transparent', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler });
            fetcherRegistry.set(12, fetcher);
            const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
            const pb = {
                ...createInitialPlaybackState(),
                runId: 12, layerId: 'layer-12', manifest: FIXTURE_MANIFEST, mesh,
                nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                currentTimestep: 2, quantization: FIXTURE_MANIFEST.quantization
            };
            const { subject, action$ } = makeActionsSubject();
            playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                restore();
                try {
                    expect(a.options.backgroundOpacity).toBe(0);
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
        // TASK-2728 taught PlaybackChunkFetcher a `releaseCaches()` that drops
        // BOTH the time-series LRU and the statics it moved out of that LRU,
        // and disposeRun now calls it instead of reaching into `.cache`
        // directly. The fake models that seam so the assertions below —
        // `fetcher.cache.clearedCount` — are unchanged: what is under proof
        // here is still "disposeRun releases the run's chunks", not which
        // method name it goes through.
        function fakeFetcher() {
            let cleared = 0;
            const cache = { clear: () => { cleared++; }, get clearedCount() { return cleared; } };
            return { cache, releaseCaches: () => cache.clear() };
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

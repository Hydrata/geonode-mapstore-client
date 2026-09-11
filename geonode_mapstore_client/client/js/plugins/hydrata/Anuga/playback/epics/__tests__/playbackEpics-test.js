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
    playbackEnvelopeFetchEpic,
    playbackIdentifyEpic,
    playbackSuppressIdentifyEpic,
    playbackDisposeEpic,
    disposeRun,
    countMeshObjects,
    warnIfOverBudget,
    fetcherRegistry,
    // TASK-2986 (W1.3, epic 2981) — the fallback path's envelope chooser.
    showFallbackEnvelope,
    PLAYBACK_LAYER_OWNER,
    TICK_INTERVAL_MS
} from '../playbackEpics';
import {
    computePlaybackMemoryPlan,
    describePlan,
    PLAYBACK_BUDGET_WARN_PREFIX,
    // TASK-2984 (W1.1, epic 2981) — RULE C's seam, threaded from runLoad.
    PLAN_TRANSIENT_EXCESS_BYTES,
    PLAN_UNCAP_MAX_PEAK_BYTES,
    APP_BASELINE_FLOOR_BYTES,
    // TASK-2986 AC2(b) — assert against the SYMBOL, not the literal.
    PHONE_CLASS_BUDGET_BYTES
} from '../../playbackMemoryPolicy';
import { reprojectMeshVertices } from '../../playbackReproject';
// TASK-3025 (W4.5, epic 2981) — the runtime-tunable rungs the epic resolves.
import { PLAYBACK_POLICY_OVERRIDE_PREFIX } from '../../playbackPolicyOverrides';
import { setConfigProp } from '@mapstore/framework/utils/ConfigUtils';
// TASK-2744 AC19 — the playback layer moved off layers.flat onto
// `additionallayers` as an `overlay`, so ADD_LAYER/CHANGE_LAYER_PROPERTIES are
// no longer the actions under test.
import {
    UPDATE_ADDITIONAL_LAYER,
    MERGE_OPTIONS_BY_ID,
    REMOVE_ADDITIONAL_LAYER
} from '@mapstore/framework/actions/additionallayers';
import { CHANGE_MAPINFO_STATE } from '@mapstore/framework/actions/mapInfo';
// TASK-2986 — the fallback path DOES write to layers.flat: it is the one
// place this plugin puts a real map layer on the map rather than an overlay.
import { ADD_LAYER, CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';
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
    PLAYBACK_CHUNK_BUFFER_ERROR,
    PLAYBACK_SET_ENVELOPE_MODE,
    PLAYBACK_ENVELOPE_LOADED,
    playbackSetEnvelopeMode,
    playbackSetColorFloor,
    PLAYBACK_FALLBACK,
    playbackFallback,
    playbackSeek,
    playbackReset
} from '../../actions/playbackActions';
import { SHOW_NOTIFICATION } from '@mapstore/framework/actions/notifications';
import { createInitialPlaybackState, playbackControllerReducer, PLAYBACK_STATUS } from '../../playbackController';
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
 *
 * TASK-2754 (W0, epic 2981) — `expireEveryUrl` lifts THE HARNESS CEILING.
 * Answering exactly one 403 bounded `calls.refreshServed` above by the
 * harness's own choice, so TASK-2739's `expect(calls.refreshServed).toBe(1)`
 * could not tell one refresh from a stampede of eight. A real credential
 * rotation does not expire one url: it invalidates EVERY presigned url in
 * the cached manifest in the same tick, which is what this mode serves —
 * 403 for every chunk url that does not already carry
 * REFRESHED_CHUNK_PREFIX. The default is deliberately UNCHANGED so the
 * existing 2739 assertions keep meaning exactly what they meant.
 *
 * The manifest branch stays FIRST: a `?refresh=1` request must never itself
 * be 403'd, or the mode would be testing a dead backend rather than a
 * rotation.
 *
 * @param {{expireEveryUrl?: boolean}} [options]
 */
function makeExpiredUrlFetchHandler({ expireEveryUrl = false } = {}) {
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
        const expired = expireEveryUrl
            ? url.indexOf(REFRESHED_CHUNK_PREFIX) !== 0
            : calls.forbidden.length === 0;
        if (expired) {
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

        /*
         * TASK-2984 (W1.1, epic 2981) AC18(e) — RULE C clause 19.
         *
         * ONE `policyOverrides` object is built in runLoad and spread into ALL
         * THREE policy call sites: the budget resolve, the initial
         * manifest-time plan, and the exact-nFace re-plan whose result is
         * pushed into the LIVE cache by fetcher.applyMemoryPlan.
         *
         * WHY THIS IS A BUG GUARD AND NOT JUST FUTURE WORK. Those two plan
         * calls are hand-written sibling literals. A later retrofit (TASK-3025,
         * the runtime-tunable task) that threads an override into one and
         * misses the other yields a fetcher whose cache ceiling disagrees with
         * its own window depth — and it is SILENT, because warnIfOverBudget has
         * a once-per-run guard (`budgetWarnedRuns`, module state, unexported
         * and never reset) so the second plan can never announce the
         * disagreement. The file already applies exactly this discipline to the
         * budget itself; this extends it to the overrides.
         */
        it('threads ONE policyOverrides object into all three policy call sites (TASK-2984 AC18e)', (done) => {
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                restore();
                try {
                    expect(a.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    // --- HALF 1, BEHAVIOURAL. The exact-nFace re-plan reaches
                    // MANIFEST_LOADED and the live fetcher, and BOTH carry the
                    // effective policy values. A retrofit that threaded only
                    // the initial plan would leave these two disagreeing.
                    const rePlan = a.memoryPlan;
                    const live = fetcherRegistry.get(4242).memoryPlan;
                    [rePlan, live].forEach((plan) => {
                        expect(plan.planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BYTES);
                        expect(plan.uncapMaxPeakBytes).toBe(PLAN_UNCAP_MAX_PEAK_BYTES);
                        expect(plan.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
                        expect(plan.overrideSource).toBe('shipped');
                    });
                    expect(live.planTransientExcessBytes).toBe(rePlan.planTransientExcessBytes);
                    expect(live.uncapMaxPeakBytes).toBe(rePlan.uncapMaxPeakBytes);
                    // saveData reaches the plan from the environment resolver
                    // (clause 11) — the fixture browser reports none.
                    expect(typeof rePlan.saveData).toBe('boolean');

                    // --- HALF 2, STRUCTURAL, and it is the half that can
                    // actually FAIL when a retrofit misses a site. While this
                    // task is the only writer `policyOverrides` is a literal
                    // `{}`, so every effective value above is the shipped one
                    // whether or not the object was threaded — half 1 alone
                    // could not tell. Count the occurrences in the epic's own
                    // source instead: ONE declaration plus THREE call sites.
                    // karma bundles unminified, so the identifier survives.
                    const source = playbackInitEpic.toString();
                    const uses = source.split('policyOverrides').length - 1;
                    expect(uses >= 4).toBe(true);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(4242, 'layer-4242', MANIFEST_URL));
        });

        /*
         * TASK-3025 (W4.5, epic 2981) AC6 — the RESOLVED overrides reach ALL
         * THREE call sites, not just the one a retrofit remembered.
         *
         * The per-site rung is the one drivable here: it arrives through
         * getConfigProp('hydrataConfig').playbackMemory, which is exactly the
         * SitePluginConfig.override_local_config path the admin row travels.
         * (The per-tester url rung reads window.location and is proven in
         * playbackPolicyOverrides-test.js, where the location is an argument.)
         *
         * THE INITIAL PLAN IS CAPTURED FROM INSIDE THE MESH FETCH. Between
         * `new PlaybackChunkFetcher({ memoryPlan: initialPlan })` and
         * `fetcher.applyMemoryPlan(rePlan)` the registry holds the
         * manifest-time plan, and the mesh's first chunk request is issued in
         * that window — so the stub fetch is where a spec can see it. Without
         * that capture, a retrofit that threaded only the re-plan would look
         * identical: both plans carry the same overrides when it is done
         * right, so only the initial plan itself can prove it was.
         */
        it('resolves the per-site rung ONCE and spreads it into all three policy call sites (TASK-3025 AC6)', (done) => {
            const MIB = 1024 * 1024;
            setConfigProp('hydrataConfig', {
                defaultTerrain: 'GLO-30',
                playbackMemory: { uncapMaxPeakMiB: 300, appBaselineFloorMiB: 420 }
            });
            let initialPlan = null;
            const restore = stubGlobalFetch((url) => {
                const fetcher = fetcherRegistry.get(4343);
                if (!initialPlan && fetcher) {
                    initialPlan = fetcher.memoryPlan;
                }
                return fixtureFetchHandler(url);
            });
            const cleanup = () => {
                restore();
                setConfigProp('hydrataConfig', undefined);
            };
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                cleanup();
                try {
                    expect(a.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    const rePlan = a.memoryPlan;
                    const live = fetcherRegistry.get(4343).memoryPlan;
                    // the exact-nFace re-plan is what reached the LIVE cache
                    expect(live).toBe(rePlan);
                    expect(initialPlan).toBeTruthy();
                    expect(initialPlan).toNotBe(rePlan);
                    // ALL THREE call sites saw the same effective values: the
                    // budget resolve (appBaselineFloorBytes), the initial plan
                    // and the re-plan.
                    [initialPlan, rePlan].forEach((plan) => {
                        expect(plan.uncapMaxPeakBytes).toBe(300 * MIB);
                        expect(plan.appBaselineFloorBytes).toBe(420 * MIB);
                        expect(plan.planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BYTES);
                        expect(plan.overrideSource).toBe('override');
                        expect(plan.overrideSources).toEqual({
                            planTransientExcessBytes: 'shipped',
                            uncapMaxPeakBytes: 'site',
                            appBaselineFloorBytes: 'site'
                        });
                    });
                    expect(rePlan.windowBudgetBytes).toBe(300 * MIB);
                    done();
                } catch (e) {
                    done(e);
                }
            }, (e) => {
                cleanup();
                done(e);
            });
            subject.next(playbackInit(4343, 'layer-4343', MANIFEST_URL));
        });

        it('logs ONE resolution line naming each effective value and its rung (TASK-3025 AC7iii)', (done) => {
            setConfigProp('hydrataConfig', { playbackMemory: { uncapMaxPeakMiB: 900 } });
            const lines = [];
            const originalWarn = console.warn;
            console.warn = (...args) => {
                lines.push(String(args[0]));
                originalWarn.apply(console, args);
            };
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const cleanup = () => {
                restore();
                console.warn = originalWarn;
                setConfigProp('hydrataConfig', undefined);
            };
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                cleanup();
                try {
                    expect(a.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    const resolution = lines.filter((l) => l.indexOf(PLAYBACK_POLICY_OVERRIDE_PREFIX) === 0);
                    // ONE line per run, and it says the value was refused
                    // rather than leaving 'my override was clamped away'
                    // indistinguishable from 'my override never arrived'.
                    expect(resolution.length).toBe(1);
                    expect(resolution[0].indexOf('REJECTED') > -1).toBe(true);
                    expect(a.memoryPlan.uncapMaxPeakBytes).toBe(PLAN_UNCAP_MAX_PEAK_BYTES);
                    expect(a.memoryPlan.overrideSources.uncapMaxPeakBytes).toBe('shipped');
                    done();
                } catch (e) {
                    done(e);
                }
            }, (e) => {
                cleanup();
                done(e);
            });
            subject.next(playbackInit(4344, 'layer-4344', MANIFEST_URL));
        });

        it('AC3 — an un-hydrated tester flag honours NOTHING from the url', (done) => {
            // The epic reads the state captured at PLAYBACK_INIT, and
            // canSelectComputeTarget hydrates from an async fetch, so the
            // early read is false. Whatever the tab's url says, the plan must
            // be the shipped one.
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState(), { anuga: { ui: {} } });
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED) {
                    return;
                }
                restore();
                try {
                    expect(a.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    expect(a.memoryPlan.overrideSource).toBe('shipped');
                    expect(a.memoryPlan.overrideSources).toEqual({
                        planTransientExcessBytes: 'shipped',
                        uncapMaxPeakBytes: 'shipped',
                        appBaselineFloorBytes: 'shipped'
                    });
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(4345, 'layer-4345', MANIFEST_URL));
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

        /*
         * TASK-2991 (W3.3, epic 2981) AC2 — a codec this client cannot invert
         * must stop the store BEFORE any of it is downloaded.
         *
         * "No chunk fetch is issued" is the half that matters. Refusing after
         * the mesh has been pulled would still be wrong-water-free, but it
         * would spend the 63 MB blocking prefix this whole epic exists to
         * shorten on a store that can never play. The guard therefore sits
         * beside resolveChunkLengthT, above `new PlaybackChunkFetcher`.
         */
        it('refuses a store declaring an unknown codec, with NO chunk fetch issued', (done) => {
            const requested = [];
            const manifest = {
                ...FIXTURE_MANIFEST,
                codecs: { depth: [{ name: 'brotli' }, { name: 'bytes', configuration: { endian: 'little' } }] }
            };
            const restore = stubGlobalFetch((url) => {
                requested.push(url);
                if (url === MANIFEST_URL) {
                    return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
                }
                return fixtureFetchHandler(url);
            });
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type === PLAYBACK_MANIFEST_FAILED) {
                    restore();
                    try {
                        expect(a.runId).toBe(77);
                        expect(a.error.indexOf('brotli') > -1).toBe(true);
                        expect(a.error.indexOf('depth') > -1).toBe(true);
                        // The ONLY request made was the manifest itself.
                        expect(requested).toEqual([MANIFEST_URL]);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            }, done);
            subject.next(playbackInit(77, 'layer-77', MANIFEST_URL));
        });

        it('a manifest that declares NO codecs block loads exactly as before', (done) => {
            // Absence is not disagreement: every store signed before
            // TASK-2990 has no `codecs` key at all, and refusing those would
            // refuse the entire product.
            expect(FIXTURE_MANIFEST.codecs).toBe(undefined);
            const restore = stubGlobalFetch(fixtureFetchHandler);
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type === PLAYBACK_MANIFEST_LOADED) {
                    restore();
                    try {
                        expect(a.nNode).toBe(FIXTURE_MESH.nNode);
                        done();
                    } catch (e) {
                        done(e);
                    }
                } else if (a.type === PLAYBACK_MANIFEST_FAILED) {
                    restore();
                    done(new Error(`refused a codec-less manifest: ${a.error}`));
                }
            }, done);
            subject.next(playbackInit(78, 'layer-78', MANIFEST_URL));
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

        // TASK-2754 (W0, epic 2981) — AC1/AC3/AC4. The spec above proves a
        // refresh HAPPENS; it cannot prove how many, because the harness only
        // ever served one 403. With the ceiling lifted (expireEveryUrl), a
        // real rotation is served: playbackInitEpic fans out
        // Promise.all([loadPlaybackMesh, loadPlaybackTime, loadPlaybackDt]),
        // and loadPlaybackMesh is itself a Promise.all of six fetchStaticArray
        // calls, so EIGHT chunk GETs are in flight before any response lands.
        // Every one of them 403s in the same tick and — before the
        // single-flight below existed — every one of them independently
        // issued `GET .../playback-manifest/?refresh=1`, the single most
        // expensive endpoint in the application, on eight uwsgi workers at
        // once, per viewer. MEASURED on unmodified source: refreshServed = 8.
        it('collapses a whole-manifest rotation into ONE ?refresh=1 and still completes the load', (done) => {
            const { handler, calls } = makeExpiredUrlFetchHandler({ expireEveryUrl: true });
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
                    // (a) NON-VACUITY: the stampede pressure really was
                    // applied. Fewer than six concurrent 403s and this spec
                    // is not testing the fan-out it claims to test.
                    expect(calls.forbidden.length >= 6).toBe(true);
                    // (b) AC1 — N concurrent 403s, exactly ONE re-sign.
                    expect(calls.refreshServed).toBe(1);
                    expect(calls.manifest.filter((u) => REFRESH_URL_RE.test(u)).length).toBe(1);
                    // (c) AC4 — the all-urls-dead case still LOADS. Not just
                    // "the request count dropped": the mesh arrived, with the
                    // fixture's real node count, and every retry went to the
                    // refreshed urls.
                    const loaded = seen.find((x) => x.type === PLAYBACK_MANIFEST_LOADED);
                    expect(!!loaded).toBe(true);
                    expect(!!loaded.mesh).toBe(true);
                    expect(loaded.mesh.nodeX.length).toBe(FIXTURE_MESH.nNode);
                    expect(seen.some((x) => x.type === PLAYBACK_MANIFEST_FAILED)).toBe(false);
                    expect(seen.some((x) => x.type === PLAYBACK_CHUNK_BUFFER_ERROR)).toBe(false);
                    // (d) AC4 — and the controller accepts it: folding the
                    // epic's OWN emitted action through the real reducer lands
                    // the run in BUFFERING (the terminal status of the init
                    // path — READY is playbackBufferEpic's to assign, from
                    // CHUNKS_BUFFERED behind isWindowBuffered), never ERROR.
                    const stateAfter = playbackControllerReducer(
                        playbackControllerReducer(createInitialPlaybackState(), playbackInit(2754, 'layer-2754', MANIFEST_URL)),
                        loaded
                    );
                    expect(stateAfter.status).toBe(PLAYBACK_STATUS.BUFFERING);
                    expect(stateAfter.nNode).toBe(FIXTURE_MESH.nNode);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(2754, 'layer-2754', MANIFEST_URL));
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

    // TASK-2754 (W0, epic 2981) — the single-flight's two remaining
    // properties, driven at the fetcher rather than through the epic because
    // both need a SECOND rotation / a SECOND fetcher, which one PLAYBACK:INIT
    // cannot express.
    //
    // The rig below models a rotation the way prod does it: every presigned
    // url carries the credential GENERATION that signed it, and a rotation
    // is `liveGeneration += 1` — which kills every url in the cached manifest
    // in the same instant, not one of them.
    describe('PlaybackChunkFetcher manifest-refresh single-flight', () => {
        function makeRotationRig() {
            const rig = { liveGeneration: 0, refreshCalls: 0, fetched: [], gateRefresh: null };
            const manifestFor = (generation) => ({
                chunk_urls: Object.keys(FIXTURE_MANIFEST.chunk_urls).reduce((acc, key) => {
                    acc[key] = `g${generation}/${key}`;
                    return acc;
                }, {})
            });
            rig.fetchImpl = (url) => {
                rig.fetched.push(url);
                const match = /^g(\d+)\/(.*)$/.exec(url);
                if (!match || Number(match[1]) !== rig.liveGeneration) {
                    return Promise.resolve(new Response(null, { status: 403 }));
                }
                return Promise.resolve(new Response(base64ToArrayBuffer(FIXTURE_STORE_FILES[match[2]]), { status: 200 }));
            };
            rig.refreshManifest = () => {
                rig.refreshCalls += 1;
                const answer = () => manifestFor(rig.liveGeneration);
                return rig.gateRefresh ? rig.gateRefresh.then(answer) : Promise.resolve(answer());
            };
            rig.newFetcher = () => new PlaybackChunkFetcher({
                manifest: manifestFor(rig.liveGeneration),
                fetchImpl: rig.fetchImpl,
                refreshManifest: rig.refreshManifest
            });
            rig.rotate = () => { rig.liveGeneration += 1; };
            return rig;
        }

        const F32 = { dtype: 'float32', byteorder: 'little' };

        // AC1 + AC2. Round one proves the collapse; round two proves the memo
        // CLEARED on settle — a permanently-memoised refresh would make the
        // second rotation unrecoverable, which is strictly worse than the
        // stampede it replaced.
        it('collapses each rotation round to one refresh, and a SECOND round refreshes again', (done) => {
            const rig = makeRotationRig();
            const fetcher = rig.newFetcher();
            rig.rotate(); // every url the fetcher holds is now dead
            Promise.all([
                fetcher.fetchAndDecodeChunk('node_x', [0], F32),
                fetcher.fetchAndDecodeChunk('node_y', [0], F32),
                fetcher.fetchAndDecodeChunk('elevation', [0], F32)
            ]).then((round1) => {
                expect(rig.refreshCalls).toBe(1);
                round1.forEach((arr) => expect(arr.length).toBe(FIXTURE_MESH.nNode));
                rig.rotate(); // second rotation, against the freshly-signed urls
                return Promise.all([
                    fetcher.fetchAndDecodeChunk('friction', [0], F32),
                    fetcher.fetchAndDecodeChunk('inradius', [0], F32)
                ]);
            }).then(() => {
                // NOT 1: the memo must not survive its own settle.
                expect(rig.refreshCalls).toBe(2);
                // NON-VACUITY: five distinct keys 403'd across the two rounds,
                // so both rounds really did enter the refresh branch.
                expect(rig.fetched.filter((u) => /^g0\//.test(u)).length).toBe(3);
                expect(rig.fetched.filter((u) => /^g1\//.test(u)).length).toBe(5);
                done();
            }).catch(done);
        });

        // AC5 — NO CROSS-RUN COUPLING. Both fetchers' refreshes are held
        // open on the same gate, so if the memo were module-global the second
        // fetcher's 403 would be satisfied by the first's in-flight promise
        // and `refreshCalls` would come back 1. Per-instance state is the
        // whole point: run A's re-sign says nothing about run B's urls.
        it('does not share one run\'s in-flight refresh with another run\'s fetcher', (done) => {
            const rig = makeRotationRig();
            let openGate = null;
            rig.gateRefresh = new Promise((resolve) => { openGate = resolve; });
            const fetcherA = rig.newFetcher();
            const fetcherB = rig.newFetcher();
            rig.rotate();
            const both = Promise.all([
                fetcherA.fetchAndDecodeChunk('node_x', [0], F32),
                fetcherB.fetchAndDecodeChunk('node_y', [0], F32)
            ]);
            // Let both 403s land and both refresh branches be entered before
            // either refresh is allowed to resolve. The count is RECORDED
            // here and asserted below rather than asserted here, so a throw
            // cannot strand the gate and turn a clean count mismatch into an
            // uninformative 2000 ms timeout.
            let refreshesWhileBothGated = null;
            setTimeout(() => {
                refreshesWhileBothGated = rig.refreshCalls;
                openGate();
            }, 30);
            both.then(([a, b]) => {
                // THE CROSS-RUN ASSERTION: two fetchers, two refreshes, both
                // in flight at once. Module-global memo state reports 1 here.
                expect(refreshesWhileBothGated).toBe(2);
                expect(rig.refreshCalls).toBe(2);
                expect(a.length).toBe(FIXTURE_MESH.nNode);
                expect(b.length).toBe(FIXTURE_MESH.nNode);
                done();
            }).catch(done);
        });

        // TASK-2981 W0 phase-1.7 sweep — AC2's OTHER half. The spec above
        // proves the memo clears after a refresh that RESOLVES; this one
        // proves it clears after one that FAILS, in the harshest shape:
        // `refreshManifest` is a caller-supplied option, so it may throw
        // SYNCHRONOUSLY, and the body of an async function runs synchronously
        // up to its first await. Memoising with a bare async IIFE therefore
        // ran clear-on-settle BEFORE the memo was installed and left the
        // rejected promise cached for the life of the fetcher — every later
        // 403 reused that one rejection and the run could never recover, the
        // exact failure mode TASK-2754 set out to remove.
        it('clears the memo when refreshManifest throws SYNCHRONOUSLY, so a later 403 still refreshes', (done) => {
            const rig = makeRotationRig();
            const workingRefresh = rig.refreshManifest;
            let throwNext = true;
            rig.refreshManifest = () => {
                if (throwNext) {
                    throwNext = false;
                    rig.refreshCalls += 1;
                    throw new Error('sync boom from refreshManifest');
                }
                return workingRefresh();
            };
            const fetcher = rig.newFetcher();   // captures the throwing refresh
            rig.rotate();
            fetcher.fetchAndDecodeChunk('node_x', [0], F32).then(
                () => done(new Error('expected the first fetch to reject')),
                () => {
                    // The memo must not still be holding the rejection.
                    expect(fetcher._refreshInFlight).toBe(null);
                    // And a later 403 must be able to re-sign for real.
                    return fetcher.fetchAndDecodeChunk('node_y', [0], F32).then((arr) => {
                        expect(rig.refreshCalls).toBe(2);
                        expect(arr.length).toBe(FIXTURE_MESH.nNode);
                        done();
                    });
                }
            ).catch(done);
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
        // FLOOR_WINDOW_CHUNKS_PER_QUANTITY — renamed from
        // MAX_CHUNKS_PER_QUANTITY by TASK-2984). fixed 600,000,000 B + cache
        // 720,000,000 B
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
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED
                    && a.type !== PLAYBACK_FALLBACK) {
                    return;
                }
                restore();
                warn.restore();
                try {
                    const lines = warn.budgetLines();
                    expect(lines.length).toBe(1);
                    expect(lines[0]).toContain('peak=2517.7 MiB');
                    // RE-BASED BY TASK-2986 (W1.3, epic 2981), and this IS
                    // AC7's assertion rather than a workaround for it.
                    //
                    // WHAT CHANGED AND WHY. This fixture declares 12,000,000
                    // nodes, so its plan AT THE STRUCTURAL FLOOR peaks at
                    // 2517.7 MiB — above PLAYBACK_HEAP_BUDGET_MAX_BYTES
                    // (2048 MiB), i.e. above every budget the resolver can
                    // produce on any device. Under TASK-2984 clause 12 that is
                    // verdict 'fallback', so this store now stops AT THE
                    // MANIFEST-TIME SEAM and never reaches the mesh — which
                    // means TASK-2729's mesh-time node-extent refusal, which
                    // this spec used to land on, is unreachable FOR THIS
                    // FIXTURE. It is not lost: assertNodeExtentMatchesMesh has
                    // its own unit coverage in playbackChunkShape-test.js, and
                    // the sibling spec below keeps the EPIC-LEVEL wiring
                    // covered on a fixture that still fits the budget.
                    //
                    // WHAT THIS SPEC STILL PROVES, and it is the load-bearing
                    // half: warnIfOverBudget emits PLAYBACK_BUDGET_WARN_PREFIX
                    // EXACTLY ONCE, and it does so ON THE FALLBACK PLAN
                    // ITSELF — the new emit-and-return sits AFTER the warn, so
                    // the only console signal on that band is not silently
                    // removed by the early return.
                    expect(a.type).toBe(PLAYBACK_FALLBACK);
                    expect(a.reason).toBe('floor-window-exceeds-budget');
                    expect(a.nNode).toBe(12000000);
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(27325, 'layer-27325', MANIFEST_URL));
        });

        // TASK-2986 — the EPIC-LEVEL half of TASK-2729's mesh-time refusal,
        // preserved on a fixture the budget accepts. The spec above used to
        // carry it; its 12M-node store now stops at the manifest-time fallback
        // seam and never reaches the mesh, so the coverage is moved here rather
        // than dropped. 1,000,000 nodes gives a floor-window peak of
        // 220,000,000 B (209.8 MiB), comfortably inside any resolvable budget,
        // so the load proceeds exactly as it always did and still trips
        // assertNodeExtentMatchesMesh against the fixture's real 6-node mesh.
        it('a store the budget ACCEPTS still fails at mesh time on a lying chunk node extent (TASK-2729)', (done) => {
            const { n_node: _ignored, ...schemaWithoutNNode } = FIXTURE_MANIFEST.schema_metadata;
            const lyingManifest = {
                ...FIXTURE_MANIFEST,
                schema_metadata: schemaWithoutNNode,
                chunk_shapes: {
                    depth: [10, 1000000],
                    x_velocity: [10, 1000000],
                    y_velocity: [10, 1000000]
                }
            };
            const restore = stubGlobalFetch((url) => (url === MANIFEST_URL
                ? Promise.resolve(new Response(JSON.stringify(lyingManifest), { status: 200 }))
                : fixtureFetchHandler(url)));
            const store = makeStore(createInitialPlaybackState());
            const { subject, action$ } = makeActionsSubject();
            playbackInitEpic(action$, store).subscribe((a) => {
                if (a.type !== PLAYBACK_MANIFEST_LOADED && a.type !== PLAYBACK_MANIFEST_FAILED
                    && a.type !== PLAYBACK_FALLBACK) {
                    return;
                }
                restore();
                try {
                    // NOT a fallback — the budget accepted this store, which is
                    // what makes the mesh-time check reachable at all.
                    expect(a.type).toBe(PLAYBACK_MANIFEST_FAILED);
                    expect(String(a.error)).toContain('chunk node extent');
                    expect(String(a.error)).toContain('TASK-2729');
                    expect(String(a.error)).toNotContain('budget');
                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
            subject.next(playbackInit(27326, 'layer-27326', MANIFEST_URL));
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

        /*
         * TASK-2985 (W1.2, epic 2981) — ONE WINDOW, TWO USES, and the whole
         * plan actually gets asked for.
         *
         * These two drive the epic against a SYNTHETIC 11-chunk store with a
         * counting fetchImpl, because the shared FIXTURE_MANIFEST store has
         * only two chunks and a 2-chunk store cannot tell planWindow from
         * getPrefetchWindow.
         */
        function synthChunkUrls(totalChunks) {
            const chunkUrls = {};
            ['depth', 'x_velocity', 'y_velocity'].forEach((q) => {
                for (let t = 0; t < totalChunks; t++) {
                    chunkUrls[`${q}/c/${t}/0`] = `${q}/c/${t}/0`;
                }
            });
            return chunkUrls;
        }

        function countingFetcher(totalChunks, calls, memoryPlan) {
            return new PlaybackChunkFetcher({
                manifest: { chunk_urls: synthChunkUrls(totalChunks), quantization: FIXTURE_MANIFEST.quantization },
                memoryPlan,
                fetchImpl: (url) => {
                    calls.push(url);
                    return Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 }));
                },
                decodeImpl: () => Promise.resolve(new Uint16Array(8))
            });
        }

        function stateFor({ totalChunks, chunksPerQuantity, bufferWindowRadius }) {
            const loaded = playbackControllerReducer(
                playbackControllerReducer(createInitialPlaybackState(), playbackInit(1, 'layer-1')),
                playbackManifestLoaded({
                    runId: 1, manifest: FIXTURE_MANIFEST, mesh: { nodeX: new Float32Array(FIXTURE_MESH.nNode) },
                    time: FIXTURE_PHYSICAL.time, nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode,
                    chunkLengthT: 10, totalChunks, quantization: FIXTURE_MANIFEST.quantization
                })
            );
            // bufferWindowAhead is chunksPerQuantity - 1 - radius by
            // construction in playbackMemoryPolicy, which is exactly how the
            // epic derives the slot count back out of the reducer's state.
            return {
                ...loaded,
                bufferWindowRadius,
                bufferWindowAhead: chunksPerQuantity - 1 - bufferWindowRadius
            };
        }

        it('AC1 — after MANIFEST_LOADED and no PLAY, the requested set is the WHOLE plan: 11 of 11', (done) => {
            // The REAL post-2984 plan for the 1412 store at the module's own
            // default 800 MiB budget: 11 slots, radius 1, ahead 9.
            const plan = computePlaybackMemoryPlan({
                nNode: 145824, nFace: 290407, chunkLengthT: 10, totalChunks: 11
            });
            expect(plan.chunksPerQuantity).toBe(11);
            expect(plan.bufferWindowRadius).toBe(1);

            const calls = [];
            const fetcher = countingFetcher(11, calls, plan);
            fetcherRegistry.set(1, fetcher);
            const store = makeStore(stateFor({
                totalChunks: 11, chunksPerQuantity: 11, bufferWindowRadius: 1
            }));
            const { subject, action$ } = makeActionsSubject();
            const sub = playbackBufferEpic(action$, store).subscribe(() => {});
            subject.next(playbackManifestLoaded({ runId: 1 }));
            setTimeout(() => {
                sub.unsubscribe();
                try {
                    const chunks = Array.from(new Set(calls.map((u) => Number(u.split('/')[2]))))
                        .sort((a, b) => a - b);
                    // THE RED, verified against the real module before this
                    // task: getPrefetchWindow(0, 11, 1, {ahead: 9}) CLIPS to
                    // [0..9] — 10 of 11, one chunk short, because the
                    // behind-slot at centre 0 is spent on nothing.
                    expect(chunks).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
                    expect(chunks.length).toBe(11);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 400);
        });

        it('AC3 — with a 3-slot plan the pre-play window is [0,1,2]; the GUARD sees the same array the fill does', (done) => {
            // ONE WINDOW, TWO USES. If the already-buffered guard were left on
            // getPrefetchWindow it would return [0,1], see both resident and
            // emit Observable.empty() — so this AC would pass in the unit test
            // and fail in the product. Feeding the guard [0,1,2] while the
            // cache holds [0,1] is exactly that discrimination.
            const plan = { chunksPerQuantity: 3, bufferWindowRadius: 1, cacheMaxBytes: 4096 };
            const calls = [];
            const fetcher = countingFetcher(11, calls, plan);
            fetcherRegistry.set(1, fetcher);
            const store = makeStore({
                ...stateFor({ totalChunks: 11, chunksPerQuantity: 3, bufferWindowRadius: 1 }),
                bufferedChunks: [0, 1]
            });
            const { subject, action$ } = makeActionsSubject();
            const sub = playbackBufferEpic(action$, store).subscribe(() => {});
            subject.next(playbackManifestLoaded({ runId: 1 }));
            setTimeout(() => {
                sub.unsubscribe();
                try {
                    const chunks = Array.from(new Set(calls.map((u) => Number(u.split('/')[2]))))
                        .sort((a, b) => a - b);
                    expect(chunks).toEqual([0, 1, 2]);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 400);
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

        /*
         * TASK-3076 (AC3/AC4/AC6) — the colour-scale FLOOR reaches the layer
         * through the SAME baseProps, gated by the ONE predicate: the epic
         * passes `colorFloor: isColorFloorActive(...) ? floor : null`, so the
         * renderer maps null -> uColorFloorActive 0 and never re-derives the
         * rule. SET_COLOR_FLOOR must be a trigger of its own for the same
         * reason SET_COLOR_MAX is: the drawer is worked while PAUSED.
         */
        describe('colour-scale floor (TASK-3076)', () => {
            function floorPb(runId, extra) {
                const mesh = { nodeX: new Float32Array(FIXTURE_MESH.nNode), nodeY: new Float32Array(FIXTURE_MESH.nNode) };
                return {
                    ...createInitialPlaybackState(),
                    runId, layerId: `layer-${runId}`, manifest: FIXTURE_MANIFEST, mesh,
                    nTime: FIXTURE_MESH.nTime, nNode: FIXTURE_MESH.nNode, chunkLengthT: 10,
                    currentTimestep: 2, quantity: 'depth', quantization: FIXTURE_MANIFEST.quantization,
                    ...extra
                };
            }

            it('AC6 — with no floor, colorFloor is null and every EXISTING key is unchanged', (done) => {
                const restore = stubGlobalFetch(fixtureFetchHandler);
                fetcherRegistry.set(301, new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler }));
                const pb = floorPb(301);
                const { subject, action$ } = makeActionsSubject();
                playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                    restore();
                    try {
                        expect('colorFloor' in a.options).toBe(true, 'the key is always present');
                        expect(a.options.colorFloor).toBe(null);
                        // the pre-existing contract, key by key
                        expect(a.options.colorMode).toBe('depth');
                        expect(a.options.colorMax).toBe(FIXTURE_MANIFEST.quantization.depth.valid_max);
                        expect(a.options.colorMin).toBe(0);
                        expect(a.options.colorRescaled).toBe(false);
                        expect(a.options.opacity).toBe(pb.opacity);
                        expect(a.options.backgroundOpacity).toBe(pb.backgroundOpacity);
                        expect(a.options.wireframe).toBe(false);
                        expect(a.options.envelopeMode).toBe(false);
                        expect(a.options.envelopeData).toBe(null);
                        expect(a.options.wetThreshold).toBe(pb.wetThreshold);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, done);
                subject.next(playbackTick(1));
            });

            it('AC3 — SET_COLOR_FLOOR alone (no tick) re-syncs the layer, exactly as SET_COLOR_MAX does', (done) => {
                const restore = stubGlobalFetch(fixtureFetchHandler);
                fetcherRegistry.set(302, new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler }));
                // fixture depth valid_max is 0.36 m, so a 0.1 m floor is inside the range
                const pb = floorPb(302, { colorFloorOverride: { depth: 0.1 } });
                const { subject, action$ } = makeActionsSubject();
                playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                    restore();
                    try {
                        expect(a.type).toBe(MERGE_OPTIONS_BY_ID);
                        expect(a.options.colorFloor).toBe(0.1);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, done);
                // the ONLY action fired — no playbackTick
                subject.next(playbackSetColorFloor('depth', 0.1));
            });

            it('AC4 — an INERT floor (above the ceiling / on another quantity) reaches the layer as null', (done) => {
                const restore = stubGlobalFetch(fixtureFetchHandler);
                fetcherRegistry.set(303, new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fixtureFetchHandler }));
                const seen = [];
                const run = (pb, next) => {
                    const { subject, action$ } = makeActionsSubject();
                    playbackSyncLayerEpic(action$, makeStore(pb)).subscribe((a) => {
                        seen.push(a.options);
                        next();
                    }, done);
                    subject.next(playbackTick(1));
                };
                // floor 2.0 with a 1.5 ceiling -> inert
                run(floorPb(303, { colorMaxOverride: { depth: 1.5 }, colorFloorOverride: { depth: 2.0 } }), () => {
                    // ceiling raised to 3.0 -> the same stored floor becomes active
                    run(floorPb(303, { colorMaxOverride: { depth: 3.0 }, colorFloorOverride: { depth: 2.0 } }), () => {
                        // shear's floor while DISPLAYING depth -> depth is untouched
                        run(floorPb(303, { colorFloorOverride: { shear: 50 } }), () => {
                            restore();
                            try {
                                expect(seen[0].colorFloor).toBe(null, 'inert above the ceiling');
                                expect(seen[1].colorFloor).toBe(2.0);
                                expect(seen[2].colorFloor).toBe(null, 'per-quantity: shear\'s floor is not depth\'s');
                                done();
                            } catch (e) {
                                done(e);
                            }
                        });
                    });
                });
            });
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
    /*
     * =====================================================================
     * TASK-2986 (W1.3, epic 2981) — THE FALLBACK PATH.
     *
     * A phone handed a 3.39 M-node mesh downloads 63 MB of geometry and holds
     * 440 MiB of typed arrays. The old refusal rule never fired for it: at the
     * 800 MiB floor budget refusal needed 8,388,608 nodes, so every real store
     * on every real device was accepted and the devices that actually die sat
     * inside the accepted band. TASK-2984's downward device path moves the
     * threshold into that band; this is what the user sees when it fires.
     *
     * WHERE THE CONSTANTS ARE CHARGED, because every fixture here depends on
     * it: APP_BASELINE_FLOOR_BYTES floors the usedJSHeapSize READING inside
     * resolvePlaybackHeapBudget and is NEVER subtracted from budgetBytes;
     * PLAN_TRANSIENT_EXCESS_BYTES is subtracted only from the WINDOW budget;
     * and the fallback VERDICT is judged against the GROSS budgetBytes
     * (TASK-2984 clause 12's deliberate asymmetry). So none of the three moves
     * any threshold in this task.
     * =====================================================================
     */
    describe('the fallback path — TASK-2986 (W1.3, epic 2981)', () => {
        const MIB = 1024 * 1024;
        // 741_410_1328_chunk2 AT MANIFEST TIME. nFace is NOT in the manifest,
        // so the manifest-time plan uses FACES_PER_NODE_ESTIMATE = 2 and the
        // numbers differ from the exact-nFace ones by ~0.1 MiB. Grade against
        // THESE, never against a formatted MiB string.
        const CHUNK2_NODES = 3393075;
        const CHUNK2_FIXED_BYTES = 339307500;        // 323.59 MiB
        const CHUNK2_FLOOR_WINDOW_BYTES = 420741300; // 401.25 MiB
        const CHUNK2_N3_PEAK_BYTES = 461458200;      // 440.08 MiB

        function manifestFor({ nNode, chunkLengthT, nTime }) {
            const shapes = {};
            const chunkUrls = { 'zarr.json': 'zarr.json' };
            ['depth', 'x_velocity', 'y_velocity'].forEach((q) => {
                shapes[q] = [chunkLengthT, nNode];
                chunkUrls[`${q}/zarr.json`] = `${q}/zarr.json`;
                for (let t = 0; t < Math.ceil(nTime / chunkLengthT); t++) {
                    chunkUrls[`${q}/c/${t}/0`] = `${q}/c/${t}/0`;
                }
            });
            ['node_x', 'node_y', 'elevation', 'friction', 'inradius', 'face_node_connectivity', 'time'].forEach((a) => {
                chunkUrls[`${a}/zarr.json`] = `${a}/zarr.json`;
                chunkUrls[`${a}/c/0`] = `${a}/c/0`;
                chunkUrls[`${a}/c/0/0`] = `${a}/c/0/0`;
            });
            return {
                chunk_urls: chunkUrls,
                chunk_shapes: shapes,
                schema_metadata: { format_version: 2, n_time: nTime, chunk_length_t: chunkLengthT },
                quantization: FIXTURE_MANIFEST.quantization
            };
        }

        /**
         * Drive the REAL budget resolution rather than stubbing past it: the
         * whole point of this task is what a small device resolves. Both
         * signals are stubbed so the resolved budget is deterministic and does
         * not depend on how much heap this karma browser happens to have —
         * and every spec ASSERTS the budget it got rather than assuming it.
         */
        function withEnvironment({ deviceMemoryGiB, jsHeapSizeLimit, usedJSHeapSize }, run) {
            Object.defineProperty(navigator, 'deviceMemory', { value: deviceMemoryGiB, configurable: true });
            Object.defineProperty(performance, 'memory', {
                value: { jsHeapSizeLimit, usedJSHeapSize }, configurable: true
            });
            const restore = () => {
                delete navigator.deviceMemory;
                delete performance.memory;
            };
            return run(restore);
        }

        // A budget squarely inside the (323.59, 401.25) MiB band — see AC1.
        // 1.9482421875 GiB x 0.20 = 399.0 MiB exactly.
        const BAND_DEVICE_MEMORY_GIB = 1.9482421875;
        // 3.90625 GiB x 0.20 = 800.0 MiB exactly — the epic's own control.
        const FITS_DEVICE_MEMORY_GIB = 3.90625;
        const BIG_HEAP = { jsHeapSizeLimit: 8192 * MIB, usedJSHeapSize: 300 * MIB };

        function driveInit(manifest, fetchCounter) {
            const handler = (url) => {
                if (String(url).indexOf('manifest') !== -1) {
                    return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
                }
                fetchCounter.push(url);
                return Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 }));
            };
            return stubGlobalFetch(handler);
        }

        function collect(store, manifest, fetches, done, assertFn) {
            const restoreFetch = driveInit(manifest, fetches);
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            const sub = playbackInitEpic(action$, store).subscribe((a) => seen.push(a));
            subject.next(playbackInit(77, 'layer-77', 'http://rig/playback-manifest/'));
            setTimeout(() => {
                sub.unsubscribe();
                restoreFetch();
                try {
                    assertFn(seen);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 500);
        }

        it('AC1 — fallback FIRES on a real store: 0 fetches, status fallback, reason floor-window-exceeds-budget', (done) => {
            // THE BUDGET MUST SIT STRICTLY INSIDE (323.59, 401.25) MiB — above
            // this fixture's fixed-mesh total and below its floor-window peak.
            // BELOW 323.59 MiB the 'fixed-mesh-exceeds-budget' branch fires
            // FIRST and this spec would assert a reason the module never
            // produces on it. An earlier draft stubbed 163 MiB, which is below
            // the fixed mesh — and this is the ONLY coverage that
            // 'floor-window-exceeds-budget' has anywhere in the epic.
            withEnvironment({ deviceMemoryGiB: BAND_DEVICE_MEMORY_GIB, ...BIG_HEAP }, (restore) => {
                const manifest = manifestFor({ nNode: CHUNK2_NODES, chunkLengthT: 2, nTime: 31 });
                const fetches = [];
                const store = makeStore(createInitialPlaybackState());
                collect(store, manifest, fetches, (e) => { restore(); done(e); }, (seen) => {
                    const fallback = seen.find((a) => a.type === PLAYBACK_FALLBACK);
                    expect(fallback).toExist();
                    expect(fallback.budgetBytes > CHUNK2_FIXED_BYTES).toBe(true);
                    expect(fallback.budgetBytes < CHUNK2_FLOOR_WINDOW_BYTES).toBe(true);
                    expect(fallback.reason).toBe('floor-window-exceeds-budget');
                    expect(fallback.floorWindowPlanPeakBytes).toBe(CHUNK2_FLOOR_WINDOW_BYTES);
                    expect(fallback.nNode).toBe(CHUNK2_NODES);
                    // ZERO fetches after the manifest. RED at HEAD: the same
                    // fixture warns and then downloads the mesh.
                    expect(fetches.length).toBe(0);
                    // ...and nothing was registered, so nothing can fetch later
                    expect(fetcherRegistry.has(77)).toBe(false);
                    const state = playbackControllerReducer(createInitialPlaybackState(), fallback);
                    expect(state.status).toBe(PLAYBACK_STATUS.FALLBACK);
                    expect(state.pendingPlay).toBe(false);
                });
            });
        });

        it('AC2(a) — fallback does NOT fire on the SAME store at 800 MiB: verdict ok, n=3, and the mesh IS fetched', (done) => {
            // The control that stops AC1 passing for the wrong reason. The
            // adjudicated AC2 table row is `chunk2 L2/16 ... 800: 3->3 (440)`.
            withEnvironment({ deviceMemoryGiB: FITS_DEVICE_MEMORY_GIB, ...BIG_HEAP }, (restore) => {
                const manifest = manifestFor({ nNode: CHUNK2_NODES, chunkLengthT: 2, nTime: 31 });
                const fetches = [];
                const store = makeStore(createInitialPlaybackState());
                collect(store, manifest, fetches, (e) => { restore(); done(e); }, (seen) => {
                    expect(seen.find((a) => a.type === PLAYBACK_FALLBACK)).toBe(undefined);
                    // the plan itself, computed the way the epic computes it
                    const plan = computePlaybackMemoryPlan({
                        nNode: CHUNK2_NODES, chunkLengthT: 2, totalChunks: 16, budgetBytes: 800 * MIB
                    });
                    expect(plan.verdict).toBe('ok');
                    expect(plan.chunksPerQuantity).toBe(3);
                    expect(plan.peakResidentBytes).toBe(CHUNK2_N3_PEAK_BYTES);
                    // and the geometry really did start moving
                    expect(fetches.length > 0).toBe(true);
                    expect(fetcherRegistry.has(77)).toBe(true);
                });
            });
        });

        it('AC2(b)/AC3 — the plan-arithmetic rows: the small store plays on a phone, the synthetic fails closed', () => {
            // Stub the literals (the prompt's authority paragraph): a stubbed
            // budgetBytes bypasses APP_BASELINE_FLOOR_BYTES entirely, because
            // the floor lives inside the budget RESOLUTION, not in the plan.
            //
            // AC2(b) — 1412 at TASK-2984's PHONE_CLASS_BUDGET_BYTES. Assert
            // against the SYMBOL so the row survives whichever literal 2984
            // ships. Its fixed mesh is 14,582,400 B (13.91 MiB) and its
            // floor-window peak 32,081,280 B (30.60 MiB), far below any budget
            // the module can resolve — including SMALL_DEVICE_MIN_BUDGET_BYTES
            // (128 MiB), the other floor this path can produce. (163 MiB is a
            // budget COLUMN in the AC2 table, an Android raw offer, NOT a
            // constant — do not conflate them.)
            const small = computePlaybackMemoryPlan({
                nNode: 145824, chunkLengthT: 10, totalChunks: 11, budgetBytes: PHONE_CLASS_BUDGET_BYTES
            });
            expect(small.verdict).toBe('ok');
            expect(small.fixedBytes).toBe(14582400);
            expect(small.floorWindowPlanPeakBytes).toBe(32081280);

            // AC3 — the 14,582,400-node synthetic at 800 MiB: 1,390.7 MiB of
            // fixed mesh alone exceeds it, so the FIRST branch fires.
            const synth = computePlaybackMemoryPlan({
                nNode: 14582400, chunkLengthT: 2, totalChunks: 16, budgetBytes: 800 * MIB
            });
            expect(synth.verdict).toBe('fallback');
            expect(synth.fallbackReason).toBe('fixed-mesh-exceeds-budget');

            // ...AND THE CORRECTED COMPANION ROW: the SAME synthetic at
            // 1,849 MiB is NOT fallback — its floor-window peak of 1,724.5 MiB
            // FITS. The superseded spec asserted the opposite, and an
            // implementer copying it writes a test that cannot pass.
            const synthBig = computePlaybackMemoryPlan({
                nNode: 14582400, chunkLengthT: 2, totalChunks: 16, budgetBytes: 1849 * MIB
            });
            expect(synthBig.verdict).toBe('ok');
            expect(synthBig.fallbackReason).toBe(null);
            expect(synthBig.chunksPerQuantity).toBe(2);

            // THE HONEST CAVEAT, and it is not decoration: 'not fallback' means
            // THE PLAN FITS THE BUDGET, not THE TAB WILL SURVIVE. TASK-3013's
            // W0.4 rig killed 813_417_1412 — whole plan 38.9 MiB — under a
            // 768 MiB cgroup, and killed 741_410_1328_chunk2 at 384, 768 AND
            // 1536 MiB. These rows assert what the shipped arithmetic
            // produces, never a survival prediction.
        });

        it('AC3 third row — A NULL PLAN IS NOT A FALLBACK: an unsizable store PROCEEDS', (done) => {
            // readNodeCount returns undefined when chunk_shapes declare no
            // usable node extent for ANY quantity array, so `initialPlan` is
            // null. A store whose size cannot be READ cannot be JUDGED, and
            // today it proceeds — that behaviour is KEPT and RECORDED here
            // rather than inherited.
            //
            // No RED is available for this row (HEAD already proceeds), so it
            // is a REGRESSION GUARD on the defensive read. Shown red by
            // reversible mutation instead: write `initialPlan.verdict ===
            // 'fallback'` without the null guard and it throws a TypeError
            // into runLoad's catch, landing status 'error'.
            withEnvironment({ deviceMemoryGiB: BAND_DEVICE_MEMORY_GIB, ...BIG_HEAP }, (restore) => {
                const manifest = manifestFor({ nNode: CHUNK2_NODES, chunkLengthT: 2, nTime: 31 });
                // strip the node extent from every quantity array
                Object.keys(manifest.chunk_shapes).forEach((q) => {
                    manifest.chunk_shapes[q] = [2];
                });
                const fetches = [];
                const store = makeStore(createInitialPlaybackState());
                collect(store, manifest, fetches, (e) => { restore(); done(e); }, (seen) => {
                    const failed = seen.find((a) => a.type === PLAYBACK_MANIFEST_FAILED);
                    // The assertion carries the evidence, so the RED of the
                    // reversible mutation NAMES the TypeError instead of
                    // printing a bare `false`. With the null guard removed this
                    // reads:
                    //   fallback=false proceeded=false error="Cannot read
                    //   properties of null (reading 'verdict')"
                    // A downstream mesh-decode/fetch failure on this synthetic
                    // manifest is expected and is NOT what this row grades —
                    // what it grades is that the plan was not judged, the run
                    // proceeded, and no null-read threw into runLoad's catch.
                    const message = failed ? String(failed.error) : '';
                    expect('fallback=' + (seen.some((a) => a.type === PLAYBACK_FALLBACK))
                        + ' proceeded=' + fetcherRegistry.has(77)
                        + ' nullVerdictThrow=' + /verdict/.test(message))
                        .toBe('fallback=false proceeded=true nullVerdictThrow=false');
                });
            });
        });

        it('AC4 — all three envelope branches, asserted on dispatched ACTIONS and never on a testid', () => {
            const depthMax = {
                id: 'lyr-9', name: 'geonode:run77_depth_max_cog',
                title: 'Results.Depth', visibility: false, type: 'wms'
            };
            const scenarioState = {
                anuga: { scenarios: { allIds: [1], byId: { 1: {
                    id: 1, latest_complete_run: { id: 77, gn_layer_depth_max: depthMax }
                } } } }
            };

            // (a) ALREADY in state.layers.flat -> made visible, no addLayer.
            const emittedA = [];
            const storeA = makeStore(createInitialPlaybackState(), {
                ...scenarioState, layers: { flat: [{ ...depthMax }] }
            });
            expect(showFallbackEnvelope(storeA, 77, (a) => emittedA.push(a))).toBe('existing');
            expect(emittedA.length).toBe(1);
            expect(emittedA[0].type).toBe(CHANGE_LAYER_PROPERTIES);
            expect(emittedA[0].layer).toBe('lyr-9');
            // ASSERT THE PROPERTIES OBJECT, not merely that something fired.
            expect(emittedA[0].newProperties).toEqual({ visibility: true });

            // (b) NOT in state but reachable from scenario state -> addLayer,
            // and `visibility: true` IS LOAD-BEARING: _serialize_gn_layer ships
            // every nested gn_layer_* dict with `visibility = False`, so a bare
            // addLayer(gn_layer_depth_max) files an INVISIBLE layer — the epic
            // records 'added', a gate greens on 'added', and the phone user
            // still sees a blank map with an apology.
            const emittedB = [];
            const storeB = makeStore(createInitialPlaybackState(), scenarioState);
            expect(showFallbackEnvelope(storeB, 77, (a) => emittedB.push(a))).toBe('added');
            expect(emittedB.length).toBe(1);
            expect(emittedB[0].type).toBe(ADD_LAYER);
            expect(emittedB[0].layer.name).toBe('geonode:run77_depth_max_cog');
            expect(emittedB[0].layer.visibility).toBe(true);
            // the source dict is NOT mutated — the state object stays as served
            expect(depthMax.visibility).toBe(false);

            // (c) neither -> nothing dispatched, and the caller still lands
            // 'fallback'. FAILS CLOSED.
            const emittedC = [];
            const storeC = makeStore(createInitialPlaybackState());
            expect(showFallbackEnvelope(storeC, 77, (a) => emittedC.push(a))).toBe('none');
            expect(emittedC.length).toBe(0);

            // ...and a run that is NEITHER latest_complete_run NOR latest_run
            // is NOT REACHABLE, BY DESIGN — it falls to (c) rather than
            // triggering a lookup this task deliberately does not build.
            const emittedD = [];
            const storeD = makeStore(createInitialPlaybackState(), scenarioState);
            expect(showFallbackEnvelope(storeD, 999, (a) => emittedD.push(a))).toBe('none');
            expect(emittedD.length).toBe(0);
        });

        it('phase 1.7 — a STALE run\'s fallback cannot clobber the run that replaced it', () => {
            // FOUND BY THIS WAVE'S CUMULATIVE REVIEW, not by an AC.
            // playbackInitEpic is a mergeMap, NOT a switchMap, so a second
            // PLAYBACK_INIT does not tear down the first run's still-running
            // load — run A's verdict can land after run B has started. Without
            // the guard a LIVE loading run is forced into a TERMINAL
            // 'fallback' carrying ANOTHER run's mesh size and budget, and
            // nothing short of a reload gets it out.
            //
            // The four sibling cases (MANIFEST_FETCHED, LOAD_PROGRESS,
            // MANIFEST_LOADED, MANIFEST_FAILED) all carry this guard already.
            const runB = playbackControllerReducer(
                createInitialPlaybackState(), playbackInit(88, 'layer-88'));
            expect(runB.runId).toBe(88);
            const payload = {
                reason: 'fixed-mesh-exceeds-budget',
                nNode: 14582400, nFace: 29164800,
                budgetBytes: 128 * 1024 * 1024, budgetSource: 'phone-class',
                floorWindowPlanPeakBytes: 1808793600, fallbackLayerShown: 'none'
            };
            const after = playbackControllerReducer(
                runB, playbackFallback({ ...payload, runId: 77 }));
            expect(after).toBe(runB);
            expect(after.status).toNotBe(PLAYBACK_STATUS.FALLBACK);
            // ...and the SAME payload for the CURRENT run IS honoured, so the
            // guard cannot be satisfied by ignoring everything.
            const own = playbackControllerReducer(
                runB, playbackFallback({ ...payload, runId: 88 }));
            expect(own.status).toBe(PLAYBACK_STATUS.FALLBACK);
            expect(own.nNode).toBe(14582400);
        });

        it('AC5/AC6 — the reducer keeps every number the message names, and fallback is TERMINAL', () => {
            const action = playbackFallback({
                runId: 77, reason: 'floor-window-exceeds-budget',
                nNode: CHUNK2_NODES, nFace: 6786150,
                budgetBytes: 399 * MIB, budgetSource: 'small-device',
                floorWindowPlanPeakBytes: CHUNK2_FLOOR_WINDOW_BYTES,
                fallbackLayerShown: 'added'
            });
            const state = playbackControllerReducer(createInitialPlaybackState(), action);
            // AC5 — WITHOUT THIS the bar is connected to a state that knows
            // none of it: on this path PLAYBACK_MANIFEST_LOADED never fires, so
            // nNode stays 0 and memoryPlan stays null, and budgetSource has no
            // home in state at HEAD at all.
            expect(state.status).toBe(PLAYBACK_STATUS.FALLBACK);
            expect(state.nNode).toBe(CHUNK2_NODES);
            expect(state.nFace).toBe(6786150);
            expect(state.budgetBytes).toBe(399 * MIB);
            expect(state.budgetSource).toBe('small-device');
            expect(state.fallbackReason).toBe('floor-window-exceeds-budget');
            expect(state.floorWindowPlanPeakBytes).toBe(CHUNK2_FLOOR_WINDOW_BYTES);
            expect(state.fallbackLayerShown).toBe('added');
            expect(state.pendingPlay).toBe(false);
            expect(state.memoryPlan).toBe(null);

            // AC6 — a TICK or a SEEK cannot escape it. RED is unavailable: no
            // such status exists at HEAD, so this spec cannot even be written
            // against unmodified source.
            const ticked = playbackControllerReducer(state, playbackTick(Date.now()));
            expect(ticked.status).toBe(PLAYBACK_STATUS.FALLBACK);
            expect(ticked.currentTimestep).toBe(state.currentTimestep);
            const sought = playbackControllerReducer(state, playbackSeek(5));
            expect(sought.status).toBe(PLAYBACK_STATUS.FALLBACK);
            expect(sought.currentTimestep).toBe(state.currentTimestep);

            // ...and PLAYBACK_RESET clears every one of the new keys, because
            // they live in createInitialPlaybackState().
            const reset = playbackControllerReducer(state, playbackReset(77, 'layer-77'));
            expect(reset.status).toBe(PLAYBACK_STATUS.IDLE);
            expect(reset.fallbackReason).toBe(null);
            expect(reset.budgetSource).toBe(null);
            expect(reset.fallbackLayerShown).toBe(null);
            expect(reset.nFace).toBe(0);
        });
    });

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

    // TASK-2814 — a null/failed envelope must EXIT Max mode with a warning,
    // never leave the renderer drawing its zero-filled buffer as a false
    // "everything dry" run-maximum.
    describe('playbackEnvelopeFetchEpic failure paths (TASK-2814)', () => {
        function envelopeState(overrides = {}) {
            return {
                ...createInitialPlaybackState(),
                runId: '9', quantity: 'depth', envelopeMode: true, envelopeData: null,
                envelopeQuantities: ['depth'],
                ...overrides
            };
        }

        it('a REJECTED fetch exits Max mode and shows a warning — never ENVELOPE_LOADED(null)', (done) => {
            const store = makeStore(envelopeState());
            fetcherRegistry.set('9', {
                manifest: { quantization: { depth_max: { scale: 0.001, offset: 0 } } },
                fetchAndDecodeChunk: () => Promise.reject(new Error('boom'))
            });
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackEnvelopeFetchEpic(action$, store).subscribe((a) => seen.push(a), done, () => {
                expect(seen.map((a) => a.type)).toEqual([PLAYBACK_SET_ENVELOPE_MODE, SHOW_NOTIFICATION]);
                expect(seen[0].enabled).toBe(false);
                expect(seen[1].level).toBe('warning');
                expect(seen.filter((a) => a.type === PLAYBACK_ENVELOPE_LOADED).length).toBe(0);
                done();
            });
            subject.next(playbackSetEnvelopeMode(true));
            setTimeout(() => subject.complete(), 50);
        });

        it('a NULL result (store cannot serve the quantity after all) takes the same exit, not silent-dry', (done) => {
            const store = makeStore(envelopeState());
            // No quantization block for depth_max -> loadPlaybackEnvelope
            // resolves null without even fetching.
            fetcherRegistry.set('9', {
                manifest: { quantization: {} },
                fetchAndDecodeChunk: () => Promise.reject(new Error('must not be called'))
            });
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackEnvelopeFetchEpic(action$, store).subscribe((a) => seen.push(a), done, () => {
                expect(seen.map((a) => a.type)).toEqual([PLAYBACK_SET_ENVELOPE_MODE, SHOW_NOTIFICATION]);
                done();
            });
            subject.next(playbackSetEnvelopeMode(true));
            setTimeout(() => subject.complete(), 50);
        });

        it('a stale failure (run switched mid-fetch) emits NOTHING — it must not kick the new context out of Max', (done) => {
            const store = makeStore(envelopeState());
            fetcherRegistry.set('9', {
                manifest: { quantization: { depth_max: { scale: 0.001, offset: 0 } } },
                fetchAndDecodeChunk: () => new Promise((_, reject) => setTimeout(() => reject(new Error('late boom')), 10))
            });
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackEnvelopeFetchEpic(action$, store).subscribe((a) => seen.push(a), done, () => {
                expect(seen.length).toBe(0);
                done();
            });
            subject.next(playbackSetEnvelopeMode(true));
            // the operator switches runs while the fetch is in flight
            store.__setPlayback(envelopeState({ runId: '10' }));
            setTimeout(() => subject.complete(), 60);
        });

        it('a successful fetch still lands as ENVELOPE_LOADED with the dequantized array', (done) => {
            const store = makeStore(envelopeState());
            fetcherRegistry.set('9', {
                manifest: { quantization: { depth_max: { scale: 0.5, offset: 1.0 } } },
                fetchAndDecodeChunk: () => Promise.resolve(new Uint16Array([0, 2]))
            });
            const { subject, action$ } = makeActionsSubject();
            const seen = [];
            playbackEnvelopeFetchEpic(action$, store).subscribe((a) => seen.push(a), done, () => {
                expect(seen.map((a) => a.type)).toEqual([PLAYBACK_ENVELOPE_LOADED]);
                expect(Array.from(seen[0].data)).toEqual([1.0, 2.0]);
                done();
            });
            subject.next(playbackSetEnvelopeMode(true));
            setTimeout(() => subject.complete(), 50);
        });
    });
});

/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackEpics — the real fetch/timer/map glue driving the pure
 * playbackController reducer (TASK-2627, W3.1, epic 2618). Every epic here
 * is thin: read playback state, call the W2.1 data plane (PlaybackChunkFetcher
 * via loadPlaybackLayerOptions's seam) or dispatch a MapStore layers action,
 * never re-implement transition logic the reducer already owns.
 *
 * Non-serializable PlaybackChunkFetcher instances live OUTSIDE redux, keyed
 * by runId (same "escape hatch" pattern as AnugaPlaybackLayer's
 * `olLayer.__anugaPlaybackRenderer` — see the W2 wave report) — Redux state
 * should never hold a class instance with in-flight promises/caches.
 *
 * State lives at `state.anugaPlayback`, NOT `state.playback` — found live
 * (not in karma, which never boots the real combined MapStore store):
 * MapStore2 core already owns the `playback` redux key for its OWN Timeline
 * plugin (web/client/reducers/playback.js). Registering a second reducer
 * under the same key silently produced `state.playback === {}` on this map
 * (neither reducer's own default state), not an error — so this collision
 * would have shipped invisibly. `anugaPlayback` avoids it entirely.
 */
import Rx from 'rxjs';
// TASK-2744 (AC19, epic 2706) — the playback layer is EPHEMERAL VIEW STATE,
// not map content, so it lives on `additionallayers` as an `overlay` rather
// than in `layers.flat`. Three defects follow from the old addLayer():
//   1. ADD_LAYER files a layer with no `group` under DEFAULT_GROUP_ID
//      ('Default', LayersUtils.js:36) and materialises a real group node, so
//      SimpleView's "one button per non-empty group"
//      (simpleViewContainer.js:376-383) grew a FIFTH menu button titled
//      "Default"; its pane is empty because simpleViewMenuRows.js filters on
//      `layer.group`, which ADD_LAYER never stamps onto the layer object —
//      measured live on map 1461: 4 buttons -> 5, pane reads "No datasets
//      here yet...".
//   2. MapUtils.saveMapConfiguration maps over `state.layers.flat` with NO
//      filtering (MapUtils.js:574-590) and LayersUtils.saveLayer has no
//      opt-out flag, so the layer was persisted into the saved map and
//      survived a fresh load.
//   3. Nothing ever removed it.
// `layerSelectorWithMarkers` (selectors/layers.js:44-63) concats
// actionType 'overlay' options onto the rendered layer array, and the Map
// plugin renders from exactly that selector (plugins/map/selector.js), so the
// layer still draws — it simply never enters layers.flat, the groups tree,
// the TOC or the saved map. Same posture StreetView/Isochrone/Itinerary use.
import {
    updateAdditionalLayer,
    mergeOptionsById,
    removeAdditionalLayer
} from '@mapstore/framework/actions/additionallayers';
import { CLICK_ON_MAP } from '@mapstore/framework/actions/map';
// TASK-2656c (W6.5, epic 2618) — suppressing the generic GetFeatureInfo
// popup while playback Inspect is armed. `changeMapInfoState` is the SAME
// plain core action several other MapStore2 plugins already dispatch to
// suppress the identify-on-click popup while THEIR own tool owns the click
// (Itinerary/StreetView/Isochrone/longitudinalProfile/geoProcessing epics —
// grep `changeMapInfoState` in web/client/epics/geoProcessing.js for the
// precedent). Importing/dispatching a core action is not editing the fork
// (see AnugaPlaybackLayer.js's header on that distinction).
import { changeMapInfoState } from '@mapstore/framework/actions/mapInfo';
import { mapInfoEnabledSelector } from '@mapstore/framework/selectors/mapInfo';

import { fetchPlaybackManifest, PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { loadPlaybackMesh, loadPlaybackTime, loadPlaybackDt, loadPlaybackFrame, loadPlaybackEnvelope } from '../loadPlaybackLayerOptions';
import {
    QUANTITY_ARRAYS,
    resolveChunkLengthT,
    assertNodeExtentMatchesMesh,
    assertDeclaredNodeCountAgrees
} from '../playbackChunkShape';
import {
    computePlaybackMemoryPlan,
    readNodeCount,
    describePlan,
    // TASK-2743 UAT-08 (W6, epic 2706) — the operator's "pre-load ... safely
    // in response to available memory". Read ONCE per manifest load and
    // threaded into both plans below, so the initial and the exact-nFace plan
    // can never be costed against different budgets.
    resolvePlaybackHeapBudgetFromEnvironment,
    PLAYBACK_BUDGET_WARN_PREFIX
} from '../playbackMemoryPolicy';
// TASK-2744 (AC20, epic 2706) — score the plan against a measurement.
import { scorePlan, isForecastContradicted, describeScore } from '../playbackMemoryAudit';
import { reprojectMeshVertices, reprojectMeshBounds } from '../playbackReproject';
import { sampleFieldAtPoint } from '../playbackIdentify';
import {
    timestepToChunkIndex,
    colorMaxForQuantity,
    colorMinForQuantity,
    isColorMaxOverridden,
    DEFAULT_PLAYBACK_OPACITY,
    DEFAULT_PLAYBACK_BACKGROUND_OPACITY
} from '../playbackController';
import { mixDtSeconds } from '../playbackDerivedQuantities';
import {
    PLAYBACK_INIT,
    PLAYBACK_PLAY,
    PLAYBACK_PAUSE,
    PLAYBACK_SEEK,
    PLAYBACK_TICK,
    PLAYBACK_MANIFEST_LOADED,
    PLAYBACK_CHUNKS_BUFFERED,
    PLAYBACK_SET_QUANTITY,
    PLAYBACK_RESET,
    PLAYBACK_SET_IDENTIFY_ARMED,
    PLAYBACK_SET_WIREFRAME,
    PLAYBACK_SET_OPACITY,
    PLAYBACK_SET_BACKGROUND_OPACITY,
    PLAYBACK_SET_OVERLAY,
    PLAYBACK_SET_COLOR_MAX,
    PLAYBACK_SET_ENVELOPE_MODE,
    PLAYBACK_ENVELOPE_LOADED,
    playbackManifestLoaded,
    playbackManifestFetched,
    playbackLoadProgress,
    playbackManifestFailed,
    playbackChunksBuffered,
    playbackChunkBufferError,
    playbackTick,
    playbackSetIdentifyResult,
    playbackEnvelopeLoaded,
    playbackSetEnvelopeMode
} from '../actions/playbackActions';
import { show } from '@mapstore/framework/actions/notifications';

// ~20Hz controller clock. NOT a render-fps claim (memory:
// reference-claude-in-chrome-prod-ui-driving-traps — never measure
// smoothness via rAF on this box) — this only paces how often the reducer
// re-samples the sim-time playhead; the GPU still draws every rAF the
// browser gives it via the layer's own `render(frameState)` hook.
export const TICK_INTERVAL_MS = 50;
// The time-chunk length is NOT a constant here any more (TASK-2724, epic
// 2706) — it is read per store from its own chunk_grid, see playbackChunkShape.
// Neither is the buffer window (TASK-2708) — it comes from the store's own
// memory plan on pb.bufferWindowRadius / pb.bufferWindowAhead, and there is
// deliberately no local fallback constant here any more: a `||`-style
// fallback silently turned the plan's legitimate radius of ZERO back into 2,
// which is the whole defect this task removes.

// The `owner` every playback overlay is registered under, so a teardown can
// remove the whole group without knowing individual layer ids.
export const PLAYBACK_LAYER_OWNER = 'anuga-playback';

// runId -> PlaybackChunkFetcher. Exported so a test (or a future "switch
// run" cleanup path) can inspect/clear it without reaching into closures.
export const fetcherRegistry = new Map();
// runId -> the currentTimestep last used to set frame0/frame1 on the layer,
// so mixT-only ticks (the common case) dispatch a cheap
// mergeOptionsById({mixT}) instead of re-fetching/re-uploading frames.
const lastSyncedTimestep = new Map();
// runId -> {timestep, frame}: the frame1 the last sync loaded, kept so the
// NEXT step can adopt it as frame0 instead of dequantizing the same timestep
// twice. See playbackSyncLayerEpic for why identity (not equality) is the
// property that matters downstream. TASK-2743 UAT-07.
const lastFrame1 = new Map();

// runId -> {sourceMesh, layerMesh}. TASK-2628 live-verify catch:
// AnugaPlaybackLayer's worker reprojection TRANSFERS (detaches)
// mesh.nodeX/nodeY's ArrayBuffers by design (W2 wave report — the transfer
// IS the proof the worker ran). Handing `pb.mesh` straight to the layer
// therefore detaches the SAME object still referenced by Redux state —
// silently zeroing pb.mesh.nodeX/nodeY for every OTHER reader (e.g.
// playbackIdentifyEpic's own reprojection). Cloning nodeX/nodeY into a
// layer-only mesh object (cached by source-mesh reference, so it stays
// STABLE across repeated dispatches and doesn't defeat the layer's own
// `newOptions.mesh !== oldOptions.mesh` re-reproject check) lets the layer
// safely transfer its private copy while `pb.mesh` stays intact forever.
const layerMeshCache = new Map();

// runId -> {mesh, x3857, y3857} — the reprojected mesh vertices identify
// needs (the renderer's OWN EPSG:3857 coordinate space, NOT the raw local
// mesh nodeX/nodeY the fetcher decodes). Reprojecting all ~50k+ vertices on
// EVERY click would be wasteful; cached per runId, invalidated whenever
// `pb.mesh` is a different reference (a new run/store loaded).
const reprojectedMeshCache = new Map();

// runId -> the over-budget breadcrumb has already been emitted for this run
// (TASK-2732). Module state rather than a closure so the guard survives the
// two plan computations of a single load; cleared by disposeRun, so a run that
// is torn down and re-opened announces itself again.
const budgetWarnedRuns = new Set();

/**
 * Drop every off-Redux structure keyed by `runId` (TASK-2744 AC2, epic 2706).
 *
 * The four Maps above hold a run's heavyweight state and, before this task,
 * NONE of them was ever deleted from: `fetcherRegistry` was `.set` at INIT and
 * read by two epics but never `.delete`d, and the same was true of
 * `lastSyncedTimestep`, `layerMeshCache` (a full Float32Array clone of
 * nodeX/nodeY) and `reprojectedMeshCache` (two more Float32Arrays of 3.39M
 * vertices each). On the prod-scale store that is ~578 MiB retained per stale
 * run, and the trigger is the ordinary Results-menu scenario switch — so
 * comparing three runs on an 8 GB laptop killed the tab.
 *
 * `keepRunId` lets INIT dispose the PREVIOUS run without touching the one it
 * is about to create.
 */
export function disposeRun(runId, keepRunId = null) {
    if (!runId || runId === keepRunId) {
        return false;
    }
    const fetcher = fetcherRegistry.get(runId);
    // Release the decoded chunks explicitly rather than waiting for the
    // fetcher itself to become unreachable: they are the large half.
    // TASK-2728 moved the static mesh arrays OUT of the LRU into their own
    // map, so releasing the LRU alone now leaves ~100 MB of mesh behind —
    // releaseCaches() drops both.
    if (fetcher && typeof fetcher.releaseCaches === 'function') {
        fetcher.releaseCaches();
    }
    fetcherRegistry.delete(runId);
    lastSyncedTimestep.delete(runId);
    layerMeshCache.delete(runId);
    reprojectedMeshCache.delete(runId);
    budgetWarnedRuns.delete(runId);
    return true;
}

/**
 * The timestep the layer's CURRENT frame0/frame1 were actually loaded for.
 *
 * TASK-2706 (W1 review) — this is `pb.currentTimestep` only while the sync
 * epic is keeping up. When a frame load is REFUSED (see
 * playbackSyncLayerEpic's catch below), no changeLayerProperties is
 * dispatched at all, so the layer keeps rendering the older frames while
 * `pb.currentTimestep` keeps advancing in the reducer. Stamping
 * `pb.currentTimestep` on an Inspect readout in that state attributes the
 * OLD numbers to the NEW timestep — a silently wrong depth reading, which is
 * exactly what playbackIdentifyEpic's own header promises can never happen
 * ("the readout can never show a value the screen isn't also showing").
 * Undefined (nothing synced yet) falls back to the playhead; the identify
 * epic's `!layer.frame0` guard already covers that case.
 */
function renderedTimestep(pb) {
    const synced = lastSyncedTimestep.get(pb.runId);
    return synced === undefined ? pb.currentTimestep : synced;
}

function arrayConfigsFor(quantization) {
    const q = quantization || {};
    const configs = {};
    QUANTITY_ARRAYS.forEach((name) => {
        const meta = q[name] || {};
        configs[name] = { dtype: 'uint16', byteorder: meta.byteorder || 'little', quantization: meta.scale !== undefined ? meta : undefined };
    });
    return configs;
}

/**
 * usedJSHeapSize, or null where the browser does not expose it (TASK-2744
 * AC20). Never faked — a null observation scores as "unmeasured", which is
 * honest, rather than as "within budget", which is the defect.
 */
export function readHeapBytes() {
    const mem = typeof performance !== 'undefined' && performance.memory;
    return mem && isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize : null;
}

/**
 * Reconcile the store's memory plan against what actually happened, and leave
 * a breadcrumb when they disagree (TASK-2744 AC20).
 *
 * Console, not controller state: this is diagnostics about a prediction, not
 * playback state the UI renders, and a `console.warn` is what makes the
 * contradiction visible in the one place someone debugging a wedged tab is
 * already looking. Returns the score so a test can assert on it.
 */
export function reportMemoryScore(memoryPlan, fetcher, baselineHeapBytes) {
    const score = scorePlan(memoryPlan, {
        accountedBytes: (memoryPlan && memoryPlan.fixedBytes || 0)
            + (fetcher && typeof fetcher.residentBytes === 'function' ? fetcher.residentBytes() : 0),
        heapBytes: readHeapBytes(),
        baselineHeapBytes
    });
    if (isForecastContradicted(score)) {
        // eslint-disable-next-line no-console
        console.warn(`[playback] ${describeScore(score)}`);
    }
    return score;
}

/**
 * Say out loud that this store does not fit — ONCE per run (TASK-2732, W3,
 * epic 2706).
 *
 * `withinBudget` is computed by playbackMemoryPolicy and, before this, nothing
 * ACTED on false. The clamp to MIN_CHUNKS_PER_QUANTITY ships the store anyway
 * and that is the deliberate engineering call — one chunk plus its neighbour is
 * the minimum that can play at all, and the alternative is a player that will
 * not open — but it shipped in total silence, so a wedged tab looked exactly
 * like the epic 2618 freeze even though the client had PREDICTED it before
 * downloading a byte. This is that missing breadcrumb, and nothing more: it
 * does not refuse the store, resize the cache or touch the policy arithmetic.
 *
 * NOT already covered by reportMemoryScore above. That warn is the exact
 * COMPLEMENT of this one: isForecastContradicted short-circuits on
 * `!!score.predictedWithinBudget`, so a plan whose withinBudget is FALSE emits
 * nothing there. AC20 scores an optimistic forecast against measurement; this
 * announces a pessimistic one, before any measurement exists.
 *
 * ONCE PER RUN, NOT ONCE PER PLAN. playbackInitEpic plans the same store twice
 * — the manifest-time plan with an ESTIMATED nFace, then the exact-nFace
 * re-plan once the mesh has landed — and the operator must see one line, not
 * two. The seam is the manifest-time plan: it is the one that sizes the cache
 * the fetcher is constructed with, and it fires before the mesh download
 * starts, which is the moment a breadcrumb is worth having.
 *
 * `describePlan(plan)` verbatim as the body — it already renders every term
 * needed to diagnose the store (nNode, nFace, chunkLengthT, chunk size, slots,
 * cache, fixed, peak/budget), and re-wording it here would be a second copy to
 * drift.
 *
 * No eslint-disable, deliberately: the effective config for this tree is
 * `no-console: ["error", { allow: ["error", "warn"] }]` (verify with
 * `npx eslint --print-config`), so console.warn lints clean and a disable
 * directive here would be a needless one.
 *
 * @param {number|string} runId
 * @param {object|null} plan a computePlaybackMemoryPlan result
 * @returns {boolean} whether a line was emitted, so a caller/test can prove it
 */
export function warnIfOverBudget(runId, plan) {
    // `!== false` and not `!plan.withinBudget`: an undefined verdict is a plan
    // shape this function does not understand, and inventing a warning for it
    // would make the signal untrustworthy exactly the way "always fires" does.
    if (!plan || plan.withinBudget !== false || budgetWarnedRuns.has(runId)) {
        return false;
    }
    budgetWarnedRuns.add(runId);
    console.warn(`${PLAYBACK_BUDGET_WARN_PREFIX} ${describePlan(plan)}`);
    return true;
}

/**
 * How many store objects the mesh phase will fetch (TASK-2744 AC18).
 *
 * loadPlaybackMesh pulls six static arrays (node_x, node_y, elevation,
 * friction, inradius, face_node_connectivity), plus `time` and `dt_ms`. A
 * has_dt=false store has NO chunk_urls entry for dt_ms — the exporter skips an
 * all-fill chunk — so it is counted only when the manifest actually offers it,
 * otherwise progress would stall one object short of its own total forever.
 */
const MESH_PHASE_KEYS = [
    'node_x/c/0', 'node_y/c/0', 'elevation/c/0', 'friction/c/0',
    'inradius/c/0', 'face_node_connectivity/c/0', 'time/c/0'
];

export function countMeshObjects(manifest) {
    const urls = (manifest && manifest.chunk_urls) || {};
    let n = MESH_PHASE_KEYS.filter((k) => urls[k] !== undefined).length;
    if (urls['dt_ms/c/0'] !== undefined) {
        n += 1;
    }
    // A manifest whose key shape we do not recognise still gets an honest
    // count rather than 0, which would render "3 of 0".
    return n || MESH_PHASE_KEYS.length;
}

/**
 * The url to re-fetch a manifest through when a presigned chunk url comes
 * back 403 (TASK-2739, W3, epic 2706).
 *
 * `?refresh=1` is the backend's cache bypass — api_v2.py's playback-manifest
 * action reads it into `build_playback_manifest(force_refresh=True)`, which
 * skips the cache READ, RE-SIGNS every chunk url, and still writes the entry
 * back, so one refreshing client repairs the manifest for every other viewer
 * in the same bucket. It is load-bearing on prod because signing uses IMDS
 * instance-role credentials that can die before the presigned urls' nominal
 * ExpiresIn (TASK-2064): one rotation just after a manifest is cached leaves
 * every viewer of that run holding dead urls, and a plain re-fetch is a no-op
 * because it is answered from the same cache entry. Shortening the cache
 * bucket is NOT the alternative — decision D10: bucket length IS the browser
 * cache-hit window (run.py's bucket_index is part of the cache key), worth
 * the 60.29 MiB of re-download W2 measured down to 0.00 MiB.
 *
 * Query handling is the whole reason this is a function rather than a
 * concatenation: buildPlaybackManifestUrl (anugaScenarioMenu.js) emits a bare
 * `/api/v2/anuga/runs/<id>/playback-manifest/`, but the playback control bar
 * lets an operator paste ANY manifest url, including a W0 rig fixture url
 * that already carries a query string.
 *
 * @param {string} manifestUrl
 * @returns {string} the same url with refresh=1 added as a query param
 */
export function buildManifestRefreshUrl(manifestUrl) {
    const separator = String(manifestUrl).indexOf('?') === -1 ? '?' : '&';
    return `${manifestUrl}${separator}refresh=1`;
}

/**
 * PLAYBACK_INIT -> ensure the target layer exists (a bare 'anuga-playback'
 * placeholder — AnugaPlaybackLayer.create() tolerates no mesh/frames yet),
 * fetch the manifest, load the mesh + time array via the W2.1/W2.2 seam,
 * and dispatch MANIFEST_LOADED (or FAILED). Never assumes an S3 origin —
 * whatever manifestUrl the caller passes is followed verbatim, exactly like
 * playbackChunkFetcher's own contract.
 */
export function playbackInitEpic(action$, store) {
    return action$.ofType(PLAYBACK_INIT).mergeMap((action) => {
        const { runId, layerId, manifestUrl } = action;
        const state = store.getState();
        // TASK-2744 AC2 — a second INIT must not strand the previous run's
        // fetcher/caches. Loading a new store used to leave the old
        // PlaybackChunkFetcher (and its decoded-chunk cache) alive in
        // fetcherRegistry forever, because nothing ever deleted from it.
        disposeRun(state.anugaPlayback && state.anugaPlayback.runId, runId);
        const layerExists = (state.additionallayers || []).some((l) => l.id === layerId);
        const ensureLayer$ = layerExists ? Rx.Observable.empty() : Rx.Observable.of(updateAdditionalLayer(
            layerId,
            PLAYBACK_LAYER_OWNER,
            'overlay',
            {
                // `id` and `type` MUST live inside `options`: the registry's
                // own `id` is only the lookup key, while the overlay selector
                // passes `options` through verbatim as the layer object.
                id: layerId,
                type: 'anuga-playback',
                title: `Playback run ${runId}`,
                visibility: true,
                // TASK-2744 AC3 — the operator-controllable default, no longer
                // a hardcoded 0.85 veil over the terrain being flooded.
                opacity: DEFAULT_PLAYBACK_OPACITY,
                // TASK-2788 — stated, not left to the layer's own fallback.
                // AnugaPlaybackLayer.create() would default this to 0 anyway,
                // but then the default would live in two places and a later
                // change to one of them would silently disagree with the
                // controller's initial state.
                backgroundOpacity: DEFAULT_PLAYBACK_BACKGROUND_OPACITY,
                wireframe: false,
                colorMode: 'depth',
                colorMax: 1,
                mixT: 0
            }
        ));

        async function runLoad(emit) {
            // Sampled BEFORE a byte is fetched — a heap delta is only
            // meaningful against a baseline taken before the allocation.
            const baselineHeapBytes = readHeapBytes();
            const manifest = await fetchPlaybackManifest(manifestUrl);
            // The manifest RESPONSE is in. Everything from here is the mesh
            // download + unpack, and it must not keep wearing that label.
            const meshObjectCount = countMeshObjects(manifest);
            emit(playbackManifestFetched(runId, meshObjectCount));
            let objectsLoaded = 0;
            let bytesLoaded = 0;
            const onProgress = ({ bytes }) => {
                objectsLoaded += 1;
                bytesLoaded += bytes || 0;
                emit(playbackLoadProgress(runId, { objectsLoaded, objectCount: meshObjectCount, bytesLoaded }));
            };
            // TASK-2724 — the store's OWN time-chunk length, before a single
            // byte of mesh is downloaded. Throws (-> MANIFEST_FAILED, with the
            // reason surfaced in the UI) on a store that does not declare it
            // or whose quantity arrays disagree; there is deliberately no
            // fallback, because guessing renders the wrong timestep silently.
            const chunkLengthT = resolveChunkLengthT(manifest);
            // TASK-2729 arm 2 — the dim-1 twin, at manifest time. Presence-
            // gated: schema_metadata.n_node is absent on every store written
            // so far, and refusing on absence would refuse the whole product.
            // Once TASK-2719 declares it, this catches a self-contradicting
            // store BEFORE the ~100 s mesh download rather than after it.
            assertDeclaredNodeCountAgrees(manifest);
            const meta0 = manifest.schema_metadata || {};
            const nTime0 = meta0.n_time || 0;
            // TASK-2708 (W1.2, epic 2706) — size the cache from THIS store
            // before a single byte is fetched. nNode comes from the store's
            // own chunk_shapes ([chunk_length_t, n_node]); the triangle count
            // is not declared in the manifest, so the plan is refined below
            // once face_node_connectivity has landed.
            const nNode0 = readNodeCount(manifest);
            const totalChunks0 = nTime0 && chunkLengthT ? Math.ceil(nTime0 / chunkLengthT) : undefined;
            const heapBudget = resolvePlaybackHeapBudgetFromEnvironment();
            const initialPlan = nNode0
                ? computePlaybackMemoryPlan({
                    nNode: nNode0, chunkLengthT, totalChunks: totalChunks0,
                    budgetBytes: heapBudget.budgetBytes
                })
                : null;
            // TASK-2732 (W3, epic 2706) — THE seam. This plan already knows
            // whether the store fits, and until now that verdict was dropped
            // on the floor. Announced here, before the mesh download starts,
            // and guarded so the exact-nFace re-plan below cannot repeat it.
            warnIfOverBudget(runId, initialPlan);
            // TASK-2739 (W3, epic 2706) — the 403 recovery the fetcher has
            // documented since W2.1 and never had a caller for. Without
            // `refreshManifest` a chunk url whose credentials rotated dies at
            // the fetcher's "no refreshManifest available to retry" throw, so
            // W2's manifest cache would turn one rotation into a dead run for
            // the rest of the bucket. Same run, same relative keys, freshly
            // signed urls.
            const fetcher = new PlaybackChunkFetcher({
                manifest,
                memoryPlan: initialPlan,
                onProgress,
                refreshManifest: () => fetchPlaybackManifest(buildManifestRefreshUrl(manifestUrl))
            });
            fetcherRegistry.set(runId, fetcher);
            lastSyncedTimestep.delete(runId);
            // TASK-2629 (W4.1) — dt_ms loads alongside mesh/time (a small,
            // single-chunk array, schema §1). CORRECTION (live-verify, W4
            // resume): a has_dt=false store's dt_ms array is uniformly the
            // fill value (NaN) — the real W1 exporter does NOT write a chunk
            // file for an all-fill-value chunk (a standard Zarr sparse-chunk
            // optimisation: an absent chunk reads back as fill_value), so
            // the manifest has NO chunk_urls entry for 'dt_ms/c/0' on every
            // has_dt=false run (both real on-box stores). Without this
            // catch, PlaybackChunkFetcher's missing-chunk_urls-entry throw
            // propagated out of the Promise.all and failed the ENTIRE
            // manifest load (MANIFEST_FAILED) for ANY has_dt=false run — the
            // opposite of "graceful Courant-only omission" (AC). `dtMs: null`
            // is a fully supported value everywhere it is read
            // (mixDtSeconds/`!dtMs` guard, playbackController's own
            // `dtMs: null` initial-state default), and `hasDt` is derived
            // independently from `schema_metadata.has_dt`, never from
            // whether this fetch succeeded.
            const [mesh, time, dtMs] = await Promise.all([
                loadPlaybackMesh(fetcher),
                loadPlaybackTime(fetcher),
                loadPlaybackDt(fetcher).catch(() => null)
            ]);
            const meta = manifest.schema_metadata || {};
            const nTime = meta.n_time || time.length;
            const totalChunks = Math.ceil(nTime / chunkLengthT);
            const nNode = meta.n_node || mesh.nodeX.length;
            // TASK-2729 arm 1 — the arm that can actually fire on the stores
            // we have. This is the first and only moment BOTH numbers are in
            // hand (the store's declared chunk node extent, and the node count
            // the mesh really shipped), and it is before any frame is sliced.
            // A disagreement here does not crash downstream: it returns a
            // finite, plausible surface welded from two timesteps. Refuse it.
            //
            // Anchored on mesh.nodeX.length, NOT on `nNode` above: nNode
            // prefers `meta.n_node`, which comes from the same manifest the
            // guard is checking, so using it would let a manifest that lies
            // about itself agree with itself and walk straight through. node_x
            // is written single-chunk (`chunks=(n_node,)`), so its decoded
            // length is the store's real node count on every store.
            assertNodeExtentMatchesMesh(manifest, mesh.nodeX.length);
            // TASK-2708 — re-plan with the EXACT triangle count now that the
            // mesh is here (the manifest-time plan had to estimate it), and
            // push the corrected ceiling into the cache that is already live.
            const memoryPlan = computePlaybackMemoryPlan({
                nNode,
                nFace: mesh.faceNodeConnectivity ? mesh.faceNodeConnectivity.length / 3 : undefined,
                chunkLengthT,
                totalChunks,
                budgetBytes: heapBudget.budgetBytes
            });
            fetcher.applyMemoryPlan(memoryPlan);
            // TASK-2744 AC20 — SCORE THE FORECAST. `withinBudget` had zero
            // readers anywhere, which is why it could report true at 711.8 MiB
            // against an 800 MiB budget in a session whose heap peak was
            // 840.7 MiB. This is the load peak: the mesh is fully decoded and
            // the first chunks are cached, so it is the moment the prediction
            // is about.
            reportMemoryScore(memoryPlan, fetcher, baselineHeapBytes);
            // TASK-2726 (W5.5, epic 2706) — publish the store's EPSG:3857
            // extent so the bar's "zoom to results" control has something to
            // aim at. It is computed HERE, in the epic, because the control
            // bar is connect()ed to state.anugaPlayback only and the OL layer
            // that owns the reprojected vertices has no dispatch — so the
            // bounds have to reach Redux, not be reached for. Allocation-free
            // (see reprojectMeshBounds' header for why that matters in an
            // epic with hard byte budgets); null on a store whose epsg is
            // unusable, which the control renders as DISABLED, never as a
            // button that silently does nothing.
            const meshBounds3857 = reprojectMeshBounds(mesh.nodeX, mesh.nodeY, mesh);
            emit(playbackManifestLoaded({
                runId, manifest, mesh, time, dtMs, quantization: manifest.quantization,
                nTime, nNode, chunkLengthT, totalChunks, memoryPlan, meshBounds3857
            }));
        }

        // TASK-2744 (AC18, epic 2706) — Observable.create, not fromPromise.
        //
        // The whole load used to be ONE promise, so nothing at all was
        // dispatched between PLAYBACK_INIT (status 'loading-manifest') and
        // MANIFEST_LOADED. Measured on map 1461: a single opaque 46.4-second
        // block wearing the 'loading-manifest' label, while the manifest
        // endpoint itself answered in milliseconds. Emitting mid-flight is the
        // whole point — a promise cannot do that.
        const load$ = Rx.Observable.create((observer) => {
            let cancelled = false;
            const emit = (a) => {
                if (!cancelled) {
                    observer.next(a);
                }
            };
            (async() => {
                try {
                    await runLoad(emit);
                } catch (error) {
                    emit(playbackManifestFailed(runId, String((error && error.message) || error)));
                }
                if (!cancelled) {
                    observer.complete();
                }
            })();
            return () => {
                cancelled = true;
            };
        });

        return Rx.Observable.merge(ensureLayer$, load$);
    });
}

/**
 * Keeps the fetcher's buffer topped up around the current playhead: fires
 * on manifest-load, play, seek, chunks-buffered (a window may have grown to
 * need its NEXT neighbour) and every tick (the playhead may have crossed a
 * chunk boundary). A no-op whenever the required window is already fully
 * buffered — PlaybackChunkFetcher.fetchAndDecodeChunk's own cache + in-flight
 * dedup make a redundant call here cheap, but skipping it avoids spamming
 * the network layer on every 50ms tick regardless.
 */
export function playbackBufferEpic(action$, store) {
    const trigger$ = action$.ofType(
        PLAYBACK_MANIFEST_LOADED, PLAYBACK_PLAY, PLAYBACK_SEEK, PLAYBACK_TICK, PLAYBACK_CHUNKS_BUFFERED
    );
    return trigger$.switchMap(() => {
        const pb = store.getState().anugaPlayback;
        if (!pb || !pb.runId || !pb.manifest || !pb.totalChunks) {
            return Rx.Observable.empty();
        }
        const fetcher = fetcherRegistry.get(pb.runId);
        if (!fetcher) {
            return Rx.Observable.empty();
        }
        const centerChunk = timestepToChunkIndex(pb.currentTimestep, pb.chunkLengthT);
        // TASK-2708 — the SAME behind/ahead pair drives the "is it already
        // buffered?" check and the actual prefetch, so the epic can never ask
        // for a window it then refuses to recognise as complete.
        const windowRadius = pb.bufferWindowRadius;
        const windowAhead = pb.bufferWindowAhead;
        const window = fetcher.getPrefetchWindow(centerChunk, pb.totalChunks, windowRadius, { ahead: windowAhead });
        const alreadyBuffered = new Set(pb.bufferedChunks);
        if (window.every((c) => alreadyBuffered.has(c))) {
            return Rx.Observable.empty();
        }
        const arrayConfigs = arrayConfigsFor(pb.quantization);
        // TASK-2743 UAT-09 (W6, epic 2706) — report EACH chunk the moment its
        // own arrays land, rather than holding the whole window behind its
        // slowest member. The controller only needs the chunk(s) frame0/frame1
        // sit in (requiredWindowFor — usually one) to leave `buffering`, so
        // batching the report made the deepest prefetch the readiness gate.
        // Measured on map 1461 with a 3-chunk window: 7,954 ms from `buffering`
        // to `ready`, with chunk 0's three arrays already decoded.
        //
        // `merge` (not `forkJoin`) is the whole point — one emission per chunk,
        // in arrival order.
        const chunkGroups = fetcher.prefetchWindowByChunk(
            arrayConfigs, centerChunk, pb.totalChunks, { windowRadius, windowAhead }
        );
        return Rx.Observable.merge(
            ...chunkGroups.map((group) => Rx.Observable.fromPromise(group.promise))
        ).mergeMap((results) => {
            const errors = results.filter((r) => r.error);
            const actions = [];
            // TASK-2744 AC20 — report what the fetcher ACTUALLY holds, not the
            // window we just asked for. "these arrived" and "these are still
            // here" differ after an LRU eviction, and residentChunkIndices
            // already applies the same all-arrays-present predicate a frame
            // needs, so it is the only thing worth announcing.
            const resident = fetcher.residentChunkIndices(QUANTITY_ARRAYS);
            // TASK-2743 UAT-10 (W6, epic 2706) — announce ONLY on an actual
            // change. PLAYBACK_CHUNKS_BUFFERED is one of THIS epic's own
            // triggers, so an announcement that carries nothing new still
            // re-enters the switchMap above, which tears down the still-open
            // `merge` and re-issues the window; chunk 0 then resolves straight
            // out of the cache in a microtask and announces again — an
            // unbounded dispatch loop. It is invisible to a test that never
            // feeds the epic's output back into action$, and it froze the tab
            // for six minutes at 100-310% CPU on map 1461, never leaving
            // `buffering`. UAT-09's per-chunk announcement is what exposed it:
            // the batched version emitted once, so the loop had no second lap.
            //
            // Compare against the LIVE state, never the `pb` captured at epic
            // entry — across emissions within one subscription `pb` is a stale
            // snapshot, and a stale comparand re-opens the same loop.
            const previous = (store.getState().anugaPlayback || {}).bufferedChunks || [];
            // Both sides are sorted ascending (residentChunkIndices sorts;
            // mergeBufferedChunks keeps the reducer's copy sorted), so an
            // element-wise compare IS set equality here.
            const changed = resident.length !== previous.length
                || resident.some((c, i) => c !== previous[i]);
            if (changed) {
                actions.push(playbackChunksBuffered(resident, true));
            }
            errors.forEach((r) => actions.push(playbackChunkBufferError(r.chunkIndex, String((r.error && r.error.message) || r.error))));
            return actions.length ? Rx.Observable.of(...actions) : Rx.Observable.empty();
        });
    });
}

/**
 * TASK-2752 (AC5/AC6, W8.2, epic 2706) — fetches (and dequantizes) the
 * ACTIVE quantity's temporal-max envelope whenever the Max toggle turns on,
 * or the operator switches to a DIFFERENT envelope-having quantity while it
 * is already on (the reducer nulls `envelopeData` on both PLAYBACK_
 * SET_ENVELOPE_MODE(true) and a quantity switch that stays in envelope mode
 * — see playbackController.js — so "envelopeMode true AND envelopeData
 * null" is exactly the "needs a fetch" state this epic watches for).
 *
 * A single chunk (the whole (nNode,) array, one fetch, cached by the
 * fetcher's own `_staticArrays` map thereafter — see playbackChunkFetcher.
 * _storeFor) — nothing like the per-tick frame traffic playbackBufferEpic
 * manages. Never throws into the stream: a failed/unavailable fetch
 * dispatches `data: null` exactly like loadPlaybackDt's `.catch(() => null)`
 * pattern in playbackInitEpic, so a transient failure degrades to "no
 * envelope drawn" rather than an unhandled rejection.
 */
export function playbackEnvelopeFetchEpic(action$, store) {
    return action$.ofType(PLAYBACK_SET_ENVELOPE_MODE, PLAYBACK_SET_QUANTITY).mergeMap(() => {
        const pb = store.getState().anugaPlayback;
        if (!pb || !pb.runId || !pb.envelopeMode || pb.envelopeData) {
            return Rx.Observable.empty();
        }
        const fetcher = fetcherRegistry.get(pb.runId);
        if (!fetcher) {
            return Rx.Observable.empty();
        }
        const runId = pb.runId;
        const quantity = pb.quantity;
        return Rx.Observable.fromPromise(
            loadPlaybackEnvelope(fetcher, quantity).catch(() => null)
        ).mergeMap((data) => {
            if (!data) {
                // TASK-2814 — a null envelope (failed fetch, or a store that
                // could not serve this quantity after all) must NOT leave Max
                // mode on: the renderer would draw its zero-filled buffer as
                // an "everything dry" run-maximum — false data, worse than an
                // error. Exit the mode and say so. Stale-guarded like
                // ENVELOPE_LOADED: if the operator has since switched run or
                // quantity, this failure is about an envelope nobody is
                // waiting for — drop it silently instead of kicking the NEW
                // context out of Max.
                const now = store.getState().anugaPlayback || {};
                if (now.runId !== runId || now.quantity !== quantity || !now.envelopeMode) {
                    return Rx.Observable.empty();
                }
                return Rx.Observable.of(
                    playbackSetEnvelopeMode(false),
                    show({
                        title: 'hydrata.playback.envelopeLoadFailedTitle',
                        message: 'hydrata.playback.envelopeLoadFailed'
                    }, 'warning')
                );
            }
            return Rx.Observable.of(playbackEnvelopeLoaded(runId, quantity, data));
        });
    });
}

/**
 * The controller's clock: while playing (or stalled — see
 * playbackController's TICK guard, which keeps re-attempting a stalled
 * crossing so `degraded` can accumulate), dispatch PLAYBACK_TICK at
 * TICK_INTERVAL_MS. Stops on PAUSE/RESET; PLAY again restarts it (a fresh
 * `switchMap` emission cancels any still-running previous interval, so two
 * overlapping intervals can never coexist).
 */
export function playbackTickEpic(action$) {
    return action$.ofType(PLAYBACK_PLAY).switchMap(() =>
        Rx.Observable.interval(TICK_INTERVAL_MS)
            .map(() => playbackTick(Date.now()))
            .takeUntil(action$.ofType(PLAYBACK_PAUSE, PLAYBACK_RESET))
    );
}

/**
 * Applies playback state to the actual AnugaPlaybackLayer via the standard
 * MapStore changeLayerProperties (AnugaPlaybackLayer.update() already knows
 * how to diff {mesh, frame0, frame1, mixT, colorMode, colorMax} against its
 * previous options — see W2.2). Only re-fetches/re-slices frame0/frame1 when
 * currentTimestep actually changed; a pure mixT/quantity change within the
 * same bracket dispatches a cheap property-only update every tick.
 */
function getLayerMesh(pb) {
    if (!pb.mesh) {
        return null;
    }
    const cached = layerMeshCache.get(pb.runId);
    if (cached && cached.sourceMesh === pb.mesh) {
        return cached.layerMesh;
    }
    const layerMesh = { ...pb.mesh, nodeX: Float32Array.from(pb.mesh.nodeX), nodeY: Float32Array.from(pb.mesh.nodeY) };
    layerMeshCache.set(pb.runId, { sourceMesh: pb.mesh, layerMesh });
    return layerMesh;
}

export function playbackSyncLayerEpic(action$, store) {
    const trigger$ = action$.ofType(
        PLAYBACK_MANIFEST_LOADED, PLAYBACK_TICK, PLAYBACK_SEEK, PLAYBACK_CHUNKS_BUFFERED, PLAYBACK_SET_QUANTITY,
        // TASK-2656d (W6.5) — a wireframe toggle while PAUSED has no other
        // trigger to ride (TICK only fires while playing) — without this,
        // the toggle would silently wait for the next play/seek/quantity
        // change to actually reach the layer.
        PLAYBACK_SET_WIREFRAME,
        // TASK-2744 (AC3/AC4/AC11) — same reasoning as SET_WIREFRAME above:
        // dragging opacity, moving the colour-ramp max or toggling an overlay
        // while PAUSED has no other trigger to ride, so without these the
        // change would silently wait for the next play/seek/quantity switch.
        PLAYBACK_SET_OPACITY,
        PLAYBACK_SET_BACKGROUND_OPACITY,
        PLAYBACK_SET_OVERLAY,
        PLAYBACK_SET_COLOR_MAX,
        // TASK-2752 — the Max toggle and its fetch landing are each their
        // own trigger for the SAME reason SET_WIREFRAME is: flipping either
        // while PAUSED has no other action to ride to the layer.
        PLAYBACK_SET_ENVELOPE_MODE,
        PLAYBACK_ENVELOPE_LOADED
    );
    return trigger$.switchMap(() => {
        const pb = store.getState().anugaPlayback;
        if (!pb || !pb.layerId || !pb.manifest || !pb.mesh) {
            return Rx.Observable.empty();
        }
        const fetcher = fetcherRegistry.get(pb.runId);
        if (!fetcher) {
            return Rx.Observable.empty();
        }
        const nextTimestepForDt = pb.nTime ? Math.min(pb.currentTimestep + 1, pb.nTime - 1) : pb.currentTimestep + 1;
        const context = {
            elevationMin: pb.elevationMin,
            elevationMax: pb.elevationMax,
            // TASK-2744 AC4 — the operator's ramp override for the ACTIVE
            // quantity, fed into the same shared derivation the legend uses.
            colorMaxOverride: (pb.colorMaxOverride || {})[pb.quantity]
        };
        const baseProps = {
            mesh: getLayerMesh(pb),
            mixT: pb.mixT,
            colorMode: pb.quantity,
            colorMax: colorMaxForQuantity(pb.quantity, pb.quantization, context),
            colorMin: colorMinForQuantity(pb.quantity, context),
            // TASK-2784 (W7, epic 2706) — a ceiling the reader set STRETCHES
            // the ramp to fill it; the store-derived default leaves it pinned
            // to absolute SLD values. Derived from the same predicate
            // colorMaxForQuantity uses, so the LUT and the uniform agree.
            colorRescaled: isColorMaxOverridden(pb.quantity, context),
            // TASK-2744 AC3 — opacity is controller state now, so it is
            // re-asserted on every sync and survives a bar remount.
            opacity: pb.opacity,
            // TASK-2788 — the dry-ground sheet's own alpha, re-asserted on
            // every sync for the same reason opacity is: the bar unmounts
            // whenever the SimpleView menu group leaves 'Results'.
            backgroundOpacity: pb.backgroundOpacity,
            // TASK-2744 AC11 — the overlay knobs likewise. They used to reach
            // the layer only via the bar's own changeLayerProperties call,
            // which is exactly why an unmount desynced them.
            flowVizEnabled: !!pb.flowVizEnabled,
            arrowDensity: pb.arrowDensity,
            arrowScale: pb.arrowScale,
            particlesEnabled: !!pb.particlesEnabled,
            particleDensity: pb.particleDensity,
            particleSpeedExaggeration: pb.particleSpeedExaggeration,
            // TASK-2629 (W4.1) — the store's OWN wet floor/g/rho_w (never
            // hardcoded — read from schema_metadata at manifest-load) plus
            // the frame-mixed dt(t) in SECONDS for the Courant formula.
            wetThreshold: pb.wetThreshold,
            g: pb.g,
            rhoW: pb.rhoW,
            dt: mixDtSeconds(pb.dtMs, pb.currentTimestep, nextTimestepForDt, pb.mixT),
            // TASK-2656d (W6.5) — real wireframe toggle (was hardcoded
            // `false` here; the renderer's own wireProgram already existed
            // and unused). Controller state (pb.wireframe), NOT the local
            // component state the flow-viz/particle overlay knobs use — see
            // playbackActions.js's PLAYBACK_SET_WIREFRAME header.
            wireframe: !!pb.wireframe,
            // TASK-2752 (AC5/AC6, W8.2, epic 2706) — the Max toggle reaching
            // the actual renderer. Without this the controller/epic state
            // machine above is a closed loop that never paints anything:
            // envelopeMode flips uEnvelopeMode, envelopeData is the
            // Float32Array setEnvelope() uploads — both are plain re-
            // asserted-every-sync layer properties, same class as
            // wireframe/opacity above (so a bar remount/unmount can never
            // desync them from controller state).
            envelopeMode: !!pb.envelopeMode,
            envelopeData: pb.envelopeData || null
        };
        if (lastSyncedTimestep.get(pb.runId) === pb.currentTimestep) {
            return Rx.Observable.of(mergeOptionsById(pb.layerId, baseProps));
        }
        const nextTimestep = pb.nTime ? Math.min(pb.currentTimestep + 1, pb.nTime - 1) : pb.currentTimestep + 1;
        // TASK-2743 UAT-07 (W6, epic 2706) — carry the previous step's frame1
        // forward as this step's frame0 instead of re-slicing it.
        //
        // On a forward step the two are the SAME timestep, so the old code
        // dequantized 3 x nNode elements (10.2M on map 1461) a second time to
        // rebuild a value it had just thrown away. Reusing the OBJECT saves
        // that pass AND — because AnugaPlaybackLayer tests frame identity —
        // lets the renderer recycle the 40.7 MB that timestep already has in
        // VRAM rather than re-uploading it. Together those are the ~191 ms of
        // per-frame main-thread work measured behind the operator's "pauses
        // for a significant buffering around frame 16".
        //
        // The memo holds ONE step (`{timestep, frame}`) and is only ever read
        // on an exact timestep match, so a seek, a backward step or a run
        // switch simply misses and re-slices. It is dropped as soon as it is
        // consumed, which bounds the retained bytes at one frame — the same
        // frame the layer is holding anyway.
        const carried = lastFrame1.get(pb.runId);
        const reusedFrame0 = carried && carried.timestep === pb.currentTimestep ? carried.frame : null;
        return Rx.Observable.fromPromise(
            Promise.all([
                reusedFrame0
                    ? Promise.resolve(reusedFrame0)
                    : loadPlaybackFrame(fetcher, pb.currentTimestep, pb.nNode, pb.chunkLengthT),
                loadPlaybackFrame(fetcher, nextTimestep, pb.nNode, pb.chunkLengthT)
            ])
        ).map(([frame0, frame1]) => {
            lastSyncedTimestep.set(pb.runId, pb.currentTimestep);
            lastFrame1.set(pb.runId, { timestep: nextTimestep, frame: frame1 });
            return mergeOptionsById(pb.layerId, { ...baseProps, frame0, frame1 });
        }).catch((error) => {
            // TASK-2706 (W1 review) — a REFUSED frame must never be swallowed.
            // Every fail-loud guard this wave added lands here
            // (isUsableChunkLength in loadPlaybackLayerOptions, dequantizeRow's
            // row-out-of-range and missing-{scale,offset} throws in
            // playbackDecode), as does the pre-existing missing-chunk_urls
            // throw in playbackChunkFetcher — reachable in production from an
            // all-fill (unwritten) quantity chunk, the same Zarr sparse-chunk
            // case playbackInitEpic already documents above for dt_ms.
            // `Rx.Observable.empty()` dispatched NOTHING at all, so the layer
            // went on rendering the PREVIOUS timestep's water under the new
            // timestep's label with no error anywhere — refusing to guess is
            // only worth anything if the refusal reaches someone.
            //
            // Reuses the existing chunk-buffer-error channel rather than
            // inventing a state: its reducer case records `error` WITHOUT
            // flipping status, so a transient failure still self-heals on the
            // next tick (`lastSyncedTimestep` is deliberately left unset, so
            // the retry is the same one that already happened — now with a
            // breadcrumb, and with `renderedTimestep` keeping Inspect honest
            // about which timestep the on-screen frames actually are).
            return Rx.Observable.of(playbackChunkBufferError(
                timestepToChunkIndex(pb.currentTimestep, pb.chunkLengthT),
                String((error && error.message) || error)
            ));
        });
    });
}

function getReprojectedMesh(pb) {
    if (!pb.mesh) {
        return null;
    }
    const cached = reprojectedMeshCache.get(pb.runId);
    if (cached && cached.mesh === pb.mesh) {
        return cached;
    }
    const { x, y } = reprojectMeshVertices(pb.mesh.nodeX, pb.mesh.nodeY, pb.mesh);
    const entry = { mesh: pb.mesh, x3857: x, y3857: y };
    reprojectedMeshCache.set(pb.runId, entry);
    return entry;
}

/**
 * TASK-2628 (W3.2) — click-to-inspect at the current timestep. Gated on
 * `identifyArmed` (the controller bar's "Inspect" toggle) so a normal map
 * click (GFI, vector edit, etc. — the existing click-disambiguation system,
 * untouched by this epic) is not hijacked by default. Reads the SAME
 * frame0/frame1/mixT the layer is currently rendering (off the map's own
 * layers slice, not re-fetched) so the readout can never show a value the
 * screen isn't also showing — and, since TASK-2706's W1 review, labels them
 * with `renderedTimestep(pb)` (the timestep those frames were loaded for)
 * rather than the playhead, which can have advanced past them after a
 * refused frame load.
 */
export function playbackIdentifyEpic(action$, store) {
    return action$.ofType(CLICK_ON_MAP)
        .map((action) => {
            const state = store.getState();
            const pb = state.anugaPlayback;
            if (!pb || !pb.identifyArmed || !pb.mesh) {
                return null;
            }
            // TASK-2744 AC19 — the playback layer is an `additionallayers`
            // overlay now, so its live frames hang off `.options`, not off a
            // layers.flat entry. Same object the renderer is handed.
            const entry = (state.additionallayers || []).find((l) => l.id === pb.layerId);
            const layer = entry && entry.options;
            if (!layer || !layer.frame0 || !layer.frame1) {
                return null;
            }
            const point = action.point;
            const rawPos = point && point.rawPos;
            if (!rawPos || rawPos[0] === undefined || rawPos[1] === undefined) {
                return null;
            }
            const reproj = getReprojectedMesh(pb);
            if (!reproj) {
                return null;
            }
            // TASK-2629 (W4.1) — the SAME store-derived wet floor/g/rhoW/dt
            // the layer is currently rendering with (never a second source
            // of truth), so the readout's six new derived-quantity fields
            // can't disagree with what's on screen.
            const timestepIndex = renderedTimestep(pb);
            const nextTimestepForDt = pb.nTime ? Math.min(timestepIndex + 1, pb.nTime - 1) : timestepIndex + 1;
            const result = sampleFieldAtPoint(
                { x3857: reproj.x3857, y3857: reproj.y3857, faceNodeConnectivity: pb.mesh.faceNodeConnectivity },
                layer.frame0, layer.frame1, layer.mixT || 0,
                rawPos[0], rawPos[1],
                pb.wetThreshold,
                { elevation: pb.mesh.elevation, friction: pb.mesh.friction, inradius: pb.mesh.vertexInradius },
                { g: pb.g, rhoW: pb.rhoW, dtSeconds: mixDtSeconds(pb.dtMs, timestepIndex, nextTimestepForDt, layer.mixT || 0) }
            );
            return playbackSetIdentifyResult({
                ...result,
                x: rawPos[0],
                y: rawPos[1],
                timestepIndex,
                quantity: pb.quantity
            });
        })
        .filter((a) => !!a);
}

/**
 * TASK-2744 (AC2 + AC19, epic 2706) — the teardown half of "the run must be
 * unloadable".
 *
 * `playbackReset()` had ZERO dispatchers anywhere in client/js outside
 * playbackController-test.js, so PLAYBACK_STATUS.IDLE — the only state that
 * renders the loader — was unreachable once a run was loaded, and every
 * off-Redux structure the run allocated stayed reachable for the life of the
 * tab. The bar now has an Unload control, and this epic is what makes that
 * control actually free the memory rather than merely blank the UI.
 *
 * Reads runId/layerId off the ACTION, not off state: epics run after the
 * reducer, and PLAYBACK_RESET's reducer case returns
 * createInitialPlaybackState(), so by now `state.anugaPlayback.layerId` is
 * already null.
 */
export function playbackDisposeEpic(action$) {
    return action$.ofType(PLAYBACK_RESET).mergeMap((action) => {
        disposeRun(action.runId);
        return action.layerId
            ? Rx.Observable.of(removeAdditionalLayer({ id: action.layerId, owner: PLAYBACK_LAYER_OWNER }))
            : Rx.Observable.empty();
    });
}

// TASK-2656c (W6.5, epic 2618) — module-level, not redux state (a raw
// boolean the operator's own prior GFI-tool setting, not playback domain
// state — same "escape hatch" posture as fetcherRegistry above). Restored
// verbatim on disarm so a playback Inspect session can never leave
// mapInfo.enabled in a DIFFERENT state than it found it, whichever way that
// was (AC: "normal identify on non-playback layers must be unaffected when
// playback inactive").
let mapInfoEnabledBeforeArm = null;

/**
 * TASK-2656c (W6.5) — a playback Inspect click ALSO fired the generic
 * MapStore GetFeatureInfo "Select a feature" popup over the identify
 * readout (UAT finding): `onMapClick` (web/client/epics/identify.js) reacts
 * to the SAME CLICK_ON_MAP action this epic file's own playbackIdentifyEpic
 * listens to, gated on `mapInfo.enabled`. Arms/disarms in lockstep with
 * PLAYBACK_SET_IDENTIFY_ARMED — the SAME toggle playbackIdentifyEpic itself
 * already gates on — so the two flows can never disagree about whose click
 * this is.
 */
export function playbackSuppressIdentifyEpic(action$, store) {
    return action$.ofType(PLAYBACK_SET_IDENTIFY_ARMED)
        .map((action) => {
            if (action.armed) {
                mapInfoEnabledBeforeArm = mapInfoEnabledSelector(store.getState());
                return changeMapInfoState(false);
            }
            const restore = mapInfoEnabledBeforeArm === null ? true : mapInfoEnabledBeforeArm;
            mapInfoEnabledBeforeArm = null;
            return changeMapInfoState(restore);
        });
}

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
import { addLayer, changeLayerProperties } from '@mapstore/framework/actions/layers';
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
import { loadPlaybackMesh, loadPlaybackTime, loadPlaybackDt, loadPlaybackFrame } from '../loadPlaybackLayerOptions';
import { QUANTITY_ARRAYS, resolveChunkLengthT } from '../playbackChunkShape';
import { computePlaybackMemoryPlan, readNodeCount } from '../playbackMemoryPolicy';
import { reprojectMeshVertices } from '../playbackReproject';
import { sampleFieldAtPoint } from '../playbackIdentify';
import { timestepToChunkIndex, colorMaxForQuantity, colorMinForQuantity } from '../playbackController';
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
    playbackManifestLoaded,
    playbackManifestFailed,
    playbackChunksBuffered,
    playbackChunkBufferError,
    playbackTick,
    playbackSetIdentifyResult
} from '../actions/playbackActions';

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

// runId -> PlaybackChunkFetcher. Exported so a test (or a future "switch
// run" cleanup path) can inspect/clear it without reaching into closures.
export const fetcherRegistry = new Map();
// runId -> the currentTimestep last used to set frame0/frame1 on the layer,
// so mixT-only ticks (the common case) dispatch a cheap
// changeLayerProperties({mixT}) instead of re-fetching/re-uploading frames.
const lastSyncedTimestep = new Map();

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
        const layerExists = ((state.layers && state.layers.flat) || []).some((l) => l.id === layerId);
        const ensureLayer$ = layerExists ? Rx.Observable.empty() : Rx.Observable.of(addLayer({
            id: layerId,
            type: 'anuga-playback',
            title: `Playback run ${runId}`,
            visibility: true,
            opacity: 0.85,
            wireframe: false,
            colorMode: 'depth',
            colorMax: 1,
            mixT: 0
        }));

        const load$ = Rx.Observable.fromPromise((async() => {
            const manifest = await fetchPlaybackManifest(manifestUrl);
            // TASK-2724 — the store's OWN time-chunk length, before a single
            // byte of mesh is downloaded. Throws (-> MANIFEST_FAILED, with the
            // reason surfaced in the UI) on a store that does not declare it
            // or whose quantity arrays disagree; there is deliberately no
            // fallback, because guessing renders the wrong timestep silently.
            const chunkLengthT = resolveChunkLengthT(manifest);
            const meta0 = manifest.schema_metadata || {};
            const nTime0 = meta0.n_time || 0;
            // TASK-2708 (W1.2, epic 2706) — size the cache from THIS store
            // before a single byte is fetched. nNode comes from the store's
            // own chunk_shapes ([chunk_length_t, n_node]); the triangle count
            // is not declared in the manifest, so the plan is refined below
            // once face_node_connectivity has landed.
            const nNode0 = readNodeCount(manifest);
            const totalChunks0 = nTime0 && chunkLengthT ? Math.ceil(nTime0 / chunkLengthT) : undefined;
            const initialPlan = nNode0
                ? computePlaybackMemoryPlan({ nNode: nNode0, chunkLengthT, totalChunks: totalChunks0 })
                : null;
            const fetcher = new PlaybackChunkFetcher({ manifest, memoryPlan: initialPlan });
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
            // TASK-2708 — re-plan with the EXACT triangle count now that the
            // mesh is here (the manifest-time plan had to estimate it), and
            // push the corrected ceiling into the cache that is already live.
            const memoryPlan = computePlaybackMemoryPlan({
                nNode,
                nFace: mesh.faceNodeConnectivity ? mesh.faceNodeConnectivity.length / 3 : undefined,
                chunkLengthT,
                totalChunks
            });
            fetcher.applyMemoryPlan(memoryPlan);
            return playbackManifestLoaded({
                runId, manifest, mesh, time, dtMs, quantization: manifest.quantization,
                nTime, nNode, chunkLengthT, totalChunks, memoryPlan
            });
        })()).catch((error) => Rx.Observable.of(playbackManifestFailed(runId, String((error && error.message) || error))));

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
        return Rx.Observable.fromPromise(
            fetcher.prefetchWindow(arrayConfigs, centerChunk, pb.totalChunks, { windowRadius, windowAhead })
        ).mergeMap((results) => {
            // A chunk only counts as buffered once EVERY configured array
            // resolved ok for it — a partial-array chunk can't render a frame.
            const okCountByChunk = {};
            const errors = [];
            results.forEach((r) => {
                if (r.error) {
                    errors.push(r);
                } else {
                    okCountByChunk[r.chunkIndex] = (okCountByChunk[r.chunkIndex] || 0) + 1;
                }
            });
            const requiredOk = QUANTITY_ARRAYS.length;
            const fullyBuffered = Object.keys(okCountByChunk)
                .filter((c) => okCountByChunk[c] === requiredOk)
                .map(Number);
            const actions = [];
            if (fullyBuffered.length) {
                actions.push(playbackChunksBuffered(fullyBuffered));
            }
            errors.forEach((r) => actions.push(playbackChunkBufferError(r.chunkIndex, String((r.error && r.error.message) || r.error))));
            return actions.length ? Rx.Observable.of(...actions) : Rx.Observable.empty();
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
        PLAYBACK_SET_WIREFRAME
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
        const context = { elevationMin: pb.elevationMin, elevationMax: pb.elevationMax };
        const baseProps = {
            mesh: getLayerMesh(pb),
            mixT: pb.mixT,
            colorMode: pb.quantity,
            colorMax: colorMaxForQuantity(pb.quantity, pb.quantization, context),
            colorMin: colorMinForQuantity(pb.quantity, context),
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
            wireframe: !!pb.wireframe
        };
        if (lastSyncedTimestep.get(pb.runId) === pb.currentTimestep) {
            return Rx.Observable.of(changeLayerProperties(pb.layerId, baseProps));
        }
        const nextTimestep = pb.nTime ? Math.min(pb.currentTimestep + 1, pb.nTime - 1) : pb.currentTimestep + 1;
        return Rx.Observable.fromPromise(
            Promise.all([
                loadPlaybackFrame(fetcher, pb.currentTimestep, pb.nNode, pb.chunkLengthT),
                loadPlaybackFrame(fetcher, nextTimestep, pb.nNode, pb.chunkLengthT)
            ])
        ).map(([frame0, frame1]) => {
            lastSyncedTimestep.set(pb.runId, pb.currentTimestep);
            return changeLayerProperties(pb.layerId, { ...baseProps, frame0, frame1 });
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

// runId -> {mesh, x3857, y3857} — the reprojected mesh vertices identify
// needs (the renderer's OWN EPSG:3857 coordinate space, NOT the raw local
// mesh nodeX/nodeY the fetcher decodes). Reprojecting all ~50k+ vertices on
// EVERY click would be wasteful; cached per runId, invalidated whenever
// `pb.mesh` is a different reference (a new run/store loaded).
const reprojectedMeshCache = new Map();

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
            const layer = ((state.layers && state.layers.flat) || []).find((l) => l.id === pb.layerId);
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

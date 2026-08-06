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

import { fetchPlaybackManifest, PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { loadPlaybackMesh, loadPlaybackTime, loadPlaybackFrame } from '../loadPlaybackLayerOptions';
import { reprojectMeshVertices } from '../playbackReproject';
import { sampleFieldAtPoint } from '../playbackIdentify';
import { timestepToChunkIndex, colorMaxForQuantity } from '../playbackController';
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
// Schema §1's O1 time-chunk length — pinned the same way
// loadPlaybackLayerOptions.loadPlaybackFrame defaults it.
const CHUNK_LENGTH_T = 10;
const BUFFER_WINDOW_RADIUS = 2;
const QUANTITY_ARRAYS = ['depth', 'x_velocity', 'y_velocity'];

// runId -> PlaybackChunkFetcher. Exported so a test (or a future "switch
// run" cleanup path) can inspect/clear it without reaching into closures.
export const fetcherRegistry = new Map();
// runId -> the currentTimestep last used to set frame0/frame1 on the layer,
// so mixT-only ticks (the common case) dispatch a cheap
// changeLayerProperties({mixT}) instead of re-fetching/re-uploading frames.
const lastSyncedTimestep = new Map();

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

        const load$ = Rx.Observable.fromPromise((async () => {
            const manifest = await fetchPlaybackManifest(manifestUrl);
            const fetcher = new PlaybackChunkFetcher({ manifest });
            fetcherRegistry.set(runId, fetcher);
            lastSyncedTimestep.delete(runId);
            const [mesh, time] = await Promise.all([loadPlaybackMesh(fetcher), loadPlaybackTime(fetcher)]);
            const meta = manifest.schema_metadata || {};
            const nTime = meta.n_time || time.length;
            const totalChunks = Math.ceil(nTime / CHUNK_LENGTH_T);
            return playbackManifestLoaded({
                runId, manifest, mesh, time, quantization: manifest.quantization,
                nTime, nNode: meta.n_node || mesh.nodeX.length, chunkLengthT: CHUNK_LENGTH_T, totalChunks
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
        const window = fetcher.getPrefetchWindow(centerChunk, pb.totalChunks, pb.bufferWindowRadius);
        const alreadyBuffered = new Set(pb.bufferedChunks);
        if (window.every((c) => alreadyBuffered.has(c))) {
            return Rx.Observable.empty();
        }
        const arrayConfigs = arrayConfigsFor(pb.quantization);
        return Rx.Observable.fromPromise(
            fetcher.prefetchWindow(arrayConfigs, centerChunk, pb.totalChunks, { windowRadius: pb.bufferWindowRadius || BUFFER_WINDOW_RADIUS })
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
        PLAYBACK_MANIFEST_LOADED, PLAYBACK_TICK, PLAYBACK_SEEK, PLAYBACK_CHUNKS_BUFFERED, PLAYBACK_SET_QUANTITY
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
        const baseProps = {
            mesh: getLayerMesh(pb),
            mixT: pb.mixT,
            colorMode: pb.quantity,
            colorMax: colorMaxForQuantity(pb.quantity, pb.quantization)
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
        }).catch(() => Rx.Observable.empty());
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
 * screen isn't also showing.
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
            const result = sampleFieldAtPoint(
                { x3857: reproj.x3857, y3857: reproj.y3857, faceNodeConnectivity: pb.mesh.faceNodeConnectivity },
                layer.frame0, layer.frame1, layer.mixT || 0,
                rawPos[0], rawPos[1]
            );
            return playbackSetIdentifyResult({
                ...result,
                x: rawPos[0],
                y: rawPos[1],
                timestepIndex: pb.currentTimestep,
                quantity: pb.quantity
            });
        })
        .filter((a) => !!a);
}

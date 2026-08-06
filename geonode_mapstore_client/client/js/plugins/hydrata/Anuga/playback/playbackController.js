/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackController — the pure state machine behind the Anuga-owned
 * playback controller (TASK-2627, W3.1, epic 2618): buffer-then-play
 * video-style transport (play/pause/scrub/speed/quantity) over the W2.1
 * data plane (PlaybackChunkFetcher's prefetch-window API) and the W2.2/W2.1
 * render seam (loadPlaybackLayerOptions.js's {mesh, frame0, frame1, mixT}).
 *
 * No fetch/timer/DOM here — every export is a pure function/reducer, so
 * "controller logic" (the AC's own words) is karma-testable without a
 * browser event loop or a mocked clock library (none is a dep here, see
 * playbackChunkFetcher-test.js's header note re: no sinon). epics/
 * playbackEpics.js is the thin glue that turns real fetches/timers/map
 * clicks into the actions this reducer consumes.
 *
 * Buffer-then-play (LOCKED — W0 memo F4 arithmetic: smooth streaming of a
 * velocity-family quantity exceeds a 50Mbps line): PLAY only reaches
 * 'playing' once the window the playhead needs is buffered ('buffering'
 * otherwise, with pendingPlay recorded so it starts the instant the window
 * completes). A mid-play buffer miss on a slow link FREEZES the playhead at
 * the last confirmed-playable instant and reports 'stalled' — never skips
 * ahead of data that hasn't arrived ("no stream and hope").
 */
import { computeMixFactor } from './playbackMeshGeometry';
import {
    PLAYBACK_INIT,
    PLAYBACK_MANIFEST_LOADED,
    PLAYBACK_MANIFEST_FAILED,
    PLAYBACK_CHUNKS_BUFFERED,
    PLAYBACK_CHUNK_BUFFER_ERROR,
    PLAYBACK_PLAY,
    PLAYBACK_PAUSE,
    PLAYBACK_SEEK,
    PLAYBACK_TICK,
    PLAYBACK_SET_SPEED,
    PLAYBACK_SET_QUANTITY,
    PLAYBACK_RESET,
    PLAYBACK_SET_IDENTIFY_ARMED,
    PLAYBACK_SET_IDENTIFY_RESULT,
    PLAYBACK_SET_LEGEND_OPEN
} from './actions/playbackActions';

export const PLAYBACK_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING_MANIFEST: 'loading-manifest',
    BUFFERING: 'buffering', // initial buffer, no playable window yet
    READY: 'ready', // buffered, paused (incl. after a normal pause)
    PLAYING: 'playing',
    SEEKING: 'seeking', // scrub target not yet buffered (AC: distinct "scrub buffering" feedback)
    STALLED: 'stalled', // was playing, ran off the buffered edge on a slow link
    PAUSED: 'paused', // reached the end of the timeline
    ERROR: 'error'
});

export const DEFAULT_SPEED = 1;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 8;
const DEFAULT_WINDOW_RADIUS = 2;
// Graceful degradation (AC): after this many consecutive stalls, `degraded`
// flips true so the UI can show a "slow connection" note rather than just
// silently re-buffering forever.
const STALL_DEGRADED_THRESHOLD = 3;

export function createInitialPlaybackState() {
    return {
        layerId: null,
        runId: null,
        manifest: null,
        mesh: null,
        quantization: null,
        status: PLAYBACK_STATUS.IDLE,
        error: null,
        nTime: 0,
        nNode: 0,
        chunkLengthT: 10,
        totalChunks: 0,
        time: null, // Float64Array|null — per-timestep simulation seconds
        currentTimestep: 0,
        playheadSeconds: 0,
        mixT: 0,
        quantity: 'depth', // 'depth' | 'speed'
        speed: DEFAULT_SPEED,
        bufferedChunks: [], // sorted, deduped time-chunk indices confirmed cached (all 3 quantity arrays)
        bufferWindowRadius: DEFAULT_WINDOW_RADIUS,
        lastTickMs: null,
        stalledSinceMs: null,
        stallCount: 0,
        degraded: false,
        pendingPlay: false,
        identifyArmed: false,
        identifyResult: null,
        legendOpen: false
    };
}

export function clampSpeed(speed) {
    const n = Number(speed);
    if (!isFinite(n)) {
        return DEFAULT_SPEED;
    }
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
}

/** Which O1 time-chunk a timestep index falls in. */
export function timestepToChunkIndex(timestepIndex, chunkLengthT) {
    return Math.floor(timestepIndex / (chunkLengthT || 1));
}

/**
 * The time-chunk indices the two-buffer renderer needs resident to draw
 * `currentTimestep` (frame0) and its successor (frame1) — mirrors
 * loadPlaybackLayerOptions.loadPlaybackLayerOptions's own
 * `Math.min(timestepIndex + 1, nTime - 1)` clamp so the controller and the
 * seam it drives can never disagree about which timestep frame1 is.
 * @returns {number[]} one or two chunk indices, ascending, deduped
 */
export function requiredChunkIndices(currentTimestep, nTime, chunkLengthT) {
    const nextTimestep = nTime ? Math.min(currentTimestep + 1, nTime - 1) : currentTimestep + 1;
    const a = timestepToChunkIndex(currentTimestep, chunkLengthT);
    const b = timestepToChunkIndex(nextTimestep, chunkLengthT);
    return a === b ? [a] : [a, b];
}

export function isWindowBuffered(bufferedChunks, required) {
    const set = new Set(bufferedChunks || []);
    return (required || []).every((c) => set.has(c));
}

export function mergeBufferedChunks(existing, incoming) {
    const set = new Set(existing || []);
    (incoming || []).forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => a - b);
}

/**
 * Locate the [i, i+1] timestep bracket an ascending `time` array (seconds)
 * containing `playheadSeconds`, and the mixT within it. Reuses
 * playbackMeshGeometry.computeMixFactor — the SAME mix math the two-buffer
 * shader's uMixT interpolates with, so the controller and the renderer can
 * never disagree about what "70% of the way to the next frame" means.
 * Clamps at both ends rather than extrapolating.
 * @param {Float64Array|number[]|null} time
 * @param {number} playheadSeconds
 * @returns {{currentTimestep: number, mixT: number}}
 */
export function findTimestepBracket(time, playheadSeconds) {
    if (!time || time.length === 0) {
        return { currentTimestep: 0, mixT: 0 };
    }
    const n = time.length;
    if (playheadSeconds <= time[0]) {
        return { currentTimestep: 0, mixT: 0 };
    }
    if (playheadSeconds >= time[n - 1]) {
        return { currentTimestep: n - 1, mixT: 0 };
    }
    // Linear scan: n_time is small (tens of output steps per store, schema
    // §1's O1 chunking) — this runs once per TICK, not per-vertex. Half-open
    // [time[i], time[i+1]) so a value sitting exactly ON a sample boundary
    // deterministically resolves to {i, mixT:0} for that later sample rather
    // than the equally-valid-but-ambiguous {i-1, mixT:1} — both represent
    // the same physical instant, but only one bracket can win.
    for (let i = 0; i < n - 1; i++) {
        if (playheadSeconds >= time[i] && playheadSeconds < time[i + 1]) {
            return { currentTimestep: i, mixT: computeMixFactor(playheadSeconds, time[i], time[i + 1]) };
        }
    }
    return { currentTimestep: n - 1, mixT: 0 };
}

/**
 * The renderer's `colorMax` uniform for the active quantity, derived from
 * the manifest's own quantization ranges (the exporter's real per-store
 * max, not a hardcoded guess) — 'depth' uses the depth array's valid_max;
 * 'speed' (velocity magnitude, derived in-shader from x/y_velocity) uses
 * the larger of the two velocity components' symmetric range, since speed
 * = length(vx,vy) can exceed either component alone. Falls back to 1 (never
 * 0 — a colorMax of 0 would divide-by-clamp everything to white/nodata in
 * the shader) when quantization metadata is absent.
 * @param {'depth'|'speed'} quantity
 * @param {object|null} quantization manifest.quantization
 * @returns {number}
 */
export function colorMaxForQuantity(quantity, quantization) {
    if (!quantization) {
        return 1;
    }
    if (quantity === 'speed') {
        const vx = quantization.x_velocity || {};
        const vy = quantization.y_velocity || {};
        const vmax = Math.max(
            Math.abs(vx.valid_max || 0), Math.abs(vx.valid_min || 0),
            Math.abs(vy.valid_max || 0), Math.abs(vy.valid_min || 0)
        );
        return vmax > 0 ? vmax : 1;
    }
    const d = quantization.depth || {};
    return d.valid_max > 0 ? d.valid_max : 1;
}

function requiredWindowFor(state, currentTimestep) {
    return requiredChunkIndices(currentTimestep, state.nTime, state.chunkLengthT);
}

function isCurrentWindowBuffered(state) {
    return isWindowBuffered(state.bufferedChunks, requiredWindowFor(state, state.currentTimestep));
}

/**
 * The pure playback reducer. Registered as the `playback` slice
 * (reducers/playbackReducer.js just re-exports this) and driven by
 * epics/playbackEpics.js's real fetch/timer/click glue.
 */
export function playbackControllerReducer(state = createInitialPlaybackState(), action = {}) {
    switch (action.type) {
    case PLAYBACK_INIT: {
        return {
            ...createInitialPlaybackState(),
            layerId: action.layerId,
            runId: action.runId,
            status: PLAYBACK_STATUS.LOADING_MANIFEST
        };
    }
    case PLAYBACK_MANIFEST_LOADED: {
        // A superseded init (user switched runs before the first one's
        // manifest resolved) — drop the stale response.
        if (action.runId !== state.runId) {
            return state;
        }
        return {
            ...state,
            manifest: action.manifest,
            mesh: action.mesh || null,
            quantization: action.quantization || null,
            nTime: action.nTime,
            nNode: action.nNode,
            chunkLengthT: action.chunkLengthT || state.chunkLengthT,
            totalChunks: action.totalChunks,
            time: action.time || null,
            status: PLAYBACK_STATUS.BUFFERING,
            currentTimestep: 0,
            playheadSeconds: action.time ? action.time[0] : 0,
            mixT: 0
        };
    }
    case PLAYBACK_MANIFEST_FAILED: {
        if (action.runId !== state.runId) {
            return state;
        }
        return { ...state, status: PLAYBACK_STATUS.ERROR, error: action.error || 'manifest load failed' };
    }
    case PLAYBACK_CHUNKS_BUFFERED: {
        const bufferedChunks = mergeBufferedChunks(state.bufferedChunks, action.chunkIndices);
        let status = state.status;
        let pendingPlay = state.pendingPlay;
        let stalledSinceMs = state.stalledSinceMs;
        const windowReady = isWindowBuffered(bufferedChunks, requiredWindowFor(state, state.currentTimestep));
        if (windowReady && (
            status === PLAYBACK_STATUS.BUFFERING ||
            status === PLAYBACK_STATUS.SEEKING ||
            status === PLAYBACK_STATUS.STALLED
        )) {
            status = pendingPlay ? PLAYBACK_STATUS.PLAYING : PLAYBACK_STATUS.READY;
            pendingPlay = false;
            stalledSinceMs = null;
        }
        return { ...state, bufferedChunks, status, pendingPlay, stalledSinceMs };
    }
    case PLAYBACK_CHUNK_BUFFER_ERROR: {
        // Recorded for visibility only — a single chunk error among a
        // redundant multi-array window fetch must not itself flip status;
        // TICK/PLAY's own "is the required window buffered" check is what
        // actually detects a stuck window.
        return { ...state, error: action.error || state.error };
    }
    case PLAYBACK_PLAY: {
        if (state.status === PLAYBACK_STATUS.PLAYING) {
            return state;
        }
        if (isCurrentWindowBuffered(state)) {
            return { ...state, status: PLAYBACK_STATUS.PLAYING, pendingPlay: false, lastTickMs: null };
        }
        return {
            ...state,
            status: state.status === PLAYBACK_STATUS.SEEKING ? state.status : PLAYBACK_STATUS.BUFFERING,
            pendingPlay: true
        };
    }
    case PLAYBACK_PAUSE: {
        if (state.status === PLAYBACK_STATUS.PLAYING) {
            return { ...state, status: PLAYBACK_STATUS.READY, pendingPlay: false, lastTickMs: null };
        }
        // Cancels a pending auto-play (e.g. paused while still buffering).
        return { ...state, pendingPlay: false };
    }
    case PLAYBACK_SEEK: {
        const nTime = state.nTime || 1;
        const currentTimestep = Math.min(Math.max(0, action.timestepIndex | 0), Math.max(0, nTime - 1));
        const playheadSeconds = state.time ? state.time[currentTimestep] : currentTimestep;
        const wasPlaying = state.status === PLAYBACK_STATUS.PLAYING;
        const seeked = { ...state, currentTimestep, playheadSeconds, mixT: 0, lastTickMs: null };
        if (isCurrentWindowBuffered(seeked)) {
            return { ...seeked, status: wasPlaying ? PLAYBACK_STATUS.PLAYING : PLAYBACK_STATUS.READY, pendingPlay: false };
        }
        // AC: "scrub shows buffering feedback" — a DISTINCT status from the
        // generic initial 'buffering' so the UI can label it "buffering
        // scrub target" rather than "loading".
        return { ...seeked, status: PLAYBACK_STATUS.SEEKING, pendingPlay: wasPlaying };
    }
    case PLAYBACK_TICK: {
        // Ticks are meaningful while actively playing AND while stalled (the
        // epic keeps its interval running on a slow link so it can keep
        // re-attempting the crossing the instant more chunks land, and so
        // repeated failed attempts can accumulate toward `degraded` — see
        // below). Any other status (paused/ready/seeking/idle/error) ignores
        // ticks entirely.
        if (state.status !== PLAYBACK_STATUS.PLAYING && state.status !== PLAYBACK_STATUS.STALLED) {
            return state;
        }
        const nowMs = action.nowMs;
        const lastTickMs = state.lastTickMs == null ? nowMs : state.lastTickMs;
        const elapsedSeconds = Math.max(0, (nowMs - lastTickMs) / 1000) * state.speed;
        const playheadSeconds = state.playheadSeconds + elapsedSeconds;
        const { currentTimestep, mixT } = findTimestepBracket(state.time, playheadSeconds);
        const candidate = { ...state, lastTickMs: nowMs, playheadSeconds, currentTimestep, mixT };
        if (!isCurrentWindowBuffered(candidate)) {
            // FREEZE at the last confirmed-playable instant (never advance
            // past data we don't have) — the un-advanced `state` fields
            // (currentTimestep/mixT/playheadSeconds) are kept, only the
            // clock + status/degradation bookkeeping move. Each TICK that
            // re-discovers the window still isn't buffered (the sim clock
            // resumes from the frozen point, so a stuck link keeps re-hitting
            // this branch) counts as one more consecutive stall.
            const stallCount = state.stallCount + 1;
            return {
                ...state,
                lastTickMs: nowMs,
                status: PLAYBACK_STATUS.STALLED,
                pendingPlay: true,
                stalledSinceMs: state.stalledSinceMs || nowMs,
                stallCount,
                degraded: state.degraded || stallCount >= STALL_DEGRADED_THRESHOLD
            };
        }
        const atEnd = state.time && playheadSeconds >= state.time[state.time.length - 1];
        if (atEnd) {
            return { ...candidate, status: PLAYBACK_STATUS.PAUSED, pendingPlay: false };
        }
        return candidate;
    }
    case PLAYBACK_SET_SPEED: {
        return { ...state, speed: clampSpeed(action.speed) };
    }
    case PLAYBACK_SET_QUANTITY: {
        // AC: "controller state survives quantity switching" — depth and
        // x_velocity/y_velocity are always fetched together per frame
        // (loadPlaybackFrame), so switching which one colours the mesh never
        // touches buffering/timestep/play state.
        return { ...state, quantity: action.quantity === 'speed' ? 'speed' : 'depth' };
    }
    case PLAYBACK_SET_IDENTIFY_ARMED: {
        return { ...state, identifyArmed: !!action.armed, identifyResult: action.armed ? state.identifyResult : null };
    }
    case PLAYBACK_SET_IDENTIFY_RESULT: {
        return { ...state, identifyResult: action.result || null };
    }
    case PLAYBACK_SET_LEGEND_OPEN: {
        return { ...state, legendOpen: !!action.open };
    }
    case PLAYBACK_RESET: {
        return createInitialPlaybackState();
    }
    default:
        return state;
    }
}

export default playbackControllerReducer;

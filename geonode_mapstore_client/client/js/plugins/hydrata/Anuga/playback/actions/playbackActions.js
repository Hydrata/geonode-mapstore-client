/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackActions — action types + creators for the Anuga-owned playback
 * controller (TASK-2627/2628, W3, epic 2618). All types are pure data
 * ({type, ...}); every state transition lives in playbackController.js's
 * pure reducer so it stays karma-testable without a store/epic harness.
 */

export const PLAYBACK_INIT = 'PLAYBACK:INIT';
export const PLAYBACK_MANIFEST_LOADED = 'PLAYBACK:MANIFEST_LOADED';
export const PLAYBACK_MANIFEST_FAILED = 'PLAYBACK:MANIFEST_FAILED';
export const PLAYBACK_CHUNKS_BUFFERED = 'PLAYBACK:CHUNKS_BUFFERED';
export const PLAYBACK_CHUNK_BUFFER_ERROR = 'PLAYBACK:CHUNK_BUFFER_ERROR';
export const PLAYBACK_PLAY = 'PLAYBACK:PLAY';
export const PLAYBACK_PAUSE = 'PLAYBACK:PAUSE';
export const PLAYBACK_SEEK = 'PLAYBACK:SEEK';
export const PLAYBACK_TICK = 'PLAYBACK:TICK';
export const PLAYBACK_SET_SPEED = 'PLAYBACK:SET_SPEED';
export const PLAYBACK_SET_QUANTITY = 'PLAYBACK:SET_QUANTITY';
export const PLAYBACK_RESET = 'PLAYBACK:RESET';
// TASK-2628 — click-to-inspect + legend UI state.
export const PLAYBACK_SET_IDENTIFY_ARMED = 'PLAYBACK:SET_IDENTIFY_ARMED';
export const PLAYBACK_SET_IDENTIFY_RESULT = 'PLAYBACK:SET_IDENTIFY_RESULT';
export const PLAYBACK_SET_LEGEND_OPEN = 'PLAYBACK:SET_LEGEND_OPEN';

/**
 * Start (or restart) a playback controller for one run. `layerId` is the
 * target AnugaPlaybackLayer's map layer id — the sync epic drives it via
 * changeLayerProperties. A second INIT with a different runId supersedes
 * any in-flight manifest load for the previous runId (see the reducer's
 * runId staleness guard on MANIFEST_LOADED/FAILED).
 */
export function playbackInit(runId, layerId, manifestUrl) {
    return { type: PLAYBACK_INIT, runId, layerId, manifestUrl };
}

export function playbackManifestLoaded({ runId, manifest, mesh, time, dtMs, quantization, nTime, nNode, chunkLengthT, totalChunks }) {
    return { type: PLAYBACK_MANIFEST_LOADED, runId, manifest, mesh, time, dtMs, quantization, nTime, nNode, chunkLengthT, totalChunks };
}

export function playbackManifestFailed(runId, error) {
    return { type: PLAYBACK_MANIFEST_FAILED, runId, error };
}

export function playbackChunksBuffered(chunkIndices) {
    return { type: PLAYBACK_CHUNKS_BUFFERED, chunkIndices };
}

export function playbackChunkBufferError(chunkIndex, error) {
    return { type: PLAYBACK_CHUNK_BUFFER_ERROR, chunkIndex, error };
}

export function playbackPlay() {
    return { type: PLAYBACK_PLAY };
}

export function playbackPause() {
    return { type: PLAYBACK_PAUSE };
}

export function playbackSeek(timestepIndex) {
    return { type: PLAYBACK_SEEK, timestepIndex };
}

export function playbackTick(nowMs) {
    return { type: PLAYBACK_TICK, nowMs };
}

export function playbackSetSpeed(speed) {
    return { type: PLAYBACK_SET_SPEED, speed };
}

export function playbackSetQuantity(quantity) {
    return { type: PLAYBACK_SET_QUANTITY, quantity };
}

export function playbackReset() {
    return { type: PLAYBACK_RESET };
}

export function playbackSetIdentifyArmed(armed) {
    return { type: PLAYBACK_SET_IDENTIFY_ARMED, armed };
}

export function playbackSetIdentifyResult(result) {
    return { type: PLAYBACK_SET_IDENTIFY_RESULT, result };
}

export function playbackSetLegendOpen(open) {
    return { type: PLAYBACK_SET_LEGEND_OPEN, open };
}

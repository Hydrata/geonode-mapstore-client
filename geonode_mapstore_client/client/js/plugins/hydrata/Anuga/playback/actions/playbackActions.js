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
// Dismiss the degraded-playback warning for the rest of this run.
export const PLAYBACK_DISMISS_DEGRADED = 'PLAYBACK:DISMISS_DEGRADED';
// TASK-2656d (W6.5, epic 2618) — real wireframe toggle (operator-requested
// for manual UAT: "they want to see meshes"). Controller state, not
// component-local like flowVizEnabled/particlesEnabled — those are pure
// visual overlay knobs with no bearing on the buffer-then-play state
// machine, but wireframe was ALREADY plumbed as a first-class
// AnugaPlaybackLayer option since W2.2 (the built-mesh preview path has
// used it since W6.1) — this only adds the missing "let the operator turn
// it on for a live run" path, reusing the same option end to end.
export const PLAYBACK_SET_WIREFRAME = 'PLAYBACK:SET_WIREFRAME';
/**
 * TASK-2744 (AC18, epic 2706) — THE STATUS LABEL LIED FOR THE WHOLE LOAD.
 *
 * `playbackInitEpic` did the manifest fetch AND the mesh/time/dt download
 * inside ONE promise before dispatching anything, so between PLAYBACK_INIT
 * (status 'loading-manifest') and MANIFEST_LOADED there was no observable
 * state change at all. Measured on map 1461: a single opaque 46.4-second block
 * (247 ms -> 46,693 ms) labelled `loading-manifest`, with zero intermediate
 * states, while the manifest endpoint hand-fetched during that stall answered
 * in milliseconds. The label pointed the reader at the one component that was
 * fine.
 */
export const PLAYBACK_MANIFEST_FETCHED = 'PLAYBACK:MANIFEST_FETCHED';
export const PLAYBACK_LOAD_PROGRESS = 'PLAYBACK:LOAD_PROGRESS';
// TASK-2744 (AC3/AC11/AC4, epic 2706) — three more render controls promoted
// to controller state for the SAME reason wireframe was (see the note above):
// they must survive this bar's own mount/unmount. The bar is unmounted every
// time the SimpleView menu group leaves 'Results' (anugaContainer.js:431), and
// while flow-viz/particles lived in component-local state that unmount silently
// desynced the button from the layer — measured on map 1461: after a remount
// the layer still had flowVizEnabled true while the button had lost its
// `active` class.
export const PLAYBACK_SET_OPACITY = 'PLAYBACK:SET_OPACITY';
// TASK-2788 — the DRY-GROUND sheet's own alpha, distinct from the layer
// opacity above. Its own action rather than a PLAYBACK_SET_OVERLAY key: the
// overlay knobs are flow-viz/particle settings the renderer reads as a group,
// while this one is a shader uniform on the base mesh pass.
export const PLAYBACK_SET_BACKGROUND_OPACITY = 'PLAYBACK:SET_BACKGROUND_OPACITY';
export const PLAYBACK_SET_OVERLAY = 'PLAYBACK:SET_OVERLAY';
export const PLAYBACK_SET_COLOR_MAX = 'PLAYBACK:SET_COLOR_MAX';
// TASK-2752 (W8.2, epic 2706) — the temporal-max envelope (Max toggle).
export const PLAYBACK_SET_ENVELOPE_MODE = 'PLAYBACK:SET_ENVELOPE_MODE';
export const PLAYBACK_ENVELOPE_LOADED = 'PLAYBACK:ENVELOPE_LOADED';

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

export function playbackManifestLoaded({ runId, manifest, mesh, time, dtMs, quantization, nTime, nNode, chunkLengthT, totalChunks, memoryPlan, meshBounds3857 }) {
    // `memoryPlan` (TASK-2708, W1.2, epic 2706) is the store's own residency
    // plan — cache ceiling and prefetch window in BYTES, derived from its
    // chunk footprint. It rides this action because the reducer owns
    // bufferWindowRadius/bufferWindowAhead and the epic owns the fetcher.
    //
    // `meshBounds3857` (TASK-2726, W5.5) is the run's extent in EPSG:3857 —
    // ALREADY PROJECTED, deliberately not `mesh`'s native-CRS numbers. This
    // signature is a whitelist, so a field that is not named here is dropped
    // silently; that is what makes adding one a two-line change in two files
    // rather than a one-line change that appears to work and does not.
    return { type: PLAYBACK_MANIFEST_LOADED, runId, manifest, mesh, time, dtMs, quantization, nTime, nNode, chunkLengthT, totalChunks, memoryPlan, meshBounds3857 };
}

/**
 * TASK-2744 AC18 — the manifest RESPONSE has landed; everything after this is
 * the mesh download and unpack. `objectCount` is how many store objects the
 * mesh phase will fetch, so the UI can render determinate progress instead of
 * an unbounded spinner.
 */
export function playbackManifestFetched(runId, objectCount) {
    return { type: PLAYBACK_MANIFEST_FETCHED, runId, objectCount };
}

/** TASK-2744 AC18 — one completed store object during the mesh phase. */
export function playbackLoadProgress(runId, { objectsLoaded, objectCount, bytesLoaded }) {
    return { type: PLAYBACK_LOAD_PROGRESS, runId, objectsLoaded, objectCount, bytesLoaded };
}

export function playbackManifestFailed(runId, error) {
    return { type: PLAYBACK_MANIFEST_FAILED, runId, error };
}

/**
 * @param {number[]} chunkIndices time-chunk indices
 * @param {boolean} [authoritative] TASK-2744 AC20 — when true this is the
 *   fetcher's ACTUAL resident set, so the reducer REPLACES bufferedChunks
 *   with it instead of unioning. Union-only is why the state claimed three
 *   chunks resident while the memory plan afforded two: nothing ever removed
 *   an index when the LRU evicted it. Left false for hand-built test actions
 *   and any caller that only knows about an addition.
 */
export function playbackChunksBuffered(chunkIndices, authoritative = false) {
    return { type: PLAYBACK_CHUNKS_BUFFERED, chunkIndices, authoritative };
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

/**
 * Unload the current run entirely (TASK-2744 AC2, epic 2706).
 *
 * The reducer ignores `runId`/`layerId` — it returns
 * createInitialPlaybackState() unconditionally — but the DISPOSE epic needs
 * both, and by the time an epic sees PLAYBACK_RESET the reducer has already
 * run, so `state.anugaPlayback.layerId` is null and the map overlay could
 * never be found again. Carrying them on the action is what keeps the
 * reducer pure AND the teardown complete; without it the fetcher, its decoded
 * chunk cache, the cloned layer mesh and the reprojected-vertex cache all
 * stay reachable forever (~578 MiB per stale run at prod scale).
 */
export function playbackReset(runId = null, layerId = null) {
    return { type: PLAYBACK_RESET, runId, layerId };
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

export function playbackDismissDegraded() {
    return { type: PLAYBACK_DISMISS_DEGRADED };
}

export function playbackSetWireframe(enabled) {
    return { type: PLAYBACK_SET_WIREFRAME, enabled: !!enabled };
}

/**
 * TASK-2744 AC3 — layer opacity, 0..1.
 *
 * Was a hardcoded `opacity: 0.85` in playbackInitEpic's addLayer block with no
 * control anywhere, so the mesh sat as an 85%-opaque sheet over the ENTIRE
 * domain (dry cells included) and you could not check the water against the
 * terrain being flooded.
 */
export function playbackSetOpacity(opacity) {
    return { type: PLAYBACK_SET_OPACITY, opacity };
}

/**
 * TASK-2788 — alpha of the dry-ground sheet only, 0..1.
 *
 * `opacity` above fades the WHOLE canvas, water included, so using it to see
 * the terrain also washes out the result you came to read. This fades just the
 * dry part of the domain, and defaults to 0: a results layer should show its
 * results, not a grey sheet over the catchment.
 */
export function playbackSetBackgroundOpacity(backgroundOpacity) {
    return { type: PLAYBACK_SET_BACKGROUND_OPACITY, backgroundOpacity };
}

/**
 * TASK-2744 AC11 — a flow-viz / particle overlay knob, by name.
 *
 * One action for all six knobs (flowVizEnabled, arrowDensity, arrowScale,
 * particlesEnabled, particleDensity, particleSpeedExaggeration) because they
 * share one reducer rule: clamp nothing, just record. The reducer whitelists
 * the key so a typo cannot inject arbitrary fields into controller state.
 */
export function playbackSetOverlay(key, value) {
    return { type: PLAYBACK_SET_OVERLAY, key, value };
}

/**
 * TASK-2744 AC4 — operator override for the colour ramp's upper bound, per
 * quantity. `value = null` restores the automatic (store-derived) maximum.
 *
 * Keyed by quantity so a depth override in metres is never reused as a speed
 * override in m/s when the picker changes.
 */
export function playbackSetColorMax(quantity, value) {
    return { type: PLAYBACK_SET_COLOR_MAX, quantity, value };
}

/**
 * TASK-2752 AC6 — toggle the temporal-max envelope ("Max") on/off for the
 * ACTIVE quantity. The reducer refuses `enabled: true` when the current
 * quantity has no envelope in this store (playbackController.
 * hasEnvelopeForQuantity) — the control bar is expected to render the
 * button disabled in that case rather than relying on this refusal.
 */
export function playbackSetEnvelopeMode(enabled) {
    return { type: PLAYBACK_SET_ENVELOPE_MODE, enabled: !!enabled };
}

/**
 * TASK-2752 — the epic's fetch+dequantize of one quantity's envelope array
 * landed. `quantity` and `runId` are the STALE-RESPONSE guard (the reducer
 * drops this if either has moved on since the fetch started); `data` is a
 * Float32Array(nNode) in physical units, or null (fetch failed/unavailable).
 */
export function playbackEnvelopeLoaded(runId, quantity, data) {
    return { type: PLAYBACK_ENVELOPE_LOADED, runId, quantity, data };
}

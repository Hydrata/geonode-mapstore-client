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
import { availableQuantityIds, availableEnvelopeQuantityIds } from './playbackDerivedQuantities';
import { isUsableChunkLength } from './playbackChunkShape';
// TASK-2744 AC11 — the overlay knobs' defaults, now that they are controller
// state rather than the control bar's component-local state.
import { DEFAULT_ARROW_DENSITY_PX, DEFAULT_ARROW_SCALE } from './playbackFlowViz';
import { DEFAULT_PARTICLE_GRID, DEFAULT_SPEED_EXAGGERATION } from './playbackParticles';
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
    PLAYBACK_SET_LEGEND_OPEN,
    PLAYBACK_DISMISS_DEGRADED,
    PLAYBACK_SET_WIREFRAME,
    PLAYBACK_SET_OPACITY,
    PLAYBACK_SET_BACKGROUND_OPACITY,
    PLAYBACK_SET_OVERLAY,
    PLAYBACK_SET_COLOR_MAX,
    PLAYBACK_MANIFEST_FETCHED,
    PLAYBACK_LOAD_PROGRESS,
    PLAYBACK_SET_ENVELOPE_MODE,
    PLAYBACK_ENVELOPE_LOADED
} from './actions/playbackActions';

export const PLAYBACK_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING_MANIFEST: 'loading-manifest',
    // TASK-2744 AC18 — the phase AFTER the manifest response has landed:
    // downloading and unpacking the store's static mesh arrays. On the
    // prod-scale store this is >99% of the wait, and before this existed it
    // wore the 'loading-manifest' label for its entire duration.
    LOADING_MESH: 'loading-mesh',
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
/**
 * TASK-2744 (AC17, epic 2706) — raised from 8.
 *
 * `speed` is a SIM-seconds-per-WALL-second multiplier: the TICK case advances
 * playheadSeconds by `(nowMs - lastTickMs)/1000 * speed` against the store's
 * own `time` array in seconds. The Msimbazi store is 0..1800 s in 60 s steps,
 * so at the old default of 1 a single timestep took SIXTY SECONDS of wall
 * clock (measured live: currentTimestep 0 -> 1 after 64.6 s; 3000 ms of wall
 * clock advanced the playhead exactly 3.00 sim-seconds and zero timesteps).
 * End-to-end was 30 minutes, and the old ceiling of 8 still meant 3.75 —
 * for a tool whose job is reviewing a finished result.
 *
 * A 24 h design storm at "whole run in 5 s" needs 86400/5 = 17,280x, so the
 * ceiling is set above that. Blast radius is provably tiny: MAX_SPEED is read
 * only by clampSpeed and by the control bar's option builder.
 */
export const MAX_SPEED = 20000;
/** The wall-clock duration a freshly loaded run defaults to playing in. */
export const DEFAULT_PLAYBACK_WALL_SECONDS = 15;
// TASK-2744 AC3 — the starting alpha. Kept at the historical 0.85 so the
// default look is unchanged; what changes is that it is now movable.
export const DEFAULT_PLAYBACK_OPACITY = 0.85;
/**
 * TASK-2788 — the dry-ground sheet is TRANSPARENT by default.
 *
 * The results layer covers the entire model domain, and for most of a run most
 * of that domain is dry, so an opaque background is a grey sheet over the
 * catchment the water is moving through. Everything a reader wants to check the
 * flood against — the river, the roads, the buildings it is reaching — lives on
 * the basemap underneath it.
 */
export const DEFAULT_PLAYBACK_BACKGROUND_OPACITY = 0;
/**
 * The window BEFORE any store is known. TASK-2708 (W1.2, epic 2706): this is
 * no longer the playback window — once a manifest lands, both the radius and
 * the (asymmetric) lookahead come from playbackMemoryPolicy's byte budget for
 * that specific store, because a fixed chunk COUNT means a completely
 * different byte cost on a 253k-node mesh and a 3.39M-node one (5.07 MiB vs
 * 64.7 MiB per chunk). It survives only as the pre-manifest default.
 */
const DEFAULT_WINDOW_RADIUS = 2;
/*
 * Graceful degradation: how long playback must sit waiting for frames before
 * we say so.
 *
 * This was `stallCount >= 3` — a count of TICKS, and TICK_INTERVAL_MS is 50,
 * so the real threshold was 150ms and the constant silently tracked the tick
 * rate. Two things followed, both measured on the Msimbazi UAT store:
 *
 *   - 150ms is shorter than any chunk fetch that store can do. One ordinary
 *     fetch was timed at 869ms, so a HEALTHY run tripped it ~6x over on the
 *     very first chunk boundary. It never measured the connection; it
 *     measured "is this file big", and answered yes.
 *   - `stallCount` was incremented and never reset, so despite the comment
 *     saying "consecutive" it accumulated for the life of the run. A live
 *     reading found stallCount=144 with degraded=true on a run that had just
 *     played end to end without a hitch.
 *
 * A DURATION is the honest measure: it says what a user would say ("playback
 * has been stuck for a few seconds"), and it cannot drift if the tick rate
 * changes.
 */
const STALL_DEGRADED_MS = 2500;

export function createInitialPlaybackState() {
    return {
        layerId: null,
        runId: null,
        manifest: null,
        mesh: null,
        // TASK-2726 (W5.5, epic 2706) — [minX, minY, maxX, maxY] in EPSG:3857,
        // published by playbackInitEpic at MANIFEST_LOADED. NOT derived from
        // `mesh` above, which is in the STORE'S NATIVE CRS; handing MapStore
        // native UTM numbers as a 3857 extent is the specific mistake this
        // separate field exists to make impossible. Null until a store loads,
        // and null for a store whose epsg is unusable — the "zoom to results"
        // control renders disabled on null rather than inert.
        meshBounds3857: null,
        quantization: null,
        status: PLAYBACK_STATUS.IDLE,
        error: null,
        nTime: 0,
        nNode: 0,
        // null until a manifest is loaded — TASK-2724 removed the `10` that
        // used to sit here. No store means no chunk grid, and a placeholder
        // chunk length is indistinguishable from a real one downstream.
        chunkLengthT: null,
        totalChunks: 0,
        time: null, // Float64Array|null — per-timestep simulation seconds
        dtMs: null, // Float32Array|null — per-timestep global dt, MILLISECONDS (schema O2); dt_ms[0] always NaN
        hasDt: false, // store attr `has_dt` — gates Courant's menu availability (AC: graceful omission)
        wetThreshold: 1e-5, // store attr `minimum_storable_height` (the h_min display mask floor) — never hardcoded past this fallback
        g: 9.8, // store attr `g`
        rhoW: 1000, // store attr `rho_w`
        elevationMin: 0, // this run's own elevation range — `stage`'s per-run rescale (elevation is unquantized, no valid_min/max attr)
        elevationMax: 0,
        currentTimestep: 0,
        playheadSeconds: 0,
        mixT: 0,
        quantity: 'depth', // one of playbackDerivedQuantities.QUANTITY_IDS
        speed: DEFAULT_SPEED,
        bufferedChunks: [], // sorted, deduped time-chunk indices confirmed cached (all 3 quantity arrays)
        bufferWindowRadius: DEFAULT_WINDOW_RADIUS,
        // TASK-2708 — chunks AHEAD of the playhead. Separate from the radius
        // because playback runs forwards and the byte budget is finite: on a
        // prod-scale chunk-10 store the plan is 0 behind / 1 ahead.
        bufferWindowAhead: DEFAULT_WINDOW_RADIUS,
        // TASK-2708 — the store's own memory plan
        // (playbackMemoryPolicy.computePlaybackMemoryPlan), kept in state so
        // the UI/diagnostics can show what was decided and why. null until a
        // manifest lands; never defaulted.
        memoryPlan: null,
        // TASK-2744 AC18 — determinate load progress for the mesh phase.
        // null when no load is in flight; never a fake percentage.
        loadProgress: null,
        lastTickMs: null,
        stalledSinceMs: null,
        // Consecutive stalled ticks WITHIN the current stall episode; reset the
        // moment the window becomes playable again. Diagnostic only now that
        // `degraded` is driven by elapsed stall time.
        stallCount: 0,
        degraded: false,
        // Sticky for the life of the loaded run: "I know, stop telling me".
        // Cleared only by RESET/loading another store, so dismissing does not
        // have to be repeated every time a slow link stalls again.
        degradedDismissed: false,
        pendingPlay: false,
        identifyArmed: false,
        identifyResult: null,
        legendOpen: false,
        // TASK-2656d (W6.5) — real wireframe toggle, default OFF (AC).
        wireframe: false,
        // TASK-2744 AC3 — layer opacity. Controller state, not a hardcoded
        // epic literal, so a control can move it AND it survives the bar's
        // own unmount/remount.
        opacity: DEFAULT_PLAYBACK_OPACITY,
        // TASK-2788 — alpha of the dry-ground sheet ONLY; see the constant.
        backgroundOpacity: DEFAULT_PLAYBACK_BACKGROUND_OPACITY,
        // TASK-2744 AC4 — per-quantity operator override of the colour ramp's
        // upper bound; {} means "use the store-derived maximum for every
        // quantity". Keyed by quantity so metres never leak onto m/s.
        colorMaxOverride: {},
        // TASK-2744 AC11 — the flow-viz / particle overlay knobs, promoted out
        // of the bar's component-local state for the same reason wireframe was
        // (TASK-2656d): the bar is UNMOUNTED whenever the SimpleView menu
        // group leaves 'Results', and local state died with it while the
        // layer kept the property — the button read OFF over a layer that was
        // still ON. Measured on map 1461.
        flowVizEnabled: false,
        arrowDensity: DEFAULT_ARROW_DENSITY_PX,
        arrowScale: DEFAULT_ARROW_SCALE,
        particlesEnabled: false,
        particleDensity: DEFAULT_PARTICLE_GRID,
        particleSpeedExaggeration: DEFAULT_SPEED_EXAGGERATION,
        // TASK-2752 (W8.2, epic 2706) — the temporal-max envelope (the Max
        // toggle). `envelopeQuantities` is which FE quantity ids THIS store
        // declares one for (set at MANIFEST_LOADED from the manifest's
        // schema_metadata.envelope_quantities via
        // playbackDerivedQuantities.availableEnvelopeQuantityIds — []
        // for a store exported before this task, the has_dt first-class-
        // absence shape). `envelopeMode` is the toggle itself; `envelopeData`
        // is the currently-loaded Float32Array(nNode) for the ACTIVE
        // quantity, fetched by the epic and null while none is loaded/
        // applicable.
        envelopeQuantities: [],
        envelopeMode: false,
        envelopeData: null
    };
}

/**
 * Does the store's declared envelope set cover THIS quantity? The single
 * predicate the reducer, the epic and the control bar all share (AC6:
 * "enabled exactly when the CURRENT result quantity has an envelope in this
 * store") so they can never disagree about it.
 * @param {string[]} envelopeQuantities state.envelopeQuantities
 * @param {string} quantity
 * @returns {boolean}
 */
export function hasEnvelopeForQuantity(envelopeQuantities, quantity) {
    return Array.isArray(envelopeQuantities) && envelopeQuantities.indexOf(quantity) !== -1;
}

// TASK-2744 AC11 — the only keys PLAYBACK_SET_OVERLAY may write. A whitelist
// rather than a blind spread, so a mistyped key is dropped instead of
// inventing a controller-state field nothing reads.
const OVERLAY_KEYS = Object.freeze([
    'flowVizEnabled', 'arrowDensity', 'arrowScale',
    'particlesEnabled', 'particleDensity', 'particleSpeedExaggeration'
]);

export function clampSpeed(speed) {
    const n = Number(speed);
    if (!isFinite(n)) {
        return DEFAULT_SPEED;
    }
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
}

/**
 * The simulated span of a store's own `time` array, in seconds.
 * @returns {number} 0 when the array is absent or degenerate.
 */
export function simulatedSpanSeconds(time) {
    if (!time || time.length < 2) {
        return 0;
    }
    const span = time[time.length - 1] - time[0];
    return span > 0 ? span : 0;
}

/**
 * TASK-2744 AC17 — the speed that plays a whole run in `targetWallSeconds`.
 *
 * Derived PER RUN rather than fixed, because "1x" means something completely
 * different for a 30-minute flash-flood store and a 7-day riverine one, and
 * neither is what someone reviewing a finished result wants by default. On the
 * Msimbazi store (1800 s) this yields 120, i.e. the whole event in 15 s.
 *
 * Falls back to DEFAULT_SPEED when the store declares no usable time array —
 * never guesses a multiplier for a run whose duration is unknown.
 */
export function defaultSpeedForTime(time, targetWallSeconds = DEFAULT_PLAYBACK_WALL_SECONDS) {
    const span = simulatedSpanSeconds(time);
    if (!span || !(targetWallSeconds > 0)) {
        return DEFAULT_SPEED;
    }
    return clampSpeed(span / targetWallSeconds);
}

/** TASK-2744 AC3 — clamp to a real 0..1 alpha; ignore garbage. */
export function clampOpacity(opacity, fallback = DEFAULT_PLAYBACK_OPACITY) {
    const n = Number(opacity);
    if (!isFinite(n)) {
        return fallback;
    }
    return Math.min(1, Math.max(0, n));
}

/**
 * Which time-chunk a timestep index falls in, at the STORE's own chunk length
 * (playbackChunkShape.resolveChunkLengthT — never a constant, TASK-2724).
 *
 * Returns 0 when there is no usable chunk length, which is only reachable
 * before a manifest has loaded (initial state's `chunkLengthT: null`); every
 * caller gates on `totalChunks > 0` first. It does NOT stand in a plausible
 * length: pretending 1 (the old `|| 1`) would silently answer with a real
 * chunk index for a store whose grid is unknown.
 */
export function timestepToChunkIndex(timestepIndex, chunkLengthT) {
    if (!isUsableChunkLength(chunkLengthT)) {
        return 0;
    }
    return Math.floor(timestepIndex / chunkLengthT);
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

function velocityAbsMax(quantization) {
    const vx = quantization.x_velocity || {};
    const vy = quantization.y_velocity || {};
    const vmax = Math.max(
        Math.abs(vx.valid_max || 0), Math.abs(vx.valid_min || 0),
        Math.abs(vy.valid_max || 0), Math.abs(vy.valid_min || 0)
    );
    return vmax > 0 ? vmax : 1;
}

function depthValidMax(quantization) {
    const d = quantization.depth || {};
    return d.valid_max > 0 ? d.valid_max : 1;
}

// AIDR classification runs classIndex 0..5 (H1..H6) — the LUT's own fixed
// colorMax, independent of any manifest/quantization data (mirrors
// playbackColormap.QUANTITY_RAMPS.hazard.max, HAZARD_CLASS_COLORS.length-1;
// kept as a literal here too so this module never needs to import the GL
// colormap module just for one constant).
const HAZARD_COLOR_MAX = 5;

/**
 * The renderer's `colorMin` uniform — non-zero ONLY for `stage` (a datum-
 * absolute elevation field, so its per-run visible range does not start at
 * zero the way every other quantity's does). Every other quantity is 0.
 * @param {string} quantity
 * @param {{elevationMin?: number}} [context]
 * @returns {number}
 */
export function colorMinForQuantity(quantity, context = {}) {
    if (quantity === 'stage') {
        return (context && context.elevationMin) || 0;
    }
    return 0;
}

/**
 * TASK-2784 (W7, epic 2706) — does the reader's ceiling override actually
 * TAKE EFFECT for this quantity?
 *
 * Not the same question as `isFinite(colorMaxOverride)`, which is what the
 * legend and the bar used to ask. colorMaxForQuantity ignores an override at
 * or below colorMin (a ceiling of 0 is not a ceiling), so the looser test let
 * the UI show the is-override styling and the reset affordance for a value
 * the renderer was discarding. One predicate, so the ramp mode, the uniform,
 * the legend labels and the reset button can never disagree.
 *
 * @param {string} quantity
 * @param {{elevationMin?: number, colorMaxOverride?: number}} [context]
 * @returns {boolean}
 */
export function isColorMaxOverridden(quantity, context = {}) {
    const override = context && context.colorMaxOverride;
    return isFinite(override) && Number(override) > colorMinForQuantity(quantity, context);
}

/**
 * The renderer's `colorMax` uniform for the active quantity (TASK-2629,
 * W4.1 extends this from {depth,speed} to all eight), derived from the
 * manifest's own quantization ranges / store attrs — never a hardcoded
 * guess. Falls back to 1 (never 0 — a colorMax of 0 would divide-by-clamp
 * everything to white/nodata in the shader) when metadata is absent.
 * `context` carries the extra per-run facts colorMax needs beyond
 * quantization (stage's elevation range, shear/froude/courant's need for
 * g/rhoW only affect the SHADER math, not colorMax, so they are not needed
 * here).
 * @param {string} quantity one of playbackDerivedQuantities.QUANTITY_IDS
 * @param {object|null} quantization manifest.quantization
 * @param {{elevationMin?: number, elevationMax?: number}} [context]
 * @returns {number}
 */
export function colorMaxForQuantity(quantity, quantization, context = {}) {
    // TASK-2744 AC4 — an operator override wins over every store-derived
    // branch below. Honoured HERE, at the single shared derivation point, so
    // the renderer uniform (playbackEpics' baseProps) and the legend
    // (PlaybackLegend's own call) can never disagree about the active range.
    //
    // The default for `depth` is the store's `valid_max` — 16.86 m on run
    // 1328 — which squeezes every urban street depth (0.1-1.0 m) into the
    // bottom 6% of the ramp, i.e. into one indistinguishable colour band.
    if (isColorMaxOverridden(quantity, context)) {
        return Number(context.colorMaxOverride);
    }
    if (quantity === 'hazard') {
        return HAZARD_COLOR_MAX;
    }
    if (quantity === 'froude') {
        return 3.0; // playbackColormap.FROUDE_RAMP_MAX
    }
    if (quantity === 'shear') {
        return 500; // playbackColormap.SHEAR_RAMP_MAX (Pa)
    }
    if (quantity === 'courant') {
        return 4.0; // playbackColormap.COURANT_RAMP_MAX
    }
    if (quantity === 'div') {
        return quantization ? Math.max(velocityAbsMax(quantization) * depthValidMax(quantization), 1) : 20;
    }
    if (quantity === 'stage') {
        const { elevationMin = 0, elevationMax = 0 } = context || {};
        const depthMax = quantization ? depthValidMax(quantization) : 0;
        return elevationMax + depthMax > elevationMin ? elevationMax + depthMax : elevationMin + 1;
    }
    if (!quantization) {
        return 1;
    }
    if (quantity === 'speed') {
        return velocityAbsMax(quantization);
    }
    return depthValidMax(quantization);
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
    // TASK-2744 AC18 — the manifest response landed; the mesh phase starts.
    case PLAYBACK_MANIFEST_FETCHED: {
        if (action.runId !== state.runId) {
            return state;
        }
        return {
            ...state,
            status: PLAYBACK_STATUS.LOADING_MESH,
            loadProgress: { objectsLoaded: 0, objectCount: action.objectCount || 0, bytesLoaded: 0 }
        };
    }
    case PLAYBACK_LOAD_PROGRESS: {
        if (action.runId !== state.runId) {
            return state;
        }
        return {
            ...state,
            loadProgress: {
                objectsLoaded: action.objectsLoaded,
                objectCount: action.objectCount,
                bytesLoaded: action.bytesLoaded
            }
        };
    }
    case PLAYBACK_MANIFEST_LOADED: {
        // A superseded init (user switched runs before the first one's
        // manifest resolved) — drop the stale response.
        if (action.runId !== state.runId) {
            return state;
        }
        const meta = (action.manifest && action.manifest.schema_metadata) || {};
        const hasDt = !!meta.has_dt;
        // AC: "Courant hidden gracefully when dt absent" — a run switched
        // INTO from a Courant-selected previous run must not keep an
        // unavailable quantity selected (availableQuantityIds already
        // filters the picker; this keeps state itself consistent even for a
        // caller that dispatches SET_QUANTITY before the picker re-renders).
        const quantity = (state.quantity === 'courant' && !hasDt) ? 'depth' : state.quantity;
        return {
            ...state,
            manifest: action.manifest,
            mesh: action.mesh || null,
            // TASK-2726 — never carried over from a previous store; a run
            // switch must not leave the zoom control aimed at the old extent.
            meshBounds3857: action.meshBounds3857 || null,
            quantization: action.quantization || null,
            nTime: action.nTime,
            nNode: action.nNode,
            // TASK-2724 — whatever the store declared, or null. Never carried
            // over from a previous store, and never defaulted.
            chunkLengthT: action.chunkLengthT || null,
            totalChunks: action.totalChunks,
            // TASK-2708 — the window is whatever this store's byte budget
            // affords, not a constant. A plan is always present in production
            // (playbackInitEpic computes it before dispatching); the fallback
            // keeps a hand-built test action working.
            memoryPlan: action.memoryPlan || null,
            bufferWindowRadius: action.memoryPlan
                ? action.memoryPlan.bufferWindowRadius
                : state.bufferWindowRadius,
            bufferWindowAhead: action.memoryPlan
                ? action.memoryPlan.bufferWindowAhead
                : state.bufferWindowAhead,
            time: action.time || null,
            // TASK-2744 AC17 — a results-review tool defaults to "watch the
            // whole event in about fifteen seconds", not to real time. Seeded
            // per run from the store's own duration; the picker still offers
            // an explicit, labelled real-time option.
            speed: defaultSpeedForTime(action.time),
            dtMs: action.dtMs || null,
            hasDt,
            // TASK-2752 — first-class-absence, mirroring hasDt immediately
            // above: a store exported before this task simply has none.
            envelopeQuantities: availableEnvelopeQuantityIds(meta.envelope_quantities),
            // A run switch always lands with Max off — carrying it over
            // would draw the OLD run's envelope (or none) under the NEW
            // run's label for one frame, and RESET below already agrees.
            envelopeMode: false,
            envelopeData: null,
            wetThreshold: meta.minimum_storable_height > 0 ? meta.minimum_storable_height : state.wetThreshold,
            g: meta.g || state.g,
            rhoW: meta.rho_w || state.rhoW,
            elevationMin: action.mesh ? action.mesh.elevationMin || 0 : state.elevationMin,
            elevationMax: action.mesh ? action.mesh.elevationMax || 0 : state.elevationMax,
            quantity,
            status: PLAYBACK_STATUS.BUFFERING,
            // TASK-2744 AC18 — the mesh phase is over; stop reporting it.
            loadProgress: null,
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
        // TASK-2744 AC20 — an authoritative report REPLACES the set. Union-only
        // made `bufferedChunks` a record of "was fetched at some point", not
        // "is resident", so it both overstated residency AND let
        // isWindowBuffered wave through a window whose chunks had been evicted
        // — suppressing the very refetch that would have corrected it.
        const bufferedChunks = action.authoritative
            ? mergeBufferedChunks([], action.chunkIndices)
            : mergeBufferedChunks(state.bufferedChunks, action.chunkIndices);
        let status = state.status;
        let pendingPlay = state.pendingPlay;
        let stalledSinceMs = state.stalledSinceMs;
        // RECOVERY CLEARS THE STALL BOOKKEEPING. It used to clear only
        // `stalledSinceMs` and carry `stallCount` and `degraded` through, which
        // is what made "consecutive" false (isolated hiccups an hour apart
        // still summed) and what made the warning unclearable: `degraded` was
        // written as `state.degraded || …` and set false in exactly one place,
        // the initial state, so nothing short of Unload could take it back down
        // — not recovering, not pausing, not finishing the run cleanly.
        let stallCount = state.stallCount;
        let degraded = state.degraded;
        const windowReady = isWindowBuffered(bufferedChunks, requiredWindowFor(state, state.currentTimestep));
        if (windowReady && (
            status === PLAYBACK_STATUS.BUFFERING ||
            status === PLAYBACK_STATUS.SEEKING ||
            status === PLAYBACK_STATUS.STALLED
        )) {
            status = pendingPlay ? PLAYBACK_STATUS.PLAYING : PLAYBACK_STATUS.READY;
            pendingPlay = false;
            stalledSinceMs = null;
            stallCount = 0;
            degraded = false;
        }
        return { ...state, bufferedChunks, status, pendingPlay, stalledSinceMs, stallCount, degraded };
    }
    case PLAYBACK_CHUNK_BUFFER_ERROR: {
        // Recorded for visibility only — a single chunk error among a
        // redundant multi-array window fetch must not itself flip status;
        // TICK/PLAY's own "is the required window buffered" check is what
        // actually detects a stuck window.
        return { ...state, error: action.error || state.error };
    }
    case PLAYBACK_PLAY: {
        // TASK-2752 AC6 — "the scrubber is disabled" while Max is on; PLAY
        // is the other half of "the timeline does not move" (a static
        // envelope has no timestep to play towards).
        if (state.envelopeMode) {
            return state;
        }
        if (state.status === PLAYBACK_STATUS.PLAYING) {
            return state;
        }
        // TASK-2685 (W6.75.3, epic 2618) — Play at end-of-timeline is dead:
        // PAUSED is the DEDICATED "reached the end" status (see
        // createInitialPlaybackState's comment; a mid-timeline user pause
        // via PLAYBACK_PAUSE always lands in READY, never PAUSED — an
        // unambiguous signal). Rewind to the first frame BEFORE the normal
        // buffered-window check below, so a still-buffered frame 0 starts
        // playing immediately and an evicted one goes through the SAME
        // buffer-then-play/pendingPlay path every other Play press does —
        // no separate rewind-only code path to keep in sync. Without this,
        // the old code re-entered PLAYING with the playhead still AT/PAST
        // the last timestep, so the very next TICK's own `atEnd` check
        // fired immediately — one dead frame, then straight back to
        // PAUSED, with currentTimestep never advancing (control looks
        // live, does nothing).
        const base = state.status === PLAYBACK_STATUS.PAUSED
            ? { ...state, currentTimestep: 0, playheadSeconds: state.time ? state.time[0] : 0, mixT: 0 }
            : state;
        if (isCurrentWindowBuffered(base)) {
            return { ...base, status: PLAYBACK_STATUS.PLAYING, pendingPlay: false, lastTickMs: null };
        }
        return {
            ...base,
            status: base.status === PLAYBACK_STATUS.SEEKING ? base.status : PLAYBACK_STATUS.BUFFERING,
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
        // TASK-2752 AC6 — "the scrubber is disabled" while Max is on.
        if (state.envelopeMode) {
            return state;
        }
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
        // TASK-2752 AC6 — a static envelope has no timestep to advance
        // towards; PLAYBACK_PLAY already refuses to enter PLAYING while
        // envelopeMode is on, so this is belt-and-braces for a TICK that
        // arrives from an interval started just before the toggle flipped.
        if (state.envelopeMode) {
            return state;
        }
        const nowMs = action.nowMs;
        const lastTickMs = (state.lastTickMs === null || state.lastTickMs === undefined) ? nowMs : state.lastTickMs;
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
            const stalledSinceMs = state.stalledSinceMs || nowMs;
            return {
                ...state,
                lastTickMs: nowMs,
                status: PLAYBACK_STATUS.STALLED,
                pendingPlay: true,
                stalledSinceMs,
                stallCount,
                // Elapsed time in THIS stall episode, not a running tally of
                // ticks across the whole run. `stalledSinceMs` resets on every
                // recovery, so a run that stutters briefly and recovers never
                // reaches the bar however many times it does it.
                degraded: state.degraded || (nowMs - stalledSinceMs) >= STALL_DEGRADED_MS
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
        // touches buffering/timestep/play state. Every derived quantity is a
        // FORMULA over those same two arrays (+static geometry) — no new
        // fetch is ever needed to switch. Rejects an unavailable quantity
        // (AC: Courant hidden gracefully when dt absent) rather than
        // silently accepting a selection the picker should never have
        // offered.
        const requested = action.quantity;
        const available = availableQuantityIds(state.hasDt);
        const quantity = available.includes(requested) ? requested : state.quantity;
        if (quantity === state.quantity) {
            return state;
        }
        // TASK-2752 AC6 — "enabled exactly when the CURRENT result quantity
        // has an envelope in this store": a switch INTO a quantity this
        // store has no envelope for must drop Max, the same way a switch
        // into Courant without has_dt already falls back above. A switch
        // between two quantities that BOTH have one stays in Max mode —
        // envelopeData is cleared either way (it belongs to the OLD
        // quantity) so the sync epic re-fetches the new one rather than
        // drawing stale numbers under the new label for one frame.
        const envelopeMode = state.envelopeMode && hasEnvelopeForQuantity(state.envelopeQuantities, quantity);
        return { ...state, quantity, envelopeMode, envelopeData: null };
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
    case PLAYBACK_DISMISS_DEGRADED: {
        // Only the dismissal is recorded — `degraded` itself stays honest so
        // state remains a truthful record of what playback is doing; the flag
        // below governs whether we SAY it.
        return { ...state, degradedDismissed: true };
    }
    case PLAYBACK_SET_WIREFRAME: {
        return { ...state, wireframe: !!action.enabled };
    }
    // TASK-2744 AC3 — operator-controlled layer opacity.
    case PLAYBACK_SET_OPACITY: {
        return { ...state, opacity: clampOpacity(action.opacity, state.opacity) };
    }
    // TASK-2788 — dry-ground alpha. Same clamp, its own field: a reader who
    // pulls the background to 0 must not lose the water with it.
    case PLAYBACK_SET_BACKGROUND_OPACITY: {
        return {
            ...state,
            backgroundOpacity: clampOpacity(action.backgroundOpacity, state.backgroundOpacity)
        };
    }
    // TASK-2744 AC11 — a flow-viz/particle knob. Whitelisted key, so an
    // unknown one is a no-op rather than a new controller-state field.
    case PLAYBACK_SET_OVERLAY: {
        if (!OVERLAY_KEYS.includes(action.key)) {
            return state;
        }
        return { ...state, [action.key]: action.value };
    }
    // TASK-2744 AC4 — per-quantity colour-ramp override; null/undefined or a
    // non-finite value CLEARS the override and restores the store-derived max.
    case PLAYBACK_SET_COLOR_MAX: {
        const quantity = action.quantity || state.quantity;
        const next = { ...(state.colorMaxOverride || {}) };
        if (action.value === null || action.value === undefined || !isFinite(action.value)) {
            delete next[quantity];
        } else {
            next[quantity] = Number(action.value);
        }
        return { ...state, colorMaxOverride: next };
    }
    // TASK-2752 AC6 — the Max toggle itself. A no-op when the requested
    // state has no envelope to show (hasEnvelopeForQuantity false): the
    // control bar is expected to render the button disabled in that case
    // (AC: "disabled with an explanatory tooltip"), so reaching this action
    // at all with enabled=true and no envelope means the UI let a disabled
    // control fire — refuse rather than pretend to turn on.
    case PLAYBACK_SET_ENVELOPE_MODE: {
        const enabled = !!action.enabled;
        if (enabled && !hasEnvelopeForQuantity(state.envelopeQuantities, state.quantity)) {
            return state;
        }
        return {
            ...state,
            envelopeMode: enabled,
            // Turning OFF drops whatever was loaded too — re-enabling later
            // (same or different quantity) always re-fetches rather than
            // risking a stale array from a run/quantity that has since moved on.
            envelopeData: enabled ? state.envelopeData : null
        };
    }
    // TASK-2752 — the epic's fetch landed. Stale-response guarded on BOTH
    // runId and quantity: a slow fetch for a quantity the operator has
    // since switched away from (or a run since unloaded) must not overwrite
    // whatever is current.
    case PLAYBACK_ENVELOPE_LOADED: {
        if (action.runId !== state.runId || action.quantity !== state.quantity) {
            return state;
        }
        return { ...state, envelopeData: action.data || null };
    }
    case PLAYBACK_RESET: {
        return createInitialPlaybackState();
    }
    default:
        return state;
    }
}

export default playbackControllerReducer;

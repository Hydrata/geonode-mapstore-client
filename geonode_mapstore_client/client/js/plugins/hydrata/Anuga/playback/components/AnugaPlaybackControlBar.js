/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AnugaPlaybackControlBar — the Anuga-owned playback transport (TASK-2627,
 * W3.1, epic 2618): a bottom-docked bar (D7: reuses the MapStore Timeline
 * plugin's visual language — bottom-docked — WITHOUT touching the Timeline
 * plugin itself, which stays untouched per the epic's locked decision) with
 * play/pause, speed, a scrubber, a timestep/clock readout, a quantity
 * picker, and explicit buffer-then-play buffering feedback.
 *
 * No run-picker UI exists yet elsewhere in the app for a playback store
 * (out of this wave's/epic's declared scope) — the small manifest-URL loader
 * shown before a run is active is this wave's minimal, honest stand-in so
 * the AC ("operator can play/pause/scrub... on localhost") is genuinely
 * operable end-to-end, not a placeholder that pretends a picker exists.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
// TASK-2744 (AC10, epic 2706) — RAW translated strings. `<Message>` renders a
// <span>, which is invalid inside <option> and impossible in a title=/
// aria-label= attribute, so those positions resolve through
// getMessageById + legacy context.messages instead. Same idiom as
// anugaScenarioMenu.js:1098-1102 and VectorDraw/FormField.js:215-220.
import { translateOr } from '../playbackI18n';
// TASK-2726 (W5.5, epic 2706) — MapStore core's map action, already imported
// and dispatched by two siblings in this plugin (anugaInputMenu.js:106 /
// pollingEpics.js:9). Reusing it keeps this zoom behaving like every other
// zoom in the plugin instead of inventing a second one.
import { zoomToExtent } from '@mapstore/framework/actions/map';
import EditableCeiling from './EditableCeiling';

/**
 * TASK-2726 — maxZoom hint for "zoom to results". A results extent is a whole
 * model domain (3.5 km on the Msimbazi store), so unlike anugaInputMenu's
 * single-feature zoom (18) there is no danger of over-zooming a point; 20
 * matches pollingEpics.js:954, which zooms to a freshly-uploaded dataset's
 * bbox — the closest analogue. MapStore's ZOOM_TO_EXTENT epic treats this as a
 * CEILING, not a target (see anugaInputMenu.js:1092).
 */
export const PLAYBACK_ZOOM_MAX = 20;

import {
    PLAYBACK_STATUS,
    MIN_SPEED,
    colorMaxForQuantity,
    isColorMaxOverridden,
    clampSpeed,
    simulatedSpanSeconds
} from '../playbackController';
import { availableQuantityIds, QUANTITY_META } from '../playbackDerivedQuantities';
import { rampGradientCss } from '../playbackColormap';
import {
    playbackInit,
    playbackPlay,
    playbackPause,
    playbackSeek,
    playbackSetSpeed,
    playbackSetQuantity,
    playbackSetIdentifyArmed,
    playbackSetLegendOpen,
    playbackDismissDegraded,
    playbackSetWireframe,
    playbackReset,
    playbackSetOpacity,
    playbackSetBackgroundOpacity,
    playbackSetOverlay,
    playbackSetColorMax
} from '../actions/playbackActions';

/**
 * TASK-2744 (AC17, epic 2706) — the speed picker is a DURATION picker.
 *
 * It used to list bare multipliers (0.25x .. 8x) which never stated their
 * wall-clock meaning. At the default 1x a Msimbazi timestep took 60 s of real
 * time, so the readout ticked while the picture barely moved for a minute —
 * indistinguishable from a hang — and even the 8x ceiling meant 3.75 minutes
 * end to end.
 *
 * "How long do I want to watch this for" is the question a results-review tool
 * should be asking, and unlike a multiplier it is meaningful without knowing
 * the run's duration. Real time stays available as an explicit entry, and
 * every label carries the multiplier it works out to, so the units are never
 * a mystery again.
 */
const WALL_DURATION_OPTIONS = [5, 10, 15, 30, 60, 120];
// Slow-motion entries, kept as true multipliers — below real time a duration
// label would be longer than the run itself and read as nonsense.
const SLOW_MOTION_OPTIONS = [0.25, 0.5].filter((s) => s >= MIN_SPEED);

// TASK-2629 (W4.1) — plain-text option labels (matches the existing
// hardcoded-English convention this <select> already used for depth/speed;
// glossary-exact terms per the AC: "Derived quantity"/"Courant number").
const QUANTITY_OPTION_LABEL = {
    depth: 'Depth',
    speed: 'Velocity',
    stage: 'Stage',
    div: 'Depth-integrated velocity (dIV)',
    hazard: 'Flood hazard (H1–H6)',
    froude: 'Froude number',
    shear: 'Manning shear stress',
    courant: 'Courant number (approx.)'
};

/*
 * SHORT forms for the bar's picker only.
 *
 * The picker was 190px — capped by `Depth-integrated velocity (dIV)`, a label
 * 31 characters long that the <select> has to reserve room for even while
 * showing `Depth`. A <select> is always as wide as its WIDEST option, so one
 * verbose entry taxes the control permanently.
 *
 * Nothing is lost, because the full name is still shown everywhere there is
 * room for it: on each <option>'s own tooltip, on the Display drawer's
 * colour-scale table (with the ramp swatch beside it), and in the legend
 * title. The bar is the one surface where width is scarce.
 */
const QUANTITY_SHORT_LABEL = {
    depth: 'Depth',
    speed: 'Velocity',
    stage: 'Stage',
    div: 'dIV',
    hazard: 'Hazard',
    froude: 'Froude',
    shear: 'Shear',
    courant: 'Courant'
};

/**
 * TASK-2744 AC17 — a wall-clock duration as a short human string ("15 s",
 * "2 min", "1 h 30 min"). Used in the speed picker's labels so an option
 * always states what it means in real time.
 */
export function formatWallDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) {
        return `${s} s`;
    }
    if (s < 3600) {
        const m = Math.round(s / 60);
        return `${m} min`;
    }
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
}

/** A speed multiplier, trimmed so 120 reads "120x" and 0.25 reads "0.25x". */
export function formatMultiplier(speed) {
    const n = Number(speed);
    if (!isFinite(n)) {
        return '—';
    }
    return `${n >= 10 ? Math.round(n) : Number(n.toFixed(2))}x`;
}

/**
 * Byte counter for the load-progress readout (TASK-2744 AC18). MiB once past
 * a megabyte — the prod-scale mesh is ~84 MiB, so "88129024 B" helps nobody.
 */
export function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1048576) {
        return `${(n / 1048576).toFixed(1)} MiB`;
    }
    if (n >= 1024) {
        return `${Math.round(n / 1024)} KiB`;
    }
    return `${n} B`;
}

function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The sim-time readout, as M:SS or H:MM:SS (TASK-2744 AC8).
 *
 * EXPORTED deliberately, and sanctioned explicitly by the card: it was
 * module-private, so a spec could not reach the arithmetic at all and the
 * clock's only coverage was through a full component render.
 *
 * It used to emit `${minutes}:${ss}` unconditionally, so an hour was never
 * carried: a 25-hour design storm read `1500:00` rather than `25:00:00`
 * (arithmetic verified — floor(90000/60) = 1500, 90000 % 60 = 0). Run 1328 is
 * 30 minutes so it reads correctly there, which is exactly why this survived:
 * the only store anyone tested against could not expose it.
 *
 * Sub-hour output is UNCHANGED — formatClock(1680) is still '28:00', so the
 * rig's `29/31 · 28:00` reading does not move.
 */
export function formatClock(seconds) {
    if (!isFinite(seconds)) {
        return '—:—';
    }
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${m}:${String(rem).padStart(2, '0')}`;
}

/**
 * Contiguous buffered spans of the timeline, as {start, width} fractions of
 * the scrubber track (TASK-2744 AC9).
 *
 * `bufferedChunks` are TIME-CHUNK indices, each covering `chunkLengthT`
 * timesteps, so chunk c spans timesteps [c*L, (c+1)*L). Adjacent chunks are
 * merged into one span rather than rendered as separate slivers with hairline
 * gaps at every boundary.
 */
export function bufferedTrackSegments(bufferedChunks, chunkLengthT, nTime) {
    if (!bufferedChunks || !bufferedChunks.length || !(chunkLengthT > 0) || !(nTime > 0)) {
        return [];
    }
    const sorted = [...new Set(bufferedChunks)].sort((a, b) => a - b);
    const segments = [];
    let runStart = sorted[0];
    let runEnd = sorted[0];
    const push = () => {
        const firstStep = runStart * chunkLengthT;
        const lastStep = Math.min((runEnd + 1) * chunkLengthT, nTime);
        segments.push({
            start: firstStep / nTime,
            width: Math.max(0, (lastStep - firstStep) / nTime)
        });
    };
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === runEnd + 1) {
            runEnd = sorted[i];
        } else {
            push();
            runStart = sorted[i];
            runEnd = sorted[i];
        }
    }
    push();
    return segments;
}

/*
 * TASK-2751 follow-up — THE SCRUBBER HAD NO AXIS. It was a bare range input
 * whose only reference point was the `1/31 · 0:00` readout beside it, so
 * "when does the peak arrive" could not be answered without dragging and
 * watching the readout tick over.
 *
 * Two things are deliberate here:
 *
 * 1. Ticks are placed by INDEX FRACTION, not by time fraction. The thumb
 *    moves linearly in TIMESTEP INDEX (the input is min=0 max=nTime-1
 *    step=1), and index-fraction and time-fraction coincide only when the
 *    output cadence is uniform. ANUGA's yieldstep regimes do not guarantee
 *    that, and on a non-uniform `time` array a time-fraction tick would sit
 *    visibly away from the frame it claims to label — an axis that lies is
 *    worse than no axis. Interpolating into `time` is honest for both.
 *
 * 2. A UNIT is chosen for the whole axis and the labels are plain numbers in
 *    it, rather than seven `m:ss` clock strings. `0 5 10 15 20 25 30 min`
 *    reads as an axis; `0:00 5:00 10:00 …` reads as a list of timestamps.
 */
const TICK_UNITS = [
    { unit: 'd', seconds: 86400, minSpan: 172800, steps: [1, 2, 5, 10, 30] },
    { unit: 'h', seconds: 3600, minSpan: 7200, steps: [1, 2, 3, 6, 12, 24] },
    { unit: 'min', seconds: 60, minSpan: 120, steps: [1, 2, 5, 10, 15, 30, 60] },
    { unit: 's', seconds: 1, minSpan: 0, steps: [1, 2, 5, 10, 15, 30, 60] }
];

export function tickUnitFor(spanSeconds) {
    return TICK_UNITS.find((u) => spanSeconds >= u.minSpan) || TICK_UNITS[TICK_UNITS.length - 1];
}

/* Where does time T sit as a fraction of the INDEX axis? Binary search for
   the bracketing pair, then interpolate within it. */
function indexFractionAt(time, last, seconds) {
    if (seconds <= time[0]) {
        return 0;
    }
    if (seconds >= time[last]) {
        return 1;
    }
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (time[mid] <= seconds) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    const dt = time[lo + 1] - time[lo];
    return (lo + (dt > 0 ? (seconds - time[lo]) / dt : 0)) / last;
}

/*
 * How many ticks will FIT in `px` of track.
 *
 * 56px per tick: the widest label the axis produces is the last one, which
 * carries the unit ("30 min" measured at 32.6px), and adjacent labels need
 * visible air between them. Below two ticks an axis says nothing, so that is
 * the floor; above eight it is denser than anyone reads, so that is the cap.
 * Width 0 means "not measured yet" and keeps the default.
 */
export function tickBudgetForWidth(px, fallback = 8) {
    if (!(px > 0)) {
        return fallback;
    }
    return Math.max(2, Math.min(8, Math.floor(px / 56)));
}

export function scrubberTicks(time, nTime, maxTicks = 8) {
    const last = (nTime || 0) - 1;
    if (!time || last < 1 || time.length <= last) {
        return { unit: null, step: null, ticks: [] };
    }
    const span = time[last] - time[0];
    if (!(span > 0)) {
        return { unit: null, step: null, ticks: [] };
    }
    const u = tickUnitFor(span);
    const spanInUnit = span / u.seconds;
    const step = u.steps.find((s) => spanInUnit / s <= maxTicks) || u.steps[u.steps.length - 1];
    const stepSeconds = step * u.seconds;
    // Align to whole multiples of the step so labels are round numbers even
    // when the run does not start at t=0 (a restarted or clipped store).
    const first = Math.ceil(time[0] / stepSeconds - 1e-9) * stepSeconds;
    const count = Math.floor((time[last] - first) / stepSeconds + 1e-9);
    const ticks = [];
    for (let i = 0; i <= count; i++) {
        const seconds = first + i * stepSeconds;
        ticks.push({
            seconds,
            value: Math.round((seconds / u.seconds) * 100) / 100,
            frac: indexFractionAt(time, last, seconds)
        });
    }
    return { unit: u.unit, step, ticks };
}

// Human-facing label per controller status — used for the buffering-feedback
// AC (video-style explicit buffering states, incl. a DISTINCT scrub label).
const STATUS_MESSAGE_ID = {
    [PLAYBACK_STATUS.LOADING_MANIFEST]: 'hydrata.playback.status.loadingManifest',
    // TASK-2744 AC18 — a DISTINCT label: this phase is the mesh download, and
    // calling it "loading manifest" for 100 s actively misdirected debugging.
    [PLAYBACK_STATUS.LOADING_MESH]: 'hydrata.playback.status.loadingMesh',
    [PLAYBACK_STATUS.BUFFERING]: 'hydrata.playback.status.buffering',
    [PLAYBACK_STATUS.SEEKING]: 'hydrata.playback.status.seeking',
    [PLAYBACK_STATUS.STALLED]: 'hydrata.playback.status.stalled',
    [PLAYBACK_STATUS.ERROR]: 'hydrata.playback.status.error'
};

export class AnugaPlaybackControlBarComponent extends React.Component {
    static propTypes = {
        playback: PropTypes.object,
        onInit: PropTypes.func,
        onPlay: PropTypes.func,
        onPause: PropTypes.func,
        onSeek: PropTypes.func,
        onSetSpeed: PropTypes.func,
        onSetQuantity: PropTypes.func,
        onSetIdentifyArmed: PropTypes.func,
        onSetLegendOpen: PropTypes.func,
        onDismissDegraded: PropTypes.func,
        onSetWireframe: PropTypes.func,
        onReset: PropTypes.func,
        onSetOpacity: PropTypes.func,
        // TASK-2788 — dry-ground alpha only; onSetOpacity fades the whole canvas.
        onSetBackgroundOpacity: PropTypes.func,
        onSetOverlay: PropTypes.func,
        onSetColorMax: PropTypes.func
    };

    // TASK-2744 AC10 — legacy context, NOT a `state.locale` selector: the
    // karma specs render this component bare (no <Provider>, no <Localized>),
    // where `this.context` is simply {} and every label falls back to its
    // English default. A selector would throw there instead.
    static contextTypes = {
        messages: PropTypes.object
    };

    /**
     * Resolve a msgId to a raw string, falling back to English.
     *
     * getMessageById returns the msgId ITSELF on a lookup miss
     * (LocaleUtils.js:158-168), so a bare call would render
     * `hydrata.playback.speedRealTime` into a tooltip or an <option>. The
     * fallback is what keeps an accessible name from ever speaking a dotted
     * key — the same reasoning as terrainUploadCrsPanel.js:280-282.
     */
    // The sub-tree guard that used to be inlined here now lives in
    // playbackI18n.js, so the legend and EditableCeiling share one copy of it
    // rather than three that can drift.
    tr(msgId, fallback) {
        return translateOr(this.context && this.context.messages, msgId, fallback);
    }

    // TASK-2744 (AC11, epic 2706) — the flow-viz/particle knobs are NO LONGER
    // component-local state. They were, on the reasoning that they are pure
    // visual toggles orthogonal to the buffer-then-play state machine — but
    // this bar is UNMOUNTED every time the SimpleView menu group leaves
    // 'Results' (anugaContainer.js:431), and local state dies with it while
    // the LAYER keeps the property. Measured on map 1461: enable Flow viz,
    // switch menu away and back, and the layer still had flowVizEnabled true
    // while the button had lost its `active` class — the overlay was drawing
    // and the control said it was off.
    //
    // The file's own header already anticipated this: wireframe (TASK-2656d)
    // was promoted to reducer state precisely so it would "persist across this
    // bar's own mount/unmount, unlike the flow-viz/particle knobs below". This
    // closes that loop for all six knobs plus opacity (AC3) and the colour-ramp
    // override (AC4); playbackSyncLayerEpic's baseProps now owns pushing every
    // one of them to the layer.
    //
    // `manifestUrlDraft` stays local: it is a text field's in-progress value,
    // meaningless once the run it produced is loaded.
    // TASK-2751 — `drawerOpen` stays local too, and for the same reason as
    // manifestUrlDraft rather than in spite of AC11's lesson: a disclosure's
    // open/shut is a property of THIS mounting of the bar, not of the run.
    // Leaving Results and coming back should hand you a tidy bar, not the
    // drawer you happened to leave open twenty minutes ago.
    state = {
        manifestUrlDraft: '',
        drawerOpen: false,
        // Rendered width of the scrubber track, so the tick axis can choose a
        // density that FITS. 0 until measured; scrubberTicks falls back to its
        // own default budget until then.
        trackWidth: 0
    };

    /*
     * The tick axis has to know how much room it has. Choosing the tick count
     * from the time span alone put "25" and "30 min" 0.4px apart once the bar
     * was narrowed to clear the map's corner controls (measured: 235.6px of
     * track, 7 ticks), and at a narrower viewport they would overlap outright.
     * An axis whose labels collide is worse than one with fewer ticks.
     *
     * ResizeObserver rather than a window resize listener: the track also
     * changes width without the window doing anything — the speed picker's
     * labels widen once the run's duration is known, which alone moved the
     * track by ~37px.
     */
    onTrackResize = (entries) => {
        const w = Math.round(entries[0].contentRect.width);
        if (w && w !== this.state.trackWidth) {
            this.setState({ trackWidth: w });
        }
    };

    /*
     * Observer setup lives in the REF, not in componentDidMount. Before a run
     * is loaded this component renders renderLoader(), a different tree with
     * no scrubber in it at all — so at mount there is nothing to observe, and
     * a componentDidMount that gave up there would never be asked again when
     * the transport row finally appeared. The ref fires exactly when the track
     * arrives and again with null when it leaves.
     */
    setTrackEl = (el) => {
        if (this.trackObserver) {
            this.trackObserver.disconnect();
            this.trackObserver = null;
        }
        this.trackEl = el;
        if (el && typeof ResizeObserver !== 'undefined') {
            this.trackObserver = new ResizeObserver(this.onTrackResize);
            this.trackObserver.observe(el);
        }
    };

    /**
     * TASK-2744 (AC1, epic 2706) — UNMOUNT MUST NOT LEAVE PLAYBACK RUNNING.
     *
     * There was no componentWillUnmount in this file at all. The bar is
     * unmounted outright (a ternary returning null, anugaContainer.js:431)
     * whenever the SimpleView menu group leaves 'Results', but
     * `playbackTickEpic` only stops on PLAYBACK_PAUSE/PLAYBACK_RESET —
     * neither of which anything dispatched on unmount. Measured on map 1461:
     * with the bar gone and openMenuGroupId null, status stayed 'playing' and
     * the playhead advanced 3.00 s over 3 s of wall clock, still decoding a
     * 6.78M-triangle mesh, with no control left to stop it short of a reload.
     *
     * Dispatches PAUSE, not RESET: the operator switched menus, they did not
     * ask to throw the run away — coming back to Results should find it where
     * they left it. PAUSE also terminates the tick interval's takeUntil.
     *
     * NOTE ON THE AC's LITERAL TEXT: AC1 asks for status === 'paused'. That
     * status is UNREACHABLE by a user pause and deliberately so — PAUSED is
     * the dedicated end-of-timeline signal (PLAYBACK_STATUS's own comment and
     * the PLAYBACK_PLAY rewind branch depend on it), while a user pause lands
     * in READY. Conflating them to satisfy the AC's wording would break the
     * state machine, so the AC is graded on its intent: playback stops.
     */
    componentWillUnmount() {
        if (this.trackObserver) {
            this.trackObserver.disconnect();
            this.trackObserver = null;
        }
        const { playback, onPause } = this.props;
        if (playback && playback.status === PLAYBACK_STATUS.PLAYING && onPause) {
            onPause();
        }
    }

    /**
     * One range input + its visible current value (TASK-2744 AC7).
     *
     * Every slider on this bar used to be a bare `<input type="range">` with a
     * `title` and nothing else: no visible label, and no rendered value at
     * all, so "arrow density" was a naked handle whose number you could only
     * discover by dragging it and watching the map. The `aria-label` is what
     * gives it an accessible name in the a11y tree; the adjacent
     * `.sv-playback-slider-value` span is what makes the number readable.
     */
    renderSlider({ testid, className, min, max, step, value, label, format, onChange }) {
        return (
            <span className="sv-playback-slider" data-testid={`${testid}-group`}>
                <input
                    type="range"
                    className={className}
                    data-testid={testid}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    title={label}
                    aria-label={label}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <span className="sv-playback-slider-value" data-testid={`${testid}-value`}>
                    {format ? format(value) : String(value)}
                </span>
            </span>
        );
    }

    /**
     * The colour-ramp maximum (TASK-2744 AC4).
     *
     * A number input rather than a slider: the useful range spans three orders
     * of magnitude across quantities (0.5 m of street flooding to 500 Pa of
     * shear), so a linear handle would be useless at the low end — and the low
     * end is exactly where the defect bites. Shows the EFFECTIVE value, so the
     * field reads the store-derived default until the operator overrides it.
     */
    /**
     * The speed `<option>` list for THIS run (TASK-2744 AC17).
     *
     * Options are computed from the store's own simulated span, so the same
     * "whole run in 15 s" entry is 120x on a 30-minute store and 5760x on a
     * 24-hour one. Labels are plain strings, not <Message> elements: <span>
     * is invalid inside <option> (see the file header on getMessageById).
     */
    /*
     * The control's own label carries what every row used to repeat: that
     * these durations are for the WHOLE RUN, and how long that run is in
     * simulated time. The run length left the real-time row for the same
     * reason — it describes the run, not the speed you pick — and it is no
     * longer only here: the scrubber's tick axis now renders it permanently
     * as the last tick ("30 min").
     */
    speedTitle(playback) {
        const span = simulatedSpanSeconds(playback.time);
        if (!(span > 0)) {
            return this.tr('hydrata.playback.speed', 'Playback speed');
        }
        return this.tr('hydrata.playback.speedTooltipRun', 'Playback speed — the whole run is {d} of simulated time')
            .replace('{d}', formatWallDuration(span));
    }

    speedOptions(playback) {
        const span = simulatedSpanSeconds(playback.time);
        const options = [];
        if (span > 0) {
            WALL_DURATION_OPTIONS.forEach((wallSeconds) => {
                const speed = clampSpeed(span / wallSeconds);
                // Drop any duration the clamp could not actually deliver, so
                // no option silently maps to a different speed than it claims.
                if (Math.abs(span / wallSeconds - speed) < 1e-6) {
                    // "Whole run in " prefixed SIX of the nine rows, so it
                    // distinguished none of them while setting the control's
                    // width for all of them. It now frames the whole control,
                    // via the tooltip built in speedTitle().
                    options.push({
                        value: speed,
                        label: `${formatWallDuration(wallSeconds)} · ${formatMultiplier(speed)}`
                    });
                }
            });
        }
        // Real time is ALWAYS offered and always labelled as such — AC17(b).
        options.push({
            value: 1,
            label: `${this.tr('hydrata.playback.speedRealTime', 'Real time')} · ${formatMultiplier(1)}`
        });
        SLOW_MOTION_OPTIONS.forEach((s) => options.push({
            value: s,
            label: `${formatMultiplier(s)} ${this.tr('hydrata.playback.speedSlowShort', 'slow')}`
        }));
        // The controller's seeded default may not equal any listed option
        // exactly; surface it rather than letting the <select> show a value it
        // has no <option> for (which renders blank).
        if (!options.some((o) => o.value === playback.speed)) {
            options.push({
                value: playback.speed,
                label: `${formatMultiplier(playback.speed)}${span > 0 ? ` (${this.tr('hydrata.playback.speedWholeRunIn', 'Whole run in {d}').replace('{d}', formatWallDuration(span / playback.speed))})` : ''}`
            });
            options.sort((a, b) => a.value - b.value);
        }
        return options;
    }

    /**
     * TASK-2751 — the colour-scale table: EVERY result quantity, one per row.
     *
     * This is the only place a ceiling is edited on the bar's own surface. It
     * was briefly also a chip beside the quantity picker; the picker's job is
     * "what am I looking at", and hanging a second number off it made the
     * primary row carry a setting that is only adjusted occasionally.
     *
     * ONE COLUMN, deliberately: eight rows of [swatch | name | ceiling] read
     * as a list you can scan down and compare, which is the actual task
     * ("is depth's ramp sensible next to velocity's?"). Two columns turn the
     * same eight rows into a grid you have to hunt around.
     *
     * The swatch is built from QUANTITY_RAMPS — the same stops the renderer
     * draws with — so it shows the colours that quantity will really appear
     * in, and the row is legible before you have selected it.
     */
    renderCeilingTable(playback) {
        const rows = availableQuantityIds(playback.hasDt).map((id) => {
            const meta = QUANTITY_META[id] || QUANTITY_META.depth;
            const override = (playback.colorMaxOverride || {})[id];
            const ceilingContext = {
                elevationMin: playback.elevationMin,
                elevationMax: playback.elevationMax,
                colorMaxOverride: override
            };
            const effective = colorMaxForQuantity(id, playback.quantization, ceilingContext);
            return (
                <li
                    className={`sv-playback-ceiling-row${id === playback.quantity ? ' is-active' : ''}`}
                    key={id}
                    data-testid={`anuga-playback-ceiling-row-${id}`}
                >
                    <span
                        className="sv-playback-ceiling-swatch"
                        data-testid={`anuga-playback-ceiling-swatch-${id}`}
                        style={{ background: rampGradientCss(id) }}
                        aria-hidden="true"
                    />
                    <button
                        type="button"
                        className="sv-playback-ceiling-row-name"
                        data-testid={`anuga-playback-ceiling-show-${id}`}
                        onClick={() => this.props.onSetQuantity(id)}
                        title={this.tr('hydrata.playback.showThisQuantity', 'Display this result quantity')}
                    >
                        {this.tr(`hydrata.playback.quantityOption.${id}`, QUANTITY_OPTION_LABEL[id])}
                    </button>
                    {meta.discrete ? (
                        <span className="sv-playback-ceiling-row-fixed">
                            <Message msgId="hydrata.playback.ceilingFixedClasses" />
                        </span>
                    ) : (
                        <EditableCeiling
                            testid={`anuga-playback-ceiling-${id}`}
                            quantity={id}
                            value={effective}
                            unit={meta.unit}
                            overridden={isColorMaxOverridden(id, ceilingContext)}
                            onChange={this.props.onSetColorMax}
                        />
                    )}
                </li>
            );
        });
        return (
            <ul className="sv-playback-ceiling-table" data-testid="anuga-playback-ceiling-table">
                {rows}
            </ul>
        );
    }

    renderLoader() {
        return (
            <div className="sv-playback-bar sv-playback-bar--loader" data-testid="anuga-playback-bar-loader">
                <input
                    type="text"
                    className="sv-playback-manifest-input"
                    data-testid="anuga-playback-manifest-input"
                    placeholder={this.tr('hydrata.playback.manifestUrlPlaceholder', 'Playback store manifest URL')}
                    value={this.state.manifestUrlDraft}
                    onChange={(e) => this.setState({ manifestUrlDraft: e.target.value })}
                />
                <button
                    className="btn sv-glass-button sv-playback-load-button"
                    data-testid="anuga-playback-load-button"
                    disabled={!this.state.manifestUrlDraft}
                    onClick={() => {
                        const runId = makeId('playback-run');
                        this.props.onInit(runId, makeId('playback-layer'), this.state.manifestUrlDraft);
                    }}
                >
                    <Message msgId="hydrata.playback.loadStore" />
                </button>
            </div>
        );
    }

    /**
     * TASK-2751 (W6.3, epic 2706) — CLOSE THE DRAWER ON ESCAPE.
     *
     * Deliberately NOT on outside-click. Tuning a ramp means clicking the map
     * to see the effect, and a drawer that shuts every time you look at your
     * own result would be actively hostile. Escape is the explicit way out.
     */
    onCardKeyDown = (e) => {
        if (e.key === 'Escape' && this.state.drawerOpen) {
            e.preventDefault();
            this.setState({ drawerOpen: false });
        }
    };

    /**
     * TASK-2751 follow-up — TRANSIENT STATUS IS A TOAST, NOT A ROW SLOT.
     *
     * The buffering label and the degraded warning used to sit ON the
     * transport row: a permanently-reserved 92px slot (TASK-2744 AC6, so a
     * mounting label could not shove the controls) plus a degraded chip that
     * was measured LIVE at 233.6px. Between them they held 325.6px hostage to
     * text that is empty most of the time, and when the degraded chip did
     * mount it crushed the scrubber onto its 150px `min-width` floor — the
     * single widest control on the bar reduced to the narrowest thing that
     * still counts as usable.
     *
     * Floating it above the card is strictly stronger than the fixed slot it
     * replaces: absolutely positioned and out of flow, this cannot move a
     * control at all, so AC6's "status must not move the play button" now
     * holds by construction rather than by reserving space for the worst
     * case. It returns null when there is nothing to say, so the toast is
     * absent — not blank — in the common case.
     */
    renderToast(playback, isBuffering, statusMsgId) {
        const progress = playback.loadProgress;
        const showDegraded = !!playback.degraded && !playback.degradedDismissed;
        if (!isBuffering && !progress && !showDegraded) {
            return null;
        }
        return (
            <div
                className="sv-playback-toast"
                data-testid="anuga-playback-toast"
                role="status"
                aria-live="polite"
                aria-label={this.tr('hydrata.playback.statusToast', 'Playback status')}
            >
                {isBuffering ? (
                    <span className="sv-playback-buffering" data-testid="anuga-playback-buffering">
                        {statusMsgId ? <Message msgId={statusMsgId} /> : null}
                    </span>
                ) : null}
                {/* TASK-2744 AC18 — determinate mesh-phase progress. The ~100 s
                    after the manifest resolves is a multi-hundred-megabyte
                    download; it had no progress bar, byte counter or ETA, only
                    a static label naming the wrong thing. */}
                {progress ? (
                    <span className="sv-playback-load-progress" data-testid="anuga-playback-load-progress">
                        {`${progress.objectsLoaded}/${progress.objectCount} · ${formatBytes(progress.bytesLoaded)}`}
                    </span>
                ) : null}
                {showDegraded ? (
                    <span
                        className="sv-playback-degraded"
                        data-testid="anuga-playback-degraded"
                        title={this.tr('hydrata.playback.degradedTooltip', 'Playback has been waiting several seconds for the next frames. A slower speed gives the buffer time to keep up.')}
                    >
                        <Message msgId="hydrata.playback.degraded" />
                        {/* The toast itself is pointer-events:none so it can
                            never eat a map click; the one control inside it
                            opts back in. */}
                        <button
                            type="button"
                            className="sv-playback-toast-dismiss"
                            data-testid="anuga-playback-degraded-dismiss"
                            onClick={this.props.onDismissDegraded}
                            title={this.tr('hydrata.playback.dismiss', 'Dismiss')}
                            aria-label={this.tr('hydrata.playback.dismiss', 'Dismiss')}
                        >
                            ×
                        </button>
                    </span>
                ) : null}
            </div>
        );
    }

    /**
     * TASK-2751 — the Display drawer: everything that CONFIGURES THE RENDER.
     *
     * Always mounted, `hidden` when shut. Two reasons, both load-bearing:
     * the card is anchored by its BOTTOM edge, so a drawer that mounts and
     * unmounts would still leave the transport row's y fixed but would churn
     * the overlay sliders' component state on every toggle; and `hidden`
     * takes these controls out of the tab order and the a11y tree, which a
     * `display:none` wrapper alone would not do.
     */
    renderDrawer(playback) {
        return (
            <div
                className="sv-playback-drawer"
                data-testid="anuga-playback-drawer"
                hidden={!this.state.drawerOpen}
            >
                <section className="sv-playback-drawer-col">
                    <h4 className="sv-playback-drawer-title">
                        <Message msgId="hydrata.playback.drawerAppearance" />
                    </h4>
                    {/* TASK-2788 — background opacity, ABOVE layer opacity.
                        Two different things that both read as "how solid is
                        this layer": this one fades ONLY the dry-ground sheet,
                        the one below fades the whole canvas, water included.
                        It sits first because it is the one you reach for to
                        see the catchment under the results, and because
                        reaching for the other one to do that job is the
                        mistake this pair exists to prevent. */}
                    <div className="sv-playback-drawer-field">
                        <span className="sv-playback-drawer-label">
                            <Message msgId="hydrata.playback.backgroundOpacity" />
                        </span>
                        {this.renderSlider({
                            testid: 'anuga-playback-background-opacity',
                            className: 'sv-playback-background-opacity',
                            min: 0, max: 1, step: 0.05,
                            value: playback.backgroundOpacity,
                            label: this.tr('hydrata.playback.backgroundOpacity', 'Background opacity'),
                            format: (v) => `${Math.round(v * 100)}%`,
                            onChange: (v) => this.props.onSetBackgroundOpacity(v)
                        })}
                    </div>
                    <div className="sv-playback-drawer-field">
                        <span className="sv-playback-drawer-label">
                            <Message msgId="hydrata.playback.opacity" />
                        </span>
                        {/* TASK-2744 AC3 — layer opacity. RED on map 1461: the
                            layer was pinned at 0.85 by playbackInitEpic with no
                            control anywhere, so the mesh sat as an opaque sheet
                            over the whole catchment (dry cells included) and you
                            could not read the water against the terrain it is
                            flooding.
                            TASK-2788 — floor lowered 0.1 -> 0. The 0.1 floor was
                            there to stop someone hiding the layer and reporting
                            it broken, but the Results menu already has Unload
                            for that, and a slider whose left end is not its
                            label's 0% is lying about its own scale. */}
                        {this.renderSlider({
                            testid: 'anuga-playback-opacity',
                            className: 'sv-playback-opacity',
                            min: 0, max: 1, step: 0.05,
                            value: playback.opacity,
                            label: this.tr('hydrata.playback.opacity', 'Result opacity'),
                            format: (v) => `${Math.round(v * 100)}%`,
                            onChange: (v) => this.props.onSetOpacity(v)
                        })}
                    </div>
                    {/* TASK-2656d (W6.5) — real wireframe toggle over the render
                        threshold's fill (default OFF); the renderer's own
                        wireProgram already existed, unused, on a live run. */}
                    <button
                        className={`btn sv-glass-button sv-playback-wireframe-toggle ${playback.wireframe ? 'active' : ''}`}
                        data-testid="anuga-playback-wireframe-toggle"
                        onClick={() => this.props.onSetWireframe(!playback.wireframe)}
                        title={this.tr('hydrata.playback.wireframeTooltip', 'Overlay mesh triangle edges')}
                    >
                        <Message msgId="hydrata.playback.wireframe" />
                    </button>
                    {/* TASK-2726 (W5.5) — Zoom to results. It lives in the drawer,
                        not the transport row: the transport row is the things you
                        touch WHILE watching (play, scrub, speed, quantity), and a
                        one-shot navigation action pushed those apart for a button
                        most sessions press once. DISABLED, not hidden and not
                        silently inert, until the extent is known —
                        `meshBounds3857` is null before MANIFEST_LOADED and stays
                        null for a store whose epsg is unusable. The extent is
                        EPSG:3857 (published by playbackInitEpic), NEVER the
                        store's native UTM. Call shape copied from
                        pollingEpics.js:954, the plugin's existing zoom. */}
                    <button
                        className="btn sv-glass-button sv-playback-zoom-to-results"
                        data-testid="anuga-playback-zoom-to-results"
                        disabled={!playback.meshBounds3857}
                        onClick={() => this.props.onZoomToExtent(playback.meshBounds3857, 'EPSG:3857', PLAYBACK_ZOOM_MAX)}
                        title={this.tr('hydrata.playback.zoomToResultsTooltip', 'Zoom the map to this run’s results')}
                    >
                        <Message msgId="hydrata.playback.zoomToResults" />
                    </button>
                </section>

                <section className="sv-playback-drawer-col">
                    <h4 className="sv-playback-drawer-title">
                        <Message msgId="hydrata.playback.drawerOverlays" />
                    </h4>
                    <button
                        className={`btn sv-glass-button sv-playback-flowviz-toggle ${playback.flowVizEnabled ? 'active' : ''}`}
                        data-testid="anuga-playback-flowviz-toggle"
                        onClick={() => this.props.onSetOverlay('flowVizEnabled', !playback.flowVizEnabled)}
                        title={this.tr('hydrata.playback.flowVizTooltip', 'Velocity arrow overlay')}
                    >
                        <Message msgId="hydrata.playback.flowViz" />
                    </button>
                    {playback.flowVizEnabled ? (
                        <span className="sv-playback-flowviz-controls" data-testid="anuga-playback-flowviz-controls">
                            {this.renderSlider({
                                testid: 'anuga-playback-flowviz-density',
                                className: 'sv-playback-flowviz-density',
                                min: 16, max: 160, step: 4,
                                value: playback.arrowDensity,
                                label: this.tr('hydrata.playback.arrowDensity', 'Arrow density (px spacing)'),
                                format: (v) => `${v} px`,
                                onChange: (v) => this.props.onSetOverlay('arrowDensity', v)
                            })}
                            {this.renderSlider({
                                testid: 'anuga-playback-flowviz-scale',
                                className: 'sv-playback-flowviz-scale',
                                min: 0.25, max: 3, step: 0.25,
                                value: playback.arrowScale,
                                label: this.tr('hydrata.playback.arrowScale', 'Arrow scale'),
                                format: (v) => `${v}x`,
                                onChange: (v) => this.props.onSetOverlay('arrowScale', v)
                            })}
                        </span>
                    ) : null}
                    <button
                        className={`btn sv-glass-button sv-playback-particles-toggle ${playback.particlesEnabled ? 'active' : ''}`}
                        data-testid="anuga-playback-particles-toggle"
                        onClick={() => this.props.onSetOverlay('particlesEnabled', !playback.particlesEnabled)}
                        title={this.tr('hydrata.playback.particlesTooltip', 'Particle trails')}
                    >
                        <Message msgId="hydrata.playback.particles" />
                    </button>
                    {playback.particlesEnabled ? (
                        <span className="sv-playback-particles-controls" data-testid="anuga-playback-particles-controls">
                            {this.renderSlider({
                                testid: 'anuga-playback-particles-density',
                                className: 'sv-playback-particles-density',
                                min: 32, max: 256, step: 16,
                                value: playback.particleDensity,
                                label: this.tr('hydrata.playback.particleDensity', 'Particle density (grid side length)'),
                                format: (v) => `${v}`,
                                onChange: (v) => this.props.onSetOverlay('particleDensity', v)
                            })}
                            {this.renderSlider({
                                testid: 'anuga-playback-particles-exaggeration',
                                className: 'sv-playback-particles-exaggeration',
                                min: 0.25, max: 5, step: 0.25,
                                value: playback.particleSpeedExaggeration,
                                label: this.tr('hydrata.playback.speedExaggeration', 'Speed exaggeration'),
                                format: (v) => `${v}x`,
                                onChange: (v) => this.props.onSetOverlay('particleSpeedExaggeration', v)
                            })}
                        </span>
                    ) : null}
                </section>

                <section className="sv-playback-drawer-col sv-playback-drawer-col--wide">
                    <h4 className="sv-playback-drawer-title">
                        <Message msgId="hydrata.playback.drawerColourScale" />
                    </h4>
                    {this.renderCeilingTable(playback)}
                </section>
            </div>
        );
    }

    /**
     * TASK-2751 — the card.
     *
     *   card  .sv-playback-bar     FIXED width, anchored bottom
     *     |- drawer                order:-1, so it grows UPWARD
     *     `- transport             fixed-height row, never reflows
     *
     * TASK-2744 AC5 anchored the bar to both edges so it stopped being capped
     * at half its container; this card goes one further and PINS the width, so
     * no content that mounts — a buffering label, an overlay slider group, a
     * ceiling editor — can change it. That is what makes AC6's "the status
     * label must not move the play button" true by construction rather than by
     * a fixed-width sticking plaster on one slot.
     *
     * The `anuga-playback-bar` testid and the `sv-playback-bar` class stay on
     * the CARD deliberately: every `.sv-playback-bar .sv-glass-button`
     * descendant rule and every existing spec keeps working, so this is a
     * re-nesting rather than a rewrite.
     */
    render() {
        const { playback } = this.props;
        if (!playback || playback.status === PLAYBACK_STATUS.IDLE) {
            return this.renderLoader();
        }
        const isPlaying = playback.status === PLAYBACK_STATUS.PLAYING;
        const isBuffering = [PLAYBACK_STATUS.LOADING_MANIFEST, PLAYBACK_STATUS.LOADING_MESH, PLAYBACK_STATUS.BUFFERING, PLAYBACK_STATUS.SEEKING, PLAYBACK_STATUS.STALLED].includes(playback.status);
        const canScrub = playback.nTime > 0;
        const statusMsgId = STATUS_MESSAGE_ID[playback.status];
        const quantityLabel = this.tr('hydrata.playback.resultQuantity', 'Result quantity');
        const ticks = scrubberTicks(playback.time, playback.nTime, tickBudgetForWidth(this.state.trackWidth));
        return (
            <div
                className={`sv-playback-bar sv-playback-bar--${playback.status}${this.state.drawerOpen ? ' is-open' : ''}`}
                data-testid="anuga-playback-bar"
                onKeyDown={this.onCardKeyDown}
            >
                {this.renderToast(playback, isBuffering, statusMsgId)}
                {this.renderDrawer(playback)}

                <div className="sv-playback-transport" data-testid="anuga-playback-transport">
                    <button
                        className="btn sv-glass-button sv-playback-playpause"
                        data-testid="anuga-playback-playpause"
                        onClick={() => (isPlaying ? this.props.onPause() : this.props.onPlay())}
                        title={isPlaying
                            ? this.tr('hydrata.playback.pause', 'Pause')
                            : this.tr('hydrata.playback.play', 'Play')}
                        aria-label={isPlaying
                            ? this.tr('hydrata.playback.pause', 'Pause')
                            : this.tr('hydrata.playback.play', 'Play')}
                    >
                        {/* TEXT-presentation codepoints. U+25B6 (▶) defaults to
                            EMOJI presentation, so the browser painted the orange
                            rounded-square emoji and ignored `color` entirely —
                            the button was orange on a blue bar with nothing in
                            the stylesheet saying so. U+25BA/U+275A are
                            text-default and take the CSS colour. */}
                        {isPlaying ? '❚❚' : '►'}
                    </button>

                    {/* TASK-2744 AC9 — the scrubber must show what is BUFFERED.
                        `bufferedChunks` has lived in controller state since epic
                        2618 and no component ever read it, so video-style buffer
                        feedback existed only as a text label. The track wrapper is
                        also what gives the buffered bar a positioned ancestor. */}
                    <span className="sv-playback-scrubber-track" data-testid="anuga-playback-scrubber-track" ref={this.setTrackEl}>
                        {bufferedTrackSegments(playback.bufferedChunks, playback.chunkLengthT, playback.nTime)
                            .map((seg, i) => (
                                <span
                                    key={`${seg.start}-${seg.width}`}
                                    className="sv-playback-scrubber-buffered"
                                    data-testid={i === 0 ? 'anuga-playback-scrubber-buffered' : `anuga-playback-scrubber-buffered-${i}`}
                                    style={{ left: `${seg.start * 100}%`, width: `${seg.width * 100}%` }}
                                />
                            ))}
                        <input
                            type="range"
                            className="sv-playback-scrubber"
                            data-testid="anuga-playback-scrubber"
                            min={0}
                            max={Math.max(0, playback.nTime - 1)}
                            step={1}
                            disabled={!canScrub}
                            value={playback.currentTimestep}
                            title={this.tr('hydrata.playback.scrubber', 'Timeline position')}
                            aria-label={this.tr('hydrata.playback.scrubber', 'Timeline position')}
                            onChange={(e) => this.props.onSeek(Number(e.target.value))}
                        />

                        {/* The tick axis. `aria-hidden` deliberately: it is a
                            visual reference for the slider, and the slider
                            already announces its own value — a screen reader
                            reading seven bare numbers after it would be noise.
                            The band is reserved in CSS whether or not ticks
                            render, so a run finishing its manifest cannot
                            change the row's height. */}
                        <span className="sv-playback-ticks" data-testid="anuga-playback-ticks" aria-hidden="true">
                            {ticks.ticks.map((t, i) => (
                                <span
                                    key={t.seconds}
                                    className="sv-playback-tick"
                                    style={{ left: `${t.frac * 100}%` }}
                                >
                                    <span className="sv-playback-tick-mark" />
                                    <span className={`sv-playback-tick-label${i === 0 ? ' sv-playback-tick-label--first' : ''}${i === ticks.ticks.length - 1 ? ' sv-playback-tick-label--last' : ''}`}>
                                        {t.value}
                                        {i === ticks.ticks.length - 1 && ticks.unit ? (
                                            <span className="sv-playback-tick-unit" data-testid="anuga-playback-tick-unit">
                                                <Message msgId={`hydrata.playback.tickUnit.${ticks.unit}`} />
                                            </span>
                                        ) : null}
                                    </span>
                                </span>
                            ))}
                        </span>
                    </span>

                    <span className="sv-playback-readout" data-testid="anuga-playback-readout">
                        {playback.currentTimestep + 1}/{playback.nTime || '—'} · {formatClock(playback.playheadSeconds)}
                    </span>

                    <select
                        className="sv-playback-speed"
                        data-testid="anuga-playback-speed"
                        value={playback.speed}
                        title={this.speedTitle(playback)}
                        aria-label={this.speedTitle(playback)}
                        onChange={(e) => this.props.onSetSpeed(Number(e.target.value))}
                    >
                        {this.speedOptions(playback).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>

                    {/* TASK-2751 — THE PRIMARY PATH. Which result quantity am I
                        looking at, and where does its colour ramp top out. Those
                        are the two adjustments a reviewer makes constantly, and
                        they were respectively buried mid-row and rendered as an
                        unlabelled number box. They travel together because the
                        ceiling is stored PER QUANTITY. */}
                    <span className="sv-playback-primary" data-testid="anuga-playback-primary-group">
                        <select
                            className="sv-playback-quantity"
                            data-testid="anuga-playback-quantity"
                            value={playback.quantity}
                            title={quantityLabel}
                            aria-label={quantityLabel}
                            onChange={(e) => this.props.onSetQuantity(e.target.value)}
                        >
                            {availableQuantityIds(playback.hasDt).map((id) => (
                                <option
                                    key={id}
                                    value={id}
                                    title={this.tr(`hydrata.playback.quantityOption.${id}`, QUANTITY_OPTION_LABEL[id])}
                                >
                                    {this.tr(`hydrata.playback.quantityShort.${id}`, QUANTITY_SHORT_LABEL[id])}
                                </option>
                            ))}
                        </select>

                        {/* TASK-2752 — RESERVED, NOT IMPLEMENTED. The temporal-max
                            envelope (the in-browser `*_max.tif`) needs per-vertex
                            max arrays that the playback store does not currently
                            contain: playback_store.py writes per-timestep
                            primitives and statics only, and max-of-derived is not
                            derived-of-max, so it cannot be faked client-side from
                            what is there. The slot is reserved so the layout is
                            final; the control stays disabled until the store can
                            answer it. */}
                        <button
                            className="btn sv-glass-button sv-playback-max-envelope"
                            data-testid="anuga-playback-max-envelope"
                            disabled
                            aria-disabled="true"
                            title={this.tr(
                                'hydrata.playback.maxEnvelopeUnavailable',
                                'Peak value over the whole run — coming soon; this run’s store has no max envelope yet'
                            )}
                        >
                            <Message msgId="hydrata.playback.maxEnvelope" />
                        </button>
                    </span>

                    <span className="sv-playback-divider" data-testid="anuga-playback-divider" aria-hidden="true" />

                    <button
                        className={`btn sv-glass-button sv-playback-display-toggle ${this.state.drawerOpen ? 'active' : ''}`}
                        data-testid="anuga-playback-display-toggle"
                        aria-expanded={this.state.drawerOpen ? 'true' : 'false'}
                        onClick={() => this.setState({ drawerOpen: !this.state.drawerOpen })}
                        title={this.tr('hydrata.playback.displayTooltip', 'Opacity, overlays and the colour scale for every result quantity')}
                    >
                        <Message msgId="hydrata.playback.display" />
                        {/* TASK-2726 follow-up — a disclosure chevron, so the
                            button reads as "there is a panel behind this" rather
                            than as another toggle in a row of toggles. Now that
                            Zoom to results lives inside the drawer, a control the
                            user is looking for can be hidden in there, and an
                            unmarked button is a poor place to hide one.

                            Drawn in CSS from borders, NOT an arrow glyph: a
                            character like U+25B4 renders at the font's mercy
                            across platforms and, if it ever picks up emoji
                            presentation, ignores `color` entirely (memory:
                            reference-emoji-presentation-glyph-ignores-css-color).
                            Borders inherit currentColor by construction.

                            It points UP when shut because the drawer GROWS
                            UPWARD (the bar is anchored by its bottom edge — see
                            renderDrawer), so the chevron indicates where the
                            panel will appear, not merely that one exists.
                            aria-hidden: `aria-expanded` on the button already
                            carries this to assistive tech, so announcing it
                            twice would be noise. */}
                        <span className="sv-playback-chevron" aria-hidden="true" />
                    </button>

                    <button
                        className={`btn sv-glass-button sv-playback-identify-toggle ${playback.identifyArmed ? 'active' : ''}`}
                        data-testid="anuga-playback-identify-toggle"
                        onClick={() => this.props.onSetIdentifyArmed(!playback.identifyArmed)}
                        title={this.tr('hydrata.playback.inspectTooltip', 'Click the mesh to inspect values at the current timestep')}
                    >
                        <Message msgId="hydrata.playback.inspect" />
                    </button>

                    <button
                        className={`btn sv-glass-button sv-playback-legend-toggle ${playback.legendOpen ? 'active' : ''}`}
                        data-testid="anuga-playback-legend-toggle"
                        onClick={() => this.props.onSetLegendOpen(!playback.legendOpen)}
                        title={this.tr('hydrata.playback.legendTooltip', 'Show the colour legend')}
                    >
                        <Message msgId="hydrata.playback.legend" />
                    </button>

                    {/* TASK-2744 (AC2) — Unload. Until this existed PLAYBACK_RESET
                        had no dispatcher outside tests, so a run could never be
                        released: the fetcher, its decoded-chunk LRU and two full
                        Float32Array copies of a 3.39M-vertex mesh stayed reachable
                        for the life of the tab (~578 MiB per stale run at prod
                        scale), and IDLE — the only status that renders the manifest
                        loader — was unreachable. */}
                    <button
                        className="btn sv-glass-button sv-playback-unload"
                        data-testid="anuga-playback-unload"
                        onClick={() => this.props.onReset(playback.runId, playback.layerId)}
                        title={this.tr('hydrata.playback.unloadTooltip', 'Unload this run and free its memory')}
                    >
                        <Message msgId="hydrata.playback.unload" />
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    // NOT `state.playback` — MapStore2 core already owns that key for its
    // own Timeline plugin (found live, see playbackEpics.js's header note).
    playback: state && state.anugaPlayback
});

const mapDispatchToProps = {
    onInit: playbackInit,
    onPlay: playbackPlay,
    onPause: playbackPause,
    onSeek: playbackSeek,
    onSetSpeed: playbackSetSpeed,
    onSetQuantity: playbackSetQuantity,
    onSetIdentifyArmed: playbackSetIdentifyArmed,
    onSetLegendOpen: playbackSetLegendOpen,
    onDismissDegraded: playbackDismissDegraded,
    onSetWireframe: playbackSetWireframe,
    // TASK-2744 AC2 — the run must be unloadable.
    onReset: playbackReset,
    // TASK-2726 — MapStore core's own zoom action, the same one
    // pollingEpics.js:954 and anugaInputMenu.js:2090 already dispatch. Not a
    // new zoom mechanism; importing/dispatching a core action is not a fork edit.
    onZoomToExtent: zoomToExtent,
    // TASK-2744 AC3/AC11/AC4 — opacity, the overlay knobs and the colour-ramp
    // maximum are controller state now, pushed to the layer by
    // playbackSyncLayerEpic's baseProps rather than by this component.
    onSetOpacity: playbackSetOpacity,
    onSetBackgroundOpacity: playbackSetBackgroundOpacity,
    onSetOverlay: playbackSetOverlay,
    onSetColorMax: playbackSetColorMax
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaPlaybackControlBarComponent);

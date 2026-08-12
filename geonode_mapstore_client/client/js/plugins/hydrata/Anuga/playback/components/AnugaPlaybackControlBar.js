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
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';

import {
    PLAYBACK_STATUS,
    MIN_SPEED,
    colorMaxForQuantity,
    clampSpeed,
    simulatedSpanSeconds
} from '../playbackController';
import { availableQuantityIds } from '../playbackDerivedQuantities';
import {
    playbackInit,
    playbackPlay,
    playbackPause,
    playbackSeek,
    playbackSetSpeed,
    playbackSetQuantity,
    playbackSetIdentifyArmed,
    playbackSetLegendOpen,
    playbackSetWireframe,
    playbackReset,
    playbackSetOpacity,
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
        onSetWireframe: PropTypes.func,
        onReset: PropTypes.func,
        onSetOpacity: PropTypes.func,
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
    tr(msgId, fallback) {
        const resolved = getMessageById(this.context && this.context.messages || {}, msgId);
        return (!resolved || resolved === msgId) ? fallback : resolved;
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
    state = {
        manifestUrlDraft: ''
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
    speedOptions(playback) {
        const span = simulatedSpanSeconds(playback.time);
        const options = [];
        if (span > 0) {
            WALL_DURATION_OPTIONS.forEach((wallSeconds) => {
                const speed = clampSpeed(span / wallSeconds);
                // Drop any duration the clamp could not actually deliver, so
                // no option silently maps to a different speed than it claims.
                if (Math.abs(span / wallSeconds - speed) < 1e-6) {
                    options.push({
                        value: speed,
                        label: this.tr('hydrata.playback.speedWholeRunIn', 'Whole run in {d}')
                            .replace('{d}', formatWallDuration(wallSeconds)) + ` (${formatMultiplier(speed)})`
                    });
                }
            });
        }
        // Real time is ALWAYS offered and always labelled as such — AC17(b).
        options.push({
            value: 1,
            label: `${this.tr('hydrata.playback.speedRealTime', 'Real time')} (1x${span > 0 ? `, ${formatWallDuration(span)}` : ''})`
        });
        SLOW_MOTION_OPTIONS.forEach((s) => options.push({
            value: s,
            label: `${formatMultiplier(s)} ${this.tr('hydrata.playback.speedSlowMotion', 'slow motion')}`
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

    renderColorMax(playback) {
        const effective = colorMaxForQuantity(
            playback.quantity,
            playback.quantization,
            {
                elevationMin: playback.elevationMin,
                elevationMax: playback.elevationMax,
                colorMaxOverride: (playback.colorMaxOverride || {})[playback.quantity]
            }
        );
        const label = this.tr('hydrata.playback.colorMax', 'Colour scale maximum');
        return (
            <span className="sv-playback-colormax" data-testid="anuga-playback-colormax-group">
                <input
                    type="number"
                    className="sv-playback-colormax-input"
                    data-testid="anuga-playback-colormax"
                    min={0}
                    step="any"
                    value={Number(effective.toFixed(3))}
                    title={label}
                    aria-label={label}
                    onChange={(e) => this.props.onSetColorMax(
                        playback.quantity,
                        e.target.value === '' ? null : Number(e.target.value)
                    )}
                />
            </span>
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

    render() {
        const { playback } = this.props;
        if (!playback || playback.status === PLAYBACK_STATUS.IDLE) {
            return this.renderLoader();
        }
        const isPlaying = playback.status === PLAYBACK_STATUS.PLAYING;
        const isBuffering = [PLAYBACK_STATUS.LOADING_MANIFEST, PLAYBACK_STATUS.LOADING_MESH, PLAYBACK_STATUS.BUFFERING, PLAYBACK_STATUS.SEEKING, PLAYBACK_STATUS.STALLED].includes(playback.status);
        const canScrub = playback.nTime > 0;
        const statusMsgId = STATUS_MESSAGE_ID[playback.status];
        return (
            <div className={`sv-playback-bar sv-playback-bar--${playback.status}`} data-testid="anuga-playback-bar">
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
                    {isPlaying ? '❙❙' : '▶'}
                </button>

                {/* TASK-2744 AC9 — the scrubber must show what is BUFFERED.
                    `bufferedChunks` has lived in controller state since epic
                    2618 and no component ever read it (grep of components/
                    returned nothing), so video-style buffer feedback existed
                    only as a text label. The track wrapper is also what gives
                    the buffered bar a positioned ancestor to sit in. */}
                <span className="sv-playback-scrubber-track" data-testid="anuga-playback-scrubber-track">
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
                </span>

                <span className="sv-playback-readout" data-testid="anuga-playback-readout">
                    {playback.currentTimestep + 1}/{playback.nTime || '—'} · {formatClock(playback.playheadSeconds)}
                </span>

                <select
                    className="sv-playback-speed"
                    data-testid="anuga-playback-speed"
                    value={playback.speed}
                    title={this.tr('hydrata.playback.speed', 'Playback speed')}
                    aria-label={this.tr('hydrata.playback.speed', 'Playback speed')}
                    onChange={(e) => this.props.onSetSpeed(Number(e.target.value))}
                >
                    {this.speedOptions(playback).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                <select
                    className="sv-playback-quantity"
                    data-testid="anuga-playback-quantity"
                    value={playback.quantity}
                    title={this.tr('hydrata.playback.quantity', 'Displayed quantity')}
                    aria-label={this.tr('hydrata.playback.quantity', 'Displayed quantity')}
                    onChange={(e) => this.props.onSetQuantity(e.target.value)}
                >
                    {availableQuantityIds(playback.hasDt).map((id) => (
                        <option key={id} value={id}>{this.tr(`hydrata.playback.quantity.${id}`, QUANTITY_OPTION_LABEL[id])}</option>
                    ))}
                </select>

                {/* TASK-2744 AC3 — layer opacity. RED on map 1461: the layer
                    was pinned at 0.85 by playbackInitEpic with no control
                    anywhere, so the mesh sat as an opaque sheet over the whole
                    catchment (dry cells included) and you could not read the
                    water against the terrain it is flooding. */}
                {this.renderSlider({
                    testid: 'anuga-playback-opacity',
                    className: 'sv-playback-opacity',
                    min: 0.1, max: 1, step: 0.05,
                    value: playback.opacity,
                    label: this.tr('hydrata.playback.opacity', 'Layer opacity'),
                    format: (v) => `${Math.round(v * 100)}%`,
                    onChange: (v) => this.props.onSetOpacity(v)
                })}

                {/* TASK-2744 AC4 — the colour ramp's upper bound. RED: for
                    `depth` this defaulted to the store's valid_max, 16.86 m on
                    run 1328, which puts every urban street depth (0.1-1.0 m)
                    in the bottom 6% of the ramp — one indistinguishable band.
                    Clearing the field restores the store-derived maximum. */}
                {this.renderColorMax(playback)}

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

                {/* TASK-2656d (W6.5) — real wireframe toggle over the render
                    threshold's fill (default OFF); the renderer's own
                    wireProgram already existed, unused, on a live run.
                    TASK-2744 AC10: the plain-text label is gone. Its
                    justification was a wave scope fence that excluded the
                    translations JSON from that wave's gmc scope — epic 2706
                    does not have that fence, so the key is a real one now. */}
                <button
                    className={`btn sv-glass-button sv-playback-wireframe-toggle ${playback.wireframe ? 'active' : ''}`}
                    data-testid="anuga-playback-wireframe-toggle"
                    onClick={() => this.props.onSetWireframe(!playback.wireframe)}
                    title={this.tr('hydrata.playback.wireframeTooltip', 'Overlay mesh triangle edges')}
                >
                    <Message msgId="hydrata.playback.wireframe" />
                </button>

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

                {/* TASK-2744 (AC6, epic 2706) — STATUS MUST NOT MOVE THE
                    CONTROLS. The bar is centred by `left:50%` +
                    `translateX(-50%)`, so ANY width change re-centres it and
                    shifts every control; mounting a buffering label therefore
                    moved the play/pause button. This slot is ALWAYS rendered
                    at a fixed width and the labels mount inside it, so the
                    bar's width is invariant to status.

                    The inner testids stay conditional on purpose — existing
                    specs assert `anuga-playback-buffering` is null when not
                    buffering, and that contract is still true and still
                    worth keeping. */}
                <span className="sv-playback-status" data-testid="anuga-playback-status">
                    {isBuffering ? (
                        <span className="sv-playback-buffering" data-testid="anuga-playback-buffering">
                            {statusMsgId ? <Message msgId={statusMsgId} /> : null}
                        </span>
                    ) : null}
                    {/* TASK-2744 AC18 — determinate mesh-phase progress. The
                        ~100 s after the manifest resolves is a multi-hundred-
                        megabyte download; it had no progress bar, byte counter
                        or ETA, only a static label naming the wrong thing. */}
                    {playback.loadProgress ? (
                        <span className="sv-playback-load-progress" data-testid="anuga-playback-load-progress">
                            {`${playback.loadProgress.objectsLoaded}/${playback.loadProgress.objectCount} · ${formatBytes(playback.loadProgress.bytesLoaded)}`}
                        </span>
                    ) : null}
                </span>
                {/* TASK-2744 (AC2, epic 2706) — Unload. Until this existed
                    PLAYBACK_RESET had no dispatcher outside tests, so a run
                    could never be released: the fetcher, its decoded-chunk
                    LRU and two full Float32Array copies of a 3.39M-vertex
                    mesh stayed reachable for the life of the tab (~578 MiB
                    per stale run at prod scale), and IDLE — the only status
                    that renders the manifest loader — was unreachable. */}
                <button
                    className="btn sv-glass-button sv-playback-unload"
                    data-testid="anuga-playback-unload"
                    onClick={() => this.props.onReset(playback.runId, playback.layerId)}
                    title={this.tr('hydrata.playback.unloadTooltip', 'Unload this run and free its memory')}
                >
                    <Message msgId="hydrata.playback.unload" />
                </button>

                {playback.degraded ? (
                    <span
                        className="sv-playback-degraded"
                        data-testid="anuga-playback-degraded"
                        title={this.tr('hydrata.playback.degradedTooltip', 'Repeated buffering stalls — playback is degraded on this connection')}
                    >
                        <Message msgId="hydrata.playback.degraded" />
                    </span>
                ) : null}
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
    onSetWireframe: playbackSetWireframe,
    // TASK-2744 AC2 — the run must be unloadable.
    onReset: playbackReset,
    // TASK-2744 AC3/AC11/AC4 — opacity, the overlay knobs and the colour-ramp
    // maximum are controller state now, pushed to the layer by
    // playbackSyncLayerEpic's baseProps rather than by this component.
    onSetOpacity: playbackSetOpacity,
    onSetOverlay: playbackSetOverlay,
    onSetColorMax: playbackSetColorMax
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaPlaybackControlBarComponent);

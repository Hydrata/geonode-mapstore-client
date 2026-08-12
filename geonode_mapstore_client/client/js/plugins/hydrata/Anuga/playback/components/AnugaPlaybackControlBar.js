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

import { PLAYBACK_STATUS, MIN_SPEED, MAX_SPEED, colorMaxForQuantity } from '../playbackController';
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

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8].filter((s) => s >= MIN_SPEED && s <= MAX_SPEED);

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

function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatClock(seconds) {
    if (!isFinite(seconds)) {
        return '—:—';
    }
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
}

// Human-facing label per controller status — used for the buffering-feedback
// AC (video-style explicit buffering states, incl. a DISTINCT scrub label).
const STATUS_MESSAGE_ID = {
    [PLAYBACK_STATUS.LOADING_MANIFEST]: 'hydrata.playback.status.loadingManifest',
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
                    placeholder="Playback store manifest URL"
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
        const isBuffering = [PLAYBACK_STATUS.LOADING_MANIFEST, PLAYBACK_STATUS.BUFFERING, PLAYBACK_STATUS.SEEKING, PLAYBACK_STATUS.STALLED].includes(playback.status);
        const canScrub = playback.nTime > 0;
        const statusMsgId = STATUS_MESSAGE_ID[playback.status];
        return (
            <div className={`sv-playback-bar sv-playback-bar--${playback.status}`} data-testid="anuga-playback-bar">
                <button
                    className="btn sv-glass-button sv-playback-playpause"
                    data-testid="anuga-playback-playpause"
                    onClick={() => (isPlaying ? this.props.onPause() : this.props.onPlay())}
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? '❙❙' : '▶'}
                </button>

                <input
                    type="range"
                    className="sv-playback-scrubber"
                    data-testid="anuga-playback-scrubber"
                    min={0}
                    max={Math.max(0, playback.nTime - 1)}
                    step={1}
                    disabled={!canScrub}
                    value={playback.currentTimestep}
                    onChange={(e) => this.props.onSeek(Number(e.target.value))}
                />

                <span className="sv-playback-readout" data-testid="anuga-playback-readout">
                    {playback.currentTimestep + 1}/{playback.nTime || '—'} · {formatClock(playback.playheadSeconds)}
                </span>

                <select
                    className="sv-playback-speed"
                    data-testid="anuga-playback-speed"
                    value={playback.speed}
                    onChange={(e) => this.props.onSetSpeed(Number(e.target.value))}
                >
                    {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}x</option>)}
                </select>

                <select
                    className="sv-playback-quantity"
                    data-testid="anuga-playback-quantity"
                    value={playback.quantity}
                    onChange={(e) => this.props.onSetQuantity(e.target.value)}
                >
                    {availableQuantityIds(playback.hasDt).map((id) => (
                        <option key={id} value={id}>{QUANTITY_OPTION_LABEL[id]}</option>
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
                    title="Click the mesh to inspect values at the current timestep"
                >
                    <Message msgId="hydrata.playback.inspect" />
                </button>

                <button
                    className={`btn sv-glass-button sv-playback-legend-toggle ${playback.legendOpen ? 'active' : ''}`}
                    data-testid="anuga-playback-legend-toggle"
                    onClick={() => this.props.onSetLegendOpen(!playback.legendOpen)}
                >
                    <Message msgId="hydrata.playback.legend" />
                </button>

                {/* TASK-2656d (W6.5) — real wireframe toggle over the render
                    threshold's fill (default OFF); the renderer's own
                    wireProgram already existed, unused, on a live run.
                    Plain-text label (matching the play/pause glyph button
                    above, NOT the <Message> siblings either side of it) —
                    this wave's declared gmc scope is
                    js/plugins/hydrata/Anuga/** only; the translations JSON
                    lives outside it (static/mapstore/hydrata-translations),
                    so a new msgId here would render its own raw key text
                    with a missing-message console warning on every frame. */}
                <button
                    className={`btn sv-glass-button sv-playback-wireframe-toggle ${playback.wireframe ? 'active' : ''}`}
                    data-testid="anuga-playback-wireframe-toggle"
                    onClick={() => this.props.onSetWireframe(!playback.wireframe)}
                    title="Overlay mesh triangle edges"
                >
                    {'Wireframe'}
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

                {isBuffering ? (
                    <span className="sv-playback-buffering" data-testid="anuga-playback-buffering">
                        {statusMsgId ? <Message msgId={statusMsgId} /> : null}
                    </span>
                ) : null}
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
                        title="Repeated buffering stalls — playback is degraded on this connection"
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

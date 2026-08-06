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
import { changeLayerProperties } from '@mapstore/framework/actions/layers';

import { PLAYBACK_STATUS, MIN_SPEED, MAX_SPEED } from '../playbackController';
import { availableQuantityIds } from '../playbackDerivedQuantities';
import { DEFAULT_ARROW_DENSITY_PX, DEFAULT_ARROW_SCALE } from '../playbackFlowViz';
import { DEFAULT_PARTICLE_GRID, DEFAULT_SPEED_EXAGGERATION } from '../playbackParticles';
import {
    playbackInit,
    playbackPlay,
    playbackPause,
    playbackSeek,
    playbackSetSpeed,
    playbackSetQuantity,
    playbackSetIdentifyArmed,
    playbackSetLegendOpen
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
        onChangeLayerProperties: PropTypes.func
    };

    // TASK-2632 (W5.1) — flow-viz overlay knobs are LOCAL component state,
    // not `anugaPlayback` reducer state (same reasoning as `wireframe`,
    // which has never had reducer-level state either — a pure visual
    // rendering toggle, orthogonal to the buffer-then-play/timeline state
    // machine `playbackController.js` owns). Applied to the layer directly
    // via `changeLayerProperties` on every change.
    state = {
        manifestUrlDraft: '',
        flowVizEnabled: false,
        arrowDensity: DEFAULT_ARROW_DENSITY_PX,
        arrowScale: DEFAULT_ARROW_SCALE,
        // TASK-2633 (W5.2) — same reasoning as the flow-viz state above:
        // local component state, applied via changeLayerProperties.
        particlesEnabled: false,
        particleDensity: DEFAULT_PARTICLE_GRID,
        particleSpeedExaggeration: DEFAULT_SPEED_EXAGGERATION
    };

    // Shared by setFlowVizProps/setParticleProps below — both are "update
    // local state, then push a field subset of it to the layer via
    // changeLayerProperties"; only WHICH fields differs.
    applyLayerProps(patch, pickFields) {
        this.setState(patch, () => {
            const { playback, onChangeLayerProperties } = this.props;
            if (playback && playback.layerId && onChangeLayerProperties) {
                onChangeLayerProperties(playback.layerId, pickFields(this.state));
            }
        });
    }

    setFlowVizProps(patch) {
        this.applyLayerProps(patch, (s) => ({
            flowVizEnabled: s.flowVizEnabled,
            arrowDensity: s.arrowDensity,
            arrowScale: s.arrowScale
        }));
    }

    setParticleProps(patch) {
        this.applyLayerProps(patch, (s) => ({
            particlesEnabled: s.particlesEnabled,
            particleDensity: s.particleDensity,
            particleSpeedExaggeration: s.particleSpeedExaggeration
        }));
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

                <button
                    className={`btn sv-glass-button sv-playback-flowviz-toggle ${this.state.flowVizEnabled ? 'active' : ''}`}
                    data-testid="anuga-playback-flowviz-toggle"
                    onClick={() => this.setFlowVizProps({ flowVizEnabled: !this.state.flowVizEnabled })}
                    title="Velocity arrow overlay"
                >
                    <Message msgId="hydrata.playback.flowViz" />
                </button>
                {this.state.flowVizEnabled ? (
                    <span className="sv-playback-flowviz-controls" data-testid="anuga-playback-flowviz-controls">
                        <input
                            type="range"
                            className="sv-playback-flowviz-density"
                            data-testid="anuga-playback-flowviz-density"
                            min={16}
                            max={160}
                            step={4}
                            value={this.state.arrowDensity}
                            title="Arrow density (px spacing)"
                            onChange={(e) => this.setFlowVizProps({ arrowDensity: Number(e.target.value) })}
                        />
                        <input
                            type="range"
                            className="sv-playback-flowviz-scale"
                            data-testid="anuga-playback-flowviz-scale"
                            min={0.25}
                            max={3}
                            step={0.25}
                            value={this.state.arrowScale}
                            title="Arrow scale"
                            onChange={(e) => this.setFlowVizProps({ arrowScale: Number(e.target.value) })}
                        />
                    </span>
                ) : null}

                <button
                    className={`btn sv-glass-button sv-playback-particles-toggle ${this.state.particlesEnabled ? 'active' : ''}`}
                    data-testid="anuga-playback-particles-toggle"
                    onClick={() => this.setParticleProps({ particlesEnabled: !this.state.particlesEnabled })}
                    title="Particle trails"
                >
                    <Message msgId="hydrata.playback.particles" />
                </button>
                {this.state.particlesEnabled ? (
                    <span className="sv-playback-particles-controls" data-testid="anuga-playback-particles-controls">
                        <input
                            type="range"
                            className="sv-playback-particles-density"
                            data-testid="anuga-playback-particles-density"
                            min={32}
                            max={256}
                            step={16}
                            value={this.state.particleDensity}
                            title="Particle density (grid side length)"
                            onChange={(e) => this.setParticleProps({ particleDensity: Number(e.target.value) })}
                        />
                        <input
                            type="range"
                            className="sv-playback-particles-exaggeration"
                            data-testid="anuga-playback-particles-exaggeration"
                            min={0.25}
                            max={5}
                            step={0.25}
                            value={this.state.particleSpeedExaggeration}
                            title="Speed exaggeration"
                            onChange={(e) => this.setParticleProps({ particleSpeedExaggeration: Number(e.target.value) })}
                        />
                    </span>
                ) : null}

                {isBuffering ? (
                    <span className="sv-playback-buffering" data-testid="anuga-playback-buffering">
                        {statusMsgId ? <Message msgId={statusMsgId} /> : null}
                    </span>
                ) : null}
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
    onChangeLayerProperties: changeLayerProperties
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaPlaybackControlBarComponent);

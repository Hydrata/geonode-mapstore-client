/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PlaybackIdentifyReadout — floating value readout for a click-to-inspect
 * result (TASK-2628, W3.2, epic 2618). Self-gates on
 * `state.anugaPlayback.identifyResult` being present (null until the
 * operator arms "Inspect" and clicks the mesh — see
 * epics/playbackEpics.js's playbackIdentifyEpic). Always names the surface
 * it reports (AC: "the readout should say which surface it reports").
 *
 * TASK-2656b (W6.5, epic 2618) — the panel's CSS anchor is a fixed
 * `bottom-left` offset (anuga.css's `.sv-playback-identify-readout`), which
 * clips on a short/narrow viewport once the result grows past a couple of
 * rows (UAT: labels unreadable at the bottom-left viewport edge). Clamped
 * in JS rather than pure CSS because the box's own height varies with which
 * derived-quantity rows are present in `result` — no CSS-only rule can know
 * that ahead of layout. Clamps AFTER every result/mount so a longer result
 * (more rows) re-clamps, not just the first paint.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

const VIEWPORT_MARGIN_PX = 8;

function formatMetric(v, digits = 3) {
    return typeof v === 'number' && isFinite(v) ? v.toFixed(digits) : '—';
}

// TASK-2629 (W4.1) — one row per derived quantity, shown whenever
// sampleFieldAtPoint actually computed it (stage/shear/courant are
// conditional on geometry/constants being passed — see playbackIdentify.js's
// header; on a wet cell every field the current store supports is present).
const EXTRA_ROWS = [
    { field: 'stage', testId: 'playback-identify-stage', label: 'Stage', unit: 'm' },
    { field: 'div', testId: 'playback-identify-div', label: 'Depth-integrated velocity', unit: 'm²/s' },
    { field: 'froude', testId: 'playback-identify-froude', label: 'Froude number', unit: '' },
    { field: 'shear', testId: 'playback-identify-shear', label: 'Manning shear stress', unit: 'Pa' },
    { field: 'courant', testId: 'playback-identify-courant', label: 'Courant number (approx.)', unit: '' }
];

export class PlaybackIdentifyReadoutComponent extends React.Component {
    static propTypes = {
        result: PropTypes.object,
        quantity: PropTypes.string
    };

    state = {
        // Inline override on top of the CSS default bottom-left anchor —
        // null until a clamp pass finds the CSS-default box would spill
        // off-screen (the common case never pays for an inline style).
        clampStyle: null
    };

    componentDidMount() {
        this._clampToViewport();
    }

    componentDidUpdate(prevProps) {
        // A different/larger result can change the panel's height (more
        // derived-quantity rows) even though `located` stays true, so
        // re-clamp on every result change, not just the first mount.
        if (prevProps.result !== this.props.result) {
            this._clampToViewport();
        }
    }

    /**
     * Re-measures the panel against its CSS-default position, then applies
     * an inline left/top/bottom/right override only if that default box
     * would spill past the viewport edge. Resets to the CSS default first
     * so a SHRINKING result (fewer rows) can un-clamp — otherwise a stale
     * inline override from a taller previous result would linger forever.
     */
    _clampToViewport() {
        const node = this._rootRef;
        if (!node || typeof window === 'undefined') {
            return;
        }
        this.setState({ clampStyle: null }, () => {
            const el = this._rootRef;
            if (!el) {
                return;
            }
            const rect = el.getBoundingClientRect();
            const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - rect.width - VIEWPORT_MARGIN_PX);
            const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - rect.height - VIEWPORT_MARGIN_PX);
            const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN_PX), maxLeft);
            const top = Math.min(Math.max(rect.top, VIEWPORT_MARGIN_PX), maxTop);
            if (left !== rect.left || top !== rect.top) {
                this.setState({
                    clampStyle: { left: `${left}px`, top: `${top}px`, bottom: 'auto', right: 'auto' }
                });
            }
        });
    }

    render() {
        const { result } = this.props;
        if (!result) {
            return null;
        }
        return (
            <div
                className="sv-playback-identify-readout"
                data-testid="playback-identify-readout"
                style={this.state.clampStyle || undefined}
                ref={(el) => { this._rootRef = el; }}
            >
                <div className="sv-playback-identify-readout-title"><Message msgId="hydrata.playback.identifyReadoutTitle" /></div>
                {!result.located ? (
                    <div className="sv-playback-identify-readout-body" data-testid="playback-identify-no-data">
                        <Message msgId="hydrata.playback.identifyReadoutNoData" />
                    </div>
                ) : (
                    <div className="sv-playback-identify-readout-body">
                        {result.wet === false ? (
                            <div className="sv-playback-identify-row" data-testid="playback-identify-dry">
                                <Message msgId="hydrata.playback.identifyReadoutDry" />
                            </div>
                        ) : null}
                        <div className="sv-playback-identify-row" data-testid="playback-identify-depth">
                            <span className="sv-playback-identify-label">Depth</span>
                            <span className="sv-playback-identify-value">{formatMetric(result.depth)} m</span>
                        </div>
                        <div className="sv-playback-identify-row" data-testid="playback-identify-speed">
                            <span className="sv-playback-identify-label">Velocity</span>
                            <span className="sv-playback-identify-value">{formatMetric(result.speed)} m/s</span>
                        </div>
                        {result.hazardClass ? (
                            <div className="sv-playback-identify-row" data-testid="playback-identify-hazard">
                                <span className="sv-playback-identify-label">Flood hazard</span>
                                <span className="sv-playback-identify-value">{result.hazardClass}</span>
                            </div>
                        ) : null}
                        {EXTRA_ROWS.filter((row) => typeof result[row.field] === 'number').map((row) => (
                            <div className="sv-playback-identify-row" key={row.field} data-testid={row.testId}>
                                <span className="sv-playback-identify-label">{row.label}</span>
                                <span className="sv-playback-identify-value">{formatMetric(result[row.field])}{row.unit ? ` ${row.unit}` : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="sv-playback-identify-readout-surface" data-testid="playback-identify-surface-note">
                    <Message msgId="hydrata.playback.identifyReadoutSurface" />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    result: state.anugaPlayback && state.anugaPlayback.identifyResult,
    quantity: state.anugaPlayback && state.anugaPlayback.quantity
});

export default connect(mapStateToProps)(PlaybackIdentifyReadoutComponent);

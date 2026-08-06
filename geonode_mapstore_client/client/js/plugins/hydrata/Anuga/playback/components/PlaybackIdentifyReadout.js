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
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

function formatMetric(v, digits = 3) {
    return typeof v === 'number' && isFinite(v) ? v.toFixed(digits) : '—';
}

export class PlaybackIdentifyReadoutComponent extends React.Component {
    static propTypes = {
        result: PropTypes.object,
        quantity: PropTypes.string
    };

    render() {
        const { result } = this.props;
        if (!result) {
            return null;
        }
        return (
            <div className="sv-playback-identify-readout" data-testid="playback-identify-readout">
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

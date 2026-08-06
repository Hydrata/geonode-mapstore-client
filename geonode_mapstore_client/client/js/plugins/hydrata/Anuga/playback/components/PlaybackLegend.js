/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PlaybackLegend — per-quantity legend for the playback mesh (TASK-2628,
 * W3.2, epic 2618). Shows the SAME SLD-derived colour stops
 * (playbackColormap.js's DEPTH_SLD_STOPS/VELOCITY_SLD_STOPS) the renderer's
 * dual-LUT now actually draws with (AnugaPlaybackRenderer's _ensureLUT), so
 * this legend and the on-screen ramp can never disagree — plus the AC's
 * required tolerance-vs-max-raster note (identify/legend both read the
 * smoothed VERTEX field, a different surface than the *_max COG rasters).
 *
 * Precedent: DemRampLegend.js (fixed-colour-stops legend, MovablePanel
 * shell) — this follows the same swatch-list + MovablePanel pattern rather
 * than simpleViewLegend.js's WMS GetLegendGraphic path, since the playback
 * layer is a custom canvas type with no WMS/SLD endpoint of its own.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

import {
    DEPTH_SLD_STOPS,
    DEPTH_SLD_MAX,
    VELOCITY_SLD_STOPS,
    VELOCITY_SLD_MAX
} from '../playbackColormap';
import { colorMaxForQuantity } from '../playbackController';
import MovablePanel from '../../../shared/components/MovablePanel';
import { setMovablePanelState } from '../../actions/uiActions';
import { playbackSetLegendOpen } from '../actions/playbackActions';

export const PLAYBACK_LEGEND_PANEL_ID = 'playbackLegend';

function stopsForQuantity(quantity) {
    return quantity === 'speed'
        ? { stops: VELOCITY_SLD_STOPS, sldMax: VELOCITY_SLD_MAX, unit: 'm/s', titleId: 'hydrata.playback.legendTitleSpeed' }
        : { stops: DEPTH_SLD_STOPS, sldMax: DEPTH_SLD_MAX, unit: 'm', titleId: 'hydrata.playback.legendTitleDepth' };
}

function formatValue(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export class PlaybackLegendComponent extends React.Component {
    static propTypes = {
        quantity: PropTypes.string,
        quantization: PropTypes.object
    };

    render() {
        const { quantity, quantization } = this.props;
        const { stops, sldMax, unit, titleId } = stopsForQuantity(quantity);
        const colorMax = colorMaxForQuantity(quantity, quantization);
        const exceedsSld = colorMax > sldMax;
        return (
            <div className="sv-playback-legend" data-testid="playback-legend">
                <div className="sv-playback-legend-header">
                    <span className="sv-playback-legend-title"><Message msgId={titleId} /></span>
                </div>
                <ul className="sv-playback-legend-stops">
                    {stops.slice().reverse().map((stop) => (
                        <li className="sv-playback-legend-row" key={stop.quantity} data-testid={`playback-legend-row-${stop.quantity}`}>
                            <span className="sv-playback-legend-swatch" style={{ backgroundColor: `rgb(${stop.color.join(',')})` }} aria-hidden="true" />
                            <span className="sv-playback-legend-label">{formatValue(stop.quantity)} {unit}{stop.quantity === stops[stops.length - 1].quantity ? '+' : ''}</span>
                        </li>
                    ))}
                </ul>
                {exceedsSld ? (
                    <div className="sv-playback-legend-note" data-testid="playback-legend-exceeds-sld">
                        <Message msgId="hydrata.playback.legendExceedsSld" msgParams={{ colorMax: formatValue(colorMax), unit }} />
                    </div>
                ) : null}
                <div className="sv-playback-legend-tolerance" data-testid="playback-legend-tolerance-note">
                    <Message msgId="hydrata.playback.legendToleranceNote" />
                </div>
            </div>
        );
    }
}

const mapStateToPropsLegend = (state) => ({
    quantity: (state.anugaPlayback && state.anugaPlayback.quantity) || 'depth',
    quantization: state.anugaPlayback && state.anugaPlayback.quantization
});

export const PlaybackLegendConnected = connect(mapStateToPropsLegend)(PlaybackLegendComponent);

function defaultLegendPosition() {
    if (typeof window === 'undefined') {
        return { x: 20, y: 80 };
    }
    return { x: Math.max(20, window.innerWidth - 300), y: 80 };
}

export function FloatingPlaybackLegendPanelComponent({ open, panelState, onClose, onPanelStateChange }) {
    if (!open) {
        return null;
    }
    return (
        <MovablePanel
            panelId={PLAYBACK_LEGEND_PANEL_ID}
            className="sv-playback-legend-panel"
            title="Legend"
            position={panelState && panelState.position}
            defaultPosition={defaultLegendPosition()}
            size={panelState && panelState.size}
            onClose={onClose}
            onMove={(position) => onPanelStateChange(PLAYBACK_LEGEND_PANEL_ID, { position })}
            onResize={(size) => onPanelStateChange(PLAYBACK_LEGEND_PANEL_ID, { size })}
        >
            <PlaybackLegendConnected />
        </MovablePanel>
    );
}

FloatingPlaybackLegendPanelComponent.propTypes = {
    open: PropTypes.bool,
    panelState: PropTypes.object,
    onClose: PropTypes.func,
    onPanelStateChange: PropTypes.func
};

const floatingMapStateToProps = (state) => ({
    open: !!(state.anugaPlayback && state.anugaPlayback.legendOpen),
    panelState: state.anuga && state.anuga.ui && state.anuga.ui.movablePanels && state.anuga.ui.movablePanels[PLAYBACK_LEGEND_PANEL_ID]
});

export const FloatingPlaybackLegendPanel = connect(floatingMapStateToProps, {
    onClose: () => playbackSetLegendOpen(false),
    onPanelStateChange: setMovablePanelState
})(FloatingPlaybackLegendPanelComponent);

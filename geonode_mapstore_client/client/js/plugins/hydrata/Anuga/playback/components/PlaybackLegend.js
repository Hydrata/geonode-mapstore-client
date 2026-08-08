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

import { QUANTITY_RAMPS } from '../playbackColormap';
import { QUANTITY_META } from '../playbackDerivedQuantities';
import { colorMaxForQuantity, colorMinForQuantity } from '../playbackController';
import MovablePanel from '../../../shared/components/MovablePanel';
import { setMovablePanelState } from '../../actions/uiActions';
import { playbackSetLegendOpen } from '../actions/playbackActions';

export const PLAYBACK_LEGEND_PANEL_ID = 'playbackLegend';

// TASK-2629 (W4.1) — legend title per quantity (glossary-exact terms: AC
// requires "Derived quantity"/"Courant number" match the glossary).
const QUANTITY_TITLE_ID = {
    depth: 'hydrata.playback.legendTitleDepth',
    speed: 'hydrata.playback.legendTitleSpeed',
    stage: 'hydrata.playback.legendTitleStage',
    div: 'hydrata.playback.legendTitleDiv',
    hazard: 'hydrata.playback.legendTitleHazard',
    froude: 'hydrata.playback.legendTitleFroude',
    shear: 'hydrata.playback.legendTitleShear',
    courant: 'hydrata.playback.legendTitleCourant'
};

function formatValue(v) {
    if (!isFinite(v)) {
        return '—';
    }
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export class PlaybackLegendComponent extends React.Component {
    static propTypes = {
        quantity: PropTypes.string,
        quantization: PropTypes.object,
        elevationMin: PropTypes.number,
        elevationMax: PropTypes.number
    };

    render() {
        const { quantity, quantization, elevationMin, elevationMax } = this.props;
        const ramp = QUANTITY_RAMPS[quantity] || QUANTITY_RAMPS.depth;
        const meta = QUANTITY_META[quantity] || QUANTITY_META.depth;
        const titleId = QUANTITY_TITLE_ID[quantity] || QUANTITY_TITLE_ID.depth;
        const context = { elevationMin, elevationMax };
        const colorMax = colorMaxForQuantity(quantity, quantization, context);
        const colorMin = colorMinForQuantity(quantity, context);
        // Hazard is CLASSED (H1-H6), not a continuous physical ramp — AC:
        // "the legend must render discrete classes" — every stop always
        // shows (no exceeds-cap note, no rescale note; the classification
        // is not a value that can "exceed" its own scale).
        const exceedsSld = !ramp.discrete && !meta.requiresDt && (colorMax - colorMin) > ramp.max;
        return (
            <div className="sv-playback-legend" data-testid="playback-legend">
                <div className="sv-playback-legend-header">
                    <span className="sv-playback-legend-title"><Message msgId={titleId} /></span>
                </div>
                <ul className="sv-playback-legend-stops">
                    {ramp.discrete ? (
                        ramp.stops.map((stop) => (
                            <li className="sv-playback-legend-row" key={stop.className} data-testid={`playback-legend-hazard-${stop.className}`}>
                                <span className="sv-playback-legend-swatch" style={{ backgroundColor: `rgb(${stop.color.join(',')})` }} aria-hidden="true" />
                                <span className="sv-playback-legend-label">{stop.className}</span>
                            </li>
                        ))
                    ) : (
                        ramp.stops.slice().reverse().map((stop) => (
                            <li className="sv-playback-legend-row" key={stop.quantity} data-testid={`playback-legend-row-${stop.quantity}`}>
                                <span className="sv-playback-legend-swatch" style={{ backgroundColor: `rgb(${stop.color.join(',')})` }} aria-hidden="true" />
                                <span className="sv-playback-legend-label">{formatValue(stop.quantity)} {meta.unit}{stop.quantity === ramp.stops[ramp.stops.length - 1].quantity ? '+' : ''}</span>
                            </li>
                        ))
                    )}
                </ul>
                {exceedsSld ? (
                    <div className="sv-playback-legend-note" data-testid="playback-legend-exceeds-sld">
                        <Message msgId="hydrata.playback.legendExceedsSld" msgParams={{ colorMax: formatValue(colorMax), unit: meta.unit }} />
                    </div>
                ) : null}
                {meta.requiresDt ? (
                    <div className="sv-playback-legend-note" data-testid="playback-legend-approximate-note">
                        <Message msgId="hydrata.playback.legendCourantApprox" />
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
    quantization: state.anugaPlayback && state.anugaPlayback.quantization,
    elevationMin: state.anugaPlayback && state.anugaPlayback.elevationMin,
    elevationMax: state.anugaPlayback && state.anugaPlayback.elevationMax
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

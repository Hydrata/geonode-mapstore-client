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

import { QUANTITY_RAMPS, isRampNormalized, rampStopValues } from '../playbackColormap';
import { QUANTITY_META } from '../playbackDerivedQuantities';
import { colorMaxForQuantity, colorMinForQuantity, isColorMaxOverridden } from '../playbackController';
import MovablePanel from '../../../shared/components/MovablePanel';
import { setMovablePanelState } from '../../actions/uiActions';
import { playbackSetLegendOpen, playbackSetColorMax } from '../actions/playbackActions';
import EditableCeiling from './EditableCeiling';

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
        elevationMax: PropTypes.number,
        // TASK-2744 AC4 — the operator's colour-ramp override for the ACTIVE
        // quantity, or undefined for "use the store-derived maximum".
        colorMaxOverride: PropTypes.number,
        // TASK-2751 — the ceiling is editable HERE too, from the number the
        // reader is already looking at.
        onSetColorMax: PropTypes.func
    };

    render() {
        const { quantity, quantization, elevationMin, elevationMax, colorMaxOverride, onSetColorMax } = this.props;
        const ramp = QUANTITY_RAMPS[quantity] || QUANTITY_RAMPS.depth;
        const meta = QUANTITY_META[quantity] || QUANTITY_META.depth;
        const titleId = QUANTITY_TITLE_ID[quantity] || QUANTITY_TITLE_ID.depth;
        const context = { elevationMin, elevationMax, colorMaxOverride };
        const colorMax = colorMaxForQuantity(quantity, quantization, context);
        const colorMin = colorMinForQuantity(quantity, context);
        // Hazard is CLASSED (H1-H6), not a continuous physical ramp — AC:
        // "the legend must render discrete classes" — every stop always
        // shows (no exceeds-cap note, no rescale note; the classification
        // is not a value that can "exceed" its own scale).
        //
        // TASK-2784 (W7) also excludes a ramp whose OWN stops are fractional.
        // `stage`'s ramp.max of 1 is a documented placeholder, not a standard
        // scale, so `span > 1` is true of every run that spans more than a
        // metre of elevation and the note fired permanently. Seen live on map
        // 1461 / prod run 1328: "Ramp extended to 65.02 m — this run exceeds
        // the standard scale", on a run doing nothing unusual. An override
        // above a REAL cap still warns, which is the case the note is for.
        const exceedsSld = !ramp.discrete && !ramp.normalized && !meta.requiresDt
            && (colorMax - colorMin) > ramp.max;
        // TASK-2744 AC4 — the stop list must TRACK an operator override: a
        // legend advertising a 6 m swatch while the renderer saturates at
        // 1.5 m is advertising a colour the map cannot produce.
        //
        // TASK-2784 (W7) replaces HOW it tracks. 2744 clipped the list —
        // dropped every stop above the ceiling — because the LUT was pinned to
        // absolute SLD values, so those colours genuinely had nowhere to live.
        // Now a reader-set ceiling STRETCHES the ramp instead
        // (playbackColormap.isRampNormalized), so every stop is reachable
        // again; what changes is the VALUE beside each swatch, not whether the
        // swatch exists. Same invariant, more contrast: pulling velocity down
        // to 4 m/s now spends the whole spectrum on 0-4 rather than the
        // yellow-to-magenta two-thirds of it.
        //
        // Untouched by design: with NO override the labels stay the SLD's own
        // absolute values, because that is exactly what the render is then
        // keyed to. (colorMaxForQuantity falls back to 1 before a manifest
        // loads, a placeholder rather than a ceiling — rescaling on it would
        // relabel the whole ramp on every pre-manifest render.)
        const normalized = isRampNormalized(quantity, isColorMaxOverridden(quantity, context));
        const visibleStops = rampStopValues(quantity, { colorMin, colorMax, normalized });
        const topStop = visibleStops[visibleStops.length - 1];
        return (
            <div className="sv-playback-legend" data-testid="playback-legend">
                <div className="sv-playback-legend-header">
                    <span className="sv-playback-legend-title"><Message msgId={titleId} /></span>
                </div>
                {/* TASK-2751 — THE CEILING, as its own row: the one place the
                    number can be TYPED. (Until TASK-2784 it was also the only
                    place the ceiling appeared at all, since the stop list was
                    clipped below it; now the top stop carries the same value.)
                    Hazard is excluded: H1–H6 IS the scale, there is no ceiling
                    to raise. */}
                {ramp.discrete ? null : (
                    <div className="sv-playback-legend-ceiling">
                        <EditableCeiling
                            testid="playback-legend-ceiling"
                            quantity={quantity}
                            value={colorMax}
                            unit={meta.unit}
                            overridden={isColorMaxOverridden(quantity, context)}
                            onChange={onSetColorMax}
                        />
                    </div>
                )}
                <ul className="sv-playback-legend-stops">
                    {ramp.discrete ? (
                        ramp.stops.map((stop) => (
                            <li className="sv-playback-legend-row" key={stop.className} data-testid={`playback-legend-hazard-${stop.className}`}>
                                <span className="sv-playback-legend-swatch" style={{ backgroundColor: `rgb(${stop.color.join(',')})` }} aria-hidden="true" />
                                <span className="sv-playback-legend-label">{stop.className}</span>
                            </li>
                        ))
                    ) : (
                        /* The testid stays keyed on the stop's NATIVE quantity —
                           the stop's stable identity across every ceiling —
                           while the label carries the value it stands for at
                           the current range. They coincide unless the reader
                           has set a ceiling. */
                        visibleStops.slice().reverse().map((stop) => (
                            <li className="sv-playback-legend-row" key={stop.quantity} data-testid={`playback-legend-row-${stop.quantity}`}>
                                <span className="sv-playback-legend-swatch" style={{ backgroundColor: `rgb(${stop.color.join(',')})` }} aria-hidden="true" />
                                <span className="sv-playback-legend-label">{formatValue(stop.value)} {meta.unit}{stop.quantity === topStop.quantity ? '+' : ''}</span>
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
    elevationMax: state.anugaPlayback && state.anugaPlayback.elevationMax,
    // TASK-2744 AC4 — same shared derivation the renderer uniform uses, so
    // the legend and the mesh can never disagree about the active range.
    colorMaxOverride: state.anugaPlayback
        && (state.anugaPlayback.colorMaxOverride || {})[(state.anugaPlayback.quantity) || 'depth']
});

export const PlaybackLegendConnected = connect(mapStateToPropsLegend, {
    // TASK-2751 — the ceiling row commits through the same per-quantity action
    // the control bar uses, so the bar chip and the legend row cannot disagree.
    onSetColorMax: playbackSetColorMax
})(PlaybackLegendComponent);

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

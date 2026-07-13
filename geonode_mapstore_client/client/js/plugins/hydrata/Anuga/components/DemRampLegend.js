/**
 * TASK-1850 (epic 1814 W2) — Live dynamic-DEM colour-ramp legend.
 *
 * Renders a vertical swatch list of the 11 FIXED ramp colours (mirrored from
 * apps/gn_anuga/slds/dem_template.sld via utils/demRamp.js) paired with the
 * LIVE elevation stops the demRescaleEpic last applied.
 *
 * Stop source (precedence — so the legend and the map can never disagree):
 *   1. The live `env=` param the epic stamps on the DEM layer
 *      (`demLayer.params.env`, parsed back to {elevMin..elevMax}). This is the
 *      SAME string GeoServer renders, so swatch labels track the visible window.
 *   2. Fallback (no live env yet, e.g. before the first pan): the terrain row's
 *      stored whole-raster `dem_elev_min`/`dem_elev_max`, expanded to the 11
 *      stops via computeDemRampStops (the FE mirror of _compute_dem_ramp_stops).
 *
 * Degraded indicator (folds TASK-97 hardening): when the epic could not fetch a
 * live windowed range and fell back to the stored full range (PART A), the
 * `demRampDegraded` ui flag is set for this layer id — the legend then shows a
 * small "full range" badge so the failure is VISIBLE rather than silent.
 *
 * No reusable colour-ramp / RasterLegend component exists in the Anuga plugin
 * or MapStore2 (red-team confirmed), so this is a small bespoke component.
 *
 * PART C (presets) deferred — see anugaInputMenu.js mount site. The colour ramp
 * is a single fixed terrain ramp baked into dem_template.sld; offering
 * viridis/grayscale would need per-preset SLD colour ramps + env plumbing,
 * which is a separate, bigger lift.
 */
import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import { isDemRampDegraded } from '../selectorsAnuga';
import {
    DEM_RAMP_COLORS,
    computeDemRampStops,
    parseEnvString,
    buildLegendStops
} from '../utils/demRamp';
// TASK-2233 — the legend now floats as a stand-alone MovablePanel (mounted at
// anugaContainer level) instead of rendering inline in the Terrain menu.
import MovablePanel from '../../shared/components/MovablePanel';
import { findDynamicDemPairs } from '../epics/demRescaleEpic';
import { setMovablePanelState, setDemLegendPanel } from '../actions/uiActions';

/**
 * Resolve the {elevMin..elevMax} stops to label the swatches with, applying the
 * live-env -> stored-range precedence described in the file header.
 *
 * @param {Object} demLayer - the map layer object (carries params.env)
 * @param {Object} terrainModel - the terrain row (carries dem_elev_min/max)
 * @returns {{stops: Object, source: ('live'|'stored'|'none')}}
 */
export function resolveLegendStops(demLayer, terrainModel) {
    // 1. live env the epic stamped
    const envString = demLayer?.params?.env;
    const liveStops = parseEnvString(envString);
    if (Object.keys(liveStops).length >= DEM_RAMP_COLORS.length) {
        return { stops: liveStops, source: 'live' };
    }
    // 2. stored whole-raster range
    const storedStops = computeDemRampStops(
        terrainModel?.dem_elev_min,
        terrainModel?.dem_elev_max
    );
    if (storedStops) {
        return { stops: storedStops, source: 'stored' };
    }
    return { stops: {}, source: 'none' };
}

/**
 * Format an elevation stop for a swatch label. null/undefined -> em-dash.
 */
function formatStop(value) {
    if (value === null || value === undefined || !isFinite(Number(value))) {
        return '—';
    }
    // Round to 1 decimal but drop a trailing .0 so round metres read cleanly.
    const n = Number(value);
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export class DemRampLegendComponent extends React.Component {
    static propTypes = {
        demLayer: PropTypes.object,
        terrainModel: PropTypes.object,
        // injected by connect: true when the epic fell back to the stored full range
        degraded: PropTypes.bool
    };

    render() {
        const { demLayer, terrainModel, degraded } = this.props;
        const { stops, source } = resolveLegendStops(demLayer, terrainModel);
        const rows = buildLegendStops(stops);
        // Show the "full range" badge when the epic explicitly degraded OR when
        // we are still on the stored whole-raster range (no live windowed fetch
        // has landed yet for this layer) — either way the ramp spans the WHOLE
        // DEM, not the visible window.
        const showFullRange = !!degraded || source === 'stored';

        return (
            <div className="sv-dem-legend" data-testid="dem-ramp-legend">
                <div className="sv-dem-legend-header">
                    <span className="sv-dem-legend-title">Elevation (m)</span>
                    {showFullRange ? (
                        <span
                            className="sv-dem-legend-fullrange"
                            data-testid="dem-ramp-legend-fullrange"
                            title={degraded
                                ? 'Live windowed range unavailable — showing the whole-DEM range'
                                : 'Showing the whole-DEM range (pan/zoom to rescale to the visible window)'}
                        >
                            full range
                        </span>
                    ) : null}
                </div>
                <ul className="sv-dem-legend-stops">
                    {/* High elevation at the top, low at the bottom (map convention). */}
                    {rows.slice().reverse().map((row) => (
                        <li className="sv-dem-legend-row" key={row.key} data-testid={`dem-ramp-legend-row-${row.key}`}>
                            <span
                                className="sv-dem-legend-swatch"
                                style={{ backgroundColor: row.color }}
                                aria-hidden="true"
                            />
                            <span className="sv-dem-legend-label">{formatStop(row.value)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => ({
    degraded: isDemRampDegraded(state, ownProps?.demLayer?.id)
});

export default connect(mapStateToProps)(DemRampLegendComponent);

/* ── TASK-2233 — stand-alone floating legend panel ──────────────────────────
 *
 * The legend used to render inline inside the Terrain layer-management panel
 * (anugaInputMenu), which meant it unmounted exactly when the user closed the
 * Inputs menu to study the map. It now rides a MovablePanel mounted at the
 * anugaContainer level (the TerrainBboxPanel pattern), self-gating on:
 *   - a dynamic-mode terrain with its DEM layer present (findDynamicDemPairs —
 *     the SAME predicate the rescale epic uses, so legend visibility can never
 *     disagree with what the epic actually rescales), and
 *   - the user-closed flag (state.anuga.ui.demLegendPanelClosed; cleared when
 *     a terrain re-enters dynamic mode, see uiReducer).
 * Dragged position / resized size persist in-session on the ui slice keyed by
 * DEM_LEGEND_PANEL_ID. Legend CONTENT is untouched — the same
 * DemRampLegendComponent renders inside the panel (degraded flag mapped by
 * the panel's own connect, so there is no nested store subscription).
 */
export const DEM_LEGEND_PANEL_ID = 'demRampLegend';

// Default to the top-right of the map, clear of the left-docked menus the
// user is likely to have open; MovablePanel clamps it back on-screen anyway.
function defaultLegendPosition() {
    if (typeof window === 'undefined') return { x: 20, y: 80 };
    return { x: Math.max(20, window.innerWidth - 300), y: 80 };
}

export function FloatingDemLegendPanelComponent({ pair, closed, degraded, panelState, onClose, onPanelStateChange }) {
    if (!pair || closed) {
        return null;
    }
    return (
        <MovablePanel
            panelId={DEM_LEGEND_PANEL_ID}
            className="sv-dem-legend-panel"
            title={pair.terrain?.title || 'Elevation'}
            position={panelState?.position}
            defaultPosition={defaultLegendPosition()}
            size={panelState?.size}
            onClose={onClose}
            onMove={(position) => onPanelStateChange(DEM_LEGEND_PANEL_ID, { position })}
            onResize={(size) => onPanelStateChange(DEM_LEGEND_PANEL_ID, { size })}
        >
            <DemRampLegendComponent demLayer={pair.layer} terrainModel={pair.terrain} degraded={degraded} />
        </MovablePanel>
    );
}

FloatingDemLegendPanelComponent.propTypes = {
    // {layer, terrain} for the first dynamic-mode DEM (null = no legend)
    pair: PropTypes.object,
    closed: PropTypes.bool,
    degraded: PropTypes.bool,
    // { position?: {x,y}, size?: {width,height} } persisted on the ui slice
    panelState: PropTypes.object,
    onClose: PropTypes.func,
    onPanelStateChange: PropTypes.func
};

const floatingMapStateToProps = (state) => {
    const pair = findDynamicDemPairs(state)[0] || null;
    return {
        pair,
        closed: !!state?.anuga?.ui?.demLegendPanelClosed,
        degraded: isDemRampDegraded(state, pair?.layer?.id),
        panelState: state?.anuga?.ui?.movablePanels?.[DEM_LEGEND_PANEL_ID]
    };
};

export const FloatingDemLegendPanel = connect(floatingMapStateToProps, {
    onClose: () => setDemLegendPanel(false),
    onPanelStateChange: setMovablePanelState
})(FloatingDemLegendPanelComponent);

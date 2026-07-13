/**
 * TASK-1861 (epic 1814 W4.4) — TerrainProfilePanel
 * TASK-2253 (epic 2249 W2) — Profile mode DELETED; the panel is Cross-section
 * only now (git history keeps the removed dual-y/velocity/momentum code).
 *
 * Cross-section tool. A dark-glass SimpleView side panel with a "Draw profile
 * line" button and a Plotly chart of the terrain + water-surface vs distance
 * along the drawn line.
 *
 * - "Draw profile line" dispatches startProfileDraw -> profileStartDrawEpic
 *   starts a MapStore LineString DrawSupport interaction.  On draw-complete
 *   profileEndDrawingEpic samples the checked terrains/scenarios via the
 *   profile endpoint and stores the series; this panel then renders it.
 * - Gated on a terrain/result being present: when no DEM is ready the draw
 *   button shows a "no terrain" hint instead of crashing (AC-5).  The epic
 *   ALSO guards server-side, so the panel never queries with no terrain.
 *
 * Chart: the MapStore PlotlyChart primitive (the same plotly the
 * LongitudinalProfile dock uses), with a transparent dark-glass layout
 * (transparent paper/plot, light text + grid).
 *
 * Mounted at the container level (like TerrainBboxPanel) so closing the Inputs
 * menu can't unmount it mid-draw; self-gates on profilePanelVisible.
 */
import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import PlotlyChart from '@mapstore/framework/components/charts/PlotlyChart';
import { PanelHeader } from '../../SimpleView/components/primitives';
import {
    setProfilePanelVisible,
    startProfileDraw
} from '../actionsAnuga';
import { hasDemReady } from '../epics/cursorElevationEpic';
import { trackEvent } from '@js/utils/analytics';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

// Dark-glass plotly layout: transparent surfaces so the SimpleView panel glass
// shows through, light text + grid lines.
const DARK_GLASS_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: 'rgba(255,255,255,0.85)', family: 'Montserrat, sans-serif', size: 11 },
    margin: { l: 48, r: 12, t: 8, b: 40 },
    showlegend: true,
    legend: { orientation: 'h', y: -0.25, font: { color: 'rgba(255,255,255,0.85)' } },
    xaxis: {
        gridcolor: 'rgba(255,255,255,0.18)',
        zerolinecolor: 'rgba(255,255,255,0.35)',
        tickcolor: 'rgba(255,255,255,0.6)'
    },
    yaxis: {
        gridcolor: 'rgba(255,255,255,0.18)',
        zerolinecolor: 'rgba(255,255,255,0.35)',
        tickcolor: 'rgba(255,255,255,0.6)'
    }
};

/**
 * W4 UAT (TASK-1861/1862) — frame the y-axis to the data's vertical relief.
 *
 * Plotly autorange (or a 'tozeroy' fill) drags the y-axis down to include 0,
 * which squashes high-elevation terrain (e.g. 800..985 m) into the top of the
 * chart with a huge empty 0..800 band — the relief becomes invisible. Compute
 * an explicit [min - pad, max + pad] range from the ACTUAL plotted y-values so
 * the chart frames the data tightly. The 'tozeroy' terrain fill still reads as
 * solid ground: it fills from the line down past the clamped viewport bottom.
 *
 * `dataTraces` is the already-built Plotly data array (each {y:[...]}). Returns
 * a [lo, hi] tuple, or null when there is no finite value to frame (caller then
 * falls back to autorange).
 *
 * `opts`:
 *   - `filter(trace)`: only traces for which this returns truthy contribute (so
 *     the elevation 'y' range and the results 'y2' range can be computed off the
 *     same data array). Default: all traces.
 *   - `zeroBased`: clamp the low edge to 0 (the results axis — 0 depth = dry IS
 *     meaningful, so the right axis should start at 0). Default: false (frame to
 *     relief, lo = min - pad, never reaching 0 for high terrain).
 */
export function computeYRange(dataTraces, opts) {
    if (!Array.isArray(dataTraces) || dataTraces.length === 0) return null;
    const filter = (opts && typeof opts.filter === 'function') ? opts.filter : () => true;
    const zeroBased = !!(opts && opts.zeroBased);
    let min = Infinity;
    let max = -Infinity;
    dataTraces.forEach((trace) => {
        if (!filter(trace)) return;
        const ys = (trace && Array.isArray(trace.y)) ? trace.y : [];
        ys.forEach((v) => {
            if (typeof v === 'number' && isFinite(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        });
    });
    if (!isFinite(min) || !isFinite(max)) return null;
    const span = max - min;
    // Pad ~5% of the span, with a small absolute floor so a flat profile (or a
    // single point) still gets a readable band rather than a zero-height axis.
    const pad = Math.max(0.05 * span, 0.5);
    const lo = zeroBased ? 0 : (min - pad);
    return [lo, max + pad];
}

// Cross-section colours: terrain is an earthy fill, the water body a translucent
// blue with its surface picked out as a line on top.
const TERRAIN_COLOR = '#b89968';
const TERRAIN_FILL = 'rgba(184, 153, 104, 0.45)';
const WATER_LINE = '#5bc0ff';
const WATER_FILL = 'rgba(91, 192, 255, 0.30)';

/**
 * TASK-1862 (W4.5) — combined terrain + water-surface cross-section.
 *
 * The hydraulic cross-section overlays the channel/terrain shape and the flood
 * water level along the transect. Two Plotly traces:
 *   1. Terrain — the DEM as a FILLED area (fill to zero) so the ground body
 *      reads as the channel cross-section (x = distance along the line).
 *   2. Water surface — stage = terrain + DEPTH per sample, filled DOWN TO the
 *      terrain trace ('tonexty') so the water column between bed and surface is
 *      shaded. A null/absent depth -> null stage (a gap, NOT a false water line)
 *      so dry reaches don't paint water.
 *
 * Uses the trace `role` (TASK-1862 getProfileTraces tag) to find the terrain
 * (role='dem') and depth (role='depth') rasters unambiguously — never name
 * sniffing. With no depth raster present it degrades to terrain-only (a plain
 * filled cross-section, still useful). With no DEM trace it returns [] (cannot
 * build a cross-section without the bed).
 *
 * Trace ORDER matters: terrain MUST precede the water trace because the water
 * fills 'tonexty' (down to the previous trace = terrain).
 */
export function buildCrossSectionData(samples, traces) {
    if (!Array.isArray(samples) || samples.length === 0 || !Array.isArray(traces)) return [];
    const demTrace = traces.find(t => t && t.role === 'dem');
    if (!demTrace) return [];
    const x = samples.map(s => s && s.distance_m);
    const demY = samples.map(s => {
        const v = s && s[demTrace.key];
        return (typeof v === 'number') ? v : null;
    });
    const data = [{
        x,
        y: demY,
        name: demTrace.label || demTrace.key,
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        fillcolor: TERRAIN_FILL,
        connectgaps: false,
        line: { color: TERRAIN_COLOR, width: 2 }
    }];
    // Water surface (stage = terrain + depth) — only when a depth raster sampled.
    const depthTrace = traces.find(t => t && t.role === 'depth');
    if (depthTrace) {
        const stageY = samples.map((s) => {
            const d = s && s[depthTrace.key];
            const bed = s && s[demTrace.key];
            // No depth (null/NaN) or no bed -> null stage (dry, a gap not water).
            if (typeof d !== 'number' || typeof bed !== 'number') return null;
            return bed + d;
        });
        // Only add the water trace if it has at least one real stage value.
        if (stageY.some(v => v !== null)) {
            data.push({
                x,
                y: stageY,
                name: depthTrace.waterLabel || 'Water surface',
                type: 'scatter',
                mode: 'lines',
                fill: 'tonexty',
                fillcolor: WATER_FILL,
                connectgaps: false,
                line: { color: WATER_LINE, width: 2 }
            });
        }
    }
    return data;
}

export class TerrainProfilePanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        drawingActive: PropTypes.bool,
        loading: PropTypes.bool,
        samples: PropTypes.array,
        traces: PropTypes.array,
        error: PropTypes.string,
        demReady: PropTypes.bool,
        setProfilePanelVisible: PropTypes.func,
        startProfileDraw: PropTypes.func
    };

    handleClose = () => {
        this.props.setProfilePanelVisible(false);
        trackEvent('button', 'click', 'anuga-profile-close');
    };

    handleDraw = () => {
        this.props.startProfileDraw();
        trackEvent('button', 'click', 'anuga-profile-draw-start');
    };

    // TASK-2253 — Cross-section is the ONLY mode now: build the combined
    // terrain + water-surface chart. The water-surface trace is a DERIVED
    // quantity (terrain+depth=stage), so it gets the localized "Water surface"
    // label (resolved off legacy context), NOT the depth raster's label.
    renderChart() {
        const messages = this.context && this.context.messages;
        const fallback = 'Water surface';
        const resolved = messages ? getMessageById(messages, 'hydrata.anuga.profileWaterSurface') : fallback;
        // getMessageById returns the msgId itself on a lookup miss.
        const waterLabel = (!resolved || resolved === 'hydrata.anuga.profileWaterSurface') ? fallback : resolved;
        const traces = (this.props.traces || []).map(t => (
            t && t.role === 'depth' ? { ...t, waterLabel } : t
        ));
        const data = buildCrossSectionData(this.props.samples, traces);
        if (data.length === 0) return null;
        // Terrain + stage are both elevation magnitude, framed to relief on a
        // SINGLE axis (W4.5).
        const range = computeYRange(data);
        const yaxis = range
            ? { ...DARK_GLASS_LAYOUT.yaxis, range, autorange: false }
            : DARK_GLASS_LAYOUT.yaxis;
        const layout = { ...DARK_GLASS_LAYOUT, yaxis };
        return (
            <div className="sv-profile-chart" data-testid="profile-chart" style={{ width: '100%', height: 240 }}>
                <PlotlyChart
                    data={data}
                    layout={layout}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                />
            </div>
        );
    }

    renderBody() {
        // AC-5: gate on a terrain/result. No DEM ready -> hint, no draw button.
        if (!this.props.demReady) {
            return (
                <div className="sv-profile-no-terrain" data-testid="profile-no-terrain">
                    <Message msgId="hydrata.anuga.profileNoTerrain" />
                </div>
            );
        }
        const hasSamples = Array.isArray(this.props.samples) && this.props.samples.length > 0;
        return (
            <React.Fragment>
                <div className="sv-profile-help" data-testid="profile-help" style={{ marginBottom: 10 }}>
                    <Message msgId="hydrata.anuga.crossSectionHelp" />
                </div>
                <div style={{ marginBottom: 10 }}>
                    <Button
                        data-testid="profile-draw-button"
                        bsSize="small"
                        bsStyle={this.props.drawingActive ? 'info' : 'success'}
                        onClick={this.handleDraw}
                    >
                        <Message msgId={hasSamples ? 'hydrata.anuga.profileRedrawButton' : 'hydrata.anuga.profileDrawButton'} />
                    </Button>
                    {this.props.drawingActive ?
                        <span style={{ marginLeft: 10 }} data-testid="profile-drawing-hint">
                            <Message msgId="hydrata.anuga.profileDrawing" />
                        </span> : null
                    }
                </div>
                {this.props.loading ?
                    <div className="sv-profile-loading" data-testid="profile-loading">
                        <Message msgId="hydrata.anuga.profileLoading" />
                    </div> : null
                }
                {this.props.error ?
                    <div
                        className="alert alert-danger sv-profile-error"
                        data-testid="profile-error"
                        style={{ padding: '6px 10px', marginBottom: 10 }}
                    >
                        <Message msgId={this.props.error} />
                    </div> : null
                }
                {!hasSamples && !this.props.loading && !this.props.error ?
                    <div className="sv-profile-empty" data-testid="profile-empty">
                        <Message msgId="hydrata.anuga.profileEmpty" />
                    </div> : null
                }
                {this.renderChart()}
            </React.Fragment>
        );
    }

    render() {
        if (!this.props.visible) return null;
        return (
            <div className={'simple-view-panel sv-profile-panel'} data-testid="profile-panel">
                <PanelHeader
                    extraClassName="h4 sv-legend-heading"
                    title={<Message msgId="hydrata.anuga.crossSectionPanelTitle" />}
                    onClose={this.handleClose}
                />
                <div style={{ padding: '10px' }}>
                    {this.renderBody()}
                </div>
                <div className={'simple-view-panel-footer'}>
                    <Button data-testid="profile-cancel" bsStyle="default" onClick={this.handleClose}>
                        <Message msgId="hydrata.anuga.profileCancel" />
                    </Button>
                </div>
            </div>
        );
    }
}

// Resolve the localized "Water surface" label off legacy context for the
// derived cross-section stage trace.
TerrainProfilePanelClass.contextTypes = {
    messages: PropTypes.object
};

const mapStateToProps = (state) => ({
    visible: !!state?.anuga?.ui?.profilePanelVisible,
    drawingActive: !!state?.anuga?.ui?.profileDrawingActive,
    loading: !!state?.anuga?.ui?.profileLoading,
    samples: state?.anuga?.ui?.profileSamples || null,
    traces: state?.anuga?.ui?.profileTraces || null,
    error: state?.anuga?.ui?.profileError || null,
    demReady: hasDemReady(state)
});

const mapDispatchToProps = (dispatch) => ({
    setProfilePanelVisible: (visible) => dispatch(setProfilePanelVisible(visible)),
    startProfileDraw: () => dispatch(startProfileDraw())
});

export const TerrainProfilePanel = connect(mapStateToProps, mapDispatchToProps)(TerrainProfilePanelClass);
export default TerrainProfilePanel;

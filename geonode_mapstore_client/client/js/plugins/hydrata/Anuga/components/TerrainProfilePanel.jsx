/**
 * TASK-1861 (epic 1814 W4.4) — TerrainProfilePanel
 *
 * Depth/result line-profile tool. A dark-glass SimpleView side panel with a
 * "Draw profile line" button and a Plotly multi-trace chart of value vs
 * distance along the drawn line.
 *
 * - "Draw profile line" dispatches startProfileDraw -> profileStartDrawEpic
 *   starts a MapStore LineString DrawSupport interaction.  On draw-complete
 *   profileEndDrawingEpic samples the active terrain DEM + the selected
 *   scenario's result rasters (depth/velocity) via the W4.3 endpoint and
 *   stores the series; this panel then renders it.
 * - Gated on a terrain/result being present: when no DEM is ready the draw
 *   button shows a "no terrain" hint instead of crashing (AC-5).  The epic
 *   ALSO guards server-side, so the panel never queries with no terrain.
 *
 * Chart: the MapStore PlotlyChart primitive (the same plotly the
 * LongitudinalProfile dock uses), with a transparent dark-glass layout
 * (transparent paper/plot, light text + grid, one trace per sampled raster).
 *
 * Mounted at the container level (like TerrainBboxPanel) so closing the Inputs
 * menu can't unmount it mid-draw; self-gates on profilePanelVisible.
 */
import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
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

const TRACE_COLORS = ['#9ad0f5', '#7fe3a0', '#ffce6b', '#ff9aa2', '#c9a0ff'];

/**
 * Map the stored samples ([{distance_m, dem|<layer>: value}]) + traces
 * ([{key,label}]) into Plotly data ([{x, y, name, type:'scatter', mode:'lines'}]).
 * One trace per present raster key; a key whose every value is null is dropped.
 */
export function buildPlotlyData(samples, traces) {
    if (!Array.isArray(samples) || samples.length === 0 || !Array.isArray(traces)) return [];
    const x = samples.map(s => s && s.distance_m);
    return traces.reduce((acc, trace, idx) => {
        const y = samples.map(s => {
            const v = s && s[trace.key];
            return (typeof v === 'number') ? v : null;
        });
        // Drop a trace that is entirely null (the run didn't produce that raster).
        if (y.every(v => v === null)) return acc;
        acc.push({
            x,
            y,
            name: trace.label || trace.key,
            type: 'scatter',
            mode: 'lines',
            connectgaps: false,
            line: { color: TRACE_COLORS[idx % TRACE_COLORS.length], width: 2 }
        });
        return acc;
    }, []);
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

    renderChart() {
        const data = buildPlotlyData(this.props.samples, this.props.traces);
        if (data.length === 0) return null;
        return (
            <div className="sv-profile-chart" data-testid="profile-chart" style={{ width: '100%', height: 240 }}>
                <PlotlyChart
                    data={data}
                    layout={DARK_GLASS_LAYOUT}
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
                    <Message msgId="hydrata.anuga.profileHelp" />
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
                    title={<Message msgId="hydrata.anuga.profilePanelTitle" />}
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

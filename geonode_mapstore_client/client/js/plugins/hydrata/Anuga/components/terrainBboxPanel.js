/**
 * TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox picker.
 *
 * Sibling to <UploaderPanel> for the GLO-30 ingest flow shipped in
 * TASK-929 (BE: POST /api/v2/anuga/projects/<pid>/terrain/create-from-bbox/).
 * Renders conditionally on state.anuga.ui.terrainBboxPanelVisible; uses the
 * same `.simple-view-panel.uploader-panel` chrome as simpleViewUploader.js
 * so visual styling matches the existing modal pattern (no new CSS).
 *
 * The bbox is drawn via MapStore's draw interaction (BBOX method, owner
 * 'terrain-bbox'); terrainBboxEpic listens for END_DRAWING on that owner,
 * validates 5x5° span, then dispatches setTerrainBbox or setTerrainBboxError.
 * That keeps the bbox lifecycle on the redux side rather than in component
 * state — same pattern the existing VectorDraw flow uses for ANUGA polygons.
 *
 * Why inline (not toast) error: project preference is inline validation so
 * the user sees the error without losing modal context; see
 * `feedback-no-em-dashes-in-copy` + the spec's "5x5 degree validation must
 * surface inline (not toast)".
 */
import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import {
    setVisibleTerrainBboxPanel,
    setTerrainBboxDrawing,
    setTerrainBbox,
    setTerrainBboxError,
    createTerrainFromBbox
} from "../actionsAnuga";
import { changeDrawingStatus } from '../../../../../MapStore2/web/client/actions/draw';
import { trackEvent } from "@js/utils/analytics";
import '../../SimpleView/simpleView.css';
import '../anuga.css';

const DEFAULT_TITLE_FALLBACK = 'Copernicus GLO-30 DEM';

export class TerrainBboxPanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        drawingActive: PropTypes.bool,
        bbox: PropTypes.array,
        error: PropTypes.string,
        setVisibleTerrainBboxPanel: PropTypes.func,
        setTerrainBboxDrawing: PropTypes.func,
        setTerrainBbox: PropTypes.func,
        setTerrainBboxError: PropTypes.func,
        createTerrainFromBbox: PropTypes.func,
        changeDrawingStatus: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {
            title: DEFAULT_TITLE_FALLBACK
        };
    }

    handleDrawClick = () => {
        // Clear any previous bbox + error so the next draw starts fresh.
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxError(null);
        this.props.setTerrainBboxDrawing(true);
        // BBOX method = MapStore's box-draw interaction. owner='terrain-bbox'
        // is the discriminator that terrainBboxEpic filters END_DRAWING on.
        this.props.changeDrawingStatus('start', 'BBOX', 'terrain-bbox', [], {});
        trackEvent('button', 'click', 'anuga-terrain-bbox-draw-start');
    };

    handleCreate = () => {
        const title = (this.state.title || '').trim() || DEFAULT_TITLE_FALLBACK;
        this.props.createTerrainFromBbox(title, this.props.bbox);
        // Reset transient state via panel close; reducer clears bbox + error.
        this.props.setVisibleTerrainBboxPanel(false);
        trackEvent('button', 'click', 'anuga-terrain-bbox-create');
    };

    handleCancel = () => {
        // Tell MapStore to drop the draw interaction in case it's mid-active.
        this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
        this.props.setVisibleTerrainBboxPanel(false);
        trackEvent('button', 'click', 'anuga-terrain-bbox-cancel');
    };

    renderBboxSummary() {
        if (this.props.bbox && this.props.bbox.length === 4) {
            const [minLon, minLat, maxLon, maxLat] = this.props.bbox;
            return (
                <span data-testid="terrain-bbox-summary">
                    {minLon.toFixed(4)}, {minLat.toFixed(4)} → {maxLon.toFixed(4)}, {maxLat.toFixed(4)}
                </span>
            );
        }
        if (this.props.drawingActive) {
            return <span data-testid="terrain-bbox-summary"><Message msgId="hydrata.anuga.terrainBboxDrawing" /></span>;
        }
        return <span data-testid="terrain-bbox-summary"><Message msgId="hydrata.anuga.terrainBboxNoBbox" /></span>;
    }

    render() {
        if (!this.props.visible) return null;
        const hasBbox = Array.isArray(this.props.bbox) && this.props.bbox.length === 4;
        const hasError = !!this.props.error;
        const hasTitle = !!(this.state.title || '').trim();
        const createDisabled = !hasBbox || hasError || !hasTitle;
        return (
            <div className={'simple-view-panel uploader-panel'} data-testid="terrain-bbox-panel">
                <div className={"row h4 legend-heading"}>
                    <Message msgId="hydrata.anuga.terrainBboxPanelTitle" />
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={this.handleCancel}
                    />
                </div>
                <div style={{padding: "10px"}}>
                    <div style={{marginBottom: "10px"}}>
                        <label htmlFor="terrain-bbox-title-input" style={{display: "block", marginBottom: "4px"}}>
                            <Message msgId="hydrata.anuga.terrainBboxTitleLabel" />
                        </label>
                        <input
                            id="terrain-bbox-title-input"
                            data-testid="terrain-bbox-title-input"
                            className={'data-title-input'}
                            type={'text'}
                            value={this.state.title}
                            onChange={(e) => this.setState({title: e.target.value})}
                            style={{width: "100%"}}
                        />
                    </div>
                    <div style={{marginBottom: "10px"}}>
                        <Button
                            data-testid="terrain-bbox-draw-button"
                            bsSize="small"
                            bsStyle={this.props.drawingActive ? "info" : "default"}
                            onClick={this.handleDrawClick}
                        >
                            <Message msgId="hydrata.anuga.terrainBboxDrawButton" />
                        </Button>
                        <span style={{marginLeft: "10px"}}>{this.renderBboxSummary()}</span>
                    </div>
                    {hasError ?
                        <div
                            className={"alert alert-danger"}
                            data-testid="terrain-bbox-error"
                            style={{padding: "6px 10px", marginBottom: "10px"}}
                        >
                            <Message msgId={this.props.error} />
                        </div> : null
                    }
                </div>
                <div className={"simple-view-panel-footer"}>
                    <Button
                        data-testid="terrain-bbox-create-submit"
                        bsStyle="success"
                        disabled={createDisabled}
                        onClick={this.handleCreate}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxCreate" />
                    </Button>
                    <Button
                        data-testid="terrain-bbox-cancel"
                        bsStyle="default"
                        onClick={this.handleCancel}
                        style={{marginLeft: "8px"}}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxCancel" />
                    </Button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    visible: !!state?.anuga?.ui?.terrainBboxPanelVisible,
    drawingActive: !!state?.anuga?.ui?.terrainBboxDrawingActive,
    bbox: state?.anuga?.ui?.terrainBbox || null,
    error: state?.anuga?.ui?.terrainBboxError || null
});

const mapDispatchToProps = (dispatch) => ({
    setVisibleTerrainBboxPanel: (visible) => dispatch(setVisibleTerrainBboxPanel(visible)),
    setTerrainBboxDrawing: (active) => dispatch(setTerrainBboxDrawing(active)),
    setTerrainBbox: (bbox) => dispatch(setTerrainBbox(bbox)),
    setTerrainBboxError: (error) => dispatch(setTerrainBboxError(error)),
    createTerrainFromBbox: (title, bbox) => dispatch(createTerrainFromBbox(title, bbox)),
    changeDrawingStatus: (status, method, owner, features, options) =>
        dispatch(changeDrawingStatus(status, method, owner, features, options))
});

export const TerrainBboxPanel = connect(mapStateToProps, mapDispatchToProps)(TerrainBboxPanelClass);

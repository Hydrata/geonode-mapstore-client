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
 * 'terrain-bbox'); terrainBboxEndDrawingEpic listens for END_DRAWING on that
 * owner, computes the geodesic area, stashes the bbox + area, then OPENS the
 * confirmation popup (terrainBboxConfirmVisible). The user reviews the
 * selection (area / estimated cells / estimated time) and either Confirms
 * (fires the create POST) or Re-selects (clears the bbox to draw again).
 *
 * The confirm popup reuses the same `.anuga-scenario-confirm-dialog` +
 * `.is-open` always-rendered pattern as anugaScenarioMenu so the visual
 * language stays consistent and Karma stays deterministic.
 *
 * Why inline (not toast) error for draw validation: project preference is
 * inline validation so the user sees the error without losing modal context.
 * BE create errors (post-Confirm) DO surface as a toast via
 * createTerrainFromBboxErrorEpic, since the panel is closed by then.
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
import {
    MAX_AREA_KM2,
    estimateCells,
    formatCells,
    formatTimeToReady,
    formatAreaKm2,
    bboxDimsKm
} from './terrainBboxEstimate';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

const DEFAULT_TITLE_FALLBACK = 'Copernicus GLO-30 DEM';

export class TerrainBboxPanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        drawingActive: PropTypes.bool,
        bbox: PropTypes.array,
        error: PropTypes.string,
        confirmVisible: PropTypes.bool,
        areaKm2: PropTypes.number,
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
        // Clear any previous bbox + error + open confirm so the next draw starts
        // fresh. Clearing the bbox (null) also dismisses the confirm popup.
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxError(null);
        this.props.setTerrainBboxDrawing(true);
        // BBOX method = MapStore's box-draw interaction. owner='terrain-bbox'
        // is the discriminator that terrainBboxEpic filters END_DRAWING on.
        this.props.changeDrawingStatus('start', 'BBOX', 'terrain-bbox', [], {});
        trackEvent('button', 'click', 'anuga-terrain-bbox-draw-start');
    };

    // Confirm in the popup -> fire the create POST and close the whole panel.
    handleConfirm = () => {
        const title = (this.state.title || '').trim() || DEFAULT_TITLE_FALLBACK;
        this.props.createTerrainFromBbox(title, this.props.bbox);
        // Reset transient state via panel close; reducer clears bbox + confirm.
        this.props.setVisibleTerrainBboxPanel(false);
        trackEvent('button', 'click', 'anuga-terrain-bbox-create');
    };

    // Re-select in the popup -> drop the bbox so the user can draw again. The
    // reducer clears the confirm popup when the bbox is set to null. We re-enter
    // draw mode immediately so the next box-draw is one click away.
    handleReselect = () => {
        this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxError(null);
        this.props.setTerrainBboxDrawing(true);
        this.props.changeDrawingStatus('start', 'BBOX', 'terrain-bbox', [], {});
        trackEvent('button', 'click', 'anuga-terrain-bbox-reselect');
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

    // Post-draw confirmation popup. Always rendered; `.is-open` toggled via CSS
    // so the test harness stays deterministic (same pattern as the scenarios
    // confirm dialog). Confirm is disabled when the geodesic area exceeds the
    // hard ceiling (MAX_AREA_KM2) — identical to the BE backstop.
    renderConfirmDialog() {
        const areaKm2 = this.props.areaKm2 || 0;
        const isOpen = !!this.props.confirmVisible;
        const tooLarge = areaKm2 > MAX_AREA_KM2;
        const dims = bboxDimsKm(this.props.bbox);
        const areaStr = formatAreaKm2(areaKm2);
        const cellsStr = formatCells(estimateCells(areaKm2));
        const timeStr = formatTimeToReady(areaKm2);
        const maxStr = MAX_AREA_KM2.toLocaleString('en-US');
        return (
            <div
                className={"anuga-scenario-confirm-dialog terrain-bbox-confirm-dialog" + (isOpen ? " is-open" : "")}
                data-testid="terrain-bbox-confirm-dialog"
                role="alertdialog"
                aria-label="Confirm terrain selection"
                aria-hidden={isOpen ? undefined : true}
            >
                <div className="terrain-bbox-confirm-body">
                    <div className="terrain-bbox-confirm-heading">
                        <Message msgId="hydrata.anuga.terrainBboxConfirmHeading" />
                    </div>
                    {tooLarge ? (
                        <div className="terrain-bbox-confirm-toolarge alert alert-danger" data-testid="terrain-bbox-confirm-toolarge">
                            <Message msgId="hydrata.anuga.terrainBboxConfirmTooLarge" msgParams={{max: maxStr}} />
                        </div>
                    ) : (
                        <React.Fragment>
                            <div className="terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-area">
                                <Message
                                    msgId="hydrata.anuga.terrainBboxConfirmArea"
                                    msgParams={{areaKm2: areaStr, widthKm: dims.widthKm, heightKm: dims.heightKm}}
                                />
                            </div>
                            <div className="terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-cells">
                                <Message msgId="hydrata.anuga.terrainBboxConfirmCells" msgParams={{cells: cellsStr}} />
                            </div>
                            <div className="terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-time">
                                <Message msgId="hydrata.anuga.terrainBboxConfirmTime" msgParams={{time: timeStr}} />
                            </div>
                            <div className="terrain-bbox-confirm-note">
                                <Message msgId="hydrata.anuga.terrainBboxConfirmNote" />
                            </div>
                        </React.Fragment>
                    )}
                </div>
                <div className="terrain-bbox-confirm-actions">
                    <button
                        type="button"
                        className="save-confirm-btn confirm"
                        data-testid="terrain-bbox-confirm-accept"
                        disabled={tooLarge}
                        onClick={this.handleConfirm}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxConfirmAccept" />
                    </button>
                    <button
                        type="button"
                        className="save-confirm-btn cancel"
                        data-testid="terrain-bbox-confirm-reselect"
                        onClick={this.handleReselect}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxConfirmReselect" />
                    </button>
                </div>
            </div>
        );
    }

    render() {
        if (!this.props.visible) return null;
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
                    <div className="terrain-bbox-hint">
                        <Message msgId="hydrata.anuga.terrainBboxHint" />
                    </div>
                    {this.props.error ?
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
                        data-testid="terrain-bbox-cancel"
                        bsStyle="default"
                        onClick={this.handleCancel}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxCancel" />
                    </Button>
                </div>
                {this.renderConfirmDialog()}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    visible: !!state?.anuga?.ui?.terrainBboxPanelVisible,
    drawingActive: !!state?.anuga?.ui?.terrainBboxDrawingActive,
    bbox: state?.anuga?.ui?.terrainBbox || null,
    error: state?.anuga?.ui?.terrainBboxError || null,
    confirmVisible: !!state?.anuga?.ui?.terrainBboxConfirmVisible,
    areaKm2: state?.anuga?.ui?.terrainBboxAreaKm2 || 0
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

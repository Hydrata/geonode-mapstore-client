/**
 * TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox picker.
 * TASK-1647 (W1.5) — Consolidated panel: 'Define import area' button (green,
 *   left-justified), 'bounding box' in full, area-limit guidance, inline
 *   review details after drawing (no separate confirm popup), italics removed.
 * TASK-1648 (W1.5) — Idempotent draw cleanup on all exit paths.
 *
 * The panel is a single panel: draw → review inline → confirm. The separate
 * .anuga-scenario-confirm-dialog popup (renderConfirmDialog) is dissolved;
 * after drawing the bbox the review details appear directly in the panel body.
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
// TASK-1648: close the Inputs menu when draw starts.
import { setAnugaInputMenu } from '../actions/uiActions';
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
// TASK-1764 (epic-1758 W1) — CHROME-ONLY re-skin of the panel header onto the
// chassis PanelHeader (cascade-safe close chip, replaces the .sv-legend-close
// span). TASK-1587 terrain behaviour/layout intent is unchanged: the close
// chip still fires handleCancel; the terrain-bbox-* testids + draw/review flow
// are untouched.
import {PanelHeader} from '../../SimpleView/components/primitives';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

const DEFAULT_TITLE_FALLBACK = 'Copernicus GLO-30 DEM';

// TASK-1648: single helper that fully resets draw state. Called on every exit
// path: import, cancel, and panel close.
const DRAW_RESET_STATUS = (dispatch) => {
    dispatch(changeDrawingStatus('clean', '', 'terrain-bbox', [], {}));
    dispatch(changeDrawingStatus('stop', '', 'terrain-bbox', [], {}));
};

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
        changeDrawingStatus: PropTypes.func,
        // TASK-1648: dispatch to close the Inputs menu when draw starts.
        setAnugaInputMenu: PropTypes.func,
    };

    constructor(props) {
        super(props);
        this.state = {
            title: DEFAULT_TITLE_FALLBACK
        };
    }

    // TASK-1648: if the panel becomes hidden while draw is active (e.g. navigated
    // away), ensure draw state is cleaned up so no orphaned draw tool remains.
    componentDidUpdate(prevProps) {
        if (prevProps.visible && !this.props.visible && this.props.drawingActive) {
            this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
            this.props.setTerrainBboxDrawing(false);
        }
    }

    // TASK-1647: 'Define import area' button click. TASK-1648: also closes Inputs menu.
    handleDrawClick = () => {
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxError(null);
        this.props.setTerrainBboxDrawing(true);
        this.props.changeDrawingStatus('start', 'BBOX', 'terrain-bbox', [], {});
        // TASK-1648: close Inputs menu to give drawing space; import panel stays open.
        if (this.props.setAnugaInputMenu) this.props.setAnugaInputMenu(false);
        trackEvent('button', 'click', 'anuga-terrain-bbox-draw-start');
    };

    // Confirm (inline) -> fire the create POST and close the panel.
    handleConfirm = () => {
        const title = (this.state.title || '').trim() || DEFAULT_TITLE_FALLBACK;
        this.props.createTerrainFromBbox(title, this.props.bbox);
        // TASK-1648: clean draw state on successful import.
        this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
        this.props.setVisibleTerrainBboxPanel(false);
        trackEvent('button', 'click', 'anuga-terrain-bbox-create');
    };

    // Re-select -> drop bbox, re-enter draw mode.
    handleReselect = () => {
        this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxError(null);
        this.props.setTerrainBboxDrawing(true);
        this.props.changeDrawingStatus('start', 'BBOX', 'terrain-bbox', [], {});
        trackEvent('button', 'click', 'anuga-terrain-bbox-reselect');
    };

    // TASK-1648: cancel/close both clear the bbox and end draw interaction.
    handleCancel = () => {
        this.props.changeDrawingStatus('clean', '', 'terrain-bbox', [], {});
        this.props.setTerrainBbox(null);
        this.props.setTerrainBboxDrawing(false);
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

    // TASK-1647: inline review section shown when bbox is drawn (replaces popup).
    renderInlineReview() {
        const hasBbox = this.props.bbox && this.props.bbox.length === 4;
        if (!hasBbox) return null;

        const areaKm2 = this.props.areaKm2 || 0;
        const tooLarge = areaKm2 > MAX_AREA_KM2;
        const dims = bboxDimsKm(this.props.bbox);
        const areaStr = formatAreaKm2(areaKm2);
        const cellsStr = formatCells(estimateCells(areaKm2));
        const timeStr = formatTimeToReady(areaKm2);
        const maxStr = MAX_AREA_KM2.toLocaleString('en-US');

        return (
            <div className="sv-terrain-bbox-inline-review" data-testid="terrain-bbox-inline-review">
                <div className="sv-terrain-bbox-confirm-heading">
                    <Message msgId="hydrata.anuga.terrainBboxConfirmHeading" />
                </div>
                {tooLarge ? (
                    <div className="sv-terrain-bbox-confirm-toolarge" data-testid="terrain-bbox-confirm-toolarge">
                        <Message msgId="hydrata.anuga.terrainBboxConfirmTooLarge" msgParams={{max: maxStr}} />
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="sv-terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-area">
                            <Message msgId="hydrata.anuga.terrainBboxConfirmArea" msgParams={{areaKm2: areaStr, widthKm: dims.widthKm, heightKm: dims.heightKm}} />
                        </div>
                        <div className="sv-terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-cells">
                            <Message msgId="hydrata.anuga.terrainBboxConfirmCells" msgParams={{cells: cellsStr}} />
                        </div>
                        <div className="sv-terrain-bbox-confirm-stat" data-testid="terrain-bbox-confirm-time">
                            <Message msgId="hydrata.anuga.terrainBboxConfirmTime" msgParams={{time: timeStr}} />
                        </div>
                    </React.Fragment>
                )}
                <div className="sv-terrain-bbox-inline-review-actions">
                    <Button
                        data-testid="terrain-bbox-confirm-accept"
                        bsStyle="success"
                        bsSize="small"
                        disabled={tooLarge}
                        onClick={this.handleConfirm}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxConfirmAccept" />
                    </Button>
                    <Button
                        data-testid="terrain-bbox-confirm-reselect"
                        bsStyle="default"
                        bsSize="small"
                        style={{marginLeft: 8}}
                        onClick={this.handleReselect}
                    >
                        <Message msgId="hydrata.anuga.terrainBboxConfirmReselect" />
                    </Button>
                </div>
            </div>
        );
    }

    render() {
        if (!this.props.visible) return null;
        return (
            <div className={'simple-view-panel sv-uploader-panel'} data-testid="terrain-bbox-panel">
                <PanelHeader
                    extraClassName="h4 sv-legend-heading"
                    title={<Message msgId="hydrata.anuga.terrainBboxPanelTitle" />}
                    onClose={this.handleCancel}
                />
                <div style={{padding: "10px"}}>
                    {/* Title input */}
                    <div style={{marginBottom: "10px"}}>
                        <label htmlFor="terrain-bbox-title-input" style={{display: "block", marginBottom: "4px"}}>
                            <Message msgId="hydrata.anuga.terrainBboxTitleLabel" />
                        </label>
                        <input
                            id="terrain-bbox-title-input"
                            data-testid="terrain-bbox-title-input"
                            className={'sv-data-title-input'}
                            type={'text'}
                            value={this.state.title}
                            onChange={(e) => this.setState({title: e.target.value})}
                            style={{width: "100%"}}
                        />
                    </div>

                    {/* TASK-1647: area guidance sentence */}
                    <div className="sv-terrain-bbox-area-guidance" data-testid="terrain-bbox-area-guidance" style={{marginBottom: "12px"}}>
                        <Message msgId="hydrata.anuga.terrainBboxAreaGuidance" />
                    </div>

                    {/* TASK-1647: 'Define import area' green button, left-justified */}
                    <div style={{marginBottom: "10px"}}>
                        <Button
                            data-testid="terrain-bbox-draw-button"
                            bsSize="small"
                            bsStyle={this.props.drawingActive ? "info" : "success"}
                            onClick={this.handleDrawClick}
                        >
                            <Message msgId="hydrata.anuga.terrainBboxDrawButton" />
                        </Button>
                        <span style={{marginLeft: "10px"}}>{this.renderBboxSummary()}</span>
                    </div>

                    {/* Error inline */}
                    {this.props.error ?
                        <div
                            className={"alert alert-danger sv-terrain-bbox-error"}
                            data-testid="terrain-bbox-error"
                            style={{padding: "6px 10px", marginBottom: "10px"}}
                        >
                            <Message msgId={this.props.error} />
                        </div> : null
                    }

                    {/* TASK-1647: inline review (replaces popup) */}
                    {this.renderInlineReview()}
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
                {/* TASK-1647: confirm popup REMOVED — review is now inline above */}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    visible: !!state?.anuga?.ui?.terrainBboxPanelVisible,
    drawingActive: !!state?.anuga?.ui?.terrainBboxDrawingActive,
    bbox: state?.anuga?.ui?.terrainBbox || null,
    error: state?.anuga?.ui?.terrainBboxError || null,
    // TASK-1647: confirmVisible no longer drives a popup; kept for any
    // consumer that checks state, but renderInlineReview uses bbox presence.
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
        dispatch(changeDrawingStatus(status, method, owner, features, options)),
    // TASK-1648: close the Inputs menu when 'Define import area' is clicked.
    setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
});

export const TerrainBboxPanel = connect(mapStateToProps, mapDispatchToProps)(TerrainBboxPanelClass);

import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
const {mapIdSelector} = require('../../../../../MapStore2/web/client/selectors/map');
import {Button, Glyphicon} from "react-bootstrap";
const Spinner = require('react-spinkit');
import {
    fetchSwammBmpTypes,
    fetchSwammAllBmps,
    fetchSwammBmpStatuses,
    showBmpForm,
    showSwammBmpChart,
    toggleBmpManager,
    makeBmpForm,
    setEditingBmpFeatureId,
    clearDrawingBmpLayerName,
    clearEditingBmpFeatureId,
    toggleBmpType,
    setBmpType,
    showSwammDataGrid,
    showSwammFeatureGrid,
    fetchSwammTargets
} from "../actionsSwamm";
import {SwammBmpForm} from "./swammBmpForm";
import {SwammDataGrid} from "./swammDataGrid";
import {SwammTargetForm} from "./swammTargetForm";
import {SwammBmpChart} from "./swammBmpChart";
import {MenuDatasetRow} from "../../ProjectManager/components/projectManagerMenuDatasetRow";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import {
    setMenuGroup,
    setOrgVisibility
} from "../../ProjectManager/actionsProjectManager";
import {bmpByUniqueNameSelector} from "../selectorsSwamm";
import {setLayer, saveChanges, toggleViewMode} from "../../../../../MapStore2/web/client/actions/featuregrid";
import {
    drawStopped
} from "../../../../../MapStore2/web/client/actions/draw";
import {query} from "../../../../../MapStore2/web/client/actions/wfsquery";

const buttonStyle = {
    position: "absolute",
    zIndex: 1021,
    top: 11,
    width: "85px",
    height: "60px",
    backgroundColor: "rgba(0,60,136,0.5)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    padding: "3px 5px",
    fontSize: "12px",
    lineHeight: "1.3",
    borderRadius: "4px",
    color: "white",
    textAlign: "center"
};

const panelStyle = {
    position: "absolute",
    zIndex: 1021,
    top: "85px",
    left: "20px",
    minWidth: "400px",
    maxWidth: "800px",
    maxHeight: "80vh",
    backgroundColor: "rgba(0,60,136,0.6)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    padding: "5px 10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "4px",
    color: "white",
    overflowY: "auto",
    overflowX: "hidden"
};

const bmpProgressButtonStyle = {
    top: "50px",
    left: "20px",
    minWidth: "135px",
    position: "absolute",
    opacity: "0.7",
    borderRadius: "4px"
};

const loadingBmpStyle = {
    position: "absolute",
    top: "200px",
    left: "50%",
    marginTop: "-100px",
    marginLeft: "-100px",
    opacity: "0.7",
    width: "200px",
    height: "100px",
    borderRadius: "4px",
    borderColor: "white",
    color: "white",
    background: "rgba(0,60,136,0.6)",
    textAlign: "center"
};

class SwammContainer extends React.Component {
    static propTypes = {
        fetchSwammBmpTypes: PropTypes.func,
        fetchSwammAllBmps: PropTypes.func,
        fetchSwammBmpStatuses: PropTypes.func,
        fetchSwammTargets: PropTypes.func,
        fetchingTargets: PropTypes.bool,
        statuses: PropTypes.array,
        targets: PropTypes.array,
        swammData: PropTypes.array,
        mapId: PropTypes.number,
        organisations: PropTypes.array,
        bmpUniqueNames: PropTypes.array,
        bmpTypes: PropTypes.array,
        allBmps: PropTypes.array,
        showOutlets: PropTypes.bool,
        showFootprints: PropTypes.bool,
        showWatersheds: PropTypes.bool,
        projectCode: PropTypes.string,
        layers: PropTypes.object,
        toggleLayer: PropTypes.func,
        showBmpForm: PropTypes.func,
        visibleBmpForm: PropTypes.bool,
        makeBmpForm: PropTypes.func,
        storedBmpForm: PropTypes.object,
        showMenuGroup: PropTypes.bool,
        setMenuGroup: PropTypes.func,
        saveChanges: PropTypes.func,
        clearDrawingBmpLayerName: PropTypes.func,
        clearEditingBmpFeatureId: PropTypes.func,
        drawingBmpLayerName: PropTypes.string,
        setEditingBmpFeatureId: PropTypes.func,
        editingBmpFeatureId: PropTypes.string,
        query: PropTypes.func,
        queryStore: PropTypes.func,
        toggleBmpType: PropTypes.func,
        setBmpType: PropTypes.func,
        setOrgVisibility: PropTypes.func,
        filters: PropTypes.object,
        fetchingBmps: PropTypes.bool,
        visibleBmpManager: PropTypes.bool,
        visibleSwammDataGrid: PropTypes.bool,
        showSwammFeatureGrid: PropTypes.func,
        showSwammDataGrid: PropTypes.func,
        visibleSwammBmpChart: PropTypes.bool,
        visibleTargetForm: PropTypes.bool,
        showSwammBmpChart: PropTypes.func,
        clickBmpManager: PropTypes.func,
        bmpByUniqueNameSelector: PropTypes.func,
        setLayer: PropTypes.func,
        toggleViewMode: PropTypes.func,
        drawStopped: PropTypes.func,
        bmpOutletLayer: PropTypes.object,
        bmpFootrprintLayer: PropTypes.object,
        bmpWatershedLayer: PropTypes.object,
        numberOfMenus: PropTypes.number,
        bmpDataLayer: PropTypes.object
    };

    static defaultProps = {};

    constructor(props) {
        super(props);
    }

    componentDidUpdate() {
        if (!this.props.mapId && !this.fetchingBmpTypes) {
            this.fetchingBmpTypes = false;
        }
        if (this.props.mapId && (this.props.bmpTypes?.length === 0) && !this.fetchingBmpTypes) {
            this.fetchingBmpTypes = true;
            this.props.fetchSwammBmpTypes(this.props.mapId);
        }
        if (this.props.mapId && (this.props.bmpTypes?.length > 0)) {
            this.fetchingBmpTypes = false;
        }
        if (!this.props.mapId && !this.fetchingBmps) {
            this.fetchingBmps = false;
        }
        if (this.props.mapId && (this.props.allBmps.length === 0) && !this.fetchingBmps) {
            this.fetchingBmps = true;
            this.props.fetchSwammAllBmps(this.props.mapId);
        }
        if (this.props.mapId && (this.props.allBmps.length > 0)) {
            this.fetchingBmps = false;
        }
        if (!this.props.mapId && !this.fetchingStatuses) {
            this.fetchingStatuses = false;
        }
        if (this.props.mapId && (this.props.statuses.length === 0) && !this.fetchingStatuses) {
            this.fetchingStatuses = true;
            this.props.fetchSwammBmpStatuses(this.props.mapId);
        }
        if (this.props.mapId && (this.props.statuses.length > 0)) {
            this.fetchingStatuses = false;
        }
        if (!this.props.mapId && !this.fetchingTargets) {
            this.fetchingTargets = false;
        }
        if (this.props.mapId && (this.props.targets.length === 0) && !this.fetchingTargets) {
            this.fetchingTargets = true;
            this.props.fetchSwammTargets(this.props.mapId);
        }
        if (this.props.mapId && (this.props.targets.length > 0)) {
            this.fetchingTargets = false;
        }
    }

    render() {
        return (
            <div id={"swamm-container"}>
                {this.props.allBmps?.length >= 0 ?
                    null :
                    <button style={loadingBmpStyle}>
                        <div style={{marginBottom: "10px"}}>Loading BMP data...</div>
                        <span><Spinner color="white" style={{display: "inline-block"}} spinnerName="circle" noFadeIn/></span>
                    </button>
                }
                {this.props.storedBmpForm && !this.props.visibleBmpForm && !this.props.drawingBmpLayerName && !this.props.editingBmpFeatureId ?
                    <React.Fragment>
                        <Button
                            style={{...bmpProgressButtonStyle, left: 20, top: 80}}
                            bsStyle={"success"}
                            onClick={() => this.props.showBmpForm()}
                        >
                            BMP in progress
                        </Button>
                        <button
                            key="swamm-bmp-creator-button"
                            // style={{...buttonStyle, left: (this.props.numberOfMenus + 5) * 100 + 20}}
                            style={{...buttonStyle, left: (this.props.numberOfMenus + 1) * 100 + 20}}
                            onClick={() => {
                                this.props.showBmpForm();
                                this.props.setMenuGroup(null);
                            }}
                        >
                            Create BMPs
                        </button>
                    </React.Fragment>
                    : this.props.drawingBmpLayerName || this.props.editingBmpFeatureId ?
                        <React.Fragment>
                            <Button
                                bsStyle="success"
                                style={{...bmpProgressButtonStyle, top: 80}}
                                onClick={() => {
                                    this.props.saveChanges();
                                    this.props.showBmpForm();
                                }}
                            >
                                Save Feature
                            </Button>
                            <Button
                                bsStyle="danger"
                                style={{...bmpProgressButtonStyle, left: 140 + 20, top: 80}}
                                onClick={() => {
                                    this.props.showBmpForm();
                                    this.props.setLayer(null);
                                    this.props.toggleViewMode();
                                    this.props.drawStopped();
                                    this.props.clearDrawingBmpLayerName();
                                    this.props.clearEditingBmpFeatureId();
                                }}
                            >
                                Cancel Feature
                            </Button>
                            <button
                                key="swamm-bmp-creator-button"
                                style={{...buttonStyle, left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                onClick={() => {
                                    this.props.saveChanges();
                                    this.props.showBmpForm();
                                    this.props.setMenuGroup(null);
                                }}
                            >
                                Create BMPs
                            </button>
                        </React.Fragment>
                        : this.props.visibleBmpForm ?
                            <button
                                key="swamm-bmp-creator-button"
                                style={{...buttonStyle, left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                disabled
                            >
                                Create BMPs
                            </button>
                            :
                            <button
                                key="swamm-bmp-creator-button"
                                style={{...buttonStyle, left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                onClick={() => {
                                    this.props.makeBmpForm();
                                    this.props.setMenuGroup(null);
                                }}
                            >
                                Create BMPs
                            </button>
                }
                <button
                    key="swamm-bmp-data-grid-button"
                    style={{...buttonStyle, left: (this.props.numberOfMenus + 2) * 100 + 20}}
                    onClick={() => {
                        this.props.showSwammFeatureGrid(this.props.bmpOutletLayer);
                        this.props.setMenuGroup(null);
                    }}
                >
                    Summary Table
                </button>
                {this.props.targets?.length ?
                    <button
                        key="swamm-bmp-chart-button"
                        style={{...buttonStyle, left: (this.props.numberOfMenus + 3) * 100 + 20}}
                        onClick={() => {
                            this.props.showSwammBmpChart();
                            this.props.setMenuGroup(null);
                        }}
                    >
                        Dashboard
                    </button> :
                    <button
                        key="swamm-bmp-chart-button"
                        style={{...buttonStyle, left: (this.props.numberOfMenus + 3) * 100 + 20}}
                        className={'disabled'}
                    >
                        <span><Spinner color="white" style={{display: "inline-block"}} spinnerName="circle" noFadeIn/></span>
                    </button>
                }
                {this.props.visibleBmpManager ?
                    <div style={{...panelStyle}} id="swamm-bmp-manager">
                        <table className="table check1" style={{tableLayout: "fixed", marginBottom: "0"}}>
                            <tbody>
                                <tr key="r1">
                                    <td key="d2">
                                        <MenuDatasetRow layer={this.props.bmpDataLayer}/>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    : null
                }
                {this.props.visibleTargetForm ?
                    <SwammTargetForm/>
                    : null
                }
                {this.props.visibleBmpForm ?
                    <SwammBmpForm setBmpTypesVisibility={this.setBmpTypesVisibility}/>
                    : null
                }
                {this.props.visibleSwammDataGrid ?
                    <div>
                        <SwammDataGrid/>
                        SwammDataGrid
                    </div>
                    : null
                }
                {this.props.visibleSwammBmpChart ?
                    <div>
                        <SwammBmpChart/>
                        SwammBmpChart
                    </div>
                    : null
                }
            </div>
        );
    }

    setBmpTypesVisibility = (bmpTypeName, visible) => {};
}

const mapStateToProps = (state) => {
    return {
        mapId: mapIdSelector(state),
        organisations: state?.projectManager?.data?.organisations,
        bmpUniqueNames: bmpByUniqueNameSelector(state),
        bmpTypes: state?.swamm?.bmpTypes,
        allBmps: state?.swamm?.allBmps,
        statuses: state?.swamm?.statuses,
        targets: state?.swamm?.targets,
        fetchingTargets: state?.swamm?.fetchingTargets,
        showOutlets: state?.swamm?.showOutlets,
        showFootprints: state?.swamm?.showFootprints,
        showWatersheds: state?.swamm?.showWatersheds,
        projectCode: state?.projectManager?.data?.code,
        layers: state?.layers,
        bmpOutletLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.projectManager?.data?.code + "_bmp_outlet")[0],
        // bmpFootprintLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.projectManager?.data?.code + "_bmp_footprint")[0],
        // bmpWatershedLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.projectManager?.data?.code + "_bmp_watershed")[0],
        visibleBmpForm: state?.swamm?.visibleBmpForm,
        storedBmpForm: state?.swamm?.storedBmpForm,
        drawingBmpLayerName: state?.swamm?.drawingBmpLayerName,
        editingBmpFeatureId: state?.swamm?.editingBmpFeatureId,
        visibleBmpManager: state?.swamm?.visibleBmpManager,
        visibleSwammDataGrid: state?.swamm?.visibleSwammDataGrid,
        visibleSwammBmpChart: state?.swamm?.visibleSwammBmpChart,
        visibleTargetForm: state?.swamm?.visibleTargetForm,
        queryStore: state?.query,
        numberOfMenus: state?.projectManager?.data?.map_store_menu_groups?.length,
        filters: {
            showOutlets: state.swamm?.showOutlets,
            showFootprints: state.swamm?.showFootprints,
            showWatersheds: state.swamm?.showWatersheds
        }
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        fetchSwammBmpTypes: (mapId) => dispatch(fetchSwammBmpTypes(mapId)),
        fetchSwammAllBmps: (mapId) => dispatch(fetchSwammAllBmps(mapId)),
        fetchSwammBmpStatuses: (mapId) => dispatch(fetchSwammBmpStatuses(mapId)),
        fetchSwammTargets: (mapId) => dispatch(fetchSwammTargets(mapId)),
        toggleLayer: (layer, isVisible) => dispatch(changeLayerProperties(layer, {visibility: isVisible})),
        // toggleOutlets: () => dispatch(toggleOutlets()),
        // toggleFootprints: () => dispatch(toggleFootprints()),
        // toggleWatersheds: () => dispatch(toggleWatersheds()),
        showBmpForm: () => dispatch(showBmpForm()),
        setLayer: (layerName) => dispatch(setLayer(layerName)),
        setEditingBmpFeatureId: (featureId) => dispatch(setEditingBmpFeatureId(featureId)),
        showSwammDataGrid: () => dispatch(showSwammDataGrid()),
        showSwammFeatureGrid: (layer) => dispatch(showSwammFeatureGrid(layer)),
        showSwammBmpChart: () => dispatch(showSwammBmpChart()),
        clickBmpManager: () => {
            dispatch(toggleBmpManager());
            dispatch(setMenuGroup(null));
        },
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup)),
        makeBmpForm: (bmpTypeId) => dispatch(makeBmpForm(bmpTypeId)),
        saveChanges: () => dispatch(saveChanges()),
        clearDrawingBmpLayerName: () => dispatch(clearDrawingBmpLayerName()),
        clearEditingBmpFeatureId: () => dispatch(clearEditingBmpFeatureId()),
        query: (url, filterObj, queryOptions, reason) => dispatch(query(url, filterObj, queryOptions, reason)),
        toggleBmpType: (bmpType) => dispatch(toggleBmpType(bmpType)),
        setBmpType: (bmpType, isVisible) => dispatch(setBmpType(bmpType, isVisible)),
        setOrgVisibility: (org, isVisible) => dispatch(setOrgVisibility(org, isVisible)),
        toggleViewMode: () => dispatch(toggleViewMode()),
        drawStopped: () => dispatch(drawStopped())
    };
};


export default connect(mapStateToProps, mapDispatchToProps)(SwammContainer);

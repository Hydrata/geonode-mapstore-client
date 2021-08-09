import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
const Spinner = require('react-spinkit');
import {
    fetchSwammBmpTypes,
    fetchProjectManagerConfig,
    fetchGroupProfiles,
    fetchSwammBmpStatuses,
    showBmpForm,
    showSwammBmpChart,
    setMenuGroup,
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
import {bmpByUniqueNameSelector} from "../selectorsSwamm";
import {setLayer, saveChanges, toggleViewMode} from "../../../../../MapStore2/web/client/actions/featuregrid";
import {drawStopped} from "../../../../../MapStore2/web/client/actions/draw";
import {query} from "../../../../../MapStore2/web/client/actions/wfsquery";

import "../../SimpleView/simpleView.css";
import "../swamm.css";


class SwammContainer extends React.Component {
    static propTypes = {
        fetchSwammBmpTypes: PropTypes.func,
        fetchSwammBmpStatuses: PropTypes.func,
        fetchSwammTargets: PropTypes.func,
        fetchProjectManagerConfig: PropTypes.func,
        fetchGroupProfiles: PropTypes.func,
        fetchingGroupProfiles: PropTypes.bool,
        fetchingTargets: PropTypes.bool,
        statuses: PropTypes.array,
        targets: PropTypes.array,
        swammData: PropTypes.array,
        mapId: PropTypes.number,
        bmpUniqueNames: PropTypes.array,
        bmpTypes: PropTypes.array,
        groupProfiles: PropTypes.array,
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
        toggleBmpType: PropTypes.func,
        setBmpType: PropTypes.func,
        filters: PropTypes.object,
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
        hasPmData: PropTypes.object,
        bmpDataLayer: PropTypes.object
    };

    static defaultProps = {};

    constructor(props) {
        super(props);
    }

    componentDidUpdate() {
        if (!this.props.mapId && !this.fetching) {
            this.fetching = false;
        }
        if (this.props.mapId && !this.props.hasPmData && !this.fetching) {
            this.props.fetchProjectManagerConfig(this.props.mapId);
            this.fetching = true;
        }
        if (this.props.mapId && this.props.hasPmData) {
            this.fetching = false;
        }
        if (this.props.hasPmData) {
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
            if (!this.props.mapId && !this.fetchingGroupProfiles) {
                this.fetchingGroupProfiles = false;
            }
            if (this.props.mapId && (this.props.groupProfiles?.length === 0) && !this.fetchingGroupProfiles) {
                this.fetchingGroupProfiles = true;
                this.props.fetchGroupProfiles();
            }
            if (this.props.mapId && (this.props.groupProfiles?.length > 0)) {
                this.fetchingGroupProfiles = false;
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
    }

    render() {
        return (
            <div id={"swamm-container"}>
                {this.props.hasPmData ?
                    <React.Fragment>
                        {this.props.storedBmpForm && !this.props.visibleBmpForm && !this.props.drawingBmpLayerName && !this.props.editingBmpFeatureId ?
                            <React.Fragment>
                                <Button
                                    className={'simple-view-menu-button bmp-progress-button-success'}
                                    style={{left: 20}}
                                    bsStyle={"success"}
                                    onClick={() => this.props.showBmpForm()}
                                >
                                    BMP in progress
                                </Button>
                                <button
                                    key="swamm-bmp-creator-button"
                                    className={'simple-view-menu-button'}
                                    style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
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
                                        className={'simple-view-menu-button bmp-progress-button'}
                                        style={{left: 30, top: 80, width: 120, backgroundColor: "darkgreen"}}
                                        onClick={() => {
                                            this.props.saveChanges();
                                            this.props.showBmpForm();
                                        }}
                                    >
                                        Save Feature
                                    </Button>
                                    <Button
                                        bsStyle="danger"
                                        className={'simple-view-menu-button bmp-progress-button'}
                                        style={{left: 160, top: 80, width: 120, backgroundColor: "darkred"}}
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
                                        className={'simple-view-menu-button'}
                                        style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
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
                                        className={'simple-view-menu-button'}
                                        style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                        disabled
                                    >
                                        Create BMPs
                                    </button>
                                    :
                                    <button
                                        key="swamm-bmp-creator-button"
                                        className={'simple-view-menu-button'}
                                        style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
                                        onClick={() => {
                                            this.props.makeBmpForm();
                                            this.props.setMenuGroup(null);
                                        }}
                                    >
                                        Create BMPs
                                    </button>
                        }
                        {this.props.targets?.length ?
                            <button
                                key="swamm-bmp-chart-button"
                                className={'simple-view-menu-button'}
                                style={{left: (this.props.numberOfMenus + 2) * 100 + 20}}
                                onClick={() => {
                                    this.props.showSwammBmpChart();
                                    this.props.setMenuGroup(null);
                                }}
                            >
                                Dashboard
                            </button> :
                            <button
                                key="swamm-bmp-chart-button"
                                className={'simple-view-menu-button disabled'}
                                style={{left: (this.props.numberOfMenus + 2) * 100 + 20}}
                            >
                                <span><Spinner color="white" style={{display: "inline-block"}} spinnerName="circle" noFadeIn/></span>
                            </button>
                        }
                        {this.props.visibleBmpManager ?
                            <div className={'simple-view-panel'} id="swamm-bmp-manager">
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
                    </React.Fragment>
                    : null}
            </div>
        );
    }

    setBmpTypesVisibility = (bmpTypeName, visible) => {};
}

const mapStateToProps = (state) => {
    console.log('state for Swamm:', state);
    return {
        mapId: state?.map?.present?.info?.id,
        hasPmData: state?.swamm?.data,
        bmpUniqueNames: bmpByUniqueNameSelector(state),
        bmpTypes: state?.swamm?.bmpTypes,
        groupProfiles: state?.swamm.groupProfiles,
        allBmps: state?.swamm?.allBmps,
        statuses: state?.swamm?.statuses,
        targets: state?.swamm?.targets,
        fetchingTargets: state?.swamm?.fetchingTargets,
        showOutlets: state?.swamm?.showOutlets,
        showFootprints: state?.swamm?.showFootprints,
        showWatersheds: state?.swamm?.showWatersheds,
        projectCode: state?.swamm?.data?.code,
        layers: state?.layers,
        bmpOutletLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_outlet")[0],
        // bmpFootprintLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_footprint")[0],
        // bmpWatershedLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_watershed")[0],
        visibleBmpForm: state?.swamm?.visibleBmpForm,
        storedBmpForm: state?.swamm?.storedBmpForm,
        drawingBmpLayerName: state?.swamm?.drawingBmpLayerName,
        editingBmpFeatureId: state?.swamm?.editingBmpFeatureId,
        visibleBmpManager: state?.swamm?.visibleBmpManager,
        visibleSwammDataGrid: state?.swamm?.visibleSwammDataGrid,
        visibleSwammBmpChart: state?.swamm?.visibleSwammBmpChart,
        visibleTargetForm: state?.swamm?.visibleTargetForm,
        numberOfMenus: state?.layers?.groups.length,
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
        fetchProjectManagerConfig: fetchProjectManagerConfig(dispatch),
        fetchGroupProfiles: () => dispatch(fetchGroupProfiles()),
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
        toggleViewMode: () => dispatch(toggleViewMode()),
        drawStopped: () => dispatch(drawStopped())
    };
};


export default connect(mapStateToProps, mapDispatchToProps)(SwammContainer);

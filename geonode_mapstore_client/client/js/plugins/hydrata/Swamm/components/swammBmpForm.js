import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Table, ControlLabel, FormControl, FormGroup, Form, Col} from "react-bootstrap";
import {
    hideBmpForm,
    showBmpForm,
    clearBmpForm,
    submitBmpForm,
    makeDefaultsBmpForm,
    makeExistingBmpForm,
    updateBmpForm,
    setDrawingBmpLayerName,
    setEditingBmpFeatureId,
    clearEditingBmpFeatureId,
    deleteBmp,
    setMenuGroup
} from "../actionsSwamm";
import "./swammBmpFormCreate";
import "./swammBmpFormEdit";
import {
    setLayer,
    toggleEditMode,
    createNewFeatures,
    startDrawingFeature,
    saveChanges
} from "../../../../../MapStore2/web/client/actions/featuregrid";
import { purgeMapInfoResults } from "../../../../../MapStore2/web/client/actions/mapInfo";
import {featureTypeSelected, createQuery, query} from "../../../../../MapStore2/web/client/actions/wfsquery";
import "../../ProjectManager/projectManager.css";
import {isInt} from "../../Utils/utils";
import {bmpByUniqueNameSelector} from "../selectorsSwamm";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";

class SwammBmpFormClass extends React.Component {
    static propTypes = {
        bmpTypeId: PropTypes.number,
        bmpTypes: PropTypes.array,
        statuses: PropTypes.array,
        setMenuGroup: PropTypes.func,
        creatingNewBmp: PropTypes.bool,
        updatingBmp: PropTypes.object,
        hideBmpForm: PropTypes.func,
        showBmpForm: PropTypes.func,
        submitBmpForm: PropTypes.func,
        showSubmitBmpFormSuccess: PropTypes.bool,
        showSubmitBmpFormError: PropTypes.bool,
        storeBmpForm: PropTypes.func,
        thisBmpType: PropTypes.object,
        newBmpForm: PropTypes.object,
        storedBmpForm: PropTypes.object,
        clearBmpForm: PropTypes.func,
        groupProfiles: PropTypes.array,
        makeDefaultsBmpForm: PropTypes.func,
        makeExistingBmpForm: PropTypes.func,
        updateBmpForm: PropTypes.func,
        setLayer: PropTypes.func,
        featureTypeSelected: PropTypes.func,
        toggleEditMode: PropTypes.func,
        createNewFeatures: PropTypes.func,
        createQuery: PropTypes.func,
        startDrawingFeature: PropTypes.func,
        saveChanges: PropTypes.func,
        setDrawingBmpLayerName: PropTypes.func,
        setEditingBmpFeatureId: PropTypes.func,
        clearEditingBmpFeatureId: PropTypes.func,
        layers: PropTypes.object,
        query: PropTypes.func,
        mapId: PropTypes.number,
        purgeMapInfoResults: PropTypes.func,
        bmpUniqueNames: PropTypes.array,
        setBmpTypesVisibility: PropTypes.func,
        setHighlightFeaturesPath: PropTypes.func,
        projectData: PropTypes.object,
        toggleLayer: PropTypes.func,
        bmpOutletLayer: PropTypes.object,
        bmpFootprintLayer: PropTypes.object,
        bmpWatershedLayer: PropTypes.object,
        deleteBmp: PropTypes.func
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.handleBmpChange = this.handleBmpChange.bind(this);
        this.handlegroupProfileChange = this.handlegroupProfileChange.bind(this);
        this.state = {};
    }

    componentDidMount() {
        if (Object.keys(this.props.storedBmpForm).length === 0 && !this.props.creatingNewBmp) {
            this.props.purgeMapInfoResults();
            this.props.setMenuGroup(null);
        }
        this.props.toggleLayer(this.props.bmpOutletLayer?.id, true);
        this.props.toggleLayer(this.props.bmpFootprintLayer?.id, true);
        this.props.toggleLayer(this.props.bmpWatershedLayer?.id, true);
    }

    componentDidUpdate() {
        if (Object.keys(this.props.storedBmpForm).length === 0 && !this.props.creatingNewBmp && this.props.updatingBmp) {
            this.props.makeExistingBmpForm(this.props.updatingBmp);
        }
    }

    render() {
        return (
            <React.Fragment>
                <Modal
                    show
                    onHide={() => this.props.hideBmpForm()}
                    style={{
                        marginTop: "100px",
                        fontSize: "small"
                    }}
                    dialogClassName="swamm-big-modal"
                    backdrop={false}
                    enforceFocus={false}
                    scrollable="true"
                >
                    <Modal.Header>
                        <Modal.Title>
                            {this.props.storedBmpForm.id ?
                                "Edit BMP: " + this.props.storedBmpForm?.type_data?.name + " " + this.props.storedBmpForm.id :
                                "Create a new BMP"
                            }
                        </Modal.Title>
                    </Modal.Header>
                    {this.props.storedBmpForm.id ?
                        <swammBmpFormEdit/> :
                        <swammBmpFormCreate/>
                    }
                    <Modal.Footer>
                        <Button
                            bsStyle="danger"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "320px", minWidth: "80px"}}
                            onClick={() => {
                                if (window.confirm('This action can not be undone. Are you sure?')) {
                                    this.props.deleteBmp(this.props.mapId, this.props.storedBmpForm?.id);
                                }
                            }}>
                            Delete
                        </Button>
                        <Button
                            bsStyle="danger"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "220px", minWidth: "80px"}}
                            onClick={() => this.props.clearBmpForm()}>
                            Close
                        </Button>
                        <Button
                            bsStyle="info"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "120px", minWidth: "80px"}}
                            onClick={() => this.props.hideBmpForm()}>
                            View Map
                        </Button>
                        <Button
                            bsStyle="success"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "20px", minWidth: "80px"}}
                            onClick={() => {
                                this.props.submitBmpForm(this.props.storedBmpForm, this.props.mapId);
                            }}>
                            Update
                        </Button>
                    </Modal.Footer>
                </Modal>
            </React.Fragment>
        );
    }
    validateRatio(ratioName) {
        const ratio = this.props.storedBmpForm[ratioName];
        if (ratio < 1 && ratio > 0) return 'success';
        if (ratio === 1) return 'warning';
        if (ratio > 1 || ratio < 0) return 'error';
        return null;
    }
    validateCost(costName) {
        const cost = this.props.storedBmpForm[costName];
        if (cost >= 0) return 'success';
        if (cost < 0) return 'error';
        return null;
    }
    validateFid(fid) {
        const id = this.props.storedBmpForm[fid];
        if (id >= 0 && isInt(id)) return 'success';
        if (id < 0) return 'error';
        return null;
    }
    handleChange(event) {
        const fieldName = event.target.name;
        let fieldValue = event.target.value;
        let kv = {[fieldName]: fieldValue};
        if (event.target.type === 'number')  {
            kv = {[fieldName]: parseFloat(fieldValue)};
        }
        this.props.updateBmpForm(kv);
    }
    handlegroupProfileChange(event) {
        const fieldName = event.target.name;
        let fieldValue = event.target.value;
        let kv = {[fieldName]: JSON.parse(fieldValue)};
        this.props.updateBmpForm(kv);
    }
    handleBmpChange(event) {
        // const fieldName = event.target.name;
        let fieldValue = event.target.value;
        // let kv = {[fieldName]: fieldValue};
        // this.props.updateBmpForm(kv);
        const selectedBmpType = this.props.bmpTypes.filter(
            bmpType => bmpType.name === fieldValue
        )[0];
        this.props.makeDefaultsBmpForm(selectedBmpType);
        // this.props.setBmpTypesVisibility(fieldValue, true);
    }
    drawBmpStep1(layerName, featureId) {
        console.log('drawBmpStep1 layerName', layerName);
        console.log('drawBmpStep1 featureId', featureId);
        this.props.setDrawingBmpLayerName(layerName);
        featureId ? this.props.setEditingBmpFeatureId(featureId) : this.props.clearEditingBmpFeatureId();
        const targetLayer = this.props.layers.flat.filter(layer => layer?.name.includes(layerName))[0];
        console.log('drawBmpStep1 targetLayer', targetLayer);
        this.props.setLayer(targetLayer?.id);
        this.props.featureTypeSelected('http://localhost:8080/geoserver/wfs', targetLayer?.name);
        console.log('drawBmpStep1 finished');
    }
}

const mapStateToProps = (state) => {
    return {
        mapId: state?.swamm?.data?.base_map,
        projectData: state?.swamm?.data,
        bmpUniqueNames: bmpByUniqueNameSelector(state).map(bmpType => bmpType.name),
        bmpTypes: state?.swamm?.bmpTypes,
        statuses: state?.swamm?.statuses,
        thisBmpType: state?.swamm?.bmpTypes.filter((bmpType) => bmpType.id === state?.swamm?.BmpFormBmpTypeId)[0],
        storedBmpForm: state?.swamm?.storedBmpForm || {},
        bmpOutletLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_outlet")[0],
        bmpFootprintLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_footprint")[0],
        bmpWatershedLayer: state?.layers?.flat?.filter((layer) => layer.name === state?.swamm?.data?.code + "_bmp_watershed")[0],
        creatingNewBmp: state?.swamm?.creatingNewBmp,
        updatingBmp: state?.swamm?.updatingBmp,
        groupProfiles: state?.swamm?.groupProfiles,
        layers: state?.layers,
        query: state?.query
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup)),
        hideBmpForm: () => dispatch(hideBmpForm()),
        showBmpForm: () => dispatch(showBmpForm()),
        submitBmpForm: (newBmp, mapId) => dispatch(submitBmpForm(newBmp, mapId)),
        updateBmpForm: (kv) => dispatch(updateBmpForm(kv)),
        clearBmpForm: () => dispatch(clearBmpForm()),
        deleteBmp: (mapId, bmpId) => dispatch(deleteBmp(mapId, bmpId)),
        makeDefaultsBmpForm: (bmpType) => dispatch(makeDefaultsBmpForm(bmpType)),
        setLayer: (id) => dispatch(setLayer(id)),
        setDrawingBmpLayerName: (layerName) => dispatch(setDrawingBmpLayerName(layerName)),
        setEditingBmpFeatureId: (featureId) => dispatch(setEditingBmpFeatureId(featureId)),
        clearEditingBmpFeatureId: () => dispatch(clearEditingBmpFeatureId()),
        featureTypeSelected: (url, typeName) => dispatch(featureTypeSelected(url, typeName)),
        toggleEditMode: () => dispatch(toggleEditMode()),
        toggleLayer: (layerId, isVisible) => dispatch(changeLayerProperties(layerId, {visibility: isVisible})),
        createNewFeatures: (features) => dispatch(createNewFeatures(features)),
        createQuery: (searchUrl, filterObj) => dispatch(createQuery(searchUrl, filterObj)),
        query: (url, filterObj, queryOptions, reason) => dispatch(query(url, filterObj, queryOptions, reason)),
        startDrawingFeature: () => dispatch(startDrawingFeature()),
        saveChanges: () => dispatch(saveChanges()),
        purgeMapInfoResults: () => dispatch(purgeMapInfoResults()),
        makeExistingBmpForm: (bmp) => dispatch(makeExistingBmpForm(bmp))
    };
};

const SwammBmpForm = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFormClass);


export {
    SwammBmpForm
};

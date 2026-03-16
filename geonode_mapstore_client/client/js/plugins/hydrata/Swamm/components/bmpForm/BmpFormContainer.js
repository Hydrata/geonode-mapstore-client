import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {
    hideBmpForm,
    clearBmpForm,
    submitBmpForm,
    makeDefaultsBmpForm,
    makeExistingBmpForm,
    setExpandedBmpTypeGroupName,
    updateBmpForm,
    hideLoadingBmp,
    showLoadingBmp,
    setChangingBmpType,
    setComplexBmpForm,
    deleteBmp,
    setMenuGroup,
    downloadBmpReport
} from "../../actionsSwamm";
import {setOpenMenuGroupId} from "../../../SimpleView/actionsSimpleView";
import { purgeMapInfoResults } from "../../../../../../MapStore2/web/client/actions/mapInfo";
import { startVectorDraw } from "../../../VectorDraw/actionsVectorDraw";
import {
    bmpByUniqueNameSelector,
    bmpOutletLayerSelector,
    bmpFootprintLayerSelector,
    bmpWatershedLayerSelector
} from "../../selectorsSwamm";
import {changeLayerProperties, refreshLayerVersion} from "../../../../../../MapStore2/web/client/actions/layers";
import {BmpGeometryControls} from "./BmpGeometryControls";
import {BmpMetadataFields} from "./BmpMetadataFields";
import {BmpOverrideFields} from "./BmpOverrideFields";
import {BmpTypeSelector} from "./BmpTypeSelector";
import {BmpReductionDisplay} from "./BmpReductionDisplay";
import {BmpActionButtons} from "./BmpActionButtons";

class SwammBmpFormClass extends React.Component {
    static propTypes = {
        bmpTypeId: PropTypes.number,
        bmpTypes: PropTypes.array,
        bmpTypeGroups: PropTypes.array,
        statuses: PropTypes.array,
        setMenuGroup: PropTypes.func,
        priorities: PropTypes.array,
        setOpenMenuGroupId: PropTypes.func,
        creatingNewBmp: PropTypes.bool,
        updatingBmp: PropTypes.object,
        hideLoadingBmp: PropTypes.func,
        showLoadingBmp: PropTypes.func,
        hideBmpForm: PropTypes.func,
        submitBmpForm: PropTypes.func,
        showSubmitBmpFormSuccess: PropTypes.bool,
        showSubmitBmpFormError: PropTypes.bool,
        storeBmpForm: PropTypes.func,
        complexBmpForm: PropTypes.bool,
        setComplexBmpForm: PropTypes.func,
        thisBmpType: PropTypes.object,
        newBmpForm: PropTypes.object,
        storedBmpForm: PropTypes.object,
        clearBmpForm: PropTypes.func,
        groupProfiles: PropTypes.array,
        saveableGroupProfiles: PropTypes.array,
        makeDefaultsBmpForm: PropTypes.func,
        makeExistingBmpForm: PropTypes.func,
        updateBmpForm: PropTypes.func,
        startVectorDraw: PropTypes.func,
        layers: PropTypes.object,
        projectId: PropTypes.number,
        purgeMapInfoResults: PropTypes.func,
        bmpUniqueNames: PropTypes.array,
        setHighlightFeaturesPath: PropTypes.func,
        projectData: PropTypes.object,
        toggleLayer: PropTypes.func,
        bmpOutletLayer: PropTypes.object,
        bmpFootprintLayer: PropTypes.object,
        bmpWatershedLayer: PropTypes.object,
        hasGeometry: PropTypes.bool,
        requiresOutlet: PropTypes.bool,
        requiresFootprint: PropTypes.bool,
        requiresWatershed: PropTypes.bool,
        watershedIsFootprint: PropTypes.bool,
        changingBmpType: PropTypes.bool,
        deleteBmp: PropTypes.func,
        setChangingBmpType: PropTypes.func,
        cppe_url: PropTypes.string,
        standard_url: PropTypes.string,
        ned_url: PropTypes.string,
        infosheet_url: PropTypes.string,
        downloadBmpReport: PropTypes.func,
        refreshLayerVersion: PropTypes.func,
        expandedBmpTypeGroupName: PropTypes.string,
        setExpandedBmpTypeGroupName: PropTypes.func
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.handleBmpChange = this.handleBmpChange.bind(this);
        this.handleGroupProfileChange = this.handleGroupProfileChange.bind(this);
        this.state = {};
    }

    componentDidMount() {
        this.props.setOpenMenuGroupId(null);
        if (Object.keys(this.props.storedBmpForm).length === 0 && !this.props.creatingNewBmp) {
            this.props.purgeMapInfoResults();
            this.props.setMenuGroup(null);
        }
    }

    componentDidUpdate() {
        if (Object.keys(this.props.storedBmpForm).length === 0 && !this.props.creatingNewBmp && this.props.updatingBmp) {
            this.props.makeExistingBmpForm(this.props.updatingBmp);
        }
    }

    render() {
        return (
            <div
                id={'swamm-bmp-form-panel'}
                className={'simple-view-panel menu-rows-container'}
            >
                <div id={"swamm-bmp-form-grid-header"}>
                    <div className={'simple-view-panel-header'}>
                        {this.props.storedBmpForm.id ?
                            "BMP " + this.props.storedBmpForm.id + ": " + this.props.storedBmpForm?.bmpName :
                            "Create a new BMP"
                        }
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.clearBmpForm();
                            this.props.setComplexBmpForm(false);
                            this.refreshBmpLayers();
                        }}
                    />
                </div>
                {this.renderColumns()}
                <BmpActionButtons
                    storedBmpForm={this.props.storedBmpForm}
                    complexBmpForm={this.props.complexBmpForm}
                    setComplexBmpForm={this.props.setComplexBmpForm}
                    downloadBmpReport={this.props.downloadBmpReport}
                    hideBmpForm={this.props.hideBmpForm}
                    standard_url={this.props.standard_url}
                    deleteBmp={this.props.deleteBmp}
                    projectId={this.props.projectId}
                    hasGeometry={this.props.hasGeometry}
                    submitBmpForm={this.props.submitBmpForm}
                    onRefreshBmpLayers={() => this.refreshBmpLayers()}
                />
            </div>
        );
    }
    renderColumns() {
        const geometryControls = (
            <BmpGeometryControls
                storedBmpForm={this.props.storedBmpForm}
                complexBmpForm={this.props.complexBmpForm}
                requiresOutlet={this.props.requiresOutlet}
                requiresFootprint={this.props.requiresFootprint}
                requiresWatershed={this.props.requiresWatershed}
                watershedIsFootprint={this.props.watershedIsFootprint}
                changingBmpType={this.props.changingBmpType}
                bmpOutletLayer={this.props.bmpOutletLayer}
                bmpFootprintLayer={this.props.bmpFootprintLayer}
                bmpWatershedLayer={this.props.bmpWatershedLayer}
                showLoadingBmp={this.props.showLoadingBmp}
                toggleLayer={this.props.toggleLayer}
                setChangingBmpType={this.props.setChangingBmpType}
                onDrawBmpStep1={(layerName, featureId) => this.drawBmpStep1(layerName, featureId)}
            />
        );
        const typeOrReduction = !this.props.storedBmpForm?.id || this.props.changingBmpType
            ? <BmpTypeSelector
                bmpTypeGroups={this.props.bmpTypeGroups}
                bmpTypes={this.props.bmpTypes}
                expandedBmpTypeGroupName={this.props.expandedBmpTypeGroupName}
                setExpandedBmpTypeGroupName={this.props.setExpandedBmpTypeGroupName}
                changingBmpType={this.props.changingBmpType}
                setChangingBmpType={this.props.setChangingBmpType}
                handleBmpChange={this.handleBmpChange}
            />
            : <BmpReductionDisplay
                storedBmpForm={this.props.storedBmpForm}
                complexBmpForm={this.props.complexBmpForm}
                watershedIsFootprint={this.props.watershedIsFootprint}
                updateBmpForm={this.props.updateBmpForm}
            />;
        const metadataFields = (
            <BmpMetadataFields
                storedBmpForm={this.props.storedBmpForm}
                handleChange={this.handleChange}
            >
                {this.props.complexBmpForm ?
                    <BmpOverrideFields
                        storedBmpForm={this.props.storedBmpForm}
                        saveableGroupProfiles={this.props.saveableGroupProfiles}
                        statuses={this.props.statuses}
                        priorities={this.props.priorities}
                        handleChange={this.handleChange}
                        handleGroupProfileChange={this.handleGroupProfileChange}
                        updateBmpForm={this.props.updateBmpForm}
                        submitBmpForm={this.props.submitBmpForm}
                        projectId={this.props.projectId}
                    /> : null
                }
            </BmpMetadataFields>
        );

        const isExisting = !!this.props.storedBmpForm?.id && !this.props.changingBmpType;

        if (isExisting) {
            // Editing existing BMP: Col 1 = editable fields + geometry, Col 2 = results
            return (
                <React.Fragment>
                    <div id={"swamm-bmp-form-grid-col-one"}>
                        {geometryControls}
                        {metadataFields}
                    </div>
                    <div id={"swamm-bmp-form-grid-col-two"}>
                        {typeOrReduction}
                    </div>
                </React.Fragment>
            );
        }
        // Creating new BMP: Col 1 = draw buttons + type selector, Col 2 = metadata
        return (
            <React.Fragment>
                <div id={"swamm-bmp-form-grid-col-one"}>
                    {geometryControls}
                    {typeOrReduction}
                </div>
                <div id={"swamm-bmp-form-grid-col-two"}>
                    {metadataFields}
                </div>
            </React.Fragment>
        );
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
    handleGroupProfileChange(event) {
        const fieldName = event.target.name;
        let fieldValue = JSON.parse(event.target.value);
        const selectedProfile = this.props.groupProfiles.filter(groupProfile => groupProfile?.pk === fieldValue)[0];
        let kv = {[fieldName]: selectedProfile};
        this.props.updateBmpForm(kv);
    }
    handleBmpChange(event) {
        let fieldValue = event.target.value;
        const selectedBmpType = this.props.bmpTypes.filter(
            bmpType => bmpType?.name === fieldValue
        )[0];
        this.props.makeDefaultsBmpForm(selectedBmpType);
    }
    drawBmpStep1(layerName, featureId) {
        this.refreshBmpLayers();
        const targetLayer = this.props.layers?.flat?.filter(layer => layer?.name?.includes(layerName))[0];
        if (!targetLayer) {
            console.error('BMP draw: layer not found:', layerName);
            return;
        }
        this.props.hideBmpForm();
        this.props.toggleLayer(targetLayer.id, true);
        this.props.startVectorDraw({
            layerName: targetLayer.name,
            geomType: layerName.includes('outlet') ? 'Point' : 'Polygon',
            featureId: featureId || null,
            owner: 'swamm',
            formConfig: null,
            onComplete: 'SWAMM:VECTOR_DRAW_COMPLETE',
            onCancel: 'SWAMM:VECTOR_DRAW_CANCELLED',
            meta: {
                storedBmpForm: this.props.storedBmpForm,
                projectId: this.props.projectId,
                geomField: layerName.includes('outlet') ? 'outlet_fid'
                    : layerName.includes('footprint') ? 'footprint_fid' : 'watershed_fid'
            }
        });
    }
    refreshBmpLayers() {
        this.props.refreshLayerVersion(this.props.bmpOutletLayer?.id);
        this.props.refreshLayerVersion(this.props.bmpFootprintLayer?.id);
        this.props.refreshLayerVersion(this.props.bmpWatershedLayer?.id);
    }
}

const mapStateToProps = (state) => {
    const membershipSlugs = state?.swamm?.userGroupProfileSlugs || state?.security?.user?.info?.groups || [];
    const validGroupProfiles = state?.swamm?.groupProfiles?.filter(item => !["anonymous", "registered-members", "admin", "swamm-users", "illinois-pork-producers"].includes(item.slug)) || [];
    const viewableGroupProfiles = validGroupProfiles.filter(item => state?.swamm?.projectData?.permitted_groups?.map(permittedGroup => permittedGroup.pk)?.includes(item.pk));
    const saveableGroupProfiles = viewableGroupProfiles.map(item => {
        item.saveable = membershipSlugs.includes(item?.slug);
        return item;
    });
    return {
        projectId: state?.swamm?.projectData?.id,
        projectData: state?.swamm?.projectData,
        bmpUniqueNames: bmpByUniqueNameSelector(state).map(bmpType => bmpType?.name),
        bmpTypes: state?.swamm?.bmpTypes,
        bmpTypeGroups: state?.swamm?.bmpTypeGroups || [],
        expandedBmpTypeGroupName: state?.swamm?.expandedBmpTypeGroupName,
        saveableGroupProfiles: saveableGroupProfiles,
        statuses: state?.swamm?.statuses,
        priorities: state?.swamm?.priorities,
        thisBmpType: state?.swamm?.bmpTypes?.filter((bmpType) => bmpType.id === state?.swamm?.BmpFormBmpTypeId)[0],
        storedBmpForm: state?.swamm?.storedBmpForm || {},
        complexBmpForm: state?.swamm?.complexBmpForm || false,
        bmpOutletLayer: bmpOutletLayerSelector(state),
        bmpFootprintLayer: bmpFootprintLayerSelector(state),
        bmpWatershedLayer: bmpWatershedLayerSelector(state),
        hasGeometry: state?.swamm?.storedBmpForm?.outlet_fid || state?.swamm?.storedBmpForm?.footprint_fid || state?.swamm?.storedBmpForm?.watershed_fid,
        requiresOutlet: state?.swamm?.storedBmpForm?.type_data?.requires_outlet,
        requiresFootprint: state?.swamm?.storedBmpForm?.type_data?.requires_footprint,
        requiresWatershed: state?.swamm?.storedBmpForm?.type_data?.requires_watershed,
        watershedIsFootprint: state?.swamm?.storedBmpForm?.type_data?.watershed_is_footprint,
        cppe_url: state?.swamm?.storedBmpForm?.type_data?.cppe_url,
        standard_url: state?.swamm?.storedBmpForm?.type_data?.standard_url,
        ned_url: state?.swamm?.storedBmpForm?.type_data?.ned_url,
        infosheet_url: state?.swamm?.storedBmpForm?.type_data?.infosheet_url,
        creatingNewBmp: state?.swamm?.creatingNewBmp,
        changingBmpType: state?.swamm?.changingBmpType,
        updatingBmp: state?.swamm?.updatingBmp,
        groupProfiles: state?.swamm?.groupProfiles,
        layers: state?.layers,
        query: state?.query
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        hideBmpForm: () => dispatch(hideBmpForm()),
        hideLoadingBmp: () => dispatch(hideLoadingBmp()),
        showLoadingBmp: () => dispatch(showLoadingBmp()),
        submitBmpForm: (newBmp, projectId) => dispatch(submitBmpForm(newBmp, projectId)),
        updateBmpForm: (kv) => dispatch(updateBmpForm(kv)),
        clearBmpForm: () => dispatch(clearBmpForm()),
        deleteBmp: (projectId, bmpId) => dispatch(deleteBmp(projectId, bmpId)),
        makeDefaultsBmpForm: (bmpType) => dispatch(makeDefaultsBmpForm(bmpType)),
        setChangingBmpType: (changingBmpType) => dispatch(setChangingBmpType(changingBmpType)),
        setExpandedBmpTypeGroupName: (expandedBmpTypeGroupName) => dispatch(setExpandedBmpTypeGroupName(expandedBmpTypeGroupName)),
        setComplexBmpForm: (complexBmpForm) => dispatch(setComplexBmpForm(complexBmpForm)),
        toggleLayer: (layerId, isVisible) => dispatch(changeLayerProperties(layerId, {visibility: isVisible})),
        startVectorDraw: (config) => dispatch(startVectorDraw(config)),
        purgeMapInfoResults: () => dispatch(purgeMapInfoResults()),
        makeExistingBmpForm: (bmp) => dispatch(makeExistingBmpForm(bmp)),
        downloadBmpReport: (bmpId) => dispatch(downloadBmpReport(bmpId)),
        refreshLayerVersion: (layer, version) => dispatch(refreshLayerVersion(layer, version))
    };
};

const SwammBmpForm = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFormClass);


export {
    SwammBmpForm
};

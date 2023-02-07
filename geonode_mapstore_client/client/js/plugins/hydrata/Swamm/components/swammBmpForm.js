import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, ControlLabel, FormControl, FormGroup} from "react-bootstrap";
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
    setDrawingBmpLayerName,
    setChangingBmpType,
    setComplexBmpForm,
    setEditingBmpFeatureId,
    clearEditingBmpFeatureId,
    deleteBmp,
    setMenuGroup,
    downloadBmpReport
} from "../actionsSwamm";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {
    setLayer,
    toggleEditMode,
    createNewFeatures,
    startDrawingFeature,
    saveChanges
} from "../../../../../MapStore2/web/client/actions/featuregrid";
import { purgeMapInfoResults } from "../../../../../MapStore2/web/client/actions/mapInfo";
import {featureTypeSelected, createQuery, query} from "../../../../../MapStore2/web/client/actions/wfsquery";
import {isInt} from "../../Utils/utils";
import {bmpByUniqueNameSelector} from "../selectorsSwamm";
import {changeLayerProperties, refreshLayerVersion} from "../../../../../MapStore2/web/client/actions/layers";

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
                <div id={"swamm-bmp-form-grid-col-one"}>
                    {
                        this.props.storedBmpForm?.id ?
                            <div className={"simple-view-panel-item-row"}>
                                <div>
                                    Type: {this.props.storedBmpForm?.type_data?.name}
                                </div>
                                <button
                                    type={'button'}
                                    className={'swamm-button'}
                                    onClick={() => {
                                        if (window.confirm('This will remove any custom data you have entered for the current BMP Type. Are you sure?')) {
                                            this.props.setChangingBmpType(true);
                                        }
                                    }}>
                                    Edit Type
                                </button>
                            </div> :
                            null
                    }
                    {
                        this.props.requiresOutlet || this.props.complexBmpForm ?
                            <div className={"simple-view-panel-item-row"}>
                                <div>
                                    Outlet Point:
                                </div>
                                {this.props.storedBmpForm?.outlet_fid ?
                                    <button
                                        type={'button'}
                                        className={'swamm-button'}
                                        onClick={() => {
                                            this.props.showLoadingBmp(true);
                                            this.props.toggleLayer(this.props.bmpOutletLayer?.id, true);
                                            this.drawBmpStep1(this.props?.projectData?.code + '_bmp_outlet', this.props.storedBmpForm?.outlet_fid);
                                        }}>
                                    Edit Outlet
                                    </button> :
                                    <button
                                        type={'button'}
                                        style={{backgroundColor: "darkgreen"}}
                                        disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                        className={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "swamm-button default" : "swamm-button default" }
                                        onClick={() => {
                                            this.props.showLoadingBmp(true);
                                            this.props.toggleLayer(this.props.bmpOutletLayer?.id, true);
                                            this.drawBmpStep1(this.props.projectData?.code + '_bmp_outlet', null);
                                        }}>
                                    Locate
                                    </button>
                                }
                            </div>
                            : null
                    }
                    {
                        this.props.requiresFootprint || this.props.complexBmpForm ?
                            <div className={"simple-view-panel-item-row"}>
                                {this.props.storedBmpForm?.footprint_fid ?
                                    <React.Fragment>
                                        <div>
                                            Footprint: {
                                                this.props.storedBmpForm?.calculated_footprint_area ?
                                                    this.props.storedBmpForm?.calculated_footprint_area?.toFixed(2) + " acres" :
                                                    ' '
                                            }
                                        </div>
                                        <button
                                            type={'button'}
                                            className={'swamm-button'}
                                            onClick={() => {
                                                this.props.showLoadingBmp(true);
                                                this.props.toggleLayer(this.props.bmpFootprintLayer?.id, true);
                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint', this.props.storedBmpForm?.footprint_fid);
                                            }}
                                        >
                                            Edit Footprint
                                        </button>
                                    </React.Fragment> :
                                    <button
                                        type={'button'}
                                        disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                        className={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "swamm-button default" : "swamm-button default" }
                                        style={{backgroundColor: "darkgreen"}}
                                        onClick={() => {
                                            this.props.showLoadingBmp(true);
                                            this.props.toggleLayer(this.props.bmpFootprintLayer?.id, true);
                                            this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint');
                                        }}
                                    >
                                        Draw Footprint
                                    </button>
                                }
                            </div>
                            : null
                    }
                    {
                        (this.props.requiresWatershed || this.props.complexBmpForm) && !this.props.watershedIsFootprint ?
                            <div className={"simple-view-panel-item-row"}>
                                {this.props.storedBmpForm?.watershed_fid ?
                                    <React.Fragment>
                                        <div>
                                            Watershed: {this.props.storedBmpForm?.calculated_watershed_area ?
                                                this.props.storedBmpForm?.calculated_watershed_area?.toFixed(2) + " acres" :
                                                ' '}
                                        </div>
                                        <button
                                            type={'button'}
                                            className={'swamm-button'}
                                            onClick={() => {
                                                this.props.showLoadingBmp(true);
                                                this.props.toggleLayer(this.props.bmpWatershedLayer?.id, true);
                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_watershed', this.props.storedBmpForm?.watershed_fid);
                                            }}
                                        >
                                            Edit Watershed
                                        </button>
                                    </React.Fragment> :
                                    <button
                                        disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                        className={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "swamm-button default" : "swamm-button default" }
                                        style={{backgroundColor: "darkgreen"}}
                                        onClick={() => {
                                            this.props.showLoadingBmp(true);
                                            this.props.toggleLayer(this.props.bmpWatershedLayer?.id, true);
                                            this.drawBmpStep1(this.props?.bmpWatershedLayer?.name);
                                        }}
                                    >
                                        Draw Watershed
                                    </button>
                                }
                            </div>
                            : null
                    }
                    <div className={"simple-view-panel-item-row"}>
                        <div>
                          Field Identifier:
                        </div>
                        <input
                            type={"text"}
                            name="field_identifier"
                            style={{
                                maxWidth: "fit-content"
                            }}
                            value={this.props.storedBmpForm?.field_identifier}
                            onChange={this.handleChange}
                            placeholder="---"
                        />
                    </div>
                    <div className={"simple-view-panel-item-row"}>
                        <div style={{textAlign: "left"}}>
                          Owner details:
                        </div>
                        <input
                            type={"text"}
                            name="owner_identifier"
                            style={{
                                maxWidth: "fit-content"
                            }}
                            value={this.props.storedBmpForm?.owner_identifier}
                            onChange={this.handleChange}
                            placeholder="---"
                        />
                    </div>
                    {
                        this.props.complexBmpForm ?
                            <React.Fragment>
                                <div className={"simple-view-panel-item-row"} id="organization-selector-container">
                                    <div>
                                      Organization
                                    </div>
                                    <select
                                        id="organization-selector"
                                        name={'group_profile'}
                                        value={this.props.storedBmpForm?.group_profile?.pk}
                                        onChange={this.handleGroupProfileChange}
                                        placeholder={this.props.storedBmpForm?.group_profile?.title}
                                    >
                                        {this.props.saveableGroupProfiles.map((groupProfile) => {
                                            return (
                                                <option
                                                    key={groupProfile.pk}
                                                    value={groupProfile?.pk}
                                                    className={groupProfile?.saveable ? "" : "non-savable-group-profile"}
                                                >
                                                    {groupProfile.title}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className={"simple-view-panel-item-row"} id="status-selector-container">
                                    <div>
                                      BMP Status
                                    </div>
                                    <select
                                        id="status-selectorr"
                                        name={'status'}
                                        value={this.props.storedBmpForm?.status}
                                        onChange={this.handleChange}
                                    >
                                        <option key={'Unknown'} value={'Unknown'}>{'Unknown'}</option>
                                        {this.props.statuses
                                            .filter(status => status.name !== 'Unknown')
                                            .map(status => <option key={status.name} value={status.name}>{status.name}</option>)
                                        }
                                    </select>
                                </div>
                                <div className={"simple-view-panel-item-row"} id="priority-selector-container">
                                    <div>
                                      BMP Priority
                                    </div>
                                    <select
                                        id="priority-selectorr"
                                        name="priority"
                                        value={this.props.storedBmpForm?.priority?.id}
                                        onChange={this.handleChange}
                                    >
                                        {this.props.priorities.map((priority) => {
                                            return (
                                                <option
                                                    key={priority.id}
                                                    value={priority?.value}
                                                >
                                                    {priority.label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className={"simple-view-panel-item-row"} id="n_surface_red_percent-selector-container">
                                    <div>
                                      Surface Nitrogen Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_n_surface_red_percent"
                                        value={this.props.storedBmpForm?.override_n_surface_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="p_surface_red_percent-selector-container">
                                    <div>
                                      Surface Phosphorus Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_p_surface_red_percent"
                                        value={this.props.storedBmpForm?.override_p_surface_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="s_surface_red_percent-selector-container">
                                    <div>
                                      Surface Sediment Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_s_surface_red_percent"
                                        value={this.props.storedBmpForm?.override_s_surface_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="n_tiled_red_percent-selector-container">
                                    <div>
                                      Tiled Nitrogen Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_n_tiled_red_percent"
                                        value={this.props.storedBmpForm?.override_n_tiled_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="p_tiled_red_percent-selector-container">
                                    <div>
                                      Tiled Phosphorus Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_p_tiled_red_percent"
                                        value={this.props.storedBmpForm?.override_p_tiled_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="s_tiled_red_percent-selector-container">
                                    <div>
                                      Tiled Sediment Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_s_tiled_red_percent"
                                        value={this.props.storedBmpForm?.override_s_tiled_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="n_erosion_red_percent-selector-container">
                                    <div>
                                      Erosion Nitrogen Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_n_erosion_red_percent"
                                        value={this.props.storedBmpForm?.override_n_erosion_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="p_erosion_red_percent-selector-container">
                                    <div>
                                      Erosion Phosphorus Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_p_erosion_red_percent"
                                        value={this.props.storedBmpForm?.override_p_erosion_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="s_erosion_red_percent-selector-container">
                                    <div>
                                      Erosion Sediment Reduction Percentage
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_s_tiled_red_percent"
                                        value={this.props.storedBmpForm?.override_s_erosion_red_percent}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="override_cost_base-selector-container">
                                    <div>
                                      Base Cost ($)
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_cost_base"
                                        value={this.props.storedBmpForm?.override_cost_base}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="cost_rate_per_footprint_area-selector-container">
                                    <div>
                                      Footprint Cost ($/acre)
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_cost_rate_per_footprint_area"
                                        value={this.props.storedBmpForm?.override_cost_rate_per_footprint_area}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                                <div className={"simple-view-panel-item-row"} id="cost_rate_per_watershed_area-selector-container">
                                    <div>
                                      Watershed Cost ($/acre)
                                    </div>
                                    <input
                                        type={"number"}
                                        step={1}
                                        name="override_cost_rate_per_watershed_area"
                                        value={this.props.storedBmpForm?.override_cost_rate_per_watershed_area}
                                        onChange={this.handleChange}
                                        placeholder="---"
                                    />
                                </div>
                            </React.Fragment>
                            : null
                    }
                    <div style={{marginTop: "10px"}}>
                        Notes
                    </div>
                    <textarea
                        id={'bmp-notes'}
                        rows={4}
                        cols={50}
                        name="notes"
                        value={this.props.storedBmpForm?.notes}
                        onChange={this.handleChange}
                    />
                </div>
                <div id={"swamm-bmp-form-grid-col-two"}>
                    {
                        !this.props.storedBmpForm?.id || this.props.changingBmpType ?
                            <React.Fragment>
                                <div style={{textAlign: "left"}}>
                                    <h5>Select a BMP Type...</h5>
                                    {this.props.bmpTypeGroups?.map((group) => {
                                        return (
                                            <div
                                                key={`group-${group}`}
                                                style={{
                                                    textAlign: "left",
                                                    marginLeft: 0,
                                                    marginBottom: "3px",
                                                    padding: "3px",
                                                    border: "1px solid white",
                                                    borderRadius: "3px"
                                                }}
                                            >
                                                <span
                                                    style={{marginLeft: "15px"}}
                                                    className={"btn glyphicon bmp-type-group-glyph" + (this.props.expandedBmpTypeGroupName === group[0] ? " glyphicon-chevron-down bmp-type-group-bottom-margin" : " glyphicon-chevron-right")}
                                                    onClick={
                                                        this.props.expandedBmpTypeGroupName === group[0] ?
                                                            () => this.props.setExpandedBmpTypeGroupName(null) :
                                                            () => this.props.setExpandedBmpTypeGroupName(group[0])
                                                    }
                                                />
                                                <span className="bmp-type-group-name">
                                                    {group[1]}
                                                </span>
                                                {
                                                    this.props.expandedBmpTypeGroupName === group[0] ?
                                                        this.props.bmpTypes
                                                            .filter(bmpType => bmpType.group_name === group[0])
                                                            .map(bmpType => {
                                                                return (
                                                                    <div
                                                                        key={`bmpType-${bmpType.name}`}
                                                                        style={{
                                                                            marginLeft: "30px"
                                                                        }}
                                                                    >
                                                                        <input
                                                                            id={`bmp-type-selector-box-${bmpType.name}`}
                                                                            // style={formControlStyle}
                                                                            type={'radio'}
                                                                            name={'bmpType'}
                                                                            value={bmpType.name}
                                                                            onChange={this.handleBmpChange}
                                                                        />
                                                                        <label
                                                                            htmlFor={`bmp-type-selector-box-${bmpType.name}`}
                                                                            style={{marginLeft: "6px", verticalAlign: "middle"}}
                                                                        >
                                                                            {bmpType.name}
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })
                                                        : null
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                                {this.props.changingBmpType ?
                                    <button
                                        type={'button'}
                                        className={'swamm-button'}
                                        style={{marginTop: "20px", backgroundColor: "darkgreen"}}
                                        onClick={() => this.props.setChangingBmpType(false)}
                                    >
                                        Accept
                                    </button> :
                                    null
                                }
                            </React.Fragment> :
                            this.props.complexBmpForm ?
                                <React.Fragment>
                                    <Table
                                        condensed
                                        bordered
                                        hover
                                        responsive="sm"
                                        className={"text-right"}
                                        style={{
                                            tableLayout: "fixed",
                                            border: "solid 1px rgb(255, 255, 255, 0.2)",
                                            borderRadius: "2px"
                                        }}
                                    >
                                        <thead>
                                            <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                                                <th style={{"width": "30%"}}>Results</th>
                                                <th style={{"width": "13%"}}>Surface</th>
                                                <th style={{"width": "13%"}}>Tiled</th>
                                                <th style={{"width": "13%", "word-break": "break-word"}}>Gully/<wbr/>Bank</th>
                                                <th style={{"width": "10%"}}>Total</th>
                                                {
                                                    this.props.watershedIsFootprint ?
                                                        <React.Fragment>
                                                            <th style={{"width": "10%"}}>Per Acre</th>
                                                            <th style={{"width": "11%"}}/>
                                                        </React.Fragment>
                                                        :
                                                        <th style={{"width": "11%"}}/>
                                                }
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                                                <td>Nitrogen load previous: </td>
                                                <td>{this.props.storedBmpForm?.surface_previous_n_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_previous_n_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_previous_n_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_previous_n_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_previous_n_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Nitrogen load reduction: </td>
                                                <td>{this.props.storedBmpForm?.surface_n_load_reduction?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_n_load_reduction?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_n_load_reduction?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_n_load_reduction?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_n_load_reduction / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Nitrogen load new: </td>
                                                <td>{this.props.storedBmpForm?.surface_new_n_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_new_n_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_new_n_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_new_n_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_new_n_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                                                <td>Phosphorus load previous: </td>
                                                <td>{this.props.storedBmpForm?.surface_previous_p_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_previous_p_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_previous_p_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_previous_p_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_previous_p_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Phosphorus load reduction: </td>
                                                <td>{this.props.storedBmpForm?.surface_p_load_reduction?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_p_load_reduction?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_p_load_reduction?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_p_load_reduction?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_p_load_reduction / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Phosphorus load new: </td>
                                                <td>{this.props.storedBmpForm?.surface_new_p_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_new_p_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_new_p_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_new_p_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_new_p_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>lbs/<wbr/>year</td>
                                            </tr>
                                            <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                                                <td>Sediment load previous: </td>
                                                <td>{this.props.storedBmpForm?.surface_previous_s_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_previous_s_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_previous_s_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_previous_s_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_previous_s_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>tons/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Sediment load reduction: </td>
                                                <td>{this.props.storedBmpForm?.surface_s_load_reduction?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_s_load_reduction?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_s_load_reduction?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_s_load_reduction?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_s_load_reduction / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>tons/<wbr/>year</td>
                                            </tr>
                                            <tr style={{borderBottom: "solid 3px rgb(255, 255, 255, 1)"}}>
                                                <td>Sediment load new: </td>
                                                <td>{this.props.storedBmpForm?.surface_new_s_load?.toFixed(0)}</td>
                                                <td>{this.props.storedBmpForm?.tiled_new_s_load?.toFixed(0)}</td>
                                                <td>{parseFloat(this.props.storedBmpForm?.erosion_new_s_load?.toPrecision(3))}</td>
                                                <td>{this.props.storedBmpForm?.total_new_s_load?.toFixed(0)}</td>
                                                {this.props.watershedIsFootprint ?
                                                    <td>{(this.props.storedBmpForm?.total_new_s_load / this.props.storedBmpForm?.calculated_footprint_area).toFixed(1)}</td>
                                                    : null
                                                }
                                                <td className={"text-left"}>tons/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Potential Incentive Payment:</td>
                                                {this.props.storedBmpForm?.calculated_total_cost ?
                                                    <td>${Number(this.props.storedBmpForm?.calculated_total_cost?.toFixed(0)).toLocaleString()}</td> :
                                                    <td/>}
                                                <td/>
                                            </tr>
                                            <tr>
                                                <td>Nitrogen reduction value: </td>
                                                {this.props.storedBmpForm?.total_cost_per_lbs_n_reduced ?
                                                    <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_n_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                    <td/>}
                                                <td className={"text-left"}>$/lb/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Phosphorus reduction value: </td>
                                                {this.props.storedBmpForm?.total_cost_per_lbs_p_reduced ?
                                                    <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_p_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                    <td/>}
                                                <td className={"text-left"}>$/lb/<wbr/>year</td>
                                            </tr>
                                            <tr>
                                                <td>Sediment reduction value: </td>
                                                {this.props.storedBmpForm?.total_cost_per_ton_s_reduced ?
                                                    <td>{Number(this.props.storedBmpForm?.total_cost_per_ton_s_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                    <td/>}
                                                <td className={"text-left"}>$/ton/<wbr/>year</td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                    {this.props.storedBmpForm?.created_by ?
                                        <p>Created by: {this.props.storedBmpForm?.created_by} on {new Date(this.props.storedBmpForm?.created_at).toLocaleString()}</p> :
                                        null
                                    }
                                    {this.props.storedBmpForm?.updated_by ?
                                        <p>Updated by: {this.props.storedBmpForm?.updated_by} on {new Date(this.props.storedBmpForm?.updated_at).toLocaleString()}</p> :
                                        null
                                    }
                                </React.Fragment> :
                                <Table
                                    bordered
                                    condensed
                                    hover
                                    responsive="sm"
                                    style={{
                                        tableLayout: "fixed",
                                        border: "solid 1px rgb(255, 255, 255, 0.2)",
                                        borderRadius: "2px"
                                    }}
                                    className={"text-right"}
                                >
                                    <thead>
                                        <tr>
                                            <th>Results</th>
                                            <th style={{"width": "100px"}}>Total</th>
                                            <th/>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Nitrogen load reduction: </td>
                                            <td>{this.props.storedBmpForm?.total_n_load_reduction?.toFixed(0)}</td>
                                            <td className={"text-left"}>lbs/year</td>
                                        </tr>
                                        <tr>
                                            <td>Phosphorus load reduction: </td>
                                            <td>{this.props.storedBmpForm?.total_p_load_reduction?.toFixed(0)}</td>
                                            <td className={"text-left"}>lbs/year</td>
                                        </tr>
                                        <tr>
                                            <td>Sediment load reduction: </td>
                                            <td>{this.props.storedBmpForm?.total_s_load_reduction?.toFixed(0)}</td>
                                            <td className={"text-left"}>tons/year</td>
                                        </tr>
                                    </tbody>
                                </Table>
                    }
                </div>
                <div
                    id={"swamm-bmp-form-grid-footer"}
                    className={"simple-view-panel-item-row"}
                    style={{
                        display: "flex",
                        justifyContent: "flex-end"
                    }}
                >
                    {this.props.storedBmpForm?.id ?
                        <React.Fragment>
                            {
                                this.props.complexBmpForm ?
                                    <button
                                        type={'button'}
                                        className={'swamm-button'}
                                        onClick={() => this.props.setComplexBmpForm(false)}>
                                        Simple
                                    </button>
                                    :
                                    <button
                                        type={'button'}
                                        className={'swamm-button'}
                                        onClick={() => this.props.setComplexBmpForm(true)}>
                                        Advanced
                                    </button>
                            }
                            <button
                                type={'button'}
                                className={'swamm-button'}
                                // onClick={() => { this.props.downloadBmpReport(this.props.storedBmpForm?.id);}}>
                                onClick={() => { window.alert('PDF creation feature is under maintenance.');}}>
                                Make PDF
                            </button>
                        </React.Fragment>
                        : null}
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        onClick={() => {
                            this.props.hideBmpForm();
                            this.refreshBmpLayers();
                        }}>
                        View Map
                    </button>
                    <button
                        type={'button'}
                        disabled={!!this.props.standard_url}
                        className={`swamm-button ${this.props.standard_url ? "" : "swamm-button-disabled"}`}
                        onClick={() => window.open(this.props.standard_url, "_blank")}>
                        Description
                    </button>
                    {this.props.storedBmpForm?.id ?
                        <button
                            type={'button'}
                            className={'swamm-button'}
                            style={{
                                backgroundColor: "darkred"
                            }}
                            onClick={() => {
                                if (window.confirm('This action can not be undone. Are you sure?')) {
                                    this.props.deleteBmp(this.props.projectId, this.props.storedBmpForm?.id);
                                }
                            }}>
                            Delete
                        </button> : null
                    }
                    <button
                        type={'button'}
                        className={this.props.hasGeometry ? 'swamm-button' : 'swamm-button disabled'}
                        style={{
                            backgroundColor: "darkgreen"
                        }}
                        onClick={() => {
                            this.props.submitBmpForm(this.props.storedBmpForm, this.props.projectId);
                        }}>
                        Save
                    </button>
                </div>
            </div>
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
    handleGroupProfileChange(event) {
        const fieldName = event.target.name;
        let fieldValue = JSON.parse(event.target.value);
        const selectedProfile = this.props.groupProfiles.filter(groupProfile => groupProfile?.pk === fieldValue)[0];
        let kv = {[fieldName]: selectedProfile};
        this.props.updateBmpForm(kv);
    }
    handleBmpChange(event) {
        console.log('event:', event);
        let fieldValue = event.target.value;
        console.log('fieldValue:', fieldValue);
        const selectedBmpType = this.props.bmpTypes.filter(
            bmpType => bmpType.name === fieldValue
        )[0];
        this.props.makeDefaultsBmpForm(selectedBmpType);
    }
    drawBmpStep1(layerName, featureId) {
        console.log('this.props.bmpOutletLayer?.id', this.props.bmpOutletLayer?.id);
        console.log('this.props.bmpFootprintLayer?.id', this.props.bmpFootprintLayer?.id);
        console.log('this.props.bmpWatershedLayer?.id', this.props.bmpWatershedLayer?.id);
        this.refreshBmpLayers();
        this.props.hideBmpForm();
        const targetLayer = this.props.layers.flat.filter(layer => layer?.name.includes(layerName))[0];
        console.log('drawBmpStep1 targetLayer', targetLayer);
        console.log('drawBmpStep1 layerName', layerName);
        console.log('drawBmpStep1 featureId', featureId);
        this.props.setDrawingBmpLayerName(targetLayer.name);
        featureId ? this.props.setEditingBmpFeatureId(featureId) : this.props.clearEditingBmpFeatureId();
        this.props.toggleLayer(targetLayer.id, true);
        this.props.setLayer(targetLayer?.id);
        this.props.featureTypeSelected('http://localhost:8080/geoserver/wfs', targetLayer.name);
        console.log('drawBmpStep1 finished');
    }
    refreshBmpLayers() {
        this.props.refreshLayerVersion(this.props.bmpOutletLayer?.id);
        this.props.refreshLayerVersion(this.props.bmpFootprintLayer?.id);
        this.props.refreshLayerVersion(this.props.bmpWatershedLayer?.id);
    }
}

const mapStateToProps = (state) => {
    const validGroupProfiles = state?.swamm?.groupProfiles.filter(item => !["anonymous", "registered-members", "admin", "swamm-users", "illinois-pork-producers"].includes(item.slug));
    console.log('validGroupProfiles:', validGroupProfiles);
    const viewableGroupProfiles = validGroupProfiles.filter(item => state?.swamm?.projectData?.permitted_groups?.includes(item.id));
    console.log('viewableGroupProfiles:', viewableGroupProfiles);
    const saveableGroupProfiles = viewableGroupProfiles.map(item => {
        item.saveable = state?.security?.user?.info?.groups?.includes(item?.slug);
        return item;
    });
    console.log('expandedBmpTypeGroupName:', state?.swamm?.expandedBmpTypeGroupName);
    console.log('bmpTypeGroups:', state?.swamm?.bmpTypeGroups);
    return {
        projectId: state?.swamm?.projectData?.id,
        projectData: state?.swamm?.projectData,
        bmpUniqueNames: bmpByUniqueNameSelector(state).map(bmpType => bmpType.name),
        bmpTypes: state?.swamm?.bmpTypes,
        bmpTypeGroups: state?.swamm?.bmpTypeGroups || [],
        expandedBmpTypeGroupName: state?.swamm?.expandedBmpTypeGroupName,
        saveableGroupProfiles: saveableGroupProfiles,
        statuses: state?.swamm?.statuses,
        priorities: state?.swamm?.priorities,
        thisBmpType: state?.swamm?.bmpTypes.filter((bmpType) => bmpType.id === state?.swamm?.BmpFormBmpTypeId)[0],
        storedBmpForm: state?.swamm?.storedBmpForm || {},
        complexBmpForm: state?.swamm?.complexBmpForm || false,
        bmpOutletLayer: state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_outlet)[0],
        bmpFootprintLayer: state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_footprint)[0],
        bmpWatershedLayer: state?.layers?.flat?.filter((layer) => parseInt(layer?.extendedParams?.pk, 10) === state?.swamm?.projectData?.bmp_watershed)[0],
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
        makeExistingBmpForm: (bmp) => dispatch(makeExistingBmpForm(bmp)),
        downloadBmpReport: (bmpId) => dispatch(downloadBmpReport(bmpId)),
        refreshLayerVersion: (layer, version) => dispatch(refreshLayerVersion(layer, version))
    };
};

const SwammBmpForm = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFormClass);


export {
    SwammBmpForm
};

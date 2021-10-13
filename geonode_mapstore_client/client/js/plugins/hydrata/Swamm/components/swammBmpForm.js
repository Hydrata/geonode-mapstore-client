import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Table, ControlLabel, FormControl, FormGroup, Form, Col, Row, Radio} from "react-bootstrap";
import {
    hideBmpForm,
    clearBmpForm,
    submitBmpForm,
    makeDefaultsBmpForm,
    makeExistingBmpForm,
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
        allowedGroupProfiles: PropTypes.array,
        defaultGroupProfile: PropTypes.string,
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
        refreshLayerVersion: PropTypes.func
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
                                "Edit BMP " + this.props.storedBmpForm.id + ": " + this.props.storedBmpForm?.type_data?.name :
                                "Create a new BMP"
                            }
                            <span
                                className={"btn glyphicon glyphicon-remove"}
                                style={{color: "red", position: "absolute", right: 0}}
                                onClick={() => {
                                    this.props.clearBmpForm();
                                    this.props.setComplexBmpForm(false);
                                    this.refreshBmpLayers();
                                }}
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{padding: 0}}>
                        <Col sm={6} style={{padding: "20px", textAlign: "left"}}>
                            {
                                this.props.storedBmpForm.bmpName ?
                                    <h5>{this.props.storedBmpForm.bmpName}</h5> :
                                    <h5>Select a BMP Type...</h5>
                            }
                            <Form horizontal>
                                {
                                    this.props.requiresOutlet || this.props.complexBmpForm ?
                                        <FormGroup controlId="outlet_fid" validationState={this.validateFid("outlet_fid")} bsSize={"small"}>
                                            <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                Outlet Point:
                                            </Col>
                                            {this.props.storedBmpForm?.outlet_fid ?
                                                <Col sm={1}>
                                                    <Button
                                                        className={"pull-right"}
                                                        bsStyle={"info"}
                                                        style={{opacity: "0.7"}}
                                                        onClick={() => {
                                                            this.props.showLoadingBmp(true);
                                                            this.props.toggleLayer(this.props.bmpOutletLayer?.id, true);
                                                            this.drawBmpStep1(this.props?.projectData?.code + '_bmp_outlet', this.props.storedBmpForm?.outlet_fid);
                                                        }}>
                                                    Edit
                                                    </Button>
                                                </Col> :
                                                <Col sm={5}>
                                                    <Button
                                                        disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                                        bsStyle={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "default" : "success" }
                                                        style={{opacity: "0.7"}}
                                                        onClick={() => {
                                                            this.props.showLoadingBmp(true);
                                                            this.props.toggleLayer(this.props.bmpOutletLayer?.id, true);
                                                            this.drawBmpStep1(this.props.projectData?.code + '_bmp_outlet', null);
                                                        }}>
                                                    Locate Outlet
                                                    </Button>
                                                </Col>
                                            }
                                        </FormGroup>
                                        : null
                                }
                                {
                                    this.props.requiresFootprint || this.props.complexBmpForm ?
                                        <FormGroup controlId="footprint_fid" validationState={this.validateFid("footprint_fid")} bsSize={"small"}>
                                            <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                Footprint:
                                            </Col>
                                            {this.props.storedBmpForm?.footprint_fid ?
                                                <React.Fragment>
                                                    <Col sm={3}>
                                                        <FormControl
                                                            inline="true"
                                                            readOnly="true"
                                                            type={"string"}
                                                            value={this.props.storedBmpForm?.calculated_footprint_area ?
                                                                this.props.storedBmpForm?.calculated_footprint_area?.toFixed(2) + " acres" :
                                                                ''}
                                                        />
                                                    </Col>
                                                    <Col sm={2}>
                                                        <Button
                                                            className={"pull-right"}
                                                            bsStyle={"info"}
                                                            style={{opacity: "0.7"}}
                                                            onClick={() => {
                                                                this.props.showLoadingBmp(true);
                                                                this.props.toggleLayer(this.props.bmpFootprintLayer?.id, true);
                                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint', this.props.storedBmpForm?.footprint_fid);
                                                            }}>
                                                        Edit
                                                        </Button>
                                                    </Col>
                                                </React.Fragment> :
                                                <React.Fragment>
                                                    <Col sm={5}>
                                                        <Button
                                                            disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                                            bsStyle={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "default" : "success" }
                                                            style={{opacity: "0.7"}}
                                                            onClick={() => {
                                                                this.props.showLoadingBmp(true);
                                                                this.props.toggleLayer(this.props.bmpFootprintLayer?.id, true);
                                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint');
                                                            }}>
                                                        Draw footprint
                                                        </Button>
                                                    </Col>
                                                </React.Fragment>
                                            }
                                        </FormGroup>
                                        : null
                                }
                                {
                                    (this.props.requiresWatershed || this.props.complexBmpForm) && !this.props.watershedIsFootprint ?
                                        <FormGroup controlId="watershed_fid" validationState={this.validateFid("watershed_fid")} bsSize={"small"}>
                                            <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                Watershed:
                                            </Col>
                                            {this.props.storedBmpForm?.watershed_fid ?
                                                <React.Fragment>
                                                    <Col sm={3}>
                                                        <FormControl
                                                            inline="true"
                                                            readOnly="true"
                                                            type={"string"}
                                                            value={this.props.storedBmpForm?.calculated_watershed_area ?
                                                                this.props.storedBmpForm?.calculated_watershed_area?.toFixed(2) + " acres" :
                                                                ''}
                                                        />
                                                    </Col>
                                                    <Col sm={2}>
                                                        <Button
                                                            className={"pull-right"}
                                                            bsStyle={"info"}
                                                            style={{opacity: "0.7"}}
                                                            onClick={() => {
                                                                this.props.showLoadingBmp(true);
                                                                this.props.toggleLayer(this.props.bmpWatershedLayer?.id, true);
                                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_watershed', this.props.storedBmpForm?.watershed_fid);
                                                            }}>
                                                        Edit
                                                        </Button>
                                                    </Col>
                                                </React.Fragment> :
                                                <React.Fragment>
                                                    <Col sm={5}>
                                                        <Button
                                                            disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                                            bsStyle={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "default" : "success" }
                                                            style={{opacity: "0.7"}}
                                                            onClick={() => {
                                                                this.props.showLoadingBmp(true);
                                                                this.props.toggleLayer(this.props.bmpWatershedLayer?.id, true);
                                                                this.drawBmpStep1(this.props?.projectData?.code + '_bmp_watershed');
                                                            }}>
                                                        Draw watershed
                                                        </Button>
                                                    </Col>
                                                </React.Fragment>
                                            }
                                        </FormGroup>
                                        : null
                                }
                                <FormGroup controlId="field_identifier" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left", marginTop: "3px"}}>
                                      Field Identifier:
                                    </Col>
                                    <Col sm={5}>
                                        <FormControl
                                            inline="true"
                                            type={"text"}
                                            name="field_identifier"
                                            value={this.props.storedBmpForm?.field_identifier}
                                            onChange={this.handleChange}
                                            placeholder="optional"
                                        />
                                        <FormControl.Feedback />
                                    </Col>
                                </FormGroup>
                                <FormGroup controlId="owner_identifier" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                      Owner details:
                                    </Col>
                                    <Col sm={5}>
                                        <FormControl
                                            inline="true"
                                            type={"text"}
                                            name="owner_identifier"
                                            value={this.props.storedBmpForm?.owner_identifier}
                                            onChange={this.handleChange}
                                            placeholder="optional"
                                        />
                                        <FormControl.Feedback />
                                    </Col>
                                </FormGroup>
                                {
                                    this.props.complexBmpForm ?
                                        <React.Fragment>
                                            <FormGroup controlId="formControlsSelectGroupProfile" bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                  Organization
                                                </Col>
                                                <Col sm={8}>
                                                    <FormControl
                                                        inline="true"
                                                        componentClass="select"
                                                        name="group_profile"
                                                        value={this.props.storedBmpForm?.group_profile?.pk}
                                                        onChange={this.handleGroupProfileChange}
                                                    >
                                                        {this.props.allowedGroupProfiles.map((groupProfile) => {
                                                            return (
                                                                <option
                                                                    key={groupProfile.pk}
                                                                    value={groupProfile?.pk}
                                                                >
                                                                    {groupProfile.title}
                                                                </option>
                                                            );
                                                        })}
                                                    </FormControl>
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="formControlsSelectStatus" bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                  BMP Status
                                                </Col>
                                                <Col sm={8}>
                                                    <FormControl
                                                        inline="true"
                                                        componentClass="select"
                                                        name="status"
                                                        value={this.props.storedBmpForm?.status}
                                                        onChange={this.handleChange}
                                                    >
                                                        <option key={'Unknown'} value={'Unknown'}>{'Unknown'}</option>
                                                        {this.props.statuses
                                                            .filter(status => status !== 'Unknown')
                                                            .map(status => <option key={status} value={status}>{status}</option>)
                                                        }
                                                    </FormControl>
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="formControlsSelectPriority" bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={3} style={{textAlign: "left"}}>
                                                  BMP Priority
                                                </Col>
                                                <Col sm={8}>
                                                    <FormControl
                                                        inline="true"
                                                        componentClass="select"
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
                                                    </FormControl>
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="n_surface_red_percent" validationState={this.validateRatio("n_surface_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Surface Nitrogen Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_n_surface_red_percent"
                                                        value={this.props.storedBmpForm?.override_n_surface_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="p_surface_red_percent" validationState={this.validateRatio("p_surface_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Surface Phosphorus Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_p_surface_red_percent"
                                                        value={this.props.storedBmpForm?.override_p_surface_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="s_surface_red_percent" validationState={this.validateRatio("s_surface_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Surface Sediment Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_s_surface_red_percent"
                                                        value={this.props.storedBmpForm?.override_s_surface_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="n_tiled_red_percent" validationState={this.validateRatio("n_tiled_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Tiled Nitrogen Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_n_tiled_red_percent"
                                                        value={this.props.storedBmpForm?.override_n_tiled_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="p_tiled_red_percent" validationState={this.validateRatio("p_tiled_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Tiled Phospohorus Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_p_tiled_red_percent"
                                                        value={this.props.storedBmpForm?.override_p_tiled_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="n_erosion_red_percent" validationState={this.validateRatio("n_erosion_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Erosion Nitrogen Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_n_erosion_red_percent"
                                                        value={this.props.storedBmpForm?.override_n_erosion_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="p_erosion_red_percent" validationState={this.validateRatio("p_erosion_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Erosion Phospohorus Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_p_erosion_red_percent"
                                                        value={this.props.storedBmpForm?.override_p_erosion_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="s_erosion_red_percent" validationState={this.validateRatio("s_erosion_red_percent")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Erosion Sediment Reduction Percentage
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type="number"
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_s_erosion_red_percent"
                                                        value={this.props.storedBmpForm?.override_s_erosion_red_percent}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="cost_base" validationState={this.validateCost("cost_base")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Base Cost ($)
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type={"number"}
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_cost_base"
                                                        value={this.props.storedBmpForm?.override_cost_base}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="cost_rate_per_footprint_area" validationState={this.validateCost("cost_rate_per_footprint_area")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Footprint Cost ($/acre)
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type={"number"}
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_cost_rate_per_footprint_area"
                                                        value={this.props.storedBmpForm?.override_cost_rate_per_footprint_area}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                            <FormGroup controlId="cost_rate_per_watershed_area" validationState={this.validateCost("cost_rate_per_watershed_area")} bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={6}>
                                                  Watershed Cost ($/acre)
                                                </Col>
                                                <Col sm={5}>
                                                    <FormControl
                                                        inline="true"
                                                        type={"number"}
                                                        step={0.01}
                                                        precision={2}
                                                        name="override_cost_rate_per_watershed_area"
                                                        value={this.props.storedBmpForm?.override_cost_rate_per_watershed_area}
                                                        onChange={this.handleChange}
                                                    />
                                                    <FormControl.Feedback />
                                                </Col>
                                            </FormGroup>
                                        </React.Fragment>
                                        : null
                                }
                                <FormGroup controlId="notes" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={3} style={{padding: "20px", textAlign: "left"}}>
                                      Notes
                                    </Col>
                                    <Col sm={12}>
                                        <FormControl
                                            inline="true"
                                            type="textarea"
                                            componentClass="textarea"
                                            name="notes"
                                            value={this.props.storedBmpForm?.notes}
                                            onChange={this.handleChange}
                                        />
                                        <FormControl.Feedback />
                                    </Col>
                                </FormGroup>
                            </Form>
                        </Col>
                        <Col sm={6} style={{padding: "10px"}}>
                            {
                                !this.props.storedBmpForm?.id || this.props.changingBmpType ?
                                    <React.Fragment>
                                        {this.props.changingBmpType ?
                                            <Button
                                                bsStyle="success"
                                                bsSize="small"
                                                style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "220px", minWidth: "80px"}}
                                                onClick={() => this.props.setChangingBmpType(false)}>
                                                Accept
                                            </Button> : null}
                                        <Form horizontal>
                                            <FormGroup controlId="formControlsSelectBmp" bsSize={"small"}>
                                                <Col componentClass={ControlLabel} sm={12} style={{textAlign: "left"}}>
                                                    <FormControl
                                                        componentClass="radio"
                                                        style={{border: "none", boxShadow: "none"}}
                                                        type="radio"
                                                        name="bmpName"
                                                        onChange={this.handleBmpChange}
                                                    >
                                                        {this.props.bmpTypeGroups?.map((group) => {
                                                            return (
                                                                <Row className={'well'} style={{textAlign: "left", marginLeft: 0}}>
                                                                    <div>{group[1]}</div>
                                                                    {
                                                                        this.props.bmpTypes
                                                                            .filter(bmpType => bmpType.group_name === group[0])
                                                                            .map(bmpType => {
                                                                                return (
                                                                                    <Col sm={6}>
                                                                                        <Radio
                                                                                            name="bmpName"
                                                                                            value={bmpType.name}
                                                                                            style={{textAlign: "left"}}
                                                                                            inline
                                                                                        >
                                                                                            {bmpType.name}
                                                                                        </Radio>
                                                                                    </Col>
                                                                                );
                                                                            })
                                                                    }
                                                                </Row>
                                                            );
                                                        })}
                                                    </FormControl>
                                                </Col>
                                            </FormGroup>
                                        </Form>
                                    </React.Fragment> :
                                    this.props.complexBmpForm ?
                                        <Table bordered condensed hover className={"text-right"} style={{tableLayout: "fixed"}}>
                                            <thead>
                                                <tr>
                                                    <th style={{"width": "30%"}}>Results</th>
                                                    <th style={{"width": "10%"}}>Surface</th>
                                                    <th style={{"width": "10%"}}>Tiled</th>
                                                    <th style={{"width": "10%"}}>Erosion</th>
                                                    <th style={{"width": "10%"}}>Total</th>
                                                    <th style={{"width": "30%"}}/>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{borderTop: "4px solid lightgrey"}}>
                                                    <td>Nitrogen load previous: </td>
                                                    <td>{this.props.storedBmpForm?.surface_previous_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_previous_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_previous_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_previous_n_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Nitrogen load reduction: </td>
                                                    <td>{this.props.storedBmpForm?.surface_n_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_n_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_n_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_n_load_reduction?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Nitrogen load new: </td>
                                                    <td>{this.props.storedBmpForm?.surface_new_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_new_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_new_n_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_new_n_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr style={{borderTop: "4px solid lightgrey"}}>
                                                    <td>Phosphorus load previous: </td>
                                                    <td>{this.props.storedBmpForm?.surface_previous_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_previous_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_previous_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_previous_p_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Phosphorus load reduction: </td>
                                                    <td>{this.props.storedBmpForm?.surface_p_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_p_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_p_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_p_load_reduction?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Phosphorus load new: </td>
                                                    <td>{this.props.storedBmpForm?.surface_new_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_new_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_new_p_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_new_p_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>lbs/year</td>
                                                </tr>
                                                <tr style={{borderTop: "4px solid lightgrey"}}>
                                                    <td>Sediment load previous: </td>
                                                    <td>{this.props.storedBmpForm?.surface_previous_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_previous_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_previous_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_previous_s_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>tons/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Sediment load reduction: </td>
                                                    <td>{this.props.storedBmpForm?.surface_s_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_s_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_s_load_reduction?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_s_load_reduction?.toFixed(0)}</td>
                                                    <td className={"text-left"}>tons/year</td>
                                                </tr>
                                                <tr style={{borderBottom: "4px solid lightgrey"}}>
                                                    <td>Sediment load new: </td>
                                                    <td>{this.props.storedBmpForm?.surface_new_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.tiled_new_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.erosion_new_s_load?.toFixed(0)}</td>
                                                    <td>{this.props.storedBmpForm?.total_new_s_load?.toFixed(0)}</td>
                                                    <td className={"text-left"}>tons/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Calculated total cost: </td>
                                                    {this.props.storedBmpForm?.calculated_total_cost ?
                                                        <td>${Number(this.props.storedBmpForm?.calculated_total_cost?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td/>
                                                </tr>
                                                <tr>
                                                    <td>Nitrogen reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_lbs_n_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_n_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/lb/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Phosphorus reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_lbs_p_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_p_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/lb/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Sediment reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_ton_s_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_ton_s_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/ton/year</td>
                                                </tr>
                                            </tbody>
                                        </Table> :
                                        <Table bordered condensed hover className={"text-right"}>
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
                                                <tr>
                                                    <td>Calculated total cost: </td>
                                                    {this.props.storedBmpForm?.calculated_total_cost ?
                                                        <td>${Number(this.props.storedBmpForm?.calculated_total_cost?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td/>
                                                </tr>
                                                <tr>
                                                    <td>Nitrogen reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_lbs_n_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_n_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/lb/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Phosphorus reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_lbs_p_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_lbs_p_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/lb/year</td>
                                                </tr>
                                                <tr>
                                                    <td>Sediment reduction cost: </td>
                                                    {this.props.storedBmpForm?.total_cost_per_ton_s_reduced ?
                                                        <td>{Number(this.props.storedBmpForm?.total_cost_per_ton_s_reduced?.toFixed(0)).toLocaleString()}</td> :
                                                        <td/>}
                                                    <td className={"text-left"}>$/ton/year</td>
                                                </tr>
                                            </tbody>
                                        </Table>
                            }
                        </Col>
                    </Modal.Body>
                    <Modal.Footer style={{marginTop: "78vh", borderTop: "none"}}>
                        {this.props.complexBmpForm || !this.props.storedBmpForm?.id || this.props.changingBmpType ?
                            <Row style={{paddingLeft: "20px", textAlign: "left"}}>
                                <h5 style={{position: "absolute", bottom: "70px"}}>More Information from NRCS documents:</h5>
                                <Row>
                                    <a
                                        href={this.props.infosheet_url}
                                        className={`btn btn-info btn-small ${this.props.infosheet_url ? "" : "disabled"}`}
                                        style={{
                                            position: "absolute",
                                            left: "20px",
                                            bottom: "20px",
                                            paddingTop: "10px",
                                            width: "80px",
                                            whiteSpace: "normal",
                                            fontSize: "14px"
                                        }}
                                        target="_blank"
                                        download
                                    >
                                        Stardards Overview
                                    </a>
                                    <a
                                        href={this.props.standard_url}
                                        className={`btn btn-info btn-small ${this.props.standard_url ? "" : "disabled"}`}
                                        style={{
                                            position: "absolute",
                                            left: "120px",
                                            bottom: "20px",
                                            paddingTop: "10px",
                                            width: "80px",
                                            whiteSpace: "normal",
                                            fontSize: "14px"
                                        }}
                                        target="_blank"
                                        download
                                    >
                                        Detailed Standard
                                    </a>
                                    <a
                                        href={this.props.ned_url}
                                        className={`btn btn-info btn-small ${this.props.ned_url ? "" : "disabled"}`}
                                        style={{
                                            position: "absolute",
                                            left: "220px",
                                            bottom: "20px",
                                            paddingTop: "10px",
                                            width: "80px",
                                            whiteSpace: "normal",
                                            fontSize: "14px"
                                        }}
                                        target="_blank"
                                        download
                                    >
                                        Effects Network
                                    </a>
                                    <a
                                        href={this.props.cppe_url}
                                        className={`btn btn-info btn-small ${this.props.cppe_url ? "" : "disabled"}`}
                                        style={{
                                            position: "absolute",
                                            left: "320px",
                                            bottom: "20px",
                                            paddingTop: "10px",
                                            width: "80px",
                                            whiteSpace: "normal",
                                            fontSize: "14px"
                                        }}
                                        target="_blank"
                                        download
                                    >
                                        Effects Data
                                    </a>
                                </Row>
                            </Row>
                            : null}
                        {this.props.storedBmpForm?.id ?
                            <React.Fragment>
                                <Button
                                    bsStyle="danger"
                                    bsSize="small"
                                    style={{position: "absolute", bottom: "20px", right: "520px", minWidth: "80px"}}
                                    onClick={() => {
                                        if (window.confirm('This action can not be undone. Are you sure?')) {
                                            this.props.deleteBmp(this.props.mapId, this.props.storedBmpForm?.id);
                                        }
                                    }}>
                                    Delete
                                </Button>
                                <Button
                                    bsStyle="warning"
                                    bsSize="small"
                                    style={{position: "absolute", bottom: "20px", right: "420px", minWidth: "80px"}}
                                    onClick={() => {
                                        if (window.confirm('This will remove any custom data you have entered for the current BMP Type. Are you sure?')) {
                                            this.props.setChangingBmpType(true);
                                        }
                                    }}>
                                    Edit Type
                                </Button>
                                <Button
                                    bsStyle="info"
                                    bsSize="small"
                                    style={{position: "absolute", bottom: "20px", right: "220px", minWidth: "80px"}}
                                    onClick={() => { this.props.downloadBmpReport(this.props.storedBmpForm?.id);}}>
                                    Make PDF
                                </Button>
                                {
                                    this.props.complexBmpForm ?
                                        <Button
                                            bsStyle="info"
                                            bsSize="small"
                                            style={{position: "absolute", bottom: "20px", right: "320px", minWidth: "80px"}}
                                            onClick={() => this.props.setComplexBmpForm(false)}>
                                            Simple
                                        </Button>
                                        :
                                        <Button
                                            bsStyle="info"
                                            bsSize="small"
                                            style={{position: "absolute", bottom: "20px", right: "320px", minWidth: "80px"}}
                                            onClick={() => this.props.setComplexBmpForm(true)}>
                                            Advanced
                                        </Button>
                                }
                            </React.Fragment>
                            : null}
                        <Button
                            bsStyle="info"
                            bsSize="small"
                            style={{position: "absolute", bottom: "20px", right: "120px", minWidth: "80px"}}
                            onClick={() => {
                                this.props.hideBmpForm();
                                this.refreshBmpLayers();
                            }}>
                            View Map
                        </Button>
                        <Button
                            bsStyle="success"
                            bsSize="small"
                            className={this.props.hasGeometry ? '' : 'disabled'}
                            style={{position: "absolute", bottom: "20px", right: "20px", minWidth: "80px"}}
                            onClick={() => {
                                this.props.submitBmpForm(this.props.storedBmpForm, this.props.mapId);
                            }}>
                            Save
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
            bmpType => bmpType.name === fieldValue
        )[0];
        this.props.makeDefaultsBmpForm(selectedBmpType);
    }
    drawBmpStep1(layerName, featureId) {
        this.refreshBmpLayers();
        this.props.hideBmpForm();
        const targetLayer = this.props.layers.flat.filter(layer => layer?.name.includes(layerName))[0];
        console.log('drawBmpStep1 targetLayer', targetLayer);
        console.log('drawBmpStep1 layerName', layerName);
        console.log('drawBmpStep1 featureId', featureId);
        this.props.setDrawingBmpLayerName(layerName);
        featureId ? this.props.setEditingBmpFeatureId(featureId) : this.props.clearEditingBmpFeatureId();
        this.props.toggleLayer(targetLayer.id, true);
        this.props.setLayer(targetLayer?.id);
        this.props.featureTypeSelected('http://localhost:8080/geoserver/wfs', targetLayer?.name);
        console.log('drawBmpStep1 finished');
    }
    refreshBmpLayers() {
        this.props.refreshLayerVersion(this.props.bmpOutletLayer.id);
        this.props.refreshLayerVersion(this.props.bmpFootprintLayer.id);
        this.props.refreshLayerVersion(this.props.bmpWatershedLayer.id);
    }
}

const mapStateToProps = (state) => {
    const allowedGroupProfileNames = state?.security?.user?.info?.groups.filter(item => !["anonymous", "registered-members", "admin", "swamm-users"].includes(item));
    const allowedGroupProfiles = state?.swamm?.groupProfiles.filter(item=> allowedGroupProfileNames.includes(item.slug));
    return {
        mapId: state?.swamm?.data?.base_map,
        projectData: state?.swamm?.data,
        bmpUniqueNames: bmpByUniqueNameSelector(state).map(bmpType => bmpType.name),
        bmpTypes: state?.swamm?.bmpTypes,
        bmpTypeGroups: state?.swamm?.bmpTypeGroups || [],
        allowedGroupProfiles: allowedGroupProfiles,
        defaultGroupProfile: allowedGroupProfileNames[0],
        statuses: state?.swamm?.statuses,
        priorities: state?.swamm?.priorities,
        thisBmpType: state?.swamm?.bmpTypes.filter((bmpType) => bmpType.id === state?.swamm?.BmpFormBmpTypeId)[0],
        storedBmpForm: state?.swamm?.storedBmpForm || {},
        complexBmpForm: state?.swamm?.complexBmpForm || false,
        bmpOutletLayer: state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.data?.code + "_bmp_outlet"))[0],
        bmpFootprintLayer: state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.data?.code + "_bmp_footprint"))[0],
        bmpWatershedLayer: state?.layers?.flat?.filter((layer) => layer.name.includes(state?.swamm?.data?.code + "_bmp_watershed"))[0],
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
        submitBmpForm: (newBmp, mapId) => dispatch(submitBmpForm(newBmp, mapId)),
        updateBmpForm: (kv) => dispatch(updateBmpForm(kv)),
        clearBmpForm: () => dispatch(clearBmpForm()),
        deleteBmp: (mapId, bmpId) => dispatch(deleteBmp(mapId, bmpId)),
        makeDefaultsBmpForm: (bmpType) => dispatch(makeDefaultsBmpForm(bmpType)),
        setChangingBmpType: (changingBmpType) => dispatch(setChangingBmpType(changingBmpType)),
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

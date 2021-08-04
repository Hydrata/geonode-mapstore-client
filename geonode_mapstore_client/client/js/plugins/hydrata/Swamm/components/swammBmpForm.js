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
                    <Modal.Body style={{padding: 0}}>
                        <Col sm={6} style={{padding: "10px"}}>
                            <Form horizontal>
                                <FormGroup controlId="formControlsSelectgroupProfile" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
                                      Organization
                                    </Col>
                                    {this.props.storedBmpForm.id ?
                                        <Col sm={5}>
                                            <FormControl
                                                inline="true"
                                                readOnly="true"
                                                type={"string"}
                                                value={this.props.storedBmpForm?.group_profile?.title}
                                            />
                                        </Col> :
                                        <Col sm={5}>
                                            <FormControl
                                                inline="true"
                                                componentClass="select"
                                                name="groupProfile"
                                                value={JSON.stringify(this.props.storedBmpForm?.group_profile)}
                                                onChange={this.handlegroupProfileChange}
                                            >
                                                <option key="1" value="select">Select Organization</option>
                                                {this.props.groupProfiles.map((groupProfile) => {
                                                    return <option key={groupProfile.id} value={JSON.stringify(groupProfile)}>{groupProfile.title}</option>;
                                                })}
                                            </FormControl>
                                            <FormControl.Feedback />
                                        </Col>
                                    }
                                </FormGroup>
                                <FormGroup controlId="formControlsSelectBmp" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
                                      BMP Type
                                    </Col>
                                    {this.props.storedBmpForm.id ?
                                        <Col sm={5}>
                                            <FormControl
                                                inline="true"
                                                readOnly="true"
                                                type={"string"}
                                                value={this.props.storedBmpForm?.bmpName}
                                            />
                                        </Col> :
                                        <Col sm={5}>
                                            <FormControl
                                                inline="true"
                                                componentClass="select"
                                                name="bmpName"
                                                value={this.props.storedBmpForm?.bmpName}
                                                onChange={this.handleBmpChange}
                                            >
                                                <option key="1" value="select">Select BMP Type</option>
                                                {this.props.bmpUniqueNames.map((bmpName) => {
                                                    return <option key={bmpName} value={bmpName}>{bmpName}</option>;
                                                })}
                                            </FormControl>
                                            <FormControl.Feedback />
                                        </Col>}
                                </FormGroup>
                                <FormGroup controlId="formControlsSelectStatus" bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
                                      BMP Status
                                    </Col>
                                    <Col sm={5}>
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
                                <FormGroup controlId="outlet_fid" validationState={this.validateFid("outlet_fid")} bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
                                        Outlet Point:
                                    </Col>
                                    {this.props.storedBmpForm?.outlet_fid ?
                                        <Col sm={1}>
                                            <Button
                                                className={"pull-right"}
                                                bsStyle={"info"}
                                                style={{opacity: "0.7"}}
                                                onClick={() => this.drawBmpStep1(this.props?.projectData?.code + '_bmp_outlet', this.props.storedBmpForm?.outlet_fid)}>
                                            Edit
                                            </Button>
                                        </Col> :
                                        <Col sm={5}>
                                            <Button
                                                disabled={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName)}
                                                bsStyle={(!this.props.storedBmpForm?.group_profile_id || !this.props.storedBmpForm.bmpName) ? "default" : "success" }
                                                style={{opacity: "0.7"}}
                                                onClick={() => this.drawBmpStep1(this.props.projectData?.code + '_bmp_outlet', null)}>
                                            Locate Outlet
                                            </Button>
                                        </Col>
                                    }
                                </FormGroup>
                                <FormGroup controlId="footprint_fid" validationState={this.validateFid("footprint_fid")} bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
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
                                                    onClick={() => this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint', this.props.storedBmpForm?.footprint_fid)}>
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
                                                    onClick={() => this.drawBmpStep1(this.props?.projectData?.code + '_bmp_footprint')}>
                                                Draw footprint
                                                </Button>
                                            </Col>
                                        </React.Fragment>
                                    }
                                </FormGroup>
                                <FormGroup controlId="watershed_fid" validationState={this.validateFid("watershed_fid")} bsSize={"small"}>
                                    <Col componentClass={ControlLabel} sm={6}>
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
                                                    onClick={() => this.drawBmpStep1(this.props?.projectData?.code + '_bmp_watershed', this.props.storedBmpForm?.watershed_fid)}>
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
                                                    onClick={() => this.drawBmpStep1(this.props?.projectData?.code + '_bmp_watershed')} bsSize={"small"}>
                                                Draw watershed
                                                </Button>
                                            </Col>
                                        </React.Fragment>
                                    }
                                </FormGroup>
                            </Form>
                        </Col>
                        <Col sm={6} style={{padding: "10px"}}>
                            <Table bordered condensed hover className={"text-right"}>
                                <thead>
                                    <tr>
                                        <th>Results</th>
                                        <th style={{"width": "100px"}}>Surface</th>
                                        <th style={{"width": "100px"}}>Tiled</th>
                                        <th style={{"width": "100px"}}>Erosion</th>
                                        <th style={{"width": "100px"}}>Total</th>
                                        <th/>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Previous nitrogen load: </td>
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
                                        <td>New nitrogen load: </td>
                                        <td>{this.props.storedBmpForm?.surface_new_n_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.tiled_new_n_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.erosion_new_n_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.total_new_n_load?.toFixed(0)}</td>
                                        <td className={"text-left"}>lbs/year</td>
                                    </tr>
                                    <tr>
                                        <td>Previous phosphorus load: </td>
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
                                        <td>New phosphorus load: </td>
                                        <td>{this.props.storedBmpForm?.surface_new_p_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.tiled_new_p_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.erosion_new_p_load?.toFixed(0)}</td>
                                        <td>{this.props.storedBmpForm?.total_new_p_load?.toFixed(0)}</td>
                                        <td className={"text-left"}>lbs/year</td>
                                    </tr>
                                    <tr>
                                        <td>Previous sediment load: </td>
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
                                    <tr>
                                        <td>New sediment load: </td>
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
                            </Table>
                            <FormGroup controlId="notes" bsSize={"small"}>
                                <Col componentClass={ControlLabel} sm={3}>
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
                            {this.props.storedBmpForm?.created_by ?
                                <Col sm={12}>Created by: {this.props.storedBmpForm?.created_by} on {new Date(this.props.storedBmpForm?.created_at).toLocaleString()}</Col> :
                                null
                            }
                            {this.props.storedBmpForm?.updated_by ?
                                <Col sm={12}>Updated by: {this.props.storedBmpForm?.updated_by} on {new Date(this.props.storedBmpForm?.updated_at).toLocaleString()}</Col> :
                                null
                            }
                        </Col>
                    </Modal.Body>
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

import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Table, ControlLabel, FormControl, FormGroup, Form, Col, Grid, Row} from "react-bootstrap";
import {
    hideTargetForm,
    deleteTarget,
    clearTargetForm,
    submitTargetForm,
    updateTargetForm
} from "../actionsSwamm";
import "../../Swamm/swamm.css";

class SwammTargetFormClass extends React.Component {
    static propTypes = {
        mapId: PropTypes.number,
        targetForm: PropTypes.object,
        hideTargetForm: PropTypes.func,
        deleteTarget: PropTypes.func,
        clearTargetForm: PropTypes.func,
        submitTargetForm: PropTypes.func,
        updateTargetForm: PropTypes.func,
        groupProfiles: PropTypes.array,
        bmpTypes: PropTypes.array,
        statuses: PropTypes.array
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.handleMultiSelection = this.handleMultiSelection.bind(this);
        this.state = {};
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <React.Fragment>
                <Modal
                    show
                    onHide={() => this.props.hideTargetForm()}
                    style={{
                        marginTop: "50px",
                        fontSize: "small"
                    }}
                    dialogClassName="swamm-big-modal"
                    backdrop={false}
                    enforceFocus={false}
                    scrollable="true"
                >
                    <Modal.Header>
                        <Modal.Title>
                            {this.props.targetForm.id ?
                                "Edit Target: " + this.props.targetForm?.name :
                                "Create a new Target"
                            }
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{padding: "20px"}}>
                        <Grid>
                            <Col sm={6}>
                                <Row className={'well'} style={{paddingTop: "10px", margin: "5px"}}>
                                    <h4 style={{paddingTop: "5px", paddingBottom: "20px", margin: "0", textAlign: "center", fontSize: "14px"}}>Target Details:</h4>
                                    <FormGroup controlId="target_name" bsSize={"small"}>
                                        <Row>
                                            <Col componentClass={ControlLabel} sm={3} style={{marginTop: "3px"}}>
                                              Name:
                                            </Col>
                                            <Col sm={9}>
                                                <FormControl
                                                    inline="true"
                                                    type="text"
                                                    name="name"
                                                    value={this.props.targetForm?.name}
                                                    onChange={this.handleChange}
                                                />
                                                <FormControl.Feedback />
                                            </Col>
                                        </Row>
                                    </FormGroup>
                                    <FormGroup controlId="target_description" bsSize={"small"}>
                                        <Row>
                                            <Col componentClass={ControlLabel} sm={3} style={{marginTop: "3px"}}>
                                              Description:
                                            </Col>
                                            <Col sm={9}>
                                                <FormControl
                                                    componentClass={"textarea"}
                                                    inline="true"
                                                    type="textarea"
                                                    name="description"
                                                    value={this.props.targetForm?.description}
                                                    onChange={this.handleChange}
                                                />
                                                <FormControl.Feedback />
                                            </Col>
                                        </Row>
                                    </FormGroup>
                                </Row>
                                <Row className={'well'} style={{paddingTop: "10px", margin: "5px"}}>
                                    <h4 style={{paddingTop: "5px", paddingBottom: "20px", margin: "0", textAlign: "center", fontSize: "14px"}}>Establish Targets:</h4>
                                    <FormGroup controlId="target_percent_n_reduction" validationState={this.validatePercentage("target_percent_n_reduction")} bsSize={"small"}>
                                        <Row>
                                            <Col componentClass={ControlLabel} sm={3} style={{marginTop: "3px"}}>
                                              Nitrogen:
                                            </Col>
                                            <Col sm={5}>
                                                <FormControl
                                                    inline="true"
                                                    type="number"
                                                    step={1}
                                                    precision={0}
                                                    name="target_percent_n_reduction"
                                                    value={this.props.targetForm?.target_percent_n_reduction * 100}
                                                    onChange={this.handleChange}
                                                />
                                                <FormControl.Feedback />
                                            </Col>
                                            <Col sm={3} style={{marginTop: "3px"}}>% reduction</Col>
                                        </Row>
                                    </FormGroup>
                                    <FormGroup controlId="target_percent_p_reduction" validationState={this.validatePercentage("target_percent_p_reduction")} bsSize={"small"}>
                                        <Row>
                                            <Col componentClass={ControlLabel} sm={3} style={{marginTop: "3px"}}>
                                              Phosphorus:
                                            </Col>
                                            <Col sm={5}>
                                                <FormControl
                                                    inline="true"
                                                    type="number"
                                                    step={1}
                                                    precision={0}
                                                    name="target_percent_p_reduction"
                                                    value={this.props.targetForm?.target_percent_p_reduction * 100}
                                                    onChange={this.handleChange}
                                                />
                                                <FormControl.Feedback />
                                            </Col>
                                            <Col sm={3} style={{marginTop: "3px"}}>% reduction</Col>
                                        </Row>
                                    </FormGroup>
                                    <FormGroup controlId="target_percent_s_reduction" validationState={this.validatePercentage("target_percent_s_reduction")} bsSize={"small"}>
                                        <Row>
                                            <Col componentClass={ControlLabel} sm={3} style={{marginTop: "3px"}}>
                                              Sediment:
                                            </Col>
                                            <Col sm={5}>
                                                <FormControl
                                                    inline="true"
                                                    type="number"
                                                    step={1}
                                                    precision={0}
                                                    name="target_percent_s_reduction"
                                                    value={this.props.targetForm?.target_percent_s_reduction * 100}
                                                    onChange={this.handleChange}
                                                />
                                                <FormControl.Feedback />
                                            </Col>
                                            <Col sm={3} style={{marginTop: "3px"}}>% reduction</Col>
                                        </Row>
                                    </FormGroup>
                                </Row>
                            </Col>
                            <Col sm={6}>
                                <Row className={'well'} style={{paddingTop: "10px", margin: "5px"}}>
                                    <h4 style={{paddingTop: "5px", paddingBottom: "20px", margin: "0", textAlign: "center", fontSize: "14px"}}>Include BMPs from these organizations:</h4>
                                    <FormGroup controlId="target_groupProfiles" bsSize={"small"}>
                                        <Row>
                                            <FormControl
                                                componentClass="select"
                                                multiple
                                                inline="true"
                                                name="group_profiles"
                                                value={this.props.targetForm?.group_profiles}
                                                onChange={this.handleMultiSelection}
                                                style={{height: "200px"}}
                                            >
                                                {
                                                    this.props.groupProfiles?.map((groupProfile) =>
                                                        <option value={groupProfile.pk}>{groupProfile.title}</option>
                                                    )
                                                }
                                            </FormControl>
                                            <FormControl.Feedback />
                                        </Row>
                                    </FormGroup>
                                </Row>
                                <Row className={'well'} style={{paddingTop: "10px", margin: "5px"}}>
                                    <h4 style={{paddingTop: "5px", paddingBottom: "20px", margin: "0", textAlign: "center", fontSize: "14px"}}>Include these BMP types:</h4>
                                    <FormGroup controlId="target_bmp_types" bsSize={"small"}>
                                        <Row>
                                            <FormControl
                                                componentClass="select"
                                                multiple
                                                inline="true"
                                                name="bmp_types"
                                                value={this.props.targetForm?.bmp_types}
                                                onChange={this.handleMultiSelection}
                                                style={{height: "200px"}}
                                            >
                                                {
                                                    this.props.bmpTypes?.map((bmpType) =>
                                                        <option value={bmpType.id}>{bmpType.name}</option>
                                                    )
                                                }
                                            </FormControl>
                                            <FormControl.Feedback />
                                        </Row>
                                    </FormGroup>
                                </Row>
                                <Row className={'well'} style={{paddingTop: "10px", margin: "5px"}}>
                                    <h4 style={{paddingTop: "5px", paddingBottom: "20px", margin: "0", textAlign: "center", fontSize: "14px"}}>Include these BMP statuses:</h4>
                                    <FormGroup controlId="target_bmp_statuses" bsSize={"small"}>
                                        <Row>
                                            <FormControl
                                                componentClass="select"
                                                multiple
                                                inline="true"
                                                name="statuses"
                                                value={this.props.targetForm?.statuses}
                                                onChange={this.handleMultiSelection}
                                                style={{height: "200px"}}
                                            >
                                                {
                                                    this.props.statuses?.map((status) =>
                                                        <option value={status.name}>{status.name}</option>
                                                    )
                                                }
                                            </FormControl>
                                            <FormControl.Feedback />
                                        </Row>
                                    </FormGroup>
                                </Row>
                            </Col>
                        </Grid>
                    </Modal.Body>
                    <Modal.Footer style={{minHeight: "100px"}}>
                        {
                            this.props.targetForm?.id ?
                                <Button
                                    bsStyle="danger"
                                    bsSize="small"
                                    style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "220px", minWidth: "80px"}}
                                    onClick={() => {
                                        if (window.confirm('This action can not be undone. Are you sure?')) {
                                            this.props.deleteTarget(this.props.mapId, this.props.targetForm?.id);
                                        }
                                    }}>
                                    Delete Target
                                </Button> :
                                null
                        }
                        <Button
                            bsStyle="danger"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "120px", minWidth: "80px"}}
                            onClick={() => this.props.hideTargetForm()}>
                            Close
                        </Button>
                        <Button
                            bsStyle="success"
                            bsSize="small"
                            style={{opacity: "0.7", position: "absolute", bottom: "20px", right: "20px", minWidth: "80px"}}
                            onClick={() => {
                                this.props.submitTargetForm(this.props.targetForm, this.props.mapId);
                            }}>
                            Save Target
                        </Button>
                    </Modal.Footer>
                </Modal>
            </React.Fragment>
        );
    }
    handleMultiSelection(event) {
        const fieldName = event.target.name;
        let fieldValue = Array.from(event.target.selectedOptions, option => option.value);
        let kv = {[fieldName]: fieldValue};
        this.props.updateTargetForm(kv);
    }
    handleChange(event) {
        const fieldName = event.target.name;
        let fieldValue = event.target.value;
        let kv = {[fieldName]: fieldValue};
        if (event.target.type === 'number' && event.target.name.includes('target_percent_'))  {
            kv = {[fieldName]: parseFloat(fieldValue) / 100};
        }
        this.props.updateTargetForm(kv);
    }
    validatePercentage(percentageName) {
        const percentage = this.props.targetForm[percentageName];
        if (percentage < 1 && percentage > 0) return 'success';
        if (percentage === 1) return 'warning';
        if (percentage > 1 || percentage < 0) return 'error';
        return null;
    }
}

const mapStateToProps = (state) => {
    return {
        mapId: state?.swamm?.data?.base_map,
        bmpTypes: state?.swamm?.bmpTypes,
        statuses: state?.swamm?.statuses,
        targetForm: state?.swamm?.targetForm || {},
        groupProfiles: state?.swamm?.groupProfiles
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideTargetForm: () => dispatch(hideTargetForm()),
        deleteTarget: (mapId, targetFormId) => dispatch(deleteTarget(mapId, targetFormId)),
        clearTargetForm: () => dispatch(clearTargetForm()),
        submitTargetForm: (targetForm, mapId) => dispatch(submitTargetForm(targetForm, mapId)),
        updateTargetForm: (kv) => dispatch(updateTargetForm(kv))
    };
};

const SwammTargetForm = connect(mapStateToProps, mapDispatchToProps)(SwammTargetFormClass);


export {
    SwammTargetForm
};

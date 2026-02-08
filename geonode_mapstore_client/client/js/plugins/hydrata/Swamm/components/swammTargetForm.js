import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {ControlLabel, FormControl, FormGroup} from "react-bootstrap";
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
        projectId: PropTypes.number,
        targetForm: PropTypes.object,
        hideTargetForm: PropTypes.func,
        deleteTarget: PropTypes.func,
        clearTargetForm: PropTypes.func,
        submitTargetForm: PropTypes.func,
        updateTargetForm: PropTypes.func,
        viewableGroupProfiles: PropTypes.array,
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
            <div
                id={'swamm-target-form-panel'}
                className={'simple-view-panel menu-rows-container'}
            >
                <div id={"swamm-target-form-header"}>
                    <div className={"swamm-bmp-chart-heading"}>
                        {this.props.targetForm.id ?
                            "Edit Target: " + this.props.targetForm?.name :
                            "Create a new Target"
                        }
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.hideTargetForm();
                        }}
                    />
                </div>
                <div id={"swamm-target-form-body"}>
                    <div id={"swamm-target-form-col-one"}>
                        <div className={"swamm-target-row"}>
                            <div
                                style={{marginRight: "15px"}}
                            >
                             Target Name:
                            </div>
                            <input
                                type="text"
                                name="name"
                                style={{
                                    width: "200px",
                                    maxWidth: "200px",
                                    textAlign: "left"
                                }}
                                value={this.props.targetForm?.name}
                                onChange={this.handleChange}
                            />
                        </div>
                        <div className={"swamm-target-row"}>
                            <div>
                              Description:
                            </div>
                        </div>
                        <div className={"swamm-target-row"}>
                            <textarea
                                id={'swamm-target-description-textarea'}
                                style={{boderRadius: "4px", marginBottom: "15px"}}
                                rows={4}
                                cols={50}
                                name="description"
                                value={this.props.targetForm?.description}
                                onChange={this.handleChange}
                            />
                        </div>
                        <div id={"swamm-target-percentages"}>
                            <div className={"swamm-target-form-heading"}>
                                Set Targets:
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  Nitrogen:
                                </div>
                                <input
                                    type="number"
                                    step={1}
                                    name="target_percent_n_reduction"
                                    value={(this.props.targetForm?.target_percent_n_reduction * 100).toFixed(0)}
                                    onChange={this.handleChange}
                                />
                                <div
                                    style={{marginLeft: "4px"}}
                                >
                                    % reduction
                                </div>
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  Phosphorus:
                                </div>
                                <input
                                    type="number"
                                    step={1}
                                    name="target_percent_p_reduction"
                                    value={(this.props.targetForm?.target_percent_p_reduction * 100).toFixed(0)}
                                    onChange={this.handleChange}
                                />
                                <div
                                    style={{marginLeft: "4px"}}
                                >
                                    % reduction
                                </div>
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  Sediment:
                                </div>
                                <input
                                    type="number"
                                    step={1}
                                    name="target_percent_s_reduction"
                                    value={(this.props.targetForm?.target_percent_s_reduction * 100).toFixed(0)}
                                    onChange={this.handleChange}
                                />
                                <div
                                    style={{marginLeft: "4px"}}
                                >
                                    % reduction
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id={"swamm-target-form-col-two"}>
                        <div className={"swamm-target-form-heading"}>
                            Include BMPs from these organizations:
                        </div>
                        <select
                            multiple
                            name="group_profiles"
                            className={"swamm-target-select"}
                            value={this.props.targetForm?.group_profiles}
                            onChange={this.handleMultiSelection}
                            style={{height: "200px"}}
                        >
                            {
                                this.props.viewableGroupProfiles?.map((groupProfile) =>
                                    <option value={groupProfile.pk}>{groupProfile.title}</option>
                                )
                            }
                        </select>
                        <div className={"swamm-target-form-heading"}>
                            Include these BMP types:
                        </div>
                        <select
                            multiple
                            name="bmp_types"
                            className={"swamm-target-select"}
                            value={this.props.targetForm?.bmp_types}
                            onChange={this.handleMultiSelection}
                            style={{height: "200px"}}
                        >
                            {
                                this.props.bmpTypes?.map((bmpType) =>
                                    <option value={bmpType.id}>{bmpType.name}</option>
                                )
                            }
                        </select>
                        <div className={"swamm-target-form-heading"}>
                            Include these BMP statuses:
                        </div>
                        <select
                            multiple
                            name="statuses"
                            className={"swamm-target-select"}
                            value={this.props.targetForm?.statuses}
                            onChange={this.handleMultiSelection}
                            style={{height: "200px"}}
                        >
                            {
                                this.props.statuses?.map((status) =>
                                    <option value={status.name}>{status.name}</option>
                                )
                            }
                        </select>
                    </div>
                </div>
                <div id={"swamm-target-form-footer"}>
                    <button
                        className={"swamm-button"}
                        onClick={() => this.props.hideTargetForm()}
                    >
                        Close
                    </button>
                    <button
                        className={"swamm-button"}
                        style={{backgroundColor: "darkgreen"}}
                        onClick={() => {
                            this.props.submitTargetForm(this.props.targetForm, this.props.projectId);
                        }}
                    >
                        Save Target
                    </button>
                    {
                        this.props.targetForm?.id ?
                            <button
                                className={"swamm-button"}
                                style={{backgroundColor: "darkred"}}
                                onClick={() => {
                                    if (window.confirm('This action can not be undone. Are you sure?')) {
                                        this.props.deleteTarget(this.props.projectId, this.props.targetForm?.id);
                                    }
                                }}
                            >
                                Delete Target
                            </button> :
                            null
                    }
                </div>
            </div>
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
            kv = {[fieldName]: parseInt(fieldValue, 10) / 100};
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
    const validGroupProfiles = state?.swamm?.groupProfiles.filter(item => !["anonymous", "registered-members", "admin", "swamm-users", "illinois-pork-producers"].includes(item.slug));
    const viewableGroupProfiles = validGroupProfiles.filter(item => state?.swamm?.projectData?.permitted_groups.map(permittedGroup => permittedGroup.pk)?.includes(item.pk));
    return {
        projectId: state?.swamm?.projectData?.id,
        bmpTypes: state?.swamm?.bmpTypes,
        statuses: state?.swamm?.statuses,
        targetForm: state?.swamm?.targetForm || {},
        viewableGroupProfiles: viewableGroupProfiles
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideTargetForm: () => dispatch(hideTargetForm()),
        deleteTarget: (projectId, targetFormId) => dispatch(deleteTarget(projectId, targetFormId)),
        clearTargetForm: () => dispatch(clearTargetForm()),
        submitTargetForm: (targetForm, projectId) => dispatch(submitTargetForm(targetForm, projectId)),
        updateTargetForm: (kv) => dispatch(updateTargetForm(kv))
    };
};

const SwammTargetForm = connect(mapStateToProps, mapDispatchToProps)(SwammTargetFormClass);


export {
    SwammTargetForm
};

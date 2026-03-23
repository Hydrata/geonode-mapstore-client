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
import Message from '@mapstore/framework/components/I18N/Message';
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
        statuses: PropTypes.array,
        swammEngines: PropTypes.array
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
                            <React.Fragment><Message msgId="hydrata.swamm.editTargetPrefix" /> {this.props.targetForm?.name}</React.Fragment> :
                            <Message msgId="hydrata.swamm.createNewTarget" />
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
                             <Message msgId="hydrata.swamm.targetName" />:
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
                              <Message msgId="hydrata.swamm.description" />:
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
                                <Message msgId="hydrata.swamm.setTargets" />:
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  <Message msgId="hydrata.swamm.nitrogen" />:
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
                                    <Message msgId="hydrata.swamm.percentReduction" />
                                </div>
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  <Message msgId="hydrata.swamm.phosphorus" />:
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
                                    <Message msgId="hydrata.swamm.percentReduction" />
                                </div>
                            </div>
                            <div className={"swamm-target-row"}>
                                <div
                                    style={{width: "90px"}}
                                >
                                  <Message msgId="hydrata.swamm.sediment" />:
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
                                    <Message msgId="hydrata.swamm.percentReduction" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id={"swamm-target-form-col-two"}>
                        <div className={"swamm-target-form-heading"}>
                            <Message msgId="hydrata.swamm.includeBmpsFromOrganizations" />:
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
                            <Message msgId="hydrata.swamm.includeBmpTypes" />:
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
                            <Message msgId="hydrata.swamm.includeBmpStatuses" />:
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
                        <div className={"swamm-target-form-heading"}>
                            <Message msgId="hydrata.swamm.includeSubWatersheds" />:
                        </div>
                        <select
                            multiple
                            name="swamm_engines"
                            className={"swamm-target-select"}
                            value={this.props.targetForm?.swamm_engines}
                            onChange={this.handleMultiSelection}
                            style={{height: "200px"}}
                        >
                            {
                                this.props.swammEngines?.map((engine) =>
                                    <option value={engine.id}>{engine.name}</option>
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
                        <Message msgId="hydrata.swamm.close" />
                    </button>
                    <button
                        className={"swamm-button"}
                        style={{backgroundColor: "darkgreen"}}
                        onClick={() => {
                            this.props.submitTargetForm(this.props.targetForm, this.props.projectId);
                        }}
                    >
                        <Message msgId="hydrata.swamm.saveTarget" />
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
                                <Message msgId="hydrata.swamm.deleteTarget" />
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
    const validGroupProfiles = state?.swamm?.groupProfiles?.filter(item => !["anonymous", "registered-members", "admin", "swamm-users", "illinois-pork-producers"].includes(item.slug)) || [];
    const viewableGroupProfiles = validGroupProfiles;
    return {
        projectId: state?.swamm?.projectData?.id,
        bmpTypes: state?.swamm?.bmpTypes,
        statuses: state?.swamm?.statuses,
        swammEngines: state?.swamm?.swammEngines,
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

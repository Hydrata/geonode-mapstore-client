import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {
    hideTargetForm,
    deleteTarget,
    clearTargetForm,
    submitTargetForm,
    updateTargetForm
} from "../actionsSwamm";
import Message from '@mapstore/framework/components/I18N/Message';
import "../../Swamm/swamm.css";
import ConfirmOverlay from '../../shared/ConfirmOverlay';

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
        this.handleCheckboxToggle = this.handleCheckboxToggle.bind(this);
        this.state = {
            openSection: 'group_profiles',
            // TASK-1409 — inline confirm overlay replaces window.confirm.
            deleteConfirmVisible: false
        };
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
                        {this.renderAccordionSection(
                            'group_profiles',
                            'Organizations',
                            this.props.viewableGroupProfiles || [],
                            (item) => item.pk,
                            (item) => item.title
                        )}
                        {this.renderAccordionSection(
                            'bmp_types',
                            'BMP Types',
                            this.props.bmpTypes || [],
                            (item) => item.id,
                            (item) => item.name
                        )}
                        {this.renderAccordionSection(
                            'statuses',
                            'Statuses',
                            this.props.statuses || [],
                            (item) => item.name,
                            (item) => item.name
                        )}
                        {this.renderAccordionSection(
                            'swamm_engines',
                            'Sub-Watersheds',
                            this.props.swammEngines || [],
                            (item) => item.id,
                            (item) => item.name
                        )}
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
                    {/* TASK-1438: shared ConfirmOverlay replaces the inline copy-paste. */}
                    {
                        this.props.targetForm?.id ?
                            this.state.deleteConfirmVisible ? (
                                <ConfirmOverlay
                                    buttonClassName="swamm-button"
                                    confirmClassName="swamm-target-delete-confirm-btn"
                                    onCancel={() => this.setState({deleteConfirmVisible: false})}
                                    onConfirm={() => {
                                        this.setState({deleteConfirmVisible: false});
                                        this.props.deleteTarget(this.props.projectId, this.props.targetForm?.id);
                                    }}
                                    confirmLabel={<Message msgId="hydrata.swamm.deleteTarget" />}
                                />
                            ) : (
                                <button
                                    className={"swamm-button"}
                                    style={{backgroundColor: "darkred"}}
                                    onClick={() => this.setState({deleteConfirmVisible: true})}
                                >
                                    <Message msgId="hydrata.swamm.deleteTarget" />
                                </button>
                            ) :
                            null
                    }
                </div>
            </div>
        );
    }
    renderAccordionSection(fieldName, title, items, getValueFn, getLabelFn) {
        const isOpen = this.state.openSection === fieldName;
        const selectedValues = this.props.targetForm?.[fieldName] || [];
        const selectedCount = selectedValues.length;

        return (
            <div className="swamm-target-accordion-section">
                <div
                    className={"swamm-target-accordion-header" + (isOpen ? " swamm-target-accordion-header-open" : "")}
                    onClick={() => this.setState({openSection: isOpen ? null : fieldName})}
                >
                    <span className="swamm-target-accordion-arrow">{isOpen ? '\u25BC' : '\u25B6'}</span>
                    <span className="swamm-target-accordion-title">{title}</span>
                    <span className="swamm-target-accordion-count">
                        {selectedCount > 0 ? `(${selectedCount} selected)` : ''}
                    </span>
                </div>
                {isOpen && (
                    <div className="swamm-target-accordion-body">
                        {items.map((item) => {
                            const value = getValueFn(item);
                            const label = getLabelFn(item);
                            // eslint-disable-next-line eqeqeq
                            const isChecked = selectedValues.some(v => v == value);
                            return (
                                <label key={value} className="swamm-target-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => this.handleCheckboxToggle(fieldName, value, e.target.checked)}
                                    />
                                    <span>{label}</span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    handleCheckboxToggle(fieldName, value, isChecked) {
        const current = this.props.targetForm?.[fieldName] || [];
        let updated;
        if (isChecked) {
            updated = [...current, value];
        } else {
            // eslint-disable-next-line eqeqeq
            updated = current.filter(v => v != value);
        }
        this.props.updateTargetForm({[fieldName]: updated});
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

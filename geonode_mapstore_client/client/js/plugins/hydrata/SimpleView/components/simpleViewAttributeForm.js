import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');

import {
    setVisibleSimpleViewAttributeForm,
    updateSimpleViewAttributeForm,
    submitSimpleViewAttributeForm
} from "../actionsSimpleView";

class SimpleViewAttributeFormClass extends React.Component {
    static propTypes = {
        setVisibleSimpleViewAttributeForm: PropTypes.func,
        updateSimpleViewAttributeForm: PropTypes.func,
        simpleViewAttributeForm: PropTypes.object,
        submitSimpleViewAttributeForm: PropTypes.func,
        projectId: PropTypes.number,
        simpleViewImporterSessionId: PropTypes.number
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.handleOverrideChange = this.handleOverrideChange.bind(this);
        this.state = {};
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    renderOverride(overrideWidget, key) {
        switch (overrideWidget) {
        case 'datepicker':
            return (
                <input
                    style={{
                        color: "white",
                        borderRadius: "4px",
                        textAlign: "right"
                    }}
                    name={key}
                    value={this.props.simpleViewAttributeForm?.[key]?.value}
                    onChange={this.handleOverrideChange}
                    type={"date"}
                />
            );
        case 'float':
            return (
                <input
                    style={{
                        color: "white",
                        borderRadius: "4px",
                        textAlign: "right"
                    }}
                    name={key}
                    value={this.props.simpleViewAttributeForm?.[key]?.value}
                    onChange={this.handleOverrideChange}
                    type={"number"}
                />
            );
        default:
            return <div>{overrideWidget} widget not found</div>;
        }
    }

    render() {
        return (
            <div
                id={'simple-view-attribute-form-panel'}
                className={'simple-view-panel menu-rows-container'}
            >
                <div id={"simple-view-attribute-form-header"}>
                    <div className={'simple-view-panel-header'}>
                        Import external data - attribute mapping
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.setVisibleSimpleViewAttributeForm(false);
                        }}
                    />
                </div>
                <div className={'simple-view-panel-body'}>
                    <div className={"simple-view-panel-col-one"} style={{
                        width: "800px",
                        marginLeft: "auto",
                        marginTop: "15px",
                        marginRight: "auto"
                    }}>
                        <div style={{
                            display: "flex",
                            marginBottom: "5px"
                        }}>
                            <h2 style={{width: "150px", textAlign: "center"}}>Type</h2>
                            <h2 style={{width: "450px", textAlign: "center"}}>Target<br/>Attribute</h2>
                            <h2 style={{width: "250px", textAlign: "center"}}>Uploaded<br/>Attribute</h2>
                            <h2 style={{width: "450px", textAlign: "center"}}>Attribute<br/>Override</h2>
                        </div>
                        {
                            Object.keys(this.props.simpleViewAttributeForm).map(key => {
                                const attribute = this.props.simpleViewAttributeForm[key];
                                if (attribute?.hidden) {
                                    return null;
                                }
                                return (
                                    <div style={{
                                        position: "relative",
                                        top: `${attribute?.position * 14}px`,
                                        border: "solid 1px #ffffff96",
                                        borderRadius: "3px",
                                        padding: "5px",
                                        paddingBottom: "2px"
                                    }}>
                                        <div style={{
                                            display: "flex",
                                            marginBottom: "5px"
                                        }}>
                                            <div style={{width: "150px"}}>
                                                {attribute?.datatype}
                                            </div>
                                            <div style={{width: "450px"}}>
                                                {key}
                                            </div>
                                            <select
                                                style={{
                                                    width: "250px",
                                                    color: "#2b5994",
                                                    borderRadius: "4px"
                                                }}
                                                name={key}
                                                value={this.props.simpleViewAttributeForm?.[key]?.value}
                                                defaultValue={""}
                                                onChange={this.handleChange}
                                            >
                                                {
                                                    attribute?.override_allowed && attribute?.override_used ?
                                                        <React.Fragment>
                                                            <option value="---" selected>---</option>
                                                            {
                                                                attribute?.options?.map(option =>
                                                                    <option value={option}>{option}</option>
                                                                )
                                                            }
                                                        </React.Fragment> :
                                                        <React.Fragment>
                                                            <option value="" hidden selected disabled>---</option>
                                                            {
                                                                attribute?.options?.map(option =>
                                                                    <option value={option}>{option}</option>
                                                                )
                                                            }
                                                        </React.Fragment>
                                                }
                                            </select>
                                            <div style={{
                                                marginLeft: "40px",
                                                width: "450px",
                                                textAlign: "center"
                                            }}>
                                                {
                                                    attribute?.override_allowed ?
                                                        this.renderOverride(attribute?.override_widget, key)
                                                        : <div/>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
                <div
                    id={"simple-view-attribute-form-grid-footer"}
                    className={"simple-view-panel-footer"}
                >
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        style={{backgroundColor: "darkred"}}
                        onClick={() => {
                            this.props.setVisibleSimpleViewAttributeForm(false);
                        }}>
                        Cancel
                    </button>
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        style={{backgroundColor: "darkgreen"}}
                        onClick={() => {
                            this.props.submitSimpleViewAttributeForm(this.props.simpleViewAttributeForm, this.props.projectId, this.props.simpleViewImporterSessionId);
                        }}>
                        Import
                    </button>
                </div>
            </div>
        );
    }

    handleChange(event) {
        const fieldName = event.target.name;
        let fieldValue = event.target.value;
        let kv = {[fieldName]: fieldValue};
        if (event.target?.type === 'number')  {
            kv = {[fieldName]: parseFloat(fieldValue)};
        }
        kv.override_used = false;
        this.props.updateSimpleViewAttributeForm(kv);
    }

    handleOverrideChange(event) {
        const fieldName = event.target.name;
        let fieldValue = event.target.value;
        let kv = {[fieldName]: fieldValue};
        if (event.target?.type === 'number')  {
            kv = {[fieldName]: parseFloat(fieldValue)};
        }
        kv.override_used = true;
        this.props.updateSimpleViewAttributeForm(kv);
    }
}

const mapStateToProps = (state) => {
    return {
        projectId: state?.simpleView?.config?.project_id,
        simpleViewAttributeForm: state?.simpleView?.simpleViewAttributeForm || {},
        simpleViewImporterSessionId: state?.simpleView?.simpleViewImporterSessionId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleSimpleViewAttributeForm: (visible) => dispatch(setVisibleSimpleViewAttributeForm(visible)),
        updateSimpleViewAttributeForm: (kv) => dispatch(updateSimpleViewAttributeForm(kv)),
        submitSimpleViewAttributeForm: (form, projectId, simpleViewImporterSessionId) => dispatch(submitSimpleViewAttributeForm(form, projectId, simpleViewImporterSessionId))
    };
};

const SimpleViewAttributeForm = connect(mapStateToProps, mapDispatchToProps)(SimpleViewAttributeFormClass);


export {
    SimpleViewAttributeForm
};

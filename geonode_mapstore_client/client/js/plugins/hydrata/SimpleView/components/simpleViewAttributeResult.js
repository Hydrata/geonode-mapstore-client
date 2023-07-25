import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');

import {
    setVisibleSimpleViewAttributeResult
} from "../actionsSimpleView";

class SimpleViewAttributeResultClass extends React.Component {
    static propTypes = {
        setVisibleSimpleViewAttributeResult: PropTypes.func,
        projectId: PropTypes.number,
        simpleViewAttributeResult: PropTypes.object
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <div
                id={'simple-view-attribute-result-panel'}
                className={'simple-view-panel menu-rows-container'}
                style={{
                    backgroundColor: "rgba(0, 60, 136)",
                    textAlign: "left"
                }}
            >
                <div id={"simple-view-attribute-form-header"}>
                    <div className={'simple-view-panel-header'}>
                        Import Result (showing "external_id" fields)
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.setVisibleSimpleViewAttributeResult(false);
                        }}
                    />
                </div>
                <div className={'simple-view-panel-body'}>
                    <div className={"simple-view-panel-col-one"} style={{
                        width: "800px",
                        minHeight: "300px",
                        marginLeft: "auto",
                        marginTop: "15px",
                        marginRight: "auto",
                        marginBottom: "50px",
                        overflowY: "scroll"
                    }}>
                        {Object.keys(this.props.simpleViewAttributeResult).map((key) => {
                            return (
                                <React.Fragment>
                                    <h3>
                                        {key.charAt(0).toUpperCase() + key.slice(1)} ({this.props.simpleViewAttributeResult[key].length}):
                                    </h3>
                                    {
                                        this.props.simpleViewAttributeResult[key].map(value => `${value}, `)
                                    }
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
                <div
                    id={"simple-view-attribute-result-grid-footer"}
                    className={"simple-view-panel-footer"}
                >
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        style={{backgroundColor: "darkred"}}
                        onClick={() => {
                            this.props.setVisibleSimpleViewAttributeResult(false);
                        }}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        projectId: state?.simpleView?.config?.project_id,
        simpleViewAttributeResult: state?.simpleView?.simpleViewAttributeResult || {},
        simpleViewImporterSessionId: state?.simpleView?.simpleViewImporterSessionId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleSimpleViewAttributeResult: (visible) => dispatch(setVisibleSimpleViewAttributeResult(visible))
    };
};

const SimpleViewAttributeResult = connect(mapStateToProps, mapDispatchToProps)(SimpleViewAttributeResultClass);


export {
    SimpleViewAttributeResult
};

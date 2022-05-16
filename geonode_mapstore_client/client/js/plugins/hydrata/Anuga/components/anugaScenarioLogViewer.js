import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    showAnugaScenarioLog
} from "../actionsAnuga";

class AnugaScenarioLogViewerClass extends React.Component {
    static propTypes = {
        selectedScenario: PropTypes.object,
        showAnugaScenarioLog: PropTypes.func,
        logText: PropTypes.string
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <div id={'anuga-scenario-log-viewer-container'}>
                <h5 style={{marginLeft: "9px"}}>
                    Scenario: {this.props.selectedScenario?.name}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.showAnugaScenarioLog(false)}
                    />
                </h5>
                <pre id={'anuga-scenario-log-viewer'} style={{color: "white", background: "black"}}>
                    {this.props.logText}
                </pre>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        selectedScenario: state?.anuga?.selectedScenario
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId))
    };
};

const AnugaScenarioLogViewer = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioLogViewerClass);


export {AnugaScenarioLogViewer};

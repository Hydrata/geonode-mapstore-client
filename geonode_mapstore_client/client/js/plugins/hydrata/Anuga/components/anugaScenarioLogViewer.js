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
        visibleAnugaLogScenario: PropTypes.object,
        showAnugaScenarioLog: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <div id={'anuga-scenario-log-viewer-container'}>
                <h5>
                    {this.props.visibleAnugaLogScenario?.name}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.showAnugaScenarioLog(false)}
                    />
                </h5>
                <div id={'anuga-scenario-log-viewer'}>
                    {this.props.visibleAnugaLogScenario?.latest_run?.log}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    console.log('a', state?.anuga?.scenarios?.filter((scenario) => state?.anuga?.visibleAnugaScenarioLogId === scenario.id)[0]);
    return {
        visibleAnugaLogScenario: state?.anuga?.scenarios?.filter((scenario) => state?.anuga?.visibleAnugaScenarioLogId === scenario.id)[0]
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId))
    };
};

const AnugaScenarioLogViewer = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioLogViewerClass);


export {AnugaScenarioLogViewer};

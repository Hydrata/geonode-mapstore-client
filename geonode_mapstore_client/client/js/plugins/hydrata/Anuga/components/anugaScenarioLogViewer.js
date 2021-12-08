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
        visibleAnugaScenarioLog: PropTypes.object,
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
                    {this.props.visibleAnugaScenarioLog?.name}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.showAnugaScenarioLog(false)}
                    />
                </h5>
                <div id={'anuga-scenario-log-viewer'}>
                    {this.props.visibleAnugaScenarioLog?.latest_output?.log}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        visibleAnugaScenarioLog: state?.anuga?.visibleAnugaScenarioLog
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaScenarioLog: (scenario) => dispatch(showAnugaScenarioLog(scenario))
    };
};

const AnugaScenarioLogViewer = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioLogViewerClass);


export {AnugaScenarioLogViewer};

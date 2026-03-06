import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    showAnugaScenarioLog
} from "../actionsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";

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
                    <Message msgId="hydrata.anuga.scenarioPrefix" /> {this.props.selectedScenario?.name}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.showAnugaScenarioLog(false);
                            trackEvent('button', `click`, `anuga-scenario-log-close`);
                        }}
                    />
                </h5>
                <pre id={'anuga-scenario-log-viewer'} style={{color: "white", background: "black"}}>
                    {this.props.logText}
                </pre>
                <div style={{display: "flex", justifyContent: "flex-end", padding: "10px"}}>
                    <button
                        className={"btn btn-default"}
                        onClick={() => {
                            this.props.showAnugaScenarioLog(false);
                            trackEvent('button', `click`, `anuga-scenario-log-close-footer`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.close" />
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        selectedScenario: (() => {
            const selectedId = state?.anuga?.scenarios?.selectedId;
            return selectedId ? state?.anuga?.scenarios?.byId?.[selectedId] : null;
        })()
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId))
    };
};

const AnugaScenarioLogViewer = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioLogViewerClass);


export {AnugaScenarioLogViewer};

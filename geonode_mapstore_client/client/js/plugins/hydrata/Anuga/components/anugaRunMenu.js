import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    showAnugaRunMenu,
    updateComputeInstance,
    setAnugaScenarioMenu,
    showAnugaScenarioLog,
    showManageAccount
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";
import {formatMoney} from "@js/plugins/hydrata/Utils/utils";

class AnugaRunMenuClass extends React.Component {
    static propTypes = {
        visibleAnugaRunMenu: PropTypes.object,
        showAnugaRunMenu: PropTypes.func,
        updateComputeInstance: PropTypes.func,
        computeInstances: PropTypes.array,
        selectedScenario: PropTypes.object,
        runAnugaScenario: PropTypes.func,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaScenarioLog: PropTypes.func,
        showManageAccount: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.props.updateComputeInstance();
    }


    render() {
        return (
            <div id={'anuga-run-menu-container'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"}>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => {
                                this.props.showAnugaRunMenu(false);
                                this.props.setAnugaScenarioMenu(true);
                            }}
                        />
                        <div>
                            <Table className={"run-server-table"}>
                                <thead>
                                    <tr className={"run-server-table-header"}>
                                        <th style={{width: "300px", textAlign: "left"}}>Run Scenario</th>
                                        <th style={{width: "80px"}}>Available Hours</th>
                                        <th style={{width: "80px"}}>Run</th>
                                        <th style={{width: "80px"}}>Download</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                        <td style={{'textAlign': 'left'}}>{this.props.selectedScenario.name}</td>
                                        <td>200</td>
                                        <td>
                                            <Button
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                style={{margin: "2px", borderRadius: "2px"}}
                                                onClick={() => {
                                                    this.props.runAnugaScenario(this.props.selectedScenario, 0);
                                                    this.props.showAnugaRunMenu(false);
                                                    this.props.showAnugaScenarioLog(this.props.selectedScenario.id);
                                                    this.props.setAnugaScenarioMenu(true);
                                                }}
                                            >
                                                Run
                                            </Button>
                                        </td>
                                        <td>
                                            <Button
                                                download
                                                href={this.props.selectedScenario?.latest_run?.s3_package_url}
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                style={{margin: "2px", borderRadius: "2px"}}
                                            >
                                                <span className="glyphicon glyphicon-download" aria-hidden="true" />
                                            </Button>
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
                <Button
                    bsStyle={'success'}
                    bsSize={'small'}
                    style={{margin: "10px", borderRadius: "2px"}}
                    onClick={() => {
                        this.props.showManageAccount(true);
                        this.props.showAnugaRunMenu(false);
                    }}
                >
                    Manage Account
                </Button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        selectedScenario: state?.anuga?.selectedScenario,
        computeInstances: state?.anuga?.computeInstances
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
        updateComputeInstance: () => dispatch(updateComputeInstance()),
        runAnugaScenario: (scenario, instanceId) => dispatch(runAnugaScenario(scenario, instanceId)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId)),
        showManageAccount: (visible) => dispatch(showManageAccount(visible))
    };
};

const AnugaRunMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaRunMenuClass);


export {AnugaRunMenu};

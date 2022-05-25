import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    showAnugaRunMenu,
    updateComputeInstance,
    setAnugaScenarioMenu,
    showAnugaScenarioLog
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";

class AnugaRunMenuClass extends React.Component {
    static propTypes = {
        visibleAnugaRunMenu: PropTypes.object,
        showAnugaRunMenu: PropTypes.func,
        updateComputeInstance: PropTypes.func,
        computeInstances: PropTypes.array,
        selectedScenario: PropTypes.object,
        runAnugaScenario: PropTypes.func,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaScenarioLog: PropTypes.func
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
                        Scenario: {this.props.selectedScenario?.name}
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => {
                                this.props.showAnugaRunMenu(false);
                                this.props.setAnugaScenarioMenu(true);
                            }}
                        />
                        <div style={{left: "7px"}}>
                            <pre id={'anuga-run-menu'}>
                                Mesh size: {this.props.selectedScenario?.latest_run?.mesh_triangle_count_estimate} triangles<br/>
                                Model Start Time: {this.props.selectedScenario?.latest_run?.real_world_start}<br/>
                                Model End Time: {this.props.selectedScenario?.latest_run?.real_world_end}<br/>
                            </pre>
                        </div>
                        <div>
                            <Table className={"scenario-table"}>
                                <thead>
                                    <tr className={"scenario-table-header"}>
                                        <th>Server</th>
                                        <th>Description</th>
                                        <th>vCPUs Total</th>
                                        <th>vCPUs Available</th>
                                        <th>Current Jobs</th>
                                        <th>Rate ($/cpu/hour)</th>
                                        <th>Estimate (hours)</th>
                                        <th>Estimate ($)</th>
                                        <th/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.computeInstances?.length > 0 ? this.props.computeInstances?.map(instance => {
                                            console.log('instance:', instance);
                                            return (
                                                <tr className={"run-server-table-row"}>
                                                    <td>{instance?.name}</td>
                                                    <td>{instance?.description}</td>
                                                    <td>{instance?.cpus_total}</td>
                                                    <td>{instance?.cpus_available}</td>
                                                    <td>{instance?.currently_running}</td>
                                                    <td>-</td>
                                                    <td>-</td>
                                                    <td>-</td>
                                                    <td>
                                                        <Button
                                                            bsStyle={'success'}
                                                            bsSize={'xsmall'}
                                                            style={{margin: "2px", borderRadius: "2px"}}
                                                            onClick={() => {
                                                                this.props.runAnugaScenario(this.props.selectedScenario, instance.id);
                                                                this.props.showAnugaRunMenu(false);
                                                                this.props.showAnugaScenarioLog(this.props.selectedScenario.id);
                                                                this.props.setAnugaScenarioMenu(true);
                                                            }}
                                                        >
                                                            Run
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        }) :
                                            <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                                ...no compute servers yet registered
                                            </tr>
                                    }
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <span
                        style={{margin: "2px", borderRadius: "2px", left: "7px", bottom: "26px", position: "absolute"}}
                    >
                        <p>Alternatively you can run the model on your own machine:</p>
                    </span>
                    <Button
                        download
                        href={this.props.selectedScenario?.latest_run?.s3_package_url}
                        bsStyle={'success'}
                        bsSize={'xsmall'}
                        style={{margin: "2px", borderRadius: "2px", left: "7px", bottom: "6px", position: "absolute"}}
                    >
                        Download
                    </Button>
                </div>
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
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId))
    };
};

const AnugaRunMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaRunMenuClass);


export {AnugaRunMenu};

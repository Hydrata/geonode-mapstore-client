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
    showAnugaScenarioLog
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
                                        <th>Server</th>
                                        <th>Description</th>
                                        <th>vCPUs Total</th>
                                        <th>vCPUs Available</th>
                                        <th>Cost Estimate<br/>(vCPUhours)</th>
                                        <th>
                                            <Button
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                style={{margin: "2px", borderRadius: "2px"}}
                                                onClick={() => {
                                                    window.alert('coming soon');
                                                }}
                                            >
                                                Purchase
                                            </Button><br/>
                                            Availabe vCPUhours
                                        </th>
                                        <th>RunTime Estimate<br/>(hours)</th>
                                        <th/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.props.computeInstances?.length > 0 ? this.props.computeInstances?.map(instance => {
                                            console.log('instance:', instance);
                                            return (
                                                <React.Fragment>
                                                    <tr className={"run-server-table-row"}>
                                                        <td>{instance?.name}</td>
                                                        <td>{instance?.description}</td>
                                                        <td>{instance?.cpus_total}</td>
                                                        <td>{instance?.cpus_available}</td>
                                                        <td>{this.props.selectedScenario?.latest_run?.vcpu_hours_estimate}</td>
                                                        <td>200</td>
                                                        <td>{instance?.cpus_available / this.props.selectedScenario?.latest_run?.vcpu_hours_estimate}</td>
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
                                                </React.Fragment>
                                            );
                                        }) :
                                            <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                                <div>
                                                    <Spinner color="white" style={{display: "inline-block", margin: "20px"}} spinnerName="circle" noFadeIn/>
                                                </div>
                                                ...searching for available compute servers
                                            </tr>
                                    }
                                    <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                        <td>None</td>
                                        <td>Your machine</td>
                                        <td>-</td>
                                        <td>-</td>
                                        <td>-</td>
                                        <td>-</td>
                                        <td>-</td>
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
                    <div id={'anuga-run-menu'} style={{left: "7px"}}>
                        Scenario: {this.props.selectedScenario?.name}<br/>
                        Mesh size: {formatMoney(this.props.selectedScenario?.latest_run?.mesh_triangle_count_estimate, 0)} triangles<br/>
                        Real world duration: {this.props.selectedScenario?.latest_run?.duration}<br/>
                    </div>
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

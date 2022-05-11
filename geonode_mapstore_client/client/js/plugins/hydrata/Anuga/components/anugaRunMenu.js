import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    showAnugaRunMenu,
    updateComputeInstance
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";

class AnugaRunMenuClass extends React.Component {
    static propTypes = {
        visibleAnugaRunMenu: PropTypes.object,
        showAnugaRunMenu: PropTypes.func,
        updateComputeInstance: PropTypes.func,
        computeInstances: PropTypes.array,
        selectedScenario: PropTypes.object,
        runAnugaScenario: PropTypes.func
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
            <div id={'anuga-run-menu-container'}>
                <h5 style={{marginLeft: "9px"}}>
                    Scenario: {this.props.selectedScenario?.name}
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.showAnugaRunMenu(false)}
                    />
                </h5>
                <pre id={'anuga-run-menu'}>
                    Mesh size: {this.props.selectedScenario?.latest_run?.mesh_triangle_count_estimate}<br/>
                    Model Start Time: {this.props.selectedScenario?.latest_run?.real_world_start}<br/>
                    Model End Time: {this.props.selectedScenario?.latest_run?.real_world_end}<br/>
                </pre>
                <Button
                    download
                    href={this.props.selectedScenario?.latest_run?.s3_package_url}
                    bsStyle={'success'}
                    bsSize={'xsmall'}
                    style={{margin: "2px", borderRadius: "2px", position: "absolute", top: "130px", left: "7px"}}
                >
                    Download
                </Button>
                <div>
                    <Table className={"run-server-table"} bordered hover>
                        <thead>
                            <tr className={"run-server-table-header"}>
                                <th>Server</th>
                                <th>Description</th>
                                <th>CPUs Total</th>
                                <th>CPUs Available</th>
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
                                                        this.props.runAnugaScenario(this.props.selectedScenario);
                                                        this.props.showAnugaRunMenu(false);
                                                    }}
                                                >
                                                    Run
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                }) :
                                    <tr className={"run-server-table-row"}>
                                        No compute servers registered
                                    </tr>
                            }
                        </tbody>
                    </Table>
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
        runAnugaScenario: (scenario) => dispatch(runAnugaScenario(scenario))
    };
};

const AnugaRunMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaRunMenuClass);


export {AnugaRunMenu};

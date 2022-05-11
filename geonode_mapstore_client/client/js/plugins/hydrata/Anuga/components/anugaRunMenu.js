import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    showAnugaRunMenu,
    updateComputeInstance
} from "../actionsAnuga";
import {Button} from "react-bootstrap";

class AnugaRunMenuClass extends React.Component {
    static propTypes = {
        visibleAnugaRunMenu: PropTypes.object,
        showAnugaRunMenu: PropTypes.func,
        updateComputeInstance: PropTypes.func,
        computeInstances: PropTypes.array,
        selectedScenario: PropTypes.object
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
                    Scenario: {this.props.visibleAnugaRunMenu?.name}
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
                    style={{margin: "2px", borderRadius: "2px", position: "absolute", top: "40px", right: "28px"}}
                >
                    Download
                </Button>
                <hr/>
                <div>
                    <h5 style={{marginLeft: "9px"}}>Available Run Servers:</h5>
                    {
                        this.props.computeInstances?.length > 0 ? this.props.computeInstances?.map(instance => {
                            console.log('instance:', instance);
                            return (
                                <pre id={'anuga-compute-instance-menu'}>
                                    <p>Name: {instance?.name}</p>
                                    <p>Description: instance?.description}</p>
                                    <p>CPUs Total: {instance?.cpus_total}</p>
                                    <p>CPUs Available: {instance?.cpus_available}</p>
                                    <p>Current Jobs: {instance?.currently_running}</p>
                                </pre>
                            );
                        }) :
                            <pre id={'anuga-compute-instance-menu'}>
                                No servers available
                            </pre>
                    }
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
        updateComputeInstance: () => dispatch(updateComputeInstance())
    };
};

const AnugaRunMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaRunMenuClass);


export {AnugaRunMenu};

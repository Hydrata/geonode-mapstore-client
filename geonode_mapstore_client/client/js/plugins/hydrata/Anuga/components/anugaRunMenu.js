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
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

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
        this.state = { computeBackend: 'local' };
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
                                trackEvent('button', `click`, `anuga-run-menu-close`);
                            }}
                        />
                        <div>
                            <Table className={"run-server-table"}>
                                <thead>
                                    <tr className={"run-server-table-header"}>
                                        <th style={{width: "200px", textAlign: "left"}}><Message msgId="hydrata.anuga.runScenario" /></th>
                                        <th style={{width: "120px"}}><Message msgId="hydrata.anuga.computeBackend" /></th>
                                        <th style={{width: "80px"}}><Message msgId="hydrata.anuga.run" /></th>
                                        <th style={{width: "80px"}}><Message msgId="hydrata.anuga.download" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                        <td style={{'textAlign': 'left'}}>{this.props.selectedScenario.name}</td>
                                        <td>
                                            <select
                                                className={'scenario-select'}
                                                value={this.state.computeBackend}
                                                onChange={(e) => this.setState({computeBackend: e.target.value})}
                                            >
                                                <option value="local">Local</option>
                                                <option value="ec2">EC2</option>
                                                <option value="batch">AWS Batch</option>
                                            </select>
                                        </td>
                                        <td>
                                            <Button
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                style={{margin: "2px", borderRadius: "2px"}}
                                                onClick={() => {
                                                    this.props.runAnugaScenario(this.props.selectedScenario, this.state.computeBackend);
                                                    this.props.showAnugaRunMenu(false);
                                                    this.props.showAnugaScenarioLog(this.props.selectedScenario.id);
                                                    this.props.setAnugaScenarioMenu(true);
                                                    trackEvent('button', `click`, `anuga-run-menu-run-${this.props.selectedScenario.name}`);
                                                }}
                                            >
                                                <Message msgId="hydrata.anuga.run" />
                                            </Button>
                                        </td>
                                        <td>
                                            <Button
                                                download
                                                href={this.props.selectedScenario?.latest_run?.s3_package_url}
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                style={{margin: "2px", borderRadius: "2px"}}
                                                onClick={() => {
                                                    trackEvent('button', `click`, `anuga-run-menu-download-${this.props.selectedScenario.name}`);
                                                }}
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
                        trackEvent('button', `click`, `anuga-run-menu-manage-account-open`);
                    }}
                >
                    <Message msgId="hydrata.anuga.manageAccount" />
                </Button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    const selectedScenario = selectedId ? state?.anuga?.scenarios?.byId?.[selectedId] : null;
    return {
        selectedScenario: selectedScenario || {},
        computeInstances: state?.anuga?.resources?.computeInstances
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
        updateComputeInstance: () => dispatch(updateComputeInstance()),
        runAnugaScenario: (scenario, computeBackend) => dispatch(runAnugaScenario(scenario, computeBackend)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId)),
        showManageAccount: (visible) => dispatch(showManageAccount(visible))
    };
};

const AnugaRunMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaRunMenuClass);


export {AnugaRunMenu};

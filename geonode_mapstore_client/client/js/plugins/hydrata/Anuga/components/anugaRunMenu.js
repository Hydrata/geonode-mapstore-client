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
    showAnugaScenarioLog,
    showManageAccount
} from "../actionsAnuga";
import {Table, Button} from "react-bootstrap";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';
import {getAnugaConfig} from "../api/anugaApi";

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
        // TASK-964 — initial 'local' is a safe pre-config fallback. componentDidMount
        // fetches /api/v2/anuga/config/ and flips this to the site default ('batch' on
        // hydrata.com, 'local' elsewhere). Operators can still pick per-run via the
        // dropdown — that explicit choice flows straight into runAnugaScenario.
        this.state = { computeBackend: 'local' };
    }

    componentDidMount() {
        this.props.updateComputeInstance();
        // TASK-964 — hydrate compute_backend from site config on mount. Failures
        // fall back to 'local' inside getAnugaConfig itself; we just guard against
        // a late callback after the component unmounts.
        this._mounted = true;
        getAnugaConfig().then((cfg) => {
            if (this._mounted && cfg && cfg.default_compute_backend) {
                this.setState({ computeBackend: cfg.default_compute_backend });
            }
        });
    }

    componentWillUnmount() {
        this._mounted = false;
    }


    render() {
        return (
            <div id={'anuga-run-menu-container'} className={'simple-view-panel anuga-panel'}>
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
                                        <th className="run-menu-th-name"><Message msgId="hydrata.anuga.runScenario" /></th>
                                        <th className="run-menu-th-backend"><Message msgId="hydrata.anuga.computeBackend" /></th>
                                        <th className="run-menu-th-action"><Message msgId="hydrata.anuga.run" /></th>
                                        <th className="run-menu-th-action"><Message msgId="hydrata.anuga.download" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={"run-server-table-row"} style={{marginTop: "15px"}}>
                                        <td className="run-menu-td-name">{this.props.selectedScenario.name}</td>
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
                                                className="anuga-btn"
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
                                                className="anuga-btn"
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
                <div className="scenario-footer">
                    <Button
                        bsStyle={'success'}
                        bsSize={'small'}
                        className="anuga-btn"
                        onClick={() => {
                            this.props.showManageAccount(true);
                            this.props.showAnugaRunMenu(false);
                            trackEvent('button', `click`, `anuga-run-menu-manage-account-open`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.manageAccount" />
                    </Button>
                    <Button
                        bsStyle={'default'}
                        bsSize={'small'}
                        className="anuga-btn"
                        onClick={() => {
                            this.props.showAnugaRunMenu(false);
                            this.props.setAnugaScenarioMenu(true);
                            trackEvent('button', `click`, `anuga-run-menu-close-footer`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.close" />
                    </Button>
                </div>
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


// Export the unconnected class as well so tests can mount it without a
// full Redux store / mock dispatch wiring. The default export remains the
// connected component used by callers.
export {AnugaRunMenu, AnugaRunMenuClass};

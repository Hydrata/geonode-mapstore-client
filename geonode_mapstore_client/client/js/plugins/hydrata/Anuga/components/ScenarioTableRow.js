import React from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, toHHMM, getSecondsFromHHMM} from './scenarioHelpers';

/**
 * Renders a single scenario <tr> with manage/advanced/compare column groups.
 * Supports 9 state machine states from v2 API.
 */
class ScenarioTableRow extends React.Component {
    static propTypes = {
        scenario: PropTypes.object.isRequired,
        scenarioTableTabs: PropTypes.array.isRequired,
        // Data lists for select dropdowns
        elevations: PropTypes.array,
        boundaries: PropTypes.array,
        inflows: PropTypes.array,
        frictions: PropTypes.array,
        structures: PropTypes.array,
        meshRegions: PropTypes.array,
        networks: PropTypes.array,
        // Callbacks
        updateAnugaScenario: PropTypes.func.isRequired,
        saveAnugaScenario: PropTypes.func.isRequired,
        setOpenMenuGroupId: PropTypes.func.isRequired,
        selectAnugaScenario: PropTypes.func.isRequired,
        showAnugaScenarioLog: PropTypes.func.isRequired,
        showAnugaRunMenu: PropTypes.func.isRequired,
        setAnugaScenarioMenu: PropTypes.func.isRequired,
        deleteAnugaScenario: PropTypes.func.isRequired,
        cancelAnugaRun: PropTypes.func.isRequired,
        retryAnugaRun: PropTypes.func,
        toggleScenarioSelected: PropTypes.func.isRequired,
        validateScenario: PropTypes.func
    };

    handleTextChange = (e) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleIntChange = (e) => {
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleNumberChange = (e) => {
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleTimeChange = (event) => {
        this.props.updateAnugaScenario(this.props.scenario, { tempTimeString: event.target.value });
    }

    handleTimeBlur = (event) => {
        const seconds = Math.max(0, getSecondsFromHHMM(event.target.value));
        const kv = {};
        kv[event.target.id] = seconds;
        delete kv.tempTimeString;
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    buildScenario = () => {
        const {scenario} = this.props;
        this.props.saveAnugaScenario(scenario);
        this.props.setOpenMenuGroupId(null);
        trackEvent('button', 'click', 'anuga-scenario-menu-build');
    }

    renderSelectCell(id, value, options) {
        const {scenario} = this.props;
        return (
            <td>
                <select
                    id={id}
                    key={`${id}-${scenario.id}`}
                    value={value}
                    className={'scenario-select'}
                    onChange={this.handleIntChange}
                >
                    <option value={""}>-</option>
                    {options?.map((item) => (
                        <option key={item?.id} value={item?.id}>{item?.title}</option>
                    ))}
                </select>
            </td>
        );
    }

    renderStatusCell() {
        const {scenario} = this.props;
        const status = findScenarioStatus(scenario);
        const latestRun = scenario?.latest_run;

        switch (status) {
        case 'building':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusBuilding" />
                </td>
            );
        case 'queued':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusQueued" />
                </td>
            );
        case 'computing': {
            const pct = latestRun?.progress_pct || 0;
            const eta = latestRun?.eta_seconds;
            return (
                <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                        <div style={{flex: 1, height: 8, background: '#444', borderRadius: 4, overflow: 'hidden'}}>
                            <div style={{width: `${pct}%`, height: '100%', background: '#5cb85c', transition: 'width 0.5s'}} />
                        </div>
                        <span style={{fontSize: 10, minWidth: 32}}>{Math.round(pct)}%</span>
                        {eta ? <span style={{fontSize: 10, color: '#888'}}>{Math.ceil(eta / 60)}m</span> : null}
                    </div>
                </td>
            );
        }
        case 'processing':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusProcessing" />
                </td>
            );
        case 'complete':
            return (
                <td className="status-complete">
                    <span className="glyphicon glyphicon-ok status-icon" />
                    <Message msgId="hydrata.anuga.statusComplete" />
                </td>
            );
        case 'error':
            return (
                <td className="status-error">
                    <Message msgId="hydrata.anuga.statusError" />
                    {latestRun?.error_message ?
                        <span title={latestRun.error_message} style={{fontSize: 10, marginLeft: 4}}>
                            {latestRun.error_message.substring(0, 30)}{latestRun.error_message.length > 30 ? '...' : ''}
                        </span> : null
                    }
                </td>
            );
        case 'cancelled':
            return (
                <td className="status-cancelled">
                    <Message msgId="hydrata.anuga.statusCancelled" />
                </td>
            );
        case 'built':
            return (<td><Message msgId="hydrata.anuga.statusBuilt" /></td>);
        case 'created':
        default:
            return (<td>{status}</td>);
        }
    }

    renderRunButton() {
        const {scenario} = this.props;
        const status = findScenarioStatus(scenario);
        switch (status) {
        case 'built':
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        this.props.setAnugaScenarioMenu(false);
                        this.props.selectAnugaScenario(scenario);
                        this.props.showAnugaRunMenu(true);
                        trackEvent('button', 'click', 'anuga-scenario-menu-run');
                    }}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        case 'complete':
            return (
                <Button
                    download href={scenario?.latest_run?.s3_package_url}
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-download')}
                >
                    <span className="glyphicon glyphicon-download" aria-hidden="true" />
                </Button>
            );
        case 'error':
            return (
                <Button
                    bsStyle={'warning'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        if (scenario?.latest_run?.id && this.props.retryAnugaRun) {
                            this.props.retryAnugaRun(scenario.latest_run.id);
                        }
                        trackEvent('button', 'click', 'anuga-scenario-menu-retry');
                    }}
                >
                    <Message msgId="hydrata.anuga.retry" />
                </Button>
            );
        case 'cancelled':
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        this.props.setAnugaScenarioMenu(false);
                        this.props.selectAnugaScenario(scenario);
                        this.props.showAnugaRunMenu(true);
                        trackEvent('button', 'click', 'anuga-scenario-menu-rerun');
                    }}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        case 'queued':
        case 'computing':
        case 'processing':
        case 'building':
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn disabled"
                >
                    <span className="glyphicon glyphicon-refresh glyphicon-spin" aria-hidden="true" />
                </Button>
            );
        default:
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn disabled"
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-run')}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        }
    }

    render() {
        const {scenario, scenarioTableTabs} = this.props;
        const showManage = scenarioTableTabs?.includes('manage');
        const showAdvanced = scenarioTableTabs?.includes('advanced');
        const showCompare = scenarioTableTabs?.includes('compare');
        const isUnsaved = scenario.unsaved;
        const status = findScenarioStatus(scenario);
        const isCancellable = ['queued', 'computing', 'building'].includes(status);

        return (
            <tr className={'scenario-table-row'}>
                <td>{scenario.id}</td>
                <td>
                    <input
                        id={'name'} key={`name-${scenario.id}`}
                        type={"text"} className={'scenario-input'}
                        value={scenario.name}
                        onChange={this.handleTextChange}
                    />
                </td>
                {showManage ?
                    <React.Fragment>
                        {this.renderSelectCell('elevation', scenario?.elevation, this.props.elevations)}
                        {this.renderSelectCell('boundary', scenario?.boundary, this.props.boundaries)}
                        {this.renderSelectCell('inflow', scenario?.inflow, this.props.inflows)}
                    </React.Fragment> : null
                }
                {showAdvanced ?
                    <React.Fragment>
                        {this.renderSelectCell('friction', scenario?.friction, this.props.frictions)}
                        {this.renderSelectCell('structure', scenario?.structure, this.props.structures)}
                        {this.renderSelectCell('mesh_region', scenario?.mesh_region, this.props.meshRegions)}
                        {this.renderSelectCell('network', scenario?.network, this.props.networks)}
                        {!showManage ?
                            <td>
                                <Button
                                    bsStyle={'success'} bsSize={'xsmall'}
                                    className={"anuga-btn" + (isUnsaved ? '' : ' disabled')}
                                    onClick={() => {
                                        if (this.props.validateScenario?.(scenario) !== false) {
                                            this.buildScenario();
                                        } else {
                                            window.alert("Scenario is not valid");
                                        }
                                    }}
                                >
                                    <Message msgId="hydrata.anuga.build" />
                                </Button>
                            </td> : null
                        }
                    </React.Fragment> : null
                }
                {showManage ?
                    <React.Fragment>
                        <td>
                            <input
                                id={'resolution'} key={`resolution-${scenario.id}`}
                                type={"number"} className={'scenario-input scenario-input-narrow'}
                                value={scenario?.resolution}
                                onChange={this.handleNumberChange}
                            />
                        </td>
                        <td>
                            <input
                                id={'duration'} key={`duration-${scenario.id}`}
                                type={"text"} className={'scenario-input scenario-input-narrow'}
                                value={scenario.tempTimeString || toHHMM(scenario.duration)}
                                onChange={this.handleTimeChange}
                                onBlur={this.handleTimeBlur}
                            />
                        </td>
                        {this.renderStatusCell()}
                        <td>
                            <Button
                                bsStyle={'success'} bsSize={'xsmall'}
                                className={"anuga-btn" + (isUnsaved ? '' : ' disabled')}
                                onClick={() => {
                                    if (this.props.validateScenario?.(scenario) !== false) {
                                        this.buildScenario();
                                    } else {
                                        window.alert("Scenario is not valid");
                                    }
                                }}
                            >
                                <Message msgId="hydrata.anuga.build" />
                            </Button>
                        </td>
                        <td>{this.renderRunButton()}</td>
                        <td>
                            <Button
                                bsStyle={'info'} bsSize={'xsmall'}
                                className="anuga-btn"
                                onClick={() => {
                                    this.props.selectAnugaScenario(scenario);
                                    if (this.props.openTaskMonitorForRun) {
                                        this.props.openTaskMonitorForRun();
                                    } else {
                                        this.props.showAnugaScenarioLog(scenario.id);
                                    }
                                    trackEvent('button', 'click', 'anuga-scenario-menu-view-log');
                                }}
                            >
                                <Message msgId="hydrata.anuga.log" />
                            </Button>
                        </td>
                        <td>
                            <Button
                                bsStyle={'danger'} bsSize={'xsmall'}
                                className="anuga-btn-delete"
                                onClick={
                                    isCancellable ?
                                        () => {
                                            trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run');
                                            if (confirm('Cancel Run?')) {
                                                trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run-confirm');
                                                this.props.cancelAnugaRun(scenario?.latest_run?.id);
                                            }
                                        } :
                                        () => {
                                            trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario');
                                            if (confirm('Delete Scenario?')) {
                                                this.props.deleteAnugaScenario(scenario);
                                                trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario-confirm');
                                            }
                                        }
                                }
                            >
                                <span className={isCancellable ? "glyphicon glyphicon-ban-circle" : "glyphicon glyphicon-trash"} aria-hidden="true" />
                            </Button>
                        </td>
                    </React.Fragment> : null
                }
                {showCompare ?
                    <React.Fragment>
                        <td>
                            <span
                                className={"btn glyphicon menu-row-glyph scenario-compare-glyph " + (scenario?.selected ? "glyphicon-ok glyph-active" : "glyphicon-remove glyph-inactive")}
                                onClick={() => {
                                    this.props.toggleScenarioSelected(scenario);
                                    trackEvent('button', 'click', `anuga-scenario-menu-select-scenario-${scenario?.name}`);
                                }}
                            />
                        </td>
                    </React.Fragment> : null
                }
            </tr>
        );
    }
}

export default ScenarioTableRow;

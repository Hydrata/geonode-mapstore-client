import React from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, toHHMM, getSecondsFromHHMM} from './scenarioHelpers';

/**
 * Renders a single scenario <tr> with manage/advanced/compare column groups.
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
        toggleScenarioSelected: PropTypes.func.isRequired
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

    renderRunButton() {
        const {scenario} = this.props;
        const status = findScenarioStatus(scenario);
        switch (status) {
        case 'built':
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    style={{margin: "2px", borderRadius: "2px"}}
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
                    style={{margin: "2px", borderRadius: "2px"}}
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-download')}
                >
                    <span className="glyphicon glyphicon-download" aria-hidden="true" />
                </Button>
            );
        default:
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className={'disabled'}
                    style={{margin: "2px", borderRadius: "2px"}}
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
                                    style={{margin: "2px", borderRadius: "2px"}}
                                    className={isUnsaved ? null : 'disabled'}
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
                                type={"number"} className={'scenario-input'}
                                style={{width: '80px'}}
                                value={scenario?.resolution}
                                onChange={this.handleNumberChange}
                            />
                        </td>
                        <td>
                            <input
                                id={'duration'} key={`duration-${scenario.id}`}
                                type={"text"} className={'scenario-input'}
                                style={{width: '80px'}}
                                value={scenario.tempTimeString || toHHMM(scenario.duration)}
                                onChange={this.handleTimeChange}
                                onBlur={this.handleTimeBlur}
                            />
                        </td>
                        <td>{findScenarioStatus(scenario)}</td>
                        <td>
                            <Button
                                bsStyle={'success'} bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                className={isUnsaved ? null : 'disabled'}
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
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {
                                    this.props.selectAnugaScenario(scenario);
                                    this.props.showAnugaScenarioLog(scenario.id);
                                    trackEvent('button', 'click', 'anuga-scenario-menu-view-log');
                                }}
                            >
                                <Message msgId="hydrata.anuga.log" />
                            </Button>
                        </td>
                        <td>
                            <Button
                                bsStyle={'danger'} bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px", backgroundColor: "#622b2b"}}
                                onClick={
                                    findScenarioStatus(scenario)?.includes?.('%') ?
                                        () => {
                                            trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run');
                                            if (confirm('Cancel Run?')) {
                                                trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run-confirm');
                                                this.props.cancelAnugaRun(scenario);
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
                                <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                            </Button>
                        </td>
                    </React.Fragment> : null
                }
                {showCompare ?
                    <React.Fragment>
                        <td>
                            <span
                                className={"btn glyphicon menu-row-glyph " + (scenario?.selected ? "glyphicon-ok" : "glyphicon-remove")}
                                style={{
                                    color: scenario?.selected ? "limegreen" : "red",
                                    fontSize: "10px"
                                }}
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

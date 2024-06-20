import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    cancelAnugaRun,
    saveAnugaScenario,
    updateAnugaScenario,
    selectAnugaScenario,
    showAnugaScenarioLog,
    setAnugaScenarioMenu,
    addAnugaScenario,
    stopAnugaScenarioPolling,
    deleteAnugaScenario,
    showAnugaRunMenu,
    toggleScenarioSelected,
    compareScenarios
} from "../actionsAnuga";

import {selectedScenarios} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import {CustomEvent} from "@piwikpro/react-piwik-pro";

class AnugaScenarioMenuClass extends React.Component {
    static propTypes = {
        anugaGroupLength: PropTypes.number,
        scenarios: PropTypes.array,
        boundaries: PropTypes.array,
        elevations: PropTypes.array,
        frictions: PropTypes.array,
        inflows: PropTypes.array,
        structures: PropTypes.array,
        meshRegions: PropTypes.array,
        networks: PropTypes.array,
        setOpenMenuGroupId: PropTypes.func,
        saveAnugaScenario: PropTypes.func,
        runAnugaScenario: PropTypes.func,
        updateAnugaScenario: PropTypes.func,
        selectAnugaScenario: PropTypes.func,
        showAnugaScenarioLog: PropTypes.func,
        setAnugaScenarioMenu: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        addAnugaScenario: PropTypes.func,
        deleteAnugaScenario: PropTypes.func,
        cancelAnugaRun: PropTypes.func,
        showAnugaRunMenu: PropTypes.func,
        toggleScenarioSelected: PropTypes.func,
        selectedScenarios: PropTypes.array,
        compareScenarios: PropTypes.func,
        readyToCompare: PropTypes.number
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            scenarioTableTabs: ['manage', 'compare']
        };
        this.handleTextChange = this.handleTextChange.bind(this);
        this.handleBoolChange = this.handleBoolChange.bind(this);
        this.handleIntChange = this.handleIntChange.bind(this);
        this.handleTimeChange = this.handleTimeChange.bind(this);
        this.handleTimeBlur = this.handleTimeBlur.bind(this);
    }

    getSecondsFromHHMM = (userInputValue) => {
        console.log('userInputValue', userInputValue);
        const [hours, minutes] = userInputValue.split(":");

        const hoursNumber = Number(hours);
        const minutesNumber = Number(minutes);
        console.log('hoursNumber', hoursNumber);
        console.log('minutesNumber', minutesNumber);

        if (!isNaN(hoursNumber) && isNaN(minutesNumber)) {
            // case where just minutes were entered - hoursNumber is actually the required minutes
            console.log('returning:', hoursNumber * 60);
            return hoursNumber * 60;
        }

        if (!isNaN(hoursNumber) && !isNaN(minutesNumber)) {
            // case where user entered both hours and minutes hh:mm
            console.log('returning:', (hoursNumber * 60 + minutesNumber) * 60);
            return (hoursNumber * 60 + minutesNumber) * 60;
        }

        return 0;
    };


    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'anuga-scenario-menu'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        Scenarios
                        <span id={"scenario-tab-button-group"}>
                            <Button
                                bsSize={'medium'}
                                style={{
                                    margin: "2px 0 -17px 20px",
                                    borderRadius: "6px 6px 0 0",
                                    color: this.state.scenarioTableTabs.includes('manage') ? "#3363a0" : 'white',
                                    backgroundColor: this.state.scenarioTableTabs.includes('manage') ? "white" : '#6085b5'
                                }}
                                onClick={
                                    () => {
                                        this.state.scenarioTableTabs.includes('manage') ?
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'manage')]
                                            })) :
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs, 'manage']
                                            }));
                                        console.log(`tracking anuga-scenario-menu-manage-tab-toggle`);
                                        CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-manage-tab-toggle`);
                                    }
                                }
                            >
                                Manage
                            </Button>
                            <Button
                                bsSize={'medium'}
                                style={{
                                    margin: "2px 0 -17px 8px",
                                    borderRadius: "6px 6px 0 0",
                                    color: this.state.scenarioTableTabs.includes('advanced') ? "#3363a0" : 'white',
                                    backgroundColor: this.state.scenarioTableTabs.includes('advanced') ? "white" : '#6085b5'
                                }}
                                onClick={
                                    () => {
                                        this.state.scenarioTableTabs.includes('advanced') ?
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'advanced')]
                                            })) :
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs, 'advanced']
                                            }));
                                        console.log(`tracking anuga-scenario-menu-advanced-tab-toggle`);
                                        CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-advanced-tab-toggle`);
                                    }
                                }
                            >
                                Advanced
                            </Button>
                            <Button
                                bsSize={'medium'}
                                style={{
                                    margin: "2px 0 -17px 8px",
                                    borderRadius: "6px 6px 0 0",
                                    color: this.state.scenarioTableTabs.includes('compare') ? "#3363a0" : 'white',
                                    backgroundColor: this.state.scenarioTableTabs.includes('compare') ? "white" : '#6085b5'
                                }}
                                onClick={
                                    () => {
                                        this.state.scenarioTableTabs.includes('compare') ?
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'compare')]
                                            })) :
                                            this.setState(prevState => ({
                                                scenarioTableTabs: [...prevState.scenarioTableTabs, 'compare']
                                            }));
                                        console.log(`tracking anuga-scenario-menu-compare-tab-toggle`);
                                        CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-compare-tab-toggle`);
                                    }
                                }
                            >
                                Compare
                            </Button>
                        </span>
                        <span id={"new-scenario-button"}>
                            <Button
                                bsStyle={'success'}
                                bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {
                                    this.props.addAnugaScenario();
                                    console.log(`tracking anuga-scenario-menu-new-scenario`);
                                    CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-new-scenario`);
                                }}
                            >
                                New Scenario
                            </Button>
                        </span>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setAnugaScenarioMenu(false);
                                    this.props.stopAnugaScenarioPolling();
                                    console.log(`tracking anuga-scenario-menu-close`);
                                    CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-close`);
                                }
                            }
                        />
                    </div>
                    <Table className={"scenario-table"}>
                        <thead>
                            <tr className={"scenario-table-header"}>
                                <th>Id</th>
                                <th>Name</th>
                                {
                                    this.state.scenarioTableTabs?.includes('manage') ?
                                        <React.Fragment>
                                            <th>Elevation</th>
                                            <th>Boundary</th>
                                            <th>Inflow</th>
                                        </React.Fragment> : null
                                }
                                {
                                    this.state.scenarioTableTabs?.includes('advanced') ?
                                        <React.Fragment>
                                            <th>Friction Map</th>
                                            <th>Structures</th>
                                            <th>Mesh Regions</th>
                                            <th>Network</th>
                                            {
                                                !this.state.scenarioTableTabs?.includes('manage') ?
                                                    <th/> : null
                                            }
                                        </React.Fragment> : null
                                }
                                {
                                    this.state.scenarioTableTabs?.includes('manage') ?
                                        <React.Fragment>
                                            <th>Resolution(m2)</th>
                                            <th>Duration</th>
                                            <th>Status</th>
                                            <th/>
                                            <th/>
                                            <th/>
                                            <th/>
                                        </React.Fragment> : null
                                }
                                {
                                    this.state.scenarioTableTabs?.includes('compare') ?
                                        <React.Fragment>
                                            <th>
                                                <span id={"depth-difference-button"}>
                                                    <Button
                                                        bsStyle={'success'}
                                                        bsSize={'xsmall'}
                                                        className={this.props.readyToCompare ? '' : 'disabled'}
                                                        style={{margin: "2px", borderRadius: "2px"}}
                                                        onClick={() => {
                                                            this.props.compareScenarios(this.props.selectedScenarios);
                                                            console.log(`tracking anuga-scenario-menu-compare`);
                                                            CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-compare-execute`);
                                                        }}
                                                    >
                                                        Compare
                                                    </Button>
                                                </span>
                                            </th>
                                        </React.Fragment> : null
                                }
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.props.scenarios?.map(scenario => {
                                    return (
                                        <tr className={'scenario-table-row'}>
                                            <td>{scenario.id}</td>
                                            <td>
                                                <input
                                                    id={'name'}
                                                    key={`name-${scenario.id}`}
                                                    type={"text"}
                                                    className={'scenario-input'}
                                                    value={scenario.name}
                                                    onChange={(e) => this.handleTextChange(e, scenario)}
                                                />
                                            </td>
                                            {
                                                this.state.scenarioTableTabs?.includes('manage') ?
                                                    <React.Fragment>
                                                        <td>
                                                            <select
                                                                id={'elevation'}
                                                                key={`elevation-${scenario.id}`}
                                                                value={scenario?.elevation}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.elevations?.map((elevation) => {
                                                                        return (
                                                                            <option
                                                                                value={elevation?.id}>{elevation?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                id={'boundary'}
                                                                key={`boundary-${scenario.id}`}
                                                                value={scenario?.boundary}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.boundaries?.map((boundary) => {
                                                                        return (
                                                                            <option
                                                                                value={boundary?.id}>{boundary?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                id={'inflow'}
                                                                key={`inflow-${scenario.id}`}
                                                                value={scenario?.inflow}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.inflows?.map((inflow) => {
                                                                        return (
                                                                            <option
                                                                                value={inflow?.id}>{inflow?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                    </React.Fragment> : null
                                            }
                                            {
                                                this.state.scenarioTableTabs?.includes('advanced') ?
                                                    <React.Fragment>
                                                        <td>
                                                            <select
                                                                id={'friction'}
                                                                key={`friction-${scenario.id}`}
                                                                value={scenario?.friction}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.frictions?.map((friction) => {
                                                                        return (
                                                                            <option
                                                                                value={friction?.id}>{friction?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                id={'structure'}
                                                                key={`structure-${scenario.id}`}
                                                                value={scenario?.structure}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.structures?.map((structure) => {
                                                                        return (
                                                                            <option
                                                                                value={structure?.id}>{structure?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                id={'mesh_region'}
                                                                key={`meshRegion-${scenario.id}`}
                                                                value={scenario?.mesh_region}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.meshRegions?.map((meshRegion) => {
                                                                        return (
                                                                            <option
                                                                                value={meshRegion?.id}>{meshRegion?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                id={'network'}
                                                                key={`network-${scenario.id}`}
                                                                value={scenario?.network}
                                                                className={'scenario-select'}
                                                                onChange={(e) => this.handleIntChange(e, scenario)}
                                                            >
                                                                <option value={""}>-</option>
                                                                {
                                                                    this.props.networks?.map((network) => {
                                                                        return (
                                                                            <option
                                                                                value={network?.id}>{network?.title}</option>
                                                                        );
                                                                    })
                                                                }
                                                            </select>
                                                        </td>
                                                        {
                                                            !this.state.scenarioTableTabs?.includes('manage') ?
                                                                <td>
                                                                    <Button
                                                                        bsStyle={'success'}
                                                                        bsSize={'xsmall'}
                                                                        style={{margin: "2px", borderRadius: "2px"}}
                                                                        className={(scenario.unsaved && this.validateScenario(scenario)) ? null : 'disabled'}
                                                                        onClick={() => {
                                                                            this.props.saveAnugaScenario(scenario);
                                                                            this.props.setOpenMenuGroupId(null);
                                                                            console.log(`tracking anuga-scenario-menu-build`);
                                                                            CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-build`);
                                                                        }}
                                                                    >
                                                                        Build
                                                                    </Button>
                                                                </td> : null
                                                        }
                                                    </React.Fragment> : null
                                            }
                                            {
                                                this.state.scenarioTableTabs?.includes('manage') ?
                                                    <React.Fragment>
                                                        <td>
                                                            <input
                                                                id={'resolution'}
                                                                key={`resolution-${scenario.id}`}
                                                                type={"number"}
                                                                className={'scenario-input'}
                                                                style={{'width': '80px'}}
                                                                value={scenario?.resolution}
                                                                onChange={(event) => this.handleNumberChange(event, scenario)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                id={'duration'}
                                                                key={`duration-${scenario.id}`}
                                                                type={"text"}
                                                                className={'scenario-input'}
                                                                style={{'width': '80px'}}
                                                                value={scenario.tempTimeString || this.toHHMM(scenario.duration)}
                                                                onChange={(event) => this.handleTimeChange(event, scenario)}
                                                                onBlur={(event) => this.handleTimeBlur(event, scenario)}
                                                            />
                                                        </td>
                                                        <td>
                                                            {this.findScenarioStatus(scenario)}
                                                        </td>
                                                        <td>
                                                            <Button
                                                                bsStyle={'success'}
                                                                bsSize={'xsmall'}
                                                                style={{margin: "2px", borderRadius: "2px"}}
                                                                className={(scenario.unsaved && this.validateScenario(scenario)) ? null : 'disabled'}
                                                                onClick={() => {
                                                                    this.props.saveAnugaScenario(scenario);
                                                                    this.props.setOpenMenuGroupId(null);
                                                                    console.log(`tracking anuga-scenario-menu-build`);
                                                                    CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-build`);
                                                                }}
                                                            >
                                                                Build
                                                            </Button>
                                                        </td>
                                                        <td>
                                                            {(() => {
                                                                const status = this.findScenarioStatus(scenario);
                                                                switch (status) {
                                                                case 'built':
                                                                    return (
                                                                        <Button
                                                                            bsStyle={'success'}
                                                                            bsSize={'xsmall'}
                                                                            style={{margin: "2px", borderRadius: "2px"}}
                                                                            onClick={() => {
                                                                                this.props.setAnugaScenarioMenu(false);
                                                                                this.props.selectAnugaScenario(scenario);
                                                                                this.props.showAnugaRunMenu(true);
                                                                                console.log(`tracking anuga-scenario-menu-run`);
                                                                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-run`);
                                                                            }}
                                                                        >
                                                                            Run
                                                                        </Button>
                                                                    );
                                                                case 'complete':
                                                                    return (
                                                                        <Button
                                                                            download
                                                                            href={scenario?.latest_run?.s3_package_url}
                                                                            bsStyle={'success'}
                                                                            bsSize={'xsmall'}
                                                                            style={{margin: "2px", borderRadius: "2px"}}
                                                                            onClick={() => {
                                                                                console.log(`tracking anuga-scenario-menu-download`);
                                                                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-download`);
                                                                            }}
                                                                        >
                                                                            <span className="glyphicon glyphicon-download" aria-hidden="true" />
                                                                        </Button>
                                                                    );
                                                                default:
                                                                    return (
                                                                        <Button
                                                                            bsStyle={'success'}
                                                                            bsSize={'xsmall'}
                                                                            className={'disabled'}
                                                                            style={{margin: "2px", borderRadius: "2px"}}
                                                                            onClick={() => {
                                                                                console.log(`tracking anuga-scenario-menu-run`);
                                                                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-run`);
                                                                            }}
                                                                        >
                                                                            Run
                                                                        </Button>
                                                                    );
                                                                }
                                                            })()}
                                                        </td>
                                                        <td>
                                                            <Button
                                                                bsStyle={'info'}
                                                                bsSize={'xsmall'}
                                                                style={{margin: "2px", borderRadius: "2px"}}
                                                                onClick={() => {
                                                                    this.props.selectAnugaScenario(scenario);
                                                                    this.props.showAnugaScenarioLog(scenario.id);
                                                                    console.log(`tracking anuga-scenario-menu-view-log`);
                                                                    CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-view-log`);
                                                                }}
                                                            >
                                                                Log
                                                            </Button>
                                                        </td>
                                                        <td>
                                                            <Button
                                                                bsStyle={'danger'}
                                                                bsSize={'xsmall'}
                                                                style={{margin: "2px", borderRadius: "2px", backgroundColor: "#622b2b"}}
                                                                onClick={
                                                                    this.findScenarioStatus(scenario)?.includes('%') ?
                                                                        () => {
                                                                            console.log(`tracking anuga-scenario-menu-cancel-run`);
                                                                            CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-cancel-run`);
                                                                            if (confirm('Cancel Run?')) {
                                                                                console.log(`tracking anuga-scenario-menu-cancel-run-confirm`);
                                                                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-cancel-run-confirm`);
                                                                                this.props.cancelAnugaRun(scenario);
                                                                            }
                                                                        } :
                                                                        () => {
                                                                            console.log(`tracking anuga-scenario-menu-delete-scenario`);
                                                                            CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-delete-scenario`);
                                                                            if (confirm('Delete Scenario?')) {
                                                                                this.props.deleteAnugaScenario(scenario);
                                                                                console.log(`tracking anuga-scenario-menu-delete-scenario-confirm`);
                                                                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-delete-scenario-confirm`);
                                                                            }
                                                                        }
                                                                }
                                                            >
                                                                <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                                                            </Button>
                                                        </td>
                                                    </React.Fragment> : null
                                            }
                                            {
                                                this.state.scenarioTableTabs?.includes('compare') ?
                                                    <React.Fragment>
                                                        <td>
                                                            <span
                                                                className={"btn glyphicon menu-row-glyph " + (scenario?.selected ? "glyphicon-ok" : "glyphicon-remove")}
                                                                style={{
                                                                    "color": scenario?.selected ? "limegreen" : "red",
                                                                    "fontSize": "10px"
                                                                }}
                                                                onClick={() => {
                                                                    this.props.toggleScenarioSelected(scenario);
                                                                    console.log(`tracking anuga-scenario-menu-select-scenario-${scenario?.name}`);
                                                                    CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-select-scenario-${scenario?.name}`);
                                                                }}
                                                            />
                                                        </td>
                                                    </React.Fragment> : null
                                            }
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </Table>
                </div>
            </div>
        );
    }

    findScenarioStatus = (scenario) => {
        if (!scenario?.latest_run_is_valid && scenario.status === 'building server') {
            return scenario.status;
        }
        if (scenario?.latest_run_is_valid || scenario?.latest_run?.status === 'error') {
            return scenario.latest_run.status;
        }
        return scenario.status;
    }

    handleTextChange = (e, scenario) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateAnugaScenario(scenario, kv);
    }

    handleBoolChange = (e, scenario) => {
        const kv = {};
        kv[e.target.id] = !scenario[e.target.id];
        this.props.updateAnugaScenario(scenario, kv);
    }

    handleIntChange = (e, scenario) => {
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateAnugaScenario(scenario, kv);
    }

    handleNumberChange = (e, scenario) => {
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateAnugaScenario(scenario, kv);
    }

    toHHMM = (secs) => {
        if (!secs) {
            return 'hh:mm';
        }
        const secNum = parseInt(secs.toString(), 10);
        const hours = Math.floor(secNum / 3600);
        const minutes = Math.floor(secNum / 60) % 60;
        const seconds = secNum % 60;

        return [hours, minutes, seconds]
            .map((val) => (val < 10 ? `0${val}` : val))
            .filter((val, index) => val !== "00" || index > 0)
            .join(":")
            .replace(/^0/, "")
            .slice(0, -3);
    };

    handleTimeChange = (event, scenario) => {
        const kv = {
            tempTimeString: event.target.value
        };
        this.props.updateAnugaScenario(scenario, kv);
    };

    handleTimeBlur = (event, scenario) => {
        const targetValue = event.target.value;
        console.log('targetValue', targetValue);
        const seconds = Math.max(0, this.getSecondsFromHHMM(targetValue));
        console.log('seconds', seconds);
        const kv = {};
        kv[event.target.id] = seconds;
        delete kv.tempTimeString;
        this.props.updateAnugaScenario(scenario, kv);
    };

    validateScenario = (scenario) => {
        console.log('validateScenario', scenario);
        if (!scenario || typeof scenario !== 'object') {
            return false;
        }
        if (!scenario?.name.length > 0) {
            return false;
        }
        console.log('validateScenario scenario?.name.length', scenario?.name.length);
        if (!scenario?.elevation) {
            return false;
        }
        console.log('validateScenario scenario?.elevation', scenario?.elevation);
        if (!scenario?.inflow) {
            return false;
        }
        console.log('validateScenario scenario?.inflow', scenario?.inflow);
        if (!scenario?.resolution > 0) {
            return false;
        }
        console.log('validateScenario scenario?.resolution > 0', scenario?.resolution > 0);
        if (!scenario?.duration > 0) {
            return false;
        }
        console.log('validateScenario scenario?.duration > 0', scenario?.duration > 0);
        if (!scenario?.boundary) {
            return false;
        }
        console.log('validateScenario', scenario);
        return true;
    }
}

const mapStateToProps = (state) => {
    // console.log('state?.anuga?.scenarios:', state?.anuga?.scenarios);
    let scenarios = state?.anuga?.scenarios?.sort((a, b) => a.id - b.id);
    // !scenarios[0]?.id ? scenarios.splice(0, 0, this.splice(-1, 1)[0]) : null // put newly created scenarios at the bottom of the list
    // console.log('scenarios:', scenarios);
    return {
        scenarios: scenarios,
        selectedScenarios: selectedScenarios(state),
        readyToCompare: selectedScenarios(state).length === 2,
        boundaries: state?.anuga?.boundaries,
        elevations: state?.anuga?.elevations,
        frictions: state?.anuga?.frictions,
        inflows: state?.anuga?.inflows,
        structures: state?.anuga?.structures,
        meshRegions: state?.anuga?.meshRegions,
        networks: state?.anuga?.networks
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        runAnugaScenario: (scenario) => dispatch(runAnugaScenario(scenario)),
        saveAnugaScenario: (scenario) => dispatch(saveAnugaScenario(scenario)),
        updateAnugaScenario: (scenario, kv) => dispatch(updateAnugaScenario(scenario, kv)),
        selectAnugaScenario: (scenario) => dispatch(selectAnugaScenario(scenario)),
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId)),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
        addAnugaScenario: () => dispatch(addAnugaScenario()),
        deleteAnugaScenario: (scenario) => dispatch(deleteAnugaScenario(scenario)),
        cancelAnugaRun: (scenario) => dispatch(cancelAnugaRun(scenario)),
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
        toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario)),
        compareScenarios: (scenarios) => dispatch(compareScenarios(scenarios))
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);


export {
    AnugaScenarioMenu
};

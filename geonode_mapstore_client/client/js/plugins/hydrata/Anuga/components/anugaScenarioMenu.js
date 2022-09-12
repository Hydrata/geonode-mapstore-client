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
    toggleScenarioSelected
} from "../actionsAnuga";

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
        toggleScenarioSelected: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            scenarioTableTabs: ['settings', 'inputs']
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
            console.log('returning:', hoursNumber * 60 * 60);
            return hoursNumber * 60 * 60;
        }

        if (!isNaN(hoursNumber) && !isNaN(minutesNumber)) {
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
                        <Button
                            bsSize={'medium'}
                            style={{
                                margin: "2px 0 -17px 20px",
                                borderRadius: "6px 6px 0 0",
                                color: this.state.scenarioTableTabs.includes('inputs') ? "#3363a0" : 'white',
                                backgroundColor: this.state.scenarioTableTabs.includes('inputs') ? "white" : '#6085b5'
                            }}
                            onClick={
                                () => this.state.scenarioTableTabs.includes('inputs') ?
                                    this.setState(prevState => ({
                                        scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'inputs')]
                                    })) :
                                    this.setState(prevState => ({
                                        scenarioTableTabs: [...prevState.scenarioTableTabs, 'inputs']
                                    }))
                            }
                        >
                            Inputs
                        </Button>
                        <span id={"scenario-tab-button-group"}>
                            <Button
                                bsSize={'medium'}
                                style={{
                                    margin: "2px 0 -17px 8px",
                                    borderRadius: "6px 6px 0 0",
                                    color: this.state.scenarioTableTabs.includes('settings') ? "#3363a0" : 'white',
                                    backgroundColor: this.state.scenarioTableTabs.includes('settings') ? "white" : '#6085b5'
                                }}
                                onClick={
                                    () => this.state.scenarioTableTabs.includes('settings') ?
                                        this.setState(prevState => ({
                                            scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'settings')]
                                        })) :
                                        this.setState(prevState => ({
                                            scenarioTableTabs: [...prevState.scenarioTableTabs, 'settings']
                                        }))
                                }
                            >
                                Settings
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
                                    () => this.state.scenarioTableTabs.includes('compare') ?
                                        this.setState(prevState => ({
                                            scenarioTableTabs: [...prevState.scenarioTableTabs.filter((tab, _) => tab !== 'compare')]
                                        })) :
                                        this.setState(prevState => ({
                                            scenarioTableTabs: [...prevState.scenarioTableTabs, 'compare']
                                        }))
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
                                    this.state.scenarioTableTabs?.includes('inputs') ?
                                        <React.Fragment>
                                            <th>Elevation</th>
                                            <th>Boundary</th>
                                            <th>Friction Map</th>
                                            <th>Inflow</th>
                                            <th>Structures</th>
                                            <th>Mesh Regions</th>
                                            {
                                                !this.state.scenarioTableTabs?.includes('settings') ?
                                                    <th/> : null
                                            }
                                        </React.Fragment> : null
                                }
                                {
                                    this.state.scenarioTableTabs?.includes('settings') ?
                                        <React.Fragment>
                                            <th>Resolution(m2)</th>
                                            {/*<th>Simplify Mesh</th>*/}
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
                                            <th>Select</th>
                                            <th>
                                                <span id={"depth-difference-button"}>
                                                    <Button
                                                        bsStyle={'success'}
                                                        bsSize={'xsmall'}
                                                        style={{margin: "2px", borderRadius: "2px"}}
                                                        onClick={() => {
                                                            alert('This feature coming soon.');
                                                        }}
                                                    >
                                                        Depth Difference
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
                                                this.state.scenarioTableTabs?.includes('inputs') ?
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
                                                        {
                                                            !this.state.scenarioTableTabs?.includes('settings') ?
                                                                <td>
                                                                    <Button
                                                                        bsStyle={'success'}
                                                                        bsSize={'xsmall'}
                                                                        style={{margin: "2px", borderRadius: "2px"}}
                                                                        className={scenario.unsaved ? null : 'disabled'}
                                                                        onClick={() => {
                                                                            this.props.saveAnugaScenario(scenario);
                                                                            this.props.setOpenMenuGroupId(null);
                                                                        }}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                </td> : null
                                                        }
                                                    </React.Fragment> : null
                                            }
                                            {
                                                this.state.scenarioTableTabs?.includes('settings') ?
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
                                                        {/*<td>*/}
                                                        {/*    <span*/}
                                                        {/*        id={'simplify_mesh'}*/}
                                                        {/*        key={`simplify_mesh-${scenario.id}`}*/}
                                                        {/*        className={"btn glyphicon menu-row-glyph " + (scenario?.simplify_mesh ? "glyphicon-ok" : "glyphicon-remove")}*/}
                                                        {/*        style={{*/}
                                                        {/*            "color": scenario?.simplify_mesh ? "limegreen" : "red",*/}
                                                        {/*            "fontSize": "10px"*/}
                                                        {/*        }}*/}
                                                        {/*        onClick={(event) => this.handleBoolChange(event, scenario)}*/}
                                                        {/*    />*/}
                                                        {/*</td>*/}
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
                                                                className={scenario.unsaved ? null : 'disabled'}
                                                                onClick={() => {
                                                                    this.props.saveAnugaScenario(scenario);
                                                                    this.props.setOpenMenuGroupId(null);
                                                                }}
                                                            >
                                                                Save
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
                                                                onClick={ this.findScenarioStatus(scenario).includes('%') ?
                                                                    () => {
                                                                        if (confirm('Cancel Run?')) {
                                                                            this.props.cancelAnugaRun(scenario);
                                                                        }
                                                                    } :
                                                                    () => {
                                                                        if (confirm('Delete Scenario?')) {
                                                                            this.props.deleteAnugaScenario(scenario);
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
                                                                    window.alert('Scenario comparison coming soon');
                                                                    this.props.toggleScenarioSelected(scenario);
                                                                }}
                                                            />
                                                        </td>
                                                        <td>-</td>
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

    toHHMM = (mins) => {
        if (!mins) {
            return 'hh:mm';
        }
        const minNum = parseInt(mins.toString(), 10);
        const hours = Math.floor(minNum / 60);
        console.log('minNum', minNum);
        console.log('hours', hours);

        const out = [hours, minNum]
            .map((val) => (val < 10 ? `0${val}` : val))
            .filter((val, index) => val !== "00" || index > 0)
            .join(":")
            .replace(/^0/, "");
        console.log('out', out);
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
        kv.tempTimeString = null;
        this.props.updateAnugaScenario(scenario, kv);
    };
}

const mapStateToProps = (state) => {
    // console.log('state?.anuga?.scenarios:', state?.anuga?.scenarios);
    let scenarios = state?.anuga?.scenarios?.sort((a, b) => a.id - b.id);
    // !scenarios[0]?.id ? scenarios.splice(0, 0, this.splice(-1, 1)[0]) : null // put newly created scenarios at the bottom of the list
    // console.log('scenarios:', scenarios);
    return {
        scenarios: scenarios,
        boundaries: state?.anuga?.boundaries,
        elevations: state?.anuga?.elevations,
        frictions: state?.anuga?.frictions,
        inflows: state?.anuga?.inflows,
        structures: state?.anuga?.structures,
        meshRegions: state?.anuga?.meshRegions
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
        toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario))
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);


export {
    AnugaScenarioMenu
};

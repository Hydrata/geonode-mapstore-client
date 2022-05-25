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
    showAnugaRunMenu
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
        showAnugaRunMenu: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
        this.handleTextChange = this.handleTextChange.bind(this);
        this.handleIntChange = this.handleIntChange.bind(this);
        this.handleTimeChange = this.handleTimeChange.bind(this);
        this.handleTimeBlur = this.handleTimeBlur.bind(this);
    }

    getSecondsFromHHMMSS = (userInputValue) => {
        const [hours, minutes, seconds] = userInputValue.split(":");

        const hoursNumber = Number(hours);
        const minutesNumber = Number(minutes);
        const secondsNumber = Number(seconds);

        if (!isNaN(hoursNumber) && isNaN(minutesNumber) && isNaN(secondsNumber)) {
            return hoursNumber;
        }

        if (!isNaN(hoursNumber) && !isNaN(minutesNumber) && isNaN(secondsNumber)) {
            return hoursNumber * 60 + minutesNumber;
        }

        if (!isNaN(hoursNumber) && !isNaN(minutesNumber) && !isNaN(secondsNumber)) {
            return hoursNumber * 60 * 60 + minutesNumber * 60 + secondsNumber;
        }

        return 0;
    };


    render() {
        return (
            <div id={'anuga-scenario-menu'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        Scenarios
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
                                <th>Select</th>
                                <th>Id</th>
                                <th>Name</th>
                                <th>Elevation</th>
                                <th>Boundary</th>
                                <th>Friction Map</th>
                                <th>Inflow</th>
                                <th>Structures</th>
                                <th>Mesh Regions</th>
                                <th>Resolution(m2)</th>
                                <th>Duration</th>
                                <th>Status</th>
                                <th/>
                                <th/>
                                <th/>
                                <th/>
                                <th/>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.props.scenarios?.map(scenario => {
                                    return (
                                        <tr className={'scenario-table-row'}>
                                            <td>
                                                <input
                                                    id={'scenario-selector-box'}
                                                    type={'radio'}
                                                    name={'scenario-selector'}
                                                    value={false}
                                                    onChange={() => this.props.selectAnugaScenario(scenario)}
                                                />
                                            </td>
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
                                                                <option value={elevation?.id}>{elevation?.title}</option>
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
                                                                <option value={boundary?.id}>{boundary?.title}</option>
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
                                                                <option value={friction?.id}>{friction?.title}</option>
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
                                                                <option value={inflow?.id}>{inflow?.title}</option>
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
                                                                <option value={structure?.id}>{structure?.title}</option>
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
                                                                <option value={meshRegion?.id}>{meshRegion?.title}</option>
                                                            );
                                                        })
                                                    }
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    id={'maximum_triangle_area'}
                                                    key={`maximum_triangle_area-${scenario.id}`}
                                                    type={"number"}
                                                    className={'scenario-input'}
                                                    style={{'width': '80px'}}
                                                    value={scenario?.maximum_triangle_area}
                                                    onChange={(event) => this.handleIntChange(event, scenario)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    id={'duration'}
                                                    key={`duration-${scenario.id}`}
                                                    type={"text"}
                                                    className={'scenario-input'}
                                                    style={{'width': '80px'}}
                                                    value={scenario.tempTimeString || this.toHHMMSS(scenario.duration)}
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
                                                <Button
                                                    bsStyle={'success'}
                                                    bsSize={'xsmall'}
                                                    style={{margin: "2px", borderRadius: "2px"}}
                                                    className={this.findScenarioStatus(scenario) !== 'built' ? 'disabled' : null }
                                                    onClick={() => {
                                                        this.props.setAnugaScenarioMenu(false);
                                                        this.props.selectAnugaScenario(scenario);
                                                        this.props.showAnugaRunMenu(true);
                                                    }}
                                                >
                                                    Run
                                                </Button>
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

    toHHMMSS = (secs) => {
        if (!secs) {
            return '00:00:00';
        }
        const secNum = parseInt(secs.toString(), 10);
        const hours = Math.floor(secNum / 3600);
        const minutes = Math.floor(secNum / 60) % 60;
        const seconds = secNum % 60;

        return [hours, minutes, seconds]
            .map((val) => (val < 10 ? `0${val}` : val))
            .filter((val, index) => val !== "00" || index > 0)
            .join(":")
            .replace(/^0/, "");
    };

    handleTimeChange = (event, scenario) => {
        const kv = {
            tempTimeString: event.target.value
        };
        this.props.updateAnugaScenario(scenario, kv);
    };

    handleTimeBlur = (event, scenario) => {
        const targetValue = event.target.value;
        const seconds = Math.max(0, this.getSecondsFromHHMMSS(targetValue));
        const kv = {};
        kv[event.target.id] = seconds;
        kv.tempTimeString = null;
        this.props.updateAnugaScenario(scenario, kv);
    };
}

const mapStateToProps = (state) => {
    return {
        scenarios: state?.anuga?.scenarios?.sort((a, b) => a.id - b.id),
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
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible))
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);


export {
    AnugaScenarioMenu
};

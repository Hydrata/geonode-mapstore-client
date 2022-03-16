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
    deleteAnugaScenario
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
        cancelAnugaRun: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
        this.handleTextChange = this.handleTextChange.bind(this);
        this.handleIntChange = this.handleIntChange.bind(this);
    }


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
                                <OverlayTrigger placement="top" overlay={<Tooltip>seconds</Tooltip>}>
                                    <th>Duration</th>
                                </OverlayTrigger>
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
                                            {/*<td>*/}
                                            {/*    <input*/}
                                            {/*        id={'constant_rainfall'}*/}
                                            {/*        key={`constantRainfall-${scenario.id}`}*/}
                                            {/*        type={"number"}*/}
                                            {/*        className={'scenario-input'}*/}
                                            {/*        style={{'width': '50px'}}*/}
                                            {/*        value={scenario.constant_rainfall}*/}
                                            {/*        onChange={(e) => this.handleNumberChange(e, scenario)}*/}
                                            {/*    />*/}
                                            {/*</td>*/}
                                            <td>
                                                <input
                                                    id={'duration'}
                                                    key={`duration-${scenario.id}`}
                                                    type={"number"}
                                                    className={'scenario-input'}
                                                    style={{'width': '80px'}}
                                                    value={scenario.duration}
                                                    onChange={(e) => this.handleIntChange(e, scenario)}
                                                />
                                            </td>
                                            {/*<td>*/}
                                            {/*    <input*/}
                                            {/*        id={'maximum_triangle_area'}*/}
                                            {/*        key={`maximumTriangleArea-${scenario.id}`}*/}
                                            {/*        type={"number"}*/}
                                            {/*        className={'scenario-input'}*/}
                                            {/*        style={{'width': '50px'}}*/}
                                            {/*        value={scenario.maximum_triangle_area}*/}
                                            {/*        onChange={(e) => this.handleNumberChange(e, scenario)}*/}
                                            {/*    />*/}
                                            {/*</td>*/}
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
                                                    download
                                                    href={scenario?.latest_run?.s3_package_url}
                                                    bsStyle={'success'}
                                                    bsSize={'xsmall'}
                                                    style={{margin: "2px", borderRadius: "2px"}}
                                                    className={this.findScenarioStatus(scenario) !== 'built' ? 'disabled' : null }
                                                    onClick={() => console.log('downloading: ', scenario)}
                                                >
                                                    Download
                                                </Button>
                                            </td>
                                            <td>
                                                <Button
                                                    bsStyle={'success'}
                                                    bsSize={'xsmall'}
                                                    style={{margin: "2px", borderRadius: "2px"}}
                                                    className={this.findScenarioStatus(scenario) !== 'built' ? 'disabled' : null }
                                                    onClick={() => {
                                                        this.props.runAnugaScenario(scenario);
                                                    }}
                                                >
                                                    Run
                                                </Button>
                                            </td>
                                            {/*<td>*/}
                                            {/*    <Button*/}
                                            {/*        bsStyle={'info'}*/}
                                            {/*        bsSize={'xsmall'}*/}
                                            {/*        style={{margin: "2px", borderRadius: "2px"}}*/}
                                            {/*        onClick={() => {*/}
                                            {/*            this.props.showAnugaScenarioLog(scenario.id);*/}
                                            {/*        }}*/}
                                            {/*    >*/}
                                            {/*        Log*/}
                                            {/*    </Button>*/}
                                            {/*</td>*/}
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
        if (scenario?.latest_run_is_valid) {
            return scenario.latest_run.status;
        }
        return scenario.status;
    }

    handleTextChange = (e, scenario) => {
        console.log('handleTextChange', e, scenario);
        console.log('e.target', e.target);
        console.log('e.target.value', e.target.value);
        console.log('e.target.id', e.target.id);
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateAnugaScenario(scenario, kv);
    }

    handleIntChange = (e, scenario) => {
        console.log('handleIntChange', e, scenario);
        console.log('e.target', e.target);
        console.log('e.target.value', e.target.value);
        console.log('e.target.id', e.target.id);
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateAnugaScenario(scenario, kv);
    }

    handleNumberChange = (e, scenario) => {
        console.log('handleNumberChange', e, scenario);
        console.log('e.target', e.target);
        console.log('e.target.value', e.target.value);
        console.log('e.target.id', e.target.id);
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateAnugaScenario(scenario, kv);
    }
}

const mapStateToProps = (state) => {
    return {
        scenarios: state?.anuga?.scenarios,
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
        // buildAnugaScenario: (scenario) => dispatch(buildAnugaScenario(scenario)),
        updateAnugaScenario: (scenario, kv) => dispatch(updateAnugaScenario(scenario, kv)),
        selectAnugaScenario: (scenario) => dispatch(selectAnugaScenario(scenario)),
        showAnugaScenarioLog: (scenarioId) => dispatch(showAnugaScenarioLog(scenarioId)),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
        addAnugaScenario: () => dispatch(addAnugaScenario()),
        deleteAnugaScenario: (scenario) => dispatch(deleteAnugaScenario(scenario)),
        cancelAnugaRun: (scenario) => dispatch(cancelAnugaRun(scenario))
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);


export {
    AnugaScenarioMenu
};

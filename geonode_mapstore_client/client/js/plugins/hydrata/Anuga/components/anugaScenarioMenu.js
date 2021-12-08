import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    saveAnugaScenario,
    updateAnugaScenario,
    selectAnugaScenario,
    showAnugaScenarioLog,
    setAnugaScenarioMenu,
    stopAnugaScenarioPolling
} from "../actionsAnuga";

class AnugaScenarioMenuClass extends React.Component {
    static propTypes = {
        anugaGroupLength: PropTypes.number,
        scenarios: PropTypes.array,
        boundaries: PropTypes.array,
        setOpenMenuGroupId: PropTypes.func,
        saveAnugaScenario: PropTypes.func,
        runAnugaScenario: PropTypes.func,
        updateAnugaScenario: PropTypes.func,
        selectAnugaScenario: PropTypes.func,
        showAnugaScenarioLog: PropTypes.func,
        setAnugaScenarioMenu: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func
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
            <div id={'anuga-scenario-menu'} className={'simple-view-panel'} style={{top: "70px", width: "700px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{width: "678px", textAlign: "left"}}>
                        Scenarios
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
                                <th>Boundary</th>
                                <th>Status</th>
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
                                                    id={'boundary'}
                                                    key={`boundary-${scenario.id}`}
                                                    value={scenario?.boundary}
                                                    className={'scenario-select'}
                                                    onChange={(e) => this.handleIntChange(e, scenario)}
                                                >
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
                                                {scenario.status}
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
                                                    className={scenario.unsaved ? 'disabled' : null }
                                                    onClick={() => {
                                                        this.props.runAnugaScenario(scenario);
                                                        this.props.setOpenMenuGroupId(null);
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
                                                        this.props.showAnugaScenarioLog(scenario);
                                                        this.props.setOpenMenuGroupId(null);
                                                    }}
                                                >
                                                    Log
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
}

const mapStateToProps = (state) => {
    return {
        scenarios: state?.anuga?.scenarios,
        boundaries: state?.anuga?.boundaries
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
        showAnugaScenarioLog: (scenario) => dispatch(showAnugaScenarioLog(scenario)),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling())
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);


export {
    AnugaScenarioMenu
};

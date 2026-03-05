import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    runAnugaScenario,
    cancelAnugaRun,
    retryAnugaRun,
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
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import ScenarioTableRow from './ScenarioTableRow';
import {validateScenario} from './scenarioHelpers';

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
        retryAnugaRun: PropTypes.func,
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
    }

    toggleTab = (tabName) => {
        this.setState(prevState => ({
            scenarioTableTabs: prevState.scenarioTableTabs.includes(tabName)
                ? prevState.scenarioTableTabs.filter(t => t !== tabName)
                : [...prevState.scenarioTableTabs, tabName]
        }));
        trackEvent('button', 'click', `anuga-scenario-menu-${tabName}-tab-toggle`);
    }

    renderTabButton(tabName, msgId) {
        const isActive = this.state.scenarioTableTabs.includes(tabName);
        return (
            <Button
                bsSize={'medium'}
                style={{
                    margin: tabName === 'manage' ? "2px 0 -17px 20px" : "2px 0 -17px 8px",
                    borderRadius: "6px 6px 0 0",
                    color: isActive ? "#3363a0" : 'white',
                    backgroundColor: isActive ? "white" : '#6085b5'
                }}
                onClick={() => this.toggleTab(tabName)}
            >
                <Message msgId={msgId} />
            </Button>
        );
    }

    render() {
        return (
            <div id={'anuga-scenario-menu'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                        <Message msgId="hydrata.anuga.scenarios" />
                        <span id={"scenario-tab-button-group"}>
                            {this.renderTabButton('manage', 'hydrata.anuga.manage')}
                            {this.renderTabButton('advanced', 'hydrata.anuga.advanced')}
                            {this.renderTabButton('compare', 'hydrata.anuga.compare')}
                        </span>
                        <span id={"new-scenario-button"}>
                            <Button
                                bsStyle={'success'} bsSize={'xsmall'}
                                style={{margin: "2px", borderRadius: "2px"}}
                                onClick={() => {
                                    this.props.addAnugaScenario();
                                    trackEvent('button', 'click', 'anuga-scenario-menu-new-scenario');
                                }}
                            >
                                <Message msgId="hydrata.anuga.newScenario" />
                            </Button>
                        </span>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={() => {
                                this.props.setAnugaScenarioMenu(false);
                                this.props.stopAnugaScenarioPolling();
                                trackEvent('button', 'click', 'anuga-scenario-menu-close');
                            }}
                        />
                    </div>
                    <Table className={"scenario-table"}>
                        <thead>
                            <tr className={"scenario-table-header"}>
                                <th><Message msgId="hydrata.anuga.id" /></th>
                                <th><Message msgId="hydrata.anuga.name" /></th>
                                {this.state.scenarioTableTabs?.includes('manage') ?
                                    <React.Fragment>
                                        <th><Message msgId="hydrata.anuga.elevation" /></th>
                                        <th><Message msgId="hydrata.anuga.boundary" /></th>
                                        <th><Message msgId="hydrata.anuga.inflow" /></th>
                                    </React.Fragment> : null
                                }
                                {this.state.scenarioTableTabs?.includes('advanced') ?
                                    <React.Fragment>
                                        <th><Message msgId="hydrata.anuga.frictionMap" /></th>
                                        <th><Message msgId="hydrata.anuga.structures" /></th>
                                        <th><Message msgId="hydrata.anuga.meshRegions" /></th>
                                        <th><Message msgId="hydrata.anuga.network" /></th>
                                        {!this.state.scenarioTableTabs?.includes('manage') ? <th/> : null}
                                    </React.Fragment> : null
                                }
                                {this.state.scenarioTableTabs?.includes('manage') ?
                                    <React.Fragment>
                                        <th><Message msgId="hydrata.anuga.resolutionM2" /></th>
                                        <th><Message msgId="hydrata.anuga.duration" /></th>
                                        <th><Message msgId="hydrata.anuga.status" /></th>
                                        <th/><th/><th/><th/>
                                    </React.Fragment> : null
                                }
                                {this.state.scenarioTableTabs?.includes('compare') ?
                                    <React.Fragment>
                                        <th>
                                            <span id={"depth-difference-button"}>
                                                <Button
                                                    bsStyle={'success'} bsSize={'xsmall'}
                                                    className={this.props.readyToCompare ? '' : 'disabled'}
                                                    style={{margin: "2px", borderRadius: "2px"}}
                                                    onClick={() => {
                                                        this.props.compareScenarios(this.props.selectedScenarios);
                                                        trackEvent('button', 'click', 'anuga-scenario-menu-compare-execute');
                                                    }}
                                                >
                                                    <Message msgId="hydrata.anuga.compare" />
                                                </Button>
                                            </span>
                                        </th>
                                    </React.Fragment> : null
                                }
                            </tr>
                        </thead>
                        <tbody>
                            {this.props.scenarios?.map(scenario => (
                                <ScenarioTableRow
                                    key={scenario.id || 'new'}
                                    scenario={scenario}
                                    scenarioTableTabs={this.state.scenarioTableTabs}
                                    elevations={this.props.elevations}
                                    boundaries={this.props.boundaries}
                                    inflows={this.props.inflows}
                                    frictions={this.props.frictions}
                                    structures={this.props.structures}
                                    meshRegions={this.props.meshRegions}
                                    networks={this.props.networks}
                                    updateAnugaScenario={this.props.updateAnugaScenario}
                                    saveAnugaScenario={this.props.saveAnugaScenario}
                                    setOpenMenuGroupId={this.props.setOpenMenuGroupId}
                                    selectAnugaScenario={this.props.selectAnugaScenario}
                                    showAnugaScenarioLog={this.props.showAnugaScenarioLog}
                                    showAnugaRunMenu={this.props.showAnugaRunMenu}
                                    setAnugaScenarioMenu={this.props.setAnugaScenarioMenu}
                                    deleteAnugaScenario={this.props.deleteAnugaScenario}
                                    cancelAnugaRun={this.props.cancelAnugaRun}
                                    retryAnugaRun={this.props.retryAnugaRun}
                                    toggleScenarioSelected={this.props.toggleScenarioSelected}
                                    validateScenario={validateScenario}
                                />
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const byId = state?.anuga?.scenarios?.byId || {};
    const allIds = state?.anuga?.scenarios?.allIds || [];
    const scenarios = allIds.map(id => byId[id]).filter(Boolean).sort((a, b) => {
        const aId = a.id || 0;
        const bId = b.id || 0;
        return aId - bId;
    });
    return {
        scenarios: scenarios,
        selectedScenarios: selectedScenarios(state),
        readyToCompare: selectedScenarios(state).length === 2,
        boundaries: state?.anuga?.resources?.boundaries,
        elevations: state?.anuga?.resources?.elevations,
        frictions: state?.anuga?.resources?.frictions,
        inflows: state?.anuga?.resources?.inflows,
        structures: state?.anuga?.resources?.structures,
        meshRegions: state?.anuga?.resources?.meshRegions,
        networks: state?.anuga?.resources?.networks
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
        cancelAnugaRun: (runId) => dispatch(cancelAnugaRun(runId)),
        retryAnugaRun: (runId) => dispatch(retryAnugaRun(runId)),
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
        toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario)),
        compareScenarios: (scenarios) => dispatch(compareScenarios(scenarios))
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);

export {
    AnugaScenarioMenu
};

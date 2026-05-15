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
    buildScenarioExplicit,
    updateAnugaScenario,
    selectAnugaScenario,
    setAnugaScenarioMenu,
    addAnugaScenario,
    stopAnugaScenarioPolling,
    deleteAnugaScenario,
    duplicateAnugaScenario,
    archiveAnugaScenario,
    unarchiveAnugaScenario,
    setAnugaScenarioArchiveFilter,
    showAnugaRunMenu,
    toggleScenarioSelected,
    compareScenarios
} from "../actionsAnuga";

import {selectedScenarios, canCreateScenario, canRunScenario, getProjectMyRole} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import ScenarioTableRow from './ScenarioTableRow';
import {validateScenario} from './scenarioHelpers';
import {toggleTaskMonitorPanel} from '../../TaskMonitor/actionsTaskMonitor';

class AnugaScenarioMenuClass extends React.Component {
    static propTypes = {
        anugaGroupLength: PropTypes.number,
        scenarios: PropTypes.array,
        boundaries: PropTypes.array,
        terrain: PropTypes.array,
        frictions: PropTypes.array,
        inflows: PropTypes.array,
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow), passed
        // straight through to ScenarioTableRow's renderSelectCell('rainfall', ...).
        rainfalls: PropTypes.array,
        structures: PropTypes.array,
        meshRegions: PropTypes.array,
        networks: PropTypes.array,
        setOpenMenuGroupId: PropTypes.func,
        saveAnugaScenario: PropTypes.func,
        buildScenarioExplicit: PropTypes.func,
        runAnugaScenario: PropTypes.func,
        updateAnugaScenario: PropTypes.func,
        selectAnugaScenario: PropTypes.func,
        setAnugaScenarioMenu: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        addAnugaScenario: PropTypes.func,
        deleteAnugaScenario: PropTypes.func,
        duplicateAnugaScenario: PropTypes.func,
        archiveAnugaScenario: PropTypes.func,
        unarchiveAnugaScenario: PropTypes.func,
        archiveFilter: PropTypes.oneOf(['none', 'only', 'all']),
        setAnugaScenarioArchiveFilter: PropTypes.func,
        cancelAnugaRun: PropTypes.func,
        retryAnugaRun: PropTypes.func,
        showAnugaRunMenu: PropTypes.func,
        toggleScenarioSelected: PropTypes.func,
        selectedScenarios: PropTypes.array,
        compareScenarios: PropTypes.func,
        readyToCompare: PropTypes.number,
        canCreateScenario: PropTypes.bool,
        canRunScenario: PropTypes.bool,
        myRole: PropTypes.string,
        currentUserId: PropTypes.number
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
                className={"scenario-tab" + (isActive ? " active" : "")}
                onClick={() => this.toggleTab(tabName)}
            >
                <Message msgId={msgId} />
            </Button>
        );
    }

    // Active/Archived chip. Clicking toggles between 'none' (default,
    // active only) and 'only' (archived only). Polling picks up the new
    // archiveFilter on its next tick.
    renderArchiveFilterChip() {
        const archived = this.props.archiveFilter === 'only';
        return (
            <Button
                bsSize={'medium'}
                className={"scenario-tab" + (archived ? " active" : "")}
                onClick={() => {
                    const nextMode = archived ? 'none' : 'only';
                    this.props.setAnugaScenarioArchiveFilter(nextMode);
                    trackEvent('button', 'click', `anuga-scenario-menu-archive-filter-${nextMode}`);
                }}
            >
                <Message msgId={archived ? "hydrata.anuga.archived" : "hydrata.anuga.active"} />
            </Button>
        );
    }

    render() {
        return (
            <div id={'anuga-scenario-menu'} className={'simple-view-panel anuga-panel'}>
                <div className={'menu-rows-container'}>
                    <div className={"row menu-row-header scenario-menu-header"}>
                        <Message msgId="hydrata.anuga.scenarios" />
                        <span id={"scenario-tab-button-group"}>
                            {this.renderTabButton('manage', 'hydrata.anuga.manage')}
                            {this.renderTabButton('advanced', 'hydrata.anuga.advanced')}
                            {this.renderTabButton('compare', 'hydrata.anuga.compare')}
                            {this.renderArchiveFilterChip()}
                        </span>
                        {this.props.canCreateScenario ?
                            <span id={"new-scenario-button"}>
                                <Button
                                    bsStyle={'success'} bsSize={'xsmall'}
                                    className="anuga-btn"
                                    onClick={() => {
                                        this.props.addAnugaScenario();
                                        trackEvent('button', 'click', 'anuga-scenario-menu-new-scenario');
                                    }}
                                >
                                    <Message msgId="hydrata.anuga.newScenario" />
                                </Button>
                            </span> : null
                        }
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
                                        <th><Message msgId="hydrata.anuga.terrain" /></th>
                                        <th><Message msgId="hydrata.anuga.boundary" /></th>
                                        <th><Message msgId="hydrata.anuga.inflow" /></th>
                                    </React.Fragment> : null
                                }
                                {this.state.scenarioTableTabs?.includes('advanced') ?
                                    <React.Fragment>
                                        <th><Message msgId="hydrata.anuga.friction" /></th>
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
                                        {/* Build | Run | Log | Duplicate | Archive | Delete */}
                                        <th/><th/><th/><th/><th/><th/>
                                    </React.Fragment> : null
                                }
                                {this.state.scenarioTableTabs?.includes('compare') ?
                                    <React.Fragment>
                                        <th>
                                            <span id={"depth-difference-button"}>
                                                <Button
                                                    bsStyle={'success'} bsSize={'xsmall'}
                                                    className={"anuga-btn" + (this.props.readyToCompare ? '' : ' disabled')}
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
                                    terrain={this.props.terrain}
                                    boundaries={this.props.boundaries}
                                    inflows={this.props.inflows}
                                    rainfalls={this.props.rainfalls}
                                    frictions={this.props.frictions}
                                    structures={this.props.structures}
                                    meshRegions={this.props.meshRegions}
                                    networks={this.props.networks}
                                    updateAnugaScenario={this.props.updateAnugaScenario}
                                    saveAnugaScenario={this.props.saveAnugaScenario}
                                    buildScenarioExplicit={this.props.buildScenarioExplicit}
                                    setOpenMenuGroupId={this.props.setOpenMenuGroupId}
                                    selectAnugaScenario={this.props.selectAnugaScenario}
                                    showAnugaRunMenu={this.props.showAnugaRunMenu}
                                    setAnugaScenarioMenu={this.props.setAnugaScenarioMenu}
                                    deleteAnugaScenario={this.props.deleteAnugaScenario}
                                    duplicateAnugaScenario={this.props.duplicateAnugaScenario}
                                    canDuplicateScenario={this.props.canCreateScenario}
                                    archiveAnugaScenario={this.props.archiveAnugaScenario}
                                    unarchiveAnugaScenario={this.props.unarchiveAnugaScenario}
                                    cancelAnugaRun={this.props.cancelAnugaRun}
                                    retryAnugaRun={this.props.retryAnugaRun}
                                    toggleScenarioSelected={this.props.toggleScenarioSelected}
                                    validateScenario={validateScenario}
                                    openTaskMonitorForRun={this.props.openTaskMonitorForRun}
                                    canRunScenario={this.props.canRunScenario}
                                    myRole={this.props.myRole}
                                    currentUserId={this.props.currentUserId}
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
        terrain: state?.anuga?.resources?.terrain,
        frictions: state?.anuga?.resources?.frictions,
        inflows: state?.anuga?.resources?.inflows,
        // TASK-955 (W2.2 FE) — Rainfall slice.
        rainfalls: state?.anuga?.resources?.rainfalls,
        structures: state?.anuga?.resources?.structures,
        meshRegions: state?.anuga?.resources?.meshRegions,
        networks: state?.anuga?.resources?.networks,
        canCreateScenario: canCreateScenario(state),
        canRunScenario: canRunScenario(state),
        myRole: getProjectMyRole(state),
        currentUserId: state?.security?.user?.pk,
        archiveFilter: state?.anuga?.scenarios?.archiveFilter || 'none'
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        runAnugaScenario: (scenario) => dispatch(runAnugaScenario(scenario)),
        saveAnugaScenario: (scenario) => dispatch(saveAnugaScenario(scenario)),
        buildScenarioExplicit: (scenarioId) => dispatch(buildScenarioExplicit(scenarioId)),
        updateAnugaScenario: (scenario, kv) => dispatch(updateAnugaScenario(scenario, kv)),
        selectAnugaScenario: (scenario) => dispatch(selectAnugaScenario(scenario)),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
        addAnugaScenario: () => dispatch(addAnugaScenario()),
        deleteAnugaScenario: (scenario) => dispatch(deleteAnugaScenario(scenario)),
        duplicateAnugaScenario: (scenario) => dispatch(duplicateAnugaScenario(scenario)),
        archiveAnugaScenario: (scenario) => dispatch(archiveAnugaScenario(scenario)),
        unarchiveAnugaScenario: (scenario) => dispatch(unarchiveAnugaScenario(scenario)),
        setAnugaScenarioArchiveFilter: (mode) => dispatch(setAnugaScenarioArchiveFilter(mode)),
        cancelAnugaRun: (runId) => dispatch(cancelAnugaRun(runId)),
        retryAnugaRun: (runId) => dispatch(retryAnugaRun(runId)),
        showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
        toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario)),
        compareScenarios: (scenarios) => dispatch(compareScenarios(scenarios)),
        openTaskMonitorForRun: () => {
            dispatch(toggleTaskMonitorPanel(true));
        }
    };
};

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);

export {
    AnugaScenarioMenu
};

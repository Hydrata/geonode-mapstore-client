import React from "react";
import {connect} from "react-redux";
import {Button} from "react-bootstrap";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';

import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {
  selectAnugaScenario,
  toggleScenarioSelected,
  updateAnugaScenario,
  saveAnugaScenario,
  buildScenarioExplicit,
  runAnugaScenario, // eslint-disable-line no-unused-vars -- W3 wires Run pipeline directly; today the Run button uses showAnugaRunMenu instead
  cancelAnugaRun,
  retryAnugaRun,
  deleteAnugaScenario,
  duplicateAnugaScenario,
  archiveAnugaScenario,
  unarchiveAnugaScenario,
  setAnugaScenarioMenu,
  showAnugaRunMenu,
  addAnugaScenario,
  stopAnugaScenarioPolling,
  setAnugaScenarioArchiveFilter,
  compareScenarios
} from "../actionsAnuga";
import {
  canCreateScenario,
  canRunScenario,
  getProjectMyRole,
  getSelectedScenario,
  canEditScenarioByRole,
  selectedScenarios as selectedScenariosSelector
} from "../selectorsAnuga";
import {toggleTaskMonitorPanel} from '../../TaskMonitor/actionsTaskMonitor';
import {validateScenario} from './scenarioHelpers';
import {ScenarioRail} from './scenarioRail';
import {ScenarioPane} from './scenarioPane';

/**
 * TASK-C-scenarios-miller — Miller-columns container for the ANUGA scenarios
 * panel. Replaces the legacy table-driven anugaScenarioMenu.js (W3 cutover).
 *
 * Local component state:
 *   - selectedCategoryId — Inputs / Advanced / Run / Actions subtab.
 *   - compareMode — header chip toggle; rail items expose compare checkboxes.
 *   - confirmingAction — single 'duplicate' | 'archive' | 'unarchive' |
 *     'delete' | 'cancel-run' string gating the container-level inline
 *     confirm dialog (always rendered, `.is-open` toggled via CSS so Karma
 *     stays deterministic per memory pin feedback-mapstore-react-version-mismatch).
 *   - confirmingScenario — captured at the same moment as confirmingAction.
 *   - buildValidationError — field-name returned by validateScenario, or null.
 *
 * Redux state read: scenarios, archiveFilter, resources (8 dropdown arrays),
 * canCreateScenario, canRunScenario, myRole, currentUserId, selectedScenario.
 *
 * Container delegates all heavy field renders to ScenarioPane, all
 * status/action-button renders to ScenarioActionToolbar (via ScenarioPane),
 * all rail item renders to ScenarioRailItem.
 */
class AnugaScenarioMenuClass extends React.Component {
  static propTypes = {
    // Redux state
    scenarios: PropTypes.array,
    selectedScenario: PropTypes.object,
    archiveFilter: PropTypes.string,
    terrain: PropTypes.array,
    boundaries: PropTypes.array,
    inflows: PropTypes.array,
    rainfalls: PropTypes.array,
    frictions: PropTypes.array,
    structures: PropTypes.array,
    meshRegions: PropTypes.array,
    networks: PropTypes.array,
    computeInstances: PropTypes.array,
    canCreateScenario: PropTypes.bool,
    canRunScenario: PropTypes.bool,
    myRole: PropTypes.string,
    currentUserId: PropTypes.number,
    selectedScenarios: PropTypes.array,
    readyToCompare: PropTypes.bool,
    // Redux dispatch
    selectAnugaScenario: PropTypes.func,
    toggleScenarioSelected: PropTypes.func,
    updateAnugaScenario: PropTypes.func,
    saveAnugaScenario: PropTypes.func,
    buildScenarioExplicit: PropTypes.func,
    cancelAnugaRun: PropTypes.func,
    retryAnugaRun: PropTypes.func,
    deleteAnugaScenario: PropTypes.func,
    duplicateAnugaScenario: PropTypes.func,
    archiveAnugaScenario: PropTypes.func,
    unarchiveAnugaScenario: PropTypes.func,
    setOpenMenuGroupId: PropTypes.func,
    setAnugaScenarioMenu: PropTypes.func,
    stopAnugaScenarioPolling: PropTypes.func,
    addAnugaScenario: PropTypes.func,
    setAnugaScenarioArchiveFilter: PropTypes.func,
    compareScenarios: PropTypes.func,
    showAnugaRunMenu: PropTypes.func,
    openTaskMonitorForRun: PropTypes.func
  };

  static defaultProps = {
    scenarios: []
  };

  constructor(props) {
    super(props);
    this.state = {
      // Wave 3A renamed: 'inputs' / 'advanced' / 'runConfig' / 'statusActions' / 'runLog'.
      // Default starts on 'inputs' to match the operator-approved Option A.
      selectedCategoryId: 'inputs',
      compareMode: false,
      confirmingAction: null,
      confirmingScenario: null,
      buildValidationError: null
    };
  }

  componentDidMount() {
    const {scenarios, selectedScenario} = this.props;
    if (!selectedScenario && scenarios && scenarios.length > 0) {
      if (this.props.selectAnugaScenario) {
        this.props.selectAnugaScenario(scenarios[0]);
      }
    }
  }

  componentDidUpdate(prevProps) {
    const {scenarios, selectedScenario} = this.props;
    if (!selectedScenario && scenarios && scenarios.length > 0) {
      const hadNoScenarios = !prevProps.scenarios || prevProps.scenarios.length === 0;
      const hadDifferentSelected = prevProps.selectedScenario && !selectedScenario;
      if (hadNoScenarios || hadDifferentSelected) {
        if (this.props.selectAnugaScenario) {
          this.props.selectAnugaScenario(scenarios[0]);
        }
      }
    }
  }

  handleSelect = (scenario) => {
    if (this.props.selectAnugaScenario) {
      this.props.selectAnugaScenario(scenario);
    }
  };

  handleToggleSelected = (scenario) => {
    if (this.props.toggleScenarioSelected) {
      this.props.toggleScenarioSelected(scenario);
    }
  };

  handleSelectCategory = (categoryId) => {
    this.setState({selectedCategoryId: categoryId});
  };

  handleNewScenario = () => {
    if (this.props.addAnugaScenario) {
      this.props.addAnugaScenario();
    }
    trackEvent('button', 'click', 'anuga-scenario-menu-new-scenario');
  };

  // Wave 3C C3: Close X removed per operator decision D3 — Option A exits via
  // the top-tab switch instead. The container button on anugaContainer.js
  // (lines 138-148) already toggles setAnugaScenarioMenu + start/stopAnugaScenarioPolling
  // when the user clicks the same tab again or switches to another top-tab,
  // so panel-level close is redundant. stopAnugaScenarioPolling + handleClose
  // are dropped here; the legend-close <span> in renderHeader is dropped too.
  // setAnugaScenarioMenu + stopAnugaScenarioPolling props are preserved in
  // propTypes/mapDispatchToProps because they are still needed by the run-now
  // chain (handleRunClick → setAnugaScenarioMenu(false)).

  handleToggleCompareMode = () => {
    const nextCompareMode = !this.state.compareMode;
    this.setState({compareMode: nextCompareMode});
    // When leaving compare mode, clear any lingering `selected` flags so
    // the next compare session starts fresh (memory pin §5.7).
    if (!nextCompareMode && Array.isArray(this.props.selectedScenarios)) {
      this.props.selectedScenarios.forEach((s) => {
        if (this.props.toggleScenarioSelected) {
          this.props.toggleScenarioSelected(s);
        }
      });
    }
    trackEvent('button', 'click', 'anuga-scenario-menu-compare-tab-toggle');
  };

  handleArchiveFilterToggle = () => {
    const archived = this.props.archiveFilter === 'only';
    const nextMode = archived ? 'none' : 'only';
    if (this.props.setAnugaScenarioArchiveFilter) {
      this.props.setAnugaScenarioArchiveFilter(nextMode);
    }
    trackEvent('button', 'click', `anuga-scenario-menu-archive-filter-${nextMode}`);
  };

  handleExecuteCompare = () => {
    if (this.props.readyToCompare && this.props.compareScenarios) {
      this.props.compareScenarios(this.props.selectedScenarios);
    }
    trackEvent('button', 'click', 'anuga-scenario-menu-compare-execute');
  };

  handleUpdateScenario = (scenario, kv) => {
    if (this.props.updateAnugaScenario) {
      this.props.updateAnugaScenario(scenario, kv);
    }
  };

  handleBuildClick = (scenario) => {
    const missingField = validateScenario(scenario);
    if (missingField) {
      this.setState({buildValidationError: missingField});
      trackEvent('button', 'click', `anuga-scenario-menu-build-validate-missing-${missingField}`);
      return;
    }
    this.setState({buildValidationError: null});
    if (scenario.unsaved || !this.props.buildScenarioExplicit) {
      if (this.props.saveAnugaScenario) {
        this.props.saveAnugaScenario(scenario);
      }
    } else if (this.props.buildScenarioExplicit) {
      this.props.buildScenarioExplicit(scenario.id);
    }
    if (this.props.setOpenMenuGroupId) {
      this.props.setOpenMenuGroupId(null);
    }
  };

  handleRunClick = (scenario) => {
    // Run still routes through AnugaRunMenu (compute-backend chooser). The
    // legacy 3-dispatch flow is preserved exactly.
    if (this.props.setAnugaScenarioMenu) this.props.setAnugaScenarioMenu(false);
    if (this.props.selectAnugaScenario) this.props.selectAnugaScenario(scenario);
    if (this.props.showAnugaRunMenu) this.props.showAnugaRunMenu(true);
  };

  handleRetryClick = (scenario) => {
    if (scenario?.latest_run?.id && this.props.retryAnugaRun) {
      this.props.retryAnugaRun(scenario.latest_run.id);
    }
  };

  handleLogClick = (scenario) => {
    if (this.props.selectAnugaScenario) this.props.selectAnugaScenario(scenario);
    if (this.props.openTaskMonitorForRun) this.props.openTaskMonitorForRun();
  };

  openConfirm = (action, scenario) => {
    this.setState({confirmingAction: action, confirmingScenario: scenario});
  };

  cancelConfirm = () => {
    const {confirmingAction} = this.state;
    trackEvent('button', 'click', `anuga-scenario-menu-${confirmingAction || 'confirm'}-cancel`);
    this.setState({confirmingAction: null, confirmingScenario: null});
  };

  performConfirm = () => {
    const {confirmingAction, confirmingScenario} = this.state;
    this.setState({confirmingAction: null, confirmingScenario: null});
    if (!confirmingScenario) return;
    if (confirmingAction === 'duplicate' && this.props.duplicateAnugaScenario) {
      this.props.duplicateAnugaScenario(confirmingScenario);
      trackEvent('button', 'click', 'anuga-scenario-menu-duplicate-scenario-confirm');
    } else if (confirmingAction === 'archive' && this.props.archiveAnugaScenario) {
      this.props.archiveAnugaScenario(confirmingScenario);
      trackEvent('button', 'click', 'anuga-scenario-menu-archive-scenario-confirm');
    } else if (confirmingAction === 'unarchive' && this.props.unarchiveAnugaScenario) {
      this.props.unarchiveAnugaScenario(confirmingScenario);
      trackEvent('button', 'click', 'anuga-scenario-menu-unarchive-scenario-confirm');
    } else if (confirmingAction === 'delete' && this.props.deleteAnugaScenario) {
      this.props.deleteAnugaScenario(confirmingScenario);
      trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario-confirm');
    } else if (confirmingAction === 'cancel-run' && this.props.cancelAnugaRun) {
      this.props.cancelAnugaRun(confirmingScenario?.latest_run?.id);
      trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run-confirm');
    }
  };

  dismissBuildValidation = () => {
    this.setState({buildValidationError: null});
  };

  renderRail() {
    const {scenarios, selectedScenario, currentUserId} = this.props;
    const selectedId = selectedScenario ? (selectedScenario.id || selectedScenario._tempId) : null;
    return (
      <ScenarioRail
        scenarios={scenarios}
        selectedId={selectedId}
        compareMode={this.state.compareMode}
        currentUserId={currentUserId}
        onSelect={this.handleSelect}
        onToggleSelected={this.handleToggleSelected}
      />
    );
  }

  renderPane() {
    const {
      selectedScenario,
      myRole,
      currentUserId,
      terrain,
      boundaries,
      inflows,
      rainfalls,
      frictions,
      structures,
      meshRegions,
      networks,
      computeInstances
    } = this.props;
    const canEdit = canEditScenarioByRole(myRole, currentUserId, selectedScenario?.created_by);
    return (
      <ScenarioPane
        scenario={selectedScenario}
        selectedCategoryId={this.state.selectedCategoryId}
        onSelectCategory={this.handleSelectCategory}
        canEdit={canEdit}
        canRunScenario={this.props.canRunScenario}
        canDuplicateScenario={this.props.canCreateScenario}
        currentUserId={currentUserId}
        terrain={terrain}
        boundaries={boundaries}
        inflows={inflows}
        rainfalls={rainfalls}
        frictions={frictions}
        structures={structures}
        meshRegions={meshRegions}
        networks={networks}
        computeInstances={computeInstances}
        onUpdateScenario={this.handleUpdateScenario}
        onBuildClick={this.handleBuildClick}
        onRunClick={this.handleRunClick}
        onRetryClick={this.handleRetryClick}
        onLogClick={this.handleLogClick}
        onDuplicateClick={(s) => this.openConfirm('duplicate', s)}
        onArchiveClick={(s) => this.openConfirm('archive', s)}
        onUnarchiveClick={(s) => this.openConfirm('unarchive', s)}
        onConfirmDelete={(s) => this.openConfirm('delete', s)}
        onConfirmCancelRun={(s) => this.openConfirm('cancel-run', s)}
      />
    );
  }

  renderHeader() {
    const {canCreateScenario: canCreate, archiveFilter, readyToCompare, scenarios} = this.props;
    const {compareMode} = this.state;
    const archivedActive = archiveFilter === 'only';
    // Wave 3A — surface counts on the filter chips so users see at a glance
    // how many scenarios live in each bucket. Counts derive directly from
    // the unfiltered scenarios array on the store (the archive filter
    // reducer also returns the unfiltered list under this same prop, so
    // we have full visibility regardless of the active chip).
    const scenariosList = Array.isArray(scenarios) ? scenarios : [];
    const activeCount = scenariosList.filter(s => s && !s.archived_at).length;
    const archivedCount = scenariosList.filter(s => s && !!s.archived_at).length;
    return (
      <div className={"row menu-row menu-row-header anuga-section-header scenario-menu-header"}>
        <Message msgId="hydrata.anuga.scenarios" />
        <span id={"scenario-tab-button-group"}>
          <Button
            className={"scenario-tab" + (archivedActive ? " active" : "")}
            onClick={this.handleArchiveFilterToggle}
          >
            <Message msgId={archivedActive ? "hydrata.anuga.archived" : "hydrata.anuga.active"} />
            <span className="scenario-tab-count">
              {' '}({archivedActive ? archivedCount : activeCount})
            </span>
          </Button>
          <Button
            className={"scenario-tab" + (compareMode ? " active" : "")}
            onClick={this.handleToggleCompareMode}
          >
            <Message msgId="hydrata.anuga.compare" />
          </Button>
        </span>
        {compareMode ?
          <span id={"depth-difference-button"}>
            <Button
              bsStyle={'success'}
              bsSize={'xsmall'}
              className={"anuga-btn" + (readyToCompare ? '' : ' disabled')}
              disabled={!readyToCompare}
              onClick={this.handleExecuteCompare}
            >
              <Message msgId="hydrata.anuga.compare" />
            </Button>
          </span>
          : (canCreate ?
            <span id={"new-scenario-button"}>
              <Button
                bsStyle={'success'}
                bsSize={'xsmall'}
                className="anuga-btn"
                onClick={this.handleNewScenario}
              >
                <Message msgId="hydrata.anuga.newScenario" />
              </Button>
            </span>
            : null)
        }
        {/* Wave 3C C3: Close X removed per operator decision D3. Top-tab
            switch on anugaContainer.js already toggles polling + visibility. */}
      </div>
    );
  }

  renderConfirmDialog() {
    const {confirmingAction, confirmingScenario} = this.state;
    const isOpen = !!confirmingAction;
    // Body + confirm-button msgId pair, keyed off confirmingAction. msgParams
    // carries the scenario name through to {name} placeholder in each body
    // string. ICU MessageFormat (used by react-intl) tolerates an unused
    // msgParams entry, so we can pass it unconditionally.
    let bodyMsgId = null;
    let confirmLabelMsgId = null;
    if (confirmingAction === 'duplicate') {
      bodyMsgId = 'hydrata.anuga.confirmDuplicateScenario';
      confirmLabelMsgId = 'hydrata.anuga.btnDuplicate';
    } else if (confirmingAction === 'archive') {
      bodyMsgId = 'hydrata.anuga.confirmArchiveScenario';
      confirmLabelMsgId = 'hydrata.anuga.btnArchive';
    } else if (confirmingAction === 'unarchive') {
      bodyMsgId = 'hydrata.anuga.confirmUnarchiveScenario';
      confirmLabelMsgId = 'hydrata.anuga.btnRestore';
    } else if (confirmingAction === 'delete') {
      bodyMsgId = 'hydrata.anuga.confirmDeleteScenario';
      confirmLabelMsgId = 'hydrata.anuga.btnDelete';
    } else if (confirmingAction === 'cancel-run') {
      bodyMsgId = 'hydrata.anuga.confirmCancelRunScenario';
      confirmLabelMsgId = 'hydrata.anuga.btnCancelRun';
    }
    const name = confirmingScenario?.name || 'this scenario';
    return (
      <span
        className={"anuga-scenario-confirm-dialog" + (isOpen ? " is-open" : "")}
        role="alertdialog"
        // TODO i18n: aria-label needs a plain string, not JSX. Matches the
        // pattern used by the sibling anuga-build-validation-dialog below
        // and other Anuga dialogs in this directory. Wire to getMessageById
        // once a static contextTypes.messages plumbing pass is done across
        // the surface.
        aria-label="Confirm scenario action"
        aria-hidden={isOpen ? undefined : true}
      >
        <span className="anuga-scenario-confirm-text">
          {bodyMsgId ? <Message msgId={bodyMsgId} msgParams={{name}} /> : null}
        </span>
        <button
          type="button"
          className="save-confirm-btn confirm"
          onClick={this.performConfirm}
        >
          {confirmLabelMsgId
            ? <Message msgId={confirmLabelMsgId} />
            : <Message msgId="hydrata.anuga.ok" />}
        </button>
        <button
          type="button"
          className="save-confirm-btn cancel"
          onClick={this.cancelConfirm}
        >
          <Message msgId="hydrata.anuga.cancel" />
        </button>
      </span>
    );
  }

  renderBuildValidationDialog() {
    const {buildValidationError} = this.state;
    return (
      <span
        className={
          "menu-row-delete-confirm anuga-build-validation-dialog"
          + (buildValidationError ? " is-open" : "")
        }
        role="alertdialog"
        aria-label="Build validation error"
        aria-hidden={buildValidationError ? undefined : true}
      >
        <span className="menu-row-delete-confirm-text">
          {buildValidationError ?
            <Message msgId={`hydrata.anuga.validateMissingField.${buildValidationError}`} />
            : null
          }
        </span>
        <button
          type="button"
          className="save-confirm-btn confirm"
          onClick={this.dismissBuildValidation}
        >
          <Message msgId="hydrata.anuga.ok" />
        </button>
      </span>
    );
  }

  render() {
    return (
      <div
        id={'anuga-scenario-menu'}
        className={'simple-view-panel anuga-panel simple-view-panel--miller anuga-scenario-miller'}
      >
        <div className={'menu-rows-container'}>
          {this.renderHeader()}
          <div className={'sv-rail-pane-shell'}>
            {this.renderRail()}
            {this.renderPane()}
          </div>
          {this.renderConfirmDialog()}
          {this.renderBuildValidationDialog()}
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
    scenarios,
    selectedScenario: getSelectedScenario(state),
    archiveFilter: state?.anuga?.scenarios?.archiveFilter || 'none',
    terrain: state?.anuga?.resources?.terrain,
    boundaries: state?.anuga?.resources?.boundaries,
    inflows: state?.anuga?.resources?.inflows,
    rainfalls: state?.anuga?.resources?.rainfalls,
    frictions: state?.anuga?.resources?.frictions,
    structures: state?.anuga?.resources?.structures,
    meshRegions: state?.anuga?.resources?.meshRegions,
    networks: state?.anuga?.resources?.networks,
    computeInstances: state?.anuga?.resources?.computeInstances,
    canCreateScenario: canCreateScenario(state),
    canRunScenario: canRunScenario(state),
    myRole: getProjectMyRole(state),
    currentUserId: state?.security?.user?.pk,
    selectedScenarios: selectedScenariosSelector(state),
    readyToCompare: selectedScenariosSelector(state).length === 2
  };
};

const mapDispatchToProps = (dispatch) => ({
  setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
  selectAnugaScenario: (scenario) => dispatch(selectAnugaScenario(scenario)),
  toggleScenarioSelected: (scenario) => dispatch(toggleScenarioSelected(scenario)),
  updateAnugaScenario: (scenario, kv) => dispatch(updateAnugaScenario(scenario, kv)),
  saveAnugaScenario: (scenario) => dispatch(saveAnugaScenario(scenario)),
  buildScenarioExplicit: (scenarioId) => dispatch(buildScenarioExplicit(scenarioId)),
  cancelAnugaRun: (runId) => dispatch(cancelAnugaRun(runId)),
  retryAnugaRun: (runId) => dispatch(retryAnugaRun(runId)),
  deleteAnugaScenario: (scenario) => dispatch(deleteAnugaScenario(scenario)),
  duplicateAnugaScenario: (scenario) => dispatch(duplicateAnugaScenario(scenario)),
  archiveAnugaScenario: (scenario) => dispatch(archiveAnugaScenario(scenario)),
  unarchiveAnugaScenario: (scenario) => dispatch(unarchiveAnugaScenario(scenario)),
  setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
  stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
  addAnugaScenario: () => dispatch(addAnugaScenario()),
  setAnugaScenarioArchiveFilter: (mode) => dispatch(setAnugaScenarioArchiveFilter(mode)),
  compareScenarios: (scenarios) => dispatch(compareScenarios(scenarios)),
  showAnugaRunMenu: (visible) => dispatch(showAnugaRunMenu(visible)),
  openTaskMonitorForRun: () => dispatch(toggleTaskMonitorPanel(true))
});

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);

export {
  AnugaScenarioMenu,
  AnugaScenarioMenuClass
};

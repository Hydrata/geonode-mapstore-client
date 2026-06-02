import React from "react";
import {connect} from "react-redux";
import {Button} from "react-bootstrap";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';

import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {
    selectAnugaScenario,
    toggleScenarioSelected,
    updateAnugaScenario,
    saveAnugaScenario,
    buildScenarioExplicit,
    cancelAnugaRun,
    retryAnugaRun,
    deleteAnugaScenario,
    duplicateAnugaScenario,
    archiveAnugaScenario,
    unarchiveAnugaScenario,
    setAnugaScenarioMenu,
    runAnugaScenario,
    addAnugaScenario,
    stopAnugaScenarioPolling,
    setAnugaScenarioArchiveFilter,
    compareScenarios
} from "../actionsAnuga";
import {
    canCreateScenario,
    canRunScenario,
    getProjectMyRole,
    getScenariosArray,
    getSelectedScenario,
    canEditScenarioByRole,
    selectedScenarios as selectedScenariosSelector
} from "../selectorsAnuga";
import {toggleTaskMonitorPanel} from '../../TaskMonitor/actionsTaskMonitor';
import {changeLayerProperties} from '../../../../../MapStore2/web/client/actions/layers';
import {validateScenario} from './scenarioHelpers';
import {ScenarioRail} from './scenarioRail';
import {ScenarioPane} from './scenarioPane';
import {SectionHeader} from "../../SimpleView/components/primitives";

/**
 * Miller-columns container for the ANUGA scenarios panel.
 *
 * Local component state:
 *   - selectedCategoryId — 'inputs' / 'advanced' / 'runConfig' / 'statusActions'.
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
// Unified registry for the 5 inline-confirm dialog actions. One entry per
// confirmingAction state; both renderConfirmDialog (body + confirm msgIds)
// and performConfirm (dispatchProp + analyticsEvent + argSelector) consult
// the same record so a new action lands in one place.
//
// ICU MessageFormat (used by react-intl) tolerates an unused {name}
// placeholder, so each entry can interpolate the scenario name via
// msgParams uniformly.
//
// `argSelector` returns the value passed into the dispatch function. Most
// entries pass the scenario through, but cancel-run breaks symmetry by
// dispatching on the nested latest_run.id integer.
const CONFIRM_DIALOG_REGISTRY = {
    duplicate: {
        body: 'hydrata.anuga.confirmDuplicateScenario',
        confirm: 'hydrata.anuga.btnDuplicate',
        dispatchProp: 'duplicateAnugaScenario',
        analyticsEvent: 'anuga-scenario-menu-duplicate-scenario-confirm',
        argSelector: (scenario) => scenario
    },
    archive: {
        body: 'hydrata.anuga.confirmArchiveScenario',
        confirm: 'hydrata.anuga.btnArchive',
        dispatchProp: 'archiveAnugaScenario',
        analyticsEvent: 'anuga-scenario-menu-archive-scenario-confirm',
        argSelector: (scenario) => scenario
    },
    unarchive: {
        body: 'hydrata.anuga.confirmUnarchiveScenario',
        confirm: 'hydrata.anuga.btnRestore',
        dispatchProp: 'unarchiveAnugaScenario',
        analyticsEvent: 'anuga-scenario-menu-unarchive-scenario-confirm',
        argSelector: (scenario) => scenario
    },
    "delete": {
        body: 'hydrata.anuga.confirmDeleteScenario',
        confirm: 'hydrata.anuga.btnDelete',
        dispatchProp: 'deleteAnugaScenario',
        analyticsEvent: 'anuga-scenario-menu-delete-scenario-confirm',
        argSelector: (scenario) => scenario
    },
    'cancel-run': {
        body: 'hydrata.anuga.confirmCancelRunScenario',
        confirm: 'hydrata.anuga.btnCancelRun',
        dispatchProp: 'cancelAnugaRun',
        analyticsEvent: 'anuga-scenario-menu-cancel-run-confirm',
        argSelector: (scenario) => scenario?.latest_run?.id
    }
};

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
      isSuperuser: PropTypes.bool,
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
      runAnugaScenario: PropTypes.func,
      openTaskMonitorForRun: PropTypes.func,
      // ISSUE 32 (TASK-1429): View results button on completion.
      flatLayers: PropTypes.array,
      onViewResults: PropTypes.func
  };

  static defaultProps = {
      scenarios: []
  };

  constructor(props) {
      super(props);
      this.state = {
      // 'inputs' / 'advanced' / 'runConfig' / 'statusActions'.
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

  // ISSUE 32 (TASK-1429): Close Scenarios, open Results, activate only this
  // scenario's 3 result layers.
  handleViewResults = (scenario) => {
      if (this.props.onViewResults) {
          this.props.onViewResults(scenario, this.props.flatLayers || []);
      }
      if (this.props.setOpenMenuGroupId) {
          this.props.setOpenMenuGroupId('Results');
      }
      if (this.props.setAnugaScenarioMenu) {
          this.props.setAnugaScenarioMenu(false);
      }
      trackEvent('button', 'click', 'anuga-scenario-menu-view-results');
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
      // Run dispatches directly to runAnugaScenario; the compute-backend
      // chooser now lives inline on the runConfig category of ScenarioPane
      // (scenario.compute_backend is set there), so the legacy AnugaRunMenu
      // popup is gone. Fall back to 'local' for the rare case where the
      // scenario was saved before the compute_backend column existed.
      if (this.props.selectAnugaScenario) this.props.selectAnugaScenario(scenario);
      if (this.props.runAnugaScenario) {
          this.props.runAnugaScenario(scenario, scenario?.compute_backend || 'local');
      }
  };

  handleRetryClick = (scenario) => {
      if (scenario?.latest_run?.id && this.props.retryAnugaRun) {
          this.props.retryAnugaRun(scenario.latest_run.id);
      }
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
      const entry = CONFIRM_DIALOG_REGISTRY[confirmingAction];
      if (!entry) return;
      const dispatch = this.props[entry.dispatchProp];
      if (!dispatch) return;
      dispatch(entry.argSelector(confirmingScenario));
      trackEvent('button', 'click', entry.analyticsEvent);
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
          isSuperuser,
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
      // Wave 3C — Duplicate moved to the scenario panel header (next to New
      // Scenario), so canDuplicateScenario + onDuplicateClick are no longer
      // forwarded into ScenarioPane.
      return (
          <ScenarioPane
              scenario={selectedScenario}
              selectedCategoryId={this.state.selectedCategoryId}
              onSelectCategory={this.handleSelectCategory}
              canEdit={canEdit}
              canRunScenario={this.props.canRunScenario}
              currentUserId={currentUserId}
              isSuperuser={isSuperuser}
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
              onArchiveClick={(s) => this.openConfirm('archive', s)}
              onUnarchiveClick={(s) => this.openConfirm('unarchive', s)}
              onConfirmDelete={(s) => this.openConfirm('delete', s)}
              onConfirmCancelRun={(s) => this.openConfirm('cancel-run', s)}
          />
      );
  }

  // Wrapper around getMessageById that returns the English fallback when the
  // messages dictionary is not yet populated (initial render, locale boot).
  // getMessageById returns the msgId itself on lookup miss, so compare against
  // the input id to detect that case.
  tr = (msgId, fallback) => {
      const messages = (this.context && this.context.messages) || {};
      const resolved = getMessageById(messages, msgId);
      return resolved === msgId ? fallback : resolved;
  };

  renderHeader() {
      const {canCreateScenario: canCreate, readyToCompare, selectedScenario} = this.props;
      const {compareMode} = this.state;
      const hasSelected = !!(selectedScenario && selectedScenario.id);
      const canDuplicateNow = canCreate && hasSelected;
      // Use the shared SectionHeader primitive (also used by anugaInputMenu /
      // InputSection / swammInputMenu) instead of a hand-written .row.menu-row
      // .menu-row-header className chain. extraClassName preserves the per-site
      // anuga-section-header and scenario-menu-header CSS hooks.
      return (
          <SectionHeader extraClassName="anuga-section-header scenario-menu-header">
              <Message msgId="hydrata.anuga.scenarios" />
              <span id={"scenario-header-actions"} className="scenario-header-actions">
                  {canCreate ?
                      <Button
                          bsStyle={'success'}
                          bsSize={'xsmall'}
                          className="anuga-btn anuga-btn-new-scenario"
                          onClick={this.handleNewScenario}
                      >
                          <Message msgId="hydrata.anuga.newScenario" />
                      </Button>
                      : null
                  }
                  <Button
                      bsSize={'xsmall'}
                      className={"anuga-btn anuga-btn-compare" + (compareMode ? ' is-active' : '')}
                      onClick={this.handleToggleCompareMode}
                      title={compareMode
                          ? this.tr('hydrata.anuga.exitCompareModeTooltip', 'Exit compare mode')
                          : this.tr('hydrata.anuga.enterCompareModeTooltip',
                              'Enter compare mode, then select 2 scenarios to compare')}
                  >
                      <Message msgId="hydrata.anuga.compare" />
                  </Button>
                  {compareMode && readyToCompare ?
                      <Button
                          bsStyle={'success'}
                          bsSize={'xsmall'}
                          className="anuga-btn anuga-btn-run-compare"
                          onClick={this.handleExecuteCompare}
                      >
                          <Message msgId="hydrata.anuga.run" />
                      </Button>
                      : null
                  }
                  <Button
                      bsSize={'xsmall'}
                      className={"anuga-btn anuga-btn-duplicate-header"
              + (canDuplicateNow ? '' : ' disabled')}
                      disabled={!canDuplicateNow}
                      onClick={() => {
                          if (canDuplicateNow) this.openConfirm('duplicate', selectedScenario);
                      }}
                      title={canDuplicateNow
                          ? this.tr('hydrata.anuga.duplicateSelectedTooltip', 'Duplicate the selected scenario')
                          : this.tr('hydrata.anuga.duplicateDisabledTooltip', 'Select a saved scenario to duplicate')}
                  >
                      <Message msgId="hydrata.anuga.btnDuplicate" />
                  </Button>
              </span>
          </SectionHeader>
      );
  }

  renderConfirmDialog() {
      const {confirmingAction, confirmingScenario} = this.state;
      const isOpen = !!confirmingAction;
      const dialogEntry = CONFIRM_DIALOG_REGISTRY[confirmingAction] || {};
      const {body: bodyMsgId, confirm: confirmLabelMsgId} = dialogEntry;
      const name = confirmingScenario?.name
      || this.tr('hydrata.anuga.thisScenario', 'this scenario');
      return (
          <span
              className={"anuga-scenario-confirm-dialog" + (isOpen ? " is-open" : "")}
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.confirmActionAriaLabel', 'Confirm scenario action')}
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
              aria-label={this.tr('hydrata.anuga.buildValidationAriaLabel', 'Build validation error')}
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
      const {selectedScenario} = this.props;
      const isComplete = selectedScenario?.computed_status === 'complete'
          || selectedScenario?.latest_run?.status === 'complete';
      return (
          <div
              id={'anuga-scenario-menu'}
              className={'simple-view-panel anuga-panel simple-view-panel--miller anuga-scenario-miller'}
          >
              <div className={'menu-rows-container'}>
                  {this.renderHeader()}
                  {/* ISSUE 32 (TASK-1429): View results button shown on run completion */}
                  {isComplete && selectedScenario?.latest_run ? (
                      <div className="anuga-view-results-bar">
                          <Button
                              bsStyle={'success'}
                              bsSize={'xsmall'}
                              className="anuga-btn anuga-btn-view-results"
                              onClick={() => this.handleViewResults(selectedScenario)}
                          >
                              <span className="glyphicon glyphicon-eye-open" aria-hidden="true" />
                              {' '}
                              <Message msgId="hydrata.anuga.viewResults" />
                          </Button>
                      </div>
                  ) : null}
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

// Pull intl messages off React legacy context so getMessageById can resolve
// tooltip + aria-label keys at render time. Matches the pattern used by
// hydrata/HGeval/components/hgevalSignupForm.js and the surrounding Anuga
// surface (anugaInputMenu.js, anugaInputStarterCard.js).
AnugaScenarioMenuClass.contextTypes = {
    messages: PropTypes.object
};

const mapStateToProps = (state) => {
    const selected = selectedScenariosSelector(state);
    return {
        scenarios: getScenariosArray(state),
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
        isSuperuser: !!(state?.security?.user?.is_superuser),
        canCreateScenario: canCreateScenario(state),
        canRunScenario: canRunScenario(state),
        myRole: getProjectMyRole(state),
        currentUserId: state?.security?.user?.pk,
        selectedScenarios: selected,
        readyToCompare: selected.length === 2,
        // ISSUE 32 (TASK-1429): flat layer list for view-results visibility toggling.
        flatLayers: state?.layers?.flat || []
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
    runAnugaScenario: (scenario, computeBackend) => dispatch(runAnugaScenario(scenario, computeBackend)),
    openTaskMonitorForRun: () => dispatch(toggleTaskMonitorPanel(true)),
    // ISSUE 32 (TASK-1429): turn on only this scenario's 3 result layers,
    // turn off all other layers in the Results group.
    onViewResults: (scenario, flatLayers) => {
        const run = scenario?.latest_run;
        if (!run) return;
        const thisRunLayerNames = [
            run.gn_layer_depth_max?.name,
            run.gn_layer_velocity_max?.name,
            run.gn_layer_depth_integrated_velocity_max?.name
        ].filter(Boolean);
        const resultLayers = flatLayers.filter(
            l => l?.group && l.group.startsWith('Results.')
        );
        resultLayers.forEach(layer => {
            const shouldBeVisible = !!layer.name && thisRunLayerNames.includes(layer.name);
            dispatch(changeLayerProperties(layer.id, {visibility: shouldBeVisible}));
        });
    }
});

const AnugaScenarioMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaScenarioMenuClass);

export {
    AnugaScenarioMenu,
    AnugaScenarioMenuClass
};

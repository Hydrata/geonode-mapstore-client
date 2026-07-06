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
import {validateScenario, findScenarioStatus, IN_FLIGHT_STATUSES, RUN_FAILURE_STATES} from './scenarioHelpers';
import {ScenarioRail} from './scenarioRail';
import {ScenarioPane} from './scenarioPane';
import {ScenarioHeaderActions} from './scenarioHeaderActions';
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
 * Container delegates all heavy field renders to ScenarioPane, the
 * always-visible run-action buttons to ScenarioHeaderActions (the header
 * strip; UAT #8 moved these out of the Run pane), and all rail item renders
 * to ScenarioRailItem.
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
          buildValidationError: null,
          // UAT #8 fix — the combined "Build and Run" deferred-run state machine,
          // or null when no run is pending. Shape: {scenarioId, phase} where
          // phase is 'awaiting-inflight' (armed; waiting for the dispatched build
          // to actually start, i.e. enter IN_FLIGHT_STATUSES) then
          // 'awaiting-built' (build observed in flight; waiting for it to reach
          // 'built'). Set by handleBuildAndRunClick (only when a real build was
          // dispatched), advanced/cleared by maybeRunAfterBuild. The two-phase
          // gate means a bare 'built' never preceded by an observed in-flight
          // episode (e.g. a save that did not rebuild, or the stale pre-rebuild
          // 'built' of an already-built scenario) can never trigger a run.
          runAfterBuild: null
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
      // UAT #8 fix — fire any "Build and Run" run that is now eligible.
      this.maybeRunAfterBuild(prevProps);
  }

  // UAT #8 fix — resolve the freshest copy of a scenario by id from the live
  // props (the scenario poller writes new status into state.anuga.scenarios →
  // this.props.scenarios). Falls back to selectedScenario for the defensive case
  // where the awaited scenario is selected but momentarily absent from the array.
  findFreshScenario = (scenarioId, props) => {
      if (scenarioId == null) return null; // eslint-disable-line no-eq-null, eqeqeq
      const list = (props && props.scenarios) || [];
      const found = list.find((s) => s && s.id === scenarioId);
      if (found) return found;
      const selected = props && props.selectedScenario;
      return selected && selected.id === scenarioId ? selected : null;
  };

  // UAT #8 fix — the combined "Build and Run" must NOT fire run in the same tick
  // as build: run would reach the backend before status is 'built' and be
  // rejected (or run a stale build). handleBuildAndRunClick arms a two-phase
  // state machine; here we watch the LIVE status flowing into props and advance
  // it, firing the run exactly once.
  //
  //   awaiting-inflight → the dispatched build must first be SEEN to start
  //     (status enters IN_FLIGHT_STATUSES). Any other status — including a bare
  //     'built' (the stale pre-rebuild artifact of an already-built scenario, or
  //     a save that never rebuilt) — is ignored here, so a run can only follow a
  //     real build episode.
  //   awaiting-built → the build was observed in flight; the run fires on the
  //     transition into 'built', then the flag is cleared so repeated post-build
  //     prop updates can never double-run.
  //
  // Every settle path clears the flag so it can never leak into a future
  // episode: built-after-inflight fires + clears; a terminal failure
  // (error/cancelled) clears without running; and the awaited scenario vanishing
  // from props clears too.
  maybeRunAfterBuild = (prevProps) => {
      const pending = this.state.runAfterBuild;
      if (!pending) return;
      const {scenarioId, phase} = pending;
      const fresh = this.findFreshScenario(scenarioId, this.props);
      if (!fresh) {
          // Awaited scenario vanished (deleted/filtered out) — drop the intent so
          // it can never leak. Act only on the transition (present last tick, gone
          // now) to avoid churn.
          if (this.findFreshScenario(scenarioId, prevProps)) {
              this.setState({runAfterBuild: null});
          }
          return;
      }
      const status = findScenarioStatus(fresh);
      if (RUN_FAILURE_STATES.includes(status)) {
          // Build reached a terminal failure — drop the intent, never run nothing.
          this.setState({runAfterBuild: null});
          return;
      }
      if (phase === 'awaiting-inflight') {
          if (IN_FLIGHT_STATUSES.includes(status)) {
              // The dispatched build has actually started — now await its 'built'.
              this.setState({runAfterBuild: {scenarioId, phase: 'awaiting-built'}});
          }
          // Otherwise keep waiting; we never fire on a 'built' seen in this phase.
          return;
      }
      // phase === 'awaiting-built': the build was observed in flight; fire on the
      // transition into 'built'. Clear BEFORE dispatching so a re-entrant prop
      // update can't double-run.
      if (status === 'built') {
          this.setState({runAfterBuild: null});
          this.handleRunClick(fresh);
      }
  };

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
  // are dropped here; the sv-legend-close <span> in renderHeader is dropped too.
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

  // Dispatch the build/save for an already-validated scenario. Returns 'build'
  // when an explicit server rebuild was dispatched (buildScenarioExplicit), or
  // 'save' when the scenario was unsaved and sent to save instead. Shared by
  // handleBuildClick (validate → dispatch) and handleBuildAndRunClick (validate →
  // dispatch → arm) so the validation runs exactly once per click; the returned
  // signal lets the combined action arm its deferred run ONLY for a real build —
  // a save may not rebuild, so arming on it would leak a pending run.
  //
  // TASK-2079 — Build-and-Run piggyback survives a benign 409: this method
  // dispatches BUILD_SCENARIO synchronously and returns 'build' regardless of
  // how the (async) POST /build/ eventually resolves — 202 (this request's
  // own build) OR 409 (the BE build-dedup guard found one ALREADY in flight
  // for the scenario). Either way handleBuildAndRunClick below arms
  // runAfterBuild, and maybeRunAfterBuild's gate watches the LIVE polled
  // scenario status, not this dispatch's outcome — so a 409 still lets the
  // armed run fire once the EXISTING in-flight build reaches 'built'. A 409
  // only ever surfaces as the benign inline `buildConflict` info near the
  // Build button (scenarioHeaderActions.js) — never the 'Build failed' toast,
  // which stays reserved for a REAL failure (comparisonActions.buildScenarioError).
  dispatchBuild = (scenario) => {
      let dispatched;
      if (scenario.unsaved || !this.props.buildScenarioExplicit) {
          if (this.props.saveAnugaScenario) {
              this.props.saveAnugaScenario(scenario);
          }
          dispatched = 'save';
      } else {
          this.props.buildScenarioExplicit(scenario.id);
          dispatched = 'build';
      }
      if (this.props.setOpenMenuGroupId) {
          this.props.setOpenMenuGroupId(null);
      }
      return dispatched;
  };

  handleBuildClick = (scenario) => {
      const missingField = validateScenario(scenario);
      if (missingField) {
          this.setState({buildValidationError: missingField});
          trackEvent('button', 'click', `anuga-scenario-menu-build-validate-missing-${missingField}`);
          return;
      }
      this.setState({buildValidationError: null});
      this.dispatchBuild(scenario);
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

  // UAT #8 — combined "Build and Run": semantics are ALWAYS build then run
  // (you clicked Build), so there is ONE path — validate, dispatch the build,
  // arm the deferred run, and let maybeRunAfterBuild fire it on the build's
  // 'built' transition (see the state machine above). This holds even for an
  // already-'built' scenario: the explicit rebuild flips building→built, which
  // the awaiting-inflight→awaiting-built gate chains correctly, so we never fire
  // inline against the stale pre-rebuild artifact.
  //
  // We arm ONLY when dispatchBuild reports a real 'build'. An unsaved scenario
  // goes to save instead, and a save only rebuilds if a build-affecting field
  // changed — arming on a save that does not rebuild would leave the flag
  // dangling for a later unrelated build to surprise-fire. The id guard keys the
  // build→built transition; a scenario with no id can't be tracked anyway.
  handleBuildAndRunClick = (scenario) => {
      const missingField = validateScenario(scenario);
      if (missingField) {
          this.setState({buildValidationError: missingField});
          trackEvent('button', 'click', `anuga-scenario-menu-build-and-run-validate-missing-${missingField}`);
          return;
      }
      this.setState({buildValidationError: null});
      const dispatched = this.dispatchBuild(scenario);
      if (dispatched === 'build' && scenario && scenario.id != null) { // eslint-disable-line no-eq-null, eqeqeq
          this.setState({runAfterBuild: {scenarioId: scenario.id, phase: 'awaiting-inflight'}});
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

  // UAT #8 — always-visible run-action strip rendered on the right of the
  // Scenarios heading, separate from the New/Compare/Duplicate cluster. canEdit
  // mirrors the gate ScenarioPane uses for the pane fields. Handlers reuse the
  // existing build/run/retry/confirm chains so behaviour (and Umami analytics
  // labels) is unchanged — only the buttons' location moved out of the Run pane.
  //
  // TASK-2115 (C) — View Results now folds INTO this same strip (dogfood
  // finding C: one consistent action row instead of a separate
  // .sv-anuga-view-results-bar sibling). Gate is unchanged: TASK-2078's D1
  // "RESULT consumer" contract — presence of latest_complete_run, NOT
  // latest_run's status, so a newer in-flight/errored run never hides an
  // older complete run's View Results affordance.
  renderRunActions() {
      const {selectedScenario, myRole, currentUserId} = this.props;
      const canEdit = canEditScenarioByRole(myRole, currentUserId, selectedScenario?.created_by);
      const hasCompleteResults = !!selectedScenario?.latest_complete_run;
      return (
          <ScenarioHeaderActions
              scenario={selectedScenario}
              canEdit={canEdit}
              canRunScenario={this.props.canRunScenario}
              hasCompleteResults={hasCompleteResults}
              onViewResultsClick={this.handleViewResults}
              onBuildClick={this.handleBuildClick}
              onRunClick={this.handleRunClick}
              onBuildAndRunClick={this.handleBuildAndRunClick}
              onRetryClick={this.handleRetryClick}
              onArchiveClick={(s) => this.openConfirm('archive', s)}
              onUnarchiveClick={(s) => this.openConfirm('unarchive', s)}
              onConfirmDelete={(s) => this.openConfirm('delete', s)}
              onConfirmCancelRun={(s) => this.openConfirm('cancel-run', s)}
          />
      );
  }

  renderHeader() {
      const {canCreateScenario: canCreate, readyToCompare, selectedScenario} = this.props;
      const {compareMode} = this.state;
      const hasSelected = !!(selectedScenario && selectedScenario.id);
      const canDuplicateNow = canCreate && hasSelected;
      // Use the shared SectionHeader primitive (also used by anugaInputMenu /
      // InputSection / swammInputMenu) instead of a hand-written .row.sv-menu-row
      // .sv-menu-row-header className chain. extraClassName preserves the per-site
      // sv-anuga-section-header and sv-scenario-menu-header CSS hooks.
      return (
          <SectionHeader extraClassName="sv-anuga-section-header sv-scenario-menu-header">
              <Message msgId="hydrata.anuga.scenarios" />
              <span id={"scenario-header-actions"} className="sv-scenario-header-actions">
                  {canCreate ?
                      <Button
                          bsStyle={'success'}
                          bsSize={'xsmall'}
                          className="sv-anuga-btn anuga-btn-new-scenario"
                          onClick={this.handleNewScenario}
                      >
                          <Message msgId="hydrata.anuga.newScenario" />
                      </Button>
                      : null
                  }
                  <Button
                      bsSize={'xsmall'}
                      className={"sv-anuga-btn sv-anuga-btn-compare" + (compareMode ? ' is-active' : '')}
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
                          className="sv-anuga-btn anuga-btn-run-compare"
                          onClick={this.handleExecuteCompare}
                      >
                          <Message msgId="hydrata.anuga.run" />
                      </Button>
                      : null
                  }
                  <Button
                      bsSize={'xsmall'}
                      className={"sv-anuga-btn sv-anuga-btn-duplicate-header"
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
              className={"sv-anuga-scenario-confirm-dialog" + (isOpen ? " is-open" : "")}
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.confirmActionAriaLabel', 'Confirm scenario action')}
              aria-hidden={isOpen ? undefined : true}
          >
              <span className="sv-anuga-scenario-confirm-text">
                  {bodyMsgId ? <Message msgId={bodyMsgId} msgParams={{name}} /> : null}
              </span>
              <button
                  type="button"
                  className="sv-save-confirm-btn confirm"
                  onClick={this.performConfirm}
              >
                  {confirmLabelMsgId
                      ? <Message msgId={confirmLabelMsgId} />
                      : <Message msgId="hydrata.anuga.ok" />}
              </button>
              <button
                  type="button"
                  className="sv-save-confirm-btn cancel"
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
                  "sv-menu-row-delete-confirm anuga-build-validation-dialog"
          + (buildValidationError ? " is-open" : "")
              }
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.buildValidationAriaLabel', 'Build validation error')}
              aria-hidden={buildValidationError ? undefined : true}
          >
              <span className="sv-menu-row-delete-confirm-text">
                  {buildValidationError ?
                      <Message msgId={`hydrata.anuga.validateMissingField.${buildValidationError}`} />
                      : null
                  }
              </span>
              <button
                  type="button"
                  className="sv-save-confirm-btn confirm"
                  onClick={this.dismissBuildValidation}
              >
                  <Message msgId="hydrata.anuga.ok" />
              </button>
          </span>
      );
  }

  render() {
      const {selectedScenario} = this.props;
      // TASK-2078: View Results gate is a RESULT consumer per D1 — presence
      // of a COMPLETE run (latest_complete_run), NOT computed_status /
      // latest_run's status. A newer in-flight or errored latest_run must
      // never hide an older complete run's View Results affordance.
      const latestCompleteRun = selectedScenario?.latest_complete_run;
      const hasCompleteResults = !!latestCompleteRun;
      // Freshness banner (NEW element, TASK-2078): shown only when latest_run
      // is a DIFFERENT, newer run than latest_complete_run AND is itself
      // in-flight or errored. The status pill/card/error strip/run log stay
      // on latest_run untouched (ScenarioHeaderActions) — this banner does
      // not replace them.
      const latestRun = selectedScenario?.latest_run;
      const latestRunIsNewer = !!latestRun && latestRun.id !== latestCompleteRun?.id;
      const latestRunFailed = latestRunIsNewer && RUN_FAILURE_STATES.includes(latestRun.status);
      const latestRunInFlight = latestRunIsNewer && IN_FLIGHT_STATUSES.includes(latestRun.status);
      const showFreshnessBanner = hasCompleteResults && (latestRunFailed || latestRunInFlight);
      const freshnessBannerMsgId = latestRunFailed
          ? 'hydrata.anuga.resultsFreshnessBannerFailed'
          : 'hydrata.anuga.resultsFreshnessBannerBuilding';
      const freshnessBannerFallback = latestRunFailed
          ? `A newer run failed — results shown are from run ${latestCompleteRun?.id}`
          : `A newer run is building — results shown are from run ${latestCompleteRun?.id}`;
      return (
          <div
              id={'anuga-scenario-menu'}
              className={'simple-view-panel sv-anuga-panel simple-view-panel--miller sv-anuga-scenario-miller'}
          >
              <div className={'sv-menu-rows-container'}>
                  {this.renderHeader()}
                  {/* ISSUE 32 (TASK-1429); folded into the strip TASK-2115 (C) —
                      View Results now renders INSIDE renderRunActions()
                      (ScenarioHeaderActions), leading the row, instead of this
                      separate sibling bar — one consistent action row. */}
                  {this.renderRunActions()}
                  {/* TASK-2078: freshness banner — a newer run is building/failed
                      while the results shown are from the last complete run. */}
                  {showFreshnessBanner ? (
                      <div
                          className="sv-anuga-results-freshness-banner"
                          role="status"
                          aria-live="polite"
                      >
                          <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
                          {' '}
                          {this.tr(freshnessBannerMsgId, freshnessBannerFallback)}
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
    // TASK-2078: layer-name visibility toggle is a RESULT consumer per D1 —
    // reads latest_complete_run (the run whose COGs are actually on the
    // map), not latest_run (which may be a newer in-flight/errored run with
    // no result layers to show yet).
    onViewResults: (scenario, flatLayers) => {
        const run = scenario?.latest_complete_run;
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

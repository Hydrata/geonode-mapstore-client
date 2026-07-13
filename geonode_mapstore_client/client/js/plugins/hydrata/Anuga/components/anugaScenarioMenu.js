import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';

import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
// TASK-2205 (W0.2 epic 2204) — opens the stand-alone "Combined surface" merge
// panel from the terrain coverage-gap suggestion (see scenarioPane.js
// renderTerrainCoverageGapSuggestion). Same action anugaInputMenu.js's header
// button dispatches (TASK-1800).
import {setTerrainWorkbenchVisible} from "../../TerrainWorkbench/actionsTerrainWorkbench";
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
    compareScenarios,
    setSessionComputeTarget
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
import {
    validateScenario, findScenarioStatus, IN_FLIGHT_STATUSES, RUN_FAILURE_STATES,
    getMeshDivergence, getMeshComparison
} from './scenarioHelpers';
import {ScenarioRail} from './scenarioRail';
import {ScenarioPane, meshRegionIsUnattached, rainfallIsUnattached} from './scenarioPane';
import {ScenarioHeaderActions} from './scenarioHeaderActions';
// TASK-2240 (epic 2237 W1.2) — the custom portaled overflow (kebab) menu
// replacing the old New Scenario/Compare/Duplicate header cluster.
import {AnugaScenarioOverflowMenu} from './anugaScenarioOverflowMenu';
// TASK-2194 (epic 2190 W2) — the FE staff-gate precedent (is_staff OR is_superuser).
import {isStaffUser} from './AnugaRunsDashboard/runsDashboardUtils';
import {SectionHeader} from "../../SimpleView/components/primitives";

/**
 * Miller-columns container for the ANUGA scenarios panel.
 *
 * Local component state:
 *   - compareMode — REMOVED (TASK-2240, epic 2237 amendment): Compare's UI
 *     entry is gone entirely; ScenarioRail's compare-checkbox rendering
 *     capability now permanently receives no `compareMode` prop (defaults
 *     false) and stays dark, untouched.
 *   - confirmingAction — single 'duplicate' | 'archive' | 'unarchive' |
 *     'delete' | 'cancel-run' string gating the container-level inline
 *     confirm dialog (always rendered, `.is-open` toggled via CSS so Karma
 *     stays deterministic per memory pin feedback-mapstore-react-version-mismatch).
 *   - confirmingScenario — captured at the same moment as confirmingAction.
 *   - buildValidationError — field-name returned by validateScenario, or null.
 *   - meshRegionWarning — TASK-2116 (F4): {pendingAction: 'build'|'buildAndRun',
 *     scenario} when Build/Build-and-Run was clicked on a scenario with a
 *     drawn-but-unattached MeshRegion, or null. Gates a SEPARATE small confirm
 *     (Build anyway / Attach first) from the 5-action CONFIRM_DIALOG_REGISTRY
 *     below — kept separate so it can never collide with those pinned
 *     duplicate/archive/delete/cancel-run analytics-parity flows.
 *   - divergenceConfirm — TASK-2211 (W3.2, epic 2204, od-4): {scenario} when
 *     maybeRunAfterBuild observed a "Build and Run" build reach 'built' with
 *     an actual mesh triangle count that diverged beyond
 *     props.meshDivergenceThreshold x the stamped pre-build estimate, or
 *     null. A THIRD separate small confirm (same family as meshRegionWarning
 *     / rainfallWarning above) — the deferred run does NOT auto-fire in this
 *     case; one explicit click (or Cancel, which leaves the scenario
 *     'built' with no run dispatched) resolves it. See maybeRunAfterBuild's
 *     doc comment for the full reversal rationale.
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

// TASK-2245 (epic 2237 W3.1); re-scoped TASK-2265 (epic 2237 W5) —
// validateScenario's two build-REQUIRED fields that live inside the
// collapsed-by-default Run settings section (scenarioPane.js). A
// missing-field build-validation failure on either one must expand-then-
// focus the matching field (AC#2) — see requestRunSettingsFocus. mesh_region
// uses the SAME expand-then-focus mechanism but targets the SEPARATE
// Optional inputs section (see requestOptionalInputsFocus) since TASK-2265
// moved it out of Run settings. Every OTHER validateScenario field
// (name/terrain/inflowOrRainfall/boundary) lives in the Required section —
// see REQUIRED_FOCUS_FIELD_IDS below, added TASK-2268, for its own
// expand-then-focus map (Required is collapsible too since TASK-2265, so it
// needs the same bridge, not "no expand plumbing applies" as this comment
// used to say).
const RUN_SETTINGS_FOCUS_FIELD_IDS = {
    resolution: 'resolution',
    duration: 'duration-hours'
};

// TASK-2268 (epic 2237 W5.3) — validateScenario's four build-REQUIRED
// fields that live inside the (now collapsible, TASK-2265) Required
// section. Direct analog of RUN_SETTINGS_FOCUS_FIELD_IDS above: a
// missing-field build-validation failure on any of these must expand-then-
// focus the matching field via requestRequiredFocus, closing the gap where
// the fired validation dialog left the offending field CSS-hidden behind a
// user-collapsed Required section. `inflowOrRainfall` focuses the 'inflow'
// select — the primary water-source field the Required section shows first
// — mirroring the "Attach first" precedent of focusing one concrete field
// for a two-field-substitutable validation failure.
const REQUIRED_FOCUS_FIELD_IDS = {
    name: 'name',
    terrain: 'terrain',
    boundary: 'boundary',
    inflowOrRainfall: 'inflow'
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
      // TASK-2194 (epic 2190 W2) — staff gate + compute-target site config
      // forwarded into ScenarioPane's Run section (advisory selector).
      isStaff: PropTypes.bool,
      availableComputeTargets: PropTypes.array,
      defaultComputeTarget: PropTypes.string,
      // TASK-2194 (review fix) — { [scenarioId]: '<target>' }: the staff
      // user's this-session choices from state.anuga.ui.sessionComputeTargets.
      // Read by every run dispatch path; written via setSessionComputeTarget
      // (NEVER updateAnugaScenario, which would flip scenario.unsaved).
      sessionComputeTargets: PropTypes.object,
      // TASK-2211 (W3.2, epic 2204, AC#4) — GET /api/v2/anuga/config/'s
      // mesh_divergence_threshold (state.anuga.ui.meshDivergenceThreshold),
      // hydrated by the SAME loadAnugaComputeConfigEpic as the two fields
      // above. null (not loaded / malformed) falls back to
      // scenarioHelpers.DEFAULT_MESH_DIVERGENCE_THRESHOLD in maybeRunAfterBuild.
      meshDivergenceThreshold: PropTypes.number,
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
      setSessionComputeTarget: PropTypes.func,
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
          confirmingAction: null,
          confirmingScenario: null,
          buildValidationError: null,
          // TASK-2116 (F4) — {pendingAction, scenario} | null.
          meshRegionWarning: null,
          // TASK-2160 (epic 2147 W4) — {pendingAction, scenario} | null; the
          // rainfall analog of meshRegionWarning. Checked BEFORE meshRegion at
          // build time (see handleBuildClick), so a scenario with BOTH a drawn-
          // unattached rainfall and a drawn-unattached mesh region surfaces the
          // rainfall warning first, then the mesh warning on "Build anyway".
          rainfallWarning: null,
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
          runAfterBuild: null,
          // TASK-2211 (W3.2, epic 2204, od-4) — {scenario} | null. Set by
          // maybeRunAfterBuild INSTEAD OF firing the run when the build's
          // actual mesh diverged beyond threshold; cleared by
          // handleDivergenceConfirm (fires the run) or handleDivergenceCancel
          // (leaves the scenario 'built', no run dispatched).
          divergenceConfirm: null,
          // TASK-2245 (epic 2237 W3.1) — expand-then-focus bridge: bumped by
          // requestRunSettingsFocus so the CHANGE in identity (not the value
          // itself) trips ScenarioPane's useCollapsibleSection effect for
          // the RUN SETTINGS section, which opens it and calls back
          // handleRunSettingsExpanded once that open state has committed —
          // see requestRunSettingsFocus's own doc comment for the full
          // ownership split (focuser stays here; collapse state moves to
          // the pane). MUST start `null` (never 0): the pane's guard treats
          // null/undefined as "no request yet" — starting at 0 would make
          // the very first mount look like an unhandled request and
          // spuriously auto-expand + focus on every fresh menu mount.
          runSettingsExpandToken: null,
          // TASK-2265 (epic 2237 W5, UAT re-aim finding 4) — the Optional
          // inputs analog of runSettingsExpandToken above: mesh_region
          // moved out of the merged RUN SETTINGS section into its own
          // Optional inputs section, so its "Attach first" flow now needs
          // its own independent expand token (bumping runSettingsExpandToken
          // would wrongly open Run settings instead). Same null-start
          // rationale.
          optionalInputsExpandToken: null,
          // TASK-2268 (epic 2237 W5.3) — the Required analog of the two
          // tokens above: a missing-field build-validation failure on a
          // Required-section field (name/terrain/boundary/inflowOrRainfall)
          // bumps THIS token so the pane's own Required
          // useCollapsibleSection expands (and only that section — a
          // separate token per section is what keeps the three bridges from
          // ever cross-firing). Same null-start rationale.
          requiredExpandToken: null
      };
      // Not React state: read synchronously by handleRunSettingsExpanded
      // once the pane's callback fires; nothing ever renders off this value
      // directly, so it doesn't need to trigger its own re-render.
      this.pendingRunSettingsFocusFieldId = null;
      // TASK-2265 — the Optional inputs analog, read by
      // handleOptionalInputsExpanded.
      this.pendingOptionalInputsFocusFieldId = null;
      // TASK-2268 — the Required analog, read by handleRequiredExpanded.
      this.pendingRequiredFocusFieldId = null;
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
  //     transition into 'built' — UNLESS the build DIVERGED (TASK-2211, W3.2,
  //     od-4: see below) — then the flag is cleared so repeated post-build
  //     prop updates can never double-run.
  //
  // Every settle path clears the flag so it can never leak into a future
  // episode: built-after-inflight fires + clears; a terminal failure
  // (error/cancelled) clears without running; and the awaited scenario vanishing
  // from props clears too.
  //
  // TASK-2211 (W3.2, epic 2204, od-4) — DELIBERATE REVERSAL of the UAT #8
  // "Build and Run ALWAYS builds then runs" semantics (operator-approved
  // 2026-07-10 grill, in direct response to the 07-09 dogfood: an honest
  // estimate can still turn out badly wrong once the mesh actually builds,
  // and Build-and-Run used to fire the run against it with no chance to
  // reconsider — the exact "convenient path" the dogfood cascade replayed).
  // On the built transition we now ask getMeshDivergence(fresh.latest_run,
  // threshold) — the SAME arithmetic TASK-2210's post-build comparison
  // renders — whether the ACTUAL triangle count exceeds threshold x the
  // stamped pre-build estimate. Above threshold: PAUSE (arm
  // divergenceConfirm instead of firing); the scenario stays 'built' until
  // one explicit confirm click (or Cancel, which leaves it there for good).
  // At/below threshold, or when there's no comparison data to evaluate
  // (missing mesh_provenance — a legacy pre-W2 scenario, or a failed
  // build's empty {} — getMeshDivergence.exceedsThreshold is ALWAYS false):
  // byte-identical auto-fire, unchanged from before this task (AC#2).
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
      // phase === 'awaiting-built': the build was observed in flight; resolve on
      // the transition into 'built'. Clear runAfterBuild BEFORE dispatching (or
      // pausing) so a re-entrant prop update can't double-run or double-pause.
      if (status === 'built') {
          this.setState({runAfterBuild: null});
          const {exceedsThreshold} = getMeshDivergence(fresh.latest_run, this.props.meshDivergenceThreshold);
          if (exceedsThreshold) {
              this.setState({divergenceConfirm: {scenario: fresh}});
              trackEvent('button', 'click', 'anuga-scenario-menu-build-and-run-divergence-pause');
              return;
          }
          this.handleRunClick(fresh);
      }
  };

  handleSelect = (scenario) => {
      // P0-A (TASK-2217/2204 gate-fix) — a divergence-confirm dialog refers
      // to a SPECIFIC scenario's build; switching to a DIFFERENT scenario
      // must invalidate it (the still-open dialog previously stayed
      // interactive against the OLD scenario with zero visual cue it no
      // longer refers to what's on screen — see the dialog's scenario-name
      // label below, added for the same reason).
      if (this.state.divergenceConfirm
          && this.state.divergenceConfirm.scenario
          && scenario
          && this.state.divergenceConfirm.scenario.id !== scenario.id) {
          this.setState({divergenceConfirm: null});
      }
      if (this.props.selectAnugaScenario) {
          this.props.selectAnugaScenario(scenario);
      }
  };

  handleToggleSelected = (scenario) => {
      if (this.props.toggleScenarioSelected) {
          this.props.toggleScenarioSelected(scenario);
      }
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

  // TASK-2240 (epic 2237 W1.2) — Compare's UI entry is REMOVED entirely
  // (epic 2237 amendment): handleToggleCompareMode/handleExecuteCompare,
  // the header's Compare/Execute-Compare buttons that called them, are
  // deleted here as dead code (nothing left to call them). The underlying
  // redux plumbing (compareScenarios action, selectedScenariosSelector,
  // toggleScenarioSelected, ScenarioRail's own compare-checkbox rendering
  // capability) is left wired but DARK — untouched — so the feature can be
  // re-lit later without redux-level rework, per the amendment's "code
  // stays dark" instruction. The two retired Umami labels
  // (anuga-scenario-menu-compare-tab-toggle / -compare-execute) move into
  // the removed-labels regression-guard pattern
  // (anugaScenarioAnalyticsParity-test.js).

  handleArchiveFilterToggle = () => {
      const archived = this.props.archiveFilter === 'only';
      const nextMode = archived ? 'none' : 'only';
      if (this.props.setAnugaScenarioArchiveFilter) {
          this.props.setAnugaScenarioArchiveFilter(nextMode);
      }
      trackEvent('button', 'click', `anuga-scenario-menu-archive-filter-${nextMode}`);
  };

  handleUpdateScenario = (scenario, kv) => {
      if (this.props.updateAnugaScenario) {
          this.props.updateAnugaScenario(scenario, kv);
      }
  };

  // TASK-2194 (review fix) — record the staff compute-target pick on the
  // per-scenario ui slot (state.anuga.ui.sessionComputeTargets). This MUST
  // NOT go through handleUpdateScenario/UPDATE_ANUGA_SCENARIO: that reducer
  // unconditionally flips scenario.unsaved, which sends the next
  // Build-and-Run down dispatchBuild's save-only branch (the deferred run is
  // never armed) and the follow-up save wholesale-replace wipes the choice.
  handleSetSessionComputeTarget = (scenario, target) => {
      const key = scenario?.id || scenario?._tempId;
      if (key === null || key === undefined) return; // eslint-disable-line no-eq-null, eqeqeq
      if (this.props.setSessionComputeTarget) {
          this.props.setSessionComputeTarget(key, target);
      }
  };

  // The current session choice for a scenario, or null (-> startRun omits
  // the field and the server resolves the site default).
  sessionComputeTargetFor = (scenario) => {
      const key = scenario?.id || scenario?._tempId;
      if (key === null || key === undefined) return null; // eslint-disable-line no-eq-null, eqeqeq
      return (this.props.sessionComputeTargets || {})[key] || null;
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
      // P0-A (TASK-2217/2204 gate-fix) — dispatchBuild is the single
      // choke-point for EVERY Build/Build-and-Run dispatch (plain build via
      // proceedPastRainfall, and Build-and-Run via armAndDispatchBuildAndRun
      // below). ANY new dispatch invalidates a still-open divergenceConfirm
      // dialog — it was computed against a PREVIOUS build's mesh comparison,
      // and confirming it after a new build was kicked off would run
      // whatever build happens to be current at click time, not the one the
      // dialog's numbers describe.
      if (this.state.divergenceConfirm) {
          this.setState({divergenceConfirm: null});
      }
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

  // TASK-2116 (F4) — true when the project has a drawn MeshRegion resource
  // but this scenario hasn't attached one. Delegates to scenarioPane.js's
  // meshRegionIsUnattached (same predicate that drives the in-pane hint) so
  // the hint and the build-time confirm can never drift apart.
  meshRegionNeedsWarning = (scenario) => meshRegionIsUnattached(scenario, this.props.meshRegions);

  // TASK-2160 (epic 2147 W4) — rainfall analog of meshRegionNeedsWarning.
  // Delegates to scenarioPane.js's rainfallIsUnattached (same predicate that
  // drives the in-pane hint) so the hint and the build-time confirm can never
  // drift apart, exactly as meshRegionNeedsWarning does for mesh regions.
  rainfallNeedsWarning = (scenario) => rainfallIsUnattached(scenario, this.props.rainfalls);

  // TASK-2160 (epic 2147 W4) — the build tail AFTER the rainfall gate has been
  // cleared (either it didn't apply, or the user chose "Build anyway"). The
  // mesh-region gate (TASK-2116) is the LAST gate before dispatch, so it lives
  // here; a scenario tripping BOTH warnings shows rainfall first, then this
  // surfaces the mesh warning. Shared by the click handlers and the rainfall
  // "Build anyway" handler so the composition can't drift.
  proceedPastRainfall = (pendingAction, scenario) => {
      if (this.meshRegionNeedsWarning(scenario)) {
          this.setState({meshRegionWarning: {pendingAction, scenario}});
          return;
      }
      if (pendingAction === 'buildAndRun') {
          this.armAndDispatchBuildAndRun(scenario);
      } else {
          this.dispatchBuild(scenario);
      }
  };

  handleBuildClick = (scenario) => {
      const missingField = validateScenario(scenario);
      if (missingField) {
          this.setState({buildValidationError: missingField});
          trackEvent('button', 'click', `anuga-scenario-menu-build-validate-missing-${missingField}`);
          // TASK-2245 (AC#2) — resolution/duration live inside the
          // collapsed-by-default RUN SETTINGS section; expand-then-focus the
          // matching field so the validation dialog doesn't leave the user
          // hunting for a hidden field. TASK-2268 (epic 2237 W5.3) — every
          // OTHER missingField (name/terrain/inflowOrRainfall/boundary)
          // lives in the Required section, which is ALSO collapsible
          // (TASK-2265) — same bridge, separate map + token so the two
          // sections never cross-fire.
          if (RUN_SETTINGS_FOCUS_FIELD_IDS[missingField]) {
              this.requestRunSettingsFocus(RUN_SETTINGS_FOCUS_FIELD_IDS[missingField]);
          } else if (REQUIRED_FOCUS_FIELD_IDS[missingField]) {
              this.requestRequiredFocus(REQUIRED_FOCUS_FIELD_IDS[missingField]);
          }
          return;
      }
      this.setState({buildValidationError: null});
      if (this.rainfallNeedsWarning(scenario)) {
          this.setState({rainfallWarning: {pendingAction: 'build', scenario}});
          return;
      }
      this.proceedPastRainfall('build', scenario);
  };

  handleRunClick = (scenario) => {
      // TASK-2194 (epic 2190 W2, review fix): the compute-TARGET chooser
      // lives inline on the Run section of ScenarioPane, and the choice is
      // SESSION state on state.anuga.ui.sessionComputeTargets keyed by
      // scenario id — NOT on the scenario object (Scenario has NO such
      // column, and riding the scenario object meant the choice flipped
      // unsaved and was wiped by any save/refresh replace). Set -> pass it
      // through (this method is ALSO the re-run + deferred build-and-run
      // path); unset -> pass null so startRun OMITS the field and the server
      // resolves the site default (StartRunView is the real gate).
      if (this.props.selectAnugaScenario) this.props.selectAnugaScenario(scenario);
      if (this.props.runAnugaScenario) {
          this.props.runAnugaScenario(scenario, this.sessionComputeTargetFor(scenario));
      }
  };

  handleRetryClick = (scenario) => {
      if (scenario?.latest_run?.id && this.props.retryAnugaRun) {
          this.props.retryAnugaRun(scenario.latest_run.id);
      }
  };

  // UAT #8 — combined "Build and Run": semantics are ALWAYS build then run
  // (you clicked Build), so there is ONE path — validate, dispatch the build,
  // arm the deferred run, and let maybeRunAfterBuild resolve it on the build's
  // 'built' transition (see the state machine above). This holds even for an
  // already-'built' scenario: the explicit rebuild flips building→built, which
  // the awaiting-inflight→awaiting-built gate chains correctly, so we never fire
  // inline against the stale pre-rebuild artifact.
  //
  // TASK-2211 (W3.2, epic 2204, od-4) — "resolve", not "fire": the build ALWAYS
  // still happens (that part of UAT #8 is unchanged), but the deferred RUN no
  // longer ALWAYS auto-fires — maybeRunAfterBuild now PAUSES it behind one
  // confirm click when the build's actual mesh diverged beyond threshold. This
  // is a documented, operator-approved reversal of the plain "ALWAYS run"
  // half of the old UAT #8 semantics — see maybeRunAfterBuild's own doc
  // comment for the full rationale and the below-threshold byte-identical
  // guarantee (AC#2).
  //
  // We arm ONLY when dispatchBuild reports a real 'build'. An unsaved scenario
  // goes to save instead, and a save only rebuilds if a build-affecting field
  // changed — arming on a save that does not rebuild would leave the flag
  // dangling for a later unrelated build to surprise-fire. The id guard keys the
  // build→built transition; a scenario with no id can't be tracked anyway.
  //
  // Extracted from handleBuildAndRunClick so TASK-2116's "Build anyway" path
  // (after the mesh-region warning is dismissed) can dispatch through the
  // exact same arm-then-build sequence.
  armAndDispatchBuildAndRun = (scenario) => {
      const dispatched = this.dispatchBuild(scenario);
      if (dispatched === 'build' && scenario && scenario.id != null) { // eslint-disable-line no-eq-null, eqeqeq
          this.setState({runAfterBuild: {scenarioId: scenario.id, phase: 'awaiting-inflight'}});
      }
  };

  handleBuildAndRunClick = (scenario) => {
      const missingField = validateScenario(scenario);
      if (missingField) {
          this.setState({buildValidationError: missingField});
          trackEvent('button', 'click', `anuga-scenario-menu-build-and-run-validate-missing-${missingField}`);
          // TASK-2245 (AC#2) / TASK-2268 — same expand-then-focus as
          // handleBuildClick.
          if (RUN_SETTINGS_FOCUS_FIELD_IDS[missingField]) {
              this.requestRunSettingsFocus(RUN_SETTINGS_FOCUS_FIELD_IDS[missingField]);
          } else if (REQUIRED_FOCUS_FIELD_IDS[missingField]) {
              this.requestRequiredFocus(REQUIRED_FOCUS_FIELD_IDS[missingField]);
          }
          return;
      }
      this.setState({buildValidationError: null});
      if (this.rainfallNeedsWarning(scenario)) {
          this.setState({rainfallWarning: {pendingAction: 'buildAndRun', scenario}});
          return;
      }
      this.proceedPastRainfall('buildAndRun', scenario);
  };

  // TASK-2116 (F4) — "Build anyway": proceed with the SAME dispatch the
  // click would have taken had there been no unattached MeshRegion. NO
  // auto-attach (operator-rejected — see scenarioPane.js's
  // meshRegionIsUnattached JSDoc).
  handleMeshRegionWarningBuildAnyway = () => {
      const pending = this.state.meshRegionWarning;
      if (!pending) return;
      this.setState({meshRegionWarning: null});
      trackEvent('button', 'click', 'anuga-scenario-menu-mesh-region-warning-build-anyway');
      if (pending.pendingAction === 'buildAndRun') {
          this.armAndDispatchBuildAndRun(pending.scenario);
      } else {
          this.dispatchBuild(pending.scenario);
      }
  };

  // TASK-2245 (epic 2237 W3.1) — expand-then-focus bridge. Collapse-state
  // ownership split (binding design decision): the FOCUSER — this method,
  // the actual `document.getElementById(fieldId).focus()` call — stays
  // HERE in the menu, unchanged from the pre-merge "Attach first" handlers
  // (TASK-2116). Only the RUN SETTINGS open/closed boolean moved to
  // scenarioPane.js's useRunSettingsCollapse. Bumping the token (any value
  // whose IDENTITY changes) is what trips that hook's effect; it opens the
  // section and calls handleRunSettingsExpanded back ONCE that open state
  // has actually committed to the DOM — never call .focus() directly from
  // here, or it can race a still-collapsed (`display:none`) field.
  requestRunSettingsFocus = (fieldId) => {
      this.pendingRunSettingsFocusFieldId = fieldId;
      this.setState((prevState) => ({runSettingsExpandToken: (prevState.runSettingsExpandToken || 0) + 1}));
  };

  // TASK-2245 — fired by ScenarioPane's onRunSettingsExpanded prop once the
  // RUN SETTINGS section is confirmed open (post-commit). This is the ONLY
  // place that actually calls .focus() for the RUN SETTINGS fields.
  handleRunSettingsExpanded = () => {
      const fieldId = this.pendingRunSettingsFocusFieldId;
      this.pendingRunSettingsFocusFieldId = null;
      const el = typeof document !== 'undefined' && fieldId ? document.getElementById(fieldId) : null;
      if (el && typeof el.focus === 'function') el.focus();
  };

  // TASK-2265 (epic 2237 W5) — Optional inputs analog of
  // requestRunSettingsFocus above: bumps optionalInputsExpandToken instead,
  // so the pane opens the Optional inputs section (not Run settings).
  requestOptionalInputsFocus = (fieldId) => {
      this.pendingOptionalInputsFocusFieldId = fieldId;
      this.setState((prevState) => ({optionalInputsExpandToken: (prevState.optionalInputsExpandToken || 0) + 1}));
  };

  // TASK-2265 — fired by ScenarioPane's onOptionalInputsExpanded prop once
  // the Optional inputs section is confirmed open (post-commit). This is
  // the ONLY place that actually calls .focus() for Optional inputs fields.
  handleOptionalInputsExpanded = () => {
      const fieldId = this.pendingOptionalInputsFocusFieldId;
      this.pendingOptionalInputsFocusFieldId = null;
      const el = typeof document !== 'undefined' && fieldId ? document.getElementById(fieldId) : null;
      if (el && typeof el.focus === 'function') el.focus();
  };

  // TASK-2268 (epic 2237 W5.3) — Required analog of requestRunSettingsFocus/
  // requestOptionalInputsFocus above: bumps requiredExpandToken so the pane
  // opens (only) the Required section.
  requestRequiredFocus = (fieldId) => {
      this.pendingRequiredFocusFieldId = fieldId;
      this.setState((prevState) => ({requiredExpandToken: (prevState.requiredExpandToken || 0) + 1}));
  };

  // TASK-2268 — fired by ScenarioPane's onRequiredExpanded prop once the
  // Required section is confirmed open (post-commit). This is the ONLY
  // place that actually calls .focus() for Required-section fields.
  handleRequiredExpanded = () => {
      const fieldId = this.pendingRequiredFocusFieldId;
      this.pendingRequiredFocusFieldId = null;
      const el = typeof document !== 'undefined' && fieldId ? document.getElementById(fieldId) : null;
      if (el && typeof el.focus === 'function') el.focus();
  };

  // TASK-2116 (F4); re-targeted TASK-2265 (epic 2237 W5, UAT re-aim finding
  // 4) — "Attach first": dismiss without building, expand-then-focus the
  // mesh-region selector. mesh_region now lives inside its own Optional
  // inputs section (moved out of the merged RUN SETTINGS section), so this
  // targets requestOptionalInputsFocus, not requestRunSettingsFocus.
  handleMeshRegionWarningAttachFirst = () => {
      this.setState({meshRegionWarning: null});
      trackEvent('button', 'click', 'anuga-scenario-menu-mesh-region-warning-attach-first');
      this.requestOptionalInputsFocus('mesh_region');
  };

  // TASK-2160 (epic 2147 W4) — "Build anyway" for the rainfall warning:
  // proceed with the SAME dispatch the click would have taken, but STILL run
  // the mesh-region gate on the way (via proceedPastRainfall) so acknowledging
  // one warning never suppresses the other. NO auto-attach (operator-rejected,
  // same rationale as mesh_region — see scenarioPane.js rainfallIsUnattached).
  handleRainfallWarningBuildAnyway = () => {
      const pending = this.state.rainfallWarning;
      if (!pending) return;
      this.setState({rainfallWarning: null});
      trackEvent('button', 'click', 'anuga-scenario-menu-rainfall-warning-build-anyway');
      this.proceedPastRainfall(pending.pendingAction, pending.scenario);
  };

  // TASK-2160 (epic 2147 W4) — "Attach first": dismiss without building and
  // focus the rainfall selector so the user can pick a rainfall immediately.
  handleRainfallWarningAttachFirst = () => {
      this.setState({rainfallWarning: null});
      trackEvent('button', 'click', 'anuga-scenario-menu-rainfall-warning-attach-first');
      const el = typeof document !== 'undefined' ? document.getElementById('rainfall') : null;
      if (el && typeof el.focus === 'function') el.focus();
  };

  // TASK-2211 (W3.2, epic 2204, od-4, AC#1) — "Confirm run": the user has
  // seen the diverged actual-vs-estimate comparison and wants the deferred
  // run to proceed anyway. Fires the SAME handleRunClick the byte-identical
  // below-threshold path uses (dispatch is otherwise unaffected by this
  // wave) — the only difference is the timing of the click.
  //
  // P0-A (TASK-2217/2204 gate-fix) — belt-and-braces re-validation: even
  // with the invalidation above (scenario switch / new build both clear
  // divergenceConfirm), re-check against the CURRENT live props at the
  // moment of the click, in case of any race between a prop update and this
  // handler firing. If the scenario this dialog was computed against no
  // longer exists, or its latest_run has moved on from the run the
  // comparison numbers describe, no-op (and still clear) rather than
  // dispatching a run keyed only by scenario id against whatever build
  // happens to be current.
  handleDivergenceConfirm = () => {
      const pending = this.state.divergenceConfirm;
      if (!pending) return;
      this.setState({divergenceConfirm: null});
      const fresh = this.findFreshScenario(pending.scenario && pending.scenario.id, this.props);
      const pendingRunId = pending.scenario && pending.scenario.latest_run && pending.scenario.latest_run.id;
      const freshRunId = fresh && fresh.latest_run && fresh.latest_run.id;
      if (!fresh || pendingRunId == null || freshRunId !== pendingRunId) { // eslint-disable-line no-eq-null, eqeqeq
          trackEvent('button', 'click', 'anuga-scenario-menu-divergence-confirm-run-stale-noop');
          return;
      }
      trackEvent('button', 'click', 'anuga-scenario-menu-divergence-confirm-run');
      this.handleRunClick(fresh);
  };

  // TASK-2211 (W3.2, epic 2204, od-4, AC#1) — "Cancel": no run is dispatched.
  // The scenario stays 'built' (the build itself already completed and is
  // NOT undone) — there is nothing else to do here; the user can inspect
  // the mesh, edit the scenario, or click plain Run later.
  handleDivergenceCancel = () => {
      this.setState({divergenceConfirm: null});
      trackEvent('button', 'click', 'anuga-scenario-menu-divergence-confirm-cancel');
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
          isStaff,
          availableComputeTargets,
          defaultComputeTarget,
          terrain,
          boundaries,
          inflows,
          rainfalls,
          frictions,
          structures,
          meshRegions,
          networks
      } = this.props;
      const canEdit = canEditScenarioByRole(myRole, currentUserId, selectedScenario?.created_by);
      // Wave 3C — Duplicate moved to the scenario panel header (next to New
      // Scenario), so canDuplicateScenario + onDuplicateClick are no longer
      // forwarded into ScenarioPane.
      return (
          <ScenarioPane
              scenario={selectedScenario}
              canEdit={canEdit}
              canRunScenario={this.props.canRunScenario}
              currentUserId={currentUserId}
              isStaff={isStaff}
              availableComputeTargets={availableComputeTargets}
              defaultComputeTarget={defaultComputeTarget}
              sessionComputeTarget={this.sessionComputeTargetFor(selectedScenario)}
              onSetSessionComputeTarget={this.handleSetSessionComputeTarget}
              terrain={terrain}
              boundaries={boundaries}
              inflows={inflows}
              rainfalls={rainfalls}
              frictions={frictions}
              structures={structures}
              meshRegions={meshRegions}
              networks={networks}
              onUpdateScenario={this.handleUpdateScenario}
              onOpenMergeTerrainsPanel={this.props.onOpenMergeTerrainsPanel}
              runSettingsExpandToken={this.state.runSettingsExpandToken}
              onRunSettingsExpanded={this.handleRunSettingsExpanded}
              optionalInputsExpandToken={this.state.optionalInputsExpandToken}
              onOptionalInputsExpanded={this.handleOptionalInputsExpanded}
              requiredExpandToken={this.state.requiredExpandToken}
              onRequiredExpanded={this.handleRequiredExpanded}
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
  // Scenarios heading, separate from the header's overflow (kebab) menu.
  // canEdit mirrors the gate ScenarioPane uses for the pane fields. Handlers
  // reuse the existing build/run/retry/confirm chains so behaviour (and
  // Umami analytics labels) is unchanged — only the buttons' location moved
  // out of the Run pane. TASK-2240 — Archive/Unarchive/Delete no longer pass
  // through here; the overflow menu (renderHeader) opens those confirms
  // directly.
  //
  // TASK-2115 (C) — View Results now folds INTO this same strip (dogfood
  // finding C: one consistent action row instead of a separate
  // .sv-anuga-view-results-bar sibling). Gate is unchanged: TASK-2078's D1
  // "RESULT consumer" contract — presence of latest_complete_run, NOT
  // latest_run's status, so a newer in-flight/errored run never hides an
  // older complete run's View Results affordance.
  // `hasCompleteResults` is passed in from render() (single derivation of
  // `!!selectedScenario?.latest_complete_run`, shared with the freshness
  // banner below) — simplify-pass cleanup (TASK-2111 W2 sweep), no behaviour
  // change.
  renderRunActions(hasCompleteResults) {
      const {selectedScenario, myRole, currentUserId} = this.props;
      const canEdit = canEditScenarioByRole(myRole, currentUserId, selectedScenario?.created_by);
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
              onConfirmCancelRun={(s) => this.openConfirm('cancel-run', s)}
          />
      );
  }

  // TASK-2240 (epic 2237 W1.2) — the header's action cluster is now a
  // single kebab overflow menu (AnugaScenarioOverflowMenu) carrying New
  // scenario / Duplicate / Archive-Restore / Delete. Compare's UI entry is
  // REMOVED entirely (amendment, epic 2237): no button anywhere dispatches
  // it any more — see the handleArchiveFilterToggle-adjacent removal note
  // earlier in this file (where handleToggleCompareMode/handleExecuteCompare
  // used to live). inFlight mirrors ScenarioHeaderActions' own derivation
  // (findScenarioStatus + IN_FLIGHT_STATUSES) so the menu's Archive/Delete
  // disable-while-running gate can never drift from the strip's own
  // Cancel-run gate.
  renderHeader() {
      const {canCreateScenario: canCreate, myRole, currentUserId, selectedScenario} = this.props;
      const canEdit = canEditScenarioByRole(myRole, currentUserId, selectedScenario?.created_by);
      const inFlight = IN_FLIGHT_STATUSES.includes(findScenarioStatus(selectedScenario));
      // Use the shared SectionHeader primitive (also used by anugaInputMenu /
      // InputSection / swammInputMenu) instead of a hand-written .row.sv-menu-row
      // .sv-menu-row-header className chain. extraClassName preserves the per-site
      // sv-anuga-section-header and sv-scenario-menu-header CSS hooks.
      return (
          <SectionHeader extraClassName="sv-anuga-section-header sv-scenario-menu-header">
              <Message msgId="hydrata.anuga.scenarios" />
              <span id={"scenario-header-actions"} className="sv-scenario-header-actions">
                  <AnugaScenarioOverflowMenu
                      canCreateScenario={canCreate}
                      scenario={selectedScenario}
                      canEdit={canEdit}
                      inFlight={inFlight}
                      onNewScenario={this.handleNewScenario}
                      onDuplicateClick={(s) => this.openConfirm('duplicate', s)}
                      onArchiveClick={(s) => this.openConfirm('archive', s)}
                      onUnarchiveClick={(s) => this.openConfirm('unarchive', s)}
                      onDeleteClick={(s) => this.openConfirm('delete', s)}
                  />
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

  // TASK-2116 (F4) — build-time confirm for a drawn-but-unattached
  // MeshRegion. Deliberately a SEPARATE small dialog from
  // CONFIRM_DIALOG_REGISTRY's 5 scenario-action confirms (duplicate/
  // archive/unarchive/delete/cancel-run) rather than a 6th registry entry —
  // those confirms are 1:1 pinned by anugaScenarioAnalyticsParity-test, and
  // "Attach first" isn't a generic Cancel (it also moves focus), so keeping
  // it out of that shared state machine avoids any risk to the pinned flows.
  // Reuses .sv-anuga-scenario-confirm-dialog for the shared look (position/
  // background/is-open toggle) — extend, don't invent a parallel style.
  renderMeshRegionWarningDialog() {
      const {meshRegionWarning} = this.state;
      const isOpen = !!meshRegionWarning;
      const scenario = meshRegionWarning?.scenario;
      const resolution = scenario?.resolution != null ? scenario.resolution : ''; // eslint-disable-line no-eq-null, eqeqeq
      const names = (this.props.meshRegions || []).map(r => r?.title).filter(Boolean).join(', ');
      return (
          <span
              className={"sv-anuga-scenario-confirm-dialog sv-anuga-mesh-region-warning-dialog"
              + (isOpen ? " is-open" : "")}
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.meshRegionWarningAriaLabel', 'Mesh region not attached')}
              aria-hidden={isOpen ? undefined : true}
          >
              <span className="sv-anuga-scenario-confirm-text">
                  <Message
                      msgId="hydrata.anuga.meshRegionUnattachedConfirm"
                      msgParams={{names, resolution}}
                  />
              </span>
              <button
                  type="button"
                  className="sv-save-confirm-btn confirm sv-anuga-mesh-region-build-anyway"
                  onClick={this.handleMeshRegionWarningBuildAnyway}
              >
                  <Message msgId="hydrata.anuga.buildAnyway" />
              </button>
              <button
                  type="button"
                  className="sv-save-confirm-btn cancel sv-anuga-mesh-region-attach-first"
                  onClick={this.handleMeshRegionWarningAttachFirst}
              >
                  <Message msgId="hydrata.anuga.attachFirst" />
              </button>
          </span>
      );
  }

  // TASK-2160 (epic 2147 W4) — build-time confirm for a drawn-but-unattached
  // Rainfall. Direct mirror of renderMeshRegionWarningDialog: always rendered,
  // `.is-open` toggled via CSS (Karma-deterministic), reusing
  // .sv-anuga-scenario-confirm-dialog for the shared chrome. Distinct wrapper
  // class .sv-anuga-rainfall-warning-dialog + button classes so its own specs
  // and the mesh-region specs target disjoint nodes.
  renderRainfallWarningDialog() {
      const {rainfallWarning} = this.state;
      const isOpen = !!rainfallWarning;
      const names = (this.props.rainfalls || []).map(r => r?.title).filter(Boolean).join(', ');
      return (
          <span
              className={"sv-anuga-scenario-confirm-dialog sv-anuga-rainfall-warning-dialog"
              + (isOpen ? " is-open" : "")}
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.rainfallWarningAriaLabel', 'Rainfall not attached')}
              aria-hidden={isOpen ? undefined : true}
          >
              <span className="sv-anuga-scenario-confirm-text">
                  <Message
                      msgId="hydrata.anuga.rainfallUnattachedConfirm"
                      msgParams={{names}}
                  />
              </span>
              <button
                  type="button"
                  className="sv-save-confirm-btn confirm sv-anuga-rainfall-build-anyway"
                  onClick={this.handleRainfallWarningBuildAnyway}
              >
                  <Message msgId="hydrata.anuga.buildAnyway" />
              </button>
              <button
                  type="button"
                  className="sv-save-confirm-btn cancel sv-anuga-rainfall-attach-first"
                  onClick={this.handleRainfallWarningAttachFirst}
              >
                  <Message msgId="hydrata.anuga.attachFirst" />
              </button>
          </span>
      );
  }

  // TASK-2211 (W3.2, epic 2204, od-4) — the divergence-interrupt confirm:
  // build-and-run PAUSED because the actual mesh diverged beyond threshold.
  // A THIRD small confirm in the SAME family as renderMeshRegionWarningDialog
  // / renderRainfallWarningDialog above (always rendered, `.is-open` toggled
  // via CSS for Karma determinism) — kept separate from the 5-action
  // CONFIRM_DIALOG_REGISTRY for the same reason those two are. Reuses
  // getMeshComparison (the SAME arithmetic TASK-2210's post-build panel
  // renders) for the actual/estimate/cost numbers in the confirm copy.
  renderDivergenceConfirmDialog() {
      const {divergenceConfirm} = this.state;
      const isOpen = !!divergenceConfirm;
      const comparison = getMeshComparison(divergenceConfirm?.scenario?.latest_run) || {};
      return (
          <span
              className={"sv-anuga-scenario-confirm-dialog sv-anuga-divergence-confirm-dialog"
              + (isOpen ? " is-open" : "")}
              role="alertdialog"
              aria-label={this.tr('hydrata.anuga.divergenceConfirmAriaLabel', 'Mesh diverged from estimate')}
              aria-hidden={isOpen ? undefined : true}
          >
              <span className="sv-anuga-scenario-confirm-text">
                  {/* P0-A (TASK-2217/2204 gate-fix) — name the scenario this
                    * dialog refers to, so a user who switched scenarios (or
                    * has multiple in flight) has a visual cue this confirm
                    * is NOT necessarily about what's currently selected. */}
                  <strong className="sv-anuga-divergence-confirm-scenario-name">
                      <Message
                          msgId="hydrata.anuga.divergenceConfirmScenarioName"
                          msgParams={{name: (divergenceConfirm && divergenceConfirm.scenario && divergenceConfirm.scenario.name) || ''}}
                      />
                  </strong>{' '}
                  <Message
                      msgId="hydrata.anuga.divergenceConfirmText"
                      msgParams={{
                          actual: comparison.actual != null // eslint-disable-line no-eq-null, eqeqeq
                              ? Number(comparison.actual).toLocaleString() : '',
                          estimate: comparison.estimate != null // eslint-disable-line no-eq-null, eqeqeq
                              ? Number(comparison.estimate).toLocaleString() : ''
                      }}
                  />
                  {comparison.actualCost !== null && comparison.actualCost !== undefined
                      ? ` (~$${Number(comparison.actualCost).toFixed(2)})`
                      : ''}
              </span>
              <button
                  type="button"
                  className="sv-save-confirm-btn confirm sv-anuga-divergence-confirm-run"
                  onClick={this.handleDivergenceConfirm}
              >
                  <Message msgId="hydrata.anuga.divergenceConfirmRun" />
              </button>
              <button
                  type="button"
                  className="sv-save-confirm-btn cancel sv-anuga-divergence-confirm-cancel"
                  onClick={this.handleDivergenceCancel}
              >
                  <Message msgId="hydrata.anuga.cancel" />
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
      const hasCompleteResults = !!selectedScenario?.latest_complete_run;
      // TASK-2243 (epic 2237 W2.1) — the freshness banner (a newer run is
      // building/failed while the results shown are from the last complete
      // run) is RELOCATED into the notices panel (scenarioPane.js's
      // ScenarioNoticesPanel, via getResultsFreshnessStatus) — both variants
      // preserved there under their existing msgIds. `selectedScenario` is
      // already threaded into ScenarioPane as `scenario` (renderPane below),
      // which carries the same latest_run/latest_complete_run fields, so no
      // new prop-threading was needed; nothing left to derive/render here.
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
                  {this.renderRunActions(hasCompleteResults)}
                  <div className={'sv-rail-pane-shell'}>
                      {this.renderRail()}
                      {this.renderPane()}
                  </div>
                  {this.renderConfirmDialog()}
                  {this.renderBuildValidationDialog()}
                  {this.renderMeshRegionWarningDialog()}
                  {this.renderRainfallWarningDialog()}
                  {this.renderDivergenceConfirmDialog()}
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
        // TASK-2194 (epic 2190 W2) — staff gate (FE precedent:
        // runsDashboardUtils.isStaffUser) + compute-target site config
        // hydrated by loadAnugaComputeConfigEpic onto state.anuga.ui.
        isStaff: isStaffUser(state?.security?.user),
        availableComputeTargets: state?.anuga?.ui?.availableComputeTargets,
        defaultComputeTarget: state?.anuga?.ui?.defaultComputeTarget,
        // TASK-2194 (review fix) — per-scenario session choices (ui slot, so
        // scenario saves/refreshes can never wipe them).
        sessionComputeTargets: state?.anuga?.ui?.sessionComputeTargets,
        // TASK-2211 (W3.2, epic 2204, AC#4) — same config-hydration slot;
        // null when not yet loaded, in which case maybeRunAfterBuild's
        // getMeshDivergence call falls back to the FE default (2x).
        meshDivergenceThreshold: state?.anuga?.ui?.meshDivergenceThreshold,
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
    runAnugaScenario: (scenario, computeTarget) => dispatch(runAnugaScenario(scenario, computeTarget)),
    setSessionComputeTarget: (scenarioId, target) => dispatch(setSessionComputeTarget(scenarioId, target)),
    openTaskMonitorForRun: () => dispatch(toggleTaskMonitorPanel(true)),
    // TASK-2205 (W0.2 epic 2204) — the gap-suggestion link's click handler.
    onOpenMergeTerrainsPanel: () => dispatch(setTerrainWorkbenchVisible(true)),
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

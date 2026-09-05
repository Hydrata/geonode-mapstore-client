const {SHOW_NOTIFICATION} = require("../../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');

const CREATE_ANUGA_TERRAIN_FROM_LAYER = 'CREATE_ANUGA_TERRAIN_FROM_LAYER';
const ADD_ANUGA_SCENARIO = 'ADD_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO = 'RUN_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO_SUCCESS = 'RUN_ANUGA_SCENARIO_SUCCESS';
const RUN_NETWORK = 'RUN_NETWORK';
const RUN_NETWORK_SUCCESS = 'RUN_NETWORK_SUCCESS';
const SAVE_ANUGA_SCENARIO = 'SAVE_ANUGA_SCENARIO';
const SAVE_ANUGA_SCENARIO_SUCCESS = 'SAVE_ANUGA_SCENARIO_SUCCESS';
const SAVE_ANUGA_SCENARIO_ERROR = 'SAVE_ANUGA_SCENARIO_ERROR';
const DELETE_ANUGA_SCENARIO = 'DELETE_ANUGA_SCENARIO';
const DELETE_ANUGA_SCENARIO_SUCCESS = 'DELETE_ANUGA_SCENARIO_SUCCESS';
const DUPLICATE_ANUGA_SCENARIO = 'DUPLICATE_ANUGA_SCENARIO';
const DUPLICATE_ANUGA_SCENARIO_SUCCESS = 'DUPLICATE_ANUGA_SCENARIO_SUCCESS';
const ARCHIVE_ANUGA_SCENARIO = 'ARCHIVE_ANUGA_SCENARIO';
const ARCHIVE_ANUGA_SCENARIO_SUCCESS = 'ARCHIVE_ANUGA_SCENARIO_SUCCESS';
// TASK-2264 — ARCHIVE_ANUGA_SCENARIO_ERROR REVIVED (Wave 3C C5 removed it as
// dead — it had no reducer). It now DOES have one (scenariosReducer stashes the
// 412 detail as `archiveError` on the scenario, mirroring TASK-2079's
// buildConflict), so the message is anchored in the pane's consolidated notices
// surface where the action happened — not only the easy-to-miss top-centre
// toast (which W4.2 found the user never saw). The toast still fires too
// (defence in depth); this action carries the same detail into Redux.
const ARCHIVE_ANUGA_SCENARIO_ERROR = 'ARCHIVE_ANUGA_SCENARIO_ERROR';
const UNARCHIVE_ANUGA_SCENARIO = 'UNARCHIVE_ANUGA_SCENARIO';
const UNARCHIVE_ANUGA_SCENARIO_SUCCESS = 'UNARCHIVE_ANUGA_SCENARIO_SUCCESS';
const SET_ANUGA_SCENARIO_ARCHIVE_FILTER = 'SET_ANUGA_SCENARIO_ARCHIVE_FILTER';
const CANCEL_ANUGA_RUN = 'CANCEL_ANUGA_RUN';
const RETRY_ANUGA_RUN = 'RETRY_ANUGA_RUN';
const UPDATE_ANUGA_SCENARIO = 'UPDATE_ANUGA_SCENARIO';
const UPDATE_NETWORK = 'UPDATE_NETWORK';
const SAVE_NETWORK = 'SAVE_NETWORK';
const SELECT_ANUGA_SCENARIO = 'SELECT_ANUGA_SCENARIO';
// TASK-2953 (epic 2815 W3, Layer 1) — dispatched by scenarioPane.js's three
// discrete-field handleField closures ONLY (never useAutoPopulateDefaults —
// see commitAnugaScenarioField's doc comment below). Consumed by
// commitAnugaScenarioFieldEpic (crudEpics.js): lazy CREATE on the first
// commit for an id-less scenario, PATCH on every commit after.
const COMMIT_ANUGA_SCENARIO_FIELD = 'COMMIT_ANUGA_SCENARIO_FIELD';
// TASK-2890 (epic 2815 W3, Layer 4) — Redux-held mirror of a Build-and-Run
// deferred-run intent, keyed by scenario id, so it survives the Scenarios
// menu unmounting (see runAfterBuildEpic, pollingEpics.js).
const ARM_RUN_AFTER_BUILD = 'ARM_RUN_AFTER_BUILD';
const ADVANCE_RUN_AFTER_BUILD = 'ADVANCE_RUN_AFTER_BUILD';
const CLEAR_RUN_AFTER_BUILD = 'CLEAR_RUN_AFTER_BUILD';

function createAnugaTerrainFromLayer(pk, title) {
    return { type: CREATE_ANUGA_TERRAIN_FROM_LAYER, pk, title };
}

function addAnugaScenario() {
    return { type: ADD_ANUGA_SCENARIO };
}

// TASK-2953 (epic 2815 W3, mechanism 1) — opts.buildAfterSave / opts.runAfterBuild
// let dispatchBuild's save branch (anugaScenarioMenu.js) ask
// saveAnugaScenarioEpic to chain a build (and arm a deferred run) onto the
// SAME create/update round-trip's success, reading the REAL id off the
// create response rather than the click-time scenario.id (which is null for
// a scenario that has never been saved — see crudEpics.js's
// saveAnugaScenarioEpic).
function saveAnugaScenario(scenario, opts = {}) {
    return {
        type: SAVE_ANUGA_SCENARIO,
        scenario,
        buildAfterSave: !!opts.buildAfterSave,
        runAfterBuild: !!opts.runAfterBuild
    };
}

// TASK-2953 AC3 — a save never builds any more (TASK-2820); saying
// "building" here was left over from before that change and is simply
// false. meta.buildAfterSave suppresses the toast entirely — the chained
// build (dispatchBuild / saveAnugaScenarioEpic) owns the user-facing notice
// for that case, so this toast would otherwise show TWICE for one click.
// meta.sentPayload (Layer 2) / meta.tempId (set only on a CREATE response)
// are forwarded verbatim onto the plain action for
// scenariosReducer.js's SAVE_ANUGA_SCENARIO_SUCCESS no-clobber merge.
function saveAnugaScenarioSuccess(scenario, meta = {}) {
    return (dispatch) => {
        if (!meta.buildAfterSave) {
            dispatch({
                type: SHOW_NOTIFICATION,
                title: 'Success',
                autoDismiss: 6,
                position: 'tc',
                message: scenario.name ? `'${scenario.name}' saved` : 'Scenario saved',
                uid: uuidv1(),
                level: 'success'
            });
        }
        dispatch({
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario,
            sentPayload: meta.sentPayload || null,
            tempId: meta.tempId != null ? meta.tempId : null // eslint-disable-line no-eq-null, eqeqeq
        });
    };
}

// TASK-2953 AC4 / TASK-2890 finding 2 — meta.scenarioId lets the dispatcher
// clear any armed run-after-build intent for the scenario whose save just
// failed, so a 4xx PATCH/create can never leave a dangling arm to
// surprise-fire a run on a later, unrelated build.
function saveAnugaScenarioError(error, meta = {}) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Error',
            autoDismiss: 60,
            position: 'tc',
            message: `Error saving scenario: ${JSON.stringify(error?.data)}`,
            uid: uuidv1(),
            level: 'error'
        });
        if (meta.scenarioId != null) { // eslint-disable-line no-eq-null, eqeqeq
            dispatch({ type: CLEAR_RUN_AFTER_BUILD, scenarioId: meta.scenarioId });
        }
        dispatch({ type: SAVE_ANUGA_SCENARIO_ERROR, error });
    };
}

// TASK-2953 (epic 2815 W3, Layer 1) — the three discrete-field handleField
// closures (scenarioPane.js renderInputsPane/renderAdvancedPane/
// renderRunConfigPane) call THIS, never updateAnugaScenario directly.
// useAutoPopulateDefaults (scenarioPane.js) is DELIBERATELY left on
// updateAnugaScenario/UPDATE_ANUGA_SCENARIO (local-only) — amendment A3
// (TASK-2953 comment #2007): that effect runs automatically on mount for
// ANY id-null scenario, with no user action, so routing it through a
// commit/lazy-create dispatcher would fire an eager POST the instant a
// brand-new scenario's panel mounts — landmine #1 through a different door.
// Dispatches the SAME local write (UPDATE_ANUGA_SCENARIO, for instant UI
// feedback) plus COMMIT_ANUGA_SCENARIO_FIELD, which
// commitAnugaScenarioFieldEpic (crudEpics.js) turns into a lazy CREATE (the
// scenario's first-ever commit) or a PATCH (every commit after).
function commitAnugaScenarioField(scenario, kv) {
    return (dispatch) => {
        const merged = { ...scenario, ...kv };
        dispatch({ type: UPDATE_ANUGA_SCENARIO, scenario: merged });
        dispatch({ type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: merged });
    };
}

// TASK-2890 (epic 2815 W3, Layer 4) — arm/advance/clear the Redux mirror of
// a deferred "run when this build reaches built" intent. armRunAfterBuild is
// dispatched both by anugaScenarioMenu.js's armAndDispatchBuildAndRun
// (existing scenario, id known at click time — ALSO keeps its own local
// this.state.runAfterBuild machine, unchanged, so the TASK-2211 divergence
// dialog keeps rendering while the menu stays mounted) and directly from
// saveAnugaScenarioEpic's projection for a scenario that had no id at click
// time (mechanism 2 — nothing else could ever arm that case). See
// runAfterBuildEpic (pollingEpics.js) for the resolver this backstops.
//
// Review fix (adversarial pass, TASK-2953/2890, correctness/blocker finding
// 1) — opts.localOwned marks an arm that a MOUNTED component's own local
// machine is ALSO tracking and will resolve itself (the dispatched==='build'
// path only). Every mechanism-2 arm (a 'save' dispatch — which, post-Layer 1,
// is virtually every click since UPDATE_ANUGA_SCENARIO always sets
// unsaved:true) has NO local counterpart: armAndDispatchBuildAndRun only ever
// sets this.state.runAfterBuild on the 'build' branch, so a save-dispatched
// arm's local machine is a permanent no-op for it. runAfterBuildEpic used to
// treat EVERY arm as component-owned while the menu was mounted and defer to
// it unconditionally — for a save-dispatched arm that meant NEITHER resolver
// ever fired: the component because it was never armed locally, the epic
// because it saw the menu mounted and stood down. localOwned:false (the
// default — crudEpics.js's chainAfterSave never passes opts) tells the epic
// this arm has no live local counterpart, so it must resolve regardless of
// mount state; localOwned:true (set only by armAndDispatchBuildAndRun) keeps
// the original "the mounted component owns it" deferral so the TASK-2211
// divergence dialog can still render for that path.
function armRunAfterBuild(scenarioId, opts = {}) {
    return { type: ARM_RUN_AFTER_BUILD, scenarioId, localOwned: !!opts.localOwned };
}

function advanceRunAfterBuild(scenarioId) {
    return { type: ADVANCE_RUN_AFTER_BUILD, scenarioId };
}

function clearRunAfterBuild(scenarioId) {
    return { type: CLEAR_RUN_AFTER_BUILD, scenarioId };
}

// TASK-2194 (epic 2190 W2, review fix) — `computeTarget` is the flat compute
// target a staff user chose this session, read from the per-scenario ui slot
// (state.anuga.ui.sessionComputeTargets — NOT the scenario object; Scenario
// has NO compute_target column). null = no choice -> startRun OMITS the
// field and the server resolves the site default. The FE never sends the
// legacy compute_backend field any more (ignored server-side since W1).
function runAnugaScenario(scenario, computeTarget = null) {
    return { type: RUN_ANUGA_SCENARIO, scenario, computeTarget };
}

function cancelAnugaRun(runId) {
    return { type: CANCEL_ANUGA_RUN, runId };
}

function retryAnugaRun(runId) {
    return { type: RETRY_ANUGA_RUN, runId };
}

function runAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario running`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: RUN_ANUGA_SCENARIO_SUCCESS, scenario });
    };
}

function runNetwork(network) {
    return { type: RUN_NETWORK, network };
}

function runNetworkSuccess(network) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Network Calculated`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: RUN_NETWORK_SUCCESS, network });
    };
}

function deleteAnugaScenario(scenario) {
    return { type: DELETE_ANUGA_SCENARIO, scenario };
}

function deleteAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario ID: ${scenario.id} deleted`,
            uid: uuidv1(),
            level: 'info'
        });
        dispatch({ type: 'INIT_ANUGA' });
    };
}

// The reducer appends the new scenario to byId / allIds so the row renders
// without a full INIT_ANUGA refetch.
function duplicateAnugaScenario(scenario) {
    return { type: DUPLICATE_ANUGA_SCENARIO, scenario };
}

function duplicateAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario duplicated as "${scenario.name}"`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: DUPLICATE_ANUGA_SCENARIO_SUCCESS, scenario });
    };
}

// The success reducer updates byId[scenario.id] in place rather than
// appending — the row was already in state at the moment of the click.
function archiveAnugaScenario(scenario) {
    return { type: ARCHIVE_ANUGA_SCENARIO, scenario };
}

function archiveAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario "${scenario.name}" archived`,
            uid: uuidv1(),
            level: 'info'
        });
        dispatch({ type: ARCHIVE_ANUGA_SCENARIO_SUCCESS, scenario });
    };
}

// Wave 3C C5: archiveAnugaScenarioError thunk replaced with showArchiveError
// — toast-only, no Redux action dispatch. 412 from the archive endpoint =
// scenario has an active/queued run. The toast surfaces the BE-supplied
// detail string so the user knows to cancel the run first. The prior
// matching error action had no reducer or middleware consumer (see C5
// comment block above) so the dispatch was dead code.
function showArchiveError(errorBody) {
    return (dispatch) => {
        const detail = errorBody?.detail || 'Could not archive scenario.';
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Cannot archive',
            autoDismiss: 12,
            position: 'tc',
            message: detail,
            uid: uuidv1(),
            level: 'warning'
        });
    };
}

// TASK-2264 — carries the 412 detail into Redux so the pane's consolidated
// notices surface (buildScenarioNotices -> archive-error ErrorStrip) can anchor
// it beside the scenario the archive was attempted on. Plain action (reducer
// stashes `archiveError` on byId[scenarioId]); dispatched alongside the toast.
function archiveAnugaScenarioError(scenarioId, errorBody) {
    return {
        type: ARCHIVE_ANUGA_SCENARIO_ERROR,
        scenarioId,
        detail: errorBody?.detail || 'Could not archive scenario.'
    };
}

function unarchiveAnugaScenario(scenario) {
    return { type: UNARCHIVE_ANUGA_SCENARIO, scenario };
}

function unarchiveAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario "${scenario.name}" restored`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: UNARCHIVE_ANUGA_SCENARIO_SUCCESS, scenario });
    };
}

// anugaScenarioMenu's Active/Archived filter chip dispatches this to update
// state.anuga.scenarios.archiveFilter. The polling epic + initial fetch read
// that key and pass it through to anugaApi.getScenariosByArchive.
function setAnugaScenarioArchiveFilter(mode) {
    return { type: SET_ANUGA_SCENARIO_ARCHIVE_FILTER, mode };
}

function updateAnugaScenario(scenario, kv) {
    return {
        type: UPDATE_ANUGA_SCENARIO,
        scenario: { ...scenario, ...kv }
    };
}

function updateNetwork(network, kv) {
    return {
        type: UPDATE_NETWORK,
        network: { ...network, ...kv }
    };
}

function saveNetwork(network) {
    return { type: SAVE_NETWORK, network };
}

const selectAnugaScenario = (scenario) => {
    return { type: SELECT_ANUGA_SCENARIO, scenario };
};

module.exports = {
    CREATE_ANUGA_TERRAIN_FROM_LAYER, createAnugaTerrainFromLayer,
    ADD_ANUGA_SCENARIO, addAnugaScenario,
    SAVE_ANUGA_SCENARIO, saveAnugaScenario,
    SAVE_ANUGA_SCENARIO_SUCCESS, saveAnugaScenarioSuccess,
    SAVE_ANUGA_SCENARIO_ERROR, saveAnugaScenarioError,
    DELETE_ANUGA_SCENARIO, deleteAnugaScenario,
    DELETE_ANUGA_SCENARIO_SUCCESS, deleteAnugaScenarioSuccess,
    DUPLICATE_ANUGA_SCENARIO, duplicateAnugaScenario,
    DUPLICATE_ANUGA_SCENARIO_SUCCESS, duplicateAnugaScenarioSuccess,
    ARCHIVE_ANUGA_SCENARIO, archiveAnugaScenario,
    ARCHIVE_ANUGA_SCENARIO_SUCCESS, archiveAnugaScenarioSuccess,
    // TASK-2264: ARCHIVE_ANUGA_SCENARIO_ERROR revived WITH a reducer (in-pane
    // surface); showArchiveError (toast) stays and fires alongside it.
    ARCHIVE_ANUGA_SCENARIO_ERROR, archiveAnugaScenarioError,
    showArchiveError,
    UNARCHIVE_ANUGA_SCENARIO, unarchiveAnugaScenario,
    UNARCHIVE_ANUGA_SCENARIO_SUCCESS, unarchiveAnugaScenarioSuccess,
    SET_ANUGA_SCENARIO_ARCHIVE_FILTER, setAnugaScenarioArchiveFilter,
    RUN_ANUGA_SCENARIO, runAnugaScenario,
    RUN_ANUGA_SCENARIO_SUCCESS, runAnugaScenarioSuccess,
    CANCEL_ANUGA_RUN, cancelAnugaRun,
    RETRY_ANUGA_RUN, retryAnugaRun,
    RUN_NETWORK, runNetwork,
    RUN_NETWORK_SUCCESS, runNetworkSuccess,
    UPDATE_ANUGA_SCENARIO, updateAnugaScenario,
    UPDATE_NETWORK, updateNetwork,
    SAVE_NETWORK, saveNetwork,
    SELECT_ANUGA_SCENARIO, selectAnugaScenario,
    COMMIT_ANUGA_SCENARIO_FIELD, commitAnugaScenarioField,
    ARM_RUN_AFTER_BUILD, armRunAfterBuild,
    ADVANCE_RUN_AFTER_BUILD, advanceRunAfterBuild,
    CLEAR_RUN_AFTER_BUILD, clearRunAfterBuild
};

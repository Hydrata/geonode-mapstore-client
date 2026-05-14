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

function createAnugaTerrainFromLayer(pk, title) {
    return { type: CREATE_ANUGA_TERRAIN_FROM_LAYER, pk, title };
}

function addAnugaScenario() {
    return { type: ADD_ANUGA_SCENARIO };
}

function saveAnugaScenario(scenario) {
    return { type: SAVE_ANUGA_SCENARIO, scenario };
}

function saveAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario ID: ${scenario.id} building`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: SAVE_ANUGA_SCENARIO_SUCCESS, scenario });
    };
}

function saveAnugaScenarioError(error) {
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
        dispatch({ type: SAVE_ANUGA_SCENARIO_ERROR, error });
    };
}

function runAnugaScenario(scenario, computeBackend = 'local') {
    return { type: RUN_ANUGA_SCENARIO, scenario, computeBackend };
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

// 412 from the archive endpoint = scenario has an active/queued run. Surface
// the BE-supplied detail string in a toast so the user knows they need to
// cancel the run first; the matching error action lets reducers track the
// failure if a future UX needs it.
function archiveAnugaScenarioError(scenario, errorBody) {
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
        dispatch({ type: ARCHIVE_ANUGA_SCENARIO_ERROR, scenario, errorBody });
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
    ARCHIVE_ANUGA_SCENARIO_ERROR, archiveAnugaScenarioError,
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
    SELECT_ANUGA_SCENARIO, selectAnugaScenario
};

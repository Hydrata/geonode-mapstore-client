const {SHOW_NOTIFICATION} = require("../../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');

const CREATE_ANUGA_ELEVATION_FROM_LAYER = 'CREATE_ANUGA_ELEVATION_FROM_LAYER';
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
const CANCEL_ANUGA_RUN = 'CANCEL_ANUGA_RUN';
const UPDATE_ANUGA_SCENARIO = 'UPDATE_ANUGA_SCENARIO';
const UPDATE_NETWORK = 'UPDATE_NETWORK';
const SELECT_ANUGA_SCENARIO = 'SELECT_ANUGA_SCENARIO';

function createAnugaElevationFromLayer(pk, title) {
    return { type: CREATE_ANUGA_ELEVATION_FROM_LAYER, pk, title };
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

function runAnugaScenario(scenario, computeInstanceId) {
    return { type: RUN_ANUGA_SCENARIO, scenario, computeInstanceId };
}

function cancelAnugaRun(scenario, computeInstanceId) {
    return { type: CANCEL_ANUGA_RUN, scenario, computeInstanceId };
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

const selectAnugaScenario = (scenario) => {
    return { type: SELECT_ANUGA_SCENARIO, scenario };
};

module.exports = {
    CREATE_ANUGA_ELEVATION_FROM_LAYER, createAnugaElevationFromLayer,
    ADD_ANUGA_SCENARIO, addAnugaScenario,
    SAVE_ANUGA_SCENARIO, saveAnugaScenario,
    SAVE_ANUGA_SCENARIO_SUCCESS, saveAnugaScenarioSuccess,
    SAVE_ANUGA_SCENARIO_ERROR, saveAnugaScenarioError,
    DELETE_ANUGA_SCENARIO, deleteAnugaScenario,
    DELETE_ANUGA_SCENARIO_SUCCESS, deleteAnugaScenarioSuccess,
    RUN_ANUGA_SCENARIO, runAnugaScenario,
    RUN_ANUGA_SCENARIO_SUCCESS, runAnugaScenarioSuccess,
    CANCEL_ANUGA_RUN, cancelAnugaRun,
    RUN_NETWORK, runNetwork,
    RUN_NETWORK_SUCCESS, runNetworkSuccess,
    UPDATE_ANUGA_SCENARIO, updateAnugaScenario,
    UPDATE_NETWORK, updateNetwork,
    SELECT_ANUGA_SCENARIO, selectAnugaScenario
};

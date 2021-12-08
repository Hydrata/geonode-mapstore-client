const {SHOW_NOTIFICATION} = require("../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');
const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';
const SET_ANUGA_INFLOW_DATA = 'SET_ANUGA_INFLOW_DATA';
const SET_ANUGA_FRICTION_DATA = 'SET_ANUGA_FRICTION_DATA';
const SET_ANUGA_STRUCTURE_DATA = 'SET_ANUGA_STRUCTURE_DATA';
const SET_ANUGA_BOUNDARY_DATA = 'SET_ANUGA_BOUNDARY_DATA';
const SET_ANUGA_ELEVATION_DATA = 'SET_ANUGA_ELEVATION_DATA';
const SET_ANUGA_AVAILABLE_ELEVATION_DATA = 'SET_ANUGA_AVAILABLE_ELEVATION_DATA';
const CREATE_ANUGA_ELEVATION_FROM_LAYER = 'CREATE_ANUGA_ELEVATION_FROM_LAYER';
const CREATE_NEW_BOUNDARY = 'CREATE_NEW_BOUNDARY';
const SET_ADD_ANUGA_ELEVATION_DATA = 'SET_ADD_ANUGA_ELEVATION_DATA';
const RUN_ANUGA_SCENARIO = 'RUN_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO_SUCCESS = 'RUN_ANUGA_SCENARIO_SUCCESS';
const SAVE_ANUGA_SCENARIO = 'SAVE_ANUGA_SCENARIO';
const SAVE_ANUGA_SCENARIO_SUCCESS = 'SAVE_ANUGA_SCENARIO_SUCCESS';
const SHOW_ANUGA_SCENARIO_LOG = 'SHOW_ANUGA_SCENARIO_LOG';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const UPDATE_ANUGA_SCENARIO = 'UPDATE_ANUGA_SCENARIO';
const SELECT_ANUGA_SCENARIO = 'SELECT_ANUGA_SCENARIO';
const ADD_ANUGA_BOUNDARY = 'ADD_ANUGA_BOUNDARY';
const ADD_ANUGA_FRICTION = 'ADD_ANUGA_FRICTION';
const ADD_ANUGA_INFLOW = 'ADD_ANUGA_INFLOW';
const ADD_ANUGA_STRUCTURE = 'ADD_ANUGA_STRUCTURE';


function initAnuga() {
    return {
        type: INIT_ANUGA
    };
}

function setAnugaInputMenu(visible) {
    return {
        type: SET_ANUGA_INPUT_MENU,
        visible
    };
}

function setAnugaScenarioMenu(visible) {
    return {
        type: SET_ANUGA_SCENARIO_MENU,
        visible
    };
}

function stopAnugaScenarioPolling() {
    return {
        type: STOP_ANUGA_SCENARIO_POLLING
    };
}

function setAnugaResultMenu(visible) {
    return {
        type: SET_ANUGA_RESULT_MENU,
        visible
    };
}

function setAnugaProjectData(data) {
    return {
        type: SET_ANUGA_PROJECT_DATA,
        data
    };
}

function setAnugaScenarioData(data) {
    return {
        type: SET_ANUGA_SCENARIO_DATA,
        data
    };
}

function setAnugaInflowData(data) {
    return {
        type: SET_ANUGA_INFLOW_DATA,
        data
    };
}

function setAnugaFrictionData(data) {
    return {
        type: SET_ANUGA_FRICTION_DATA,
        data
    };
}

function setAnugaStructureData(data) {
    return {
        type: SET_ANUGA_STRUCTURE_DATA,
        data
    };
}

function setAnugaBoundaryData(data) {
    return {
        type: SET_ANUGA_BOUNDARY_DATA,
        data
    };
}

function setAnugaElevationData(data) {
    return {
        type: SET_ANUGA_ELEVATION_DATA,
        data
    };
}

function setAnugaAvailableElevationData(data) {
    return {
        type: SET_ANUGA_AVAILABLE_ELEVATION_DATA,
        data
    };
}

function setAddAnugaElevation(visible) {
    return {
        type: SET_ADD_ANUGA_ELEVATION_DATA,
        visible
    };
}

function createAnugaElevationFromLayer(pk, name) {
    return {
        type: CREATE_ANUGA_ELEVATION_FROM_LAYER,
        pk,
        name
    };
}

function createNewBoundary(boundaryTitle) {
    return {
        type: CREATE_NEW_BOUNDARY,
        boundaryTitle
    };
}

function saveAnugaScenario(scenario) {
    return {
        type: SAVE_ANUGA_SCENARIO,
        scenario
    };
}

function runAnugaScenario(scenario) {
    return {
        type: RUN_ANUGA_SCENARIO,
        scenario
    };
}

function runAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario ID: ${scenario.id} running`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: RUN_ANUGA_SCENARIO_SUCCESS,
            scenario
        });
    };
}

function saveAnugaScenarioSuccess(scenario) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario ID: ${scenario.id} saved`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario
        });
    };
}

function updateAnugaScenario(scenario, kv) {
    return {
        type: UPDATE_ANUGA_SCENARIO,
        scenario: {
            ...scenario,
            ...kv
        }
    };
}

function showAnugaScenarioLog(scenario) {
    return {
        type: SHOW_ANUGA_SCENARIO_LOG,
        scenario
    };
}

function addAnugaBoundary() {
    return {
        type: ADD_ANUGA_BOUNDARY
    };
}

function addAnugaFriction() {
    return {
        type: ADD_ANUGA_FRICTION
    };
}

function addAnugaInflow() {
    return {
        type: ADD_ANUGA_INFLOW
    };
}

function addAnugaStructure() {
    return {
        type: ADD_ANUGA_STRUCTURE
    };
}

const selectAnugaScenario = (scenario) => {
    return {
        type: SELECT_ANUGA_SCENARIO,
        scenario
    };
};

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_ANUGA_PROJECT_DATA, setAnugaProjectData,
    SET_ANUGA_SCENARIO_DATA, setAnugaScenarioData,
    SET_ANUGA_INFLOW_DATA, setAnugaInflowData,
    SET_ANUGA_FRICTION_DATA, setAnugaFrictionData,
    SET_ANUGA_STRUCTURE_DATA, setAnugaStructureData,
    SET_ANUGA_BOUNDARY_DATA, setAnugaBoundaryData,
    SET_ANUGA_ELEVATION_DATA, setAnugaElevationData,
    SET_ANUGA_AVAILABLE_ELEVATION_DATA, setAnugaAvailableElevationData,
    SET_ADD_ANUGA_ELEVATION_DATA, setAddAnugaElevation,
    CREATE_ANUGA_ELEVATION_FROM_LAYER, createAnugaElevationFromLayer,
    CREATE_NEW_BOUNDARY, createNewBoundary,
    SAVE_ANUGA_SCENARIO, saveAnugaScenario,
    SAVE_ANUGA_SCENARIO_SUCCESS, saveAnugaScenarioSuccess,
    RUN_ANUGA_SCENARIO, runAnugaScenario,
    RUN_ANUGA_SCENARIO_SUCCESS, runAnugaScenarioSuccess,
    UPDATE_ANUGA_SCENARIO, updateAnugaScenario,
    SELECT_ANUGA_SCENARIO, selectAnugaScenario,
    SHOW_ANUGA_SCENARIO_LOG, showAnugaScenarioLog,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    ADD_ANUGA_BOUNDARY, addAnugaBoundary,
    ADD_ANUGA_FRICTION, addAnugaFriction,
    ADD_ANUGA_INFLOW, addAnugaInflow,
    ADD_ANUGA_STRUCTURE, addAnugaStructure
};

const {SHOW_NOTIFICATION} = require("../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');
const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';
const SET_ANUGA_BOUNDARY_DATA = 'SET_ANUGA_BOUNDARY_DATA';
const SET_ANUGA_FRICTION_DATA = 'SET_ANUGA_FRICTION_DATA';
const SET_ANUGA_INFLOW_DATA = 'SET_ANUGA_INFLOW_DATA';
const SET_ANUGA_STRUCTURE_DATA = 'SET_ANUGA_STRUCTURE_DATA';
const SET_ANUGA_MESH_REGION_DATA = 'SET_ANUGA_MESH_REGION_DATA';
const CREATE_ANUGA_BOUNDARY = 'CREATE_ANUGA_BOUNDARY';
const CREATE_ANUGA_FRICTION = 'CREATE_ANUGA_FRICTION';
const CREATE_ANUGA_INFLOW = 'CREATE_ANUGA_INFLOW';
const CREATE_ANUGA_STRUCTURE = 'CREATE_ANUGA_STRUCTURE';
const CREATE_ANUGA_MESH_REGION = 'CREATE_ANUGA_MESH_REGION';
const SET_ANUGA_ELEVATION_DATA = 'SET_ANUGA_ELEVATION_DATA';
const CREATE_ANUGA_ELEVATION_FROM_LAYER = 'CREATE_ANUGA_ELEVATION_FROM_LAYER';
const SET_ADD_ANUGA_ELEVATION_DATA = 'SET_ADD_ANUGA_ELEVATION_DATA';
const ADD_ANUGA_SCENARIO = 'ADD_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO = 'RUN_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO_SUCCESS = 'RUN_ANUGA_SCENARIO_SUCCESS';
const SAVE_ANUGA_SCENARIO = 'SAVE_ANUGA_SCENARIO';
const SAVE_ANUGA_SCENARIO_SUCCESS = 'SAVE_ANUGA_SCENARIO_SUCCESS';
const DELETE_ANUGA_SCENARIO = 'DELETE_ANUGA_SCENARIO';
const DELETE_ANUGA_SCENARIO_SUCCESS = 'DELETE_ANUGA_SCENARIO_SUCCESS';
const SHOW_ANUGA_SCENARIO_LOG = 'SHOW_ANUGA_SCENARIO_LOG';
const START_ANUGA_SCENARIO_POLLING = 'START_ANUGA_SCENARIO_POLLING';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const START_ANUGA_ELEVATION_POLLING = 'START_ANUGA_ELEVATION_POLLING';
const STOP_ANUGA_ELEVATION_POLLING = 'STOP_ANUGA_ELEVATION_POLLING';
const SET_ANUGA_POLLING_DATA = 'SET_ANUGA_POLLING_DATA';
const UPDATE_ANUGA_SCENARIO = 'UPDATE_ANUGA_SCENARIO';
const SELECT_ANUGA_SCENARIO = 'SELECT_ANUGA_SCENARIO';
const SET_CREATING_ANUGA_LAYER = 'SET_CREATING_ANUGA_LAYER';
// const BUILD_ANUGA_SCENARIO = 'BUILD_ANUGA_SCENARIO';
// const BUILD_ANUGA_SCENARIO_SUCCESS = 'BUILD_ANUGA_SCENARIO_SUCCESS';
const SET_ANUGA_SCENARIO_IS_LOADED = 'SET_ANUGA_SCENARIO_IS_LOADED';


function initAnuga() {
    return {
        type: INIT_ANUGA
    };
}

function setCreatingAnugaLayer(isCreatingAnugaLayer) {
    return {
        type: SET_CREATING_ANUGA_LAYER,
        isCreatingAnugaLayer
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

function startAnugaScenarioPolling() {
    return {
        type: START_ANUGA_SCENARIO_POLLING
    };
}

function stopAnugaScenarioPolling() {
    return {
        type: STOP_ANUGA_SCENARIO_POLLING
    };
}

function startAnugaElevationPolling() {
    return {
        type: START_ANUGA_ELEVATION_POLLING
    };
}

function stopAnugaElevationPolling() {
    return {
        type: STOP_ANUGA_ELEVATION_POLLING
    };
}

function setAnugaPollingData(scenarios) {
    return {
        type: SET_ANUGA_POLLING_DATA,
        scenarios
    };
}

function deleteAnugaScenario(scenario) {
    return {
        type: DELETE_ANUGA_SCENARIO,
        scenario
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

function setAnugaScenarioData(scenarios) {
    return {
        type: SET_ANUGA_SCENARIO_DATA,
        scenarios
    };
}

function setAnugaScenarioResultsLoaded(scenarioId, isLoaded) {
    return {
        type: SET_ANUGA_SCENARIO_IS_LOADED,
        scenarioId,
        isLoaded
    };
}

function setAnugaInflowData(data) {
    return {
        type: SET_ANUGA_INFLOW_DATA,
        data
    };
}

function setAnugaMeshRegionData(data) {
    return {
        type: SET_ANUGA_MESH_REGION_DATA,
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

function createAnugaBoundary(boundaryTitle) {
    return {
        type: CREATE_ANUGA_BOUNDARY,
        boundaryTitle
    };
}

function createAnugaFriction(frictionTitle) {
    return {
        type: CREATE_ANUGA_FRICTION,
        frictionTitle
    };
}

function createAnugaInflow(inflowTitle) {
    return {
        type: CREATE_ANUGA_INFLOW,
        inflowTitle
    };
}

function createAnugaStructure(structureTitle) {
    return {
        type: CREATE_ANUGA_STRUCTURE,
        structureTitle
    };
}

function createAnugaMeshRegion(meshRegionTitle) {
    return {
        type: CREATE_ANUGA_MESH_REGION,
        meshRegionTitle
    };
}

function setAnugaElevationData(data) {
    return {
        type: SET_ANUGA_ELEVATION_DATA,
        data
    };
}

function setAddAnugaElevation(visible) {
    return {
        type: SET_ADD_ANUGA_ELEVATION_DATA,
        visible
    };
}

function createAnugaElevationFromLayer(pk, title) {
    return {
        type: CREATE_ANUGA_ELEVATION_FROM_LAYER,
        pk,
        title
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
//
// function buildAnugaScenarioSuccess(scenario) {
//     return (dispatch) => {
//         dispatch({
//             type: SHOW_NOTIFICATION,
//             title: 'Success',
//             autoDismiss: 6,
//             position: 'tc',
//             message: `Scenario ID: ${scenario.id} built`,
//             uid: uuidv1(),
//             level: 'success'
//         });
//         dispatch({
//             type: BUILD_ANUGA_SCENARIO_SUCCESS,
//             scenario
//         });
//     };
// }

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
        dispatch({
            type: INIT_ANUGA
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

function showAnugaScenarioLog(scenarioId) {
    return {
        type: SHOW_ANUGA_SCENARIO_LOG,
        scenarioId
    };
}

// function buildAnugaScenario(scenario) {
//     return {
//         type: BUILD_ANUGA_SCENARIO,
//         scenario
//     };
// }

function addAnugaScenario() {
    return {
        type: ADD_ANUGA_SCENARIO
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
    SET_ANUGA_ELEVATION_DATA, setAnugaElevationData,
    SET_ANUGA_BOUNDARY_DATA, setAnugaBoundaryData,
    SET_ANUGA_FRICTION_DATA, setAnugaFrictionData,
    SET_ANUGA_INFLOW_DATA, setAnugaInflowData,
    SET_ANUGA_STRUCTURE_DATA, setAnugaStructureData,
    SET_ANUGA_MESH_REGION_DATA, setAnugaMeshRegionData,
    CREATE_ANUGA_BOUNDARY, createAnugaBoundary,
    CREATE_ANUGA_FRICTION, createAnugaFriction,
    CREATE_ANUGA_INFLOW, createAnugaInflow,
    CREATE_ANUGA_STRUCTURE, createAnugaStructure,
    CREATE_ANUGA_MESH_REGION, createAnugaMeshRegion,
    SET_ADD_ANUGA_ELEVATION_DATA, setAddAnugaElevation,
    CREATE_ANUGA_ELEVATION_FROM_LAYER, createAnugaElevationFromLayer,
    SAVE_ANUGA_SCENARIO, saveAnugaScenario,
    ADD_ANUGA_SCENARIO, addAnugaScenario,
    SAVE_ANUGA_SCENARIO_SUCCESS, saveAnugaScenarioSuccess,
    DELETE_ANUGA_SCENARIO, deleteAnugaScenario,
    DELETE_ANUGA_SCENARIO_SUCCESS, deleteAnugaScenarioSuccess,
    RUN_ANUGA_SCENARIO, runAnugaScenario,
    RUN_ANUGA_SCENARIO_SUCCESS, runAnugaScenarioSuccess,
    UPDATE_ANUGA_SCENARIO, updateAnugaScenario,
    SELECT_ANUGA_SCENARIO, selectAnugaScenario,
    SHOW_ANUGA_SCENARIO_LOG, showAnugaScenarioLog,
    START_ANUGA_SCENARIO_POLLING, startAnugaScenarioPolling,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    START_ANUGA_ELEVATION_POLLING, startAnugaElevationPolling,
    STOP_ANUGA_ELEVATION_POLLING, stopAnugaElevationPolling,
    SET_ANUGA_POLLING_DATA, setAnugaPollingData,
    SET_CREATING_ANUGA_LAYER, setCreatingAnugaLayer,
    // BUILD_ANUGA_SCENARIO, buildAnugaScenario,
    // BUILD_ANUGA_SCENARIO_SUCCESS, buildAnugaScenarioSuccess,
    SET_ANUGA_SCENARIO_IS_LOADED, setAnugaScenarioResultsLoaded
};

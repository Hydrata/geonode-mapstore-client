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
const ADD_ANUGA_BOUNDARY = 'ADD_ANUGA_BOUNDARY';
const ADD_ANUGA_FRICTION = 'ADD_ANUGA_FRICTION';
const ADD_ANUGA_INFLOW = 'ADD_ANUGA_INFLOW';
const ADD_ANUGA_STRUCTURE = 'ADD_ANUGA_STRUCTURE';
const ADD_ANUGA_MESH_REGION = 'ADD_ANUGA_MESH_REGION';
const SET_ANUGA_ELEVATION_DATA = 'SET_ANUGA_ELEVATION_DATA';
const CREATE_ANUGA_ELEVATION_FROM_LAYER = 'CREATE_ANUGA_ELEVATION_FROM_LAYER';
const SET_ADD_ANUGA_ELEVATION_DATA = 'SET_ADD_ANUGA_ELEVATION_DATA';
const ADD_ANUGA_SCENARIO = 'ADD_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO = 'RUN_ANUGA_SCENARIO';
const RUN_ANUGA_SCENARIO_SUCCESS = 'RUN_ANUGA_SCENARIO_SUCCESS';
const SAVE_ANUGA_SCENARIO = 'SAVE_ANUGA_SCENARIO';
const SAVE_ANUGA_SCENARIO_SUCCESS = 'SAVE_ANUGA_SCENARIO_SUCCESS';
const SAVE_ANUGA_SCENARIO_ERROR = 'SAVE_ANUGA_SCENARIO_ERROR';
const DELETE_ANUGA_SCENARIO = 'DELETE_ANUGA_SCENARIO';
const DELETE_ANUGA_SCENARIO_SUCCESS = 'DELETE_ANUGA_SCENARIO_SUCCESS';
const SHOW_ANUGA_SCENARIO_LOG = 'SHOW_ANUGA_SCENARIO_LOG';
const SHOW_ANUGA_RUN_MENU = 'SHOW_ANUGA_RUN_MENU';
const START_ANUGA_SCENARIO_POLLING = 'START_ANUGA_SCENARIO_POLLING';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const START_ANUGA_ELEVATION_POLLING = 'START_ANUGA_ELEVATION_POLLING';
const STOP_ANUGA_ELEVATION_POLLING = 'STOP_ANUGA_ELEVATION_POLLING';
const SET_ANUGA_POLLING_DATA = 'SET_ANUGA_POLLING_DATA';
const UPDATE_ANUGA_SCENARIO = 'UPDATE_ANUGA_SCENARIO';
const SELECT_ANUGA_SCENARIO = 'SELECT_ANUGA_SCENARIO';
const SET_CREATING_ANUGA_LAYER = 'SET_CREATING_ANUGA_LAYER';
const SET_ANUGA_SCENARIO_IS_LOADED = 'SET_ANUGA_SCENARIO_IS_LOADED';
const CANCEL_ANUGA_RUN = 'CANCEL_ANUGA_RUN';
const UPDATE_COMPUTE_INSTANCE = 'UPDATE_COMPUTE_INSTANCE';
const UPDATE_COMPUTE_INSTANCE_SUCCESS = 'UPDATE_COMPUTE_INSTANCE_SUCCESS';


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

function addAnugaMeshRegion() {
    return {
        type: ADD_ANUGA_MESH_REGION
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
        dispatch({
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario
        });
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
        dispatch({
            type: SAVE_ANUGA_SCENARIO_ERROR,
            error
        });
    };
}

function runAnugaScenario(scenario, computeInstanceId) {
    return {
        type: RUN_ANUGA_SCENARIO,
        scenario,
        computeInstanceId
    };
}


function cancelAnugaRun(scenario, computeInstanceId) {
    return {
        type: CANCEL_ANUGA_RUN,
        scenario,
        computeInstanceId
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

function showAnugaRunMenu(visible) {
    return {
        type: SHOW_ANUGA_RUN_MENU,
        visible
    };
}

function addAnugaScenario() {
    return {
        type: ADD_ANUGA_SCENARIO
    };
}

function updateComputeInstance() {
    return {
        type: UPDATE_COMPUTE_INSTANCE
    };
}

function updateComputeInstanceSuccess(data) {
    return {
        type: UPDATE_COMPUTE_INSTANCE_SUCCESS,
        data
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
    ADD_ANUGA_BOUNDARY, addAnugaBoundary,
    ADD_ANUGA_FRICTION, addAnugaFriction,
    ADD_ANUGA_INFLOW, addAnugaInflow,
    ADD_ANUGA_STRUCTURE, addAnugaStructure,
    ADD_ANUGA_MESH_REGION, addAnugaMeshRegion,
    SET_ADD_ANUGA_ELEVATION_DATA, setAddAnugaElevation,
    CREATE_ANUGA_ELEVATION_FROM_LAYER, createAnugaElevationFromLayer,
    SAVE_ANUGA_SCENARIO, saveAnugaScenario,
    ADD_ANUGA_SCENARIO, addAnugaScenario,
    SAVE_ANUGA_SCENARIO_SUCCESS, saveAnugaScenarioSuccess,
    SAVE_ANUGA_SCENARIO_ERROR, saveAnugaScenarioError,
    DELETE_ANUGA_SCENARIO, deleteAnugaScenario,
    DELETE_ANUGA_SCENARIO_SUCCESS, deleteAnugaScenarioSuccess,
    RUN_ANUGA_SCENARIO, runAnugaScenario,
    RUN_ANUGA_SCENARIO_SUCCESS, runAnugaScenarioSuccess,
    UPDATE_ANUGA_SCENARIO, updateAnugaScenario,
    SELECT_ANUGA_SCENARIO, selectAnugaScenario,
    SHOW_ANUGA_SCENARIO_LOG, showAnugaScenarioLog,
    SHOW_ANUGA_RUN_MENU, showAnugaRunMenu,
    START_ANUGA_SCENARIO_POLLING, startAnugaScenarioPolling,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    START_ANUGA_ELEVATION_POLLING, startAnugaElevationPolling,
    STOP_ANUGA_ELEVATION_POLLING, stopAnugaElevationPolling,
    SET_ANUGA_POLLING_DATA, setAnugaPollingData,
    SET_CREATING_ANUGA_LAYER, setCreatingAnugaLayer,
    SET_ANUGA_SCENARIO_IS_LOADED, setAnugaScenarioResultsLoaded,
    CANCEL_ANUGA_RUN, cancelAnugaRun,
    UPDATE_COMPUTE_INSTANCE, updateComputeInstance,
    UPDATE_COMPUTE_INSTANCE_SUCCESS, updateComputeInstanceSuccess
};

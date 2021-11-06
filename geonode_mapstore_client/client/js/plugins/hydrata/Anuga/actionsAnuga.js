const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';
const SET_ANUGA_INFLOW_DATA = 'SET_ANUGA_INFLOW_DATA';
const SET_ANUGA_FRICTION_DATA = 'SET_ANUGA_FRICTION_DATA';
const SET_ANUGA_STAGE_DATA = 'SET_ANUGA_STAGE_DATA';
const SET_ANUGA_BOUNDARY_DATA = 'SET_ANUGA_BOUNDARY_DATA';
const SET_ANUGA_ELEVATION_DATA = 'SET_ANUGA_ELEVATION_DATA';
const ADD_ANUGA_ELEVATION = 'ADD_ANUGA_ELEVATION';
const ADD_ANUGA_BOUNDARY = 'ADD_ANUGA_BOUNDARY';
const ADD_ANUGA_FRICTION = 'ADD_ANUGA_FRICTION';
const ADD_ANUGA_INFLOW = 'ADD_ANUGA_INFLOW';
const ADD_ANUGA_STAGE = 'ADD_ANUGA_STAGE';


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

function setAnugaStageData(data) {
    return {
        type: SET_ANUGA_STAGE_DATA,
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

function addAnugaElevation() {
    return {
        type: ADD_ANUGA_ELEVATION
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

function addAnugaStage() {
    return {
        type: ADD_ANUGA_STAGE
    };
}

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_ANUGA_PROJECT_DATA, setAnugaProjectData,
    SET_ANUGA_SCENARIO_DATA, setAnugaScenarioData,
    SET_ANUGA_INFLOW_DATA, setAnugaInflowData,
    SET_ANUGA_FRICTION_DATA, setAnugaFrictionData,
    SET_ANUGA_STAGE_DATA, setAnugaStageData,
    SET_ANUGA_BOUNDARY_DATA, setAnugaBoundaryData,
    SET_ANUGA_ELEVATION_DATA, setAnugaElevationData,
    ADD_ANUGA_ELEVATION, addAnugaElevation,
    ADD_ANUGA_BOUNDARY, addAnugaBoundary,
    ADD_ANUGA_FRICTION, addAnugaFriction,
    ADD_ANUGA_INFLOW, addAnugaInflow,
    ADD_ANUGA_STAGE, addAnugaStage,
};

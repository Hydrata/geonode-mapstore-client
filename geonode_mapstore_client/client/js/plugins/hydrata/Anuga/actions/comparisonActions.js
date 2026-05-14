const {SHOW_NOTIFICATION} = require("../../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');

const SET_COMPARISON_DATA = 'SET_COMPARISON_DATA';
const TOGGLE_SCENARIO_SELECTED = 'TOGGLE_SCENARIO_SELECTED';
const COMPARE_SCENARIOS = 'COMPARE_SCENARIOS';
const COMPARE_SCENARIOS_SUCCESS = 'COMPARE_SCENARIOS_SUCCESS';
const UPDATE_COMPUTE_INSTANCE = 'UPDATE_COMPUTE_INSTANCE';
const UPDATE_COMPUTE_INSTANCE_SUCCESS = 'UPDATE_COMPUTE_INSTANCE_SUCCESS';

// -- Resource-type add/create constants ------------------------------------

const CREATE_ANUGA_BOUNDARY = 'CREATE_ANUGA_BOUNDARY';
const CREATE_ANUGA_FRICTION = 'CREATE_ANUGA_FRICTION';
const CREATE_ANUGA_INFLOW = 'CREATE_ANUGA_INFLOW';
const CREATE_ANUGA_STRUCTURE = 'CREATE_ANUGA_STRUCTURE';
const CREATE_ANUGA_MESH_REGION = 'CREATE_ANUGA_MESH_REGION';
const CREATE_NETWORK = 'CREATE_NETWORK';
const CREATE_LUMPED_CATCHMENT = 'CREATE_LUMPED_CATCHMENT';
const CREATE_NODES = 'CREATE_NODES';
const CREATE_LINKS = 'CREATE_LINKS';
const CREATE_FIGURE = 'CREATE_FIGURE';
const ADD_ANUGA_BOUNDARY = 'ADD_ANUGA_BOUNDARY';
const ADD_ANUGA_FRICTION = 'ADD_ANUGA_FRICTION';
const ADD_ANUGA_INFLOW = 'ADD_ANUGA_INFLOW';
const ADD_ANUGA_STRUCTURE = 'ADD_ANUGA_STRUCTURE';
const ADD_ANUGA_FULL_MESH = 'ADD_ANUGA_FULL_MESH';
const ADD_ANUGA_MESH_REGION = 'ADD_ANUGA_MESH_REGION';
const ADD_NETWORK = 'ADD_ANUGA_NETWORK';
const ADD_LUMPED_CATCHMENT = 'ADD_LUMPED_CATCHMENT';
const ADD_NODES = 'ADD_NODES';
const ADD_LINKS = 'ADD_LINKS';

function setComparisonData(data) {
    return { type: SET_COMPARISON_DATA, data };
}

function toggleScenarioSelected(scenario) {
    return { type: TOGGLE_SCENARIO_SELECTED, scenario };
}

const compareScenarios = (scenarios) => {
    return { type: COMPARE_SCENARIOS, scenarios };
};

function compareScenariosSuccess(scenarios) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Scenario comparison started`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: COMPARE_SCENARIOS_SUCCESS, scenarios });
    };
}

function updateComputeInstance() {
    return { type: UPDATE_COMPUTE_INSTANCE };
}

function updateComputeInstanceSuccess(data) {
    return { type: UPDATE_COMPUTE_INSTANCE_SUCCESS, data };
}

// -- Resource create/add action creators -----------------------------------

function createAnugaBoundary(boundaryTitle) {
    return { type: CREATE_ANUGA_BOUNDARY, boundaryTitle };
}

function createAnugaFriction(frictionTitle) {
    return { type: CREATE_ANUGA_FRICTION, frictionTitle };
}

function createAnugaInflow(inflowTitle) {
    return { type: CREATE_ANUGA_INFLOW, inflowTitle };
}

function createAnugaStructure(structureTitle) {
    return { type: CREATE_ANUGA_STRUCTURE, structureTitle };
}

function createAnugaMeshRegion(meshRegionTitle) {
    return { type: CREATE_ANUGA_MESH_REGION, meshRegionTitle };
}

function createNetwork(networkTitle) {
    return { type: CREATE_NETWORK, networkTitle };
}

function createCatchment(catchmentTitle) {
    return { type: CREATE_LUMPED_CATCHMENT, catchmentTitle };
}

function createNodes(nodesTitle) {
    return { type: CREATE_NODES, nodesTitle };
}

function createLinks(linksTitle) {
    return { type: CREATE_LINKS, linksTitle };
}

function createFigure(figureTitle, publicationId) {
    return { type: CREATE_FIGURE, figureTitle, publicationId };
}

function addAnugaBoundary() {
    return { type: ADD_ANUGA_BOUNDARY };
}

function addAnugaFriction() {
    return { type: ADD_ANUGA_FRICTION };
}

function addAnugaInflow() {
    return { type: ADD_ANUGA_INFLOW };
}

function addAnugaStructure() {
    return { type: ADD_ANUGA_STRUCTURE };
}

function addAnugaFullMesh() {
    return { type: ADD_ANUGA_FULL_MESH };
}

function addAnugaMeshRegion() {
    return { type: ADD_ANUGA_MESH_REGION };
}

function addNetwork() {
    return { type: ADD_NETWORK };
}

function addCatchment() {
    return { type: ADD_LUMPED_CATCHMENT };
}

function addNodes() {
    return { type: ADD_NODES };
}

function addLinks() {
    return { type: ADD_LINKS };
}

module.exports = {
    SET_COMPARISON_DATA, setComparisonData,
    TOGGLE_SCENARIO_SELECTED, toggleScenarioSelected,
    COMPARE_SCENARIOS, compareScenarios,
    COMPARE_SCENARIOS_SUCCESS, compareScenariosSuccess,
    UPDATE_COMPUTE_INSTANCE, updateComputeInstance,
    UPDATE_COMPUTE_INSTANCE_SUCCESS, updateComputeInstanceSuccess,
    CREATE_ANUGA_BOUNDARY, createAnugaBoundary,
    CREATE_ANUGA_FRICTION, createAnugaFriction,
    CREATE_ANUGA_INFLOW, createAnugaInflow,
    CREATE_ANUGA_STRUCTURE, createAnugaStructure,
    CREATE_ANUGA_MESH_REGION, createAnugaMeshRegion,
    CREATE_NETWORK, createNetwork,
    CREATE_LUMPED_CATCHMENT, createCatchment,
    CREATE_NODES, createNodes,
    CREATE_LINKS, createLinks,
    CREATE_FIGURE, createFigure,
    ADD_ANUGA_BOUNDARY, addAnugaBoundary,
    ADD_ANUGA_FRICTION, addAnugaFriction,
    ADD_ANUGA_INFLOW, addAnugaInflow,
    ADD_ANUGA_STRUCTURE, addAnugaStructure,
    ADD_ANUGA_FULL_MESH, addAnugaFullMesh,
    ADD_ANUGA_MESH_REGION, addAnugaMeshRegion,
    ADD_NETWORK, addNetwork,
    ADD_LUMPED_CATCHMENT, addCatchment,
    ADD_NODES, addNodes,
    ADD_LINKS, addLinks
};

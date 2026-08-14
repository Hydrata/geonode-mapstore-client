const {SHOW_NOTIFICATION} = require("../../../../../MapStore2/web/client/actions/notifications");
const uuidv1 = require('uuid/v1');

const SET_COMPARISON_DATA = 'SET_COMPARISON_DATA';
const TOGGLE_SCENARIO_SELECTED = 'TOGGLE_SCENARIO_SELECTED';
const COMPARE_SCENARIOS = 'COMPARE_SCENARIOS';
const COMPARE_SCENARIOS_SUCCESS = 'COMPARE_SCENARIOS_SUCCESS';
const UPDATE_COMPUTE_INSTANCE = 'UPDATE_COMPUTE_INSTANCE';
const UPDATE_COMPUTE_INSTANCE_SUCCESS = 'UPDATE_COMPUTE_INSTANCE_SUCCESS';
const BUILD_SCENARIO = 'HYDRATA:ANUGA:BUILD_SCENARIO';
const BUILD_SCENARIO_SUCCESS = 'HYDRATA:ANUGA:BUILD_SCENARIO_SUCCESS';
const BUILD_SCENARIO_ERROR = 'HYDRATA:ANUGA:BUILD_SCENARIO_ERROR';

// -- Resource-type add/create constants ------------------------------------

const CREATE_ANUGA_BOUNDARY = 'CREATE_ANUGA_BOUNDARY';
const CREATE_ANUGA_FRICTION = 'CREATE_ANUGA_FRICTION';
const CREATE_ANUGA_INFLOW = 'CREATE_ANUGA_INFLOW';
// TASK-955 (W2.2 FE) — Rainfall is a polygon-geometry sibling to Inflow.
// Mirrors createAnugaInflow at every step; BE Rainfall ViewSet (TASK-954)
// exposes the same CRUD shape so the create/add/delete plumbing is identical.
const CREATE_ANUGA_RAINFALL = 'CREATE_ANUGA_RAINFALL';
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
// TASK-955 — paired with CREATE_ANUGA_RAINFALL; dispatched by anugaInputMenu
// like ADD_ANUGA_INFLOW. The noOpEpic stubs that formerly consumed these were
// removed in TASK-1586 (no consumer now); layer injection is event-driven via
// taskCompleteLayerEpic (see V2P-79 add-layer notes).
const ADD_ANUGA_RAINFALL = 'ADD_ANUGA_RAINFALL';
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

function buildScenarioExplicit(scenarioId) {
    return { type: BUILD_SCENARIO, scenarioId };
}

function buildScenarioSuccess(scenarioId) {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Build started',
            autoDismiss: 6,
            position: 'tc',
            message: scenarioId ? `Scenario ${scenarioId} building` : 'Scenario building',
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({ type: BUILD_SCENARIO_SUCCESS, scenarioId });
    };
}

function buildScenarioError(scenarioId, error) {
    return (dispatch) => {
        // TASK-2079: a 409 means the BE build-dedup guard found a build
        // ALREADY in flight (or just-dispatched, not yet picked up — see
        // BUILD_DEDUP_BLOCKING_STATUS_VALUES, api_v2.py) for this scenario —
        // it is NOT a failure, so no 'Build failed' toast. The reducer
        // (scenariosReducer.js) picks up `conflict: true` below and stashes
        // {runId, runStatus, detail} on the scenario as `buildConflict`,
        // which scenarioHeaderActions.js renders as benign inline info next
        // to the Build button. The Build-and-Run piggyback
        // (anugaScenarioMenu.js's maybeRunAfterBuild) is UNAFFECTED by this
        // 409 either way — it arms off the synchronous dispatch call, not
        // this epic's response, and rides the live scenario-status poll to
        // observe the EXISTING in-flight build through to 'built'.
        // Shape note: MapStore's axios response interceptor (MapStore2/web/
        // client/libs/ajax.js) rejects with `{...error.response, originalError:
        // error}` — i.e. the response's OWN fields (status, data, …) are
        // spread onto the error directly; `error.response` itself is NOT
        // preserved on that object (only on error.originalError.response, the
        // raw axios error). So `error.status` / `error.data` are the reliable
        // reads here — `error?.response?.status` is always undefined post-
        // interceptor, which is why it's listed first only as a defensive
        // no-op fallback (?? short-circuits past it to error?.status).
        const status = error?.response?.status ?? error?.status;
        if (status === 409) {
            const data = error?.response?.data ?? error?.data ?? {};
            dispatch({
                type: BUILD_SCENARIO_ERROR,
                scenarioId,
                error,
                conflict: true,
                runId: data.run_id,
                runStatus: data.status,
                detail: data.detail
            });
            return;
        }
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Build failed',
            autoDismiss: 12,
            position: 'tc',
            message: `Error starting build: ${JSON.stringify(error?.data ?? error?.message)}`,
            uid: uuidv1(),
            level: 'error'
        });
        dispatch({ type: BUILD_SCENARIO_ERROR, scenarioId, error, conflict: false });
    };
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

// TASK-955 — mirror createAnugaInflow. Consumed by makeCreateEpic which
// dispatches POST /api/v2/anuga/projects/{pid}/rainfalls/ (V2 only, no V1
// holdout — TASK-954 shipped V2 POST for Rainfall, unlike Inflow).
function createAnugaRainfall(rainfallTitle) {
    return { type: CREATE_ANUGA_RAINFALL, rainfallTitle };
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

// TASK-955 — paired with addAnugaInflow; consumed by taskCompleteLayerEpic
// (via modelClassToAddAction map keyed off Process.metadata.model_class).
function addAnugaRainfall() {
    return { type: ADD_ANUGA_RAINFALL };
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
    BUILD_SCENARIO, buildScenarioExplicit,
    BUILD_SCENARIO_SUCCESS, buildScenarioSuccess,
    BUILD_SCENARIO_ERROR, buildScenarioError,
    CREATE_ANUGA_BOUNDARY, createAnugaBoundary,
    CREATE_ANUGA_FRICTION, createAnugaFriction,
    CREATE_ANUGA_INFLOW, createAnugaInflow,
    // TASK-955 (W2.2 FE) — Rainfall sibling to Inflow.
    CREATE_ANUGA_RAINFALL, createAnugaRainfall,
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
    // TASK-955 — paired with CREATE_ANUGA_RAINFALL.
    ADD_ANUGA_RAINFALL, addAnugaRainfall,
    ADD_ANUGA_STRUCTURE, addAnugaStructure,
    ADD_ANUGA_FULL_MESH, addAnugaFullMesh,
    ADD_ANUGA_MESH_REGION, addAnugaMeshRegion,
    ADD_NETWORK, addNetwork,
    ADD_LUMPED_CATCHMENT, addCatchment,
    ADD_NODES, addNodes,
    ADD_LINKS, addLinks
};

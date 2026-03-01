const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';
const SET_ANUGA_BOUNDARY_DATA = 'SET_ANUGA_BOUNDARY_DATA';
const SET_ANUGA_FRICTION_DATA = 'SET_ANUGA_FRICTION_DATA';
const SET_ANUGA_INFLOW_DATA = 'SET_ANUGA_INFLOW_DATA';
const SET_ANUGA_STRUCTURE_DATA = 'SET_ANUGA_STRUCTURE_DATA';
const SET_ANUGA_FULL_MESH_DATA = 'SET_ANUGA_FULL_MESH_DATA';
const SET_ANUGA_MESH_REGION_DATA = 'SET_ANUGA_MESH_REGION_DATA';
const SET_NETWORK_DATA = 'SET_NETWORK_DATA';
const SET_LUMPED_CATCHMENT_DATA = 'SET_LUMPED_CATCHMENT_DATA';
const SET_ANUGA_NODES_DATA = 'SET_ANUGA_NODES_DATA';
const SET_ANUGA_LINKS_DATA = 'SET_ANUGA_LINKS_DATA';
const SET_PUBLICATION_DATA = 'SET_PUBLICATION_DATA';
const SET_ANUGA_ELEVATION_DATA = 'SET_ANUGA_ELEVATION_DATA';
const SET_ADD_ANUGA_ELEVATION_DATA = 'SET_ADD_ANUGA_ELEVATION_DATA';
const SET_ANUGA_POLLING_DATA = 'SET_ANUGA_POLLING_DATA';
const SET_ANUGA_SCENARIO_IS_LOADED = 'SET_ANUGA_SCENARIO_IS_LOADED';
const UPDATE_ANUGA_RESOURCES = 'UPDATE_ANUGA_RESOURCES';
const SET_ANUGA_RESOURCES = 'SET_ANUGA_RESOURCES';

function setAnugaProjectData(data) {
    return { type: SET_ANUGA_PROJECT_DATA, data };
}

function setAnugaScenarioData(scenarios) {
    return { type: SET_ANUGA_SCENARIO_DATA, scenarios };
}

function setAnugaBoundaryData(data) {
    return { type: SET_ANUGA_BOUNDARY_DATA, data };
}

function setAnugaFrictionData(data) {
    return { type: SET_ANUGA_FRICTION_DATA, data };
}

function setAnugaInflowData(data) {
    return { type: SET_ANUGA_INFLOW_DATA, data };
}

function setAnugaStructureData(data) {
    return { type: SET_ANUGA_STRUCTURE_DATA, data };
}

function setAnugaFullMeshData(data) {
    return { type: SET_ANUGA_FULL_MESH_DATA, data };
}

function setAnugaMeshRegionData(data) {
    return { type: SET_ANUGA_MESH_REGION_DATA, data };
}

function setNetworkData(data) {
    return { type: SET_NETWORK_DATA, data };
}

function setCatchmentData(data) {
    return { type: SET_LUMPED_CATCHMENT_DATA, data };
}

function setAnugaNodesData(data) {
    return { type: SET_ANUGA_NODES_DATA, data };
}

function setAnugaLinksData(data) {
    return { type: SET_ANUGA_LINKS_DATA, data };
}

function setPublicationData(data) {
    return { type: SET_PUBLICATION_DATA, data };
}

function setAnugaElevationData(data) {
    return { type: SET_ANUGA_ELEVATION_DATA, data };
}

function setAddAnugaElevation(visible) {
    return { type: SET_ADD_ANUGA_ELEVATION_DATA, visible };
}

function setAnugaPollingData(scenarios) {
    return { type: SET_ANUGA_POLLING_DATA, scenarios };
}

function setAnugaScenarioResultsLoaded(scenarioId, isLoaded) {
    return { type: SET_ANUGA_SCENARIO_IS_LOADED, scenarioId, isLoaded };
}

function updateAnugaResources(action, pageSize = 100) {
    return { type: UPDATE_ANUGA_RESOURCES, action, pageSize };
}

function setAnugaResources(data) {
    return { type: SET_ANUGA_RESOURCES, data };
}

module.exports = {
    SET_ANUGA_PROJECT_DATA, setAnugaProjectData,
    SET_ANUGA_SCENARIO_DATA, setAnugaScenarioData,
    SET_ANUGA_BOUNDARY_DATA, setAnugaBoundaryData,
    SET_ANUGA_FRICTION_DATA, setAnugaFrictionData,
    SET_ANUGA_INFLOW_DATA, setAnugaInflowData,
    SET_ANUGA_STRUCTURE_DATA, setAnugaStructureData,
    SET_ANUGA_FULL_MESH_DATA, setAnugaFullMeshData,
    SET_ANUGA_MESH_REGION_DATA, setAnugaMeshRegionData,
    SET_NETWORK_DATA, setNetworkData,
    SET_LUMPED_CATCHMENT_DATA, setCatchmentData,
    SET_ANUGA_NODES_DATA, setAnugaNodesData,
    SET_ANUGA_LINKS_DATA, setAnugaLinksData,
    SET_PUBLICATION_DATA, setPublicationData,
    SET_ANUGA_ELEVATION_DATA, setAnugaElevationData,
    SET_ADD_ANUGA_ELEVATION_DATA, setAddAnugaElevation,
    SET_ANUGA_POLLING_DATA, setAnugaPollingData,
    SET_ANUGA_SCENARIO_IS_LOADED, setAnugaScenarioResultsLoaded,
    UPDATE_ANUGA_RESOURCES, updateAnugaResources,
    SET_ANUGA_RESOURCES, setAnugaResources
};

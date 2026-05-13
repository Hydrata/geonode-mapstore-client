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
const SET_ANUGA_TERRAIN_DATA = 'SET_ANUGA_TERRAIN_DATA';
const SET_ADD_ANUGA_TERRAIN_DATA = 'SET_ADD_ANUGA_TERRAIN_DATA';
const SET_ANUGA_POLLING_DATA = 'SET_ANUGA_POLLING_DATA';
const SET_ANUGA_SCENARIO_IS_LOADED = 'SET_ANUGA_SCENARIO_IS_LOADED';
const UPDATE_ANUGA_RESOURCES = 'UPDATE_ANUGA_RESOURCES';
const SET_ANUGA_RESOURCES = 'SET_ANUGA_RESOURCES';

// Membership actions
const FETCH_MEMBERSHIPS = 'FETCH_MEMBERSHIPS';
const SET_MEMBERSHIPS = 'SET_MEMBERSHIPS';
const ADD_MEMBERSHIP_REQUEST = 'ADD_MEMBERSHIP_REQUEST';
const UPDATE_MEMBERSHIP_REQUEST = 'UPDATE_MEMBERSHIP_REQUEST';
const DELETE_MEMBERSHIP_REQUEST = 'DELETE_MEMBERSHIP_REQUEST';
const SET_MEMBERSHIPS_LOADING = 'SET_MEMBERSHIPS_LOADING';
const UPDATE_PROJECT_VISIBILITY_REQUEST = 'UPDATE_PROJECT_VISIBILITY_REQUEST';

// V2P-21 — lazy-fetch my_perms on Anuga panel open
// Trigger: FETCH_MY_PERMS dispatched by initAnugaEpic (= AnugaContainer mount = panel open).
// Success: SET_ANUGA_RESOURCE_PERMS feeds state.anuga.resources.<type>[i].perms
//          which V2P-02 helpers (canEditLayer/canDeleteLayer/canDownloadLayer) read.
// Failure: SET_PERMS_LOAD_FAILED toggles a flag; V2P-02 helpers must continue
//          to fall back to project my_role rather than denying everything.
const FETCH_MY_PERMS = 'ANUGA:FETCH_MY_PERMS';
const SET_ANUGA_RESOURCE_PERMS = 'ANUGA:SET_ANUGA_RESOURCE_PERMS';
const SET_PERMS_LOAD_FAILED = 'ANUGA:SET_PERMS_LOAD_FAILED';

// V2P-714 + TASK-723 — cascade-delete dataset rows. 9 types in scope:
// V2P-714 shipped terrain/boundary/friction/inflow; TASK-723 fans the same
// pattern out to structure/mesh_region/catchment/nodes/links (NETWORK
// intentionally excluded — separate lifecycle).
// Each type has 4 actions: start, success (204), blocked (409 with blocking
// scenarios list), error (other failures). Per-type because the reducer
// targets distinct slots (state.anuga.resources.{terrain,boundaries,
// structures,meshRegions,catchments,nodes,links,...}) and SimpleView row
// components key error-rendering off the per-type type-strings.
const DELETE_TERRAIN = 'ANUGA:DELETE_TERRAIN';
const DELETE_TERRAIN_SUCCESS = 'ANUGA:DELETE_TERRAIN_SUCCESS';
const DELETE_TERRAIN_BLOCKED = 'ANUGA:DELETE_TERRAIN_BLOCKED';
const DELETE_TERRAIN_ERROR = 'ANUGA:DELETE_TERRAIN_ERROR';

const DELETE_BOUNDARY = 'ANUGA:DELETE_BOUNDARY';
const DELETE_BOUNDARY_SUCCESS = 'ANUGA:DELETE_BOUNDARY_SUCCESS';
const DELETE_BOUNDARY_BLOCKED = 'ANUGA:DELETE_BOUNDARY_BLOCKED';
const DELETE_BOUNDARY_ERROR = 'ANUGA:DELETE_BOUNDARY_ERROR';

const DELETE_FRICTION = 'ANUGA:DELETE_FRICTION';
const DELETE_FRICTION_SUCCESS = 'ANUGA:DELETE_FRICTION_SUCCESS';
const DELETE_FRICTION_BLOCKED = 'ANUGA:DELETE_FRICTION_BLOCKED';
const DELETE_FRICTION_ERROR = 'ANUGA:DELETE_FRICTION_ERROR';

const DELETE_INFLOW = 'ANUGA:DELETE_INFLOW';
const DELETE_INFLOW_SUCCESS = 'ANUGA:DELETE_INFLOW_SUCCESS';
const DELETE_INFLOW_BLOCKED = 'ANUGA:DELETE_INFLOW_BLOCKED';
const DELETE_INFLOW_ERROR = 'ANUGA:DELETE_INFLOW_ERROR';

// TASK-723 — 5 additional cascade-delete types extending the V2P-714 pattern.
const DELETE_STRUCTURE = 'ANUGA:DELETE_STRUCTURE';
const DELETE_STRUCTURE_SUCCESS = 'ANUGA:DELETE_STRUCTURE_SUCCESS';
const DELETE_STRUCTURE_BLOCKED = 'ANUGA:DELETE_STRUCTURE_BLOCKED';
const DELETE_STRUCTURE_ERROR = 'ANUGA:DELETE_STRUCTURE_ERROR';

const DELETE_MESH_REGION = 'ANUGA:DELETE_MESH_REGION';
const DELETE_MESH_REGION_SUCCESS = 'ANUGA:DELETE_MESH_REGION_SUCCESS';
const DELETE_MESH_REGION_BLOCKED = 'ANUGA:DELETE_MESH_REGION_BLOCKED';
const DELETE_MESH_REGION_ERROR = 'ANUGA:DELETE_MESH_REGION_ERROR';

const DELETE_CATCHMENT = 'ANUGA:DELETE_CATCHMENT';
const DELETE_CATCHMENT_SUCCESS = 'ANUGA:DELETE_CATCHMENT_SUCCESS';
const DELETE_CATCHMENT_BLOCKED = 'ANUGA:DELETE_CATCHMENT_BLOCKED';
const DELETE_CATCHMENT_ERROR = 'ANUGA:DELETE_CATCHMENT_ERROR';

const DELETE_NODES = 'ANUGA:DELETE_NODES';
const DELETE_NODES_SUCCESS = 'ANUGA:DELETE_NODES_SUCCESS';
const DELETE_NODES_BLOCKED = 'ANUGA:DELETE_NODES_BLOCKED';
const DELETE_NODES_ERROR = 'ANUGA:DELETE_NODES_ERROR';

const DELETE_LINKS = 'ANUGA:DELETE_LINKS';
const DELETE_LINKS_SUCCESS = 'ANUGA:DELETE_LINKS_SUCCESS';
const DELETE_LINKS_BLOCKED = 'ANUGA:DELETE_LINKS_BLOCKED';
const DELETE_LINKS_ERROR = 'ANUGA:DELETE_LINKS_ERROR';

// TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain).
// 1 gn_layer + 1 TIF; no UTM/hillshade siblings (simpler than Terrain).
const DELETE_FRICTION_RASTER = 'ANUGA:DELETE_FRICTION_RASTER';
const DELETE_FRICTION_RASTER_SUCCESS = 'ANUGA:DELETE_FRICTION_RASTER_SUCCESS';
const DELETE_FRICTION_RASTER_BLOCKED = 'ANUGA:DELETE_FRICTION_RASTER_BLOCKED';
const DELETE_FRICTION_RASTER_ERROR = 'ANUGA:DELETE_FRICTION_RASTER_ERROR';

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

function setAnugaTerrainData(data) {
    return { type: SET_ANUGA_TERRAIN_DATA, data };
}

function setAddAnugaTerrainData(visible) {
    return { type: SET_ADD_ANUGA_TERRAIN_DATA, visible };
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

// Membership action creators
function fetchMemberships() {
    return { type: FETCH_MEMBERSHIPS };
}

function setMemberships(data) {
    return { type: SET_MEMBERSHIPS, data };
}

function addMembershipRequest(userId, role) {
    return { type: ADD_MEMBERSHIP_REQUEST, userId, role };
}

function updateMembershipRequest(membershipId, role) {
    return { type: UPDATE_MEMBERSHIP_REQUEST, membershipId, role };
}

function deleteMembershipRequest(membershipId) {
    return { type: DELETE_MEMBERSHIP_REQUEST, membershipId };
}

function setMembershipsLoading(loading) {
    return { type: SET_MEMBERSHIPS_LOADING, loading };
}

function updateProjectVisibilityRequest(visibility) {
    return { type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility };
}

// V2P-21 action creators
function fetchMyPerms(projectId) {
    return { type: FETCH_MY_PERMS, projectId };
}

function setAnugaResourcePerms(payload) {
    // payload shape from /api/v2/anuga/projects/<pid>/my-perms/:
    //   { my_role, visibility, scenarios: {<id>: [perms]}, terrain: {...}, ... }
    return { type: SET_ANUGA_RESOURCE_PERMS, payload };
}

function setPermsLoadFailed(failed) {
    return { type: SET_PERMS_LOAD_FAILED, failed };
}

// V2P-714 action creators. `id` is the AnugaModel pk (Terrain.id, etc.);
// `layerIds` is an array of MapStore layer ids — Terrain has 2 siblings
// (utm + hillshade), Boundary/Friction/Inflow have 1.
const _toLayerIds = (v) => {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v === null || v === undefined || v === '') return [];
    return [v];
};
function deleteTerrain(projectId, id, layerIds) {
    return { type: DELETE_TERRAIN, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteTerrainSuccess(id, layerIds) {
    return { type: DELETE_TERRAIN_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteTerrainBlocked(id, blocking, message) {
    return { type: DELETE_TERRAIN_BLOCKED, id, blocking, message };
}
function deleteTerrainError(id, error) {
    return { type: DELETE_TERRAIN_ERROR, id, error };
}

function deleteBoundary(projectId, id, layerIds) {
    return { type: DELETE_BOUNDARY, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteBoundarySuccess(id, layerIds) {
    return { type: DELETE_BOUNDARY_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteBoundaryBlocked(id, blocking, message) {
    return { type: DELETE_BOUNDARY_BLOCKED, id, blocking, message };
}
function deleteBoundaryError(id, error) {
    return { type: DELETE_BOUNDARY_ERROR, id, error };
}

function deleteFriction(projectId, id, layerIds) {
    return { type: DELETE_FRICTION, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteFrictionSuccess(id, layerIds) {
    return { type: DELETE_FRICTION_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteFrictionBlocked(id, blocking, message) {
    return { type: DELETE_FRICTION_BLOCKED, id, blocking, message };
}
function deleteFrictionError(id, error) {
    return { type: DELETE_FRICTION_ERROR, id, error };
}

function deleteInflow(projectId, id, layerIds) {
    return { type: DELETE_INFLOW, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteInflowSuccess(id, layerIds) {
    return { type: DELETE_INFLOW_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteInflowBlocked(id, blocking, message) {
    return { type: DELETE_INFLOW_BLOCKED, id, blocking, message };
}
function deleteInflowError(id, error) {
    return { type: DELETE_INFLOW_ERROR, id, error };
}

// TASK-723 action creators — mirror deleteBoundary's shape exactly. `id` is
// the AnugaModel pk (Structure.id / MeshRegion.id / etc.); `layerIds` is an
// array of MapStore layer ids (typically 1 each, but array signature kept
// uniform with V2P-714 in case future types stamp siblings like terrain does).
function deleteStructure(projectId, id, layerIds) {
    return { type: DELETE_STRUCTURE, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteStructureSuccess(id, layerIds) {
    return { type: DELETE_STRUCTURE_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteStructureBlocked(id, blocking, message) {
    return { type: DELETE_STRUCTURE_BLOCKED, id, blocking, message };
}
function deleteStructureError(id, error) {
    return { type: DELETE_STRUCTURE_ERROR, id, error };
}

function deleteMeshRegion(projectId, id, layerIds) {
    return { type: DELETE_MESH_REGION, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteMeshRegionSuccess(id, layerIds) {
    return { type: DELETE_MESH_REGION_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteMeshRegionBlocked(id, blocking, message) {
    return { type: DELETE_MESH_REGION_BLOCKED, id, blocking, message };
}
function deleteMeshRegionError(id, error) {
    return { type: DELETE_MESH_REGION_ERROR, id, error };
}

function deleteCatchment(projectId, id, layerIds) {
    return { type: DELETE_CATCHMENT, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteCatchmentSuccess(id, layerIds) {
    return { type: DELETE_CATCHMENT_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteCatchmentBlocked(id, blocking, message) {
    return { type: DELETE_CATCHMENT_BLOCKED, id, blocking, message };
}
function deleteCatchmentError(id, error) {
    return { type: DELETE_CATCHMENT_ERROR, id, error };
}

function deleteNodes(projectId, id, layerIds) {
    return { type: DELETE_NODES, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteNodesSuccess(id, layerIds) {
    return { type: DELETE_NODES_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteNodesBlocked(id, blocking, message) {
    return { type: DELETE_NODES_BLOCKED, id, blocking, message };
}
function deleteNodesError(id, error) {
    return { type: DELETE_NODES_ERROR, id, error };
}

function deleteLinks(projectId, id, layerIds) {
    return { type: DELETE_LINKS, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteLinksSuccess(id, layerIds) {
    return { type: DELETE_LINKS_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteLinksBlocked(id, blocking, message) {
    return { type: DELETE_LINKS_BLOCKED, id, blocking, message };
}
function deleteLinksError(id, error) {
    return { type: DELETE_LINKS_ERROR, id, error };
}

// TASK-829 (W4.2b) — FrictionRaster cascade-delete creators. Mirror
// deleteFriction's signature; layerIds is an array even though a typical
// FrictionRaster has only one gn_layer (kept uniform with V2P-714).
function deleteFrictionRaster(projectId, id, layerIds) {
    return { type: DELETE_FRICTION_RASTER, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteFrictionRasterSuccess(id, layerIds) {
    return { type: DELETE_FRICTION_RASTER_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteFrictionRasterBlocked(id, blocking, message) {
    return { type: DELETE_FRICTION_RASTER_BLOCKED, id, blocking, message };
}
function deleteFrictionRasterError(id, error) {
    return { type: DELETE_FRICTION_RASTER_ERROR, id, error };
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
    SET_ANUGA_TERRAIN_DATA, setAnugaTerrainData,
    SET_ADD_ANUGA_TERRAIN_DATA, setAddAnugaTerrainData,
    SET_ANUGA_POLLING_DATA, setAnugaPollingData,
    SET_ANUGA_SCENARIO_IS_LOADED, setAnugaScenarioResultsLoaded,
    UPDATE_ANUGA_RESOURCES, updateAnugaResources,
    SET_ANUGA_RESOURCES, setAnugaResources,
    FETCH_MEMBERSHIPS, fetchMemberships,
    SET_MEMBERSHIPS, setMemberships,
    ADD_MEMBERSHIP_REQUEST, addMembershipRequest,
    UPDATE_MEMBERSHIP_REQUEST, updateMembershipRequest,
    DELETE_MEMBERSHIP_REQUEST, deleteMembershipRequest,
    SET_MEMBERSHIPS_LOADING, setMembershipsLoading,
    UPDATE_PROJECT_VISIBILITY_REQUEST, updateProjectVisibilityRequest,
    FETCH_MY_PERMS, fetchMyPerms,
    SET_ANUGA_RESOURCE_PERMS, setAnugaResourcePerms,
    SET_PERMS_LOAD_FAILED, setPermsLoadFailed,
    // V2P-714 — cascade-delete dataset rows
    DELETE_TERRAIN, deleteTerrain,
    DELETE_TERRAIN_SUCCESS, deleteTerrainSuccess,
    DELETE_TERRAIN_BLOCKED, deleteTerrainBlocked,
    DELETE_TERRAIN_ERROR, deleteTerrainError,
    DELETE_BOUNDARY, deleteBoundary,
    DELETE_BOUNDARY_SUCCESS, deleteBoundarySuccess,
    DELETE_BOUNDARY_BLOCKED, deleteBoundaryBlocked,
    DELETE_BOUNDARY_ERROR, deleteBoundaryError,
    DELETE_FRICTION, deleteFriction,
    DELETE_FRICTION_SUCCESS, deleteFrictionSuccess,
    DELETE_FRICTION_BLOCKED, deleteFrictionBlocked,
    DELETE_FRICTION_ERROR, deleteFrictionError,
    DELETE_INFLOW, deleteInflow,
    DELETE_INFLOW_SUCCESS, deleteInflowSuccess,
    DELETE_INFLOW_BLOCKED, deleteInflowBlocked,
    DELETE_INFLOW_ERROR, deleteInflowError,
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    DELETE_STRUCTURE, deleteStructure,
    DELETE_STRUCTURE_SUCCESS, deleteStructureSuccess,
    DELETE_STRUCTURE_BLOCKED, deleteStructureBlocked,
    DELETE_STRUCTURE_ERROR, deleteStructureError,
    DELETE_MESH_REGION, deleteMeshRegion,
    DELETE_MESH_REGION_SUCCESS, deleteMeshRegionSuccess,
    DELETE_MESH_REGION_BLOCKED, deleteMeshRegionBlocked,
    DELETE_MESH_REGION_ERROR, deleteMeshRegionError,
    DELETE_CATCHMENT, deleteCatchment,
    DELETE_CATCHMENT_SUCCESS, deleteCatchmentSuccess,
    DELETE_CATCHMENT_BLOCKED, deleteCatchmentBlocked,
    DELETE_CATCHMENT_ERROR, deleteCatchmentError,
    DELETE_NODES, deleteNodes,
    DELETE_NODES_SUCCESS, deleteNodesSuccess,
    DELETE_NODES_BLOCKED, deleteNodesBlocked,
    DELETE_NODES_ERROR, deleteNodesError,
    DELETE_LINKS, deleteLinks,
    DELETE_LINKS_SUCCESS, deleteLinksSuccess,
    DELETE_LINKS_BLOCKED, deleteLinksBlocked,
    DELETE_LINKS_ERROR, deleteLinksError,
    // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
    DELETE_FRICTION_RASTER, deleteFrictionRaster,
    DELETE_FRICTION_RASTER_SUCCESS, deleteFrictionRasterSuccess,
    DELETE_FRICTION_RASTER_BLOCKED, deleteFrictionRasterBlocked,
    DELETE_FRICTION_RASTER_ERROR, deleteFrictionRasterError
};

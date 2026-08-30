const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
// TASK-1637 — "init in flight" guard. initAnugaEpic sets this to the map id
// it is currently resolving (the from-map → getProjectV2 → setAnugaProjectData
// waterfall) and clears it (false) on completion AND on chain error. Both
// anugaContainer.componentDidUpdate (the re-dispatch source) and the epic's
// own top-of-pipe gate read it so a re-render mid-chain can't fire a second
// INIT_ANUGA that switchMap would otherwise use to CANCEL the first in-flight
// chain. Keyed on map id so a map switch (new gnresource.id) is never deduped
// against the previous map's stale guard.
const SET_ANUGA_INIT_IN_FLIGHT = 'SET_ANUGA_INIT_IN_FLIGHT';
// TASK-2850 (epic 2839 W2.3) — the TERMINAL "no ANUGA project for this map"
// state. initAnugaEpic's from-map POST 404s for the (large majority of)
// maps that simply are not ANUGA projects; before this, that 404 only ever
// cleared SET_ANUGA_INIT_IN_FLIGHT, which left `!isAnugaProject` permanently
// true (there is no project to ever set) and re-armed anugaContainer's
// componentDidUpdate gate on literally every re-render — an unbounded
// ~8.8 dispatches/sec retry storm against a write-shaped endpoint, one per
// ordinary map view. This records a POSITIVE, cacheable answer ("asked, and
// there genuinely is none") that the gate can check, distinguishing it from
// "have not asked yet" (initial null) and "asking now" (initInFlight).
// Keyed on map id for the same reason initInFlight is: a map switch must
// never be gated by the PREVIOUS map's terminal answer.
const SET_ANUGA_NO_PROJECT_FOR_MAP = 'SET_ANUGA_NO_PROJECT_FOR_MAP';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';
const SET_ANUGA_BOUNDARY_DATA = 'SET_ANUGA_BOUNDARY_DATA';
const SET_ANUGA_FRICTION_DATA = 'SET_ANUGA_FRICTION_DATA';
const SET_ANUGA_INFLOW_DATA = 'SET_ANUGA_INFLOW_DATA';
// TASK-955 (W2.2 FE) — Rainfall is a polygon sibling to Inflow.
// Mirrors SET_ANUGA_INFLOW_DATA at every level of the data pipeline so
// the v2 GET fan-out, taskCompleteLayerEpic, and the resources reducer
// can treat Rainfall identically.
const SET_ANUGA_RAINFALL_DATA = 'SET_ANUGA_RAINFALL_DATA';
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

// Invitation actions (TASK-860)
const FETCH_INVITATIONS = 'ANUGA:FETCH_INVITATIONS';
const SET_INVITATIONS = 'ANUGA:SET_INVITATIONS';
const SEND_INVITATION_REQUEST = 'ANUGA:SEND_INVITATION_REQUEST';
const REVOKE_INVITATION_REQUEST = 'ANUGA:REVOKE_INVITATION_REQUEST';
const RESEND_INVITATION_REQUEST = 'ANUGA:RESEND_INVITATION_REQUEST';

// Membership actions
const FETCH_MEMBERSHIPS = 'FETCH_MEMBERSHIPS';
const SET_MEMBERSHIPS = 'SET_MEMBERSHIPS';
const ADD_MEMBERSHIP_REQUEST = 'ADD_MEMBERSHIP_REQUEST';
const UPDATE_MEMBERSHIP_REQUEST = 'UPDATE_MEMBERSHIP_REQUEST';
const DELETE_MEMBERSHIP_REQUEST = 'DELETE_MEMBERSHIP_REQUEST';
const SET_MEMBERSHIPS_LOADING = 'SET_MEMBERSHIPS_LOADING';
const UPDATE_PROJECT_VISIBILITY_REQUEST = 'UPDATE_PROJECT_VISIBILITY_REQUEST';
// TASK-2440 (epic 2425 W4.1) — the visibility PATCH has finished, by ANY route:
// success, a 402 refusal, a generic error, or no project loaded at all. Clears
// the visibilityPending flag the REQUEST above arms (projectsReducer).
// ONE settle for all outcomes on purpose: the 402 and error branches emit no
// SET_ANUGA_PROJECT_DATA, so a success-only clear would leave all three Sharing
// rows permanently disabled after any refusal — and SET_PAYWALL_UPGRADE_PROMPT
// lives in the Paywall slice, so clearing off that would force projectsReducer
// to import across slices to cover just one of three branches.
const UPDATE_PROJECT_VISIBILITY_SETTLED = 'UPDATE_PROJECT_VISIBILITY_SETTLED';

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
// TASK-1720 (W3) fix — in-place patch of a single terrain row in Redux state.
// Carries id + a partial object of fields to merge (e.g. {styling_mode: 'dynamic'}).
// Used by _handleTerrainStylingModeChange after a successful PATCH /terrain/{id}/ so
// that findDynamicDemPairs reads the new styling_mode on the very next CHANGE_MAP_VIEW
// without triggering a full initAnuga re-fetch.
const UPDATE_TERRAIN_ROW = 'ANUGA:UPDATE_TERRAIN_ROW';

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

// TASK-955 (W2.2 FE) — Rainfall cascade-delete. Mirrors DELETE_INFLOW shape
// exactly; BE Rainfall ViewSet (TASK-954) returns 204/409 ACTIVE_REFERENCES/
// 403 with the same semantics as Inflow.
const DELETE_RAINFALL = 'ANUGA:DELETE_RAINFALL';
const DELETE_RAINFALL_SUCCESS = 'ANUGA:DELETE_RAINFALL_SUCCESS';
const DELETE_RAINFALL_BLOCKED = 'ANUGA:DELETE_RAINFALL_BLOCKED';
const DELETE_RAINFALL_ERROR = 'ANUGA:DELETE_RAINFALL_ERROR';

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

// TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM creation. Body shape and
// async-flow contract are pinned by anugaApi.createTerrainFromBbox. The
// epic handles the POST + dispatches the success/error follow-ups.
const CREATE_TERRAIN_FROM_BBOX = 'ANUGA:CREATE_TERRAIN_FROM_BBOX';
const CREATE_TERRAIN_FROM_BBOX_SUCCESS = 'ANUGA:CREATE_TERRAIN_FROM_BBOX_SUCCESS';
const CREATE_TERRAIN_FROM_BBOX_ERROR = 'ANUGA:CREATE_TERRAIN_FROM_BBOX_ERROR';

// TASK-2327 (epic 2323) — convert an ellipsoid terrain to an EGM2008 derived
// terrain. convertTerrainDatumEpic POSTs the convert-datum action; the derived
// terrain arrives via the Tasks panel (taskCompleteLayerEpic).
const CONVERT_TERRAIN_DATUM = 'ANUGA:CONVERT_TERRAIN_DATUM';
const CONVERT_TERRAIN_DATUM_SUCCESS = 'ANUGA:CONVERT_TERRAIN_DATUM_SUCCESS';
const CONVERT_TERRAIN_DATUM_ERROR = 'ANUGA:CONVERT_TERRAIN_DATUM_ERROR';
// TASK-2335 (epic 2323): persist the datum-badge dismissal (fire-and-forget).
const ACK_TERRAIN_DATUM = 'ANUGA:ACK_TERRAIN_DATUM';

// TASK-2548 (epic 2425 W3e) — `mapId` STAMPS which map this project data was
// fetched for. The payload cannot answer that question itself: the retrieve
// serializer is ProjectSerializerV2, and only ProjectSerializerV2Full carries
// `base_map` (gn_anuga/serializers_v2.py), so `data` measured live is exactly
// [id, name, projection, simple_view_config, visibility, owner_username,
// my_role]. Whoever fetched it knows the map, so whoever fetched it stamps it.
// projectsReducer refuses a stamp that positively disagrees with the map the
// slice is about — the same rule SET_ANUGA_RESOURCE_PERMS already applies to
// `projectId`, and for the same reason: late data for the map the user has
// LEFT must not relabel the one they are on.
function setAnugaProjectData(data, mapId) {
    return { type: SET_ANUGA_PROJECT_DATA, data, mapId };
}

// TASK-1637 — pass the map id when setting (so the gate can compare against
// the live gnresource.id) and `false` to clear on completion/error.
function setAnugaInitInFlight(mapId) {
    return { type: SET_ANUGA_INIT_IN_FLIGHT, mapId };
}

// TASK-2850 — dispatched by initAnugaEpic's catch on (and only on) a 404
// from the from-map lookup: this map genuinely has no ANUGA project.
function setAnugaNoProjectForMap(mapId) {
    return { type: SET_ANUGA_NO_PROJECT_FOR_MAP, mapId };
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

// TASK-955 — paired with SET_ANUGA_INFLOW_DATA.
function setAnugaRainfallData(data) {
    return { type: SET_ANUGA_RAINFALL_DATA, data };
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

/** The visibility PATCH finished — success, 402, error, or no project. */
function updateProjectVisibilitySettled() {
    return { type: UPDATE_PROJECT_VISIBILITY_SETTLED };
}

// Invitation action creators (TASK-860)
function fetchInvitations() {
    return { type: FETCH_INVITATIONS };
}

/**
 * payload: { invitations_enabled: bool, results: [...] }
 * The reducer stores both the flag and the list.
 */
function setInvitations(payload) {
    return { type: SET_INVITATIONS, payload };
}

function sendInvitationRequest(email, role) {
    return { type: SEND_INVITATION_REQUEST, email, role };
}

function revokeInvitationRequest(invitationId) {
    return { type: REVOKE_INVITATION_REQUEST, invitationId };
}

function resendInvitationRequest(invitationId) {
    return { type: RESEND_INVITATION_REQUEST, invitationId };
}

// V2P-21 action creators
/**
 * @param {number}  projectId
 * @param {boolean} force  TASK-2464 (epic 2425 W2.5) — bypass fetchMyPermsEpic's
 *   30s per-project dedupe. Use ONLY when something just changed the answer
 *   server-side (a visibility PATCH succeeded; a webhook poll is watching for
 *   an entitlement flip). The dedupe exists to protect the TASK-658 cold-start
 *   perf budget from repeated panel opens, not to suppress refetches after a
 *   write — and it was silently doing the latter. See permsEpics.js.
 */
function fetchMyPerms(projectId, force = false) {
    return { type: FETCH_MY_PERMS, projectId, force };
}

/**
 * @param {object} payload  the my-perms body
 * @param {number} projectId  TASK-2463 (epic 2425 W2.6) — the project the
 *   payload DESCRIBES. Required by projectsReducer, which folds
 *   `payload.visibility` and (TASK-2497, W3d) `payload.my_role` back into
 *   state.anuga.projects.data and must not do that when a late response for
 *   the previous project lands after an SPA navigation. The action carried no
 *   project identity before, so the reducer had no way to tell. Omitting it is
 *   fail-SAFE: the fold is skipped, and the padlock and the role selectors keep
 *   showing the last values the project fetch established.
 */
function setAnugaResourcePerms(payload, projectId) {
    // payload shape from /api/v2/anuga/projects/<pid>/my-perms/:
    //   { my_role, visibility, scenarios: {<id>: [perms]}, terrain: {...}, ... }
    return { type: SET_ANUGA_RESOURCE_PERMS, payload, projectId };
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
// TASK-1720 (W3) fix — merge partial fields into a single terrain row without
// replacing the whole array (no flicker, no initAnuga re-fetch).
function updateTerrainRow(id, fields) {
    return { type: UPDATE_TERRAIN_ROW, id, fields };
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

// TASK-955 (W2.2 FE) — Rainfall cascade-delete creators. Mirror deleteInflow
// exactly. `id` is the Rainfall.id (AnugaModel pk); `layerIds` is the 1-item
// array of MapStore layer ids stamped by create_rainfall_gn_layer.
function deleteRainfall(projectId, id, layerIds) {
    return { type: DELETE_RAINFALL, projectId, id, layerIds: _toLayerIds(layerIds) };
}
function deleteRainfallSuccess(id, layerIds) {
    return { type: DELETE_RAINFALL_SUCCESS, id, layerIds: _toLayerIds(layerIds) };
}
function deleteRainfallBlocked(id, blocking, message) {
    return { type: DELETE_RAINFALL_BLOCKED, id, blocking, message };
}
function deleteRainfallError(id, error) {
    return { type: DELETE_RAINFALL_ERROR, id, error };
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

// TASK-930 (W2-FE) — Global GLO-30 DEM creation action creators. Body shape
// matches the BE TASK-929 endpoint contract: {title, source:'copernicus_glo30',
// bbox:[minLon,minLat,maxLon,maxLat]}. terrainBboxEpic catches CREATE_TERRAIN_
// FROM_BBOX and POSTs via anugaApi.createTerrainFromBbox.
function createTerrainFromBbox(title, bbox) {
    return { type: CREATE_TERRAIN_FROM_BBOX, title, bbox };
}
function createTerrainFromBboxSuccess(data) {
    return { type: CREATE_TERRAIN_FROM_BBOX_SUCCESS, data };
}
function createTerrainFromBboxError(error) {
    return { type: CREATE_TERRAIN_FROM_BBOX_ERROR, error };
}

// TASK-2327 (epic 2323) — convert-to-EGM2008 action creators.
function convertTerrainDatum(projectId, terrainId) {
    return { type: CONVERT_TERRAIN_DATUM, projectId, terrainId };
}
function convertTerrainDatumSuccess(data) {
    return { type: CONVERT_TERRAIN_DATUM_SUCCESS, data };
}
function convertTerrainDatumError(error) {
    return { type: CONVERT_TERRAIN_DATUM_ERROR, error };
}
function ackTerrainDatum(projectId, terrainId, ack) {
    return { type: ACK_TERRAIN_DATUM, projectId, terrainId, ack };
}

module.exports = {
    SET_ANUGA_PROJECT_DATA, setAnugaProjectData,
    SET_ANUGA_INIT_IN_FLIGHT, setAnugaInitInFlight,
    SET_ANUGA_NO_PROJECT_FOR_MAP, setAnugaNoProjectForMap,
    SET_ANUGA_SCENARIO_DATA, setAnugaScenarioData,
    SET_ANUGA_BOUNDARY_DATA, setAnugaBoundaryData,
    SET_ANUGA_FRICTION_DATA, setAnugaFrictionData,
    SET_ANUGA_INFLOW_DATA, setAnugaInflowData,
    // TASK-955 (W2.2 FE) — Rainfall sibling to Inflow.
    SET_ANUGA_RAINFALL_DATA, setAnugaRainfallData,
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
    UPDATE_PROJECT_VISIBILITY_SETTLED, updateProjectVisibilitySettled,
    // Invitation actions (TASK-860)
    FETCH_INVITATIONS, fetchInvitations,
    SET_INVITATIONS, setInvitations,
    SEND_INVITATION_REQUEST, sendInvitationRequest,
    REVOKE_INVITATION_REQUEST, revokeInvitationRequest,
    RESEND_INVITATION_REQUEST, resendInvitationRequest,
    FETCH_MY_PERMS, fetchMyPerms,
    SET_ANUGA_RESOURCE_PERMS, setAnugaResourcePerms,
    SET_PERMS_LOAD_FAILED, setPermsLoadFailed,
    // TASK-1720 (W3) fix — in-place single-row terrain merge
    UPDATE_TERRAIN_ROW, updateTerrainRow,
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
    // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow)
    DELETE_RAINFALL, deleteRainfall,
    DELETE_RAINFALL_SUCCESS, deleteRainfallSuccess,
    DELETE_RAINFALL_BLOCKED, deleteRainfallBlocked,
    DELETE_RAINFALL_ERROR, deleteRainfallError,
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
    DELETE_FRICTION_RASTER_ERROR, deleteFrictionRasterError,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM creation
    CREATE_TERRAIN_FROM_BBOX, createTerrainFromBbox,
    CREATE_TERRAIN_FROM_BBOX_SUCCESS, createTerrainFromBboxSuccess,
    CREATE_TERRAIN_FROM_BBOX_ERROR, createTerrainFromBboxError,
    // TASK-2327 (epic 2323) — convert an ellipsoid terrain to EGM2008
    CONVERT_TERRAIN_DATUM, convertTerrainDatum,
    CONVERT_TERRAIN_DATUM_SUCCESS, convertTerrainDatumSuccess,
    CONVERT_TERRAIN_DATUM_ERROR, convertTerrainDatumError,
    // TASK-2335 (epic 2323) — persist datum-badge dismissal
    ACK_TERRAIN_DATUM, ackTerrainDatum
};

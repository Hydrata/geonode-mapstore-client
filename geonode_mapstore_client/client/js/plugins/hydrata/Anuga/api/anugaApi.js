/**
 * ANUGA API Client
 *
 * Pure functions returning Promises. No Redux, no dispatch.
 * Centralizes all HTTP calls for the ANUGA plugin.
 *
 * V2P-79 — V1 → V2 cutover. All public functions now route through
 * /api/v2/anuga/. The legacy V1 path /anuga/api/ stays alive on the BE
 * (V2P-80 retires it 30d post-79) but is no longer called from FE here,
 * with three deliberate exceptions for create-only paths where V2 didn't
 * ship POST endpoints (boundary/friction/inflow). See `createResource`.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import {parseDevHostname} from "@js/utils/APIUtils";

// V1 short type name → V2 nested-resource plural segment. Keys are the
// type identifiers callers already pass (the V1 router segment); values
// are the V2 URL segments per /opt/hydrata/apps/gn_anuga/urls.py.
//
// Three keys are intentionally absent: 'boundary', 'friction', 'inflow'.
// V2 boundaries/frictions/inflows endpoints expose only GET list/retrieve
// + PATCH partial_update — no POST create. createResource() falls back to
// V1 for those three; every other helper (list / patch / delete) routes V2.
const V2_PLURAL = {
    elevation: 'elevations',
    boundary: 'boundaries',
    friction: 'frictions',
    inflow: 'inflows',
    structure: 'structures',
    'mesh-region': 'mesh-regions',
    'full-mesh': 'full-meshes',
    network: 'networks',
    catchment: 'catchments',
    nodes: 'nodes',
    links: 'links',
    comparison: 'comparisons',
    publication: 'publications',
    'compute-instance': 'compute-instances'
};

// Types whose V2 ViewSet does NOT expose POST create (V2P-12a/12b kept these
// read+patch-only; V2 spatial-layer stamping is intended to land via a
// different upload flow in V2P-80+). createResource keeps V1 for these.
const V1_CREATE_ONLY_TYPES = new Set(['boundary', 'friction', 'inflow']);

const v2Plural = (type) => V2_PLURAL[type] || type;

// -- Project ---------------------------------------------------------------

// V2P-79: V1 POST /anuga/api/project/get_project_from_map_id/
//      → V2 POST /api/v2/anuga/projects/from-map/  (V2P-74)
// Body shape preserved verbatim ({mapId}); response shape preserved
// ({projectId}). Anonymous-allowed on the V2 side.
export const getProjectFromMapId = (mapId) =>
    axios.post('/api/v2/anuga/projects/from-map/', { mapId });

// V2P-79: alias to V2 list endpoint. Pagination semantics preserved by
// query params (page_size, page) — V2 ProjectViewSetV2 inherits DRF defaults.
export const getProjects = (pageSize = 100, page = 1) =>
    axios.get(parseDevHostname('/api/v2/anuga/projects/'), {
        params: { page_size: pageSize, page }
    });

// -- Generic resource CRUD -------------------------------------------------

// V2P-79: most types route to /api/v2/anuga/projects/{pid}/{plural}/.
// Boundary/Friction/Inflow stay on V1 because V2 did not ship POST create
// for them — see V1_CREATE_ONLY_TYPES rationale at top of file.
export const createResource = (projectId, type, data) => {
    if (V1_CREATE_ONLY_TYPES.has(type)) {
        // V1 holdout — V2 boundaries/frictions/inflows expose no POST.
        // Backend remains alive (V2P-80 will retire when V2 gains create).
        return axios.post(`/anuga/api/${projectId}/${type}/`, data);
    }
    return axios.post(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/`, data);
};

// V2P-79: getResourceList — list all instances of `type` within a project.
// V1 returned a plain array; V2 likewise (no DEFAULT_PAGINATION_CLASS in
// REST_FRAMEWORK settings, viewsets do not declare pagination_class). Field
// shapes match through V2P-78 (base_map_full / s3_*_url / nested gn_layer).
export const getResourceList = (projectId, type) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/`);

// V2P-79: PATCH a resource title (re-uses the generic V2 PATCH route).
// V2 sub-resource serializers expose `title` (read+write).
export const updateResourceTitle = (projectId, type, resourceId, title) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/${resourceId}/`, { title });

// V2P-79: generic PATCH for any sub-resource. V2P-78 ensured field-compat
// for `gn_layer`, `base_map_full`, `s3_*_url`, etc.
export const updateResource = (projectId, type, resourceId, data) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/${v2Plural(type)}/${resourceId}/`, data);

// -- Scenarios -------------------------------------------------------------

// V2P-79: V1 createScenario was a POST /anuga/api/{pid}/scenario/. The V2
// path /api/v2/anuga/projects/{pid}/scenarios/ is reached via createScenarioV2
// below; we keep this name as a thin alias so any existing callers continue
// to work with no change to argument shape.
export const createScenario = (projectId, scenario) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/`, scenario);

// V2P-79 / V2P-72: V1 PUT → V2 PATCH for partial-update semantics. V2 also
// supports PUT, but switching to PATCH avoids accidental field nulling when
// callers don't include all required-on-write fields. ScenarioUpdateSerializerV2
// limits the writable fields to {name, elevation, boundary, friction, inflow,
// structure, mesh_region, network, resolution, duration}.
export const updateScenario = (projectId, scenarioId, scenario) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`, scenario);

// V2P-79: V1 DELETE → V2 DELETE on the project-nested route.
export const deleteScenario = (projectId, scenarioId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`);

// V2P-714: V2 DELETE wrappers for the 4 cascade-delete dataset types.
// Backend signals cascade-clean GeoNode Dataset, GeoServer layer, GeoFence
// rules, S3 TIFs. Returns 204 on success; 409 with {error_code:
// 'ACTIVE_REFERENCES', blocking: [...]} if active scenarios reference the
// dataset; 403 for viewers; 401 for anonymous.
export const deleteElevationV2 = (projectId, elevationId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/elevations/${elevationId}/`);

export const deleteBoundaryV2 = (projectId, boundaryId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/boundaries/${boundaryId}/`);

export const deleteFrictionV2 = (projectId, frictionId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/frictions/${frictionId}/`);

export const deleteInflowV2 = (projectId, inflowId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/inflows/${inflowId}/`);

// V2P-79 / V2P-72: V1 POST /anuga/api/{pid}/scenario/compare/
//      → V2 POST /api/v2/anuga/projects/{pid}/scenarios/compare/ (CompareView).
// Body shape now {scenario_one_id, scenario_two_id} per V2 contract.
// V1 callers passed an array of scenarios; we adapt for back-compat — the
// epic dispatching this still passes the same payload it always did.
export const compareScenarios = (projectId, scenarios) => {
    // V1 payload was [{id: <int>}, {id: <int>}] (per V1 ComparisonViewSet
    // contract). V2 wants an explicit {scenario_one_id, scenario_two_id}.
    // Translate at the API boundary so callers don't have to.
    if (Array.isArray(scenarios) && scenarios.length === 2) {
        return axios.post(
            `/api/v2/anuga/projects/${projectId}/scenarios/compare/`,
            {
                scenario_one_id: scenarios[0]?.id,
                scenario_two_id: scenarios[1]?.id
            }
        );
    }
    // Pass-through for any caller already using the V2 body shape.
    return axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/compare/`, scenarios);
};

// -- Network ---------------------------------------------------------------

// V2P-79: V1 POST /anuga/api/{pid}/network/{nid}/run/
//      → V2 POST /api/v2/anuga/projects/{pid}/networks/{nid}/run/  (V2P-75)
export const runNetwork = (projectId, networkId, data) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/networks/${networkId}/run/`, data);

// -- Comparison / Compute --------------------------------------------------

// V2P-79: V1 GET /anuga/api/{pid}/compute-instance/  (project-scoped)
//      → V2 GET /api/v2/anuga/compute-instances/  (V2P-76, global, NOT
//        project-scoped — compute templates are global resources).
// Caller passes projectId for backwards-compat; we drop it. Response is
// the same list-of-templates shape; no FE consumer reads project_id off
// returned rows.
export const getComputeInstances = (_projectId) =>
    axios.get('/api/v2/anuga/compute-instances/');

// -- Publication / Figures -------------------------------------------------

// V2P-79: V1 → V2 routes the create-figure action (V2P-76 PublicationViewSetV2).
export const createFigure = (projectId, publicationId, title) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/publications/${publicationId}/create-figure/`, { title });

// -- Dataset search --------------------------------------------------------

// Already V2 (GeoNode core endpoint, not /anuga/api/).
export const searchDataset = (datasetName) =>
    axios.get(`/api/v2/datasets?search=${datasetName}&search_fields=name`);

// -- v2 Project -----------------------------------------------------------

export const getProjectV2 = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/`);

export const getProjectsV2 = (pageSize = 100, page = 1) =>
    axios.get('/api/v2/anuga/projects/', { params: { page_size: pageSize, page } });

// V2P-21 — batch perm fetch for the whole project. Backend caches with
// Cache-Control: private, max-age=60. See V2P-20 endpoint at
// /opt/hydrata/apps/gn_anuga/api_v2.py::ProjectViewSetV2.my_perms.
export const getMyPerms = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/my-perms/`);

// -- v2 Scenarios ---------------------------------------------------------

export const getScenariosV2 = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/scenarios/`);

export const createScenarioV2 = (projectId, scenario) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/scenarios/`, scenario);

export const deleteScenarioV2 = (projectId, scenarioId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/`);

// -- v2 Run lifecycle -----------------------------------------------------

export const startRun = (scenarioId, computeBackend = 'local') =>
    axios.post(`/api/v2/anuga/scenarios/${scenarioId}/run/`, { compute_backend: computeBackend });

export const cancelRun = (runId) =>
    axios.post(`/api/v2/anuga/runs/${runId}/cancel/`);

export const retryRun = (runId) =>
    axios.post(`/api/v2/anuga/runs/${runId}/retry/`);

export const getRunStatus = (runId) =>
    axios.get(`/api/v2/anuga/runs/${runId}/status/`);

export const getRun = (runId) =>
    axios.get(`/api/v2/anuga/runs/${runId}/`);

// -- Memberships ----------------------------------------------------------

// V2P-79 / V2P-722: V1 /member/  → V2 /members/  (path now plural).
// Body/response shape preserved verbatim. ProjectMembership.role still
// integer, user still PrimaryKeyRelatedField.
export const getMemberships = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/members/`);

export const addMembership = (projectId, userId, role) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/members/`, { user: userId, role });

export const searchUsers = (query) =>
    axios.get('/api/v2/users/', { params: { search: query, page_size: 10 } });

export const updateMembership = (projectId, membershipId, role) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/members/${membershipId}/`, { role });

export const deleteMembership = (projectId, membershipId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/members/${membershipId}/`);

// -- Project visibility ---------------------------------------------------

export const updateProjectVisibility = (projectId, visibility) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/`, { visibility });

/**
 * ANUGA API Client
 *
 * Pure functions returning Promises. No Redux, no dispatch.
 * Centralizes all HTTP calls for the ANUGA plugin.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import {parseDevHostname} from "@js/utils/APIUtils";

// -- Project ---------------------------------------------------------------

export const getProjectFromMapId = (mapId) =>
    axios.post('/anuga/api/project/get_project_from_map_id/', { mapId });

export const getProjects = (pageSize = 100, page = 1) =>
    axios.get(parseDevHostname('/anuga/api/project/'), {
        params: { page_size: pageSize, page }
    });

// -- Generic resource CRUD -------------------------------------------------

export const createResource = (projectId, type, data) =>
    axios.post(`/anuga/api/${projectId}/${type}/`, data);

export const getAvailableLayers = (projectId, type) =>
    axios.get(`/anuga/api/${projectId}/${type}/available/`);

export const getResourceList = (projectId, type) =>
    axios.get(`/anuga/api/${projectId}/${type}/`);

export const updateResourceTitle = (projectId, type, resourceId, title) =>
    axios.patch(`/anuga/api/${projectId}/${type}/${resourceId}/`, { title });

export const updateResource = (projectId, type, resourceId, data) =>
    axios.patch(`/anuga/api/${projectId}/${type}/${resourceId}/`, data);

// -- Scenarios -------------------------------------------------------------

export const createScenario = (projectId, scenario) =>
    axios.post(`/anuga/api/${projectId}/scenario/`, scenario);

export const updateScenario = (projectId, scenarioId, scenario) =>
    axios.put(`/anuga/api/${projectId}/scenario/${scenarioId}/`, scenario);

export const deleteScenario = (projectId, scenarioId) =>
    axios.delete(`/anuga/api/${projectId}/scenario/${scenarioId}/`);

export const compareScenarios = (projectId, scenarios) =>
    axios.post(`/anuga/api/${projectId}/scenario/compare/`, scenarios);

// -- Network ---------------------------------------------------------------

export const runNetwork = (projectId, networkId, data) =>
    axios.post(`/anuga/api/${projectId}/network/${networkId}/run/`, data);

// -- Comparison / Compute --------------------------------------------------

export const getComputeInstances = (projectId) =>
    axios.get(`/anuga/api/${projectId}/compute-instance/`);

// -- Publication / Figures -------------------------------------------------

export const createFigure = (projectId, publicationId, title) =>
    axios.post(`/anuga/api/${projectId}/publication/${publicationId}/create-figure/`, { title });

// -- Dataset search --------------------------------------------------------

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

export const getMemberships = (projectId) =>
    axios.get(`/anuga/api/${projectId}/member/`);

export const addMembership = (projectId, userId, role) =>
    axios.post(`/anuga/api/${projectId}/member/`, { user: userId, role });

export const searchUsers = (query) =>
    axios.get('/api/v2/users/', { params: { search: query, page_size: 10 } });

export const updateMembership = (projectId, membershipId, role) =>
    axios.patch(`/anuga/api/${projectId}/member/${membershipId}/`, { role });

export const deleteMembership = (projectId, membershipId) =>
    axios.delete(`/anuga/api/${projectId}/member/${membershipId}/`);

// -- Project visibility ---------------------------------------------------

export const updateProjectVisibility = (projectId, visibility) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/`, { visibility });

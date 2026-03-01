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

export const getProject = (projectId) =>
    axios.get(`/anuga/api/project/${projectId}/`);

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

// -- Scenarios -------------------------------------------------------------

export const getScenarios = (projectId) =>
    axios.get(`/anuga/api/${projectId}/scenario/`);

export const createScenario = (projectId, scenario) =>
    axios.post(`/anuga/api/${projectId}/scenario/`, scenario);

export const updateScenario = (projectId, scenarioId, scenario) =>
    axios.put(`/anuga/api/${projectId}/scenario/${scenarioId}/`, scenario);

export const deleteScenario = (projectId, scenarioId) =>
    axios.delete(`/anuga/api/${projectId}/scenario/${scenarioId}/`);

export const runScenario = (projectId, scenarioId, data) =>
    axios.post(`/anuga/api/${projectId}/scenario/${scenarioId}/run/`, data);

export const cancelScenario = (projectId, scenarioId, runId) =>
    axios.post(`/anuga/api/${projectId}/scenario/${scenarioId}/cancel/`, { runId });

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

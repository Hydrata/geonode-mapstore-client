/**
 * SWAMM API Client
 *
 * Pure functions returning Promises. No Redux, no dispatch.
 * Centralizes all HTTP calls for the SWAMM plugin.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';

// ── Project ──────────────────────────────────────────────────────────────

const _projectIdCache = {};

export const getProjectFromMapId = (mapId) => {
    if (_projectIdCache[mapId]) {
        return Promise.resolve({ data: { projectId: _projectIdCache[mapId] }, status: 200 });
    }
    return axios.post('/swamm/api/project/get_project_from_map_id/', { mapId })
        .then(response => {
            if (response?.data?.projectId) {
                _projectIdCache[mapId] = response.data.projectId;
            }
            return response;
        });
};

export const getProject = (projectId) =>
    axios.get(`/swamm/api/project/${projectId}/`);

export const getProjectManagerConfig = (mapId) =>
    axios.get(`/projects/api/maps/${mapId}/`);

// ── BMP Types ────────────────────────────────────────────────────────────

export const getBmpTypes = (projectId) =>
    axios.get(`/swamm/api/${projectId}/bmp-type/`);

export const getBmpTypeGroups = (projectId) =>
    axios.get(`/swamm/api/${projectId}/bmp-type/bmp_type_group_list/`);

// ── Group Profiles ───────────────────────────────────────────────────────

export const getGroupProfiles = () =>
    axios.get('/api/v2/groups?page_size=1000');

export const getUserGroupMemberships = () =>
    axios.get('/swamm/api/user-group-memberships/');

// ── BMPs ─────────────────────────────────────────────────────────────────

export const getAllBmps = (projectId, cursor = null) => {
    const url = cursor || `/swamm/api/${projectId}/bmps/`;
    return axios.get(url);
};

/**
 * Fetch all BMP pages recursively, accumulating results into a flat array.
 * Returns a Promise that resolves with { data: allResults[] }.
 */
export const getAllBmpsPaginated = (projectId) => {
    const MAX_PAGES = 200;
    const accumulate = (cursor, collected, pageCount) => {
        if (pageCount >= MAX_PAGES) {
            console.warn('getAllBmpsPaginated: max pages reached, returning partial results');
            return { data: collected };
        }
        return getAllBmps(projectId, cursor).then(response => {
            const results = response.data?.results || response.data || [];
            const all = collected.concat(results);
            const next = response.data?.next || null;
            if (next) {
                return accumulate(next, all, pageCount + 1);
            }
            return { data: all };
        });
    };
    return accumulate(null, [], 0);
};

export const getBmp = (projectId, bmpId) =>
    axios.get(`/swamm/api/${projectId}/bmps/${bmpId}/`);

export const createBmp = (projectId, data) =>
    axios.post(`/swamm/api/${projectId}/bmps/`, data);

export const updateBmp = (projectId, bmpId, data) =>
    axios.patch(`/swamm/api/${projectId}/bmps/${bmpId}/`, data);

export const deleteBmp = (projectId, bmpId) =>
    axios.delete(`/swamm/api/${projectId}/bmps/${bmpId}/`, {});

export const getBmpStatuses = (projectId) =>
    axios.get(`/swamm/api/${projectId}/bmps/status_list/`);

export const getLatestFeatureId = (projectId, geomType) =>
    axios.get(`/swamm/api/${projectId}/bmps/get-latest-feature-id/${geomType}/`);

// ── Pollutant Loading Targets ────────────────────────────────────────────

export const getTargets = (projectId) =>
    axios.get(`/swamm/api/${projectId}/pollutant-loading-target/`);

export const createTarget = (projectId, data) =>
    axios.post(`/swamm/api/${projectId}/pollutant-loading-target/`, data);

export const updateTarget = (projectId, targetId, data) =>
    axios.patch(`/swamm/api/${projectId}/pollutant-loading-target/${targetId}/`, data);

export const deleteTarget = (projectId, targetId) =>
    axios.delete(`/swamm/api/${projectId}/pollutant-loading-target/${targetId}/`, {});

export const downloadTargetXlsx = (projectId, targetId) =>
    axios.get(
        `/swamm/api/${projectId}/pollutant-loading-target/${targetId}/download-xlsx/`,
        { responseType: 'blob' }
    );

export const downloadTargetPdf = (projectId, targetId) =>
    axios.get(
        `/swamm/api/${projectId}/pollutant-loading-target/${targetId}/download-pdf/`,
        { responseType: 'arraybuffer' }
    );

// ── Loading Data ─────────────────────────────────────────────────────────

export const getErosionData = (projectId) =>
    axios.get(`/swamm/api/${projectId}/erosion/`);

// ── BMP History ─────────────────────────────────────────────────────────

export const getBmpHistory = (projectId, bmpId, cursor = null) => {
    const url = cursor || `/swamm/api/${projectId}/bmps/${bmpId}/history/`;
    return axios.get(url);
};

// ── Engines ─────────────────────────────────────────────────────────────

export const getEngines = (projectId) =>
    axios.get(`/swamm/api/${projectId}/swamm-engine/?format=json`);


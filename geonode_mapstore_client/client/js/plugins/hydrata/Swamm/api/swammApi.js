/**
 * SWAMM API Client
 *
 * Pure functions returning Promises. No Redux, no dispatch.
 * Centralizes all HTTP calls for the SWAMM plugin.
 */
const axios = require('../../../../../MapStore2/web/client/libs/ajax');

// ── Project ──────────────────────────────────────────────────────────────

export const getProjectFromMapId = (mapId) =>
    axios.post('/swamm/api/project/get_project_from_map_id/', { mapId });

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

// ── BMPs ─────────────────────────────────────────────────────────────────

export const getAllBmps = (projectId) =>
    axios.get(`/swamm/api/${projectId}/bmps/`);

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

// ── Loading Data ─────────────────────────────────────────────────────────

export const getErosionData = (projectId) =>
    axios.get(`/swamm/api/${projectId}/erosion/`);

export const getNitrogenData = (projectId) =>
    axios.get(`/swamm/api/${projectId}/nitrogen/`);

export const getPhosphorusData = (projectId) =>
    axios.get(`/swamm/api/${projectId}/phosphorus/`);

export const getSedimentData = (projectId) =>
    axios.get(`/swamm/api/${projectId}/sediment/`);

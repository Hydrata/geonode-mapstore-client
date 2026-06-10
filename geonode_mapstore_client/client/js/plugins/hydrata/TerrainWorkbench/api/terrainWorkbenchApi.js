/**
 * TASK-1600 (W1) — TerrainWorkbench API client.
 *
 * Thin axios wrappers for:
 *   - Terrain listing (design-DEM + regional pickers)
 *   - AnalysisSurface CRUD
 *   - AnalysisSurface /design-inputs/ sub-resource
 *   - AnalysisSurface /derive/ trigger
 *
 * All calls return Promises; error handling is left to the calling epic.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';

// ── Terrain listing ────────────────────────────────────────────────────────

// GET /api/v2/anuga/projects/{pid}/terrain/
// Returns the list of fully-uploaded Terrain rows for the project (elevation
// product only, hillshade companions excluded — see TerrainViewSetV2.get_queryset).
export const listTerrains = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/terrain/`);

// ── AnalysisSurface CRUD ───────────────────────────────────────────────────

// GET /api/v2/anuga/projects/{pid}/analysis-surfaces/
export const listAnalysisSurfaces = (projectId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/analysis-surfaces/`);

// POST /api/v2/anuga/projects/{pid}/analysis-surfaces/
// Payload: { title, regional_terrain, use_culverts, feather_width_m,
//            target_resolution_m, breach_max_cost, breach_search_dist }
export const createAnalysisSurface = (projectId, payload) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/analysis-surfaces/`, payload);

// GET /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/
export const getAnalysisSurface = (projectId, surfaceId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/`);

// PATCH /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/
export const patchAnalysisSurface = (projectId, surfaceId, payload) =>
    axios.patch(`/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/`, payload);

// DELETE /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/
export const deleteAnalysisSurface = (projectId, surfaceId) =>
    axios.delete(`/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/`);

// ── Design inputs sub-resource ─────────────────────────────────────────────

// POST /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/design-inputs/
// Payload: { design_inputs: [{terrain_id, priority}] }
// Replaces the ordered list atomically.
export const setDesignInputs = (projectId, surfaceId, designInputs) =>
    axios.post(
        `/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/design-inputs/`,
        { design_inputs: designInputs }
    );

// ── Derive trigger ─────────────────────────────────────────────────────────

// POST /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/derive/
// Returns 202 { task_id, process_id }
export const deriveAnalysisSurface = (projectId, surfaceId) =>
    axios.post(
        `/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/derive/`
    );

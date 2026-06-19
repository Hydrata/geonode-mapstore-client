/**
 * TASK-1600 (W1) — TerrainWorkbench API client.
 * TASK-1671 (W1.6) — Updated for single DEM priority stack.
 *
 * Thin axios wrappers for:
 *   - Terrain listing
 *   - AnalysisSurface CRUD
 *   - AnalysisSurface /inputs/ sub-resource (TASK-1671: replaces /design-inputs/)
 *   - AnalysisSurface /derive/ trigger (TASK-1671: atomic save-on-derive)
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
// TASK-1753 (W1.8): optional params (e.g. {output_terrain: <id>}) forwarded as the
// query string so the FE can resolve a derived Terrain's source recipe in one call.
export const listAnalysisSurfaces = (projectId, params) =>
    axios.get(
        `/api/v2/anuga/projects/${projectId}/analysis-surfaces/`,
        params ? { params } : undefined
    );

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

// ── Inputs sub-resource (TASK-1671: replaces /design-inputs/) ─────────────

// POST /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/inputs/
// Payload: { inputs: [{terrain_id, priority, unmodified}] }
// Replaces the ordered stack atomically.
export const setInputs = (projectId, surfaceId, inputs) =>
    axios.post(
        `/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/inputs/`,
        { inputs }
    );

// ── Derive trigger (TASK-1671: atomic save-on-derive) ──────────────────────

// POST /api/v2/anuga/projects/{pid}/analysis-surfaces/{id}/derive/
// Body: { inputs:[{terrain_id,priority,unmodified}], feather_width_m,
//         target_resolution_m, breach_max_cost, breach_search_dist, use_culverts }
// Returns 202 { detail, process_id, task_id }
export const deriveAnalysisSurface = (projectId, surfaceId, body) =>
    axios.post(
        `/api/v2/anuga/projects/${projectId}/analysis-surfaces/${surfaceId}/derive/`,
        body || {}
    );

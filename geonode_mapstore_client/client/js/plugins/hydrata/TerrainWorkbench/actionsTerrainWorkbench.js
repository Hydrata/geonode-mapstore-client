/**
 * TASK-1599 / TASK-1600 (W1) — TerrainWorkbench actions.
 * TASK-1671 (W1.6) — Single DEM priority stack, atomic save-on-derive.
 *
 * Section UI (shell — TASK-1599):
 *   SET_SECTION, SET_VISIBLE
 *
 * Recipe lifecycle (TASK-1600 + TASK-1671):
 *   TW_LOAD_DATA               — fetch terrain list + surface list on open
 *   TW_LOAD_DATA_SUCCESS       — store terrains + surfaces
 *   TW_LOAD_DATA_ERROR         — surface fetch failure
 *
 *   TW_SELECT_SURFACE          — select a surface for editing
 *   TW_CREATE_SURFACE          — POST new surface
 *   TW_CREATE_SURFACE_SUCCESS  — add to list, select
 *   TW_CREATE_SURFACE_ERROR
 *   TW_UPDATE_SURFACE          — PATCH surface params
 *   TW_UPDATE_SURFACE_SUCCESS  — merge into list
 *   TW_UPDATE_SURFACE_ERROR
 *   TW_DELETE_SURFACE          — DELETE surface
 *   TW_DELETE_SURFACE_SUCCESS  — remove from list
 *   TW_DELETE_SURFACE_ERROR
 *
 *   TW_DERIVE                  — POST /derive/ (atomic: inputs + params in body)
 *   TW_DERIVE_SUCCESS          — store process_id, flip deriving=true
 *   TW_DERIVE_ERROR            — surface derive error
 *   TW_DERIVE_COMPLETE         — TaskMonitor flipped to complete; fetch updated surface
 *   TW_DERIVE_COMPLETE_ERROR
 */

// ── Shell ──────────────────────────────────────────────────────────────────

export const TERRAIN_WORKBENCH_SET_SECTION = 'TERRAIN_WORKBENCH_SET_SECTION';
export const TERRAIN_WORKBENCH_SET_VISIBLE = 'TERRAIN_WORKBENCH_SET_VISIBLE';

export function setTerrainWorkbenchSection(section) {
    return { type: TERRAIN_WORKBENCH_SET_SECTION, section };
}
export function setTerrainWorkbenchVisible(visible) {
    return { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible };
}

// ── Load ───────────────────────────────────────────────────────────────────

export const TW_LOAD_DATA = 'TW_LOAD_DATA';
export const TW_LOAD_DATA_SUCCESS = 'TW_LOAD_DATA_SUCCESS';
export const TW_LOAD_DATA_ERROR = 'TW_LOAD_DATA_ERROR';

export function twLoadData() { return { type: TW_LOAD_DATA }; }
export function twLoadDataSuccess(terrains, surfaces) {
    return { type: TW_LOAD_DATA_SUCCESS, terrains, surfaces };
}
export function twLoadDataError(error) { return { type: TW_LOAD_DATA_ERROR, error }; }

// ── Select ─────────────────────────────────────────────────────────────────

export const TW_SELECT_SURFACE = 'TW_SELECT_SURFACE';
export function twSelectSurface(surfaceId) { return { type: TW_SELECT_SURFACE, surfaceId }; }

// TASK-1753 (W1.8) — Select the source recipe of a DERIVED terrain row.
// When the modeller clicks a Terrain produced by an analysis-surface recipe,
// twSelectSurfaceForTerrainEpic resolves its source AnalysisSurface (from
// already-loaded surfaces, else via ?output_terrain=<id>), ensures the recipe
// list is loaded, and dispatches twSelectSurface so the builder populates.
export const TW_SELECT_SURFACE_FOR_TERRAIN = 'TW_SELECT_SURFACE_FOR_TERRAIN';
export function twSelectSurfaceForTerrain(terrainId) {
    return { type: TW_SELECT_SURFACE_FOR_TERRAIN, terrainId };
}

// ── Create surface ─────────────────────────────────────────────────────────

export const TW_CREATE_SURFACE = 'TW_CREATE_SURFACE';
export const TW_CREATE_SURFACE_SUCCESS = 'TW_CREATE_SURFACE_SUCCESS';
export const TW_CREATE_SURFACE_ERROR = 'TW_CREATE_SURFACE_ERROR';

export function twCreateSurface(payload) { return { type: TW_CREATE_SURFACE, payload }; }
export function twCreateSurfaceSuccess(surface) { return { type: TW_CREATE_SURFACE_SUCCESS, surface }; }
export function twCreateSurfaceError(error) { return { type: TW_CREATE_SURFACE_ERROR, error }; }

// ── Update surface (PATCH params) ──────────────────────────────────────────

export const TW_UPDATE_SURFACE = 'TW_UPDATE_SURFACE';
export const TW_UPDATE_SURFACE_SUCCESS = 'TW_UPDATE_SURFACE_SUCCESS';
export const TW_UPDATE_SURFACE_ERROR = 'TW_UPDATE_SURFACE_ERROR';

export function twUpdateSurface(surfaceId, payload) {
    return { type: TW_UPDATE_SURFACE, surfaceId, payload };
}
export function twUpdateSurfaceSuccess(surface) { return { type: TW_UPDATE_SURFACE_SUCCESS, surface }; }
export function twUpdateSurfaceError(error) { return { type: TW_UPDATE_SURFACE_ERROR, error }; }

// ── Delete surface ─────────────────────────────────────────────────────────

export const TW_DELETE_SURFACE = 'TW_DELETE_SURFACE';
export const TW_DELETE_SURFACE_SUCCESS = 'TW_DELETE_SURFACE_SUCCESS';
export const TW_DELETE_SURFACE_ERROR = 'TW_DELETE_SURFACE_ERROR';

export function twDeleteSurface(surfaceId) { return { type: TW_DELETE_SURFACE, surfaceId }; }
export function twDeleteSurfaceSuccess(surfaceId) { return { type: TW_DELETE_SURFACE_SUCCESS, surfaceId }; }
export function twDeleteSurfaceError(error) { return { type: TW_DELETE_SURFACE_ERROR, error }; }

// ── Design inputs ──────────────────────────────────────────────────────────

export const TW_SET_DESIGN_INPUTS = 'TW_SET_DESIGN_INPUTS';
export const TW_SET_DESIGN_INPUTS_SUCCESS = 'TW_SET_DESIGN_INPUTS_SUCCESS';
export const TW_SET_DESIGN_INPUTS_ERROR = 'TW_SET_DESIGN_INPUTS_ERROR';

export function twSetDesignInputs(surfaceId, designInputs) {
    return { type: TW_SET_DESIGN_INPUTS, surfaceId, designInputs };
}
export function twSetDesignInputsSuccess(surface) {
    return { type: TW_SET_DESIGN_INPUTS_SUCCESS, surface };
}
export function twSetDesignInputsError(error) { return { type: TW_SET_DESIGN_INPUTS_ERROR, error }; }

// ── Derive (TASK-1671: atomic — inputs + params in body) ───────────────────

export const TW_DERIVE = 'TW_DERIVE';
export const TW_DERIVE_SUCCESS = 'TW_DERIVE_SUCCESS';
export const TW_DERIVE_ERROR = 'TW_DERIVE_ERROR';
export const TW_DERIVE_COMPLETE = 'TW_DERIVE_COMPLETE';
export const TW_DERIVE_COMPLETE_ERROR = 'TW_DERIVE_COMPLETE_ERROR';

// TASK-1671: twDerive now carries the full derive body (inputs + params).
// surfaceId is kept for process polling; body is forwarded to the API.
export function twDerive(surfaceId, body) { return { type: TW_DERIVE, surfaceId, body }; }
export function twDeriveSuccess(surfaceId, processId) {
    return { type: TW_DERIVE_SUCCESS, surfaceId, processId };
}
export function twDeriveError(error) { return { type: TW_DERIVE_ERROR, error }; }
export function twDeriveComplete(surface) { return { type: TW_DERIVE_COMPLETE, surface }; }
export function twDeriveCompleteError(error) { return { type: TW_DERIVE_COMPLETE_ERROR, error }; }

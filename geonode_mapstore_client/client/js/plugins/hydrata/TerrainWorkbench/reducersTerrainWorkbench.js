/**
 * TASK-1599 / TASK-1600 (W1) — TerrainWorkbench reducer.
 *
 * State shape:
 *   activeSection: 'terrain' | 'delineation' | 'catchments'
 *   visible: bool
 *
 *   -- Recipe state (TASK-1600) --
 *   terrains: []          — project terrain rows (for pickers)
 *   surfaces: []          — project AnalysisSurface rows
 *   selectedSurfaceId: null | number
 *   loading: bool
 *   error: null | string
 *   saving: bool          — PATCH/POST in flight
 *   saveError: null | string
 *   derivingProcessId: null | number   — TaskMonitor process id while derive in flight
 *   deriving: bool        — derive POST in flight or TaskMonitor not yet complete
 *   deriveError: null | string
 *   deriveCoarserPairs: null | [{above,below}]  — TASK-2970: server-refused stack
 */
import {
    TERRAIN_WORKBENCH_SET_SECTION,
    TERRAIN_WORKBENCH_SET_VISIBLE,
    TW_LOAD_DATA,
    TW_LOAD_DATA_SUCCESS,
    TW_LOAD_DATA_ERROR,
    TW_SELECT_SURFACE,
    TW_CREATE_SURFACE,
    TW_CREATE_SURFACE_SUCCESS,
    TW_CREATE_SURFACE_ERROR,
    TW_UPDATE_SURFACE,
    TW_UPDATE_SURFACE_SUCCESS,
    TW_UPDATE_SURFACE_ERROR,
    TW_DELETE_SURFACE,
    TW_DELETE_SURFACE_SUCCESS,
    TW_DELETE_SURFACE_ERROR,
    TW_SET_DESIGN_INPUTS,
    TW_SET_DESIGN_INPUTS_SUCCESS,
    TW_SET_DESIGN_INPUTS_ERROR,
    TW_DERIVE,
    TW_DERIVE_SUCCESS,
    TW_DERIVE_ERROR,
    TW_DERIVE_COARSER_ACK,
    TW_DERIVE_COMPLETE,
    TW_DERIVE_COMPLETE_ERROR,
    TW_SET_MERGE_EXTENT_DRAWING,
    TW_SET_MERGE_EXTENT
} from './actionsTerrainWorkbench';

const defaultState = {
    activeSection: 'terrain',
    visible: false,
    // Recipe state
    terrains: [],
    surfaces: [],
    selectedSurfaceId: null,
    loading: false,
    error: null,
    saving: false,
    saveError: null,
    derivingProcessId: null,
    deriving: false,
    deriveError: null,
    // TASK-2970 (W3.7) — the SERVER's coarser-above-finer pairs from a refused
    // derive (400 COARSER_ABOVE_FINER), which re-open the confirm dialog seeded
    // with them. null = nothing to acknowledge. Cleared the moment a new derive
    // starts or succeeds, so a later unrelated derive can never re-open the
    // dialog on a dead pair list.
    deriveCoarserPairs: null,
    // TASK-2582 (W2a) — Merge extent: client-side-only draw state.
    // mergeExtent: WGS84 [minLon, minLat, maxLon, maxLat] | null (null = full union).
    mergeExtentDrawing: false,
    mergeExtent: null
};

/** Merge an updated surface into the surfaces list by id. */
function mergeSurface(surfaces, updated) {
    const idx = surfaces.findIndex(s => s.id === updated.id);
    if (idx === -1) return [...surfaces, updated];
    return surfaces.map(s => s.id === updated.id ? updated : s);
}

export default function terrainWorkbench(state = defaultState, action = {}) {
    switch (action.type) {
    // ── Shell ──────────────────────────────────────────────────────────
    case TERRAIN_WORKBENCH_SET_SECTION:
        return { ...state, activeSection: action.section };
    case TERRAIN_WORKBENCH_SET_VISIBLE:
        return { ...state, visible: action.visible };

    // ── Load ───────────────────────────────────────────────────────────
    case TW_LOAD_DATA:
        return { ...state, loading: true, error: null };
    case TW_LOAD_DATA_SUCCESS:
        return {
            ...state,
            loading: false,
            terrains: action.terrains,
            surfaces: action.surfaces
        };
    case TW_LOAD_DATA_ERROR:
        return { ...state, loading: false, error: action.error };

    // ── Select ─────────────────────────────────────────────────────────
    case TW_SELECT_SURFACE:
        return { ...state, selectedSurfaceId: action.surfaceId, deriveError: null };

    // ── Create ─────────────────────────────────────────────────────────
    case TW_CREATE_SURFACE:
        return { ...state, saving: true, saveError: null };
    case TW_CREATE_SURFACE_SUCCESS:
        return {
            ...state,
            saving: false,
            surfaces: [...state.surfaces, action.surface],
            selectedSurfaceId: action.surface.id
        };
    case TW_CREATE_SURFACE_ERROR:
        return { ...state, saving: false, saveError: action.error };

    // ── Update ─────────────────────────────────────────────────────────
    case TW_UPDATE_SURFACE:
        return { ...state, saving: true, saveError: null };
    case TW_UPDATE_SURFACE_SUCCESS:
        return {
            ...state,
            saving: false,
            surfaces: mergeSurface(state.surfaces, action.surface)
        };
    case TW_UPDATE_SURFACE_ERROR:
        return { ...state, saving: false, saveError: action.error };

    // ── Delete ─────────────────────────────────────────────────────────
    case TW_DELETE_SURFACE:
        return { ...state, saving: true, saveError: null };
    case TW_DELETE_SURFACE_SUCCESS:
        return {
            ...state,
            saving: false,
            surfaces: state.surfaces.filter(s => s.id !== action.surfaceId),
            selectedSurfaceId: state.selectedSurfaceId === action.surfaceId
                ? null
                : state.selectedSurfaceId
        };
    case TW_DELETE_SURFACE_ERROR:
        return { ...state, saving: false, saveError: action.error };

    // ── Design inputs ──────────────────────────────────────────────────
    case TW_SET_DESIGN_INPUTS:
        return { ...state, saving: true, saveError: null };
    case TW_SET_DESIGN_INPUTS_SUCCESS:
        return {
            ...state,
            saving: false,
            surfaces: mergeSurface(state.surfaces, action.surface)
        };
    case TW_SET_DESIGN_INPUTS_ERROR:
        return { ...state, saving: false, saveError: action.error };

    // ── Derive ─────────────────────────────────────────────────────────
    case TW_DERIVE:
        return {
            ...state,
            deriving: true,
            deriveError: null,
            derivingProcessId: null,
            deriveCoarserPairs: null
        };
    case TW_DERIVE_SUCCESS:
        // UAT 2026-07-30: derive accepted (202 + process_id) — the TaskMonitor
        // owns progress from here, so close the Combined-surface panel. The
        // ERROR case deliberately keeps visible untouched: the panel hosts the
        // derive ErrorStrip and must stay open to show a failure.
        return {
            ...state,
            deriving: true,
            derivingProcessId: action.processId,
            visible: false,
            deriveCoarserPairs: null
        };
    case TW_DERIVE_ERROR:
        return { ...state, deriving: false, deriveError: action.error };
    // TASK-2970 (W3.7): a REFUSED derive, not a failed one. Deliberately leaves
    // deriveError null — a red "Derive failed" strip behind a dialog offering
    // "Derive anyway" reads as a bug. The dialog carries the whole explanation.
    case TW_DERIVE_COARSER_ACK:
        return {
            ...state,
            deriving: false,
            deriveError: null,
            derivingProcessId: null,
            deriveCoarserPairs: action.pairs || null
        };
    case TW_DERIVE_COMPLETE:
        return {
            ...state,
            deriving: false,
            derivingProcessId: null,
            surfaces: mergeSurface(state.surfaces, action.surface)
        };
    case TW_DERIVE_COMPLETE_ERROR:
        return { ...state, deriving: false, deriveError: action.error };

    // ── Merge extent (TASK-2582, W2a) ───────────────────────────────────
    case TW_SET_MERGE_EXTENT_DRAWING:
        return { ...state, mergeExtentDrawing: action.active };
    case TW_SET_MERGE_EXTENT:
        // Setting (drawn) OR clearing (Clear -> null) both end the draw.
        return { ...state, mergeExtent: action.extent, mergeExtentDrawing: false };

    default:
        return state;
    }
}

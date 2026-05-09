import {
    SET_ANUGA_TERRAIN_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_STRUCTURE_DATA,
    SET_ANUGA_FULL_MESH_DATA,
    SET_ANUGA_MESH_REGION_DATA,
    SET_NETWORK_DATA,
    SET_LUMPED_CATCHMENT_DATA,
    SET_ANUGA_NODES_DATA,
    SET_ANUGA_LINKS_DATA,
    SET_PUBLICATION_DATA,
    SET_COMPARISON_DATA,
    UPDATE_COMPUTE_INSTANCE_SUCCESS,
    UPDATE_NETWORK,
    SET_ANUGA_RESOURCE_PERMS,
    SET_PERMS_LOAD_FAILED,
    DELETE_TERRAIN,
    DELETE_TERRAIN_SUCCESS,
    DELETE_TERRAIN_BLOCKED,
    DELETE_TERRAIN_ERROR,
    DELETE_BOUNDARY,
    DELETE_BOUNDARY_SUCCESS,
    DELETE_BOUNDARY_BLOCKED,
    DELETE_BOUNDARY_ERROR,
    DELETE_FRICTION,
    DELETE_FRICTION_SUCCESS,
    DELETE_FRICTION_BLOCKED,
    DELETE_FRICTION_ERROR,
    DELETE_INFLOW,
    DELETE_INFLOW_SUCCESS,
    DELETE_INFLOW_BLOCKED,
    DELETE_INFLOW_ERROR
} from "../actionsAnuga";

// V2P-21 — map BE (kebab-case) resource_type keys to FE (camelCase plural)
// reducer slot names. Backend returns mesh-regions/full-meshes/compute-instances/
// idf-tables/time-series/temporal-patterns; FE state uses meshRegions/fullMeshes/
// computeInstances. Anything not in this table gets passed through verbatim
// (so 'scenarios', 'terrain', 'boundaries', etc. just-work).
//
// Two BE keys (members, runs) have no resourcesReducer slot — we skip them
// (memberships live in their own membershipsReducer; runs live in runsReducer
// keyed byId, not this resources slice). Hydrology types (idf-tables/time-series/
// temporal-patterns) ALSO have no slot today; we still write them to the
// camelCase key so V2P-02 helpers reading state.anuga.resources.idfTables work
// once any consumer registers them.
const _BE_TO_FE_KEY = {
    'mesh-regions': 'meshRegions',
    'full-meshes': 'fullMeshes',
    'compute-instances': 'computeInstances',
    'idf-tables': 'idfTables',
    'time-series': 'timeSeries',
    'temporal-patterns': 'temporalPatterns'
};

// Top-level keys in the my_perms payload that are NOT resource_type slots.
const _NON_RESOURCE_KEYS = new Set(['my_role', 'visibility']);

// Skip these resource_type keys — they don't map to the resources reducer
// slice. (members lives in membershipsReducer; runs lives in runsReducer.)
const _SKIP_RESOURCE_KEYS = new Set(['members', 'runs']);

const initialState = {
    terrain: [],
    // V2P-714 sibling-orphan: distinguish "not yet loaded" from "loaded
    // and empty". Without this signal, orphanStatus in pollingEpics can't
    // tell whether terrain.length===0 means BE-truly-empty (every legacy
    // terrain_create Process IS orphaned) or just-not-fetched-yet (the
    // first completed terrain_create on a fresh load).
    terrainLoaded: false,
    boundaries: [],
    frictions: [],
    inflows: [],
    structures: [],
    fullMeshes: [],
    meshRegions: [],
    networks: [],
    catchments: [],
    nodes: [],
    links: [],
    publications: [],
    comparisons: [],
    computeInstances: []
};

// V2P-714 helpers — mutate per-row delete state without dropping the row.
function _markDeleting(rows, id) {
    return (rows || []).map(r => r?.id === id
        ? { ...r, deleting: true, blockingError: null, deleteError: null }
        : r
    );
}

function _markBlocked(rows, id, message, blocking) {
    return (rows || []).map(r => r?.id === id
        ? {
            ...r,
            deleting: false,
            blockingError: { message: message || '', blocking: Array.isArray(blocking) ? blocking : [] },
            deleteError: null
        }
        : r
    );
}

function _markError(rows, id, error) {
    return (rows || []).map(r => r?.id === id
        ? { ...r, deleting: false, blockingError: null, deleteError: error || { message: 'Delete failed' } }
        : r
    );
}

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_TERRAIN_DATA:
        return { ...state, terrain: action.data, terrainLoaded: true };
    case SET_ANUGA_BOUNDARY_DATA:
        return { ...state, boundaries: action.data };
    case SET_ANUGA_FRICTION_DATA:
        return { ...state, frictions: action.data };
    case SET_ANUGA_INFLOW_DATA:
        return { ...state, inflows: action.data };
    case SET_ANUGA_STRUCTURE_DATA:
        return { ...state, structures: action.data };
    case SET_ANUGA_FULL_MESH_DATA:
        return { ...state, fullMeshes: action.data };
    case SET_ANUGA_MESH_REGION_DATA:
        return { ...state, meshRegions: action.data };
    case SET_NETWORK_DATA:
        return { ...state, networks: action.data };
    case SET_LUMPED_CATCHMENT_DATA:
        return { ...state, catchments: action.data };
    case SET_ANUGA_NODES_DATA:
        return { ...state, nodes: action.data };
    case SET_ANUGA_LINKS_DATA:
        return { ...state, links: action.data };
    case SET_PUBLICATION_DATA:
        return { ...state, publications: action.data };
    case SET_COMPARISON_DATA:
        return { ...state, comparisons: action.data };
    case UPDATE_COMPUTE_INSTANCE_SUCCESS:
        return { ...state, computeInstances: action.data };
    case UPDATE_NETWORK:
        return {
            ...state,
            networks: state.networks.map((network) => {
                if (network.id === action.network.id) {
                    return { ...action.network, unsaved: true };
                }
                return network;
            })
        };
    case SET_ANUGA_RESOURCE_PERMS: {
        // V2P-21: merge per-resource perms returned from /my-perms/ into the
        // resources slice. Per V2P-02's `_resolveResourcePerms` reading
        // contract (selectorsAnuga.js), state.anuga.resources[<type>] must be
        // an Array of {id, perms, ...} objects so .find(r => r.id === layerId)
        // hits. We preserve any existing entries (e.g. boundaries already
        // populated by SET_ANUGA_BOUNDARY_DATA) by spreading their fields and
        // overlaying perms. For ids not yet in state we create a stub
        // {id, perms} entry so the helpers see the perms even if the v1
        // list-endpoint fan-out hasn't completed yet.
        const payload = action.payload || {};
        const next = { ...state };
        Object.entries(payload).forEach(([beKey, idsToPerms]) => {
            if (_NON_RESOURCE_KEYS.has(beKey)) return; // my_role / visibility
            if (_SKIP_RESOURCE_KEYS.has(beKey)) return; // members / runs
            if (!idsToPerms || typeof idsToPerms !== 'object') return;

            const feKey = _BE_TO_FE_KEY[beKey] || beKey;
            const existing = Array.isArray(state[feKey]) ? state[feKey] : [];
            const permsByIdStr = idsToPerms; // {<idStr>: [perms]}

            // 1. Update existing entries with perms (preserve all their fields).
            const seenIds = new Set();
            const merged = existing.map((entry) => {
                if (!entry || entry.id === undefined || entry.id === null) return entry;
                const idStr = String(entry.id);
                seenIds.add(idStr);
                if (Object.prototype.hasOwnProperty.call(permsByIdStr, idStr)) {
                    const perms = permsByIdStr[idStr];
                    return { ...entry, perms: Array.isArray(perms) ? perms : [] };
                }
                // No perms returned for this id — V2P-15 contract: empty {} for
                // anon, full perms for authenticated, so a missing id usually
                // means the resource doesn't exist on the BE side. Leave perms
                // untouched to avoid clobbering an in-flight v1 fetch.
                return entry;
            });

            // 2. Stub-add ids that are in the perms payload but not yet in
            //    state (the FE may have opened the panel before the v1
            //    fan-out finished, and V2P-02 helpers should still find perms).
            Object.entries(permsByIdStr).forEach(([idStr, perms]) => {
                if (seenIds.has(idStr)) return;
                const numericId = parseInt(idStr, 10);
                if (Number.isNaN(numericId)) return;
                merged.push({
                    id: numericId,
                    perms: Array.isArray(perms) ? perms : []
                });
            });

            next[feKey] = merged;
        });
        // Successful set => clear any prior failure flag.
        next.permsLoadFailed = false;
        return next;
    }
    case SET_PERMS_LOAD_FAILED:
        return { ...state, permsLoadFailed: !!action.failed };
    // V2P-714 — cascade-delete dataset rows. Each pair is (start, success,
    // blocked, error). On start we set deleting:true on the row. On success
    // we drop the row entirely; on blocked/error we clear deleting and stamp
    // a per-row error so the SimpleView row component can render inline.
    case DELETE_TERRAIN:
        return { ...state, terrain: _markDeleting(state.terrain, action.id) };
    case DELETE_TERRAIN_SUCCESS:
        return { ...state, terrain: (state.terrain || []).filter(r => r?.id !== action.id) };
    case DELETE_TERRAIN_BLOCKED:
        return { ...state, terrain: _markBlocked(state.terrain, action.id, action.message, action.blocking) };
    case DELETE_TERRAIN_ERROR:
        return { ...state, terrain: _markError(state.terrain, action.id, action.error) };
    case DELETE_BOUNDARY:
        return { ...state, boundaries: _markDeleting(state.boundaries, action.id) };
    case DELETE_BOUNDARY_SUCCESS:
        return { ...state, boundaries: (state.boundaries || []).filter(r => r?.id !== action.id) };
    case DELETE_BOUNDARY_BLOCKED:
        return { ...state, boundaries: _markBlocked(state.boundaries, action.id, action.message, action.blocking) };
    case DELETE_BOUNDARY_ERROR:
        return { ...state, boundaries: _markError(state.boundaries, action.id, action.error) };
    case DELETE_FRICTION:
        return { ...state, frictions: _markDeleting(state.frictions, action.id) };
    case DELETE_FRICTION_SUCCESS:
        return { ...state, frictions: (state.frictions || []).filter(r => r?.id !== action.id) };
    case DELETE_FRICTION_BLOCKED:
        return { ...state, frictions: _markBlocked(state.frictions, action.id, action.message, action.blocking) };
    case DELETE_FRICTION_ERROR:
        return { ...state, frictions: _markError(state.frictions, action.id, action.error) };
    case DELETE_INFLOW:
        return { ...state, inflows: _markDeleting(state.inflows, action.id) };
    case DELETE_INFLOW_SUCCESS:
        return { ...state, inflows: (state.inflows || []).filter(r => r?.id !== action.id) };
    case DELETE_INFLOW_BLOCKED:
        return { ...state, inflows: _markBlocked(state.inflows, action.id, action.message, action.blocking) };
    case DELETE_INFLOW_ERROR:
        return { ...state, inflows: _markError(state.inflows, action.id, action.error) };
    default:
        return state;
    }
};

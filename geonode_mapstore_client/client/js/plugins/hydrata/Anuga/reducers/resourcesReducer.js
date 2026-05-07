import {
    SET_ANUGA_ELEVATION_DATA,
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
    SET_PERMS_LOAD_FAILED
} from "../actionsAnuga";

// V2P-21 — map BE (kebab-case) resource_type keys to FE (camelCase plural)
// reducer slot names. Backend returns mesh-regions/full-meshes/compute-instances/
// idf-tables/time-series/temporal-patterns; FE state uses meshRegions/fullMeshes/
// computeInstances. Anything not in this table gets passed through verbatim
// (so 'scenarios', 'elevations', 'boundaries', etc. just-work).
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
    elevations: [],
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

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_ELEVATION_DATA:
        return { ...state, elevations: action.data };
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
    default:
        return state;
    }
};

/**
 * V2P-23 — Shared Karma test fixture builder.
 *
 * Returns a `state.anuga.resources` slice shape matching the Redux state
 * V2P-21's reducer populates from V2P-20's /my-perms/ payload.
 *
 * Usage:
 *   const resources = makeAnugaResourceState('editor', 5);
 *   // resources.scenarios[0].perms === ['view_resourcebase', ..., 'delete_resourcebase']
 *
 * The output's per-id list of perm strings matches what
 * gn_anuga.sync._ROLE_PERMS would resolve to for that role.
 *
 * Resource type names are camelCase as produced by the V2P-21 reducer's
 * BE-to-FE key map (resourcesReducer.js _BE_TO_FE_KEY):
 *   mesh-regions    -> meshRegions
 *   full-meshes     -> fullMeshes
 *   compute-instances -> computeInstances   (no perms — special-case V2P-12b)
 *   idf-tables      -> idfTables
 *   time-series     -> timeSeries
 *   temporal-patterns -> temporalPatterns
 * Straight-through types (no mapping needed): scenarios, terrain, boundaries,
 * inflows, frictions, structures, networks, catchments, nodes, links, comparisons,
 * publications.
 *
 * compute-instances is included in RESOURCE_TYPES so the fixture key exists, but
 * per V2P-12b it is a global (not per-project) resource — the BE /my-perms/
 * payload never returns per-id perms for it. Its array entries are therefore
 * produced with empty perms regardless of role.
 */

// Role -> perm-string set. Mirrors gn_anuga.sync._ROLE_PERMS exactly.
export const ROLE_PERMS = {
    viewer: ['view_resourcebase', 'download_resourcebase'],
    contributor: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase'],
    editor: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase'],
    manager: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase', 'change_resourcebase_permissions'],
    owner: ['view_resourcebase', 'download_resourcebase', 'change_resourcebase', 'delete_resourcebase', 'change_resourcebase_permissions']
};

// camelCase keys that appear in state.anuga.resources, derived from the
// V2P-21 reducer's initialState + _BE_TO_FE_KEY pass-through comment.
// 'members' and 'runs' are skipped (they live in their own reducer slices).
// 'computeInstances' is listed but always gets empty perms (V2P-12b).
const RESOURCE_TYPES = [
    'scenarios',
    'terrain',
    'boundaries',
    'inflows',
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow). Added to the
    // fixture so V2P-21 my-perms reducer + V2P-02 helper tests have a slot to
    // populate; otherwise components reading state.anuga.resources.rainfalls
    // hit undefined under tests that build state via makeAnugaResourceState.
    'rainfalls',
    'frictions',
    'structures',
    'meshRegions',
    'fullMeshes',
    'networks',
    'catchments',
    'nodes',
    'links',
    'comparisons',
    'publications',
    'computeInstances',
    'idfTables',
    'timeSeries',
    'temporalPatterns'
];

// computeInstances is a global resource (V2P-12b) — the BE never returns
// per-id perms for it in /my-perms/; always use empty perms for that slot.
const _GLOBAL_TYPES = new Set(['computeInstances']);

/**
 * Build a state.anuga.resources slice.
 *
 * @param {string} role - One of 'viewer'|'contributor'|'editor'|'manager'|'owner'.
 *   Unknown roles produce entries with empty perms arrays.
 * @param {number} [layerCount=1] - Number of stub entries to create per type.
 *   Use 0 to test empty-slice consumers.
 * @returns {Object} state.anuga.resources shape — one key per RESOURCE_TYPES
 *   entry, each an Array of {id, perms} objects.
 */
export function makeAnugaResourceState(role, layerCount = 1) {
    const perms = ROLE_PERMS[role] || [];
    const resources = {};
    RESOURCE_TYPES.forEach(type => {
        const typePerms = _GLOBAL_TYPES.has(type) ? [] : perms;
        resources[type] = Array.from({ length: layerCount }, (_, i) => ({
            id: i + 1,
            perms: [...typePerms]  // fresh list per id so caller mutations don't leak
        }));
    });
    return resources;
}

/**
 * Build the full state.anuga shape for use in Redux-connected component tests.
 *
 * @param {string} role - Same as makeAnugaResourceState.
 * @param {number} [layerCount=1] - Same as makeAnugaResourceState.
 * @returns {Object} { anuga: { resources, project, permsLoadFailed } }
 */
export function makeAnugaState(role, layerCount = 1) {
    return {
        anuga: {
            resources: makeAnugaResourceState(role, layerCount),
            project: { data: { my_role: role } },
            permsLoadFailed: false
        }
    };
}

import {createSelector} from 'reselect';
import {TERMINAL_RUN_STATES} from './anugaConstants';

// -- Permission selectors (project-level RBAC via my_role) -----------------

/**
 * Returns the current user's role on the active ANUGA project.
 * Values: "owner" | "manager" | "editor" | "contributor" | "viewer" | null
 * Source: ProjectSerializer.my_role (computed server-side from ProjectMembership)
 */
export const getProjectMyRole = (state) =>
    state?.anuga?.projects?.data?.my_role || null;

export const getProjectVisibility = (state) =>
    state?.anuga?.projects?.data?.visibility || null;

// Legacy selectors — now read from project my_role instead of gnresource
export const canViewAnugaMap = (state) =>
    getProjectMyRole(state) !== null;

export const canEditAnugaMap = (state) =>
    ["owner", "manager", "editor"].includes(getProjectMyRole(state));

export const canManageAnugaMap = (state) =>
    ["owner", "manager"].includes(getProjectMyRole(state));

export const isOwnerAnugaMap = (state) =>
    getProjectMyRole(state) === "owner";

export const canCreateScenario = (state) =>
    ["owner", "manager", "editor", "contributor"].includes(getProjectMyRole(state));

export const canRunScenario = (state) =>
    ["owner", "manager", "editor", "contributor"].includes(getProjectMyRole(state));

export const canManageMembers = (state) =>
    ["owner", "manager"].includes(getProjectMyRole(state));

/**
 * Pure helper — same logic as canEditScenario without a state dependency.
 * Useful in connected components that already have role + user pk as props,
 * so each row can decide without forcing re-renders via fresh closures.
 */
export const canEditScenarioByRole = (role, currentUserId, scenarioOwnerId) => {
    if (["owner", "manager", "editor"].includes(role)) return true;
    if (role === "contributor") {
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (scenarioOwnerId == null) return true;
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        return currentUserId != null && scenarioOwnerId === currentUserId;
    }
    return false;
};

/**
 * Editor+ can edit any scenario; Contributor can edit only scenarios they created.
 * scenarioOwnerId is the Scenario.created_by user pk from the V2 serializer.
 * Pass null/undefined for unsaved scenarios — Contributor is treated as the implicit creator.
 */
export const canEditScenario = (state, scenarioOwnerId) =>
    canEditScenarioByRole(getProjectMyRole(state), state?.security?.user?.pk, scenarioOwnerId);

// -- Membership selectors --------------------------------------------------

export const getMemberships = (state) =>
    state?.anuga?.memberships?.data || [];

export const getMembershipsLoading = (state) =>
    state?.anuga?.memberships?.loading || false;

// -- Scenario selectors (normalized byId/allIds, memoized) ------------------

const getScenariosByIdRaw = (state) => state?.anuga?.scenarios?.byId || {};
const getAllIdsRaw = (state) => state?.anuga?.scenarios?.allIds || [];

/**
 * Get all scenarios as a sorted array (by id ascending). Memoized.
 */
export const getScenariosArray = createSelector(
    [getScenariosByIdRaw, getAllIdsRaw],
    (byId, allIds) => allIds.map(id => byId[id]).filter(Boolean).sort((a, b) => {
        const aId = a.id || 0;
        const bId = b.id || 0;
        return aId - bId;
    })
);

export const getScenarioById = (state, id) => {
    return state?.anuga?.scenarios?.byId?.[id] || null;
};

export const selectedScenarios = createSelector(
    [getScenariosArray],
    (scenarios) => scenarios.filter(scenario => scenario?.selected)
);

export const getSelectedScenario = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    if (!selectedId) return null;
    return state?.anuga?.scenarios?.byId?.[selectedId] || null;
};

// -- Resource selectors (read from anuga.resources) -------------------------

const modelTypesToApiName = {
    terrain: 'terrain',
    boundaries: 'boundary',
    frictions: 'friction',
    inflows: 'inflow',
    meshRegions: 'mesh-region',
    structures: 'structure',
    catchments: 'catchment',
    nodes: 'nodes',
    links: 'links'
};
const modelTypes = Object.keys(modelTypesToApiName);

export const getAnugaModels = (state) => {
    const modelsArray = [];
    modelTypes.forEach(anugaModel => {
        const items = state?.anuga?.resources?.[anugaModel] || [];
        items.forEach(instance => {
            modelsArray.push({...instance, apiKey: modelTypesToApiName[anugaModel]});
        });
    });
    return modelsArray;
};

// -- Run selectors ----------------------------------------------------------

export const getActiveRuns = (state) => {
    const byId = state?.anuga?.runs?.byId || {};
    return Object.values(byId).filter(run => !TERMINAL_RUN_STATES.includes(run?.status));
};

// -- Project selectors ------------------------------------------------------

export const getProjectData = (state) => state?.anuga?.projects?.data || null;
export const getProjectId = (state) => state?.anuga?.projects?.data?.id || null;

// -- Per-layer permission helpers (V2P-02) ---------------------------------
//
// Read order (defence-in-depth): per-resource state.anuga.resources Redux
// slice (lazy-populated by anuga GET fans-out, see V2P-21) -> layer.perms
// (V2P-01 spread from MapLayer.dataset blob) -> project my_role (gate of
// last resort). Returning true if ANY level grants the perm.
//
// Forward-compat: if state.anuga.resources[type] is undefined OR the
// matching id is missing (lazy-fetch hasn't completed yet) we fall back to
// layer.perms + my_role rather than denying. This matches V2P-15's
// "transient lookup failure must not lock owners out" rule.
//
// All helpers take currentUserId so the Contributor+ownership rule from
// canEditScenarioByRole extends naturally to nested resources (Boundary /
// Inflow / Friction / Structure layers attached to a scenario).
//
// IMPORTANT: state.anuga.resources is shaped as `{type: [array, ...]}` per
// resourcesReducer.js, NOT a byId map. We .find() by id when a resource
// type is supplied. The conventional `resourceType` keys live in
// modelTypesToApiName (terrain, boundaries, frictions, inflows,
// meshRegions, structures, catchments, nodes, links).

const _resolveResourcePerms = (layer, anugaResources) => {
    const resourceType = layer?.resourceType;
    const layerId = layer?.id;
    if (resourceType && layerId !== undefined && Array.isArray(anugaResources?.[resourceType])) {
        const match = anugaResources[resourceType].find(r => r?.id === layerId);
        if (match?.perms) return match.perms;
    }
    return layer?.perms || [];
};

const _isAuthenticated = (myRole) => myRole && myRole !== 'anonymous';

/**
 * Pure helper: can the current user edit this layer?
 * Mirrors canEditScenarioByRole's role rules but accepts layer-level perms
 * as additional input. Editor / Manager / Owner: always yes; Contributor:
 * only when they own the layer; Viewer: only via explicit perm grant.
 */
export const canEditLayer = (layer, anugaResources, myRole, currentUserId) => {
    const perms = _resolveResourcePerms(layer, anugaResources);
    if (perms.indexOf('change_resourcebase') !== -1) return true;
    if (['owner', 'manager', 'editor'].includes(myRole)) return true;
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (myRole === 'contributor' && currentUserId != null && layer?.owner === currentUserId) return true;
    return false;
};

/**
 * Pure helper: can the current user delete this layer?
 * Editor+ always; Contributor never (delete requires manager+ or explicit
 * delete_resourcebase perm). Matches existing simpleViewMenuRow gate which
 * only allowed Owner/Manager/explicit-perm to delete.
 */
export const canDeleteLayer = (layer, anugaResources, myRole, currentUserId) => {
    const perms = _resolveResourcePerms(layer, anugaResources);
    if (perms.indexOf('delete_resourcebase') !== -1) return true;
    if (['owner', 'manager', 'editor'].includes(myRole)) return true;
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (myRole === 'contributor' && currentUserId != null && layer?.owner === currentUserId) return true;
    return false;
};

/**
 * Pure helper: can the current user download this layer?
 * Any authenticated role can download; explicit download_resourcebase grant
 * also opens the door (e.g. for anonymous downloads on public datasets).
 */
export const canDownloadLayer = (layer, anugaResources, myRole, _currentUserId) => {
    const perms = _resolveResourcePerms(layer, anugaResources);
    if (perms.indexOf('download_resourcebase') !== -1) return true;
    if (_isAuthenticated(myRole)) return true;
    return false;
};

// -- State-shaped wrappers (V2P-02) ----------------------------------------
// Pull myRole + currentUserId + anugaResources from the Redux store and
// delegate to the pure helpers above. Use these in mapStateToProps; use the
// pure helpers in render hot paths where the props are already wired.

export const canEditLayerSelector = (state, layer) => canEditLayer(
    layer,
    state?.anuga?.resources,
    getProjectMyRole(state),
    state?.security?.user?.pk
);

export const canDeleteLayerSelector = (state, layer) => canDeleteLayer(
    layer,
    state?.anuga?.resources,
    getProjectMyRole(state),
    state?.security?.user?.pk
);

export const canDownloadLayerSelector = (state, layer) => canDownloadLayer(
    layer,
    state?.anuga?.resources,
    getProjectMyRole(state),
    state?.security?.user?.pk
);

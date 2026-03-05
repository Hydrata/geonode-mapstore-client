import {createSelector} from 'reselect';

// -- Permission selectors (unchanged — read from gnresource) ----------------

const getCurrentUserPerm = (state) => {
    const currentUserId = state?.security?.user?.pk;
    return state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
};

export const canViewAnugaMap = (state) =>
    ["view", "edit", "manage", "owner"].includes(getCurrentUserPerm(state));

export const canEditAnugaMap = (state) =>
    ["edit", "manage", "owner"].includes(getCurrentUserPerm(state));

export const canManageAnugaMap = (state) =>
    ["manage", "owner"].includes(getCurrentUserPerm(state));

export const isOwnerAnugaMap = (state) =>
    ["owner"].includes(getCurrentUserPerm(state));

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
    elevations: 'elevation',
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
    const terminalStates = ['complete', 'error', 'cancelled'];
    return Object.values(byId).filter(run => !terminalStates.includes(run?.status));
};

// -- Project selectors ------------------------------------------------------

export const getProjectData = (state) => state?.anuga?.projects?.data || null;
export const getProjectId = (state) => state?.anuga?.projects?.data?.id || null;

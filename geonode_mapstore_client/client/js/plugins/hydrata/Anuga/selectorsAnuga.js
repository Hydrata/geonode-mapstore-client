
// -- Permission selectors (unchanged — read from gnresource) ----------------

export const canViewAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["view", "edit", "manage", "owner"].includes(currentUserPerm);
};

export const canEditAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["edit", "manage", "owner"].includes(currentUserPerm);
};

export const canManageAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["manage", "owner"].includes(currentUserPerm);
};

export const isOwnerAnugaMap = (state) => {
    const currentUserId = state?.security?.user?.pk;
    const currentUserPerm = state?.gnresource?.compactPermissions?.users?.filter(user => user.id === currentUserId)[0]?.permissions;
    return ["owner"].includes(currentUserPerm);
};

// -- Scenario selectors (normalized byId/allIds) ----------------------------

/**
 * Get all scenarios as a sorted array (by id ascending).
 */
export const getScenariosArray = (state) => {
    const byId = state?.anuga?.scenarios?.byId || {};
    const allIds = state?.anuga?.scenarios?.allIds || [];
    return allIds.map(id => byId[id]).filter(Boolean).sort((a, b) => {
        const aId = a.id || 0;
        const bId = b.id || 0;
        return aId - bId;
    });
};

export const getScenarioById = (state, id) => {
    return state?.anuga?.scenarios?.byId?.[id] || null;
};

export const selectedScenarios = (state) => {
    return getScenariosArray(state).filter(scenario => scenario?.selected);
};

export const getSelectedScenario = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    if (!selectedId) return null;
    return state?.anuga?.scenarios?.byId?.[selectedId] || null;
};

// -- Resource selectors (read from anuga.resources) -------------------------

export const getAnugaModels = (state) => {
    const modelTypes = [
        'elevations',
        'boundaries',
        'frictions',
        'inflows',
        'meshRegions',
        'structures',
        'catchments',
        'nodes',
        'links'
    ];
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
    let modelsArray = Array();
    modelTypes.map(anugaModel => {
        const items = state?.anuga?.resources?.[anugaModel] || [];
        items.map(instance => {
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

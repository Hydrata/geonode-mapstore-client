// Barrel re-export — all epics split into polling + CRUD groups
export {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
    pollComparisonEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    addAnugaInflowEpic,
    addAnugaStructureEpic,
    addAnugaFullMeshEpic,
    addAnugaMeshRegionEpic,
    addCatchmentEpic,
    addNodesEpic,
    addLinksEpic,
    addComparisonEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    anugaMapLayerGroupEpic
} from './epics/pollingEpics';

export {
    createAnugaBoundaryEpic,
    createAnugaFrictionEpic,
    createAnugaInflowEpic,
    createAnugaStructureEpic,
    createAnugaMeshRegionEpic,
    createNetworkEpic,
    createCatchmentEpic,
    createNodesEpic,
    createLinksEpic,
    deleteAnugaScenarioEpic,
    runAnugaScenarioEpic,
    cancelAnugaRunEpic,
    retryAnugaRunEpic,
    saveAnugaScenarioEpic,
    saveNetworkEpic,
    compareScenarioEpic,
    runNetworkEpic,
    updateComputeInstanceEpic,
    createFigureEpic,
    prePopulateAnugaFeatureGridWithDefaults,
    updateAnugaModelTitle,
    getAnugaResourcesEpic,
    // V2P-714 — cascade-delete dataset rows (elevation/boundary/friction/inflow)
    deleteElevationEpic,
    deleteBoundaryEpic,
    deleteFrictionEpic,
    deleteInflowEpic
} from './epics/crudEpics';

export {
    manageTerrain3DEpic
} from './epics/terrainEpics';

// V2P-21 — lazy-fetch my_perms on Anuga panel open (INIT_ANUGA trigger).
export {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
} from './epics/permsEpics';

// Barrel re-export — all epics split into polling + CRUD groups
export {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    addAnugaInflowEpic,
    addAnugaRainfallEpic,
    addAnugaStructureEpic,
    addAnugaFullMeshEpic,
    addAnugaMeshRegionEpic,
    addCatchmentEpic,
    addNodesEpic,
    addLinksEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    anugaMapLayerGroupEpic
} from './epics/pollingEpics';

export {
    createAnugaBoundaryEpic,
    createAnugaFrictionEpic,
    createAnugaInflowEpic,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    createAnugaRainfallEpic,
    createAnugaStructureEpic,
    createAnugaMeshRegionEpic,
    createNetworkEpic,
    createCatchmentEpic,
    createNodesEpic,
    createLinksEpic,
    deleteAnugaScenarioEpic,
    duplicateAnugaScenarioEpic,
    archiveAnugaScenarioEpic,
    unarchiveAnugaScenarioEpic,
    runAnugaScenarioEpic,
    cancelAnugaRunEpic,
    retryAnugaRunEpic,
    saveAnugaScenarioEpic,
    saveNetworkEpic,
    compareScenarioEpic,
    buildScenarioEpic,
    runNetworkEpic,
    updateComputeInstanceEpic,
    createFigureEpic,
    updateAnugaModelTitle,
    getAnugaResourcesEpic,
    // V2P-714 — cascade-delete dataset rows (terrain/boundary/friction/inflow)
    deleteTerrainEpic,
    deleteBoundaryEpic,
    deleteFrictionEpic,
    deleteInflowEpic,
    // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
    deleteRainfallEpic,
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    deleteStructureEpic,
    deleteMeshRegionEpic,
    deleteCatchmentEpic,
    deleteNodesEpic,
    deleteLinksEpic,
    // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
    deleteFrictionRasterEpic
} from './epics/crudEpics';

// TASK-793 — VectorDraw editor handlers for the 5 migrated Anuga prefixes
// (bdy_/inf_/fri_/mes_/str_). These replace prePopulateAnugaFeatureGridWithDefaults
// which was the legacy FeatureGrid pre-population epic.
export {
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic
} from './epics/vectorDrawAnugaEpics';

export {
    manageTerrain3DEpic
} from './epics/terrainEpics';

// V2P-21 — lazy-fetch my_perms on Anuga panel open (INIT_ANUGA trigger).
export {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
} from './epics/permsEpics';

// TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker.
export {
    terrainBboxEndDrawingEpic,
    createTerrainFromBboxEpic
} from './epics/terrainBboxEpic';

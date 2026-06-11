// Barrel re-export — all epics split into polling + CRUD groups
//
// ── TASK-1582 ANUGA layer-population inventory (epic 1578 W2) ──────────────
// Three paths populate project DATASET layers; only path 1 serves anonymous
// viewers. The login-gated "path 3" runtime injection this epic set out to
// retire is ALREADY a no-op (retired by V2P-79); the 627-class anon-blank was
// a missing-MapLayer-rows problem, fixed by the W1 backfill — not by anything
// live in here.
//
//   Path 1 (CANONICAL, auth-free): toMapStoreMapConfig maplayer merge
//     (js/utils/ResourceUtils.js:640) — load-time, sole dataset-inventory
//     populator; stamps layerConfig.group from extra_params.anuga_group.
//   Path 2 (event-driven create, editor-only): taskCompleteLayerEpic +
//     buildTerrainAddSequence (pollingEpics) + crudEpics makeCreate — addLayer
//     on TaskMonitor process completion. The live-add UX. KEEP.
//   Path 3 (RETIRED, V2P-79): /available/ polling. Now no-ops. See below.
//
// Per-epic verdict (RETIRE = redundant dataset injection; KEEP = dynamic UI):
//   initAnugaEpic ............ KEEP  login-gated; fills state.anuga.* input
//                                    panels + state.simpleView.config + scenario
//                                    /resource data. NEVER dispatches addLayer.
//   pollAnugaModelCreationEpic RETIRE(dead) no-op stub since V2P-79; listener
//                                    retained only to swallow START_ANUGA_MODEL_
//                                    CREATION_POLLING. Safe to delete (1583).
//   addAnuga*Epic x9 ......... RETIRE(dead) noOpEpic stubs (V2P-79). Safe to
//                                    delete with their START actions (1583).
//   pollAnugaScenarioEpic .... KEEP  dynamic: adds/removes scenario RESULT
//                                    layers on run completion (not inventory).
//   pollActiveRunStatusEpic .. KEEP  dynamic run-status UI; no layers.
//   ensureAnugaGroupsEpic .... KEEP  pre-seeds the ANUGA group skeleton in
//                                    state.layers.groups (FIX_ANUGA_GROUPS from
//                                    initAnuga). Login-gated; for anon, MapStore
//                                    auto-creates group nodes from the maplayer
//                                    merge's stamped layer.group paths (1584).
//   taskCompleteLayerEpic .... KEEP  path-2 event-driven addLayer (live-add).
//   anugaMapLayerGroupEpic ... KEEP  routes auto-injected maplayers into the
//                                    right ANUGA group via moveNode.
// ──────────────────────────────────────────────────────────────────────────
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
    createTerrainFromBboxEpic,
    createTerrainFromBboxErrorEpic
} from './epics/terrainBboxEpic';

// TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
export {
    demRescaleOnMoveEndEpic
} from './epics/demRescaleEpic';

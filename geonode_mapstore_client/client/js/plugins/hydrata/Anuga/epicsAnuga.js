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
//   pollAnugaModelCreationEpic REMOVED in TASK-1586 (was RETIRE(dead) no-op
//                                    stub since V2P-79).
//   addAnuga*Epic x9 ......... REMOVED in TASK-1586 (were RETIRE(dead)
//                                    noOpEpic stubs, V2P-79).
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
    // TASK-2232 — additive bootstrap recovery: hidden-tab drop (Mode A) +
    // wedged initInFlight guard (Mode B). Neither touches the initAnugaEpic
    // waterfall; both only re-offer INIT_ANUGA for a map the container
    // already requested init for.
    anugaVisibilityBootstrapEpic,
    anugaInitWatchdogEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
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
    // TASK-2194 (epic 2190 W2) — compute-target site-config hydration.
    loadAnugaComputeConfigEpic,
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
    deleteFrictionRasterEpic,
    // Self-heal: prune blob-resident ghost terrain layers (orphaned after a
    // re-derive / server-side terrain delete) on terrain-list load.
    pruneOrphanTerrainLayersEpic
} from './epics/crudEpics';

// TASK-793 — VectorDraw editor handlers for the 5 migrated Anuga prefixes
// (bdy_/inf_/fri_/mes_/str_). These replace prePopulateAnugaFeatureGridWithDefaults
// which was the legacy FeatureGrid pre-population epic.
export {
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic,
    // TASK-2165 — post-save bbox recalc (fixes zoom-to-layer planet-zoom on
    // drawn-from-scratch ANUGA layers).
    vectorDrawRecalcBboxEpic
} from './epics/vectorDrawAnugaEpics';

export {
    manageTerrain3DEpic,
    // TASK-2572 — silence a datum-shift-superseded terrain's orphan map layers.
    supersededTerrainVisibilityEpic
} from './epics/terrainEpics';

// V2P-21 — lazy-fetch my_perms on Anuga panel open (INIT_ANUGA trigger).
export {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
} from './epics/permsEpics';

// TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker.
// TASK-2327 (epic 2323) — convert an ellipsoid terrain to EGM2008.
export {
    terrainBboxEndDrawingEpic,
    createTerrainFromBboxEpic,
    createTerrainFromBboxErrorEpic,
    convertTerrainDatumEpic,
    convertTerrainDatumErrorEpic,
    ackTerrainDatumEpic
} from './epics/terrainBboxEpic';

// TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
export {
    demRescaleOnMoveEndEpic
} from './epics/demRescaleEpic';

// TASK-1856 (W3.2) — Debounced point-elevation query on MOUSE_MOVE.
export {
    cursorElevationEpic
} from './epics/cursorElevationEpic';

// TASK-1861 (W4.4) — Depth/result line-profile tool (draw-line + sampler).
// TASK-2254 (epic 2249 W2) — pickerSeedEpic seeds the checked terrain/scenario
// picker rows from map visibility on panel open.
// TASK-2276 (epic 2249 W-followup) — clearProfileLineEpic guards the Clear
// button's map-line removal to this tool's own draw owner (or idle).
// TASK-2577 — pruneSupersededCheckedTerrainsEpic drops/substitutes a checked
// terrain id that becomes superseded on a terrain-data refetch.
export {
    profileStartDrawEpic,
    profileEndDrawingEpic,
    pickerSeedEpic,
    pruneSupersededCheckedTerrainsEpic,
    clearProfileLineEpic
} from './epics/profileEpic';

// TASK-1901 (epic 1898 W2) — Canonical group-tree-order reconciler.
// Re-asserts sub-group display order on map load + layer add.
// TASK-1902 — terrain sub-order: Contour > DEM > Hillshade (via FK).
// TASK-1903 — floater ranking + intra-Results band order (latest run on top).
export {
    layerOrderReconcilerEpic,
    terrainSubOrderReconcilerEpic,
    resultsLayerOrderEpic
} from './epics/layerOrderEpics';

// TASK-1930 (W2.6) — map-OPEN GWC tile prefetch (warm visible COGs on map load).
export {
    warmTilesOnMapOpenEpic
} from './epics/warmTilesEpic';

import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
// TASK-1645 (W1.5): terrainWorkbench reducer re-homed here; plugin shell dissolved.
import terrainWorkbench from '../TerrainWorkbench/reducersTerrainWorkbench';
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    cancelAnugaRunEpic,
    retryAnugaRunEpic,
    pollActiveRunStatusEpic,
    runAnugaScenarioEpic,
    runNetworkEpic,
    saveAnugaScenarioEpic,
    saveNetworkEpic,
    pollAnugaScenarioEpic,
    deleteAnugaScenarioEpic,
    duplicateAnugaScenarioEpic,
    archiveAnugaScenarioEpic,
    unarchiveAnugaScenarioEpic,
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
    createFigureEpic,
    updateComputeInstanceEpic,
    updateAnugaModelTitle,
    compareScenarioEpic,
    getAnugaResourcesEpic,
    manageTerrain3DEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    anugaMapLayerGroupEpic,
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic,
    deleteTerrainEpic,
    deleteBoundaryEpic,
    deleteFrictionEpic,
    deleteInflowEpic,
    // TASK-955 — Rainfall cascade-delete epic.
    deleteRainfallEpic,
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    deleteStructureEpic,
    deleteMeshRegionEpic,
    deleteCatchmentEpic,
    deleteNodesEpic,
    deleteLinksEpic,
    // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
    deleteFrictionRasterEpic,
    // Self-heal: prune blob-resident ghost terrain layers on terrain load.
    pruneOrphanTerrainLayersEpic,
    // TASK-793 — VectorDraw editor handlers for migrated Anuga prefixes
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker.
    terrainBboxEndDrawingEpic,
    createTerrainFromBboxEpic,
    createTerrainFromBboxErrorEpic,
    // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
    demRescaleOnMoveEndEpic,
    // TASK-1856 (W3.2) — Debounced cursor-elevation point query.
    cursorElevationEpic,
    // TASK-1861 (W4.4) — Depth/result line-profile tool.
    profileStartDrawEpic,
    profileEndDrawingEpic,
    // TASK-1901 (epic 1898 W2) — Canonical group-tree-order reconciler.
    layerOrderReconcilerEpic,
    // TASK-1902 — terrain sub-order: Contour > DEM > Hillshade (via FK).
    terrainSubOrderReconcilerEpic,
    // TASK-1903 — floater ranking + intra-Results band order (latest run on top).
    resultsLayerOrderEpic,
    // TASK-1930 (W2.6) — map-OPEN GWC tile prefetch.
    warmTilesOnMapOpenEpic
} from "./epicsAnuga";
// TASK-1645 (W1.5): TerrainWorkbench recipe epics re-homed into Anuga plugin.
import {
    twLoadDataEpic,
    twSelectSurfaceForTerrainEpic,
    twCreateSurfaceEpic,
    twUpdateSurfaceEpic,
    twDeleteSurfaceEpic,
    twSetDesignInputsEpic,
    twDeriveEpic,
    twDeriveCompleteEpic
} from '../TerrainWorkbench/epicsTerrainWorkbench';
import {
    fetchMembershipsEpic,
    addMembershipEpic,
    updateMembershipEpic,
    deleteMembershipEpic,
    updateProjectVisibilityEpic,
    // TASK-860 — invitation epics
    fetchInvitationsEpic,
    sendInvitationEpic,
    revokeInvitationEpic,
    resendInvitationEpic
} from "./epics/membershipEpics";

export default createPlugin('Anuga', {
    component: anugaContainer,
    reducers: {
        anuga,
        // TASK-1645 (W1.5): terrainWorkbench slice registered under Anuga plugin.
        terrainWorkbench
    },
    epics: {
        initAnugaEpic,
        cancelAnugaRunEpic,
        retryAnugaRunEpic,
        pollActiveRunStatusEpic,
        runAnugaScenarioEpic,
        runNetworkEpic,
        saveAnugaScenarioEpic,
        saveNetworkEpic,
        pollAnugaScenarioEpic,
        deleteAnugaScenarioEpic,
        duplicateAnugaScenarioEpic,
        archiveAnugaScenarioEpic,
        unarchiveAnugaScenarioEpic,
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
        createFigureEpic,
        updateComputeInstanceEpic,
        updateAnugaModelTitle,
        compareScenarioEpic,
        getAnugaResourcesEpic,
        manageTerrain3DEpic,
        ensureAnugaGroupsEpic,
        taskCompleteLayerEpic,
        anugaMapLayerGroupEpic,
        fetchMembershipsEpic,
        addMembershipEpic,
        updateMembershipEpic,
        deleteMembershipEpic,
        updateProjectVisibilityEpic,
        // TASK-860 — invitation epics
        fetchInvitationsEpic,
        sendInvitationEpic,
        revokeInvitationEpic,
        resendInvitationEpic,
        triggerFetchMyPermsOnInitEpic,
        fetchMyPermsEpic,
        deleteTerrainEpic,
        deleteBoundaryEpic,
        deleteFrictionEpic,
        deleteInflowEpic,
        // TASK-955 (W2.2 FE) — Rainfall cascade-delete epic.
        deleteRainfallEpic,
        // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
        deleteStructureEpic,
        deleteMeshRegionEpic,
        deleteCatchmentEpic,
        deleteNodesEpic,
        deleteLinksEpic,
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
        deleteFrictionRasterEpic,
        // Self-heal: prune blob-resident ghost terrain layers on terrain load.
        pruneOrphanTerrainLayersEpic,
        // TASK-793 — VectorDraw editor handlers for migrated Anuga prefixes
        vectorDrawAnugaCompleteEpic,
        vectorDrawAnugaCancelledEpic,
        // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker epics.
        terrainBboxEndDrawingEpic,
        createTerrainFromBboxEpic,
        createTerrainFromBboxErrorEpic,
        // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
        demRescaleOnMoveEndEpic,
        // TASK-1856 (W3.2) — Debounced cursor-elevation point query.
        cursorElevationEpic,
        // TASK-1861 (W4.4) — Depth/result line-profile tool epics.
        profileStartDrawEpic,
        profileEndDrawingEpic,
        // TASK-1901 (epic 1898 W2) — Canonical group-tree-order reconciler.
        layerOrderReconcilerEpic,
        // TASK-1902 — terrain sub-order: Contour > DEM > Hillshade.
        terrainSubOrderReconcilerEpic,
        // TASK-1903 — floater ranking + intra-Results band order.
        resultsLayerOrderEpic,
        // TASK-1930 (W2.6) — map-OPEN GWC tile prefetch (warm visible COGs).
        warmTilesOnMapOpenEpic,
        // TASK-1645 (W1.5): TerrainWorkbench recipe epics registered under Anuga plugin.
        twLoadDataEpic,
        twSelectSurfaceForTerrainEpic,
        twCreateSurfaceEpic,
        twUpdateSurfaceEpic,
        twDeleteSurfaceEpic,
        twSetDesignInputsEpic,
        twDeriveEpic,
        twDeriveCompleteEpic
    }
});

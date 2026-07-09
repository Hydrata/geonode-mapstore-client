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
    // TASK-2194 (epic 2190 W2) — compute-target site-config hydration.
    loadAnugaComputeConfigEpic,
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
// TASK-1995 (epic 1969 W2.3) — map-click disambiguation: the classifier epic
// (drawing-guarded + perms-gated) and the Identify-ON enabler.
import {
    clickDisambiguationEpic,
    anugaIdentifyEnableEpic,
    anugaIdentifyJsonFormatEpic
} from "./epics/clickDisambiguationEpic";
// TASK-1995 (epic 1969 W2.3) — register the 8 editable ANUGA vector prefixes
// into the click-target registry ONCE at module load. Mirrors FormField.js's
// registerDiscriminator(...) module-load registration; kept out of
// anugaClickTargets.js itself so the W1 unit tests can clean() the registry.
import { registerAnugaClickTargets } from "./anugaClickTargets";
// TASK-1996 (epic 1969 W3.1) — register the 7 legacy FeatureGrid prefixes as
// read-only view-attributes openers.
import { registerLegacyClickTargets } from "./legacyClickTargets";
// TASK-1997 (epic 1969 W3.2) — register raster (fri_raster_, terrain COG)
// prefixes as read-only value-readout openers.
import { registerRasterClickTargets } from "./rasterClickTargets";

registerAnugaClickTargets();
registerLegacyClickTargets();
registerRasterClickTargets();
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
// TASK-2099 (epic 2092 W4.1) — Paywall checkout round-trip epics.
import {
    checkoutReturnEpic,
    pollMyPermsWhilePendingEpic,
    subscribeCheckoutEpic
} from "./epics/paywallEpics";
// TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
import {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic
} from "./epics/computeMeterEpics";

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
        // TASK-2194 (epic 2190 W2) — compute-target site-config hydration.
        loadAnugaComputeConfigEpic,
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
        // TASK-2099 (epic 2092 W4.1) — Paywall checkout round-trip epics.
        checkoutReturnEpic,
        pollMyPermsWhilePendingEpic,
        subscribeCheckoutEpic,
        // TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
        triggerFetchBalanceOnInitEpic,
        fetchComputeBalanceEpic,
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
        // TASK-1995 (epic 1969 W2.3) — map-click disambiguation (classify GFI ->
        // open editable vector) + ensure Identify is ON for ANUGA maps + force
        // application/json info_format (W2 corrective: live Identify default is
        // text/plain, which the classifier's FeatureCollection guard would drop).
        clickDisambiguationEpic,
        anugaIdentifyEnableEpic,
        anugaIdentifyJsonFormatEpic,
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

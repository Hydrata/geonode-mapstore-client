import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
// TASK-1645 (W1.5): terrainWorkbench reducer re-homed here; plugin shell dissolved.
import terrainWorkbench from '../TerrainWorkbench/reducersTerrainWorkbench';
// TASK-2627 (W3.1, epic 2618) — Anuga-owned playback controller slice + epics.
// Registered as `anugaPlayback`, NOT `playback` — MapStore2 core already
// owns `state.playback` for its own Timeline plugin (found live: a second
// reducer under the same key silently produced `state.playback === {}`,
// neither reducer's default state — see playbackEpics.js's header note).
import anugaPlayback from './playback/reducers/playbackReducer';
import {
    playbackInitEpic,
    playbackBufferEpic,
    playbackTickEpic,
    playbackSyncLayerEpic,
    // TASK-2628 (W3.2) — click-to-inspect at the current timestep.
    playbackIdentifyEpic,
    // TASK-2656c (W6.5) — suppress the generic GFI popup while playback
    // Inspect is armed.
    playbackSuppressIdentifyEpic,
    // TASK-2744 (AC2, epic 2706) — free the run's fetcher/caches and remove
    // the map overlay on Unload.
    playbackDisposeEpic,
    // TASK-2752 (W8.2, epic 2706) — fetches the temporal-max envelope for
    // the active quantity when the Max toggle turns on (or the operator
    // switches to a different envelope-having quantity while it is on).
    playbackEnvelopeFetchEpic
} from './playback/epics/playbackEpics';
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    // TASK-2232 — bootstrap recovery (hidden-tab drop + wedged-guard watchdog).
    anugaVisibilityBootstrapEpic,
    anugaInitWatchdogEpic,
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
    // TASK-2707 (epic 2706 W1.1) — Build / Build-and-Run. Exported from the
    // barrel since TASK-2079 but NEVER enumerated here, so the epic never
    // subscribed: every Build click dispatched BUILD_SCENARIO into a stream
    // with no listener (no request, no error, no toast). Registration is the
    // fix; epicRegistrationCompleteness-test.js is the guard against a repeat.
    buildScenarioEpic,
    getAnugaResourcesEpic,
    manageTerrain3DEpic,
    // TASK-2572 — a terrain superseded by a datum-shift conversion has no TOC
    // row; hide its DEM + hillshade so the wrong-datum surface stops painting.
    supersededTerrainVisibilityEpic,
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
    // TASK-2165 — post-save bbox recalc (zoom-to-layer planet-zoom fix)
    vectorDrawRecalcBboxEpic,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker.
    terrainBboxEndDrawingEpic,
    createTerrainFromBboxEpic,
    createTerrainFromBboxErrorEpic,
    // TASK-2327 (epic 2323) — convert an ellipsoid terrain to EGM2008.
    convertTerrainDatumEpic,
    convertTerrainDatumErrorEpic,
    // TASK-2335 (epic 2323) — persist the datum-badge dismissal across reload.
    ackTerrainDatumEpic,
    // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
    demRescaleOnMoveEndEpic,
    // TASK-1856 (W3.2) — Debounced cursor-elevation point query.
    cursorElevationEpic,
    // TASK-1861 (W4.4) — Depth/result line-profile tool.
    profileStartDrawEpic,
    profileEndDrawingEpic,
    // TASK-2254 (epic 2249 W2) — Cross-section picker seed-from-visibility.
    pickerSeedEpic,
    // TASK-2577 — prune/substitute checked terrains superseded on a refetch.
    pruneSupersededCheckedTerrainsEpic,
    // TASK-2276 (epic 2249 W-followup) — owner-guarded Clear draw-line removal.
    clearProfileLineEpic,
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
    twDeriveCompleteEpic,
    // TASK-2582 (W2a) — Merge extent draw lifecycle (owner-isolated 'merge-extent').
    twMergeExtentEndDrawingEpic
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
    // TASK-2483 (epic 2425 W2.8) — the tab-visible my_perms re-read. The tab the
    // customer STARTED checkout from never sees ?checkout=success and so never
    // polls; this is what makes its padlock fresh when they look at it again.
    refreshMyPermsOnTabVisibleEpic,
    subscribeCheckoutEpic,
    // TASK-2489 (epic 2425 W3c) — clears the confirming state on the POLLED
    // /commerce/balance/ channel, against a server timestamp captured before
    // departure.
    clearPendingOnPurchaseRowEpic
} from "./epics/paywallEpics";
// TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
import {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic,
    // TASK-2513 (epic 2425 W3d) — the second trigger: a boot-time miss left the
    // meter slice dark for the whole session, and a dark slice render-nulls all
    // three refusal modals.
    refetchBalanceOnAccountSummaryEpic
} from "./epics/computeMeterEpics";
// TASK-2420 (epic 2359 W4.5) — Account panel Billing-tab fetch + Stripe
// Customer Portal round-trip epics.
import {
    triggerFetchAccountSummaryOnInitEpic,
    triggerFetchAccountSummaryOnBillingTabOpenEpic,
    fetchAccountSummaryEpic,
    requestBillingPortalEpic,
    refreshAccountOnWindowFocusEpic
} from "./epics/accountEpics";

export default createPlugin('Anuga', {
    component: anugaContainer,
    reducers: {
        anuga,
        // TASK-1645 (W1.5): terrainWorkbench slice registered under Anuga plugin.
        terrainWorkbench,
        // TASK-2627 (W3.1, epic 2618) — playback controller slice (anugaPlayback,
        // not playback — see the import comment above).
        anugaPlayback
    },
    epics: {
        initAnugaEpic,
        // TASK-2232 — bootstrap recovery (hidden-tab drop + wedged-guard watchdog).
        anugaVisibilityBootstrapEpic,
        anugaInitWatchdogEpic,
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
        // TASK-2707 (epic 2706 W1.1) — Build / Build-and-Run: POSTs
        // /api/v2/anuga/projects/{p}/scenarios/{s}/build/ on BUILD_SCENARIO.
        // Absent from this map until now; see the import-block note above.
        buildScenarioEpic,
        getAnugaResourcesEpic,
        manageTerrain3DEpic,
        supersededTerrainVisibilityEpic,
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
        refreshMyPermsOnTabVisibleEpic,
        subscribeCheckoutEpic,
        // TASK-2489 (epic 2425 W3c) — the post-checkout confirmation's clear.
        clearPendingOnPurchaseRowEpic,
        // TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
        triggerFetchBalanceOnInitEpic,
        fetchComputeBalanceEpic,
        // TASK-2513 (epic 2425 W3d) — repairs a boot fetch that failed.
        refetchBalanceOnAccountSummaryEpic,
        // TASK-2420 (epic 2359 W4.5) — Account panel Billing-tab fetch + portal.
        triggerFetchAccountSummaryOnInitEpic,
        triggerFetchAccountSummaryOnBillingTabOpenEpic,
        fetchAccountSummaryEpic,
        requestBillingPortalEpic,
        refreshAccountOnWindowFocusEpic,
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
        // TASK-2165 — post-save bbox recalc (zoom-to-layer planet-zoom fix)
        vectorDrawRecalcBboxEpic,
        // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker epics.
        terrainBboxEndDrawingEpic,
        createTerrainFromBboxEpic,
        createTerrainFromBboxErrorEpic,
        // TASK-2327 (epic 2323) — convert an ellipsoid terrain to EGM2008.
        convertTerrainDatumEpic,
        convertTerrainDatumErrorEpic,
        // TASK-2335 (epic 2323) — persist the datum-badge dismissal across reload.
        ackTerrainDatumEpic,
        // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
        demRescaleOnMoveEndEpic,
        // TASK-1856 (W3.2) — Debounced cursor-elevation point query.
        cursorElevationEpic,
        // TASK-1861 (W4.4) — Depth/result line-profile tool epics.
        profileStartDrawEpic,
        profileEndDrawingEpic,
        // TASK-2254 (epic 2249 W2) — Cross-section picker seed-from-visibility
        // (checked terrains/scenarios on panel open).
        pickerSeedEpic,
        // TASK-2577 — prune/substitute checked terrains superseded on a refetch.
        pruneSupersededCheckedTerrainsEpic,
        // TASK-2276 (epic 2249 W-followup) — owner-guarded Clear draw-line removal.
        clearProfileLineEpic,
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
        twDeriveCompleteEpic,
        // TASK-2582 (W2a) — Merge extent draw lifecycle (owner-isolated 'merge-extent').
        twMergeExtentEndDrawingEpic,
        // TASK-2627 (W3.1, epic 2618) — playback controller: manifest/mesh/time
        // load, buffer-window prefetch, the ~20Hz playhead clock, and syncing
        // {mesh, frame0, frame1, mixT, colorMode, colorMax} onto the real
        // AnugaPlaybackLayer via the standard changeLayerProperties action.
        playbackInitEpic,
        playbackBufferEpic,
        playbackTickEpic,
        playbackSyncLayerEpic,
        // TASK-2628 (W3.2) — click-to-inspect at the current timestep.
        playbackIdentifyEpic,
        // TASK-2656c (W6.5) — suppress the generic GFI popup while playback
        // Inspect is armed; restores mapInfo.enabled verbatim on disarm.
        playbackSuppressIdentifyEpic,
        // TASK-2744 (AC2, epic 2706) — Unload: drop the fetcher + its decoded
        // chunk cache + the cloned/reprojected mesh copies, and remove the
        // map overlay. Without it a scenario switch retained ~578 MiB per
        // stale run.
        playbackDisposeEpic,
        // TASK-2752 (W8.2, epic 2706) — the Max envelope fetch.
        playbackEnvelopeFetchEpic
    }
});

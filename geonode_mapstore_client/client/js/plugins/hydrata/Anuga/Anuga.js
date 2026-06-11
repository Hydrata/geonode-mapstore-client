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
    // TASK-1594 (W1) — Culvert: terrain-workbench drainage structure.
    createAnugaCulvertEpic,
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
    // TASK-793 — VectorDraw editor handlers for migrated Anuga prefixes
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker.
    terrainBboxEndDrawingEpic,
    createTerrainFromBboxEpic,
    createTerrainFromBboxErrorEpic,
    // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
    demRescaleOnMoveEndEpic
} from "./epicsAnuga";
// TASK-1645 (W1.5): TerrainWorkbench recipe epics re-homed into Anuga plugin.
import {
    twLoadDataEpic,
    twCreateSurfaceEpic,
    twUpdateSurfaceEpic,
    twDeleteSurfaceEpic,
    twSetDesignInputsEpic,
    twDeriveEpic,
    twDeriveCompleteEpic,
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
        // TASK-793 — VectorDraw editor handlers for migrated Anuga prefixes
        vectorDrawAnugaCompleteEpic,
        vectorDrawAnugaCancelledEpic,
        // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker epics.
        terrainBboxEndDrawingEpic,
        createTerrainFromBboxEpic,
        createTerrainFromBboxErrorEpic,
        // TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
        demRescaleOnMoveEndEpic,
        // TASK-1645 (W1.5): TerrainWorkbench recipe epics registered under Anuga plugin.
        twLoadDataEpic,
        twCreateSurfaceEpic,
        twUpdateSurfaceEpic,
        twDeleteSurfaceEpic,
        twSetDesignInputsEpic,
        twDeriveEpic,
        twDeriveCompleteEpic,
    }
});

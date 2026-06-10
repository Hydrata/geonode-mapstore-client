/**
 * TASK-1599 (W1) — TerrainWorkbench MapStore plugin (shell).
 * TASK-1600 (W1) — Recipe UI + epics registered.
 *
 * A workbench panel with 3 sections:
 *   terrain     — live (recipe UI + derive from TASK-1600)
 *   delineation — stubbed (Epic B)
 *   catchments  — stubbed (Epic C)
 *
 * Registered in:
 *   - js/plugins/index.js (TerrainWorkbenchPlugin)
 *   - localConfig.json   (map_viewer + dataset_viewer contexts) — BOTH copies
 *
 * @see memory/mapstore-epic-never-registered-in-barrel.md — every epic exported
 * from epicsTerrainWorkbench.js MUST appear in the epics object below.
 */
import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import terrainWorkbench from './reducersTerrainWorkbench';
import TerrainWorkbenchPanel from './components/TerrainWorkbenchPanel';
import {
    twLoadDataEpic,
    twCreateSurfaceEpic,
    twUpdateSurfaceEpic,
    twDeleteSurfaceEpic,
    twSetDesignInputsEpic,
    twDeriveEpic,
    twDeriveCompleteEpic,
} from './epicsTerrainWorkbench';

export default createPlugin('TerrainWorkbench', {
    component: TerrainWorkbenchPanel,
    reducers: {
        terrainWorkbench,
    },
    epics: {
        // TASK-1600: recipe UI epics.
        // All names here must exactly match their export names above.
        twLoadDataEpic,
        twCreateSurfaceEpic,
        twUpdateSurfaceEpic,
        twDeleteSurfaceEpic,
        twSetDesignInputsEpic,
        twDeriveEpic,
        twDeriveCompleteEpic,
    },
});

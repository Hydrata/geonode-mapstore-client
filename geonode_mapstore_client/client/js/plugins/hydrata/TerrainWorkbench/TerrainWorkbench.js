/**
 * TASK-1599 (W1) — TerrainWorkbench MapStore plugin.
 *
 * A workbench panel with 3 sections:
 *   terrain     — live (recipe UI from TASK-1600 mounts here)
 *   delineation — stubbed (Epic B)
 *   catchments  — stubbed (Epic C)
 *
 * Registered in:
 *   - js/plugins/index.js (TerrainWorkbenchPlugin)
 *   - localConfig.json   (map_viewer + map_edit contexts) — BOTH copies
 *
 * @see memory/mapstore-epic-never-registered-in-barrel.md — every epic exported
 * from epicsTerrainWorkbench.js MUST appear in the epics object below.
 * Currently no epics; TASK-1600 will add the recipe-UI epics.
 */
import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import terrainWorkbench from './reducersTerrainWorkbench';
import TerrainWorkbenchPanel from './components/TerrainWorkbenchPanel';
// No epics for the shell; TASK-1600 will add them.
// import { ... } from './epicsTerrainWorkbench';

export default createPlugin('TerrainWorkbench', {
    component: TerrainWorkbenchPanel,
    reducers: {
        terrainWorkbench,
    },
    epics: {
        // Shell has no epics.  TASK-1600 will populate this object.
    },
});

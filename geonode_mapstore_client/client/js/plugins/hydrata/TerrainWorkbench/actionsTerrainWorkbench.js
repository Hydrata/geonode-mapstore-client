/**
 * TASK-1599 (W1) — TerrainWorkbench action types + creators.
 */

export const TERRAIN_WORKBENCH_SET_SECTION = 'TERRAIN_WORKBENCH_SET_SECTION';
export const TERRAIN_WORKBENCH_SET_VISIBLE = 'TERRAIN_WORKBENCH_SET_VISIBLE';

/**
 * Switch the active workbench section.
 * @param {'terrain'|'delineation'|'catchments'} section
 */
export function setTerrainWorkbenchSection(section) {
    return { type: TERRAIN_WORKBENCH_SET_SECTION, section };
}

/**
 * Show or hide the workbench panel.
 * @param {boolean} visible
 */
export function setTerrainWorkbenchVisible(visible) {
    return { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible };
}

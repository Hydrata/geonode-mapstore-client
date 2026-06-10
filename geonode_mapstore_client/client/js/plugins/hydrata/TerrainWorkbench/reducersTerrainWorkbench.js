/**
 * TASK-1599 (W1) — TerrainWorkbench reducer.
 *
 * State shape:
 *   activeSection: 'terrain' | 'delineation' | 'catchments'
 *   visible: bool
 */
import {
    TERRAIN_WORKBENCH_SET_SECTION,
    TERRAIN_WORKBENCH_SET_VISIBLE,
} from './actionsTerrainWorkbench';

const defaultState = {
    activeSection: 'terrain',
    visible: false,
};

export default function terrainWorkbench(state = defaultState, action = {}) {
    switch (action.type) {
    case TERRAIN_WORKBENCH_SET_SECTION:
        return { ...state, activeSection: action.section };
    case TERRAIN_WORKBENCH_SET_VISIBLE:
        return { ...state, visible: action.visible };
    default:
        return state;
    }
}

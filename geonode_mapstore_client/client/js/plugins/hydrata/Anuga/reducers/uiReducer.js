import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_PUBLICATION_PANEL,
    SET_CREATING_ANUGA_LAYER,
    SET_MEMBERSHIP_PANEL,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker panel.
    SET_VISIBLE_TERRAIN_BBOX_PANEL,
    SET_TERRAIN_BBOX_DRAWING,
    SET_TERRAIN_BBOX,
    SET_TERRAIN_BBOX_ERROR,
    SET_TERRAIN_BBOX_CONFIRM,
    // TASK-1850 (epic 1814 W2) — dynamic-ramp degraded (full-range) flag.
    SET_DEM_RAMP_DEGRADED
} from "../actionsAnuga";

import {
    SET_OPEN_MENU_GROUP_ID
} from "../../SimpleView/actionsSimpleView";

const initialState = {
    showAnugaInputMenu: false,
    showAnugaScenarioMenu: false,
    showAnugaResultMenu: false,
    showNetworkMenu: false,
    showPublicationPanel: false,
    isCreatingAnugaLayer: false,
    showAddAnugaTerrainData: false,
    showMembershipPanel: false,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker panel state.
    // The 4 fields cluster (visible/drawing-active/bbox/error) live on the
    // existing `ui` slice rather than on a new reducer; matches how
    // isCreatingAnugaLayer treats a transient creation flow as UI state.
    terrainBboxPanelVisible: false,
    terrainBboxDrawingActive: false,
    terrainBbox: null,
    terrainBboxError: null,
    // Post-draw confirmation popup: visibility + the geodesic area (km2) of the
    // drawn extent so the popup can render cells/time estimates.
    terrainBboxConfirmVisible: false,
    terrainBboxAreaKm2: null,
    // TASK-1850 (epic 1814 W2) — per-layer dynamic-ramp degraded flag keyed by
    // map layer id: { [layerId]: true } when the live windowed bbox-stats fetch
    // failed and the ramp fell back to the stored whole-raster range. The legend
    // reads this so the degraded state is visible rather than silent.
    demRampDegraded: {}
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_CREATING_ANUGA_LAYER:
        return { ...state, isCreatingAnugaLayer: action.isCreatingAnugaLayer };
    case SET_OPEN_MENU_GROUP_ID:
        if (action.openMenuGroupId) {
            return {
                ...state,
                showAnugaInputMenu: false,
                showAnugaScenarioMenu: false,
                showAnugaResultMenu: false
            };
        }
        return state;
    case SET_ANUGA_INPUT_MENU:
        return {
            ...state,
            showAnugaInputMenu: action.visible,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_SCENARIO_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: action.visible,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_RESULT_MENU:
        return {
            ...state,
            showAnugaScenarioMenu: false,
            showAnugaInputMenu: false,
            showAnugaResultMenu: action.visible,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_NETWORK_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: action.visible,
            showPublicationPanel: false
        };
    case SET_PUBLICATION_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: action.visible
        };
    case SET_MEMBERSHIP_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false,
            showMembershipPanel: action.visible
        };
    case SET_VISIBLE_TERRAIN_BBOX_PANEL:
        // Closing the panel resets transient draw state so re-opening is clean.
        return action.visible
            ? { ...state, terrainBboxPanelVisible: true }
            : { ...state, terrainBboxPanelVisible: false, terrainBboxDrawingActive: false, terrainBbox: null, terrainBboxError: null, terrainBboxConfirmVisible: false, terrainBboxAreaKm2: null };
    case SET_TERRAIN_BBOX_DRAWING:
        return { ...state, terrainBboxDrawingActive: action.active };
    case SET_TERRAIN_BBOX:
        // Clearing the bbox (Re-select / Draw-again) also dismisses the confirm
        // popup; setting a new bbox leaves popup visibility to SET_TERRAIN_BBOX_CONFIRM.
        return action.bbox
            ? { ...state, terrainBbox: action.bbox, terrainBboxDrawingActive: false }
            : { ...state, terrainBbox: null, terrainBboxDrawingActive: false, terrainBboxConfirmVisible: false, terrainBboxAreaKm2: null };
    case SET_TERRAIN_BBOX_ERROR:
        return { ...state, terrainBboxError: action.error };
    case SET_TERRAIN_BBOX_CONFIRM:
        return action.visible
            ? { ...state, terrainBboxConfirmVisible: true, terrainBboxAreaKm2: action.areaKm2 }
            : { ...state, terrainBboxConfirmVisible: false };
    case SET_DEM_RAMP_DEGRADED: {
        // Per-layer flag; only rewrite the map when the value actually changes so
        // a steady stream of successful pans doesn't churn the reducer object.
        const current = state.demRampDegraded || {};
        if (!!current[action.layerId] === action.degraded) {
            return state;
        }
        return {
            ...state,
            demRampDegraded: { ...current, [action.layerId]: action.degraded }
        };
    }
    default:
        return state;
    }
};

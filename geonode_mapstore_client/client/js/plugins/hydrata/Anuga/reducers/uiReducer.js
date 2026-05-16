import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_PUBLICATION_PANEL,
    SHOW_ANUGA_SCENARIO_LOG,
    SHOW_ANUGA_RUN_MENU,
    SET_CREATING_ANUGA_LAYER,
    SET_MEMBERSHIP_PANEL,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker panel.
    SET_VISIBLE_TERRAIN_BBOX_PANEL,
    SET_TERRAIN_BBOX_DRAWING,
    SET_TERRAIN_BBOX,
    SET_TERRAIN_BBOX_ERROR
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
    visibleAnugaScenarioLogId: false,
    visibleAnugaRunMenu: false,
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
    terrainBboxError: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_CREATING_ANUGA_LAYER:
        return { ...state, isCreatingAnugaLayer: action.isCreatingAnugaLayer };
    case SHOW_ANUGA_SCENARIO_LOG:
        return { ...state, visibleAnugaScenarioLogId: action.scenarioId };
    case SHOW_ANUGA_RUN_MENU:
        return { ...state, visibleAnugaRunMenu: action.visible };
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
            : { ...state, terrainBboxPanelVisible: false, terrainBboxDrawingActive: false, terrainBbox: null, terrainBboxError: null };
    case SET_TERRAIN_BBOX_DRAWING:
        return { ...state, terrainBboxDrawingActive: action.active };
    case SET_TERRAIN_BBOX:
        return { ...state, terrainBbox: action.bbox, terrainBboxDrawingActive: false };
    case SET_TERRAIN_BBOX_ERROR:
        return { ...state, terrainBboxError: action.error };
    default:
        return state;
    }
};

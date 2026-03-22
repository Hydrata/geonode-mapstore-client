import {
    SET_MENU_GROUP,
    SET_SWAMM_INPUT_MENU,
    SHOW_BMP_MANAGER,
    HIDE_BMP_MANAGER,
    TOGGLE_BMP_MANAGER,
    SHOW_SWAMM_DATA_GRID,
    HIDE_SWAMM_DATA_GRID,
    SHOW_SWAMM_BMP_CHART,
    HIDE_SWAMM_BMP_CHART,
    SHOW_TARGET_FORM,
    HIDE_TARGET_FORM,
    UPDATE_TARGET_FORM,
    SHOW_BMP_CHOOSER,
    HIDE_BMP_CHOOSER,
    SET_DASHBOARD_VIEW
} from "../actionsSwamm";

const uiReducer = (state, action) => {
    switch (action.type) {
    case SET_MENU_GROUP:
        if (action.payload) {
            return { visibleBmpManager: false };
        }
        return {};
    case SET_SWAMM_INPUT_MENU:
        return { showSwammInputMenu: action.visible };
    case SHOW_BMP_MANAGER:
        return { visibleBmpManager: true };
    case HIDE_BMP_MANAGER:
        return { visibleBmpManager: false };
    case TOGGLE_BMP_MANAGER:
        return { visibleBmpManager: !state.visibleBmpManager };
    case SHOW_SWAMM_DATA_GRID:
        return { visibleSwammDataGrid: true };
    case HIDE_SWAMM_DATA_GRID:
        return { visibleSwammDataGrid: false };
    case SHOW_SWAMM_BMP_CHART:
        return { visibleSwammBmpChart: true };
    case HIDE_SWAMM_BMP_CHART:
        return { visibleSwammBmpChart: false };
    case SHOW_TARGET_FORM:
        return {
            visibleTargetForm: action.visibleTargetForm,
            targetForm: action.target
        };
    case HIDE_TARGET_FORM:
        return { visibleTargetForm: action.visibleTargetForm };
    case UPDATE_TARGET_FORM:
        return {
            targetForm: {
                ...state.targetForm,
                ...action.kv
            }
        };
    case SHOW_BMP_CHOOSER:
        return { bmpChooserCandidates: action.candidates };
    case HIDE_BMP_CHOOSER:
        return { bmpChooserCandidates: null };
    case SET_DASHBOARD_VIEW:
        return { dashboardView: action.view };
    default:
        return {};
    }
};

export default uiReducer;

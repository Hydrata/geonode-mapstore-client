import {
    SET_VISIBLE_LEGEND_PANEL,
    SET_OPEN_MENU_GROUP_ID,
    SV_SELECT_LAYER,
    SET_VISIBLE_UPLOADER_PANEL,
    UPDATE_UPLOAD_STATUS
} from "./actionsSimpleView";

export default ( state = {}, action) => {
    switch (action.type) {
    case SET_OPEN_MENU_GROUP_ID:
        if (state.openMenuGroupId === action.openMenuGroupId) {
            return {
                ...state,
                openMenuGroupId: null
            };
        }
        return {
            ...state,
            openMenuGroupId: action.openMenuGroupId
        };
    case SET_VISIBLE_LEGEND_PANEL:
        return {
            ...state,
            visibleLegendPanel: action.visible
        };
    case SET_VISIBLE_UPLOADER_PANEL:
        return {
            ...state,
            visibleUploaderPanel: action.visible
        };
    case UPDATE_UPLOAD_STATUS:
        return {
            ...state,
            uploadStatus: action.status
        };
    case SV_SELECT_LAYER:
        return {
            ...state,
            selectedLayer: action.layer
        };
    default:
        return state;
    }
};

import {SET_VISIBLE_LEGEND_PANEL, SET_OPEN_MENU_GROUP_ID} from "./actionsSimpleView";

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
    default:
        return state;
    }
};

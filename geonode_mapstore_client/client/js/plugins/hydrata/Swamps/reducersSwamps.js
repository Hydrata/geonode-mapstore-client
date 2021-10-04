import {
    SET_VISIBLE_SWAMPS_CHART,
    SET_CURRENT_SWAMP_ID,
    CLEAR_CURRENT_SWAMP,
    SAVE_SWAMP_QUERY_TO_STORE,
    SET_SELECTED_X_KEY,
    SET_SELECTED_Y_KEY,
    REFRESH_PAGE
} from "./actionsSwamps";

const initialState = {
    currentSwampId: null,
    currentSwampData: null
};

export default ( state = initialState, action) => {
    // console.log(action);
    switch (action.type) {
    case SET_CURRENT_SWAMP_ID:
        return {
            ...state,
            currentSwampId: action.currentSwampId
        };
    case CLEAR_CURRENT_SWAMP:
        return {
            ...state,
            currentSwampId: null,
            currentSwampData: null
        };
    case SAVE_SWAMP_QUERY_TO_STORE:
        return {
            ...state,
            currentSwampData: action.swampData
        };
    case SET_VISIBLE_SWAMPS_CHART:
        return {
            ...state,
            visibleSwampsChart: action.visible
        };
    case SET_SELECTED_X_KEY:
        return {
            ...state,
            selectedXKey: action.selectedXKey
        };
    case SET_SELECTED_Y_KEY:
        return {
            ...state,
            selectedYKey: action.selectedYKey
        };
    case REFRESH_PAGE:
        window.location.reload(false);
        return state;
    default:
        return state;
    }
};

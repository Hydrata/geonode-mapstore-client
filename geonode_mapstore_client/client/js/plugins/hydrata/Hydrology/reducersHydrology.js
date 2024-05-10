import {
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";


const initialState = {
    isHydrologyProject: false,
    showHydrologyMainMenu: false
};

export default ( state = initialState, action) => {
    console.log('action for Hydrology: ', action);
    switch (action.type) {
    case SET_HYDROLOGY_MAIN_MENU:
        return {
            ...state,
            showHydrologyMainMenu: action.visible
        };
    case SET_ACTIVE_HYDROLOGY_PAGE:
        return {
            ...state,
            pageName: action.pageName
        };
    case INIT_HYDROLOGY_FULFILLED:
        return {
            ...state,
            projectId: action.projectId
        };
    case SET_HYDROLOGY_TIME_SERIES_DATA:
        return {
            ...state,
            timeSeries: action.payload
        };
    case SET_HYDROLOGY_TEMPORAL_PATTERN_DATA:
        return {
            ...state,
            temporalPatterns: action.payload
        };
    case SET_HYDROLOGY_IDF_TABLE_DATA:
        return {
            ...state,
            IdfTables: action.payload
        };
    default:
        return state;
    }
};

import {
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE,
    SET_ACTIVE_HYDROLOGY_LIST_ITEM,
    UPDATE_ACTIVE_HYDROLOGY_LIST_ITEM
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";
import {UPDATE_ANUGA_SCENARIO} from "@js/plugins/hydrata/Anuga/actionsAnuga";


const initialState = {
    isHydrologyProject: false,
    showHydrologyMainMenu: false,
    activeHydrologyPage: "idf-tables"
};

export const hydrologyKeyMap = {
    "idf-tables": "idfTables",
    "temporal-patterns": "temporalPatterns",
    "time-series": "timeSeries",
    "inflows": "inflows"
}

export default ( state = initialState, action) => {
    console.log('action for Hydrology: ', action);
    switch (action.type) {
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
            idfTables: action.payload
        };
    case SET_HYDROLOGY_MAIN_MENU:
        return {
            ...state,
            showHydrologyMainMenu: action.visible
        };
    case SET_ACTIVE_HYDROLOGY_PAGE:
        return {
            ...state,
            activeHydrologyPage: action.pageName
        };
    case SET_ACTIVE_HYDROLOGY_LIST_ITEM:
        return {
            ...state,
            activeHydrologyListItem: action.item
        };
    case UPDATE_ACTIVE_HYDROLOGY_LIST_ITEM: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        console.log('***', action);
        return {
            ...state,
            [pageName]: state[pageName].map((item) => item.id === action.item.id
                ? { ...action.item, unsaved: true }
                : item),
            activeHydrologyListItem: {
                ...action.item,
                unsaved: true
            }
        };
    }
default:
        return state;
    }
};
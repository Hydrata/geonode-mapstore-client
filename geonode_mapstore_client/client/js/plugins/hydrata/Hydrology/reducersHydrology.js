import {
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE,
    SET_ACTIVE_HYDROLOGY_ITEM,
    UPDATE_ACTIVE_HYDROLOGY_ITEM,
    SAVE_HYDROLOGY_ITEM_SUCCESS
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";


const initialState = {
    isHydrologyProject: false,
    showHydrologyMainMenu: false,
    activeHydrologyPage: "idf-table"
};

export const hydrologyKeyMap = {
    "idf-table": "idfTables",
    "temporal-pattern": "temporalPatterns",
    "time-series": "timeSeries",
    "inflows": "inflows"
};

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
    case SET_ACTIVE_HYDROLOGY_ITEM:
        return {
            ...state,
            activeHydrologyItem: action.item
        };
    case UPDATE_ACTIVE_HYDROLOGY_ITEM: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        return {
            ...state,
            [pageName]: state[pageName].map((item) => item.id === action.item.id
                ? { ...action.item, unsaved: true }
                : item),
            activeHydrologyItem: {
                ...action.item,
                unsaved: true
            }
        };
    }
    case SAVE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        return {
            ...state,
            [pageName]: state[pageName].map((item) => item.id === action.item.id
                ? { ...action.item, unsaved: false }
                : item),
            activeHydrologyItem: {
                ...action.item,
                unsaved: false
            }
        };
    }
    default:
        return state;
    }
};

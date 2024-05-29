import { v4 as uuidv4 } from 'uuid';
import {
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE,
    SET_ACTIVE_HYDROLOGY_ITEM,
    UPDATE_ACTIVE_HYDROLOGY_ITEM,
    CREATE_HYDROLOGY_FORM,
    SAVE_HYDROLOGY_ITEM_SUCCESS,
    CREATE_HYDROLOGY_ITEM_SUCCESS,
    DELETE_HYDROLOGY_ITEM_SUCCESS,
    UPDATE_IDF_ROW_DATA,
    UPDATE_TEMPORAL_PATTERN_ROW_DATA
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";

import {IdfTable, TemporalPattern} from "./classesHydrology";

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

const createIdfTableFromJson = (idfTableJson) => {
    const idfTableInstance = new IdfTable();
    idfTableInstance.id = idfTableJson?.id;
    idfTableInstance.project = idfTableJson?.project;
    idfTableInstance.name = idfTableJson?.name;
    idfTableInstance.description = idfTableJson?.description;
    idfTableInstance.source = idfTableJson?.source;
    idfTableInstance.owner = idfTableJson?.owner;
    idfTableInstance.data = idfTableJson?.data;
    return idfTableInstance;
};

const createTemporalPatternFromJson = (temporalPatternJson) => {
    const temporalPatternInstance = new TemporalPattern();
    temporalPatternInstance.id = temporalPatternJson?.id;
    temporalPatternInstance.project = temporalPatternJson?.project;
    temporalPatternInstance.name = temporalPatternJson?.name;
    temporalPatternInstance.description = temporalPatternJson?.description;
    temporalPatternInstance.source = temporalPatternJson?.source;
    temporalPatternInstance.owner = temporalPatternJson?.owner;
    temporalPatternInstance.data = temporalPatternJson?.data;
    return temporalPatternInstance;
};


export default ( state = initialState, action) => {
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
        const temporalPatterns = action.payload.map(temporalPatternJson => createTemporalPatternFromJson(temporalPatternJson));
        return {
            ...state,
            temporalPatterns: temporalPatterns
        };
    case SET_HYDROLOGY_IDF_TABLE_DATA:
        const idfTables = action.payload.map(idfTableJson => createIdfTableFromJson(idfTableJson));
        return {
            ...state,
            idfTables: idfTables
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
        let updatedActiveHydrologyItem;
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (item.id === action.item.id) {
                    item.updateProperties(action.kv);
                    item.unsaved = true;
                    updatedActiveHydrologyItem = item;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case CREATE_HYDROLOGY_FORM: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let newHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            newHydrologyItem = new IdfTable();
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            newHydrologyItem = new TemporalPattern();
        } else if (action.activeHydrologyPage === 'time-series') {
            newHydrologyItem = new IdfTable();
        }
        newHydrologyItem.unsaved = true;
        return {
            ...state,
            [pageName]: [...state[pageName], newHydrologyItem],
            activeHydrologyItem: newHydrologyItem
        };
    }
    case SAVE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let updatedActiveHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            updatedActiveHydrologyItem = createTemporalPatternFromJson(action.item);
        } else if (action.activeHydrologyPage === 'time-series') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        }
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (item.id === action.item.id) {
                    updatedActiveHydrologyItem.unsaved = false;
                    return updatedActiveHydrologyItem;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case CREATE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let updatedActiveHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            updatedActiveHydrologyItem = createTemporalPatternFromJson(action.item);
        } else if (action.activeHydrologyPage === 'time-series') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        }
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (typeof item.id === 'string' && item.id.includes('temp') && item.name === action.item.name) {
                    updatedActiveHydrologyItem.unsaved = false;
                    return updatedActiveHydrologyItem;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case DELETE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        return {
            ...state,
            [pageName]: state[pageName].filter((item) => item.id !== action.item.id),
            activeHydrologyItem: null
        };
    }
    case UPDATE_IDF_ROW_DATA: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            idfTables: state.idfTables.map((idfTable) => {
                if (idfTable.id === action.idfTableId) {
                    idfTable.updateIntensityValues(action.rowData);
                    idfTable.unsaved = true;
                    updatedActiveHydrologyItem = idfTable;
                }
                return idfTable;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case UPDATE_TEMPORAL_PATTERN_ROW_DATA: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            temporalPatterns: state.temporalPatterns.map((temporalPattern) => {
                if (temporalPattern.id === action.temporalPatternId) {
                    temporalPattern.updatePercentageValues(action.rowData);
                    temporalPattern.unsaved = true;
                    updatedActiveHydrologyItem = temporalPattern;
                }
                return temporalPattern;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    default:
        return state;
    }
};

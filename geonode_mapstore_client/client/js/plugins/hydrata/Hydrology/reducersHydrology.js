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
    UPDATE_TEMPORAL_PATTERN_ROW_DATA,
    UPDATE_TIME_SERIES_ROW_DATA, REPLACE_TIME_SERIES_ROW_DATA,
    SET_IDF_DERIVE_LAT,
    SET_IDF_DERIVE_LON,
    SET_IDF_DERIVE_DURATIONS,
    SET_IDF_DERIVE_RPS,
    SET_IDF_DERIVE_MAP_PICK_ACTIVE,
    DERIVE_IDF_REQUEST,
    SET_IDF_DERIVE_PROCESS_ID,
    SET_IDF_DERIVE_ERROR,
    SET_IDF_DERIVE_RESULT,
    SET_CELERY_ANUGA_ENABLED
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";

import {IdfTable, TemporalPattern, TimeSeries} from "./classesHydrology";

// TASK-934 — IDF Derive default form values. ERA5-Land hourly data does
// not improve below ~1h, so 60min is the smallest meaningful duration.
// Default RPs follow design-standard practice (2/5/10/20/50/100/200yr).
const IDF_DERIVE_DEFAULT_DURATIONS = '60, 180, 360, 720, 1440, 2880, 10080';
const IDF_DERIVE_DEFAULT_RPS = '2, 5, 10, 20, 50, 100, 200';

const initialIdfDerive = {
    lat: null,
    lon: null,
    durationsText: IDF_DERIVE_DEFAULT_DURATIONS,
    rpsText: IDF_DERIVE_DEFAULT_RPS,
    mapPickActive: false,
    processId: null,
    taskId: null,
    error: null,
    result: null,
    // Optimistic default — overridden once /api/v2/anuga/config/ resolves.
    // Sites with celery_anuga_enabled=false hit the 503 branch in the epic.
    celeryAnugaEnabled: true,
    inFlight: false
};

const initialState = {
    isHydrologyProject: false,
    showHydrologyMainMenu: false,
    activeHydrologyPage: "idf-table",
    idfDerive: initialIdfDerive
};

export const hydrologyKeyMap = {
    "idf-table": "idfTables",
    "temporal-pattern": "temporalPatterns",
    "time-series": "timeSeriess"
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

const createTimeSeriesFromJson = (timeSeriesJson) => {
    const timeSeriesInstance = new TimeSeries();
    timeSeriesInstance.id = timeSeriesJson?.id;
    timeSeriesInstance.project = timeSeriesJson?.project;
    timeSeriesInstance.name = timeSeriesJson?.name;
    timeSeriesInstance.description = timeSeriesJson?.description;
    timeSeriesInstance.source = timeSeriesJson?.source;
    timeSeriesInstance.owner = timeSeriesJson?.owner;
    timeSeriesInstance.data = timeSeriesJson?.data;
    return timeSeriesInstance;
};


export default ( state = initialState, action) => {
    switch (action.type) {
    case INIT_HYDROLOGY_FULFILLED:
        return {
            ...state,
            projectId: action.projectId
        };
    case SET_HYDROLOGY_IDF_TABLE_DATA:
        const idfTables = action.payload.map(idfTableJson => createIdfTableFromJson(idfTableJson));
        return {
            ...state,
            idfTables: idfTables
        };
    case SET_HYDROLOGY_TEMPORAL_PATTERN_DATA:
        const temporalPatterns = action.payload.map(temporalPatternJson => createTemporalPatternFromJson(temporalPatternJson));
        return {
            ...state,
            temporalPatterns: temporalPatterns
        };
    case SET_HYDROLOGY_TIME_SERIES_DATA:
        const timeSeriess = action.payload.map(timeSeriesJson => createTimeSeriesFromJson(timeSeriesJson));
        return {
            ...state,
            timeSeriess: timeSeriess
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
            newHydrologyItem = new TimeSeries();
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
            updatedActiveHydrologyItem = createTimeSeriesFromJson(action.item);
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
            updatedActiveHydrologyItem = createTimeSeriesFromJson(action.item);
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
                    idfTable.updateIntensityValues(action.rowIndex, action.columnId, action.value);
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
                    temporalPattern.updatePercentageValues(action.rowIndex, action.columnId, action.value);
                    temporalPattern.unsaved = true;
                    updatedActiveHydrologyItem = temporalPattern;
                }
                return temporalPattern;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case UPDATE_TIME_SERIES_ROW_DATA: {
        let updatedTimeSeries;

        let updatedTimeSeriess = state.timeSeriess.map((timeSeries) => {
            if (timeSeries.id === action.timeSeriesId) {
                timeSeries.updateRowValues(action.rowIndex, action.columnId, action.value);
                timeSeries.unsaved = true;
                updatedTimeSeries = timeSeries;
            }
            return timeSeries;
        });

        return {
            ...state,
            timeSeriess: updatedTimeSeriess,
            activeHydrologyItem: updatedTimeSeries || state.activeHydrologyItem
        };
    }
    case REPLACE_TIME_SERIES_ROW_DATA: {
        let updatedTimeSeries;

        let updatedTimeSeriess = state.timeSeriess.map((timeSeries) => {
            if (timeSeries.id === action.timeSeriesId) {
                timeSeries.setRowData(action.newRowData);
                timeSeries.unsaved = true;
                updatedTimeSeries = timeSeries;
            }
            return timeSeries;
        });

        return {
            ...state,
            timeSeriess: updatedTimeSeriess,
            activeHydrologyItem: updatedTimeSeries || state.activeHydrologyItem
        };
    }
    case SET_IDF_DERIVE_LAT:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), lat: action.lat}
        };
    case SET_IDF_DERIVE_LON:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), lon: action.lon}
        };
    case SET_IDF_DERIVE_DURATIONS:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), durationsText: action.text}
        };
    case SET_IDF_DERIVE_RPS:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), rpsText: action.text}
        };
    case SET_IDF_DERIVE_MAP_PICK_ACTIVE:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), mapPickActive: action.active}
        };
    case DERIVE_IDF_REQUEST:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                error: null,
                result: null,
                processId: null,
                taskId: null,
                inFlight: true
            }
        };
    case SET_IDF_DERIVE_PROCESS_ID:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                processId: action.processId,
                taskId: action.taskId,
                error: null
            }
        };
    case SET_IDF_DERIVE_ERROR:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                error: action.message,
                inFlight: false
            }
        };
    case SET_IDF_DERIVE_RESULT:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                result: action.idfTable,
                inFlight: false
            }
        };
    case SET_CELERY_ANUGA_ENABLED:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), celeryAnugaEnabled: action.enabled}
        };
    default:
        return state;
    }
};

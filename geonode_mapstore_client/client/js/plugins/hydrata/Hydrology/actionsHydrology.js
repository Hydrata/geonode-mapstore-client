const INIT_HYDROLOGY = 'INIT_HYDROLOGY';
const INIT_HYDROLOGY_FULFILLED = 'INIT_HYDROLOGY_FULFILLED';
const INIT_HYDROLOGY_REJECTED = 'INIT_HYDROLOGY_REJECTED';
const FETCH_HYDROLOGY_TIME_SERIES_DATA = 'FETCH_HYDROLOGY_TIME_SERIES_DATA';
const SET_HYDROLOGY_TIME_SERIES_DATA = 'SET_HYDROLOGY_TIME_SERIES_DATA';
const ERROR_HYDROLOGY_TIME_SERIES_DATA = 'ERROR_HYDROLOGY_TIME_SERIES_DATA';
const FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA = 'FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA';
const SET_HYDROLOGY_TEMPORAL_PATTERN_DATA = 'SET_HYDROLOGY_TEMPORAL_PATTERN_DATA';
const ERROR_HYDROLOGY_TEMPORAL_PATTERN_DATA = 'ERROR_HYDROLOGY_TEMPORAL_PATTERN_DATA';
const FETCH_HYDROLOGY_IDF_TABLE_DATA = 'FETCH_HYDROLOGY_IDF_TABLE_DATA';
const SET_HYDROLOGY_IDF_TABLE_DATA = 'SET_HYDROLOGY_IDF_TABLE_DATA';
const ERROR_HYDROLOGY_IDF_TABLE_DATA = 'ERROR_HYDROLOGY_IDF_TABLE_DATA';
const SET_HYDROLOGY_MAIN_MENU = 'SET_HYDROLOGY_MAIN_MENU';
const SET_ACTIVE_HYDROLOGY_PAGE = 'SET_ACTIVE_HYDROLOGY_PAGE';
const SET_ACTIVE_HYDROLOGY_ITEM = 'SET_ACTIVE_HYDROLOGY_ITEM';
const UPDATE_ACTIVE_HYDROLOGY_ITEM = 'UPDATE_ACTIVE_HYDROLOGY_ITEM';
const SAVE_HYDROLOGY_ITEM = 'SAVE_HYDROLOGY_ITEM';
const SAVE_HYDROLOGY_ITEM_SUCCESS = 'SAVE_HYDROLOGY_ITEM_SUCCESS';
const SAVE_HYDROLOGY_ITEM_FAILURE = 'SAVE_HYDROLOGY_ITEM_FAILURE';
const CREATE_HYDROLOGY_FORM = 'CREATE_HYDROLOGY_FORM';
const CREATE_HYDROLOGY_ITEM = 'CREATE_HYDROLOGY_ITEM';
const CREATE_HYDROLOGY_ITEM_SUCCESS = 'CREATE_HYDROLOGY_ITEM_SUCCESS';
const CREATE_HYDROLOGY_ITEM_FAILURE = 'CREATE_HYDROLOGY_ITEM_FAILURE';
const DELETE_HYDROLOGY_ITEM = 'DELETE_HYDROLOGY_ITEM';
const DELETE_HYDROLOGY_ITEM_SUCCESS = 'DELETE_HYDROLOGY_ITEM_SUCCESS';
const DELETE_HYDROLOGY_ITEM_FAILURE = 'DELETE_HYDROLOGY_ITEM_FAILURE';
const UPDATE_IDF_ROW_DATA = 'UPDATE_IDF_ROW_DATA';
const UPDATE_TEMPORAL_PATTERN_ROW_DATA = 'UPDATE_TEMPORAL_PATTERN_ROW_DATA';
const UPDATE_TIME_SERIES_ROW_DATA = 'UPDATE_TIME_SERIES_ROW_DATA';
const REPLACE_TIME_SERIES_ROW_DATA = 'REPLACE_TIME_SERIES_ROW_DATA';

// TASK-1450 (W3) — Preset picker: store the selected pattern key on the item.
const SET_TEMPORAL_PATTERN_PRESET = 'SET_TEMPORAL_PATTERN_PRESET';

// TASK-934 — IDF Derive panel actions.
const SET_IDF_DERIVE_LAT = 'SET_IDF_DERIVE_LAT';
const SET_IDF_DERIVE_LON = 'SET_IDF_DERIVE_LON';
const SET_IDF_DERIVE_DURATIONS = 'SET_IDF_DERIVE_DURATIONS';
const SET_IDF_DERIVE_RPS = 'SET_IDF_DERIVE_RPS';
const SET_IDF_DERIVE_MAP_PICK_ACTIVE = 'SET_IDF_DERIVE_MAP_PICK_ACTIVE';
const DERIVE_IDF_REQUEST = 'DERIVE_IDF_REQUEST';
const SET_IDF_DERIVE_PROCESS_ID = 'SET_IDF_DERIVE_PROCESS_ID';
const SET_IDF_DERIVE_ERROR = 'SET_IDF_DERIVE_ERROR';
const SET_IDF_DERIVE_RESULT = 'SET_IDF_DERIVE_RESULT';
const SET_CELERY_ANUGA_ENABLED = 'SET_CELERY_ANUGA_ENABLED';


const initHydrology = () => ({
    type: INIT_HYDROLOGY
});

const initHydrologyFulfilled = projectId => ({
    type: INIT_HYDROLOGY_FULFILLED,
    projectId
});

const initHydrologyRejected = (errorMessage) => ({
    type: INIT_HYDROLOGY_REJECTED,
    payload: errorMessage
});

const fetchHydrologyTimeSeriesData = () => ({
    type: FETCH_HYDROLOGY_TIME_SERIES_DATA
});

const setHydrologyTimeSeriesData = payload => ({
    type: SET_HYDROLOGY_TIME_SERIES_DATA,
    payload
});

const errorHydrologyTimeSeriesData = (errorMessage) => ({
    type: ERROR_HYDROLOGY_TIME_SERIES_DATA,
    payload: errorMessage
});

const fetchHydrologyTemporalPatternData = () => ({
    type: FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA
});

const setHydrologyTemporalPatternData = payload => ({
    type: SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    payload
});

const errorHydrologyTemporalPatternData = (errorMessage) => ({
    type: ERROR_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    payload: errorMessage
});

const fetchHydrologyIdfTableData = () => ({
    type: FETCH_HYDROLOGY_IDF_TABLE_DATA
});

const setHydrologyIdfTableData = payload => ({
    type: SET_HYDROLOGY_IDF_TABLE_DATA,
    payload
});

const errorHydrologyIdfTableData = (errorMessage) => ({
    type: ERROR_HYDROLOGY_IDF_TABLE_DATA,
    payload: errorMessage
});

const setHydrologyMainMenu = (visible) => ({
    type: SET_HYDROLOGY_MAIN_MENU,
    visible
});

const setActiveHydrologyPage = (pageName) => ({
    type: SET_ACTIVE_HYDROLOGY_PAGE,
    pageName
});

const setActiveHydrologyItem = (item) => ({
    type: SET_ACTIVE_HYDROLOGY_ITEM,
    item
});

const updateActiveHydrologyItem = (activeHydrologyPage, item, kv) => ({
    type: UPDATE_ACTIVE_HYDROLOGY_ITEM,
    activeHydrologyPage,
    item,
    kv
});

const saveHydrologyItem = (activeHydrologyPage, item) => ({
    type: SAVE_HYDROLOGY_ITEM,
    activeHydrologyPage,
    item
});

const saveHydrologyItemSuccess = (activeHydrologyPage, item) => ({
    type: SAVE_HYDROLOGY_ITEM_SUCCESS,
    activeHydrologyPage,
    item
});

const saveHydrologyItemFailure = (response) => ({
    type: SAVE_HYDROLOGY_ITEM_FAILURE,
    response,
    error: true
});

const createHydrologyForm = (activeHydrologyPage) => ({
    type: CREATE_HYDROLOGY_FORM,
    activeHydrologyPage
});

const createHydrologyItem = (activeHydrologyPage, item) => ({
    type: CREATE_HYDROLOGY_ITEM,
    activeHydrologyPage,
    item
});

const createHydrologyItemSuccess = (activeHydrologyPage, item) => ({
    type: CREATE_HYDROLOGY_ITEM_SUCCESS,
    activeHydrologyPage,
    item
});

const createHydrologyItemFailure = (response) => ({
    type: CREATE_HYDROLOGY_ITEM_FAILURE,
    response,
    error: true
});

const deleteHydrologyItem = (activeHydrologyPage, item) => ({
    type: DELETE_HYDROLOGY_ITEM,
    activeHydrologyPage,
    item
});

const deleteHydrologyItemSuccess = (activeHydrologyPage, item) => ({
    type: DELETE_HYDROLOGY_ITEM_SUCCESS,
    activeHydrologyPage,
    item
});

const deleteHydrologyItemFailure = (response) => ({
    type: DELETE_HYDROLOGY_ITEM_FAILURE,
    response,
    error: true
});

const updateIdfRowData = (idfTableId, rowIndex, columnId, value) => ({
    type: UPDATE_IDF_ROW_DATA,
    idfTableId,
    rowIndex,
    columnId,
    value
});

const updateTemporalPatternRowData = (temporalPatternId, rowIndex, columnId, value) => ({
    type: UPDATE_TEMPORAL_PATTERN_ROW_DATA,
    temporalPatternId,
    rowIndex,
    columnId,
    value
});

// TASK-1450 (W3) — store selected pattern key on the TemporalPattern item.
const setTemporalPatternPreset = (temporalPatternId, patternKey) => ({
    type: SET_TEMPORAL_PATTERN_PRESET,
    temporalPatternId,
    patternKey
});

const updateTimeSeriesRowData = (timeSeriesId, rowIndex, columnId, value) => ({
    type: UPDATE_TIME_SERIES_ROW_DATA,
    timeSeriesId,
    rowIndex,
    columnId,
    value
});

const replaceTimeSeriesRowData = (timeSeriesId, newRowData) => ({
    type: REPLACE_TIME_SERIES_ROW_DATA,
    timeSeriesId,
    newRowData
});

const setIdfDeriveLat = (lat) => ({type: SET_IDF_DERIVE_LAT, lat});
const setIdfDeriveLon = (lon) => ({type: SET_IDF_DERIVE_LON, lon});
const setIdfDeriveDurations = (text) => ({type: SET_IDF_DERIVE_DURATIONS, text});
const setIdfDeriveRPs = (text) => ({type: SET_IDF_DERIVE_RPS, text});
const setIdfDeriveMapPickActive = (active) => ({type: SET_IDF_DERIVE_MAP_PICK_ACTIVE, active});
const deriveIdfRequest = () => ({type: DERIVE_IDF_REQUEST});
const setIdfDeriveProcessId = (taskId, processId) => ({
    type: SET_IDF_DERIVE_PROCESS_ID,
    taskId,
    processId
});
const setIdfDeriveError = (message) => ({type: SET_IDF_DERIVE_ERROR, message});
const setIdfDeriveResult = (idfTable) => ({type: SET_IDF_DERIVE_RESULT, idfTable});
const setCeleryAnugaEnabled = (enabled) => ({type: SET_CELERY_ANUGA_ENABLED, enabled});

module.exports = {
    INIT_HYDROLOGY, initHydrology,
    INIT_HYDROLOGY_FULFILLED, initHydrologyFulfilled,
    INIT_HYDROLOGY_REJECTED, initHydrologyRejected,
    FETCH_HYDROLOGY_TIME_SERIES_DATA, fetchHydrologyTimeSeriesData,
    SET_HYDROLOGY_TIME_SERIES_DATA, setHydrologyTimeSeriesData,
    ERROR_HYDROLOGY_TIME_SERIES_DATA, errorHydrologyTimeSeriesData,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA, fetchHydrologyTemporalPatternData,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA, setHydrologyTemporalPatternData,
    ERROR_HYDROLOGY_TEMPORAL_PATTERN_DATA, errorHydrologyTemporalPatternData,
    FETCH_HYDROLOGY_IDF_TABLE_DATA, fetchHydrologyIdfTableData,
    SET_HYDROLOGY_IDF_TABLE_DATA, setHydrologyIdfTableData,
    ERROR_HYDROLOGY_IDF_TABLE_DATA, errorHydrologyIdfTableData,
    SET_HYDROLOGY_MAIN_MENU, setHydrologyMainMenu,
    SET_ACTIVE_HYDROLOGY_PAGE, setActiveHydrologyPage,
    SET_ACTIVE_HYDROLOGY_ITEM, setActiveHydrologyItem,
    UPDATE_ACTIVE_HYDROLOGY_ITEM, updateActiveHydrologyItem,
    SAVE_HYDROLOGY_ITEM, saveHydrologyItem,
    SAVE_HYDROLOGY_ITEM_SUCCESS, saveHydrologyItemSuccess,
    SAVE_HYDROLOGY_ITEM_FAILURE, saveHydrologyItemFailure,
    CREATE_HYDROLOGY_FORM, createHydrologyForm,
    CREATE_HYDROLOGY_ITEM, createHydrologyItem,
    CREATE_HYDROLOGY_ITEM_SUCCESS, createHydrologyItemSuccess,
    CREATE_HYDROLOGY_ITEM_FAILURE, createHydrologyItemFailure,
    DELETE_HYDROLOGY_ITEM, deleteHydrologyItem,
    DELETE_HYDROLOGY_ITEM_SUCCESS, deleteHydrologyItemSuccess,
    DELETE_HYDROLOGY_ITEM_FAILURE, deleteHydrologyItemFailure,
    UPDATE_IDF_ROW_DATA, updateIdfRowData,
    UPDATE_TEMPORAL_PATTERN_ROW_DATA, updateTemporalPatternRowData,
    UPDATE_TIME_SERIES_ROW_DATA, updateTimeSeriesRowData,
    REPLACE_TIME_SERIES_ROW_DATA, replaceTimeSeriesRowData,
    SET_TEMPORAL_PATTERN_PRESET, setTemporalPatternPreset,
    SET_IDF_DERIVE_LAT, setIdfDeriveLat,
    SET_IDF_DERIVE_LON, setIdfDeriveLon,
    SET_IDF_DERIVE_DURATIONS, setIdfDeriveDurations,
    SET_IDF_DERIVE_RPS, setIdfDeriveRPs,
    SET_IDF_DERIVE_MAP_PICK_ACTIVE, setIdfDeriveMapPickActive,
    DERIVE_IDF_REQUEST, deriveIdfRequest,
    SET_IDF_DERIVE_PROCESS_ID, setIdfDeriveProcessId,
    SET_IDF_DERIVE_ERROR, setIdfDeriveError,
    SET_IDF_DERIVE_RESULT, setIdfDeriveResult,
    SET_CELERY_ANUGA_ENABLED, setCeleryAnugaEnabled
};

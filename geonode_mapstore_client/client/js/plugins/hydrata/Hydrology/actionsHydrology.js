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

const updateIdfRowData = (idfTableId, rowData) => ({
    type: UPDATE_IDF_ROW_DATA,
    idfTableId,
    rowData
});

const updateTemporalPatternRowData = (temporalPatternId, rowData) => ({
    type: UPDATE_TEMPORAL_PATTERN_ROW_DATA,
    temporalPatternId,
    rowData
});

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
    UPDATE_TEMPORAL_PATTERN_ROW_DATA, updateTemporalPatternRowData
};

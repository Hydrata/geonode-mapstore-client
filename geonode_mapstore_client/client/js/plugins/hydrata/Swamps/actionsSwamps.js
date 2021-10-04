const INIT_SWAMPS = 'INIT_SWAMPS';
const SET_VISIBLE_SWAMPS_CHART = 'SET_VISIBLE_SWAMPS_CHART';
const SAVE_SWAMP_QUERY_TO_STORE = 'SAVE_SWAMP_QUERY_TO_STORE';
const SET_CURRENT_SWAMP_ID = 'SET_CURRENT_SWAMP_ID';
const CLEAR_CURRENT_SWAMP = 'CLEAR_CURRENT_SWAMP';
const SET_SELECTED_X_KEY = 'SET_SELECTED_X_KEY';
const SET_SELECTED_Y_KEY = 'SET_SELECTED_Y_KEY';
const REFRESH_PAGE = 'REFRESH_PAGE';

function initSwamps() {
    return {
        type: INIT_SWAMPS
    };
}

function setVisibleSwampsChart(visible) {
    return {
        type: SET_VISIBLE_SWAMPS_CHART,
        visible
    };
}

function setCurrentSwampId(currentSwampId) {
    return {
        type: SET_CURRENT_SWAMP_ID,
        currentSwampId
    };
}

function clearCurrentSwamp() {
    return {
        type: CLEAR_CURRENT_SWAMP
    };
}

function saveSwampQueryToStore(swampData) {
    return {
        type: SAVE_SWAMP_QUERY_TO_STORE,
        swampData
    };
}

function setSelectedXKey(xKey) {
    return {
        type: SET_SELECTED_X_KEY,
        selectedXKey: xKey
    };
}

function setSelectedYKey(yKey) {
    return {
        type: SET_SELECTED_Y_KEY,
        selectedYKey: yKey
    };
}

function refreshPage() {
    return {
        type: REFRESH_PAGE
    };
}

module.exports = {
    INIT_SWAMPS, initSwamps,
    REFRESH_PAGE, refreshPage,
    SET_VISIBLE_SWAMPS_CHART, setVisibleSwampsChart,
    SET_CURRENT_SWAMP_ID, setCurrentSwampId,
    CLEAR_CURRENT_SWAMP, clearCurrentSwamp,
    SAVE_SWAMP_QUERY_TO_STORE, saveSwampQueryToStore,
    SET_SELECTED_X_KEY, setSelectedXKey,
    SET_SELECTED_Y_KEY, setSelectedYKey
};

const INIT_SWAMPS = 'INIT_SWAMPS';
const SET_VISIBLE_SWAMPS_CHART = 'SET_VISIBLE_SWAMPS_CHART';
const PROCESS_SURVEY_SITES = 'PROCESS_SURVEY_SITES';
const SAVE_SWAMP_QUERY_TO_STORE = 'SAVE_SWAMP_QUERY_TO_STORE';
const SET_SELECTED_SWAMP_ID = 'SET_SELECTED_SWAMP_ID';
const CLEAR_SELECTED_SWAMP = 'CLEAR_SELECTED_SWAMP';
const SET_SELECTED_X_KEY = 'SET_SELECTED_X_KEY';
const SET_SELECTED_Y_KEY = 'SET_SELECTED_Y_KEY';
const REFRESH_SWAMPS = 'REFRESH_SWAMPS';
const TOGGLE_SELECTION_OF_SITE_ID = 'TOGGLE_SELECTION_OF_SITE_ID';
const TOGGLE_SELECTION_OF_SURVEY_KEY = 'TOGGLE_SELECTION_OF_SURVEY_KEY';

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

function setSelectedSwampId(selectedSwampId) {
    return {
        type: SET_SELECTED_SWAMP_ID,
        selectedSwampId
    };
}

function clearSelectedSwamp() {
    return {
        type: CLEAR_SELECTED_SWAMP
    };
}

function saveSwampQueryToStore(selectedSwampData) {
    return {
        type: SAVE_SWAMP_QUERY_TO_STORE,
        selectedSwampData
    };
}

function processSurveySites(surveySites) {
    return {
        type: PROCESS_SURVEY_SITES,
        surveySites
    };
}

function setSelectedXKey(xKey) {
    return {
        type: SET_SELECTED_X_KEY,
        selectedXKey: xKey
    };
}

function toggleSelectionOfSiteId(siteId) {
    return {
        type: TOGGLE_SELECTION_OF_SITE_ID,
        selectedSiteId: siteId
    };
}

function toggleSelectionOfSurveyKey(surveyKey) {
    return {
        type: TOGGLE_SELECTION_OF_SURVEY_KEY,
        selectedSurveyKey: surveyKey
    };
}

function setSelectedYKey(yKey) {
    return {
        type: SET_SELECTED_Y_KEY,
        selectedYKey: yKey
    };
}

function refreshSwamps() {
    return {
        type: REFRESH_SWAMPS
    };
}

module.exports = {
    INIT_SWAMPS, initSwamps,
    PROCESS_SURVEY_SITES, processSurveySites,
    REFRESH_SWAMPS, refreshSwamps,
    SET_VISIBLE_SWAMPS_CHART, setVisibleSwampsChart,
    SET_SELECTED_SWAMP_ID, setSelectedSwampId,
    CLEAR_SELECTED_SWAMP, clearSelectedSwamp,
    TOGGLE_SELECTION_OF_SITE_ID, toggleSelectionOfSiteId,
    TOGGLE_SELECTION_OF_SURVEY_KEY, toggleSelectionOfSurveyKey,
    SAVE_SWAMP_QUERY_TO_STORE, saveSwampQueryToStore,
    SET_SELECTED_X_KEY, setSelectedXKey,
    SET_SELECTED_Y_KEY, setSelectedYKey
};

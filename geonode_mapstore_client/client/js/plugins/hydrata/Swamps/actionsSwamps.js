const SET_VISIBLE_SWAMPS_CHART = 'SET_VISIBLE_SWAMPS_CHART';
const SAVE_SWAMPS_SURVEY_QUERY_TO_STORE = 'SAVE_SWAMPS_SURVEY_QUERY_TO_STORE';
const SET_CURRENT_SWAMPS_SURVEY_SITE_ID = 'SET_CURRENT_SWAMPS_SURVEY_SITE_ID';
const SET_SELECTED_X_KEY = 'SET_SELECTED_X_KEY';
const SET_SELECTED_Y_KEY = 'SET_SELECTED_Y_KEY';

function setVisibleSwampsChart(visible) {
    return {
        type: SET_VISIBLE_SWAMPS_CHART,
        visible
    };
}

function setCurrentSwampsSurveySiteId(currentSwampsSurveySiteId) {
    return {
        type: SET_CURRENT_SWAMPS_SURVEY_SITE_ID,
        currentSwampsSurveySiteId
    };
}

function saveSwampsQueryToStore(swampsSurveyData) {
    return {
        type: SAVE_SWAMPS_SURVEY_QUERY_TO_STORE,
        swampsSurveyData
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

module.exports = {
    SET_VISIBLE_SWAMPS_CHART, setVisibleSwampsChart,
    SET_CURRENT_SWAMPS_SURVEY_SITE_ID, setCurrentSwampsSurveySiteId,
    SAVE_SWAMPS_SURVEY_QUERY_TO_STORE, saveSwampsQueryToStore,
    SET_SELECTED_X_KEY, setSelectedXKey,
    SET_SELECTED_Y_KEY, setSelectedYKey
};

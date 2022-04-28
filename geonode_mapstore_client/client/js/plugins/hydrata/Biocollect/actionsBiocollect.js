const SET_VISIBLE_BIOCOLLECT_CHART = 'SET_VISIBLE_BIOCOLLECT_CHART';
const SAVE_SWAMPS_SURVEY_QUERY_TO_STORE = 'SAVE_SWAMPS_SURVEY_QUERY_TO_STORE';
const SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID = 'SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID';
const SET_SELECTED_X_KEY = 'SET_SELECTED_X_KEY';
const SET_SELECTED_Y_KEY = 'SET_SELECTED_Y_KEY';

function setVisibleBiocollectChart(visible) {
    return {
        type: SET_VISIBLE_BIOCOLLECT_CHART,
        visible
    };
}

function setCurrentBiocollectSurveySiteId(currentBiocollectSurveySiteId) {
    return {
        type: SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID,
        currentBiocollectSurveySiteId
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
    SET_VISIBLE_BIOCOLLECT_CHART, setVisibleBiocollectChart,
    SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID, setCurrentBiocollectSurveySiteId,
    SAVE_SWAMPS_SURVEY_QUERY_TO_STORE, saveSwampsQueryToStore,
    SET_SELECTED_X_KEY, setSelectedXKey,
    SET_SELECTED_Y_KEY, setSelectedYKey
};

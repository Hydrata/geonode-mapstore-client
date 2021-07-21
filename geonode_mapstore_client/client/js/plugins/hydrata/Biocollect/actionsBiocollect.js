const SET_VISIBLE_BIOCOLLECT_CHART = 'SET_VISIBLE_BIOCOLLECT_CHART';
const SAVE_SWAMPS_SURVEY_QUERY_TO_STORE = 'SAVE_SWAMPS_SURVEY_QUERY_TO_STORE';
const SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID = 'SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID';

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

module.exports = {
    SET_VISIBLE_BIOCOLLECT_CHART, setVisibleBiocollectChart,
    SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID, setCurrentBiocollectSurveySiteId,
    SAVE_SWAMPS_SURVEY_QUERY_TO_STORE, saveSwampsQueryToStore
};

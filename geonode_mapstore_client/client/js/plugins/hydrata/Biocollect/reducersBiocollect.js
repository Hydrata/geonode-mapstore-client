import {SET_VISIBLE_BIOCOLLECT_CHART, SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID, SAVE_SWAMPS_SURVEY_QUERY_TO_STORE} from "./actionsBiocollect";

export default ( state = {}, action) => {
    console.log(action);
    switch (action.type) {
    case SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID:
        return {
            ...state,
            currentBiocollectSurveySiteId: action.currentBiocollectSurveySiteId
        };
    case SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:
        return {
            ...state,
            swampsSurveyData: action.swampsSurveyData
        };
    case SET_VISIBLE_BIOCOLLECT_CHART:
        return {
            ...state,
            visibleBiocollectChart: action.visible
        };
    default:
        return state;
    }
};

import {
    SET_VISIBLE_SWAMPS_CHART,
    SET_SELECTED_SWAMP_ID,
    PROCESS_SURVEY_SITES,
    CLEAR_SELECTED_SWAMP,
    SAVE_SWAMP_QUERY_TO_STORE,
    TOGGLE_SELECTION_OF_SITE_ID,
    TOGGLE_SELECTION_OF_SURVEY_KEY,
    SET_SELECTED_X_KEY,
    SET_SELECTED_Y_KEY,
    REFRESH_SWAMPS
} from "./actionsSwamps";

const initialState = {
    selectedSwampId: null,
    selectedSwampData: null,
    availableSites: [],
    selectedSiteIds: [],
    selectedSurveyIds: []
};

export default ( state = initialState, action) => {
    // console.log(action);
    switch (action.type) {
    case SET_SELECTED_SWAMP_ID:
        return {
            ...state,
            selectedSwampId: action.selectedSwampId
        };
    case CLEAR_SELECTED_SWAMP:
        return {
            ...state,
            selectedSwampId: null,
            selectedSwampData: null
        };
    case SAVE_SWAMP_QUERY_TO_STORE:
        return {
            ...state,
            selectedSwampData: action.selectedSwampData
        };
    case TOGGLE_SELECTION_OF_SITE_ID:
        // add or remove the site_id:
        let newSelectedSiteIds;
        if (state.selectedSiteIds.includes(action.selectedSiteId)) {
            newSelectedSiteIds = state.selectedSiteIds.filter(item => item !== action.selectedSiteId);
        } else {
            newSelectedSiteIds = [...state.selectedSiteIds, action.selectedSiteId];
        }
        // now find the activities available on these sites so the user can select them:
        const filteredSurveySites = state.surveySites
            .filter(site => newSelectedSiteIds.includes(site.site_id));
        const _newAvailableSurveyKeys = filteredSurveySites
            .map((site) => Object.keys(site.activities));
        let newAvailableSurveyKeys = [...new Set([].concat.apply([], _newAvailableSurveyKeys))];
        // now get the actual activities data for graphing:
        let selectedActivities = {};
        newAvailableSurveyKeys.map((surveyKey) => {
            selectedActivities[surveyKey] = filteredSurveySites.map((site) => site.activities[surveyKey]);
        });
        let flattenedSelectedActivites = {};
        Object.entries(selectedActivities).forEach(([key, value]) => {
            const cleanValue = value.filter((obj) => obj !== undefined);
            flattenedSelectedActivites[key] = [...new Set([].concat.apply([], cleanValue))];
        });
        return {
            ...state,
            selectedSiteIds: newSelectedSiteIds,
            availableSurveyKeys: newAvailableSurveyKeys,
            selectedActivities: flattenedSelectedActivites
        };
    case TOGGLE_SELECTION_OF_SURVEY_KEY:
        return {
            ...state
        };
    case SET_VISIBLE_SWAMPS_CHART:
        return {
            ...state,
            visibleSwampsChart: action.visible
        };
    case PROCESS_SURVEY_SITES:
        return {
            ...state,
            surveySites: action.surveySites
        };
    case SET_SELECTED_X_KEY:
        return {
            ...state,
            selectedXKey: action.selectedXKey
        };
    case SET_SELECTED_Y_KEY:
        return {
            ...state,
            selectedYKey: action.selectedYKey
        };
    case REFRESH_SWAMPS:
        return state;
    default:
        return state;
    }
};

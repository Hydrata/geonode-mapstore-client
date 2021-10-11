import moment from 'moment';
import {
    SET_VISIBLE_SWAMPS_CHART,
    SET_SELECTED_SWAMP_ID,
    PROCESS_SURVEY_SITES,
    CLEAR_SELECTED_SWAMP,
    SAVE_SWAMP_QUERY_TO_STORE,
    TOGGLE_SELECTION_OF_SITE_ID,
    TOGGLE_SELECTION_OF_SURVEY_TYPE_KEY,
    SET_SELECTED_X_KEY,
    SET_SELECTED_Y_KEY,
    REFRESH_SWAMPS
} from "./actionsSwamps";

const initialState = {
    selectedSwampId: null,
    selectedSwampData: null,
    availableSites: [],
    selectedSiteIds: [],
    selectedSurveyIds: [],
    availableSurveyTypeKeys: [],
    selectedSurveyTypeKeys: [],
    availableActivityFields: [],
    selectedActivityField: null
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
        const availableSurveySites = state.surveySites
            .filter(site => newSelectedSiteIds.includes(site.site_id));
        const _newAvailableSurveyTypeKeys = availableSurveySites
            .map((site) => Object.keys(site.activities));
        let newAvailableSurveyTypeKeys = [...new Set([].concat.apply([], _newAvailableSurveyTypeKeys))];
        return {
            ...state,
            selectedSiteIds: newSelectedSiteIds,
            availableSurveyTypeKeys: newAvailableSurveyTypeKeys,
            availableSurveySites: availableSurveySites,
            selectedSurveyTypeKeys: [],
            selectedActivities: [],
            availableActivityFields: []
        };
    case TOGGLE_SELECTION_OF_SURVEY_TYPE_KEY:
        // add or remove the surveyTypeKey:
        let newSelectedSurveyTypeKeys;
        if (state.selectedSurveyTypeKeys.includes(action.selectedSurveyTypeKey)) {
            newSelectedSurveyTypeKeys = state.selectedSurveyTypeKeys.filter(item => item !== action.selectedSurveyTypeKey);
        } else {
            newSelectedSurveyTypeKeys = [...state.selectedSurveyTypeKeys, action.selectedSurveyTypeKey];
        }
        let flattenedSelectedActivites = {};
        // now get the actual activities data for graphing:
        let selectedSurveyTypes = {};
        newSelectedSurveyTypeKeys.map((surveyTypeKey) => {
            selectedSurveyTypes[surveyTypeKey] = state.availableSurveySites.map((site) => site.activities[surveyTypeKey]);
        });
        Object.entries(selectedSurveyTypes).forEach(([key, value]) => {
            const cleanValue = value.filter((obj) => obj !== undefined);
            flattenedSelectedActivites[key] = [...new Set([].concat.apply([], cleanValue))];
        });
        let availableActivityFields = [];
        let formattedSelectedActivites = [];
        for (let surveyType in flattenedSelectedActivites) {
            if (flattenedSelectedActivites.hasOwnProperty(surveyType)) {
                formattedSelectedActivites = flattenedSelectedActivites[surveyType].map((activity) => {
                    for (let field in activity.fields) {
                        if (activity.fields.hasOwnProperty(field)) {
                            activity[field] = activity.fields[field];
                            if (!availableActivityFields.includes(field)) {
                                availableActivityFields.push(field);
                            }
                        }
                    }
                    activity.js_survey_date_time = new Date(activity.survey_date_time).getTime();
                    return activity;
                });
            }
        }
        return {
            ...state,
            selectedSurveyTypeKeys: newSelectedSurveyTypeKeys,
            selectedActivities: formattedSelectedActivites,
            availableActivityFields: availableActivityFields
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

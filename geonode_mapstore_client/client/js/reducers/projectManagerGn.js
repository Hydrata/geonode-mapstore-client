import { SET_PROJECT_MANAGER_CONFIG, FETCH_PROJECT_MANAGER_CONFIG } from "../actions/projectManagerGn";

export default ( state = {}, action) => {
    switch (action.type) {
    case FETCH_PROJECT_MANAGER_CONFIG:
        return {
            ...state
        };
    case SET_PROJECT_MANAGER_CONFIG:
        return {
            ...state,
            projectConfig: action.projectConfig
        };
    default:
        return state;
    }
};

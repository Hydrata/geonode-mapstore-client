import { LOAD_PROJECT_MANAGER_CONFIG } from "../actions/projectManagerGn";

export default ( state = {}, action) => {
    switch (action.type) {
    case LOAD_PROJECT_MANAGER_CONFIG:
        return {
            ...state,
            something: 'something',
            projectConfig: action.projectConfig
        };
    default:
        return state;
    }
};

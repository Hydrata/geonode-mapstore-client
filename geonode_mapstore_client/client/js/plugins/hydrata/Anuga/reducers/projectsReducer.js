import {
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_RESOURCES
} from "../actionsAnuga";

const initialState = {
    data: null,
    loading: false,
    anugaHomePageResources: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_PROJECT_DATA:
        return {
            ...state,
            data: action.data
        };
    case SET_ANUGA_RESOURCES: {
        let projects = action.data?.projects
            ?.map(project => project?.base_map_full)
            .filter(map => !map?.featured);
        if (projects) {
            projects.sort((a, b) => {
                let dateA = a?.base_map_full ? new Date(a.base_map_full.last_updated) : new Date(0);
                let dateB = b?.base_map_full ? new Date(b.base_map_full.last_updated) : new Date(0);
                return dateB - dateA;
            });
        }
        return {
            ...state,
            anugaHomePageResources: {
                ...action.data,
                projects: projects
            }
        };
    }
    default:
        return state;
    }
};

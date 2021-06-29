import {
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    FETCH_PROJECT_MANAGER_CONFIG,
    SET_MENU_GROUP,
    SET_ORG_VISIBILITY
} from "./actionsProjectManager";

export default ( state = {}, action) => {
    switch (action.type) {
    case FETCH_PROJECT_MANAGER_CONFIG:
        return {
            ...state,
            fetching: action.mapId
        };
    case FETCH_PROJECT_MANAGER_CONFIG_SUCCESS:
        return {
            ...state,
            fetching: null,
            data: action.payload
        };
    case SET_MENU_GROUP:
        if (state.openMenuGroup?.id_label === action.payload?.id_label) {
            return {
                ...state,
                openMenuGroup: null
            };
        }
        return {
            ...state,
            openMenuGroup: action.payload
        };
    case SET_ORG_VISIBILITY:
        return {
            ...state,
            data: {
                ...state.data,
                organisations: state?.data?.organisations?.map(org => {
                    if (org.id === action.org.id) {
                        return {
                            ...org,
                            visibility: action.isVisible
                        };
                    }
                    return org;
                })
            }
        };
    default:
        return state;
    }
};

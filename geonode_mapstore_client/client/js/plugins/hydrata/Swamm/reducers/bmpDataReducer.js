import {
    SET_SWAMM_PROJECT_DATA,
    FETCH_GROUP_PROFILES,
    FETCH_GROUP_PROFILES_SUCCESS,
    FETCH_PROJECT_MANAGER_CONFIG,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    FETCH_SWAMM_BMPTYPES,
    FETCH_SWAMM_BMPTYPES_SUCCESS,
    FETCH_SWAMM_ALL_BMPS_SUCCESS,
    FETCH_SWAMM_BMP_STATUSES,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS,
    FETCH_SWAMM_TARGETS_SUCCESS,
    SELECT_SWAMM_TARGET_ID,
    UPDATE_BMP_TYPE_GROUPS,
    SUBMIT_BMP_FORM_SUCCESS,
    DELETE_BMP_SUCCESS
} from "../actionsSwamm";

const bmpDataReducer = (state, action) => {
    switch (action.type) {
    case SET_SWAMM_PROJECT_DATA:
        return { projectData: action.projectData };
    case FETCH_GROUP_PROFILES:
        return { fetchingGroupProfiles: action.groupProfiles };
    case FETCH_GROUP_PROFILES_SUCCESS:
        return { fetchingGroupProfiles: false, groupProfiles: action.groupProfiles };
    case FETCH_PROJECT_MANAGER_CONFIG:
        return { fetching: action.mapId };
    case FETCH_PROJECT_MANAGER_CONFIG_SUCCESS:
        return { fetching: null, data: action.payload };
    case FETCH_SWAMM_BMPTYPES:
        return { fetching: action.mapId };
    case FETCH_SWAMM_BMPTYPES_SUCCESS: {
        const bmpTypes = action.bmpTypes;
        bmpTypes.sort((a, b) => a.name.localeCompare(b.name));
        return { fetching: false, bmpTypes: bmpTypes };
    }
    case FETCH_SWAMM_ALL_BMPS_SUCCESS:
        return { fetching: false, allBmps: action.allBmps };
    case FETCH_SWAMM_BMP_STATUSES:
        return { fetchingStatuses: true };
    case FETCH_SWAMM_BMP_STATUSES_SUCCESS:
        return { statuses: action.statuses };
    case FETCH_SWAMM_TARGETS_SUCCESS:
        return { fetchingTargets: false, targets: action.targets };
    case SELECT_SWAMM_TARGET_ID:
        return { selectedTargetId: action.selectedTargetId };
    case UPDATE_BMP_TYPE_GROUPS: {
        const bmpTypeGroups = action.bmpTypeGroups;
        bmpTypeGroups.map(bmpTypeGroup => {
            if (bmpTypeGroup?.[2]) {
                return bmpTypeGroup;
            }
            bmpTypeGroup.push(true);
            return bmpTypeGroup;
        });
        return { bmpTypeGroups: bmpTypeGroups };
    }
    case SUBMIT_BMP_FORM_SUCCESS: {
        const allBmpIds = state.allBmps?.map((bmp) => bmp.id);
        if (allBmpIds.indexOf(action.bmp?.id) > -1) {
            return {
                allBmps: state.allBmps.map((bmp) => {
                    if (bmp.id === action.bmp?.id) {
                        return action.bmp;
                    }
                    return bmp;
                })
            };
        }
        return { allBmps: [...state.allBmps, action.bmp] };
    }
    case DELETE_BMP_SUCCESS:
        return { allBmps: state.allBmps.filter((bmp) => bmp.id !== action.bmpId) };
    default:
        return {};
    }
};

export default bmpDataReducer;

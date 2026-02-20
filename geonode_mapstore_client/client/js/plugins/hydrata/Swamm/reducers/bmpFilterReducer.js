import {
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_TYPE_GROUP,
    SET_BMP_TYPE,
    TOGGLE_BMP_PRIORITY_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    SET_BMP_FILTER_MODE,
    SET_EXPANDED_FILTER
} from "../actionsSwamm";

const bmpFilterReducer = (state, action) => {
    switch (action.type) {
    case TOGGLE_BMP_TYPE_VISIBILITY:
        return {
            bmpTypes: state.bmpTypes.map(bmpType => {
                if (bmpType.id === action.bmpType.id) {
                    return { ...bmpType, visibility: !action.bmpType?.visibility };
                }
                return bmpType;
            })
        };
    case TOGGLE_BMP_TYPE_GROUP:
        return {
            bmpTypeGroups: state.bmpTypeGroups.map(bmpTypeGroup => {
                if (bmpTypeGroup[0] === action.bmpTypeGroup?.[0]) {
                    if (bmpTypeGroup?.[2]) {
                        return [bmpTypeGroup[0], bmpTypeGroup[1]];
                    }
                    return [...bmpTypeGroup, true];
                }
                return bmpTypeGroup;
            }),
            bmpTypes: state.bmpTypes.map(bmpType => {
                if (bmpType.group_name === action.bmpTypeGroup?.[0]) {
                    const visibility = action.bmpTypeGroup?.[2];
                    return { ...bmpType, visibility: visibility };
                }
                return bmpType;
            })
        };
    case SET_BMP_TYPE:
        return {
            bmpTypes: state.bmpTypes.map(bmpType => {
                if (bmpType.id === action.bmpType.id) {
                    return { ...bmpType, visibility: action.isVisible };
                }
                return bmpType;
            })
        };
    case TOGGLE_BMP_PRIORITY_VISIBILITY:
        return {
            priorities: state.priorities.map(priority => {
                if (priority.id === action.priority.id) {
                    return { ...priority, visibility: !action.priority?.visibility };
                }
                return priority;
            })
        };
    case TOGGLE_BMP_GROUP_PROFILE_VISIBILITY:
        return {
            groupProfiles: state.groupProfiles.map(groupProfile => {
                if (groupProfile.id === action.groupProfile.id) {
                    return { ...groupProfile, visibility: !action.groupProfile?.visibility };
                }
                return groupProfile;
            })
        };
    case TOGGLE_BMP_STATUS_VISIBILITY:
        return {
            statuses: state.statuses.map(status => {
                if (status.id === action.status.id) {
                    return { ...status, visibility: !action.status?.visibility };
                }
                return status;
            })
        };
    case SET_ALL_BMP_TYPES_VISIBILITY:
        return {
            bmpTypes: state.bmpTypes.map(bmpType => ({
                ...bmpType,
                visibility: action.boolValue
            }))
        };
    case SET_BMP_FILTER_MODE:
        return { bmpFilterMode: action.bmpFilterMode };
    case SET_EXPANDED_FILTER:
        if (state.expandedFilter === action.expandedFilter) {
            return { expandedFilter: null };
        }
        return { expandedFilter: action.expandedFilter };
    default:
        return {};
    }
};

export default bmpFilterReducer;

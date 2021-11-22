import {
    FETCH_SWAMM_BMPTYPES_SUCCESS,
    FETCH_SWAMM_BMPTYPES,
    FETCH_SWAMM_ALL_BMPS_SUCCESS,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    FETCH_PROJECT_MANAGER_CONFIG,
    FETCH_GROUP_PROFILES_SUCCESS,
    FETCH_GROUP_PROFILES,
    FETCH_SWAMM_BMP_STATUSES,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS,
    FETCH_SWAMM_TARGETS_SUCCESS,
    SELECT_SWAMM_TARGET_ID,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_PRIORITY_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    SET_BMP_TYPE,
    SET_CHANGING_BMP_TYPE,
    SET_COMPLEX_BMP_FORM,
    SET_MENU_GROUP,
    SET_EXPANDED_FILTER,
    SET_BMP_LAYERS,
    SHOW_BMP_FORM,
    HIDE_BMP_FORM,
    SHOW_LOADING_BMP,
    HIDE_LOADING_BMP,
    SHOW_SWAMM_DATA_GRID,
    HIDE_SWAMM_DATA_GRID,
    SHOW_SWAMM_BMP_CHART,
    HIDE_SWAMM_BMP_CHART,
    SHOW_BMP_MANAGER,
    HIDE_BMP_MANAGER,
    TOGGLE_BMP_MANAGER,
    MAKE_BMP_FORM,
    CLEAR_BMP_FORM,
    MAKE_DEFAULTS_BMP_FORM,
    MAKE_EXISTING_BMP_FORM,
    UPDATE_BMP_FORM,
    SUBMIT_BMP_FORM_SUCCESS,
    SUBMIT_BMP_FORM_ERROR,
    SET_DRAWING_BMP_LAYER_NAME,
    CLEAR_DRAWING_BMP_LAYER_NAME,
    SET_EDITING_BMP_FEATURE_ID,
    REGISTER_MISSING_BMP_FEATURE_ID,
    CLEAR_EDITING_BMP_FEATURE_ID,
    UPDATE_BMP_TYPE_GROUPS,
    DELETE_BMP_SUCCESS,
    SET_BMP_FILTER_MODE,
    SHOW_TARGET_FORM,
    HIDE_TARGET_FORM,
    UPDATE_TARGET_FORM
} from "./actionsSwamm";

const initialState = {
    showOutlets: true,
    showFootprints: true,
    showWatersheds: true,
    bmpTypes: [],
    groupProfiles: [],
    allBmps: [],
    statuses: [],
    targets: [],
    visibleBmpForm: false,
    visibleTargetForm: false,
    creatingNewBmp: false,
    drawingBmpLayerName: false,
    bmpFilterMode: 'type',
    expandedFilter: null,
    priorities: [
        {id: 0, label: 'Not Assigned', value: 0, visibility: true},
        {id: 1, label: 'Critical', value: 1, visibility: true},
        {id: 2, label: 'Normal', value: 2, visibility: true},
        {id: 3, label: 'Low', value: 3, visibility: true}
    ]
};

export default ( state = initialState, action) => {
    console.log(action);
    switch (action.type) {
    case FETCH_GROUP_PROFILES:
        return {
            ...state,
            fetchingGroupProfiles: action.groupProfiles
        };
    case FETCH_GROUP_PROFILES_SUCCESS:
        return {
            ...state,
            fetchingGroupProfiles: false,
            groupProfiles: action.groupProfiles
        };
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
    case FETCH_SWAMM_BMPTYPES:
        return {
            ...state,
            fetching: action.mapId
        };
    case FETCH_SWAMM_BMPTYPES_SUCCESS:
        return {
            ...state,
            fetching: false,
            bmpTypes: action.bmpTypes
        };
    case FETCH_SWAMM_ALL_BMPS_SUCCESS:
        return {
            ...state,
            fetching: false,
            allBmps: action.allBmps
        };
    case FETCH_SWAMM_BMP_STATUSES:
        return {
            ...state,
            fetchingStatuses: true
        };
    case FETCH_SWAMM_BMP_STATUSES_SUCCESS:
        return {
            ...state,
            statuses: action.statuses
        };
    case TOGGLE_BMP_TYPE_VISIBILITY:
        return {
            ...state,
            bmpTypes: state.bmpTypes.map(bmpType => {
                if (bmpType.id === action.bmpType.id) {
                    return {
                        ...bmpType,
                        visibility: !action.bmpType.visibility
                    };
                }
                return bmpType;
            })
        };
    case SET_BMP_TYPE:
        return {
            ...state,
            bmpTypes: state.bmpTypes.map(bmpType => {
                if (bmpType.id === action.bmpType.id) {
                    return {
                        ...bmpType,
                        visibility: action.isVisible
                    };
                }
                return bmpType;
            })
        };
    case TOGGLE_BMP_PRIORITY_VISIBILITY:
        return {
            ...state,
            priorities: state.priorities.map(priority => {
                if (priority.id === action.priority.id) {
                    return {
                        ...priority,
                        visibility: !action.priority.visibility
                    };
                }
                return priority;
            })
        };
    case TOGGLE_BMP_GROUP_PROFILE_VISIBILITY:
        return {
            ...state,
            groupProfiles: state.groupProfiles.map(groupProfile => {
                if (groupProfile.id === action.groupProfile.id) {
                    return {
                        ...groupProfile,
                        visibility: !action.groupProfile.visibility
                    };
                }
                return groupProfile;
            })
        };
    case TOGGLE_BMP_STATUS_VISIBILITY:
        return {
            ...state,
            statuses: state.statuses.map(status => {
                if (status.id === action.status.id) {
                    return {
                        ...status,
                        visibility: !action.status.visibility
                    };
                }
                return status;
            })
        };
    case SET_ALL_BMP_TYPES_VISIBILITY:
        return {
            ...state,
            bmpTypes: state.bmpTypes.map(bmpType => {
                bmpType.visibility = action.boolValue;
                return bmpType;
            })
        };
    case SET_MENU_GROUP:
        if (action.payload) {
            return {
                ...state,
                visibleBmpManager: false
            };
        }
        return state;
    case SHOW_BMP_MANAGER:
        return {
            ...state,
            visibleBmpManager: true
        };
    case HIDE_BMP_MANAGER:
        return {
            ...state,
            visibleBmpManager: false
        };
    case TOGGLE_BMP_MANAGER:
        return {
            ...state,
            visibleBmpManager: !state.visibleBmpManager
        };
    case SHOW_SWAMM_DATA_GRID:
        return {
            ...state,
            visibleSwammDataGrid: true
        };
    case HIDE_SWAMM_DATA_GRID:
        return {
            ...state,
            visibleSwammDataGrid: false
        };
    case SHOW_SWAMM_BMP_CHART:
        return {
            ...state,
            visibleSwammBmpChart: true
        };
    case HIDE_SWAMM_BMP_CHART:
        return {
            ...state,
            visibleSwammBmpChart: false
        };
    case SHOW_BMP_FORM:
        return {
            ...state,
            visibleBmpForm: true
        };
    case SHOW_LOADING_BMP:
        return {
            ...state,
            loadingBmp: true
        };
    case HIDE_LOADING_BMP:
        return {
            ...state,
            loadingBmp: false
        };
    case MAKE_BMP_FORM:
        return {
            ...state,
            creatingNewBmp: true,
            visibleBmpForm: true,
            storedBmpForm: {
                group_profile_id: action.groupProfile.pk,
                group_profile: action.groupProfile,
                bmpName: ''
            }
        };
    case MAKE_DEFAULTS_BMP_FORM:
        const defaultsForm = {
            bmpName: action.bmpType.name,
            type: action.bmpType.id,
            type_data: action.bmpType,
            project: action.bmpType.project.id,
            override_n_surface_red_percent: action.bmpType.n_surface_red_percent,
            override_p_surface_red_percent: action.bmpType.p_surface_red_percent,
            override_s_surface_red_percent: action.bmpType.s_surface_red_percent,
            override_n_tiled_red_percent: action.bmpType.n_tiled_red_percent,
            override_p_tiled_red_percent: action.bmpType.p_tiled_red_percent,
            override_n_erosion_red_percent: action.bmpType.n_erosion_red_percent,
            override_p_erosion_red_percent: action.bmpType.p_erosion_red_percent,
            override_s_erosion_red_percent: action.bmpType.s_erosion_red_percent,
            override_cost_base: action.bmpType.cost_base,
            override_cost_rate_per_watershed_area: action.bmpType.cost_rate_per_watershed_area,
            override_cost_rate_per_footprint_area: action.bmpType.cost_rate_per_footprint_area,
            notes: ''
        };
        return {
            ...state,
            storedBmpForm: {
                ...state.storedBmpForm,
                ...defaultsForm
            }
        };
    case MAKE_EXISTING_BMP_FORM:
        const outletFid = state?.storedBmpForm?.outlet_fid ? state.storedBmpForm?.outlet_fid : action.bmp?.outlet_fid;
        const footprintFid = state?.storedBmpForm?.footprint_fid ? state.storedBmpForm?.footprint_fid : action.bmp?.footprint_fid;
        const watershedFid = state?.storedBmpForm?.watershed_fid ? state.storedBmpForm?.watershed_fid : action.bmp?.watershed_fid;
        const existingForm = {
            ...action.bmp,
            id: action.bmp.id,
            bmpName: action.bmp.type_data.name,
            type: action.bmp.type_data.id,
            type_data: action.bmp.type_data,
            project: action.bmp.project,
            group_profile: action.bmp.group_profile,
            group_profile_id: action.bmp.group_profile?.id,
            override_n_surface_red_percent: action.bmp.override_n_surface_red_percent,
            override_p_surface_red_percent: action.bmp.override_p_surface_red_percent,
            override_s_surface_red_percent: action.bmp.override_s_surface_red_percent,
            override_n_tiled_red_percent: action.bmp.override_n_tiled_red_percent,
            override_p_tiled_red_percent: action.bmp.override_p_tiled_red_percent,
            override_n_erosion_red_percent: action.bmp.override_n_erosion_red_percent,
            override_p_erosion_red_percent: action.bmp.override_p_erosion_red_percent,
            override_s_erosion_red_percent: action.bmp.override_s_erosion_red_percent,
            override_cost_base: action.bmp.override_cost_base,
            override_cost_rate_per_watershed_area: action.bmp.override_cost_rate_per_watershed_area,
            override_cost_rate_per_footprint_area: action.bmp.override_cost_rate_per_footprint_area,
            notes: action.bmp.notes,
            owner_identifier: action.bmp.owner_identifier,
            field_identifier: action.bmp.field_identifier,
            outlet_fid: outletFid,
            footprint_fid: footprintFid,
            watershed_fid: watershedFid
        };
        return {
            ...state,
            storedBmpForm: existingForm,
            updatingBmp: null
        };
    case HIDE_BMP_FORM:
        return {
            ...state,
            visibleBmpForm: false
        };
    case CLEAR_BMP_FORM:
        return {
            ...state,
            creatingNewBmp: false,
            storedBmpForm: null,
            BmpFormBmpTypeId: null,
            visibleBmpForm: false,
            updatingBmp: null
        };
    case SUBMIT_BMP_FORM_SUCCESS:
        const allBmpIds = state.allBmps?.map((bmp) => bmp.id);
        console.log("allBmpIds:", allBmpIds);
        if (allBmpIds.indexOf(action.bmp.id) > -1) {
            return {
                ...state,
                allBmps: state.allBmps.map((bmp) => {
                    if (bmp.id === action.bmp.id) {
                        return action.bmp;
                    }
                    return bmp;
                })
            };
        }
        return {
            ...state,
            allBmps: [...state.allBmps, action.bmp]
        };
    case SUBMIT_BMP_FORM_ERROR:
        return {
            ...state,
            showSubmitBmpFormError: true
        };
    case UPDATE_BMP_FORM:
        console.log('heard UPDATE_BMP_FORM', action);
        if (action?.kv?.type_data?.id) {
            return {
                ...state,
                BmpFormBmpTypeId: action.kv.type_data.id
            };
        }
        if (action?.kv?.group_profile) {
            return {
                ...state,
                storedBmpForm: {
                    ...state.storedBmpForm,
                    ...action.kv,
                    group_profile: action?.kv?.group_profile,
                    group_profile_id: action?.kv?.group_profile?.pk
                }
            };
        }
        return  {
            ...state,
            storedBmpForm: {
                ...state.storedBmpForm,
                ...action.kv
            }
        };
    case SET_DRAWING_BMP_LAYER_NAME:
        let drawingBmpLayerName = false;
        if (action.drawingBmpLayerName !== state.drawingBmpLayerName) {
            drawingBmpLayerName = action.drawingBmpLayerName;
        }
        return {
            ...state,
            drawingBmpLayerName: drawingBmpLayerName
        };
    case CLEAR_DRAWING_BMP_LAYER_NAME:
        return {
            ...state,
            drawingBmpLayerName: null
        };
    case REGISTER_MISSING_BMP_FEATURE_ID:
        return {
            ...state,
            missingBmpFeatureId: action.missingBmpFeatureId
        };
    case SET_COMPLEX_BMP_FORM:
        return {
            ...state,
            complexBmpForm: action.complexBmpForm
        };
    case SET_EXPANDED_FILTER:
        if (state.expandedFilter === action.expandedFilter) {
            return {
                ...state,
                expandedFilter: null
            };
        }
        return {
            ...state,
            expandedFilter: action.expandedFilter
        };
    case SET_BMP_LAYERS:
        return {
            ...state,
            bmpOutletLayer: action.bmpOutletLayer,
            bmpFootprintLayer: action.bmpFootprintLayer,
            bmpWatershedLayer: action.bmpWatershedLayer
        };
    case SET_CHANGING_BMP_TYPE:
        return {
            ...state,
            changingBmpType: action.changingBmpType
        };
    case SET_EDITING_BMP_FEATURE_ID:
        return {
            ...state,
            editingBmpFeatureId: action.editingBmpFeatureId
        };
    case CLEAR_EDITING_BMP_FEATURE_ID:
        return {
            ...state,
            editingBmpFeatureId: null
        };
    case DELETE_BMP_SUCCESS:
        return {
            ...state,
            allBmps: state.allBmps.filter((bmp) => bmp.id !== action.bmpId)
        };
    case FETCH_SWAMM_TARGETS_SUCCESS:
        return {
            ...state,
            fetchingTargets: false,
            targets: action.targets
        };
    case SELECT_SWAMM_TARGET_ID:
        return {
            ...state,
            selectedTargetId: action.selectedTargetId
        };
    case SET_BMP_FILTER_MODE:
        return {
            ...state,
            bmpFilterMode: action.bmpFilterMode
        };
    case UPDATE_TARGET_FORM:
        return  {
            ...state,
            targetForm: {
                ...state.targetForm,
                ...action.kv
            }
        };
    case SHOW_TARGET_FORM:
        if (action.target) {
            return {
                ...state,
                visibleTargetForm: action.visibleTargetForm,
                targetForm: action.target
            };
        }
        return {
            ...state,
            visibleTargetForm: action.visibleTargetForm
        };
    case HIDE_TARGET_FORM:
        return {
            ...state,
            visibleTargetForm: action.visibleTargetForm
        };
    case UPDATE_BMP_TYPE_GROUPS:
        return {
            ...state,
            bmpTypeGroups: action.bmpTypeGroups
        };
    default:
        return state;
    }
};

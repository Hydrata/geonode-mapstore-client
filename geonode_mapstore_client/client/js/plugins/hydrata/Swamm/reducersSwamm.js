import {
    FETCH_SWAMM_BMPTYPES_SUCCESS,
    FETCH_SWAMM_BMPTYPES,
    FETCH_SWAMM_ALL_BMPS_SUCCESS,
    FETCH_SWAMM_BMP_STATUSES,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS,
    FETCH_SWAMM_TARGETS_SUCCESS,
    SELECT_SWAMM_TARGET_ID,
    // TOGGLE_OUTLETS,
    // TOGGLE_FOOTPRINTS,
    // TOGGLE_WATERSHEDS,
    TOGGLE_BMP_TYPE,
    SET_BMP_TYPE,
    SHOW_BMP_FORM,
    HIDE_BMP_FORM,
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
    CLEAR_EDITING_BMP_FEATURE_ID,
    DELETE_BMP_SUCCESS,
    SET_BMP_FILTER_MODE,
    SHOW_TARGET_FORM,
    HIDE_TARGET_FORM,
    UPDATE_TARGET_FORM,
    CLEAR_TARGET_FORM,
    SUBMIT_TARGET_FORM,
    SUBMIT_TARGET_FORM_SUCCESS,
    SUBMIT_TARGET_FORM_ERROR,
    DELETE_TARGET,
    DELETE_TARGET_SUCCESS,
    DELETE_TARGET_ERROR
} from "./actionsSwamm";
import {
    SET_MENU_GROUP
} from "../ProjectManager/actionsProjectManager";
import { LOAD_FEATURE_INFO } from "../../../../MapStore2/web/client/actions/mapInfo";

const initialState = {
    showOutlets: true,
    showFootprints: true,
    showWatersheds: true,
    bmpTypes: [],
    allBmps: [],
    statuses: [],
    targets: [],
    visibleBmpForm: false,
    visibleTargetForm: false,
    creatingNewBmp: false,
    drawingBmpLayerName: false,
    bmpFilterMode: 'type'
};

export default ( state = initialState, action) => {
    switch (action.type) {
    case LOAD_FEATURE_INFO:
        const possibleBmpFeatures = action?.data?.features?.map((feature) => {
            if (
                /([a-zA-Z0-9]{3}_){2}outlet/.test(feature.id) ||
                /([a-zA-Z0-9]{3}_){2}footprint/.test(feature.id) ||
                /([a-zA-Z0-9]{3}_){2}watershed/.test(feature.id)
            ) { return feature;}
            return null;
        });
        if (!possibleBmpFeatures) {
            return state;
        }
        if (possibleBmpFeatures[0]) {
            let bmp;
            if (state.allBmps.filter((bmpToCheck) => bmpToCheck.watershed_fid === possibleBmpFeatures[0].id)[0]) {
                bmp = state.allBmps.filter((bmpToCheck) => bmpToCheck.watershed_fid === possibleBmpFeatures[0].id)[0];
            }
            if (state.allBmps.filter((bmpToCheck) => bmpToCheck.footprint_fid === possibleBmpFeatures[0].id)[0]) {
                bmp = state.allBmps.filter((bmpToCheck) => bmpToCheck.footprint_fid === possibleBmpFeatures[0].id)[0];
            }
            if (state.allBmps.filter((bmpToCheck) => bmpToCheck.outlet_fid === possibleBmpFeatures[0].id)[0]) {
                bmp = state.allBmps.filter((bmpToCheck) => bmpToCheck.outlet_fid === possibleBmpFeatures[0].id)[0];
            }
            console.log('possibleBmpFeatures', possibleBmpFeatures);
            if (!bmp) {
                alert(`error: Orphaned geometry ${JSON.stringify(possibleBmpFeatures[0])}`);
                return state;
            }
            return {
                ...state,
                visibleBmpForm: true,
                updatingBmp: bmp
            };
        }
        return state;
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
    case TOGGLE_BMP_TYPE:
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
    // case TOGGLE_OUTLETS:
    //     return {
    //         ...state,
    //         showOutlets: !state.showOutlets
    //     };
    // case TOGGLE_FOOTPRINTS:
    //     return {
    //         ...state,
    //         showFootprints: !state.showFootprints
    //     };
    // case TOGGLE_WATERSHEDS:
    //     return {
    //         ...state,
    //         showWatersheds: !state.showWatersheds
    //     };
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
    case MAKE_BMP_FORM:
        return {
            ...state,
            creatingNewBmp: true,
            visibleBmpForm: true,
            storedBmpForm: {
                organisation: '',
                bmpName: ''
            }
        };
    case MAKE_DEFAULTS_BMP_FORM:
        const defaultsForm = {
            // ...action.bmpType,
            id: null,
            bmpName: action.bmpType.name,
            type: action.bmpType.id,
            type_data: action.bmpType,
            project: action.bmpType.project.id,
            // organisation: null,
            override_n_redratio: action.bmpType.n_redratio,
            override_p_redratio: action.bmpType.p_redratio,
            override_s_redratio: action.bmpType.s_redratio,
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
            organisation: action.bmp.organisation,
            organisation_id: action.bmp.organisation.id,
            override_n_redratio: action.bmp.override_n_redratio,
            override_p_redratio: action.bmp.override_p_redratio,
            override_s_redratio: action.bmp.override_s_redratio,
            override_cost_base: action.bmp.override_cost_base,
            override_cost_rate_per_watershed_area: action.bmp.override_cost_rate_per_watershed_area,
            override_cost_rate_per_footprint_area: action.bmp.override_cost_rate_per_footprint_area,
            notes: action.bmp.notes,
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
        if (action?.kv?.type_data?.id) {
            return {
                ...state,
                BmpFormBmpTypeId: action.kv.type_data.id
            };
        }
        if (action?.kv?.organisation?.id) {
            return {
                ...state,
                storedBmpForm: {
                    ...state.storedBmpForm,
                    ...action.kv,
                    organisation_id: action?.kv?.organisation?.id
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
        console.log('deleted', action);
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
    default:
        return state;
    }
};

import {
    SHOW_BMP_FORM,
    HIDE_BMP_FORM,
    SHOW_LOADING_BMP,
    HIDE_LOADING_BMP,
    MAKE_BMP_FORM,
    MAKE_DEFAULTS_BMP_FORM,
    MAKE_EXISTING_BMP_FORM,
    CLEAR_BMP_FORM,
    UPDATE_BMP_FORM,
    SUBMIT_BMP_FORM_ERROR,
    SET_CHANGING_BMP_TYPE,
    SET_COMPLEX_BMP_FORM,
    SET_EXPANDED_BMP_TYPE_GROUP_NAME
} from "../actionsSwamm";

const bmpFormReducer = (state, action) => {
    switch (action.type) {
    case SHOW_BMP_FORM:
        return { visibleBmpForm: true };
    case HIDE_BMP_FORM:
        return { visibleBmpForm: false };
    case SHOW_LOADING_BMP:
        return { loadingBmp: true };
    case HIDE_LOADING_BMP:
        return { loadingBmp: false };
    case MAKE_BMP_FORM:
        return {
            creatingNewBmp: true,
            visibleBmpForm: true,
            storedBmpForm: {
                group_profile_id: action.groupProfile?.pk,
                group_profile: action.groupProfile,
                bmpName: ''
            }
        };
    case MAKE_DEFAULTS_BMP_FORM: {
        const defaultsForm = {
            bmpName: action.bmpType?.name,
            type: action.bmpType?.id,
            type_data: action.bmpType,
            project: action.bmpType?.project?.id,
            override_n_surface_red_percent: action.bmpType?.n_surface_red_percent,
            override_p_surface_red_percent: action.bmpType?.p_surface_red_percent,
            override_s_surface_red_percent: action.bmpType?.s_surface_red_percent,
            override_n_tiled_red_percent: action.bmpType?.n_tiled_red_percent,
            override_p_tiled_red_percent: action.bmpType?.p_tiled_red_percent,
            override_n_erosion_red_percent: action.bmpType?.n_erosion_red_percent,
            override_p_erosion_red_percent: action.bmpType?.p_erosion_red_percent,
            override_s_erosion_red_percent: action.bmpType?.s_erosion_red_percent,
            override_cost_base: action.bmpType?.cost_base,
            override_cost_rate_per_watershed_area: action.bmpType?.cost_rate_per_watershed_area,
            override_cost_rate_per_footprint_area: action.bmpType?.cost_rate_per_footprint_area,
            notes: ''
        };
        return {
            storedBmpForm: {
                ...state.storedBmpForm,
                ...defaultsForm
            }
        };
    }
    case MAKE_EXISTING_BMP_FORM: {
        const outletFid = state?.storedBmpForm?.outlet_fid ? state.storedBmpForm?.outlet_fid : action.bmp?.outlet_fid;
        const footprintFid = state?.storedBmpForm?.footprint_fid ? state.storedBmpForm?.footprint_fid : action.bmp?.footprint_fid;
        const watershedFid = state?.storedBmpForm?.watershed_fid ? state.storedBmpForm?.watershed_fid : action.bmp?.watershed_fid;
        const existingForm = {
            ...action.bmp,
            id: action.bmp?.id,
            bmpName: action.bmp?.type_data?.name,
            type: action.bmp?.type_data?.id,
            type_data: action.bmp?.type_data,
            project: action.bmp?.project,
            group_profile: action.bmp?.group_profile,
            group_profile_id: action.bmp?.group_profile?.id,
            override_n_surface_red_percent: action.bmp?.override_n_surface_red_percent,
            override_p_surface_red_percent: action.bmp?.override_p_surface_red_percent,
            override_s_surface_red_percent: action.bmp?.override_s_surface_red_percent,
            override_n_tiled_red_percent: action.bmp?.override_n_tiled_red_percent,
            override_p_tiled_red_percent: action.bmp?.override_p_tiled_red_percent,
            override_n_erosion_red_percent: action.bmp?.override_n_erosion_red_percent,
            override_p_erosion_red_percent: action.bmp?.override_p_erosion_red_percent,
            override_s_erosion_red_percent: action.bmp?.override_s_erosion_red_percent,
            override_cost_base: action.bmp?.override_cost_base,
            override_cost_rate_per_watershed_area: action.bmp?.override_cost_rate_per_watershed_area,
            override_cost_rate_per_footprint_area: action.bmp?.override_cost_rate_per_footprint_area,
            notes: action.bmp?.notes,
            owner_identifier: action.bmp?.owner_identifier,
            field_identifier: action.bmp?.field_identifier,
            outlet_fid: outletFid,
            footprint_fid: footprintFid,
            watershed_fid: watershedFid
        };
        return { storedBmpForm: existingForm, updatingBmp: null };
    }
    case CLEAR_BMP_FORM:
        return {
            creatingNewBmp: false,
            storedBmpForm: null,
            BmpFormBmpTypeId: null,
            visibleBmpForm: false,
            updatingBmp: null
        };
    case UPDATE_BMP_FORM:
        if (action?.kv?.type_data?.id) {
            return { BmpFormBmpTypeId: action.kv.type_data.id };
        }
        if (action?.kv?.group_profile) {
            return {
                storedBmpForm: {
                    ...state.storedBmpForm,
                    ...action.kv,
                    group_profile: action?.kv?.group_profile,
                    group_profile_id: action?.kv?.group_profile?.pk
                }
            };
        }
        return {
            storedBmpForm: {
                ...state.storedBmpForm,
                ...action.kv
            }
        };
    case SUBMIT_BMP_FORM_ERROR:
        return { showSubmitBmpFormError: true };
    case SET_CHANGING_BMP_TYPE:
        return { changingBmpType: action.changingBmpType };
    case SET_COMPLEX_BMP_FORM:
        return { complexBmpForm: action.complexBmpForm };
    case SET_EXPANDED_BMP_TYPE_GROUP_NAME:
        return { expandedBmpTypeGroupName: action.expandedBmpTypeGroupName };
    default:
        return {};
    }
};

export default bmpFormReducer;

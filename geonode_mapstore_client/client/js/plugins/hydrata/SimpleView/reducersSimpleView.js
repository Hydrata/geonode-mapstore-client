import {
    SET_VISIBLE_LEGEND_PANEL,
    SET_VISIBLE_INTRODUCTION,
    SET_OPEN_MENU_GROUP_ID,
    SV_SELECT_LAYER,
    SET_VISIBLE_UPLOADER_PANEL,
    UPDATE_UPLOAD_STATUS,
    SET_SV_CONFIG,
    SET_VISIBLE_SV_ATTRIBUTE_FORM,
    SET_VISIBLE_SV_ATTRIBUTE_RESULT,
    SET_SV_ATTRIBUTE_RESULT,
    CREATE_SV_ATTRIBUTE_FORM,
    UPDATE_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SET_PROCESSING_SV_ATTRIBUTE_FORM
} from "@js/plugins/hydrata/SimpleView/actionsSimpleView";

export default ( state = {}, action) => {
    switch (action.type) {
    case SET_PROCESSING_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            processingSimpleViewAttributeForm: action.processing
        };
    case SET_SV_CONFIG:
        return {
            ...state,
            config: action.config
        };
    case SET_OPEN_MENU_GROUP_ID:
        if (state.openMenuGroupId === action.openMenuGroupId) {
            return {
                ...state,
                openMenuGroupId: null
            };
        }
        return {
            ...state,
            openMenuGroupId: action.openMenuGroupId
        };
    case SET_VISIBLE_LEGEND_PANEL:
        return {
            ...state,
            visibleLegendPanel: action.visible
        };
    case SET_VISIBLE_INTRODUCTION:
        return {
            ...state,
            visibleIntroduction: action.visible
        };
    case SET_VISIBLE_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            visibleSimpleViewAttributeForm: action.visible
        };
    case SET_VISIBLE_SV_ATTRIBUTE_RESULT:
        return {
            ...state,
            visibleSimpleViewAttributeResult: action.visible
        };
    case SET_SV_ATTRIBUTE_RESULT:
        return {
            ...state,
            simpleViewAttributeResult: action.data
        };
    case CREATE_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            simpleViewAttributeForm: action.form,
            simpleViewImporterSessionId: action.simpleViewImporterSessionId,
            submitUrl: action.submitUrl,
            visibleSimpleViewAttributeForm: true
        };
    case UPDATE_SV_ATTRIBUTE_FORM:
        console.log('UPDATE_SV_ATTRIBUTE_FORM action.kv', action.kv);
        const override_used = action.kv.override_used;
        delete action.kv.override_used;
        const newKey = Object.keys(action.kv)[0];
        const newValue = action.kv[newKey];
        console.log('UPDATE_SV_ATTRIBUTE_FORM newKey', newKey);
        console.log('UPDATE_SV_ATTRIBUTE_FORM newValue', newValue);
        const existingAttributeValue = {...state.simpleViewAttributeForm[newKey]};
        console.log('UPDATE_SV_ATTRIBUTE_FORM existingAttributeValue', existingAttributeValue);
        const updatedFormValue = {
            ...existingAttributeValue,
            value: newValue,
            override_used: override_used
        };
        console.log('UPDATE_SV_ATTRIBUTE_FORM updatedFormValue', updatedFormValue);
        const updatedSimpleViewAttributeForm = {
            ...state.simpleViewAttributeForm,
            [newKey]: updatedFormValue
        };
        console.log('UPDATE_SV_ATTRIBUTE_FORM updatedSimpleViewAttributeForm', updatedSimpleViewAttributeForm);
        return {
            ...state,
            simpleViewAttributeForm: updatedSimpleViewAttributeForm
        };
    case SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS:
        return {
            ...state,
            simpleViewImporterSessionId: action?.data?.importer_session_id
        };
    case SET_VISIBLE_UPLOADER_PANEL:
        return {
            ...state,
            visibleUploaderPanel: action.visible,
            importerConfigKey: action.importerConfigKey,
            importerTargetObjectId: action.importerTargetObjectId
        };
    case UPDATE_UPLOAD_STATUS:
        return {
            ...state,
            uploadStatus: action.status
        };
    case SV_SELECT_LAYER:
        return {
            ...state,
            selectedLayer: action.layer
        };
    default:
        return state;
    }
};

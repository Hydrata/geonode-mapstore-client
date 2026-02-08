const SET_OPEN_MENU_GROUP_ID = 'SET_OPEN_MENU_GROUP_ID';
const SET_VISIBLE_LEGEND_PANEL = 'SET_VISIBLE_LEGEND_PANEL';
const SET_VISIBLE_INTRODUCTION = 'SET_VISIBLE_INTRODUCTION';
const SET_VISIBLE_UPLOADER_PANEL = 'SET_VISIBLE_UPLOADER_PANEL';
const SET_VISIBLE_SV_ATTRIBUTE_FORM = 'SET_VISIBLE_SV_ATTRIBUTE_FORM';
const UPDATE_UPLOAD_STATUS = 'UPDATE_UPLOAD_STATUS';
const SV_SELECT_LAYER = 'SV_SELECT_LAYER';
const SV_DOWNLOAD_LAYER = 'SV_DOWNLOAD_LAYER';
const UPDATE_DATASET_TITLE = 'UPDATE_DATASET_TITLE';
const UPDATE_DATASET_TITLE_SUCCESS = 'UPDATE_DATASET_TITLE_SUCCESS';
const SET_SV_CONFIG = 'SET_SV_CONFIG';
const UPDATE_SV_ATTRIBUTE_FORM = 'UPDATE_SV_ATTRIBUTE_FORM';
const CREATE_SV_ATTRIBUTE_FORM = 'CREATE_SV_ATTRIBUTE_FORM';
const SUBMIT_SV_ATTRIBUTE_FORM = 'SUBMIT_SV_ATTRIBUTE_FORM';
const SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS = 'SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS';
const SET_VISIBLE_SV_ATTRIBUTE_RESULT = 'SET_VISIBLE_SV_ATTRIBUTE_RESULT';
const SET_SV_ATTRIBUTE_RESULT = 'SET_SV_ATTRIBUTE_RESULT';
const SET_PROCESSING_SV_ATTRIBUTE_FORM = 'SET_PROCESSING_SV_ATTRIBUTE_FORM';


function setProcessingSimpleViewAttributeForm(processing) {
    return {
        type: SET_PROCESSING_SV_ATTRIBUTE_FORM,
        processing
    };
}

function setOpenMenuGroupId(openMenuGroupId) {
    return {
        type: SET_OPEN_MENU_GROUP_ID,
        openMenuGroupId
    };
}

function setVisibleLegendPanel(visible) {
    return {
        type: SET_VISIBLE_LEGEND_PANEL,
        visible
    };
}

function setVisibleSimpleViewAttributeForm(visible) {
    return {
        type: SET_VISIBLE_SV_ATTRIBUTE_FORM,
        visible
    };
}

function setVisibleSimpleViewAttributeResult(visible) {
    return {
        type: SET_VISIBLE_SV_ATTRIBUTE_RESULT,
        visible
    };
}

function setSimpleViewAttributeResult(data) {
    return {
        type: SET_SV_ATTRIBUTE_RESULT,
        data
    };
}

function createSimpleViewAttributeForm(data) {
    return {
        type: CREATE_SV_ATTRIBUTE_FORM,
        form: data?.form,
        simpleViewImporterSessionId: data?.importer_session_id,
        submitUrl: data?.submitUrl
    };
}

function setVisibleIntroduction(visible) {
    return {
        type: SET_VISIBLE_INTRODUCTION,
        visible
    };
}

function setVisibleUploaderPanel(visible, importerConfigKey, importerTargetObjectId) {
    return {
        type: SET_VISIBLE_UPLOADER_PANEL,
        visible,
        importerConfigKey,
        importerTargetObjectId
    };
}

const updateSimpleViewAttributeForm = (kv) => {
    return {
        type: UPDATE_SV_ATTRIBUTE_FORM,
        kv: kv
    };
};

const submitSimpleViewAttributeForm = (form, projectId, simpleViewImporterSessionId) => {
    console.log('actions submitSimpleViewAttributeForm: ', form, projectId, simpleViewImporterSessionId);
    return {
        type: SUBMIT_SV_ATTRIBUTE_FORM,
        form,
        projectId,
        simpleViewImporterSessionId
    };
};

const submitSimpleViewAttributeFormSuccess = (data) => {
    return {
        type: SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
        data: data
    };
};

function updateUploadStatus(status) {
    return {
        type: UPDATE_UPLOAD_STATUS,
        status
    };
}

function svSelectLayer(layer) {
    return {
        type: SV_SELECT_LAYER,
        layer
    };
}

function svDownloadLayer(layer) {
    return {
        type: SV_DOWNLOAD_LAYER,
        layer
    };
}

function updateDatasetTitle(datasetName, newTitle) {
    return {
        type: UPDATE_DATASET_TITLE,
        datasetName,
        newTitle
    };
}

function updateDatasetTitleSuccess() {
    return {
        type: UPDATE_DATASET_TITLE_SUCCESS
    };
}

function setSvConfig(config) {
    return {
        type: SET_SV_CONFIG,
        config
    };
}

module.exports = {
    SET_OPEN_MENU_GROUP_ID, setOpenMenuGroupId,
    SET_VISIBLE_LEGEND_PANEL, setVisibleLegendPanel,
    SET_VISIBLE_INTRODUCTION, setVisibleIntroduction,
    SET_VISIBLE_UPLOADER_PANEL, setVisibleUploaderPanel,
    SET_VISIBLE_SV_ATTRIBUTE_FORM, setVisibleSimpleViewAttributeForm,
    UPDATE_UPLOAD_STATUS, updateUploadStatus,
    UPDATE_DATASET_TITLE, updateDatasetTitle,
    UPDATE_DATASET_TITLE_SUCCESS, updateDatasetTitleSuccess,
    SV_SELECT_LAYER, svSelectLayer,
    SV_DOWNLOAD_LAYER, svDownloadLayer,
    SET_SV_CONFIG, setSvConfig,
    UPDATE_SV_ATTRIBUTE_FORM, updateSimpleViewAttributeForm,
    CREATE_SV_ATTRIBUTE_FORM, createSimpleViewAttributeForm,
    SUBMIT_SV_ATTRIBUTE_FORM, submitSimpleViewAttributeForm,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS, submitSimpleViewAttributeFormSuccess,
    SET_PROCESSING_SV_ATTRIBUTE_FORM, setProcessingSimpleViewAttributeForm,
    SET_VISIBLE_SV_ATTRIBUTE_RESULT, setVisibleSimpleViewAttributeResult,
    SET_SV_ATTRIBUTE_RESULT, setSimpleViewAttributeResult
};

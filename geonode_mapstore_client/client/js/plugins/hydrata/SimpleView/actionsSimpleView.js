const SET_OPEN_MENU_GROUP_ID = 'SET_OPEN_MENU_GROUP_ID';
const SET_VISIBLE_LEGEND_PANEL = 'SET_VISIBLE_LEGEND_PANEL';
const SET_VISIBLE_INTRODUCTION = 'SET_VISIBLE_INTRODUCTION';
// Epic 2765 W3 — the project-introduction payload and its acceptance.
// SET_VISIBLE_INTRODUCTION above stays the pure RENDER flag (the toolbar's
// "About this project" button reopens the modal through it); these three carry
// the content and the accept state, which are a different concern.
const INTRODUCTION_LOADED = 'INTRODUCTION_LOADED';
const ACCEPT_INTRODUCTION = 'ACCEPT_INTRODUCTION';
const INTRODUCTION_ACCEPTED = 'INTRODUCTION_ACCEPTED';
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

/**
 * The introduction payload for `projectId` has arrived.
 *
 * @param {number} projectId       the ANUGA project the payload describes. Kept
 *   beside the data so a role/paywall reading can be checked against THIS
 *   project rather than against whatever the ANUGA panel loaded last — the
 *   TASK-2427 staleness trap; see introductionGate.js.
 * @param {object} data            the GET body.
 * @param {string|null} acceptedVersion  the content_version this browser has
 *   already accepted ANONYMOUSLY (localStorage), or null. Read in the epic so
 *   the reducer stays pure; irrelevant when authenticated, where the server's
 *   `accepted_current_version` is the answer.
 */
function introductionLoaded(projectId, data, acceptedVersion = null) {
    return {
        type: INTRODUCTION_LOADED,
        projectId,
        data,
        acceptedVersion
    };
}

/** The viewer pressed Accept. Intent only — the epic decides how it persists. */
function acceptIntroduction() {
    return {
        type: ACCEPT_INTRODUCTION
    };
}

/**
 * The acceptance is recorded (server row when authenticated, localStorage when
 * anonymous). Carries the VERSION rather than a boolean so a later content edit
 * re-prompts: the gate compares versions, it never asks "ever accepted".
 */
function introductionAccepted(projectId, contentVersion) {
    return {
        type: INTRODUCTION_ACCEPTED,
        projectId,
        contentVersion
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
    INTRODUCTION_LOADED, introductionLoaded,
    ACCEPT_INTRODUCTION, acceptIntroduction,
    INTRODUCTION_ACCEPTED, introductionAccepted,
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

const SET_OPEN_MENU_GROUP_ID = 'SET_OPEN_MENU_GROUP_ID';
const SET_VISIBLE_LEGEND_PANEL = 'SET_VISIBLE_LEGEND_PANEL';
const SET_VISIBLE_INTRODUCTION = 'SET_VISIBLE_INTRODUCTION';
const SET_VISIBLE_UPLOADER_PANEL = 'SET_VISIBLE_UPLOADER_PANEL';
const UPDATE_UPLOAD_STATUS = 'UPDATE_UPLOAD_STATUS';
const SV_SELECT_LAYER = 'SV_SELECT_LAYER';
const SV_DOWNLOAD_LAYER = 'SV_DOWNLOAD_LAYER';
const UPDATE_DATASET_TITLE = 'UPDATE_DATASET_TITLE';
const UPDATE_DATASET_TITLE_SUCCESS = 'UPDATE_DATASET_TITLE_SUCCESS';
const SET_SV_CONFIG = 'SET_SV_CONFIG';

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

function setVisibleIntroduction(visible) {
    return {
        type: SET_VISIBLE_INTRODUCTION,
        visible
    };
}

function setVisibleUploaderPanel(visible) {
    return {
        type: SET_VISIBLE_UPLOADER_PANEL,
        visible
    };
}

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
    UPDATE_UPLOAD_STATUS, updateUploadStatus,
    UPDATE_DATASET_TITLE, updateDatasetTitle,
    UPDATE_DATASET_TITLE_SUCCESS, updateDatasetTitleSuccess,
    SV_SELECT_LAYER, svSelectLayer,
    SV_DOWNLOAD_LAYER, svDownloadLayer,
    SET_SV_CONFIG, setSvConfig
};

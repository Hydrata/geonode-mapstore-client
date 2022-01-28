const SET_OPEN_MENU_GROUP_ID = 'SET_OPEN_MENU_GROUP_ID';
const SET_VISIBLE_LEGEND_PANEL = 'SET_VISIBLE_LEGEND_PANEL';
const SET_VISIBLE_UPLOADER_PANEL = 'SET_VISIBLE_UPLOADER_PANEL';
const SV_SELECT_LAYER = 'SV_SELECT_LAYER';

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

function setVisibleUploaderPanel(visible) {
    return {
        type: SET_VISIBLE_UPLOADER_PANEL,
        visible
    };
}

function svSelectLayer(layer) {
    return {
        type: SV_SELECT_LAYER,
        layer
    };
}

module.exports = {
    SET_OPEN_MENU_GROUP_ID, setOpenMenuGroupId,
    SET_VISIBLE_LEGEND_PANEL, setVisibleLegendPanel,
    SET_VISIBLE_UPLOADER_PANEL, setVisibleUploaderPanel,
    SV_SELECT_LAYER, svSelectLayer
};

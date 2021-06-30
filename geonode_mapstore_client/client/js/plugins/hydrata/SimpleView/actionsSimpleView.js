const SET_OPEN_MENU_GROUP_ID = 'SET_OPEN_MENU_GROUP_ID';
const SET_VISIBLE_LEGEND_PANEL = 'SET_VISIBLE_LEGEND_PANEL';

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

module.exports = {
    SET_OPEN_MENU_GROUP_ID, setOpenMenuGroupId,
    SET_VISIBLE_LEGEND_PANEL, setVisibleLegendPanel
};

const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_NETWORK_MENU = 'SET_NETWORK_MENU';
const SET_REVIEW_PANEL = 'SET_REVIEW_PANEL';
const SET_PUBLICATION_PANEL = 'SET_PUBLICATION_PANEL';
const SHOW_ANUGA_SCENARIO_LOG = 'SHOW_ANUGA_SCENARIO_LOG';
const SHOW_ANUGA_RUN_MENU = 'SHOW_ANUGA_RUN_MENU';
const SHOW_MANAGE_ACCOUNT = 'SHOW_MANAGE_ACCOUNT';
const SET_CREATING_ANUGA_LAYER = 'SET_CREATING_ANUGA_LAYER';
const FIX_ANUGA_GROUPS = 'FIX_ANUGA_GROUPS';
const SET_MEMBERSHIP_PANEL = 'SET_MEMBERSHIP_PANEL';

function initAnuga() {
    return { type: INIT_ANUGA };
}

function fixAnugaGroups() {
    return { type: FIX_ANUGA_GROUPS };
}

function setAnugaInputMenu(visible) {
    return { type: SET_ANUGA_INPUT_MENU, visible };
}

function setAnugaScenarioMenu(visible) {
    return { type: SET_ANUGA_SCENARIO_MENU, visible };
}

function setAnugaResultMenu(visible) {
    return { type: SET_ANUGA_RESULT_MENU, visible };
}

function setNetworkMenu(visible) {
    return { type: SET_NETWORK_MENU, visible };
}

function setReviewPanel(visible) {
    return { type: SET_REVIEW_PANEL, visible };
}

function setPublicationPanel(visible) {
    return { type: SET_PUBLICATION_PANEL, visible };
}

function showAnugaScenarioLog(scenarioId) {
    return { type: SHOW_ANUGA_SCENARIO_LOG, scenarioId };
}

function showAnugaRunMenu(visible) {
    return { type: SHOW_ANUGA_RUN_MENU, visible };
}

function setCreatingAnugaLayer(isCreatingAnugaLayer) {
    return { type: SET_CREATING_ANUGA_LAYER, isCreatingAnugaLayer };
}

const showManageAccount = (visible) => {
    return { type: SHOW_MANAGE_ACCOUNT, visible };
};

function setMembershipPanel(visible) {
    return { type: SET_MEMBERSHIP_PANEL, visible };
}

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_NETWORK_MENU, setNetworkMenu,
    SET_REVIEW_PANEL, setReviewPanel,
    SET_PUBLICATION_PANEL, setPublicationPanel,
    SHOW_ANUGA_SCENARIO_LOG, showAnugaScenarioLog,
    SHOW_ANUGA_RUN_MENU, showAnugaRunMenu,
    SET_CREATING_ANUGA_LAYER, setCreatingAnugaLayer,
    SHOW_MANAGE_ACCOUNT, showManageAccount,
    FIX_ANUGA_GROUPS, fixAnugaGroups,
    SET_MEMBERSHIP_PANEL, setMembershipPanel
};

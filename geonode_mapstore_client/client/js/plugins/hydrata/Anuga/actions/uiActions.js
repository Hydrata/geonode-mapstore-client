const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_NETWORK_MENU = 'SET_NETWORK_MENU';
const SET_PUBLICATION_PANEL = 'SET_PUBLICATION_PANEL';
const SHOW_ANUGA_SCENARIO_LOG = 'SHOW_ANUGA_SCENARIO_LOG';
const SHOW_ANUGA_RUN_MENU = 'SHOW_ANUGA_RUN_MENU';
const SHOW_MANAGE_ACCOUNT = 'SHOW_MANAGE_ACCOUNT';
const SET_CREATING_ANUGA_LAYER = 'SET_CREATING_ANUGA_LAYER';
const FIX_ANUGA_GROUPS = 'FIX_ANUGA_GROUPS';
const SET_MEMBERSHIP_PANEL = 'SET_MEMBERSHIP_PANEL';
// TASK-930 (W2-FE) — Global GLO-30 bbox picker UI state.
const SET_VISIBLE_TERRAIN_BBOX_PANEL = 'SET_VISIBLE_TERRAIN_BBOX_PANEL';
const SET_TERRAIN_BBOX_DRAWING = 'SET_TERRAIN_BBOX_DRAWING';
const SET_TERRAIN_BBOX = 'SET_TERRAIN_BBOX';
const SET_TERRAIN_BBOX_ERROR = 'SET_TERRAIN_BBOX_ERROR';

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

// TASK-930 (W2-FE) — Show/hide the Global GLO-30 bbox picker panel.
function setVisibleTerrainBboxPanel(visible) {
    return { type: SET_VISIBLE_TERRAIN_BBOX_PANEL, visible };
}

// TASK-930 — Toggle the draw-on-map state so the panel can flag "we're listening
// for the next bbox-end event". The terrainBboxEpic flips this back to false
// when END_DRAWING fires with owner='terrain-bbox'.
function setTerrainBboxDrawing(active) {
    return { type: SET_TERRAIN_BBOX_DRAWING, active };
}

// TASK-930 — Stash the drawn extent [minLon, minLat, maxLon, maxLat]. null
// when no bbox is yet drawn (initial state and after Cancel/successful Create).
function setTerrainBbox(bbox) {
    return { type: SET_TERRAIN_BBOX, bbox };
}

// TASK-930 — Inline error message for the panel (e.g. "bbox > 5x5 degrees").
// Per project preference, surface validation INLINE rather than as a toast.
function setTerrainBboxError(error) {
    return { type: SET_TERRAIN_BBOX_ERROR, error };
}

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_NETWORK_MENU, setNetworkMenu,
    SET_PUBLICATION_PANEL, setPublicationPanel,
    SHOW_ANUGA_SCENARIO_LOG, showAnugaScenarioLog,
    SHOW_ANUGA_RUN_MENU, showAnugaRunMenu,
    SET_CREATING_ANUGA_LAYER, setCreatingAnugaLayer,
    SHOW_MANAGE_ACCOUNT, showManageAccount,
    FIX_ANUGA_GROUPS, fixAnugaGroups,
    SET_MEMBERSHIP_PANEL, setMembershipPanel,
    // TASK-930 (W2-FE) — Global GLO-30 bbox picker UI state.
    SET_VISIBLE_TERRAIN_BBOX_PANEL, setVisibleTerrainBboxPanel,
    SET_TERRAIN_BBOX_DRAWING, setTerrainBboxDrawing,
    SET_TERRAIN_BBOX, setTerrainBbox,
    SET_TERRAIN_BBOX_ERROR, setTerrainBboxError
};

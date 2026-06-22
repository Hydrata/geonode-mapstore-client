const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_NETWORK_MENU = 'SET_NETWORK_MENU';
const SET_PUBLICATION_PANEL = 'SET_PUBLICATION_PANEL';
const SET_CREATING_ANUGA_LAYER = 'SET_CREATING_ANUGA_LAYER';
const FIX_ANUGA_GROUPS = 'FIX_ANUGA_GROUPS';
const SET_MEMBERSHIP_PANEL = 'SET_MEMBERSHIP_PANEL';
// TASK-930 (W2-FE) — Global GLO-30 bbox picker UI state.
const SET_VISIBLE_TERRAIN_BBOX_PANEL = 'SET_VISIBLE_TERRAIN_BBOX_PANEL';
const SET_TERRAIN_BBOX_DRAWING = 'SET_TERRAIN_BBOX_DRAWING';
const SET_TERRAIN_BBOX = 'SET_TERRAIN_BBOX';
const SET_TERRAIN_BBOX_ERROR = 'SET_TERRAIN_BBOX_ERROR';
// Confirmation popup shown after the bbox is drawn (geodesic-area review +
// cells/time estimate) before the create POST fires.
const SET_TERRAIN_BBOX_CONFIRM = 'SET_TERRAIN_BBOX_CONFIRM';
// TASK-1850 (epic 1814 W2) — Per-DEM-layer dynamic-ramp health flag. The
// demRescaleEpic sets degraded=true when the live bbox-stats fetch fails (or
// returns a malformed env_params) and it falls back to the stored full-raster
// range; degraded=false once a live windowed fetch succeeds again. The legend
// (DemRampLegend) reads this so a degraded ramp is VISIBLE, not silent.
const SET_DEM_RAMP_DEGRADED = 'SET_DEM_RAMP_DEGRADED';
// TASK-1855/1856 (epic 1814 W3) — Cursor elevation readout for the 2D map
// footer. The cursorElevationEpic dispatches this on each debounced MOUSE_MOVE
// to update state.anuga.resources.cursorElevation.  null = no DEM / off-DEM /
// nodata / footer-off; float = valid DEM elevation in metres.
const SET_TERRAIN_CURSOR_ELEVATION = 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION';
// TASK-1861 (epic 1814 W4.4) — Depth/result line-profile tool UI state.
// The panel lets the user draw a profile line; profileEpic samples the active
// terrain DEM + selected scenario's result rasters along it (W4.3 endpoint) and
// stores the samples here for the Plotly multi-trace chart. State all lives on
// the existing `ui` slice (mirrors the terrainBbox cluster).
const SET_PROFILE_PANEL_VISIBLE = 'ANUGA:SET_PROFILE_PANEL_VISIBLE';
const START_PROFILE_DRAW = 'ANUGA:START_PROFILE_DRAW';
const SET_PROFILE_DRAWING = 'ANUGA:SET_PROFILE_DRAWING';
const SET_PROFILE_LOADING = 'ANUGA:SET_PROFILE_LOADING';
const SET_PROFILE_SAMPLES = 'ANUGA:SET_PROFILE_SAMPLES';
const SET_PROFILE_ERROR = 'ANUGA:SET_PROFILE_ERROR';
const CLEAR_PROFILE = 'ANUGA:CLEAR_PROFILE';
// TASK-1862 (epic 1814 W4.5) — cross-section / transect MODE of the profile
// tool. 'profile' = raw value-vs-distance traces (W4.4); 'crosssection' = the
// combined terrain (filled area) + water-surface (terrain+depth=stage) chart.
// Same draw interaction / endpoint / samples — only the chart rendering differs.
const SET_PROFILE_MODE = 'ANUGA:SET_PROFILE_MODE';

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

function setCreatingAnugaLayer(isCreatingAnugaLayer) {
    return { type: SET_CREATING_ANUGA_LAYER, isCreatingAnugaLayer };
}

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

// Show/hide the post-draw confirmation popup. `areaKm2` is the geodesic area
// of the drawn extent (turf), stashed on the ui slice so the popup can render
// the cells/time estimate without recomputing. Pass visible=false to dismiss.
function setTerrainBboxConfirm(visible, areaKm2) {
    return { type: SET_TERRAIN_BBOX_CONFIRM, visible, areaKm2 };
}

// TASK-1850 — flag/clear the dynamic-ramp degraded (full-range fallback) state
// for a given map layer id. `degraded=true` means the live windowed fetch
// failed and the ramp is showing the stored whole-raster range.
function setDemRampDegraded(layerId, degraded) {
    return { type: SET_DEM_RAMP_DEGRADED, layerId, degraded: !!degraded };
}

// TASK-1855/1856 (W3.2) — set or clear the cursor elevation float in the
// resources slice.  Pass null to hide the readout (off-DEM / no DEM loaded /
// mouseOut / footer-off).
function setTerrainCursorElevation(elevation) {
    return { type: SET_TERRAIN_CURSOR_ELEVATION, elevation };
}

// ── TASK-1861 (W4.4) — line-profile tool action creators ──────────────────
// Open/close the profile panel. Closing resets all transient profile state.
function setProfilePanelVisible(visible) {
    return { type: SET_PROFILE_PANEL_VISIBLE, visible };
}
// User clicked "Draw profile line" — profileEpic starts the LineString draw.
function startProfileDraw() {
    return { type: START_PROFILE_DRAW };
}
// Reflects whether the map draw interaction is live (drives the button label).
function setProfileDrawing(active) {
    return { type: SET_PROFILE_DRAWING, active };
}
// In-flight flag while the W4.3 endpoint request is pending.
function setProfileLoading(loading) {
    return { type: SET_PROFILE_LOADING, loading };
}
// Store the sampled series. `samples` = [{distance_m, dem|<layer>: float|null}].
// `traces` = [{key, label}] describing which raster keys are present, in order.
function setProfileSamples(samples, traces) {
    return { type: SET_PROFILE_SAMPLES, samples, traces };
}
// Surface a sampling error (i18n msgId string). null clears it.
function setProfileError(error) {
    return { type: SET_PROFILE_ERROR, error };
}
// Drop the drawn line + samples (Re-draw / panel close).
function clearProfile() {
    return { type: CLEAR_PROFILE };
}
// TASK-1862 (W4.5) — switch the profile tool between 'profile' (raw traces) and
// 'crosssection' (combined terrain + water-surface chart). Same samples; only
// the chart rendering differs, so switching mode is free (no re-sample).
function setProfileMode(mode) {
    return { type: SET_PROFILE_MODE, mode };
}

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_NETWORK_MENU, setNetworkMenu,
    SET_PUBLICATION_PANEL, setPublicationPanel,
    SET_CREATING_ANUGA_LAYER, setCreatingAnugaLayer,
    FIX_ANUGA_GROUPS, fixAnugaGroups,
    SET_MEMBERSHIP_PANEL, setMembershipPanel,
    // TASK-930 (W2-FE) — Global GLO-30 bbox picker UI state.
    SET_VISIBLE_TERRAIN_BBOX_PANEL, setVisibleTerrainBboxPanel,
    SET_TERRAIN_BBOX_DRAWING, setTerrainBboxDrawing,
    SET_TERRAIN_BBOX, setTerrainBbox,
    SET_TERRAIN_BBOX_ERROR, setTerrainBboxError,
    SET_TERRAIN_BBOX_CONFIRM, setTerrainBboxConfirm,
    // TASK-1850 (epic 1814 W2) — dynamic-ramp degraded (full-range) flag.
    SET_DEM_RAMP_DEGRADED, setDemRampDegraded,
    // TASK-1855/1856 (epic 1814 W3) — 2D cursor elevation readout.
    SET_TERRAIN_CURSOR_ELEVATION, setTerrainCursorElevation,
    // TASK-1861 (epic 1814 W4.4) — depth/result line-profile tool.
    SET_PROFILE_PANEL_VISIBLE, setProfilePanelVisible,
    START_PROFILE_DRAW, startProfileDraw,
    SET_PROFILE_DRAWING, setProfileDrawing,
    SET_PROFILE_LOADING, setProfileLoading,
    SET_PROFILE_SAMPLES, setProfileSamples,
    SET_PROFILE_ERROR, setProfileError,
    CLEAR_PROFILE, clearProfile,
    // TASK-1862 (epic 1814 W4.5) — cross-section / transect mode.
    SET_PROFILE_MODE, setProfileMode
};

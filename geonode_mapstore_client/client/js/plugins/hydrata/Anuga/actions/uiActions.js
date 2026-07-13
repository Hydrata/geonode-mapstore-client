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
// TASK-2253 (epic 2249 W2) — SET_PROFILE_MODE DELETED: Profile mode is gone,
// Cross-section is the tool's only chart now (git history keeps the action).
// TASK-2254 (epic 2249 W2) — Cross-section PICKER checked-id state. Up to 3
// terrains + 3 scenario water surfaces can be checked at once (independent
// caps). SET_* bulk-replaces the whole list (pickerSeedEpic seeding on panel
// open); TOGGLE_* is the per-row checkbox click (hard-capped — a click past
// the cap is a no-op, enforced in the reducer, not just the UI).
const SET_CHECKED_TERRAINS = 'ANUGA:SET_CHECKED_TERRAINS';
const SET_CHECKED_SCENARIOS = 'ANUGA:SET_CHECKED_SCENARIOS';
const TOGGLE_CHECKED_TERRAIN = 'ANUGA:TOGGLE_CHECKED_TERRAIN';
const TOGGLE_CHECKED_SCENARIO = 'ANUGA:TOGGLE_CHECKED_SCENARIO';
// TASK-1880 (epic 1884 W2 — THE HEADLINE) — in-app terrain-upload CRS picker.
// The upload glyph / starter CTA no longer fire the byte transfer directly; they
// OPEN this panel carrying the picked File + an auto-title, so a CRS-less DEM can
// be recovered in-app by the user assigning its SOURCE CRS (no QGIS round-trip).
// The File rides redux/lifted state so it survives open → Confirm. The panel is
// mounted at the container level (like terrainBbox) so closing the Inputs menu
// cannot unmount it mid-upload. crsOverride is forwarded to finalize as
// `crs_override` (TASK-1885 BE contract), OMITTED when the DEM already has a CRS.
const SET_TERRAIN_UPLOAD_CRS_PANEL = 'ANUGA:SET_TERRAIN_UPLOAD_CRS_PANEL';
const SET_TERRAIN_UPLOAD_CRS_ERROR = 'ANUGA:SET_TERRAIN_UPLOAD_CRS_ERROR';
// TASK-2194 (epic 2190 W2) — site compute-target config hydrated once from
// GET /api/v2/anuga/config/ (loadAnugaComputeConfigEpic on INIT_ANUGA).
// Carries the site allowlist (available_compute_targets) + marked default
// (default_compute_target) that drive the staff-only selector in
// scenarioPane's Run section. Lives on the `ui` slice (mirrors the
// terrainBbox cluster's "transient app state on ui" precedent).
const SET_ANUGA_COMPUTE_CONFIG = 'ANUGA:SET_ANUGA_COMPUTE_CONFIG';
// TASK-2194 (epic 2190 W2 review fix) — the staff compute-target CHOICE is
// SESSION state, keyed per scenario on state.anuga.ui.sessionComputeTargets
// ({ [scenarioId]: '<target>' }). It deliberately does NOT ride the scenario
// object: routing it through UPDATE_ANUGA_SCENARIO flipped unsaved:true
// (sending the next Build-and-Run down the save-only detour that never arms
// the deferred run) and any save/refresh wholesale-replace wiped it. An
// explicit pick of the SITE DEFAULT is stored (and POSTed) too — the server
// validates allowlist membership either way.
const SET_SESSION_COMPUTE_TARGET = 'ANUGA:SET_SESSION_COMPUTE_TARGET';
// TASK-2233 — reusable MovablePanel per-panel UI state. Dragged position /
// resized size are keyed by panel id on state.anuga.ui.movablePanels so they
// survive re-renders in-session ({ [panelId]: { position?, size? } }, patches
// merged). Shared by every MovablePanel consumer (DEM legend today; the
// TASK-2046 result-raster legends are the planned second consumer).
const SET_MOVABLE_PANEL_STATE = 'ANUGA:SET_MOVABLE_PANEL_STATE';
// TASK-2233 — stand-alone floating dynamic-DEM legend visibility. The panel
// auto-shows whenever a dynamic-mode terrain pair exists; visible=false
// records that the user closed it. The closed flag is ALSO cleared by
// UPDATE_TERRAIN_ROW flipping a terrain to styling_mode='dynamic' (see
// uiReducer) so re-entering dynamic mode re-shows the legend (AC2).
const SET_DEM_LEGEND_PANEL = 'ANUGA:SET_DEM_LEGEND_PANEL';

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
// TASK-2254 — bulk-replace the checked-id set (pickerSeedEpic on panel open).
// `ids` is capped to 3 defensively even though callers already cap it.
function setCheckedTerrains(ids) {
    return { type: SET_CHECKED_TERRAINS, ids };
}
function setCheckedScenarios(ids) {
    return { type: SET_CHECKED_SCENARIOS, ids };
}
// TASK-2254 — user checkbox click: unchecks an already-checked id, else adds
// it (a no-op past the 3-cap, enforced in the reducer).
function toggleCheckedTerrain(id) {
    return { type: TOGGLE_CHECKED_TERRAIN, id };
}
function toggleCheckedScenario(id) {
    return { type: TOGGLE_CHECKED_SCENARIO, id };
}

// TASK-1880 (W2) — open/close the terrain-upload CRS picker. On open carry the
// picked `file` (a File/Blob, survives in redux so the Confirm dispatch can run
// the upload) + an auto-derived `title` (file.name minus extension). Closing
// (visible=false) discards the file/title/error so re-opening is clean — that IS
// the Cancel path (no upload runs). Pass file=null/title=null to just close.
function setTerrainUploadCrsPanel(visible, file, title) {
    return { type: SET_TERRAIN_UPLOAD_CRS_PANEL, visible, file, title };
}
// TASK-1880 (W2) — surface the BE finalize 400 (TASK-1885 VALIDATION_ERROR on a
// bad/unresolvable crs_override) in the panel's ErrorStrip. null clears it.
function setTerrainUploadCrsError(error) {
    return { type: SET_TERRAIN_UPLOAD_CRS_ERROR, error };
}

// TASK-2194 — `config` is the raw GET /api/v2/anuga/config/ payload; the
// reducer extracts available_compute_targets / default_compute_target
// (shape-tolerant, empty allowlist on a bad shape -> selector hidden).
function setAnugaComputeConfig(config) {
    return { type: SET_ANUGA_COMPUTE_CONFIG, config };
}

// TASK-2194 (review fix) — record (or clear, target=null) the staff user's
// this-session compute-target choice for one scenario. `scenarioId` is the
// scenario's id (or _tempId for a not-yet-saved scenario).
function setSessionComputeTarget(scenarioId, target) {
    return { type: SET_SESSION_COMPUTE_TARGET, scenarioId, target };
}

// TASK-2233 — merge a {position?, size?} patch into one movable panel's
// persisted UI state (keyed by panelId).
function setMovablePanelState(panelId, patch) {
    return { type: SET_MOVABLE_PANEL_STATE, panelId, patch };
}

// TASK-2233 — show (true) / close (false) the floating dynamic-DEM legend.
function setDemLegendPanel(visible) {
    return { type: SET_DEM_LEGEND_PANEL, visible };
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
    // TASK-2254 (epic 2249 W2) — Cross-section picker checked-id state.
    SET_CHECKED_TERRAINS, setCheckedTerrains,
    SET_CHECKED_SCENARIOS, setCheckedScenarios,
    TOGGLE_CHECKED_TERRAIN, toggleCheckedTerrain,
    TOGGLE_CHECKED_SCENARIO, toggleCheckedScenario,
    // TASK-2194 (epic 2190 W2) — staff compute-target selector site config.
    SET_ANUGA_COMPUTE_CONFIG, setAnugaComputeConfig,
    // TASK-2194 (review fix) — per-scenario session compute-target choice.
    SET_SESSION_COMPUTE_TARGET, setSessionComputeTarget,
    // TASK-1880 (epic 1884 W2) — in-app terrain-upload CRS picker.
    SET_TERRAIN_UPLOAD_CRS_PANEL, setTerrainUploadCrsPanel,
    SET_TERRAIN_UPLOAD_CRS_ERROR, setTerrainUploadCrsError,
    // TASK-2233 — MovablePanel per-panel state + floating DEM legend visibility.
    SET_MOVABLE_PANEL_STATE, setMovablePanelState,
    SET_DEM_LEGEND_PANEL, setDemLegendPanel
};

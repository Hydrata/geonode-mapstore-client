import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_PUBLICATION_PANEL,
    SET_CREATING_ANUGA_LAYER,
    SET_MEMBERSHIP_PANEL,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker panel.
    SET_VISIBLE_TERRAIN_BBOX_PANEL,
    SET_TERRAIN_BBOX_DRAWING,
    SET_TERRAIN_BBOX,
    SET_TERRAIN_BBOX_ERROR,
    SET_TERRAIN_BBOX_CONFIRM,
    // TASK-1850 (epic 1814 W2) — dynamic-ramp degraded (full-range) flag.
    SET_DEM_RAMP_DEGRADED,
    // TASK-1861 (epic 1814 W4.4) — depth/result line-profile tool state.
    SET_PROFILE_PANEL_VISIBLE,
    SET_PROFILE_DRAWING,
    SET_PROFILE_LOADING,
    SET_PROFILE_SAMPLES,
    SET_PROFILE_ERROR,
    CLEAR_PROFILE,
    // TASK-1862 (epic 1814 W4.5) — cross-section / transect mode.
    SET_PROFILE_MODE,
    // TASK-1880 (epic 1884 W2) — in-app terrain-upload CRS picker.
    SET_TERRAIN_UPLOAD_CRS_PANEL,
    SET_TERRAIN_UPLOAD_CRS_ERROR,
    // TASK-2194 (epic 2190 W2) — staff compute-target selector site config.
    SET_ANUGA_COMPUTE_CONFIG,
    // TASK-2194 (review fix) — per-scenario session compute-target choice.
    SET_SESSION_COMPUTE_TARGET
} from "../actionsAnuga";

import {
    SET_OPEN_MENU_GROUP_ID
} from "../../SimpleView/actionsSimpleView";

const initialState = {
    showAnugaInputMenu: false,
    showAnugaScenarioMenu: false,
    showAnugaResultMenu: false,
    showNetworkMenu: false,
    showPublicationPanel: false,
    isCreatingAnugaLayer: false,
    showAddAnugaTerrainData: false,
    showMembershipPanel: false,
    // TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker panel state.
    // The 4 fields cluster (visible/drawing-active/bbox/error) live on the
    // existing `ui` slice rather than on a new reducer; matches how
    // isCreatingAnugaLayer treats a transient creation flow as UI state.
    terrainBboxPanelVisible: false,
    terrainBboxDrawingActive: false,
    terrainBbox: null,
    terrainBboxError: null,
    // Post-draw confirmation popup: visibility + the geodesic area (km2) of the
    // drawn extent so the popup can render cells/time estimates.
    terrainBboxConfirmVisible: false,
    terrainBboxAreaKm2: null,
    // TASK-1850 (epic 1814 W2) — per-layer dynamic-ramp degraded flag keyed by
    // map layer id: { [layerId]: true } when the live windowed bbox-stats fetch
    // failed and the ramp fell back to the stored whole-raster range. The legend
    // reads this so the degraded state is visible rather than silent.
    demRampDegraded: {},
    // TASK-1861 (epic 1814 W4.4) — depth/result line-profile tool. The cluster
    // lives on `ui` like the terrainBbox state. samples = the sampled series
    // ([{distance_m, dem|<layer>: float|null}]); traces = [{key,label}] in order.
    profilePanelVisible: false,
    profileDrawingActive: false,
    profileLoading: false,
    profileSamples: null,
    profileTraces: null,
    profileError: null,
    // TASK-1862 (epic 1814 W4.5) — cross-section / transect mode. The same drawn
    // line + samples render either as raw value-vs-distance traces ('profile',
    // W4.4) or the combined terrain + water-surface chart ('crosssection').
    // Defaults to 'profile' so W4.4 behaviour is unchanged.
    profileMode: 'profile',
    // TASK-1880 (epic 1884 W2 — THE HEADLINE) — in-app terrain-upload CRS picker.
    // The cluster lives on `ui` like the terrainBbox / profile state. The picked
    // File rides redux (terrainUploadCrsFile) so it survives open → Confirm; it is
    // intentionally a non-serialized object held only for the upload's lifetime
    // and is cleared on close. terrainUploadCrsError surfaces the BE finalize 400.
    terrainUploadCrsPanelVisible: false,
    terrainUploadCrsFile: null,
    terrainUploadCrsTitle: '',
    terrainUploadCrsError: null,
    // TASK-2194 (epic 2190 W2) — site compute-target config (staff selector).
    // null = not hydrated yet; the selector renders only for a staff user
    // with a NON-EMPTY hydrated allowlist, so both "loading" and "empty
    // allowlist (retired site)" hide it.
    availableComputeTargets: null,
    defaultComputeTarget: null,
    // TASK-2211 (W3.2, epic 2204, AC#4) — the divergence-interrupt threshold
    // (GET /api/v2/anuga/config/'s mesh_divergence_threshold), hydrated by
    // the SAME SET_ANUGA_COMPUTE_CONFIG action as the two fields above.
    // null = not hydrated yet OR a malformed payload — anugaScenarioMenu.js
    // falls back to scenarioHelpers.DEFAULT_MESH_DIVERGENCE_THRESHOLD (2x)
    // in that case, never blocking the Build-and-Run flow on a config load.
    meshDivergenceThreshold: null,
    // TASK-2194 (review fix) — { [scenarioId]: '<target>' }: the staff user's
    // THIS-SESSION compute-target choice per scenario. Lives here (NOT on the
    // scenario object) so choosing a target never flips scenario.unsaved and
    // the choice survives SAVE_ANUGA_SCENARIO_SUCCESS / SET_ANUGA_SCENARIO_DATA
    // wholesale-replaces of the scenarios slice. An explicit pick of the site
    // default is stored (and POSTed) like any other pick.
    sessionComputeTargets: {}
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_CREATING_ANUGA_LAYER:
        return { ...state, isCreatingAnugaLayer: action.isCreatingAnugaLayer };
    case SET_OPEN_MENU_GROUP_ID:
        if (action.openMenuGroupId) {
            return {
                ...state,
                showAnugaInputMenu: false,
                showAnugaScenarioMenu: false,
                showAnugaResultMenu: false
            };
        }
        return state;
    case SET_ANUGA_INPUT_MENU:
        return {
            ...state,
            showAnugaInputMenu: action.visible,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_SCENARIO_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: action.visible,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_RESULT_MENU:
        return {
            ...state,
            showAnugaScenarioMenu: false,
            showAnugaInputMenu: false,
            showAnugaResultMenu: action.visible,
            showNetworkMenu: false,
            showPublicationPanel: false
        };
    case SET_NETWORK_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: action.visible,
            showPublicationPanel: false
        };
    case SET_PUBLICATION_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: action.visible
        };
    case SET_MEMBERSHIP_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showPublicationPanel: false,
            showMembershipPanel: action.visible
        };
    case SET_VISIBLE_TERRAIN_BBOX_PANEL:
        // Closing the panel resets transient draw state so re-opening is clean.
        return action.visible
            ? { ...state, terrainBboxPanelVisible: true }
            : { ...state, terrainBboxPanelVisible: false, terrainBboxDrawingActive: false, terrainBbox: null, terrainBboxError: null, terrainBboxConfirmVisible: false, terrainBboxAreaKm2: null };
    case SET_TERRAIN_BBOX_DRAWING:
        return { ...state, terrainBboxDrawingActive: action.active };
    case SET_TERRAIN_BBOX:
        // Clearing the bbox (Re-select / Draw-again) also dismisses the confirm
        // popup; setting a new bbox leaves popup visibility to SET_TERRAIN_BBOX_CONFIRM.
        return action.bbox
            ? { ...state, terrainBbox: action.bbox, terrainBboxDrawingActive: false }
            : { ...state, terrainBbox: null, terrainBboxDrawingActive: false, terrainBboxConfirmVisible: false, terrainBboxAreaKm2: null };
    case SET_TERRAIN_BBOX_ERROR:
        return { ...state, terrainBboxError: action.error };
    case SET_TERRAIN_BBOX_CONFIRM:
        return action.visible
            ? { ...state, terrainBboxConfirmVisible: true, terrainBboxAreaKm2: action.areaKm2 }
            : { ...state, terrainBboxConfirmVisible: false };
    // TASK-2194 (epic 2190 W2) — hydrate the compute-target site config.
    // Shape-tolerant: a malformed payload yields an EMPTY allowlist (selector
    // hidden, dispatch omits compute_target, server default applies).
    case SET_ANUGA_COMPUTE_CONFIG: {
        const cfg = action.config || {};
        return {
            ...state,
            availableComputeTargets: Array.isArray(cfg.available_compute_targets)
                ? cfg.available_compute_targets
                : [],
            defaultComputeTarget: typeof cfg.default_compute_target === 'string'
                ? cfg.default_compute_target
                : null,
            // TASK-2211 (W3.2, epic 2204, AC#4) — shape-tolerant like the two
            // fields above: a non-finite-number payload yields null, which
            // anugaScenarioMenu.js's divergence gate treats as "use the FE
            // default" (never a crash, never a blocked Build-and-Run).
            // Number.isFinite (not the global isFinite) never coerces — it
            // already returns false for a string/array/object/NaN, so no
            // separate typeof guard is needed.
            meshDivergenceThreshold: Number.isFinite(cfg.mesh_divergence_threshold)
                ? cfg.mesh_divergence_threshold
                : null
        };
    }
    // TASK-2194 (review fix) — record/clear one scenario's session choice.
    // target=null clears the entry (defensive: today's selector only emits
    // real allowlist values, so the clear path is programmatic-only).
    case SET_SESSION_COMPUTE_TARGET: {
        const key = action.scenarioId;
        if (key === null || key === undefined || key === '') return state;
        const current = state.sessionComputeTargets || {};
        if (!action.target) {
            if (!(key in current)) return state;
            const next = { ...current };
            delete next[key];
            return { ...state, sessionComputeTargets: next };
        }
        if (current[key] === action.target) return state;
        return { ...state, sessionComputeTargets: { ...current, [key]: action.target } };
    }
    case SET_DEM_RAMP_DEGRADED: {
        // Per-layer flag; only rewrite the map when the value actually changes so
        // a steady stream of successful pans doesn't churn the reducer object.
        const current = state.demRampDegraded || {};
        if (!!current[action.layerId] === action.degraded) {
            return state;
        }
        return {
            ...state,
            demRampDegraded: { ...current, [action.layerId]: action.degraded }
        };
    }
    // ── TASK-1861 (W4.4) — line-profile tool ──────────────────────────────
    case SET_PROFILE_PANEL_VISIBLE:
        // Closing the panel resets all transient profile state so re-opening
        // is clean (mirrors SET_VISIBLE_TERRAIN_BBOX_PANEL).
        return action.visible
            ? { ...state, profilePanelVisible: true }
            : {
                ...state,
                profilePanelVisible: false,
                profileDrawingActive: false,
                profileLoading: false,
                profileSamples: null,
                profileTraces: null,
                profileError: null,
                // TASK-1862: reset the mode so re-opening starts in 'profile'.
                profileMode: 'profile'
            };
    // TASK-1862 (W4.5) — flip cross-section / transect mode (free; no re-sample).
    case SET_PROFILE_MODE:
        return { ...state, profileMode: action.mode === 'crosssection' ? 'crosssection' : 'profile' };
    case SET_PROFILE_DRAWING:
        return { ...state, profileDrawingActive: action.active };
    case SET_PROFILE_LOADING:
        return { ...state, profileLoading: action.loading };
    case SET_PROFILE_SAMPLES:
        // A successful sample clears any prior error + the drawing flag.
        return {
            ...state,
            profileSamples: action.samples || null,
            profileTraces: action.traces || null,
            profileLoading: false,
            profileDrawingActive: false,
            profileError: null
        };
    case SET_PROFILE_ERROR:
        return { ...state, profileError: action.error || null, profileLoading: false, profileDrawingActive: false };
    case CLEAR_PROFILE:
        return { ...state, profileSamples: null, profileTraces: null, profileError: null };
    // ── TASK-1880 (W2) — in-app terrain-upload CRS picker ──────────────────
    case SET_TERRAIN_UPLOAD_CRS_PANEL:
        // Opening carries the picked File + auto-title; closing (visible=false)
        // discards them so re-opening is clean (mirrors SET_VISIBLE_TERRAIN_BBOX_PANEL).
        // Closing IS the Cancel path — the File is dropped without uploading.
        return action.visible
            ? {
                ...state,
                terrainUploadCrsPanelVisible: true,
                terrainUploadCrsFile: action.file || null,
                terrainUploadCrsTitle: action.title || '',
                terrainUploadCrsError: null
            }
            : {
                ...state,
                terrainUploadCrsPanelVisible: false,
                terrainUploadCrsFile: null,
                terrainUploadCrsTitle: '',
                terrainUploadCrsError: null
            };
    case SET_TERRAIN_UPLOAD_CRS_ERROR:
        return { ...state, terrainUploadCrsError: action.error || null };
    default:
        return state;
    }
};

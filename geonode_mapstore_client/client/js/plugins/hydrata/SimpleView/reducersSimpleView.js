import {
    SET_VISIBLE_LEGEND_PANEL,
    SET_VISIBLE_INTRODUCTION,
    INTRODUCTION_LOADED,
    INTRODUCTION_ACCEPTED,
    SAVE_INTRODUCTION,
    INTRODUCTION_SAVED,
    INTRODUCTION_SAVE_FAILED,
    SET_OPEN_MENU_GROUP_ID,
    SV_SELECT_LAYER,
    SET_VISIBLE_UPLOADER_PANEL,
    UPDATE_UPLOAD_STATUS,
    SET_SV_CONFIG,
    SET_VISIBLE_SV_ATTRIBUTE_FORM,
    SET_VISIBLE_SV_ATTRIBUTE_RESULT,
    SET_SV_ATTRIBUTE_RESULT,
    CREATE_SV_ATTRIBUTE_FORM,
    UPDATE_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SET_PROCESSING_SV_ATTRIBUTE_FORM
} from "@js/plugins/hydrata/SimpleView/actionsSimpleView";
// TASK-2790 — the single writer of `gnresource.id` (js/reducers/gnresource.js
// has the only case for it, js/actions/gnresource.js the only creator), which
// makes it the exact "the map changed" signal. NOT @@router/LOCATION_CHANGE,
// which also fires for every non-map route in the SPA. Same action, same
// reasoning and the same guard shape as Anuga/reducers/projectsReducer.js:
// clearing there is what makes `!isAnugaProject` genuinely mean "no project for
// the map on screen" (TASK-2548).
import { SET_RESOURCE_ID } from "@js/actions/gnresource";

// TASK-1005 W1 — `selectedCategory: null` is intentionally dead state.
//
// The Miller-columns rail+pane (simpleViewMenuRows.js) keeps the rail's
// selected subheading in *local component state* (`selectedSubHeading`)
// so the load-bearing `openMenuGroupId` slice stays untouched. The reducer
// field exists ONLY to keep redux-persist hydration deterministic (R12)
// and to prevent any future selector from accidentally reading `undefined`.
//
// epicsSwamm.js:245 gates `ensureBmpGeometriesGroupEpic` on
// `state.simpleView.openMenuGroupId !== viewBmpGroup.id`. Adding
// `selectedCategory` here does NOT affect that read (R05).

// TASK-2790 — `gnresource.id` is a STRING on the SPA route path (measured
// live: "1418"), while other setResourceId callers pass a numeric pk. A
// type-only difference must never read as "different map": that would clear a
// live payload on the map it belongs to. Null/undefined on either side is NOT
// a match, so an unknown map id fails closed into the reset branch.
//
// Deliberately a local copy of projectsReducer's `_isSameMap` rather than an
// import: exporting it from that module would make one plugin's reducer depend
// on another's internals for a four-line comparison, and the two slices'
// reset rules are allowed to diverge. If a third copy ever appears, promote it.
const _isSameMapId = (a, b) => {
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (a == null || b == null) return false;
    return String(a) === String(b);
};

export default ( state = {selectedCategory: null}, action) => {
    switch (action.type) {
    /**
     * TASK-2790 (epic 2765 W5) — THE INTRODUCTION FOLLOWS THE MAP.
     *
     * `introductionFetchEpic` writes this slice on INTRODUCTION_LOADED and
     * nothing ever cleared it. On a same-document SPA hop from map A to map B,
     * B's fetch is triggered by B's INIT_ANUGA and takes a round-trip
     * (from-map, then introduction). For that whole window the slice still held
     * A's payload — A's project_name, A's content_version, A's baseline block —
     * and TASK-2775's toolbar button dispatches setVisibleIntroduction(true)
     * directly, with no guard. The content is a liability disclaimer with a
     * project name on it; showing a stranger the wrong project's framing is the
     * exact failure this epic exists to remove, even for one second.
     *
     * WHY CLEARING, NOT A FRESHNESS CHECK ON THE BUTTON. A guard on the
     * consumer is the thing the NEXT consumer forgets — and there are already
     * three readers (the toolbar, the auto-show guard, the modal itself).
     * Clearing makes the stale value UNREADABLE, so a reader that forgets the
     * comparison gets "no introduction" (fail-closed) rather than the wrong
     * one. That is verbatim the argument projectsReducer's SET_RESOURCE_ID case
     * records for the project slice, and this is the same bug family
     * (TASK-2427/TASK-2548).
     *
     * THE WHOLE `introduction` KEY GOES, not just `data`: `projectId`,
     * `acceptedVersion`, `savingIntroduction` and `introductionSaveFailed` all
     * describe the project we have just left. Leaving `projectId` behind would
     * be worse than useless — INTRODUCTION_ACCEPTED / INTRODUCTION_SAVED
     * compare against it, so a stale id would let a late response for map A
     * write into the slice while B is on screen, which is precisely what those
     * guards exist to refuse.
     *
     * `visibleIntroduction` is deliberately NOT touched. It is the render flag,
     * not content, and the modal is now gated on the payload as well
     * (TASK-2796), so a latched-true flag over a cleared slice renders nothing
     * and then opens correctly the moment B's payload lands.
     *
     * SAME MAP -> SAME OBJECT. A repeat SET_RESOURCE_ID carrying the id we are
     * already on must be a no-op: MAP_CONFIG_LOADED re-fires on reconfig, and
     * returning a fresh object there would clear a payload under the map it
     * belongs to and re-render every consumer for nothing.
     */
    case SET_RESOURCE_ID: {
        if (_isSameMapId(state.introductionMapId, action.id)) {
            return state;
        }
        return {
            ...state,
            introduction: undefined,
            // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
            introductionMapId: action.id == null ? null : action.id
        };
    }
    case SET_PROCESSING_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            processingSimpleViewAttributeForm: action.processing
        };
    case SET_SV_CONFIG:
        return {
            ...state,
            config: action.config
        };
    case SET_OPEN_MENU_GROUP_ID:
        if (state.openMenuGroupId === action.openMenuGroupId) {
            return {
                ...state,
                openMenuGroupId: null
            };
        }
        return {
            ...state,
            openMenuGroupId: action.openMenuGroupId
        };
    case SET_VISIBLE_LEGEND_PANEL:
        return {
            ...state,
            visibleLegendPanel: action.visible
        };
    case SET_VISIBLE_INTRODUCTION:
        return {
            ...state,
            visibleIntroduction: action.visible
        };
    // Epic 2765 W3 — the introduction CONTENT slice, deliberately separate from
    // the `visibleIntroduction` render flag above: the toolbar's "About this
    // project" button reopens the modal without re-fetching or re-deciding
    // anything, and an accept must not have to unmount the payload to be
    // recorded.
    case INTRODUCTION_LOADED:
        // TASK-2790 — REFUSE a payload fetched for a map we have since left.
        //
        // Clearing on SET_RESOURCE_ID above closes the window where the OLD
        // payload is still readable; this closes the other half, where a slow
        // reply for map A lands AFTER the hop and writes A's disclaimer back in
        // under map B. `introductionFetchEpic` is a mergeMap by design (INIT_ANUGA
        // re-fires until a project resolves, and a switchMap would cancel the
        // first fetch forever), so nothing upstream tears the request down.
        //
        // Only a stamp that POSITIVELY disagrees is refused — an unstamped
        // dispatch reads through, so a unit test or a future caller that has not
        // been taught to stamp still works. Same fail-safe rule, same words, as
        // SET_ANUGA_PROJECT_DATA in Anuga/reducers/projectsReducer.js.
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (action.mapId != null && state.introductionMapId != null
            && !_isSameMapId(action.mapId, state.introductionMapId)) {
            return state;
        }
        return {
            ...state,
            introduction: {
                projectId: action.projectId,
                data: action.data,
                acceptedVersion: action.acceptedVersion || null
            }
        };
    case INTRODUCTION_ACCEPTED:
        // Stamped with the project, and refused when it does not describe the
        // payload on screen: an accept that lands after an SPA hop to another
        // map must not mark the NEW project's introduction as accepted.
        if (String(state.introduction?.projectId) !== String(action.projectId)) {
            return state;
        }
        return {
            ...state,
            introduction: {
                ...state.introduction,
                acceptedVersion: action.contentVersion
            }
        };
    // Epic 2765 W4 (TASK-2778) — owner/manager edit-in-place.
    //
    // All three carry the same project guard as INTRODUCTION_ACCEPTED above,
    // and for the same reason: a save that resolves after an SPA hop must not
    // paint one project's introduction over another's.
    case SAVE_INTRODUCTION:
        if (String(state.introduction?.projectId) !== String(action.projectId)) {
            return state;
        }
        return {
            ...state,
            introduction: {
                ...state.introduction,
                savingIntroduction: true,
                introductionSaveFailed: false
            }
        };
    case INTRODUCTION_SAVED:
        if (String(state.introduction?.projectId) !== String(action.projectId)) {
            return state;
        }
        // ⚠ SPREAD, not a fresh object like INTRODUCTION_LOADED builds. The
        // PATCH response is the same payload shape, so replacing the whole
        // slice would have looked equivalent — but it would drop
        // `acceptedVersion`, i.e. an owner's typo fix would silently forget
        // that THIS browser had anonymously accepted anything. The gate
        // compares versions, so the stamp is kept and simply stops matching
        // once the content really changed (an unchanged save hashes the same
        // and re-prompts nobody).
        return {
            ...state,
            introduction: {
                ...state.introduction,
                data: action.data,
                savingIntroduction: false,
                introductionSaveFailed: false
            }
        };
    case INTRODUCTION_SAVE_FAILED:
        if (String(state.introduction?.projectId) !== String(action.projectId)) {
            return state;
        }
        // `data` untouched: the editor stays open over the CURRENT server
        // content with the owner's unsaved text still in the textareas.
        return {
            ...state,
            introduction: {
                ...state.introduction,
                savingIntroduction: false,
                introductionSaveFailed: true
            }
        };
    case SET_VISIBLE_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            visibleSimpleViewAttributeForm: action.visible
        };
    case SET_VISIBLE_SV_ATTRIBUTE_RESULT:
        return {
            ...state,
            visibleSimpleViewAttributeResult: action.visible
        };
    case SET_SV_ATTRIBUTE_RESULT:
        return {
            ...state,
            simpleViewAttributeResult: action.data
        };
    case CREATE_SV_ATTRIBUTE_FORM:
        return {
            ...state,
            simpleViewAttributeForm: action.form,
            simpleViewImporterSessionId: action.simpleViewImporterSessionId,
            submitUrl: action.submitUrl,
            visibleSimpleViewAttributeForm: true
        };
    case UPDATE_SV_ATTRIBUTE_FORM: {
        const { override_used: overrideUsed, ...fields } = action.kv;
        const newKey = Object.keys(fields)[0];
        const newValue = fields[newKey];
        return {
            ...state,
            simpleViewAttributeForm: {
                ...state.simpleViewAttributeForm,
                [newKey]: {
                    ...state.simpleViewAttributeForm[newKey],
                    value: newValue,
                    override_used: overrideUsed
                }
            }
        };
    }
    case SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS:
        return {
            ...state,
            simpleViewImporterSessionId: action?.data?.importer_session_id
        };
    case SET_VISIBLE_UPLOADER_PANEL:
        return {
            ...state,
            visibleUploaderPanel: action.visible,
            importerConfigKey: action.importerConfigKey,
            importerTargetObjectId: action.importerTargetObjectId
        };
    case UPDATE_UPLOAD_STATUS:
        return {
            ...state,
            uploadStatus: action.status
        };
    case SV_SELECT_LAYER:
        return {
            ...state,
            selectedLayer: action.layer
        };
    default:
        return state;
    }
};

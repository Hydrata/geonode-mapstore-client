import {
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_POLLING_DATA,
    ADD_ANUGA_SCENARIO,
    UPDATE_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    DUPLICATE_ANUGA_SCENARIO_SUCCESS,
    ARCHIVE_ANUGA_SCENARIO_SUCCESS,
    UNARCHIVE_ANUGA_SCENARIO_SUCCESS,
    SET_ANUGA_SCENARIO_ARCHIVE_FILTER,
    SELECT_ANUGA_SCENARIO,
    TOGGLE_SCENARIO_SELECTED,
    SET_ANUGA_SCENARIO_IS_LOADED,
    // TASK-2079 — build-dedup: BUILD_SCENARIO_ERROR previously had no
    // reducer (action-only); a benign 409 (conflict: true) now stashes
    // `buildConflict` on the scenario so it can render inline near the
    // Build button instead of a toast.
    BUILD_SCENARIO,
    BUILD_SCENARIO_SUCCESS,
    BUILD_SCENARIO_ERROR
} from "../actionsAnuga";

const initialState = {
    byId: {},
    allIds: [],
    selectedId: null,
    // Active/Archived view filter. 'none' = active only (default, matches BE
    // default queryset), 'only' = archived only, 'all' = both.
    archiveFilter: 'none'
};

/**
 * Normalize an array of scenarios into byId/allIds.
 */
const normalizeScenarios = (scenarios) => {
    const byId = {};
    const allIds = [];
    scenarios.forEach(s => {
        byId[s.id] = s;
        allIds.push(s.id);
    });
    return { byId, allIds };
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_SCENARIO_DATA: {
        // Always replace — allows refresh after delete/re-init
        const { byId, allIds } = normalizeScenarios(action.scenarios);
        return { ...state, byId, allIds };
    }
    case SET_ANUGA_POLLING_DATA: {
        // Merge backend scenario data into normalized state
        const newById = { ...state.byId };
        const newAllIds = [...state.allIds];

        action.scenarios.forEach(backendScenario => {
            const existing = newById[backendScenario.id];
            if (existing) {
                // Merge: keep local fields (unsaved, selected, tempTimeString), update backend fields
                newById[backendScenario.id] = {
                    ...existing,
                    latest_run: backendScenario?.latest_run ?? null,
                    // TASK-2078: latest_complete_run MUST be in this merge
                    // whitelist too — 2078 repointed the FE result consumers
                    // (View Results gate, freshness banner, cross-section
                    // profile, download) from latest_run to latest_complete_run.
                    // Without this line the 8s poll never refreshes it on an
                    // already-loaded scenario, so it stays frozen at init value
                    // and those consumers go stale until a page reload.
                    latest_complete_run: backendScenario?.latest_complete_run ?? null,
                    status: backendScenario?.status || 'unsaved',
                    computed_status: backendScenario?.computed_status || backendScenario?.status,
                    latest_run_is_valid: backendScenario?.latest_run_is_valid
                };
            } else {
                // New backend-created scenario (e.g. copy)
                newById[backendScenario.id] = backendScenario;
                newAllIds.push(backendScenario.id);
            }
        });

        return {
            ...state,
            byId: newById,
            allIds: newAllIds
        };
    }
    case ADD_ANUGA_SCENARIO: {
        // Temporary scenario with null id — use a temp key
        const tempId = `new_${Date.now()}`;
        return {
            ...state,
            byId: {
                ...state.byId,
                [tempId]: {
                    id: null,
                    _tempId: tempId,
                    name: "",
                    code: null,
                    description: "",
                    // TASK-2038 (F5): matches the BE default
                    // (gn_anuga/models/scenario.py: resolution FloatField
                    // default=100) — resolution is the target triangle EDGE
                    // LENGTH in metres, not an area; 1000 collapsed a small
                    // domain to ~1 triangle (dogfood 2026-07-01).
                    resolution: 100,
                    constant_rainfall: null,
                    duration: null,
                    status: "new",
                    computed_status: "created",
                    project: action.projectId || null,
                    boundary: "",
                    terrain: "",
                    log: "log placeholder",
                    unsaved: false,
                    selected: false
                }
            },
            allIds: [...state.allIds, tempId]
        };
    }
    case UPDATE_ANUGA_SCENARIO: {
        // action.scenario contains the merged fields (action creator spreads kv into it)
        const key = action.scenario.id || action.scenario._tempId;
        if (!key || !state.byId[key]) return state;
        const existing = state.byId[key];
        return {
            ...state,
            byId: {
                ...state.byId,
                [key]: { ...existing, ...action.scenario, unsaved: true }
            }
        };
    }
    case TOGGLE_SCENARIO_SELECTED: {
        const key = action.scenario.id || action.scenario._tempId;
        if (!key || !state.byId[key]) return state;
        const existing = state.byId[key];
        return {
            ...state,
            byId: {
                ...state.byId,
                [key]: { ...existing, selected: !existing.selected }
            }
        };
    }
    case SAVE_ANUGA_SCENARIO_SUCCESS: {
        const newById = { ...state.byId };
        const newAllIds = [...state.allIds];
        const saved = { ...action.scenario, unsaved: false };

        // Find and replace the temp entry (null id) or existing entry
        const tempKey = newAllIds.find(id => newById[id]?.id === null);
        if (tempKey && !action.scenario._tempId) {
            // Replace temp with real
            delete newById[tempKey];
            const idx = newAllIds.indexOf(tempKey);
            newAllIds[idx] = saved.id;
        }
        newById[saved.id] = saved;

        return { ...state, byId: newById, allIds: newAllIds };
    }
    case DUPLICATE_ANUGA_SCENARIO_SUCCESS: {
        // The BE returns a freshly-INSERTed pk (ScenarioSerializerV2); we
        // append to byId/allIds. Defensive guard for malformed dispatch
        // without an id; collisions cannot happen with a fresh insert.
        if (!action.scenario?.id) {
            return state;
        }
        return {
            ...state,
            byId: { ...state.byId, [action.scenario.id]: { ...action.scenario, unsaved: false } },
            allIds: [...state.allIds, action.scenario.id]
        };
    }
    case ARCHIVE_ANUGA_SCENARIO_SUCCESS:
    case UNARCHIVE_ANUGA_SCENARIO_SUCCESS: {
        // The polling epic reconciles visibility on its next tick by
        // re-fetching with the current archiveFilter; we update byId here so
        // the row's badge refreshes immediately.
        const id = action.scenario?.id;
        if (!id || !state.byId[id]) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [id]: {
                    ...state.byId[id],
                    archived_at: action.scenario.archived_at,
                    archived_by: action.scenario.archived_by,
                    archived_by_username: action.scenario.archived_by_username
                }
            }
        };
    }
    case SET_ANUGA_SCENARIO_ARCHIVE_FILTER: {
        // Record the chip's mode so the polling epic + initial fetch pass
        // `?archived=` through to the BE. Default 'none' = active only.
        const mode = action.mode;
        if (!['none', 'only', 'all'].includes(mode)) return state;
        return { ...state, archiveFilter: mode };
    }
    case SELECT_ANUGA_SCENARIO:
        return {
            ...state,
            selectedId: action.scenario.id || action.scenario._tempId
        };
    case SET_ANUGA_SCENARIO_IS_LOADED: {
        const existing = state.byId[action.scenarioId];
        if (!existing) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [action.scenarioId]: { ...existing, isLoaded: action.isLoaded }
            }
        };
    }
    // TASK-2079 — build-dedup reducer for BUILD_SCENARIO_ERROR (previously
    // action-only, no reducer at all). A fresh Build click optimistically
    // clears any stale conflict lozenge left over from a prior 409 before
    // the new request resolves.
    // A fresh Build click (BUILD_SCENARIO) and a successful build
    // (BUILD_SCENARIO_SUCCESS) both optimistically clear any stale conflict
    // lozenge left over from a prior 409 — identical logic, shared here.
    case BUILD_SCENARIO:
    case BUILD_SCENARIO_SUCCESS: {
        const id = action.scenarioId;
        if (!id || !state.byId[id] || !state.byId[id].buildConflict) return state;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], buildConflict: null } }
        };
    }
    case BUILD_SCENARIO_ERROR: {
        const id = action.scenarioId;
        if (!id || !state.byId[id]) return state;
        // A REAL failure (conflict: false) is surfaced by the 'Build failed'
        // toast (comparisonActions.buildScenarioError) — no inline state to
        // set here, but still clear any stale conflict lozenge.
        const buildConflict = action.conflict
            ? { runId: action.runId, status: action.runStatus, detail: action.detail }
            : null;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], buildConflict } }
        };
    }
    default:
        return state;
    }
};

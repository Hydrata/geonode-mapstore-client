import {
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_POLLING_DATA,
    ADD_ANUGA_SCENARIO,
    UPDATE_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    SELECT_ANUGA_SCENARIO,
    TOGGLE_SCENARIO_SELECTED,
    SET_ANUGA_SCENARIO_IS_LOADED
} from "../actionsAnuga";

const initialState = {
    byId: {},
    allIds: [],
    selectedId: null
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
        // Initial load — only set if empty (preserve local edits)
        if (state.allIds.length === 0) {
            const { byId, allIds } = normalizeScenarios(action.scenarios);
            return { ...state, byId, allIds };
        }
        return state;
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
                    latest_run: { ...backendScenario?.latest_run },
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
                    resolution: 1000,
                    constant_rainfall: null,
                    duration: null,
                    status: "new",
                    computed_status: "created",
                    project: action.projectId || null,
                    boundary: "",
                    elevation: "",
                    log: "log placeholder",
                    unsaved: false,
                    selected: false
                }
            },
            allIds: [...state.allIds, tempId]
        };
    }
    case UPDATE_ANUGA_SCENARIO: {
        const key = action.scenario.id || action.scenario._tempId;
        if (!key || !state.byId[key]) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [key]: { ...action.scenario, unsaved: true }
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
    default:
        return state;
    }
};

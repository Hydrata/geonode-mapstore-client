import {
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    UPDATE_RUN_STATUS
} from "../actionsAnuga";

const initialState = {
    byId: {},
    activePolling: []
};

export default (state = initialState, action) => {
    switch (action.type) {
    case START_ACTIVE_RUN_POLLING:
        return {
            ...state,
            activePolling: state.activePolling.includes(action.runId)
                ? state.activePolling
                : [...state.activePolling, action.runId]
        };
    case STOP_ACTIVE_RUN_POLLING:
        return {
            ...state,
            activePolling: state.activePolling.filter(id => id !== action.runId)
        };
    case UPDATE_RUN_STATUS:
        return {
            ...state,
            byId: {
                ...state.byId,
                [action.runId]: {
                    ...(state.byId[action.runId] || {}),
                    id: action.runId,
                    status: action.status,
                    progress_pct: action.progress_pct,
                    eta_seconds: action.eta_seconds,
                    error_message: action.error_message,
                    compute_backend: action.compute_backend
                }
            }
        };
    default:
        return state;
    }
};

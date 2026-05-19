import {
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    UPDATE_RUN_STATUS,
    RUN_STATUS_POLLING_TIMEOUT,
    DISMISS_RUN_POLLING_TIMEOUT
} from "../actionsAnuga";

const initialState = {
    byId: {},
    activePolling: [],
    // W7 (TASK-1045) — runId -> true once pollActiveRunStatusEpic has hit its
    // wall-clock cap without observing a terminal status. The runPollingPausedBanner
    // component reads this slice to decide whether to render. Re-dispatching
    // START_ACTIVE_RUN_POLLING(runId) clears the entry.
    pollingTimeoutFor: {}
};

export default (state = initialState, action) => {
    switch (action.type) {
    case START_ACTIVE_RUN_POLLING: {
        // Re-starting polling for a run clears any prior paused-banner flag.
        const {[action.runId]: _cleared, ...remaining} = state.pollingTimeoutFor || {};
        return {
            ...state,
            activePolling: state.activePolling.includes(action.runId)
                ? state.activePolling
                : [...state.activePolling, action.runId],
            pollingTimeoutFor: remaining
        };
    }
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
    case RUN_STATUS_POLLING_TIMEOUT:
        return {
            ...state,
            pollingTimeoutFor: {
                ...(state.pollingTimeoutFor || {}),
                [action.runId]: true
            }
        };
    case DISMISS_RUN_POLLING_TIMEOUT: {
        // Clear the flag without re-arming polling. User acknowledged the
        // banner via a click/focus elsewhere on the page.
        const {[action.runId]: _cleared, ...remaining} = state.pollingTimeoutFor || {};
        return {
            ...state,
            pollingTimeoutFor: remaining
        };
    }
    default:
        return state;
    }
};

import {
    TM_SET_PROCESSES,
    TM_SET_ACTIVE_COUNT,
    TM_UPDATE_PROCESS,
    TM_CANCEL_PROCESS_RESULT
} from '../actionsTaskMonitor';

const initialState = {
    byId: {},
    allIds: [],
    activeCount: 0,
    lastFetched: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case TM_SET_PROCESSES: {
        const byId = {};
        const allIds = [];
        (action.processes || []).forEach(p => {
            byId[p.id] = p;
            allIds.push(p.id);
        });
        return {
            ...state,
            byId,
            allIds,
            lastFetched: Date.now()
        };
    }
    case TM_SET_ACTIVE_COUNT:
        return { ...state, activeCount: action.count };
    case TM_UPDATE_PROCESS:
        if (!action.process) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [action.process.id]: action.process
            },
            allIds: state.allIds.indexOf(action.process.id) === -1
                ? [action.process.id, ...state.allIds]
                : state.allIds
        };
    case TM_CANCEL_PROCESS_RESULT:
        if (!action.process) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [action.process.id]: action.process
            }
        };
    default:
        return state;
    }
};

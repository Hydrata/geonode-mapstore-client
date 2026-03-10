import {
    TM_TOGGLE_PANEL,
    TM_SET_FILTER,
    TM_EXPAND_PROCESS,
    TM_TOGGLE_LOG
} from '../actionsTaskMonitor';

const initialState = {
    panelOpen: false,
    filter: 'active',
    expandedProcessId: null,
    showLog: false
};

export default (state = initialState, action) => {
    switch (action.type) {
    case TM_TOGGLE_PANEL:
        return {
            ...state,
            panelOpen: action.open !== undefined ? action.open : !state.panelOpen
        };
    case TM_SET_FILTER:
        return { ...state, filter: action.filter, expandedProcessId: null, showLog: false };
    case TM_EXPAND_PROCESS:
        return {
            ...state,
            expandedProcessId: state.expandedProcessId === action.processId ? null : action.processId,
            showLog: false
        };
    case TM_TOGGLE_LOG:
        return { ...state, showLog: action.show !== undefined ? action.show : !state.showLog };
    default:
        return state;
    }
};

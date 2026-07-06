/**
 * Compute-meter reducer (TASK-2100, epic 2092 W4.2). Mounted at
 * state.anuga.computeMeter (Anuga/reducersAnuga.js) — account-scoped, but
 * rides the same Anuga slice as everything else in this app for consistency.
 *
 * `enabled` is the "backend reports no meter" signal
 * (commerce.balance_views.AccountBalanceView, flag-off dark shape) the FE's
 * zero-meter-UI guarantee keys off — distinct from "no billing account yet"
 * (enabled=true, balance=null).
 */
import {
    SET_COMPUTE_BALANCE,
    SET_METER_INSUFFICIENT_BALANCE,
    SET_METER_CAP_EXCEEDED,
    SET_METER_ESTIMATE_CEILING,
    DISMISS_METER_MODAL
} from './actions';

const initialState = {
    enabled: false,
    balance: null,
    availablePacks: [],
    recentEntries: [],
    // {type: 'insufficient_balance'|'cap_exceeded'|'estimate_ceiling', checkoutUrl, detail} | null
    modal: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_COMPUTE_BALANCE: {
        const data = action.data || {};
        return {
            ...state,
            enabled: !!data.enabled,
            balance: data.balance !== undefined ? data.balance : null,
            availablePacks: data.available_packs || [],
            recentEntries: data.recent_entries || []
        };
    }
    case SET_METER_INSUFFICIENT_BALANCE:
        return {
            ...state,
            modal: { type: 'insufficient_balance', checkoutUrl: action.checkoutUrl, detail: action.detail }
        };
    case SET_METER_CAP_EXCEEDED:
        return {
            ...state,
            modal: { type: 'cap_exceeded', checkoutUrl: null, detail: action.detail }
        };
    case SET_METER_ESTIMATE_CEILING:
        return {
            ...state,
            modal: { type: 'estimate_ceiling', checkoutUrl: null, detail: action.detail }
        };
    case DISMISS_METER_MODAL:
        return { ...state, modal: null };
    default:
        return state;
    }
};

export const getComputeMeterState = (state) => (state && state.anuga && state.anuga.computeMeter) || initialState;

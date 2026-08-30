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
    SET_METER_EMAIL_UNVERIFIED,
    RESEND_EMAIL_VERIFICATION_REQUEST,
    SET_RESEND_EMAIL_VERIFICATION_RESULT,
    DISMISS_METER_MODAL
} from './actions';

const initialState = {
    // TASK-2513 (epic 2425 W3d) — distinguishes "never fetched yet" from a
    // genuinely empty/dark response, exactly as Paywall/account/reducer.js's own
    // `loaded` does for the summary slice.
    //
    // It is load-bearing, not bookkeeping: initialState and the backend's
    // `_dark_response()` (commerce/balance_views.py) reduce to the IDENTICAL
    // {enabled: false, balance: null}, so `balance === null` cannot tell "the
    // boot fetch failed and nothing has ever answered" from "the meter is off on
    // this site". refetchBalanceOnAccountSummaryEpic gates on THIS, and a repair
    // keyed on the balance instead would refetch on every account summary for
    // the life of every dark session — three of the four prod sites.
    loaded: false,
    enabled: false,
    balance: null,
    availablePacks: [],
    recentEntries: [],
    // {type: 'insufficient_balance'|'cap_exceeded'|'estimate_ceiling'|'email_unverified', checkoutUrl, detail, resendUrl} | null
    modal: null,
    // TASK-2849 — feedback for the email_unverified modal's Resend button.
    // {pending, status: 'sent'|'already_verified'|'cooldown'|'send_failed'|'error'|null, detail} — pending is
    // a separate bool (not folded into status) so the button's disabled
    // state does not depend on parsing a string.
    resendVerification: { pending: false, status: null, detail: null }
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_COMPUTE_BALANCE: {
        const data = action.data || {};
        return {
            ...state,
            // Any response marks the slice observed — including a dark one. That
            // self-clearing is what bounds the repair epic without a once-guard.
            loaded: true,
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
    case SET_METER_EMAIL_UNVERIFIED:
        return {
            ...state,
            modal: { type: 'email_unverified', checkoutUrl: null, detail: action.detail, resendUrl: action.resendUrl },
            // A fresh refusal always starts from a clean resend-feedback slate.
            resendVerification: { pending: false, status: null, detail: null }
        };
    case RESEND_EMAIL_VERIFICATION_REQUEST:
        return { ...state, resendVerification: { pending: true, status: null, detail: null } };
    case SET_RESEND_EMAIL_VERIFICATION_RESULT:
        return {
            ...state,
            resendVerification: { pending: false, status: action.status, detail: action.detail || null }
        };
    case DISMISS_METER_MODAL:
        return { ...state, modal: null, resendVerification: { pending: false, status: null, detail: null } };
    default:
        return state;
    }
};

export const getComputeMeterState = (state) => (state && state.anuga && state.anuga.computeMeter) || initialState;

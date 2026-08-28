/**
 * Account summary reducer (TASK-2420, epic 2359 W4.5). Mounted at
 * state.anuga.accountSummary (Anuga/reducersAnuga.js) — account-scoped
 * (like Paywall/meter/reducer.js) but rides the Anuga slice for consistency.
 *
 * `loaded` distinguishes "never fetched yet" (Billing tab not opened this
 * session) from a genuinely empty/dark response — the Billing tab uses it to
 * show a loading state rather than a flash of zeros on first open.
 */
import {
    SET_ACCOUNT_SUMMARY,
    SET_BILLING_PORTAL_ERROR,
    SET_BILLING_PORTAL_OPENED,
    REQUEST_BILLING_PORTAL
} from './actions';

const initialState = {
    loaded: false,
    organisation: null,
    isPersonal: true,
    manager: null,
    isManager: false,
    balance: null,
    // TASK-2848 (epic 2839 W2.1) — `table` retired: AC2839-AC6 kills band()
    // and its FE mirror (bandForEstimate) everywhere; the account-summary
    // payload no longer carries a price-band table to consume
    // (commerce/account_views.py's free_band dict dropped its 'table' key
    // in TASK-2841, same epic W1.1).
    freeBand: { cap: 0, usedToday: 0, edge: '0' },
    subscription: { active: false, since: null },
    availablePacks: [],
    recentEntries: [],
    portalLoading: false,
    portalError: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ACCOUNT_SUMMARY: {
        const data = action.data || {};
        const freeBand = data.free_band || {};
        const subscription = data.subscription || {};
        return {
            ...state,
            loaded: true,
            organisation: data.organisation !== undefined ? data.organisation : null,
            isPersonal: !!data.is_personal,
            manager: data.manager !== undefined ? data.manager : null,
            isManager: !!data.is_manager,
            balance: data.balance !== undefined ? data.balance : null,
            freeBand: {
                cap: freeBand.cap !== undefined ? freeBand.cap : 0,
                usedToday: freeBand.used_today !== undefined ? freeBand.used_today : 0,
                edge: freeBand.edge !== undefined ? freeBand.edge : '0'
            },
            subscription: {
                active: !!subscription.active,
                since: subscription.since !== undefined ? subscription.since : null
            },
            availablePacks: data.available_packs || [],
            recentEntries: data.recent_entries || []
        };
    }
    case REQUEST_BILLING_PORTAL:
        return { ...state, portalLoading: true, portalError: null };
    case SET_BILLING_PORTAL_ERROR:
        return { ...state, portalLoading: false, portalError: action.detail || null };
    case SET_BILLING_PORTAL_OPENED:
        return { ...state, portalLoading: false };
    default:
        return state;
    }
};

export const getAccountSummaryState = (state) => (state && state.anuga && state.anuga.accountSummary) || initialState;

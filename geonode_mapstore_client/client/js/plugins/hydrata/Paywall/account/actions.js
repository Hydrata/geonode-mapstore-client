/**
 * Account panel FE actions (TASK-2420, epic 2359 W4.5).
 *
 * Separate from Paywall/meter/actions.js (the compute-meter balance strip +
 * 402/429 refusal modals) — this slice backs the Billing tab's FULL account
 * summary (org/manager, balance, free-band usage, subscription, ledger)
 * sourced from GET /commerce/account/ (commerce.account_views), plus the
 * manager-only Stripe Customer Portal round-trip
 * (POST /commerce/billing-portal/).
 */

export const FETCH_ACCOUNT_SUMMARY = 'ACCOUNT:FETCH_SUMMARY';
export const SET_ACCOUNT_SUMMARY = 'ACCOUNT:SET_SUMMARY';
export const REQUEST_BILLING_PORTAL = 'ACCOUNT:REQUEST_BILLING_PORTAL';
export const SET_BILLING_PORTAL_ERROR = 'ACCOUNT:SET_BILLING_PORTAL_ERROR';
export const SET_BILLING_PORTAL_OPENED = 'ACCOUNT:SET_BILLING_PORTAL_OPENED';

export function fetchAccountSummary() {
    return { type: FETCH_ACCOUNT_SUMMARY };
}

/** @param {object} data — the /commerce/account/ response body. */
export function setAccountSummary(data) {
    return { type: SET_ACCOUNT_SUMMARY, data };
}

/** Manager-only — POSTs /commerce/billing-portal/ then redirects on success. */
export function requestBillingPortal() {
    return { type: REQUEST_BILLING_PORTAL };
}

/** @param {string} detail — server error detail, or a generic client message. */
export function setBillingPortalError(detail) {
    return { type: SET_BILLING_PORTAL_ERROR, detail };
}

/**
 * UAT-2 (new-tab portal) — the portal now opens in a separate tab, so THIS
 * page stays alive and the "Opening…" button state must be cleared on
 * success (previously the same-tab navigation made that moot).
 */
export function setBillingPortalOpened() {
    return { type: SET_BILLING_PORTAL_OPENED };
}

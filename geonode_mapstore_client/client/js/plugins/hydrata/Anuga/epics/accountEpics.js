/**
 * Account panel fetch/portal epics (TASK-2420, epic 2359 W4.5).
 *
 * The account summary (GET /commerce/account/) is fetched:
 *   - once per INIT_ANUGA (mirrors computeMeterEpics.js's balance-fetch
 *     trigger) — so the Estimate line's over-balance badge (scenarioPane.js)
 *     has a balance/free-band to compare against even if the Billing tab is
 *     never opened;
 *   - every time the Billing tab opens (SET_MEMBERSHIP_PANEL_TAB(tab=
 *     'billing')) — refetched (not deduped) so the panel is never showing a
 *     stale balance after a run/checkout elsewhere in the session;
 *   - on checkout-return success (paywallEpics.js's checkoutReturnEpic also
 *     dispatches fetchAccountSummary() alongside its existing balance
 *     refresh).
 */
import Rx from 'rxjs';
import * as anugaApi from '../api/anugaApi';
import { INIT_ANUGA, SET_MEMBERSHIP_PANEL_TAB } from '../actionsAnuga';
import {
    FETCH_ACCOUNT_SUMMARY,
    REQUEST_BILLING_PORTAL,
    fetchAccountSummary,
    setAccountSummary,
    setBillingPortalError,
    setBillingPortalOpened
} from '../../Paywall/account/actions';
import { getAccountSummaryState } from '../../Paywall/account/reducer';
import { fetchComputeBalance } from '../../Paywall/meter/actions';
// TASK-2110-class error-shape gotcha (see apiErrorUtils.js doc comment):
// MapStore2's libs/ajax.js response interceptor rewrites axios rejections
// to the response blob directly (err.status/err.data), not err.response.*.
import { readErrData } from '../utils/apiErrorUtils';

// Module-level "already fired the initial fetch" guard — mirrors
// computeMeterEpics.js's _initialFetchHandled idiom.
let _initialFetchHandled = false;
export const __resetAccountSummaryInitForTests = () => { _initialFetchHandled = false; };

export const triggerFetchAccountSummaryOnInitEpic = (action$) => action$
    .ofType(INIT_ANUGA)
    .filter(() => !_initialFetchHandled)
    .map(() => {
        _initialFetchHandled = true;
        return fetchAccountSummary();
    });

// UAT-2 — the Stripe Customer Portal opens in a NEW tab so the map SPA
// survives the round-trip (same rationale + blocked-popup fallback as
// paywallEpics.js's _openInNewTab).
const _openInNewTab = (url) => {
    if (typeof window === 'undefined' || !window.location) return;
    const w = window.open(url, '_blank');
    if (w) {
        w.opener = null;
    } else {
        window.location.href = url;
    }
};

// Test seam — the real behaviour opens a browser tab, which would derail a
// Karma run. Mirrors paywallEpics.js's __setRedirectForTests.
let _redirectTo = _openInNewTab;
export const __setRedirectForTests = (fn) => {
    _redirectTo = fn || _openInNewTab;
};

export const triggerFetchAccountSummaryOnBillingTabOpenEpic = (action$) => action$
    .ofType(SET_MEMBERSHIP_PANEL_TAB)
    .filter((action) => action.tab === 'billing')
    .map(() => fetchAccountSummary());

export const fetchAccountSummaryEpic = (action$) => action$
    .ofType(FETCH_ACCOUNT_SUMMARY)
    .switchMap(() => Rx.Observable.from(anugaApi.getAccountSummary())
        .map((response) => setAccountSummary(response?.data || {}))
        // A failed fetch (401 for a since-logged-out session, 5xx) is
        // non-fatal — the Billing tab simply stays in its 'loading'/empty
        // state rather than throwing.
        .catch(() => Rx.Observable.empty())
    );

export const requestBillingPortalEpic = (action$) => action$
    .ofType(REQUEST_BILLING_PORTAL)
    .switchMap(() => Rx.Observable.from(anugaApi.createBillingPortalSession())
        .mergeMap((response) => {
            const url = response?.data?.url;
            if (url) {
                _redirectTo(url);
                // New-tab open leaves THIS page alive — clear the button's
                // "Opening…" state (same-tab nav previously made this moot).
                return Rx.Observable.of(setBillingPortalOpened());
            }
            // W3c adversarial — a 200 WITH NO URL used to emit nothing at all,
            // so `portalLoading` stayed true and "Manage billing" read
            // "Opening…" for the life of the page. That is verbatim the defect
            // TASK-2441 fixed in subscribeCheckoutEpic, sitting in the sibling
            // epic 2441 cites as its own precedent. Every branch must settle
            // the flag it armed; an unexplained dead control is worse than an
            // explained failure.
            return Rx.Observable.of(setBillingPortalError(
                'Unable to open the billing portal right now.'
            ));
        })
        .catch((error) => Rx.Observable.of(
            setBillingPortalError(readErrData(error)?.detail || 'Unable to open the billing portal right now.')
        ))
    );

/**
 * UAT-2 (new-tab checkout/portal) — the purchase now completes in ANOTHER
 * tab, so this tab's balance/ledger go stale the moment the user pays.
 * Refetch the account summary + meter balance whenever this window regains
 * focus, once a summary has ever been loaded (a dark/flags-off session never
 * loads one, so it never fires). Debounced so rapid focus flapping can't
 * queue a fetch burst; both endpoints are cheap idempotent GETs.
 */
export const refreshAccountOnWindowFocusEpic = (action$, store) =>
    (typeof window === 'undefined'
        ? Rx.Observable.empty()
        : Rx.Observable.fromEvent(window, 'focus'))
        .debounceTime(500)
        .filter(() => getAccountSummaryState(store.getState()).loaded)
        .mergeMap(() => Rx.Observable.of(fetchAccountSummary(), fetchComputeBalance()));

export default {
    triggerFetchAccountSummaryOnInitEpic,
    triggerFetchAccountSummaryOnBillingTabOpenEpic,
    fetchAccountSummaryEpic,
    requestBillingPortalEpic,
    refreshAccountOnWindowFocusEpic
};

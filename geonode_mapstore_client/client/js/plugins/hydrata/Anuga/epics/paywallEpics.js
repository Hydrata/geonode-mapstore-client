/**
 * Paywall + compute-meter checkout-round-trip epics (TASK-2099/2100, epic
 * 2092 W4).
 *
 * Three concerns:
 *   1. checkoutReturnEpic — parses ?checkout=success|cancel off the return
 *      URL (CheckoutReturnView, apps/commerce/checkout_views.py, places it
 *      BEFORE the hash router's fragment per TASK-1375) and arms the FE-only
 *      `pending` overlay, or shows a toast on cancel.
 *   2. pollMyPermsWhilePendingEpic — while `pending` is armed, re-fetches
 *      my_perms on an interval until the webhook flips it to paid_private
 *      (paywallContract.js _meta.note_on_pending: the backend has no
 *      in-flight marker, so polling my_perms is the only way to observe it).
 *      TASK-2100: the SAME return URL/marker covers a credit-pack purchase
 *      (shared checkout session machinery, see subscribeCheckoutEpic below),
 *      so each poll tick ALSO re-fetches the compute balance — cheap
 *      over-fetch, and it's the only place both purchase kinds' webhook race
 *      is already being waited out.
 *   3. subscribeCheckoutEpic — POSTs /commerce/checkout/create-session/ (the
 *      checkout_url is POST-only, an <a href> click would 405) and redirects
 *      the browser to the returned session.url. Shared by the 2099
 *      subscription CTA and the 2100 credit-pack purchase CTA.
 */
import Rx from 'rxjs';
import { show } from '../../../../../MapStore2/web/client/actions/notifications';
import * as anugaApi from '../api/anugaApi';
import { INIT_ANUGA, fetchMyPerms, setMembershipPanel, setMembershipPanelTab } from '../actionsAnuga';
import { SUBSCRIBE_CHECKOUT_REQUEST, setPaywallPending } from '../../Paywall/actions';
import { isPaywallPending } from '../../Paywall/reducer';
import { fetchComputeBalance, dismissMeterModal } from '../../Paywall/meter/actions';
import { fetchAccountSummary } from '../../Paywall/account/actions';

const getProjectId = (state) => state?.anuga?.projects?.data?.id;

// Fixed-interval poll, capped — a "no polish" MVP: no backoff, just a hard
// ceiling so an abandoned tab (webhook lost, user never returns) can't poll
// forever. 20 * 3s = 60s, comfortably longer than a normal webhook round trip.
export const PAYWALL_POLL_INTERVAL_MS = 3000;
export const PAYWALL_POLL_MAX_ATTEMPTS = 20;

// Test seam — lets tests shrink the poll interval so a Karma run doesn't
// have to wait out the real 3s cadence (mirrors permsEpics.js's __setNowForTests).
let _pollIntervalMs = PAYWALL_POLL_INTERVAL_MS;
export const __setPollIntervalForTests = (ms) => { _pollIntervalMs = ms || PAYWALL_POLL_INTERVAL_MS; };

// Test seam — subscribeCheckoutEpic's real behaviour is a full-page
// navigation (window.location.href = url), which would hang/derail a Karma
// run in a real browser. Tests inject a spy here instead of letting the
// suite actually navigate away.
let _redirectTo = (url) => {
    if (typeof window !== 'undefined' && window.location) {
        window.location.href = url;
    }
};
export const __setRedirectForTests = (fn) => {
    _redirectTo = fn || ((url) => { if (typeof window !== 'undefined' && window.location) window.location.href = url; });
};

// Module-level "have we already parsed the return URL this session" guard —
// mirrors permsEpics.js's dedupe idiom. Without it, INIT_ANUGA firing more
// than once (SPA nav back into the same project) would re-arm `pending` on
// an already-resolved checkout every time.
let _checkoutReturnHandled = false;
export const __resetCheckoutReturnForTests = () => { _checkoutReturnHandled = false; };

const _readCheckoutMarker = () => {
    const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
    return new URLSearchParams(search).get('checkout');
};

/**
 * INIT_ANUGA is the same panel-open trigger permsEpics.js uses for the
 * my_perms fetch itself — by the time this fires the app is mounted and
 * window.location reflects the CheckoutReturnView redirect (?checkout=...
 * placed before the hash, so location.search sees it — see checkout_views.py).
 */
export const checkoutReturnEpic = (action$) => action$
    .ofType(INIT_ANUGA)
    .filter(() => !_checkoutReturnHandled)
    .map(() => {
        _checkoutReturnHandled = true;
        return _readCheckoutMarker();
    })
    .filter((marker) => marker === 'success' || marker === 'cancel')
    .mergeMap((marker) => marker === 'success'
        // TASK-2100: also clear any stale insufficient_balance/cap_exceeded
        // meter modal — the SAME ?checkout=success return covers a
        // credit-pack purchase (shared checkout session, see
        // subscribeCheckoutEpic), and the balance poll below will bring the
        // panel's numbers current; a leftover modal would otherwise block
        // the user from seeing that Run is dispatchable again.
        // TASK-2420 — ALSO open the Account panel on Billing with the
        // balance refreshed, so the user watches the credit/subscription
        // land rather than having to hunt for it afterwards.
        ? Rx.Observable.of(
            setPaywallPending(), dismissMeterModal(),
            setMembershipPanel(true), setMembershipPanelTab('billing'), fetchAccountSummary()
        )
        : Rx.Observable.of(show({
            title: 'hydrata.anuga.checkoutCancelled.title',
            message: 'hydrata.anuga.checkoutCancelled.message',
            level: 'info',
            autoDismiss: 5,
            position: 'tc'
        }))
    );

export const pollMyPermsWhilePendingEpic = (action$, store) => action$
    .ofType('PAYWALL:SET_PENDING')
    .switchMap(() => {
        const projectId = getProjectId(store.getState());
        return Rx.Observable.interval(_pollIntervalMs)
            .take(PAYWALL_POLL_MAX_ATTEMPTS)
            .takeWhile(() => isPaywallPending(store.getState()))
            .mergeMap(() => Rx.Observable.of(
                fetchComputeBalance(),
                ...(projectId ? [fetchMyPerms(projectId)] : [])
            ));
    });

export const subscribeCheckoutEpic = (action$, store) => action$
    .ofType(SUBSCRIBE_CHECKOUT_REQUEST)
    .switchMap(({ purchaseType, priceId }) => {
        const projectId = getProjectId(store.getState());
        return Rx.Observable.from(anugaApi.createCheckoutSession(projectId, purchaseType, priceId))
            .mergeMap((response) => {
                const url = response?.data?.checkout_url;
                if (url) {
                    _redirectTo(url);
                }
                return Rx.Observable.empty();
            })
            .catch(() => Rx.Observable.of(
                show({
                    title: 'hydrata.anuga.checkoutFailed.title',
                    message: 'hydrata.anuga.checkoutFailed.message',
                    level: 'error',
                    autoDismiss: 5,
                    position: 'tc'
                })
            ));
    });

export default {
    checkoutReturnEpic,
    pollMyPermsWhilePendingEpic,
    subscribeCheckoutEpic
};

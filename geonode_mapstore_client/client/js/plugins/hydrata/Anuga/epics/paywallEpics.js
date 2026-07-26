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
 *      my_perms on an interval until the webhook flips it to a PAID steady
 *      state (paid_private OR paid_organization — see PAID_STEADY_STATES in
 *      Paywall/reducer.js; matching only paid_private was TASK-2457's bug)
 *      (paywallContract.js _meta.note_on_pending: the backend has no
 *      in-flight marker, so polling my_perms is the only way to observe it),
 *      or until it gives up, at which point it CLEARS the overlay rather than
 *      stranding the customer on a permanent spinner.
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
import { SUBSCRIBE_CHECKOUT_REQUEST, setPaywallPending, clearPaywallPending } from '../../Paywall/actions';
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

// UAT-2 — Stripe checkout opens in a NEW tab so the map SPA (unsaved map
// state, panel layout, in-flight polls) survives the round-trip; the
// CheckoutReturnView redirect lands in that new tab, whose own
// checkoutReturnEpic shows the Billing tab. Fallback-guarded: a popup
// blocker makes window.open return null, in which case we same-tab navigate
// so the purchase flow never dead-ends. `w.opener = null` severs the reverse
// handle (passing 'noopener' as a window feature would ALSO force the return
// value to null, breaking blocked-detection).
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
// Karma run. Tests inject a spy here instead.
let _redirectTo = _openInNewTab;
export const __setRedirectForTests = (fn) => {
    _redirectTo = fn || _openInNewTab;
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
        // NOTE the show(opts, level) signature: level is the SECOND ARG — a
        // `level` key inside opts is overwritten by the arg's 'success'
        // default (the UAT-2 green-error-toast bug).
        : Rx.Observable.of(show({
            title: 'hydrata.anuga.checkoutCancelled.title',
            message: 'hydrata.anuga.checkoutCancelled.message',
            autoDismiss: 5,
            position: 'tc'
        }, 'info'))
    );

/**
 * Poll my_perms after a Stripe return until the webhook flips the entitlement.
 *
 * TASK-2464 — `fetchMyPerms(projectId, TRUE)`. The poll runs every 3s against
 * permsEpics' 30s dedupe window, which is only invalidated on failure — so 9
 * of the first 10 ticks were returning Observable.empty() with no HTTP call
 * and no log. The poll looked like it was working and was mostly not.
 *
 * TASK-2457 (adversarial R2) — the poll must CLEAR the pending overlay when it
 * gives up. It previously ran out of attempts and stopped silently, and since
 * the overlay masks `steady` in getEffectivePaywallPayload, a customer whose
 * webhook was slow or lost was left in `pending` until they reloaded the page.
 * An un-dismissable state is a trap (ModalHost.js's own standard).
 *
 * The clear is a `concat(defer(...))` tail, NOT a `finally`: it must run only
 * when the inner stream COMPLETES (attempts exhausted, or takeWhile went
 * false), never when switchMap unsubscribes it because a second SET_PENDING
 * arrived — a finally would fire on unsubscribe too and disarm the overlay the
 * new poll had just armed. `defer` re-reads the store at that moment, so the
 * normal success path (steady went paid_*, overlay already null) emits
 * nothing.
 *
 * TASK-2463 (epic 2425 W2.6) — the project id is resolved PER TICK, not once
 * when the poll is armed. On the path that matters most it is not available
 * when the poll is armed: checkoutReturnEpic maps INIT_ANUGA straight to
 * SET_PENDING, and INIT_ANUGA fires BEFORE initAnugaEpic has resolved the
 * project (permsEpics.js:57 documents the same ordering). So on a checkout
 * RETURN — the one path where a webhook is racing us — `projectId` was
 * undefined, the `projectId ? ... : []` branch emitted nothing, and the poll
 * spent 60 seconds fetching only the compute balance. It looked like it was
 * polling my_perms and it never once did. Reading the store inside the
 * mergeMap costs nothing and is correct by the first tick, 3s in.
 */
export const pollMyPermsWhilePendingEpic = (action$, store) => action$
    .ofType('PAYWALL:SET_PENDING')
    .switchMap(() => {
        return Rx.Observable.interval(_pollIntervalMs)
            .take(PAYWALL_POLL_MAX_ATTEMPTS)
            .takeWhile(() => isPaywallPending(store.getState()))
            .mergeMap(() => {
                const projectId = getProjectId(store.getState());
                return Rx.Observable.of(
                    fetchComputeBalance(),
                    ...(projectId ? [fetchMyPerms(projectId, true)] : [])
                );
            })
            .concat(Rx.Observable.defer(() => (
                isPaywallPending(store.getState())
                    ? Rx.Observable.of(clearPaywallPending())
                    : Rx.Observable.empty()
            )));
    });

export const subscribeCheckoutEpic = (action$, store) => action$
    .ofType(SUBSCRIBE_CHECKOUT_REQUEST)
    .switchMap(({ purchaseType, priceId, accountOnly }) => {
        // UAT-2 — `accountOnly` (Billing tab's Subscribe): the subscription is
        // ACCOUNT-scoped, so no project rides the session — no post-payment
        // visibility flip of whichever map the user happened to be viewing.
        // The UpgradeModal path (privacy intent on THIS project) still sends
        // the project so the webhook can flip it private.
        const projectId = accountOnly ? null : getProjectId(store.getState());
        // The map being viewed — CheckoutReturnView's fallback return target
        // for project-less sessions (see createCheckoutSession).
        const returnMapId = store.getState()?.gnresource?.id || null;
        return Rx.Observable.from(anugaApi.createCheckoutSession(projectId, purchaseType, priceId, returnMapId))
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
                    autoDismiss: 5,
                    position: 'tc'
                }, 'error')
            ));
    });

export default {
    checkoutReturnEpic,
    pollMyPermsWhilePendingEpic,
    subscribeCheckoutEpic
};

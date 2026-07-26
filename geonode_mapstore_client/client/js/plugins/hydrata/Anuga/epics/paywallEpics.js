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
import {
    SUBSCRIBE_CHECKOUT_REQUEST, RECHECK_PAYMENT, SET_PAYWALL_PENDING,
    setPaywallPending, stallPaywallPending, clearPaywallPending
} from '../../Paywall/actions';
import { isPaywallPending } from '../../Paywall/reducer';
import {
    fetchComputeBalance, dismissMeterModal, SET_COMPUTE_BALANCE
} from '../../Paywall/meter/actions';
import { fetchAccountSummary, SET_ACCOUNT_SUMMARY } from '../../Paywall/account/actions';

const getProjectId = (state) => state?.anuga?.projects?.data?.id;

// TWO-PHASE POLL (TASK-2463, epic 2425 W2.8). Was a single fixed 20 x 3s = 60s
// phase, described in this comment as "comfortably longer than a normal webhook
// round trip" — which is true of a NORMAL one and was the whole problem. Stripe
// retries a failed webhook delivery on a backoff measured in minutes, and the
// budget was set to the length of the happy path, so the only customers it
// covered were the ones who never needed a poll.
//
// Phase 1 keeps the responsive 3s cadence for the first minute (the overwhelming
// majority of deliveries), then phase 2 drops to 15s for four more minutes. Five
// minutes total, 36 requests. Still HARD-CAPPED, for the reason the original
// comment gave and which has not changed: an abandoned tab (webhook lost, user
// gone) must not poll forever. What HAS changed is what happens at the cap —
// see the stall tail below; running out of attempts is no longer silence, so the
// cap no longer has to be generous enough to cover every possible delay.
export const PAYWALL_POLL_INTERVAL_MS = 3000;
export const PAYWALL_POLL_MAX_ATTEMPTS = 20;
export const PAYWALL_POLL_SLOW_INTERVAL_MS = 15000;
export const PAYWALL_POLL_SLOW_ATTEMPTS = 16;

// Test seam — lets tests shrink the poll interval so a Karma run doesn't
// have to wait out the real cadence (mirrors permsEpics.js's __setNowForTests).
// One argument shrinks BOTH phases: a seam that silently left phase 2 at 15s
// would make any exhaustion test wait four real minutes or, more likely, be
// written to assert something short of exhaustion.
let _pollIntervalMs = PAYWALL_POLL_INTERVAL_MS;
let _pollSlowIntervalMs = PAYWALL_POLL_SLOW_INTERVAL_MS;
export const __setPollIntervalForTests = (ms, slowMs) => {
    _pollIntervalMs = ms || PAYWALL_POLL_INTERVAL_MS;
    _pollSlowIntervalMs = slowMs || ms || PAYWALL_POLL_SLOW_INTERVAL_MS;
};

// Test seam — the real probe reads document.visibilityState, which a test cannot
// set. Injecting the probe keeps refreshMyPermsOnTabVisibleEpic's own logic under
// test instead of only its event wiring.
let _isDocumentVisible = () => (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
);
export const __setDocumentVisibleForTests = (fn) => {
    _isDocumentVisible = fn || (() => (
        typeof document === 'undefined' || document.visibilityState !== 'hidden'
    ));
};

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
 * Drop `?checkout=...` from the address bar once it has been acted on
 * (TASK-2486, epic 2425 W2.9).
 *
 * The module-level `_checkoutReturnHandled` guard only covers repeat INIT_ANUGA
 * within ONE page life. A RELOAD — or the customer bookmarking/sharing the URL
 * they landed on — re-reads the same marker and re-arms the whole flow on a
 * checkout that was settled minutes ago. That was survivable while the tail
 * merely marked state; it was not once the tail also raised an autoDismiss:0
 * toast, since each reload stacked another permanent one with no way to retract
 * any of them. The toast is gone (see the poll's tail), and so is the re-arm.
 *
 * `replaceState`, not `pushState`: the return redirect is not a place the
 * customer should be able to navigate BACK to. The hash is preserved explicitly
 * because it carries the MapStore route (`/catalogue/?checkout=success#/map/<id>`
 * — CheckoutReturnView.APP_MAP_ROUTE); dropping it would send the SPA home.
 * Guarded on availability so a non-browser test environment is a no-op.
 */
const _stripCheckoutMarker = () => {
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
    const { pathname = '', search = '', hash = '' } = window.location || {};
    const params = new URLSearchParams(search);
    if (!params.has('checkout')) return;
    params.delete('checkout');
    const query = params.toString();
    window.history.replaceState({}, '', `${pathname}${query ? `?${query}` : ''}${hash}`);
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
        const marker = _readCheckoutMarker();
        // Stripped whether or not it is one we act on: an unrecognised value is
        // just as capable of surviving into a bookmark.
        _stripCheckoutMarker();
        return marker;
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
 * TASK-2457 (adversarial R2) — the poll must not just STOP when it gives up.
 * It previously ran out of attempts and stopped silently, leaving the customer in
 * `pending` until they reloaded. That wave's answer was to CLEAR the overlay.
 *
 * TASK-2463 (epic 2425 W2.8) — clearing it turned out to be the wrong terminal
 * state, because the SAME wave deleted PendingSpinner. After that, a webhook
 * slower than 60s produced: no padlock (visibility never flipped), no spinner
 * (deleted), no toast, no retry affordance, and a re-stamped
 * `_lastFetchByProjectId` so even reopening the panel inside the next 30s
 * fetched nothing. A customer who had paid saw free_public and no
 * acknowledgement whatsoever. A money-path terminal state must never be silence.
 *
 * So the tail marks the overlay instead of clearing it, and the Billing tab
 * gains a re-check. TASK-2486 (W2.9) removed the sticky toast W2.8 paired with
 * it (see the tail below) and reworded the notice, because "we are still
 * confirming your purchase" is contradicted by an already-correct balance on the
 * commonest path. See Paywall/reducer.js's SET_ACCOUNT_SUMMARY case for the full
 * three-channel map of which purchase kind each clear covers.
 *
 * The tail is a `concat(defer(...))`, NOT a `finally`: it must run only
 * when the inner stream COMPLETES (attempts exhausted, or takeWhile went
 * false), never when switchMap unsubscribes it because a second SET_PENDING
 * arrived — a finally would fire on unsubscribe too and stall the overlay the
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
    .ofType(SET_PAYWALL_PENDING)
    .switchMap(() => {
        // takeWhile AFTER the concat so it ends BOTH phases, not just the fast one.
        const ticks = Rx.Observable.concat(
            Rx.Observable.interval(_pollIntervalMs).take(PAYWALL_POLL_MAX_ATTEMPTS),
            Rx.Observable.interval(_pollSlowIntervalMs).take(PAYWALL_POLL_SLOW_ATTEMPTS)
        );
        // MINIMUM FLOOR (TASK-2486, epic 2425 W2.9). The poll's lifetime used to
        // be exactly the overlay's, so ANY clear also stopped the balance refresh.
        // That made one shape strictly worse than it had been before W2.8: a
        // customer who was ALREADY subscribed and bought a credit pack has
        // `subscription.active` true in the very first summary, so the overlay
        // cleared at tick 1 and the refresh stopped ~3s in — where the 20 x 3s
        // poll that predates W2.8 would have kept reading the balance for a
        // minute and picked the pack up. The floor restores exactly that minute
        // and no more: ticks 1..PAYWALL_POLL_MAX_ATTEMPTS always run, after which
        // the overlay decides as before. It buys no extra requests on any path
        // that pre-W2.8 was not already paying for.
        //
        // Counted in a closure rather than read off the tick value because
        // `concat` restarts phase 2's interval index at 0, so the emitted value
        // is not a running count.
        let tick = 0;
        return ticks
            .takeWhile(() => {
                tick += 1;
                return tick <= PAYWALL_POLL_MAX_ATTEMPTS || isPaywallPending(store.getState());
            })
            .mergeMap(() => {
                const projectId = getProjectId(store.getState());
                return Rx.Observable.of(
                    fetchComputeBalance(),
                    // TASK-2463 (W2.8) — the summary is re-asked on every tick, not
                    // once at return. It is the only channel that confirms an
                    // account-scoped subscription (see reducer.js's
                    // SET_ACCOUNT_SUMMARY case), so asking once at t=0 — before the
                    // webhook — could only ever observe the pre-purchase state.
                    fetchAccountSummary(),
                    ...(projectId ? [fetchMyPerms(projectId, true)] : [])
                );
            })
            // NO TOAST HERE (TASK-2486, epic 2425 W2.9). W2.8 paired this marker
            // with a `show({autoDismiss: 0}, 'warning')`. There is no
            // notification-retraction path in this codebase — `grep -rn "hide("
            // js/plugins/hydrata` returns one hit, SimpleView/components/
            // primitives/Tooltip.js, unrelated — so an autoDismiss:0 toast is a
            // claim that CANNOT be taken back. On the subscription path it
            // outlived its own refutation: the webhook lands a minute later, the
            // padlock goes private, and the toast sits on screen contradicting
            // it. The marker below is state-driven and therefore self-retracting:
            // any of the three clears removes the notice with it.
            .concat(Rx.Observable.defer(() => (
                isPaywallPending(store.getState())
                    ? Rx.Observable.of(stallPaywallPending())
                    : Rx.Observable.empty()
            )));
    });

/**
 * Clear the pending overlay when the COMPUTE BALANCE goes up (TASK-2486, epic
 * 2425 W2.9) — the credit pack's only confirmation signal.
 *
 * WHY THE PACK HAD NO DETECTOR UNTIL NOW, verified in the backend rather than
 * assumed. `stripe_webhook` (apps/commerce/checkout_views.py) discriminates on
 * `metadata.purchase_type` BEFORE the subscription path and routes a
 * `credit_pack` session to `_handle_credit_pack_checkout_completed`, which
 * writes exactly one `ComputeLedgerEntry` and never touches
 * `has_paid_private_entitlement` or `Project.visibility`. The two clears that
 * existed both key on those fields — `subscription.active` in
 * AccountSummaryView IS `has_paid_private_entitlement` — so for an UNSUBSCRIBED
 * pack buyer neither could ever fire, and that is the default shape of the
 * production estate (84 owners, no Account rows, no subscriptions).
 *
 * BASELINE, and why it is adopted lazily. Checkout opens in a NEW tab (UAT-2),
 * so the tab that handles `?checkout=success` is usually a cold SPA whose
 * balance is still null when SET_PENDING fires. Treating null as zero would read
 * any existing balance as an increase and clear instantly. So: the first
 * numeric balance seen after arming becomes the baseline, and only a LATER,
 * higher reading confirms. A reading LOWER than the baseline re-baselines (a
 * debit landed mid-poll — a run dispatched from another tab), so a subsequent
 * credit is still seen as an increase rather than being masked by the dip.
 *
 * WHAT THIS CANNOT DO, stated rather than papered over: if the webhook lands
 * before the first balance read, the credit is already inside the baseline and
 * no increase is ever observable. That case falls through to the poll's terminal
 * marker, whose copy is written to be true in exactly that situation (it claims
 * only that the figures below were just re-read — never that anything is
 * missing). Distinguishing it needs a server-side "was THIS checkout session
 * processed" read, which is TASK-2486's follow-on, not this epic.
 *
 * Both SET_COMPUTE_BALANCE and SET_ACCOUNT_SUMMARY carry `data.balance` (the
 * balance and account endpoints both serialize `str(account.balance)`), and the
 * poll asks for both every tick, so watching both makes the detector fire on
 * whichever answer returns first rather than preferring one endpoint.
 */
const _numericBalance = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export const clearPendingOnBalanceIncreaseEpic = (action$, store) => action$
    .ofType(SET_PAYWALL_PENDING)
    .switchMap(() => {
        let baseline = _numericBalance(store.getState()?.anuga?.computeMeter?.balance);
        return action$
            .ofType(SET_COMPUTE_BALANCE, SET_ACCOUNT_SUMMARY)
            // The overlay may be cleared by either of the other two channels
            // first; once it is, there is nothing left to confirm and this
            // stream must not outlive it and disarm a LATER pending overlay.
            .takeWhile(() => isPaywallPending(store.getState()))
            .map((action) => _numericBalance(action?.data?.balance))
            .filter((observed) => observed !== null)
            .mergeMap((observed) => {
                if (baseline === null || observed < baseline) {
                    baseline = observed;
                    return Rx.Observable.empty();
                }
                if (observed > baseline) {
                    return Rx.Observable.of(clearPaywallPending('balance'));
                }
                return Rx.Observable.empty();
            })
            // One confirmation per armed overlay. A second increase would be a
            // different purchase, and the switchMap above re-arms for that.
            .take(1);
    });

/**
 * "Check again" on the stalled notice — re-ask every endpoint that could carry
 * the news. Forced, because permsEpics' 30s dedupe would otherwise swallow a
 * button press made within 30s of the last poll tick, which is exactly when an
 * impatient customer presses it: a re-check that silently does nothing is worse
 * than no button.
 */
export const recheckPaymentEpic = (action$, store) => action$
    .ofType(RECHECK_PAYMENT)
    .mergeMap(() => {
        const projectId = getProjectId(store.getState());
        return Rx.Observable.of(
            fetchComputeBalance(),
            fetchAccountSummary(),
            ...(projectId ? [fetchMyPerms(projectId, true)] : [])
        );
    });

/**
 * Re-read my_perms whenever the tab becomes visible again (TASK-2463 W2.8; also
 * the mechanism TASK-2483 asks for).
 *
 * TWO PROBLEMS, ONE MECHANISM. (a) The tab the customer RETURNS to: browsers
 * throttle timers in a backgrounded tab, so a poll ticking every 3s may tick far
 * less often while Stripe's page is in front — coming back to the tab should
 * re-ask immediately rather than wait out a throttled interval. (b) The tab the
 * customer STARTED from (TASK-2483): checkout opens in a NEW tab (UAT-2), so the
 * originating tab never sees `?checkout=success`, never arms `pending`, and its
 * padlock stayed stale until a reload. It does not need the poll — it needs one
 * fetch when the customer looks at it again.
 *
 * `force` only while a purchase is being confirmed. Outside that, the ordinary
 * 30s dedupe applies, so tab-flipping cannot turn into a fetch per switch. For
 * case (b) that is still sufficient: the customer was away completing a Stripe
 * checkout, which takes far longer than 30s, so the window has always expired by
 * the time they return. (If they bail out in under 30s, nothing was bought.)
 *
 * WHY NOT JUST EXTEND accountEpics.js's refreshAccountOnWindowFocusEpic, which
 * already refetches the summary + balance on window focus. Two reasons, both
 * checkable: it is gated on `accountSummary.loaded`, so it never fires in a
 * session that has not opened the Billing tab — while the padlock is on screen
 * from map load; and it fetches account-scoped endpoints, whereas my_perms is
 * project-scoped and needs the project id from the store. `visibilitychange`
 * rather than `focus` because it is the signal for "this document is being looked
 * at", and it fires for a tab that becomes visible without the window ever
 * changing focus state.
 */
export const refreshMyPermsOnTabVisibleEpic = (action$, store) => (
    typeof document === 'undefined'
        ? Rx.Observable.empty()
        : Rx.Observable.fromEvent(document, 'visibilitychange')
)
    .filter(() => _isDocumentVisible())
    .debounceTime(300)
    .map(() => ({
        projectId: getProjectId(store.getState()),
        confirming: isPaywallPending(store.getState())
    }))
    .filter(({ projectId }) => Boolean(projectId))
    .map(({ projectId, confirming }) => fetchMyPerms(projectId, confirming));

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
    clearPendingOnBalanceIncreaseEpic,
    recheckPaymentEpic,
    refreshMyPermsOnTabVisibleEpic,
    subscribeCheckoutEpic
};

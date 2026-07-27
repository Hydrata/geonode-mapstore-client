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
 *      leaving it armed forever (the overlay masks `steady`, so "pending
 *      forever" means the app never shows the answer the server already gave).
 *      Clearing reveals `steady` and nothing else — W2.5 deleted PendingSpinner,
 *      so `pending` renders no surface of its own. Acknowledging a purchase
 *      whose webhook outlived the budget is TASK-2489, NOT this epic.
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
    SUBSCRIBE_CHECKOUT_REQUEST,
    SET_PAYWALL_PENDING,
    setPaywallPending,
    clearPaywallPending,
    subscribeCheckoutSettled
} from '../../Paywall/actions';
import {
    isPaywallPending,
    getPaywallDesiredVisibility,
    getPaywallCheckoutAnchor
} from '../../Paywall/reducer';
import { SET_COMPUTE_BALANCE, fetchComputeBalance, dismissMeterModal } from '../../Paywall/meter/actions';
import { getComputeMeterState } from '../../Paywall/meter/reducer';
import { fetchAccountSummary } from '../../Paywall/account/actions';

const getProjectId = (state) => state?.anuga?.projects?.data?.id;

/*
 * ─── TASK-2489 (epic 2425 W3c): THE CHANNEL MATRIX ──────────────────────────
 *
 * This replaces the "what the clear does not solve" note that stood here through
 * W2.10. Three attempts failed by inventing a detector before establishing which
 * channel each purchase shape is observable ON. The rule the matrix establishes,
 * and which the code below enforces: A CONFIRMING CLAIM MAY ONLY BE RENDERED
 * WHERE A PER-TICK CHANNEL EXISTS TO RETRACT IT.
 *
 * | purchase shape                     | dispatched by                     | webhook writes            | per-tick channel |
 * |------------------------------------|-----------------------------------|---------------------------|------------------|
 * | credit pack (meter modal, Billing) | ComputeMeterContainer.js:27,      | purchase ledger row       | YES — /commerce/balance/ recent_entries[].created_at
 * |                                    | BillingTabContainer.js:33         | (checkout_views.py:791-796)| -> state.anuga.computeMeter.recentEntries
 * | subscription, project-scoped       | PaywallPanelContainer.js:29       | entitlement + visibility  | YES — my_perms paywall.state -> PAID_STEADY_STATES
 * | (upgrade modal)                    |                                   | flip                      | clear, Paywall/reducer.js
 * | subscription, account-scoped,      | BillingTabContainer.js:36         | entitlement only          | YES — past_due -> paid_private/paid_organization
 * | viewing a NON-public project       | (accountOnly: true)               | (checkout_views.py:133-136)| on my_perms
 * | subscription, account-scoped,      | BillingTabContainer.js:36         | entitlement only          | NO — _derive_paywall_state returns free_public
 * | viewing a PUBLIC project           |                                   |                           | before AND after (api_v2.py:795-797)
 *
 * ROW 4 IS THE NAMED RESIDUAL GAP. The entitlement surfaces only as
 * `subscription.active` on /commerce/account/, which is fetched at boot and not
 * on any tick. Its ONLY in-scope coverage is the give-up tail's single
 * fetchAccountSummary() (below): a webhook landing anywhere inside the 60s
 * window makes that read true. After 60s: nothing further until focus or
 * reload. That is recorded, not papered over with an invented detector — the
 * app cannot tell "not landed" from "landed by a channel it cannot observe",
 * and every wording that pretended otherwise was refuted by the customer's own
 * screen.
 */

/**
 * The departure record, written before the Stripe tab opens and read back by
 * whichever tab the return lands in.
 *
 * localStorage, NOT sessionStorage and NOT a module variable: checkout opens in
 * a NEW TAB (_openInNewTab below), so the tab that reads this is not the tab
 * that wrote it. One key, last-write-wins — the same semantics the buy control's
 * own in-flight guard gives the click stream.
 */
export const CHECKOUT_ANCHOR_STORAGE_KEY = 'hydrata_checkout_anchor';

// Storage access is wrapped and warned exactly like pollingEpics.js's handled-ids
// store (:761-770, :825-833): a quota/privacy block must degrade the feature, not
// break the money path.
const _warnStorage = (verb, e) => {
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(`hydrata: checkout anchor storage unavailable on ${verb}`, e);
    }
};

const _writeCheckoutAnchor = (record) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(CHECKOUT_ANCHOR_STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
        _warnStorage('write', e);
    }
};

const _readCheckoutAnchor = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(CHECKOUT_ANCHOR_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
    } catch (e) {
        _warnStorage('read', e);
        return null;
    }
};

const _clearCheckoutAnchor = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.removeItem(CHECKOUT_ANCHOR_STORAGE_KEY);
    } catch (e) {
        _warnStorage('clear', e);
    }
};

/**
 * The newest SERVER `created_at` among purchase rows in the balance window, or
 * null when it holds none.
 *
 * Never a COUNT: both commerce endpoints return only the 10 newest rows
 * (balance_views.py:29 RECENT_ENTRIES_LIMIT), so a count is not monotonic and a
 * busy account's purchase row can fall out of the window between two reads.
 */
const _newestPurchaseIso = (entries) => (Array.isArray(entries) ? entries : []).reduce(
    (newest, e) => {
        if (!e || e.entry_type !== 'purchase' || !e.created_at) return newest;
        return (newest === null || Date.parse(e.created_at) > Date.parse(newest)) ? e.created_at : newest;
    },
    null
);

/**
 * Build the anchor from the store as it stands at the moment of departure.
 *
 * `balanceObserved` is the whole reason AC3's null-anchor rule is safe. "No
 * purchase row at departure, therefore ANY purchase row later is new" holds only
 * if the empty window was FETCHED and empty. Three live shapes make it
 * never-fetched, and in each of them a month-old row would clear the notice ~3s
 * after arming — the same unearned claim as W2.8/W2.9, inverted:
 *   (a) meter dark        — balance_views.py:32-38, enabled false, balance null;
 *   (b) no billing account — balance_views.py:60-66, enabled true, balance null
 *       (and a user can be added to a pre-existing account carrying old rows
 *       between departure and return);
 *   (c) nothing fetched yet — meter/reducer.js initialState, which a Billing-tab
 *       onBuyPack can beat.
 * Only the account-present shape (balance_views.py:85-90) sets both fields, so
 * `enabled === true && balance !== null` is exactly "this window was read".
 */
const _buildCheckoutAnchor = (state, {purchaseType, accountOnly, projectId}) => {
    const meter = getComputeMeterState(state);
    return {
        purchaseType,
        accountOnly: !!accountOnly,
        projectId: projectId ?? null,
        latestPurchaseIso: _newestPurchaseIso(meter.recentEntries),
        balanceObserved: meter.enabled === true && meter.balance !== null
    };
};

/**
 * Does the balance window now hold a purchase row this checkout is responsible
 * for?
 *
 * BOTH SIDES ARE SERVER TIMESTAMPS. No Date.now(), no client clock: a browser
 * running fast would otherwise make no row ever look new and the notice would
 * never retract, which is precisely the sticky claim this task exists to
 * prevent. Date.parse here only parses two strings the server produced.
 */
const _hasPurchaseSinceAnchor = (entries, anchor) => {
    const rows = (Array.isArray(entries) ? entries : [])
        .filter((e) => e && e.entry_type === 'purchase' && e.created_at);
    if (!rows.length) return false;
    if (anchor.latestPurchaseIso) {
        const floor = Date.parse(anchor.latestPurchaseIso);
        return rows.some((e) => Date.parse(e.created_at) > floor);
    }
    // Null anchor: sound ONLY on a window that was actually read. Both endpoints
    // order -created_at, so a purchase row absent from a READ window at
    // departure and present later must be newer.
    return anchor.balanceObserved === true;
};

// Fixed-interval poll, capped — a "no polish" MVP: no backoff, just a hard
// ceiling so an abandoned tab (webhook lost, user never returns) can't poll
// forever. 20 * 3s = 60s, comfortably longer than a normal webhook round trip.
//
// A Stripe webhook RETRY is measured in minutes, so a delivery slower than 60s
// still runs the budget out. TASK-2489 did not change that ceiling and could
// not: what it changed is what the customer is told inside it (a state-driven
// notice that retracts by rendering) and what happens at the cap (the clear now
// carries one account refetch, so the panel stops showing pre-purchase money).
// See the CHANNEL MATRIX above for which shapes are observable per tick and
// which one is not.
export const PAYWALL_POLL_INTERVAL_MS = 3000;
export const PAYWALL_POLL_MAX_ATTEMPTS = 20;

// Test seam — lets tests shrink the poll interval so a Karma run doesn't
// have to wait out the real 3s cadence (mirrors permsEpics.js's __setNowForTests).
let _pollIntervalMs = PAYWALL_POLL_INTERVAL_MS;
export const __setPollIntervalForTests = (ms) => { _pollIntervalMs = ms || PAYWALL_POLL_INTERVAL_MS; };

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
 * (TASK-2486, epic 2425 W2.9; KEPT through the W2.10 revert).
 *
 * The module-level `_checkoutReturnHandled` guard only covers repeat INIT_ANUGA
 * within ONE page life. A RELOAD — or the customer bookmarking/sharing the URL
 * they landed on — re-reads the same marker and re-arms the whole flow on a
 * checkout that was settled minutes ago: a fresh 60s poll, a fresh burst of
 * forced my_perms/balance fetches, and a `pending` overlay masking `steady` for
 * a purchase that finished long ago. That is wrong independently of anything the
 * poll's tail does, which is why this survived the W2.10 revert of the
 * confirmation UX around it.
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
        // TASK-2489 — the pending overlay carries the DEPARTURE ANCHOR, lifted
        // out of localStorage here because this is the one place that knows a
        // return is being handled. The originating tab wrote it; this tab may
        // not be that tab (_openInNewTab), which is why the handover is
        // localStorage and not module state.
        ? Rx.Observable.of(
            setPaywallPending(_readCheckoutAnchor()), dismissMeterModal(),
            setMembershipPanel(true), setMembershipPanelTab('billing'), fetchAccountSummary()
        )
        // NOTE the show(opts, level) signature: level is the SECOND ARG — a
        // `level` key inside opts is overwritten by the arg's 'success'
        // default (the UAT-2 green-error-toast bug).
        // TASK-2489 — a cancelled checkout leaves no record behind: nothing is
        // confirming, so nothing should be able to claim it later.
        : Rx.Observable.defer(() => {
            _clearCheckoutAnchor();
            return Rx.Observable.of(show({
                title: 'hydrata.anuga.checkoutCancelled.title',
                message: 'hydrata.anuga.checkoutCancelled.message',
                autoDismiss: 5,
                position: 'tc'
            }, 'info'));
        })
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
 * TASK-2489 (epic 2425 W3c) — THE TAIL IS THE SOLE EMITTER OF THE POST-CHECKOUT
 * `fetchAccountSummary()`, on BOTH branches. The Billing tab the customer was
 * just sent to renders the ACCOUNT slice, not the per-tick meter slice
 * (BillingTabContainer.js) — so the fresher balance every tick already fetched
 * is invisible there, and the panel kept showing pre-purchase money over an
 * unlocked padlock. That is the live common-path defect, and this is where it is
 * closed.
 *
 * IT IS EXACTLY-ONCE BY CONSTRUCTION, which is the only reason it is allowed to
 * exist at all: the interval has COMPLETED by the time this defer runs, so there
 * are no ticks left to fire on. The obvious alternative — an epic on
 * SET_ANUGA_RESOURCE_PERMS that fetches whenever `paywall.state` is paid, the
 * natural repair given that the PAID clear lives in a reducer which cannot
 * dispatch — is FORBIDDEN: it fires every 3s for as long as the customer is
 * paid, which is precisely the per-tick account fetch `26e4aab36` reverted. It
 * passes a test written against the credit-pack path and fails the one in
 * epicsAnuga-test.js that feeds three more paid readings after the clear.
 *
 * ACCEPTED COST, stated rather than glossed: on the fast paths the refetch lands
 * at the NEXT tick, so the panel's money figure can lag the padlock by up to one
 * 3s interval. It carries no claim while it lags — the confirming notice renders
 * off the pending flag and is already gone — and it is pre-W2.8 behaviour plus a
 * bounded refresh, not worse than it.
 *
 * The clear is a `concat(defer(...))` tail, NOT a `finally`: it must run only
 * when the inner stream COMPLETES (attempts exhausted, or takeWhile went
 * false), never when switchMap unsubscribes it because a second SET_PENDING
 * arrived — a finally would fire on unsubscribe too and disarm the overlay the
 * new poll had just armed. `defer` re-reads the store at that moment, so the
 * normal success path emits the refetch alone.
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
            .concat(Rx.Observable.defer(() => {
                if (isPaywallPending(store.getState())) {
                    _clearCheckoutAnchor();
                    return Rx.Observable.of(clearPaywallPending(), fetchAccountSummary());
                }
                return Rx.Observable.of(fetchAccountSummary());
            }));
    });

/**
 * TASK-2489 (epic 2425 W3c) — clear the confirming state when the purchase the
 * customer just made actually shows up.
 *
 * THE CHANNEL, which three previous attempts got wrong. /commerce/account/ is
 * fetched at most twice per checkout and BOTH are at cold-SPA boot
 * (checkoutReturnEpic's one synchronous Observable.of, plus the Billing-tab-open
 * trigger it causes); nothing re-reads it during the 60s poll. A detector on it
 * gets ONE reading, taken at the instant the race is about, which is why AC9c
 * bans it. /commerce/balance/ is re-fetched on EVERY tick by
 * pollMyPermsWhilePendingEpic above, and its rows carry the SERVER's
 * `created_at` (balance_views.py:73-83, key `created_at` — the account endpoint's
 * key is `date`, and confusing the two is what sank the previous spec).
 *
 * WHY A TIMESTAMP AND NOT A BALANCE DIFF (W2.9's design). The webhook routinely
 * WINS: Stripe posts checkout.session.completed server-to-server in seconds,
 * while the return goes through a synchronous Session.retrieve and then a full
 * cold MapStore boot (13.6s median, permsEpics.js:18). So the credit is already
 * inside the first reading the client ever takes, and a client-side before/after
 * diff cannot see a change that happened before the client existed. An anchor
 * captured BEFORE departure, compared against a server timestamp, can.
 *
 * CREDIT PACKS ONLY, by construction. checkout_views.py has exactly one
 * ENTRY_TYPE_PURCHASE write (:791-796) and it is the credit-pack path; a
 * subscription writes no ledger row at all. Subscriptions clear on their own
 * channel — the PAID steady state in Paywall/reducer.js — and the anchor's
 * purchaseType is what keeps the two from claiming each other's purchase.
 *
 * IT EVALUATES ON SET_PAYWALL_PENDING TOO, not only on each balance tick.
 * triggerFetchBalanceOnInitEpic (computeMeterEpics.js:26) fires the first
 * balance fetch on INIT_ANUGA, which may land BEFORE this arms; without the
 * second trigger the epic would sit out a needless 3s waiting to be told
 * something the store already knows. redux-observable reduces before it emits to
 * epics (createEpicMiddleware.js:79-80), so the overlay and its anchor are both
 * in place by the time this reads them.
 *
 * IT EMITS THE CLEAR AND NOTHING ELSE. The single post-checkout
 * fetchAccountSummary() belongs to the poll tail above, which is exactly-once by
 * construction because the interval has completed; emitting one here as well
 * would make it two.
 */
export const clearPendingOnPurchaseRowEpic = (action$, store) => action$
    .ofType(SET_COMPUTE_BALANCE, SET_PAYWALL_PENDING)
    .filter(() => isPaywallPending(store.getState()))
    .filter(() => {
        const anchor = getPaywallCheckoutAnchor(store.getState());
        if (!anchor || anchor.purchaseType !== 'credit_pack') return false;
        return _hasPurchaseSinceAnchor(getComputeMeterState(store.getState()).recentEntries, anchor);
    })
    .map(() => {
        _clearCheckoutAnchor();
        return clearPaywallPending();
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
    // TASK-2441 (epic 2425 W4.2) — THE double-submit guard. Two clicks used to
    // create two live Stripe checkout sessions.
    //
    // `exhaustMap` IGNORES a source action while the inner stream is still
    // running, so the projection below is never entered for the second click
    // and `anugaApi.createCheckoutSession(...)` is never reached. That matters
    // because the call is EAGER — it fires while the projection is still
    // building its return value — which is precisely why the `switchMap` this
    // replaces was not a guard: switchMap unsubscribes the first INNER stream,
    // but by then the first POST has already left the browser AND the second
    // one has been made. Anyone who reads an unsubscribe as cancellation will
    // put switchMap back; it is not, and the money path is where that shows up.
    //
    // WHY NOT A STORE READ (`.filter(() => !isCheckoutInFlight(...))`), which is
    // what this task originally specified: redux-observable dispatches to the
    // REDUCER FIRST and to the epic second (redux-observable@0.19.0,
    // createEpicMiddleware.js:79-80 — `next(action)` then `input$.next(action)`).
    // The reducer arms checkoutInFlight on SUBSCRIBE_CHECKOUT_REQUEST, so that
    // filter sees its OWN action's flag already set and refuses the FIRST click
    // as well as the second — every buy control dead on arrival. The reducer
    // flag is still the source of truth for the UI (it is what disables the
    // controls); it just cannot also be this epic's self-guard. Verified by the
    // two-clicks test in epicsAnuga-test.js, which counts POSTs on the mock.
    //
    // RESIDUAL, deliberately not closed here: nothing client-side survives two
    // browser tabs or a reload mid-flight. CreateCheckoutSessionView.post
    // (apps/commerce/checkout_views.py:399) has no idempotency key and creates
    // the session unconditionally at :542 / :577. That is a backend task.
    .exhaustMap(({ purchaseType, priceId, accountOnly }) => {
        // UAT-2 — `accountOnly` (Billing tab's Subscribe): the subscription is
        // ACCOUNT-scoped, so no project rides the session — no post-payment
        // visibility flip of whichever map the user happened to be viewing.
        // The UpgradeModal path (privacy intent on THIS project) still sends
        // the project so the webhook can flip it private.
        const projectId = accountOnly ? null : getProjectId(store.getState());
        // The map being viewed — CheckoutReturnView's fallback return target
        // for project-less sessions (see createCheckoutSession).
        const returnMapId = store.getState()?.gnresource?.id || null;
        // W3d — the destination the live refusal was about, so the customer is
        // sold the tier they picked rather than a hardcoded 'private'. Null for
        // an account-scoped subscription (nothing is flipped) and for the
        // compute-meter pack flow. getPaywallDesiredVisibility is itself
        // project-guarded, so a refusal belonging to another project cannot
        // supply the visibility for this purchase.
        const desiredVisibility = accountOnly
            ? null
            : getPaywallDesiredVisibility(store.getState());
        return Rx.Observable.from(
            anugaApi.createCheckoutSession(projectId, purchaseType, priceId, returnMapId, desiredVisibility)
        )
            .mergeMap((response) => {
                const url = response?.data?.checkout_url;
                if (url) {
                    // TASK-2489 — THE DEPARTURE ANCHOR, written immediately
                    // before the Stripe tab opens.
                    //
                    // Position matters twice. It sits INSIDE the exhaustMap
                    // projection, which is TASK-2441's double-submit guard, so a
                    // suppressed second click can never overwrite the anchor
                    // belonging to the checkout actually in flight — that would
                    // replace latestPurchaseIso with a value read seconds later
                    // and silently widen the window in which a stale row looks
                    // new. And it sits on the URL branch, so a create that
                    // failed (no session, no purchase possible) leaves no record
                    // for a later return to adopt.
                    _writeCheckoutAnchor(
                        _buildCheckoutAnchor(store.getState(), {purchaseType, accountOnly, projectId})
                    );
                    _redirectTo(url);
                }
                // TASK-2441 — the clear is UNCONDITIONAL, on both the url and
                // the no-url branch. Two reasons it cannot be success-only or
                // error-only:
                //  - Since UAT-2 the checkout opens in a NEW TAB, so this page
                //    survives a success and nothing else would ever clear it
                //    (same fix, same reason, as requestBillingPortalEpic's
                //    setBillingPortalOpened in accountEpics.js).
                //  - The no-url branch used to emit nothing at all. With a flag
                //    added, that silence becomes a permanent lock-out of every
                //    buy control.
                // The popup-blocked fallback same-tab navigates, so its clear is
                // a harmless no-op — but the clear must not be conditional on
                // which branch ran.
                return Rx.Observable.of(subscribeCheckoutSettled());
            })
            .catch(() => Rx.Observable.of(
                show({
                    title: 'hydrata.anuga.checkoutFailed.title',
                    message: 'hydrata.anuga.checkoutFailed.message',
                    autoDismiss: 5,
                    position: 'tc'
                }, 'error'),
                // A failed create must be retryable.
                subscribeCheckoutSettled()
            ));
    });

export default {
    checkoutReturnEpic,
    pollMyPermsWhilePendingEpic,
    refreshMyPermsOnTabVisibleEpic,
    subscribeCheckoutEpic,
    clearPendingOnPurchaseRowEpic
};

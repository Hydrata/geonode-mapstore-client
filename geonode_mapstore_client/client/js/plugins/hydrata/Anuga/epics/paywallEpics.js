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
    getPaywallCheckoutAnchor,
    isAnchoredPurchaseConfirmed
} from '../../Paywall/reducer';
import { SET_COMPUTE_BALANCE, fetchComputeBalance, dismissMeterModal } from '../../Paywall/meter/actions';
import { getComputeMeterState } from '../../Paywall/meter/reducer';
import { SET_ACCOUNT_SUMMARY, fetchAccountSummary } from '../../Paywall/account/actions';

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
 * | subscription, account-scoped,      | BillingTabContainer.js:36         | entitlement only          | YES (W3c) — subscription.active on
 * | viewing a PUBLIC project           |                                   |                           | /commerce/account/, polled per tick
 *
 * ROW 4 WAS THE NAMED RESIDUAL GAP, AND W3c's ADVERSARIAL REVIEW SHOWED WHY IT
 * COULD NOT STAY ONE. `_derive_paywall_state` returns free_public for a public
 * project before AND after entitlement (apps/gn_anuga/api_v2.py:795-797), so no
 * my_perms tick can ever retract this shape's notice; meanwhile the ONE
 * /commerce/account/ read taken at boot routinely lands AFTER the webhook (the
 * return goes through a synchronous Session.retrieve plus a 13.6s median cold
 * MapStore boot), so SubscriptionSection rendered "Active since <today>"
 * directly BELOW a notice saying the confirmation had not landed — for the full
 * 60s, on the Billing tab's own Subscribe. A claim the customer's own screen
 * refutes is precisely what the operator reverted in W2.10.
 *
 * The repair is to give row 4 the per-tick channel the matrix rule demands,
 * rather than to keep making an unretractable claim: while a SUBSCRIPTION
 * anchor is pending, each poll tick also re-reads /commerce/account/. This is
 * NOT the reverted per-tick account fetch (26e4aab36) — that one fired on every
 * paid my_perms reading for as long as the customer stayed paid, unbounded. This
 * one is bounded twice over: only while `pending` (<= 20 ticks / 60s) and only
 * for the one purchase shape whose evidence lives on that endpoint. A credit
 * pack still polls only /commerce/balance/.
 *
 * `subscription.active` is EVIDENCE FOR THIS CHECKOUT, not merely correlated
 * with one: an account that already holds the entitlement is 409'd before Stripe
 * is touched at all (apps/commerce/checkout_views.py:471-476), so it cannot have
 * started this checkout.
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
 * TASK-2496 (epic 2425 W3d) — did a checkout depart from THIS TAB?
 *
 * A MODULE VARIABLE, deliberately, and not the localStorage anchor above. The
 * anchor is written for the tab the customer RETURNS to, and checkoutReturnEpic
 * reads and immediately DELETES it (:386-387) — in the return tab, because
 * `_redirectTo` is `_openInNewTab`. So it is already gone before the ORIGINATING
 * tab regains visibility, which is precisely the tab this flag is about. Being
 * per-tab is the whole point: it answers "did the customer leave THIS page for
 * Stripe", which no shared storage can answer.
 *
 * Consumed EXACTLY ONCE, by refreshMyPermsOnTabVisibleEpic below. That bounds
 * the extra request rate at one forced my_perms per checkout initiated from this
 * tab — not one per focus, which is the rate decision TASK-2483 AC2 pinned and
 * the green test at epicsAnuga-test.js's refreshMyPermsOnTabVisibleEpic describe
 * still enforces.
 */
let _checkoutDepartedFromThisTab = false;
export const __resetCheckoutDepartureForTests = () => { _checkoutDepartedFromThisTab = false; };

/** Read-and-clear. Never call this inside a `||` — see the epic below. */
const _consumeCheckoutDeparture = () => {
    const departed = _checkoutDepartedFromThisTab;
    _checkoutDepartedFromThisTab = false;
    return departed;
};

/**
 * Build the anchor recorded at the moment of departure.
 *
 * TASK-2511 (epic 2425 W3d) — THE FLOOR IS THE SERVER'S DEPARTURE TIMESTAMP,
 * `departed_at` off the create-session response. It used to be
 * `latestPurchaseIso`: the newest purchase row in whatever
 * `meter.recentEntries` held at CLICK time. That could not answer the question
 * `_hasPurchaseSinceAnchor`'s docstring claimed it answered, for two independent
 * reasons.
 *
 *   (a) The snapshot is refreshed only at boot, on window focus, and during a
 *       pending poll — so it is routinely minutes stale.
 *   (b) `resolve_account_for_user` resolves an Account SHARED by every
 *       AccountUser on it (services.py `provision_account_for_user` folds a user
 *       into the ONE Account of their earliest GroupProfile), and
 *       balance_views.py serialises EVERY row of it. On hydrata.com prod that is
 *       Account pk=1 with 47 users via `registered-members` — so "a colleague"
 *       is "every other paying customer".
 *
 * The failure that shipped: 09:00 you open the map (newest row P0, last week);
 * 09:40 a colleague buys a pack, P1 lands on the shared account, your tab never
 * refetches; 09:50 you click Buy credits with floor = P0; 09:51 the first poll
 * tick returns P1 > P0, the notice retracts ~3s in on a row that PREDATES your
 * checkout, `takeWhile` ends the poll, and your own webhook 20s later is never
 * observed. That is exactly the "panel kept showing pre-purchase money" defect
 * TASK-2489 exists to close, re-entered through a stale floor.
 *
 * A server floor makes the whole was-the-window-observed gate UNNECESSARY, so it
 * is gone along with the 37-line block that justified it. That gate existed only
 * because a client-side floor cannot distinguish "fetched and empty" from "never
 * fetched"; a departure timestamp has no such ambiguity, and nothing here reads
 * the meter slice any more.
 *
 * OPERATOR RULING 2026-07-27 recorded the two rejected alternatives so they are
 * not re-opened: (b) stamping the Stripe session id onto ComputeLedgerEntry
 * gives exact attribution but costs a column + migration + webhook write +
 * serializer, queued behind the 2491/2492 migration series; (c) an FE-only floor
 * tweak is cheapest and does NOT close the shared-Account case, which IS the
 * reported defect.
 */
const _buildCheckoutAnchor = ({purchaseType, accountOnly, projectId, departedAtIso}) => ({
    purchaseType,
    accountOnly: !!accountOnly,
    projectId: projectId ?? null,
    departedAtIso: departedAtIso ?? null
});

/**
 * Has a purchase row landed on this SHARED account since this checkout departed
 * the server?
 *
 * THAT IS EXACTLY WHAT IT ESTABLISHES — no more. The residual it does NOT close,
 * stated rather than glossed: two purchases on the SAME account inside the same
 * ~30s checkout window are still indistinguishable, because a ledger row carries
 * no reference to the session that produced it. The server floor narrows 47
 * shared users down to that; it does not eliminate it.
 *
 * BOTH SIDES ARE SERVER TIMESTAMPS. No Date.now(), no client clock: a browser
 * running fast would otherwise make no row ever look new and the notice would
 * never retract, which is precisely the sticky claim this task exists to
 * prevent. `departed_at` is `timezone.now()` in CreateCheckoutSessionView and
 * `created_at` is `ComputeLedgerEntry.created_at` (auto_now_add) serialised by
 * balance_views.py — the same app-server clock, pinned by a pytest.
 *
 * NO FLOOR MEANS NO CLAIM. A record written by a previous bundle in another tab,
 * or a hydrata backend deployed behind this gmc bundle, carries no
 * `departedAtIso` — and returns FALSE, never a clear. The consequence is bounded
 * and benign: that checkout's notice runs to the 60s cap, where the poll tail
 * still dispatches `clearPaywallPending()` AND `fetchAccountSummary()`, so the
 * panel never keeps showing pre-purchase money.
 */
const _hasPurchaseSinceAnchor = (entries, anchor) => {
    if (!anchor || !anchor.departedAtIso) return false;
    const floor = Date.parse(anchor.departedAtIso);
    return (Array.isArray(entries) ? entries : []).some(
        (e) => e && e.entry_type === 'purchase' && e.created_at && Date.parse(e.created_at) > floor
    );
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
        // W3c adversarial (correctness + staleness lenses) — THE RECORD IS
        // CONSUMED, i.e. read and immediately deleted. It had exactly three
        // deletion sites (cancel, the poll's give-up tail, the purchase-row
        // detector) and none of them covers the commonest success path: a
        // subscription that clears via the PAID steady state does so in a
        // REDUCER, which cannot dispatch and cannot reach localStorage, so the
        // record survived indefinitely. A later checkout whose own
        // _writeCheckoutAnchor throws (Safari private mode, quota — swallowed
        // by design) then inherited it, and a months-old latestPurchaseIso is a
        // floor that any purchase row clears. Deleting it HERE makes the record
        // self-limiting by construction: the store copy on the overlay is the
        // live read model from this point on, storage has no further job, and
        // ?checkout=success is stripped with replaceState so this return cannot
        // be replayed. `defer` so the read/clear happen at subscribe time, not
        // when the observable is built.
        ? Rx.Observable.defer(() => {
            const anchor = _readCheckoutAnchor();
            _clearCheckoutAnchor();
            return Rx.Observable.of(
                setPaywallPending(anchor), dismissMeterModal(),
                setMembershipPanel(true), setMembershipPanelTab('billing'), fetchAccountSummary()
            );
        })
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
 * TASK-2489 (epic 2425 W3c) — THE TAIL EMITS A `fetchAccountSummary()` ON BOTH
 * BRANCHES, and (W3c adversarial aside: for a CREDIT-PACK or anchorless pending
 * it is the only emitter — a subscription anchor additionally polls that
 * endpoint per tick, see the mergeMap above and the matrix at the top of this
 * file). The Billing tab the customer was
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
                const state = store.getState();
                const projectId = getProjectId(state);
                // W3c adversarial — the ROW-4 channel (see the matrix at the top
                // of this file). An account-scoped subscription bought while
                // viewing a PUBLIC project surfaces on NEITHER of the two reads
                // above, so without this the notice could not be retracted by
                // anything short of the 60s tail while the panel below it already
                // read "Active since today". Gated on the anchor so a credit pack
                // — whose evidence is a balance row, already fetched above —
                // does not pay for it, and bounded by `pending` so this can never
                // become the unbounded per-tick fetch 26e4aab36 reverted.
                const anchor = getPaywallCheckoutAnchor(state);
                const confirmingSubscription = anchor && anchor.purchaseType === 'subscription';
                return Rx.Observable.of(
                    fetchComputeBalance(),
                    ...(projectId ? [fetchMyPerms(projectId, true)] : []),
                    ...(confirmingSubscription ? [fetchAccountSummary()] : [])
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
 * ONE EPIC, TWO PURCHASE SHAPES, ONE CHANNEL EACH — never both. checkout_views.py
 * has exactly one ENTRY_TYPE_PURCHASE write (:791-796) and it is the credit-pack
 * path; a subscription writes no ledger row at all, so a pack's row can never
 * confirm a subscription and vice versa. The anchor's purchaseType is what keeps
 * the two from claiming each other's purchase.
 *   credit_pack   -> a purchase row newer than the departure anchor, on
 *                    /commerce/balance/ (polled every tick).
 *   subscription  -> `subscription.active` on /commerce/account/ (polled every
 *                    tick while a subscription is pending — see the matrix at
 *                    the top of this file), or the PAID steady state in
 *                    Paywall/reducer.js when a project flip is part of the deal.
 *
 * W3c adversarial (money-path CRITICAL) added the subscription branch. Before
 * it, the account-scoped-subscription-on-a-public-project shape had NO channel
 * at all: the notice ran the full 60s while SubscriptionSection, four lines
 * below it in the same panel, already read "Active since today".
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
    .ofType(SET_COMPUTE_BALANCE, SET_ACCOUNT_SUMMARY, SET_PAYWALL_PENDING)
    .filter(() => isPaywallPending(store.getState()))
    .filter(() => {
        const state = store.getState();
        const anchor = getPaywallCheckoutAnchor(state);
        if (!anchor) return false;
        if (anchor.purchaseType === 'subscription') return isAnchoredPurchaseConfirmed(state);
        if (anchor.purchaseType !== 'credit_pack') return false;
        return _hasPurchaseSinceAnchor(getComputeMeterState(state).recentEntries, anchor);
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
 * `force` while a purchase is being confirmed OR when a checkout departed from
 * THIS tab. Outside those, the ordinary 30s dedupe applies, so tab-flipping
 * cannot turn into a fetch per switch (TASK-2483 AC2's rate decision, and the
 * TASK-658 cold-start budget).
 *
 * TASK-2496 (epic 2425 W3d) — THE DEPARTURE FLAG, and why `confirming` alone was
 * never enough for case (b). `confirming` is isPaywallPending, armed ONLY by
 * checkoutReturnEpic off a `?checkout=success` marker; the originating tab never
 * sees that marker, so `confirming` is structurally FALSE there for the whole
 * life of the page.
 *
 * The justification that used to stand here measured the wrong interval: "the
 * customer was away completing a Stripe checkout, which takes far longer than
 * 30s, so the window has always expired by the time they return". permsEpics'
 * gate is keyed to the last ACTUAL FETCH IN THIS TAB, not to time away. So:
 * t=0 flip to the Stripe tab; t=60 a glance back at the map (a real, unforced
 * fetch — stamp = 60); t=80 pay, t=82 the webhook lands; t=85 return, 85-60 =
 * 25s < 30s, `Rx.Observable.empty()`, no HTTP, no action, no log. Nothing else
 * recurs on this endpoint: refreshAccountOnWindowFocusEpic is account-scoped and
 * gated on accountSummary.loaded, and triggerFetchMyPermsOnInitEpic ends in
 * distinctUntilChanged. The customer who has paid keeps seeing an unpaid padlock
 * until a focus that happens to land more than 30s after that stamp.
 *
 * RATE CONSEQUENCE, exactly: at most ONE extra forced my_perms per checkout
 * initiated from this tab, because the flag is read-and-cleared (see
 * `_consumeCheckoutDeparture`). Not one per focus.
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
    .map(({ projectId, confirming }) => {
        // TASK-2496 — CONSUMED HERE, i.e. AFTER the projectId filter above, and
        // never in the `.map` that computes `confirming`. That earlier map runs
        // on every visible transition including ones that emit no action (no
        // project loaded yet), so consuming there burns the flag on a
        // visibilitychange that goes nowhere and the forced refetch is lost.
        //
        // On its OWN LINE, then OR'd. `confirming || _consumeCheckoutDeparture()`
        // short-circuits, leaving the flag set whenever a confirmation is already
        // in flight — after which behaviour becomes order-dependent.
        const departed = _consumeCheckoutDeparture();
        return fetchMyPerms(projectId, confirming || departed);
    });

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
    // WHAT THIS GUARD DOES NOT COVER, AND WHAT NOW DOES (TASK-2510). Nothing
    // client-side survives two browser tabs or a reload mid-flight, and since
    // UAT-2 the checkout opens in a NEW tab — so this page stays alive with
    // every buy control re-enabled while the customer is still on Stripe. That
    // window is closed on the SERVER: CreateCheckoutSessionView now records an
    // `OpenCheckoutSession` (commerce/models.py) keyed on the purchase
    // discriminators, and a second create-session POST inside
    // CHECKOUT_SESSION_REUSE_WINDOW is handed back the SAME session while
    // Stripe still reports it `open` — never a second live one, and never a
    // consumed URL for a legitimate repeat purchase.
    //
    // `exhaustMap` is still the right operator and is NOT redundant: it is what
    // stops a double click costing two create-session round trips at all, and
    // it is the only thing scoping the departure anchor written below to the
    // checkout actually in flight. The two guards are orthogonal — this one is
    // per-click within one page, that one is per-account across tabs.
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
                // TASK-2511 — the SERVER's departure timestamp, read alongside
                // the url and carried into the anchor VERBATIM. Absent when a
                // hydrata backend predating this bundle answers; the compare
                // side then makes no claim at all (see _hasPurchaseSinceAnchor).
                const departedAtIso = response?.data?.departed_at;
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
                        _buildCheckoutAnchor({purchaseType, accountOnly, projectId, departedAtIso})
                    );
                    // TASK-2496 — the customer is leaving THIS tab for Stripe.
                    // Same branch and same reasons as the anchor above: inside
                    // the exhaustMap projection so a suppressed second click
                    // cannot arm it twice, and on the URL branch only, so a
                    // create that failed (nothing to pay for, nothing left the
                    // tab) does not buy a forced refetch.
                    _checkoutDepartedFromThisTab = true;
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

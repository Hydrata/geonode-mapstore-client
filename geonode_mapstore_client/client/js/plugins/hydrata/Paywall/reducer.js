/**
 * Paywall reducer (TASK-2099, epic 2092 W4.1). Mounted at state.anuga.paywall
 * (see Anuga/reducersAnuga.js) — the paywall block is per-project, keyed off
 * the same Anuga project context as everything else in that tree.
 *
 * Two-layer shape:
 *   steady  — the last `paywall` block from my_perms (free_public /
 *             paid_private / past_due). Written by SET_ANUGA_RESOURCE_PERMS.
 *   overlay — FE-only ephemeral state my_perms never emits (upgrade_prompt,
 *             pending). Takes precedence over `steady` while set. `pending` is
 *             armed by a ?checkout=success return and disarmed either by a PAID
 *             steady arriving (below) or by the poll giving up after 60s. It
 *             renders NO surface of its own — W2.5 deleted PendingSpinner — so
 *             it is a mask on `steady`, nothing more. W2.8/W2.9 added a
 *             `stalled` sub-state and two extra confirmation channels here; the
 *             operator reverted all of it on 2026-07-26 (W2.10) and the problem
 *             it was aimed at — acknowledging a webhook slower than the poll —
 *             is TASK-2489. Do not re-add a detector to this slice.
 *
 * getEffectivePaywallPayload resolves the two into the single payload shape
 * PaywallPanel expects ({state, checkout_url, read_only}).
 *
 * IMPORTANT: SET_ANUGA_RESOURCE_PERMS's payload also contains `my_role`,
 * `visibility`, and per-resource-type perms dicts — Anuga/reducers/
 * resourcesReducer.js's generic merge loop must SKIP the `paywall` key (it is
 * an object, not an {id: perms} map, so without an explicit skip it silently
 * corrupts into resources.paywall = []). See _NON_RESOURCE_KEYS there.
 */
import { SET_ANUGA_RESOURCE_PERMS } from '../Anuga/actionsAnuga';
// The "is this stamp about the project on screen?" rule, in one place — this
// file used to carry its own copy. Paywall/selectors.js already reads from
// selectorsAnuga, so the direction is established.
import { describesLoadedProject } from '../Anuga/selectorsAnuga';
// W3c adversarial — the account summary is READ here (never written), so the
// confirming notice cannot outlive the evidence rendered beneath it.
// account/reducer.js imports only its own actions, so this is not a cycle.
import { getAccountSummaryState } from './account/reducer';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING,
    SUBSCRIBE_CHECKOUT_REQUEST,
    SUBSCRIBE_CHECKOUT_SETTLED
} from './actions';

/**
 * The steady literals that mean "the subscription landed" — i.e. the pending
 * overlay has done its job and must disarm.
 *
 * TASK-2457 (adversarial R2, epic 2425 W2.5): this was the bare string
 * 'paid_private'. `paid_organization` — the state W2 itself added — never
 * matched, so a customer WHO HAD PAID sat on a permanent, undismissable
 * "Confirming your subscription…" until they reloaded.
 *
 * The contract doc had retracted this finding on the grounds that the webhook
 * (commerce/checkout_views.py) hardcodes the flip to PRIVATE, so paid_private
 * always matches. That is true for the checkout path and false as a general
 * claim: this clear runs on EVERY my_perms read, not only post-checkout, and
 * an already-organization project on an entitled account reads back
 * paid_organization. Derive from the list, never re-inline a literal.
 */
const PAID_STEADY_STATES = ['paid_private', 'paid_organization'];

const initialState = {
    steady: null,
    overlay: null,
    // TASK-2463 (epic 2425 W2.7) — which project `steady` DESCRIBES, or null when
    // the writing action carried no identity. See getPaywallSteady below.
    steadyProjectId: null,
    // W3d — the same stamp for `overlay`. W2.7 stamped `steady` only, and
    // getEffectivePaywallPayload reads `overlay` FIRST, so the guard was
    // short-circuited exactly when an overlay existed. See below.
    overlayProjectId: null,
    // TASK-2441 (epic 2425 W4.2) — a create-session POST is on the wire. Read
    // by subscribeCheckoutEpic's double-submit filter and by every buy control.
    // ACCOUNT-scoped on purpose, and deliberately NOT stamped with a project:
    // the Billing tab's Subscribe is `accountOnly` and rides no project at all
    // (BillingTabContainer.js -> paywallEpics.js), so a project-guarded flag
    // would silently never arm for the one control that commits to $100/mo.
    checkoutInFlight: false
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_RESOURCE_PERMS: {
        const paywall = action.payload && action.payload.paywall;
        if (!paywall) return state;
        // The backend never emits `pending` (see paywallContract.js
        // _meta.note_on_pending) — the poll epic is watching for the webhook
        // flip to show up as a steady PAID state, at which point the FE-only
        // pending overlay has done its job and clears itself.
        //
        // W3c adversarial (money-path + correctness lenses) — NOT for a CREDIT
        // PACK. This clear was written for subscriptions, where a paid steady
        // state IS the purchase landing. A credit pack changes no entitlement,
        // so for an ALREADY-ENTITLED customer on a private project
        // `_derive_paywall_state` returns paid_private on every tick before and
        // after the purchase (apps/gn_anuga/api_v2.py:727). The first my_perms
        // read then disarmed the overlay on evidence that said nothing about the
        // pack: the notice retracted ~3s in, takeWhile ended the poll, and
        // TASK-2489's purchase-row detector — the ONLY channel that can observe
        // a pack — never got to fire. The customer was left reading
        // pre-purchase money with no notice up to say so, which is the live
        // defect 2489 exists to close. The anchor's purchaseType is what keeps
        // the two purchase shapes from claiming each other's evidence
        // (paywallEpics.js), and it has to be enforced on BOTH sides of that
        // sentence, not just the epic's.
        //
        // An overlay with NO anchor still clears here exactly as before: no
        // anchor means no detector, so this and the 60s tail are all there is.
        const anchor = state.overlay && state.overlay.anchor;
        const overlay = (state.overlay && state.overlay.state === 'pending'
            && PAID_STEADY_STATES.includes(paywall.state)
            && anchor?.purchaseType !== 'credit_pack')
            ? null
            : state.overlay;
        // Stamp the project this payload describes. `?? null` normalises the
        // no-identity case to a single value so getPaywallSteady has one thing
        // to test for.
        return {
            ...state,
            steady: paywall,
            steadyProjectId: action.projectId ?? null,
            overlay
        };
    }
    case SET_PAYWALL_UPGRADE_PROMPT:
        return {
            ...state,
            overlay: {
                state: 'upgrade_prompt',
                checkout_url: action.checkoutUrl,
                read_only: false,
                // W3d — the destination the customer was refused, carried through
                // to the checkout so they are sold the tier they picked.
                visibility: action.visibility ?? null
            },
            overlayProjectId: action.projectId ?? null
        };
    case DISMISS_PAYWALL_UPGRADE:
        return (state.overlay && state.overlay.state === 'upgrade_prompt')
            ? { ...state, overlay: null, overlayProjectId: null }
            : state;
    // TASK-2489 (epic 2425 W3c) — the overlay carries the DEPARTURE ANCHOR, the
    // record written to localStorage before the Stripe tab opened and lifted
    // back out by checkoutReturnEpic. It is inert data in this slice: nothing
    // here reads it, and no action other than this one can put it there. It
    // exists so (a) clearPendingOnPurchaseRowEpic has a server timestamp to
    // compare against without re-reading storage every 3s, and (b) the Billing
    // tab's confirming notice has a pure store read to render from. Because it
    // lives ON the overlay it dies with it, so a clear can never leave a stale
    // anchor behind for a later checkout to adopt.
    case SET_PAYWALL_PENDING:
        return {
            ...state,
            overlay: {
                state: 'pending', checkout_url: null, read_only: false, visibility: null,
                anchor: action.anchor ?? null
            },
            overlayProjectId: null
        };
    // TASK-2457 — the poll gave up. Clear ONLY a pending overlay, so this can
    // never eat an upgrade_prompt refusal that armed while the poll was
    // running (same narrowness as DISMISS_PAYWALL_UPGRADE above).
    //
    // W2.8 added a `stalled` marker here and W2.9 a SET_ACCOUNT_SUMMARY channel
    // beside it; the operator reverted both on 2026-07-26 (W2.10). The asymmetry
    // those were reaching for is real: an ACCOUNT-scoped subscription (Billing
    // tab "Subscribe" passes accountOnly, so no project rides the session)
    // grants the entitlement without flipping any project, and a credit pack
    // writes only a ComputeLedgerEntry — so neither reliably produces a paid
    // PROJECT steady state, and this reducer alone cannot tell "the purchase has
    // not landed" from "it landed by a channel this slice cannot observe".
    //
    // TASK-2489 answered that by moving the question OUT of this slice rather
    // than adding another rule to it: a DEPARTURE ANCHOR captured before the
    // Stripe tab opens gives an epic something to compare server timestamps
    // against. There are now three ways out, all of them named in
    // paywallEpics.js's channel matrix — the PAID clear above, this action (via
    // clearPendingOnPurchaseRowEpic on either purchase shape's own channel, or
    // the poll's give-up tail), and nothing else. Do not re-add a detector here.
    case CLEAR_PAYWALL_PENDING:
        return (state.overlay && state.overlay.state === 'pending')
            ? { ...state, overlay: null, overlayProjectId: null }
            : state;
    // TASK-2441 — checkout in-flight, armed on the click and cleared by the
    // epic on EVERY branch of the round-trip. Mirrors the shipped
    // REQUEST_BILLING_PORTAL -> portalLoading pair in account/reducer.js.
    case SUBSCRIBE_CHECKOUT_REQUEST:
        return { ...state, checkoutInFlight: true };
    case SUBSCRIBE_CHECKOUT_SETTLED:
        return { ...state, checkoutInFlight: false };
    default:
        return state;
    }
};

/**
 * The server steady state, but ONLY if it describes the project now loaded.
 *
 * TASK-2463 (epic 2425 W2.7) — mirrors projectsReducer.js:75's guard, which W2.6
 * added for `visibility` and which left this half of the same payload
 * unprotected. After an SPA nav A -> B, a late my_perms for A was REFUSED for
 * visibility and still ACCEPTED for paywall.steady, so the padlock could render
 * B's visibility next to A's lapse — "Private (subscription lapsed)" where the
 * lapse belongs to a project the user is no longer looking at, i.e. a billing
 * claim about the wrong thing. Asymmetry introduced by W2.6, closed here.
 *
 * WHY THE GUARD IS A READ AND NOT A REDUCER REFUSAL, unlike projectsReducer's.
 * The paywall slice is mounted through combineReducers (Anuga/reducersAnuga.js),
 * so this reducer sees only its own slice and cannot know which project is
 * loaded. The information exists at selector level, so the comparison lives
 * there, against the stamp the reducer records.
 *
 * WHY AN UNSTAMPED PAYLOAD IS ACCEPTED, unlike projectsReducer's. There, a
 * refusal is fail-SAFE: `visibility` has another writer (the project fetch) and
 * skipping the fold keeps the last good value. Here SET_ANUGA_RESOURCE_PERMS is
 * the ONLY writer of `steady`, so refusing an unstamped payload would discard
 * the paywall state outright — fail-DANGEROUS. So: refuse only a stamp that
 * positively disagrees with a known loaded project.
 *
 * NOT COVERED, deliberately: the pending-overlay clear above still acts on an
 * unstamped or mismatched payload, so a late paid_* for A can disarm a `pending`
 * armed for B. That needs the current project id at reduce time, which this
 * reducer has no access to, so it is not folded in here on speculation.
 *
 * W3c adversarial — THE COST OF THAT IS NO LONGER "a spinner clearing early",
 * which is what this paragraph used to say and what was true when `pending`
 * rendered nothing (W2.5 deleted PendingSpinner). Since TASK-2489 the flag also
 * gates the Billing tab's confirming notice, the 3s poll and the tail's account
 * refetch, so an early clear now means a purchase stops being watched for. The
 * credit-pack half of that is closed above (the anchor gate); the cross-project
 * half is bounded by the same 60s cap and is filed rather than guessed at.
 */
export const getPaywallSteady = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice || !slice.steady) return null;
    return describesLoadedProject(state, slice.steadyProjectId) ? slice.steady : null;
};

/**
 * TASK-2441 — is a checkout-session create on the wire right now?
 *
 * Null-safe in the same shape as getPaywallSteady above: an absent slice reads
 * `false`. Several epic-test stores mount `anuga` with no `paywall` key at all
 * (epicsAnuga-test.js storeWithProjectId), and this selector is read on every
 * SUBSCRIBE_CHECKOUT_REQUEST, so an unguarded read would throw inside the epic.
 *
 * NOT routed through describesLoadedProject — see initialState.checkoutInFlight
 * for why the flag is account-scoped rather than project-scoped.
 */
export const isCheckoutInFlight = (state) =>
    !!(state && state.anuga && state.anuga.paywall && state.anuga.paywall.checkoutInFlight);

/**
 * The overlay, but ONLY if it describes the project now loaded.
 *
 * W3d — W2.7 stamped `steady` and guarded it in getPaywallSteady, but
 * getEffectivePaywallPayload reads `overlay` FIRST, so the guard was
 * short-circuited precisely when an overlay existed. `upgrade_prompt` is the
 * overlay that matters: it is the only one rendering a live CTA, and unlike
 * `pending` it has never been covered.
 *
 * WHY IT SURVIVES A NAV AT ALL. The upgrade modal is ModalHost-backdropped and
 * deliberately NOT dismiss-on-click (ModalHost.js), and the slice is not reset
 * on an SPA route change — so a refusal armed on project A is still mounted
 * when the user reaches project B, and PaywallPanelContainer re-renders it.
 *
 * WHY IT WAS A MONEY BUG, not just a stale modal. `onSubscribeClick` dispatches
 * SUBSCRIBE_CHECKOUT_REQUEST with no project; subscribeCheckoutEpic resolves
 * getProjectId at CLICK time. So clicking Subscribe on A's stale refusal opened
 * a checkout for B and the webhook privatised B — a project the customer was
 * never refused on and never asked to change.
 *
 * An UNSTAMPED overlay is accepted, matching getPaywallSteady: refuse only a
 * stamp that positively disagrees with a known loaded project.
 */
const getPaywallOverlay = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice || !slice.overlay) return null;
    return describesLoadedProject(state, slice.overlayProjectId) ? slice.overlay : null;
};

/** Resolves the single payload PaywallPanel renders from, or null. */
export const getEffectivePaywallPayload = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice) return null;
    return getPaywallOverlay(state) || getPaywallSteady(state) || null;
};

/**
 * The destination visibility a live, project-matched refusal was about, or null.
 *
 * Read at Subscribe-click time so the checkout buys the tier the customer
 * chose. Routed through getPaywallOverlay rather than the raw slice so a
 * refusal belonging to another project can never supply the visibility for
 * this one's purchase.
 */
export const getPaywallDesiredVisibility = (state) => {
    const overlay = getPaywallOverlay(state);
    return (overlay && overlay.state === 'upgrade_prompt' && overlay.visibility) || null;
};

/** True while the FE-only post-checkout poll should keep running. */
export const isPaywallPending = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    return !!(slice && slice.overlay && slice.overlay.state === 'pending');
};

/**
 * TASK-2489 — the departure anchor of the checkout THIS overlay is confirming,
 * or null.
 *
 * Deliberately gated on `pending`: the anchor is meaningless once the overlay is
 * gone, and reading it through this selector means a caller cannot accidentally
 * treat a leftover value as live. Null-safe in the same shape as the selectors
 * above (several epic-test stores mount `anuga` with no `paywall` key at all).
 */
export const getPaywallCheckoutAnchor = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice || !slice.overlay || slice.overlay.state !== 'pending') return null;
    return slice.overlay.anchor || null;
};

/**
 * W3c adversarial (money-path CRITICAL) — is the anchored purchase ALREADY
 * CONFIRMED by something this store is rendering elsewhere?
 *
 * The Billing tab put "Confirming your purchase… this panel updates on its own"
 * directly above a SubscriptionSection reading "Active since 2026-07-27", for
 * the full 60s poll, on the Billing tab's own Subscribe. That is the W2.8/W2.9
 * failure the operator reverted — a claim the customer's own screen refutes —
 * and it came back for one purchase shape (account-scoped subscription bought
 * while viewing a PUBLIC project: `_derive_paywall_state` returns free_public
 * before AND after entitlement, so the PAID-steady clear can never fire).
 *
 * `subscription.active` is unambiguous EVIDENCE FOR THIS CHECKOUT, not merely
 * correlated with it: `_create_subscription_session` 409s an account that
 * already has the entitlement (apps/commerce/checkout_views.py:471-476), so a
 * subscription checkout cannot even be STARTED by an active account. Active
 * after a subscription return therefore means this one landed.
 *
 * It is a RETRACTION, never an arming condition — paywallEpics.js explains why
 * /commerce/account/ cannot ARM anything (AC9c: one reading, taken at the
 * instant the race is about). Refusing to make a claim the store already
 * contradicts needs no such freshness: the worst case is silence.
 *
 * Credit packs are deliberately absent: their evidence is a purchase ROW, which
 * clearPendingOnPurchaseRowEpic already reads, and the account summary carries
 * no departure baseline to compare a balance against.
 */
export const isAnchoredPurchaseConfirmed = (state) => {
    const anchor = getPaywallCheckoutAnchor(state);
    if (!anchor || anchor.purchaseType !== 'subscription') return false;
    const account = getAccountSummaryState(state);
    return !!(account.loaded && account.subscription && account.subscription.active);
};

/**
 * TASK-2489 — should the Billing tab render its confirming notice?
 *
 * `pending` armed AND a departure anchor for it. Both halves matter. Without
 * `pending` there is nothing to confirm. Without an anchor there is no channel
 * that can retract the claim — the AC1 matrix rule is that a confirming claim
 * may only be rendered where a per-tick observation exists to withdraw it — so
 * a storage-blocked browser falls back to the pre-W2.8 silence rather than to a
 * notice nothing can take down. The notice therefore disappears BY RENDERING,
 * with no retraction call; there is no notification-retraction path in this
 * codebase, which is what made W2.8's autoDismiss:0 toast unwithdrawable.
 *
 * W3c adversarial — AND NOT ALREADY REFUTED. The epic clear runs one dispatch
 * behind the evidence that triggers it, and React is free to paint in between;
 * gating the notice on the same store value the panel below it renders makes
 * the contradiction unrenderable rather than merely short-lived. See
 * isAnchoredPurchaseConfirmed above.
 */
export const isPaywallConfirming = (state) =>
    !!getPaywallCheckoutAnchor(state) && !isAnchoredPurchaseConfirmed(state);

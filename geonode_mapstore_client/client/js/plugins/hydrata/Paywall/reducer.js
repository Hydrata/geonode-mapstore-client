/**
 * Paywall reducer (TASK-2099, epic 2092 W4.1). Mounted at state.anuga.paywall
 * (see Anuga/reducersAnuga.js) — the paywall block is per-project, keyed off
 * the same Anuga project context as everything else in that tree.
 *
 * Two-layer shape:
 *   steady  — the last `paywall` block from my_perms (free_public /
 *             paid_private / past_due). Written by SET_ANUGA_RESOURCE_PERMS.
 *   overlay — FE-only ephemeral state my_perms never emits (upgrade_prompt,
 *             pending). Takes precedence over `steady` while set. A `pending`
 *             overlay also carries `stalled` (TASK-2463, W2.8): the poll has run
 *             its full budget without OBSERVING the purchase land, so the Billing
 *             tab swaps "Confirming your purchase…" for a re-check plus a line
 *             saying when the figures below were last read. `stalled` names the
 *             POLL's outcome, not the customer's money — the app cannot tell a
 *             missing webhook from one it simply had no channel to see, so
 *             neither the flag nor the copy claims anything is outstanding
 *             (TASK-2486, W2.9). It is NOT cleared into nothing — see actions.js.
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
// TASK-2463 (W2.8) — the account summary is the ONLY channel that can confirm an
// ACCOUNT-scoped purchase (Billing tab "Subscribe", `accountOnly`), which never
// produces a paid PROJECT steady state. See the pending-clear below.
import { SET_ACCOUNT_SUMMARY } from './account/actions';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    STALL_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING
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
    steadyProjectId: null
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
        const overlay = (state.overlay && state.overlay.state === 'pending'
            && PAID_STEADY_STATES.includes(paywall.state))
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
            overlay: { state: 'upgrade_prompt', checkout_url: action.checkoutUrl, read_only: false }
        };
    case DISMISS_PAYWALL_UPGRADE:
        return (state.overlay && state.overlay.state === 'upgrade_prompt')
            ? { ...state, overlay: null }
            : state;
    case SET_PAYWALL_PENDING:
        // `stalled` is FE-only sub-state of the FE-only `pending` state, NOT a new
        // contract literal: paywall_contract.json is frozen at 7 states with a
        // pinned hash (paywallContractHash-test.js), and "the poll gave up" is not
        // something the backend has any view on. Keeping `state: 'pending'` means
        // every existing consumer — PaywallPanel's switch, isPaywallPending, the
        // PAID clear above — keeps working unchanged.
        return { ...state, overlay: { state: 'pending', stalled: false, checkout_url: null, read_only: false } };
    // TASK-2463 (W2.8) — the poll ran its full budget without seeing the purchase
    // land. Marks the overlay stalled rather than clearing it: see
    // STALL_PAYWALL_PENDING in actions.js for why TASK-2457's clear became the
    // wrong answer once W2.5 deleted the thing that rendered `pending`.
    //
    // Acts ONLY on a pending overlay, so it can never touch an upgrade_prompt
    // refusal that armed while the poll was running (same narrowness as
    // DISMISS_PAYWALL_UPGRADE above), and it is idempotent.
    case STALL_PAYWALL_PENDING:
        return (state.overlay && state.overlay.state === 'pending' && !state.overlay.stalled)
            ? { ...state, overlay: { ...state.overlay, stalled: true } }
            : state;
    // TASK-2486 (W2.9) — the THIRD confirmation channel, and the one that
    // covers the credit pack: the compute balance went up. Dispatched by
    // clearPendingOnBalanceIncreaseEpic, which is where the previous balance is
    // observable (see actions.js's CLEAR_PAYWALL_PENDING).
    //
    // Narrow, like the two clears above it: acts only on a pending overlay, so a
    // balance increase during an unrelated upgrade_prompt cannot dismiss the
    // refusal the user is looking at.
    case CLEAR_PAYWALL_PENDING:
        return (state.overlay && state.overlay.state === 'pending')
            ? { ...state, overlay: null }
            : state;
    // TASK-2463 (W2.8) — the SECOND way a purchase can be confirmed, and without
    // it the honest-stall change above would have created a new permanent lie.
    //
    // The pending overlay is armed by ANY `?checkout=success` return, and it
    // covers three purchase kinds. Each now has exactly one detector, and the
    // three are checked here in one place because their asymmetry is the thing
    // that keeps being got wrong:
    //   * privacy subscription WITH a project on the session -> the webhook sets
    //     the entitlement AND flips visibility (commerce/checkout_views.py
    //     _grant_entitlement_and_flip_project), so my_perms answers
    //     paid_private/paid_organization. Cleared by SET_ANUGA_RESOURCE_PERMS
    //     above — and also by the rule below, whichever arrives first.
    //   * ACCOUNT-scoped subscription (Billing tab "Subscribe" passes
    //     accountOnly, so no project rides the session — see subscribeCheckoutEpic)
    //     -> the same webhook grants the entitlement but flips nothing, because
    //     there is no project on the session. my_perms keeps answering
    //     free_public for good. THIS case is what the rule below closes.
    //   * credit pack -> `purchase_type=credit_pack` is discriminated BEFORE the
    //     subscription path (checkout_views.py stripe_webhook) and routed to
    //     _handle_credit_pack_checkout_completed, which writes ONE
    //     ComputeLedgerEntry and touches has_paid_private_entitlement nowhere.
    //     So `subscription.active` below can NEVER go true for it, and neither
    //     can a paid project state. Its only signal is the BALANCE, which this
    //     reducer cannot see: cleared by CLEAR_PAYWALL_PENDING above (TASK-2486,
    //     W2.9). Before that clear existed, an UNSUBSCRIBED pack buyer — the
    //     default shape of the production estate — could not be confirmed by any
    //     rule in this file and always ran the poll to exhaustion.
    //
    // `subscription.active` IS `Account.has_paid_private_entitlement`
    // (commerce/account_views.py AccountSummaryView) — the same field the
    // subscription webhook writes and `customer.subscription.deleted` revokes.
    // It is a SUBSCRIPTION flag, not a "money arrived" flag; reading it as the
    // latter is what left the pack buyer with no detector.
    //
    // NOT A TRANSITION CHECK, deliberately: this clears on `active` being true,
    // not on it going false -> true. When the webhook BEATS the return — the
    // common case — the first summary already reads active and no transition is
    // ever observable, so a transition check would strand a subscription that
    // landed perfectly. The cost that used to carry (an already-subscribed
    // customer buying a pack cleared at tick 1 and stopped the poll's balance
    // refresh with it) is gone: pollMyPermsWhilePendingEpic now runs a minimum
    // floor of PAYWALL_POLL_MAX_ATTEMPTS ticks regardless of this clear.
    case SET_ACCOUNT_SUMMARY: {
        const active = !!(action.data && action.data.subscription && action.data.subscription.active);
        return (active && state.overlay && state.overlay.state === 'pending')
            ? { ...state, overlay: null }
            : state;
    }
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
 * reducer has no access to; the failure mode is a spinner clearing early rather
 * than a wrong billing claim, so it is not folded in here on speculation.
 */
export const getPaywallSteady = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice || !slice.steady) return null;
    const stamped = slice.steadyProjectId;
    const loaded = state.anuga.projects && state.anuga.projects.data
        && state.anuga.projects.data.id;
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (stamped != null && loaded != null && stamped !== loaded) return null;
    return slice.steady;
};

/** Resolves the single payload PaywallPanel renders from, or null. */
export const getEffectivePaywallPayload = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice) return null;
    return slice.overlay || getPaywallSteady(state) || null;
};

/** True while the FE-only post-checkout poll should keep running. */
export const isPaywallPending = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    return !!(slice && slice.overlay && slice.overlay.state === 'pending');
};

/**
 * TASK-2463 (W2.8) — what the Billing tab should say about a purchase in flight:
 * `null` (nothing in flight), `{stalled: false}` (polling), `{stalled: true}`
 * (the poll's budget is spent and we still have not seen it land).
 *
 * Deliberately NOT two booleans. A caller holding `pending` and `stalled`
 * separately can render both messages, or neither, and both mistakes are silent.
 */
export const getPaywallConfirming = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    const overlay = slice && slice.overlay;
    if (!overlay || overlay.state !== 'pending') return null;
    return { stalled: !!overlay.stalled };
};

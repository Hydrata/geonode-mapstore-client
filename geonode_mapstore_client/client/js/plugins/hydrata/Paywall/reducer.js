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
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
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
    steadyProjectId: null,
    // W3d — the same stamp for `overlay`. W2.7 stamped `steady` only, and
    // getEffectivePaywallPayload reads `overlay` FIRST, so the guard was
    // short-circuited exactly when an overlay existed. See below.
    overlayProjectId: null
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
    case SET_PAYWALL_PENDING:
        return {
            ...state,
            overlay: { state: 'pending', checkout_url: null, read_only: false, visibility: null },
            overlayProjectId: null
        };
    // TASK-2457 — the poll gave up. Clear ONLY a pending overlay, so this can
    // never eat an upgrade_prompt refusal that armed while the poll was
    // running (same narrowness as DISMISS_PAYWALL_UPGRADE above).
    //
    // THE ONLY OTHER WAY OUT is the PAID clear in SET_ANUGA_RESOURCE_PERMS
    // above. W2.8 added a `stalled` marker here and W2.9 a SET_ACCOUNT_SUMMARY
    // channel beside it; the operator reverted both on 2026-07-26 (W2.10). The
    // asymmetry those were reaching for is real and is written down in
    // TASK-2489: an ACCOUNT-scoped subscription (Billing tab "Subscribe" passes
    // accountOnly, so no project rides the session) grants the entitlement
    // without flipping any project, and a credit pack writes only a
    // ComputeLedgerEntry — so neither ever produces a paid PROJECT steady state
    // and the poll runs to exhaustion for both. What no rule in this file can
    // do is tell "the purchase has not landed" from "it landed by a channel
    // this slice cannot observe", which is why every client-side attempt so far
    // has rendered a claim the customer's own screen refutes. TASK-2489 closes
    // it server-side.
    case CLEAR_PAYWALL_PENDING:
        return (state.overlay && state.overlay.state === 'pending')
            ? { ...state, overlay: null, overlayProjectId: null }
            : state;
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
    const stamped = slice.overlayProjectId;
    const loaded = state.anuga.projects && state.anuga.projects.data
        && state.anuga.projects.data.id;
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (stamped != null && loaded != null && stamped !== loaded) return null;
    return slice.overlay;
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

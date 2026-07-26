/**
 * Paywall reducer (TASK-2099, epic 2092 W4.1). Mounted at state.anuga.paywall
 * (see Anuga/reducersAnuga.js) — the paywall block is per-project, keyed off
 * the same Anuga project context as everything else in that tree.
 *
 * Two-layer shape:
 *   steady  — the last `paywall` block from my_perms (free_public /
 *             paid_private / past_due). Written by SET_ANUGA_RESOURCE_PERMS.
 *   overlay — FE-only ephemeral state my_perms never emits (upgrade_prompt,
 *             pending). Takes precedence over `steady` while set.
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
        return { ...state, overlay: { state: 'pending', checkout_url: null, read_only: false } };
    // TASK-2457 — the poll gave up. Clear ONLY a pending overlay, so this can
    // never eat an upgrade_prompt refusal that armed while the poll was
    // running (same narrowness as DISMISS_PAYWALL_UPGRADE above).
    case CLEAR_PAYWALL_PENDING:
        return (state.overlay && state.overlay.state === 'pending')
            ? { ...state, overlay: null }
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

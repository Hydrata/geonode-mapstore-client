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
    SET_PAYWALL_PENDING
} from './actions';

const initialState = {
    steady: null,
    overlay: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_RESOURCE_PERMS: {
        const paywall = action.payload && action.payload.paywall;
        if (!paywall) return state;
        // The backend never emits `pending` (see paywallContract.js
        // _meta.note_on_pending) — the poll epic is watching for the webhook
        // flip to show up as a steady `paid_private`, at which point the
        // FE-only pending overlay has done its job and clears itself.
        const overlay = (state.overlay && state.overlay.state === 'pending' && paywall.state === 'paid_private')
            ? null
            : state.overlay;
        return { ...state, steady: paywall, overlay };
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
    default:
        return state;
    }
};

/** Resolves the single payload PaywallPanel renders from, or null. */
export const getEffectivePaywallPayload = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    if (!slice) return null;
    return slice.overlay || slice.steady || null;
};

/** True while the FE-only post-checkout poll should keep running. */
export const isPaywallPending = (state) => {
    const slice = state && state.anuga && state.anuga.paywall;
    return !!(slice && slice.overlay && slice.overlay.state === 'pending');
};

/**
 * TASK-2099 (epic 2092 W4.1) — Paywall reducer: the two-layer steady/overlay
 * merge that feeds PaywallPanelContainer's connected `paywallPayload` prop.
 */
import expect from 'expect';
import paywallReducer, {getEffectivePaywallPayload, isPaywallPending} from '../reducer';
import {SET_ANUGA_RESOURCE_PERMS} from '../../Anuga/actionsAnuga';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING
} from '../actions';

describe('TASK-2099 Paywall reducer', () => {
    it('initial state has no steady/overlay', () => {
        const state = paywallReducer(undefined, {type: '@@INIT'});
        expect(state.steady).toBe(null);
        expect(state.overlay).toBe(null);
    });

    it('SET_ANUGA_RESOURCE_PERMS with no paywall key is a no-op', () => {
        const state = paywallReducer(undefined, {type: SET_ANUGA_RESOURCE_PERMS, payload: {my_role: 'owner'}});
        expect(state.steady).toBe(null);
    });

    it('SET_ANUGA_RESOURCE_PERMS writes the steady payload', () => {
        const payload = {paywall: {state: 'free_public', checkout_url: null, read_only: false}};
        const state = paywallReducer(undefined, {type: SET_ANUGA_RESOURCE_PERMS, payload});
        expect(state.steady).toEqual(payload.paywall);
        expect(state.overlay).toBe(null);
    });

    it('SET_PAYWALL_UPGRADE_PROMPT arms the overlay with the 402 checkout_url', () => {
        const state = paywallReducer(undefined, {type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/create-session/'});
        expect(state.overlay).toEqual({state: 'upgrade_prompt', checkout_url: 'https://x/create-session/', read_only: false});
    });

    it('DISMISS_PAYWALL_UPGRADE clears an upgrade_prompt overlay only', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'});
        state = paywallReducer(state, {type: DISMISS_PAYWALL_UPGRADE});
        expect(state.overlay).toBe(null);
    });

    it('DISMISS_PAYWALL_UPGRADE does not clear a pending overlay (only dismisses upgrade_prompt)', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        state = paywallReducer(state, {type: DISMISS_PAYWALL_UPGRADE});
        expect(state.overlay).toEqual({state: 'pending', checkout_url: null, read_only: false});
    });

    it('SET_PAYWALL_PENDING arms the pending overlay', () => {
        const state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        expect(state.overlay).toEqual({state: 'pending', checkout_url: null, read_only: false});
    });

    it('a steady paid_private clears a pending overlay (webhook flip observed via poll)', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        expect(state.overlay.state).toBe('pending');
        state = paywallReducer(state, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'paid_private', checkout_url: null, read_only: false}}
        });
        expect(state.overlay).toBe(null);
        expect(state.steady.state).toBe('paid_private');
    });

    it('a steady free_public while pending does NOT clear the overlay (webhook has not fired yet)', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        state = paywallReducer(state, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'free_public', checkout_url: null, read_only: false}}
        });
        expect(state.overlay).toEqual({state: 'pending', checkout_url: null, read_only: false});
    });

    // TASK-2457 (adversarial R2, epic 2425 W2.5) — THE CUSTOMER HAD PAID AND
    // THE APP KEPT SAYING "Confirming your subscription…".
    //
    // The clear matched the bare literal 'paid_private'. paid_organization —
    // the state W2 itself added — never matched, so the overlay (which MASKS
    // steady in getEffectivePaywallPayload) stuck until a page reload.
    //
    // The contract doc had retracted this as unreachable because the webhook
    // hardcodes the flip to PRIVATE. True for the checkout path; false in
    // general — this clear runs on EVERY my_perms read, and an already-
    // organization project on an entitled account reads back paid_organization.
    it('a steady paid_organization ALSO clears a pending overlay (TASK-2457)', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        expect(state.overlay.state).toBe('pending');
        state = paywallReducer(state, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'paid_organization', checkout_url: null, read_only: false}}
        });
        expect(state.overlay).toBe(
            null,
            'paid_organization did not clear the pending overlay — a paying customer is stranded on the spinner'
        );
        expect(state.steady.state).toBe('paid_organization');
        // The whole point: the effective payload must now show the PAID state,
        // not the masking overlay.
        expect(getEffectivePaywallPayload({anuga: {paywall: state}}).state).toBe('paid_organization');
    });

    it('past_due while pending does NOT clear the overlay (not a paid state)', () => {
        let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        state = paywallReducer(state, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'past_due', checkout_url: 'https://x/', read_only: true}}
        });
        expect(state.overlay.state).toBe('pending');
    });

    // TASK-2457 second half — the poll giving up must be able to disarm the
    // overlay, or a lost/slow webhook is an un-dismissable state.
    it('CLEAR_PAYWALL_PENDING disarms a pending overlay, revealing steady', () => {
        let state = paywallReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'free_public', checkout_url: null, read_only: false}}
        });
        state = paywallReducer(state, {type: SET_PAYWALL_PENDING});
        expect(getEffectivePaywallPayload({anuga: {paywall: state}}).state).toBe('pending');
        state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING});
        expect(state.overlay).toBe(null);
        expect(getEffectivePaywallPayload({anuga: {paywall: state}}).state).toBe('free_public');
    });

    it('CLEAR_PAYWALL_PENDING never eats an upgrade_prompt refusal', () => {
        // A 402 can arm while the poll is still running. Clearing "pending"
        // must not silently discard a refusal the customer has to see.
        let state = paywallReducer(undefined, {type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'});
        state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING});
        expect(state.overlay.state).toBe('upgrade_prompt');
    });

    it('CLEAR_PAYWALL_PENDING is a no-op (same reference) when nothing is armed', () => {
        const before = paywallReducer(undefined, {type: '@@INIT'});
        expect(paywallReducer(before, {type: CLEAR_PAYWALL_PENDING})).toBe(before);
    });

    describe('getEffectivePaywallPayload', () => {
        it('returns null when there is no anuga.paywall slice', () => {
            expect(getEffectivePaywallPayload({})).toBe(null);
        });

        it('prefers overlay over steady', () => {
            const state = {
                anuga: {
                    paywall: {
                        steady: {state: 'free_public', checkout_url: null, read_only: false},
                        overlay: {state: 'upgrade_prompt', checkout_url: 'https://x/', read_only: false}
                    }
                }
            };
            expect(getEffectivePaywallPayload(state).state).toBe('upgrade_prompt');
        });

        it('falls back to steady when there is no overlay', () => {
            const state = {
                anuga: {paywall: {steady: {state: 'paid_private', checkout_url: null, read_only: false}, overlay: null}}
            };
            expect(getEffectivePaywallPayload(state).state).toBe('paid_private');
        });
    });

    describe('isPaywallPending', () => {
        it('is false with no overlay', () => {
            expect(isPaywallPending({anuga: {paywall: {overlay: null}}})).toBe(false);
        });

        it('is true only when overlay.state is pending', () => {
            expect(isPaywallPending({anuga: {paywall: {overlay: {state: 'pending'}}}})).toBe(true);
            expect(isPaywallPending({anuga: {paywall: {overlay: {state: 'upgrade_prompt'}}}})).toBe(false);
        });
    });
});

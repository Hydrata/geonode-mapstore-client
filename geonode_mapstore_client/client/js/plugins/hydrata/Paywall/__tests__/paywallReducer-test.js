/**
 * TASK-2099 (epic 2092 W4.1) — Paywall reducer: the two-layer steady/overlay
 * merge that feeds PaywallPanelContainer's connected `paywallPayload` prop.
 */
import expect from 'expect';
import paywallReducer, {
    getEffectivePaywallPayload, getPaywallSteady, isPaywallPending, getPaywallConfirming
} from '../reducer';
import {getPaywallSteadyState, isPaywallPastDue} from '../selectors';
import {SET_ANUGA_RESOURCE_PERMS} from '../../Anuga/actionsAnuga';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    STALL_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING
} from '../actions';
import {SET_ACCOUNT_SUMMARY} from '../account/actions';

// TASK-2463 (W2.8) added `stalled` to the pending overlay. Spelled out once here
// so the exact-shape assertions below keep asserting the WHOLE object (a
// toEqual with a field quietly dropped is how a new field escapes review).
const PENDING_OVERLAY = {state: 'pending', stalled: false, checkout_url: null, read_only: false};

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
        expect(state.overlay).toEqual(PENDING_OVERLAY);
    });

    it('SET_PAYWALL_PENDING arms the pending overlay, NOT stalled', () => {
        const state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        expect(state.overlay).toEqual(PENDING_OVERLAY);
        expect(getPaywallConfirming({anuga: {paywall: state}})).toEqual({stalled: false});
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
        expect(state.overlay).toEqual(PENDING_OVERLAY);
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

    // TASK-2463 (epic 2425 W2.8) — the give-up path. TASK-2457 made the poll
    // CLEAR the overlay here; the same wave deleted PendingSpinner, so from then
    // on clearing it revealed nothing at all and a customer who had paid got no
    // acknowledgement of any kind. The overlay now STAYS and is marked stalled.
    it('STALL_PAYWALL_PENDING keeps the overlay and marks it stalled — it does NOT reveal a pre-payment steady', () => {
        let state = paywallReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'free_public', checkout_url: null, read_only: false}}
        });
        state = paywallReducer(state, {type: SET_PAYWALL_PENDING});
        expect(getEffectivePaywallPayload({anuga: {paywall: state}}).state).toBe('pending');
        state = paywallReducer(state, {type: STALL_PAYWALL_PENDING});
        expect(state.overlay).toNotBe(
            null,
            'the customer who paid is back to seeing the pre-payment state with no signal'
        );
        expect(getPaywallConfirming({anuga: {paywall: state}})).toEqual({stalled: true});
        // The steady state is still there and still readable — nothing was
        // destroyed, it is simply not what the panel leads with.
        expect(state.steady.state).toBe('free_public');
    });

    it('STALL_PAYWALL_PENDING never eats an upgrade_prompt refusal', () => {
        // A 402 can arm while the poll is still running. The give-up path must
        // not silently discard a refusal the customer has to see.
        let state = paywallReducer(undefined, {type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'});
        state = paywallReducer(state, {type: STALL_PAYWALL_PENDING});
        expect(state.overlay.state).toBe('upgrade_prompt');
    });

    it('STALL_PAYWALL_PENDING is a no-op (same reference) when nothing is armed, and idempotent when already stalled', () => {
        const before = paywallReducer(undefined, {type: '@@INIT'});
        expect(paywallReducer(before, {type: STALL_PAYWALL_PENDING})).toBe(before);
        const stalled = paywallReducer(
            paywallReducer(undefined, {type: SET_PAYWALL_PENDING}), {type: STALL_PAYWALL_PENDING}
        );
        expect(paywallReducer(stalled, {type: STALL_PAYWALL_PENDING})).toBe(stalled);
    });

    it('getPaywallConfirming is null when no purchase is in flight, whatever the steady state', () => {
        const state = paywallReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'past_due', checkout_url: 'https://x/', read_only: true}}
        });
        expect(getPaywallConfirming({anuga: {paywall: state}})).toBe(null);
        expect(getPaywallConfirming({})).toBe(null);
    });

    // TASK-2463 (W2.8) — the SECOND confirmation channel, and the reason the
    // honest-stall change is not itself a new permanent lie. An ACCOUNT-scoped
    // subscription (Billing tab "Subscribe" -> accountOnly, no project on the
    // session) leaves the project public forever, so my_perms answers free_public
    // for good and no paid PROJECT state ever arrives. Before this rule the
    // customer's subscription would land perfectly and the app would sit on
    // "still confirming" until they reloaded.
    describe('confirmation via the account summary (W2.8)', () => {
        it('an ACTIVE subscription clears a pending overlay', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            state = paywallReducer(state, {
                type: SET_ACCOUNT_SUMMARY, data: {subscription: {active: true, since: '2026-07-26'}}
            });
            expect(state.overlay).toBe(
                null,
                'an account-scoped subscription that landed left the app claiming it was '
                + 'still confirming — the only channel that can confirm it was ignored'
            );
        });

        it('clears a STALLED overlay too — a late confirmation must still resolve it', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            state = paywallReducer(state, {type: STALL_PAYWALL_PENDING});
            state = paywallReducer(state, {
                type: SET_ACCOUNT_SUMMARY, data: {subscription: {active: true}}
            });
            expect(state.overlay).toBe(null);
        });

        it('an INACTIVE subscription changes nothing (the poll must keep waiting)', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            const after = paywallReducer(state, {
                type: SET_ACCOUNT_SUMMARY, data: {subscription: {active: false}}
            });
            expect(after).toBe(state, 'an unchanged summary must not even produce a new object');
            expect(isPaywallPending({anuga: {paywall: after}})).toBe(true);
        });

        it('does not touch an upgrade_prompt refusal', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'});
            state = paywallReducer(state, {
                type: SET_ACCOUNT_SUMMARY, data: {subscription: {active: true}}
            });
            expect(state.overlay.state).toBe('upgrade_prompt');
        });

        it('a malformed/absent summary body is inert', () => {
            const state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            expect(paywallReducer(state, {type: SET_ACCOUNT_SUMMARY})).toBe(state);
            expect(paywallReducer(state, {type: SET_ACCOUNT_SUMMARY, data: {}})).toBe(state);
        });
    });

    // TASK-2486 (epic 2425 W2.9) — the THIRD confirmation channel, the credit
    // pack's. Its signal is the compute balance, which this slice cannot see, so
    // the comparison is made in clearPendingOnBalanceIncreaseEpic and only its
    // verdict arrives here. Backend-verified: the credit-pack webhook branch
    // (commerce/checkout_views.py _handle_credit_pack_checkout_completed) writes
    // a ComputeLedgerEntry and touches neither has_paid_private_entitlement (the
    // field `subscription.active` reports) nor Project.visibility, so NEITHER of
    // the two clears above can ever fire for an unsubscribed pack buyer.
    describe('confirmation via the compute balance (W2.9)', () => {
        it('clears a pending overlay', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING, reason: 'balance'});
            expect(state.overlay).toBe(
                null,
                'the pack landed, the balance went up, and the app still claimed it had '
                + 'confirmed nothing'
            );
        });

        it('clears a STALLED overlay too — the balance can arrive after the poll gave up', () => {
            let state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            state = paywallReducer(state, {type: STALL_PAYWALL_PENDING});
            state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING, reason: 'balance'});
            expect(state.overlay).toBe(null);
            expect(getPaywallConfirming({anuga: {paywall: state}})).toBe(null);
        });

        it('does not touch an upgrade_prompt refusal', () => {
            let state = paywallReducer(undefined, {
                type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'
            });
            state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING, reason: 'balance'});
            expect(state.overlay.state).toBe(
                'upgrade_prompt',
                'a balance change dismissed the refusal the user was reading'
            );
        });

        it('is inert with no overlay at all', () => {
            const state = paywallReducer(undefined, {type: 'INIT'});
            expect(paywallReducer(state, {type: CLEAR_PAYWALL_PENDING})).toBe(state);
        });
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

    // ── TASK-2463 (epic 2425 W2.7): steady must describe the project on screen ──
    //
    // W2.6 gave projectsReducer a projectId refusal for `visibility` and left
    // this half of the SAME payload unprotected, so after an SPA nav A -> B a
    // late my_perms for A was refused for visibility and accepted for
    // paywall.steady. The padlock then paired B's visibility with A's lapse: a
    // billing claim about a project the user is no longer looking at.
    describe('getPaywallSteady — the project stamp (TASK-2463 W2.7)', () => {
        const steadyFor = (projectId, paywallState) => paywallReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            projectId,
            payload: {paywall: {state: paywallState, checkout_url: null, read_only: false}}
        });
        const withProject = (paywall, loadedId) => ({
            anuga: {paywall, projects: {data: {id: loadedId, visibility: 'private'}}}
        });

        it('records which project the steady payload describes', () => {
            expect(steadyFor(7, 'past_due').steadyProjectId).toBe(7);
        });

        it('normalises a payload with no project identity to null', () => {
            expect(steadyFor(undefined, 'past_due').steadyProjectId).toBe(null);
        });

        it('returns the steady state when the stamp matches the loaded project', () => {
            const state = withProject(steadyFor(7, 'past_due'), 7);
            expect(getPaywallSteady(state).state).toBe('past_due');
            expect(getPaywallSteadyState(state)).toBe('past_due');
            expect(isPaywallPastDue(state)).toBe(true);
        });

        it('REFUSES a steady state stamped for a DIFFERENT project — the A->B nav bug', () => {
            const state = withProject(steadyFor(7, 'past_due'), 8);
            expect(getPaywallSteady(state)).toBe(null);
            expect(getPaywallSteadyState(state)).toBe(null);
            // The consequence that matters: no "(subscription lapsed)" claim
            // attached to a project whose account never lapsed.
            expect(isPaywallPastDue(state)).toBe(false);
        });

        it('ACCEPTS an unstamped steady state — refusing it would be fail-DANGEROUS here', () => {
            // Unlike projectsReducer, SET_ANUGA_RESOURCE_PERMS is the ONLY writer
            // of `steady`, so a refusal discards the paywall state outright
            // rather than falling back to another writer's value.
            const state = withProject(steadyFor(undefined, 'past_due'), 8);
            expect(getPaywallSteadyState(state)).toBe('past_due');
        });

        it('ACCEPTS a stamped steady state when no project is loaded yet', () => {
            const state = {anuga: {paywall: steadyFor(7, 'paid_private'), projects: {data: null}}};
            expect(getPaywallSteadyState(state)).toBe('paid_private');
        });

        it('getEffectivePaywallPayload honours the same guard, and an OVERLAY still wins', () => {
            const mismatched = steadyFor(7, 'past_due');
            expect(getEffectivePaywallPayload(withProject(mismatched, 8))).toBe(null);
            // An FE-only overlay is not project-stamped and must not be dropped:
            // it is armed by a click in the here and now.
            const withOverlay = paywallReducer(mismatched, {
                type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'
            });
            expect(getEffectivePaywallPayload(withProject(withOverlay, 8)).state)
                .toBe('upgrade_prompt');
        });
    });
});

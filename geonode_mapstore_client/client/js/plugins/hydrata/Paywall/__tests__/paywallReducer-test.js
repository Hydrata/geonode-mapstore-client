/**
 * TASK-2099 (epic 2092 W4.1) — Paywall reducer: the two-layer steady/overlay
 * merge that feeds PaywallPanelContainer's connected `paywallPayload` prop.
 */
import expect from 'expect';
import paywallReducer, {
    getEffectivePaywallPayload,
    getPaywallCheckoutAnchor,
    getPaywallDesiredVisibility,
    getPaywallSteady,
    isAnchoredPurchaseConfirmed,
    isCheckoutInFlight,
    isPaywallConfirming,
    isPaywallPending
} from '../reducer';
import {getPaywallSteadyState, isPaywallPastDue} from '../selectors';
import {SET_ANUGA_RESOURCE_PERMS} from '../../Anuga/actionsAnuga';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING,
    setPaywallPending,
    subscribeCheckoutRequest,
    subscribeCheckoutSettled
} from '../actions';

// The pending overlay's exact shape, spelled out once so the toEqual assertions
// below keep asserting the WHOLE object (a field quietly added or dropped is how
// a change to it escapes review). W2.8's `stalled` sub-state was removed by the
// W2.10 revert — see the reducer's CLEAR_PAYWALL_PENDING case. TASK-2489 added
// `anchor`: the departure record, inert in this slice, defaulting to null so an
// arming that carries none is indistinguishable from pre-2489 behaviour.
const PENDING_OVERLAY = {
    state: 'pending', checkout_url: null, read_only: false, visibility: null, anchor: null
};

// Shared by the three project-stamp describes below: build a slice through the
// REAL reducer (never a hand-rolled literal — that is how a shape change slips
// past a stamp test), then mount it under a given loaded project.
const withProject = (paywall, loadedId) => ({
    anuga: {paywall, projects: {data: {id: loadedId, visibility: 'private'}}}
});
const refusalFor = (projectId, visibility) => paywallReducer(undefined, {
    type: SET_PAYWALL_UPGRADE_PROMPT,
    checkoutUrl: 'https://x/create-session/',
    visibility,
    projectId
});

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
        expect(state.overlay).toEqual({state: 'upgrade_prompt', checkout_url: 'https://x/create-session/', read_only: false, visibility: null});
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

    it('SET_PAYWALL_PENDING arms the pending overlay', () => {
        const state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        expect(state.overlay).toEqual(PENDING_OVERLAY);
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

    // TASK-2457 second half — the poll giving up must be able to disarm the
    // overlay, or a lost/slow webhook is an un-dismissable state.
    //
    // W2.10 (operator decision 2026-07-26) restored this trio after W2.8 replaced
    // the clear with a STALL marker and W2.9 added a SET_ACCOUNT_SUMMARY channel
    // beside it. Clearing reveals `steady` — that is all it does, and all it is
    // claimed to do. Acknowledging a webhook slower than the poll is TASK-2489.
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

    // W2.10 REGRESSION GUARD. W2.9 made the account summary a confirmation
    // channel in this slice: an ACTIVE subscription cleared a pending overlay.
    // It is gone, and it must not come back here — the summary is
    // account-scoped, `subscription.active` is a subscription flag rather than a
    // "money arrived" flag, and a credit-pack buyer never sets it, so this
    // reducer cannot tell "not landed" from "landed unobserved". TASK-2489 owns
    // the server-side read that can.
    it('the account summary is INERT in this slice — it is not a confirmation channel', () => {
        const state = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
        const after = paywallReducer(state, {
            type: 'ACCOUNT:SET_SUMMARY', data: {subscription: {active: true, since: '2026-07-26'}}
        });
        expect(after).toBe(state, 'the account summary disarmed the pending overlay');
        expect(isPaywallPending({anuga: {paywall: after}})).toBe(true);
    });

    // ── TASK-2489 (epic 2425 W3c): the departure anchor ─────────────────────
    //
    // It rides the arming action and lives ON the overlay, so it dies with it.
    // That is what stops a settled checkout's record being adopted by a later
    // one, and it is why the Billing tab's notice can be a pure store read.
    describe('the checkout anchor (TASK-2489)', () => {
        const ANCHOR = {
            purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
            latestPurchaseIso: '2026-07-27T01:00:00+00:00', balanceObserved: true
        };
        const SUB_ANCHOR = {
            purchaseType: 'subscription', accountOnly: true, projectId: null,
            latestPurchaseIso: null, balanceObserved: true
        };
        /** A store with the anchored overlay plus whatever /commerce/account/ last said. */
        const withSummary = (paywall, summary) => ({
            anuga: {paywall, accountSummary: {loaded: true, subscription: {active: false, since: null}, ...summary}}
        });

        it('SET_PAYWALL_PENDING carries the anchor onto the overlay', () => {
            const state = paywallReducer(undefined, setPaywallPending(ANCHOR));
            expect(state.overlay.anchor).toEqual(ANCHOR);
            expect(getPaywallCheckoutAnchor({anuga: {paywall: state}})).toEqual(ANCHOR);
            expect(isPaywallConfirming({anuga: {paywall: state}})).toBe(true);
        });

        it('an arming with NO anchor is pre-2489 behaviour — pending, but nothing confirming', () => {
            // localStorage blocked, a corrupt record, or a return this browser
            // never started. The poll still runs and still clears; the panel just
            // makes no claim it has no channel to retract.
            const state = paywallReducer(undefined, setPaywallPending());
            expect(state.overlay.anchor).toBe(null);
            expect(isPaywallPending({anuga: {paywall: state}})).toBe(true);
            expect(isPaywallConfirming({anuga: {paywall: state}})).toBe(false);
        });

        it('the anchor dies with the overlay, so a settled checkout leaves nothing to adopt', () => {
            let state = paywallReducer(undefined, setPaywallPending(ANCHOR));
            state = paywallReducer(state, {type: CLEAR_PAYWALL_PENDING});
            expect(getPaywallCheckoutAnchor({anuga: {paywall: state}})).toBe(null);
            expect(isPaywallConfirming({anuga: {paywall: state}})).toBe(false);
        });

        const paidPrivate = (state) => paywallReducer(state, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'paid_private', checkout_url: null, read_only: false}}
        });

        it('a PAID steady clearing a SUBSCRIPTION overlay takes the anchor with it', () => {
            const state = paidPrivate(paywallReducer(undefined, setPaywallPending(SUB_ANCHOR)));
            expect(isPaywallConfirming({anuga: {paywall: state}})).toBe(false);
        });

        it('an anchorless pending overlay still clears on a PAID steady — pre-2489 behaviour', () => {
            const state = paidPrivate(paywallReducer(undefined, setPaywallPending()));
            expect(isPaywallPending({anuga: {paywall: state}})).toBe(false);
        });

        // ── W3c adversarial: the PAID clear must not eat a CREDIT PACK ───────
        //
        // A credit pack changes no entitlement, so for an already-entitled
        // customer on a private project `paid_private` is what EVERY my_perms
        // tick returns, before and after the purchase. Clearing on it retracted
        // the notice ~3s in on evidence about a different thing entirely, ended
        // the poll via takeWhile, and left the purchase-row detector — the only
        // channel that can see a pack — with nothing to fire on. The customer
        // was then reading pre-purchase money with no notice up to say so, which
        // is the live defect TASK-2489 exists to close.
        it('a PAID steady does NOT clear a CREDIT-PACK overlay — that purchase has its own channel', () => {
            const state = paidPrivate(paywallReducer(undefined, setPaywallPending(ANCHOR)));
            expect(isPaywallPending({anuga: {paywall: state}})).toBe(
                true,
                'an entitled customer\'s steady paid_private disarmed a credit-pack '
                + 'confirmation, so the pack\'s own detector never got to fire'
            );
            expect(getPaywallCheckoutAnchor({anuga: {paywall: state}})).toEqual(ANCHOR);
        });

        // ── TASK-2512 (epic 2425 W3d): the CROSS-PROJECT half of the same rule ──
        //
        // The PAID clear acted on an unstamped OR MISMATCHED payload, so after an
        // SPA nav A -> B a late my_perms for A could disarm a confirmation armed
        // for B. That used to cost "a spinner clearing early" and no longer does:
        // since TASK-2489 the same flag gates the Billing tab's confirming
        // notice, the 3s poll (via takeWhile) and the tail's account refetch, so
        // an early clear means the purchase stops being watched for and the panel
        // goes quiet showing pre-purchase money.
        //
        // The comparison is anchor-relative, not "loaded project"-relative, and
        // that is deliberate: this reducer is mounted through combineReducers and
        // cannot see the loaded project, but the anchor already records the
        // project THIS CHECKOUT was for — which is the sharper question anyway
        // ("is this evidence about the thing I paid for?").
        describe('TASK-2512 — the clear cannot be fired by another project\'s payload', () => {
            const subAnchorFor = (projectId) => ({
                purchaseType: 'subscription', accountOnly: false, projectId,
                latestPurchaseIso: null, balanceObserved: true
            });
            const paidPrivateFor = (state, projectId) => paywallReducer(state, {
                type: SET_ANUGA_RESOURCE_PERMS,
                projectId,
                payload: {paywall: {state: 'paid_private', checkout_url: null, read_only: false}}
            });

            // ── THE RED ONE ──────────────────────────────────────────────────
            it('a PAID steady stamped for ANOTHER project does NOT clear the confirmation', () => {
                const state = paidPrivateFor(
                    paywallReducer(undefined, setPaywallPending(subAnchorFor(7))), 42
                );
                expect(isPaywallPending({anuga: {paywall: state}})).toBe(
                    true,
                    'a late my_perms for a project the customer navigated AWAY from '
                    + 'disarmed the confirmation for the project they actually paid '
                    + 'for — the poll ends and the panel goes quiet over '
                    + 'pre-purchase money'
                );
                expect(getPaywallCheckoutAnchor({anuga: {paywall: state}})).toEqual(subAnchorFor(7));
                // The steady write itself is NOT refused — only the clear is.
                // getPaywallSteady is what decides whether that steady is shown.
                expect(state.steady.state).toBe('paid_private');
                expect(state.steadyProjectId).toBe(42);
            });

            it('the SAME project\'s PAID steady still clears — the confirmation path stays working', () => {
                const state = paidPrivateFor(
                    paywallReducer(undefined, setPaywallPending(subAnchorFor(42))), 42
                );
                expect(isPaywallPending({anuga: {paywall: state}})).toBe(
                    false, 'the guard swallowed the very clear it is supposed to allow'
                );
            });

            // Same fail-safe rule as describesLoadedProject / getPaywallSteady:
            // refuse only a stamp that POSITIVELY disagrees. An unstamped payload
            // is the common shape (permsEpics dispatches carry no project id on
            // several paths), and refusing it would strand a paying customer.
            it('an UNSTAMPED payload still clears, matching _describesLoadedProject', () => {
                const state = paidPrivate(
                    paywallReducer(undefined, setPaywallPending(subAnchorFor(7)))
                );
                expect(isPaywallPending({anuga: {paywall: state}})).toBe(
                    false, 'an unstamped payload was refused — fail-DANGEROUS, not fail-safe'
                );
            });

            it('an ACCOUNT-SCOPED anchor (projectId null) clears on any project\'s paid steady', () => {
                // The Billing tab's Subscribe rides no project at all, and the
                // entitlement it buys is account-scoped — so paid_* on ANY project
                // of that account IS evidence the subscription landed.
                const state = paidPrivateFor(
                    paywallReducer(undefined, setPaywallPending(SUB_ANCHOR)), 42
                );
                expect(isPaywallPending({anuga: {paywall: state}})).toBe(false);
            });

            it('an ANCHORLESS pending overlay is unaffected by the stamp either way', () => {
                // No anchor means no detector, so this clear and the 60s tail are
                // all there is — pre-2489 behaviour, deliberately preserved.
                const state = paidPrivateFor(paywallReducer(undefined, setPaywallPending()), 42);
                expect(isPaywallPending({anuga: {paywall: state}})).toBe(false);
            });
        });

        it('an upgrade_prompt overlay is never mistaken for a confirming checkout', () => {
            const state = refusalFor(42, 'private');
            expect(getPaywallCheckoutAnchor({anuga: {paywall: state}})).toBe(null);
            expect(isPaywallConfirming({anuga: {paywall: state}})).toBe(false);
        });

        it('both selectors are null-safe on a store with no paywall slice', () => {
            expect(getPaywallCheckoutAnchor({})).toBe(null);
            expect(isPaywallConfirming({})).toBe(false);
        });

        // ── W3c adversarial (money-path CRITICAL) ────────────────────────────
        //
        // "Confirming your purchase… this panel updates on its own" rendered
        // directly above SubscriptionSection's "Active since 2026-07-27", for
        // the full 60s, on the Billing tab's own Subscribe. Both read the SAME
        // store, so the contradiction is not a race to be narrowed — it is a
        // claim the notice must refuse to make.
        describe('the notice cannot contradict the panel it sits on', () => {
            const pendingSub = () => paywallReducer(undefined, setPaywallPending(SUB_ANCHOR));

            it('a SUBSCRIPTION anchor stops confirming the moment the summary says active', () => {
                const state = withSummary(pendingSub(), {subscription: {active: true, since: '2026-07-27'}});
                expect(isAnchoredPurchaseConfirmed(state)).toBe(true);
                expect(isPaywallConfirming(state)).toBe(
                    false,
                    'the notice claimed the confirmation had not landed while the same '
                    + 'store already rendered "Active since" four lines below it'
                );
                // The overlay itself is untouched — the epic clears it, and the
                // poll must keep running until it does.
                expect(isPaywallPending(state)).toBe(true);
            });

            it('...and keeps confirming while the summary still says inactive', () => {
                expect(isPaywallConfirming(withSummary(pendingSub(), {}))).toBe(true);
            });

            it('an UNLOADED summary is not evidence of anything', () => {
                const state = withSummary(pendingSub(), {loaded: false, subscription: {active: true}});
                expect(isAnchoredPurchaseConfirmed(state)).toBe(false);
                expect(isPaywallConfirming(state)).toBe(true);
            });

            it('a CREDIT-PACK anchor is not confirmed by a subscription being active', () => {
                // An entitled customer buying a pack: `active` is true and always
                // was. Reading it as evidence would retract the notice on the
                // wrong purchase entirely.
                const state = withSummary(
                    paywallReducer(undefined, setPaywallPending(ANCHOR)),
                    {subscription: {active: true, since: '2026-01-01'}}
                );
                expect(isAnchoredPurchaseConfirmed(state)).toBe(false);
                expect(isPaywallConfirming(state)).toBe(true);
            });

            it('is null-safe with no accountSummary slice at all', () => {
                expect(isAnchoredPurchaseConfirmed({anuga: {paywall: pendingSub()}})).toBe(false);
                expect(isAnchoredPurchaseConfirmed({})).toBe(false);
            });
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

        it('getEffectivePaywallPayload honours the same guard, and an UNSTAMPED overlay still wins', () => {
            const mismatched = steadyFor(7, 'past_due');
            expect(getEffectivePaywallPayload(withProject(mismatched, 8))).toBe(null);
            // W3d — an overlay armed with NO identity is still accepted, matching
            // getPaywallSteady: refuse only a stamp that positively disagrees.
            // (This assertion predates W3d, when overlays were never stamped at
            // all; a MISMATCHED overlay is now refused — see the block below.)
            const withOverlay = paywallReducer(mismatched, {
                type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl: 'https://x/'
            });
            expect(getEffectivePaywallPayload(withProject(withOverlay, 8)).state)
                .toBe('upgrade_prompt');
        });
    });

    // ── W3d: the OVERLAY needs the same stamp, and it is read FIRST ──────────
    //
    // W2.7 stamped `steady` and guarded it, but getEffectivePaywallPayload reads
    // `overlay ||` first, so the guard was short-circuited exactly when an
    // overlay existed. `upgrade_prompt` is the one that matters: it renders a
    // live CTA, it survives an SPA nav (ModalHost is not dismiss-on-click and
    // the slice is not reset on a route change), and clicking its Subscribe
    // resolves getProjectId at CLICK time — so a refusal armed on A opened a
    // checkout for B and the webhook privatised B, a project the customer was
    // never refused on and never asked to change.
    describe('getEffectivePaywallPayload — the overlay stamp (W3d)', () => {

        it('records which project the refusal is about', () => {
            expect(refusalFor(7, 'private').overlayProjectId).toBe(7);
            expect(refusalFor(undefined, 'private').overlayProjectId).toBe(null);
        });

        it('renders the refusal on the project it was armed for', () => {
            expect(getEffectivePaywallPayload(withProject(refusalFor(7, 'private'), 7)).state)
                .toBe('upgrade_prompt');
        });

        it('REFUSES a refusal armed for a DIFFERENT project — the wrong-project purchase', () => {
            expect(getEffectivePaywallPayload(withProject(refusalFor(7, 'private'), 8))).toBe(null);
        });

        it('renders a stamped refusal when no project is loaded yet', () => {
            const state = {anuga: {paywall: refusalFor(7, 'private'), projects: {data: null}}};
            expect(getEffectivePaywallPayload(state).state).toBe('upgrade_prompt');
        });

        it('DISMISS and CLEAR_PENDING drop the stamp with the overlay', () => {
            const dismissed = paywallReducer(refusalFor(7, 'private'), {type: DISMISS_PAYWALL_UPGRADE});
            expect(dismissed.overlay).toBe(null);
            expect(dismissed.overlayProjectId).toBe(null);

            const pending = paywallReducer(refusalFor(7, 'private'), {type: SET_PAYWALL_PENDING});
            expect(pending.overlayProjectId).toBe(null);
            expect(paywallReducer(pending, {type: CLEAR_PAYWALL_PENDING}).overlayProjectId).toBe(null);
        });
    });

    // ── W3d: the refused DESTINATION rides the refusal ──────────────────────
    //
    // The 402 branch kept only checkout_url, so "the customer chose
    // Organization" was lost between the refusal and the checkout. The webhook
    // then flipped to a hardcoded PRIVATE: paid for Organization, given
    // Private, with no surface saying so.
    describe('getPaywallDesiredVisibility (W3d)', () => {

        it('carries the destination the customer was refused', () => {
            expect(getPaywallDesiredVisibility(withProject(refusalFor(7, 'organization'), 7)))
                .toBe('organization');
            expect(getPaywallDesiredVisibility(withProject(refusalFor(7, 'private'), 7)))
                .toBe('private');
        });

        it('is null with no refusal armed', () => {
            expect(getPaywallDesiredVisibility({})).toBe(null);
            expect(getPaywallDesiredVisibility({anuga: {paywall: {overlay: null}}})).toBe(null);
        });

        it('is null for a pending overlay — nothing was refused', () => {
            const pending = paywallReducer(undefined, {type: SET_PAYWALL_PENDING});
            expect(getPaywallDesiredVisibility(withProject(pending, 7))).toBe(null);
        });

        it('NEVER supplies another project\'s destination', () => {
            // Routed through the same stamp guard, so a stale refusal cannot
            // decide what tier THIS project is bought at.
            expect(getPaywallDesiredVisibility(withProject(refusalFor(7, 'organization'), 8)))
                .toBe(null);
        });
    });

    // ── TASK-2441 (epic 2425 W4.2): the checkout in-flight flag ─────────────
    //
    // The single source of truth the epic's double-submit filter reads and
    // every buy control disables on. Shape copied from the shipped
    // REQUEST_BILLING_PORTAL -> portalLoading precedent
    // (Paywall/account/reducer.js:62-67).
    describe('checkout in-flight flag (TASK-2441)', () => {
        const mount = (paywall, loadedId) => ({
            anuga: {paywall, projects: {data: {id: loadedId}}}
        });

        it('starts clear', () => {
            expect(paywallReducer(undefined, {type: '@@INIT'}).checkoutInFlight).toBe(false);
        });

        it('SUBSCRIBE_CHECKOUT_REQUEST arms it', () => {
            const state = paywallReducer(
                undefined, subscribeCheckoutRequest('credit_pack', {priceId: 'price_x'})
            );
            expect(state.checkoutInFlight).toBe(true);
            expect(isCheckoutInFlight(mount(state, 7))).toBe(true);
        });

        it('the settle action clears it', () => {
            const armed = paywallReducer(undefined, subscribeCheckoutRequest('subscription'));
            const settled = paywallReducer(armed, subscribeCheckoutSettled());
            expect(settled.checkoutInFlight).toBe(false);
            expect(isCheckoutInFlight(mount(settled, 7))).toBe(false);
        });

        it('an unrelated action leaves it untouched', () => {
            const armed = paywallReducer(undefined, subscribeCheckoutRequest('subscription'));
            expect(paywallReducer(armed, {type: SET_PAYWALL_PENDING}).checkoutInFlight).toBe(true);
            expect(paywallReducer(armed, {type: 'SOMETHING:ELSE'}).checkoutInFlight).toBe(true);
        });

        it('the selector is null-safe — an absent slice reads false, never throws', () => {
            // storeWithProjectId in epicsAnuga-test.js mounts `anuga` with no
            // paywall key at all; a selector that assumed the slice would
            // redden epic tests that never touched checkout.
            expect(isCheckoutInFlight(undefined)).toBe(false);
            expect(isCheckoutInFlight({})).toBe(false);
            expect(isCheckoutInFlight({anuga: {}})).toBe(false);
            expect(isCheckoutInFlight({anuga: {projects: {data: {id: 7}}}})).toBe(false);
        });

        it('is NOT project-guarded — the Billing tab Subscribe rides no project', () => {
            // accountOnly checkouts (BillingTabContainer.js:33) carry no
            // project, and the Billing tab can be open with a project loaded
            // whose id would never match. Routing this flag through
            // _describesLoadedProject would silently never arm for them.
            const armed = paywallReducer(undefined, subscribeCheckoutRequest('subscription', {accountOnly: true}));
            expect(isCheckoutInFlight(mount(armed, 42))).toBe(true);
            expect(isCheckoutInFlight({anuga: {paywall: armed, projects: {data: null}}})).toBe(true);
        });
    });
});

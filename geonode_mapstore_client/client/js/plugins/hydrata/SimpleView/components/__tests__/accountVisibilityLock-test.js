/*
 * TASK-2463 + TASK-2462 (epic 2425 W2.5) — the project-visibility padlock on
 * the RHS Account button, and the owner gate that decides who sees it.
 *
 * SCOPE OF PROOF, stated up front because this epic exists to correct exactly
 * this mistake: jsdom has NO layout engine and NO cascade. Nothing below is
 * evidence that the padlock is visible, in the viewport, sized correctly,
 * overlapping the person glyph, or painting above anything. It proves DOM and
 * wiring facts only:
 *   - who gets a padlock and who does not (the TASK-2462 gate)
 *   - which visibility values produce one
 *   - the accessible name
 *   - that the positioned host class is on the button
 * The geometric claims — in viewport, hit-testable via elementFromPoint, not
 * clipped, not over the map canvas — are asserted in
 * deploy/tests/e2e/test_paywall_money_path.py and ONLY there.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ConnectedSimpleView from '../simpleViewContainer';
import AccountVisibilityLock, { visibilityLockLabel } from '../accountVisibilityLock';

function makeStore(state) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => a
    };
}

/**
 * @param myRole      the viewer's role on the project ('owner' or 'manager'
 *                    gates the lock in — TASK-2484 widened it from owner-only
 *                    to match the backend's MANAGER+ visibility-write gate)
 * @param visibility  the project's server-side visibility
 * @param paywallSteady  the paywall steady-state literal, or null
 *
 * The viewer is the project's ACTUAL OWNER by default (owner_username ===
 * security.user.username), and NOT the same question as my_role: get_user_role
 * returns 'owner' for any superuser (sync.py steps 2-3), so a superuser browsing
 * someone else's project arrives here with my_role 'owner' and owns nothing.
 *
 * W2.8 made that distinction load-bearing for the lapse wording. W2.9 withdrew
 * the lapse wording entirely (see the last describe in this file), so ownership
 * no longer changes ANY rendered output — the pairs are kept because "these two
 * viewers get the same label" is now the assertion, and it needs both to exist.
 */
const stateFor = (myRole, visibility, paywallSteady = null) => ({
    anuga: {
        projects: { data: { my_role: myRole, visibility, owner_username: 'the_viewer' } },
        ui: { showMembershipPanel: false },
        paywall: { steady: paywallSteady ? { state: paywallSteady } : null, overlay: null }
    },
    security: { user: { pk: 1, username: 'the_viewer' } },
    simpleView: {},
    layers: { groups: [] },
    localConfig: { plugins: { map_viewer: [] } }
});

/** Same, but the project belongs to somebody else. */
const stateForNonOwner = (myRole, visibility, paywallSteady = null) => {
    const state = stateFor(myRole, visibility, paywallSteady);
    state.anuga.projects.data.owner_username = 'somebody_else';
    return state;
};

const lockIn = (container) => container.querySelector('[data-testid="sv-visibility-lock"]');
const accountBtn = (container) => container.querySelector('button[title="Account"]');

// ── The pure label helper ────────────────────────────────────────────────────
describe('visibilityLockLabel (TASK-2463)', () => {
    it('names the visibility for the two locked tiers', () => {
        expect(visibilityLockLabel('private', false)).toBe('Project visibility: Private');
        expect(visibilityLockLabel('organization', false)).toBe('Project visibility: Organization');
    });

    it('returns null for public and for unknown/absent visibility — no lock, no label', () => {
        expect(visibilityLockLabel('public', false)).toBe(null);
        expect(visibilityLockLabel(null, false)).toBe(null);
        expect(visibilityLockLabel(undefined, true)).toBe(null);
        expect(visibilityLockLabel('nonsense', false)).toBe(null);
    });

    it('is not fooled by Object.prototype keys arriving off the wire', () => {
        // A bare LOCKED_VISIBILITIES[visibility] returns a truthy prototype
        // member for these, which would render a padlock whose accessible name
        // is a stringified function.
        ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']
            .forEach((key) => expect(visibilityLockLabel(key, false)).toBe(null, key));
    });

    // TASK-2463 (epic 2425 W2.9) — the label is now a function of the visibility
    // ALONE. It used to take a second `lapsed` argument and append
    // "(subscription lapsed)", which is a statement about the PROJECT that
    // nothing reachable from the frontend can establish. See the describe at the
    // bottom of this file for the full argument.
    it('names the visibility and makes no claim about billing, whatever else it is passed', () => {
        expect(visibilityLockLabel('private')).toBe('Project visibility: Private');
        // Extra arguments are inert: a caller left over from the old two-arg
        // signature must not be able to resurrect the claim by passing true.
        expect(visibilityLockLabel('private', true)).toBe('Project visibility: Private');
        expect(visibilityLockLabel('organization', true)).toBe('Project visibility: Organization');
        ['lapsed', 'subscription', 'due', 'expired', 'unpaid']
            .forEach((word) => expect(visibilityLockLabel('private', true).toLowerCase())
                .toNotInclude(word, `the padlock label still claims "${word}"`));
    });

    it('never implies the model went public — the HARD CONTRACT RULE, unchanged', () => {
        expect(visibilityLockLabel('private', true).toLowerCase()).toNotInclude('public');
        expect(visibilityLockLabel('organization', true).toLowerCase()).toNotInclude('public');
    });
});

// ── The presentational component in isolation ────────────────────────────────
describe('AccountVisibilityLock component (TASK-2463)', () => {
    let host;
    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(host);
        host.parentNode.removeChild(host);
    });

    const render = (props) => {
        act(() => { ReactDOM.render(<AccountVisibilityLock {...props} />, host); });
        return host;
    };

    it('renders a non-interactive image with the visibility as its accessible name', () => {
        const el = render({ visibility: 'private' }).querySelector('[data-testid="sv-visibility-lock"]');
        expect(el).toExist();
        // AC3: "not announced as an interactive control unless it is one".
        expect(el.getAttribute('role')).toBe('img');
        expect(el.tagName).toBe('SPAN');
        expect(el.getAttribute('aria-label')).toBe('Project visibility: Private');
        expect(el.querySelector('button')).toBe(null);
        expect(el.querySelector('a')).toBe(null);
    });

    it('carries the visibility as a data attribute so a test can tell the tiers apart', () => {
        expect(render({ visibility: 'organization' })
            .querySelector('[data-testid="sv-visibility-lock"]').getAttribute('data-visibility'))
            .toBe('organization');
    });

    // TASK-2463 (W2.9) — the --lapsed modifier and the `lapsed` prop that drove
    // it are gone from the component, and the rule is gone from simpleView.css.
    // A stray `lapsed` from an un-updated caller must be inert, not revive it.
    it('has no lapse modifier left, and a stray `lapsed` prop cannot bring one back', () => {
        expect(render({ visibility: 'private' })
            .querySelector('[data-testid="sv-visibility-lock"]').className)
            .toNotInclude('sv-visibility-lock--lapsed');
        expect(render({ visibility: 'private', lapsed: true })
            .querySelector('[data-testid="sv-visibility-lock"]').className)
            .toNotInclude('sv-visibility-lock--lapsed');
        expect(render({ visibility: 'private', lapsed: true })
            .querySelector('[data-testid="sv-visibility-lock"]').getAttribute('aria-label'))
            .toBe('Project visibility: Private');
    });

    it('renders nothing at all for public', () => {
        expect(render({ visibility: 'public' }).querySelector('[data-testid="sv-visibility-lock"]')).toBe(null);
        expect(render({ visibility: 'public', lapsed: true })
            .querySelector('[data-testid="sv-visibility-lock"]')).toBe(null);
    });
});

// ── Wired into the real Account button ───────────────────────────────────────
describe('Account button visibility padlock — wiring (TASK-2463)', () => {
    it('private: the padlock is a DOM CHILD of the Account button, on the positioned host', () => {
        // Being a child is what makes `position: absolute` resolve against the
        // button (and what makes a click on it still open the Account panel).
        // The host class is the anchor; without it the badge would escape to
        // .simple-view-right-toolbar and land against the whole column.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'private')) }
        );
        const btn = accountBtn(container);
        expect(btn).toExist();
        expect(btn.className).toInclude('sv-visibility-lock-host');
        const lock = lockIn(container);
        expect(lock).toExist();
        expect(lock.parentNode).toBe(btn);
    });

    it('organization is locked too — it is a paid tier, not a free middle ground', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'organization')) }
        );
        expect(lockIn(container).getAttribute('aria-label')).toBe('Project visibility: Organization');
    });

    it('public renders NO padlock (AC4) while the button itself stays', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'public')) }
        );
        expect(accountBtn(container)).toExist();
        expect(lockIn(container)).toBe(null);
    });

    it('the host class is present even with no padlock, so the anchor cannot go missing', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'public')) }
        );
        expect(accountBtn(container).className).toInclude('sv-visibility-lock-host');
    });

    // TASK-2463 (W2.9) — past_due and paid_private now render the SAME padlock.
    // They are not the same fact about the customer, but they are the same fact
    // about the project, and the padlock speaks about the project. The
    // billing-standing surface is Account > Billing.
    it('past_due renders the plain padlock — no amber, no billing annotation', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'past_due')) }
        );
        const lock = lockIn(container);
        expect(lock.className).toNotInclude('sv-visibility-lock--lapsed');
        expect(lock.getAttribute('aria-label')).toBe('Project visibility: Private');
    });

    it('paid_private renders identically — the padlock describes the project, not the bill', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'paid_private')) }
        );
        expect(lockIn(container).className).toNotInclude('sv-visibility-lock--lapsed');
        expect(lockIn(container).getAttribute('aria-label')).toBe('Project visibility: Private');
    });

    it('the BUTTON accessible name carries the visibility too (ARIA presentational children)', () => {
        // `button` has presentational children in ARIA, so a descendant
        // role=img is not guaranteed to be announced. Without this the padlock
        // would be information a screen-reader user never receives.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'private')) }
        );
        expect(accountBtn(container).getAttribute('aria-label'))
            .toBe('Account — Project visibility: Private');
    });

    it('the button accessible name is plain "Account" when there is no padlock', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'public')) }
        );
        expect(accountBtn(container).getAttribute('aria-label')).toBe('Account');
    });

    it('is dark under the kill-switch: paywallEnabled=false renders no padlock at all', () => {
        // Flags-off the same slot is the canManageMembers "Permissions" padlock
        // glyph; a padlock badge on a padlock glyph would be nonsense, and the
        // 3 non-ANUGA prod sites ship SimpleView with no cfg at all.
        const { container } = mountWithProviders(
            <ConnectedSimpleView />, { store: makeStore(stateFor('owner', 'private')) }
        );
        expect(container.querySelector('button[title="Permissions"]')).toExist();
        expect(lockIn(container)).toBe(null);
    });
});

// ── TASK-2462: the viewer-capability gate ────────────────────────────────────
describe('Account button visibility padlock — the TASK-2462 gate', () => {
    it('the OWNER of a private project sees it', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('owner', 'private')) }
        );
        expect(lockIn(container)).toExist();
    });

    // TASK-2484 (W2.7), operator-decided: MANAGERS SEE IT TOO. The backend's
    // visibility-write gate is MANAGER+ (check_project_role, min_role=MANAGER)
    // and the entitlement check charges request.user's own account, so a
    // manager can flip a project Private, be BILLED, and take past_due
    // refusals. Withholding the indicator from exactly those people was the
    // costly direction of wrong, not the safe one.
    it('a MANAGER of a private project sees it — the backend lets a manager flip visibility and bills them for it (TASK-2484)', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor('manager', 'private')) }
        );
        expect(lockIn(container)).toExist();
        expect(accountBtn(container).getAttribute('aria-label'))
            .toBe('Account — Project visibility: Private');
    });

    // W2.5 added these to stop the gate widening BY ACCIDENT, and W2.7 moved the
    // line rather than removing them — that protection is the whole point of
    // TASK-2462. The line is now exactly the backend's write gate: owner/manager
    // in, everyone else out. If someone later widens to my_role !== null, to
    // canEditAnugaMap (which admits 'editor'), or to canCreateScenario (which
    // admits 'contributor'), these fail and force the decision back into the
    // open rather than quietly showing a paid-tier indicator — and a lapse
    // notice about someone else's account — to people who cannot act on it.
    ['editor', 'contributor', 'viewer'].forEach(role => {
        it(`a ${role} (below manager) sees NO padlock — the gate matches the backend's MANAGER+ write gate, it does not guess`, () => {
            const { container } = mountWithProviders(
                <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor(role, 'private')) }
            );
            expect(accountBtn(container)).toExist('the Account button itself must still render');
            expect(lockIn(container)).toBe(null);
        });
    });

    it('a stranger with my_role null sees no padlock', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(stateFor(null, 'private')) }
        );
        expect(lockIn(container)).toBe(null);
    });

    it('a below-manager collaborator sees nothing even when the project is past_due', () => {
        // Announcing the lapse to someone who cannot act on it leaks account
        // standing and offers a fix they cannot apply. An editor cannot change
        // visibility (backend min_role=MANAGER), so the lapse is not theirs.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('editor', 'private', 'past_due')) }
        );
        expect(lockIn(container)).toBe(null);
        expect(accountBtn(container).getAttribute('aria-label')).toBe('Account');
    });

    // TASK-2484 (W2.7) added a test here pinning the aria-label
    // 'Project visibility: Private (subscription lapsed)' for a MANAGER. That
    // string is a claim about the PROJECT, and the manager case is exactly where
    // it is false — so the test is replaced rather than preserved. See the
    // describe below for the full reasoning; the manager keeps the padlock (the
    // W2.7 gate widening is intact), it just stops asserting something the app
    // cannot know.
    it('a MANAGER of a private project sees the padlock at past_due too — the GATE is unchanged', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateForNonOwner('manager', 'private', 'past_due')) }
        );
        expect(lockIn(container)).toExist(
            'the W2.7 MANAGER+ gate was narrowed — a manager can flip visibility and be billed for it'
        );
    });
});

// ── TASK-2463 (epic 2425 W2.9): the lapse claim is withdrawn ────────────────
//
// THE CLAIM. `visibilityLockLabel` used to append "(subscription lapsed)" to
// the padlock's accessible name, and paint it amber, whenever the paywall steady
// state was `past_due`. That sentence is about THE PROJECT.
//
// WHAT past_due ESTABLISHES. `_derive_paywall_state` (gn_anuga/api_v2.py) does
// `account = _get_acting_account(user)` and never touches `project.account` —
// read directly, and its own docstring says the acting-account resolution is
// deliberate FOR THE ENTITLEMENT CHECK. So past_due means exactly "the VIEWING
// user's account holds no paid private entitlement". It establishes nothing at
// all about who paid for the project.
//
// TWO MIRROR-IMAGE FAILURES, and why no predicate over this state can separate
// them. W2.7 widened the padlock from owner-only to MANAGER+ (correctly — the
// backend write gate is min_role=MANAGER and the entitlement is charged to the
// ACTING account, so a manager can flip a project private and be billed for it).
// That made the first failure reachable:
//   (a) an invited MANAGER whose own account is unentitled, on a private project
//       fully paid for by its owner, was told the project's subscription had
//       lapsed. W2.8 fixed this by requiring owner_username === the viewer.
//   (b) the exact mirror, which that fix left standing: an OWNER whose own
//       account is unentitled, on a project a MANAGER privatised on the
//       MANAGER's live subscription, is told the same thing. Also false.
// The states (a) and (b) arrive in are INDISTINGUISHABLE here: `my_role`,
// `visibility`, `owner_username` and `paywall.steady` are identical. Ownership
// was never the attribution predicate — it just moved the falsehood to a
// different viewer.
//
// AND THE FRONTEND CANNOT REPAIR IT. `Project.account` is not serialized
// anywhere (serializers_v2.py) and is NULL on all 166 production projects
// (verified read-only 2026-07-26), so even shipping it would answer nothing for
// the live estate. So the claim is withdrawn: the padlock states the visibility,
// which it knows, and says nothing about billing, which it does not.
//
// WHAT THIS DOES NOT DECIDE. Which account GOVERNS a project's paid standing is
// epic decision W2.7-D4, open with the operator, and the WORDING fork ("lapsed"
// vs "never subscribed" — past_due collapses both, and on day one at flip the
// second is the case for all 84 non-public prod owners) is TASK-2487. Neither is
// pre-empted here: withdrawing an unattributable claim is what is safe under
// every fork, and re-adding an attributable one is what those decide.
//
// WHAT IS LOST, stated plainly rather than buried: this was the last proactive
// lapse surface after W2.5 deleted the dunning banner. The renew affordance is
// unaffected — it has always lived in Account > Billing (BillingTabPanel's
// SubscriptionSection, which reads the ACCOUNT's own subscription state and can
// therefore say something true). Restoring a proactive notice is TASK-2487's job.
describe('Account button visibility padlock — an unattributable lapse is not claimed (W2.9)', () => {
    it('the project OWNER is told the visibility and NOTHING about a lapse', () => {
        // THE MIRROR CASE. This state is also what an owner sees when a MANAGER
        // privatised the project on the manager's own live subscription: the
        // project's standing is fine and the owner's account is simply
        // unsubscribed. Nothing in this payload can tell the two apart.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'past_due')) }
        );
        const lock = lockIn(container);
        expect(lock).toExist('the padlock itself must survive — only the claim goes');
        expect(lock.getAttribute('aria-label')).toBe(
            'Project visibility: Private',
            'the owner is being told THIS PROJECT\'s subscription has lapsed. past_due '
            + 'was computed from the owner\'s own acting account and says nothing about '
            + 'the project — a manager may have privatised it on a live subscription.'
        );
        expect(lock.className).toNotInclude(
            'sv-visibility-lock--lapsed',
            'the amber lapse styling makes the same unattributable claim in colour'
        );
    });

    it('an invited MANAGER is told the visibility and NOTHING about a lapse (W2.8, kept)', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateForNonOwner('manager', 'private', 'past_due')) }
        );
        const lock = lockIn(container);
        expect(lock).toExist();
        expect(lock.getAttribute('aria-label')).toBe('Project visibility: Private');
        expect(lock.className).toNotInclude('sv-visibility-lock--lapsed');
    });

    it('a SUPERUSER browsing someone else\'s project gets no lapse claim either', () => {
        // get_user_role maps is_superuser -> 'owner' (sync.py steps 2-3), so
        // my_role cannot tell a superuser apart from the real owner. This is the
        // path that was reachable even BEFORE W2.7 and was never noticed.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateForNonOwner('owner', 'private', 'past_due')) }
        );
        expect(lockIn(container).getAttribute('aria-label')).toBe('Project visibility: Private');
    });

    it('says nothing about a lapse when the payload is partial either', () => {
        // The old predicate read state.security.user.username, which
        // AppUtils.js:327 only populates when an access_token is present — so its
        // owner branch could silently never fire. It is gone, and these two
        // degraded payloads now reach the SAME label as every other viewer
        // rather than a different one.
        const missing = stateFor('owner', 'private', 'past_due');
        delete missing.anuga.projects.data.owner_username;
        expect(lockIn(mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(missing) }
        ).container).getAttribute('aria-label')).toBe('Project visibility: Private');

        const anonish = stateFor('owner', 'private', 'past_due');
        anonish.security = { user: { pk: 1 } };
        expect(lockIn(mountWithProviders(
            <ConnectedSimpleView paywallEnabled />, { store: makeStore(anonish) }
        ).container).getAttribute('aria-label')).toBe('Project visibility: Private');
    });

    it('the MANAGER+ gate itself is untouched — both roles still get a padlock', () => {
        // The claim goes; the TASK-2484 widening stays. A manager who can flip
        // visibility and be billed for it must still see the project's state.
        [stateFor('owner', 'private', 'past_due'),
            stateForNonOwner('manager', 'private', 'past_due'),
            stateFor('owner', 'organization', 'past_due')]
            .forEach((state) => expect(lockIn(mountWithProviders(
                <ConnectedSimpleView paywallEnabled />, { store: makeStore(state) }
            ).container)).toExist('the padlock was narrowed along with the claim'));
    });

    it('no viewer, no visibility and no steady state can resurrect the amber class', () => {
        // The modifier is gone from the component AND from simpleView.css. This
        // pins that: a future edit re-adding one without the other is how a
        // padlock ends up styled by a rule nobody can find.
        ['past_due', 'paid_private', 'paid_organization', 'free_public', null]
            .forEach((steady) => {
                [stateFor('owner', 'private', steady),
                    stateForNonOwner('manager', 'organization', steady)]
                    .forEach((state) => {
                        const lock = lockIn(mountWithProviders(
                            <ConnectedSimpleView paywallEnabled />, { store: makeStore(state) }
                        ).container);
                        if (lock) {
                            expect(lock.className).toNotInclude('sv-visibility-lock--lapsed', `${steady}`);
                        }
                    });
            });
    });
});

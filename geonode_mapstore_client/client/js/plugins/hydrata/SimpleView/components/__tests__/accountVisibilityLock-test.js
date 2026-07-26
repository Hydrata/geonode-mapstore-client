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
 * security.user.username). TASK-2463 (W2.8) made that distinction load-bearing
 * for the lapse wording — see stateForNonOwner below — and it is NOT the same
 * question as my_role: get_user_role returns 'owner' for any superuser
 * (sync.py steps 2-3), so a superuser browsing someone else's project arrives
 * here with my_role 'owner' and is not the owner of anything.
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

    it('says the subscription lapsed WITHOUT implying the model went public', () => {
        // HARD CONTRACT RULE: lapse never auto-publishes. The wording must not
        // suggest otherwise, and it must still name the real visibility.
        const label = visibilityLockLabel('private', true);
        expect(label).toBe('Project visibility: Private (subscription lapsed)');
        expect(label.toLowerCase()).toNotInclude('public');
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

    it('adds the --lapsed modifier ONLY when past_due', () => {
        expect(render({ visibility: 'private', lapsed: false })
            .querySelector('[data-testid="sv-visibility-lock"]').className)
            .toNotInclude('sv-visibility-lock--lapsed');
        expect(render({ visibility: 'private', lapsed: true })
            .querySelector('[data-testid="sv-visibility-lock"]').className)
            .toInclude('sv-visibility-lock--lapsed');
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

    it('past_due turns the padlock amber and says so, still naming the real visibility', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'past_due')) }
        );
        const lock = lockIn(container);
        expect(lock.className).toInclude('sv-visibility-lock--lapsed');
        expect(lock.getAttribute('aria-label')).toBe('Project visibility: Private (subscription lapsed)');
    });

    it('paid_private does NOT mark it lapsed', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'paid_private')) }
        );
        expect(lockIn(container).className).toNotInclude('sv-visibility-lock--lapsed');
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

// ── TASK-2463 (epic 2425 W2.8): whose lapse is it? ───────────────────────────
//
// THE FALSE CLAIM THIS REMOVES. `_derive_paywall_state` (gn_anuga/api_v2.py)
// resolves `_get_acting_account(user)` and never `project.account` — read
// directly, and its own docstring says the acting-account resolution is
// deliberate FOR THE ENTITLEMENT CHECK. So `past_due` means exactly one thing:
// "the VIEWING user's account has no paid private entitlement". It says nothing
// whatever about the project's standing.
//
// W2.7 widened the padlock from owner-only to MANAGER+, which was right, and in
// doing so made this reachable: an invited manager whose own account is
// unentitled, looking at a private project fully paid for by its owner, was told
// "Project visibility: Private (subscription lapsed)" — false about the project.
// Before W2.7 only superusers (my_role -> 'owner') could reach it.
//
// WHY SUPPRESSION AND NOT REWORDING. Which account GOVERNS a project — and
// whether Project.account should be populated at creation, given that it is NULL
// on all 166 production projects (verified read-only 2026-07-26;
// ProjectViewSet.perform_create saves only created_by and owner, and the sole
// writer is commerce/checkout_views.py's legacy-adoption bind) — is being grilled
// with the operator and is not settled here. Rewording the label is one of the
// forks on the table (W2.7-D4 (i)); picking it would pre-empt that decision. So
// this change does the one thing that is safe under EVERY fork: where the claim
// cannot be attributed, the UI says nothing rather than something false.
//
// THE OWNER CASE IS KEPT DELIBERATELY. For the project's actual owner the acting
// account is the only account that can be charged for this project today, so
// past_due is a true and actionable statement about their own standing — and
// past_due is the day-one default at flip for 84 of 84 non-public prod owners,
// all of whom own their projects. Withdrawing it from them would delete the only
// proactive lapse surface left after W2.5 removed the dunning banner.
describe('Account button visibility padlock — the lapse must be attributable (TASK-2463 W2.8)', () => {
    it('the project OWNER still sees the lapse, in full', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'past_due')) }
        );
        expect(lockIn(container).className).toInclude('sv-visibility-lock--lapsed');
        expect(lockIn(container).getAttribute('aria-label'))
            .toBe('Project visibility: Private (subscription lapsed)');
    });

    it('an invited MANAGER is told the visibility and NOTHING about a lapse', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateForNonOwner('manager', 'private', 'past_due')) }
        );
        const lock = lockIn(container);
        expect(lock).toExist();
        expect(lock.getAttribute('aria-label')).toBe(
            'Project visibility: Private',
            'the manager is being told this project\'s subscription has lapsed. The '
            + 'backend never checked the project\'s account — only the manager\'s own.'
        );
        expect(lock.className).toNotInclude(
            'sv-visibility-lock--lapsed',
            'the amber lapse styling makes the same unattributable claim in colour'
        );
    });

    it('a SUPERUSER browsing someone else\'s project gets no lapse claim either', () => {
        // get_user_role maps is_superuser -> 'owner', so my_role cannot tell a
        // superuser apart from the real owner; owner_username can. This is the
        // path that was reachable BEFORE W2.7 and was never noticed.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateForNonOwner('owner', 'private', 'past_due')) }
        );
        expect(lockIn(container).getAttribute('aria-label')).toBe('Project visibility: Private');
    });

    it('says nothing about a lapse when it cannot tell who the owner is', () => {
        // Fail-safe, not fail-quiet-and-hope: an absent owner_username (an older
        // serializer, a partial project payload) must suppress the claim, not
        // default to making it.
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

    it('the OWNER of a paid_private project is not marked lapsed (no false positive)', () => {
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('owner', 'private', 'paid_private')) }
        );
        expect(lockIn(container).className).toNotInclude('sv-visibility-lock--lapsed');
    });
});

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
 * @param myRole      the viewer's role on the project ('owner' gates the lock in)
 * @param visibility  the project's server-side visibility
 * @param paywallSteady  the paywall steady-state literal, or null
 */
const stateFor = (myRole, visibility, paywallSteady = null) => ({
    anuga: {
        projects: { data: { my_role: myRole, visibility } },
        ui: { showMembershipPanel: false },
        paywall: { steady: paywallSteady ? { state: paywallSteady } : null, overlay: null }
    },
    security: { user: { pk: 1 } },
    simpleView: {},
    layers: { groups: [] },
    localConfig: { plugins: { map_viewer: [] } }
});

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

    // The operator's verdict was "owner, or member of the organisation that
    // owns the project". The org half is NOT derivable on the FE today (no
    // backend field carries the project's owning organisation — see
    // Paywall/selectors.js and TASK-2471), so the gate is owner-only and
    // UNDER-shows rather than guessing. These four pin that it under-shows
    // deliberately: if someone later widens the gate to my_role !== null or to
    // canEditResource, these fail and force the decision back into the open
    // rather than quietly showing a paid-tier control to people who cannot
    // act on it.
    ['manager', 'editor', 'contributor', 'viewer'].forEach(role => {
        it(`a ${role} (non-owner) sees NO padlock — the gate under-shows, it does not guess`, () => {
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

    it('a non-owner sees nothing even when the project is past_due', () => {
        // The lapse belongs to the OWNER's account. Announcing it to a
        // collaborator leaks account standing and offers a fix they cannot apply.
        const { container } = mountWithProviders(
            <ConnectedSimpleView paywallEnabled />,
            { store: makeStore(stateFor('editor', 'private', 'past_due')) }
        );
        expect(lockIn(container)).toBe(null);
        expect(accountBtn(container).getAttribute('aria-label')).toBe('Account');
    });
});

/*
 * RHS Permissions padlock → custom MembershipPanel.
 *
 * The padlock replaces the old left-rail "Permissions" (members) button. It must:
 *   - render only when the user can manage members (ANUGA owner/manager), since
 *     the MembershipPanel only mounts on ANUGA maps for that audience;
 *   - dispatch setMembershipPanel (our custom permissions panel) on click — NOT
 *     the old GeoNode ResourceDetails (setShowDetails) action;
 *   - reflect state.anuga.ui.showMembershipPanel as its active state.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ConnectedSimpleView from '../simpleViewContainer';

function makeStore(state) {
    const dispatched = [];
    return {
        dispatched,
        store: {
            getState: () => state,
            subscribe: () => () => {},
            dispatch: (a) => { dispatched.push(a); return a; }
        }
    };
}

const ownerState = (showMembershipPanel = false) => ({
    anuga: { projects: { data: { my_role: 'owner' } }, ui: { showMembershipPanel } },
    security: { user: { pk: 1 } },
    simpleView: {},
    // layers has no `flat` — exercises the optional-chain guard in
    // simpleViewLegend mapStateToProps (state?.layers?.flat?.filter)
    layers: { groups: [] },
    localConfig: { plugins: { map_viewer: [] } }
});

describe('SimpleView RHS Permissions padlock', () => {
    it('dispatches setMembershipPanel(true) on click — not ResourceDetails', () => {
        const { store, dispatched } = makeStore(ownerState(false));
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        const padlock = container.querySelector('button[title="Permissions"]');
        expect(padlock).toBeTruthy();
        expect(padlock.className).toNotContain('active');

        fireEvent.click(padlock);

        const membershipActions = dispatched.filter(a => a && a.type === 'SET_MEMBERSHIP_PANEL');
        expect(membershipActions.length).toBe(1);
        expect(membershipActions[0].visible).toBe(true);
    });

    it('shows the padlock active when the MembershipPanel is open', () => {
        const { store } = makeStore(ownerState(true));
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        const padlock = container.querySelector('button[title="Permissions"]');
        expect(padlock).toBeTruthy();
        expect(padlock.className).toContain('active');
    });

    it('hides the padlock when the user cannot manage members', () => {
        const state = ownerState(false);
        state.anuga.projects.data.my_role = 'viewer'; // not owner/manager
        const { store } = makeStore(state);
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
    });
});

// TASK-2420 (epic 2359 W4.5) — the padlock -> Account panel button. AC1:
// flags-off is covered above (byte-identical, untouched by these new
// tests). AC2: flags-on renders for ANY authenticated user (not just a
// project manager), glyph 'user', title 'Account'.
describe('SimpleView RHS Account button (TASK-2420, paywallEnabled=true)', () => {
    // paywallEnabled is read off ownProps (mapStateToProps(state, ownProps)) —
    // it arrives as a genuine ownProp via MapStore's createPlugin cfg-spread
    // in the real app (localConfig.json's SimpleView plugin cfg, map_viewer
    // block), so these tests pass it the same way: a JSX prop on the
    // connected component, not via state.
    const paywallOnState = (myRole, loggedIn = true) => ({
        anuga: { projects: { data: { my_role: myRole } }, ui: { showMembershipPanel: false } },
        security: { user: loggedIn ? { pk: 1 } : null },
        simpleView: {},
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: [] } }
    });

    it('renders for a non-manager authenticated user (hidden under flags-off) as "Account" with the user glyph', () => {
        const { store } = makeStore(paywallOnState('viewer'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
        const btn = container.querySelector('button[title="Account"]');
        expect(btn).toBeTruthy();
        expect(btn.querySelector('.glyphicon-user')).toBeTruthy();
    });

    it('still renders for a manager too (title flips from Permissions to Account)', () => {
        const { store } = makeStore(paywallOnState('manager'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
        expect(container.querySelector('button[title="Account"]')).toBeTruthy();
    });

    it('renders nothing for an anonymous (logged-out) visitor', () => {
        const { store } = makeStore(paywallOnState('viewer', false));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Account"]')).toBe(null);
    });

    it('dispatches setMembershipPanel(true) on click, same as the flags-off padlock', () => {
        const { store, dispatched } = makeStore(paywallOnState('viewer'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        fireEvent.click(container.querySelector('button[title="Account"]'));
        const membershipActions = dispatched.filter(a => a && a.type === 'SET_MEMBERSHIP_PANEL');
        expect(membershipActions.length).toBe(1);
        expect(membershipActions[0].visible).toBe(true);
    });
});

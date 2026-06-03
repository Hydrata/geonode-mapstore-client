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
    // LegendPanel (rendered by SimpleViewContainer) reads state.layers.flat.filter
    layers: { flat: [], groups: [] },
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

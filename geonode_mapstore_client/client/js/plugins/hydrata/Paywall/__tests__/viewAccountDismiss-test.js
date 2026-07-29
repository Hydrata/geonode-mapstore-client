/**
 * "View account" must DISMISS the dialog it is leaving (epic 2425 W2
 * remediation).
 *
 * WHY THIS SUITE EXISTS, AND WHY THE OLD ONE DID NOT CATCH IT
 * -----------------------------------------------------------
 * TASK-2435 turned the compute-meter refusal modal into a body-level portal at
 * z-index 100000, with a backdrop that deliberately does NOT dismiss on click
 * and a focus trap that pulls every Tab back into the dialog. The Account
 * panel it routes to is a MovablePanel whose inline z-index 100000 resolves
 * INSIDE .gn-page-wrapper's 99999 stacking context, so it opens BEHIND the
 * portal. Net effect: "View account" left the customer looking at a scrim they
 * could neither click through nor Tab out of. The upgrade modal is now hosted
 * the same way, so it has the same obligation.
 *
 * The pre-existing coverage (computeMeterPanel-test.js, "View account on all
 * three refusal modals") asserts only that the onViewAccount CALLBACK fires.
 * That is true of the broken build too — the defect is in what the container
 * DISPATCHES. So these tests drive the real connected containers through a
 * store and assert on the dispatched action stream: the dismiss must be there,
 * alongside (not instead of) the panel-routing actions.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';

import ComputeMeterContainer from '../meter/containers/ComputeMeterContainer';
import PaywallPanelContainer from '../containers/PaywallPanelContainer';
import { DISMISS_METER_MODAL } from '../meter/actions';
import { DISMISS_PAYWALL_UPGRADE } from '../actions';
import { SET_MEMBERSHIP_PANEL, SET_MEMBERSHIP_PANEL_TAB } from '../../Anuga/actions/uiActions';

let container;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    if (container) {
        // Unmounting also tears the portal out of document.body, which is what
        // keeps the document-scoped queries below honest between tests.
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
    }
});

/**
 * Minimal store — connect() needs only getState/subscribe/dispatch. A real
 * createStore would fold the actions into new state and hide the very thing
 * under test (which actions were dispatched, and in what order).
 */
function fakeStore(state) {
    const dispatched = [];
    return {
        dispatched,
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (action) => {
            dispatched.push(action);
            return action;
        }
    };
}

function renderConnected(store, element) {
    act(() => {
        ReactDOM.render(<Provider store={store}>{element}</Provider>, container);
    });
    // Both containers portal to document.body, so the mount container is empty.
    return document;
}

const types = (store) => store.dispatched.map((a) => a.type);

describe('"View account" dismisses the compute-meter refusal modal (W2 remediation)', () => {
    const meterState = (modalType) => ({
        anuga: {
            computeMeter: {
                enabled: true,
                balance: '0.00',
                availablePacks: [],
                recentEntries: [],
                modal: { type: modalType, detail: 'x' }
            }
        }
    });

    ['insufficient_balance', 'cap_exceeded', 'estimate_ceiling'].forEach((modalType) => {
        const testId = `meter-${modalType.replace(/_/g, '-')}-view-account`;

        it(`${modalType}: dispatches the dismiss ALONGSIDE the Billing-tab routing`, () => {
            const store = fakeStore(meterState(modalType));
            const doc = renderConnected(store, <ComputeMeterContainer />);
            const btn = doc.querySelector(`[data-testid="${testId}"]`);
            expect(btn).toExist();

            act(() => { btn.click(); });

            const dispatched = types(store);
            // The regression that shipped: routing without dismissing, leaving
            // the customer behind a click-absorbing, focus-trapping portal.
            expect(dispatched).toInclude(DISMISS_METER_MODAL);
            expect(dispatched).toInclude(SET_MEMBERSHIP_PANEL);
            expect(dispatched).toInclude(SET_MEMBERSHIP_PANEL_TAB);
            // Dismiss FIRST: the dialog must be gone before the panel it hides
            // is asked to open, not after.
            expect(dispatched.indexOf(DISMISS_METER_MODAL))
                .toBeLessThan(dispatched.indexOf(SET_MEMBERSHIP_PANEL));
            // Routing must still happen — dismissing INSTEAD of routing would
            // be a different dead-end.
            expect(store.dispatched.find((a) => a.type === SET_MEMBERSHIP_PANEL).visible).toBe(true);
            expect(store.dispatched.find((a) => a.type === SET_MEMBERSHIP_PANEL_TAB).tab).toBe('billing');
        });
    });
});

describe('"View account" dismisses the paywall upgrade modal (W2 remediation)', () => {
    const paywallState = {
        anuga: {
            paywall: {
                steady: null,
                overlay: { state: 'upgrade_prompt', checkout_url: 'https://checkout/', read_only: false }
            }
        }
    };

    it('dispatches the upgrade dismiss ALONGSIDE the Billing-tab routing', () => {
        const store = fakeStore(paywallState);
        const doc = renderConnected(store, <PaywallPanelContainer paywallEnabled />);
        const btn = doc.querySelector('[data-testid="paywall-view-account"]');
        expect(btn).toExist();

        act(() => { btn.click(); });

        const dispatched = types(store);
        expect(dispatched).toInclude(DISMISS_PAYWALL_UPGRADE);
        expect(dispatched).toInclude(SET_MEMBERSHIP_PANEL);
        expect(dispatched).toInclude(SET_MEMBERSHIP_PANEL_TAB);
        expect(dispatched.indexOf(DISMISS_PAYWALL_UPGRADE))
            .toBeLessThan(dispatched.indexOf(SET_MEMBERSHIP_PANEL));
        expect(store.dispatched.find((a) => a.type === SET_MEMBERSHIP_PANEL_TAB).tab).toBe('billing');
    });
});

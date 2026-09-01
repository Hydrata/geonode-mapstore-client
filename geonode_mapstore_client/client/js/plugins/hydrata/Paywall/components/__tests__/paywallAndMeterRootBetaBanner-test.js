/**
 * TASK-2871 (epic 2839 W5.0) — the beta notice banner is DELETED outright
 * (operator ruling), not rewritten: it told every signed-in hydrata.com user
 * "Payments are in test mode — no card will be charged", a promise that
 * becomes false the instant TASK-2103 flips stripe_use_test_keys to false.
 *
 * RED-before-GREEN (AC#4): this spec is the regression guard that REPLACES
 * betaNoticeBanner-test.js (deleted whole, per AC#3 — no orphaned tests for
 * a component that no longer exists). Run against the pre-deletion tree it
 * FAILS (BetaNoticeBannerContainer is still the first child PaywallAndMeterRoot
 * mounts, and jobName='hydratabase' + signed-in makes it visible); after the
 * deletion + PaywallAndMeterRoot rewire it PASSES.
 *
 * Mounts the actual plugin composition root (not just the deleted component)
 * so the guard cannot be defeated by a future re-add anywhere else in the
 * Paywall tree — it asserts on the real mounted DOM, not on an import.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

import PaywallAndMeterRoot from '../PaywallAndMeterRoot';

function makeStore() {
    const rootReducer = combineReducers({
        // Every Paywall/meter/account selector this root's connected children
        // read (getEffectivePaywallPayload, isCheckoutInFlight,
        // getComputeMeterState, getAccountSummaryState) null-guards on a
        // missing/empty slice and degrades to its own initialState — an
        // empty passthrough is the real shape those selectors already
        // tolerate, not a test-only shortcut.
        anuga: (state = {}) => state,
        gnsettings: (state = { jobName: 'hydratabase' }) => state,
        security: (state = { user: { username: 'e2e_regular' } }) => state
    });
    return createStore(rootReducer);
}

let host;
beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
});
afterEach(() => {
    ReactDOM.unmountComponentAtNode(host);
    host.parentNode && host.parentNode.removeChild(host);
});

describe('TASK-2871 — beta notice banner is retired, not rewritten', () => {
    it('a signed-in hydratabase mount renders no beta-notice banner node', (done) => {
        ReactDOM.render(<Provider store={makeStore()}><PaywallAndMeterRoot /></Provider>, host, () => {
            expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);
            expect(host.querySelector('.sv-beta-notice-banner')).toBe(null);
            done();
        });
    });

    it('the mounted DOM carries none of the three retired promise strings', (done) => {
        ReactDOM.render(<Provider store={makeStore()}><PaywallAndMeterRoot /></Provider>, host, () => {
            const text = host.textContent;
            expect(text).toNotInclude('in beta');
            expect(text).toNotInclude('test mode');
            expect(text).toNotInclude('no card will be charged');
            expect(text).toNotInclude('free compute credit');
            done();
        });
    });
});

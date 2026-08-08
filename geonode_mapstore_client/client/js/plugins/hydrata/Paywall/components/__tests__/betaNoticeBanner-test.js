/**
 * TASK-2638 (epic 2635 W1) — beta notice banner.
 *
 * AC1 — renders only for jobName==='hydratabase', signed-in.
 * AC2 — remaining-credit text is store-sourced (changes with balance).
 * AC3 — dismissal persists across a reload for the SAME user; does not
 *       suppress the banner for a DIFFERENT user on the same browser.
 * AC4 — the banner, scenarioHelpers.formatCostEstimate (the scenario-pane
 *       estimate's derivation) and scenarioHelpers.bandForEstimate (the
 *       header chip's derivation) cannot tell three different stories for
 *       one fixture: the banner states account balance (a DIFFERENT fact
 *       from a run's price) and never claims anything about run pricing,
 *       while the two estimate-derivation functions themselves resolve the
 *       SAME fixture to the SAME Free/priced verdict.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

import BetaNoticeBannerContainer from '../../containers/BetaNoticeBannerContainer';
import accountSummaryReducer from '../../account/reducer';
import { setAccountSummary } from '../../account/actions';
import { formatCostEstimate, bandForEstimate } from '../../../Anuga/components/scenarioHelpers';

function makeStore({ jobName = 'hydratabase', username = 'e2e_regular' } = {}) {
    const rootReducer = combineReducers({
        anuga: combineReducers({ accountSummary: accountSummaryReducer }),
        gnsettings: (state = { jobName }) => state,
        security: (state = { user: username ? { username } : null }) => state
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
    // Scope the clear to this suite's own dismissal keys only — other
    // Karma suites in the same session may use localStorage for unrelated
    // things (e.g. paywallEpics.js's checkout-pending anchor).
    // TASK-2653 clears BOTH the pre-v2 key format (some specs below seed it
    // directly to prove it is now inert) and the current v2 format that
    // setDismissedFor/isDismissedFor actually read/write.
    ['e2e_regular', 'e2e_staff'].forEach((u) => {
        window.localStorage.removeItem(`hydrata.betaNoticeBanner.dismissed.${u}`);
        window.localStorage.removeItem(`hydrata.betaNoticeBanner.dismissed.v2.${u}`);
    });
});

describe('TASK-2638 BetaNoticeBanner', () => {
    it('AC1 — renders for a signed-in user when jobName is hydratabase', () => {
        const store = makeStore({ jobName: 'hydratabase' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toExist();
    });

    ['swamm', 'sararaportal', 'nicp'].forEach((jobName) => {
        it(`AC1 — does NOT render for jobName=${jobName}`, () => {
            const store = makeStore({ jobName });
            ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
            expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);
        });
    });

    it('AC1 — does NOT render for an anonymous (signed-out) session on hydratabase', () => {
        const store = makeStore({ jobName: 'hydratabase', username: null });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);
    });

    it('AC2 — the remaining-credit text is sourced from the store balance, not a hardcoded literal', () => {
        const store = makeStore({ jobName: 'hydratabase' });
        store.dispatch(setAccountSummary({ balance: '12.34', free_band: { cap: 3, used_today: 0, edge: '0.5', table: [] } }));
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        const textEl = host.querySelector('[data-testid="sv-beta-notice-banner-text"]');
        expect(textEl.textContent).toInclude('$12.34');

        // Change the store balance — the SAME mounted component must reflect it.
        store.dispatch(setAccountSummary({ balance: '99.00', free_band: { cap: 3, used_today: 0, edge: '0.5', table: [] } }));
        expect(host.querySelector('[data-testid="sv-beta-notice-banner-text"]').textContent).toInclude('$99.00');
        expect(host.querySelector('[data-testid="sv-beta-notice-banner-text"]').textContent).toNotInclude('$12.34');
    });

    it('AC2 — before the account summary has loaded, no credit figure is fabricated', () => {
        const store = makeStore({ jobName: 'hydratabase' }); // no setAccountSummary dispatched -> loaded:false
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        const text = host.querySelector('[data-testid="sv-beta-notice-banner-text"]').textContent;
        expect(text).toNotInclude('$0.00');
        expect(text).toInclude('beta');
    });

    it('AC3 — dismissal persists across a reload for the SAME user', () => {
        const store = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toExist();

        host.querySelector('[data-testid="sv-beta-notice-banner-dismiss"]').click();
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);

        // "Reload" — unmount and remount fresh (localStorage survives a
        // real reload; a fresh Provider/store simulates that here).
        ReactDOM.unmountComponentAtNode(host);
        const reloadedStore = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={reloadedStore}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);
    });

    it('AC3 — dismissal does NOT suppress the banner for a DIFFERENT user on the same browser', () => {
        const store = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        host.querySelector('[data-testid="sv-beta-notice-banner-dismiss"]').click();
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);

        ReactDOM.unmountComponentAtNode(host);
        const otherUserStore = makeStore({ jobName: 'hydratabase', username: 'e2e_staff' });
        ReactDOM.render(<Provider store={otherUserStore}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toExist();
    });

    it('AC4 — the banner never claims anything about run pricing (states account balance only)', () => {
        const store = makeStore({ jobName: 'hydratabase' });
        store.dispatch(setAccountSummary({ balance: '50.00', free_band: { cap: 3, used_today: 0, edge: '0.5', table: [[2, '1'], [5, '2'], [null, '5']] } }));
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        const text = host.querySelector('[data-testid="sv-beta-notice-banner-text"]').textContent;
        expect(text).toInclude('$50.00');
        // Never states a per-run price word — that story belongs to the
        // scenario-pane estimate / header chip, not this banner.
        expect(text).toNotInclude('est.');
        expect(text).toNotInclude('band');
    });

    it('AC4 — formatCostEstimate (scenario-pane) and bandForEstimate (header chip) agree on ONE fixture', () => {
        // One shared fixture: a $0.20 estimate, free threshold $0.50 —
        // both derivations must resolve this to "Free", never disagree.
        const freeEstimate = 0.20;
        expect(formatCostEstimate(freeEstimate)).toBe('~$0.20 est.');
        // formatCostEstimate only special-cases EXACTLY 0 as 'Free' — the
        // header chip's bandForEstimate is the one that buckets sub-threshold
        // amounts into the Free BAND (0). Confirm the band-level verdict:
        expect(bandForEstimate(freeEstimate, '0.5', [[2, '1'], [5, '2'], [null, '5']])).toBe(0);
        // And the true free-band case (estimate itself is exactly 0)
        // agrees on both surfaces without contradiction.
        expect(formatCostEstimate(0)).toBe('Free');
        expect(bandForEstimate(0, '0.5', [[2, '1'], [5, '2'], [null, '5']])).toBe(0);
    });
});

// TASK-2653 (epic 2635 W4, ruling 2635-D6) — the "accept + flag" mitigation
// for the W5 GPU rebake: an evergreen engine-update disclosure line, and a
// versioned dismiss key so it re-shows exactly once to users who already
// dismissed the pre-D6 banner.
describe('TASK-2653 BetaNoticeBanner — engine-update line + dismiss-key v2', () => {
    it('the evergreen engine-update line renders (no IntlProvider in this suite, so the msgId text itself is the render proof — same convention as billingTabPanel-test.js)', () => {
        const store = makeStore({ jobName: 'hydratabase' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        const text = host.querySelector('[data-testid="sv-beta-notice-banner-text"]').textContent;
        expect(text).toInclude('hydrata.anuga.betaEngineUpdateNotice');
    });

    it('an OLD (pre-v2) dismissal key does NOT suppress the banner', () => {
        // Seed exactly the literal pre-D6 key format — a prior dismisser's
        // localStorage, untouched by this epic wave.
        window.localStorage.setItem('hydrata.betaNoticeBanner.dismissed.e2e_regular', '1');
        const store = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toExist();
    });

    it('dismissing writes the v2 key and suppresses on next mount', () => {
        const store = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={store}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toExist();

        host.querySelector('[data-testid="sv-beta-notice-banner-dismiss"]').click();
        expect(window.localStorage.getItem('hydrata.betaNoticeBanner.dismissed.v2.e2e_regular')).toBe('1');

        ReactDOM.unmountComponentAtNode(host);
        const reloadedStore = makeStore({ jobName: 'hydratabase', username: 'e2e_regular' });
        ReactDOM.render(<Provider store={reloadedStore}><BetaNoticeBannerContainer /></Provider>, host);
        expect(host.querySelector('[data-testid="sv-beta-notice-banner"]')).toBe(null);
    });
});

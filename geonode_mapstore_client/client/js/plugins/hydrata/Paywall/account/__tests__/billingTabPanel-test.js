/**
 * TASK-2420 (epic 2359 W4.5) — BillingTabPanel: the Account panel's Billing
 * tab content. Covers the spec's "Billing tab contents" list (docs/strategy/
 * account-panel-spec.md).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import BillingTabPanel from '../components/BillingTabPanel';

let container;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    if (container) {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
    }
});

function render(props) {
    act(() => { ReactDOM.render(<BillingTabPanel {...props} />, container); });
    return container;
}

const baseFreeBand = { cap: 3, usedToday: 1, edge: '0.5' };

describe('BillingTabPanel — loading state', () => {
    it('shows a loading placeholder before the summary has loaded', () => {
        const c = render({ loaded: false });
        expect(c.querySelector('[data-testid="sv-account-billing-loading"]')).toExist();
        expect(c.querySelector('[data-testid="sv-account-billing-tab"]')).toBe(null);
    });
});

describe('BillingTabPanel — account header (spec item 1)', () => {
    it('org account: shows the org name + "shared by all members" + manager', () => {
        const c = render({
            loaded: true, organisation: 'Acme Consulting', isPersonal: false, manager: 'acme_manager'
        });
        const header = c.querySelector('[data-testid="sv-account-header"]');
        expect(header.textContent).toInclude('Acme Consulting');
        expect(header.textContent).toInclude('shared by all members of Acme Consulting');
        expect(header.textContent).toInclude('acme_manager');
    });

    it('personal account: shows "Personal account", no "shared by" line', () => {
        const c = render({ loaded: true, organisation: null, isPersonal: true, manager: 'solo_user' });
        const header = c.querySelector('[data-testid="sv-account-header"]');
        expect(header.textContent).toInclude('Personal account');
        expect(c.querySelector('[data-testid="sv-account-header-shared"]')).toBe(null);
    });
});

describe('BillingTabPanel — balance (spec item 2, re-homed BalanceStrip)', () => {
    it('renders the dollar balance prominently, never "credits"', () => {
        const c = render({ loaded: true, balance: '42.50', freeBand: baseFreeBand });
        const strip = c.querySelector('[data-testid="compute-meter-balance-strip"]');
        expect(strip).toExist();
        expect(strip.textContent).toInclude('$42.50');
        expect(strip.textContent).toNotInclude('credits');
    });
});

describe('BillingTabPanel — free-band explainer (spec item 3)', () => {
    it('shows "N of CAP used" and the live-settings explainer copy', () => {
        const c = render({ loaded: true, freeBand: { cap: 3, usedToday: 2, edge: '0.5' } });
        const section = c.querySelector('[data-testid="sv-account-free-band"]');
        expect(section.textContent).toInclude('2 of 3 used');
        expect(section.textContent).toInclude('$0.5');
    });
});

describe('BillingTabPanel — credit packs (spec item 4)', () => {
    it('renders $10/$25 buy buttons and fires onBuyPack with the price id', () => {
        let clickedWith = null;
        const c = render({
            loaded: true,
            freeBand: baseFreeBand,
            availablePacks: [
                { price_id: 'price_10', amount: '10', currency: 'usd' },
                { price_id: 'price_25', amount: '25', currency: 'usd' }
            ],
            onBuyPack: (id) => { clickedWith = id; }
        });
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_10"]').textContent).toBe('+ $10');
        c.querySelector('[data-testid="compute-meter-buy-pack-price_25"]').click();
        expect(clickedWith).toBe('price_25');
    });
});

describe('BillingTabPanel — subscription section (spec item 5, manager-only)', () => {
    it('manager, not subscribed: shows a Subscribe button', () => {
        let subscribed = false;
        const c = render({
            loaded: true, freeBand: baseFreeBand, isManager: true, manager: 'me',
            subscription: { active: false, since: null }, onSubscribe: () => { subscribed = true; }
        });
        expect(c.querySelector('[data-testid="sv-account-subscription-state"]').textContent).toInclude('Not subscribed');
        const btn = c.querySelector('[data-testid="sv-account-subscribe-btn"]');
        expect(btn).toExist();
        btn.click();
        expect(subscribed).toBe(true);
        expect(c.querySelector('[data-testid="sv-account-ask-manager"]')).toBe(null);
    });

    it('manager, subscribed: shows Manage billing and fires onManageBilling', () => {
        let managed = false;
        const c = render({
            loaded: true, freeBand: baseFreeBand, isManager: true, manager: 'me',
            subscription: { active: true, since: '2026-01-15T00:00:00Z' }, onManageBilling: () => { managed = true; }
        });
        expect(c.querySelector('[data-testid="sv-account-subscription-state"]').textContent).toInclude('Active');
        expect(c.querySelector('[data-testid="sv-account-subscription-state"]').textContent).toInclude('2026-01-15');
        const btn = c.querySelector('[data-testid="sv-account-manage-billing-btn"]');
        expect(btn).toExist();
        btn.click();
        expect(managed).toBe(true);
    });

    it('non-manager: sees "ask <manager>" instead of subscribe/manage — never the CTA', () => {
        const c = render({
            loaded: true, freeBand: baseFreeBand, isManager: false, manager: 'acme_manager',
            subscription: { active: false, since: null }
        });
        expect(c.querySelector('[data-testid="sv-account-subscribe-btn"]')).toBe(null);
        expect(c.querySelector('[data-testid="sv-account-manage-billing-btn"]')).toBe(null);
        expect(c.querySelector('[data-testid="sv-account-ask-manager"]').textContent).toInclude('acme_manager');
    });
});

describe('BillingTabPanel — recent activity (spec item 6)', () => {
    it('renders up to 10 entries with a run->project link where present', () => {
        const c = render({
            loaded: true, freeBand: baseFreeBand,
            recentEntries: [
                { date: '2026-07-23T10:00:00Z', entry_type: 'debit', amount: '2.00', run: { run_id: 99, project_id: 5, project_name: 'Merewether' } },
                { date: '2026-07-22T10:00:00Z', entry_type: 'purchase', amount: '10.00', run: null }
            ]
        });
        const rows = c.querySelectorAll('.sv-account-recent-entry-row');
        expect(rows.length).toBe(2);
        const link = c.querySelector('[data-testid="sv-account-recent-entry-run-link"]');
        expect(link).toExist();
        expect(link.textContent).toBe('Merewether');
        expect(link.getAttribute('href')).toBe('#/map/5');
    });

    it('renders nothing (no section) when there are no entries', () => {
        const c = render({ loaded: true, freeBand: baseFreeBand, recentEntries: [] });
        expect(c.querySelector('[data-testid="sv-account-recent-activity"]')).toBe(null);
    });
});

describe('BillingTabPanel — footer links (spec item 7)', () => {
    it('links to /plans (billing-policy is carried by the re-homed BalanceStrip)', () => {
        const c = render({ loaded: true, freeBand: baseFreeBand });
        expect(c.querySelector('[data-testid="sv-account-plans-link"]').getAttribute('href')).toBe('/plans');
        expect(c.querySelector('[data-testid="compute-meter-billing-policy-link"]').getAttribute('href')).toBe('/billing-policy');
    });
});

describe('BillingTabPanel — billing-portal error surfacing', () => {
    it('shows portalError text when present', () => {
        const c = render({ loaded: true, freeBand: baseFreeBand, portalError: 'Only the manager can do that.' });
        expect(c.querySelector('[data-testid="sv-account-portal-error"]').textContent).toBe('Only the manager can do that.');
    });
});

// TASK-2424 (epic 2359 W4.5) — SimpleView Design System v1 styling: the Free
// runs / Subscription / Recent activity sub-sections now go through the
// chassis Section primitive (title + divider), and an empty ledger renders a
// distinct EmptyState rather than nothing at all. These evolve the 2420
// specs above (none of which are deleted) rather than replacing them.
describe('BillingTabPanel — section headings (TASK-2424 SimpleView Section chassis)', () => {
    it('renders titled sections for free runs, subscription and recent activity', () => {
        const c = render({
            loaded: true,
            freeBand: baseFreeBand,
            recentEntries: [{ date: '2026-07-23T10:00:00Z', entry_type: 'debit', amount: '2.00', run: null }]
        });
        const titles = Array.from(c.querySelectorAll('.sv-section-title')).map((el) => el.textContent);
        expect(titles).toInclude('hydrata.anuga.accountFreeRunsHeading');
        expect(titles).toInclude('hydrata.anuga.accountSubscriptionHeading');
        expect(titles).toInclude('hydrata.anuga.accountRecentActivityHeading');
    });
});

describe('BillingTabPanel — recent activity empty state (TASK-2424)', () => {
    it('renders the EmptyState primitive (not nothing) when there are no entries', () => {
        const c = render({ loaded: true, freeBand: baseFreeBand, recentEntries: [] });
        // The 2420 contract still holds: the POPULATED testid stays absent.
        expect(c.querySelector('[data-testid="sv-account-recent-activity"]')).toBe(null);
        // TASK-2424: a distinct empty-state testid now renders in its place.
        const empty = c.querySelector('[data-testid="sv-account-recent-activity-empty"]');
        expect(empty).toExist();
        expect(empty.querySelector('.sv-empty-state')).toExist();
        expect(empty.textContent).toInclude('hydrata.anuga.accountRecentActivityEmpty');
    });
});

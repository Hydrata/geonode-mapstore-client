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
                { date: '2026-07-23T10:00:00Z', entry_type: 'debit', amount: '2.00', run: { run_id: 99, project_id: 5, base_map_id: 1418, project_name: 'Merewether' } },
                { date: '2026-07-22T10:00:00Z', entry_type: 'purchase', amount: '10.00', run: null }
            ]
        });
        const rows = c.querySelectorAll('.sv-account-recent-entry-row');
        expect(rows.length).toBe(2);
        const link = c.querySelector('[data-testid="sv-account-recent-entry-run-link"]');
        expect(link).toExist();
        expect(link.textContent).toBe('Merewether');
        expect(link.getAttribute('href')).toBe('#/map/1418'); // MAP pk, never Project pk (review A6)
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

// ─────────────────────────────────────────────────────────────────────────────
// TASK-2436 (epic 2425 W2) — Billing-tab visual-regression guard.
//
// W2 added unscoped rules for the compute-meter refusal modal, which shares
// two classNames with this panel (.compute-meter-buy-pack-btn and
// .compute-meter-billing-policy-link). Those new rules are all scoped under
// `.compute-meter-modal` precisely so they cannot reach this tab, and the
// pre-existing `.sv-account-billing-tab .compute-meter-*` rules were left
// untouched. This test pins the structural invariant that scoping relies on.
//
// (Karma cannot compare pixels — jsdom has no cascade. What it CAN prove, and
// what actually matters, is that the guarding ancestor is absent here.)
// ─────────────────────────────────────────────────────────────────────────────
describe('BillingTabPanel — TASK-2436 scoping guard', () => {
    it('renders no .compute-meter-modal ancestor, so W2\'s modal rules cannot reach the card', () => {
        const c = render({
            loaded: true,
            balance: '15.00',
            availablePacks: [{ price_id: 'price_a', amount: '10', currency: 'usd' }],
            freeBand: baseFreeBand
        });
        const tab = c.querySelector('[data-testid="sv-account-billing-tab"]');
        expect(tab).toExist();
        expect(c.querySelector('.compute-meter-modal')).toBe(null);
        expect(c.querySelector('.compute-meter-modal-overlay')).toBe(null);
        expect(c.querySelector('.compute-meter-panel')).toBe(null);
    });

    it('still renders the card variant with the shared classNames the tab-scoped rules target', () => {
        const c = render({
            loaded: true,
            balance: '15.00',
            availablePacks: [{ price_id: 'price_a', amount: '10', currency: 'usd' }],
            freeBand: baseFreeBand
        });
        const strip = c.querySelector('[data-testid="compute-meter-balance-strip"]');
        expect(strip.className).toInclude('compute-meter-balance-strip--card');
        expect(c.querySelector('.compute-meter-buy-pack-btn')).toExist();
        expect(c.querySelector('.compute-meter-billing-policy-link')).toExist();
    });
});

// ── TASK-2463 (epic 2425 W2.8): the post-checkout confirmation notice ────────
//
// WHY THIS SURFACE EXISTS. The post-checkout poll used to give up after 60s and
// CLEAR the FE-only `pending` state. W2.5 had already deleted PendingSpinner, so
// after that clear there was nothing left: a customer whose Stripe webhook took
// longer than a minute — which real webhook retries routinely do — saw no
// padlock, no spinner, no toast and no way to re-check, with every surface
// reading the pre-payment state. A money-path terminal state must never be
// silence.
//
// The Billing tab is the home for it because the checkout return OPENS this tab
// (checkoutReturnEpic dispatches setMembershipPanelTab('billing')), and because
// the two things that confirm a purchase — the balance and the subscription
// state — are already on it.
describe('BillingTabPanel — post-checkout confirmation notice (W2.8)', () => {
    const loaded = { loaded: true, isPersonal: true, freeBand: baseFreeBand };

    it('says nothing at all when no purchase is in flight', () => {
        const c = render({ ...loaded, confirming: null });
        expect(c.querySelector('[data-testid="sv-account-confirming"]')).toBe(null);
        expect(c.querySelector('[data-testid="sv-account-confirming-recheck"]')).toBe(null);
    });

    it('while the poll is running: acknowledges the purchase, with no retry button yet', () => {
        const c = render({ ...loaded, confirming: { stalled: false } });
        const notice = c.querySelector('[data-testid="sv-account-confirming"]');
        expect(notice).toExist(
            'the customer just paid and the panel that opened for them says nothing about it'
        );
        expect(notice.textContent.toLowerCase()).toInclude('confirming');
        // Nothing to retry while the poll is still asking on their behalf.
        expect(c.querySelector('[data-testid="sv-account-confirming-recheck"]')).toBe(null);
    });

    it('once stalled: keeps the acknowledgement AND offers an explicit re-check', () => {
        const calls = [];
        const c = render({ ...loaded, confirming: { stalled: true }, onRecheck: () => calls.push(1) });
        const notice = c.querySelector('[data-testid="sv-account-confirming"]');
        expect(notice).toExist('the poll gave up and the customer was told nothing');
        const btn = c.querySelector('[data-testid="sv-account-confirming-recheck"]');
        expect(btn).toExist('a stalled confirmation with no way to re-check is a dead end');
        act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(calls.length).toBe(1, 'the re-check button is wired to nothing');
    });

    it('is announced to assistive tech rather than only being visible', () => {
        const notice = render({ ...loaded, confirming: { stalled: true } })
            .querySelector('[data-testid="sv-account-confirming"]');
        // role="status" carries an implicit aria-live=polite: the notice appears
        // without any user action, so a screen-reader user would otherwise never
        // learn it had arrived.
        expect(notice.getAttribute('role')).toBe('status');
    });

    it('never claims the payment failed or was lost — it claims only what the app knows', () => {
        // THE WORDING IS LOAD-BEARING. The app cannot tell "the webhook has not
        // arrived" from "the webhook arrived for a purchase kind this poll does
        // not watch" (a credit pack is confirmed by the BALANCE, which this
        // notice cannot see — Paywall/reducer.js's SET_ACCOUNT_SUMMARY case).
        // So the copy must describe OUR state, never the customer's money.
        const text = render({ ...loaded, confirming: { stalled: true } })
            .querySelector('[data-testid="sv-account-confirming"]').textContent.toLowerCase();
        ['failed', 'lost', 'not received', 'no payment', 'unsuccessful', 'declined']
            .forEach((banned) => expect(text).toNotInclude(banned, `notice claims "${banned}"`));
    });

    // TASK-2486 (epic 2425 W2.9). THE OTHER HALF OF THE SAME RULE, and the one
    // W2.8 broke while writing the rule down. Its stalled copy opened "We are
    // still confirming your purchase with our payment provider." The shape that
    // reaches this state most often is an UNSUBSCRIBED customer who bought a
    // credit pack (84 of 84 prod owners have no subscription) and whose webhook
    // landed before the poll's first balance read — for them that sentence sits
    // two lines above an ALREADY-CORRECT balance, and Check again cannot clear
    // it, because the endpoints it re-asks are structurally incapable of
    // confirming a pack. A claim the customer's own screen refutes is the defect
    // class this epic exists to remove; "we have not confirmed it" is such a
    // claim just as much as "it failed" is.
    it('never asserts that anything is still outstanding — the app cannot know that either', () => {
        const text = render({ ...loaded, confirming: { stalled: true } })
            .querySelector('[data-testid="sv-account-confirming"]').textContent.toLowerCase();
        ['still confirming', 'we are confirming', 'has not', 'have not', 'waiting for']
            .forEach((banned) => expect(text).toNotInclude(
                banned,
                `stalled notice claims "${banned}" — false for a purchase that has landed by a `
                + 'channel this notice cannot see, which is the commonest way to reach it'
            ));
        // What it MUST still do: say when the figures below were read, and give a
        // way to read them again. Removing the claim must not remove the answer.
        expect(text).toInclude('check again');
    });

    it('does not displace the balance or the subscription state — they are the real confirmation', () => {
        const c = render({
            ...loaded, confirming: { stalled: true }, balance: '10.00',
            subscription: { active: false }, isManager: true
        });
        expect(c.querySelector('[data-testid="sv-account-confirming"]')).toExist();
        expect(c.querySelector('[data-testid="sv-account-subscription-state"]')).toExist();
        expect(c.querySelector('.compute-meter-balance')).toExist();
    });
});

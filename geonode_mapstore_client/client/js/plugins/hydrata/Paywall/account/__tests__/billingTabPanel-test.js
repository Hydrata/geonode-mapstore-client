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

    // TASK-2872 (epic 2839 W5.0b) — two copy defects, fixed in copy only
    // (the underlying `if quoted <= free_threshold` in estimate.py is the
    // intended ruling and is untouched):
    //   (a) BOUNDARY — "under $X" said a run quoted at EXACTLY $X was not
    //       free; it is (`<=`). "$X or less" is the true boundary.
    //   (b) "estimated" was the retired band-era word; plans.html:94 was
    //       already swept to "quoted" by TASK-2849 — this surface was
    //       missed by that sweep.
    it('says "quoted at $X or less" — never the retired-boundary "estimated under $X"', () => {
        const c = render({ loaded: true, freeBand: { cap: 3, usedToday: 0, edge: '5.00' } });
        const section = c.querySelector('[data-testid="sv-account-free-band"]');
        expect(section.textContent).toInclude('quoted at $5.00 or less are free');
        expect(section.textContent).toNotInclude('estimated under');
        expect(section.textContent).toNotInclude('estimated');
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

    it('still renders the balance card with the shared classNames the tab-scoped rules target', () => {
        const c = render({
            loaded: true,
            balance: '15.00',
            availablePacks: [{ price_id: 'price_a', amount: '10', currency: 'usd' }],
            freeBand: baseFreeBand
        });
        const strip = c.querySelector('[data-testid="compute-meter-balance-strip"]');
        // TASK-2458 — the class the tab-scoped rule targets is now the bare
        // .compute-meter-balance-strip: with the inline variant deleted there
        // is only one strip, so the --card modifier distinguished it from
        // nothing.
        expect(strip.className).toBe('compute-meter-balance-strip');
        expect(c.querySelector('.compute-meter-buy-pack-btn')).toExist();
        expect(c.querySelector('.compute-meter-billing-policy-link')).toExist();
    });
});

// ── TASK-2489 (epic 2425 W3c): the confirming notice, REPLACING the W2.10 ────
//    revert ratchet deliberately rather than slipping past it.
//
// The W2.10 ratchet asserted "renders no confirming notice and no re-check,
// whatever props it is handed". That was right for a panel with no channel
// capable of retracting a claim. TASK-2489 gives it one — the polled
// /commerce/balance/ purchase row, anchored to a server timestamp — so the
// notice comes back, under the SAME testid the ratchet named. Renaming it to
// evade those assertions would have been the violation; replacing them, and
// keeping every part that still holds, is the point.
//
// WHAT SURVIVES FROM THE RATCHET, UNCHANGED IN FORCE:
//   (i)   absent when not confirming — the panel must not invent the state;
//   (ii)  NO re-check control in EITHER state — RECHECK_PAYMENT was deleted by
//         26e4aab36 and stays deleted; the poll already re-reads every 3s, and a
//         button that re-asks an endpoint incapable of answering is worse than
//         no button;
//   (iii) the real answer — the subscription pill and the balance — still
//         renders. Adding the claim must not displace the answer, exactly as
//         removing it must not have.
describe('BillingTabPanel — post-checkout confirming notice (TASK-2489)', () => {
    const base = {
        loaded: true, isPersonal: true, freeBand: baseFreeBand,
        isManager: true, balance: '10.00'
    };

    it('(i) renders NO notice when nothing is confirming', () => {
        const c = render({ ...base, confirming: false });
        expect(c.querySelector('[data-testid="sv-account-confirming"]')).toBe(null);
        expect(c.innerHTML).toNotInclude('sv-account-confirming');
    });

    it('renders the notice while a returned checkout is still confirming', () => {
        const c = render({ ...base, confirming: true });
        const notice = c.querySelector('[data-testid="sv-account-confirming"]');
        expect(notice).toExist();
        // i18n'd, not hardcoded English — the four locales that carry
        // checkoutCancelled carry these too (anugaI18n-test.js).
        expect(notice.textContent).toInclude('hydrata.anuga.checkoutConfirming.title');
        expect(notice.textContent).toInclude('hydrata.anuga.checkoutConfirming.message');
        // Announced, because it appears without the customer doing anything.
        expect(notice.getAttribute('role')).toBe('status');
    });

    it('(ii) offers NO re-check control in either state', () => {
        [false, true].forEach((confirming) => {
            const c = render({ ...base, confirming });
            expect(c.querySelector('[data-testid="sv-account-confirming-recheck"]')).toBe(null);
            expect(c.innerHTML).toNotInclude('recheck');
            expect(c.innerHTML).toNotInclude('Check again');
        });
    });

    it('(iii) the real answer still renders underneath it — the claim never displaces the balance', () => {
        const c = render({ ...base, confirming: true, subscription: { active: false } });
        expect(c.querySelector('[data-testid="sv-account-subscription-state"]')).toExist();
        expect(c.querySelector('.compute-meter-balance')).toExist();
        // Order matters: the notice sits ABOVE the balance card, so the customer
        // reads the claim and its resolution in one glance.
        const html = c.innerHTML;
        expect(html.indexOf('sv-account-confirming')).toBeLessThan(html.indexOf('compute-meter-balance-strip'));
    });

    it('defaults to not confirming, so an un-updated caller cannot raise the claim by omission', () => {
        const c = render({ ...base });
        expect(c.querySelector('[data-testid="sv-account-confirming"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-2441 (epic 2425 W4.2) — the Billing tab's money controls disable while
// a checkout create is in flight.
//
// Both surfaces on this tab spend money: the credit-pack buttons in the balance
// card and the $100/mo Subscribe button. Subscribe had no double-submit
// protection whatsoever, while its own sibling Manage-billing has carried
// `disabled={portalLoading}` since UAT-2 — this closes that asymmetry using the
// same treatment.
// ─────────────────────────────────────────────────────────────────────────────
describe('BillingTabPanel — checkout in-flight state (TASK-2441)', () => {
    const base = {
        loaded: true,
        isManager: true,
        manager: 'dave',
        balance: '15.00',
        freeBand: baseFreeBand,
        subscription: {active: false},
        availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}]
    };

    it('Subscribe is disabled and acknowledges the click while a checkout is in flight', () => {
        const c = render({...base, checkoutPending: true});
        const btn = c.querySelector('[data-testid="sv-account-subscribe-btn"]');
        expect(btn.disabled).toBe(true);
        // Mirrors the sibling Manage-billing button's shipped 'Opening…'
        // treatment — a greyed button with unchanged copy still reads as dead.
        expect(btn.textContent).toBe('Opening…');
    });

    it('Subscribe is enabled with its normal label when nothing is in flight', () => {
        const c = render(base);
        const btn = c.querySelector('[data-testid="sv-account-subscribe-btn"]');
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('Subscribe');
    });

    it('the balance card pack buttons are disabled while a checkout is in flight', () => {
        const c = render({...base, checkoutPending: true});
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').disabled).toBe(true);
    });

    it('the balance card pack buttons are enabled by default', () => {
        const c = render(base);
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').disabled).toBe(false);
    });

    it('a disabled Subscribe does not fire onSubscribe', () => {
        let calls = 0;
        const c = render({...base, checkoutPending: true, onSubscribe: () => { calls += 1; }});
        c.querySelector('[data-testid="sv-account-subscribe-btn"]').click();
        expect(calls).toBe(0);
    });
});

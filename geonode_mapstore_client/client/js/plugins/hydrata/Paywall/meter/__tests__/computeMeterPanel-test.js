/**
 * TASK-2100 (epic 2092 W4.2) — ComputeMeterPanel: kill-switch, balance strip,
 * insufficient-balance modal (AC#2), cap-exceeded modal (AC#3, DISTINCT
 * message from insufficient_balance).
 *
 * TASK-2435 (epic 2425 W2) — the map mount became a portal-rendered modal
 * host. Two consequences for this suite, both deliberate:
 *
 *  1. The panel's output no longer lands in the mount container — it is
 *     portaled to document.body. Every query that used to run against
 *     `container` would silently return null, so `render()` now returns
 *     `document` and the modal assertions run against it. Without this the
 *     suite would have gone green only by losing its coverage.
 *  2. The standalone on-map balance strip is gone, so the strip's coverage is
 *     re-homed onto the exported BalanceStrip component, rendered directly.
 *     That is the explicit inline-variant test AC#3 asks for — see the
 *     ESCALATION note in that describe block for why it could not be a test
 *     of a strip "inside the modals".
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import ComputeMeterPanel, {BalanceStrip} from '../components/ComputeMeterPanel';

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
 * Renders the panel and returns the DOCUMENT as the query root: the panel
 * portals to document.body (TASK-2435), so `container` is always empty.
 */
function render(props) {
    act(() => { ReactDOM.render(<ComputeMeterPanel {...props} />, container); });
    return document;
}

/** Renders a bare component into the mount container (no portal involved). */
function renderInContainer(element) {
    act(() => { ReactDOM.render(element, container); });
    return container;
}

describe('ComputeMeterPanel — kill-switch', () => {
    it('renders nothing when enabled=false regardless of other props', () => {
        const c = render({enabled: false, balance: '10.00', modal: {type: 'insufficient_balance'}});
        expect(c.querySelector('[data-testid="compute-meter-panel"]')).toBe(null);
    });

    it('renders nothing when enabled is not provided (default off)', () => {
        const c = render({});
        expect(c.querySelector('[data-testid="compute-meter-panel"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-2435 — the map mount is a modal HOST, not a balance dashboard.
// ─────────────────────────────────────────────────────────────────────────────
describe('ComputeMeterPanel — modal host (TASK-2435)', () => {
    it('renders NOTHING when enabled but no refusal is in flight (no standalone on-map strip)', () => {
        const c = render({
            enabled: true,
            balance: '15.00',
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}]
        });
        expect(c.querySelector('[data-testid="compute-meter-panel"]')).toBe(null);
        expect(c.querySelector('[data-testid="compute-meter-balance-strip"]')).toBe(null);
        expect(c.querySelector('[data-testid="compute-meter-balance"]')).toBe(null);
    });

    it('portals the modal to document.body, OUTSIDE the mount container', () => {
        render({enabled: true, modal: {type: 'insufficient_balance', detail: 'x'}});
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        expect(host).toExist('modal host not rendered');
        // The whole point: it must escape .gn-viewer-layout-body's transform
        // containing block and .gn-page-wrapper's stacking context.
        expect(container.contains(host)).toBe(false);
        expect(host.parentNode).toBe(document.body);
    });

    it('the host carries dialog semantics (role, aria-modal, aria-labelledby -> the modal title)', () => {
        render({enabled: true, modal: {type: 'cap_exceeded', detail: 'x'}});
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        expect(host.getAttribute('role')).toBe('dialog');
        expect(host.getAttribute('aria-modal')).toBe('true');
        const labelledBy = host.getAttribute('aria-labelledby');
        expect(labelledBy).toExist();
        const title = document.getElementById(labelledBy);
        expect(title).toExist('aria-labelledby points at no element');
        expect(title.className).toInclude('compute-meter-modal-title');
    });

    it('unmounts the portal cleanly — no orphan node left in document.body', () => {
        render({enabled: true, modal: {type: 'estimate_ceiling', detail: 'x'}});
        expect(document.querySelector('[data-testid="compute-meter-panel"]')).toExist();
        act(() => { ReactDOM.unmountComponentAtNode(container); });
        expect(document.querySelector('[data-testid="compute-meter-panel"]')).toBe(null);
    });

    it('renders nothing for an unrecognised modal.type (contract break, not an empty dialog)', () => {
        const c = render({enabled: true, modal: {type: 'not_a_real_refusal', detail: 'x'}});
        expect(c.querySelector('[data-testid="compute-meter-panel"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-2435 AC#2 — focus management.
//
// NOTE (gotcha for future readers): jsdom/karma has NO layout engine, so this
// suite can prove focus, Escape and DOM parentage but can NEVER prove
// "in viewport" or "above the map". That half of AC#1 is proved only by the
// Playwright gate, tests/e2e/test_paywall_money_path.py (deploy repo).
// ─────────────────────────────────────────────────────────────────────────────
describe('ComputeMeterPanel — focus trap and Escape (TASK-2435 AC#2)', () => {
    let invoker;
    beforeEach(() => {
        invoker = document.createElement('button');
        invoker.textContent = 'Run';
        document.body.appendChild(invoker);
        invoker.focus();
    });
    afterEach(() => {
        if (invoker && invoker.parentNode) {
            invoker.parentNode.removeChild(invoker);
        }
        invoker = null;
    });

    it('moves focus into the modal on open', () => {
        expect(document.activeElement).toBe(invoker);
        render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        expect(host.contains(document.activeElement)).toBe(true);
        expect(document.activeElement).toNotBe(invoker);
    });

    it('returns focus to the invoking control on close', () => {
        render({enabled: true, modal: {type: 'cap_exceeded', detail: 'x'}});
        expect(document.activeElement).toNotBe(invoker);
        act(() => { ReactDOM.unmountComponentAtNode(container); });
        expect(document.activeElement).toBe(invoker);
    });

    it('Escape calls onDismissModal', () => {
        let dismissed = false;
        render({
            enabled: true,
            modal: {type: 'cap_exceeded', detail: 'x'},
            onDismissModal: () => { dismissed = true; }
        });
        act(() => {
            document.activeElement.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true})
            );
        });
        expect(dismissed).toBe(true);
    });

    it('Tab from the last focusable wraps to the first (focus cannot walk out to the map)', () => {
        render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        const items = host.querySelectorAll('a[href],button:not([disabled])');
        expect(items.length).toBeGreaterThan(1);
        const first = items[0];
        const last = items[items.length - 1];
        last.focus();
        act(() => {
            last.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', keyCode: 9, bubbles: true}));
        });
        expect(document.activeElement).toBe(first);
    });

    it('Shift+Tab from the first focusable wraps to the last', () => {
        render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        const items = host.querySelectorAll('a[href],button:not([disabled])');
        const first = items[0];
        const last = items[items.length - 1];
        first.focus();
        act(() => {
            first.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Tab', keyCode: 9, shiftKey: true, bubbles: true})
            );
        });
        expect(document.activeElement).toBe(last);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BalanceStrip — the inline variant, rendered directly (TASK-2435 AC#3).
//
// ESCALATION recorded here so it is not silently lost: TASK-2435's Context and
// AC#3 assert that the inline variant is "the strip embedded INSIDE the
// modals". It is not, and never was. `grep -rn "<BalanceStrip" js/` returns
// exactly two mounts — BillingTabPanel.js:194 (variant="card") and the
// standalone map mount this task removes. The modals share PackButtons and
// BillingPolicyLink with the strip, not the strip itself; the source comment
// AC#3 appears to paraphrase calls the strip the "refusal-modal HOST surface".
// So AC#3's second clause would mandate NEW UI (a second, duplicate buy-pack
// row inside the insufficient_balance modal), not preserve existing UI.
// What is preserved instead, and asserted below: the inline variant is not
// deleted, still renders, and is still exported.
// ─────────────────────────────────────────────────────────────────────────────
describe('BalanceStrip — inline variant survives the map-mount removal (TASK-2435 AC#3)', () => {
    it('shows the balance, available packs, and recent entries', () => {
        const c = renderInContainer(
            <BalanceStrip
                balance="15.00"
                availablePacks={[{price_id: 'price_a', amount: '10', currency: 'usd'}]}
                recentEntries={[{entry_type: 'debit', amount: '5.00'}]}
            />
        );
        expect(c.querySelector('[data-testid="compute-meter-balance-strip"]')).toExist();
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toInclude('$15.00');
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]')).toExist();
        expect(c.querySelector('[data-testid="compute-meter-recent-entries"]')).toExist();
    });

    it('shows a "no billing account yet" message when balance is null', () => {
        const c = renderInContainer(<BalanceStrip balance={null} />);
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toInclude('No billing account yet');
    });

    it('is the INLINE variant, not the Billing-tab card', () => {
        const c = renderInContainer(<BalanceStrip balance="15.00" />);
        const strip = c.querySelector('[data-testid="compute-meter-balance-strip"]');
        expect(strip.className).toInclude('compute-meter-balance-strip');
        expect(strip.className).toNotInclude('compute-meter-balance-strip--card');
    });
});

describe('BalanceStrip — pack CTA dollar labels (TASK-2124)', () => {
    it('renders "Buy $<amount> pack" when the API resolves an amount', () => {
        const c = renderInContainer(
            <BalanceStrip availablePacks={[{price_id: 'price_a', amount: '10', currency: 'usd'}]} />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('Buy $10 pack');
    });

    it('falls back to the generic label when amount is null (unconfigured/failed lookup)', () => {
        const c = renderInContainer(
            <BalanceStrip availablePacks={[{price_id: 'price_a', amount: null, currency: null}]} />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('Buy credit pack');
    });

    it('renders each pack with its OWN amount label, never a shared/hardcoded one', () => {
        const c = renderInContainer(
            <BalanceStrip
                availablePacks={[
                    {price_id: 'price_a', amount: '10', currency: 'usd'},
                    {price_id: 'price_b', amount: '25', currency: 'usd'}
                ]}
            />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('Buy $10 pack');
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_b"]').textContent).toBe('Buy $25 pack');
    });
});

describe('ComputeMeterPanel — insufficient_balance modal (AC#2)', () => {
    it('shows the modal with detail + pack CTAs when modal.type is insufficient_balance', () => {
        const c = render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'insufficient_balance', checkoutUrl: 'https://x/', detail: 'This run is priced at $5.'}
        });
        expect(c.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toExist();
        expect(c.querySelector('[data-testid="meter-insufficient-balance-detail"]').textContent).toBe('This run is priced at $5.');
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]')).toExist();
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]').textContent).toBe('Buy $10 pack');
        expect(c.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toBe(null);
    });

    it('onBuyPack fires with the clicked priceId', () => {
        let calledWith = null;
        const c = render({
            enabled: true,
            availablePacks: [
                {price_id: 'price_a', amount: '10', currency: 'usd'},
                {price_id: 'price_b', amount: '25', currency: 'usd'}
            ],
            modal: {type: 'insufficient_balance', detail: 'x'},
            onBuyPack: (priceId) => { calledWith = priceId; }
        });
        c.querySelector('[data-testid="meter-buy-pack-cta-price_b"]').click();
        expect(calledWith).toBe('price_b');
    });

    it('onDismissModal fires on Cancel', () => {
        let dismissed = false;
        const c = render({
            enabled: true,
            modal: {type: 'insufficient_balance', detail: 'x'},
            onDismissModal: () => { dismissed = true; }
        });
        c.querySelector('[data-testid="meter-dismiss-modal"]').click();
        expect(dismissed).toBe(true);
    });
});

describe('ComputeMeterPanel — cap_exceeded modal (AC#3, distinct message)', () => {
    it('shows the cap-exceeded modal with its OWN message, NOT the insufficient-balance one', () => {
        const c = render({
            enabled: true,
            modal: {type: 'cap_exceeded', detail: 'Free daily compute-run cap (3) reached.'}
        });
        expect(c.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toExist();
        expect(c.querySelector('[data-testid="meter-cap-exceeded-detail"]').textContent)
            .toBe('Free daily compute-run cap (3) reached.');
        expect(c.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toBe(null);
    });

    it('does NOT offer a pack-purchase CTA (a free-cap breach isn\'t fixed by buying a pack)', () => {
        const c = render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'cap_exceeded', detail: 'capped'}
        });
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]')).toBe(null);
    });
});

describe('ComputeMeterPanel — estimate_ceiling modal (TASK-2123, distinct message)', () => {
    it('shows the estimate-ceiling modal with its OWN message, distinct from insufficient_balance AND cap_exceeded', () => {
        const c = render({
            enabled: true,
            modal: {type: 'estimate_ceiling', detail: 'This run is estimated at $388, above the $20 dispatch ceiling.'}
        });
        expect(c.querySelector('[data-testid="meter-estimate-ceiling-modal"]')).toBeTruthy();
        expect(c.querySelector('[data-testid="meter-estimate-ceiling-detail"]').textContent)
            .toBe('This run is estimated at $388, above the $20 dispatch ceiling.');
        expect(c.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toBe(null);
        expect(c.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toBe(null);
    });

    it('offers a contact-us link, NOT a pack-purchase CTA (no CTA fixes an over-ceiling run)', () => {
        const c = render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'estimate_ceiling', detail: 'too big'}
        });
        expect(c.querySelector('[data-testid="meter-estimate-ceiling-contact-link"]')).toBeTruthy();
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]')).toBe(null);
    });

    it('onDismissModal fires on OK', () => {
        let dismissed = false;
        const c = render({
            enabled: true,
            modal: {type: 'estimate_ceiling', detail: 'too big'},
            onDismissModal: () => { dismissed = true; }
        });
        c.querySelector('[data-testid="meter-dismiss-modal"]').click();
        expect(dismissed).toBe(true);
    });
});

// TASK-2420 (epic 2359 W4.5) — "View account" on all three refusal modals,
// routing to the Account panel's Billing tab (UAT-1 findings 4+13: the
// discoverable home for balance/free-run accounting).
describe('ComputeMeterPanel — "View account" on all three refusal modals (TASK-2420)', () => {
    it('insufficient_balance modal calls onViewAccount', () => {
        let called = false;
        const c = render({
            enabled: true,
            modal: {type: 'insufficient_balance', detail: 'x'},
            onViewAccount: () => { called = true; }
        });
        c.querySelector('[data-testid="meter-insufficient-balance-view-account"]').click();
        expect(called).toBe(true);
    });

    it('cap_exceeded modal calls onViewAccount', () => {
        let called = false;
        const c = render({
            enabled: true,
            modal: {type: 'cap_exceeded', detail: 'x'},
            onViewAccount: () => { called = true; }
        });
        c.querySelector('[data-testid="meter-cap-exceeded-view-account"]').click();
        expect(called).toBe(true);
    });

    it('estimate_ceiling modal calls onViewAccount', () => {
        let called = false;
        const c = render({
            enabled: true,
            modal: {type: 'estimate_ceiling', detail: 'x'},
            onViewAccount: () => { called = true; }
        });
        c.querySelector('[data-testid="meter-estimate-ceiling-view-account"]').click();
        expect(called).toBe(true);
    });
});

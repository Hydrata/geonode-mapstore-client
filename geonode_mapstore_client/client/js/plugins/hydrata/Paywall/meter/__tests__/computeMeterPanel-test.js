/**
 * TASK-2100 (epic 2092 W4.2) — ComputeMeterPanel: kill-switch, balance strip,
 * insufficient-balance modal (AC#2), cap-exceeded modal (AC#3, DISTINCT
 * message from insufficient_balance).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import ComputeMeterPanel from '../components/ComputeMeterPanel';

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
    act(() => { ReactDOM.render(<ComputeMeterPanel {...props} />, container); });
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

describe('ComputeMeterPanel — balance strip (AC#4, minimal, no polish)', () => {
    it('shows the balance, available packs, and recent entries', () => {
        const c = render({
            enabled: true,
            balance: '15.00',
            availablePacks: ['price_a'],
            recentEntries: [{entry_type: 'debit', amount: '5.00'}]
        });
        expect(c.querySelector('[data-testid="compute-meter-panel"]')).toExist();
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toInclude('$15.00');
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]')).toExist();
        expect(c.querySelector('[data-testid="compute-meter-recent-entries"]')).toExist();
    });

    it('shows a "no billing account yet" message when balance is null', () => {
        const c = render({enabled: true, balance: null});
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toInclude('No billing account yet');
    });
});

describe('ComputeMeterPanel — insufficient_balance modal (AC#2)', () => {
    it('shows the modal with detail + pack CTAs when modal.type is insufficient_balance', () => {
        const c = render({
            enabled: true,
            availablePacks: ['price_a'],
            modal: {type: 'insufficient_balance', checkoutUrl: 'https://x/', detail: 'This run is priced at $5.'}
        });
        expect(c.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toExist();
        expect(c.querySelector('[data-testid="meter-insufficient-balance-detail"]').textContent).toBe('This run is priced at $5.');
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]')).toExist();
        expect(c.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toBe(null);
    });

    it('onBuyPack fires with the clicked priceId', () => {
        let calledWith = null;
        const c = render({
            enabled: true,
            availablePacks: ['price_a', 'price_b'],
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
            availablePacks: ['price_a'],
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
            availablePacks: ['price_a'],
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

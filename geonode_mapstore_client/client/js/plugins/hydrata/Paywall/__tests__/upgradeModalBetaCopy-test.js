/**
 * TASK-2639 (epic 2635 W1) — the privacy 402's upgrade_prompt modal no
 * longer offers a dead Stripe TEST-mode checkout CTA.
 *
 * _check_private_entitlement_response (api_v2.py) now sends
 * checkout_url: null unconditionally for every upgrade_prompt refusal —
 * that ABSENCE is what selects the beta copy branch below (betaMode in
 * PaywallPanel.js's UpgradeModal), never a visibility/tier check, so a
 * future BE regression that starts sending a real URL again would
 * immediately restore the original Subscribe CTA rather than silently
 * hiding it forever.
 *
 * AC4 (2639) — "offers no dead payment action for this 402": the subscribe
 * CTA must be ABSENT, not merely disabled/unlinked.
 * AC2 (2639) — the new copy is asserted verbatim.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import PaywallPanel from '../components/PaywallPanel';

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

function renderPaywall(props) {
    act(() => {
        ReactDOM.render(<PaywallPanel {...props} />, container);
    });
    return document;
}

describe('TASK-2639 UpgradeModal — beta copy replaces the dead checkout CTA', () => {
    it('AC4 — checkout_url: null renders NO subscribe CTA at all (not disabled — ABSENT)', () => {
        const doc = renderPaywall({
            paywallEnabled: true,
            paywallPayload: { state: 'upgrade_prompt', checkout_url: null, read_only: false, visibility: 'private' }
        });
        expect(doc.querySelector('[data-testid="upgrade-modal"]')).toExist();
        expect(doc.querySelector('[data-testid="subscribe-cta"]')).toBe(null);
    });

    it('AC2 — the beta copy is asserted verbatim', () => {
        const doc = renderPaywall({
            paywallEnabled: true,
            paywallPayload: { state: 'upgrade_prompt', checkout_url: null, read_only: false, visibility: 'private' }
        });
        const modal = doc.querySelector('[data-testid="upgrade-modal"]');
        expect(modal.querySelector('.paywall-upgrade-modal-title').textContent).toBe('Not available during beta');
        expect(modal.querySelector('.paywall-upgrade-modal-body').textContent).toBe(
            "Private models aren't available during beta — contact us if you need one."
        );
    });

    it('beta copy is identical for organization refusals too (no dead CTA regardless of tier)', () => {
        const doc = renderPaywall({
            paywallEnabled: true,
            paywallPayload: { state: 'upgrade_prompt', checkout_url: null, read_only: false, visibility: 'organization' }
        });
        expect(doc.querySelector('[data-testid="subscribe-cta"]')).toBe(null);
        expect(doc.querySelector('.paywall-upgrade-modal-title').textContent).toBe('Not available during beta');
    });

    it('AC4 — non-payment actions (View account, Keep it public) remain available', () => {
        const doc = renderPaywall({
            paywallEnabled: true,
            paywallPayload: { state: 'upgrade_prompt', checkout_url: null, read_only: false, visibility: 'private' }
        });
        expect(doc.querySelector('[data-testid="paywall-view-account"]')).toExist();
        expect(doc.querySelector('[data-testid="dismiss-upgrade"]')).toExist();
        expect(doc.querySelector('[data-testid="paywall-billing-policy-link"]')).toExist();
    });

    it('regression — a truthy checkout_url still renders the ORIGINAL subscribe CTA + tier copy (shape unchanged for that branch)', () => {
        const doc = renderPaywall({
            paywallEnabled: true,
            paywallPayload: {
                state: 'upgrade_prompt', checkout_url: 'https://x/create-session/',
                read_only: false, visibility: 'private'
            }
        });
        const cta = doc.querySelector('[data-testid="subscribe-cta"]');
        expect(cta).toExist();
        expect(cta.textContent).toBe('Subscribe & make private');
        expect(doc.querySelector('.paywall-upgrade-modal-title').textContent)
            .toBe('Private models require a subscription');
    });
});

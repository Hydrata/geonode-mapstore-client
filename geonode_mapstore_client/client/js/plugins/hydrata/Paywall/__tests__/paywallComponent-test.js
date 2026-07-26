/**
 * TASK-1357 — Karma contract-assertion tests for the PaywallPanel component.
 *
 * These tests load paywall_contract.json VERBATIM and drive the PaywallPanel
 * component through each of the six states defined there, asserting the rendered
 * UX matches docs/strategy/paywall-ux-design.md.
 *
 * Kill-switch: when PAYWALL_ENABLED=false the component renders nothing.
 * Fixture-mode: PAYWALL_FIXTURE_MODE=true renders each state from the fixture
 * without any live backend call (used here for all state assertions).
 *
 * Contract source: apps/gn_anuga/fixtures/paywall_contract.json
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import PaywallPanel from '../components/PaywallPanel';

// Load the contract fixture verbatim from the canonical location.
// Webpack resolves this from the project root alias @js which maps to
// geonode_mapstore_client/client/js. The fixture lives in hydrata/apps/gn_anuga/fixtures/
// but is symlinked / aliased in the test webpack config. We import it directly
// from its absolute source via a relative path from this test file.
//
// The fixture path from this test:
//   __tests__/paywallComponent-test.js
//   → Paywall/components/PaywallPanel.js  (imports fixture at runtime)
//
// For Karma, we import the JS-module version of the fixture that PaywallPanel
// re-exports so this test never duplicates or re-authors the contract shape.
import { CONTRACT_FIXTURE, getStatePayload } from '../paywallContract';

// Minimal DOM container for ReactDOM render
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

/**
 * Renders PaywallPanel and returns the DOCUMENT as the query root.
 *
 * W2 remediation — the panel's output no longer lands in the mount container.
 * Every rendered state is portaled to document.body: the blocking
 * upgrade_prompt through the shared ModalHost, the advisory states through the
 * anchored shell. Both had to leave the plugin's in-flow mount point, which
 * measured at rect [0, 668, 1408, 16] on a 683px-tall map route in a document
 * that cannot scroll (see PaywallPanel.render). Exactly the change
 * computeMeterPanel-test.js made for TASK-2435, for exactly the same reason:
 * without it every query below would silently return null and the suite would
 * go green by losing its coverage instead of by passing.
 *
 * The absence assertions stay honest because afterEach unmounts the container,
 * which tears the portal out of document.body too.
 */
function renderPaywall(props) {
    act(() => {
        ReactDOM.render(
            <PaywallPanel {...props} />,
            container
        );
    });
    return document;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture shape assertions — the contract file must have the expected shape.
// If paywall_contract.json changes its shape, these fail before the UX tests do.
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — contract fixture shape', () => {
    // v1.1 (TASK-2432 -> mirrored by TASK-2446): `paid_organization` joined
    // the paid steady state, taking the fixture from 6 states to 7.
    it('fixture has _meta with version 1.1', () => {
        expect(CONTRACT_FIXTURE._meta).toExist();
        expect(CONTRACT_FIXTURE._meta.version).toBe('1.1');
    });

    it('fixture has exactly 7 states', () => {
        expect(CONTRACT_FIXTURE.states).toExist();
        expect(CONTRACT_FIXTURE.states.length).toBe(7);
    });

    const EXPECTED_STATES = [
        'free_public', 'upgrade_prompt', 'pending', 'paid_private',
        'paid_organization', 'past_due', 'anon'
    ];

    EXPECTED_STATES.forEach(stateName => {
        it(`fixture has state: ${stateName}`, () => {
            const entry = CONTRACT_FIXTURE.states.find(s => s.state === stateName);
            expect(entry).toExist(`state ${stateName} not found in fixture`);
        });
    });

    it('free_public payload: read_only=false, checkout_url=null', () => {
        const { payload } = getStatePayload('free_public');
        expect(payload.state).toBe('free_public');
        expect(payload.read_only).toBe(false);
        expect(payload.checkout_url).toBe(null);
    });

    it('upgrade_prompt payload: read_only=false, checkout_url is a string', () => {
        const { payload } = getStatePayload('upgrade_prompt');
        expect(payload.state).toBe('upgrade_prompt');
        expect(payload.read_only).toBe(false);
        expect(typeof payload.checkout_url).toBe('string');
    });

    it('pending payload: read_only=false, checkout_url=null', () => {
        const { payload } = getStatePayload('pending');
        expect(payload.state).toBe('pending');
        expect(payload.read_only).toBe(false);
        expect(payload.checkout_url).toBe(null);
    });

    it('paid_private payload: read_only=false, checkout_url=null', () => {
        const { payload } = getStatePayload('paid_private');
        expect(payload.state).toBe('paid_private');
        expect(payload.read_only).toBe(false);
        expect(payload.checkout_url).toBe(null);
    });

    it('past_due payload: read_only=TRUE (contract rule), checkout_url is a string', () => {
        const { payload } = getStatePayload('past_due');
        expect(payload.state).toBe('past_due');
        expect(payload.read_only).toBe(true);
        expect(typeof payload.checkout_url).toBe('string');
    });

    it('anon payload: null (no paywall block for anonymous callers)', () => {
        const entry = CONTRACT_FIXTURE.states.find(s => s.state === 'anon');
        expect(entry.payload).toBe(null);
    });

    it('fixture has hard_contract_rules: lapse rule present', () => {
        const rules = CONTRACT_FIXTURE.hard_contract_rules;
        expect(Array.isArray(rules)).toBe(true);
        const lapseRule = rules.find(r => r.includes('LAPSE NEVER AUTO-PUBLISHES'));
        expect(lapseRule).toExist('hard contract rule LAPSE NEVER AUTO-PUBLISHES not found');
    });

    it('_meta documents pending as FE-only (no backend DB marker)', () => {
        expect(CONTRACT_FIXTURE._meta.note_on_pending).toExist();
        expect(CONTRACT_FIXTURE._meta.note_on_pending).toContain('FE-only');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kill-switch: PAYWALL_ENABLED=false → renders nothing
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — kill-switch (PAYWALL_ENABLED=false)', () => {
    it('renders nothing when paywallEnabled=false regardless of state', () => {
        const c = renderPaywall({
            paywallEnabled: false,
            fixtureMode: true,
            fixtureState: 'free_public'
        });
        // No paywall root element should be present
        expect(c.querySelector('[data-testid="paywall-panel"]')).toBe(null);
    });

    it('renders nothing when paywallEnabled is not provided (default off)', () => {
        const c = renderPaywall({
            fixtureMode: true,
            fixtureState: 'paid_private'
        });
        expect(c.querySelector('[data-testid="paywall-panel"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: free_public — shows "Make private" CTA
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: free_public', () => {
    let c;
    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'free_public'
        });
    });

    it('renders the paywall panel', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist();
    });

    it('shows the "Make private" CTA button', () => {
        const btn = c.querySelector('[data-testid="make-private-btn"]');
        expect(btn).toExist('"Make private" button not found in free_public state');
    });

    it('does not show upgrade_prompt modal', () => {
        expect(c.querySelector('[data-testid="upgrade-modal"]')).toBe(null);
    });

    it('does not show dunning banner', () => {
        expect(c.querySelector('[data-testid="dunning-banner"]')).toBe(null);
    });

    it('does not show pending spinner', () => {
        expect(c.querySelector('[data-testid="pending-spinner"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: upgrade_prompt — shows upgrade modal with checkout_url
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: upgrade_prompt', () => {
    let c;
    const checkoutUrl = getStatePayload('upgrade_prompt').payload.checkout_url;

    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'upgrade_prompt'
        });
    });

    it('renders the paywall panel', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist();
    });

    it('shows upgrade modal', () => {
        const modal = c.querySelector('[data-testid="upgrade-modal"]');
        expect(modal).toExist('upgrade modal not found in upgrade_prompt state');
    });

    it('modal contains a subscribe CTA link pointing to checkout_url', () => {
        const cta = c.querySelector('[data-testid="subscribe-cta"]');
        expect(cta).toExist('"Subscribe" CTA not found');
        // The CTA href or data attribute should reference the checkout URL from the fixture
        const href = cta.getAttribute('href') || cta.getAttribute('data-href');
        expect(href).toBe(checkoutUrl);
    });

    it('modal contains a "Keep it public" dismiss action', () => {
        const dismiss = c.querySelector('[data-testid="dismiss-upgrade"]');
        expect(dismiss).toExist('"Keep it public" dismiss action not found');
    });

    it('does not show dunning banner', () => {
        expect(c.querySelector('[data-testid="dunning-banner"]')).toBe(null);
    });

    // TASK-2420 (epic 2359 W4.5) — "View account" -> Account panel Billing tab.
    it('modal contains a "View account" action that calls onViewAccount', () => {
        let called = false;
        const cWithHandler = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'upgrade_prompt',
            onViewAccount: () => { called = true; }
        });
        const viewAccount = cWithHandler.querySelector('[data-testid="paywall-view-account"]');
        expect(viewAccount).toExist('"View account" action not found');
        viewAccount.click();
        expect(called).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: pending — shows spinner (FE-only transient)
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: pending (FE-only transient)', () => {
    let c;

    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'pending'
        });
    });

    it('renders the paywall panel', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist();
    });

    it('shows pending spinner', () => {
        const spinner = c.querySelector('[data-testid="pending-spinner"]');
        expect(spinner).toExist('pending spinner not found');
    });

    it('does not show upgrade modal', () => {
        expect(c.querySelector('[data-testid="upgrade-modal"]')).toBe(null);
    });

    it('does not show dunning banner', () => {
        expect(c.querySelector('[data-testid="dunning-banner"]')).toBe(null);
    });

    it('does not show "Make private" CTA (already in transition)', () => {
        expect(c.querySelector('[data-testid="make-private-btn"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: paid_private — normal view, manage-billing CTA
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: paid_private', () => {
    let c;

    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'paid_private'
        });
    });

    it('renders the paywall panel', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist();
    });

    it('shows "private" badge indicator', () => {
        const badge = c.querySelector('[data-testid="private-badge"]');
        expect(badge).toExist('private badge not found in paid_private state');
    });

    it('does not show upgrade modal', () => {
        expect(c.querySelector('[data-testid="upgrade-modal"]')).toBe(null);
    });

    it('does not show dunning banner', () => {
        expect(c.querySelector('[data-testid="dunning-banner"]')).toBe(null);
    });

    it('does not show pending spinner', () => {
        expect(c.querySelector('[data-testid="pending-spinner"]')).toBe(null);
    });

    it('does not show "Make private" CTA (project already private)', () => {
        expect(c.querySelector('[data-testid="make-private-btn"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: paid_organization — TASK-2446 (epic 2425 W2).
//
// REGRESSION GUARD: before this case existed the switch fell through to
// `default: content = null`, so the ENTIRE panel was suppressed — every
// assertion below would have been null. This is the blank-render gap that
// blocked the PAYWALL_ENABLED flip.
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: paid_organization (TASK-2446)', () => {
    let c;

    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'paid_organization'
        });
    });

    it('renders the paywall panel (NOT a blank/null render)', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist(
            'paid_organization fell through to the default null branch'
        );
    });

    it('shows an organization badge indicator', () => {
        const badge = c.querySelector('[data-testid="organization-badge"]');
        expect(badge).toExist('organization badge not found in paid_organization state');
        expect(badge.textContent).toInclude('Organization');
    });

    it('carries a distinguishing modifier class so it can be styled apart from Private', () => {
        const badge = c.querySelector('[data-testid="organization-badge"]');
        expect(badge.className).toInclude('paywall-private-badge');
        expect(badge.className).toInclude('paywall-private-badge--organization');
    });

    it('is DISTINCT from the paid_private badge (not conflated)', () => {
        expect(c.querySelector('[data-testid="private-badge"]')).toBe(null);
        expect(c.querySelector('[data-testid="organization-badge"]').textContent)
            .toNotInclude('Private');
    });

    it('shows no upgrade modal, dunning banner, pending spinner or make-private CTA', () => {
        expect(c.querySelector('[data-testid="upgrade-modal"]')).toBe(null);
        expect(c.querySelector('[data-testid="dunning-banner"]')).toBe(null);
        expect(c.querySelector('[data-testid="pending-spinner"]')).toBe(null);
        expect(c.querySelector('[data-testid="make-private-btn"]')).toBe(null);
    });

    it('contract payload is read_only=false, checkout_url=null', () => {
        const { payload } = getStatePayload('paid_organization');
        expect(payload.state).toBe('paid_organization');
        expect(payload.read_only).toBe(false);
        expect(payload.checkout_url).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: past_due — non-blocking dunning banner, renew CTA
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: past_due', () => {
    let c;
    const renewUrl = getStatePayload('past_due').payload.checkout_url;

    beforeEach(() => {
        c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'past_due'
        });
    });

    it('renders the paywall panel', () => {
        expect(c.querySelector('[data-testid="paywall-panel"]')).toExist();
    });

    it('shows the dunning banner', () => {
        const banner = c.querySelector('[data-testid="dunning-banner"]');
        expect(banner).toExist('dunning banner not found in past_due state');
    });

    it('dunning banner contains renew CTA pointing to checkout_url', () => {
        const cta = c.querySelector('[data-testid="renew-cta"]');
        expect(cta).toExist('"Renew subscription" CTA not found');
        const href = cta.getAttribute('href') || cta.getAttribute('data-href');
        expect(href).toBe(renewUrl);
    });

    it('does NOT render a hard lockout (read_only is advisory only)', () => {
        // The project UI must remain accessible — no hard-blocking overlay
        expect(c.querySelector('[data-testid="hard-lockout"]')).toBe(null);
    });

    it('does not show upgrade modal', () => {
        expect(c.querySelector('[data-testid="upgrade-modal"]')).toBe(null);
    });

    it('does not show "Make private" CTA (project already private)', () => {
        expect(c.querySelector('[data-testid="make-private-btn"]')).toBe(null);
    });

    it('does not offer "revert to public due to lapse" affordance (contract rule)', () => {
        // HARD CONTRACT RULE: lapse never auto-publishes
        expect(c.querySelector('[data-testid="revert-to-public"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State: anon — no paywall key in my_perms; component renders nothing
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — state: anon (no paywall block)', () => {
    it('renders nothing when paywallPayload is null (anon)', () => {
        const c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'anon'
        });
        // For anon, the paywall panel itself should not render (no billing context)
        expect(c.querySelector('[data-testid="paywall-panel"]')).toBe(null);
    });

    it('renders nothing when paywallPayload is undefined (key absent)', () => {
        // This simulates the backend omitting the paywall key entirely
        const c = renderPaywall({
            paywallEnabled: true,
            paywallPayload: undefined
        });
        expect(c.querySelector('[data-testid="paywall-panel"]')).toBe(null);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hard contract rule: past_due NEVER offers auto-revert-to-public
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — hard contract rule: lapse never auto-publishes', () => {
    it('past_due state has no "revert to public" element', () => {
        const c = renderPaywall({
            paywallEnabled: true,
            fixtureMode: true,
            fixtureState: 'past_due'
        });
        expect(c.querySelector('[data-testid="revert-to-public"]')).toBe(null);
        expect(c.querySelector('[data-testid="auto-publish-on-lapse"]')).toBe(null);
    });
});

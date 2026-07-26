/**
 * TASK-1357 — Karma contract-assertion tests for the PaywallPanel component.
 * Rescoped by TASK-2463 (epic 2425 W2.5).
 *
 * These tests load paywall_contract.json VERBATIM and drive PaywallPanel
 * through all seven states defined there. What they assert changed shape in
 * W2.5: the component now renders exactly ONE state (the blocking
 * upgrade_prompt modal) and NOTHING for the five non-blocking ones, because
 * the map is a modal host, not a badge surface. See PaywallPanel.js's
 * docstring for where each state's information went instead.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. jsdom has no layout engine and no
 * cascade, so nothing here is evidence about position, visibility, viewport
 * containment or paint order — a rule EXISTING is not a rule APPLYING. It
 * proves DOM facts only: which nodes exist, and (via assertPortaledToBody)
 * where in the tree they landed. Every geometric claim in this epic is carried
 * by tests/e2e/test_paywall_money_path.py.
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
 * WHY `document` AND NOT `container` — and why that is not a free pass.
 * The one state this component still renders (upgrade_prompt) is portaled to
 * document.body by ModalHost, so it never lands in the mount container;
 * querying `container` would return null for everything and the suite would go
 * green by losing its coverage instead of by passing. Exactly the change
 * computeMeterPanel-test.js made for TASK-2435.
 *
 * The honest-scope caveat (raised against this file in the W2 adversarial
 * pass): querying `document` makes an ABSENCE assertion strong (nothing
 * anywhere in the page) but makes a PRESENCE assertion blind to *where* the
 * node landed — it would pass for an in-flow render just as happily as for a
 * portal. That is why `assertPortaledToBody` below exists and is called in the
 * upgrade_prompt block: the mount point is the thing this epic keeps getting
 * wrong, so it gets its own explicit assertion rather than being implied.
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

/**
 * Asserts the node is a DIRECT child of document.body — i.e. genuinely
 * portaled out, not merely findable from `document`. Karma cannot prove
 * geometry (jsdom has no layout engine and no cascade), so this proves the one
 * structural half it can: the node escaped the plugin's in-flow mount point,
 * which measured at rect [0, 668, 1408, 16] on a 683px-tall non-scrolling map
 * route. The "is it actually visible / above every layer" half is the
 * Playwright suite's job (tests/e2e/test_paywall_money_path.py).
 */
function assertPortaledToBody(node, what) {
    expect(node).toExist(`${what} did not render at all`);
    expect(node.parentNode).toBe(
        document.body,
        `${what} is in the page but NOT a direct child of document.body ` +
        '(parent was ' + (node.parentNode && node.parentNode.nodeName) + ') — ' +
        'it did not escape the in-flow mount point'
    );
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
// TASK-2463 (epic 2425 W2.5) — THE FIVE NON-BLOCKING STATES RENDER NOTHING.
//
// This block REPLACES five per-state describes that asserted the opposite
// (make-private CTA, pending spinner, private badge, organization badge,
// dunning banner, each inside a `[data-testid="paywall-panel"]` shell anchored
// top-centre over the map). Those tests were not wrong when written — they
// encoded W2's anchored direction, which the operator rejected at the UAT
// gate. They are replaced rather than deleted so the reversal is legible.
//
// The queries run against `document`, so this is the strongest form of the
// claim available in karma: the state produces no node ANYWHERE in the page,
// portaled or in-flow. What karma still cannot prove is the geometric half —
// "nothing intersects the map canvas". That is asserted at the map-canvas
// centre by test_paywall_map_is_clean_at_rest_for_every_steady_state in
// tests/e2e/test_paywall_money_path.py, which is the only place it CAN be
// proved. Do not read this block as a geometry guarantee.
// ─────────────────────────────────────────────────────────────────────────────
describe('PaywallPanel — the non-blocking states render nothing (TASK-2463)', () => {
    const STEADY_STATES = ['free_public', 'pending', 'paid_private', 'paid_organization', 'past_due'];

    // Every testid the deleted sub-components used to emit, plus the shell.
    // Listed explicitly (not derived) so resurrecting any one of them by name
    // fails here rather than silently re-appearing over someone's map.
    const FORBIDDEN = [
        'paywall-panel',
        'make-private-cta', 'make-private-btn',
        'pending-spinner',
        'private-badge', 'organization-badge', 'manage-billing-link',
        'dunning-banner', 'renew-cta', 'dismiss-dunning'
    ];

    STEADY_STATES.forEach(stateName => {
        it(`${stateName}: emits no paywall node anywhere in the document`, () => {
            const c = renderPaywall({
                paywallEnabled: true,
                fixtureMode: true,
                fixtureState: stateName
            });
            FORBIDDEN.forEach(testid => {
                expect(c.querySelector(`[data-testid="${testid}"]`)).toBe(
                    null,
                    `${stateName} rendered [data-testid="${testid}"] — the map is a modal host, not a badge surface`
                );
            });
        });
    });

    it('past_due does not render a hard lockout (read_only is advisory only)', () => {
        const c = renderPaywall({ paywallEnabled: true, fixtureMode: true, fixtureState: 'past_due' });
        expect(c.querySelector('[data-testid="hard-lockout"]')).toBe(null);
    });

    it('the anchored shell className is gone from the markup, not just unstyled', () => {
        // guard:paywall-css flags a className with NO rule but never a rule
        // with no className, so the CSS side cannot catch a half-revert. This
        // does: paywall.css deleted `.paywall-panel--anchored`, so emitting it
        // again would ship an unstyled browser-default box.
        STEADY_STATES.concat(['upgrade_prompt']).forEach(stateName => {
            const c = renderPaywall({ paywallEnabled: true, fixtureMode: true, fixtureState: stateName });
            expect(c.querySelector('.paywall-panel--anchored')).toBe(
                null, `${stateName} re-emitted .paywall-panel--anchored`
            );
        });
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

    // TASK-2463 — the one structural claim karma can make about the mount
    // point. This file had ZERO assertion that anything portals, which is how
    // an in-flow regression could have passed all 45 of its other assertions.
    it('the modal host is a DIRECT child of document.body (portaled, not in flow)', () => {
        assertPortaledToBody(c.querySelector('[data-testid="paywall-panel"]'), 'the upgrade modal host');
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
    // Trivially true since TASK-2463 (past_due renders nothing here at all),
    // and kept exactly for that reason: the rule outlives this component's
    // current shape, and the day someone re-adds a past_due surface this is
    // the assertion that must still hold.
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

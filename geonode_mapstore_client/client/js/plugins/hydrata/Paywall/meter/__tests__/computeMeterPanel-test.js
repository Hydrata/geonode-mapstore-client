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

    // W2 remediation — THE REAL RUN -> 402 PATH, which the test above does not
    // reproduce. scenarioHeaderActions.js's fireDebounced disables the Run
    // button SYNCHRONOUSLY on click (startDebounce), so by the time the server
    // answers 402 and this modal mounts, document.activeElement is already
    // <body> and the shipped "restore focus" was a guaranteed no-op. The
    // synthetic invoker above never disables, which is exactly why it passed.
    //
    // The fix is two-part and both parts are asserted here: remember the control
    // the customer actually PRESSED (tracked from module load, before the click
    // can disable it), and — when that control can no longer take focus back —
    // land on a deterministic neighbour in the same cluster, not <body>.
    describe('the invoker disables itself on click (the real Run -> 402 path)', () => {
        let cluster;
        let runBtn;
        let buildBtn;

        /**
         * A real user click is mousedown -> mouseup -> click. HTMLElement.click()
         * dispatches ONLY the click, so a test that uses it alone is not
         * exercising the path the customer takes. The press is the whole point
         * here: it is the last moment at which the Run button is still enabled.
         */
        const userClick = (el) => {
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
            el.click();
        };

        beforeEach(() => {
            cluster = document.createElement('div');
            runBtn = document.createElement('button');
            runBtn.textContent = 'Run';
            // Exactly what fireDebounced does: disable on click, synchronously.
            runBtn.addEventListener('click', () => { runBtn.disabled = true; });
            buildBtn = document.createElement('button');
            buildBtn.textContent = 'Build';
            cluster.appendChild(runBtn);
            cluster.appendChild(buildBtn);
            document.body.appendChild(cluster);
        });
        afterEach(() => {
            if (cluster && cluster.parentNode) {
                cluster.parentNode.removeChild(cluster);
            }
            cluster = runBtn = buildBtn = null;
        });

        it('does not dump focus on <body> when the invoker disabled itself', () => {
            runBtn.focus();
            expect(document.activeElement).toBe(runBtn);
            userClick(runBtn);
            // The browser blurs a disabled element — this is the state the
            // modal actually mounts into on the real path.
            expect(runBtn.disabled).toBe(true);
            expect(document.activeElement).toNotBe(runBtn);

            render({enabled: true, modal: {type: 'insufficient_balance', detail: 'x'}});
            act(() => { ReactDOM.unmountComponentAtNode(container); });

            expect(document.activeElement).toNotBe(document.body);
            // Deterministic target: the nearest focusable control in the same
            // cluster the customer was working in — not the map, not <body>.
            expect(document.activeElement).toBe(buildBtn);
        });

        it('still prefers the invoker itself when it is re-enabled by close time', () => {
            runBtn.focus();
            userClick(runBtn);
            render({enabled: true, modal: {type: 'insufficient_balance', detail: 'x'}});
            // The debounce window expires while the modal is open.
            runBtn.disabled = false;
            act(() => { ReactDOM.unmountComponentAtNode(container); });
            expect(document.activeElement).toBe(runBtn);
        });
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

    // Cumulative-review catch (TASK-2435 Phase 1.7). The backdrop deliberately
    // does NOT dismiss, so a customer who clicks it moves focus to <body>. With
    // the keydown handler bound to the host via onKeyDown, Escape would never
    // fire again and the dialog would be un-closable by keyboard. The listener
    // is on `document` for exactly this case.
    it('Escape still closes after focus has left the dialog (backdrop click)', () => {
        let dismissed = false;
        render({
            enabled: true,
            modal: {type: 'cap_exceeded', detail: 'x'},
            onDismissModal: () => { dismissed = true; }
        });
        // Simulate focus escaping the dialog, as a backdrop click does.
        document.body.focus();
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        expect(host.contains(document.activeElement)).toBe(false);
        act(() => {
            document.body.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true})
            );
        });
        expect(dismissed).toBe(true);
    });

    it('Tab pulls focus back in when it has escaped the dialog', () => {
        render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        act(() => {
            document.body.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Tab', keyCode: 9, bubbles: true})
            );
        });
        expect(host.contains(document.activeElement)).toBe(true);
    });

    // Cumulative-review catch (TASK-2435 Phase 1.7). A second refusal can
    // replace the first without an intervening dismiss; without key={modal.type}
    // React reconciles the host in place, the mount effect does not re-run, and
    // focus is left on a button that no longer exists.
    it('a modal-type swap while open re-enters focus into the NEW dialog', () => {
        render({
            enabled: true,
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        act(() => {
            ReactDOM.render(
                <ComputeMeterPanel enabled modal={{type: 'cap_exceeded', detail: 'y'}} />,
                container
            );
        });
        const host = document.querySelector('[data-testid="compute-meter-panel"]');
        expect(document.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toExist();
        expect(document.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toBe(null);
        expect(host.contains(document.activeElement)).toBe(true);
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
// BalanceStrip — ONE variant, the Billing-tab card (TASK-2458).
//
// History, kept because it is the whole reason this task exists: TASK-2435
// removed the standalone on-map balance strip, which was the inline variant's
// only app mount. The escalation recorded here at the time noted that AC#3's
// "the strip embedded INSIDE the modals" was never true — the modals share
// PackButtons and BillingPolicyLink with the strip, not the strip itself — and
// so W2 kept the inline branch alive, exported and tested, rather than deleting
// it. "Kept, tested, and unmounted" is a holding position, not an end state:
// dead-but-tested code survives every refactor precisely because the tests
// pass.
//
// The operator closed AC1's first branch on 2026-07-27: the inline variant does
// NOT get a mount beside Run — giving it one would reintroduce exactly the
// on-map furniture W2.5 removed when the visibility indicator became a padlock
// on the account button. So the branch is deleted and BalanceStrip is simply
// the card it has actually been since TASK-2435. With one variant left, the
// --card modifier modified nothing and is gone too; the single class now
// carries the rule that used to sit on the modifier.
// ─────────────────────────────────────────────────────────────────────────────
describe('BalanceStrip — one variant, the Billing-tab card (TASK-2458)', () => {
    it('renders the card markup with no variant prop at all', () => {
        const c = renderInContainer(
            <BalanceStrip
                balance="15.00"
                availablePacks={[{price_id: 'price_a', amount: '10', currency: 'usd'}]}
            />
        );
        expect(c.querySelector('[data-testid="compute-meter-balance-strip"]')).toExist();
        expect(c.querySelector('.compute-meter-balance-row')).toExist();
        expect(c.querySelector('.compute-meter-balance-label').textContent).toBe('Compute balance');
        // The card's 2dp figure, not the inline branch's raw `$${balance}`.
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toBe('$15.00');
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]')).toExist();
    });

    it('carries exactly one className — no --card modifier to distinguish', () => {
        const c = renderInContainer(<BalanceStrip balance="15.00" />);
        const strip = c.querySelector('[data-testid="compute-meter-balance-strip"]');
        expect(strip.className).toBe('compute-meter-balance-strip');
    });

    it('shows a "no billing account yet" message when balance is null', () => {
        const c = renderInContainer(<BalanceStrip balance={null} />);
        expect(c.querySelector('[data-testid="compute-meter-balance"]').textContent).toInclude('No billing account yet');
    });

    it('never renders a recent-entries list, even when handed entries', () => {
        // The rendering went with the inline branch. BillingTabPanel — the one
        // app mount — deliberately does not pass recentEntries: it renders its
        // own richer list (dates, run links). This is the assertion that keeps
        // the paywall CSS guard's deleted .compute-meter-recent-entries
        // allowlist entry from needing to come back.
        const c = renderInContainer(
            <BalanceStrip balance="15.00" recentEntries={[{entry_type: 'debit', amount: '5.00'}]} />
        );
        expect(c.querySelector('[data-testid="compute-meter-recent-entries"]')).toBe(null);
    });
});

describe('BalanceStrip — pack CTA dollar labels (TASK-2124)', () => {
    // TASK-2458 — these three used to render the inline variant, so they
    // asserted PackButtons' VERBOSE labels. The strip is now always the card,
    // which passes `compact`, so they assert the compact labels here. The
    // verbose form did not lose its coverage with the branch: it is what the
    // refusal modals render, asserted in the insufficient_balance describe
    // above ('Buy $10 pack' on meter-buy-pack-cta-price_a) and by the
    // null-amount fallback case below.
    it('renders "+ $<amount>" when the API resolves an amount', () => {
        const c = renderInContainer(
            <BalanceStrip availablePacks={[{price_id: 'price_a', amount: '10', currency: 'usd'}]} />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('+ $10');
    });

    it('falls back to the generic label when amount is null (unconfigured/failed lookup)', () => {
        const c = renderInContainer(
            <BalanceStrip availablePacks={[{price_id: 'price_a', amount: null, currency: null}]} />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('Buy credits');
    });

    it('the modal CTAs keep the VERBOSE label, including the null-amount fallback', () => {
        // Same TASK-2124 contract on the other surface: never a hardcoded
        // price->dollar map, and a null amount still renders a working button.
        const c = render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: null, currency: null}],
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]').textContent).toBe('Buy credit pack');
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
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').textContent).toBe('+ $10');
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_b"]').textContent).toBe('+ $25');
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

// TASK-2849 (epic 2839 W2.2) — email_unverified modal (TASK-2844's dispatch
// gate). NOT a billing refusal: no pack CTA, no "View account" link — the
// only action is Resend.
describe('ComputeMeterPanel — email_unverified modal (TASK-2849)', () => {
    it('shows the email-unverified modal with the server detail, distinct from every other modal', () => {
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'Please verify your email address before running a model.', resendUrl: '/resend/'}
        });
        expect(c.querySelector('[data-testid="meter-email-unverified-modal"]')).toBeTruthy();
        expect(c.querySelector('[data-testid="meter-email-unverified-detail"]').textContent)
            .toBe('Please verify your email address before running a model.');
        expect(c.querySelector('[data-testid="meter-insufficient-balance-modal"]')).toBe(null);
        expect(c.querySelector('[data-testid="meter-cap-exceeded-modal"]')).toBe(null);
        expect(c.querySelector('[data-testid="meter-estimate-ceiling-modal"]')).toBe(null);
    });

    it('offers a Resend CTA, never a pack-purchase or View-account CTA (not a billing refusal)', () => {
        const c = render({
            enabled: true,
            availablePacks: [{price_id: 'price_a', amount: '10', currency: 'usd'}],
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'}
        });
        expect(c.querySelector('[data-testid="meter-resend-verification-cta"]')).toBeTruthy();
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]')).toBe(null);
        expect(c.querySelector('[data-testid="meter-email-unverified-view-account"]')).toBe(null);
    });

    it('onResendVerification fires when the Resend CTA is clicked', () => {
        let clicked = 0;
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
            onResendVerification: () => { clicked++; }
        });
        c.querySelector('[data-testid="meter-resend-verification-cta"]').click();
        expect(clicked).toBe(1);
    });

    it('the Resend CTA disables and reads "Sending…" while a resend is pending', () => {
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
            resendVerification: {pending: true, status: null, detail: null}
        });
        const btn = c.querySelector('[data-testid="meter-resend-verification-cta"]');
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toBe('Sending…');
    });

    it('shows "sent" feedback after a successful resend', () => {
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
            resendVerification: {pending: false, status: 'sent', detail: null}
        });
        expect(c.querySelector('[data-testid="meter-resend-verification-feedback"]').textContent)
            .toBe('Verification email sent — check your inbox.');
    });

    it('shows the server-supplied cooldown detail verbatim, not a hardcoded copy', () => {
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
            resendVerification: {pending: false, status: 'cooldown', detail: 'A verification email was sent recently. Please wait a few minutes before resending.'}
        });
        expect(c.querySelector('[data-testid="meter-resend-verification-feedback"]').textContent)
            .toBe('A verification email was sent recently. Please wait a few minutes before resending.');
    });

    it('shows no feedback line before any resend has been attempted', () => {
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
            resendVerification: {pending: false, status: null, detail: null}
        });
        expect(c.querySelector('[data-testid="meter-resend-verification-feedback"]')).toBe(null);
    });

    it('onDismissModal fires on OK', () => {
        let dismissed = false;
        const c = render({
            enabled: true,
            modal: {type: 'email_unverified', detail: 'verify', resendUrl: '/resend/'},
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

// ─── TASK-2441 (epic 2425 W4.2): buy controls disable while a checkout is in
// flight ──────────────────────────────────────────────────────────────────────
//
// Two clicks used to create two live Stripe checkout sessions. The epic's store
// read is the authoritative guard; this is the affordance that stops a customer
// reaching for the second click during the ~4-6s of silence before the tab
// opens. PackButtons has TWO mounts, so both are asserted — the Billing tab's
// card strip is the one that spends money most often.
describe('buy controls disabled while a checkout is in flight (TASK-2441)', () => {
    const packs = [
        {price_id: 'price_a', amount: '10', currency: 'usd'},
        {price_id: 'price_b', amount: '25', currency: 'usd'}
    ];

    it('insufficient-balance modal: every pack CTA is disabled when checkoutPending', () => {
        const c = render({
            enabled: true,
            availablePacks: packs,
            checkoutPending: true,
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]').disabled).toBe(true);
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_b"]').disabled).toBe(true);
    });

    it('insufficient-balance modal: pack CTAs are enabled when nothing is in flight', () => {
        const c = render({
            enabled: true,
            availablePacks: packs,
            modal: {type: 'insufficient_balance', detail: 'x'}
        });
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_a"]').disabled).toBe(false);
        expect(c.querySelector('[data-testid="meter-buy-pack-cta-price_b"]').disabled).toBe(false);
    });

    // TASK-2458 — this used to be two specs, one per variant, asserting the
    // same thing about the same markup. With one variant left they were the
    // same test twice; the surviving one keeps both pack assertions.
    it('BalanceStrip (Billing tab card): pack buttons are disabled when pending', () => {
        const c = renderInContainer(
            <BalanceStrip balance="15.00" availablePacks={packs} pending />
        );
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').disabled).toBe(true);
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_b"]').disabled).toBe(true);
    });

    it('BalanceStrip: pack buttons are enabled by default', () => {
        const c = renderInContainer(<BalanceStrip balance="15.00" availablePacks={packs} />);
        expect(c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').disabled).toBe(false);
    });

    it('a disabled pack button does not fire onBuyPack', () => {
        let calls = 0;
        const c = renderInContainer(
            <BalanceStrip
                balance="15.00"
                availablePacks={packs}
                pending
                onBuyPack={() => { calls += 1; }}
            />
        );
        c.querySelector('[data-testid="compute-meter-buy-pack-price_a"]').click();
        expect(calls).toBe(0);
    });
});

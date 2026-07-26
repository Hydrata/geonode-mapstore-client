/**
 * ComputeMeterPanel — compute-meter FE surface (TASK-2100, epic 2092 W4.2).
 *
 * Kill-switch: `enabled` (from the balance endpoint's dark/live response,
 * commerce.balance_views.AccountBalanceView) — renders null when false.
 * Ships DARK by construction: flag-off's fixed response IS `enabled: false`.
 *
 * TASK-2435 (epic 2425 W2) — THE MAP MOUNT IS A MODAL HOST, NOT A DASHBOARD.
 * ------------------------------------------------------------------------
 * This component used to render an always-on balance strip in normal flow,
 * with the refusal modal as a sibling underneath it. Because every
 * compute-meter-* rule in the bundle was scoped `.msgapi
 * .sv-account-billing-tab .compute-meter-*` (account.css — the Billing-tab
 * embedding), the map mount got position:static/z-index:auto and landed in
 * normal flow AFTER a map that fills 100% of .gn-viewer-layout-center, in a
 * document that cannot scroll. Measured: every modal rendered at exactly
 * viewportHeight + 55px, at both 1408x683 and 1305x1327. All three refusal
 * modals were invisible for that one reason.
 *
 * position:fixed alone does NOT fix it. On the map route
 * `.msgapi .page-map-viewer .gn-viewer-layout-body { transform: translate(0) }`
 * makes that element the containing block for fixed descendants, AND
 * `.gn-page-wrapper` carries z-index:99999. So the overlay must leave the
 * viewer layout entirely — hence createPortal to document.body, following
 * hydrologyDetailIdfTable.js's IdfCurveModal (the overlay shell) and
 * anugaScenarioOverflowMenu.js (Escape + focus handling). `.msgapi` is on
 * <body> itself, so themePrefix-ed rules still match a body-level portal.
 *
 * Decision 6: balance and price belong where the spend decision is made
 * (beside Run, W3) and the Billing tab remains the top-up surface — so the
 * standalone on-map balance strip is GONE. The panel now renders nothing at
 * all until a refusal arrives, then portals exactly one modal:
 * insufficient_balance -> pack purchase CTAs; cap_exceeded -> its OWN
 * distinct message (never conflated); estimate_ceiling (TASK-2123) -> a
 * contact-us path (no CTA fixes an over-ceiling run).
 *
 * BalanceStrip itself is NOT deleted — it is still the Billing tab's balance
 * card (variant="card", BillingTabPanel.js) and its default inline variant
 * stays exported and directly covered by computeMeterPanel-test.js.
 */
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
// TASK-2436 — imported by the component that EMITS the markup, not by a
// sibling panel, so the modal can never ship without its stylesheet again.
import '../meter.css';
const PropTypes = require('prop-types');

/**
 * Shared "Buy credit pack" button row — used by BOTH the always-visible
 * balance strip and the insufficient_balance modal. `testIdPrefix` keeps
 * each surface's data-testid distinct (compute-meter-buy-pack-* vs
 * meter-buy-pack-cta-*) so tests can disambiguate context without either
 * surface duplicating the render logic.
 *
 * TASK-2124 — `availablePacks` entries are `{price_id, amount, currency}`
 * (commerce.balance_views.AccountBalanceView / checkout_views.get_credit_pack_options).
 * `amount` is a server-resolved dollar figure (a cached Stripe Price lookup)
 * or `null` when unresolvable (unconfigured Stripe keys on localhost/dark
 * sites, or a failed lookup) — NEVER a hardcoded price->dollar map here.
 * A null amount renders the pre-2124 generic label so checkout still works.
 */
function PackButtons({ availablePacks, testIdPrefix, onBuyPack, compact }) {
    if (!availablePacks || availablePacks.length === 0) {
        return null;
    }
    // UAT-2 redesign — `compact` (Account panel balance card only) renders the
    // primary "+ $10" form; the refusal-modal CTAs keep the verbose label.
    return (
        <React.Fragment>
            {availablePacks.map(({ price_id: priceId, amount }) => (
                <button
                    type="button"
                    key={priceId}
                    data-testid={`${testIdPrefix}-${priceId}`}
                    className="compute-meter-buy-pack-btn"
                    onClick={() => onBuyPack(priceId)}
                >
                    {compact
                        ? (amount ? `+ $${amount}` : 'Buy credits')
                        : (amount ? `Buy $${amount} pack` : 'Buy credit pack')}
                </button>
            ))}
        </React.Fragment>
    );
}

/**
 * BillingPolicyLink — shared "Refund & billing policy" link (TASK-2367) used
 * by BOTH the always-visible balance strip and the estimate_ceiling modal.
 * `testIdPrefix` keeps each surface's data-testid distinct, mirroring the
 * PackButtons pattern above.
 */
function BillingPolicyLink({ testIdPrefix }) {
    return (
        <a
            data-testid={`${testIdPrefix}-billing-policy-link`}
            className="compute-meter-billing-policy-link"
            href="/billing-policy"
        >
            Refund &amp; billing policy
        </a>
    );
}

BillingPolicyLink.propTypes = {
    testIdPrefix: PropTypes.string.isRequired
};

PackButtons.propTypes = {
    availablePacks: PropTypes.array,
    testIdPrefix: PropTypes.string.isRequired,
    onBuyPack: PropTypes.func
};

PackButtons.defaultProps = {
    availablePacks: [],
    onBuyPack: () => {}
};

function BalanceStrip({ balance, availablePacks, recentEntries, onBuyPack, variant }) {
    // UAT-2 redesign — `variant="card"` (Account panel Billing tab only):
    // uppercase-labelled balance card, 2dp value, compact primary pack
    // buttons right of the figure. The default inline strip (refusal-modal
    // host surface) is byte-identical to before.
    const isCard = variant === 'card';
    const noAccount = balance === null || balance === undefined;
    const cardValue = () => {
        const n = parseFloat(balance);
        return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${balance}`;
    };
    return (
        <div data-testid="compute-meter-balance-strip" className={`compute-meter-balance-strip${isCard ? ' compute-meter-balance-strip--card' : ''}`}>
            {isCard ? (
                <div className="compute-meter-balance-row">
                    <span className="compute-meter-balance-labelled">
                        <span className="compute-meter-balance-label">Compute balance</span>
                        <span data-testid="compute-meter-balance" className="compute-meter-balance">
                            {noAccount ? 'No billing account yet' : cardValue()}
                        </span>
                    </span>
                    {availablePacks && availablePacks.length > 0 ? (
                        <span className="compute-meter-packs">
                            <PackButtons availablePacks={availablePacks} testIdPrefix="compute-meter-buy-pack" onBuyPack={onBuyPack} compact />
                        </span>
                    ) : null}
                </div>
            ) : (
                <React.Fragment>
                    <span data-testid="compute-meter-balance" className="compute-meter-balance">
                        {'Compute balance: '}
                        {noAccount ? 'No billing account yet' : `$${balance}`}
                    </span>
                    {availablePacks && availablePacks.length > 0 ? (
                        <span className="compute-meter-packs">
                            <PackButtons availablePacks={availablePacks} testIdPrefix="compute-meter-buy-pack" onBuyPack={onBuyPack} />
                        </span>
                    ) : null}
                </React.Fragment>
            )}
            {recentEntries && recentEntries.length > 0 ? (
                <ul data-testid="compute-meter-recent-entries" className="compute-meter-recent-entries">
                    {/* index-as-key: read-only, server-ordered list, no reorder/insert */}
                    {recentEntries.map((entry, idx) => (
                        <li key={idx}>
                            {`${entry.entry_type} $${entry.amount}`}
                        </li>
                    ))}
                </ul>
            ) : null}
            <BillingPolicyLink testIdPrefix="compute-meter" />
        </div>
    );
}

BalanceStrip.propTypes = {
    balance: PropTypes.string,
    availablePacks: PropTypes.array,
    recentEntries: PropTypes.array,
    onBuyPack: PropTypes.func,
    variant: PropTypes.oneOf(['inline', 'card'])
};

BalanceStrip.defaultProps = {
    balance: null,
    availablePacks: [],
    recentEntries: [],
    onBuyPack: () => {}
};

/**
 * TASK-2420 (epic 2359 W4.5) — shared "View account" link, used by all three
 * compute-meter refusal modals to route to the Account panel's Billing tab
 * (the discoverable home for balance/free-run accounting UAT-1 found
 * missing). `testIdPrefix` mirrors PackButtons/BillingPolicyLink's pattern.
 */
function ViewAccountLink({ testIdPrefix, onViewAccount }) {
    return (
        <button
            type="button"
            data-testid={`${testIdPrefix}-view-account`}
            className="compute-meter-view-account-link"
            onClick={onViewAccount}
        >
            View account
        </button>
    );
}

ViewAccountLink.propTypes = {
    testIdPrefix: PropTypes.string.isRequired,
    onViewAccount: PropTypes.func
};

/**
 * The one id every refusal modal's <h2> carries, so MeterModalHost can point
 * aria-labelledby at it without knowing which modal it is hosting. Safe as a
 * single shared id because the three modals are mutually exclusive — exactly
 * one is ever mounted (see ComputeMeterPanel.render).
 */
const MODAL_TITLE_ID = 'compute-meter-modal-title';

/** Tab-cycle candidates inside an open modal. */
const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * MeterModalHost — TASK-2435. Portals its child overlay to document.body so
 * the refusal modal escapes .gn-viewer-layout-body's transform containing
 * block and .gn-page-wrapper's stacking context (see the module docstring),
 * and gives it dialog semantics: Escape closes, Tab cycles within, focus
 * enters on open and returns to the invoking control on close.
 *
 * Deliberately NO backdrop-click-to-dismiss (unlike IdfCurveModal, which is
 * an informational chart): these are refusals the customer has to read and
 * act on, and each already carries an explicit Cancel/OK. A stray click on
 * the backdrop silently discarding "you have no balance" is exactly the
 * failure mode this epic exists to remove.
 */
function MeterModalHost({ children, onDismiss }) {
    const hostRef = useRef(null);
    // Captured synchronously at mount, restored at unmount — this is the
    // "returns to the invoking control" half of AC#2. There is no in-DOM
    // trigger for these modals (they arrive as Redux actions from a refused
    // Run dispatch), so the invoking control is whatever had focus when the
    // refusal landed — normally the Run button the customer just pressed.
    const previouslyFocusedRef = useRef(null);

    const focusable = useCallback(() => {
        if (!hostRef.current) {
            return [];
        }
        return Array.prototype.slice.call(hostRef.current.querySelectorAll(FOCUSABLE));
    }, []);

    // useLayoutEffect, not useEffect, for the same synchronous-attach reason
    // anugaScenarioOverflowMenu.js documents: the handler must be live before
    // the browser can deliver an Escape to the newly painted dialog.
    useLayoutEffect(() => {
        previouslyFocusedRef.current = document.activeElement;
        const items = focusable();
        if (items.length > 0) {
            items[0].focus();
        } else if (hostRef.current) {
            hostRef.current.focus();
        }
        return () => {
            const previous = previouslyFocusedRef.current;
            // Only restore if the invoking control is still in the document
            // and still focusable — otherwise leave focus where the browser
            // put it rather than throwing it to <body>.
            if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
                previous.focus();
            }
        };
    }, [focusable]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            e.stopPropagation();
            onDismiss();
            return;
        }
        if (e.key !== 'Tab' && e.keyCode !== 9) {
            return;
        }
        const items = focusable();
        if (items.length === 0) {
            e.preventDefault();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        // Wrap at both ends so Tab can never walk out into the map behind.
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    if (typeof document === 'undefined') {
        return null;
    }

    return ReactDOM.createPortal(
        <div
            ref={hostRef}
            data-testid="compute-meter-panel"
            className="compute-meter-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={MODAL_TITLE_ID}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
        >
            {children}
        </div>,
        document.body
    );
}

MeterModalHost.propTypes = {
    children: PropTypes.node,
    onDismiss: PropTypes.func
};

MeterModalHost.defaultProps = {
    onDismiss: () => {}
};

/** Insufficient-balance 402 -> modal -> pack purchase CTAs (AC#2). */
function InsufficientBalanceModal({ detail, availablePacks, onBuyPack, onDismiss, onViewAccount }) {
    return (
        <div data-testid="meter-insufficient-balance-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 id={MODAL_TITLE_ID} className="compute-meter-modal-title">Insufficient compute balance</h2>
                <p data-testid="meter-insufficient-balance-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
                    <PackButtons availablePacks={availablePacks} testIdPrefix="meter-buy-pack-cta" onBuyPack={onBuyPack} />
                    <ViewAccountLink testIdPrefix="meter-insufficient-balance" onViewAccount={onViewAccount} />
                    <button
                        type="button"
                        data-testid="meter-dismiss-modal"
                        className="compute-meter-dismiss-btn"
                        onClick={onDismiss}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

InsufficientBalanceModal.propTypes = {
    detail: PropTypes.string,
    availablePacks: PropTypes.array,
    onBuyPack: PropTypes.func,
    onDismiss: PropTypes.func,
    onViewAccount: PropTypes.func
};

/**
 * Cap-exceeded 429 -> its OWN distinct message (AC#3) — no pack CTA (a free
 * dispatch, not a paid one; buying a pack doesn't lift a per-day free cap).
 */
function CapExceededModal({ detail, onDismiss, onViewAccount }) {
    return (
        <div data-testid="meter-cap-exceeded-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 id={MODAL_TITLE_ID} className="compute-meter-modal-title">Daily free-run limit reached</h2>
                <p data-testid="meter-cap-exceeded-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
                    <ViewAccountLink testIdPrefix="meter-cap-exceeded" onViewAccount={onViewAccount} />
                    <button
                        type="button"
                        data-testid="meter-dismiss-modal"
                        className="compute-meter-dismiss-btn"
                        onClick={onDismiss}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}

CapExceededModal.propTypes = {
    detail: PropTypes.string,
    onDismiss: PropTypes.func,
    onViewAccount: PropTypes.func
};

/**
 * Estimate-ceiling 402 -> its OWN distinct message (TASK-2123) — a run
 * priced above the launch dispatch ceiling. NEVER conflated with
 * insufficient_balance (no pack purchase fixes this) or cap_exceeded (a
 * different, free-band limit) — a contact-us path instead of a buy CTA.
 */
function EstimateCeilingModal({ detail, onDismiss, onViewAccount }) {
    return (
        <div data-testid="meter-estimate-ceiling-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 id={MODAL_TITLE_ID} className="compute-meter-modal-title">This run is too large to dispatch automatically</h2>
                <p data-testid="meter-estimate-ceiling-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
                    <a
                        data-testid="meter-estimate-ceiling-contact-link"
                        className="compute-meter-contact-link"
                        href="mailto:david.kennewell@hydrata.com?subject=Compute%20estimate%20ceiling"
                    >
                        Contact us
                    </a>
                    <ViewAccountLink testIdPrefix="meter-estimate-ceiling" onViewAccount={onViewAccount} />
                    <button
                        type="button"
                        data-testid="meter-dismiss-modal"
                        className="compute-meter-dismiss-btn"
                        onClick={onDismiss}
                    >
                        OK
                    </button>
                </div>
                <BillingPolicyLink testIdPrefix="meter-estimate-ceiling" />
            </div>
        </div>
    );
}

EstimateCeilingModal.propTypes = {
    detail: PropTypes.string,
    onDismiss: PropTypes.func,
    onViewAccount: PropTypes.func
};

class ComputeMeterPanel extends React.Component {
    static propTypes = {
        /** Kill-switch — from the balance endpoint's `enabled` field. Default false (dark). */
        enabled: PropTypes.bool,
        /**
         * Only needed by the insufficient_balance modal's buy-pack CTAs.
         * `balance` / `recentEntries` were dropped with the standalone strip
         * (TASK-2435) — BalanceStrip still takes them, on the Billing tab.
         */
        availablePacks: PropTypes.array,
        /** {type: 'insufficient_balance'|'cap_exceeded'|'estimate_ceiling', checkoutUrl, detail} | null */
        modal: PropTypes.shape({
            type: PropTypes.string,
            checkoutUrl: PropTypes.string,
            detail: PropTypes.string
        }),
        onBuyPack: PropTypes.func,
        onDismissModal: PropTypes.func,
        // TASK-2420 (epic 2359 W4.5) — "View account" on all three refusal
        // modals, opening the Account panel's Billing tab.
        onViewAccount: PropTypes.func
    };

    static defaultProps = {
        enabled: false,
        availablePacks: [],
        modal: null,
        onBuyPack: () => {},
        onDismissModal: () => {},
        onViewAccount: () => {}
    };

    render() {
        const { enabled, availablePacks, modal, onBuyPack, onDismissModal, onViewAccount } = this.props;

        // Kill-switch: render nothing when the backend reports no meter
        // (ships dark — see commerce.balance_views.AccountBalanceView).
        if (!enabled) {
            return null;
        }

        // TASK-2435 — modal HOST, not a dashboard. With no refusal in flight
        // there is nothing to show on the map; the balance lives in the
        // Billing tab and (W3) beside Run.
        if (!modal) {
            return null;
        }

        // Exactly one modal, ever — the three refusal reasons are mutually
        // exclusive and are never conflated. Selecting here (rather than
        // three independent && branches) makes that exclusivity structural.
        let content = null;
        if (modal.type === 'insufficient_balance') {
            content = (
                <InsufficientBalanceModal
                    detail={modal.detail}
                    availablePacks={availablePacks}
                    onBuyPack={onBuyPack}
                    onDismiss={onDismissModal}
                    onViewAccount={onViewAccount}
                />
            );
        } else if (modal.type === 'cap_exceeded') {
            content = (<CapExceededModal detail={modal.detail} onDismiss={onDismissModal} onViewAccount={onViewAccount} />);
        } else if (modal.type === 'estimate_ceiling') {
            content = (<EstimateCeilingModal detail={modal.detail} onDismiss={onDismissModal} onViewAccount={onViewAccount} />);
        }

        // An unrecognised modal.type is a contract break, not a reason to
        // paint an empty dialog over the customer's map.
        if (!content) {
            return null;
        }

        return (
            <MeterModalHost onDismiss={onDismissModal}>
                {content}
            </MeterModalHost>
        );
    }
}

export default ComputeMeterPanel;
export { BalanceStrip, MeterModalHost, InsufficientBalanceModal, CapExceededModal, EstimateCeilingModal, ViewAccountLink };

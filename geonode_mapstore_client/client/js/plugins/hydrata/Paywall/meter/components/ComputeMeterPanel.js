/**
 * ComputeMeterPanel — compute-meter FE surface (TASK-2100, epic 2092 W4.2).
 *
 * Kill-switch: `enabled` (from the balance endpoint's dark/live response,
 * commerce.balance_views.AccountBalanceView) — renders null when false.
 * Ships DARK by construction: flag-off's fixed response IS `enabled: false`.
 *
 * Two states, same component (mirrors PaywallPanel's single-component,
 * multi-state design):
 *   - Minimal balance strip (AC#4): balance + available packs + recent
 *     ledger entries. No polish — a compact read-only summary, not a full
 *     wallet page.
 *   - Modal overlay (AC#2/AC#3), shown ON TOP of the strip when `modal` is
 *     set: insufficient_balance -> pack purchase CTAs; cap_exceeded -> its
 *     OWN distinct message (never conflated with insufficient_balance).
 *     TASK-2123 adds a THIRD, equally distinct state: estimate_ceiling -> a
 *     contact-us path (no CTA fixes an over-ceiling run — never conflated
 *     with either of the other two).
 */
import React from 'react';
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

/** Insufficient-balance 402 -> modal -> pack purchase CTAs (AC#2). */
function InsufficientBalanceModal({ detail, availablePacks, onBuyPack, onDismiss, onViewAccount }) {
    return (
        <div data-testid="meter-insufficient-balance-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 className="compute-meter-modal-title">Insufficient compute balance</h2>
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
                <h2 className="compute-meter-modal-title">Daily free-run limit reached</h2>
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
                <h2 className="compute-meter-modal-title">This run is too large to dispatch automatically</h2>
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
        balance: PropTypes.string,
        availablePacks: PropTypes.array,
        recentEntries: PropTypes.array,
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
        balance: null,
        availablePacks: [],
        recentEntries: [],
        modal: null,
        onBuyPack: () => {},
        onDismissModal: () => {},
        onViewAccount: () => {}
    };

    render() {
        const { enabled, balance, availablePacks, recentEntries, modal, onBuyPack, onDismissModal, onViewAccount } = this.props;

        // Kill-switch: render nothing when the backend reports no meter
        // (ships dark — see commerce.balance_views.AccountBalanceView).
        if (!enabled) {
            return null;
        }

        return (
            <div data-testid="compute-meter-panel" className="compute-meter-panel">
                <BalanceStrip
                    balance={balance}
                    availablePacks={availablePacks}
                    recentEntries={recentEntries}
                    onBuyPack={onBuyPack}
                />
                {modal && modal.type === 'insufficient_balance' ? (
                    <InsufficientBalanceModal
                        detail={modal.detail}
                        availablePacks={availablePacks}
                        onBuyPack={onBuyPack}
                        onDismiss={onDismissModal}
                        onViewAccount={onViewAccount}
                    />
                ) : null}
                {modal && modal.type === 'cap_exceeded' ? (
                    <CapExceededModal detail={modal.detail} onDismiss={onDismissModal} onViewAccount={onViewAccount} />
                ) : null}
                {modal && modal.type === 'estimate_ceiling' ? (
                    <EstimateCeilingModal detail={modal.detail} onDismiss={onDismissModal} onViewAccount={onViewAccount} />
                ) : null}
            </div>
        );
    }
}

export default ComputeMeterPanel;
export { BalanceStrip, InsufficientBalanceModal, CapExceededModal, EstimateCeilingModal, ViewAccountLink };

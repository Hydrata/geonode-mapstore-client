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
 */
import React from 'react';
const PropTypes = require('prop-types');

/**
 * Shared "Buy credit pack" button row — used by BOTH the always-visible
 * balance strip and the insufficient_balance modal. `testIdPrefix` keeps
 * each surface's data-testid distinct (compute-meter-buy-pack-* vs
 * meter-buy-pack-cta-*) so tests can disambiguate context without either
 * surface duplicating the render logic.
 */
function PackButtons({ availablePacks, testIdPrefix, onBuyPack }) {
    if (!availablePacks || availablePacks.length === 0) {
        return null;
    }
    return (
        <React.Fragment>
            {availablePacks.map((priceId) => (
                <button
                    type="button"
                    key={priceId}
                    data-testid={`${testIdPrefix}-${priceId}`}
                    className="compute-meter-buy-pack-btn"
                    onClick={() => onBuyPack(priceId)}
                >
                    Buy credit pack
                </button>
            ))}
        </React.Fragment>
    );
}

PackButtons.propTypes = {
    availablePacks: PropTypes.array,
    testIdPrefix: PropTypes.string.isRequired,
    onBuyPack: PropTypes.func
};

PackButtons.defaultProps = {
    availablePacks: [],
    onBuyPack: () => {}
};

function BalanceStrip({ balance, availablePacks, recentEntries, onBuyPack }) {
    return (
        <div data-testid="compute-meter-balance-strip" className="compute-meter-balance-strip">
            <span data-testid="compute-meter-balance" className="compute-meter-balance">
                {'Compute balance: '}
                {balance === null || balance === undefined ? 'No billing account yet' : `$${balance}`}
            </span>
            {availablePacks && availablePacks.length > 0 ? (
                <span className="compute-meter-packs">
                    <PackButtons availablePacks={availablePacks} testIdPrefix="compute-meter-buy-pack" onBuyPack={onBuyPack} />
                </span>
            ) : null}
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
        </div>
    );
}

BalanceStrip.propTypes = {
    balance: PropTypes.string,
    availablePacks: PropTypes.array,
    recentEntries: PropTypes.array,
    onBuyPack: PropTypes.func
};

BalanceStrip.defaultProps = {
    balance: null,
    availablePacks: [],
    recentEntries: [],
    onBuyPack: () => {}
};

/** Insufficient-balance 402 -> modal -> pack purchase CTAs (AC#2). */
function InsufficientBalanceModal({ detail, availablePacks, onBuyPack, onDismiss }) {
    return (
        <div data-testid="meter-insufficient-balance-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 className="compute-meter-modal-title">Insufficient compute balance</h2>
                <p data-testid="meter-insufficient-balance-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
                    <PackButtons availablePacks={availablePacks} testIdPrefix="meter-buy-pack-cta" onBuyPack={onBuyPack} />
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
    onDismiss: PropTypes.func
};

/**
 * Cap-exceeded 429 -> its OWN distinct message (AC#3) — no pack CTA (a free
 * dispatch, not a paid one; buying a pack doesn't lift a per-day free cap).
 */
function CapExceededModal({ detail, onDismiss }) {
    return (
        <div data-testid="meter-cap-exceeded-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 className="compute-meter-modal-title">Daily free-run limit reached</h2>
                <p data-testid="meter-cap-exceeded-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
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
    onDismiss: PropTypes.func
};

class ComputeMeterPanel extends React.Component {
    static propTypes = {
        /** Kill-switch — from the balance endpoint's `enabled` field. Default false (dark). */
        enabled: PropTypes.bool,
        balance: PropTypes.string,
        availablePacks: PropTypes.array,
        recentEntries: PropTypes.array,
        /** {type: 'insufficient_balance'|'cap_exceeded', checkoutUrl, detail} | null */
        modal: PropTypes.shape({
            type: PropTypes.string,
            checkoutUrl: PropTypes.string,
            detail: PropTypes.string
        }),
        onBuyPack: PropTypes.func,
        onDismissModal: PropTypes.func
    };

    static defaultProps = {
        enabled: false,
        balance: null,
        availablePacks: [],
        recentEntries: [],
        modal: null,
        onBuyPack: () => {},
        onDismissModal: () => {}
    };

    render() {
        const { enabled, balance, availablePacks, recentEntries, modal, onBuyPack, onDismissModal } = this.props;

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
                    />
                ) : null}
                {modal && modal.type === 'cap_exceeded' ? (
                    <CapExceededModal detail={modal.detail} onDismiss={onDismissModal} />
                ) : null}
            </div>
        );
    }
}

export default ComputeMeterPanel;
export { BalanceStrip, InsufficientBalanceModal, CapExceededModal };

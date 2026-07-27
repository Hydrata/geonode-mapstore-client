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
 * card (BillingTabPanel.js, its one and only caller). Its second, inline
 * variant WAS deleted, by TASK-2458: removing the on-map strip left that
 * branch with zero app mounts, and it is not coming back beside Run.
 */
import React from 'react';
// TASK-2436 — imported by the component that EMITS the markup, not by a
// sibling panel, so the modal can never ship without its stylesheet again.
import '../meter.css';
// W2 remediation — the portal/dialog machinery TASK-2435 wrote here now lives
// in ONE place, shared with the paywall upgrade modal (which had the same
// stacking defect one layer up). See ModalHost.js's docstring.
import ModalHost from '../../components/ModalHost';
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
function PackButtons({ availablePacks, testIdPrefix, onBuyPack, compact, pending }) {
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
                    // TASK-2441 — the native attribute, styled by a :disabled
                    // rule rather than a modifier className (no new class, so
                    // the paywall CSS coverage guard stays quiet). The
                    // authoritative double-submit guard is the store read in
                    // subscribeCheckoutEpic; this is the affordance that stops
                    // the customer reaching for a second click during the
                    // several seconds before the Stripe tab opens.
                    disabled={pending}
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
    onBuyPack: PropTypes.func,
    compact: PropTypes.bool,
    /** TASK-2441 — a checkout-session create is on the wire. */
    pending: PropTypes.bool
};

PackButtons.defaultProps = {
    availablePacks: [],
    onBuyPack: () => {},
    pending: false
};

/**
 * The Billing tab's balance card: uppercase label over the figure, compact
 * primary pack buttons right of it, policy link below.
 *
 * TASK-2458 — this used to branch on `variant`, with the INLINE branch as the
 * default. TASK-2435 removed that branch's only app mount (the standalone
 * on-map strip) and kept it exported and tested rather than deleted; the
 * operator closed the question on 2026-07-27 by ruling out giving it a new
 * home, since a balance beside Run would reintroduce exactly the on-map
 * furniture W2.5 had just removed. So the branch, its `variant` prop and its
 * recent-entries list are gone: BillingTabPanel is the one caller, and this is
 * the card it has been rendering all along. Dead-but-tested code survives
 * every refactor because the tests pass, which is what made it worth deleting
 * rather than leaving.
 *
 * `recentEntries` went with the branch and was NOT re-homed: BillingTabPanel
 * deliberately never passed it — it renders its own richer ledger list (dates,
 * run links) below this card.
 */
function BalanceStrip({ balance, availablePacks, onBuyPack, pending }) {
    const noAccount = balance === null || balance === undefined;
    const value = () => {
        const n = parseFloat(balance);
        return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${balance}`;
    };
    return (
        <div data-testid="compute-meter-balance-strip" className="compute-meter-balance-strip">
            <div className="compute-meter-balance-row">
                <span className="compute-meter-balance-labelled">
                    <span className="compute-meter-balance-label">Compute balance</span>
                    <span data-testid="compute-meter-balance" className="compute-meter-balance">
                        {noAccount ? 'No billing account yet' : value()}
                    </span>
                </span>
                {availablePacks && availablePacks.length > 0 ? (
                    <span className="compute-meter-packs">
                        <PackButtons availablePacks={availablePacks} testIdPrefix="compute-meter-buy-pack" onBuyPack={onBuyPack} pending={pending} compact />
                    </span>
                ) : null}
            </div>
            <BillingPolicyLink testIdPrefix="compute-meter" />
        </div>
    );
}

BalanceStrip.propTypes = {
    balance: PropTypes.string,
    availablePacks: PropTypes.array,
    onBuyPack: PropTypes.func,
    /** TASK-2441 — a checkout-session create is on the wire. */
    pending: PropTypes.bool
};

BalanceStrip.defaultProps = {
    balance: null,
    availablePacks: [],
    onBuyPack: () => {},
    pending: false
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

/**
 * MeterModalHost — TASK-2435's body-level refusal-modal host, now a thin
 * naming layer over the shared ModalHost (W2 remediation): same portal, same
 * dialog semantics, same deliberate absence of backdrop-click-to-dismiss, but
 * ONE implementation shared with the paywall upgrade modal. The
 * `compute-meter-panel` testid/className are unchanged — meter.css supplies
 * this host's fixed full-viewport layer and z-index 100000.
 */
function MeterModalHost({ children, onDismiss }) {
    return (
        <ModalHost
            onDismiss={onDismiss}
            testId="compute-meter-panel"
            className="compute-meter-panel"
            titleId={MODAL_TITLE_ID}
        >
            {children}
        </ModalHost>
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
function InsufficientBalanceModal({ detail, availablePacks, onBuyPack, onDismiss, onViewAccount, checkoutPending }) {
    return (
        <div data-testid="meter-insufficient-balance-modal" className="compute-meter-modal-overlay">
            <div className="compute-meter-modal">
                <h2 id={MODAL_TITLE_ID} className="compute-meter-modal-title">Insufficient compute balance</h2>
                <p data-testid="meter-insufficient-balance-detail" className="compute-meter-modal-body">
                    {detail}
                </p>
                <div className="compute-meter-modal-actions">
                    <PackButtons availablePacks={availablePacks} testIdPrefix="meter-buy-pack-cta" onBuyPack={onBuyPack} pending={checkoutPending} />
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
    onViewAccount: PropTypes.func,
    /** TASK-2441 — a checkout-session create is on the wire. */
    checkoutPending: PropTypes.bool
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
         * (TASK-2435); `balance` still reaches BalanceStrip on the Billing
         * tab, and `recentEntries` is rendered there by BillingTabPanel's own
         * richer list (BalanceStrip stopped rendering one in TASK-2458).
         */
        availablePacks: PropTypes.array,
        /** {type: 'insufficient_balance'|'cap_exceeded'|'estimate_ceiling', checkoutUrl, detail} | null */
        modal: PropTypes.shape({
            type: PropTypes.string,
            checkoutUrl: PropTypes.string,
            detail: PropTypes.string
        }),
        onBuyPack: PropTypes.func,
        /**
         * TASK-2441 (epic 2425 W4.2) — a checkout-session create is on the
         * wire, so every buy control disables. Mapped from the paywall slice's
         * account-scoped flag (isCheckoutInFlight), not from local state: the
         * same purchase can be started from three different surfaces.
         */
        checkoutPending: PropTypes.bool,
        onDismissModal: PropTypes.func,
        // TASK-2420 (epic 2359 W4.5) — "View account" on all three refusal
        // modals, opening the Account panel's Billing tab.
        onViewAccount: PropTypes.func
    };

    static defaultProps = {
        enabled: false,
        availablePacks: [],
        modal: null,
        checkoutPending: false,
        onBuyPack: () => {},
        onDismissModal: () => {},
        onViewAccount: () => {}
    };

    render() {
        const { enabled, availablePacks, modal, checkoutPending, onBuyPack, onDismissModal, onViewAccount } = this.props;

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
                    checkoutPending={checkoutPending}
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

        // key={modal.type}: if a SECOND refusal arrives while the first is
        // still open (the reducer replaces the modal without an intervening
        // dismiss), React would otherwise reconcile the same host in place and
        // the mount effect would not re-run — leaving focus on a button that
        // no longer exists. Keying on the type forces a remount, so focus
        // enters the new dialog and the old invoker is still restored.
        return (
            <MeterModalHost key={modal.type} onDismiss={onDismissModal}>
                {content}
            </MeterModalHost>
        );
    }
}

export default ComputeMeterPanel;
export { BalanceStrip, MeterModalHost, InsufficientBalanceModal, CapExceededModal, EstimateCeilingModal, ViewAccountLink };

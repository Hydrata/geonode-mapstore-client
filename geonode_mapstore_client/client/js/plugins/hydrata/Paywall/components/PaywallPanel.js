/**
 * PaywallPanel — flag-gated, state-driven paywall UX component.
 *
 * TASK-1357 / Epic TASK-1350 (W3).
 *
 * Renders the six paywall states defined in paywall_contract.json:
 *   free_public     → "Make private" CTA
 *   upgrade_prompt  → Upgrade modal with checkout_url
 *   pending         → Spinner (FE-only, Stripe-return window)
 *   paid_private    → Private badge + manage-billing link
 *   paid_organization → Organization badge + manage-billing link (TASK-2446)
 *   past_due        → Non-blocking dunning banner + renew CTA
 *   anon            → Nothing (paywall key absent for anonymous callers)
 *
 * Kill-switch: `paywallEnabled` prop (default false) — the whole component
 * is dormant (renders null) when false. Ships DARK until operator flip.
 *
 * Fixture-mode: `fixtureMode` prop + `fixtureState` prop — bypasses any live
 * backend data and renders the given state from the contract fixture.
 * Used exclusively by Karma tests and development; never set in production.
 *
 * Hard contract rules enforced by this component:
 *   1. LAPSE NEVER AUTO-PUBLISHES — past_due never shows "revert to public" affordance.
 *   2. `read_only=true` on past_due is FE-advisory only — renders a non-blocking
 *      dunning banner, NOT a hard lockout (the backend does not enforce it in Phase-1).
 */

import React from 'react';
// TASK-2436 — imported by the component that EMITS the markup, so the panel
// can never ship without its stylesheet again (28 paywall-* classNames had
// no rule anywhere in the repo before this).
import '../paywall.css';
const PropTypes = require('prop-types');
import { getStatePayload } from '../paywallContract';

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * MakePrivateCTA — shown in free_public state.
 * Notifies parent when user clicks "Make private".
 */
function MakePrivateCTA({ onMakePrivate }) {
    return (
        <div data-testid="make-private-cta">
            <button
                data-testid="make-private-btn"
                className="paywall-make-private-btn"
                onClick={onMakePrivate}
                title="Make this model private"
            >
                Make private
            </button>
            <p className="paywall-make-private-hint">
                Only you and your team will be able to see it.
            </p>
        </div>
    );
}

MakePrivateCTA.propTypes = {
    onMakePrivate: PropTypes.func
};

MakePrivateCTA.defaultProps = {
    onMakePrivate: () => {}
};

/**
 * UpgradeModal — shown when upgrade_prompt state is active (after 402 response).
 * checkout_url comes from the contract payload.
 *
 * TASK-2099: checkout_url is a POST-only DRF endpoint
 * (/commerce/checkout/create-session/) — a plain `<a href>` click would 405.
 * The CTA is a button; `onSubscribeClick` (wired by the container to the
 * checkout epic) does the real POST and redirects to the returned session
 * URL. `data-href` is kept (rather than a real `href`) purely so the fixture
 * Karma tests can still assert the checkout_url reached this component,
 * without making the element itself navigable.
 */
function UpgradeModal({ checkoutUrl, onDismiss, onSubscribeClick, onViewAccount }) {
    return (
        <div data-testid="upgrade-modal" className="paywall-upgrade-modal-overlay">
            <div className="paywall-upgrade-modal">
                <h2 className="paywall-upgrade-modal-title">
                    Private models require a subscription
                </h2>
                <p className="paywall-upgrade-modal-body">
                    Keep your flood model private — visible only to you and your team.
                    Start a subscription to unlock private models.
                </p>
                <div className="paywall-upgrade-modal-actions">
                    <button
                        type="button"
                        data-testid="subscribe-cta"
                        className="paywall-subscribe-btn"
                        data-href={checkoutUrl}
                        onClick={() => onSubscribeClick(checkoutUrl)}
                    >
                        Subscribe &amp; make private
                    </button>
                    {/* TASK-2420 (epic 2359 W4.5) — "View account" -> Billing tab. */}
                    <button
                        type="button"
                        data-testid="paywall-view-account"
                        className="paywall-view-account-btn"
                        onClick={onViewAccount}
                    >
                        View account
                    </button>
                    <button
                        data-testid="dismiss-upgrade"
                        className="paywall-dismiss-btn"
                        onClick={onDismiss}
                    >
                        Keep it public
                    </button>
                </div>
                <a
                    data-testid="paywall-billing-policy-link"
                    className="paywall-billing-policy-link"
                    href="/billing-policy"
                >
                    Refund &amp; billing policy
                </a>
            </div>
        </div>
    );
}

UpgradeModal.propTypes = {
    checkoutUrl: PropTypes.string,
    onDismiss: PropTypes.func,
    onSubscribeClick: PropTypes.func,
    onViewAccount: PropTypes.func
};

UpgradeModal.defaultProps = {
    checkoutUrl: '',
    onDismiss: () => {},
    onSubscribeClick: () => {},
    onViewAccount: () => {}
};

/**
 * PendingSpinner — shown after returning from Stripe, while polling my_perms.
 * FE-only transient: the backend never emits `pending`.
 */
function PendingSpinner() {
    return (
        <div data-testid="pending-spinner" className="paywall-pending-spinner">
            <div className="paywall-spinner-icon" aria-label="Loading" role="status" />
            <p className="paywall-pending-text">
                Confirming your subscription&hellip;
            </p>
            <p className="paywall-pending-subtext">
                This usually takes a few seconds. Please wait.
            </p>
        </div>
    );
}

/**
 * PrivateBadge — the paid steady-state indicator. One component, two
 * visibility tiers (TASK-2446, epic 2425 W2):
 *   - `variant="private"`      → paid_private      (🔒 "Private")
 *   - `variant="organization"` → paid_organization (👥 "Organization")
 *
 * Parameterised rather than duplicated so the manage-billing affordance can
 * never drift between the two tiers. "Organization" is the visibility tier
 * from the glossary — "the explicit set of people invited to this project" —
 * NOT the owner's commerce organisation, and NOT the retired org auto-fold.
 *
 * Includes the optional manage-billing link when checkout_url is available.
 * NOTE: _derive_paywall_state (gn_anuga/api_v2.py) currently hardcodes
 * checkout_url=None for BOTH paid states, so that link is unreachable today
 * for either tier — see TASK-2455.
 */
function PrivateBadge({ manageBillingUrl, variant }) {
    const isOrganization = variant === 'organization';
    return (
        <div
            data-testid={isOrganization ? 'organization-badge' : 'private-badge'}
            className={`paywall-private-badge${isOrganization ? ' paywall-private-badge--organization' : ''}`}
        >
            <span
                className="paywall-private-badge-icon"
                aria-label={isOrganization ? 'Organization-visibility model' : 'Private model'}
            >
                {isOrganization ? '\u{1F465}' : '\u{1F512}'}
            </span>
            <span className="paywall-private-badge-label">
                {isOrganization ? 'Organization' : 'Private'}
            </span>
            {manageBillingUrl ? (
                <a
                    data-testid="manage-billing-link"
                    className="paywall-manage-billing-link"
                    href={manageBillingUrl}
                    data-href={manageBillingUrl}
                >
                    Manage billing
                </a>
            ) : null}
        </div>
    );
}

PrivateBadge.propTypes = {
    manageBillingUrl: PropTypes.string,
    variant: PropTypes.oneOf(['private', 'organization'])
};

PrivateBadge.defaultProps = {
    manageBillingUrl: null,
    variant: 'private'
};

/**
 * DunningBanner — shown in past_due state.
 * Non-blocking (advisory only) — does NOT hard-lock the project UI.
 * HARD CONTRACT RULE: never shows "revert to public" affordance.
 *
 * TASK-2099: renewUrl is the SAME POST-only create-session endpoint as
 * UpgradeModal's checkoutUrl (_derive_paywall_state, api_v2.py) — the
 * `<a href>` 405 trap applies here too. Same button + onRenewClick fix.
 */
function DunningBanner({ renewUrl, onDismiss, onRenewClick }) {
    return (
        <div data-testid="dunning-banner" className="paywall-dunning-banner paywall-dunning-banner--warning">
            <div className="paywall-dunning-banner-content">
                <span className="paywall-dunning-banner-icon" aria-hidden="true">&#9888;</span>
                <span className="paywall-dunning-banner-text">
                    Your subscription has lapsed — this model is still private, but renew to maintain your subscription.
                </span>
                <button
                    type="button"
                    data-testid="renew-cta"
                    className="paywall-renew-btn"
                    data-href={renewUrl}
                    onClick={() => onRenewClick(renewUrl)}
                >
                    Renew subscription
                </button>
                <button
                    data-testid="dismiss-dunning"
                    className="paywall-dunning-dismiss"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    &times;
                </button>
            </div>
        </div>
    );
}

DunningBanner.propTypes = {
    renewUrl: PropTypes.string,
    onDismiss: PropTypes.func,
    onRenewClick: PropTypes.func
};

DunningBanner.defaultProps = {
    renewUrl: '',
    onDismiss: () => {},
    onRenewClick: () => {}
};

// ─── Main component ──────────────────────────────────────────────────────────

class PaywallPanel extends React.Component {
    static propTypes = {
        /** Kill-switch. Default false (dark). The whole component renders null when false. */
        paywallEnabled: PropTypes.bool,

        /**
         * Live payload from my_perms.paywall: { state, checkout_url, read_only }.
         * Null/undefined when the paywall key is absent (anon caller).
         * Ignored when fixtureMode=true.
         */
        paywallPayload: PropTypes.shape({
            state: PropTypes.string,
            checkout_url: PropTypes.string,
            read_only: PropTypes.bool
        }),

        /** Dev/test fixture mode. Bypasses live paywallPayload; uses fixtureState. */
        fixtureMode: PropTypes.bool,

        /**
         * Which fixture state to render (fixture-mode only).
         * One of: free_public, upgrade_prompt, pending, paid_private,
         * paid_organization, past_due, anon.
         */
        fixtureState: PropTypes.string,

        /** Called when user clicks "Make private" in free_public state. */
        onMakePrivate: PropTypes.func,

        /** Called when user dismisses the upgrade_prompt modal. */
        onDismissUpgrade: PropTypes.func,

        /** Called with checkoutUrl when user clicks "Subscribe" (upgrade_prompt state). */
        onSubscribeClick: PropTypes.func,

        /** Called with checkoutUrl when user clicks "Renew subscription" (past_due state). */
        onRenewClick: PropTypes.func,

        /** TASK-2420 — "View account" on the upgrade_prompt modal -> Billing tab. */
        onViewAccount: PropTypes.func
    };

    static defaultProps = {
        paywallEnabled: false,
        paywallPayload: undefined,
        fixtureMode: false,
        fixtureState: null,
        onMakePrivate: () => {},
        onDismissUpgrade: () => {},
        onSubscribeClick: () => {},
        onRenewClick: () => {},
        onViewAccount: () => {}
    };

    constructor(props) {
        super(props);
        this.state = {
            dunningDismissed: false
        };
    }

    /**
     * Resolve the effective payload to render from.
     * In fixture-mode: look up the state entry from the contract fixture.
     * In live mode: use paywallPayload directly.
     * Returns null when the caller is anonymous (no paywall block).
     */
    _resolvePayload() {
        const { fixtureMode, fixtureState, paywallPayload } = this.props;

        if (fixtureMode && fixtureState) {
            if (fixtureState === 'anon') {
                return null;
            }
            try {
                return getStatePayload(fixtureState).payload;
            } catch (e) {
                // Unknown fixture state — treat as no-op
                return null;
            }
        }

        // Live mode: paywallPayload is what the backend returned (or undefined/null for anon).
        return paywallPayload || null;
    }

    render() {
        const { paywallEnabled, onMakePrivate, onDismissUpgrade, onSubscribeClick, onRenewClick, onViewAccount } = this.props;
        const { dunningDismissed } = this.state;

        // Kill-switch: render nothing when disabled (dark ship default).
        if (!paywallEnabled) {
            return null;
        }

        const payload = this._resolvePayload();

        // Anonymous caller or absent paywall key: render nothing.
        if (!payload) {
            return null;
        }

        const { state: paywallState, checkout_url: checkoutUrl } = payload;

        // Render the appropriate UX for each state.
        let content;
        switch (paywallState) {
        case 'free_public':
            content = (
                <MakePrivateCTA onMakePrivate={onMakePrivate} />
            );
            break;

        case 'upgrade_prompt':
            content = (
                <UpgradeModal
                    checkoutUrl={checkoutUrl}
                    onDismiss={onDismissUpgrade}
                    onSubscribeClick={onSubscribeClick}
                    onViewAccount={onViewAccount}
                />
            );
            break;

        case 'pending':
            content = <PendingSpinner />;
            break;

        case 'paid_private':
            content = (
                <PrivateBadge manageBillingUrl={checkoutUrl} variant="private" />
            );
            break;

        // TASK-2446 (epic 2425 W2) — contract v1.1 / TASK-2432's DISTINCT
        // steady-state literal for an organization-visibility project held by
        // an entitled account. Without this case it fell through to
        // `default: content = null` and the whole panel silently vanished on
        // the next my_perms read — reachable by an ordinary PATCH or by
        // grandfathering, and reachable with PAYWALL_ENABLED=False too (the
        // flag-off branch of _derive_paywall_state emits it as well).
        case 'paid_organization':
            content = (
                <PrivateBadge manageBillingUrl={checkoutUrl} variant="organization" />
            );
            break;

        case 'past_due':
            if (dunningDismissed) {
                // Dismissed: show a minimal private indicator.
                content = (
                    <div data-testid="private-badge" className="paywall-private-badge paywall-private-badge--past-due">
                        <span className="paywall-private-badge-label">Private (subscription lapsed)</span>
                    </div>
                );
            } else {
                content = (
                    <DunningBanner
                        renewUrl={checkoutUrl}
                        onDismiss={() => this.setState({ dunningDismissed: true })}
                        onRenewClick={onRenewClick}
                    />
                );
            }
            break;

        default:
            // Unknown state — render nothing gracefully.
            content = null;
        }

        if (!content) {
            return null;
        }

        return (
            <div data-testid="paywall-panel" className="paywall-panel">
                {content}
            </div>
        );
    }
}

export default PaywallPanel;

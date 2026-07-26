/**
 * PaywallPanel — flag-gated paywall UX component. THE MAP IS NOT A BADGE
 * SURFACE: this component renders exactly ONE thing, the blocking
 * upgrade_prompt refusal modal. Every other contract state renders null here.
 *
 * TASK-1357 / Epic TASK-1350 (W3); rewritten by TASK-2463 (epic 2425 W2.5).
 *
 * How the seven paywall_contract.json states are surfaced NOW:
 *   upgrade_prompt    → Upgrade modal with checkout_url  ← THE ONLY ONE HERE
 *   free_public       → nothing. Public is the happy path; TASK-2462 decided
 *                       against a persistent "Make private" nag. The
 *                       make-private ACTION lives in Account > Sharing.
 *   paid_private      → padlock on the Account button (SimpleView
 *   paid_organization   accountVisibilityLock.js), driven by the project's
 *                       `visibility`, gated to the owner.
 *   past_due          → the same padlock, UNANNOTATED. TASK-2463 (W2.9) deleted
 *                       the amber `--lapsed` modifier and the "(subscription
 *                       lapsed)" wording with it: past_due is computed from the
 *                       READING user's acting account, never from the project's,
 *                       so an amber padlock asserted something about the project
 *                       that no payload establishes (SimpleView/components/
 *                       accountVisibilityLock.js carries the derivation). Do not
 *                       re-add it. The renew/manage action lives in
 *                       Account > Billing (BillingTabPanel SubscriptionSection).
 *   pending           → nothing HERE, and since the W2.10 revert (operator
 *                       decision 2026-07-26) nothing ANYWHERE: the FE-only
 *                       Stripe-return window renders no surface at all. It masks
 *                       `steady` while the poll runs and is cleared after 60s.
 *                       W2.8/W2.9's Billing-tab confirmation notice is removed;
 *                       acknowledging a webhook slower than the poll is
 *                       TASK-2489, which needs a server-side read this component
 *                       has no access to.
 *   anon              → nothing (paywall key absent for anonymous callers).
 *
 * WHY — grill decision 6 (2026-07-25): "the map becomes a modal HOST, not a
 * balance dashboard." W2 fixed a real defect (these states rendered at
 * viewportHeight+55px in a non-scrolling document, i.e. invisible) by
 * ANCHORING them top-centre over the map, which contradicted that decision;
 * the operator rejected it at the W2 UAT gate. The states were never the
 * problem — the destination was. Ambient state belongs on the control that
 * changes it, not in the middle of someone's flood model.
 *
 * DO NOT re-add an on-map surface here. If a state genuinely needs to
 * interrupt the customer, that is what ModalHost is for, and it is a REFUSAL.
 *
 * Kill-switch: `paywallEnabled` prop (default false) — the whole component
 * is dormant (renders null) when false. Ships DARK until operator flip.
 *
 * Fixture-mode: `fixtureMode` prop + `fixtureState` prop — bypasses any live
 * backend data and renders the given state from the contract fixture.
 * Used exclusively by Karma tests and development; never set in production.
 *
 * Hard contract rules enforced by this component:
 *   1. LAPSE NEVER AUTO-PUBLISHES — past_due never shows "revert to public"
 *      affordance. Trivially true now: past_due renders nothing here at all.
 *   2. `read_only=true` on past_due is FE-advisory only — never a hard lockout
 *      (the backend does not enforce it in Phase-1).
 */

import React from 'react';
// TASK-2436 — imported by the component that EMITS the markup, so the panel
// can never ship without its stylesheet again.
import '../paywall.css';
// W2 remediation — the same body-level dialog host the compute-meter refusal
// modals use. See ModalHost.js for the measured evidence that this panel's own
// `position: relative; z-index: 2` was capping its "z-index: 100000" overlay.
import ModalHost from './ModalHost';
const PropTypes = require('prop-types');
import { getStatePayload } from '../paywallContract';

/**
 * The id UpgradeModal's <h2> carries so ModalHost can name the dialog
 * (aria-labelledby) without knowing which modal it is hosting. Safe as a
 * single constant: exactly one upgrade modal is ever mounted.
 */
const UPGRADE_MODAL_TITLE_ID = 'paywall-upgrade-modal-title';

// ─── Sub-components ──────────────────────────────────────────────────────────
//
// TASK-2463 removed four of them — MakePrivateCTA (free_public), PendingSpinner
// (pending), PrivateBadge (paid_private / paid_organization / dismissed
// past_due) and DunningBanner (past_due) — along with the anchored shell that
// portaled them over the map. They are deleted, not commented out or left
// unreferenced: an unrendered component is an invitation to re-mount it
// somewhere, and the whole point of this change is that these states have no
// on-map surface. Their information now lives on the Account button padlock
// and in Account > Billing. Recover them from git history (TASK-2436..2446) if
// a future decision reverses this — do not resurrect them by accident.

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
 *
 * W2 remediation — this component emits ONLY the backdrop + card. It is always
 * rendered inside a ModalHost (see PaywallPanel.render), which supplies the
 * body-level portal and the dialog semantics (role, accessible name, focus
 * entry/trap/restore, Escape). Before that it was a full-viewport
 * click-absorbing scrim with none of them.
 */
function UpgradeModal({ checkoutUrl, onDismiss, onSubscribeClick, onViewAccount }) {
    return (
        <div data-testid="upgrade-modal" className="paywall-upgrade-modal-overlay">
            <div className="paywall-upgrade-modal">
                <h2 id={UPGRADE_MODAL_TITLE_ID} className="paywall-upgrade-modal-title">
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

        /** Called when user dismisses the upgrade_prompt modal. */
        onDismissUpgrade: PropTypes.func,

        /** Called with checkoutUrl when user clicks "Subscribe" (upgrade_prompt state). */
        onSubscribeClick: PropTypes.func,

        /** TASK-2420 — "View account" on the upgrade_prompt modal -> Billing tab. */
        onViewAccount: PropTypes.func
    };

    static defaultProps = {
        paywallEnabled: false,
        paywallPayload: undefined,
        fixtureMode: false,
        fixtureState: null,
        onDismissUpgrade: () => {},
        onSubscribeClick: () => {},
        onViewAccount: () => {}
    };

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
        const { paywallEnabled, onDismissUpgrade, onSubscribeClick, onViewAccount } = this.props;

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

        // upgrade_prompt is the one BLOCKING state and the ONLY state this
        // component renders. It gets the shared body-level dialog host (portal
        // + role/name/focus/Escape).
        if (paywallState === 'upgrade_prompt') {
            return (
                <ModalHost
                    onDismiss={onDismissUpgrade}
                    testId="paywall-panel"
                    className="paywall-panel paywall-panel--modal-host"
                    titleId={UPGRADE_MODAL_TITLE_ID}
                >
                    <UpgradeModal
                        checkoutUrl={checkoutUrl}
                        onDismiss={onDismissUpgrade}
                        onSubscribeClick={onSubscribeClick}
                        onViewAccount={onViewAccount}
                    />
                </ModalHost>
            );
        }

        // EVERY OTHER STATE RENDERS NOTHING ON THE MAP (TASK-2463).
        //
        // Not "renders in flow" — nothing. The in-flow mount point measured at
        // rect [0, 668, 1408, 16] on a 1408x683 map route whose document
        // cannot scroll, with document.elementFromPoint(centre) returning
        // DIV.mapstore-map-footer: invisible, and not even its own hit-test
        // target. W2 escaped that by portaling an anchored shell to
        // document.body at top:60px. The operator rejected the destination at
        // the W2 UAT gate, so BOTH the shell and the in-flow fallback are gone
        // and there is no third option left to regress into.
        //
        // Where the information went instead is listed in the file docstring.
        // The one thing that must stay true: after this return, no paywall
        // element exists over the map canvas in any steady state. The e2e
        // suite asserts exactly that at the map-canvas centre for all five.
        return null;
    }
}

export default PaywallPanel;

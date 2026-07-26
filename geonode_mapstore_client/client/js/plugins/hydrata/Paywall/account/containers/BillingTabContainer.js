/**
 * BillingTabContainer — connects BillingTabPanel to Redux (TASK-2420,
 * epic 2359 W4.5). Mirrors ComputeMeterContainer's shape.
 */
import { connect } from 'react-redux';
import BillingTabPanel from '../components/BillingTabPanel';
import { getAccountSummaryState } from '../reducer';
import { requestBillingPortal } from '../actions';
import { subscribeCheckoutRequest, recheckPayment } from '../../actions';
// TASK-2463 (epic 2425 W2.8) — the post-checkout confirmation notice.
import { getPaywallConfirming } from '../../reducer';

const mapStateToProps = (state) => {
    const account = getAccountSummaryState(state);
    return {
        loaded: account.loaded,
        organisation: account.organisation,
        isPersonal: account.isPersonal,
        manager: account.manager,
        isManager: account.isManager,
        balance: account.balance,
        freeBand: account.freeBand,
        subscription: account.subscription,
        availablePacks: account.availablePacks,
        recentEntries: account.recentEntries,
        portalLoading: account.portalLoading,
        portalError: account.portalError,
        // TASK-2463 (W2.8) — null | {stalled}. Read through the selector rather
        // than reaching into state.anuga.paywall.overlay, so "is a purchase being
        // confirmed" has one definition shared with the poll epic.
        confirming: getPaywallConfirming(state)
    };
};

const mapDispatchToProps = (dispatch) => ({
    onBuyPack: (priceId) => dispatch(subscribeCheckoutRequest('credit_pack', { priceId })),
    // UAT-2 — accountOnly: the Billing tab subscribes the ACCOUNT; no project
    // rides the checkout session (see subscribeCheckoutEpic).
    onSubscribe: () => dispatch(subscribeCheckoutRequest('subscription', { accountOnly: true })),
    onManageBilling: () => dispatch(requestBillingPortal()),
    // TASK-2463 (W2.8) — "Check again". recheckPaymentEpic re-asks my_perms
    // (forced), the balance and the summary; the container does not know the
    // project id, and does not need to.
    onRecheck: () => dispatch(recheckPayment())
});

export default connect(mapStateToProps, mapDispatchToProps)(BillingTabPanel);

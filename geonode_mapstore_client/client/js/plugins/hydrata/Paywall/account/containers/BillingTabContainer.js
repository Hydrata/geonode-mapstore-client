/**
 * BillingTabContainer — connects BillingTabPanel to Redux (TASK-2420,
 * epic 2359 W4.5). Mirrors ComputeMeterContainer's shape.
 */
import { connect } from 'react-redux';
import BillingTabPanel from '../components/BillingTabPanel';
import { getAccountSummaryState } from '../reducer';
import { requestBillingPortal } from '../actions';
import { subscribeCheckoutRequest } from '../../actions';

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
        portalError: account.portalError
    };
};

const mapDispatchToProps = (dispatch) => ({
    onBuyPack: (priceId) => dispatch(subscribeCheckoutRequest('credit_pack', { priceId })),
    onSubscribe: () => dispatch(subscribeCheckoutRequest('subscription')),
    onManageBilling: () => dispatch(requestBillingPortal())
});

export default connect(mapStateToProps, mapDispatchToProps)(BillingTabPanel);

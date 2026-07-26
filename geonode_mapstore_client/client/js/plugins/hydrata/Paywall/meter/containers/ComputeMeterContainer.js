/**
 * ComputeMeterContainer — connects ComputeMeterPanel to Redux (TASK-2100,
 * epic 2092 W4.2). Mirrors PaywallPanelContainer's shape.
 */
import { connect } from 'react-redux';
import ComputeMeterPanel from '../components/ComputeMeterPanel';
import { getComputeMeterState } from '../reducer';
import { dismissMeterModal } from '../actions';
import { subscribeCheckoutRequest } from '../../actions';
// TASK-2420 (epic 2359 W4.5) — "View account" on the refusal modals.
import { setMembershipPanel, setMembershipPanelTab } from '../../../Anuga/actionsAnuga';

// TASK-2435 (epic 2425 W2) — the map mount is a refusal-modal host, not a
// balance dashboard, so `balance` and `recentEntries` are no longer mapped:
// nothing on this surface reads them. They remain in the meter reducer and
// are consumed by the Billing tab (BillingTabPanel -> BalanceStrip card).
const mapStateToProps = (state) => {
    const meter = getComputeMeterState(state);
    return {
        enabled: meter.enabled,
        availablePacks: meter.availablePacks,
        modal: meter.modal
    };
};

const mapDispatchToProps = (dispatch) => ({
    onBuyPack: (priceId) => dispatch(subscribeCheckoutRequest('credit_pack', { priceId })),
    onDismissModal: () => dispatch(dismissMeterModal()),
    // "View account" MUST dismiss the refusal modal first (W2 remediation).
    //
    // TASK-2435 made this host a body-level portal at z-index 100000 with a
    // click-absorbing backdrop and a focus trap. The Account panel is a
    // MovablePanel whose inline z-index 100000 resolves INSIDE
    // .gn-page-wrapper's 99999 stacking context, so it opens BEHIND the
    // portal; the backdrop then swallows every click aimed at it and the trap
    // pulls every Tab back into the dialog. Routing the customer to Billing
    // without dismissing was therefore a mouse AND keyboard dead-end — the
    // one thing a refusal modal must never be.
    //
    // Dismissing is also the honest semantics: the customer has chosen to go
    // deal with their balance, so the refusal has been read and acted on.
    onViewAccount: () => {
        dispatch(dismissMeterModal());
        dispatch(setMembershipPanel(true));
        dispatch(setMembershipPanelTab('billing'));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ComputeMeterPanel);

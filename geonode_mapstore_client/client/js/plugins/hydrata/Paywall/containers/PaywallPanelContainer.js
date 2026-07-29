/**
 * PaywallPanelContainer — connects PaywallPanel to Redux (TASK-2099, epic
 * 2092 W4.1). Preserves fixture mode: this container never sets
 * `fixtureMode`/`fixtureState`, so ownProps passed through by MapStore's
 * plugin cfg (paywallEnabled) survive connect()'s default mergeProps
 * ({...ownProps, ...stateProps, ...dispatchProps}) untouched — the existing
 * Karma suite (paywallComponent-test.js) renders PaywallPanel directly and is
 * unaffected by this container.
 */
import { connect } from 'react-redux';
import PaywallPanel from '../components/PaywallPanel';
import { getEffectivePaywallPayload, isCheckoutInFlight } from '../reducer';
import { dismissPaywallUpgrade, subscribeCheckoutRequest } from '../actions';
import { setMembershipPanel, setMembershipPanelTab } from '../../Anuga/actionsAnuga';

const mapStateToProps = (state) => ({
    paywallPayload: getEffectivePaywallPayload(state),
    // TASK-2441 (epic 2425 W4.2) — disables the Subscribe CTA while a
    // create-session POST is on the wire.
    checkoutPending: isCheckoutInFlight(state)
});

// TASK-2463 (epic 2425 W2.5) dropped two handlers with the components that
// used them: `onMakePrivate` (MakePrivateCTA, free_public) and `onRenewClick`
// (DunningBanner, past_due). Both are removed rather than left wired to a prop
// nothing reads — a live dispatch bound to a deleted control is how a dead CTA
// gets resurrected by someone who sees the plumbing and assumes a caller.
// The make-private action lives in Account > Sharing; renew lives in
// Account > Billing (BillingTabPanel's Subscribe/Manage billing).
const mapDispatchToProps = (dispatch) => ({
    onDismissUpgrade: () => dispatch(dismissPaywallUpgrade()),
    onSubscribeClick: () => dispatch(subscribeCheckoutRequest('subscription')),
    // TASK-2420 (epic 2359 W4.5) — "View account" on the upgrade_prompt modal.
    //
    // W2 remediation: dismisses the upgrade prompt FIRST, for the same reason
    // ComputeMeterContainer does. The upgrade modal is now hosted in the same
    // body-level ModalHost (portal + click-absorbing backdrop + focus trap),
    // so leaving it open while opening the Account panel — a MovablePanel
    // confined inside .gn-page-wrapper's stacking context — would strand the
    // customer behind a scrim they cannot click through or Tab out of.
    onViewAccount: () => {
        dispatch(dismissPaywallUpgrade());
        dispatch(setMembershipPanel(true));
        dispatch(setMembershipPanelTab('billing'));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PaywallPanel);

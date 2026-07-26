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
import { getEffectivePaywallPayload } from '../reducer';
import { dismissPaywallUpgrade, subscribeCheckoutRequest } from '../actions';
import { updateProjectVisibilityRequest, setMembershipPanel, setMembershipPanelTab } from '../../Anuga/actionsAnuga';

const mapStateToProps = (state) => ({
    paywallPayload: getEffectivePaywallPayload(state)
});

const mapDispatchToProps = (dispatch) => ({
    onMakePrivate: () => dispatch(updateProjectVisibilityRequest('private')),
    onDismissUpgrade: () => dispatch(dismissPaywallUpgrade()),
    onSubscribeClick: () => dispatch(subscribeCheckoutRequest('subscription')),
    onRenewClick: () => dispatch(subscribeCheckoutRequest('subscription')),
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

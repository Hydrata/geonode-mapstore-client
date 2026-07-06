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
import { updateProjectVisibilityRequest } from '../../Anuga/actionsAnuga';

const mapStateToProps = (state) => ({
    paywallPayload: getEffectivePaywallPayload(state)
});

const mapDispatchToProps = (dispatch) => ({
    onMakePrivate: () => dispatch(updateProjectVisibilityRequest('private')),
    onDismissUpgrade: () => dispatch(dismissPaywallUpgrade()),
    onSubscribeClick: () => dispatch(subscribeCheckoutRequest('subscription')),
    onRenewClick: () => dispatch(subscribeCheckoutRequest('subscription'))
});

export default connect(mapStateToProps, mapDispatchToProps)(PaywallPanel);

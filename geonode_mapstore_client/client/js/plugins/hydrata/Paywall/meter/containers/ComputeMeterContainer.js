/**
 * ComputeMeterContainer — connects ComputeMeterPanel to Redux (TASK-2100,
 * epic 2092 W4.2). Mirrors PaywallPanelContainer's shape.
 */
import { connect } from 'react-redux';
import ComputeMeterPanel from '../components/ComputeMeterPanel';
import { getComputeMeterState } from '../reducer';
import { dismissMeterModal } from '../actions';
import { subscribeCheckoutRequest } from '../../actions';

const mapStateToProps = (state) => {
    const meter = getComputeMeterState(state);
    return {
        enabled: meter.enabled,
        balance: meter.balance,
        availablePacks: meter.availablePacks,
        recentEntries: meter.recentEntries,
        modal: meter.modal
    };
};

const mapDispatchToProps = (dispatch) => ({
    onBuyPack: (priceId) => dispatch(subscribeCheckoutRequest('credit_pack', { priceId })),
    onDismissModal: () => dispatch(dismissMeterModal())
});

export default connect(mapStateToProps, mapDispatchToProps)(ComputeMeterPanel);

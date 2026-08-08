/**
 * PaywallAndMeterRoot — the Paywall plugin's actual mounted component.
 *
 * TASK-2100 (epic 2092 W4.2): MapStore's createPlugin takes a single
 * `component`, so the bundled-launch epic's two independently-killable
 * surfaces (privacy paywall, TASK-2099; compute meter, TASK-2100) are
 * rendered here as SIBLINGS under the one registered 'Paywall' plugin,
 * rather than registering a second plugin (keeps index.js / localConfig
 * untouched for this subtask — see TASK-2100's target_files). Each child
 * has its OWN kill-switch (paywallEnabled prop / the balance endpoint's
 * `enabled`) and renders null independently — so either, both, or neither
 * can be dark at once, exactly like two independently-killable flags.
 *
 * TASK-2638 (epic 2635 W1) added a THIRD sibling, BetaNoticeBannerContainer
 * — its own kill-switch is the jobName==='hydratabase' + signed-in + not-
 * dismissed gate computed inside the container, same independent-render
 * pattern as its two siblings.
 */
import React from 'react';
import PaywallPanelContainer from '../containers/PaywallPanelContainer';
import ComputeMeterContainer from '../meter/containers/ComputeMeterContainer';
import BetaNoticeBannerContainer from '../containers/BetaNoticeBannerContainer';

const PaywallAndMeterRoot = (props) => (
    <React.Fragment>
        <BetaNoticeBannerContainer />
        <PaywallPanelContainer {...props} />
        <ComputeMeterContainer />
    </React.Fragment>
);

export default PaywallAndMeterRoot;

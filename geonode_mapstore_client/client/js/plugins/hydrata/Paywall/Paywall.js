/**
 * Paywall plugin entry-point.
 *
 * TASK-1357 / Epic TASK-1350 (W3).
 *
 * Flag-gated, state-driven paywall UX for the public->private upgrade flow.
 * Ships DARK (paywallEnabled defaults to false) until the operator flips
 * PAYWALL_ENABLED in the site inventory and deploys.
 *
 * Plugin cfg (via MapStore localConfig plugins entry):
 *   {
 *     "name": "Paywall",
 *     "cfg": {
 *       "paywallEnabled": false  // true when operator flips PAYWALL_ENABLED
 *     }
 *   }
 */

import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import PaywallPanel from './components/PaywallPanel';
// TASK-2099 (epic 2092 W4.1): the connected container reads the Redux feed
// (my_perms.paywall + the FE-only upgrade_prompt/pending overlay) and wires
// the checkout round-trip dispatches. Its reducer/epics are registered under
// the Anuga plugin (reducersAnuga.js / Anuga.js) — the paywall block is
// per-project, riding the same Anuga slice as everything else — so this
// plugin registers no reducers/epics of its own.
import PaywallPanelContainer from './containers/PaywallPanelContainer';

export default createPlugin('Paywall', {
    component: PaywallPanelContainer
});

export { PaywallPanel };
export { CONTRACT_FIXTURE, getStatePayload, PAYWALL_STATES } from './paywallContract';

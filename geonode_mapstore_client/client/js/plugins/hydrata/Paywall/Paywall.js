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

export default createPlugin('Paywall', {
    component: PaywallPanel
});

export { PaywallPanel };
export { CONTRACT_FIXTURE, getStatePayload, PAYWALL_STATES } from './paywallContract';

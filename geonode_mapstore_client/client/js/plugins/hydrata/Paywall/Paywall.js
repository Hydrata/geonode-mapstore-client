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
// TASK-2099 (epic 2092 W4.1) + TASK-2100 (W4.2): the mounted component is a
// small root rendering the connected privacy-paywall panel AND the connected
// compute-meter panel as siblings (see PaywallAndMeterRoot's docstring for
// why — createPlugin takes one `component`, and this subtask deliberately
// does not register a second plugin). Both children's reducers/epics are
// registered under the Anuga plugin (reducersAnuga.js / Anuga.js) — both
// blocks ride the same Anuga slice — so this plugin registers no
// reducers/epics of its own.
import PaywallAndMeterRoot from './components/PaywallAndMeterRoot';

export default createPlugin('Paywall', {
    component: PaywallAndMeterRoot
});

export { PaywallPanel };
export { CONTRACT_FIXTURE, getStatePayload, PAYWALL_STATES } from './paywallContract';

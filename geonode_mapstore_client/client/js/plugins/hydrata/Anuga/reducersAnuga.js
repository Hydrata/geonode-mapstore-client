import { combineReducers } from 'redux';
import projects from './reducers/projectsReducer';
import scenarios from './reducers/scenariosReducer';
import runs from './reducers/runsReducer';
import ui from './reducers/uiReducer';
import resources from './reducers/resourcesReducer';
import memberships from './reducers/membershipsReducer';
// TASK-1993 (W2.1): mount the map-click disambiguation slice under the ANUGA
// plugin's combineReducers -> state.anuga.clickDisambiguation (mirrors Swamm's
// state.swamm.bmpChooserCandidates precedent). W1 (TASK-1991) shipped it unmounted.
import clickDisambiguation from './reducers/clickDisambiguationReducer';
// TASK-2099 (epic 2092 W4.1): the paywall block is per-project (my_perms),
// so it rides the same Anuga slice as everything else -> state.anuga.paywall.
import paywall from '../Paywall/reducer';
// TASK-2100 (epic 2092 W4.2): compute-meter balance + insufficient-balance/
// cap-exceeded modal -> state.anuga.computeMeter.
import computeMeter from '../Paywall/meter/reducer';
// TASK-2420 (epic 2359 W4.5): Account panel Billing tab summary
// (org/manager/balance/free-band/subscription/ledger) -> state.anuga.accountSummary.
import accountSummary from '../Paywall/account/reducer';

export default combineReducers({
    projects, scenarios, runs, ui, resources, memberships, clickDisambiguation, paywall, computeMeter, accountSummary
});

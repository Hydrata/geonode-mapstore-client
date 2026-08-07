// Scoped test entry for the TaskMonitor suite (TASK-2674, epic 2662 W2.4).
//
// Mirrors tests-paywall-scoped.webpack.js: a SUBSET RUNNER so a red-first TDD
// cycle on the task-manager truth path costs a minute instead of an hour. The
// wave gate is still the full `npm run test` — every file listed here is also
// picked up by the untargeted run.
var epicsAndSelectors = require.context('./js/plugins/hydrata/TaskMonitor/__tests__', false, /-test\.jsx?$/);
var components = require.context('./js/plugins/hydrata/TaskMonitor/components/__tests__', false, /-test\.jsx?$/);
epicsAndSelectors.keys().forEach(epicsAndSelectors);
components.keys().forEach(components);
module.exports = epicsAndSelectors;

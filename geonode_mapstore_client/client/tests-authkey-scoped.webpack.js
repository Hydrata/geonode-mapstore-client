// Scoped test entry for the authkey warm-up probe suite (TASK-2659).
//
// Mirrors tests-paywall-scoped.webpack.js: a SUBSET RUNNER so a red-first TDD
// cycle on the probe module costs a minute instead of the full-suite hour. The
// wave gate is still the full `npm run test`; every file listed here is also
// picked up by the untargeted run (js/utils/__tests__ matches the global
// /-test\.jsx?$/ context).
var probe = require.context('./js/utils/__tests__', false, /AuthkeyWarmupProbe-test\.jsx?$/);
probe.keys().forEach(probe);
module.exports = probe;

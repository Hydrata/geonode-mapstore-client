// Scoped test entry for the SimpleView primitives suite (TASK-2689, epic 2662).
//
// Mirrors tests-taskmonitor-scoped.webpack.js: a SUBSET RUNNER so a red-first
// TDD cycle on the StatusBadge liveness styling costs a minute instead of an
// hour. The wave gate is still the full `npm run test` — every file listed
// here is also picked up by the untargeted run.
var primitives = require.context('./js/plugins/hydrata/SimpleView/components/primitives/__tests__', false, /StatusBadge-test\.jsx?$/);
primitives.keys().forEach(primitives);
module.exports = primitives;

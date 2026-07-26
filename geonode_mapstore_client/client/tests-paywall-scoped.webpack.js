// Scoped test entry for the paywall / money-path suite (TASK-2425 W2.8).
//
// WHY THIS EXISTS. The full `npm run test` run is ~4700 tests and takes the
// better part of an hour, which is long enough that a red-first TDD cycle stops
// being run and the "watch it fail" step turns into an assertion in a commit
// message. Four false claims shipped in this epic, two of them tests that could
// not fail; a cheap way to actually observe RED is a countermeasure to that, not
// a convenience. Mirrors tests-scenarios-scoped.webpack.js.
//
// This is a SUBSET RUNNER, not a substitute: the wave gate is still the full
// suite. Every file listed here is also picked up by the untargeted run.
var epics = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /epicsAnuga-test\.jsx?$/);
epics.keys().forEach(epics);
var paywall = require.context('./js/plugins/hydrata/Paywall/__tests__', false, /-test\.jsx?$/);
paywall.keys().forEach(paywall);
var account = require.context('./js/plugins/hydrata/Paywall/account/__tests__', false, /-test\.jsx?$/);
account.keys().forEach(account);
var meter = require.context('./js/plugins/hydrata/Paywall/meter/__tests__', false, /-test\.jsx?$/);
meter.keys().forEach(meter);
var lock = require.context('./js/plugins/hydrata/SimpleView/components/__tests__', false, /accountVisibilityLock-test\.jsx?$/);
lock.keys().forEach(lock);
var visibility = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /visibilityFromMyPerms-test\.jsx?$/);
visibility.keys().forEach(visibility);
var membership = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /membershipPanel-test\.jsx?$/);
membership.keys().forEach(membership);
module.exports = paywall;

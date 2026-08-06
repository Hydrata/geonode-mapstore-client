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
// TASK-2513 (epic 2425 W3d) — the compute-meter balance-fetch epics. They were
// NOT in this runner: the context above matches only /epicsAnuga-test\.jsx?$/,
// so every spec in computeMeterEpics-test.js was invisible here and a red-first
// cycle on that file reported green having executed nothing. Adding this line
// ALONE raised the completed count by exactly 4, which is how it was verified.
var meterEpics = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /computeMeterEpics-test\.jsx?$/);
meterEpics.keys().forEach(meterEpics);
// TASK-2548 (epic 2425 W3e) — the map-switch project-identity specs. Same
// reason as the computeMeterEpics line above: the Anuga/__tests__ contexts here
// match by FILENAME, so a new spec in that directory executes nothing until it
// is named. This runner is the money-path subset and this file is the money
// path's project identity, so it belongs here rather than only in the full run.
var followsMap = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /projectFollowsMap-test\.jsx?$/);
followsMap.keys().forEach(followsMap);
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
// The money-path toast msgIds are raised from paywallEpics.js by id — a missing
// key renders the raw id to a paying customer, so the i18n coverage test belongs
// in this subset too.
var i18n = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /anugaI18n-test\.jsx?$/);
i18n.keys().forEach(i18n);
// TASK-2638 (epic 2635 W1) — the beta notice banner. Same reason as every
// line above: Paywall/components/__tests__ is a NEW directory with no
// existing context here, so its spec executes nothing until named.
var betaBanner = require.context('./js/plugins/hydrata/Paywall/components/__tests__', false, /-test\.jsx?$/);
betaBanner.keys().forEach(betaBanner);
// TASK-2645 (epic 2635 W1) — PRICING_UNAVAILABLE handling in
// runAnugaScenarioEpic. Same reason as every line above: the existing
// /epicsAnuga-test\.jsx?$/ context at the top matches by FILENAME only, so
// this new file (deliberately named to NOT match that or any other
// existing pattern here) executes nothing until named.
var pricingUnavailable = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /pricingUnavailableEpic-test\.jsx?$/);
pricingUnavailable.keys().forEach(pricingUnavailable);
module.exports = paywall;

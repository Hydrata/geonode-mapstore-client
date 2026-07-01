// Scoped test entry (TASK-2038, epic 2037 W1): the scenario-config helper
// suite (validateScenario / validateCategoryProgress) and the scenarios
// reducer default-resolution regression test.
//
// TASK-2045 (F3, epic 2037 W1b) added scenarioCategoryRail-test.js — the
// rail-wiring coverage for boundary feature-presence gating.
var helpers = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioHelpers-test\.jsx?$/);
helpers.keys().forEach(helpers);
var rail = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioCategoryRail-test\.jsx?$/);
rail.keys().forEach(rail);
var reducer = require.context('./js/plugins/hydrata/Anuga/reducers/__tests__', false, /scenariosReducer-test\.jsx?$/);
reducer.keys().forEach(reducer);
module.exports = reducer;

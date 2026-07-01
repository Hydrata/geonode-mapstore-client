// Scoped test entry (TASK-2038, epic 2037 W1): the scenario-config helper
// suite (validateScenario / validateCategoryProgress) and the scenarios
// reducer default-resolution regression test.
var helpers = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioHelpers-test\.jsx?$/);
helpers.keys().forEach(helpers);
var reducer = require.context('./js/plugins/hydrata/Anuga/reducers/__tests__', false, /scenariosReducer-test\.jsx?$/);
reducer.keys().forEach(reducer);
module.exports = reducer;

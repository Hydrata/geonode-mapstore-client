// Scoped test entry (epic TASK-2706 W5): the three ANUGA suites that had NO
// scoped runner and therefore only ~1-hour full-suite feedback, which is
// precisely how the TDD "watch it fail" step gets skipped.
//
//   scenarioHeaderActions-test.js       — the toolbar money chip (TASK-2716).
//   anugaScenarioMenu-test.js           — AnugaResultsMenuClass's filter +
//                                         empty-state branch (TASK-2715).
//   epicRegistrationCompleteness-test.js— the barrel + on-disk epic
//                                         registration guard (TASK-2742,
//                                         guard shipped by TASK-2733).
//
// Same shape as tests-terrainsupersede-scoped.webpack.js (TASK-2572) and
// tests-scenarios-scoped.webpack.js (TASK-2038).
var headerActions = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioHeaderActions-test\.jsx?$/);
headerActions.keys().forEach(headerActions);
var resultsMenu = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /anugaScenarioMenu-test\.jsx?$/);
resultsMenu.keys().forEach(resultsMenu);
var epicRegistration = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /epicRegistrationCompleteness-test\.jsx?$/);
epicRegistration.keys().forEach(epicRegistration);
module.exports = headerActions;

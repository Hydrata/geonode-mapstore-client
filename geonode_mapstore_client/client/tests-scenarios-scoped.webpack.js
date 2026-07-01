// Scoped test entry (TASK-2038, epic 2037 W1): the scenario-config helper
// suite (validateScenario / validateCategoryProgress) and the scenarios
// reducer default-resolution regression test.
//
// TASK-2045 (F3, epic 2037 W1b) added scenarioCategoryRail-test.js — the
// rail-wiring coverage for boundary feature-presence gating.
//
// TASK-2039 (F4, epic 2037 W2) added terrainUploadCrsPanel-test.js (i18n +
// detected-CRS + a11y proof) and anugaI18n-test.js (terrainCrs* key coverage).
//
// TASK-2042 (F2-residual, epic 2037 W2) added crudEpics-test.js —
// retryAnugaRunEpic no longer arms a poll on the superseded old run id.
var helpers = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioHelpers-test\.jsx?$/);
helpers.keys().forEach(helpers);
var rail = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /scenarioCategoryRail-test\.jsx?$/);
rail.keys().forEach(rail);
var terrainCrs = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /terrainUploadCrsPanel-test\.jsx?$/);
terrainCrs.keys().forEach(terrainCrs);
var i18n = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /anugaI18n-test\.jsx?$/);
i18n.keys().forEach(i18n);
var crudEpics = require.context('./js/plugins/hydrata/Anuga/epics/__tests__', false, /crudEpics-test\.jsx?$/);
crudEpics.keys().forEach(crudEpics);
var reducer = require.context('./js/plugins/hydrata/Anuga/reducers/__tests__', false, /scenariosReducer-test\.jsx?$/);
reducer.keys().forEach(reducer);
module.exports = reducer;

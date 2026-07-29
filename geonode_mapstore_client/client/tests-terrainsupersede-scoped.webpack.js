// Scoped test entry (TASK-2572): the two suites that pin "a datum-shift
// SUPERSEDED terrain must stop rendering".
//
//   terrainEpics-test.js    — supersededTerrainVisibilityEpic: derives
//                             visibility:false for the superseded terrain's DEM
//                             + hillshade on every terrain-data load, so the
//                             result is fetch-order independent (AC1/AC3) and
//                             reverses when superseded_by is cleared (AC4).
//   anugaInputMenu-test.js  — _buildTerrainGroups: the superseded terrain gets
//                             NO row of any kind once the models arrive —
//                             neither a terrain group nor the stand-alone
//                             fallback row (AC3/AC4, FE half).
//
// Same shape as tests-layerorder-scoped.webpack.js (TASK-1916/1905).
var terrainEpics = require.context('./js/plugins/hydrata/Anuga/epics/__tests__', false, /terrainEpics-test\.jsx?$/);
terrainEpics.keys().forEach(terrainEpics);
var inputMenu = require.context('./js/plugins/hydrata/Anuga/components/__tests__', false, /anugaInputMenu-test\.jsx?$/);
inputMenu.keys().forEach(inputMenu);
module.exports = terrainEpics;

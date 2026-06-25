// Scoped test entry: only layerOrderEpics-test.js
// Used by TASK-1916/1905 to run a fast subset.
var context = require.context('./js/plugins/hydrata/Anuga/epics/__tests__', false, /layerOrderEpics-test\.jsx?$/);
context.keys().forEach(context);
module.exports = context;

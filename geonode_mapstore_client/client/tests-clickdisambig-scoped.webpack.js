// Scoped test entry (epic 1969 W2-corrective-4): the clickDisambiguation epic+reducer
// suite AND the core IdentifyContainer test (which now exercises the anugaAggregating
// dock-defer prop). Fast subset for iterating on the flash fix.
var anuga = require.context('./js/plugins/hydrata/Anuga/epics/__tests__', false, /clickDisambiguationEpic-test\.jsx?$/);
anuga.keys().forEach(anuga);
var identify = require.context('./MapStore2/web/client/components/data/identify/__tests__', false, /IdentifyContainer-test\.jsx?$/);
identify.keys().forEach(identify);
// the Identify PLUGIN test (exercises the createStructuredSelector that now exposes anugaAggregating)
var identifyPlugin = require.context('./MapStore2/web/client/plugins/__tests__', false, /Identify-test\.jsx?$/);
identifyPlugin.keys().forEach(identifyPlugin);
module.exports = anuga;

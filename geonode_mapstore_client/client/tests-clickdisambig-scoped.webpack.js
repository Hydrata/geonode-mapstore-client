// Scoped test entry (epic 1969 W3): the clickDisambiguation epic+reducer suite,
// the clickTargetRegistry unit tests, the ClickDisambiguationPanel tests,
// the W3 target registration tests, and the core IdentifyContainer test
// (W2-corrective-4 dock-defer prop).
var registry = require.context('./js/plugins/hydrata/shared/__tests__', false, /clickTargetRegistry-test\.jsx?$/);
registry.keys().forEach(registry);
var panel = require.context('./js/plugins/hydrata/shared/components/__tests__', false, /ClickDisambiguationPanel-test\.jsx?$/);
panel.keys().forEach(panel);
var anuga = require.context('./js/plugins/hydrata/Anuga/epics/__tests__', false, /clickDisambiguationEpic-test\.jsx?$/);
anuga.keys().forEach(anuga);
// W3 target registration tests (legacyClickTargets + rasterClickTargets + anugaClickTargets)
var anugaTargets = require.context('./js/plugins/hydrata/Anuga/__tests__', false, /(anugaClickTargets|legacyClickTargets|rasterClickTargets)-test\.jsx?$/);
anugaTargets.keys().forEach(anugaTargets);
var identify = require.context('./MapStore2/web/client/components/data/identify/__tests__', false, /IdentifyContainer-test\.jsx?$/);
identify.keys().forEach(identify);
// the Identify PLUGIN test (exercises the createStructuredSelector that now exposes anugaAggregating)
var identifyPlugin = require.context('./MapStore2/web/client/plugins/__tests__', false, /Identify-test\.jsx?$/);
identifyPlugin.keys().forEach(identifyPlugin);
module.exports = anuga;

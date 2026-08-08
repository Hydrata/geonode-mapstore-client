// Scoped test entry (epic 2618 W3, dev-iteration only — NOT part of any
// subtask commit) — every playback __tests__ file, for fast RED/GREEN
// cycles instead of the full ~5000-spec suite.
var playback = require.context('./js/plugins/hydrata/Anuga/playback', true, /-test\.jsx?$/);
playback.keys().forEach(playback);
module.exports = playback;

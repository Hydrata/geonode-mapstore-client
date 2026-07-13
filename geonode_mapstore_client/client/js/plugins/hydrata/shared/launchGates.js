// TASK-2126 (epic TASK-2092 — bundled launch) — launch gates for features that
// are NOT ready for paying customers yet. A gated feature's entry point is
// rendered DISABLED with a "Coming soon" badge (see ComingSoonBadge) rather
// than removed, so users can see it is planned. Each flag also guards the
// feature's real content as defense-in-depth (so a leaked Redux state can't
// surface a gated panel).
//
// To re-enable a feature: flip its flag to `true` and delete the surrounding
// gate UI (the `disabled`/badge wiring at the entry point).
export const LAUNCH_GATES = {
    idfDerive: false,      // IDF tables tab → "Derive" sub-toggle
    networksTab: false     // Hydrology "Networks" rail tab
    // TASK-2253 — resultsProfile gate DELETED: Cross-section shipped, button live.
};

export default LAUNCH_GATES;

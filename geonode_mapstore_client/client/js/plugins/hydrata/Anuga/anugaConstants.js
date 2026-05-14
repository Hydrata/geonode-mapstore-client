// Shared constants for the Anuga plugin.
// Kept in a leaf module so it can be imported by both selectors and epics
// without inducing a cycle (selectorsAnuga.js ↔ epics/pollingEpics.js).

// Run statuses past which polling work is wasted.
export const TERMINAL_RUN_STATES = ['complete', 'error', 'cancelled'];

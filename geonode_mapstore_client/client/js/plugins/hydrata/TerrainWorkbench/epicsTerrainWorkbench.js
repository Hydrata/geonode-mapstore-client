/**
 * TASK-1599 (W1) — TerrainWorkbench epics barrel.
 *
 * Shell has no epics yet.  Placeholder exported so the barrel import in
 * TerrainWorkbench.js has a non-empty object (avoids webpack dead-code
 * elimination on the barrel module).
 *
 * Epics will be added by TASK-1600 (recipe UI) and subsequent subtasks.
 *
 * @see memory/mapstore-epic-never-registered-in-barrel.md — every epic that is
 * exported here MUST also appear in the createPlugin epics object in
 * TerrainWorkbench.js.
 */

// No epics for the shell.  Export an empty object so imports don't break.
export const terrainWorkbenchEpics = {};

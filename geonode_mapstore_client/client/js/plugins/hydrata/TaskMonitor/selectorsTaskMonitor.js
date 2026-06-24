/**
 * TaskMonitor selectors.
 *
 * Exported for cross-plugin use — other plugins can import these
 * to read TaskMonitor state without coupling.
 */

// TASK-1887 (epic 1884 W3): staleness window for a RUNNING process.
//
// A Process whose `updated` timestamp has not advanced for STALE_MS is
// treated as STALLED — the badge switches from a spinning "Running" to a
// static "Stalled" label, and the progress bar is hidden. The value MUST be
// shorter than the BE reaper window (TASK-1888, STALE_PROCESS_REAPER_MINUTES=15
// min = 900 000 ms) so the FE softens first and the BE makes it durable.
//
// Poll cadence: closed-panel=10s, open-panel=3s. 5 minutes gives ~100 missed
// open-panel ticks before the FE signals stalled — a generous window that
// covers a slow but alive worker without masking a truly dead one.
export const STALE_MS = 300000; // 5 min; FE softens first — BE reaps at 15 min (TASK-1888)

/**
 * isActiveProcess — exported so BOTH getFilteredProcesses and the epic's
 * setActiveCount use the SAME predicate (no duplicated status-list literal).
 *
 * A process is "active" iff:
 *   - status is pending OR running, AND
 *   - (now - Date.parse(p.updated)) < STALE_MS
 *
 * A running row whose updated timestamp is stale is considered "stalled" and
 * drops out of the active count / active filter list. The process record itself
 * stays in the store (the BE hasn't terminated it yet); ProcessRow renders a
 * "Stalled" badge instead of a spinning "Running" one.
 *
 * @param {object} p   Process object from the store.
 * @param {number} now Current timestamp (ms). Pass Date.now() in production;
 *                     injectable in tests for determinism.
 * @returns {boolean}
 */
export const isActiveProcess = (p, now) => {
    if (!p) return false;
    if (p.status !== 'pending' && p.status !== 'running') return false;
    if (!p.updated) return true; // no timestamp → assume alive (conservative)
    return (now - Date.parse(p.updated)) < STALE_MS;
};

export const getProcesses = (state) => state?.taskMonitor?.processes?.byId || {};
export const getAllProcessIds = (state) => state?.taskMonitor?.processes?.allIds || [];
export const getActiveCount = (state) => state?.taskMonitor?.processes?.activeCount || 0;

export const getPanelOpen = (state) => state?.taskMonitor?.ui?.panelOpen || false;
export const getFilter = (state) => state?.taskMonitor?.ui?.filter || 'active';
export const getExpandedProcessId = (state) => state?.taskMonitor?.ui?.expandedProcessId || null;
export const getShowLog = (state) => state?.taskMonitor?.ui?.showLog || false;

export const getProcessById = (state, processId) =>
    state?.taskMonitor?.processes?.byId?.[processId] || null;

export const getActiveProcesses = (state) => {
    const byId = getProcesses(state);
    return getAllProcessIds(state)
        .map(id => byId[id])
        .filter(p => p && (p.status === 'pending' || p.status === 'running'));
};

export const getProcessesByType = (state, processType) => {
    const byId = getProcesses(state);
    return getAllProcessIds(state)
        .map(id => byId[id])
        .filter(p => p && p.process_type === processType);
};

export const getProcessForObject = (state, processType, objectId) => {
    const byId = getProcesses(state);
    return getAllProcessIds(state)
        .map(id => byId[id])
        .find(p => p && p.process_type === processType && p.metadata?.source_object_id === objectId) || null;
};

export const getFilteredProcesses = (state) => {
    const byId = getProcesses(state);
    const filter = getFilter(state);
    const now = Date.now();
    return getAllProcessIds(state)
        .map(id => byId[id])
        .filter(p => {
            if (!p) return false;
            switch (filter) {
            // TASK-1887: active filter excludes stale running rows (they are
            // stalled — the BE hasn't reaped them yet, but the FE demotes them
            // so they don't pollute the "active" count display).
            case 'active': return isActiveProcess(p, now);
            case 'completed': return p.status === 'complete';
            case 'failed': return p.status === 'error';
            case 'all': return true;
            default: return true;
            }
        });
};

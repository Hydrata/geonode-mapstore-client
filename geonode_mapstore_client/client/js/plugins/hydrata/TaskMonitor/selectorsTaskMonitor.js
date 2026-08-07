/**
 * TaskMonitor selectors.
 *
 * Exported for cross-plugin use — other plugins can import these
 * to read TaskMonitor state without coupling.
 */

/**
 * isActiveProcess — exported so BOTH getFilteredProcesses and the epic's
 * setActiveCount use the SAME predicate (no duplicated status-list literal).
 *
 * TASK-2674 (epic 2662 W2.4): liveness is SERVER truth. The serializer
 * derives `liveness` (provisioning | live | stalled | zombie-candidate;
 * null for terminal rows) at read time from last_heartbeat (D5/D7) — the
 * FE-side five-minute clock heuristic (TASK-1887) is deleted and the FE
 * never derives liveness again.
 *
 * A process is "active" iff:
 *   - status is pending OR running, AND
 *   - the server has not declared it stalled / zombie-candidate.
 *
 * `provisioning` rows are active regardless of age (staleness-EXEMPT: a
 * Batch queue can legitimately hold a job for hours before the container
 * starts). A MISSING liveness field (synthetic FE rows like terrain-export,
 * or older payload shapes) is treated as alive — conservative, matching the
 * old "no timestamp → assume alive" stance. `wedged` is ADVISORY-ONLY (D5)
 * and never demotes a row out of the active set.
 *
 * @param {object} p Process object from the store.
 * @returns {boolean}
 */
export const isActiveProcess = (p) => {
    if (!p) return false;
    if (p.status !== 'pending' && p.status !== 'running') return false;
    return p.liveness !== 'stalled' && p.liveness !== 'zombie-candidate';
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
    return getAllProcessIds(state)
        .map(id => byId[id])
        .filter(p => {
            if (!p) return false;
            switch (filter) {
            // TASK-2674: active filter excludes rows the SERVER declares
            // stalled/zombie-candidate (the BE hasn't reaped them yet, but
            // they don't pollute the "active" count display; they remain
            // visible under the "all" filter with their liveness badge).
            case 'active': return isActiveProcess(p);
            case 'completed': return p.status === 'complete';
            case 'failed': return p.status === 'error';
            case 'all': return true;
            default: return true;
            }
        });
};

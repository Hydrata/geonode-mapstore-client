/**
 * TaskMonitor selectors.
 *
 * Exported for cross-plugin use — other plugins can import these
 * to read TaskMonitor state without coupling.
 */

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
            case 'active': return p.status === 'pending' || p.status === 'running';
            case 'completed': return p.status === 'complete';
            case 'failed': return p.status === 'error';
            case 'all': return true;
            default: return true;
            }
        });
};

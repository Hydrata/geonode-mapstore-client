// Action types
export const TM_TOGGLE_PANEL = 'TM_TOGGLE_PANEL';
export const TM_SET_FILTER = 'TM_SET_FILTER';
export const TM_EXPAND_PROCESS = 'TM_EXPAND_PROCESS';
export const TM_TOGGLE_LOG = 'TM_TOGGLE_LOG';
export const TM_SET_PROCESSES = 'TM_SET_PROCESSES';
export const TM_SET_ACTIVE_COUNT = 'TM_SET_ACTIVE_COUNT';
export const TM_UPDATE_PROCESS = 'TM_UPDATE_PROCESS';
export const TM_START_POLLING = 'TM_START_POLLING';
export const TM_STOP_POLLING = 'TM_STOP_POLLING';
export const TM_CANCEL_PROCESS = 'TM_CANCEL_PROCESS';
export const TM_CANCEL_PROCESS_RESULT = 'TM_CANCEL_PROCESS_RESULT';
// TASK-1651 (W1.5): initiate a terrain-file export (presigned S3 URL fetch).
export const TM_TERRAIN_EXPORT = 'TM_TERRAIN_EXPORT';

// Action creators
export const toggleTaskMonitorPanel = (open) => ({ type: TM_TOGGLE_PANEL, open });
export const setTaskMonitorFilter = (filter) => ({ type: TM_SET_FILTER, filter });
export const expandProcess = (processId) => ({ type: TM_EXPAND_PROCESS, processId });
export const toggleProcessLog = (show) => ({ type: TM_TOGGLE_LOG, show });
export const setProcesses = (processes) => ({ type: TM_SET_PROCESSES, processes });
export const setActiveCount = (count) => ({ type: TM_SET_ACTIVE_COUNT, count });
export const updateProcess = (process) => ({ type: TM_UPDATE_PROCESS, process });
export const startTaskMonitorPolling = () => ({ type: TM_START_POLLING });
export const stopTaskMonitorPolling = () => ({ type: TM_STOP_POLLING });
export const cancelProcess = (processId) => ({ type: TM_CANCEL_PROCESS, processId });
export const cancelProcessResult = (process) => ({ type: TM_CANCEL_PROCESS_RESULT, process });
// TASK-1651: dispatch to start a terrain export — projectId + terrainId + title.
export const terrainExport = (projectId, terrainId, title) => ({
    type: TM_TERRAIN_EXPORT, projectId, terrainId, title
});

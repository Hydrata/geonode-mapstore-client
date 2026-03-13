/**
 * TaskMonitor API Client
 *
 * Pure functions returning Promises. No Redux.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';

export const getProcesses = (params = {}) =>
    axios.get('/api/v2/tasks/processes/', { params });

export const getProcessDetail = (processId) =>
    axios.get(`/api/v2/tasks/processes/${processId}/`);

export const cancelProcess = (processId) =>
    axios.post(`/api/v2/tasks/processes/${processId}/cancel/`);

export const getActiveProcesses = (params = {}) =>
    axios.get('/api/v2/tasks/active/', { params });

export const getActiveCount = (params = {}) =>
    axios.get('/api/v2/tasks/active/count/', { params });

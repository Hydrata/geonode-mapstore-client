/**
 * Hydrology API Client — pure functions returning Promises.
 *
 * TASK-934: thin axios wrappers for IDF derive + retrieve. Errors are NOT
 * caught here — callers (epics) handle 503 (celery_anuga disabled) and
 * 400/422 (validation) distinctly.
 */
import axios from '../../../../../MapStore2/web/client/libs/ajax';

// POST /api/v2/anuga/projects/{pid}/idf-tables/derive/
// Payload: {lat, lon, durations_min, return_periods_yr, source?, start_year?, end_year?, climate_scenario?}
// 202 → {task_id, process_id}; 503 → site disabled; 400/422 → validation.
export const deriveIdf = (projectId, payload) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`, payload);

// GET /api/v2/anuga/projects/{pid}/idf-tables/{id}/
// Returns the full IDFTable (intensities_mm_per_hr, ci_lower_mm_per_hr,
// ci_upper_mm_per_hr, durations_min, return_periods_yr, provenance, ag_grid).
export const getIdfTable = (projectId, idfTableId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/idf-tables/${idfTableId}/`);

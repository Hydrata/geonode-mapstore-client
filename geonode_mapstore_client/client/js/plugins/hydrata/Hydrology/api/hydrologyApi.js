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
// ci_upper_mm_per_hr, durations_min, return_periods_yr, provenance, and a
// `data` adapter ({rowData} keyed by the FE IdfTable ARI accessorKeys).
export const getIdfTable = (projectId, idfTableId) =>
    axios.get(`/api/v2/anuga/projects/${projectId}/idf-tables/${idfTableId}/`);

// POST /api/v2/anuga/projects/{pid}/time-series/derive-design-storm/
// TASK-1451 (W4) — Synchronous endpoint; returns 201 + the persisted TimeSeries
// when mode='derive' (default / omitted).
// TASK-1501 (W4b) — mode='preview' + cells=[...] for rowless batch preview (200).
// Payload: {mode?, idf_table_id, cells?[{pattern,ari|aep,duration_min,timestep_min}],
//           pattern?, aep|ari?, duration_min?, timestep_min?, peak_position?, name?}
export const deriveDesignStorm = (projectId, payload) =>
    axios.post(`/api/v2/anuga/projects/${projectId}/time-series/derive-design-storm/`, payload);

// POST /api/v2/anuga/projects/{pid}/rainfalls/{pk}/attach-design-storm/
// TASK-1501 (W4b) — Materialises exactly one TimeSeries row and returns it (201).
// Payload: {idf_table_id, pattern, ari|aep, duration_min, timestep_min,
//           peak_position?, name?, feature_id?}
export const attachDesignStorm = (projectId, rainfallPk, payload) =>
    axios.post(
        `/api/v2/anuga/projects/${projectId}/rainfalls/${rainfallPk}/attach-design-storm/`,
        payload
    );

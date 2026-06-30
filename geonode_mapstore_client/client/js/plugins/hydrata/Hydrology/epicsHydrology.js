import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";
// TASK-1804: analytics instrumentation for IDF derive lifecycle.
import { trackEvent } from '@js/utils/analytics';

import {
    INIT_HYDROLOGY,
    FETCH_HYDROLOGY_TIME_SERIES_DATA,
    fetchHydrologyTimeSeriesData,
    setHydrologyTimeSeriesData,
    errorHydrologyTimeSeriesData,
    // TASK-1986 (epic-1970) — hydrograph slice
    FETCH_HYDROLOGY_HYDROGRAPH_DATA,
    fetchHydrologyHydrographData,
    setHydrologyHydrographData,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    fetchHydrologyTemporalPatternData,
    setHydrologyTemporalPatternData,
    errorHydrologyTemporalPatternData,
    FETCH_HYDROLOGY_IDF_TABLE_DATA,
    fetchHydrologyIdfTableData,
    setHydrologyIdfTableData,
    errorHydrologyIdfTableData,
    SAVE_HYDROLOGY_ITEM,
    SAVE_HYDROLOGY_ITEM_SUCCESS,
    saveHydrologyItemSuccess,
    saveHydrologyItemFailure,
    createHydrologyItemSuccess,
    createHydrologyItemFailure,
    DELETE_HYDROLOGY_ITEM,
    deleteHydrologyItemSuccess,
    deleteHydrologyItemFailure,
    DERIVE_IDF_REQUEST,
    SET_IDF_DERIVE_PROCESS_ID,
    setIdfDeriveProcessId,
    setIdfDeriveError,
    setIdfDeriveResult,
    setIdfDeriveLat,
    setIdfDeriveLon,
    SET_IDF_DERIVE_MAP_PICK_ACTIVE,
    setIdfDeriveMapPickActive,
    setCeleryAnugaEnabled,
    DERIVE_DESIGN_STORM_REQUEST,
    deriveDesignStormSuccess,
    deriveDesignStormFailure,
    // TASK-1501 (W4b) — projection browser
    PREVIEW_DESIGN_STORMS_REQUEST,
    previewDesignStormsRequest,
    previewDesignStormsSuccess,
    previewDesignStormsFailure,
    ATTACH_DESIGN_STORM_REQUEST,
    attachDesignStormSuccess,
    attachDesignStormFailure,
    markProjectionStale,
    // TASK-1561 (W3b) — bulk save
    SAVE_DESIGN_STORMS_REQUEST,
    saveDesignStormsSuccess,
    saveDesignStormsFailure
} from "../Hydrology/actionsHydrology";
import {show} from '../../../../MapStore2/web/client/actions/notifications';
import {CLICK_ON_MAP, registerEventListener, unRegisterEventListener} from '../../../../MapStore2/web/client/actions/map';
import {purgeMapInfoResults, hideMapinfoMarker, toggleMapInfoState} from '../../../../MapStore2/web/client/actions/mapInfo';
import {deriveIdf, getIdfTable, deriveDesignStorm, attachDesignStorm} from './api/hydrologyApi';
import {getAnugaConfig} from '../Anuga/api/anugaApi';

// V2P-79 / V2P-77 — V1 hydrology routes were /anuga/api/{pid}/<endpoint>/
// where <endpoint> was 'time-series' / 'temporal-pattern' / 'sv-idf-table'
// (singular, the V1 route segments). V2 paths nest under projects with
// pluralised segments per /opt/hydrata/apps/gn_anuga/urls.py:
//   * /api/v2/anuga/projects/{pid}/idf-tables/
//   * /api/v2/anuga/projects/{pid}/time-series/        (already plural)
//   * /api/v2/anuga/projects/{pid}/temporal-patterns/
//
// Action `activeHydrologyPage` historically carries the V1 route segment
// (also matches the per-page UI tab). Map at the API boundary so callers
// stay unchanged.
const V1_TO_V2_HYDROLOGY = {
    'time-series': 'time-series',
    'temporal-pattern': 'temporal-patterns',
    'sv-idf-table': 'idf-tables',
    // TASK-1986 (epic-1970): hydrographs share the BE time-series endpoint
    // (series_type=hydrograph filter applied at fetch time; POST stamps the type).
    'hydrographs': 'time-series'
};

const v2Hydrology = (page) => V1_TO_V2_HYDROLOGY[page] || page;

async function fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction, queryString = '') {
    try {
        const response = await axios.get(
            `/api/v2/anuga/projects/${projectId}/${v2Hydrology(endpoint)}/${queryString}`
        );
        // Unwrap DRF pagination — a reducer .map() TypeError propagates
        // through redux-observable and tears down every merged epic timer
        // (TaskMonitor poller included).
        const data = response.data;
        const payload = Array.isArray(data) ? data : (data?.results ?? []);
        return dispatchFunction(payload);
    } catch (error) {
        return errorFunction(error);
    }
}

export const initHydrologyEpic = (action$, store) =>
    action$
        .ofType(INIT_HYDROLOGY)
        .filter(() => store.getState()?.gnresource.id)
        .filter(() => store.getState()?.anuga?.projects?.data?.id)
        .mergeMap(() => {
            let response;
            try {
                const user = store.getState()?.security?.user;
                if (!user) return null;

                response = Rx.Observable.of(
                    fetchHydrologyTimeSeriesData(),
                    fetchHydrologyTemporalPatternData(),
                    fetchHydrologyIdfTableData(),
                    // TASK-1986 (epic-1970): fetch hydrograph series separately
                    fetchHydrologyHydrographData()
                );
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTimeSeriesEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TIME_SERIES_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projects?.data?.id;
                const endpoint = "time-series";
                const dispatchFunction = setHydrologyTimeSeriesData;
                const errorFunction = errorHydrologyTimeSeriesData;
                // TASK-1970 W3 fix: Design Storms = hyetographs ONLY. The BE list
                // returns ALL series_type rows when unfiltered, so without this
                // filter hydrograph rows (created in the Hydrographs panel) leak
                // into the Design Storms list — the mirror of fetchHydrographEpic's
                // ?series_type=hydrograph.
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction, '?series_type=hyetograph');
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

// TASK-1986 (epic-1970) — fetch only series_type=hydrograph rows.
// Stored in state.hydrology.hydrographs (separate from timeSeriess so each
// panel sees only its own type without client-side filtering).
// TASK-2015 (epic-1970 W7): DRY'd onto the shared fetchAndDispatch helper —
// mirrors fetchTimeSeriesEpic, with a ?series_type=hydrograph query-string.
// The errorFunction preserves the prior NON-FATAL behaviour: on an axios
// failure dispatch setHydrologyHydrographData([]) so the panel still renders
// (an empty list) rather than tearing down the merged epic timers.
export const fetchHydrographEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_HYDROGRAPH_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projects?.data?.id;
                const endpoint = "time-series";
                const dispatchFunction = setHydrologyHydrographData;
                // Non-fatal: an empty list keeps the Hydrographs panel rendering.
                const errorFunction = () => setHydrologyHydrographData([]);
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction, '?series_type=hydrograph');
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTemporalPatternEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projects?.data?.id;
                const endpoint = "temporal-pattern";
                const dispatchFunction = setHydrologyTemporalPatternData;
                const errorFunction = errorHydrologyTemporalPatternData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchIdfTableEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_IDF_TABLE_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projects?.data?.id;
                const endpoint = "sv-idf-table";
                const dispatchFunction = setHydrologyIdfTableData;
                const errorFunction = errorHydrologyIdfTableData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const saveHydrologyItemEpic = (action$, store) =>
    action$
        .ofType(SAVE_HYDROLOGY_ITEM)
        .mergeMap(action => {
            const postData = {
                headers: {
                    'Accept': 'application/json'
                },
                ...action.item,
                data: action.item.data
            };
            const projectId = store.getState()?.anuga?.projects?.data?.id;
            if (typeof action.item?.id === 'number' || typeof action.item?.id === 'string' && !isNaN(Number(action.item?.id))) {
                return Rx.Observable.from(
                    axios.patch(
                        `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/${action.item.id}/`,
                        postData
                    )
                )
                    .mergeMap(response =>
                        Rx.Observable.from([
                            saveHydrologyItemSuccess(action.activeHydrologyPage, response.data),
                            show({
                                "message": `Successfully saved ${response.data.name}`,
                                "title": "hydrata.hydrology.success",
                                "uid": 1000,
                                "position": "tc"
                            })
                        ])
                    )
                    .catch(error => Rx.Observable.from([
                        saveHydrologyItemFailure(error.data),
                        show({
                            "message": `Error: ${error.data?.errors}`,
                            "title": "hydrata.hydrology.error",
                            "uid": 6000,
                            "position": "tc"
                        }, 'error')
                    ]));
            }
            return Rx.Observable.from(
                axios.post(
                    `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/`,
                    postData
                )
            )
                .mergeMap(response =>
                    Rx.Observable.from([
                        createHydrologyItemSuccess(action.activeHydrologyPage, response.data),
                        show({
                            "message": `Successfully created ${response.data.name}`,
                            "title": "hydrata.hydrology.success",
                            "uid": 1000,
                            "position": "tc"
                        })
                    ])
                )
                .catch(error => Rx.Observable.from([
                    createHydrologyItemFailure(error.data),
                    show({
                        "message": `Error: ${error.data?.errors}`,
                        "title": "hydrata.hydrology.error",
                        "uid": 6000,
                        "position": "tc"
                    }, 'error')
                ]));
        });


export const deleteHydrologyItemEpic = (action$, store) =>
    action$
        .ofType(DELETE_HYDROLOGY_ITEM)
        .mergeMap(action => {
            const projectId = store.getState()?.anuga?.projects?.data?.id;
            return Rx.Observable.from(
                axios.delete(
                    `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/${action.item.id}/`
                )
            )
                .mergeMap(() =>
                    Rx.Observable.from([
                        deleteHydrologyItemSuccess(action.activeHydrologyPage, action.item),
                        show({
                            "message": `Successfully deleted ${action.item.name}`,
                            "title": "hydrata.hydrology.success",
                            "uid": 1000,
                            "position": "tc"
                        })
                    ])
                )
                .catch(error => {
                    // TASK-1557 (W2) — surface a clear message on a blocked
                    // delete. A 409 from the block-if-attached guard returns the
                    // DRF APIException shape {detail: "...detach first..."}; a
                    // generic 4xx/5xx may instead carry {errors: ...}. Prefer
                    // `detail` so the "Detach from rainfall feature(s) first"
                    // copy reaches the user (was: "Error: undefined" on 409).
                    const data = error?.data;
                    const reason = data?.detail || data?.errors || error?.message || 'delete failed';
                    return Rx.Observable.from([
                        deleteHydrologyItemFailure(data),
                        show({
                            "message": `Error: ${reason}`,
                            "title": "hydrata.hydrology.error",
                            "uid": 6000,
                            "position": "tc"
                        }, 'error')
                    ]);
                });
        });

// ERA5 annual-maxima GEV derivation floors. The derive endpoint can only
// produce ARIs the model is defined for, so the derive payload is clamped to:
//   • durations ≥ 60 min — ERA5-Land is hourly; sub-hourly intensities aren't
//     resolvable (services.validate_durations_min rejects < 60 with a 400).
//   • return periods ≥ 1 yr — the GEV quantile p = 1 − 1/T needs T ≥ 1
//     (T = 0.5 → p = −1 → NaN), and the serializer's IntegerField child 400s
//     on a fractional 0.5.
// The canonical matrix deliberately KEEPS the sub-hourly rows + the 0.5yr
// column for manually-entered IDF tables, so these are filtered OUT of the
// derive POST (in deriveIdfEpic) rather than rejected at parse time. See the
// deploy spine uat_blockers (epic 1497).
const DERIVE_MIN_DURATION_MIN = 60;
const DERIVE_MIN_RETURN_PERIOD_YR = 1;

// TASK-1789 — ERA5 year-range constants.
// Mirrors idf_core._ERA5_MAX_YEAR. Change here if the backend value changes.
// 10yr = quick (ERA5_MAX-9 .. ERA5_MAX); 75yr = full (1950 .. ERA5_MAX).
// GPEX-covered points bypass ERA5 entirely — year-range only governs Tier-3.
export const ERA5_MAX_YEAR = 2026;
export const IDF_YEAR_RANGE = {
    '10yr': {start_year: ERA5_MAX_YEAR - 9, end_year: ERA5_MAX_YEAR},
    '75yr': {start_year: 1950, end_year: ERA5_MAX_YEAR}
};

// TASK-934 — Parse the comma-separated text fields into number arrays.
// Returns {durations: number[], rps: number[], error: string|null}.
// Parsing stays permissive (durations ≥1, rps ≥0.5) so the matrix can carry
// the manual-only sub-hourly / sub-annual cells; the derive floors above are
// applied when the payload is built. Duplicates rejected so the backend
// doesn't waste compute on redundant cells.
const parseIdfDeriveInputs = (durationsText, rpsText) => {
    const parseList = (text, minVal, label) => {
        const tokens = String(text || '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        if (tokens.length === 0) return {values: null, error: `${label} required`};
        const values = [];
        for (const t of tokens) {
            const n = Number(t);
            if (!Number.isFinite(n)) return {values: null, error: `${label}: '${t}' is not a number`};
            if (n < minVal) return {values: null, error: `${label}: ${n} below minimum ${minVal}`};
            if (values.indexOf(n) !== -1) return {values: null, error: `${label}: duplicate ${n}`};
            values.push(n);
        }
        return {values, error: null};
    };
    const d = parseList(durationsText, 1, 'Durations');
    if (d.error) return {durations: null, rps: null, error: d.error};
    const r = parseList(rpsText, 0.5, 'Return periods');
    if (r.error) return {durations: null, rps: null, error: r.error};
    return {durations: d.values, rps: r.values, error: null};
};

// Actions emitted once an IDF derive completes and its IDFTable has been
// fetched: stash the result on idfDerive.result, refresh the Items list so the
// new table shows under IDF Tables → Input without a reload (the list is
// otherwise fetched only on INIT_HYDROLOGY), and fire the COMPLETE analytics
// event (TASK-1804). Shared by the GPEX fast-path (deriveIdfEpic) and the
// background-poll path (idfDeriveCompleteEpic).
const idfDeriveCompleteActions = (idfTableData) => {
    trackEvent('process', 'complete', 'idf-derive-complete');
    return Rx.Observable.from([
        setIdfDeriveResult(idfTableData),
        fetchHydrologyIdfTableData()
    ]);
};

// TASK-934 — POST /api/v2/anuga/projects/{pid}/idf-tables/derive/.
// 202 → setIdfDeriveProcessId. 503 → unavailable (celery_anuga disabled).
// 400/422 → BE validation error (surface detail inline).
export const deriveIdfEpic = (action$, store) =>
    action$
        .ofType(DERIVE_IDF_REQUEST)
        // exhaustMap (not mergeMap): while a derive POST is in flight, ignore a
        // second DERIVE_IDF_REQUEST so a double-click can't fire two derive
        // tasks (TASK-1539). Validation-error inner observables complete
        // immediately, so a retry after a rejected request is unaffected.
        .exhaustMap(() => {
            const state = store.getState();
            const projectId = state?.anuga?.projects?.data?.id;
            const slice = state?.hydrology?.idfDerive || {};
            if (!projectId) {
                return Rx.Observable.of(setIdfDeriveError('No active project'));
            }
            // Reject null/undefined first — Number(null) === 0 which is
            // finite, so the isFinite() guard alone would let a missing
            // pin slip through and hit the BE with lat=0, lon=0.
            if (slice.lat === null || slice.lat === undefined
                || slice.lon === null || slice.lon === undefined) {
                return Rx.Observable.of(setIdfDeriveError('Pick a point on the map (lat/lon required)'));
            }
            const lat = Number(slice.lat);
            const lon = Number(slice.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                return Rx.Observable.of(setIdfDeriveError('Pick a point on the map (lat/lon required)'));
            }
            const parsed = parseIdfDeriveInputs(slice.durationsText, slice.rpsText);
            if (parsed.error) return Rx.Observable.of(setIdfDeriveError(parsed.error));
            // Clamp to the ERA5 derive floors (see DERIVE_MIN_* above): sub-hourly
            // durations and sub-annual return periods can't be derived, so drop
            // them from the POST. They stay valid in the manual IDF table.
            const durations_min = parsed.durations.filter(d => d >= DERIVE_MIN_DURATION_MIN);
            const return_periods_yr = parsed.rps.filter(rp => rp >= DERIVE_MIN_RETURN_PERIOD_YR);
            if (durations_min.length === 0) {
                return Rx.Observable.of(setIdfDeriveError(
                    'Select at least one duration of 60 min or more. ERA5-Land is '
                    + 'hourly, so sub-hourly durations cannot be derived.'
                ));
            }
            if (return_periods_yr.length === 0) {
                return Rx.Observable.of(setIdfDeriveError(
                    'Select at least one return period of 1 yr or more. Sub-annual '
                    + 'ARIs cannot be estimated from annual maxima.'
                ));
            }
            // TASK-1789 — include year-range in payload. GPEX-covered points
            // return 200 instantly; for ERA5 (Tier-3) the year-range controls
            // the record length. Default '10yr' when slice has no yearRangeMode.
            const yearRangeMode = slice.yearRangeMode || '10yr';
            const yearRange = IDF_YEAR_RANGE[yearRangeMode] || IDF_YEAR_RANGE['10yr'];
            const payload = {
                lat, lon, durations_min, return_periods_yr,
                start_year: yearRange.start_year,
                end_year: yearRange.end_year
            };
            // TASK-1804: fire START when the derive POST is triggered.
            trackEvent('process', 'start', 'idf-derive-start');
            return Rx.Observable.from(deriveIdf(projectId, payload))
                .mergeMap(response => {
                    const data = response?.data || {};
                    const httpStatus = response?.status;
                    // TASK-1789 — GPEX fast-path: 200 with tier:'gpex' + idftable_id.
                    // Fetch the table immediately and dispatch result directly.
                    // The background (202) path goes through idfDeriveCompleteEpic.
                    if (httpStatus === 200 && data.tier === 'gpex' && data.idftable_id) {
                        const idftableId = data.idftable_id;
                        return Rx.Observable.from(getIdfTable(projectId, idftableId))
                            // GPEX fast-path success: stash + refresh list + COMPLETE event.
                            .mergeMap(tableResponse => idfDeriveCompleteActions(tableResponse.data))
                            .catch(fetchErr => Rx.Observable.of(
                                setIdfDeriveError(fetchErr?.message || 'Failed to fetch GPEX IDF result')
                            ));
                    }
                    // 202 background path — hand off to idfDeriveCompleteEpic.
                    return Rx.Observable.from([
                        setIdfDeriveProcessId(data.task_id || null, data.process_id || null)
                    ]);
                })
                .catch(error => {
                    // The MapStore2 ajax interceptor rejects with
                    // {...error.response, originalError} — so status/data
                    // live one level up, NOT under .response.
                    // See client/MapStore2/web/client/libs/ajax.js:155-173.
                    const status = error?.status
                        || error?.response?.status
                        || error?.originalError?.response?.status;
                    if (status === 503) {
                        // TASK-1804: fire ERROR on 503 (celery unavailable).
                        trackEvent('process', 'error', 'idf-derive-error');
                        return Rx.Observable.from([
                            setIdfDeriveError('IDF derivation is unavailable on this site'),
                            setCeleryAnugaEnabled(false)
                        ]);
                    }
                    // TASK-1804: fire ERROR on generic POST failure.
                    trackEvent('process', 'error', 'idf-derive-error');
                    const detail = error?.data?.detail
                        || error?.data?.error
                        || error?.response?.data?.detail
                        || error?.message
                        || 'Derive failed';
                    return Rx.Observable.from([setIdfDeriveError(String(detail))]);
                });
        });

// TASK-934 — Watch TaskMonitor for our derive process to complete.
// Polls the redux state (TaskMonitor already polls the BE every 3-10s and
// updates state.taskMonitor.processes.byId). When status === 'complete',
// fetch the IDFTable, stash it on idfDerive.result AND refresh the Items
// list (fetchHydrologyIdfTableData) so the new table appears under IDF
// Tables → Input without a reload. On 'error', surface the BE error message.
//
// Why poll redux instead of subscribing to a specific action: TaskMonitor
// dispatches TM_SET_PROCESSES (bulk) and updateProcess (single); rather
// than couple to those internals we sample state on a timer that lives
// only while a derive is in flight.
//
// Cap matches the IDF Batch jobdef ceiling (attemptDurationSeconds: 7200,
// ansible/.../idf-batch-deploy/templates/idf-jobdef.json.j2) so the FE never
// declares a "timeout" before the backend itself would. The old 150-tick /
// 5-min cap pre-dated the move to AWS Batch (epic-1830 W4): a 75-yr ERA5 GEV
// fit on Batch legitimately runs ~60 min, and the old celery ~300s soft limit
// no longer applies — so the short cap tripped a FALSE "Derive timed out" on a
// healthy 3770s fit (map 5600, 2026-06-25) while the task manager correctly
// showed Complete. Reading redux is cheap (no API call per tick), so a
// generous cap costs nothing. Mirrors TW_DERIVE_POLL_MAX (epicsTerrainWorkbench).
const IDF_DERIVE_POLL_MAX_ATTEMPTS = 3600;
// When the FE poll cap IS reached, defer to the task monitor instead of
// inventing a cause: the panel can't know WHY a derive is slow, and the old
// "ERA5 archive unavailable" guess was wrong on a perfectly healthy long run.
// The task manager carries the real, linked process status.
export const IDF_DERIVE_TIMEOUT_MESSAGE =
    'Still deriving — check the task monitor for status.';

export const idfDeriveCompleteEpic = (action$, store) =>
    action$
        .ofType(SET_IDF_DERIVE_PROCESS_ID)
        .filter(action => !!action.processId)
        .switchMap(action => {
            const targetPid = action.processId;
            const fetched = {done: false};
            return Rx.Observable.timer(0, 2000)
                .take(IDF_DERIVE_POLL_MAX_ATTEMPTS)
                .takeWhile(() => !fetched.done)
                // Stop polling if user kicks off another derive or panel closes.
                .takeUntil(action$.ofType(DERIVE_IDF_REQUEST))
                .mergeMap((tick) => {
                    const state = store.getState();
                    const proc = state?.taskMonitor?.processes?.byId?.[targetPid];
                    if (!proc) {
                        if (tick === IDF_DERIVE_POLL_MAX_ATTEMPTS - 1) {
                            fetched.done = true;
                            // TASK-1804: fire ERROR on poll timeout (proc never registered).
                            trackEvent('process', 'error', 'idf-derive-error');
                            return Rx.Observable.of(setIdfDeriveError(IDF_DERIVE_TIMEOUT_MESSAGE));
                        }
                        return Rx.Observable.empty();
                    }
                    if (proc.status === 'complete') {
                        fetched.done = true;
                        const projectId = state?.anuga?.projects?.data?.id;
                        const idftableId = proc?.metadata?.idftable_id;
                        if (!projectId || !idftableId) {
                            return Rx.Observable.of(
                                setIdfDeriveError('Derive completed but result id missing')
                            );
                        }
                        return Rx.Observable.from(getIdfTable(projectId, idftableId))
                            // Poll-complete success: stash + refresh list + COMPLETE event.
                            .mergeMap(response => idfDeriveCompleteActions(response.data))
                            .catch(err => Rx.Observable.of(
                                setIdfDeriveError(err?.message || 'Failed to fetch IDF result')
                            ));
                    }
                    if (proc.status === 'error' || proc.status === 'cancelled') {
                        fetched.done = true;
                        // TASK-1804: fire ERROR when the backend reports failure.
                        trackEvent('process', 'error', 'idf-derive-error');
                        const msg = proc?.metadata?.error_message
                            || proc?.error_message
                            || (proc.status === 'cancelled' ? 'Derive cancelled' : 'Derive failed');
                        return Rx.Observable.of(setIdfDeriveError(String(msg)));
                    }
                    if (tick === IDF_DERIVE_POLL_MAX_ATTEMPTS - 1) {
                        fetched.done = true;
                        // TASK-1804: fire ERROR on poll timeout.
                        trackEvent('process', 'error', 'idf-derive-error');
                        return Rx.Observable.of(setIdfDeriveError(IDF_DERIVE_TIMEOUT_MESSAGE));
                    }
                    return Rx.Observable.empty();
                });
        });

// TASK-934 — Map-pick handler. When user clicks "Pick on map" we set
// mapPickActive=true; the next CLICK_ON_MAP captures lat/lon and clears
// the flag. Mirrors the HGeval mapClickEpic pattern.
// TASK-1499 (W2) — Round lat/lon to 2 dp on write so stored value
// matches the displayed value carried into the derive POST.
export const idfDeriveMapPickEpic = (action$, store) =>
    action$
        .ofType(CLICK_ON_MAP)
        .filter(() => store.getState()?.hydrology?.idfDerive?.mapPickActive === true)
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        .filter(({point}) => point?.latlng?.lat != null && point?.latlng?.lng != null)
        .mergeMap(({point}) => Rx.Observable.from([
            setIdfDeriveLat(Number(point.latlng.lat.toFixed(2))),
            setIdfDeriveLon(Number(point.latlng.lng.toFixed(2))),
            setIdfDeriveMapPickActive(false)
        ]));

// TASK-1499 (W2) — Identify-suppression manager epic for the IDF-derive
// map-pick flow. Cloned from hgevalMapClickManagerEpic (epicsHGeval.js:211).
// On mapPickActive=true: disable Identify (guarded), register event listener,
// purge any open identify results. On mapPickActive=false: unregister and
// restore Identify (only if we disabled it). The weDisabledMapInfo closure
// guard prevents double-toggle and respects a user who already had Identify
// off before arming pick.
export const hydrologyIdfPickManagerEpic = (action$, store) => {
    let weDisabledMapInfo = false;
    return action$
        .ofType(SET_IDF_DERIVE_MAP_PICK_ACTIVE)
        .switchMap(() => {
            const state = store.getState();
            const mapPickActive = state?.hydrology?.idfDerive?.mapPickActive;
            if (mapPickActive) {
                const actions = [
                    purgeMapInfoResults(),
                    hideMapinfoMarker(),
                    registerEventListener('click', 'hydrologyIdfPick')
                ];
                if (!weDisabledMapInfo && state?.mapInfo?.enabled !== false) {
                    actions.push(toggleMapInfoState());
                    weDisabledMapInfo = true;
                }
                return Rx.Observable.from(actions);
            }
            const actions = [unRegisterEventListener('click', 'hydrologyIdfPick')];
            if (weDisabledMapInfo) {
                actions.push(toggleMapInfoState());
                weDisabledMapInfo = false;
            }
            return Rx.Observable.from(actions);
        });
};

// TASK-934 — Hydrate celery_anuga_enabled from /api/v2/anuga/config/.
// Fires once on the first INIT_HYDROLOGY (Hydrology container mount).
// Failure → silently keep the optimistic `true` default; the 503 path
// in deriveIdfEpic catches the actual disabled-site case.
export const loadAnugaConfigEpic = (action$) =>
    action$
        .ofType(INIT_HYDROLOGY)
        .take(1)
        .mergeMap(() =>
            Rx.Observable.from(getAnugaConfig())
                .map(cfg => setCeleryAnugaEnabled(cfg?.celery_anuga_enabled !== false))
                .catch(() => Rx.Observable.empty())
        );

// ---------------------------------------------------------------------------
// Helper: build projection cells from the current spec + loaded IDF table.
// Returns [{pattern, ari, duration_min, timestep_min}] for the filtered view.
// Pure function, exported for testing.
// ---------------------------------------------------------------------------
export function _buildProjectionCells(projection, idfTables) {
    if (!projection || !projection.selectedIdfTableId) return [];
    const idfTable = (idfTables || []).find(t => t.id === projection.selectedIdfTableId);
    if (!idfTable) return [];

    // Derive available ARIs from the IDF table's return_periods_yr or columnDefs.
    // W3 stored these on data.return_periods_yr; fall back to columnDef ari fields.
    const rpList = idfTable.data?.return_periods_yr
        || idfTable.return_periods_yr
        || idfTable.columnDefs?.filter(c => c.ari).map(c => c.ari)
        || [];

    // Derive available durations from the IDF table's durations_min or rowData.
    const durationList = idfTable.data?.durations_min
        || idfTable.durations_min
        || (idfTable.rowData || []).map(r => r.duration).filter(Boolean)
        || [];

    // Patterns: use selected (non-empty) or all from PRESET_FAMILIES.
    const patternsToUse = projection.selectedPatterns && projection.selectedPatterns.length > 0
        ? projection.selectedPatterns
        : ['alternating_block', 'SCS_TYPE_I', 'SCS_TYPE_IA', 'SCS_TYPE_II', 'SCS_TYPE_III', 'HUFF'];

    // Apply view filters — narrow without creating/deleting rows (AC2).
    const ariFilter = projection.viewFilter?.ari;
    const durationFilter = projection.viewFilter?.durationMin;
    const aris = ariFilter ? rpList.filter(r => r === ariFilter) : rpList;
    const durations = durationFilter ? durationList.filter(d => d === durationFilter) : durationList;
    const timestepMin = projection.timestepMin || 60;

    const cells = [];
    for (const pattern of patternsToUse) {
        for (const ari of aris) {
            for (const duration of durations) {
                cells.push({
                    pattern,
                    ari: Number(ari),
                    duration_min: Number(duration),
                    timestep_min: timestepMin
                });
            }
        }
    }
    return cells;
}

// TASK-1501 (W4b) — Design-storm rowless BATCH PREVIEW epic.
// Listens for PREVIEW_DESIGN_STORMS_REQUEST, POSTs to the derive-design-storm
// endpoint with mode='preview' + cells=[...], gets back rowData without
// persisting any TimeSeries row (AC1, AC2, AC9).
export const previewDesignStormsEpic = (action$, store) =>
    action$
        .ofType(PREVIEW_DESIGN_STORMS_REQUEST)
        .switchMap(action => {
            const projectId = store.getState()?.anuga?.projects?.data?.id;
            if (!projectId) {
                return Rx.Observable.of(previewDesignStormsFailure('No active project'));
            }
            if (!action.cells || action.cells.length === 0) {
                return Rx.Observable.of(previewDesignStormsSuccess([]));
            }
            const payload = {
                mode: 'preview',
                idf_table_id: action.idfTableId,
                cells: action.cells
            };
            return Rx.Observable.from(deriveDesignStorm(projectId, payload))
                .map(response => {
                    const previews = (response?.data?.previews || []);
                    return previewDesignStormsSuccess(previews);
                })
                .catch(error => {
                    const detail = error?.data?.detail
                        || error?.response?.data?.detail
                        || error?.message
                        || 'Preview failed';
                    return Rx.Observable.of(previewDesignStormsFailure(String(detail)));
                });
        });

// TASK-1501 (W4b) — Reactive reprojection on IDF/pattern save (AC5).
// On SAVE_HYDROLOGY_ITEM_SUCCESS for 'sv-idf-table' or 'temporal-pattern',
// mark the projection stale so the browser re-fetches previews.
export const reprojectOnSaveEpic = (action$, store) =>
    action$
        .ofType(SAVE_HYDROLOGY_ITEM_SUCCESS)
        .filter(action =>
            action.activeHydrologyPage === 'sv-idf-table' ||
            action.activeHydrologyPage === 'temporal-pattern'
        )
        .mergeMap(() => {
            const state = store.getState();
            const projection = state?.hydrology?.projection;
            const projectId = state?.anuga?.projects?.data?.id;
            // If there is a live projection spec, re-run the preview automatically.
            if (!projection || !projection.selectedIdfTableId || !projectId) {
                return Rx.Observable.of(markProjectionStale());
            }
            // Re-derive the filtered preview set from the updated IDF/pattern.
            const cells = _buildProjectionCells(projection, state?.hydrology?.idfTables);
            if (!cells || cells.length === 0) {
                return Rx.Observable.of(markProjectionStale());
            }
            // Dispatch PREVIEW_DESIGN_STORMS_REQUEST — the preview epic handles it.
            return Rx.Observable.of(
                previewDesignStormsRequest(cells, projection.selectedIdfTableId, projection.timestepMin)
            );
        });

// TASK-1501 (W4b) — ATTACH→materialise-one epic (AC6).
// Listens for ATTACH_DESIGN_STORM_REQUEST, POSTs to the attach-design-storm
// endpoint (201 + one real TimeSeries row), then writes the returned id into
// the feature's data_timeseries_id via the TimeDataPicker contract.
export const attachDesignStormEpic = (action$, store) =>
    action$
        .ofType(ATTACH_DESIGN_STORM_REQUEST)
        .mergeMap(action => {
            const state = store.getState();
            const projectId = state?.anuga?.projects?.data?.id;
            if (!projectId) {
                return Rx.Observable.of(attachDesignStormFailure('No active project'));
            }
            const {rainfallPk, spec, featureId} = action;
            const payload = {
                idf_table_id: spec.idfTableId,
                pattern: spec.patternKey,
                duration_min: spec.durationMin,
                timestep_min: spec.timestepMin
            };
            if (spec.aep !== undefined && spec.aep !== null && spec.aep !== '') {
                payload.aep = Number(spec.aep);
            } else if (spec.ari !== undefined && spec.ari !== null && spec.ari !== '') {
                payload.ari = Number(spec.ari);
            }
            if (spec.peakPosition !== undefined && spec.peakPosition !== null) {
                payload.peak_position = Number(spec.peakPosition);
            }
            if (spec.name) payload.name = spec.name;
            if (featureId !== undefined && featureId !== null) {
                payload.feature_id = featureId;
            }
            return Rx.Observable.from(attachDesignStorm(projectId, rainfallPk, payload))
                .mergeMap(response => {
                    const ts = response.data;
                    return Rx.Observable.from([
                        attachDesignStormSuccess(ts, rainfallPk),
                        show({
                            message: `Design storm "${ts.name}" attached to rainfall.`,
                            title: 'hydrata.hydrology.success',
                            uid: 1002,
                            position: 'tc'
                        }),
                        // Re-fetch time-series list so new row appears in the rail.
                        fetchHydrologyTimeSeriesData()
                    ]);
                })
                .catch(error => {
                    const detail = error?.data?.detail
                        || error?.response?.data?.detail
                        || error?.message
                        || 'Attach design storm failed';
                    return Rx.Observable.from([
                        attachDesignStormFailure(String(detail)),
                        show({
                            message: `Error: ${String(detail)}`,
                            title: 'hydrata.hydrology.error',
                            uid: 6002,
                            position: 'tc'
                        }, 'error')
                    ]);
                });
        });

// TASK-1451 (W4) — Design-storm derive epic.
// Listens for DERIVE_DESIGN_STORM_REQUEST, POSTs to the synchronous
// derive-design-storm endpoint (201 + persisted TimeSeries), then
// re-fetches the time-series list so the new item appears in the rail.
export const deriveDesignStormEpic = (action$, store) =>
    action$
        .ofType(DERIVE_DESIGN_STORM_REQUEST)
        .mergeMap(action => {
            const projectId = store.getState()?.anuga?.projects?.data?.id;
            if (!projectId) {
                return Rx.Observable.of(deriveDesignStormFailure('No active project'));
            }
            const {formValues} = action;
            // Map FE selectedPreset → BE field name `pattern`.
            // BE DesignStormDeriveSerializer uses field name `pattern` (not
            // `pattern_key` / `selectedPreset`). Carry-over C: always send
            // `pattern` so saved provenance restores correctly.
            const payload = {
                idf_table_id: formValues.idfTableId,
                pattern: formValues.patternKey,
                duration_min: formValues.durationMin,
                timestep_min: formValues.timestepMin
            };
            // AEP or ARI — exactly one is required by the BE serializer.
            if (formValues.aep !== undefined && formValues.aep !== null && formValues.aep !== '') {
                payload.aep = Number(formValues.aep);
            } else if (formValues.ari !== undefined && formValues.ari !== null && formValues.ari !== '') {
                payload.ari = Number(formValues.ari);
            }
            // peak_position only relevant for alternating_block (ignored for
            // SCS patterns but harmless to send — BE default=0.5).
            if (formValues.peakPosition !== undefined && formValues.peakPosition !== null) {
                payload.peak_position = Number(formValues.peakPosition);
            }
            if (formValues.name) {
                payload.name = formValues.name;
            }
            return Rx.Observable.from(deriveDesignStorm(projectId, payload))
                .mergeMap(response => {
                    const ts = response.data;
                    return Rx.Observable.from([
                        deriveDesignStormSuccess(ts),
                        fetchHydrologyTimeSeriesData(),
                        show({
                            message: `Design storm "${ts.name}" saved.`,
                            title: 'hydrata.hydrology.success',
                            uid: 1001,
                            position: 'tc'
                        })
                    ]);
                })
                .catch(error => {
                    const detail = error?.data?.detail
                        || error?.data?.non_field_errors?.[0]
                        || error?.response?.data?.detail
                        || error?.message
                        || 'Derive design storm failed';
                    return Rx.Observable.from([
                        deriveDesignStormFailure(String(detail)),
                        show({
                            message: `Error: ${String(detail)}`,
                            title: 'hydrata.hydrology.error',
                            uid: 6001,
                            position: 'tc'
                        }, 'error')
                    ]);
                });
        });

// TASK-1561 (W3b) — Design-storm BULK SAVE epic.
// Listens for SAVE_DESIGN_STORMS_REQUEST, POSTs mode='save' + cells to the
// derive-design-storm endpoint (201 + {mode:'save', created:[...], replaced:N}),
// then re-fetches the time-series list so saved rows appear in the rail.
// Same URL and axios/auth pattern as attachDesignStormEpic.
export const saveDesignStormsEpic = (action$, store) =>
    action$
        .ofType(SAVE_DESIGN_STORMS_REQUEST)
        .mergeMap(action => {
            const projectId = store.getState()?.anuga?.projects?.data?.id;
            if (!projectId) {
                return Rx.Observable.of(saveDesignStormsFailure('No active project'));
            }
            const {cells, idfTableId} = action;
            const payload = {
                mode: 'save',
                idf_table_id: idfTableId,
                cells: cells
            };
            return Rx.Observable.from(deriveDesignStorm(projectId, payload))
                .mergeMap(response => {
                    const created = response?.data?.created || [];
                    const replaced = response?.data?.replaced || 0;
                    const n = created.length;
                    return Rx.Observable.from([
                        saveDesignStormsSuccess(created, replaced),
                        // Re-fetch the time-series list so saved rows appear in the rail.
                        fetchHydrologyTimeSeriesData(),
                        show({
                            message: `Saved ${n} design storm${n !== 1 ? 's' : ''}${replaced > 0 ? ` (replaced ${replaced})` : ''}.`,
                            title: 'hydrata.hydrology.success',
                            uid: 1003,
                            position: 'tc'
                        })
                    ]);
                })
                .catch(error => {
                    const detail = error?.data?.detail
                        || error?.response?.data?.detail
                        || error?.message
                        || 'Save design storms failed';
                    return Rx.Observable.from([
                        saveDesignStormsFailure(String(detail)),
                        show({
                            message: `Error: ${String(detail)}`,
                            title: 'hydrata.hydrology.error',
                            uid: 6003,
                            position: 'tc'
                        }, 'error')
                    ]);
                });
        });

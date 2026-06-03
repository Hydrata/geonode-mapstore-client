import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";

import {
    INIT_HYDROLOGY,
    FETCH_HYDROLOGY_TIME_SERIES_DATA,
    fetchHydrologyTimeSeriesData,
    setHydrologyTimeSeriesData,
    errorHydrologyTimeSeriesData,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    fetchHydrologyTemporalPatternData,
    setHydrologyTemporalPatternData,
    errorHydrologyTemporalPatternData,
    FETCH_HYDROLOGY_IDF_TABLE_DATA,
    fetchHydrologyIdfTableData,
    setHydrologyIdfTableData,
    errorHydrologyIdfTableData,
    SAVE_HYDROLOGY_ITEM,
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
    setIdfDeriveMapPickActive,
    setCeleryAnugaEnabled,
    DERIVE_DESIGN_STORM_REQUEST,
    deriveDesignStormSuccess,
    deriveDesignStormFailure
} from "../Hydrology/actionsHydrology";
import {show} from '../../../../MapStore2/web/client/actions/notifications';
import {CLICK_ON_MAP} from '../../../../MapStore2/web/client/actions/map';
import {deriveIdf, getIdfTable, deriveDesignStorm} from './api/hydrologyApi';
import {getAnugaConfig} from '../Anuga/api/anugaApi';

// V2P-79 / V2P-77 — V1 hydrology routes were /anuga/api/{pid}/<endpoint>/
// where <endpoint> was 'time-series' / 'temporal-pattern' / 'idf-table'
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
    'idf-table': 'idf-tables'
};

const v2Hydrology = (page) => V1_TO_V2_HYDROLOGY[page] || page;

async function fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction) {
    try {
        const response = await axios.get(
            `/api/v2/anuga/projects/${projectId}/${v2Hydrology(endpoint)}/`
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
                    fetchHydrologyIdfTableData()
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
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
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
                const endpoint = "idf-table";
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
                .catch(error => Rx.Observable.from([
                    deleteHydrologyItemFailure(error.data),
                    show({
                        "message": `Error: ${error.data?.errors}`,
                        "title": "hydrata.hydrology.error",
                        "uid": 6000,
                        "position": "tc"
                    }, 'error')
                ]));
        });

// TASK-934 — Parse the comma-separated text fields into number arrays.
// Returns {durations: number[], rps: number[], error: string|null}.
// Invariants: durations ≥60 (smallest meaningful ERA5-Land hourly step),
// rps ≥2 (smallest GEV-fittable AMS). Duplicates rejected so the backend
// doesn't waste compute on redundant return periods.
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
    const d = parseList(durationsText, 60, 'Durations');
    if (d.error) return {durations: null, rps: null, error: d.error};
    const r = parseList(rpsText, 2, 'Return periods');
    if (r.error) return {durations: null, rps: null, error: r.error};
    return {durations: d.values, rps: r.values, error: null};
};

// TASK-934 — POST /api/v2/anuga/projects/{pid}/idf-tables/derive/.
// 202 → setIdfDeriveProcessId. 503 → unavailable (celery_anuga disabled).
// 400/422 → BE validation error (surface detail inline).
export const deriveIdfEpic = (action$, store) =>
    action$
        .ofType(DERIVE_IDF_REQUEST)
        .mergeMap(() => {
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
            const payload = {
                lat, lon,
                durations_min: parsed.durations,
                return_periods_yr: parsed.rps
            };
            return Rx.Observable.from(deriveIdf(projectId, payload))
                .mergeMap(response => {
                    const data = response?.data || {};
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
                        return Rx.Observable.from([
                            setIdfDeriveError('IDF derivation is unavailable on this site'),
                            setCeleryAnugaEnabled(false)
                        ]);
                    }
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
// fetch the IDFTable and stash on idfDerive.result. On 'error', surface
// the BE error message.
//
// Why poll redux instead of subscribing to a specific action: TaskMonitor
// dispatches TM_SET_PROCESSES (bulk) and updateProcess (single); rather
// than couple to those internals we sample state on a timer that lives
// only while a derive is in flight.
// 5-minute poll cap at 2s tick = 150 attempts. A 75-yr ERA5 fit
// completes in ~30-90s on the anuga worker; the worker timeout itself is
// 600s. The cap is defence-in-depth against a stuck Process row leaving
// the FE polling redux forever.
const IDF_DERIVE_POLL_MAX_ATTEMPTS = 150;

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
                            return Rx.Observable.of(setIdfDeriveError('Derive timed out waiting for result'));
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
                            .map(response => setIdfDeriveResult(response.data))
                            .catch(err => Rx.Observable.of(
                                setIdfDeriveError(err?.message || 'Failed to fetch IDF result')
                            ));
                    }
                    if (proc.status === 'error' || proc.status === 'cancelled') {
                        fetched.done = true;
                        const msg = proc?.metadata?.error_message
                            || proc?.error_message
                            || (proc.status === 'cancelled' ? 'Derive cancelled' : 'Derive failed');
                        return Rx.Observable.of(setIdfDeriveError(String(msg)));
                    }
                    if (tick === IDF_DERIVE_POLL_MAX_ATTEMPTS - 1) {
                        fetched.done = true;
                        return Rx.Observable.of(setIdfDeriveError('Derive timed out waiting for result'));
                    }
                    return Rx.Observable.empty();
                });
        });

// TASK-934 — Map-pick handler. When user clicks "Pick on map" we set
// mapPickActive=true; the next CLICK_ON_MAP captures lat/lon and clears
// the flag. Mirrors the HGeval mapClickEpic pattern.
export const idfDeriveMapPickEpic = (action$, store) =>
    action$
        .ofType(CLICK_ON_MAP)
        .filter(() => store.getState()?.hydrology?.idfDerive?.mapPickActive === true)
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        .filter(({point}) => point?.latlng?.lat != null && point?.latlng?.lng != null)
        .mergeMap(({point}) => Rx.Observable.from([
            setIdfDeriveLat(point.latlng.lat),
            setIdfDeriveLon(point.latlng.lng),
            setIdfDeriveMapPickActive(false)
        ]));

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

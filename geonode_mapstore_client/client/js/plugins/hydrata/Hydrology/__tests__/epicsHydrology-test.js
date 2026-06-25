/**
 * V2P-79 — Hydrology epics V1 → V2 cutover regression guards.
 *
 * The V1 paths /anuga/api/{pid}/{sv-idf-table|time-series|temporal-pattern}/
 * are migrated to V2 nested routes:
 *   /api/v2/anuga/projects/{pid}/idf-tables/
 *   /api/v2/anuga/projects/{pid}/time-series/         (already plural)
 *   /api/v2/anuga/projects/{pid}/temporal-patterns/
 *
 * Action `activeHydrologyPage` carries the V1 segment (matches UI tab id).
 * The plural-mapping happens at the API boundary inside epicsHydrology.js
 * (V1_TO_V2_HYDROLOGY).
 */
import expect from 'expect';
import Rx from 'rxjs';
import { mockAxios as setupMockAxios } from '../../../../__tests__/helpers';

const {
    fetchTimeSeriesEpic,
    fetchTemporalPatternEpic,
    fetchIdfTableEpic,
    saveHydrologyItemEpic,
    deleteHydrologyItemEpic,
    deriveIdfEpic,
    idfDeriveCompleteEpic,
    idfDeriveMapPickEpic,
    hydrologyIdfPickManagerEpic,
    loadAnugaConfigEpic,
    IDF_DERIVE_TIMEOUT_MESSAGE,
    // TASK-1789 — year-range constants
    ERA5_MAX_YEAR,
    IDF_YEAR_RANGE
} = require('../epicsHydrology');

const reducer = require('../reducersHydrology').default;

const {
    FETCH_HYDROLOGY_TIME_SERIES_DATA,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    FETCH_HYDROLOGY_IDF_TABLE_DATA,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SAVE_HYDROLOGY_ITEM,
    DELETE_HYDROLOGY_ITEM,
    DERIVE_IDF_REQUEST,
    SET_IDF_DERIVE_PROCESS_ID,
    SET_IDF_DERIVE_ERROR,
    SET_IDF_DERIVE_RESULT,
    SET_IDF_DERIVE_LAT,
    SET_IDF_DERIVE_LON,
    SET_IDF_DERIVE_MAP_PICK_ACTIVE,
    SET_CELERY_ANUGA_ENABLED,
    INIT_HYDROLOGY
} = require('../actionsHydrology');

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('V2P-79 Hydrology epics → V2 cutover', () => {
    let mockAxios;
    const projectId = 42;
    const store = {
        getState: () => ({
            gnresource: { id: 1 },
            anuga: { projects: { data: { id: projectId } } },
            security: { user: { pk: 1 } }
        })
    };

    beforeEach(() => {
        // TASK-740 AC3: use the shared mockAxios helper (binds to the
        // libs/ajax instance + auto-restores via its own afterEach).
        mockAxios = setupMockAxios();
        mockAxios.onAny().reply(200, []);
    });

    it('fetchIdfTableEpic GETs /api/v2/anuga/projects/{pid}/idf-tables/', (done) => {
        const action$ = mockActions([{ type: FETCH_HYDROLOGY_IDF_TABLE_DATA }]);
        const sub = fetchIdfTableEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastGet = mockAxios.history.get.slice(-1)[0];
                expect(lastGet.url).toBe(`/api/v2/anuga/projects/${projectId}/idf-tables/`);
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('fetchTimeSeriesEpic GETs /api/v2/anuga/projects/{pid}/time-series/', (done) => {
        const action$ = mockActions([{ type: FETCH_HYDROLOGY_TIME_SERIES_DATA }]);
        const sub = fetchTimeSeriesEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastGet = mockAxios.history.get.slice(-1)[0];
                expect(lastGet.url).toBe(`/api/v2/anuga/projects/${projectId}/time-series/`);
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('fetchTemporalPatternEpic GETs /api/v2/anuga/projects/{pid}/temporal-patterns/', (done) => {
        const action$ = mockActions([{ type: FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA }]);
        const sub = fetchTemporalPatternEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastGet = mockAxios.history.get.slice(-1)[0];
                expect(lastGet.url).toBe(`/api/v2/anuga/projects/${projectId}/temporal-patterns/`);
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('saveHydrologyItemEpic POSTs to V2 plural for new item (no id)', (done) => {
        const action$ = mockActions([{
            type: SAVE_HYDROLOGY_ITEM,
            activeHydrologyPage: 'temporal-pattern',
            item: { name: 'P', data: [] }
        }]);
        const sub = saveHydrologyItemEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastPost = mockAxios.history.post.slice(-1)[0];
                expect(lastPost.url).toBe(
                    `/api/v2/anuga/projects/${projectId}/temporal-patterns/`
                );
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('saveHydrologyItemEpic PATCHes V2 plural for existing item (with numeric id)', (done) => {
        const action$ = mockActions([{
            type: SAVE_HYDROLOGY_ITEM,
            activeHydrologyPage: 'sv-idf-table',
            item: { id: 99, name: 'X', data: [] }
        }]);
        const sub = saveHydrologyItemEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastPatch = mockAxios.history.patch.slice(-1)[0];
                expect(lastPatch.url).toBe(
                    `/api/v2/anuga/projects/${projectId}/idf-tables/99/`
                );
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    // TASK-1531: a saved temporal pattern must carry its chosen preset through
    // the PATCH body so the row persists pattern_key (was always NULL → picker
    // reverted to Alternating Block on reload). The reducer stamps pattern_key
    // on the item; here we assert the save epic's {...item} spread forwards it.
    it('saveHydrologyItemEpic PATCH body carries pattern_key (TASK-1531)', (done) => {
        const action$ = mockActions([{
            type: SAVE_HYDROLOGY_ITEM,
            activeHydrologyPage: 'temporal-pattern',
            item: { id: 7, name: 'SCS II', pattern_type: 'preset', pattern_key: 'SCS_TYPE_II', data: [] }
        }]);
        const sub = saveHydrologyItemEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastPatch = mockAxios.history.patch.slice(-1)[0];
                expect(lastPatch.url).toBe(
                    `/api/v2/anuga/projects/${projectId}/temporal-patterns/7/`
                );
                const body = JSON.parse(lastPatch.data);
                expect(body.pattern_key).toBe('SCS_TYPE_II');
                expect(body.pattern_type).toBe('preset');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('deleteHydrologyItemEpic DELETEs V2 plural', (done) => {
        const action$ = mockActions([{
            type: DELETE_HYDROLOGY_ITEM,
            activeHydrologyPage: 'time-series',
            item: { id: 7, name: 'TS' }
        }]);
        const sub = deleteHydrologyItemEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                const lastDelete = mockAxios.history.delete.slice(-1)[0];
                expect(lastDelete.url).toBe(
                    `/api/v2/anuga/projects/${projectId}/time-series/7/`
                );
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    // Regression for the "TaskMonitor poller dies after one tick" bug.
    // The V2 hydrology endpoints set pagination_class = HydrologyPagination,
    // so the response body is {count, next, previous, results: [...]}.
    // Before the fix, fetchAndDispatch handed the whole body to the reducer,
    // which calls .map() on action.payload — a TypeError that propagates back
    // through redux-observable and tears down every merged epic timer.
    describe('paginated DRF body is unwrapped into action.payload (array)', () => {
        const paginatedReply = (results) => ({
            count: results.length,
            next: null,
            previous: null,
            results
        });

        [
            ['fetchIdfTableEpic', fetchIdfTableEpic,
                FETCH_HYDROLOGY_IDF_TABLE_DATA, SET_HYDROLOGY_IDF_TABLE_DATA],
            ['fetchTimeSeriesEpic', fetchTimeSeriesEpic,
                FETCH_HYDROLOGY_TIME_SERIES_DATA, SET_HYDROLOGY_TIME_SERIES_DATA],
            ['fetchTemporalPatternEpic', fetchTemporalPatternEpic,
                FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA, SET_HYDROLOGY_TEMPORAL_PATTERN_DATA]
        ].forEach(([name, epic, fetchType, setType]) => {
            it(`${name}: action.payload is the results array, not the body`, (done) => {
                const rows = [{ id: 1, name: 'A', data: [] }, { id: 2, name: 'B', data: [] }];
                mockAxios.reset();
                mockAxios.onGet().reply(200, paginatedReply(rows));
                const collected = [];
                const action$ = mockActions([{ type: fetchType }]);
                const sub = epic(action$, store).subscribe(
                    action => collected.push(action),
                    err => done(err),
                    () => {
                        expect(collected.length).toBe(1);
                        expect(collected[0].type).toBe(setType);
                        expect(Array.isArray(collected[0].payload)).toBe(true);
                        expect(collected[0].payload).toEqual(rows);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
            });
        });

        it('end-to-end: dispatched action flows through reducer without crashing .map()', (done) => {
            const rows = [
                { id: 1, name: 'IDF-A', data: [] },
                { id: 2, name: 'IDF-B', data: [] }
            ];
            mockAxios.reset();
            mockAxios.onGet().reply(200, paginatedReply(rows));
            const action$ = mockActions([{ type: FETCH_HYDROLOGY_IDF_TABLE_DATA }]);
            const sub = fetchIdfTableEpic(action$, store).subscribe(
                action => {
                    // This is the path that killed the TaskMonitor poller —
                    // run the reducer to prove it survives the new payload.
                    const state = reducer(undefined, action);
                    expect(state.idfTables.length).toBe(2);
                    expect(state.idfTables[0].name).toBe('IDF-A');
                    expect(state.idfTables[1].name).toBe('IDF-B');
                },
                err => done(err),
                () => {
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('empty paginated body (results: []) dispatches [], does not crash reducer', (done) => {
            mockAxios.reset();
            mockAxios.onGet().reply(200, paginatedReply([]));
            const action$ = mockActions([{ type: FETCH_HYDROLOGY_IDF_TABLE_DATA }]);
            const sub = fetchIdfTableEpic(action$, store).subscribe(
                action => {
                    expect(Array.isArray(action.payload)).toBe(true);
                    expect(action.payload.length).toBe(0);
                    const state = reducer(undefined, action);
                    expect(state.idfTables).toEqual([]);
                },
                err => done(err),
                () => {
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('malformed body (missing results) falls back to [] — reducer survives', (done) => {
            mockAxios.reset();
            mockAxios.onGet().reply(200, { count: 0, next: null, previous: null });
            const action$ = mockActions([{ type: FETCH_HYDROLOGY_IDF_TABLE_DATA }]);
            const sub = fetchIdfTableEpic(action$, store).subscribe(
                action => {
                    expect(Array.isArray(action.payload)).toBe(true);
                    expect(action.payload.length).toBe(0);
                    expect(() => reducer(undefined, action)).toNotThrow();
                },
                err => done(err),
                () => {
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('legacy non-paginated array body still works (back-compat)', (done) => {
            const rows = [{ id: 3, name: 'legacy', data: [] }];
            mockAxios.reset();
            mockAxios.onGet().reply(200, rows);
            const action$ = mockActions([{ type: FETCH_HYDROLOGY_IDF_TABLE_DATA }]);
            const sub = fetchIdfTableEpic(action$, store).subscribe(
                action => {
                    expect(action.payload).toEqual(rows);
                    const state = reducer(undefined, action);
                    expect(state.idfTables.length).toBe(1);
                    expect(state.idfTables[0].name).toBe('legacy');
                },
                err => done(err),
                () => {
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });
    });

    // TASK-934 — IDF Derive epics: deriveIdf POST, 503/error handling,
    // TaskMonitor → IDFTable fetch on complete, map-click capture,
    // /config/ celery_anuga_enabled hydration on INIT_HYDROLOGY.
    describe('TASK-934 IDF Derive epics', () => {
        const idfDeriveState = (slice) => ({
            gnresource: { id: 1 },
            anuga: { projects: { data: { id: projectId } } },
            security: { user: { pk: 1 } },
            hydrology: { idfDerive: slice || {} }
        });
        const idfDeriveStore = (slice, tmByid) => ({
            getState: () => ({
                ...idfDeriveState(slice),
                taskMonitor: { processes: { byId: tmByid || {} } }
            })
        });

        // TASK-1789 — sanity checks for exported constants
        it('TASK-1789 ERA5_MAX_YEAR is 2026', () => {
            expect(ERA5_MAX_YEAR).toBe(2026);
        });

        it('TASK-1789 IDF_YEAR_RANGE has 10yr and 75yr entries', () => {
            expect(IDF_YEAR_RANGE['10yr']).toExist();
            expect(IDF_YEAR_RANGE['75yr']).toExist();
            expect(IDF_YEAR_RANGE['10yr'].start_year).toBe(ERA5_MAX_YEAR - 9);
            expect(IDF_YEAR_RANGE['75yr'].start_year).toBe(1950);
        });

        it('deriveIdfEpic POSTs to /idf-tables/derive/ and dispatches SET_IDF_DERIVE_PROCESS_ID', (done) => {
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(202, {task_id: 'celery-uuid', process_id: 77});
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(1);
                    expect(collected[0].type).toBe(SET_IDF_DERIVE_PROCESS_ID);
                    expect(collected[0].processId).toBe(77);
                    expect(collected[0].taskId).toBe('celery-uuid');
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('deriveIdfEpic ignores a double DERIVE_IDF_REQUEST while the POST is in flight (TASK-1539 debounce)', (done) => {
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(202, {task_id: 'celery-uuid', process_id: 77});
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100'
            };
            // Two rapid requests (the double-click). exhaustMap must drop the
            // second while the first POST is still in flight -> exactly ONE POST
            // and ONE SET_IDF_DERIVE_PROCESS_ID (mergeMap would fire two).
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}, {type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    try {
                        const pids = collected.filter(c => c.type === SET_IDF_DERIVE_PROCESS_ID);
                        expect(pids.length).toBe(1);
                        expect(mockAxios.history.post.length).toBe(1);
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('deriveIdfEpic 503 → SET_IDF_DERIVE_ERROR + SET_CELERY_ANUGA_ENABLED(false)', function _t(done) {
            this.timeout(6000);
            mockAxios.reset();
            // 503 is the site-disabled-by-CELERY_ANUGA_ENABLED=false signal.
            // axios-mock-adapter requires a body for some rejection codes;
            // pass an explicit object so the rejection surfaces with
            // error.response.status === 503.
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(503, { detail: 'unavailable' });
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            deriveIdfEpic(action$, idfDeriveStore(slice))
                .take(2)
                .subscribe(
                    a => collected.push(a),
                    err => done(err),
                    () => {
                        try {
                            const types = collected.map(c => c.type);
                            expect(types.indexOf(SET_IDF_DERIVE_ERROR)).toBeGreaterThan(-1);
                            expect(types.indexOf(SET_CELERY_ANUGA_ENABLED)).toBeGreaterThan(-1);
                            const setEnabled = collected.find(c => c.type === SET_CELERY_ANUGA_ENABLED);
                            expect(setEnabled.enabled).toBe(false);
                            done();
                        } catch (e) { done(e); }
                    }
                );
        });

        it('deriveIdfEpic 400 → SET_IDF_DERIVE_ERROR (non-503 path)', (done) => {
            // axios-mock-adapter's exact rejection shape for non-2xx isn't
            // guaranteed across versions (error.response.data may or may
            // not survive); assert only that the epic dispatches a single
            // SET_IDF_DERIVE_ERROR (string message) and does NOT dispatch
            // SET_CELERY_ANUGA_ENABLED (that path is 503-only).
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(400, {detail: 'lat out of range'});
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60', rpsText: '2'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            let finished = false;
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => {
                    if (!finished && a.type === SET_IDF_DERIVE_ERROR) {
                        finished = true;
                        try {
                            expect(typeof a.message).toBe('string');
                            expect(a.message.length).toBeGreaterThan(0);
                            if (sub) sub.unsubscribe();
                            done();
                        } catch (e) { done(e); }
                    } else if (!finished && a.type === SET_CELERY_ANUGA_ENABLED) {
                        finished = true;
                        done(new Error('400 must NOT flip celeryAnugaEnabled (503-only)'));
                    }
                },
                err => { if (!finished) { finished = true; done(err); } }
            );
        });

        it('deriveIdfEpic missing lat/lon → SET_IDF_DERIVE_ERROR without HTTP call', (done) => {
            mockAxios.reset();
            const slice = {
                lat: null, lon: null,
                durationsText: '60', rpsText: '2'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(1);
                    expect(collected[0].type).toBe(SET_IDF_DERIVE_ERROR);
                    expect(mockAxios.history.post.length).toBe(0);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('deriveIdfEpic drops sub-hourly durations and sub-annual RPs from the POST payload', (done) => {
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(202, {task_id: 'celery-uuid', process_id: 88});
            // Matrix selection includes manual-only cells (5/10/30 min, 0.5 yr)
            // that ERA5 annual-maxima GEV can't derive — they must be filtered out.
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '5, 10, 30, 60, 1440', rpsText: '0.5, 2, 100'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                () => {},
                err => done(err),
                () => {
                    try {
                        expect(mockAxios.history.post.length).toBe(1);
                        const body = JSON.parse(mockAxios.history.post[0].data);
                        expect(body.durations_min).toEqual([60, 1440]);
                        expect(body.return_periods_yr).toEqual([2, 100]);
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('deriveIdfEpic errors without HTTP when all durations are sub-hourly', (done) => {
            mockAxios.reset();
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '5, 10, 30', rpsText: '2, 100'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    try {
                        expect(collected.length).toBe(1);
                        expect(collected[0].type).toBe(SET_IDF_DERIVE_ERROR);
                        expect(mockAxios.history.post.length).toBe(0);
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('deriveIdfEpic errors without HTTP when all return periods are sub-annual', (done) => {
            mockAxios.reset();
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '0.5'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    try {
                        expect(collected.length).toBe(1);
                        expect(collected[0].type).toBe(SET_IDF_DERIVE_ERROR);
                        expect(mockAxios.history.post.length).toBe(0);
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('idfDeriveCompleteEpic GETs IDFTable AND refreshes the Items list on complete', (done) => {
            mockAxios.reset();
            const idftableId = 999;
            mockAxios.onGet(`/api/v2/anuga/projects/${projectId}/idf-tables/${idftableId}/`)
                .reply(200, {id: idftableId, provenance: {source: 'ERA5-Land'}});
            const tmByid = {
                88: {id: 88, status: 'complete', metadata: {idftable_id: idftableId}}
            };
            const action$ = mockActions([{
                type: SET_IDF_DERIVE_PROCESS_ID, processId: 88, taskId: 'x'
            }]);
            const collected = [];
            const sub = idfDeriveCompleteEpic(action$, idfDeriveStore({}, tmByid)).subscribe(
                a => {
                    collected.push(a);
                    // Both the result stash and the list refresh must fire so the
                    // derived table appears under IDF Tables → Input without a reload.
                    if (collected.some(c => c.type === SET_IDF_DERIVE_RESULT)
                        && collected.some(c => c.type === FETCH_HYDROLOGY_IDF_TABLE_DATA)) {
                        if (sub) sub.unsubscribe();
                        expect(collected.find(c => c.type === SET_IDF_DERIVE_RESULT).idfTable.id).toBe(idftableId);
                        done();
                    }
                },
                err => done(err)
            );
        });

        it('idfDeriveCompleteEpic SET_IDF_DERIVE_ERROR when process status=error', (done) => {
            mockAxios.reset();
            const tmByid = {
                88: {id: 88, status: 'error', metadata: {error_message: 'GEV fit failed'}}
            };
            const action$ = mockActions([{
                type: SET_IDF_DERIVE_PROCESS_ID, processId: 88, taskId: 'x'
            }]);
            const sub = idfDeriveCompleteEpic(action$, idfDeriveStore({}, tmByid)).subscribe(
                a => {
                    if (a.type === SET_IDF_DERIVE_ERROR) {
                        expect(a.message.indexOf('GEV fit failed')).toBeGreaterThan(-1);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                },
                err => done(err)
            );
        });

        // TASK-1535 — the BE's clear ERA5-unavailable message (set by the
        // soft-time-limit / S3-timeout path) reaches the FE verbatim, so the
        // user sees "ERA5 archive may be unavailable" not a generic "failed".
        it('idfDeriveCompleteEpic surfaces the BE ERA5-unavailable message verbatim', (done) => {
            mockAxios.reset();
            const beMsg = 'IDF derive timed out after 300s — the ERA5 archive may be unavailable or unreachable. Please try again later.';
            const tmByid = {
                88: {id: 88, status: 'error', metadata: {error_message: beMsg}}
            };
            const action$ = mockActions([{
                type: SET_IDF_DERIVE_PROCESS_ID, processId: 88, taskId: 'x'
            }]);
            const sub = idfDeriveCompleteEpic(action$, idfDeriveStore({}, tmByid)).subscribe(
                a => {
                    if (a.type === SET_IDF_DERIVE_ERROR) {
                        expect(a.message).toBe(beMsg);
                        expect(a.message.indexOf('ERA5')).toBeGreaterThan(-1);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                },
                err => done(err)
            );
        });

        // The FE poll-cap fallback DEFERS to the task monitor instead of
        // guessing a cause. The old message blamed the ERA5 archive even on a
        // healthy long Batch run (map 5600: a 3770s fit completed fine while
        // the FE showed "ERA5 unavailable"). It must NOT assert an ERA5 cause.
        it('IDF_DERIVE_TIMEOUT_MESSAGE defers to the task monitor', () => {
            expect(typeof IDF_DERIVE_TIMEOUT_MESSAGE).toBe('string');
            expect(IDF_DERIVE_TIMEOUT_MESSAGE.toLowerCase().indexOf('task monitor')).toBeGreaterThan(-1);
            // No invented cause — the panel can't know the archive is down.
            expect(IDF_DERIVE_TIMEOUT_MESSAGE.indexOf('ERA5')).toBe(-1);
            expect(IDF_DERIVE_TIMEOUT_MESSAGE.toLowerCase().indexOf('unavailable')).toBe(-1);
        });

        it('idfDeriveMapPickEpic captures lat/lon from CLICK_ON_MAP when mapPickActive=true', (done) => {
            const slice = {mapPickActive: true};
            const action$ = mockActions([{
                type: 'CLICK_ON_MAP',
                point: {latlng: {lat: -37.8, lng: 144.9}}
            }]);
            const collected = [];
            const sub = idfDeriveMapPickEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    const types = collected.map(a => a.type);
                    expect(types.indexOf(SET_IDF_DERIVE_LAT)).toBeGreaterThan(-1);
                    expect(types.indexOf(SET_IDF_DERIVE_LON)).toBeGreaterThan(-1);
                    expect(types.indexOf(SET_IDF_DERIVE_MAP_PICK_ACTIVE)).toBeGreaterThan(-1);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        // TASK-1499 (W2) AC3 — round-on-write
        it('idfDeriveMapPickEpic rounds lat/lon to 2 dp on write', (done) => {
            const slice = {mapPickActive: true};
            const action$ = mockActions([{
                type: 'CLICK_ON_MAP',
                point: {latlng: {lat: -33.674412, lng: 150.318107}}
            }]);
            const collected = [];
            const sub = idfDeriveMapPickEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    const latAction = collected.find(a => a.type === SET_IDF_DERIVE_LAT);
                    const lonAction = collected.find(a => a.type === SET_IDF_DERIVE_LON);
                    expect(latAction).toExist();
                    expect(lonAction).toExist();
                    // Stored value must equal 2-dp rounded float
                    expect(latAction.lat).toBe(-33.67);
                    expect(lonAction.lon).toBe(150.32);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('idfDeriveMapPickEpic IGNORES CLICK_ON_MAP when mapPickActive=false', (done) => {
            const slice = {mapPickActive: false};
            const action$ = mockActions([{
                type: 'CLICK_ON_MAP',
                point: {latlng: {lat: -37.8, lng: 144.9}}
            }]);
            const collected = [];
            const sub = idfDeriveMapPickEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(0);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        // ── TASK-1789 — GPEX fast-path (200) + year-range payload ──────────

        it('TASK-1789 deriveIdfEpic sends start_year/end_year in the POST payload (10yr mode)', (done) => {
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(202, {task_id: 'celery-uuid', process_id: 77});
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100',
                yearRangeMode: '10yr'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                () => {},
                err => done(err),
                () => {
                    try {
                        expect(mockAxios.history.post.length).toBe(1);
                        const body = JSON.parse(mockAxios.history.post[0].data);
                        expect(body.start_year).toBe(2017); // ERA5_MAX_YEAR - 9 = 2026 - 9
                        expect(body.end_year).toBe(2026);
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('TASK-1789 deriveIdfEpic sends start_year=1950/end_year=2026 in 75yr mode', (done) => {
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(202, {task_id: 'celery-uuid', process_id: 77});
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100',
                yearRangeMode: '75yr'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                () => {},
                err => done(err),
                () => {
                    try {
                        const body = JSON.parse(mockAxios.history.post[0].data);
                        expect(body.start_year).toBe(1950);
                        expect(body.end_year).toBe(2026);
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('TASK-1789 deriveIdfEpic HTTP 200 + tier:gpex → fetches table and dispatches SET_IDF_DERIVE_RESULT', (done) => {
            mockAxios.reset();
            const idftableId = 42;
            // GPEX fast-path: 200 + tier:gpex
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(200, {tier: 'gpex', idftable_id: idftableId, process_id: 55});
            // The GET for the IDF table
            mockAxios.onGet(`/api/v2/anuga/projects/${projectId}/idf-tables/${idftableId}/`)
                .reply(200, {id: idftableId, provenance: {grade: 'screening', source_key: 'gpex_mev_v4'}});
            const slice = {
                lat: 24.33, lon: 56.39,
                durationsText: '60, 1440', rpsText: '2, 100',
                yearRangeMode: '10yr'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => {
                    collected.push(a);
                    if (collected.some(c => c.type === SET_IDF_DERIVE_RESULT)) {
                        try {
                            const result = collected.find(c => c.type === SET_IDF_DERIVE_RESULT);
                            expect(result.idfTable.id).toBe(idftableId);
                            expect(result.idfTable.provenance.grade).toBe('screening');
                            // Must NOT dispatch SET_IDF_DERIVE_PROCESS_ID for GPEX fast-path
                            const pidAction = collected.find(c => c.type === SET_IDF_DERIVE_PROCESS_ID);
                            expect(pidAction).toNotExist();
                            if (sub) sub.unsubscribe();
                            done();
                        } catch (e) { done(e); }
                    }
                },
                err => done(err)
            );
        });

        it('TASK-1789 deriveIdfEpic HTTP 200 without tier:gpex falls through to 202 path', (done) => {
            // A plain 200 without tier:gpex (e.g. sync compute) should go through
            // the normal setIdfDeriveProcessId path with null ids.
            mockAxios.reset();
            mockAxios.onPost(`/api/v2/anuga/projects/${projectId}/idf-tables/derive/`)
                .reply(200, {task_id: null, process_id: null}); // no tier:gpex
            const slice = {
                lat: -37.8, lon: 144.9,
                durationsText: '60, 1440', rpsText: '2, 100',
                yearRangeMode: '10yr'
            };
            const action$ = mockActions([{type: DERIVE_IDF_REQUEST}]);
            const collected = [];
            const sub = deriveIdfEpic(action$, idfDeriveStore(slice)).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    try {
                        // No SET_IDF_DERIVE_RESULT (no table fetched)
                        const resultAction = collected.find(c => c.type === SET_IDF_DERIVE_RESULT);
                        expect(resultAction).toNotExist();
                        // Falls through to process-id path
                        const pidAction = collected.find(c => c.type === SET_IDF_DERIVE_PROCESS_ID);
                        expect(pidAction).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    } catch (e) { done(e); }
                }
            );
        });

        it('loadAnugaConfigEpic hydrates celery_anuga_enabled from /config/', (done) => {
            mockAxios.reset();
            mockAxios.onGet('/api/v2/anuga/config/').reply(200, {
                default_compute_backend: 'local',
                celery_anuga_enabled: false
            });
            const action$ = mockActions([{type: INIT_HYDROLOGY}]);
            const collected = [];
            const sub = loadAnugaConfigEpic(action$, idfDeriveStore({})).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(1);
                    expect(collected[0].type).toBe(SET_CELERY_ANUGA_ENABLED);
                    expect(collected[0].enabled).toBe(false);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        // TASK-1499 (W2) AC2 — Identify-suppression manager epic
        describe('hydrologyIdfPickManagerEpic (W2 AC2)', () => {
            const PURGE_MAP_INFO_RESULTS = 'PURGE_MAPINFO_RESULTS';
            const HIDE_MAPINFO_MARKER = 'HIDE_MAPINFO_MARKER';
            const TOGGLE_MAPINFO_STATE = 'TOGGLE_MAPINFO_STATE';
            const REGISTER_EVENT_LISTENER = 'REGISTER_EVENT_LISTENER';
            const UNREGISTER_EVENT_LISTENER = 'UNREGISTER_EVENT_LISTENER';

            it('on mapPickActive=true dispatches purge + hide + register + toggleMapInfo when enabled', (done) => {
                // Store: mapInfo.enabled = true (default)
                const pickStore = {
                    getState: () => ({
                        hydrology: { idfDerive: { mapPickActive: true } },
                        mapInfo: { enabled: true }
                    })
                };
                const action$ = mockActions([{
                    type: SET_IDF_DERIVE_MAP_PICK_ACTIVE,
                    active: true
                }]);
                const collected = [];
                const sub = hydrologyIdfPickManagerEpic(action$, pickStore).subscribe(
                    a => collected.push(a),
                    err => done(err),
                    () => {
                        const types = collected.map(a => a.type);
                        expect(types.indexOf(PURGE_MAP_INFO_RESULTS)).toBeGreaterThan(-1);
                        expect(types.indexOf(HIDE_MAPINFO_MARKER)).toBeGreaterThan(-1);
                        expect(types.indexOf(REGISTER_EVENT_LISTENER)).toBeGreaterThan(-1);
                        expect(types.indexOf(TOGGLE_MAPINFO_STATE)).toBeGreaterThan(-1);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
            });

            it('on mapPickActive=false dispatches unregister + restores toggleMapInfo if we disabled it', (done) => {
                // Simulate: manager sees true first (sets weDisabledMapInfo=true), then false
                // We test the false branch in isolation by creating a fresh epic instance
                // that has already set weDisabledMapInfo. We do this by sending two actions.
                const calls = [];
                const makeStore = (active) => ({
                    getState: () => ({
                        hydrology: { idfDerive: { mapPickActive: active } },
                        mapInfo: { enabled: true }
                    })
                });
                // Use a Subject so we can push two values
                const subject = new Rx.Subject();
                const action$ = subject.asObservable();
                action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

                const sub = hydrologyIdfPickManagerEpic(action$, makeStore(true)).subscribe(
                    a => calls.push(a),
                    err => done(err)
                );

                // First push: arm (true)
                subject.next({ type: SET_IDF_DERIVE_MAP_PICK_ACTIVE, active: true });

                setTimeout(() => {
                    // Switch store to false, then push disarm
                    const sub2 = hydrologyIdfPickManagerEpic(
                        (() => {
                            const s2 = new Rx.Subject();
                            const a2 = s2.asObservable();
                            a2.ofType = (...types) => a2.filter(a => types.includes(a.type));
                            // Send true first so weDisabledMapInfo is set, then false
                            setTimeout(() => {
                                s2.next({ type: SET_IDF_DERIVE_MAP_PICK_ACTIVE, active: true });
                                setTimeout(() => {
                                    s2.next({ type: SET_IDF_DERIVE_MAP_PICK_ACTIVE, active: false });
                                    setTimeout(() => { s2.complete(); }, 0);
                                }, 0);
                            }, 0);
                            return a2;
                        })(),
                        (() => {
                            let callCount = 0;
                            return {
                                getState: () => {
                                    callCount++;
                                    // First call (arm): enabled=true; second call (disarm): enabled=false
                                    return {
                                        hydrology: { idfDerive: { mapPickActive: callCount <= 1 } },
                                        mapInfo: { enabled: callCount <= 1 }
                                    };
                                }
                            };
                        })()
                    ).toArray().subscribe(
                        allActions => {
                            const types = allActions.map(a => a.type);
                            // Should include unregister on the false branch
                            expect(types.indexOf(UNREGISTER_EVENT_LISTENER)).toBeGreaterThan(-1);
                            // Should include toggle restore (weDisabledMapInfo was true)
                            expect(types.indexOf(TOGGLE_MAPINFO_STATE)).toBeGreaterThan(-1);
                            if (sub) sub.unsubscribe();
                            if (sub2) sub2.unsubscribe();
                            done();
                        },
                        err => done(err)
                    );
                }, 50);
            });

            it('does NOT re-enable mapInfo if it was already disabled before pick', (done) => {
                // mapInfo.enabled = false: weDisabledMapInfo stays false, no toggle on arm
                const pickStoreDisabled = {
                    getState: () => ({
                        hydrology: { idfDerive: { mapPickActive: true } },
                        mapInfo: { enabled: false }
                    })
                };
                const action$ = mockActions([{
                    type: SET_IDF_DERIVE_MAP_PICK_ACTIVE,
                    active: true
                }]);
                const collected = [];
                const sub = hydrologyIdfPickManagerEpic(action$, pickStoreDisabled).subscribe(
                    a => collected.push(a),
                    err => done(err),
                    () => {
                        const types = collected.map(a => a.type);
                        // Must NOT toggle (user already had it off)
                        expect(types.indexOf(TOGGLE_MAPINFO_STATE)).toBe(-1);
                        // Must still register listener and purge
                        expect(types.indexOf(REGISTER_EVENT_LISTENER)).toBeGreaterThan(-1);
                        expect(types.indexOf(PURGE_MAP_INFO_RESULTS)).toBeGreaterThan(-1);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
            });
        });
    });

    it('regression guard: no V1 /anuga/api/ URLs are sent during the full lifecycle', (done) => {
        const action$ = mockActions([
            { type: FETCH_HYDROLOGY_IDF_TABLE_DATA },
            { type: FETCH_HYDROLOGY_TIME_SERIES_DATA },
            { type: FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA },
            { type: SAVE_HYDROLOGY_ITEM, activeHydrologyPage: 'sv-idf-table', item: { name: 'A' } },
            { type: SAVE_HYDROLOGY_ITEM, activeHydrologyPage: 'sv-idf-table', item: { id: 1, name: 'A' } },
            { type: DELETE_HYDROLOGY_ITEM, activeHydrologyPage: 'sv-idf-table', item: { id: 1 } }
        ]);
        const subs = [
            fetchIdfTableEpic(action$, store).subscribe(),
            fetchTimeSeriesEpic(action$, store).subscribe(),
            fetchTemporalPatternEpic(action$, store).subscribe(),
            saveHydrologyItemEpic(action$, store).subscribe(),
            deleteHydrologyItemEpic(action$, store).subscribe()
        ];

        setTimeout(() => {
            const allUrls = []
                .concat(mockAxios.history.get.map(r => r.url))
                .concat(mockAxios.history.post.map(r => r.url))
                .concat(mockAxios.history.patch.map(r => r.url))
                .concat(mockAxios.history.delete.map(r => r.url));
            const v1Hits = allUrls.filter(u => u.indexOf('/anuga/api/') !== -1);
            expect(v1Hits.length).toBe(0);
            // Sanity: at least one V2 call was made.
            const v2Hits = allUrls.filter(u => u.indexOf('/api/v2/anuga/') !== -1);
            expect(v2Hits.length).toBeGreaterThan(0);
            subs.forEach(s => s && s.unsubscribe && s.unsubscribe());
            done();
        }, 200);
    });
});

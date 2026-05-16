/**
 * V2P-79 — Hydrology epics V1 → V2 cutover regression guards.
 *
 * The V1 paths /anuga/api/{pid}/{idf-table|time-series|temporal-pattern}/
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
import MockAdapter from 'axios-mock-adapter';

const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

const {
    fetchTimeSeriesEpic,
    fetchTemporalPatternEpic,
    fetchIdfTableEpic,
    saveHydrologyItemEpic,
    deleteHydrologyItemEpic
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
    DELETE_HYDROLOGY_ITEM
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
        mockAxios = new MockAdapter(axios);
        mockAxios.onAny().reply(200, []);
    });

    afterEach(() => {
        mockAxios.restore();
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
            activeHydrologyPage: 'idf-table',
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

    it('regression guard: no V1 /anuga/api/ URLs are sent during the full lifecycle', (done) => {
        const action$ = mockActions([
            { type: FETCH_HYDROLOGY_IDF_TABLE_DATA },
            { type: FETCH_HYDROLOGY_TIME_SERIES_DATA },
            { type: FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA },
            { type: SAVE_HYDROLOGY_ITEM, activeHydrologyPage: 'idf-table', item: { name: 'A' } },
            { type: SAVE_HYDROLOGY_ITEM, activeHydrologyPage: 'idf-table', item: { id: 1, name: 'A' } },
            { type: DELETE_HYDROLOGY_ITEM, activeHydrologyPage: 'idf-table', item: { id: 1 } }
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

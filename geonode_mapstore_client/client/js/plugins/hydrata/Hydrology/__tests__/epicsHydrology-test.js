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

const {
    FETCH_HYDROLOGY_TIME_SERIES_DATA,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    FETCH_HYDROLOGY_IDF_TABLE_DATA,
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
            anuga: { projectData: { id: projectId } },
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

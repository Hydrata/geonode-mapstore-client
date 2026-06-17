/**
 * TASK-1501 (W4b) — Design-storm projection browser tests.
 *
 * Covers:
 * 1. New projection slice actions (constants + creators)
 * 2. Reducer: SET_PROJECTION_SPEC, PREVIEW_*, SET_PROJECTION_VIEW_FILTER,
 *    SET_FOCUSED_PREVIEW, ATTACH_*, MARK_PROJECTION_STALE
 * 3. previewDesignStormsEpic: batch preview request (mode='preview'), empty
 *    cells short-circuit, missing projectId guard
 * 4. reprojectOnSaveEpic: marks stale/re-runs on sv-idf-table and temporal-pattern
 *    saves; ignores time-series saves
 * 5. attachDesignStormEpic: POSTs to attach-design-storm, dispatches SUCCESS +
 *    fetchHydrologyTimeSeriesData; missing projectId guard
 * 6. _buildProjectionCells: correct cell cross-product + view-filter narrowing
 * 7. previewKey helper: stable composite key
 * 8. rowDataToHyetograph: unchanged from W4 (AC3 reuse guard)
 */
import expect from 'expect';
import Rx from 'rxjs';
import { mockAxios as setupMockAxios } from '../../../../__tests__/helpers';

// ---------------------------------------------------------------------------
// 1. Action constants + creators
// ---------------------------------------------------------------------------
import {
    SET_PROJECTION_SPEC, setProjectionSpec,
    PREVIEW_DESIGN_STORMS_REQUEST, previewDesignStormsRequest,
    PREVIEW_DESIGN_STORMS_SUCCESS, previewDesignStormsSuccess,
    PREVIEW_DESIGN_STORMS_FAILURE, previewDesignStormsFailure,
    SET_PROJECTION_VIEW_FILTER, setProjectionViewFilter,
    SET_FOCUSED_PREVIEW, setFocusedPreview,
    ATTACH_DESIGN_STORM_REQUEST, attachDesignStormRequest,
    ATTACH_DESIGN_STORM_SUCCESS, attachDesignStormSuccess,
    ATTACH_DESIGN_STORM_FAILURE, attachDesignStormFailure as _attachDesignStormFailure,
    MARK_PROJECTION_STALE, markProjectionStale,
    SAVE_HYDROLOGY_ITEM_SUCCESS,
    FETCH_HYDROLOGY_TIME_SERIES_DATA
} from '../actionsHydrology';

import {
    previewDesignStormsEpic,
    reprojectOnSaveEpic,
    attachDesignStormEpic,
    _buildProjectionCells
} from '../epicsHydrology';

import { previewKey, rowDataToHyetograph } from '../components/hydrologyDetailTimeSeries';

const reducer = require('../reducersHydrology').default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const makeStore = (projection, idfTables, projectId) => ({
    getState: () => ({
        anuga: {projects: {data: {id: projectId || 64}}},
        hydrology: {
            projection: projection || null,
            idfTables: idfTables || []
        }
    })
});

// ---------------------------------------------------------------------------
// 1. Action creators
// ---------------------------------------------------------------------------
describe('TASK-1501 W4b — projection browser', () => {

    describe('action creators', () => {
        it('setProjectionSpec creates correct action', () => {
            const action = setProjectionSpec({selectedIdfTableId: 42});
            expect(action.type).toBe(SET_PROJECTION_SPEC);
            expect(action.spec.selectedIdfTableId).toBe(42);
        });

        it('previewDesignStormsRequest carries cells + idfTableId + timestepMin', () => {
            const cells = [{pattern: 'HUFF', ari: 100, duration_min: 1440, timestep_min: 60}];
            const action = previewDesignStormsRequest(cells, 7, 60);
            expect(action.type).toBe(PREVIEW_DESIGN_STORMS_REQUEST);
            expect(action.cells).toEqual(cells);
            expect(action.idfTableId).toBe(7);
            expect(action.timestepMin).toBe(60);
        });

        it('previewDesignStormsSuccess carries previews array', () => {
            const previews = [{pattern: 'SCS_TYPE_II', ari: 100, persisted: false}];
            const action = previewDesignStormsSuccess(previews);
            expect(action.type).toBe(PREVIEW_DESIGN_STORMS_SUCCESS);
            expect(action.previews).toEqual(previews);
        });

        it('previewDesignStormsFailure carries error string', () => {
            const action = previewDesignStormsFailure('compute error');
            expect(action.type).toBe(PREVIEW_DESIGN_STORMS_FAILURE);
            expect(action.error).toBe('compute error');
        });

        it('setProjectionViewFilter carries filter', () => {
            const action = setProjectionViewFilter({ari: 100});
            expect(action.type).toBe(SET_PROJECTION_VIEW_FILTER);
            expect(action.filter.ari).toBe(100);
        });

        it('setFocusedPreview carries key', () => {
            const action = setFocusedPreview('SCS_TYPE_II|100|1440');
            expect(action.type).toBe(SET_FOCUSED_PREVIEW);
            expect(action.key).toBe('SCS_TYPE_II|100|1440');
        });

        it('attachDesignStormRequest carries rainfallPk + spec + featureId', () => {
            const spec = {idfTableId: 5, patternKey: 'HUFF', ari: 50, durationMin: 720, timestepMin: 60};
            const action = attachDesignStormRequest(12, spec, 3);
            expect(action.type).toBe(ATTACH_DESIGN_STORM_REQUEST);
            expect(action.rainfallPk).toBe(12);
            expect(action.spec).toEqual(spec);
            expect(action.featureId).toBe(3);
        });

        it('attachDesignStormSuccess carries timeSeries + rainfallPk', () => {
            const ts = {id: 99, name: 'ds'};
            const action = attachDesignStormSuccess(ts, 12);
            expect(action.type).toBe(ATTACH_DESIGN_STORM_SUCCESS);
            expect(action.timeSeries).toBe(ts);
            expect(action.rainfallPk).toBe(12);
        });

        it('markProjectionStale creates correct action', () => {
            const action = markProjectionStale();
            expect(action.type).toBe(MARK_PROJECTION_STALE);
        });
    });

    // ---------------------------------------------------------------------------
    // 2. Reducer
    // ---------------------------------------------------------------------------
    describe('reducer — projection slice', () => {
        it('initial state has projection slice with correct defaults', () => {
            const state = reducer(undefined, {type: '@@INIT'});
            expect(state.projection).toExist();
            expect(state.projection.selectedIdfTableId).toBe(null);
            expect(state.projection.selectedPatterns).toEqual([]);
            expect(state.projection.previews).toEqual([]);
            expect(state.projection.inFlight).toBe(false);
            expect(state.projection.stale).toBe(false);
            expect(state.projection.focusedKey).toBe(null);
            expect(state.projection.attachInFlight).toBe(false);
        });

        it('SET_PROJECTION_SPEC updates spec, clears previews + focusedKey', () => {
            const pre = reducer(undefined, {
                type: PREVIEW_DESIGN_STORMS_SUCCESS,
                previews: [{pattern: 'HUFF'}]
            });
            // Ensure previews is set first
            const state = reducer(pre, {
                type: SET_PROJECTION_SPEC,
                spec: {selectedIdfTableId: 42, timestepMin: 30}
            });
            expect(state.projection.selectedIdfTableId).toBe(42);
            expect(state.projection.timestepMin).toBe(30);
            expect(state.projection.previews).toEqual([]);
            expect(state.projection.focusedKey).toBe(null);
            expect(state.projection.stale).toBe(false);
        });

        it('PREVIEW_DESIGN_STORMS_REQUEST sets inFlight=true, clears error + stale', () => {
            const state = reducer(undefined, {type: PREVIEW_DESIGN_STORMS_REQUEST});
            expect(state.projection.inFlight).toBe(true);
            expect(state.projection.error).toBe(null);
            expect(state.projection.stale).toBe(false);
        });

        it('PREVIEW_DESIGN_STORMS_SUCCESS stores previews, clears inFlight', () => {
            const previews = [
                {pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440, persisted: false, rowData: []}
            ];
            const pre = reducer(undefined, {type: PREVIEW_DESIGN_STORMS_REQUEST});
            const state = reducer(pre, {type: PREVIEW_DESIGN_STORMS_SUCCESS, previews});
            expect(state.projection.inFlight).toBe(false);
            expect(state.projection.previews).toEqual(previews);
            expect(state.projection.stale).toBe(false);
        });

        it('PREVIEW_DESIGN_STORMS_FAILURE stores error, clears inFlight', () => {
            const pre = reducer(undefined, {type: PREVIEW_DESIGN_STORMS_REQUEST});
            const state = reducer(pre, {type: PREVIEW_DESIGN_STORMS_FAILURE, error: 'compute error'});
            expect(state.projection.inFlight).toBe(false);
            expect(state.projection.error).toBe('compute error');
        });

        it('SET_PROJECTION_VIEW_FILTER merges into viewFilter', () => {
            const state = reducer(undefined, {
                type: SET_PROJECTION_VIEW_FILTER,
                filter: {ari: 100}
            });
            expect(state.projection.viewFilter.ari).toBe(100);
            // durationMin untouched (merges)
            expect(state.projection.viewFilter.durationMin).toBe(null);
        });

        it('SET_FOCUSED_PREVIEW updates focusedKey', () => {
            const state = reducer(undefined, {type: SET_FOCUSED_PREVIEW, key: 'HUFF|50|720'});
            expect(state.projection.focusedKey).toBe('HUFF|50|720');
        });

        it('ATTACH_DESIGN_STORM_REQUEST sets attachInFlight=true', () => {
            const state = reducer(undefined, {
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 1, spec: {}, featureId: null
            });
            expect(state.projection.attachInFlight).toBe(true);
            expect(state.projection.attachError).toBe(null);
        });

        it('ATTACH_DESIGN_STORM_SUCCESS clears attachInFlight', () => {
            const pre = reducer(undefined, {
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 1, spec: {}, featureId: null
            });
            const state = reducer(pre, {
                type: ATTACH_DESIGN_STORM_SUCCESS,
                timeSeries: {id: 77}, rainfallPk: 1
            });
            expect(state.projection.attachInFlight).toBe(false);
            expect(state.projection.attachError).toBe(null);
        });

        it('ATTACH_DESIGN_STORM_FAILURE stores attachError, clears attachInFlight', () => {
            const pre = reducer(undefined, {
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 1, spec: {}, featureId: null
            });
            const state = reducer(pre, {
                type: ATTACH_DESIGN_STORM_FAILURE,
                error: 'attach error'
            });
            expect(state.projection.attachInFlight).toBe(false);
            expect(state.projection.attachError).toBe('attach error');
        });

        it('MARK_PROJECTION_STALE sets stale=true', () => {
            const state = reducer(undefined, {type: MARK_PROJECTION_STALE});
            expect(state.projection.stale).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 3. previewDesignStormsEpic
    // ---------------------------------------------------------------------------
    describe('previewDesignStormsEpic', () => {
        let mockAxios;
        const projectId = 64;

        beforeEach(() => {
            mockAxios = setupMockAxios();
        });

        it('POSTs with mode=preview + cells to derive-design-storm, dispatches SUCCESS', (done) => {
            const cells = [
                {pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440, timestep_min: 60}
            ];
            const previewsResponse = {
                mode: 'preview',
                idf_table_id: 5,
                previews: [{
                    pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440,
                    total_depth_mm: 134.2, persisted: false, rowData: [{timestamp: 't', value: 1}]
                }]
            };
            mockAxios.onPost(
                `/api/v2/anuga/projects/${projectId}/time-series/derive-design-storm/`
            ).reply(200, previewsResponse);

            const action$ = mockActions([{
                type: PREVIEW_DESIGN_STORMS_REQUEST,
                cells, idfTableId: 5, timestepMin: 60
            }]);
            const store = makeStore(null, [], projectId);

            const collected = [];
            const sub = previewDesignStormsEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    // Verify the POST body included mode='preview'
                    const lastPost = mockAxios.history.post.slice(-1)[0];
                    const body = JSON.parse(lastPost.data);
                    expect(body.mode).toBe('preview');
                    expect(body.cells).toEqual(cells);
                    expect(body.idf_table_id).toBe(5);

                    // SUCCESS action with previews
                    expect(collected.length).toBe(1);
                    expect(collected[0].type).toBe(PREVIEW_DESIGN_STORMS_SUCCESS);
                    expect(collected[0].previews.length).toBe(1);
                    expect(collected[0].previews[0].persisted).toBe(false);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches SUCCESS([]) and makes no HTTP call when cells=[]', (done) => {
            const action$ = mockActions([{
                type: PREVIEW_DESIGN_STORMS_REQUEST,
                cells: [], idfTableId: 5, timestepMin: 60
            }]);
            const store = makeStore(null, [], projectId);
            const collected = [];
            const sub = previewDesignStormsEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(1);
                    expect(collected[0].type).toBe(PREVIEW_DESIGN_STORMS_SUCCESS);
                    expect(collected[0].previews).toEqual([]);
                    expect(mockAxios.history.post.length).toBe(0);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches FAILURE when no active project', (done) => {
            const action$ = mockActions([{
                type: PREVIEW_DESIGN_STORMS_REQUEST,
                cells: [{pattern: 'HUFF', ari: 10, duration_min: 360, timestep_min: 60}],
                idfTableId: 5, timestepMin: 60
            }]);
            const noProjectStore = {
                getState: () => ({anuga: {projects: {data: null}}, hydrology: {}})
            };
            const collected = [];
            const sub = previewDesignStormsEpic(action$, noProjectStore).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === PREVIEW_DESIGN_STORMS_FAILURE)).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches FAILURE on BE error response', (done) => {
            mockAxios.onPost().reply(400, {detail: 'bad cell params'});
            const cells = [{pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440, timestep_min: 60}];
            const action$ = mockActions([{
                type: PREVIEW_DESIGN_STORMS_REQUEST,
                cells, idfTableId: 5, timestepMin: 60
            }]);
            const store = makeStore(null, [], projectId);
            const collected = [];
            const sub = previewDesignStormsEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === PREVIEW_DESIGN_STORMS_FAILURE)).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });
    });

    // ---------------------------------------------------------------------------
    // 4. reprojectOnSaveEpic (AC5)
    // ---------------------------------------------------------------------------
    describe('reprojectOnSaveEpic', () => {
        it('dispatches markProjectionStale when sv-idf-table saved and no projection spec', (done) => {
            const action$ = mockActions([{
                type: SAVE_HYDROLOGY_ITEM_SUCCESS,
                activeHydrologyPage: 'sv-idf-table',
                item: {id: 5, name: 'IDF A'}
            }]);
            const store = makeStore(null, [], 64);
            const collected = [];
            const sub = reprojectOnSaveEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === MARK_PROJECTION_STALE)).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches PREVIEW_DESIGN_STORMS_REQUEST when sv-idf-table saved and projection is active', (done) => {
            const idfTable = {
                id: 5,
                data: {
                    return_periods_yr: [10, 100],
                    durations_min: [60, 1440]
                }
            };
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['SCS_TYPE_II'],
                viewFilter: {},
                timestepMin: 60
            };
            const action$ = mockActions([{
                type: SAVE_HYDROLOGY_ITEM_SUCCESS,
                activeHydrologyPage: 'sv-idf-table',
                item: {id: 5, name: 'IDF A'}
            }]);
            const store = makeStore(projection, [idfTable], 64);
            const collected = [];
            const sub = reprojectOnSaveEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === PREVIEW_DESIGN_STORMS_REQUEST)).toBe(true);
                    const preview = collected.find(a => a.type === PREVIEW_DESIGN_STORMS_REQUEST);
                    // cells = 1 pattern × 2 ARIs × 2 durations = 4
                    expect(preview.cells.length).toBe(4);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches PREVIEW_DESIGN_STORMS_REQUEST when temporal-pattern saved and projection active', (done) => {
            const idfTable = {
                id: 5,
                data: {return_periods_yr: [100], durations_min: [1440]}
            };
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['HUFF'],
                viewFilter: {},
                timestepMin: 60
            };
            const action$ = mockActions([{
                type: SAVE_HYDROLOGY_ITEM_SUCCESS,
                activeHydrologyPage: 'temporal-pattern',
                item: {id: 3, name: 'Huff Q2'}
            }]);
            const store = makeStore(projection, [idfTable], 64);
            const collected = [];
            const sub = reprojectOnSaveEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a =>
                        a.type === PREVIEW_DESIGN_STORMS_REQUEST ||
                        a.type === MARK_PROJECTION_STALE
                    )).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('IGNORES time-series save (only IDF/pattern triggers reproject)', (done) => {
            const action$ = mockActions([{
                type: SAVE_HYDROLOGY_ITEM_SUCCESS,
                activeHydrologyPage: 'time-series',
                item: {id: 9, name: 'TS 1'}
            }]);
            const store = makeStore(null, [], 64);
            const collected = [];
            const sub = reprojectOnSaveEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.length).toBe(0);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });
    });

    // ---------------------------------------------------------------------------
    // 5. attachDesignStormEpic (AC6)
    // ---------------------------------------------------------------------------
    describe('attachDesignStormEpic', () => {
        let mockAxios;
        const projectId = 64;

        beforeEach(() => {
            mockAxios = setupMockAxios();
        });

        it('POSTs to attach-design-storm, dispatches SUCCESS + fetchTimeSeriesData', (done) => {
            const ts = {id: 88, name: 'Design Storm HUFF 720min ARI50yr', source: 'design_storm|...'};
            mockAxios.onPost(
                `/api/v2/anuga/projects/${projectId}/rainfalls/12/attach-design-storm/`
            ).reply(201, ts);

            const spec = {
                idfTableId: 5, patternKey: 'HUFF',
                ari: 50, aep: '', durationMin: 720, timestepMin: 60
            };
            const action$ = mockActions([{
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 12, spec, featureId: 3
            }]);
            const store = makeStore(null, [], projectId);
            const collected = [];
            const sub = attachDesignStormEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    // Verify POST URL
                    const lastPost = mockAxios.history.post.slice(-1)[0];
                    expect(lastPost.url).toBe(
                        `/api/v2/anuga/projects/${projectId}/rainfalls/12/attach-design-storm/`
                    );
                    // Request body
                    const body = JSON.parse(lastPost.data);
                    expect(body.idf_table_id).toBe(5);
                    expect(body.pattern).toBe('HUFF');
                    expect(body.ari).toBe(50);
                    expect(body.duration_min).toBe(720);
                    expect(body.feature_id).toBe(3);

                    // Dispatched actions
                    expect(collected.some(a => a.type === ATTACH_DESIGN_STORM_SUCCESS)).toBe(true);
                    expect(collected.some(a => a.type === FETCH_HYDROLOGY_TIME_SERIES_DATA)).toBe(true);
                    const success = collected.find(a => a.type === ATTACH_DESIGN_STORM_SUCCESS);
                    expect(success.timeSeries.id).toBe(88);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches FAILURE when no active project', (done) => {
            const action$ = mockActions([{
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 12,
                spec: {idfTableId: 5, patternKey: 'HUFF', ari: 50, durationMin: 720, timestepMin: 60},
                featureId: null
            }]);
            const noProjectStore = {getState: () => ({anuga: {projects: {data: null}}, hydrology: {}})};
            const collected = [];
            const sub = attachDesignStormEpic(action$, noProjectStore).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === ATTACH_DESIGN_STORM_FAILURE)).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });

        it('dispatches FAILURE on 400 error from BE', (done) => {
            mockAxios.onPost().reply(400, {detail: 'invalid spec'});
            const spec = {idfTableId: 5, patternKey: 'HUFF', ari: 50, durationMin: 720, timestepMin: 60};
            const action$ = mockActions([{
                type: ATTACH_DESIGN_STORM_REQUEST,
                rainfallPk: 12, spec, featureId: null
            }]);
            const store = makeStore(null, [], projectId);
            const collected = [];
            const sub = attachDesignStormEpic(action$, store).subscribe(
                a => collected.push(a),
                err => done(err),
                () => {
                    expect(collected.some(a => a.type === ATTACH_DESIGN_STORM_FAILURE)).toBe(true);
                    if (sub) sub.unsubscribe();
                    done();
                }
            );
        });
    });

    // ---------------------------------------------------------------------------
    // 6. _buildProjectionCells (pure function)
    // ---------------------------------------------------------------------------
    describe('_buildProjectionCells', () => {
        const baseIdf = {
            id: 5,
            data: {
                return_periods_yr: [2, 10, 100],
                durations_min: [60, 360, 1440]
            }
        };

        it('returns empty array when projection is null', () => {
            expect(_buildProjectionCells(null, [baseIdf])).toEqual([]);
        });

        it('returns empty array when no IDF table found for selectedIdfTableId', () => {
            const projection = {
                selectedIdfTableId: 999,
                selectedPatterns: ['HUFF'],
                viewFilter: {}, timestepMin: 60
            };
            expect(_buildProjectionCells(projection, [baseIdf])).toEqual([]);
        });

        it('cross-product: 1 pattern × 3 ARIs × 3 durations = 9 cells', () => {
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['HUFF'],
                viewFilter: {}, timestepMin: 60
            };
            const cells = _buildProjectionCells(projection, [baseIdf]);
            expect(cells.length).toBe(9);
            expect(cells.every(c => c.pattern === 'HUFF')).toBe(true);
            expect(cells.every(c => c.timestep_min === 60)).toBe(true);
        });

        it('view-filter: ARI narrows result (AC2)', () => {
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['SCS_TYPE_II'],
                viewFilter: {ari: 100}, timestepMin: 60
            };
            const cells = _buildProjectionCells(projection, [baseIdf]);
            // 1 pattern × 1 ARI × 3 durations = 3
            expect(cells.length).toBe(3);
            expect(cells.every(c => c.ari === 100)).toBe(true);
        });

        it('view-filter: duration narrows result (AC2)', () => {
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['alternating_block'],
                viewFilter: {durationMin: 1440}, timestepMin: 60
            };
            const cells = _buildProjectionCells(projection, [baseIdf]);
            // 1 pattern × 3 ARIs × 1 duration = 3
            expect(cells.length).toBe(3);
            expect(cells.every(c => c.duration_min === 1440)).toBe(true);
        });

        it('both view-filters: ARI + duration = 1 cell', () => {
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: ['SCS_TYPE_II'],
                viewFilter: {ari: 10, durationMin: 360}, timestepMin: 60
            };
            const cells = _buildProjectionCells(projection, [baseIdf]);
            expect(cells.length).toBe(1);
            expect(cells[0].ari).toBe(10);
            expect(cells[0].duration_min).toBe(360);
        });

        it('empty selectedPatterns defaults to all 6 preset patterns', () => {
            const projection = {
                selectedIdfTableId: 5,
                selectedPatterns: [],
                viewFilter: {ari: 100, durationMin: 1440}, timestepMin: 60
            };
            const cells = _buildProjectionCells(projection, [baseIdf]);
            // 6 patterns × 1 ARI × 1 duration = 6
            expect(cells.length).toBe(6);
        });
    });

    // ---------------------------------------------------------------------------
    // 7. previewKey helper
    // ---------------------------------------------------------------------------
    describe('previewKey', () => {
        it('produces stable composite key from preview object', () => {
            const preview = {pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440};
            expect(previewKey(preview)).toBe('SCS_TYPE_II|100|1440');
        });

        it('different pattern produces different key', () => {
            const p1 = {pattern: 'SCS_TYPE_II', ari: 100, duration_min: 1440};
            const p2 = {pattern: 'HUFF', ari: 100, duration_min: 1440};
            expect(previewKey(p1)).toNotBe(previewKey(p2));
        });

        it('different ari produces different key', () => {
            const p1 = {pattern: 'HUFF', ari: 10, duration_min: 1440};
            const p2 = {pattern: 'HUFF', ari: 100, duration_min: 1440};
            expect(previewKey(p1)).toNotBe(previewKey(p2));
        });
    });

    // ---------------------------------------------------------------------------
    // 8. rowDataToHyetograph (AC3 reuse guard — unchanged from W4)
    // ---------------------------------------------------------------------------
    describe('rowDataToHyetograph (W4b reuse AC3)', () => {
        it('still maps values to intensity and clamps negatives', () => {
            const rowData = [
                {timestamp: '2000-01-01T00:00:00', value: 5},
                {timestamp: '2000-01-01T01:00:00', value: -1}
            ];
            const result = rowDataToHyetograph(rowData);
            expect(result.length).toBe(2);
            expect(result[0].intensity).toBe(5);
            expect(result[1].intensity).toBe(0);
        });

        it('returns [] for empty input', () => {
            expect(rowDataToHyetograph([])).toEqual([]);
        });
    });

});

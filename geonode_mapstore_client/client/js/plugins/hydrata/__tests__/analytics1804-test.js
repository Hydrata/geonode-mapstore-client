/**
 * TASK-1804 — Analytics instrumentation tests.
 *
 * Verifies that the three currently-dark surfaces fire the correct
 * START / COMPLETE / ERROR trackEvent calls via window.umami.track.
 *
 * Strategy: set window.umami = { track: spy } so trackEvent() captures
 * calls without any webpack-module-spy machinery (same pattern as
 * anugaScenarioAnalyticsParity-test.js).
 *
 * Surfaces tested:
 *   (a) TerrainWorkbench derive  — labels terrain-merge-{start,complete,error}
 *   (b) HGeval report generation — labels hgeval-report-{start,complete,error}
 *   (c) IDF derive               — labels idf-derive-{start,complete,error}
 */

import expect from 'expect';
import Rx from 'rxjs';
import mockAxios from '../../../__tests__/helpers/mockAxios';

// ── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Build a Subject-based ActionsObservable that emits actions and completes.
 */
function mockActions(actions) {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
}

/**
 * Collect all window.umami.track calls during a test.
 */
function makeUmamiSpy() {
    const calls = [];
    const origUmami = window.umami;
    window.umami = { track: (label, payload) => calls.push({ label, ...payload }) };
    return {
        calls,
        labels: () => calls.map(c => c.label),
        restore: () => { window.umami = origUmami; }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) TerrainWorkbench — terrain-merge-{start,complete,error}
// ═══════════════════════════════════════════════════════════════════════════

describe('TASK-1804 analytics — TerrainWorkbench derive', () => {
    const {
        twDeriveEpic,
        twDeriveCompleteEpic
    } = require('../TerrainWorkbench/epicsTerrainWorkbench');
    const {
        TW_DERIVE,
        TW_DERIVE_SUCCESS,
        twDeriveSuccess
    } = require('../TerrainWorkbench/actionsTerrainWorkbench');

    let mock;
    let spy;

    beforeEach(() => {
        mock = mockAxios();
        spy = makeUmamiSpy();
    });

    afterEach(() => {
        spy.restore();
    });

    const projectId = 99;
    const surfaceId = 7;

    function makeStore(taskMonitorState) {
        return {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                gnresource: { id: 1 },
                taskMonitor: taskMonitorState || { processes: { byId: {} } }
            })
        };
    }

    it('test_terrain_merge_fires_start_on_TW_DERIVE', (done) => {
        // Stub the derive POST so the epic can proceed.
        mock.onPost().reply(202, { process_id: 'pid-1' });
        const action$ = mockActions([{
            type: TW_DERIVE,
            surfaceId: surfaceId,
            body: {}
        }]);
        const store = makeStore();
        const sub = twDeriveEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('terrain-merge-start');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_terrain_merge_fires_error_on_derive_POST_failure', (done) => {
        // Stub the derive POST to return 500.
        mock.onPost().reply(500, { detail: 'Server error' });
        const action$ = mockActions([{
            type: TW_DERIVE,
            surfaceId: surfaceId,
            body: {}
        }]);
        const store = makeStore();
        const sub = twDeriveEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('terrain-merge-error');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_terrain_merge_fires_complete_when_process_reaches_complete', (done) => {
        // Stub the surface GET that follows a successful derive.
        mock.onGet().reply(200, { id: surfaceId, is_stale: false });

        // Build a store where the process is already 'complete'.
        const storeWithComplete = {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                taskMonitor: {
                    processes: {
                        byId: { 'pid-1': { status: 'complete', metadata: {} } }
                    }
                }
            })
        };
        const action$ = mockActions([
            twDeriveSuccess(surfaceId, 'pid-1')
        ]);
        // twDeriveCompleteEpic uses a timer — it never completes; collect
        // emissions and verify trackEvent fires on the first non-empty action.
        const sub = twDeriveCompleteEpic(action$, storeWithComplete).subscribe(
            () => {
                // Check on each emission; once we see the label, we're done.
                if (spy.labels().indexOf('terrain-merge-complete') !== -1) {
                    sub.unsubscribe();
                    done();
                }
            },
            err => done(err)
        );
    });

    it('test_terrain_merge_fires_error_when_process_reaches_error', (done) => {
        const storeWithError = {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                taskMonitor: {
                    processes: {
                        byId: { 'pid-2': { status: 'error', metadata: { error_message: 'Derive failed' } } }
                    }
                }
            })
        };
        const action$ = mockActions([
            twDeriveSuccess(surfaceId, 'pid-2')
        ]);
        // twDeriveCompleteEpic uses a timer — collect first emission.
        const sub = twDeriveCompleteEpic(action$, storeWithError).subscribe(
            () => {
                if (spy.labels().indexOf('terrain-merge-error') !== -1) {
                    sub.unsubscribe();
                    done();
                }
            },
            err => done(err)
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// (b) HGeval — hgeval-report-{start,complete,error}
// ═══════════════════════════════════════════════════════════════════════════

describe('TASK-1804 analytics — HGeval report generation', () => {
    const { startReportEpic } = require('../HGeval/epicsHGeval');
    const { HGEVAL_START_REPORT } = require('../HGeval/actionsHGeval');

    let mock;
    let spy;

    beforeEach(() => {
        mock = mockAxios();
        spy = makeUmamiSpy();
    });

    afterEach(() => {
        spy.restore();
    });

    it('test_hgeval_report_fires_start_on_HGEVAL_START_REPORT', (done) => {
        // No coordinates → early error path; START must still fire.
        const store = {
            getState: () => ({
                hgeval: { coordinates: null, step: 'selecting' }
            })
        };
        const action$ = mockActions([{ type: HGEVAL_START_REPORT }]);
        const sub = startReportEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('hgeval-report-start');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_hgeval_report_fires_error_when_no_coordinates', (done) => {
        const store = {
            getState: () => ({
                hgeval: { coordinates: null, step: 'selecting' }
            })
        };
        const action$ = mockActions([{ type: HGEVAL_START_REPORT }]);
        const sub = startReportEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('hgeval-report-error');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_hgeval_report_fires_error_when_coords_outside_nicaragua_bounds', (done) => {
        const store = {
            getState: () => ({
                hgeval: {
                    coordinates: { lon: 0, lat: 0 }, // outside Nicaragua
                    step: 'selecting'
                }
            })
        };
        const action$ = mockActions([{ type: HGEVAL_START_REPORT }]);
        const sub = startReportEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('hgeval-report-error');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// (c) IDF derive — idf-derive-{start,complete,error}
// ═══════════════════════════════════════════════════════════════════════════

describe('TASK-1804 analytics — IDF derive', () => {
    const {
        deriveIdfEpic,
        idfDeriveCompleteEpic
    } = require('../Hydrology/epicsHydrology');
    const {
        DERIVE_IDF_REQUEST,
        SET_IDF_DERIVE_PROCESS_ID,
        setIdfDeriveProcessId
    } = require('../Hydrology/actionsHydrology');

    let mock;
    let spy;

    beforeEach(() => {
        mock = mockAxios();
        spy = makeUmamiSpy();
    });

    afterEach(() => {
        spy.restore();
    });

    const projectId = 42;

    function makeStore(overrides) {
        return {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                hydrology: {
                    idfDerive: {
                        lat: -13.0,
                        lon: 130.0,
                        durationsText: '60,120',
                        rpsText: '2,10',
                        yearRangeMode: '10yr',
                        mapPickActive: false,
                        ...((overrides || {}).idfDerive)
                    }
                },
                taskMonitor: {
                    processes: { byId: {} }
                },
                ...overrides
            })
        };
    }

    it('test_idf_derive_fires_start_on_DERIVE_IDF_REQUEST', (done) => {
        // 202 background path.
        mock.onPost().reply(202, { task_id: 'tid-1', process_id: 'pid-1' });
        const action$ = mockActions([{ type: DERIVE_IDF_REQUEST }]);
        const store = makeStore();
        const sub = deriveIdfEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('idf-derive-start');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_idf_derive_fires_error_on_503', (done) => {
        mock.onPost().reply(503, {});
        const action$ = mockActions([{ type: DERIVE_IDF_REQUEST }]);
        const store = makeStore();
        const sub = deriveIdfEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('idf-derive-error');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_idf_derive_fires_complete_on_gpex_fast_path', (done) => {
        // 200 GPEX fast-path — mocked to return idf table directly.
        const idftableId = 55;
        mock.onPost().reply(200, { tier: 'gpex', idftable_id: idftableId });
        mock.onGet().reply(200, { id: idftableId, data: { return_periods_yr: [2, 10] } });
        const action$ = mockActions([{ type: DERIVE_IDF_REQUEST }]);
        const store = makeStore();
        const sub = deriveIdfEpic(action$, store).subscribe(
            () => {},
            err => done(err),
            () => {
                expect(spy.labels()).toInclude('idf-derive-complete');
                if (sub) sub.unsubscribe();
                done();
            }
        );
    });

    it('test_idf_derive_fires_complete_in_poll_complete_path', (done) => {
        const idftableId = 56;
        mock.onGet().reply(200, { id: idftableId, data: {} });

        const storeWithComplete = {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                taskMonitor: {
                    processes: {
                        byId: {
                            'pid-2': {
                                status: 'complete',
                                metadata: { idftable_id: idftableId }
                            }
                        }
                    }
                }
            })
        };
        const action$ = mockActions([setIdfDeriveProcessId(null, 'pid-2')]);
        // idfDeriveCompleteEpic uses a timer — collect first emission.
        const sub = idfDeriveCompleteEpic(action$, storeWithComplete).subscribe(
            () => {
                if (spy.labels().indexOf('idf-derive-complete') !== -1) {
                    sub.unsubscribe();
                    done();
                }
            },
            err => done(err)
        );
    });

    it('test_idf_derive_fires_error_on_poll_error_status', (done) => {
        const storeWithError = {
            getState: () => ({
                anuga: { projects: { data: { id: projectId } } },
                taskMonitor: {
                    processes: {
                        byId: {
                            'pid-3': {
                                status: 'error',
                                metadata: { error_message: 'ERA5 failed' }
                            }
                        }
                    }
                }
            })
        };
        const action$ = mockActions([setIdfDeriveProcessId(null, 'pid-3')]);
        // idfDeriveCompleteEpic uses a timer — collect first emission.
        const sub = idfDeriveCompleteEpic(action$, storeWithError).subscribe(
            () => {
                if (spy.labels().indexOf('idf-derive-error') !== -1) {
                    sub.unsubscribe();
                    done();
                }
            },
            err => done(err)
        );
    });
});

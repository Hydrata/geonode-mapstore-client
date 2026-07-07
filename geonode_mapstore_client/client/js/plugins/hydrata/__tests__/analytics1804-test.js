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
 *
 * Supports BOTH umami.track call shapes used in this codebase:
 *   - trackEvent(category, action, label) -> umami.track(label, {category, action})
 *   - trackPageview(url)                  -> umami.track((props) => ({...props, url}))
 *     (TASK-2141 — Umami's documented SPA pageview pattern: a callback that
 *     overrides only `url` on the auto-collected payload.)
 */
function makeUmamiSpy() {
    const calls = [];
    const origUmami = window.umami;
    window.umami = {
        track: (labelOrFn, payload) => {
            if (typeof labelOrFn === 'function') {
                const props = labelOrFn({});
                calls.push({ ...props });
            } else {
                calls.push({ label: labelOrFn, ...payload });
            }
        }
    };
    return {
        calls,
        labels: () => calls.map(c => c.label).filter((l) => l !== undefined),
        urls: () => calls.map(c => c.url).filter((u) => u !== undefined),
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

    let spy;

    beforeEach(() => {
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

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2140 — outcome events (Intent-vs-Outcome taxonomy, epic TASK-2129 W2)
// ═══════════════════════════════════════════════════════════════════════════

// (a) ANUGA run terminal-state observed — anuga-run-terminal-{complete,error,cancelled}
describe('TASK-2140 (a) analytics — ANUGA run terminal-state observed', () => {
    const { pollActiveRunStatusEpic } = require('../Anuga/epics/pollingEpics');
    const { START_ACTIVE_RUN_POLLING } = require('../Anuga/actions/pollingActions');

    let mock;
    let spy;

    beforeEach(() => {
        mock = mockAxios();
        spy = makeUmamiSpy();
    });

    afterEach(() => {
        spy.restore();
    });

    it('test_run_terminal_fires_anuga_run_terminal_complete', (done) => {
        mock.onGet('/api/v2/anuga/runs/501/status/').reply(200, { status: 'complete' });
        const action$ = mockActions([{ type: START_ACTIVE_RUN_POLLING, runId: 501 }]);
        const sub = pollActiveRunStatusEpic(action$, { getState: () => ({ anuga: { scenarios: { byId: {} } } }) })
            .subscribe(
                () => {
                    if (spy.labels().indexOf('anuga-run-terminal-complete') !== -1) {
                        sub.unsubscribe();
                        done();
                    }
                },
                err => done(err)
            );
    });

    it('test_run_terminal_fires_anuga_run_terminal_error', (done) => {
        mock.onGet('/api/v2/anuga/runs/502/status/').reply(200, { status: 'error' });
        const action$ = mockActions([{ type: START_ACTIVE_RUN_POLLING, runId: 502 }]);
        const sub = pollActiveRunStatusEpic(action$, { getState: () => ({ anuga: { scenarios: { byId: {} } } }) })
            .subscribe(
                () => {
                    if (spy.labels().indexOf('anuga-run-terminal-error') !== -1) {
                        sub.unsubscribe();
                        done();
                    }
                },
                err => done(err)
            );
    });

    it('test_run_non_terminal_status_does_not_fire_a_terminal_label', (done) => {
        mock.onGet('/api/v2/anuga/runs/503/status/').reply(200, { status: 'running' });
        const action$ = mockActions([{ type: START_ACTIVE_RUN_POLLING, runId: 503 }]);
        // No terminal status arrives — this epic's timer/take(cap) stream
        // never completes on its own here, so assert on a short timer rather
        // than in the subscribe callback (a throw inside next() would not
        // reliably surface as a mocha failure).
        const sub = pollActiveRunStatusEpic(action$, { getState: () => ({ anuga: { scenarios: { byId: {} } } }) })
            .subscribe(() => {}, err => done(err));
        setTimeout(() => {
            sub.unsubscribe();
            try {
                expect(spy.labels().some((l) => l.indexOf('anuga-run-terminal-') === 0)).toBe(false);
                done();
            } catch (e) {
                done(e);
            }
        }, 300);
    });
});

// (b) TaskMonitor panel open/close + terminal-status-seen
describe('TASK-2140 (b) analytics — TaskMonitor panel toggle + terminal-status-seen', () => {
    const {
        trackTaskMonitorPanelToggleEpic,
        trackTerminalStatusSeenEpic,
        __resetTerminalSeenForTests
    } = require('../TaskMonitor/epicsTaskMonitor');
    const { TM_TOGGLE_PANEL, TM_SET_PROCESSES } = require('../TaskMonitor/actionsTaskMonitor');

    let spy;

    beforeEach(() => {
        spy = makeUmamiSpy();
        __resetTerminalSeenForTests();
    });

    afterEach(() => {
        spy.restore();
    });

    it('test_panel_toggle_fires_open_then_close', (done) => {
        const action$ = mockActions([
            { type: TM_TOGGLE_PANEL, open: true },
            { type: TM_TOGGLE_PANEL, open: false }
        ]);
        trackTaskMonitorPanelToggleEpic(action$)
            .subscribe(
                () => {},
                err => done(err),
                () => {
                    expect(spy.labels()).toEqual(['taskmonitor-panel-toggle', 'taskmonitor-panel-toggle']);
                    expect(spy.calls[0].action).toBe('open');
                    expect(spy.calls[1].action).toBe('close');
                    done();
                }
            );
    });

    it('test_terminal_status_seen_fires_once_per_process_id_despite_repeat_polls', (done) => {
        const action$ = mockActions([
            { type: TM_SET_PROCESSES, processes: [{ id: 'p1', status: 'complete' }, { id: 'p2', status: 'running' }] },
            // Same p1 re-arrives on the next poll tick (still 'complete') —
            // must NOT re-fire; p2 transitions to 'error' — must fire once.
            { type: TM_SET_PROCESSES, processes: [{ id: 'p1', status: 'complete' }, { id: 'p2', status: 'error' }] }
        ]);
        trackTerminalStatusSeenEpic(action$)
            .subscribe(
                () => {},
                err => done(err),
                () => {
                    const labels = spy.labels();
                    expect(labels.filter((l) => l === 'taskmonitor-process-terminal-complete').length).toBe(1);
                    expect(labels.filter((l) => l === 'taskmonitor-process-terminal-error').length).toBe(1);
                    done();
                }
            );
    });
});

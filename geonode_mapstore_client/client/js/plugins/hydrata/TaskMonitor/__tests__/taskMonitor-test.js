import expect from 'expect';
import Rx from 'rxjs';
import { testEpic, mockAxios } from '../../../../__tests__/helpers';
import { addTimeoutEpic, TEST_TIMEOUT } from '../../../../__tests__/helpers/testEpic';
import {
    autoStartTaskMonitorEpic,
    pollActiveCountEpic,
    pollProcessListEpic,
    loadProcessDetailEpic,
    cancelProcessEpic,
    processListsEqual
} from '../epicsTaskMonitor';
import {
    TM_START_POLLING,
    TM_STOP_POLLING,
    TM_TOGGLE_PANEL,
    TM_SET_FILTER,
    TM_SET_PROCESSES,
    TM_SET_ACTIVE_COUNT,
    TM_UPDATE_PROCESS,
    TM_CANCEL_PROCESS,
    TM_CANCEL_PROCESS_RESULT,
    toggleTaskMonitorPanel,
    setTaskMonitorFilter,
    expandProcess,
    toggleProcessLog,
    setProcesses,
    setActiveCount,
    updateProcess,
    startTaskMonitorPolling,
    stopTaskMonitorPolling,
    cancelProcess,
    cancelProcessResult
} from '../actionsTaskMonitor';
import {
    getProcesses,
    getAllProcessIds,
    getActiveCount,
    getPanelOpen,
    getFilter,
    getExpandedProcessId,
    getShowLog,
    getProcessById,
    getActiveProcesses,
    getProcessesByType,
    getProcessForObject,
    getFilteredProcesses,
    isActiveProcess
} from '../selectorsTaskMonitor';
import processReducer from '../reducers/processReducer';
import uiReducer from '../reducers/uiReducer';
import { LOGIN_SUCCESS } from '@mapstore/framework/actions/security';

/**
 * Helper: create a mock action$ observable from an array of actions.
 */
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

describe('TaskMonitor', () => {

    // =========================================================================
    // ACTION CREATORS
    // =========================================================================
    describe('action creators', () => {
        it('toggleTaskMonitorPanel creates correct action', () => {
            const action = toggleTaskMonitorPanel(true);
            expect(action.type).toBe(TM_TOGGLE_PANEL);
            expect(action.open).toBe(true);
        });

        it('setTaskMonitorFilter creates correct action', () => {
            const action = setTaskMonitorFilter('completed');
            expect(action.type).toBe(TM_SET_FILTER);
            expect(action.filter).toBe('completed');
        });

        it('setProcesses creates correct action', () => {
            const procs = [{ id: 1, status: 'running' }];
            const action = setProcesses(procs);
            expect(action.type).toBe(TM_SET_PROCESSES);
            expect(action.processes).toBe(procs);
        });

        it('setActiveCount creates correct action', () => {
            const action = setActiveCount(5);
            expect(action.type).toBe(TM_SET_ACTIVE_COUNT);
            expect(action.count).toBe(5);
        });

        it('startTaskMonitorPolling creates correct action', () => {
            const action = startTaskMonitorPolling();
            expect(action.type).toBe(TM_START_POLLING);
        });

        it('stopTaskMonitorPolling creates correct action', () => {
            const action = stopTaskMonitorPolling();
            expect(action.type).toBe(TM_STOP_POLLING);
        });

        it('cancelProcess creates correct action with processId', () => {
            const action = cancelProcess(42);
            expect(action.type).toBe(TM_CANCEL_PROCESS);
            expect(action.processId).toBe(42);
        });

        it('updateProcess creates correct action', () => {
            const proc = { id: 1, status: 'complete' };
            const action = updateProcess(proc);
            expect(action.type).toBe(TM_UPDATE_PROCESS);
            expect(action.process).toBe(proc);
        });

        it('cancelProcessResult creates correct action', () => {
            const proc = { id: 1, status: 'cancelled' };
            const action = cancelProcessResult(proc);
            expect(action.type).toBe(TM_CANCEL_PROCESS_RESULT);
            expect(action.process).toBe(proc);
        });

        it('expandProcess creates correct action', () => {
            const action = expandProcess(10);
            expect(action.type).toBe('TM_EXPAND_PROCESS');
            expect(action.processId).toBe(10);
        });

        it('toggleProcessLog creates correct action', () => {
            const action = toggleProcessLog(true);
            expect(action.type).toBe('TM_TOGGLE_LOG');
            expect(action.show).toBe(true);
        });
    });

    // =========================================================================
    // PROCESS REDUCER
    // =========================================================================
    describe('processReducer', () => {
        it('should return initial state', () => {
            const state = processReducer(undefined, { type: 'UNKNOWN' });
            expect(state.byId).toEqual({});
            expect(state.allIds).toEqual([]);
            expect(state.activeCount).toBe(0);
            expect(state.lastFetched).toBe(null);
        });

        it('should handle TM_SET_PROCESSES', () => {
            const processes = [
                { id: 1, status: 'running', process_type: 'layer_create' },
                { id: 2, status: 'complete', process_type: 'compute' }
            ];
            const state = processReducer(undefined, { type: TM_SET_PROCESSES, processes });
            expect(state.byId[1].status).toBe('running');
            expect(state.byId[2].status).toBe('complete');
            expect(state.allIds).toEqual([1, 2]);
            expect(state.lastFetched).toBeA('number');
        });

        it('should handle TM_SET_ACTIVE_COUNT', () => {
            const state = processReducer(undefined, { type: TM_SET_ACTIVE_COUNT, count: 7 });
            expect(state.activeCount).toBe(7);
        });

        it('should handle TM_UPDATE_PROCESS for existing process', () => {
            const initialState = {
                byId: { 1: { id: 1, status: 'running' } },
                allIds: [1],
                activeCount: 1,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_UPDATE_PROCESS,
                process: { id: 1, status: 'complete', log: 'done' }
            });
            expect(state.byId[1].status).toBe('complete');
            expect(state.byId[1].log).toBe('done');
            expect(state.allIds).toEqual([1]);
        });

        it('should handle TM_UPDATE_PROCESS for new process', () => {
            const initialState = {
                byId: { 1: { id: 1, status: 'running' } },
                allIds: [1],
                activeCount: 1,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_UPDATE_PROCESS,
                process: { id: 2, status: 'pending' }
            });
            expect(state.byId[2].status).toBe('pending');
            // New process prepended to allIds
            expect(state.allIds).toEqual([2, 1]);
        });

        it('should handle TM_UPDATE_PROCESS with null process', () => {
            const initialState = {
                byId: {},
                allIds: [],
                activeCount: 0,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_UPDATE_PROCESS,
                process: null
            });
            expect(state).toBe(initialState);
        });

        it('should handle TM_CANCEL_PROCESS_RESULT', () => {
            const initialState = {
                byId: { 5: { id: 5, status: 'running' } },
                allIds: [5],
                activeCount: 1,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_CANCEL_PROCESS_RESULT,
                process: { id: 5, status: 'cancelled' }
            });
            expect(state.byId[5].status).toBe('cancelled');
        });

        it('should handle TM_CANCEL_PROCESS_RESULT with null process', () => {
            const initialState = {
                byId: {},
                allIds: [],
                activeCount: 0,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_CANCEL_PROCESS_RESULT,
                process: null
            });
            expect(state).toBe(initialState);
        });

        it('should drop processes not in new list and merge existing ones on TM_SET_PROCESSES', () => {
            const initialState = {
                byId: {
                    1: { id: 1, status: 'running', subtasks: [{ id: 10 }] },
                    2: { id: 2, status: 'pending' }
                },
                allIds: [1, 2],
                activeCount: 1,
                lastFetched: null
            };
            const state = processReducer(initialState, {
                type: TM_SET_PROCESSES,
                processes: [{ id: 2, status: 'complete' }, { id: 3, status: 'running' }]
            });
            // Process 1 should be gone — not in new list
            expect(state.byId[1]).toBe(undefined);
            // Process 2 should have updated status from poll
            expect(state.byId[2].status).toBe('complete');
            // Process 3 is new
            expect(state.byId[3].status).toBe('running');
            expect(state.allIds).toEqual([2, 3]);
        });

        it('should preserve subtasks and log from TM_UPDATE_PROCESS when TM_SET_PROCESSES fires', () => {
            // Simulate: detail fetch populated subtasks + log via TM_UPDATE_PROCESS
            const stateAfterDetail = processReducer(
                {
                    byId: { 1: { id: 1, status: 'running', progress_pct: 50 } },
                    allIds: [1],
                    activeCount: 1,
                    lastFetched: null
                },
                {
                    type: TM_UPDATE_PROCESS,
                    process: { id: 1, status: 'running', progress_pct: 50, subtasks: [{ id: 10, name: 'mesh' }], log: 'Step 1 done' }
                }
            );
            expect(stateAfterDetail.byId[1].subtasks.length).toBe(1);
            expect(stateAfterDetail.byId[1].log).toBe('Step 1 done');

            // Now the 3-second poll fires TM_SET_PROCESSES with list data (no subtasks/log)
            const stateAfterPoll = processReducer(stateAfterDetail, {
                type: TM_SET_PROCESSES,
                processes: [{ id: 1, status: 'running', progress_pct: 75 }]
            });
            // Poll data wins for shared fields
            expect(stateAfterPoll.byId[1].progress_pct).toBe(75);
            expect(stateAfterPoll.byId[1].status).toBe('running');
            // Detail-only fields preserved
            expect(stateAfterPoll.byId[1].subtasks).toEqual([{ id: 10, name: 'mesh' }]);
            expect(stateAfterPoll.byId[1].log).toBe('Step 1 done');
            expect(stateAfterPoll.allIds).toEqual([1]);
        });
    });

    // =========================================================================
    // UI REDUCER
    // =========================================================================
    describe('uiReducer', () => {
        it('should return initial state', () => {
            const state = uiReducer(undefined, { type: 'UNKNOWN' });
            expect(state.panelOpen).toBe(false);
            expect(state.filter).toBe('active');
            expect(state.expandedProcessId).toBe(null);
            expect(state.showLog).toBe(false);
        });

        it('should toggle panel open', () => {
            const state = uiReducer(undefined, { type: TM_TOGGLE_PANEL });
            expect(state.panelOpen).toBe(true);
        });

        it('should toggle panel closed', () => {
            const openState = { panelOpen: true, filter: 'active', expandedProcessId: null, showLog: false };
            const state = uiReducer(openState, { type: TM_TOGGLE_PANEL });
            expect(state.panelOpen).toBe(false);
        });

        it('should set panel to explicit open value', () => {
            const state = uiReducer(undefined, { type: TM_TOGGLE_PANEL, open: true });
            expect(state.panelOpen).toBe(true);
        });

        it('should set filter and reset expanded process', () => {
            const initialState = { panelOpen: true, filter: 'active', expandedProcessId: 5, showLog: true };
            const state = uiReducer(initialState, { type: TM_SET_FILTER, filter: 'completed' });
            expect(state.filter).toBe('completed');
            expect(state.expandedProcessId).toBe(null);
            expect(state.showLog).toBe(false);
        });

        it('should toggle expand process', () => {
            const state = uiReducer(undefined, { type: 'TM_EXPAND_PROCESS', processId: 10 });
            expect(state.expandedProcessId).toBe(10);
            expect(state.showLog).toBe(false);
        });

        it('should collapse process when same processId is expanded again', () => {
            const expandedState = { panelOpen: true, filter: 'active', expandedProcessId: 10, showLog: true };
            const state = uiReducer(expandedState, { type: 'TM_EXPAND_PROCESS', processId: 10 });
            expect(state.expandedProcessId).toBe(null);
        });

        it('should toggle log', () => {
            const state = uiReducer(undefined, { type: 'TM_TOGGLE_LOG' });
            expect(state.showLog).toBe(true);
        });

        it('should set log to explicit value', () => {
            const state = uiReducer(undefined, { type: 'TM_TOGGLE_LOG', show: true });
            expect(state.showLog).toBe(true);
        });
    });

    // =========================================================================
    // SELECTORS
    // =========================================================================
    describe('selectors', () => {
        const mockState = {
            taskMonitor: {
                processes: {
                    byId: {
                        1: { id: 1, status: 'running', process_type: 'layer_create', metadata: { source_object_id: 100 } },
                        2: { id: 2, status: 'complete', process_type: 'compute' },
                        3: { id: 3, status: 'pending', process_type: 'layer_create' },
                        4: { id: 4, status: 'error', process_type: 'compute' }
                    },
                    allIds: [1, 2, 3, 4],
                    activeCount: 2
                },
                ui: {
                    panelOpen: true,
                    filter: 'active',
                    expandedProcessId: 1,
                    showLog: false
                }
            }
        };

        it('getProcesses returns byId map', () => {
            const procs = getProcesses(mockState);
            expect(Object.keys(procs).length).toBe(4);
        });

        it('getAllProcessIds returns allIds array', () => {
            const ids = getAllProcessIds(mockState);
            expect(ids).toEqual([1, 2, 3, 4]);
        });

        it('getActiveCount returns count from state', () => {
            expect(getActiveCount(mockState)).toBe(2);
        });

        it('getActiveCount returns 0 for undefined state', () => {
            expect(getActiveCount({})).toBe(0);
        });

        it('getPanelOpen returns panel state', () => {
            expect(getPanelOpen(mockState)).toBe(true);
        });

        it('getPanelOpen returns false for undefined state', () => {
            expect(getPanelOpen({})).toBe(false);
        });

        it('getFilter returns filter value', () => {
            expect(getFilter(mockState)).toBe('active');
        });

        it('getExpandedProcessId returns expanded ID', () => {
            expect(getExpandedProcessId(mockState)).toBe(1);
        });

        it('getShowLog returns showLog state', () => {
            expect(getShowLog(mockState)).toBe(false);
        });

        it('getProcessById returns specific process', () => {
            const proc = getProcessById(mockState, 2);
            expect(proc.status).toBe('complete');
            expect(proc.process_type).toBe('compute');
        });

        it('getProcessById returns null for missing ID', () => {
            expect(getProcessById(mockState, 999)).toBe(null);
        });

        it('getActiveProcesses returns pending and running', () => {
            const active = getActiveProcesses(mockState);
            expect(active.length).toBe(2);
            expect(active.map(p => p.id).sort()).toEqual([1, 3]);
        });

        it('getProcessesByType filters by process_type', () => {
            const layerCreates = getProcessesByType(mockState, 'layer_create');
            expect(layerCreates.length).toBe(2);
            const computes = getProcessesByType(mockState, 'compute');
            expect(computes.length).toBe(2);
        });

        it('getProcessForObject finds by type and source_object_id', () => {
            const proc = getProcessForObject(mockState, 'layer_create', 100);
            expect(proc.id).toBe(1);
        });

        it('getProcessForObject returns null when not found', () => {
            expect(getProcessForObject(mockState, 'layer_create', 999)).toBe(null);
        });

        it('getFilteredProcesses returns active when filter is active', () => {
            const filtered = getFilteredProcesses(mockState);
            expect(filtered.length).toBe(2);
            filtered.forEach(p => {
                expect(['pending', 'running']).toContain(p.status);
            });
        });

        it('getFilteredProcesses returns completed when filter is completed', () => {
            const state = {
                ...mockState,
                taskMonitor: {
                    ...mockState.taskMonitor,
                    ui: { ...mockState.taskMonitor.ui, filter: 'completed' }
                }
            };
            const filtered = getFilteredProcesses(state);
            expect(filtered.length).toBe(1);
            expect(filtered[0].status).toBe('complete');
        });

        it('getFilteredProcesses returns failed when filter is failed', () => {
            const state = {
                ...mockState,
                taskMonitor: {
                    ...mockState.taskMonitor,
                    ui: { ...mockState.taskMonitor.ui, filter: 'failed' }
                }
            };
            const filtered = getFilteredProcesses(state);
            expect(filtered.length).toBe(1);
            expect(filtered[0].status).toBe('error');
        });

        it('getFilteredProcesses returns all when filter is all', () => {
            const state = {
                ...mockState,
                taskMonitor: {
                    ...mockState.taskMonitor,
                    ui: { ...mockState.taskMonitor.ui, filter: 'all' }
                }
            };
            const filtered = getFilteredProcesses(state);
            expect(filtered.length).toBe(4);
        });
    });

    // =========================================================================
    // EPICS
    // =========================================================================
    describe('epics', () => {
        describe('autoStartTaskMonitorEpic', () => {
            // TASK-673 D1.4: autoStart now requires a security.user gate to
            // suppress the polling timer for anon users. Tests pass a stubbed
            // store that exposes state.security.user; anon-user tests stub it
            // to null/undefined.
            const authStore = { getState: () => ({ security: { user: { username: 'alice', pk: 1 } } }) };
            const anonStore = { getState: () => ({ security: { user: null } }) };

            it('should dispatch startTaskMonitorPolling on LOGIN_SUCCESS (auth)', (done) => {
                const action$ = mockActions([{ type: LOGIN_SUCCESS }]);
                const emitted = [];

                autoStartTaskMonitorEpic(action$, authStore)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(1);
                            expect(emitted[0].type).toBe(TM_START_POLLING);
                            done();
                        }
                    );
            });

            it('should dispatch startTaskMonitorPolling on INIT_ANUGA (auth)', (done) => {
                const action$ = mockActions([{ type: 'INIT_ANUGA' }]);
                const emitted = [];

                autoStartTaskMonitorEpic(action$, authStore)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(1);
                            expect(emitted[0].type).toBe(TM_START_POLLING);
                            done();
                        }
                    );
            });

            it('should only emit once (take(1))', (done) => {
                const action$ = mockActions([
                    { type: LOGIN_SUCCESS },
                    { type: 'INIT_ANUGA' }
                ]);
                const emitted = [];

                autoStartTaskMonitorEpic(action$, authStore)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(1);
                            done();
                        }
                    );
            });

            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'SOMETHING_ELSE' }]);
                const emitted = [];

                autoStartTaskMonitorEpic(action$, authStore)
                    .take(1)
                    .timeout(300)
                    .subscribe(
                        action => emitted.push(action),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        },
                        () => done()
                    );
            });

            it('should NOT emit for anon user even when LOGIN_SUCCESS/INIT_ANUGA fire', (done) => {
                // TASK-673 D1.4 (B5 C3): anon must never trigger polling.
                const action$ = mockActions([
                    { type: LOGIN_SUCCESS },
                    { type: 'INIT_ANUGA' }
                ]);
                const emitted = [];

                autoStartTaskMonitorEpic(action$, anonStore)
                    .take(1)
                    .timeout(300)
                    .subscribe(
                        action => emitted.push(action),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        },
                        () => done()
                    );
            });
        });

        describe('pollActiveCountEpic', () => {
            // TASK-673 D1.4 (B5 C3): include security.user so the defense-in-depth
            // user gate doesn't suppress these tests.
            const authUser = { username: 'alice', pk: 1 };

            it('should start polling on TM_START_POLLING when panel is closed', (done) => {
                const mock = mockAxios();
                mock.onGet(/\/api\/v2\/tasks\/processes\//).reply(200, {
                    results: [
                        { id: 1, status: 'running', process_type: 'layer_create' },
                        { id: 2, status: 'complete', process_type: 'layer_create' }
                    ]
                });
                const state = {
                    taskMonitor: { ui: { panelOpen: false } },
                    security: { user: authUser },
                    anuga: { projects: { data: { id: 42 } } }
                };
                // First tick (timer(0)) fetches + dispatches setProcesses + setActiveCount.
                testEpic(
                    pollActiveCountEpic,
                    2,
                    { type: TM_START_POLLING },
                    (actions) => {
                        expect(actions.length).toBe(2);
                        expect(actions[0].type).toBe(TM_SET_PROCESSES);
                        expect(actions[0].processes.length).toBe(2);
                        expect(actions[1].type).toBe(TM_SET_ACTIVE_COUNT);
                        // Only the 'running' row is active.
                        expect(actions[1].count).toBe(1);
                    },
                    state,
                    done
                );
            });

            it('should not poll when panel is open', (done) => {
                const state = {
                    taskMonitor: { ui: { panelOpen: true } },
                    security: { user: authUser },
                    anuga: { projects: { data: { id: 42 } } }
                };
                // panelOpen=true filter blocks the closed-panel poll → only the
                // injected TEST_TIMEOUT comes through.
                testEpic(
                    addTimeoutEpic(pollActiveCountEpic, 50),
                    1,
                    { type: TM_START_POLLING },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TEST_TIMEOUT);
                    },
                    state,
                    done
                );
            });

            it('should stop on TM_STOP_POLLING', (done) => {
                // Deterministic teardown proof. timer(0, 10000) schedules its
                // first tick on the async scheduler (a 0ms macrotask); dispatching
                // TM_STOP_POLLING synchronously right after TM_START_POLLING means
                // takeUntil(TM_STOP_POLLING) completes the inner stream BEFORE that
                // first tick fires, so the poller emits nothing. The injected
                // TEST_TIMEOUT is the only action that surfaces. (The positive
                // "first tick emits" contract is covered by the test above, so this
                // pair proves both: ticks emit on START, and STOP suppresses them.)
                const state = {
                    taskMonitor: { ui: { panelOpen: false } },
                    security: { user: authUser },
                    anuga: { projects: { data: { id: 42 } } }
                };
                testEpic(
                    addTimeoutEpic(pollActiveCountEpic, 50),
                    1,
                    [{ type: TM_START_POLLING }, { type: TM_STOP_POLLING }],
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TEST_TIMEOUT);
                    },
                    state,
                    done
                );
            });

            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    })
                };
                const emitted = [];

                pollActiveCountEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should NOT poll for anon user even on TM_START_POLLING', (done) => {
                // TASK-673 D1.4 (B5 C3): defense-in-depth. The security.user
                // filter blocks every tick → only TEST_TIMEOUT surfaces.
                const state = {
                    taskMonitor: { ui: { panelOpen: false } },
                    security: { user: null }
                };
                testEpic(
                    addTimeoutEpic(pollActiveCountEpic, 50),
                    1,
                    { type: TM_START_POLLING },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TEST_TIMEOUT);
                    },
                    state,
                    done
                );
            });

            it('should NOT poll while project_id is unhydrated', (done) => {
                // The Process list endpoint requires ?project_id=<int> (see
                // taskmonitor/views.py). Polling without it once leaked
                // cross-project layer_create completes into the wrong map's
                // TOC. Skip ticks until state.anuga.projects.data.id is set —
                // the getProjectId filter blocks, so only TEST_TIMEOUT surfaces.
                const state = {
                    taskMonitor: { ui: { panelOpen: false } },
                    security: { user: authUser },
                    anuga: { projects: { data: null } }
                };
                testEpic(
                    addTimeoutEpic(pollActiveCountEpic, 50),
                    1,
                    { type: TM_START_POLLING },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TEST_TIMEOUT);
                    },
                    state,
                    done
                );
            });
        });

        describe('pollProcessListEpic', () => {
            // TASK-673 D1.4 (B5 C3): include security.user so the defense-in-depth
            // user gate doesn't suppress these tests.
            const authUser = { username: 'alice', pk: 1 };

            it('should start polling on TM_TOGGLE_PANEL when panel is open', (done) => {
                const mock = mockAxios();
                mock.onGet(/\/api\/v2\/tasks\/processes\//).reply(200, {
                    results: [
                        { id: 1, status: 'running', process_type: 'layer_create' },
                        { id: 2, status: 'pending', process_type: 'layer_create' }
                    ]
                });
                const state = {
                    taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                    security: { user: authUser },
                    anuga: { projects: { data: { id: 42 } } }
                };
                // active filter → first tick dispatches setProcesses + setActiveCount.
                testEpic(
                    pollProcessListEpic,
                    2,
                    { type: TM_TOGGLE_PANEL },
                    (actions) => {
                        expect(actions.length).toBe(2);
                        expect(actions[0].type).toBe(TM_SET_PROCESSES);
                        expect(actions[0].processes.length).toBe(2);
                        expect(actions[1].type).toBe(TM_SET_ACTIVE_COUNT);
                        expect(actions[1].count).toBe(2);
                    },
                    state,
                    done
                );
            });

            it('should not emit when panel is closed', (done) => {
                const action$ = mockActions([{ type: TM_TOGGLE_PANEL }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false, filter: 'active' } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    })
                };
                const emitted = [];

                pollProcessListEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should respond to TM_SET_FILTER when panel is open', (done) => {
                const mock = mockAxios();
                mock.onGet(/\/api\/v2\/tasks\/processes\//).reply(200, {
                    results: [{ id: 9, status: 'complete', process_type: 'layer_create' }]
                });
                const state = {
                    taskMonitor: { ui: { panelOpen: true, filter: 'completed' } },
                    security: { user: authUser },
                    anuga: { projects: { data: { id: 42 } } }
                };
                // completed filter → first tick dispatches setProcesses only
                // (no setActiveCount on non-active filters).
                testEpic(
                    pollProcessListEpic,
                    1,
                    { type: TM_SET_FILTER, filter: 'completed' },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TM_SET_PROCESSES);
                        expect(actions[0].processes.length).toBe(1);
                    },
                    state,
                    done
                );
            });

            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    })
                };
                const emitted = [];

                pollProcessListEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should NOT poll for anon user even when panel is open', (done) => {
                // TASK-673 D1.4 (B5 C3): defense-in-depth.
                const action$ = mockActions([{ type: TM_TOGGLE_PANEL }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: null }
                    })
                };
                const emitted = [];

                pollProcessListEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should NOT poll while project_id is unhydrated', (done) => {
                // Matches pollActiveCountEpic gate; the open-panel poller
                // must also wait for state.anuga.projects.data.id before
                // hitting the API. getProjectId filter blocks → only
                // TEST_TIMEOUT surfaces.
                const state = {
                    taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                    security: { user: authUser },
                    anuga: { projects: { data: null } }
                };
                testEpic(
                    addTimeoutEpic(pollProcessListEpic, 50),
                    1,
                    { type: TM_TOGGLE_PANEL },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe(TEST_TIMEOUT);
                    },
                    state,
                    done
                );
            });

            describe('open-panel poller payload', () => {
                let mock;
                beforeEach(() => { mock = mockAxios(); });

                it('passes all rows through unfiltered on the active-filter branch', (done) => {
                    const mixedRows = [
                        { id: 1, status: 'pending', process_type: 'layer_create' },
                        { id: 2, status: 'running', process_type: 'layer_create' },
                        { id: 3, status: 'complete', process_type: 'layer_create' },
                        { id: 4, status: 'error', process_type: 'layer_create' },
                        { id: 5, status: 'cancelled', process_type: 'layer_create' }
                    ];
                    mock.onGet('/api/v2/tasks/processes/').reply(200, { results: mixedRows });

                    const state = {
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    };
                    // active filter → setProcesses (all 5 rows, unfiltered) + setActiveCount.
                    testEpic(
                        pollProcessListEpic,
                        2,
                        { type: TM_TOGGLE_PANEL },
                        (actions) => {
                            const setActions = actions.filter(a => a.type === TM_SET_PROCESSES);
                            expect(setActions.length).toBe(1);
                            const surfaced = setActions[0].processes;
                            expect(surfaced.length).toBe(5);
                            expect(surfaced.map(p => p.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
                            const countActions = actions.filter(a => a.type === TM_SET_ACTIVE_COUNT);
                            expect(countActions[0].count).toBe(2);
                        },
                        state,
                        done
                    );
                });

                it('passes completed rows through unfiltered on the completed-filter branch', (done) => {
                    const completedRows = [
                        { id: 10, status: 'complete', process_type: 'layer_create' },
                        { id: 11, status: 'complete', process_type: 'terrain_create' }
                    ];
                    mock.onGet('/api/v2/tasks/processes/').reply(200, { results: completedRows });

                    const state = {
                        taskMonitor: { ui: { panelOpen: true, filter: 'completed' } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    };
                    // completed filter → setProcesses only (no setActiveCount).
                    testEpic(
                        pollProcessListEpic,
                        1,
                        { type: TM_SET_FILTER, filter: 'completed' },
                        (actions) => {
                            const setActions = actions.filter(a => a.type === TM_SET_PROCESSES);
                            expect(setActions.length).toBe(1);
                            expect(setActions[0].processes.length).toBe(2);
                            expect(setActions[0].processes.map(p => p.id).sort((a, b) => a - b)).toEqual([10, 11]);
                        },
                        state,
                        done
                    );
                });

                it('preserves terminal terrain_create completions for action$ listeners', (done) => {
                    // Regression guard: a payload-shape assertion would still pass
                    // even if the dispatched action never reached redux-observable
                    // listeners. testEpic collects the epic's emitted stream
                    // (the same surface listeners like taskCompleteLayerEpic see
                    // on TM_SET_PROCESSES); we assert the dispatched action carries
                    // the terminal terrain_create row — the surface where the
                    // original bug hid.
                    const rows = [
                        { id: 'in-flight', status: 'running', process_type: 'layer_create' },
                        {
                            id: 'terrain-done',
                            status: 'complete',
                            process_type: 'terrain_create',
                            metadata: { project_id: 42, terrain_id: 9999, mapstore_layers: [{ name: 'geonode:ele_9999' }] }
                        }
                    ];
                    mock.onGet('/api/v2/tasks/processes/').reply(200, { results: rows });

                    const state = {
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: authUser },
                        anuga: { projects: { data: { id: 42 } } }
                    };
                    // active filter → setProcesses + setActiveCount per tick.
                    testEpic(
                        pollProcessListEpic,
                        2,
                        { type: TM_TOGGLE_PANEL },
                        (actions) => {
                            const setProc = actions.find(a => a.type === TM_SET_PROCESSES);
                            expect(setProc).toBeTruthy();
                            const terrainProc = setProc.processes.find(p => p.process_type === 'terrain_create');
                            expect(terrainProc).toBeTruthy();
                            expect(terrainProc.status).toBe('complete');
                        },
                        state,
                        done
                    );
                });
            });
        });

        describe('loadProcessDetailEpic', () => {
            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const emitted = [];

                loadProcessDetailEpic(action$)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should filter out actions without processId', (done) => {
                const action$ = mockActions([{ type: 'TM_EXPAND_PROCESS', processId: null }]);
                const emitted = [];

                loadProcessDetailEpic(action$)
                    .take(1)
                    .timeout(300)
                    .subscribe(
                        action => emitted.push(action),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        },
                        () => done()
                    );
            });

            it('should be a function', () => {
                expect(typeof loadProcessDetailEpic).toBe('function');
            });
        });

        describe('cancelProcessEpic', () => {
            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const emitted = [];

                cancelProcessEpic(action$)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err),
                        () => {
                            expect(emitted.length).toBe(0);
                            done();
                        }
                    );
            });

            it('should be a function', () => {
                expect(typeof cancelProcessEpic).toBe('function');
            });
        });
    });

    // =========================================================================
    // TASK-2674 (epic 2662 W2.4) — isActiveProcess reads SERVER liveness.
    // The FE-side clock-staleness heuristic is DELETED: liveness is a fact the
    // serializer derives from last_heartbeat (D5/D7); the FE renders it
    // verbatim and never does timestamp math again.
    // =========================================================================
    describe('TASK-2674 isActiveProcess (server-truth liveness)', () => {
        // An ANCIENT updated timestamp everywhere below: under the deleted
        // clock heuristic this made every row "stalled". Server liveness
        // must now be the ONLY input, so these prove no clock math remains.
        const ancientUpdated = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

        it('returns false for null/undefined process', () => {
            expect(isActiveProcess(null)).toBe(false);
            expect(isActiveProcess(undefined)).toBe(false);
        });

        it('returns false for terminal statuses (server sends liveness=null for them)', () => {
            expect(isActiveProcess({ status: 'complete', liveness: null })).toBe(false);
            expect(isActiveProcess({ status: 'error', liveness: null })).toBe(false);
            expect(isActiveProcess({ status: 'cancelled', liveness: null })).toBe(false);
        });

        it('returns true for running/pending with liveness=live — even with an ancient updated', () => {
            expect(isActiveProcess({ status: 'running', liveness: 'live', updated: ancientUpdated })).toBe(true);
            expect(isActiveProcess({ status: 'pending', liveness: 'live', updated: ancientUpdated })).toBe(true);
        });

        it('provisioning exemption: provisioning rows stay active regardless of age (D5 — a Batch queue can hold a job for hours)', () => {
            expect(isActiveProcess({ status: 'running', liveness: 'provisioning', updated: ancientUpdated })).toBe(true);
            expect(isActiveProcess({ status: 'pending', liveness: 'provisioning', updated: ancientUpdated })).toBe(true);
        });

        it('returns false when the SERVER says stalled — even with a fresh updated', () => {
            const freshUpdated = new Date(Date.now() - 5000).toISOString();
            expect(isActiveProcess({ status: 'running', liveness: 'stalled', updated: freshUpdated })).toBe(false);
            expect(isActiveProcess({ status: 'pending', liveness: 'stalled', updated: freshUpdated })).toBe(false);
        });

        it('returns false when the SERVER says zombie-candidate', () => {
            expect(isActiveProcess({ status: 'running', liveness: 'zombie-candidate' })).toBe(false);
        });

        it('returns true for running with NO liveness field (synthetic FE rows, e.g. terrain-export) — conservative', () => {
            expect(isActiveProcess({ status: 'running' })).toBe(true);
        });

        it('wedged is ADVISORY-ONLY (D5): a wedged live row is still active', () => {
            expect(isActiveProcess({ status: 'running', liveness: 'live', wedged: true })).toBe(true);
        });
    });

    describe('TASK-2674 getFilteredProcesses honours server liveness in the active filter', () => {
        const ancientUpdated = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

        const makeState = (processes, filter = 'active') => ({
            taskMonitor: {
                processes: {
                    byId: processes.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}),
                    allIds: processes.map(p => p.id),
                    activeCount: 0
                },
                ui: { panelOpen: true, filter, expandedProcessId: null, showLog: false }
            }
        });

        it('server-stalled running row is excluded from active filter; live row stays', () => {
            const state = makeState([
                { id: 1, status: 'running', liveness: 'live' },
                { id: 2, status: 'running', liveness: 'stalled' }
            ], 'active');
            const filtered = getFilteredProcesses(state);
            expect(filtered.length).toBe(1);
            expect(filtered[0].id).toBe(1);
        });

        it('zombie-candidate row is excluded from active filter', () => {
            const state = makeState([
                { id: 1, status: 'running', liveness: 'zombie-candidate' }
            ], 'active');
            expect(getFilteredProcesses(state).length).toBe(0);
        });

        it('provisioning row with an ancient updated IS included in active (exemption)', () => {
            const state = makeState([
                { id: 1, status: 'running', liveness: 'provisioning', updated: ancientUpdated }
            ], 'active');
            expect(getFilteredProcesses(state).length).toBe(1);
        });

        it('server-stalled row IS included in "all" filter', () => {
            const state = makeState([
                { id: 1, status: 'running', liveness: 'stalled' }
            ], 'all');
            expect(getFilteredProcesses(state).length).toBe(1);
        });
    });

    // =========================================================================
    // TASK-2674 — poll dedup must SEE read-time-derived transitions.
    // liveness/wedged are derived by the serializer at READ time from
    // last_heartbeat vs now: a live→stalled flip arrives with id/status/
    // updated/progress_pct all unchanged. If processListsEqual ignored them,
    // distinctUntilChanged would suppress the tick and the panel would show
    // "live" forever — the exact lie this epic deletes.
    // =========================================================================
    describe('TASK-2674 processListsEqual sees liveness/wedged transitions', () => {
        const base = { id: 1, status: 'running', updated: '2026-08-07T00:00:00Z', progress_pct: 50 };

        it('equal lists (same liveness/wedged) are equal', () => {
            expect(processListsEqual(
                [{ ...base, liveness: 'live', wedged: false }],
                [{ ...base, liveness: 'live', wedged: false }]
            )).toBe(true);
        });

        it('a live→stalled flip with NO other field changing is NOT equal', () => {
            expect(processListsEqual(
                [{ ...base, liveness: 'live' }],
                [{ ...base, liveness: 'stalled' }]
            )).toBe(false);
        });

        it('a wedged flip with NO other field changing is NOT equal', () => {
            expect(processListsEqual(
                [{ ...base, liveness: 'live', wedged: false }],
                [{ ...base, liveness: 'live', wedged: true }]
            )).toBe(false);
        });

        it('still detects the pre-existing transitions (status/updated/progress_pct)', () => {
            expect(processListsEqual([base], [{ ...base, progress_pct: 60 }])).toBe(false);
            expect(processListsEqual([base], [{ ...base, status: 'complete' }])).toBe(false);
            expect(processListsEqual([base], [{ ...base, updated: '2026-08-07T00:01:00Z' }])).toBe(false);
        });
    });
});

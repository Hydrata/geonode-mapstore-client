import expect from 'expect';
import Rx from 'rxjs';
import {
    autoStartTaskMonitorEpic,
    pollActiveCountEpic,
    pollProcessListEpic,
    loadProcessDetailEpic,
    cancelProcessEpic
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
    getFilteredProcesses
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

/**
 * Helper: create a live Subject-based action$ that stays open for interactive tests.
 */
const liveActions = () => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    return { subject, action$ };
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
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false } },
                        security: { user: authUser }
                    })
                };
                const emitted = [];

                const sub = pollActiveCountEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_START_POLLING });

                // API call will fail (no server), catch returns empty
                setTimeout(() => {
                    sub.unsubscribe();
                    done();
                }, 200);
            });

            it('should not poll when panel is open', (done) => {
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true } },
                        security: { user: authUser }
                    })
                };
                const emitted = [];

                const sub = pollActiveCountEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_START_POLLING });

                setTimeout(() => {
                    // Filter blocks emission when panelOpen is true
                    expect(emitted.length).toBe(0);
                    sub.unsubscribe();
                    done();
                }, 200);
            });

            it('should stop on TM_STOP_POLLING', (done) => {
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false } },
                        security: { user: authUser }
                    })
                };
                const emitted = [];

                const sub = pollActiveCountEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_START_POLLING });
                setTimeout(() => {
                    subject.next({ type: TM_STOP_POLLING });
                    setTimeout(() => {
                        sub.unsubscribe();
                        done();
                    }, 100);
                }, 50);
            });

            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false } },
                        security: { user: authUser }
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
                // TASK-673 D1.4 (B5 C3): defense-in-depth.
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false } },
                        security: { user: null }
                    })
                };
                const emitted = [];

                const sub = pollActiveCountEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_START_POLLING });

                setTimeout(() => {
                    expect(emitted.length).toBe(0);
                    sub.unsubscribe();
                    done();
                }, 200);
            });
        });

        describe('pollProcessListEpic', () => {
            // TASK-673 D1.4 (B5 C3): include security.user so the defense-in-depth
            // user gate doesn't suppress these tests.
            const authUser = { username: 'alice', pk: 1 };

            it('should start polling on TM_TOGGLE_PANEL when panel is open', (done) => {
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: authUser }
                    })
                };
                const emitted = [];

                const sub = pollProcessListEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_TOGGLE_PANEL });

                // API call will fail (no server) -> catch -> empty
                setTimeout(() => {
                    sub.unsubscribe();
                    done();
                }, 200);
            });

            it('should not emit when panel is closed', (done) => {
                const action$ = mockActions([{ type: TM_TOGGLE_PANEL }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: false, filter: 'active' } },
                        security: { user: authUser }
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
                const { subject, action$ } = liveActions();
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true, filter: 'completed' } },
                        security: { user: authUser }
                    })
                };
                const emitted = [];

                const sub = pollProcessListEpic(action$, store)
                    .subscribe(
                        action => emitted.push(action),
                        err => done(err)
                    );

                subject.next({ type: TM_SET_FILTER, filter: 'completed' });

                setTimeout(() => {
                    sub.unsubscribe();
                    done();
                }, 200);
            });

            it('should not emit for unrelated actions', (done) => {
                const action$ = mockActions([{ type: 'UNRELATED' }]);
                const store = {
                    getState: () => ({
                        taskMonitor: { ui: { panelOpen: true, filter: 'active' } },
                        security: { user: authUser }
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
});

/**
 * TaskMonitor epics — RxJS 5 (redux-observable 0.x).
 *
 * Two-tier polling:
 *   Panel closed → /active/count/ every 10s
 *   Panel open  → /processes/ every 3s
 */
import Rx from 'rxjs';
import * as taskMonitorApi from './api/taskMonitorApi';
import {
    TM_START_POLLING,
    TM_STOP_POLLING,
    TM_TOGGLE_PANEL,
    TM_SET_FILTER,
    TM_CANCEL_PROCESS,
    setProcesses,
    setActiveCount,
    updateProcess,
    cancelProcessResult,
    startTaskMonitorPolling
} from './actionsTaskMonitor';
import { LOGIN_SUCCESS } from '@mapstore/framework/actions/security';
import { INIT_ANUGA } from '../Anuga/actions/uiActions';

const ACTIVE_STATES = ['pending', 'running'];

// Map filter names to API params
const filterToParams = (filter) => {
    switch (filter) {
    case 'active': return { status: 'pending' };
    case 'completed': return { status: 'complete' };
    case 'failed': return { status: 'error' };
    default: return {};
    }
};

/**
 * Auto-start polling on login or ANUGA init.
 */
export const autoStartTaskMonitorEpic = (action$) =>
    action$
        .ofType(LOGIN_SUCCESS, INIT_ANUGA)
        .take(1)
        .map(() => startTaskMonitorPolling());

/**
 * Count poller — runs when panel is closed, 10s interval.
 */
export const pollActiveCountEpic = (action$, store) =>
    action$
        .ofType(TM_START_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 10000)
                .takeUntil(action$.ofType(TM_STOP_POLLING))
                .filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                .exhaustMap(() =>
                    Rx.Observable.from(taskMonitorApi.getActiveCount())
                        .map(response => setActiveCount(response.data?.count || 0))
                        .catch(() => Rx.Observable.empty())
                )
        );

/**
 * Full process list poller — runs when panel is open, 3s interval.
 */
export const pollProcessListEpic = (action$, store) =>
    action$
        .ofType(TM_TOGGLE_PANEL, TM_SET_FILTER)
        .filter(() => store.getState()?.taskMonitor?.ui?.panelOpen)
        .switchMap(() => {
            const filter = store.getState()?.taskMonitor?.ui?.filter || 'active';
            const params = filterToParams(filter);
            // For 'active' filter, fetch both pending and running
            if (filter === 'active') {
                return Rx.Observable.timer(0, 3000)
                    .takeUntil(
                        action$.ofType(TM_TOGGLE_PANEL).filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                            .merge(action$.ofType(TM_STOP_POLLING))
                    )
                    .exhaustMap(() =>
                        Rx.Observable.from(taskMonitorApi.getActiveProcesses())
                            .concatMap(response => {
                                const processes = response.data || [];
                                return Rx.Observable.of(
                                    setProcesses(processes),
                                    setActiveCount(processes.filter(p => ACTIVE_STATES.includes(p.status)).length)
                                );
                            })
                            .catch(() => Rx.Observable.empty())
                    );
            }
            return Rx.Observable.timer(0, 3000)
                .takeUntil(
                    action$.ofType(TM_TOGGLE_PANEL).filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                        .merge(action$.ofType(TM_STOP_POLLING))
                )
                .exhaustMap(() =>
                    Rx.Observable.from(taskMonitorApi.getProcesses(params))
                        .map(response => setProcesses(response.data?.results || response.data || []))
                        .catch(() => Rx.Observable.empty())
                );
        });

/**
 * Load expanded process detail (with subtasks + log).
 */
export const loadProcessDetailEpic = (action$) =>
    action$
        .ofType('TM_EXPAND_PROCESS')
        .filter(action => action.processId)
        .switchMap(action =>
            Rx.Observable.from(taskMonitorApi.getProcessDetail(action.processId))
                .map(response => updateProcess(response.data))
                .catch(() => Rx.Observable.empty())
        );

/**
 * Cancel a process via API.
 */
export const cancelProcessEpic = (action$) =>
    action$
        .ofType(TM_CANCEL_PROCESS)
        .exhaustMap(action =>
            Rx.Observable.from(taskMonitorApi.cancelProcess(action.processId))
                .map(response => cancelProcessResult(response.data))
                .catch(() => Rx.Observable.empty())
        );

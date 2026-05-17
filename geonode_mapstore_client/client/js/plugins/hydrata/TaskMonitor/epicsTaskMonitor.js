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
import { LOGIN_SUCCESS, SESSION_VALID } from '@mapstore/framework/actions/security';
import { INIT_ANUGA } from '../Anuga/actions/uiActions';
import { getProjectId } from '../Anuga/selectorsAnuga';

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
 *
 * TASK-673 D1.4 (B5 C3): for anon users, polling produces dead 401s on
 * /api/v2/tasks/processes/ which contend for HTTP/2 stream slots during the
 * cold critical path (B1 #6, B2 H3, 2026-05-05). Gate on state.security.user
 * so the timer never starts for anon. We listen to SESSION_VALID and
 * LOGIN_SUCCESS in addition to INIT_ANUGA: SESSION_VALID is the action that
 * fires after the on-page-load auth check completes for an already-signed-in
 * session; without it, INIT_ANUGA can fire before security state is hydrated
 * for refresh of an authed page. Ordering check is via state.security.user
 * present in the filter — the first action that finds a user wins (.take(1)).
 */
export const autoStartTaskMonitorEpic = (action$, store) =>
    action$
        .ofType(LOGIN_SUCCESS, SESSION_VALID, INIT_ANUGA)
        .filter(() => !!store.getState()?.security?.user)
        .take(1)
        .map(() => startTaskMonitorPolling());

/**
 * Closed-panel poller — 10s interval. Fetches the recent process list (not
 * just the count) so taskCompleteLayerEpic can react to async layer-creation
 * completions even when the panel is closed.
 *
 * Gating rules — skip the tick unless ALL hold:
 *   1. Panel is closed (this is the closed-panel poller).
 *   2. Security user is hydrated (defense-in-depth vs. anon 401 noise; see
 *      TASK-673 D1.4 B5 C3).
 *   3. `getProjectId(state)` returns a non-null id. The Process list endpoint
 *      now requires `?project_id=<int>` and 400s without it. Polling without
 *      a project id once leaked cross-project layer_create completions into
 *      the new map's TOC via taskCompleteLayerEpic — fixed at the API
 *      boundary, gated here so the FE never makes the bad request to begin
 *      with. The polling auto-starts on INIT_ANUGA but the v2 project GET
 *      fan-out can still be in-flight; we wait it out instead of falling
 *      back to a scopeless request.
 */
export const pollActiveCountEpic = (action$, store) =>
    action$
        .ofType(TM_START_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 10000)
                .takeUntil(action$.ofType(TM_STOP_POLLING))
                .filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                .filter(() => !!store.getState()?.security?.user)
                .filter(() => !!getProjectId(store.getState()))
                .exhaustMap(() => {
                    const projectId = getProjectId(store.getState());
                    return Rx.Observable.from(
                        taskMonitorApi.getProcesses({ project_id: projectId, limit: 10 })
                    )
                        .concatMap(response => {
                            const processes = response.data?.results || response.data || [];
                            const activeCount = processes.filter(p => ACTIVE_STATES.includes(p.status)).length;
                            return Rx.Observable.of(
                                setProcesses(processes),
                                setActiveCount(activeCount)
                            );
                        })
                        .catch(() => Rx.Observable.empty());
                })
        );

/**
 * Full process list poller — runs when panel is open, 3s interval.
 *
 * Same project_id gating as the closed-panel poller: skip ticks until
 * `getProjectId(state)` is non-null, since the API rejects unscoped lists.
 */
export const pollProcessListEpic = (action$, store) =>
    action$
        .ofType(TM_TOGGLE_PANEL, TM_SET_FILTER)
        .filter(() => store.getState()?.taskMonitor?.ui?.panelOpen)
        .filter(() => !!store.getState()?.security?.user)
        .switchMap(() => {
            const filter = store.getState()?.taskMonitor?.ui?.filter || 'active';
            const params = filterToParams(filter);
            // For 'active' filter, fetch the recent process list (not just
            // currently-active) so taskCompleteLayerEpic can see completion
            // transitions. UI filters by status for display.
            if (filter === 'active') {
                return Rx.Observable.timer(0, 3000)
                    .takeUntil(
                        action$.ofType(TM_TOGGLE_PANEL).filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                            .merge(action$.ofType(TM_STOP_POLLING))
                    )
                    .filter(() => !!getProjectId(store.getState()))
                    .exhaustMap(() => {
                        const projectId = getProjectId(store.getState());
                        return Rx.Observable.from(
                            taskMonitorApi.getProcesses({ project_id: projectId, limit: 10 })
                        )
                            .concatMap(response => {
                                const processes = response.data?.results || response.data || [];
                                return Rx.Observable.of(
                                    setProcesses(processes),
                                    setActiveCount(processes.filter(p => ACTIVE_STATES.includes(p.status)).length)
                                );
                            })
                            .catch(() => Rx.Observable.empty());
                    });
            }
            return Rx.Observable.timer(0, 3000)
                .takeUntil(
                    action$.ofType(TM_TOGGLE_PANEL).filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                        .merge(action$.ofType(TM_STOP_POLLING))
                )
                .filter(() => !!getProjectId(store.getState()))
                .exhaustMap(() => {
                    const projectId = getProjectId(store.getState());
                    return Rx.Observable.from(
                        taskMonitorApi.getProcesses({ ...params, project_id: projectId })
                    )
                        .map(response => setProcesses(response.data?.results || response.data || []))
                        .catch(() => Rx.Observable.empty());
                });
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

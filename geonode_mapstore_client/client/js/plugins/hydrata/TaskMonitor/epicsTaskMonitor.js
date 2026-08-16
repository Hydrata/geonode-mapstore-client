/**
 * TaskMonitor epics — RxJS 5 (redux-observable 0.x).
 *
 * Two-tier polling:
 *   Panel closed → /active/count/ every 10s
 *   Panel open  → /processes/ every 3s
 */
import Rx from 'rxjs';
import * as taskMonitorApi from './api/taskMonitorApi';
import {trackEvent} from '@js/utils/analytics';
import {
    TM_START_POLLING,
    TM_STOP_POLLING,
    TM_TOGGLE_PANEL,
    TM_SET_FILTER,
    TM_SET_PROCESSES,
    TM_CANCEL_PROCESS,
    TM_TERRAIN_EXPORT,
    setProcesses,
    setActiveCount,
    updateProcess,
    cancelProcessResult,
    startTaskMonitorPolling,
    toggleTaskMonitorPanel
} from './actionsTaskMonitor';
import { LOGIN_SUCCESS, SESSION_VALID } from '@mapstore/framework/actions/security';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { INIT_ANUGA } from '../Anuga/actions/uiActions';
import { getProjectId } from '../Anuga/selectorsAnuga';
import { getTerrainDownloadUrl } from '../Anuga/api/anugaApi';
// isActiveProcess: the epic's setActiveCount uses the SAME predicate as
// getFilteredProcesses (no duplicated status-list literal). TASK-2674: the
// predicate reads SERVER liveness (FE staleness heuristic deleted).
import { isActiveProcess } from './selectorsTaskMonitor';

const filterToParams = (filter) => {
    switch (filter) {
    case 'completed': return { status: 'complete' };
    case 'failed': return { status: 'error' };
    default: return {};
    }
};

// Suppress no-op ticks: if a poll returns a byte-equivalent process list the
// dispatch chain (reducer rebuild + every TM_SET_PROCESSES listener including
// taskCompleteLayerEpic's orphan-classification + localStorage walk) re-runs
// for nothing. id+status+updated+progress_pct covers every WRITTEN transition
// any downstream consumer reacts to (every server-side fold bumps `updated`,
// so phase/eta_seconds changes always ride an `updated` change).
//
// TASK-2674: liveness + wedged must be compared EXPLICITLY — the serializer
// derives them at READ time from last_heartbeat vs now, so a live→stalled
// (or wedged) flip can arrive with every written field unchanged. Without
// these two terms distinctUntilChanged would suppress that tick and the
// panel would show "live" forever. Exported for tests.
export const processListsEqual = (a, b) =>
    a === b || (
        Array.isArray(a) && Array.isArray(b) &&
        a.length === b.length &&
        a.every((p, i) => {
            const q = b[i];
            return p?.id === q?.id
                && p?.status === q?.status
                && p?.updated === q?.updated
                && p?.progress_pct === q?.progress_pct
                && p?.liveness === q?.liveness
                && p?.wedged === q?.wedged;
        })
    );

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
                        .map(response => response.data?.results || response.data || [])
                        .catch(() => Rx.Observable.empty());
                })
                .distinctUntilChanged(processListsEqual)
                .concatMap(processes => {
                    // TASK-2674: isActiveProcess (same predicate as
                    // getFilteredProcesses — badge dot and active list always
                    // agree) now reads SERVER liveness; no clock argument.
                    return Rx.Observable.of(
                        setProcesses(processes),
                        setActiveCount(processes.filter(p => isActiveProcess(p)).length)
                    );
                })
        );

/**
 * Open-panel poller — 3s interval, gated on panelOpen + security.user +
 * getProjectId. The 'active' filter fetches `limit:10` (newest regardless of
 * status) so taskCompleteLayerEpic can observe completion transitions; the
 * panel filters terminal rows for display via `getFilteredProcesses`. Other
 * filters delegate to the BE via `filterToParams` and fetch the full project
 * history. Action payload is the raw list — `taskCompleteLayerEpic` listens on
 * TM_SET_PROCESSES to inject map layers on completion, so stripping terminals
 * here would leave new uploads invisible on the map.
 */
export const pollProcessListEpic = (action$, store) =>
    action$
        .ofType(TM_TOGGLE_PANEL, TM_SET_FILTER)
        .filter(() => store.getState()?.taskMonitor?.ui?.panelOpen)
        .filter(() => !!store.getState()?.security?.user)
        .switchMap(() =>
            Rx.Observable.timer(0, 3000)
                .takeUntil(
                    action$.ofType(TM_TOGGLE_PANEL).filter(() => !store.getState()?.taskMonitor?.ui?.panelOpen)
                        .merge(action$.ofType(TM_STOP_POLLING))
                )
                .filter(() => !!getProjectId(store.getState()))
                .exhaustMap(() => {
                    const state = store.getState();
                    const projectId = getProjectId(state);
                    const filter = state?.taskMonitor?.ui?.filter || 'active';
                    const params = filter === 'active'
                        ? { project_id: projectId, limit: 10 }
                        : { ...filterToParams(filter), project_id: projectId };
                    return Rx.Observable.from(taskMonitorApi.getProcesses(params))
                        .map(response => response.data?.results || response.data || [])
                        .catch(() => Rx.Observable.empty());
                })
                .distinctUntilChanged(processListsEqual)
                .concatMap(processes => {
                    const filter = store.getState()?.taskMonitor?.ui?.filter || 'active';
                    const emissions = [setProcesses(processes)];
                    if (filter === 'active') {
                        // TASK-2674: isActiveProcess (same predicate as
                        // getFilteredProcesses) reads SERVER liveness.
                        emissions.push(setActiveCount(
                            processes.filter(p => isActiveProcess(p)).length
                        ));
                    }
                    return Rx.Observable.of(...emissions);
                })
        );

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
 *
 * TASK-2761 (epic 2706 W8): a rejected cancelProcess() (403/404/409/500, or a
 * network drop) must not vanish silently — the bare `.catch(() =>
 * Rx.Observable.empty())` this replaces dropped every failure with no toast,
 * no log and no state write, indistinguishable from a slow response. There is
 * no in-flight/"cancelling" panel state anywhere in this plugin today, so
 * surfacing the notification is sufficient to leave the panel consistent —
 * there is nothing else to unstick.
 */
export const cancelProcessEpic = (action$) =>
    action$
        .ofType(TM_CANCEL_PROCESS)
        .exhaustMap(action =>
            Rx.Observable.from(taskMonitorApi.cancelProcess(action.processId))
                .map(response => cancelProcessResult(response.data))
                .catch((e) => {
                    // TASK-2814 — the backend returns 409 SPECIFICALLY for the
                    // benign "already terminal" case (TASK-2763: a
                    // reaper/cancel settled the row first); nothing failed,
                    // there was just nothing left to cancel. Red-toasting it
                    // reads as an error in a healthy flow. Every other
                    // rejection (403/404/500, network drop) still surfaces.
                    // MapStore's ajax interceptor rejects with the FLATTENED
                    // response ({...error.response, originalError}), so the
                    // status is at e.status; the e.response fallback covers a
                    // raw axios error that bypassed the interceptor.
                    const status = e && (e.status || (e.response && e.response.status));
                    if (status === 409) {
                        return Rx.Observable.empty();
                    }
                    return Rx.Observable.of(show({
                        message: 'hydrata.taskMonitor.cancelError'
                    }, 'error'));
                })
        );

/**
 * TASK-1651 (W1.5): Terrain export via Tasks Panel.
 *
 * On TM_TERRAIN_EXPORT:
 *   1. Inject a synthetic "running" process into the Tasks Panel state.
 *   2. Open the Tasks Panel so the user sees progress immediately.
 *   3. Fetch the presigned S3 URL from the BE (/terrain/{id}/download/).
 *   4a. On success: update the synthetic process to "complete" with download_url
 *       in metadata, then attempt a browser auto-download (which may be blocked
 *       by the browser if not gesture-initiated — the panel affordance is the
 *       contract).
 *   4b. On error: update the synthetic process to "error" with error_message.
 *
 * The synthetic process id is `terrain-export-<terrainId>` — no Celery task is
 * created. The processReducer's TM_UPDATE_PROCESS handler inserts it into
 * byId/allIds so ProcessRow renders it normally alongside real BE tasks.
 */
export const terrainExportEpic = (action$) =>
    action$
        .ofType(TM_TERRAIN_EXPORT)
        .mergeMap(action => {
            const { projectId, terrainId, title } = action;
            const syntheticId = `terrain-export-${terrainId}`;
            const name = title ? `Export: ${title}` : 'Terrain Export';

            const pendingProcess = {
                id: syntheticId,
                name,
                process_type: 'terrain_export',
                status: 'running',
                status_detail: 'Preparing download…',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                subtasks: [],
                log: ''
            };

            return Rx.Observable.concat(
                // Step 1: inject synthetic running process + open panel.
                Rx.Observable.of(updateProcess(pendingProcess)),
                Rx.Observable.of(toggleTaskMonitorPanel(true)),
                // Step 2: fetch presigned URL.
                Rx.Observable.from(getTerrainDownloadUrl(projectId, terrainId))
                    .mergeMap(resp => {
                        const { url, filename } = resp.data;
                        const completeProcess = {
                            ...pendingProcess,
                            status: 'complete',
                            status_detail: null,
                            updated: new Date().toISOString(),
                            metadata: { download_url: url, filename }
                        };
                        // Attempt browser auto-download. Browsers may block this
                        // if initiated outside a user-gesture context; the
                        // "Ready – Download" button in ProcessDetail is the
                        // guaranteed affordance.
                        try {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename || 'terrain.tif';
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        } catch (_) {
                            // Browser blocked the auto-download — user will use
                            // the Download button in the Tasks Panel.
                        }
                        return Rx.Observable.of(updateProcess(completeProcess));
                    })
                    .catch(err => {
                        const detail = err?.response?.data?.detail
                            || err?.message
                            || 'Failed to prepare download';
                        const errorProcess = {
                            ...pendingProcess,
                            status: 'error',
                            status_detail: null,
                            error_message: String(detail),
                            updated: new Date().toISOString()
                        };
                        return Rx.Observable.of(updateProcess(errorProcess));
                    })
            );
        });

/**
 * TASK-2140 (b) — OUTCOME event: Tasks Panel open/close. Every TM_TOGGLE_PANEL
 * dispatch is a real occurrence (a user click on the button/close-X OR an
 * upload/build/export flow auto-opening the panel so progress is visible) —
 * no dedup needed, each toggle fires once. Side-effect only; emits no Redux
 * actions (v1 contract, matches vectorDrawAnugaCompleteEpic's shape).
 */
export const trackTaskMonitorPanelToggleEpic = (action$, store) =>
    action$
        .ofType(TM_TOGGLE_PANEL)
        .mergeMap((action) => {
            // Every live call site passes an explicit boolean, but the reducer
            // also supports a bare toggle (action.open===undefined flips the
            // CURRENT state) — mirror that fallback here via post-reduce store
            // state rather than assuming a shape no caller currently uses.
            const isOpen = action.open !== undefined
                ? action.open
                : !!store?.getState?.()?.taskMonitor?.ui?.panelOpen;
            trackEvent('button', isOpen ? 'open' : 'close', 'taskmonitor-panel-toggle');
            return Rx.Observable.empty();
        });

// TASK-2140 (b) — terminal-status-seen dedup. Both pollers (closed-panel 10s /
// open-panel 3s) re-fetch and re-dispatch TM_SET_PROCESSES with the SAME
// process ids on every tick while a completed/errored/cancelled process is
// still within the fetched window — an undeduped tracker would fire once per
// poll tick, not once per occurrence. In-memory Set, session-scoped (matches
// the established permsEpics.js __resetPermsCacheForTests pattern for test
// isolation — no localStorage persistence needed; this is a session metric,
// not a replay-safety concern like taskCompleteLayerEpic's handled-ids registry).
const TASKMONITOR_TERMINAL_STATES = ['complete', 'error', 'cancelled'];
let _seenTerminalProcessIds = new Set();

export const trackTerminalStatusSeenEpic = (action$) =>
    action$
        .ofType(TM_SET_PROCESSES)
        .mergeMap((action) => {
            (action.processes || []).forEach((p) => {
                if (p && p.id !== undefined && p.id !== null &&
                    TASKMONITOR_TERMINAL_STATES.includes(p.status) &&
                    !_seenTerminalProcessIds.has(p.id)) {
                    _seenTerminalProcessIds.add(p.id);
                    // Status is the bounded 3-value set above — folding it
                    // into the label stays low-cardinality (process_type is
                    // NOT included: the backend vocabulary isn't closed/known
                    // FE-side, so it stays out of the label to avoid an
                    // uncontrolled cardinality surface).
                    trackEvent('process', p.status, `taskmonitor-process-terminal-${p.status}`);
                }
            });
            return Rx.Observable.empty();
        });

// Test seam: clear the in-memory dedup set between test cases so one test's
// process ids don't suppress another's assertions (module-level state is
// shared across the whole karma bundle).
export const __resetTerminalSeenForTests = () => { _seenTerminalProcessIds = new Set(); };

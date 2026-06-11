/**
 * TASK-1600 (W1) — TerrainWorkbench epics.
 *
 * All epics exported here MUST also appear in the createPlugin epics object
 * in TerrainWorkbench.js — per memory/mapstore-epic-never-registered-in-barrel.md.
 *
 * Epics:
 *   twLoadDataEpic          — fetch terrains + surfaces on TW_LOAD_DATA
 *   twCreateSurfaceEpic     — POST new surface
 *   twUpdateSurfaceEpic     — PATCH surface params
 *   twDeleteSurfaceEpic     — DELETE surface
 *   twSetDesignInputsEpic   — POST /design-inputs/
 *   twDeriveEpic            — POST /derive/ → store process_id
 *   twDeriveCompleteEpic    — watch TaskMonitor, on complete re-fetch surface + addLayer
 */
import Rx from 'rxjs';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { getProjectId } from '../Anuga/selectorsAnuga';
// TASK-1649 (W1.5): open Tasks Panel when derive starts.
import { toggleTaskMonitorPanel } from '../TaskMonitor/actionsTaskMonitor';
import {
    TW_LOAD_DATA,
    TW_CREATE_SURFACE,
    TW_UPDATE_SURFACE,
    TW_DELETE_SURFACE,
    TW_SET_DESIGN_INPUTS,
    TW_DERIVE,
    TW_DERIVE_SUCCESS,
    twLoadDataSuccess,
    twLoadDataError,
    twCreateSurfaceSuccess,
    twCreateSurfaceError,
    twUpdateSurfaceSuccess,
    twUpdateSurfaceError,
    twDeleteSurfaceSuccess,
    twDeleteSurfaceError,
    twSetDesignInputsSuccess,
    twSetDesignInputsError,
    twDeriveSuccess,
    twDeriveError,
    twDeriveComplete,
    twDeriveCompleteError,
} from './actionsTerrainWorkbench';
import {
    listTerrains,
    listAnalysisSurfaces,
    createAnalysisSurface,
    patchAnalysisSurface,
    deleteAnalysisSurface,
    setDesignInputs,
    deriveAnalysisSurface,
    getAnalysisSurface,
} from './api/terrainWorkbenchApi';

// Maximum 2s-tick polling attempts for a derive (5-min cap, matches IDF derive).
const TW_DERIVE_POLL_MAX = 150;
export const TW_DERIVE_TIMEOUT_MESSAGE =
    'Derive timed out — check the task monitor for status.';

// ── Load ───────────────────────────────────────────────────────────────────

export const twLoadDataEpic = (action$, store) =>
    action$
        .ofType(TW_LOAD_DATA)
        .switchMap(() => {
            const projectId = getProjectId(store.getState());
            if (!projectId) {
                return Rx.Observable.of(twLoadDataError('No project loaded'));
            }
            return Rx.Observable
                .forkJoin(
                    Rx.Observable.from(listTerrains(projectId)),
                    Rx.Observable.from(listAnalysisSurfaces(projectId))
                )
                .map(([terrainResp, surfaceResp]) =>
                    twLoadDataSuccess(
                        terrainResp?.data?.results || terrainResp?.data || [],
                        surfaceResp?.data?.results || surfaceResp?.data || []
                    )
                )
                .catch(err =>
                    Rx.Observable.of(twLoadDataError(err?.message || 'Load failed'))
                );
        });

// ── Create surface ─────────────────────────────────────────────────────────

export const twCreateSurfaceEpic = (action$, store) =>
    action$
        .ofType(TW_CREATE_SURFACE)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            return Rx.Observable
                .from(createAnalysisSurface(projectId, action.payload))
                .map(resp => twCreateSurfaceSuccess(resp.data))
                .catch(err => {
                    const detail = err?.response?.data?.detail
                        || err?.response?.data?.error
                        || err?.message
                        || 'Create failed';
                    return Rx.Observable.of(twCreateSurfaceError(String(detail)));
                });
        });

// ── Update surface ─────────────────────────────────────────────────────────

export const twUpdateSurfaceEpic = (action$, store) =>
    action$
        .ofType(TW_UPDATE_SURFACE)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            return Rx.Observable
                .from(patchAnalysisSurface(projectId, action.surfaceId, action.payload))
                .map(resp => twUpdateSurfaceSuccess(resp.data))
                .catch(err => {
                    const detail = err?.response?.data?.detail
                        || err?.message
                        || 'Update failed';
                    return Rx.Observable.of(twUpdateSurfaceError(String(detail)));
                });
        });

// ── Delete surface ─────────────────────────────────────────────────────────

export const twDeleteSurfaceEpic = (action$, store) =>
    action$
        .ofType(TW_DELETE_SURFACE)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            return Rx.Observable
                .from(deleteAnalysisSurface(projectId, action.surfaceId))
                .map(() => twDeleteSurfaceSuccess(action.surfaceId))
                .catch(err =>
                    Rx.Observable.of(twDeleteSurfaceError(err?.message || 'Delete failed'))
                );
        });

// ── Design inputs ──────────────────────────────────────────────────────────

export const twSetDesignInputsEpic = (action$, store) =>
    action$
        .ofType(TW_SET_DESIGN_INPUTS)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            return Rx.Observable
                .from(setDesignInputs(projectId, action.surfaceId, action.designInputs))
                .map(resp => twSetDesignInputsSuccess(resp.data))
                .catch(err => {
                    const detail = err?.response?.data?.detail
                        || err?.message
                        || 'Save inputs failed';
                    return Rx.Observable.of(twSetDesignInputsError(String(detail)));
                });
        });

// ── Derive ─────────────────────────────────────────────────────────────────

export const twDeriveEpic = (action$, store) =>
    action$
        .ofType(TW_DERIVE)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            return Rx.Observable
                .from(deriveAnalysisSurface(projectId, action.surfaceId))
                .switchMap(resp => Rx.Observable.from([
                    // TASK-1649: open Tasks Panel so derive progress is visible.
                    toggleTaskMonitorPanel(true),
                    twDeriveSuccess(action.surfaceId, resp?.data?.process_id),
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail
                        || err?.response?.data?.error
                        || err?.message
                        || 'Derive failed';
                    return Rx.Observable.of(twDeriveError(String(detail)));
                });
        });

// ── Derive-complete watcher ────────────────────────────────────────────────
//
// After TW_DERIVE_SUCCESS carries a process_id, poll redux state.taskMonitor
// every 2s (same pattern as idfDeriveCompleteEpic in Hydrology).
// On complete: re-fetch the surface, add the hillshade layer to the map.
// On error/cancelled: surface derive error.

export const twDeriveCompleteEpic = (action$, store) =>
    action$
        .ofType(TW_DERIVE_SUCCESS)
        .filter(action => !!action.processId)
        .switchMap(action => {
            const targetPid = action.processId;
            const surfaceId = action.surfaceId;
            const done = { v: false };
            return Rx.Observable.timer(0, 2000)
                .take(TW_DERIVE_POLL_MAX)
                .takeWhile(() => !done.v)
                // Cancel if another derive kicks off for the same surface.
                .takeUntil(action$.ofType(TW_DERIVE))
                .mergeMap((tick) => {
                    const state = store.getState();
                    const proc = state?.taskMonitor?.processes?.byId?.[targetPid];
                    if (!proc) {
                        if (tick === TW_DERIVE_POLL_MAX - 1) {
                            done.v = true;
                            return Rx.Observable.of(twDeriveError(TW_DERIVE_TIMEOUT_MESSAGE));
                        }
                        return Rx.Observable.empty();
                    }
                    if (proc.status === 'complete') {
                        done.v = true;
                        const projectId = getProjectId(state);
                        if (!projectId || !surfaceId) {
                            return Rx.Observable.of(
                                twDeriveCompleteError('Derive completed but surface id missing')
                            );
                        }
                        // Re-fetch the surface to get updated output_terrain,
                        // provenance_hash, enforcement_log, and is_stale=false.
                        // Note: the hillshade layer is added to the map
                        // automatically by pollingEpics.buildTerrainAddSequence
                        // when create_terrain_gn_layer completes — we don't
                        // need to add it here.
                        return Rx.Observable
                            .from(getAnalysisSurface(projectId, surfaceId))
                            .mergeMap(resp => {
                                const surface = resp.data;
                                const actions = [
                                    twDeriveComplete(surface),
                                    show({
                                        message: 'Terrain assembled — preview layers loading',
                                        title: 'Terrain Workbench',
                                        uid: 'tw-derive-done',
                                        position: 'tc',
                                        autoDismiss: 5,
                                    }),
                                ];
                                return Rx.Observable.from(actions);
                            })
                            .catch(err =>
                                Rx.Observable.of(
                                    twDeriveCompleteError(err?.message || 'Failed to fetch updated surface')
                                )
                            );
                    }
                    if (proc.status === 'error' || proc.status === 'cancelled') {
                        done.v = true;
                        const msg = proc?.metadata?.error_message
                            || proc?.error_message
                            || (proc.status === 'cancelled' ? 'Derive cancelled' : 'Derive failed');
                        return Rx.Observable.of(twDeriveError(String(msg)));
                    }
                    if (tick === TW_DERIVE_POLL_MAX - 1) {
                        done.v = true;
                        return Rx.Observable.of(twDeriveError(TW_DERIVE_TIMEOUT_MESSAGE));
                    }
                    return Rx.Observable.empty();
                });
        });

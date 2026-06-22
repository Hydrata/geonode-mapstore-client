/**
 * TASK-1600 (W1) — TerrainWorkbench epics.
 * TASK-1671 (W1.6) — Atomic save-on-derive: body carries inputs + params.
 *
 * All epics exported here MUST also appear in the createPlugin epics object
 * in Anuga.js (since W1.5 — the standalone TerrainWorkbench.js barrel was
 * removed) — per memory/mapstore-epic-never-registered-in-barrel.md.
 *
 * Epics:
 *   twLoadDataEpic          — fetch terrains + surfaces on TW_LOAD_DATA
 *   twCreateSurfaceEpic     — POST new surface
 *   twUpdateSurfaceEpic     — PATCH surface params
 *   twDeleteSurfaceEpic     — DELETE surface
 *   twSetDesignInputsEpic   — kept for backward compat (no longer dispatched by UI)
 *   twDeriveEpic            — POST /derive/ with atomic body → store process_id
 *   twDeriveCompleteEpic    — watch TaskMonitor, on complete re-fetch surface + addLayer
 */
import Rx from 'rxjs';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { getProjectId } from '../Anuga/selectorsAnuga';
// TASK-1649 (W1.5): open Tasks Panel when derive starts.
import { toggleTaskMonitorPanel } from '../TaskMonitor/actionsTaskMonitor';
// TASK-1804: analytics instrumentation for terrain merge/conform lifecycle.
import { trackEvent } from '@js/utils/analytics';
import {
    TW_LOAD_DATA,
    TW_SELECT_SURFACE_FOR_TERRAIN,
    TW_CREATE_SURFACE,
    TW_UPDATE_SURFACE,
    TW_DELETE_SURFACE,
    TW_SET_DESIGN_INPUTS,
    TW_DERIVE,
    TW_DERIVE_SUCCESS,
    twLoadData,
    twLoadDataSuccess,
    twLoadDataError,
    twSelectSurface,
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
    twDeriveCompleteError
} from './actionsTerrainWorkbench';
import {
    listTerrains,
    listAnalysisSurfaces,
    createAnalysisSurface,
    patchAnalysisSurface,
    deleteAnalysisSurface,
    setInputs,
    deriveAnalysisSurface,
    getAnalysisSurface
} from './api/terrainWorkbenchApi';
// TASK-1800 (W1.9 UAT r2): TW_PARAM_DEFAULTS seed the lazily-created combined surface.
import { TW_PARAM_DEFAULTS } from './components/recipeBuilderComponents';

// Poll redux taskMonitor state on a 2s tick until the derive reaches a terminal
// status. Cap matches the backend derive time_limit (7200s) so the FE never
// declares a "timeout" before the backend itself would — a real multi-DEM merge
// legitimately runs many minutes. The old 150-tick / 5-min cap tripped a FALSE
// "Derive timed out" on a perfectly healthy 311s derive (W1.9 UAT). Reading
// redux is cheap (no API call per tick), so a generous cap costs nothing.
const TW_DERIVE_POLL_MAX = 3600;
export const TW_DERIVE_TIMEOUT_MESSAGE =
    'Check the task monitor.';

// TASK-1658: extract a human-readable message from a Hydrata/DRF error response.
// The BE returns {success:false, errors:[...], code} for validation failures, so
// reading only detail/error/message collapses a 400 to the generic fallback (the
// silent-failure UAT finding 12). errors entries may be plain strings OR objects
// ({message}/{detail}/{field,error}). Falls back to detail -> error -> message ->
// the caller's default.
export const extractTwError = (err, fallback) => {
    const data = err?.response?.data;
    const errors = data?.errors;
    if (Array.isArray(errors) && errors.length) {
        const parts = errors
            .map(e => {
                if (typeof e === 'string') {
                    return e;
                }
                if (e && typeof e === 'object') {
                    return e.message
                        || e.detail
                        || (e.field ? `${e.field}: ${e.error || e.message || ''}`.trim() : null);
                }
                return null;
            })
            .filter(Boolean);
        if (parts.length) {
            return parts.join('; ');
        }
    }
    return String(data?.detail || data?.error || err?.message || fallback);
};

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

// ── Select source recipe of a derived terrain (TASK-1753, W1.8) ─────────────
//
// When the modeller selects a DERIVED Terrain row (one produced by an
// analysis-surface recipe), populate the recipe builder with its source
// AnalysisSurface so they can inspect / edit / re-derive instead of starting
// from an empty recipe.
//
// Resolution order:
//   1. Already-loaded state — find a surface whose output_terrain === terrainId.
//      (After the section has been opened once, twSurfaces is populated.)
//   2. Otherwise hit the BE filter ?output_terrain=<id> (a OneToOneField, so at
//      most one match) and merge the result via twLoadData semantics.
//
// The matched surface must be present in state.terrainWorkbench.surfaces for the
// builder to render it, so when we resolve via the BE we also dispatch
// twLoadData() to refresh the list before selecting. A terrain with NO source
// recipe (a plain upload) is a no-op — nothing to populate.

export const twSelectSurfaceForTerrainEpic = (action$, store) =>
    action$
        .ofType(TW_SELECT_SURFACE_FOR_TERRAIN)
        .switchMap(action => {
            const terrainId = action.terrainId;
            if (terrainId === undefined || terrainId === null) {
                return Rx.Observable.empty();
            }
            const state = store.getState();
            const surfaces = state?.terrainWorkbench?.surfaces || [];
            // Compare as strings so a numeric terrain id matches a string id from
            // the map layer name without loose-equality lint noise.
            const sameTerrain = (a, b) =>
                a !== undefined && a !== null && String(a) === String(b);
            const loaded = surfaces.find(s => sameTerrain(s.output_terrain, terrainId));
            if (loaded) {
                return Rx.Observable.of(twSelectSurface(loaded.id));
            }
            const projectId = getProjectId(state);
            if (!projectId) {
                return Rx.Observable.empty();
            }
            return Rx.Observable
                .from(listAnalysisSurfaces(projectId, { output_terrain: terrainId }))
                .switchMap(resp => {
                    const matches = resp?.data?.results || resp?.data || [];
                    const surface = Array.isArray(matches) ? matches[0] : null;
                    if (!surface) {
                        // Plain upload (no source recipe) — nothing to populate.
                        return Rx.Observable.empty();
                    }
                    // Ensure the resolved surface is in the list before selecting so
                    // the builder can render it, then select it.
                    //
                    // TASK-1587 (W1.8 P1.7, A6): we already have `surface` here, but
                    // there is no action creator that upserts a single fetched surface
                    // into state.terrainWorkbench.surfaces (the reducer's mergeSurface
                    // is internal to the BE-flow *_SUCCESS cases only). Rather than
                    // invent a fragile new TW_UPSERT_SURFACE action, we refetch via
                    // twLoadData() and select. selectedSurfaceId is set immediately;
                    // the surface row lands one reducer cycle later when twLoadData
                    // resolves, so the builder's selectedSurface lookup can be null for
                    // a single cycle (a brief empty flash) before populating. This is
                    // self-healing and acceptable — the populate is correct, just one
                    // cycle late.
                    return Rx.Observable.of(twLoadData(), twSelectSurface(surface.id));
                })
                .catch(() => Rx.Observable.empty());
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
                .catch(err =>
                    Rx.Observable.of(twCreateSurfaceError(extractTwError(err, 'Create failed')))
                );
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
                .catch(err =>
                    Rx.Observable.of(twUpdateSurfaceError(extractTwError(err, 'Update failed')))
                );
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

// ── Design inputs (kept for backward compat; no longer dispatched by UI) ──

export const twSetDesignInputsEpic = (action$, store) =>
    action$
        .ofType(TW_SET_DESIGN_INPUTS)
        .switchMap(action => {
            const projectId = getProjectId(store.getState());
            // TASK-1671: UI no longer dispatches TW_SET_DESIGN_INPUTS.
            // This epic is preserved so reducer cases and existing tests remain valid.
            return Rx.Observable
                .from(setInputs(projectId, action.surfaceId, action.designInputs))
                .map(resp => twSetDesignInputsSuccess(resp.data))
                .catch(err => {
                    const detail = err?.response?.data?.detail
                        || err?.message
                        || 'Save inputs failed';
                    return Rx.Observable.of(twSetDesignInputsError(String(detail)));
                });
        });

// ── Derive (TASK-1671: body carries atomic inputs + params) ────────────────

export const twDeriveEpic = (action$, store) =>
    action$
        .ofType(TW_DERIVE)
        .switchMap(action => {
            // TASK-1804: fire START when the derive POST is triggered.
            trackEvent('process', 'start', 'terrain-merge-start');
            const projectId = getProjectId(store.getState());
            // TASK-1671: action.body = { inputs:[{terrain_id,priority,unmodified}],
            //   feather_width_m, target_resolution_m, breach_max_cost,
            //   breach_search_dist, use_culverts }

            // TASK-1800 (W1.9 UAT r2): a project owns a SINGLE combined surface and
            // the panel no longer surfaces a "+ New" affordance. When the project has
            // ZERO AnalysisSurface rows the user still builds + derives one — the panel
            // edits a synthetic in-memory surface (id absent). At derive time we LAZILY
            // materialise exactly one row (POST), then derive against its new id. This
            // keeps create-on-first-need (no data litter from merely opening the panel)
            // and preserves the W1.6 atomic save-on-derive flow. The created row is
            // unnamed (no list/name is shown); a deterministic title keeps it legible
            // in the admin/API. surfaceId present (existing surface) → derive directly.
            const deriveWithId = (surfaceId, extraActions = []) =>
                Rx.Observable
                    .from(deriveAnalysisSurface(projectId, surfaceId, action.body || {}))
                    .switchMap(resp => Rx.Observable.from([
                        ...extraActions,
                        // TASK-1649: open Tasks Panel so derive progress is visible.
                        toggleTaskMonitorPanel(true),
                        twDeriveSuccess(surfaceId, resp?.data?.process_id)
                    ]))
                    .catch(err => {
                        // TASK-1804: fire ERROR when the derive POST fails.
                        trackEvent('process', 'error', 'terrain-merge-error');
                        return Rx.Observable.of(twDeriveError(extractTwError(err, 'Derive failed')));
                    });

            if (action.surfaceId === null || action.surfaceId === undefined) {
                // Lazily create the single combined surface, then derive against it.
                return Rx.Observable
                    .from(createAnalysisSurface(projectId, {
                        title: 'Combined surface',
                        use_culverts: false,
                        ...TW_PARAM_DEFAULTS
                    }))
                    .switchMap(createResp => {
                        const surface = createResp.data;
                        // TASK-1800 (W1.9 UAT r2 — adversarial-review fix): register the
                        // created row in Redux + select it the MOMENT create succeeds,
                        // INDEPENDENT of the derive outcome. Previously these two actions
                        // were passed as deriveWithId's extraActions, which only emit on
                        // the derive SUCCESS branch — so a create-succeeds / derive-fails
                        // sequence left the persisted row UNREGISTERED (panel still saw
                        // surface=null), and the user's retry POSTed createAnalysisSurface
                        // AGAIN, orphaning a fresh "Combined surface" row per failed retry.
                        // startWith-ing the registration means a failed derive leaves the
                        // row registered + selected, so the retry hits the EXISTING-id
                        // derive path (deriveWithId) instead of creating a duplicate.
                        return deriveWithId(surface.id).startWith(
                            twCreateSurfaceSuccess(surface),
                            twSelectSurface(surface.id)
                        );
                    })
                    .catch(err => {
                        // TASK-1804: fire ERROR when surface create-before-derive fails.
                        trackEvent('process', 'error', 'terrain-merge-error');
                        return Rx.Observable.of(twDeriveError(extractTwError(err, 'Create failed')));
                    });
            }

            return deriveWithId(action.surfaceId);
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
                            // TASK-1804: fire ERROR on poll timeout (proc never registered).
                            trackEvent('process', 'error', 'terrain-merge-error');
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
                                // TASK-1804: fire COMPLETE when derive reaches 'complete'.
                                trackEvent('process', 'complete', 'terrain-merge-complete');
                                const actions = [
                                    twDeriveComplete(surface),
                                    show({
                                        message: 'Terrain assembled — preview layers loading',
                                        title: 'Terrain Workbench',
                                        uid: 'tw-derive-done',
                                        position: 'tc',
                                        autoDismiss: 5
                                    })
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
                        // TASK-1804: fire ERROR when the backend reports failure.
                        trackEvent('process', 'error', 'terrain-merge-error');
                        const msg = proc?.metadata?.error_message
                            || proc?.error_message
                            || (proc.status === 'cancelled' ? 'Derive cancelled' : 'Derive failed');
                        return Rx.Observable.of(twDeriveError(String(msg)));
                    }
                    if (tick === TW_DERIVE_POLL_MAX - 1) {
                        done.v = true;
                        // TASK-1804: fire ERROR on poll timeout.
                        trackEvent('process', 'error', 'terrain-merge-error');
                        return Rx.Observable.of(twDeriveError(TW_DERIVE_TIMEOUT_MESSAGE));
                    }
                    return Rx.Observable.empty();
                });
        });

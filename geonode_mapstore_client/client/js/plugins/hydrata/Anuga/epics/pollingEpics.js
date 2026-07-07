import Rx from "rxjs";
import {
    addLayer,
    addGroup,
    removeLayer,
    refreshLayers,
    moveNode
} from '../../../../../MapStore2/web/client/actions/layers';
import {zoomToExtent, CHANGE_MAP_VIEW} from "../../../../../MapStore2/web/client/actions/map";
import {getNode} from '../../../../../MapStore2/web/client/utils/LayersUtils';
import {saveDirectContent} from "@js/actions/gnsave";
import {trackEvent} from "@js/utils/analytics";
// TASK-2117 (F1) — surface init-chain bootstrap failures instead of
// swallowing them; matches the established `show(...)` notification idiom
// already used by crudEpics.js / paywallEpics.js / permsEpics.js /
// membershipEpics.js / terrainBboxEpic.js.
import {show} from "../../../../../MapStore2/web/client/actions/notifications";
import * as anugaApi from '../api/anugaApi';
import {
    addAnugaBoundary,
    addAnugaInflow,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    addAnugaRainfall,
    addAnugaFriction,
    addAnugaStructure,
    addAnugaFullMesh,
    addAnugaMeshRegion,
    addCatchment,
    addNodes,
    addLinks,
    INIT_ANUGA,
    initAnuga,
    setAnugaBoundaryData,
    setAnugaTerrainData,
    setAnugaFrictionData,
    setAnugaInflowData,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    setAnugaRainfallData,
    setAnugaFullMeshData,
    setAnugaMeshRegionData,
    setNetworkData,
    setCatchmentData,
    setAnugaNodesData,
    setAnugaLinksData,
    setAnugaPollingData,
    setAnugaProjectData,
    setAnugaInitInFlight,
    setAnugaScenarioData,
    setAnugaScenarioResultsLoaded,
    setAnugaStructureData,
    setPublicationData,
    setComparisonData,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    startAnugaModelCreationPolling,
    startAnugaScenarioPolling,
    stopActiveRunPolling,
    updateRunStatus,
    runStatusPollingTimeout,
    fixAnugaGroups,
    FIX_ANUGA_GROUPS
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE_SUCCESS,
    setSvConfig,
    updateUploadStatus
} from "../../SimpleView/actionsSimpleView";
import {TM_SET_PROCESSES} from "../../TaskMonitor/actionsTaskMonitor";
import {getProjectId} from "../selectorsAnuga";

const getArchiveFilter = (state) => state?.anuga?.scenarios?.archiveFilter || 'none';
// Run statuses past which polling work is wasted. Shared with
// pollActiveRunStatusEpic + selectorsAnuga.getActiveRuns so the terminal-state
// set has one source of truth.
import {TERMINAL_RUN_STATES} from "../anugaConstants";

// TASK-603: Page Visibility gate. When the catalogue tab is hidden the
// browser will keep timer-based polling subscriptions alive but the user
// gains no value from the work. Real-user incident (gabriela.garcia@wkcgroup.com,
// 2026-04-22): a tab abandoned with the catalogue open polled for ~19h and
// produced ~30k wasted requests. We gate the catalogue init + model-creation
// polls here so the timers themselves stop while hidden and resume within one
// cycle of the next visibilitychange. We use `document.visibilityState !==
// 'hidden'` (not the legacy `document.hidden` boolean) for strictness, and
// `startWith(null)` so the gate fires immediately at subscription time rather
// than waiting for the first visibilitychange.
//
// Scope (deliberate): scenario/terrain/taskMonitor polls are NOT gated —
// they have their own start/stop semantics and are tracked under separate
// optimisation tasks.
//
// Test seam: `__visibilityForTests$` lets unit tests inject a Subject so they
// can drive isVisible deterministically without monkey-patching
// document.visibilityState (which sits behind a non-configurable native
// accessor in Chromium and isn't reliably overridable from user code). When
// set, it overrides the live DOM-driven stream. Tests must reset to null
// in afterEach to avoid leaking across the suite.
let __visibilityForTests$ = null;
export const __setVisibilityForTests = (subj) => { __visibilityForTests$ = subj; };
const _domVisibility$ = (typeof document !== 'undefined' && document.addEventListener)
    ? Rx.Observable.fromEvent(document, 'visibilitychange')
        .startWith(null)
        .map(() => document.visibilityState !== 'hidden')
    : Rx.Observable.of(true);
const visibility$ = Rx.Observable.defer(
    () => __visibilityForTests$ || _domVisibility$
);

// W7 (TASK-1045) — polling cap. Without a cap, an orphan BE Process leaves
// the user polling forever (memory pin: feedback-fe-epic-task-monitor-poll-cap).
// Callers must evaluate this from the CURRENT scenario at subscription time
// (read store.getState() inside the switchMap, not from a stale closure of
// the initial action).
//
// Floor = 1h wall-clock at 3s ticks; headroom = 2/3 over the BE-supplied
// expected_duration_seconds, so a slow-but-healthy run isn't prematurely paused.
const POLLING_TICK_SECONDS = 3;
const POLLING_CAP_FLOOR_TICKS = 1200;
const POLLING_CAP_HEADROOM_RATIO = 2 / 3;
const DEFAULT_EXPECTED_DURATION_SECONDS = POLLING_CAP_FLOOR_TICKS;
export function getPollingCap(scenario) {
    const expected = scenario?.latest_run?.expected_duration_seconds
        || DEFAULT_EXPECTED_DURATION_SECONDS;
    const dynamic = Math.ceil(expected * POLLING_CAP_HEADROOM_RATIO / POLLING_TICK_SECONDS);
    return Math.max(POLLING_CAP_FLOOR_TICKS, dynamic);
}

// TASK-1586: pollAnugaModelCreationEpic removed — it was a no-op stub that
// only swallowed START_ANUGA_MODEL_CREATION_POLLING (V2P-79 retired
// /available/ polling; layer injection is now path-1 MapLayer merge +
// path-2 taskCompleteLayerEpic). The action creators and dispatches are
// intentionally retained so callers (initAnugaEpic, buildTerrainAddSequence)
// continue to compile without change.

// V2P-79 — resource endpoint catalogue. Each entry is a (V1) type identifier
// recognised by anugaApi.getResourceList; the helper translates the type to
// its V2 plural URL segment internally (see V2_PLURAL in api/anugaApi.js).
// All paths now hit /api/v2/anuga/projects/{pid}/{plural}/ on the BE.
const resourceEndpoints = [
    {endpoint: 'boundary', action: setAnugaBoundaryData},
    {endpoint: 'terrain', action: setAnugaTerrainData},
    {endpoint: 'inflow', action: setAnugaInflowData},
    // TASK-955 (W2.2 FE) — Rainfall list fetch. Hits V2 /rainfalls/ via
    // anugaApi.getResourceList → V2_PLURAL mapping (TASK-955 anugaApi edit).
    {endpoint: 'rainfall', action: setAnugaRainfallData},
    {endpoint: 'structure', action: setAnugaStructureData},
    {endpoint: 'friction', action: setAnugaFrictionData},
    {endpoint: 'full-mesh', action: setAnugaFullMeshData},
    {endpoint: 'mesh-region', action: setAnugaMeshRegionData},
    {endpoint: 'network', action: setNetworkData},
    {endpoint: 'catchment', action: setCatchmentData},
    {endpoint: 'nodes', action: setAnugaNodesData},
    {endpoint: 'links', action: setAnugaLinksData},
    {endpoint: 'comparison', action: setComparisonData},
    {endpoint: 'publication', action: setPublicationData}
];

const fetchResourceEndpoint = (endpoint, projectId) => Rx.Observable
    .from(anugaApi.getResourceList(projectId, endpoint))
    // Every resourceEndpoints route is a V2 LIST endpoint (success → array), and
    // every consumer iterates the result with array methods (.map/.forEach/.some
    // in the Inputs/Networks panels, pruneOrphanTerrainLayersEpic,
    // computeTerrainSubOrder). A failure fallback of `{}` is a non-array that
    // crashes all of them (and `x || []` does NOT rescue `{}`), so fall back to
    // an empty ARRAY — the correct "no rows" sentinel for a list fetch.
    .catch(() => Rx.Observable.of({data: []}))
    .switchMap(response => Rx.Observable.of(response.data));

export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA, UPDATE_DATASET_TITLE_SUCCESS)
        .filter(() => store.getState().gnresource.id)
        // TASK-1637 — hoist the auth filter ABOVE the from-map POST. Previously
        // this lived after the from-map switchMap, so an anonymous visitor fired
        // a wasted POST /from-map/ that then died at the auth gate. Anon users
        // now drop here, before any network call.
        .filter(() => !!store.getState()?.security?.user)
        // TASK-603: drop init catalogue project-poll when tab is hidden.
        // Use withLatestFrom rather than switchMap-on-visibility$ here because
        // initAnugaEpic is action-driven (one-shot per action), not timer-driven.
        // If the user fires INIT_ANUGA while hidden we simply skip the catalogue
        // refresh — the next INIT_ANUGA after the tab becomes visible will run.
        .withLatestFrom(visibility$)
        .filter(([_, isVisible]) => isVisible)
        .map(([action]) => action)
        // TASK-1637 — "init in flight" dedupe gate. anugaContainer's
        // componentDidUpdate re-dispatches INIT_ANUGA on EVERY re-render while
        // !isAnugaProject (i.e. for the whole from-map → getProjectV2 →
        // setAnugaProjectData window). Because the chain below uses switchMap,
        // a 2nd INIT_ANUGA would CANCEL the first in-flight waterfall and
        // restart it from scratch — one wasted full round-trip before the
        // SimpleView menus mount. We gate on a guard keyed to the CURRENT map
        // id: if an init for this exact map is already running, drop the
        // duplicate. Keyed on map id (not a bare boolean) so a map switch —
        // which lands a new gnresource.id — is never deduped against the
        // previous map's stale guard. Legitimate refresh re-inits
        // (crudEpics saveNetwork/createFigure, pollingEpics terrain-add /
        // orphan-refresh, UPDATE_DATASET_TITLE_SUCCESS) all fire AFTER the
        // first init completed (guard already cleared on setAnugaProjectData),
        // so they pass straight through.
        .filter(() => store.getState()?.anuga?.projects?.initInFlight !== store.getState().gnresource.id)
        .switchMap(() => {
            const mapId = store.getState().gnresource.id;
            // Mark the guard the instant we commit to the from-map call. The
            // dispatched flag lands in Redux before the next INIT_ANUGA
            // re-dispatch reaches the gate above, so the duplicate is dropped.
            // Clear the guard on the empty/error tail so a failed init never
            // wedges the gate shut (the refresh paths must always be able to
            // re-init). On the success path the guard is also cleared by the
            // SET_ANUGA_PROJECT_DATA reducer case — belt and braces.
            return Rx.Observable.of(setAnugaInitInFlight(mapId))
                .concat(
                    Rx.Observable.from(anugaApi.getProjectFromMapId(mapId))
                        .switchMap(response1 => {
                            const projectId = response1.data.projectId;
                            // Use v2 for project detail
                            return Rx.Observable.from(anugaApi.getProjectV2(projectId))
                                .switchMap(response2 => {
                                    // TASK-2140 (d) — project-bootstrap OUTCOME
                                    // event. NOTE (novel_question, see W2
                                    // wave-agent summary): the from-map endpoint
                                    // is a get-or-create — its response carries
                                    // no `created` flag, so the FE cannot
                                    // distinguish "brand-new project" from "user
                                    // re-opened an existing one". This fires on
                                    // EVERY successful init, not just true
                                    // creation; labelled -init- (not -create-)
                                    // to avoid overclaiming semantics we can't
                                    // back. A precise create-only signal would
                                    // need a BE response field (out of gmc scope).
                                    trackEvent('process', 'complete', 'anuga-project-init-complete');
                                    // Respect the persisted archiveFilter so a
                                    // panel reopen after switching to 'Archived'
                                    // restores the same view.
                                    const scenariosFetch = Rx.Observable.from(
                                        anugaApi.getScenariosByArchive(projectId, getArchiveFilter(store.getState()))
                                    )
                                        .catch(() => Rx.Observable.of({data: []}))
                                        .map(resp => setAnugaScenarioData(resp.data));

                                    // V2P-79: resource fetches now go through V2 plural routes.
                                    const resourceObservables = resourceEndpoints.map(
                                        ({endpoint, action}) => fetchResourceEndpoint(endpoint, projectId).map(action)
                                    );

                                    return Rx.Observable.of(
                                        setAnugaProjectData(response2.data),
                                        fixAnugaGroups(),
                                        setSvConfig(response2.data.simple_view_config)
                                    ).concat(
                                        Rx.Observable.merge(scenariosFetch, ...resourceObservables),
                                        Rx.Observable.of(startAnugaScenarioPolling()),
                                        Rx.Observable.of(startAnugaModelCreationPolling())
                                    );
                                });
                        })
                        // TASK-2117 (F1, dogfood 2026-07-04) — surface this
                        // chain's failure instead of a total silent swallow.
                        // The :173 auth filter (ABOVE the switchMap this catch
                        // lives inside) already drops anonymous visitors
                        // before any network call fires — this catch is
                        // therefore ONLY ever reached for a logged-in user,
                        // so no anon-spam risk. The realistic failure here is
                        // a stale/expired session (the cookie lapses sometime
                        // after the page loaded, well after the auth filter
                        // already passed): the from-map POST then 401/403s,
                        // which the BE reports distinctly from a generic
                        // failure — surfaced as a "log out and back in"
                        // notification. Anything else (500, network error)
                        // gets a generic "model builder failed to load"
                        // toast. The guard is STILL cleared on every path (no
                        // stuck spinner) — this only ADDS a notification
                        // alongside the pre-existing setAnugaInitInFlight(false).
                        // Sibling swallows exist elsewhere (crudEpics.js
                        // ~491-496 and ~9 other catch-to-empty sites) — this
                        // fixes the init chain only; noted for a future sweep.
                        .catch((err) => {
                            // libs/ajax.js's response interceptor rejects with
                            // `{...error.response, originalError: error}` (a
                            // SPREAD, not a nested `.response`) — so the status
                            // lands at `err.status`, matching the established
                            // idiom in permsEpics.js / demRescaleEpic.js. Fall
                            // back to `err.originalError.status` in case a
                            // caller ever surfaces the raw pre-interceptor
                            // error instead.
                            const httpStatus = err?.status ?? err?.originalError?.status;
                            const isAuthError = httpStatus === 401 || httpStatus === 403;
                            const notification = isAuthError
                                ? show({message: 'hydrata.anuga.initSessionExpiredError'}, 'error')
                                : show({message: 'hydrata.anuga.initGenericError'}, 'error');
                            return Rx.Observable.of(notification, setAnugaInitInFlight(false));
                        })
                );
        });

// TASK-2078: result-load "already loaded?" check reads latest_complete_run —
// the run whose COGs are actually eligible to be on the map — not latest_run
// (which may be a newer in-flight/errored run with no result layers yet).
const isScenarioLoaded = (scenario, state) => {
    const depth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_complete_run?.gn_layer_depth_max?.name);
    const velocityDepth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_complete_run?.gn_layer_depth_integrated_velocity_max?.name);
    const velocity = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_complete_run?.gn_layer_velocity_max?.name);
    return !!depth?.length && !!velocityDepth?.length && !!velocity?.length;
};

// Polling is started once per init via startAnugaScenarioPolling in
// initAnugaEpic — switchMap ensures only one active subscription at a time.
// Each poll reads the FE's archiveFilter ('none' default, 'only' for the
// Archived tab, 'all' for both) and passes it to the BE via
// getScenariosByArchive. The call still drives setAnugaPollingData so the
// row-update + new-row paths in the reducer don't change.
// TASK-1897 (FE defence-in-depth): an ANUGA result layer's name is
// geonode:run{N}_{token}_cog. Restricting removal candidates to this pattern
// means an input, DEM or terrain layer can NEVER be removed even if a human
// title collides.
export const RESULT_LAYER_NAME_RE = /(^|:)run\d+_.+_cog$/;

// Choose which currently-loaded result layers to remove before (re)adding a
// scenario's result layers (sourced from latest_complete_run — TASK-2078).
// Within the result-layer set we match the target run's own layers by
// run-unique NAME (idempotent re-add) and a SUPERSEDED previous run of the
// SAME scenario by title — the scenario API exposes only `latest_run` /
// `latest_complete_run` (no full run lineage/history), so title is the only
// same-scenario proxy available, and it is safe here because it is scoped to
// result layers and a map shows a single project. The authoritative
// cross-project guarantee lives in the backend (the run-scoped FK lookup in
// _idempotent_result_layer); this keeps the FE from ever mutating a foreign
// or non-result layer.
export const selectStaleResultLayers = (flatLayers, latestRun) => {
    const names = [
        latestRun?.gn_layer_depth_integrated_velocity_max?.name,
        latestRun?.gn_layer_depth_max?.name,
        latestRun?.gn_layer_velocity_max?.name
    ].filter(Boolean);
    const titles = [
        latestRun?.gn_layer_depth_integrated_velocity_max?.title,
        latestRun?.gn_layer_depth_max?.title,
        latestRun?.gn_layer_velocity_max?.title
    ].filter(Boolean);
    return (flatLayers || []).filter(layer =>
        RESULT_LAYER_NAME_RE.test(layer?.name || '') &&
        (names.includes(layer?.name) || titles.includes(layer?.title))
    );
};

export const pollAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_SCENARIO_POLLING)
        .switchMap(() =>
            Rx.Observable
                .timer(0, 8000)
                .takeUntil(action$.ofType(STOP_ANUGA_SCENARIO_POLLING))
                .switchMap(() =>
                    Rx.Observable.from(
                        anugaApi.getScenariosByArchive(
                            getProjectId(store.getState()),
                            getArchiveFilter(store.getState())
                        )
                    )
                        .catch(() => Rx.Observable.empty())
                        .switchMap(response => Rx.Observable
                            .of(setAnugaPollingData(response.data))
                            .switchMap((action) => {
                                const scenariosById = store.getState()?.anuga?.scenarios?.byId || {};
                                // TASK-2078: the result-load gate is the presence
                                // of a COMPLETE run (latest_complete_run), NOT
                                // computed_status/latest_run's status — a newer
                                // in-flight or errored run must never hide an
                                // older complete run's results. This is a RESULT
                                // consumer per D1; the status pill/card/error
                                // strip/run log stay on latest_run elsewhere.
                                let backendScenariosToLoadResults = action.scenarios?.filter(scenario =>
                                    !!scenario.latest_complete_run
                                );
                                let scenarioToLoadResults = backendScenariosToLoadResults.filter(scenarioBackend => {
                                    const frontendScenario = scenariosById[scenarioBackend.id];
                                    if (frontendScenario && !frontendScenario.isLoaded && !isScenarioLoaded(frontendScenario, store.getState())) {
                                        return true;
                                    }
                                    return false;
                                })[0];
                                const currentLayerNames = store.getState()?.layers?.flat?.map(layer => layer?.name);
                                let wmsLayers = store.getState()?.layers?.flat?.filter((l) => l?.type === 'wms' && l?.group !== 'background') || [];
                                // TASK-1897 (FE defence-in-depth): pick stale
                                // result layers to remove by run-unique NAME,
                                // scoped to result layers only — never a bare
                                // title match against arbitrary layers.
                                let existingResultLayers = selectStaleResultLayers(
                                    store.getState()?.layers?.flat,
                                    scenarioToLoadResults?.latest_complete_run
                                );
                                if (scenarioToLoadResults &&
                                    scenarioToLoadResults?.latest_complete_run?.gn_layer_depth_integrated_velocity_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_complete_run?.gn_layer_depth_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_complete_run?.gn_layer_velocity_max?.catalogURL &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_complete_run?.gn_layer_depth_integrated_velocity_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_complete_run?.gn_layer_depth_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_complete_run?.gn_layer_velocity_max?.name)
                                ) {
                                    // ISSUE 32 (TASK-1429): remap BE group name
                                    // "Results.Depth Integrated Velocity" → "Results.Momentum"
                                    // so the layer lands in the renamed FE group.
                                    const remapGroup = (layer) => {
                                        if (!layer) return layer;
                                        if (layer.group === 'Results.Depth Integrated Velocity') {
                                            return Object.assign({}, layer, {group: 'Results.Momentum'});
                                        }
                                        return layer;
                                    };
                                    const depthVelocityLayer = remapGroup(scenarioToLoadResults.latest_complete_run.gn_layer_depth_integrated_velocity_max);
                                    const depthLayer = scenarioToLoadResults.latest_complete_run.gn_layer_depth_max;
                                    const velocityLayer = scenarioToLoadResults.latest_complete_run.gn_layer_velocity_max;
                                    // Remove every superseded stale result layer
                                    // (variable count; never dispatch
                                    // removeLayer(undefined)) before re-adding.
                                    const removeStaleResultLayers = (existingResultLayers || [])
                                        .filter(layer => layer?.id)
                                        .map(layer => Rx.Observable.of(removeLayer(layer.id)));
                                    return Rx.Observable
                                        .concat(
                                            ...removeStaleResultLayers,
                                            Rx.Observable.of(setAnugaPollingData(action.scenarios)),
                                            Rx.Observable.of(addLayer(depthVelocityLayer)),
                                            Rx.Observable.of(addLayer(depthLayer)),
                                            Rx.Observable.of(addLayer(velocityLayer)),
                                            Rx.Observable.of(setAnugaScenarioResultsLoaded(scenarioToLoadResults?.id, true)),
                                            Rx.Observable.of(refreshLayers(wmsLayers))
                                        );
                                }
                                return Rx.Observable.of(setAnugaPollingData(action.scenarios));
                            })
                        )
                )
        );

// Lightweight run-status poller for active runs (3s interval).
//
// W7 (TASK-1045) — polling cap. The stream is .take(N)-capped where N is
// derived from the CURRENT scenario at subscription time (via store.getState),
// not the START action payload — the scenario's latest_run can flip
// between START_ACTIVE_RUN_POLLING firing and the first tick landing. When
// the cap is reached without a terminal status, we dispatch
// RUN_STATUS_POLLING_TIMEOUT(runId) so a paused-banner can prompt the user
// to manually resume. STOP_ACTIVE_RUN_POLLING (terminal-status detected, or
// user navigation) still tears down via takeUntil first.
//
// `store` arg added at the same time so we can read scenario state. Callers
// in the rootEpic invoke (action$, store) for every epic — no caller change.
//
// Pattern: a single ticker tracks tick count via `scan`; when the count hits
// the cap, we emit a timeout action and end the stream. takeUntil(STOP) still
// tears down early on terminal status or navigation, in which case scan's
// counter never reaches cap and no timeout fires.
export const pollActiveRunStatusEpic = (action$, store) =>
    action$
        .ofType(START_ACTIVE_RUN_POLLING)
        .switchMap((action) => {
            const runId = action.runId;
            // Derive the cap at subscription time from the live store. We
            // search byId for the scenario whose latest_run.id matches runId.
            const cap = (() => {
                const state = store && store.getState ? store.getState() : null;
                const byId = state?.anuga?.scenarios?.byId || {};
                const scenario = Object.values(byId).find(
                    s => s?.latest_run?.id === runId
                );
                return getPollingCap(scenario);
            })();
            return Rx.Observable.timer(0, 3000)
                .takeUntil(action$.ofType(STOP_ACTIVE_RUN_POLLING).filter(a => a.runId === runId))
                .scan((acc) => acc + 1, 0)
                // Stop after `cap` ticks have been emitted from scan (1..cap).
                .take(cap)
                .exhaustMap((tickNumber) =>
                    Rx.Observable.from(anugaApi.getRunStatus(runId))
                        .catch(() => Rx.Observable.empty())
                        .map(response => ({response, tickNumber}))
                )
                .concatMap(({response, tickNumber}) => {
                    const data = response.data;
                    const actions = [updateRunStatus(runId, data)];
                    if (TERMINAL_RUN_STATES.includes(data?.status)) {
                        // TASK-2140 (a) — OUTCOME event: the run reached a
                        // terminal state (complete|error|cancelled). Fires
                        // exactly once per run because takeUntil(STOP_ACTIVE_
                        // RUN_POLLING) tears the timer down right after this
                        // dispatch — no further ticks land for this runId.
                        // Status is a bounded 3-value set (TERMINAL_RUN_STATES)
                        // so folding it into the label stays low-cardinality.
                        trackEvent('process', data.status, `anuga-run-terminal-${data.status}`);
                        actions.push(stopActiveRunPolling(runId));
                    } else if (tickNumber >= cap) {
                        // Cap reached without a terminal status — pause the
                        // poll and surface the banner. The banner is the
                        // resume affordance (dispatches START_ACTIVE_RUN_POLLING).
                        actions.push(runStatusPollingTimeout(runId));
                        actions.push(stopActiveRunPolling(runId));
                    }
                    return Rx.Observable.from(actions);
                });
        });

// -- Ensure ANUGA group tree exists before layers are added ----------------

// Order is z-order from TOP (renders on top) to BOTTOM. Rasters last so they
// sit underneath the vector inputs — drawing a boundary on top of a terrain
// hillshade has to stay visible. The reverse-walk in initialReorderLayers
// (MapStore2 LayersUtils) flips this list into flat[]: the first child here
// ends at the END of flat = TOP of the OL z-stack. So Boundaries first =
// painted on top of everything, Terrain last = painted underneath.
// TASK-1901 (W2): Canonical Input Data child order, top-of-map → bottom-of-map
// (visually highest first — reverse-walk in initialReorderLayers means the FIRST
// child here lands at TOP of the OL z-stack). Mirrors BE utils.py LAYER_Z_ORDER.
// FE/BE divergence guard: a karma test in layerOrderEpics-test.js pins this list;
// update the two in tandem (search: "LAYER_Z_ORDER" in hydrata/apps/).
// NOTE: No "Culverts" entry — BE reserved the rank but no live layer exists yet.
// Exported for use by layerOrderEpics (reconciler) so the canonical list has one
// source of truth.
export const ANUGA_GROUPS = {
    "Input Data": [
        // Vector tiers: structures-over-boundaries keeps drainage features visible
        // above catchment outlines. Canonical tier order mirrors BE LAYER_Z_ORDER.
        "Structures",
        "Boundaries", "Inflows",
        // TASK-955 (W2.2 FE) — Rainfall input group, beside Inflows so the
        // legend ordering matches the polygon-vs-line input split.
        // BE INPUT_DATA_GROUP_MAP maps the 'rai' prefix to this label.
        "Rainfalls",
        "Catchments", "Nodes", "Links",
        "Mesh Regions", "Full Mesh",
        "Friction",
        // TASK-829 raster sibling to vector Friction; routed via the
        // 'fri_raster_' prefix in BE INPUT_DATA_GROUP_MAP. Pre-create here so
        // the first friction-raster upload doesn't trigger a lazy group-add at
        // a non-canonical position.
        "Friction Rasters",
        "Terrain"
    ],
    "Results": [
        // ISSUE 32 (TASK-1429): "Depth Integrated Velocity" renamed to "Momentum"
        // in all human-facing labels. Dataset name (depthintegratedvelocity) unchanged.
        "Depth", "Momentum", "Velocity",
        "Comparison: Velocity", "Comparison: Depth",
        "Comparison: Momentum"
    ]
};

export const ensureAnugaGroupsEpic = (action$, store) =>
    action$
        .ofType(FIX_ANUGA_GROUPS)
        .switchMap(() => {
            const groups = store.getState().layers?.groups || [];
            const actions = [];

            Object.entries(ANUGA_GROUPS).forEach(([parentName, children]) => {
                if (!getNode(groups, parentName)) {
                    actions.push(addGroup(parentName, "", {
                        id: parentName,
                        name: parentName,
                        expanded: true
                    }));
                }
                children.forEach(childName => {
                    const childId = `${parentName}.${childName}`;
                    if (!getNode(groups, childId)) {
                        actions.push(addGroup(childName, parentName, {
                            id: childId,
                            name: childName
                        }));
                    }
                });
            });

            return actions.length > 0
                ? Rx.Observable.from(actions)
                : Rx.Observable.empty();
        });

// Resolve the ANUGA group label ('Input Data.Terrain', 'Results.Depth', ...)
// for a layer being injected by taskCompleteLayerEpic. The Layer Menu /
// Results tab filter in simpleViewMenuRows.js gates each layer on
// `layer.group.split('.')[0] === openMenuGroupId`, so the group MUST land
// on the layer at addLayer time. Sources in priority order:
//   1. metadata.target_group (explicit BE hint; terrain stamps this)
//   2. metadata.mapstore_layer.extra_params.anuga_group (MapLayer canonical
//      field stamped by create_maplayer_for_dataset)
//   3. layerConfig.group when serializer's get_group already resolved it
//      to an ANUGA-prefixed path (Input Data.* or Results.*)
// Returns the resolved group string or null when no signal is available
// (caller leaves layerConfig.group unchanged).
const resolveAnugaGroup = (metadata, layerConfig) => {
    const target = metadata?.target_group;
    if (typeof target === 'string' && target) return target;
    const extra = metadata?.mapstore_layer?.extra_params?.anuga_group;
    if (typeof extra === 'string' && extra) return extra;
    const serialized = layerConfig?.group;
    if (typeof serialized === 'string' &&
        (serialized.startsWith('Input Data.') || serialized.startsWith('Results.'))) {
        return serialized;
    }
    return null;
};

// localStorage-backed handled-completion-ids registry. Module-scoped Set
// alone resets on page reload, which re-fires the addLayer + "save your
// project" banner for every previously-handled completion (because the
// per-tick `currentNames.includes` guard only catches layers added under
// the SAME bytemap-name; renamed/dropped projects + completed Processes
// older than the current session both leak through). Persisting the
// handled-IDs across reloads scoped by mapId removes the phantom toast on
// every reload AND prevents redundant addLayer dispatches for completions
// the user has already seen.
//
// Storage shape: [{id, ts}], TTL-pruned to 7d on every read. Failures to
// access localStorage (privacy mode, quota, parse) degrade to in-memory
// only — same defensive pattern as simpleViewMenuRows' collapseStorage.
const HANDLED_IDS_STORAGE_PREFIX = 'hydrata_handled_completion_ids_';
export const HANDLED_IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// TASK-1650 (W1.5): NEW_LAYERS_NOTIFICATION removed — both show() firings
// (buildTerrainAddSequence + taskCompleteLayerEpic) were info toasts on
// auto-added layers. Error/warning toasts are dispatched separately and kept.

const handledIdsStorageKey = (mapId) => `${HANDLED_IDS_STORAGE_PREFIX}${mapId}`;

// Read the raw [{id, ts}] array from localStorage, TTL-pruning stale entries.
// Returns [] on any failure (missing key, parse error, quota/privacy block,
// non-array payload). Telemetry surfaces failures via console.warn so a
// silent localStorage outage shows up in DevTools without crashing the epic.
const loadHandledCompletionIdsRaw = (mapId) => {
    if (mapId === null || mapId === undefined) return [];
    try {
        const raw = window.localStorage.getItem(handledIdsStorageKey(mapId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cutoff = Date.now() - HANDLED_IDS_TTL_MS;
        return parsed.filter(e => e && typeof e.ts === 'number' && e.ts >= cutoff && e.id !== undefined);
    } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('hydrata: handled-ids storage unavailable on read', e);
        }
        return [];
    }
};

const loadHandledCompletionIds = (mapId) => {
    const fresh = loadHandledCompletionIdsRaw(mapId);
    return {
        set: new Set(fresh.map(e => e.id)),
        entries: fresh
    };
};

// Cross-tab safe persist. Two tabs on the same mapId each maintain their own
// in-memory Set; a naive overwrite means tab B's write loses tab A's entries.
// Fix: re-read the persistent state, merge (existing fresh entries + the
// in-memory Set), write the union. Also back-fill the caller's Set with any
// ids another tab has already persisted so this tab won't re-fire addLayer
// for completions the other tab already handled.
//
// handledIdsSet is mutated in place to absorb re-hydrated cross-tab ids.
// Returns the merged entries array so the caller can replace its mirror
// list (handledEntries) used for fresh-write ts stamps.
const persistHandledCompletionIds = (mapId, handledIdsSet, inMemoryEntries) => {
    if (mapId === null || mapId === undefined) return null;
    try {
        const existingFromStorage = loadHandledCompletionIdsRaw(mapId);
        const now = Date.now();
        const merged = new Map();
        // Seed with existing storage entries (already TTL-pruned by raw loader).
        for (const entry of existingFromStorage) {
            merged.set(entry.id, entry);
        }
        // Preserve any in-memory entries with their original ts (so the TTL
        // clock doesn't reset on re-persist). New ids missing a ts get one
        // stamped now.
        const inMemoryTsById = new Map();
        if (Array.isArray(inMemoryEntries)) {
            for (const entry of inMemoryEntries) {
                if (entry && entry.id !== undefined && typeof entry.ts === 'number') {
                    inMemoryTsById.set(entry.id, entry.ts);
                }
            }
        }
        for (const id of handledIdsSet) {
            if (!merged.has(id)) {
                const ts = inMemoryTsById.has(id) ? inMemoryTsById.get(id) : now;
                merged.set(id, { id, ts });
            }
        }
        // Back-fill the in-memory Set with cross-tab entries so this tab will
        // skip ids another tab has already handled.
        for (const id of merged.keys()) handledIdsSet.add(id);
        const mergedEntries = Array.from(merged.values());
        window.localStorage.setItem(handledIdsStorageKey(mapId), JSON.stringify(mergedEntries));
        return mergedEntries;
    } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('hydrata: handled-ids storage unavailable on write', e);
        }
        // localStorage unavailable (privacy/quota); in-memory Set still works
        // for the current page lifetime.
        return null;
    }
};

// TASK-1586: noOpEpic helper + 10 stubs (addAnugaBoundaryEpic,
// addAnugaFrictionEpic, addAnugaInflowEpic, addAnugaRainfallEpic,
// addAnugaStructureEpic, addAnugaFullMeshEpic, addAnugaMeshRegionEpic,
// addCatchmentEpic, addNodesEpic, addLinksEpic) removed. These were V2P-79
// no-ops that only swallowed ADD_ANUGA_* actions. The action creators,
// reducers, and dispatches are intentionally retained — they are still
// dispatched by taskCompleteLayerEpic (modelClassDispatch) and callers in
// anugaInputMenu for backwards-compat.

// -- Fix 3: Event-driven layer addition on TaskMonitor completion ----------
// When a layer_create process completes, dispatch the appropriate add action
// to fetch available layers for that resource type immediately.

// Per-class dispatch table for layer_create completions. Keyed on the
// Python class name stamped in Process metadata.model_class.
//   addAction — legacy V1 ADD_ANUGA_* action; dispatched for backwards compat
//               so any future listener on ADD_ANUGA_* can register without
//               requiring changes here.
//   endpoint / setAction — resource-list refresh pair. The page-load
//               fan-out in initAnugaEpic fires before celery's
//               `create_supporting_models` has populated the default rows
//               for a fresh project, so /<plural>/ returns [] and
//               state.anuga.resources.<type> persists that empty list.
//               When the layer_create Process lands with mapstore_layer
//               metadata, taskCompleteLayerEpic uses this entry to refetch
//               /<endpoint>/ and dispatch setAction so the Scenarios >
//               Required dropdowns (which read from resources.inflows
//               etc.) see the new resource. terrain_create dodges this
//               via initAnuga() inside buildTerrainAddSequence; this map
//               is the equivalent per-type targeted fetch for non-terrain
//               layer_create completions. TASK-955 added Rainfall.
//               TASK-1292 added Terrain: a layer_create with model_class=
//               'Terrain' skips the terrain_create/buildTerrainAddSequence
//               path (which already calls initAnuga) but still needs the
//               resources.terrain list refreshed so the Inputs>Terrain
//               panel updates without a hard reload. addAction is null
//               because there is no ADD_ANUGA_TERRAIN V1 constant; the
//               layer itself is injected via the mapstore_layer metadata
//               branch above this dispatch table.
const modelClassDispatch = {
    'Boundary': { addAction: addAnugaBoundary,   endpoint: 'boundary',    setAction: setAnugaBoundaryData },
    'Inflow': { addAction: addAnugaInflow,     endpoint: 'inflow',      setAction: setAnugaInflowData },
    'Rainfall': { addAction: addAnugaRainfall,   endpoint: 'rainfall',    setAction: setAnugaRainfallData },
    'Friction': { addAction: addAnugaFriction,   endpoint: 'friction',    setAction: setAnugaFrictionData },
    'Structure': { addAction: addAnugaStructure,  endpoint: 'structure',   setAction: setAnugaStructureData },
    'FullMesh': { addAction: addAnugaFullMesh,   endpoint: 'full-mesh',   setAction: setAnugaFullMeshData },
    'MeshRegion': { addAction: addAnugaMeshRegion, endpoint: 'mesh-region', setAction: setAnugaMeshRegionData },
    'Catchment': { addAction: addCatchment,       endpoint: 'catchment',   setAction: setCatchmentData },
    'Nodes': { addAction: addNodes,           endpoint: 'nodes',       setAction: setAnugaNodesData },
    'Links': { addAction: addLinks,           endpoint: 'links',       setAction: setAnugaLinksData },
    'Terrain': { addAction: null,             endpoint: 'terrain',     setAction: setAnugaTerrainData }
};

// Multi-layer terrain handoff. Adds DEM + hillshade together, then runs
// the post-add chain (refresh, first-upload zoom + save race, group placement,
// status update, model-creation polling kickoff). Driven by Process metadata
// stamped by the create_terrain_gn_layer celery task.
const buildTerrainAddSequence = (metadata, action$, store, currentNames) => {
    const layers = Array.isArray(metadata?.mapstore_layers) ? metadata.mapstore_layers : [];
    const isFirstUpload = !!metadata?.is_first_upload;
    const firstLayer = layers[0];
    const newLayers = layers.filter(l => l?.name && !currentNames.includes(l.name));
    if (!newLayers.length) {
        return Rx.Observable.empty();
    }
    // TASK-1720 (W3): Look up the terrain's styling_mode from Redux state so
    // we can gate singleTile stamping at first-add time. The BE (W1) sets
    // singleTile:false + gwc_tileable:true on the mapstore_layer config for
    // traditional terrains. For dynamic terrains (styling_mode !== 'traditional'),
    // we add singleTile:true so the demRescaleEpic's env-bearing GetMap fires as
    // a single untiled request per pan/zoom rather than GWC tile grid requests.
    // Default 'traditional' when terrain is not yet in state (race: the terrain
    // row may not be in state at the time of first terrain_create completion).
    const terrainId = metadata?.terrain_id;
    const terrainResources = store.getState()?.anuga?.resources?.terrain || [];
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    const matchedTerrain = terrainId != null
        ? terrainResources.find(t => t?.id === terrainId)
        : null;
    const isTraditional = !matchedTerrain || matchedTerrain.styling_mode !== 'dynamic';

    // Stamp the BE-resolved group on each layer so the Layer Menu / Results
    // tab filter (simpleViewMenuRows.js — gates on layer.group.split('.')[0])
    // routes the layer into the correct tab without waiting for the next
    // FIX_ANUGA_GROUPS tick. terrain_create stamps metadata.target_group
    // ('Input Data.Terrain') for both DEM + hillshade.
    // ENH 7 (TASK-1428): default terrain rasters to 50% opacity so both
    // DEM + hillshade are visible when stacked.
    const stampedLayers = newLayers.map(l => {
        const group = resolveAnugaGroup(metadata, l);
        const layerWithGroup = group ? Object.assign({}, l, { group }) : Object.assign({}, l);
        // TASK-1720: override singleTile based on styling_mode.
        // Dynamic → singleTile:true (demRescaleEpic will stamp env= on next pan/zoom).
        // Traditional → singleTile:false (GWC WMTS tiled; no env= will be set;
        //   the gwcCatalogRouting / routeLayerTileSource paths route tiles correctly).
        const singleTileOverride = isTraditional ? { singleTile: false } : { singleTile: true };
        return Object.assign(layerWithGroup, { opacity: 0.5 }, singleTileOverride);
    });
    return Rx.Observable.concat(
        Rx.Observable.defer(() => {
            const wmsLayers = store.getState()?.layers?.flat?.filter(l => l?.type === 'wms' && l?.group !== 'background') || [];
            return Rx.Observable.of(refreshLayers(wmsLayers));
        }),
        ...stampedLayers.map(l => Rx.Observable.of(addLayer(l))),
        // TASK-1650 (W1.5): info toast removed — auto-added input layers are
        // visible in the Inputs panel; the toast added noise with no action.
        ...(isFirstUpload && firstLayer?.bbox?.bounds
            ? [
                Rx.Observable.of(zoomToExtent(firstLayer.bbox.bounds, firstLayer.bbox.crs, 20)),
                // Wait for OpenLayers CHANGE_MAP_VIEW so the saved blob captures
                // the new center/zoom; fall back to a 2s timer.
                Rx.Observable.race(
                    action$.ofType(CHANGE_MAP_VIEW).take(1),
                    Rx.Observable.timer(2000)
                ).take(1).mapTo(saveDirectContent())
            ]
            : [Rx.Observable.of(saveDirectContent())]),
        Rx.Observable.of(updateUploadStatus('Complete')),
        Rx.Observable.of(initAnuga()),
        Rx.Observable.of(startAnugaModelCreationPolling()),
        Rx.Observable.defer(() => {
            const wmsLayers = store.getState()?.layers?.flat?.filter(l => l?.type === 'wms' && l?.group !== 'background') || [];
            return Rx.Observable.of(refreshLayers(wmsLayers));
        })
    );
    // Note: legacy pollAnugaTerrainEpic dispatched moveNode here to push the
    // Terrain sub-group to the end of Input Data, but that call passed
    // `nodes.length` as the insert index when the source was already in the
    // target's nodes — moveNode then injected a null at the old position,
    // crashing the TOC with "Cannot read properties of undefined (reading
    // 'nodes')". `addLayer` with `group: 'Input Data.Terrain'` already
    // routes the layer into the right sub-group via the ADD_LAYER reducer,
    // so the explicit moveNode is unnecessary.
};

const isLayerCompletionType = pt => pt === 'layer_create' || pt === 'terrain_create';

// V2P-714 follow-up: a completed terrain_create process is "orphaned" if
// the user has since deleted the underlying Terrain row. Replaying its
// addLayer side-effect on page reload would re-inject a layer whose
// backing GeoNode Dataset is 404 (cascade-cleaned). We classify each
// candidate against state.anuga.resources.terrain into one of:
//   present  — terrain row visible in state, definitely safe to replay
//   orphaned — terrain row known-missing, definitely skip
//   unknown  — can't decide yet, defer to next poll (don't mark handled)
//
// Three discrete bugs forced the current shape:
//
//   (a) Pre-rename Processes with metadata.terrain_id===null. Returning
//       'present' for those replays addLayer for layers whose Datasets
//       were cascade-deleted long ago (12 ele_3905/9-13 ghosts on a real
//       map blob in dev). The legacy procs have NO way to verify
//       existence — orphan-classify them and skip.
//
//   (b) `terrain.length === 0` is ambiguous (empty after fetch vs
//       not-fetched-yet). Use the explicit terrainLoaded flag stamped
//       by SET_ANUGA_TERRAIN_DATA to disambiguate.
//
//   (c) Fresh-create race: a terrain_create completion arriving
//       after a successful upload is in the polling stream BEFORE the
//       FE's cached terrain list has been refetched. The BE truth
//       (terrain row exists) and FE state (stale list, no row)
//       disagree. Earlier attempts used a recency-window heuristic
//       on `process.finished` to rescue this case; that fails because
//       real DEMs can take up to an HOUR to process — by the time the
//       FE polls, any time-window is wrong (either too short to catch
//       slow uploads, or too long to ever orphan-classify a true
//       cascade-delete). Instead: when terrainLoaded=true and id is
//       missing, dispatch initAnuga() to force a terrain refetch and
//       defer classification. On the next poll, if the id is still
//       missing post-refresh, it really IS orphaned. The caller's
//       refreshAttempted Set tracks per-process whether we've already
//       paid the refresh roundtrip, so at most one extra catalogue
//       fetch per truly-orphaned process per app boot.
const orphanStatus = (process, state, refreshAttempted) => {
    if (process.process_type !== 'terrain_create') return 'present';
    const terrainId = process.metadata?.terrain_id;
    // (a) Legacy procs: no terrain_id stamped → can't verify, treat as
    // orphaned. Marking handled prevents perpetual re-injection on
    // every page-load poll.
    if (terrainId === null || terrainId === undefined) return 'orphaned';
    const resources = state?.anuga?.resources;
    // (b) Resources slice not yet loaded → defer. The terrainLoaded
    // flag is stamped by SET_ANUGA_TERRAIN_DATA; while it's false the
    // initialState empty-array could mean anything. (No initAnuga
    // dispatch needed here — initAnugaEpic itself will fire the
    // catalogue fetch as soon as visibility/gnresource gates open.)
    if (!resources?.terrainLoaded) return 'unknown';
    const terrain = resources.terrain;
    if (Array.isArray(terrain) && terrain.some(e => e?.id === terrainId)) {
        return 'present';
    }
    // (c) terrain_id is set, terrain list is loaded, but id is missing.
    // First miss for this process: defer + caller dispatches initAnuga.
    // After refresh, if still missing → really orphaned.
    if (refreshAttempted && refreshAttempted.has(process.id)) {
        return 'orphaned';
    }
    return 'unknown';
};

// Per-map handled-completion-ids registry. store.getState() inside the
// epic returns POST-reduce state, so a prev/new byId diff is always empty.
// A persistent Set gives us a stable "have I handled this completion yet"
// signal independent of reducer timing. Persisted in localStorage keyed
// by mapId so it survives reload — without that, every reload re-flagged
// completed Processes as "new", re-firing addLayer (which is a no-op when
// the layer is already in `currentNames`) AND the "new layers found, save
// your project" banner for every completion whose name does NOT match an
// already-loaded layer (e.g. a Process whose Dataset was renamed, or one
// from a previous session). The TTL-pruned shape ([{id, ts}], 7d) keeps
// the registry from growing without bound across long-lived projects.
//
// refreshAttempted is the sibling per-app-boot Set used by the refresh-then-
// defer classifier (see orphanStatus comment block (c)). When a candidate's
// terrain_id is missing from the loaded terrain list, we dispatch initAnuga
// to force a catalogue refetch and add the candidate id here so the next
// tick can classify decisively as 'present' or 'orphaned'. Stays in-memory
// only — it represents the refresh-round-trip lifecycle for the current
// app boot, not a fact worth persisting across reloads.
export const taskCompleteLayerEpic = (action$, store) => {
    // Hydrated lazily per-mapId on the first matching action; the action
    // stream may fire before gnresource.id is available (initAnugaEpic
    // gates on it) so we re-hydrate when the seen mapId changes.
    let loadedForMapId = null;
    let handledCompletionIds = new Set();
    let handledEntries = [];
    // Buffer for handled entries captured while gnresource.id is still null
    // (TaskMonitor fires processes before gnresource hydrates on first paint).
    // Without this buffer, the in-memory Set guards the current page only;
    // on reload the same completions re-fire because persist no-op'd when
    // mapId was null. Flushed once on the first tick where mapId becomes
    // non-null.
    const pendingEntriesBeforeMapId = [];
    const refreshAttempted = new Set();
    return action$.ofType(TM_SET_PROCESSES)
        .switchMap((action) => {
            const processes = action.processes || [];
            const state = store.getState();
            const mapId = state?.gnresource?.id;
            const currentNames = state?.layers?.flat?.map(l => l?.name) || [];
            // (Re)hydrate the persisted Set the first time we see this
            // mapId in the action stream. Merge any pending entries that
            // were captured while mapId was null (Fix 2: retroactive flush).
            if (mapId !== undefined && mapId !== null && loadedForMapId !== mapId) {
                const hydrated = loadHandledCompletionIds(mapId);
                handledCompletionIds = hydrated.set;
                handledEntries = hydrated.entries;
                // Replay pending pre-mapId entries into the Set + entries
                // list so the next persist call flushes them to localStorage.
                if (pendingEntriesBeforeMapId.length > 0) {
                    pendingEntriesBeforeMapId.forEach(e => {
                        if (!handledCompletionIds.has(e.id)) {
                            handledCompletionIds.add(e.id);
                            handledEntries.push(e);
                        }
                    });
                    pendingEntriesBeforeMapId.length = 0;
                    const merged = persistHandledCompletionIds(mapId, handledCompletionIds, handledEntries);
                    if (merged) handledEntries = merged;
                }
                loadedForMapId = mapId;
            }
            // Defence-in-depth project scoping. The TaskMonitor poller is
            // gated on getProjectId being non-null (epicsTaskMonitor.js), and
            // the API requires ?project_id=<int> (taskmonitor/views.py). If
            // BOTH of those are ever bypassed and a Process from another
            // project lands in the action payload, we still won't addLayer it
            // here. The dedupe Set is per-mapId so it can't catch this case;
            // currentNames dedupe can't either, because mapstore_layer.name
            // embeds the source project id (e.g. geonode:rai_11550_rainfall_01).
            const currentProjectId = getProjectId(state);
            const candidates = processes.filter(
                p => isLayerCompletionType(p.process_type) &&
                     p.status === 'complete' &&
                     !handledCompletionIds.has(p.id) &&
                     (!currentProjectId || p.metadata?.project_id === currentProjectId)
            );
            if (!candidates.length) return Rx.Observable.empty();
            const classified = candidates.map(p => ({
                process: p,
                status: orphanStatus(p, state, refreshAttempted)
            }));
            // Mark handled only when we can decide. 'unknown' candidates stay
            // unmarked so the next poll (after initAnuga fills terrain) can
            // re-classify them. 'present' and 'orphaned' are decisive.
            let mutated = false;
            const now = Date.now();
            classified.forEach(c => {
                if (c.status !== 'unknown' && !handledCompletionIds.has(c.process.id)) {
                    handledCompletionIds.add(c.process.id);
                    const entry = { id: c.process.id, ts: now };
                    handledEntries.push(entry);
                    // If mapId is not yet hydrated, buffer the entry so it
                    // can be persisted retroactively once mapId arrives.
                    // Soft cap at 500 entries — drop oldest first — to bound
                    // memory growth on long-lived non-map contexts where
                    // mapId never hydrates.
                    if (mapId === null || mapId === undefined) {
                        pendingEntriesBeforeMapId.push(entry);
                        if (pendingEntriesBeforeMapId.length > 500) {
                            pendingEntriesBeforeMapId.shift();
                        }
                    }
                    mutated = true;
                }
            });
            if (mutated && mapId !== null && mapId !== undefined) {
                const merged = persistHandledCompletionIds(mapId, handledCompletionIds, handledEntries);
                if (merged) handledEntries = merged;
            }
            // Refresh-then-defer: 'unknown' candidates with terrain_id set
            // and terrainLoaded=true are fresh-upload-with-stale-list cases.
            // Force one initAnuga catalogue refetch and mark the id so the
            // next tick can decide. Candidates whose terrainLoaded=false
            // are intentionally NOT in this set — initAnugaEpic itself will
            // fire the catalogue fetch on its own gating signal.
            const refreshNeeded = classified.filter(c => {
                if (c.status !== 'unknown') return false;
                if (c.process.process_type !== 'terrain_create') return false;
                const tid = c.process.metadata?.terrain_id;
                if (tid === null || tid === undefined) return false;
                return state?.anuga?.resources?.terrainLoaded === true;
            });
            refreshNeeded.forEach(c => refreshAttempted.add(c.process.id));
            const newlyCompleted = classified
                .filter(c => c.status === 'present')
                .map(c => c.process);
            const observables = [];
            const refreshedEndpoints = new Set();
            newlyCompleted.forEach(p => {
                const dispatch = modelClassDispatch[p.metadata?.model_class];
                if (p.process_type === 'terrain_create' && Array.isArray(p.metadata?.mapstore_layers)) {
                    observables.push(buildTerrainAddSequence(p.metadata, action$, store, currentNames));
                } else if (p.metadata?.mapstore_layer) {
                    const baseLayerConfig = p.metadata.mapstore_layer;
                    if (!currentNames.includes(baseLayerConfig?.name)) {
                        // Stamp BE-resolved ANUGA group on the layer so the
                        // Layer Menu / Results tab filter at
                        // simpleViewMenuRows.js (gates on
                        // layer.group.split('.')[0]) routes it into the
                        // right tab without waiting for the next
                        // FIX_ANUGA_GROUPS tick (which only fires on
                        // page-load via initAnugaEpic).
                        const resolvedGroup = resolveAnugaGroup(p.metadata, baseLayerConfig);
                        const layerConfig = resolvedGroup
                            ? Object.assign({}, baseLayerConfig, { group: resolvedGroup })
                            : baseLayerConfig;
                        observables.push(Rx.Observable.of(addLayer(layerConfig)));
                        // TASK-1650 (W1.5): info toast removed — auto-added
                        // input layers appear in the Inputs panel immediately.
                    }
                } else if (dispatch?.addAction) {
                    observables.push(Rx.Observable.of(dispatch.addAction()));
                }
                // Refresh state.anuga.resources.<type> on non-terrain
                // layer_create completion. The branches above inject the
                // map layer but never update resources.<type>, leaving the
                // Scenarios > Required dropdowns (which read
                // resources.inflows / .rainfalls / etc.) stale on fresh
                // projects where the page-load fan-out raced
                // `create_supporting_models`. Dedupe by endpoint within
                // the batch so 6 defaults completing in one tick fire 6
                // distinct fetches, not 6 × N.
                if (p.process_type === 'layer_create' && currentProjectId && dispatch
                    && !refreshedEndpoints.has(dispatch.endpoint)) {
                    refreshedEndpoints.add(dispatch.endpoint);
                    observables.push(
                        fetchResourceEndpoint(dispatch.endpoint, currentProjectId).map(dispatch.setAction)
                    );
                }
            });
            // UAT-2026-06-29 finding #1 (option C residual): the orphan
            // CLASSIFICATION refresh — refetch the terrain LIST only, not a full
            // initAnuga(). The refresh-then-defer exists solely so orphanStatus()
            // can decide an 'unknown' terrain_create whose terrain_id is absent
            // from the loaded list (e.g. a model-less orphan whose CASCADE-
            // surviving COGs linger after the Terrain row was deleted, like
            // ele_84855). A full initAnuga() re-fired POST /from-map + getProjectV2
            // + the whole resource fan-out + polling restart on EVERY open of an
            // orphan-bearing map (a 2nd from-map ~10s after the first, right after
            // the closed-panel TaskMonitor poll). All orphanStatus() needs is a
            // fresh terrain list, so refetch ONLY that — the same surgical pattern
            // as the non-terrain layer_create branch above. setAnugaTerrainData
            // sets terrainLoaded=true and re-drives the (display-only)
            // terrainSubOrderReconcilerEpic, so orphan ordering is preserved;
            // convergence to 'orphaned' is driven by refreshAttempted.add() above,
            // independent of this dispatch. currentProjectId is non-null here (the
            // 'unknown' branch requires terrainLoaded===true, set only after a
            // project-scoped fetch); the initAnuga() fallback is defensive.
            // PUSHED LAST (after the add-loop): concat() subscribes sequentially,
            // so an async fetch placed first would block the synchronous addLayer /
            // buildTerrainAddSequence dispatches behind a network round-trip.
            if (refreshNeeded.length > 0) {
                observables.push(currentProjectId
                    ? fetchResourceEndpoint('terrain', currentProjectId).map(setAnugaTerrainData)
                    : Rx.Observable.of(initAnuga()));
            }
            return observables.length > 0
                ? Rx.Observable.concat(...observables)
                : Rx.Observable.empty();
        });
};

// -- MapLayer group assignment: move auto-added MapLayers to correct ANUGA groups --
export const anugaMapLayerGroupEpic = (action$, store) =>
    action$
        .ofType(FIX_ANUGA_GROUPS)
        .delay(500)  // wait for ensureAnugaGroupsEpic to create group tree
        .switchMap(() => {
            const layers = store.getState()?.layers?.flat || [];
            const actions = [];
            layers.forEach(layer => {
                const anugaGroup = layer?.extendedParams?.mapLayer?.extra_params?.anuga_group;
                if (anugaGroup && layer.group !== anugaGroup) {
                    actions.push(moveNode(layer.id, anugaGroup, 0));
                }
            });
            return actions.length > 0
                ? Rx.Observable.from(actions)
                : Rx.Observable.empty();
        });

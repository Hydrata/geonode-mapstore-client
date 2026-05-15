import Rx from "rxjs";
import {
    addLayer,
    addGroup,
    removeLayer,
    refreshLayers,
    moveNode
} from '../../../../../MapStore2/web/client/actions/layers';
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {zoomToExtent, CHANGE_MAP_VIEW} from "../../../../../MapStore2/web/client/actions/map";
import {getNode} from '../../../../../MapStore2/web/client/utils/LayersUtils';
import {saveDirectContent} from "@js/actions/gnsave";
import * as anugaApi from '../api/anugaApi';
import {
    ADD_ANUGA_BOUNDARY,
    ADD_ANUGA_FRICTION,
    ADD_ANUGA_INFLOW,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    ADD_ANUGA_RAINFALL,
    ADD_ANUGA_STRUCTURE,
    ADD_ANUGA_FULL_MESH,
    ADD_ANUGA_MESH_REGION,
    ADD_LUMPED_CATCHMENT,
    ADD_NODES,
    ADD_LINKS,
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
    setAnugaScenarioData,
    setAnugaScenarioResultsLoaded,
    setAnugaStructureData,
    setPublicationData,
    setComparisonData,
    START_ANUGA_MODEL_CREATION_POLLING,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    startAnugaModelCreationPolling,
    startAnugaScenarioPolling,
    stopActiveRunPolling,
    updateRunStatus,
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
import {SHOW_ANUGA_SCENARIO_LOG} from "../actions/uiActions";

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
    .catch(() => Rx.Observable.of({data: {}}))
    .switchMap(response => Rx.Observable.of(response.data));

export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA, UPDATE_DATASET_TITLE_SUCCESS)
        .filter(() => store.getState().gnresource.id)
        // TASK-603: drop init catalogue project-poll when tab is hidden.
        // Use withLatestFrom rather than switchMap-on-visibility$ here because
        // initAnugaEpic is action-driven (one-shot per action), not timer-driven.
        // If the user fires INIT_ANUGA while hidden we simply skip the catalogue
        // refresh — the next INIT_ANUGA after the tab becomes visible will run.
        .withLatestFrom(visibility$)
        .filter(([_, isVisible]) => isVisible)
        .map(([action]) => action)
        .switchMap(() =>
            Rx.Observable.from(anugaApi.getProjectFromMapId(store.getState().gnresource.id))
                .catch(() => Rx.Observable.empty())
        )
        .filter(() => !!store.getState()?.security?.user)
        .switchMap(response1 => {
            const projectId = response1.data.projectId;
            // Use v2 for project detail
            return Rx.Observable.from(anugaApi.getProjectV2(projectId))
                .catch(() => Rx.Observable.empty())
                .switchMap(response2 => {
                    // Respect the persisted archiveFilter so a panel reopen
                    // after switching to 'Archived' restores the same view.
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
        });

// V2P-79: model-creation polling fans out add-layer actions every 60s as a
// safety-net for layer addition. Pre-V2P-79 those add-actions hit V1
// `/available/` endpoints to discover new layers; V2 has no `/available/`
// route — layer addition is now driven by:
//   * `taskCompleteLayerEpic` (event-driven, on TaskMonitor process completion)
//   * MapLayer auto-injection at map-load (extra_params.anuga_group)
//   * `addLayer(response.data.mapstore_layer)` inside makeCreateEpic
//
// Per V2P-79 spec ("Remove /available/ polling — replaced by MapLayer
// system") we still listen for START_ANUGA_MODEL_CREATION_POLLING so the
// initAnuga chain doesn't surface an unhandled-action warning, but we no
// longer fan out the legacy add-actions. takeUntil retained for parity
// with the prior cancellation contract.
//
// TASK-603 visibility gate retained around the future-poll site so a
// re-introduction of polling here remains tab-aware by default.
export const pollAnugaModelCreationEpic = (action$) =>
    action$
        .ofType(START_ANUGA_MODEL_CREATION_POLLING)
        .switchMap(() =>
            visibility$.switchMap(isVisible =>
                isVisible
                    // V2P-79: previous V1 `/available/` fan-out removed.
                    // The MapLayer + taskCompleteLayerEpic chain is now the
                    // single source of layer-injection; this poll has no
                    // remaining work to do.
                    ? Rx.Observable.empty()
                    : Rx.Observable.never()
            ).takeUntil(action$.ofType(STOP_ANUGA_MODEL_CREATION_POLLING))
        );

const isScenarioLoaded = (scenario, state) => {
    const depth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_max?.name);
    const velocityDepth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_integrated_velocity_max?.name);
    const velocity = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_velocity_max?.name);
    return !!depth?.length && !!velocityDepth?.length && !!velocity?.length;
};

// Polling is started once per init via startAnugaScenarioPolling in
// initAnugaEpic — switchMap ensures only one active subscription at a time.
// Each poll reads the FE's archiveFilter ('none' default, 'only' for the
// Archived tab, 'all' for both) and passes it to the BE via
// getScenariosByArchive. The call still drives setAnugaPollingData so the
// row-update + new-row paths in the reducer don't change.
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
                                let backendScenariosToLoadResults = action.scenarios?.filter(scenario =>
                                    (scenario.computed_status === 'complete' || scenario.latest_run?.status === 'complete')
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
                                const newResultLayerTitles = [
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.title,
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.title,
                                    scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.title
                                ];
                                let existingResultLayers = store.getState()?.layers?.flat?.filter(layer => newResultLayerTitles.includes(layer?.title));
                                if (scenarioToLoadResults &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.catalogURL &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.name)
                                ) {
                                    const depthVelocityLayer = scenarioToLoadResults.latest_run.gn_layer_depth_integrated_velocity_max;
                                    const depthLayer = scenarioToLoadResults.latest_run.gn_layer_depth_max;
                                    const velocityLayer = scenarioToLoadResults.latest_run.gn_layer_velocity_max;
                                    return Rx.Observable
                                        .concat(
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[0]?.id)),
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[1]?.id)),
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[2]?.id)),
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

// New: lightweight run-status poller for active runs (3s interval)
export const pollActiveRunStatusEpic = (action$) =>
    action$
        .ofType(START_ACTIVE_RUN_POLLING)
        .switchMap((action) => {
            const runId = action.runId;
            return Rx.Observable.timer(0, 3000)
                .takeUntil(action$.ofType(STOP_ACTIVE_RUN_POLLING).filter(a => a.runId === runId))
                .exhaustMap(() =>
                    Rx.Observable.from(anugaApi.getRunStatus(runId))
                        .catch(() => Rx.Observable.empty())
                )
                .concatMap(response => {
                    const data = response.data;
                    const actions = [
                        updateRunStatus(runId, data)
                    ];
                    if (TERMINAL_RUN_STATES.includes(data?.status)) {
                        actions.push(stopActiveRunPolling(runId));
                    }
                    return Rx.Observable.from(actions);
                });
        });

// Tail the latest_run log while the scenario log viewer is open. There is
// NO `latest_run.log` BE endpoint; the log viewer is passive and reads
// `state.anuga.scenarios.byId[id].latest_run.log`. This epic refreshes
// that slice by polling `getRun(latest_run.id)` every 3s while the viewer
// is open AND the run status is non-terminal.
//
// Trigger semantics: SHOW_ANUGA_SCENARIO_LOG with a truthy scenarioId opens
// the viewer; the SAME action with `scenarioId === false` closes it (see
// anugaScenarioLogViewer.js calling `showAnugaScenarioLog(false)`). There is
// no separate HIDE action — we filter the SHOW stream by truthiness for
// start, and use `takeUntil` on the falsy SHOW for stop.
//
// State-read discipline: each tick reads store.getState() via
// `Observable.defer(...)` so closure-captured state cannot go stale across
// the 3s window — between ticks the user can save/cancel/copy the scenario,
// or the BE poller can flip `latest_run` to a terminal status. Reading at
// emission time (not at SHOW time) avoids both classes of staleness.
//
// switchMap (not mergeMap): re-opening the same viewer or switching to a
// different scenario id should cancel any in-flight poll and re-subscribe.
// Cap of one concurrent poll per epic instance.
//
// We dispatch `setAnugaPollingData([{ id, latest_run }])`, which the
// scenariosReducer's SET_ANUGA_POLLING_DATA branch merges into byId[id]
// without disturbing local-only fields (`unsaved`, `selected`, `tempTimeString`).
// `anugaContainer.js:230` reads `selectedScenario.latest_run.log` from that
// same byId entry, so the next render reflects the freshly fetched log text.
export const tailScenarioLogEpic = (action$, store) =>
    action$
        .ofType(SHOW_ANUGA_SCENARIO_LOG)
        .filter(action => !!action.scenarioId)
        .switchMap(() =>
            Rx.Observable.interval(3000)
                .startWith(0)
                .takeUntil(
                    action$.ofType(SHOW_ANUGA_SCENARIO_LOG).filter(a => !a.scenarioId)
                )
                .switchMap(() =>
                    Rx.Observable.defer(() => {
                        const state = store.getState();
                        const scenarioId = state?.anuga?.ui?.visibleAnugaScenarioLogId;
                        if (!scenarioId) return Rx.Observable.empty();
                        const scenario = state?.anuga?.scenarios?.byId?.[scenarioId];
                        const currentRun = scenario?.latest_run;
                        const runId = currentRun?.id;
                        const runStatus = currentRun?.status;
                        if (!runId) return Rx.Observable.empty();
                        if (TERMINAL_RUN_STATES.includes(runStatus)) {
                            return Rx.Observable.empty();
                        }
                        // Same-payload guard: when getRun returns a run whose
                        // log length AND status are byte-identical to the slice
                        // we already hold, skip the dispatch. The common case
                        // during long ANUGA runs is a slow log trickle — most
                        // 3s ticks return the same bytes and the prior
                        // unconditional dispatch caused a reducer merge,
                        // connected-component re-render, and DOM textarea
                        // re-render with no user-visible delta.
                        return Rx.Observable.from(anugaApi.getRun(runId))
                            .catch(() => Rx.Observable.empty())
                            .switchMap(response => {
                                const next = response.data;
                                const same =
                                    next?.log?.length === currentRun?.log?.length &&
                                    next?.status === currentRun?.status;
                                if (same) return Rx.Observable.empty();
                                return Rx.Observable.of(setAnugaPollingData([{
                                    id: scenarioId,
                                    latest_run: next
                                }]));
                            });
                    })
                )
        );

// -- Ensure ANUGA group tree exists before layers are added ----------------

const ANUGA_GROUPS = {
    "Input Data": [
        "Terrain", "Boundaries", "Structures", "Inflows",
        // TASK-955 (W2.2 FE) — Rainfall input group (sits next to Inflows so the
        // legend ordering matches the new polygon-vs-line input split). BE
        // INPUT_DATA_GROUP_MAP entry for the 'rai' prefix lands in a follow-up
        // BE task; until then, no layer.group will resolve to 'Input Data.Rainfall'
        // and the empty group renders quietly.
        "Rainfall",
        "Friction", "Full Mesh", "Mesh Regions",
        "Catchments", "Nodes", "Links"
    ],
    "Results": [
        "Depth", "Depth Integrated Velocity", "Velocity",
        "Comparison: Velocity", "Comparison: Depth",
        "Comparison: Depth Integrated Velocity"
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

// -- Add-layer epics (V2P-79: no-op stubs) ---------------------------------
//
// Pre-V2P-79 these epics fetched `/anuga/api/{pid}/{type}/available/` and
// dispatched addLayer() for each candidate. V2 has no /available/ route —
// per V2P-79 spec the layer-picker is replaced by:
//   * `taskCompleteLayerEpic` (event-driven on TaskMonitor completion)
//   * MapLayer auto-injection (anuga_group extra_param at load time)
//   * `addLayer(response.data.mapstore_layer)` inside makeCreateEpic
//
// We retain each epic name so Anuga.js plugin registration stays atomic
// and dispatchers (pollAnugaModelCreationEpic, taskCompleteLayerEpic,
// anugaInputMenu) don't surface unhandled-action warnings if they fire
// the action. The epics now match the action type but emit nothing — the
// legacy "fetch available layers and inject" work has already happened by
// the time these fire in V2.
const noOpEpic = (actionType) => (action$) =>
    action$
        .ofType(actionType)
        .switchMap(() => Rx.Observable.empty());

export const addAnugaBoundaryEpic = noOpEpic(ADD_ANUGA_BOUNDARY);
export const addAnugaFrictionEpic = noOpEpic(ADD_ANUGA_FRICTION);
export const addAnugaInflowEpic = noOpEpic(ADD_ANUGA_INFLOW);
// TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
export const addAnugaRainfallEpic = noOpEpic(ADD_ANUGA_RAINFALL);
export const addAnugaStructureEpic = noOpEpic(ADD_ANUGA_STRUCTURE);
export const addAnugaFullMeshEpic = noOpEpic(ADD_ANUGA_FULL_MESH);
export const addAnugaMeshRegionEpic = noOpEpic(ADD_ANUGA_MESH_REGION);
export const addCatchmentEpic = noOpEpic(ADD_LUMPED_CATCHMENT);
export const addNodesEpic = noOpEpic(ADD_NODES);
export const addLinksEpic = noOpEpic(ADD_LINKS);

// -- Fix 3: Event-driven layer addition on TaskMonitor completion ----------
// When a layer_create process completes, dispatch the appropriate add action
// to fetch available layers for that resource type immediately.

const modelClassToAddAction = {
    'Boundary': addAnugaBoundary,
    'Inflow': addAnugaInflow,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow). Process
    // metadata.model_class is the Python class name ('Rainfall'), set by
    // _stamp_layer_create_process in /opt/hydrata/apps/gn_anuga/tasks.py.
    'Rainfall': addAnugaRainfall,
    'Friction': addAnugaFriction,
    'Structure': addAnugaStructure,
    'FullMesh': addAnugaFullMesh,
    'MeshRegion': addAnugaMeshRegion,
    'Catchment': addCatchment,
    'Nodes': addNodes,
    'Links': addLinks
};

// Multi-layer terrain handoff. Adds DEM + hillshade together, then runs
// the post-add chain (refresh, first-upload zoom + save race, group placement,
// status update, model-creation polling kickoff). Driven by Process metadata
// stamped by the create_terrain_gn_layer celery task.
const buildTerrainAddSequence = (metadata, action$, store) => {
    const layers = Array.isArray(metadata?.mapstore_layers) ? metadata.mapstore_layers : [];
    const isFirstUpload = !!metadata?.is_first_upload;
    const firstLayer = layers[0];
    const currentNames = store.getState()?.layers?.flat?.map(l => l?.name) || [];
    const newLayers = layers.filter(l => l?.name && !currentNames.includes(l.name));
    if (!newLayers.length) {
        return Rx.Observable.empty();
    }
    return Rx.Observable.concat(
        Rx.Observable.defer(() => {
            const wmsLayers = store.getState()?.layers?.flat?.filter(l => l?.type === 'wms' && l?.group !== 'background') || [];
            return Rx.Observable.of(refreshLayers(wmsLayers));
        }),
        ...newLayers.map(l => Rx.Observable.of(addLayer(l))),
        Rx.Observable.of(show({
            "message": "hydrata.anuga.newLayersMessage",
            "title": "hydrata.anuga.newLayersTitle",
            "uid": 1000,
            "position": "tc"
        })),
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

// Per-instance set of completion IDs we've already dispatched addLayer for.
// store.getState() inside the epic returns POST-reduce state, so a prev/new
// byId diff is always empty. A closure-scoped Set gives us a stable
// "have I handled this completion yet" signal independent of reducer timing.
// Reset on page reload (single epic instance per app boot), which is fine
// because MapLayer auto-injection on reload re-populates layers.flat.
//
// refreshAttempted is the sibling per-app-boot Set used by the refresh-then-
// defer classifier (see orphanStatus comment block (c)). When a candidate's
// terrain_id is missing from the loaded terrain list, we dispatch initAnuga
// to force a catalogue refetch and add the candidate id here so the next
// tick can classify decisively as 'present' or 'orphaned'.
export const taskCompleteLayerEpic = (action$, store) => {
    const handledCompletionIds = new Set();
    const refreshAttempted = new Set();
    return action$.ofType(TM_SET_PROCESSES)
        .switchMap((action) => {
            const processes = action.processes || [];
            const candidates = processes.filter(
                p => isLayerCompletionType(p.process_type) &&
                     p.status === 'complete' &&
                     !handledCompletionIds.has(p.id)
            );
            if (!candidates.length) return Rx.Observable.empty();
            const state = store.getState();
            const classified = candidates.map(p => ({
                process: p,
                status: orphanStatus(p, state, refreshAttempted)
            }));
            // Mark handled only when we can decide. 'unknown' candidates stay
            // unmarked so the next poll (after initAnuga fills terrain) can
            // re-classify them. 'present' and 'orphaned' are decisive.
            classified.forEach(c => {
                if (c.status !== 'unknown') handledCompletionIds.add(c.process.id);
            });
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
            if (refreshNeeded.length > 0) {
                observables.push(Rx.Observable.of(initAnuga()));
            }
            newlyCompleted.forEach(p => {
                if (p.process_type === 'terrain_create' && Array.isArray(p.metadata?.mapstore_layers)) {
                    observables.push(buildTerrainAddSequence(p.metadata, action$, store));
                } else if (p.metadata?.mapstore_layer) {
                    const layerConfig = p.metadata.mapstore_layer;
                    const currentNames = store.getState()?.layers?.flat?.map(l => l?.name) || [];
                    if (!currentNames.includes(layerConfig?.name)) {
                        observables.push(Rx.Observable.of(addLayer(layerConfig)));
                        observables.push(Rx.Observable.of(show({
                            "message": "hydrata.anuga.newLayersMessage",
                            "title": "hydrata.anuga.newLayersTitle",
                            "uid": 1000,
                            "position": "tc"
                        })));
                    }
                } else {
                    const modelClass = p.metadata?.model_class;
                    const actionCreator = modelClassToAddAction[modelClass];
                    if (actionCreator) observables.push(Rx.Observable.of(actionCreator()));
                }
            });
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

import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {addLayer, removeLayer, removeNode} from '../../../../../MapStore2/web/client/actions/layers';
import * as anugaApi from '../api/anugaApi';
// TASK-2100 (epic 2092 W4.2) — StartRunView's meter gate 402/429 contract.
// TASK-2123 (epic 2092 W5-preflip) — adds the estimate_ceiling 402 branch.
import {setMeterInsufficientBalance, setMeterCapExceeded, setMeterEstimateCeiling} from '../../Paywall/meter/actions';
// Shared axios error-shape readers (epic-2092 W4 simplify pass — see the
// util's own docstring for the MapStore2 ajax-interceptor gotcha).
import {readErrStatus as _readErrStatus, readErrData as _readErrData} from '../utils/apiErrorUtils';
import {
    CANCEL_ANUGA_RUN,
    RETRY_ANUGA_RUN,
    SAVE_NETWORK,
    CREATE_ANUGA_BOUNDARY,
    CREATE_ANUGA_FRICTION,
    CREATE_ANUGA_INFLOW,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    CREATE_ANUGA_RAINFALL,
    CREATE_ANUGA_MESH_REGION,
    CREATE_ANUGA_STRUCTURE,
    // TASK-1594 (W1) — Culvert create action.
    CREATE_ANUGA_CULVERT,
    CREATE_NETWORK,
    CREATE_FIGURE,
    CREATE_LUMPED_CATCHMENT,
    CREATE_NODES,
    CREATE_LINKS,
    DELETE_ANUGA_SCENARIO,
    deleteAnugaScenarioSuccess,
    DUPLICATE_ANUGA_SCENARIO,
    duplicateAnugaScenarioSuccess,
    ARCHIVE_ANUGA_SCENARIO,
    archiveAnugaScenarioSuccess,
    // Wave 3C C5: archiveAnugaScenarioError → showArchiveError. Toast-only
    // (no Redux action dispatch); the prior ARCHIVE_ANUGA_SCENARIO_ERROR
    // action had no reducer or middleware consumer.
    showArchiveError,
    UNARCHIVE_ANUGA_SCENARIO,
    unarchiveAnugaScenarioSuccess,
    initAnuga,
    INIT_ANUGA,
    RUN_ANUGA_SCENARIO,
    runAnugaScenarioSuccess,
    // TASK-2194 (epic 2190 W2) — staff compute-target selector site config.
    setAnugaComputeConfig,
    RUN_NETWORK,
    runNetworkSuccess,
    setNetworkMenu,
    SAVE_ANUGA_SCENARIO,
    saveAnugaScenarioError,
    saveAnugaScenarioSuccess,
    BUILD_SCENARIO,
    buildScenarioSuccess,
    buildScenarioError,
    setAnugaScenarioMenu,
    setCreatingAnugaLayer,
    UPDATE_COMPUTE_INSTANCE,
    updateComputeInstanceSuccess,
    COMPARE_SCENARIOS,
    compareScenariosSuccess,
    UPDATE_ANUGA_RESOURCES,
    setAnugaResources,
    startActiveRunPolling,
    // V2P-714 — cascade-delete dataset rows
    DELETE_TERRAIN,
    DELETE_BOUNDARY,
    DELETE_FRICTION,
    DELETE_INFLOW,
    // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
    DELETE_RAINFALL,
    deleteTerrainSuccess,
    deleteTerrainBlocked,
    deleteTerrainError,
    deleteBoundarySuccess,
    deleteBoundaryBlocked,
    deleteBoundaryError,
    deleteFrictionSuccess,
    deleteFrictionBlocked,
    deleteFrictionError,
    deleteInflowSuccess,
    deleteInflowBlocked,
    deleteInflowError,
    // TASK-955 — Rainfall cascade-delete creators (mirror inflow shape).
    deleteRainfallSuccess,
    deleteRainfallBlocked,
    deleteRainfallError,
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    DELETE_STRUCTURE,
    DELETE_MESH_REGION,
    DELETE_CATCHMENT,
    DELETE_NODES,
    DELETE_LINKS,
    deleteStructureSuccess,
    deleteStructureBlocked,
    deleteStructureError,
    deleteMeshRegionSuccess,
    deleteMeshRegionBlocked,
    deleteMeshRegionError,
    deleteCatchmentSuccess,
    deleteCatchmentBlocked,
    deleteCatchmentError,
    deleteNodesSuccess,
    deleteNodesBlocked,
    deleteNodesError,
    deleteLinksSuccess,
    deleteLinksBlocked,
    deleteLinksError,
    // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
    DELETE_FRICTION_RASTER,
    deleteFrictionRasterSuccess,
    deleteFrictionRasterBlocked,
    deleteFrictionRasterError,
    // Self-heal: terrain list load = trigger to prune blob-resident ghost
    // terrain layers (Terrain rows + Datasets deleted server-side after a
    // re-derive). Reducer stamps resources.terrain + terrainLoaded on this.
    SET_ANUGA_TERRAIN_DATA
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE
} from "../../SimpleView/actionsSimpleView";
import {getAnugaModels, getProjectId, canEditAnugaMap} from "../selectorsAnuga";
import {resourceError} from "@js/actions/gnresource";
import {saveDirectContent} from "@js/actions/gnsave";
// Authoritative bare-name helper (strips the `geonode:` workspace prefix) —
// the same copy cursorElevationEpic / profileEpic import, so terrain
// name-matching stays consistent across epics.
import {bareName} from "./terrainEpics";

// -- Create-resource epics (create + trigger add-layer) --------------------
// Fix 1: If the POST response includes mapstore_layer data, add the layer
// directly instead of calling the /available/ endpoint (prevents ghost layers).
// For async creation (Fix 2), mapstore_layer won't be present — the layer
// will be added when the TaskMonitor process completes or via fallback polling.

const makeCreateEpic = (actionType, resourceType, titleKey) => (action$, store) =>
    action$
        .ofType(actionType)
        .switchMap((action) =>
            Rx.Observable
                .from(anugaApi.createResource(
                    getProjectId(store.getState()),
                    resourceType,
                    {
                        project: getProjectId(store.getState()),
                        title: action[titleKey]
                    }
                ))
                .catch(() => Rx.Observable.of(null))
                .switchMap((response) => {
                    if (!response) return Rx.Observable.of(setCreatingAnugaLayer(false));
                    const actions = [initAnuga(), setCreatingAnugaLayer(false)];
                    const layer = response?.data?.mapstore_layer;
                    if (layer && store.getState().layers.flat.filter(l => l?.name === layer?.name).length === 0) {
                        actions.unshift(addLayer(layer));
                        actions.push(show({
                            "message": "hydrata.anuga.newLayersMessage",
                            "title": "hydrata.anuga.newLayersTitle",
                            "uid": 1000,
                            "position": "tc"
                        }));
                    }
                    return Rx.Observable.from(actions);
                })
        );

export const createAnugaBoundaryEpic = makeCreateEpic(CREATE_ANUGA_BOUNDARY, 'boundary', 'boundaryTitle');
export const createAnugaFrictionEpic = makeCreateEpic(CREATE_ANUGA_FRICTION, 'friction', 'frictionTitle');
export const createAnugaInflowEpic = makeCreateEpic(CREATE_ANUGA_INFLOW, 'inflow', 'inflowTitle');
// TASK-955 (W2.2 FE) — Rainfall create epic. `'rainfall'` routes via
// V1_CREATE_ONLY_TYPES (anugaApi.createResource); GET/PATCH/DELETE go V2.
export const createAnugaRainfallEpic = makeCreateEpic(CREATE_ANUGA_RAINFALL, 'rainfall', 'rainfallTitle');
export const createAnugaStructureEpic = makeCreateEpic(CREATE_ANUGA_STRUCTURE, 'structure', 'structureTitle');
export const createAnugaMeshRegionEpic = makeCreateEpic(CREATE_ANUGA_MESH_REGION, 'mesh-region', 'meshRegionTitle');
// TASK-1594 (W1) — Culvert: terrain-workbench drainage structure creation.
export const createAnugaCulvertEpic = makeCreateEpic(CREATE_ANUGA_CULVERT, 'culvert', 'culvertTitle');
export const createNetworkEpic = makeCreateEpic(CREATE_NETWORK, 'network', 'networkTitle');
export const createCatchmentEpic = makeCreateEpic(CREATE_LUMPED_CATCHMENT, 'catchment', 'catchmentTitle');
export const createNodesEpic = makeCreateEpic(CREATE_NODES, 'nodes', 'nodesTitle');
export const createLinksEpic = makeCreateEpic(CREATE_LINKS, 'links', 'linksTitle');

// -- Scenario CRUD ---------------------------------------------------------

export const deleteAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(DELETE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.deleteScenarioV2(getProjectId(store.getState()), action.scenario.id)
            )
                .catch(() => Rx.Observable.empty())
                .concatMap((response) => Rx.Observable.of(deleteAnugaScenarioSuccess(response.data)))
        );

// Reducer appends to byId/allIds on DUPLICATE_ANUGA_SCENARIO_SUCCESS — no
// full INIT_ANUGA needed.
export const duplicateAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(DUPLICATE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.duplicateScenario(getProjectId(store.getState()), action.scenario.id)
            )
                .catch(() => Rx.Observable.empty())
                .concatMap((response) => Rx.Observable.of(duplicateAnugaScenarioSuccess(response.data)))
        );

// 412 Precondition Failed surfaces a user-visible toast (the scenario has an
// active/queued run). Wave 3C C5: the catch handler now dispatches only the
// toast thunk — the prior ARCHIVE_ANUGA_SCENARIO_ERROR action had no
// reducer or middleware consumer. Wave 3C C1 also pre-disables the Archive
// button while a run is in flight, so this 412 path is now a defence-in-depth
// fallback (race window between the BE flipping a run to terminal and the
// FE poller refreshing the row).
export const archiveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(ARCHIVE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.archiveScenario(getProjectId(store.getState()), action.scenario.id)
            )
                .concatMap((response) => Rx.Observable.of(archiveAnugaScenarioSuccess(response.data)))
                // axios surfaces 4xx as a thrown error with .response; pull the
                // BE detail string off and route through the toast thunk.
                // Fallback to err.data covers test mocks that don't construct
                // a full response object on the thrown error.
                .catch((err) => Rx.Observable.of(
                    showArchiveError(err?.response?.data || err?.data)
                ))
        );

// Simpler than archive: no 412 case, since unarchive is always safe (it
// can't break an active run). Errors fall through to Rx.Observable.empty
// so the polling tick re-syncs state.
export const unarchiveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(UNARCHIVE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.unarchiveScenario(getProjectId(store.getState()), action.scenario.id)
            )
                .catch(() => Rx.Observable.empty())
                .concatMap((response) => Rx.Observable.of(unarchiveAnugaScenarioSuccess(response.data)))
        );

// Bug #2 fix: restructured so runAnugaScenarioSuccess dispatch is emitted
// into the observable chain (previously swallowed by .then inside .concatMap)
//
// TASK-2100 (epic 2092 W4.2): StartRunView's meter gate (TASK-2097) can
// refuse dispatch with a 402 (insufficient_balance, contract-shaped like the
// paywall 402) or a 429 (FREE_CAP_EXCEEDED, distinct message per AC#3) —
// both now route to the compute-meter modal instead of the pre-existing
// silent swallow, which is preserved for every OTHER error (unrelated to
// this task; not touching that behaviour).
export const runAnugaScenarioEpic = (action$, _store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                // TASK-2194 — flat compute target (null -> field omitted,
                // server resolves the site default); compute_backend is no
                // longer sent on any dispatch path.
                anugaApi.startRun(action.scenario.id, action.computeTarget)
            )
                .concatMap((response) => {
                    const runId = response?.data?.id;
                    return Rx.Observable.of(
                        runAnugaScenarioSuccess(response.data),
                        setAnugaScenarioMenu(true),
                        ...(runId ? [startActiveRunPolling(runId)] : [])
                    );
                })
                .catch((err) => {
                    const status = _readErrStatus(err);
                    const data = _readErrData(err);
                    if (status === 402 && data?.state === 'insufficient_balance') {
                        return Rx.Observable.of(setMeterInsufficientBalance(data.checkout_url, data.detail));
                    }
                    // TASK-2123 — a known, too-expensive estimate (above the
                    // launch ceiling). Distinct modal from insufficient_balance
                    // (both are 402s, but the state discriminates) — no CTA can
                    // fix this, so no checkout_url is expected in the body.
                    if (status === 402 && data?.state === 'estimate_ceiling') {
                        return Rx.Observable.of(setMeterEstimateCeiling(data.detail));
                    }
                    if (status === 429 && data?.error_code === 'FREE_CAP_EXCEEDED') {
                        return Rx.Observable.of(setMeterCapExceeded(data.detail));
                    }
                    return Rx.Observable.empty();
                })
        );

// TASK-2194 (epic 2190 W2) — hydrate the compute-target site config once per
// session on the first INIT_ANUGA (panel open), mirroring Hydrology's
// loadAnugaConfigEpic / computeMeterEpics' balance fetch. getAnugaConfig()
// already catches network errors (returns an empty-allowlist fallback), so
// this epic always settles: an unreachable endpoint just leaves the staff
// selector hidden (empty allowlist) and dispatch omits compute_target.
export const loadAnugaComputeConfigEpic = (action$) =>
    action$
        .ofType(INIT_ANUGA)
        .take(1)
        .mergeMap(() =>
            Rx.Observable.from(anugaApi.getAnugaConfig())
                .map((cfg) => setAnugaComputeConfig(cfg))
                .catch(() => Rx.Observable.empty())
        );

// Bug #1 fix: removed the spurious runScenario call before cancel.
// Now calls cancelRun(runId) directly.
export const cancelAnugaRunEpic = (action$) =>
    action$
        .ofType(CANCEL_ANUGA_RUN)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.cancelRun(action.runId)
            )
                .concatMap(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.cancelled"}, "info")
                ))
                .catch((error) => {
                    // 409 = already terminal — show info instead of error
                    if (error?.response?.status === 409) {
                        return Rx.Observable.of(
                            show({"message": "hydrata.anuga.cancelError"}, "warning")
                        );
                    }
                    return Rx.Observable.empty();
                })
        );

// New: retry a failed run
//
// TASK-2042 (F2-residual): retry now re-enqueues a fresh build for the
// scenario (BE dispatch_scenario_build), not just resets the errored run —
// so the run this epic was told to retry (action.runId) stays 'created'
// permanently while the REAL new work lands on a brand-new Run row the BE
// creates asynchronously (build_simulation_package always creates a new Run;
// see its docstring). Polling that old, now-superseded run id would show a
// permanently-static 'created' status — misleading, not just useless — so
// this no longer arms startActiveRunPolling. The Scenarios panel already
// polls scenario status continuously while it is mounted
// (anugaContainer.js's Scenarios-tab toggle calls startAnugaScenarioPolling,
// and Retry is only reachable from inside that mounted panel), so the
// scenario's computed_status (created -> building -> built) is already live
// without any extra polling here.
export const retryAnugaRunEpic = (action$) =>
    action$
        .ofType(RETRY_ANUGA_RUN)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.retryRun(action.runId)
            )
                .concatMap(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.retrySuccess"}, "success")
                ))
                .catch(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.retryError"}, "error")
                ))
        );

// PATCH allow-list mirrors ScenarioUpdateSerializerV2 writable fields.
// Read-only fields (status, computed_status, latest_run, latest_run_is_valid,
// created_by, created_by_username, log, unsaved, …) are silently dropped by
// the serializer.
// TASK-955 (W2.2 FE): 'rainfall' added — TASK-957 BE updates
// ScenarioUpdateSerializerV2.Meta.fields to include rainfall so the PATCH
// surface accepts it; the BE serializer drops anything not in its writable
// allow-list silently, so this addition is forward-safe even if the BE deploy
// lags the FE bundle.
export const SCENARIO_PATCH_FIELDS = [
    'name', 'terrain', 'boundary', 'friction', 'inflow', 'rainfall',
    'structure', 'mesh_region', 'network', 'resolution', 'duration'
];

export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .switchMap((action) => {
            const projectId = getProjectId(store.getState());
            if (action.scenario.id) {
                // V2P-79 / V2P-72 — existing scenario PATCH hits V2 partial_update at
                // /api/v2/anuga/projects/{pid}/scenarios/{id}/. ScenarioUpdateSerializerV2
                // limits the writable surface to SCENARIO_PATCH_FIELDS; anything else
                // is dropped server-side without raising.
                const scenario = SCENARIO_PATCH_FIELDS.reduce((acc, k) => {
                    if (action.scenario[k] !== undefined) acc[k] = action.scenario[k];
                    return acc;
                }, {});
                return Rx.Observable.from(
                    anugaApi.updateScenario(projectId, action.scenario.id, scenario)
                        .then(response => saveAnugaScenarioSuccess(response.data))
                        .catch(error => saveAnugaScenarioError(error))
                );
            }
            // V2P-79: new scenario creation routes to V2 via createScenarioV2.
            return Rx.Observable.from(
                anugaApi.createScenarioV2(projectId, action.scenario)
                    .then(response => saveAnugaScenarioSuccess(response.data))
                    .catch(error => saveAnugaScenarioError(error))
            );
        });

export const compareScenarioEpic = (action$, store) =>
    action$
        .ofType(COMPARE_SCENARIOS)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.compareScenarios(getProjectId(store.getState()), action.scenarios)
                    .then(response => compareScenariosSuccess(response.data))
            )
                .catch(() => Rx.Observable.empty())
        );

// TASK-958: explicit build endpoint, decoupled from PATCH side-effect. Fires
// when the user clicks Build on a scenario row that has no unsaved changes
// (otherwise SAVE_ANUGA_SCENARIO is dispatched, which now only triggers a
// rebuild when a BUILD_AFFECTING_FIELDS field is in the diff).
//
// TASK-2079: the BE build-dedup guard 409s this POST when a build is already
// in flight for the scenario. buildScenarioError (comparisonActions.js)
// distinguishes that 409 from a real failure — no 'Build failed' toast, just
// a benign BUILD_SCENARIO_ERROR{conflict: true, runId, runStatus, detail} the
// scenariosReducer stashes as `buildConflict`, surfaced inline near the
// Build button (scenarioHeaderActions.js). This epic itself stays a plain
// success/error passthrough; the 409-vs-real-failure branch lives entirely
// in buildScenarioError so every caller of it gets the same benign handling.
export const buildScenarioEpic = (action$, store) =>
    action$
        .ofType(BUILD_SCENARIO)
        .switchMap((action) =>
            Rx.Observable.from(
                anugaApi.buildScenario(getProjectId(store.getState()), action.scenarioId)
                    .then(() => buildScenarioSuccess(action.scenarioId))
                    .catch(error => buildScenarioError(action.scenarioId, error))
            )
        );

// -- Network ---------------------------------------------------------------

export const runNetworkEpic = (action$, store) =>
    action$
        .ofType(RUN_NETWORK)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.runNetwork(getProjectId(store.getState()), action.network.id, action.network)
            )
                .concatMap((response) => Rx.Observable.of(
                    runNetworkSuccess(response.data),
                    setNetworkMenu(true)
                ))
                .catch(() => Rx.Observable.empty())
        );

// -- Save network (bug #6 fix) ---------------------------------------------

export const saveNetworkEpic = (action$, store) =>
    action$
        .ofType(SAVE_NETWORK)
        .switchMap((action) => {
            const projectId = getProjectId(store.getState());
            const network = action.network;
            return Rx.Observable.from(
                anugaApi.updateResource(projectId, 'network', network.id, network)
            )
                .concatMap(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.networkSaved"}, "success"),
                    initAnuga()
                ))
                .catch(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.networkSaveError"}, "error")
                ));
        });

// -- Compute instances -----------------------------------------------------

export const updateComputeInstanceEpic = (action$, store) =>
    action$
        .ofType(UPDATE_COMPUTE_INSTANCE)
        .switchMap(() =>
            Rx.Observable
                .from(anugaApi.getComputeInstances(getProjectId(store.getState())))
                .catch(() => Rx.Observable.empty())
                .switchMap((response) => Rx.Observable.of(updateComputeInstanceSuccess(response.data)))
        );

// -- Figure creation -------------------------------------------------------

export const createFigureEpic = (action$, store) =>
    action$
        .ofType(CREATE_FIGURE)
        .switchMap((action) =>
            Rx.Observable
                .from(anugaApi.createFigure(getProjectId(store.getState()), action.publicationId, action.figureTitle))
                .catch(() => Rx.Observable.empty())
        )
        .switchMap((response) => {
            window.open(response?.data?.detail_url, '_blank').focus();
            return Rx.Observable.of(initAnuga());
        });

// -- Dataset title update --------------------------------------------------

export const updateAnugaModelTitle = (action$, store) =>
    action$
        .ofType(UPDATE_DATASET_TITLE)
        .switchMap((action) =>
            Rx.Observable
                .from(anugaApi.searchDataset(action.datasetName.split('geonode:')[1]))
                .catch(() => Rx.Observable.empty())
                .switchMap(response => {
                    const gnLayerPk = parseInt(response?.data?.datasets?.[0]?.pk, 10);
                    const anugaModels = getAnugaModels(store?.getState());
                    const anugaModel = anugaModels.filter(model => model.gn_layer === gnLayerPk)?.[0];
                    return Rx.Observable
                        .from(anugaApi.updateResourceTitle(
                            getProjectId(store.getState()),
                            anugaModel.apiKey,
                            anugaModel.id,
                            action.newTitle
                        ))
                        .catch(() => Rx.Observable.empty());
                })
                .switchMap(() => Rx.Observable.empty())
        );

// -- Resources list --------------------------------------------------------

export const getAnugaResourcesEpic = (action$, {getState: _getState = () => {}}) =>
    action$.ofType(UPDATE_ANUGA_RESOURCES)
        .switchMap(() => {
            return Rx.Observable.defer(
                () => anugaApi.getProjects()
                    .then(({data}) => data)
            )
                .switchMap((data) => {
                    return Rx.Observable.of(setAnugaResources({
                        projects: [...data],
                        isNextPageAvailable: !!data?.links?.next,
                        isPreviousPageAvailable: !!data?.links?.previous,
                        loading: false
                    }));
                }).catch((error) => {
                    return Rx.Observable.of(
                        resourceError(error.data || error.message),
                        setAnugaResources({loading: false})
                    );
                }).startWith(setAnugaResources({loading: true}));
        });

// -- V2P-714: cascade-delete dataset rows ----------------------------------
// One epic per type. Each calls the V2 DELETE endpoint, then on:
//   * 204 → dispatch typeSuccess + removeNode + removeLayer
//   * 409 → typeBlocked with the BE-supplied blocking-scenarios array
//   * other → typeError
//
// _readErrStatus/_readErrData (the MapStore2 ajax-interceptor gotcha) now
// live in ../utils/apiErrorUtils — imported at the top of this file.

const makeDeleteEpic = (
    actionType, apiFn, successAction, blockedAction, errorAction
) => (action$, store) =>
    action$
        .ofType(actionType)
        .switchMap((action) => {
            const projectId = action.projectId || getProjectId(store.getState());
            // Backward-compat: tolerate old single-layerId callers that haven't
            // moved to the array signature yet (none in-tree, but safer).
            const layerIds = Array.isArray(action.layerIds) && action.layerIds.length > 0
                ? action.layerIds.filter(Boolean)
                : (action.layerId ? [action.layerId] : []);
            // Success emissions: drop the row + its sibling map layers and
            // persist the removal. Shared by the happy path AND the 404 path
            // (FINDING 1) so an already-gone row is cleaned up identically.
            const successEmissions = () => Rx.Observable.of(
                successAction(action.id, layerIds),
                ...layerIds.flatMap(lid => [
                    removeNode(lid, 'layers'),
                    removeLayer(lid)
                ]),
                // Persist the FE removal to base_resourcebase.blob so a
                // page refresh doesn't restore the deleted layers as
                // ghosts (their backing GeoServer Datasets are gone via
                // the BE cascade — re-rendering them would WMS-404).
                ...(layerIds.length > 0 ? [saveDirectContent()] : [])
            );
            return Rx.Observable.defer(
                () => apiFn(projectId, action.id)
            )
                .switchMap(() => successEmissions())
                .catch((err) => {
                    const status = _readErrStatus(err);
                    const data = _readErrData(err);
                    if (status === 409 && data?.error_code === 'ACTIVE_REFERENCES') {
                        return Rx.Observable.of(blockedAction(
                            action.id,
                            Array.isArray(data.blocking) ? data.blocking : [],
                            data.message || ''
                        ));
                    }
                    // FINDING 1 (UAT 2026-06-23): a 404 means the row is already
                    // gone server-side (e.g. a stale terrain the list never
                    // refreshed after it was replaced by a re-derive). Deleting
                    // an already-deleted resource is idempotently successful, so
                    // treat 404 like success and drop the ghost row instead of
                    // surfacing the mystifying "Delete failed. Please try again."
                    if (status === 404) {
                        return successEmissions();
                    }
                    return Rx.Observable.of(errorAction(action.id, {status, data}));
                });
        });

export const deleteTerrainEpic = makeDeleteEpic(
    DELETE_TERRAIN,
    anugaApi.deleteTerrainV2,
    deleteTerrainSuccess,
    deleteTerrainBlocked,
    deleteTerrainError
);

export const deleteBoundaryEpic = makeDeleteEpic(
    DELETE_BOUNDARY,
    anugaApi.deleteBoundaryV2,
    deleteBoundarySuccess,
    deleteBoundaryBlocked,
    deleteBoundaryError
);

export const deleteFrictionEpic = makeDeleteEpic(
    DELETE_FRICTION,
    anugaApi.deleteFrictionV2,
    deleteFrictionSuccess,
    deleteFrictionBlocked,
    deleteFrictionError
);

export const deleteInflowEpic = makeDeleteEpic(
    DELETE_INFLOW,
    anugaApi.deleteInflowV2,
    deleteInflowSuccess,
    deleteInflowBlocked,
    deleteInflowError
);

// TASK-955 (W2.2 FE) — Rainfall cascade-delete epic. Identical contract to
// deleteInflowEpic: 204 -> success + removeNode + removeLayer + saveDirectContent;
// 409 ACTIVE_REFERENCES -> blocked; other -> error.
export const deleteRainfallEpic = makeDeleteEpic(
    DELETE_RAINFALL,
    anugaApi.deleteRainfallV2,
    deleteRainfallSuccess,
    deleteRainfallBlocked,
    deleteRainfallError
);

// -- TASK-723: cascade-delete fan-out (5 more types) -----------------------
// NETWORK intentionally excluded — separate lifecycle. Identical contract
// to V2P-714: 204→success, 409 ACTIVE_REFERENCES→blocked, other→error.

export const deleteStructureEpic = makeDeleteEpic(
    DELETE_STRUCTURE,
    anugaApi.deleteStructureV2,
    deleteStructureSuccess,
    deleteStructureBlocked,
    deleteStructureError
);

export const deleteMeshRegionEpic = makeDeleteEpic(
    DELETE_MESH_REGION,
    anugaApi.deleteMeshRegionV2,
    deleteMeshRegionSuccess,
    deleteMeshRegionBlocked,
    deleteMeshRegionError
);

export const deleteCatchmentEpic = makeDeleteEpic(
    DELETE_CATCHMENT,
    anugaApi.deleteCatchmentV2,
    deleteCatchmentSuccess,
    deleteCatchmentBlocked,
    deleteCatchmentError
);

export const deleteNodesEpic = makeDeleteEpic(
    DELETE_NODES,
    anugaApi.deleteNodesV2,
    deleteNodesSuccess,
    deleteNodesBlocked,
    deleteNodesError
);

export const deleteLinksEpic = makeDeleteEpic(
    DELETE_LINKS,
    anugaApi.deleteLinksV2,
    deleteLinksSuccess,
    deleteLinksBlocked,
    deleteLinksError
);

// TASK-829 (W4.2b) — FrictionRaster cascade-delete epic.
export const deleteFrictionRasterEpic = makeDeleteEpic(
    DELETE_FRICTION_RASTER,
    anugaApi.deleteFrictionRasterV2,
    deleteFrictionRasterSuccess,
    deleteFrictionRasterBlocked,
    deleteFrictionRasterError
);

// -- Self-heal: prune blob-resident ghost terrain layers --------------------
// A combined surface that is re-derived (512→513) — or any terrain deleted
// server-side while a map referencing it was not open — leaves its Terrain row
// AND its GeoNode/GeoServer Datasets gone, but the layer config LINGERS in that
// map's base_resourcebase.blob. On the next load MapStore restores it from the
// blob, anugaInputMenu._buildTerrainGroups renders the now-model-less layer as
// a stand-alone "parent row", and it looks like a deleted terrain
// "re-appeared". The orphan-guard in pollingEpics (orphanStatus) only stops the
// polling path from RE-ADDING orphans via addLayer — it cannot touch a layer
// already baked into the saved blob. This epic closes that gap.
//
// On terrain-list load (SET_ANUGA_TERRAIN_DATA stamps resources.terrain +
// terrainLoaded) find every 'Input Data.Terrain' map layer that matches NO
// terrain model (neither its DEM nor its hillshade gn_layer_name), then CONFIRM
// each candidate's backing Dataset is genuinely gone with a direct PK probe
// (datasetExistsByPk) before removing it. Anything other than a hard 404 — a
// 200, a 403/5xx, a network error, or a layer with no geonode_id — is KEPT, so
// a transient publish race or a still-valid derived surface is never deleted.
// Editor+ only: a viewer cannot persist a blob save, so there is nothing to do.
const _terrainLayerMatchesModel = (layer, model) => {
    const ln = bareName(layer?.name);
    return !!ln && (ln === model?.gn_layer_name || ln === model?.gn_layer_hillshade_name);
};

export const pruneOrphanTerrainLayersEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_TERRAIN_DATA)
        .switchMap(() => {
            const state = store.getState();
            if (!canEditAnugaMap(state)) return Rx.Observable.empty();
            const terrainModels = state?.anuga?.resources?.terrain || [];
            const candidates = (state?.layers?.flat || [])
                .filter(l => l?.group === 'Input Data.Terrain')
                .filter(l => !terrainModels.some(m => _terrainLayerMatchesModel(l, m)));
            if (candidates.length === 0) return Rx.Observable.empty();
            // Probe every candidate's Dataset by PK in parallel. A candidate
            // survives (maps to null) on anything but a hard 404, so a transient
            // publish race or a still-valid derived surface is never deleted.
            return Rx.Observable
                .forkJoin(
                    candidates.map(layer =>
                        Rx.Observable
                            .defer(() => anugaApi.datasetExistsByPk(layer.geonode_id))
                            .map(exists => (exists === false ? layer : null))
                            .catch(() => Rx.Observable.of(null))
                    )
                )
                .switchMap(probed => {
                    const ghosts = probed.filter(Boolean);
                    if (ghosts.length === 0) return Rx.Observable.empty();
                    // Drop each ghost (DEM + hillshade are separate layers) and
                    // persist the pruned tree ONCE so they do not return.
                    return Rx.Observable.of(
                        ...ghosts.flatMap(l => [removeNode(l.id, 'layers'), removeLayer(l.id)]),
                        saveDirectContent()
                    );
                });
        });

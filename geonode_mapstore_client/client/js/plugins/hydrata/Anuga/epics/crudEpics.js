import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {addLayer, removeLayer, removeNode} from '../../../../../MapStore2/web/client/actions/layers';
import * as anugaApi from '../api/anugaApi';
import {
    CANCEL_ANUGA_RUN,
    RETRY_ANUGA_RUN,
    SAVE_NETWORK,
    CREATE_ANUGA_BOUNDARY,
    CREATE_ANUGA_FRICTION,
    CREATE_ANUGA_INFLOW,
    CREATE_ANUGA_MESH_REGION,
    CREATE_ANUGA_STRUCTURE,
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
    archiveAnugaScenarioError,
    UNARCHIVE_ANUGA_SCENARIO,
    unarchiveAnugaScenarioSuccess,
    initAnuga,
    RUN_ANUGA_SCENARIO,
    runAnugaScenarioSuccess,
    RUN_NETWORK,
    runNetworkSuccess,
    setNetworkMenu,
    SAVE_ANUGA_SCENARIO,
    saveAnugaScenarioError,
    saveAnugaScenarioSuccess,
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
    deleteFrictionRasterError
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE
} from "../../SimpleView/actionsSimpleView";
import {getAnugaModels, getProjectId} from "../selectorsAnuga";
import {resourceError} from "@js/actions/gnresource";
import {saveDirectContent} from "@js/actions/gnsave";

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
export const createAnugaStructureEpic = makeCreateEpic(CREATE_ANUGA_STRUCTURE, 'structure', 'structureTitle');
export const createAnugaMeshRegionEpic = makeCreateEpic(CREATE_ANUGA_MESH_REGION, 'mesh-region', 'meshRegionTitle');
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
// active/queued run). The catch handler dispatches the error action so the
// matching reducer entry can flag the failed attempt if a future UX needs to
// highlight the row.
export const archiveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(ARCHIVE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.archiveScenario(getProjectId(store.getState()), action.scenario.id)
            )
                .concatMap((response) => Rx.Observable.of(archiveAnugaScenarioSuccess(response.data)))
                // axios surfaces 4xx as a thrown error with .response; pull the
                // BE detail string off and route through the error thunk.
                // Fallback to err.data covers test mocks that don't construct
                // a full response object on the thrown error.
                .catch((err) => Rx.Observable.of(
                    archiveAnugaScenarioError(action.scenario, err?.response?.data || err?.data)
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
export const runAnugaScenarioEpic = (action$, _store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.startRun(action.scenario.id, action.computeBackend)
            )
                .concatMap((response) => {
                    const runId = response?.data?.id;
                    return Rx.Observable.of(
                        runAnugaScenarioSuccess(response.data),
                        setAnugaScenarioMenu(true),
                        ...(runId ? [startActiveRunPolling(runId)] : [])
                    );
                })
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
export const retryAnugaRunEpic = (action$) =>
    action$
        .ofType(RETRY_ANUGA_RUN)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.retryRun(action.runId)
            )
                .concatMap((response) => {
                    const runId = response?.data?.id;
                    return Rx.Observable.of(
                        show({"message": "hydrata.anuga.retrySuccess"}, "success"),
                        ...(runId ? [startActiveRunPolling(runId)] : [])
                    );
                })
                .catch(() => Rx.Observable.of(
                    show({"message": "hydrata.anuga.retryError"}, "error")
                ))
        );

// PATCH allow-list mirrors ScenarioUpdateSerializerV2 writable fields.
// Read-only fields (status, computed_status, latest_run, latest_run_is_valid,
// created_by, created_by_username, log, unsaved, …) are silently dropped by
// the serializer.
export const SCENARIO_PATCH_FIELDS = [
    'name', 'terrain', 'boundary', 'friction', 'inflow',
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
// Error shape gotcha: MapStore2 libs/ajax.js:158 interceptor rewrites axios
// rejections so the canonical access is err.status / err.data, not
// err.response.status / err.response.data. We check both forms defensively
// because axios-mock-adapter (used by the API regression suite) preserves
// the err.response.* shape.
const _readErrStatus = (err) => err?.status ?? err?.response?.status;
const _readErrData = (err) => err?.data ?? err?.response?.data ?? {};

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
            return Rx.Observable.defer(
                () => apiFn(projectId, action.id)
            )
                .switchMap(() => Rx.Observable.of(
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
                ))
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

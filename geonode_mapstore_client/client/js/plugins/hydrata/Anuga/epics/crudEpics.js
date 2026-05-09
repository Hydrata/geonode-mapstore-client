import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {addLayer, removeLayer, removeNode} from '../../../../../MapStore2/web/client/actions/layers';
import {CREATE_NEW_FEATURE} from "../../../../../MapStore2/web/client/actions/featuregrid";
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
    deleteInflowError
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

export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .switchMap((action) => {
            const scenario = {...action.scenario, log: action.scenario.log || 'anuga log'};
            const projectId = getProjectId(store.getState());
            if (scenario.id) {
                // V2P-79 / V2P-72 — existing scenario PATCH now hits V2.
                // anugaApi.updateScenario routes to /api/v2/anuga/projects/{pid}/scenarios/{id}/
                // (PATCH partial_update). ScenarioUpdateSerializerV2 limits the
                // writable surface; trailing read-only fields (e.g. log) are
                // ignored server-side without raising.
                return Rx.Observable.from(
                    anugaApi.updateScenario(projectId, scenario.id, scenario)
                        .then(response => saveAnugaScenarioSuccess(response.data))
                        .catch(error => saveAnugaScenarioError(error))
                );
            }
            // V2P-79: new scenario creation routes to V2 via createScenarioV2.
            return Rx.Observable.from(
                anugaApi.createScenarioV2(projectId, scenario)
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

// -- Feature grid defaults -------------------------------------------------

export const prePopulateAnugaFeatureGridWithDefaults = (action$, store) =>
    action$
        .ofType(CREATE_NEW_FEATURE)
        .filter(() => ['geonode:bdy_', 'geonode:inf_', 'geonode:str_', 'geonode:fri_', 'geonode:mes_'].some(layerType => store.getState()?.featuregrid?.selectedLayer.includes(layerType)))
        .concatMap((action) => {
            if (action?.features?.[0] && Object.keys(action?.features?.[0])?.length > 0) {
                return Rx.Observable.empty();
            }
            const defaultPropertyMap = {
                'geonode:bdy_': {
                    location: "External",
                    boundary: "Dirichlet"
                },
                'geonode:inf_': {
                    type: "Rainfall",
                    data: 100
                },
                'geonode:str_': {
                    method: 'Holes'
                },
                'geonode:fri_': {
                    manning: 0.035
                },
                'geonode:mes_': {
                    resolution: 10
                }
            };
            const layerPrefix = store.getState()?.featuregrid?.selectedLayer.substring(0, 12);
            const newFeature = {
                ...action.features[0],
                properties: defaultPropertyMap[layerPrefix]
            };
            return Rx.Observable.of({
                ...action,
                features: [newFeature, ...action.features.slice(1)]
            });
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

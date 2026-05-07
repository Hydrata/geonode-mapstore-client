import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {addLayer} from '../../../../../MapStore2/web/client/actions/layers';
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
    startActiveRunPolling
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE
} from "../../SimpleView/actionsSimpleView";
import {getAnugaModels, getProjectId} from "../selectorsAnuga";
import {resourceError} from "@js/actions/gnresource";

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
                // Existing scenario — keep v1 update (v2 has no update endpoint)
                return Rx.Observable.from(
                    anugaApi.updateScenario(projectId, scenario.id, scenario)
                        .then(response => saveAnugaScenarioSuccess(response.data))
                        .catch(error => saveAnugaScenarioError(error))
                );
            }
            // New scenario — use v2 create
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

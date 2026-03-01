import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {CREATE_NEW_FEATURE} from "../../../../../MapStore2/web/client/actions/featuregrid";
import * as anugaApi from '../api/anugaApi';
import {
    addAnugaBoundary,
    addAnugaInflow,
    addAnugaFriction,
    addAnugaStructure,
    addAnugaMeshRegion,
    addNetwork,
    addCatchment,
    addNodes,
    addLinks,
    CANCEL_ANUGA_RUN,
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
    fixAnugaGroups
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE
} from "../../SimpleView/actionsSimpleView";
import {getAnugaModels} from "../selectorsAnuga";
import {resourceError} from "@js/actions/gnresource";
import {parseDevHostname} from "@js/utils/APIUtils";

// -- Create-resource epics (create + trigger add-layer) --------------------

const makeCreateEpic = (actionType, resourceType, titleKey, addAction) => (action$, store) =>
    action$
        .ofType(actionType)
        .switchMap((action) =>
            Rx.Observable
                .from(anugaApi.createResource(
                    store.getState()?.anuga?.projectData?.id,
                    resourceType,
                    {
                        project: store.getState()?.anuga?.projectData?.id,
                        title: action[titleKey]
                    }
                ))
                .catch(() => Rx.Observable.empty())
                .switchMap(() => Rx.Observable.of(addAction()))
        );

export const createAnugaBoundaryEpic = makeCreateEpic(CREATE_ANUGA_BOUNDARY, 'boundary', 'boundaryTitle', addAnugaBoundary);
export const createAnugaFrictionEpic = makeCreateEpic(CREATE_ANUGA_FRICTION, 'friction', 'frictionTitle', addAnugaFriction);
export const createAnugaInflowEpic = makeCreateEpic(CREATE_ANUGA_INFLOW, 'inflow', 'inflowTitle', addAnugaInflow);
export const createAnugaStructureEpic = makeCreateEpic(CREATE_ANUGA_STRUCTURE, 'structure', 'structureTitle', addAnugaStructure);
export const createAnugaMeshRegionEpic = makeCreateEpic(CREATE_ANUGA_MESH_REGION, 'mesh-region', 'meshRegionTitle', addAnugaMeshRegion);
export const createNetworkEpic = makeCreateEpic(CREATE_NETWORK, 'network', 'networkTitle', addNetwork);
export const createCatchmentEpic = makeCreateEpic(CREATE_LUMPED_CATCHMENT, 'catchment', 'catchmentTitle', addCatchment);
export const createNodesEpic = makeCreateEpic(CREATE_NODES, 'nodes', 'nodesTitle', addNodes);
export const createLinksEpic = makeCreateEpic(CREATE_LINKS, 'links', 'linksTitle', addLinks);

// -- Scenario CRUD ---------------------------------------------------------

export const deleteAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(DELETE_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(anugaApi.deleteScenario(store.getState()?.anuga?.projectData?.id, action.scenario.id))
                .catch(() => Rx.Observable.empty())
        )
        .concatMap((response) => Rx.Observable.of(deleteAnugaScenarioSuccess(response.data)));

export const runAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.runScenario(store.getState()?.anuga?.projectData?.id, action.scenario.id, action)
                    .then(response => runAnugaScenarioSuccess(response.data))
            )
                .catch(() => Rx.Observable.empty())
        )
        .concatMap(() => Rx.Observable.of(
            setAnugaScenarioMenu(true)
        ));

export const cancelAnugaRunEpic = (action$, store) =>
    action$
        .ofType(CANCEL_ANUGA_RUN)
        .concatMap((action) => {
            const projectId = store.getState()?.anuga?.projectData?.id;
            const scenarioId = action.scenario.id;
            const runId = action.scenario.latest_run.id;
            return Rx.Observable.from(
                anugaApi.runScenario(projectId, scenarioId, action)
            )
                .concatMap(() => Rx.Observable.from(
                    anugaApi.cancelScenario(projectId, scenarioId, runId)
                ))
                .concatMap(() => Rx.Observable.of(show({"message": "hydrata.anuga.cancelling"}, "warning")))
                .catch(() => Rx.Observable.empty());
        });

export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .switchMap((action) => {
            const scenario = {...action.scenario, log: action.scenario.log || 'anuga log'};
            const projectId = store.getState()?.anuga?.projectData?.id;
            if (scenario.id) {
                return Rx.Observable.from(
                    anugaApi.updateScenario(projectId, scenario.id, scenario)
                        .then(response => saveAnugaScenarioSuccess(response.data))
                        .catch(error => saveAnugaScenarioError(error))
                );
            }
            return Rx.Observable.from(
                anugaApi.createScenario(projectId, scenario)
                    .then(response => saveAnugaScenarioSuccess(response.data))
                    .catch(error => saveAnugaScenarioError(error))
            );
        });

export const compareScenarioEpic = (action$, store) =>
    action$
        .ofType(COMPARE_SCENARIOS)
        .concatMap((action) =>
            Rx.Observable.from(
                anugaApi.compareScenarios(store.getState()?.anuga?.projectData?.id, action.scenarios)
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
                anugaApi.runNetwork(store.getState()?.anuga?.projectData?.id, action.network.id, action.network)
                    .then(response => runNetworkSuccess(response.data))
            )
                .catch(() => Rx.Observable.empty())
        )
        .concatMap(() => Rx.Observable.of(
            setNetworkMenu(true)
        ));

// -- Compute instances -----------------------------------------------------

export const updateComputeInstanceEpic = (action$, store) =>
    action$
        .ofType(UPDATE_COMPUTE_INSTANCE)
        .switchMap(() =>
            Rx.Observable
                .from(anugaApi.getComputeInstances(store.getState()?.anuga?.projectData?.id))
                .catch(() => Rx.Observable.empty())
                .switchMap((response) => Rx.Observable.of(updateComputeInstanceSuccess(response.data)))
        );

// -- Figure creation -------------------------------------------------------

export const createFigureEpic = (action$, store) =>
    action$
        .ofType(CREATE_FIGURE)
        .switchMap((action) =>
            Rx.Observable
                .from(anugaApi.createFigure(store.getState()?.anuga?.projectData?.id, action.publicationId, action.figureTitle))
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
                            store.getState()?.anuga?.projectData?.id,
                            anugaModel.apiKey,
                            anugaModel.id,
                            action.newTitle
                        ))
                        .catch(() => Rx.Observable.empty());
                })
                .switchMap(() => Rx.Observable.empty())
        );

// -- Resources list --------------------------------------------------------

export const getAnugaResourcesEpic = (action$, {getState = () => {}}) =>
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

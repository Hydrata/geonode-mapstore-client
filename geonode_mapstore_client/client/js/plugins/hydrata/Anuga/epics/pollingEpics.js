import Rx from "rxjs";
import {
    addLayer,
    removeLayer,
    refreshLayers,
    moveNode
} from '../../../../../MapStore2/web/client/actions/layers';
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import {zoomToExtent} from "../../../../../MapStore2/web/client/actions/map";
import {saveDirectContent} from "@js/actions/gnsave";
import * as anugaApi from '../api/anugaApi';
import {
    ADD_ANUGA_BOUNDARY,
    ADD_ANUGA_FRICTION,
    ADD_ANUGA_INFLOW,
    ADD_ANUGA_STRUCTURE,
    ADD_ANUGA_FULL_MESH,
    ADD_ANUGA_MESH_REGION,
    ADD_LUMPED_CATCHMENT,
    ADD_NODES,
    ADD_LINKS,
    ADD_COMPARISON,
    addAnugaBoundary,
    addAnugaInflow,
    addAnugaFriction,
    addAnugaStructure,
    addAnugaFullMesh,
    addAnugaMeshRegion,
    addNetwork,
    addCatchment,
    addNodes,
    addLinks,
    addComparison,
    INIT_ANUGA,
    initAnuga,
    setAnugaBoundaryData,
    setAnugaElevationData,
    setAnugaFrictionData,
    setAnugaInflowData,
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
    setCreatingAnugaLayer,
    setComparisonData,
    START_ANUGA_ELEVATION_POLLING,
    START_ANUGA_MODEL_CREATION_POLLING,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_ELEVATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    STOP_COMPARISON_POLLING,
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    stopAnugaElevationPolling,
    startAnugaModelCreationPolling,
    startAnugaScenarioPolling,
    stopActiveRunPolling,
    updateRunStatus,
    fixAnugaGroups
} from "../actionsAnuga";
import {
    UPDATE_DATASET_TITLE_SUCCESS,
    SET_OPEN_MENU_GROUP_ID,
    setSvConfig,
    updateUploadStatus
} from "../../SimpleView/actionsSimpleView";
import {getProjectId} from "../selectorsAnuga";

const addAnugaLayerFromAvailableResponse = (response, store) => {
    if (response.data?.length === 0) {
        return Rx.Observable.empty();
    }
    let actions = [
        initAnuga(),
        setCreatingAnugaLayer(false)
    ];
    response.data.map(model => {
        if (store.getState().layers.flat.filter(layer => layer.name === model?.name).length === 0) {
            actions.unshift(addLayer(model));
            actions.push(
                show({
                    "message": "hydrata.anuga.newLayersMessage",
                    "title": "hydrata.anuga.newLayersTitle",
                    "uid": 1000,
                    "position": "tc"
                })
            );
        }
    });
    return Rx.Observable.from(actions);
};

// Resource endpoints that stay on v1 (no v2 equivalent)
const v1ResourceEndpoints = [
    {endpoint: 'boundary', action: setAnugaBoundaryData},
    {endpoint: 'elevation', action: setAnugaElevationData},
    {endpoint: 'inflow', action: setAnugaInflowData},
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

const fetchV1Endpoint = (endpoint, projectId) => Rx.Observable
    .from(anugaApi.getResourceList(projectId, endpoint))
    .catch(() => Rx.Observable.of({data: {}}))
    .switchMap(response => Rx.Observable.of(response.data));

export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA, UPDATE_DATASET_TITLE_SUCCESS)
        .filter(() => store.getState().gnresource.id)
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
                    // v2 scenario fetch
                    const scenariosFetch = Rx.Observable.from(anugaApi.getScenariosV2(projectId))
                        .catch(() => Rx.Observable.of({data: []}))
                        .map(resp => setAnugaScenarioData(resp.data));

                    // v1 resource fetches
                    const resourceObservables = v1ResourceEndpoints.map(
                        ({endpoint, action}) => fetchV1Endpoint(endpoint, projectId).map(action)
                    );

                    return Rx.Observable.of(
                        setAnugaProjectData(response2.data),
                        fixAnugaGroups(),
                        setSvConfig(response2.data.simple_view_config)
                    ).concat(
                        Rx.Observable.merge(scenariosFetch, ...resourceObservables),
                        Rx.Observable.of(startAnugaScenarioPolling())
                    );
                });
        });

export const pollAnugaModelCreationEpic = (action$) =>
    action$
        .ofType(START_ANUGA_MODEL_CREATION_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 10000)
                .takeUntil(action$.ofType(STOP_ANUGA_MODEL_CREATION_POLLING))
                .switchMap(() =>
                    Rx.Observable.concat(
                        Rx.Observable.of(addAnugaBoundary()),
                        Rx.Observable.of(addAnugaFriction()),
                        Rx.Observable.of(addAnugaStructure()),
                        Rx.Observable.of(addAnugaInflow()),
                        Rx.Observable.of(addAnugaFullMesh()),
                        Rx.Observable.of(addAnugaMeshRegion()),
                        Rx.Observable.of(addNetwork()),
                        Rx.Observable.of(addCatchment()),
                        Rx.Observable.of(addNodes()),
                        Rx.Observable.of(addLinks())
                    ))
        );

export const pollAnugaElevationEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_ELEVATION_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 6000)
                .takeUntil(action$.ofType(STOP_ANUGA_ELEVATION_POLLING))
                .switchMap(() =>
                    Rx.Observable
                        .from(anugaApi.getAvailableLayers(getProjectId(store.getState()), 'elevation'))
                        .catch(() => Rx.Observable.empty())
                )
                .switchMap(response => {
                    if (response.data?.length < 2) {
                        return Rx.Observable.empty();
                    }
                    const elevationLayerData = response.data[0];
                    const hillshadeLayerData = response.data?.[1];
                    return Rx.Observable.concat(
                        Rx.Observable.of(stopAnugaElevationPolling()),
                        Rx.Observable.of(() => {
                            let wmsLayers = store.getState()?.layers?.flat?.filter((layer) => layer.type === 'wms' && layer.group !== 'background') || [];
                            return refreshLayers(wmsLayers);
                        }),
                        Rx.Observable.of(addLayer(elevationLayerData)),
                        Rx.Observable.of(addLayer(hillshadeLayerData)),
                        Rx.Observable.of(zoomToExtent(
                            response.data[0]?.bbox?.bounds,
                            response.data[0]?.bbox?.crs,
                            20
                        )),
                        Rx.Observable.of(updateUploadStatus('Complete')),
                        Rx.Observable.of(saveDirectContent()),
                        Rx.Observable.of(initAnuga()),
                        Rx.Observable.of(startAnugaModelCreationPolling()),
                        Rx.Observable.of(() => {
                            let wmsLayers = store.getState()?.layers?.flat?.filter((layer) => layer.type === 'wms' && layer.group !== 'background') || [];
                            return refreshLayers(wmsLayers);
                        }),
                        Rx.Observable.of(moveNode('Input Data.Elevations', 'Input Data', store.getState()?.layers.groups.filter(group => group.id === "Input Data")?.[0]?.nodes?.length))
                    );
                })
        );

const isScenarioLoaded = (scenario, state) => {
    const depth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_max?.name);
    const velocityDepth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_integrated_velocity_max?.name);
    const velocity = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_velocity_max?.name);
    return !!depth?.length && !!velocityDepth?.length && !!velocity?.length;
};

// Bug #5 fix: use v2 getScenariosV2. Polling is still started once per init
// via startAnugaScenarioPolling in initAnugaEpic — switchMap ensures only one
// active subscription at a time.
export const pollAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_SCENARIO_POLLING)
        .switchMap(() =>
            Rx.Observable
                .timer(0, 8000)
                .takeUntil(action$.ofType(STOP_ANUGA_SCENARIO_POLLING))
                .switchMap(() =>
                    Rx.Observable.from(
                        anugaApi.getScenariosV2(getProjectId(store.getState()))
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
            const terminalStates = ['complete', 'error', 'cancelled'];
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
                    if (terminalStates.includes(data?.status)) {
                        actions.push(stopActiveRunPolling(runId));
                    }
                    return Rx.Observable.from(actions);
                });
        });

export const pollComparisonEpic = (action$, store) =>
    action$
        .ofType(SET_OPEN_MENU_GROUP_ID)
        .filter(action => action?.openMenuGroupId === 'Results')
        .switchMap(() =>
            Rx.Observable.timer(0, 10000)
                .takeUntil(action$.ofType(STOP_COMPARISON_POLLING))
                .switchMap(() =>
                    Rx.Observable.concat(
                        Rx.Observable.of(addComparison())
                    ))
        );

// -- Add-layer epics (fetch available layers from backend) -----------------

const makeAddLayerEpic = (actionType, resourceType) => (action$, store) =>
    action$
        .ofType(actionType)
        .switchMap(() =>
            Rx.Observable
                .from(anugaApi.getAvailableLayers(getProjectId(store.getState()), resourceType))
                .catch(() => Rx.Observable.empty())
                .switchMap((response) => addAnugaLayerFromAvailableResponse(response, store))
        );

export const addAnugaBoundaryEpic = makeAddLayerEpic(ADD_ANUGA_BOUNDARY, 'boundary');
export const addAnugaFrictionEpic = makeAddLayerEpic(ADD_ANUGA_FRICTION, 'friction');
export const addAnugaInflowEpic = makeAddLayerEpic(ADD_ANUGA_INFLOW, 'inflow');
export const addAnugaStructureEpic = makeAddLayerEpic(ADD_ANUGA_STRUCTURE, 'structure');
export const addAnugaFullMeshEpic = makeAddLayerEpic(ADD_ANUGA_FULL_MESH, 'full-mesh');
export const addAnugaMeshRegionEpic = makeAddLayerEpic(ADD_ANUGA_MESH_REGION, 'mesh-region');
export const addCatchmentEpic = makeAddLayerEpic(ADD_LUMPED_CATCHMENT, 'catchment');
export const addNodesEpic = makeAddLayerEpic(ADD_NODES, 'nodes');
export const addLinksEpic = makeAddLayerEpic(ADD_LINKS, 'links');
export const addComparisonEpic = makeAddLayerEpic(ADD_COMPARISON, 'comparison');

import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";
import {addLayer, removeLayer, refreshLayers, moveNode} from '../../../../MapStore2/web/client/actions/layers';
import {show} from '../../../../MapStore2/web/client/actions/notifications';
import {zoomToExtent} from "../../../../MapStore2/web/client/actions/map";
import {saveDirectContent} from "@js/actions/gnsave";
import {CREATE_NEW_FEATURE} from "../../../../MapStore2/web/client/actions/featuregrid";
import {
    ADD_ANUGA_BOUNDARY,
    ADD_ANUGA_FRICTION,
    ADD_ANUGA_INFLOW,
    ADD_ANUGA_STRUCTURE,
    ADD_ANUGA_FULL_MESH,
    ADD_ANUGA_MESH_REGION,
    // ADD_NETWORK,
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
    INIT_ANUGA,
    initAnuga,
    RUN_ANUGA_SCENARIO,
    runAnugaScenarioSuccess,
    RUN_NETWORK,
    runNetworkSuccess,
    setNetworkMenu,
    SAVE_ANUGA_SCENARIO,
    saveAnugaScenarioError,
    saveAnugaScenarioSuccess,
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
    setAnugaScenarioMenu,
    setAnugaScenarioResultsLoaded,
    setAnugaStructureData,
    setPublicationData,
    setCreatingAnugaLayer,
    START_ANUGA_ELEVATION_POLLING,
    START_ANUGA_MODEL_CREATION_POLLING,
    START_ANUGA_SCENARIO_POLLING,
    START_COMPARISON_POLLING,
    setComparisonData,
    startAnugaModelCreationPolling,
    startAnugaScenarioPolling,
    STOP_ANUGA_ELEVATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    STOP_COMPARISON_POLLING,
    stopComparisonPolling,
    stopAnugaElevationPolling,
    UPDATE_COMPUTE_INSTANCE,
    updateComputeInstanceSuccess,
    COMPARE_SCENARIOS,
    compareScenariosSuccess,
    UPDATE_ANUGA_RESOURCES,
    setAnugaResources
} from "./actionsAnuga";

import {
    UPDATE_DATASET_TITLE,
    updateUploadStatus,
    UPDATE_DATASET_TITLE_SUCCESS,
    SET_OPEN_MENU_GROUP_ID, setSvConfig
} from "../SimpleView/actionsSimpleView";
import {getAnugaModels} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import {resourceError} from "@js/actions/gnresource";
import {parseDevHostname} from "@js/utils/APIUtils";

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
                    "message": "New layers added... You should save your project.",
                    "title": "Layers added",
                    "uid": 1000,
                    "position": "tc"
                })
            );
        }
    });
    return Rx.Observable.from(actions);
};

export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA, UPDATE_DATASET_TITLE_SUCCESS)
        .filter(() => store.getState()?.gnresource.id)
        .switchMap(() => Rx.Observable
            .from(
                axios.post(`/anuga/api/project/get_project_from_map_id/`, {"mapId": store.getState()?.gnresource.id})
                    .catch((error) => {console.log('**', error); return 'error';})
            )
            .filter(response1 => response1?.status <= 400)
            .filter(() => !!store.getState()?.security?.user)
            .switchMap(response1 => Rx.Observable
                .from(axios.get(`/anuga/api/project/${response1.data.projectId}/`))
                .switchMap(response2 => Rx.Observable
                    .of(setAnugaProjectData(response2.data))
                    .concat(
                        Rx.Observable.of(setSvConfig(response2.data?.simple_view_config)),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/scenario/`))
                            .switchMap((response3) => Rx.Observable.of(setAnugaScenarioData(response3.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/boundary/`))
                            .switchMap((response4) => Rx.Observable.of(setAnugaBoundaryData(response4.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/elevation/`))
                            .switchMap((response5) => Rx.Observable.of(setAnugaElevationData(response5.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/inflow/`))
                            .switchMap((response6) => Rx.Observable.of(setAnugaInflowData(response6.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/structure/`))
                            .switchMap((response7) => Rx.Observable.of(setAnugaStructureData(response7.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/friction/`))
                            .switchMap((response8) => Rx.Observable.of(setAnugaFrictionData(response8.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/full-mesh/`))
                            .switchMap((response9) => Rx.Observable.of(setAnugaFullMeshData(response9.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/mesh-region/`))
                            .switchMap((response10) => Rx.Observable.of(setAnugaMeshRegionData(response10.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/network/`))
                            .switchMap((response11) => Rx.Observable.of(setNetworkData(response11.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/catchment/`))
                            .switchMap((response12) => Rx.Observable.of(setCatchmentData(response12.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/nodes/`))
                            .switchMap((response13) => Rx.Observable.of(setAnugaNodesData(response13.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/links/`))
                            .switchMap((response14) => Rx.Observable.of(setAnugaLinksData(response14.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/comparison/`))
                            .switchMap((response15) => Rx.Observable.of(setComparisonData(response15.data))),
                        Rx.Observable
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/publication/`))
                            .switchMap((response16) => Rx.Observable.of(setPublicationData(response16.data))),
                        Rx.Observable.of(startAnugaScenarioPolling())
                    )
                )
                .filter((setAnugaProjectDataAction) => {
                    return setAnugaProjectDataAction;
                })
            )
        )
        .filter((response1) => {
            return response1;
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
                        .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/elevation/available/`))
                        .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap(response => {
                    if (response.data?.length < 2) {
                        return Rx.Observable.empty();
                    }
                    // const numberOfInputDataGroups = (store.getState()?.layers.groups.filter(group => group.id === "Input Data")?.[0]?.nodes?.length || 2) - 1;
                    return Rx.Observable.concat(
                        Rx.Observable.of(stopAnugaElevationPolling()),
                        Rx.Observable.of(() => {
                            let wmsLayers = store.getState()?.layers?.flat?.filter((layer) => layer.type === 'wms' && layer.group !== 'background') || [];
                            return refreshLayers(wmsLayers);
                        }),
                        Rx.Observable.of(addLayer(response.data[0])),  // The elevation
                        Rx.Observable.of(addLayer(response.data?.[1])),  // The hillshade
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
    // console.log('isScenarioLoaded', scenario);
    const depth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_max?.name);
    const velocityDepth = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_depth_integrated_velocity_max?.name);
    const velocity = state?.layers?.flat?.filter((layer) => layer.name === scenario?.latest_run?.gn_layer_velocity_max?.name);
    // console.log(depth, velocityDepth, velocity);
    const result = !!depth?.length && !!velocityDepth?.length && !!velocity?.length;
    // console.log(result);
    return result;
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
                        axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/`)
                            .catch((error) => error)
                    )
                        .filter(response1 => response1?.status <= 400)
                        .switchMap(response => Rx.Observable
                            .of(setAnugaPollingData(response.data))
                            .switchMap((action) => {
                                // console.log('filter this:', action.scenarios);
                                // check backend
                                let backendScenariosToLoadResults = action.scenarios?.filter(scenario =>
                                    scenario.latest_run?.status === 'complete'
                                );
                                // console.log('backendScenariosToLoadResults', backendScenariosToLoadResults);
                                // now swap to frontend
                                let scenarioToLoadResults = backendScenariosToLoadResults.filter(scenarioBackend => {
                                    // console.log('** testing scenarioBackend:', scenarioBackend);
                                    const scenarioBackendTestResult = store.getState()?.anuga?.scenarios?.filter(scenarioFrontEnd => {
                                        // console.log('scenarioFrontEnd:', scenarioFrontEnd);
                                        const frontendMatchesBackend = scenarioFrontEnd?.id === scenarioBackend.id;
                                        const frontendIsNotLoaded = !scenarioFrontEnd.isLoaded;
                                        const backendIsNotLoaded = !isScenarioLoaded(scenarioFrontEnd, store.getState());
                                        // console.log('frontendMatchesBackend:', frontendMatchesBackend);
                                        // console.log('frontendIsNotLoaded:', frontendIsNotLoaded);
                                        // console.log('backendIsNotLoaded:', backendIsNotLoaded);
                                        if (frontendMatchesBackend && frontendIsNotLoaded && backendIsNotLoaded) {
                                            // console.log('using scenarioBackend:', scenarioBackend);
                                            return scenarioBackend;
                                        }
                                        // console.log('rejecting scenarioBackend:', scenarioBackend);
                                        return null;
                                    })[0];
                                    // console.log('scenarioBackendTestResult:', scenarioBackendTestResult);
                                    return scenarioBackendTestResult;
                                })[0];
                                // console.log('frontend scenarioToLoadResults', scenarioToLoadResults);
                                // and check frontend
                                const currentLayerNames = store.getState()?.layers?.flat?.map(layer => layer?.name);
                                let wmsLayers = store.getState()?.layers?.flat?.filter((l) => l?.type === 'wms' && l?.group !== 'background') || [];
                                // remove existing results from that scenario:
                                const newResultLayerTitles = [
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.title,
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.title,
                                    scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.title
                                ];
                                let existingResultLayers = store.getState()?.layers?.flat?.filter(layer => newResultLayerTitles.includes(layer?.title));
                                console.log('remove these existingResultLayers:', existingResultLayers);
                                if (scenarioToLoadResults &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.catalogURL &&
                                    scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.catalogURL &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_depth_integrated_velocity_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_depth_max?.name) &&
                                    !currentLayerNames.includes(scenarioToLoadResults?.latest_run?.gn_layer_velocity_max?.name)
                                ) {
                                    // console.log('turning on: scenariosToLoadResults', scenarioToLoadResults);
                                    return Rx.Observable
                                        .concat(
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[0]?.id)),
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[1]?.id)),
                                            Rx.Observable.of(removeLayer(existingResultLayers?.[2]?.id)),
                                            Rx.Observable.of(setAnugaPollingData(action.scenarios)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_depth_integrated_velocity_max)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_depth_max)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_velocity_max)),
                                            Rx.Observable.of(setAnugaScenarioResultsLoaded(scenarioToLoadResults?.id, true)),
                                            Rx.Observable.of(refreshLayers(wmsLayers))
                                        );
                                }
                                // console.log('not turning on anything');
                                return Rx.Observable.of(setAnugaPollingData(action.scenarios));
                            })
                        )
                )
        );

export const deleteAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(DELETE_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(axios.delete(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/`)))
        .concatMap((response) => Rx.Observable.of(deleteAnugaScenarioSuccess(response.data)));


export const runAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(
            axios
                .post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/run/`, action)
                .then(response => runAnugaScenarioSuccess(response.data))
        ))
        .concatMap(() => Rx.Observable.of(
            setAnugaScenarioMenu(true)
        ));

export const cancelAnugaRunEpic = (action$, store) =>
    action$
        .ofType(CANCEL_ANUGA_RUN)
        .concatMap((action) => Rx.Observable.from(
            axios
                .post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/run/`, action)
        ))
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/cancel/`, {"runId": action.scenario.latest_run.id})))
        .concatMap(() => Rx.Observable.of(show({"message": "cancelling..."}, "warning")));


export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .switchMap((action) => {
            action.scenario.log = action.scenario.log || 'anuga log';
            if (action.scenario.id) {
                return Rx.Observable.from(axios
                    .put(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/`, action.scenario)
                    .then(response => saveAnugaScenarioSuccess(response.data))
                    .catch(error => saveAnugaScenarioError(error))
                );
            }
            return Rx.Observable.from(axios
                .post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/`, action.scenario)
                .then(response => saveAnugaScenarioSuccess(response.data))
                .catch(error => saveAnugaScenarioError(error))
            );
        });


export const compareScenarioEpic = (action$, store) =>
    action$
        .ofType(COMPARE_SCENARIOS)
        .concatMap((action) => Rx.Observable.from(
            axios
                .post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/compare/`, action.scenarios)
                .then(response => compareScenariosSuccess(response.data))
        ));


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

export const runNetworkEpic = (action$, store) =>
    action$
        .ofType(RUN_NETWORK)
        .concatMap((action) => Rx.Observable.from(
            axios
                .post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/network/${action.network.id}/run/`, action.network)
                .then(response => runNetworkSuccess(response.data))
        ))
        .concatMap(() => Rx.Observable.of(
            setNetworkMenu(true)
        ));

export const createAnugaBoundaryEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_BOUNDARY)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/boundary/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.boundaryTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaBoundary());
        });

export const addAnugaBoundaryEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_BOUNDARY)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/boundary/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const addComparisonEpic = (action$, store) =>
    action$
        .ofType(ADD_COMPARISON)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/comparison/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const createAnugaFrictionEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_FRICTION)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/friction/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.frictionTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaFriction());
        });

export const addAnugaFrictionEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_FRICTION)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/friction/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const createAnugaInflowEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_INFLOW)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/inflow/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.inflowTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaInflow());
        });

export const addAnugaInflowEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_INFLOW)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/inflow/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const createAnugaStructureEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_STRUCTURE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/structure/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.structureTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaStructure());
        });

export const addAnugaStructureEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_STRUCTURE)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/structure/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const addAnugaFullMeshEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_FULL_MESH)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/full-mesh/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const addAnugaMeshRegionEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_MESH_REGION)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/mesh-region/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

// export const addNetworkEpic = (action$, store) =>
//     action$
//         .ofType(ADD_NETWORK)
//         .switchMap(() =>
//             Rx.Observable
//                 .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/network/available/`)
//                     .catch((error) => error)
//                 )
//                 .filter(response1 => response1?.status <= 400)
//                 .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
//         );

export const addCatchmentEpic = (action$, store) =>
    action$
        .ofType(ADD_LUMPED_CATCHMENT)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/catchment/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const addNodesEpic = (action$, store) =>
    action$
        .ofType(ADD_NODES)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/nodes/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const addLinksEpic = (action$, store) =>
    action$
        .ofType(ADD_LINKS)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/links/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status <= 400)
                .switchMap((response1) => addAnugaLayerFromAvailableResponse(response1, store))
        );

export const createAnugaMeshRegionEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_MESH_REGION)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/mesh-region/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.meshRegionTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaMeshRegion());
        });

export const createNetworkEpic = (action$, store) =>
    action$
        .ofType(CREATE_NETWORK)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/network/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.networkTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addNetwork());
        });

export const createFigureEpic = (action$, store) =>
    action$
        .ofType(CREATE_FIGURE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/publication/${action.publicationId}/create-figure/`, {
                    "title": action.figureTitle
                })
                    .catch((error) => error)
                )
        )
        .filter(response1 => response1?.status <= 400)
        .switchMap((response1) => {
            console.log('response1:', response1);
            window.open(response1?.data?.detail_url, '_blank').focus();
            return Rx.Observable.of(initAnuga());
        });

export const createCatchmentEpic = (action$, store) =>
    action$
        .ofType(CREATE_LUMPED_CATCHMENT)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/catchment/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.catchmentTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addCatchment());
        });

export const createNodesEpic = (action$, store) =>
    action$
        .ofType(CREATE_NODES)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/nodes/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.nodesTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addNodes());
        });

export const createLinksEpic = (action$, store) =>
    action$
        .ofType(CREATE_LINKS)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/links/`, {
                    "project": store.getState()?.anuga?.projectData?.id,
                    "title": action.linksTitle
                })
                    .catch((error) => error)
                ))
        .filter(response1 => response1?.status <= 400)
        .switchMap(() => {
            return Rx.Observable.of(addLinks());
        });

export const updateComputeInstanceEpic = (action$, store) =>
    action$
        .ofType(UPDATE_COMPUTE_INSTANCE)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/compute-instance/`))
                .switchMap((response) => {
                    return Rx.Observable.of(updateComputeInstanceSuccess(response.data));
                })
        );


export const prePopulateAnugaFeatureGridWithDefaults = (action$, store) =>
    action$
        .ofType(CREATE_NEW_FEATURE)
        .concatMap((action) => {
            // console.log('store.getState()?.featuregrid?.selectedLayer', store.getState()?.featuregrid?.selectedLayer);
            // console.log('!!store.getState()?.featuregrid?.selectedLayer?.includes(\'geonode:bdy_\')', !!store.getState()?.featuregrid?.selectedLayer?.includes('geonode:bdy_'));
            // console.log('* action', action);
            return Rx.Observable.of(action);
        })
        .filter(() => ['geonode:bdy_', 'geonode:inf_', 'geonode:str_', 'geonode:fri_', 'geonode:mes_'].some(layerType => store.getState()?.featuregrid?.selectedLayer.includes(layerType)))
        .concatMap((action) => {
            // console.log('** CREATE_NEW_FEATURE action', action);
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
            action.features[0].properties = defaultPropertyMap[store.getState()?.featuregrid?.selectedLayer.substring(0, 12)];
            // console.log('** CREATE returning:', action);
            return Rx.Observable.of(action);
        }
        );


export const updateAnugaModelTitle = (action$, store) =>
    action$
        .ofType(UPDATE_DATASET_TITLE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.get(`/api/v2/datasets?search=${action.datasetName.split('geonode:')[1]}&search_fields=name`))
                .switchMap(response => {
                    // find the right anugaModel here, using the response?.data?.datasets?.[0]?.pk
                    const gnLayerPk = parseInt(response?.data?.datasets?.[0]?.pk, 10);
                    // console.log('gnLayerPk:', gnLayerPk);
                    const anugaModels = getAnugaModels(store?.getState());
                    // console.log('anugaModels:', anugaModels);
                    const anugaModel = anugaModels.filter(model => model.gn_layer === gnLayerPk)?.[0];
                    // console.log('anugaModel:', anugaModel);
                    return Rx.Observable
                        .from(axios.patch(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/${anugaModel.apiKey}/${anugaModel.id}/`, {"title": action.newTitle}));
                })
                .switchMap(() => Rx.Observable.empty())
        );


export const getAnugaResourcesEpic = (action$, {getState = () => {}}) =>
    action$.ofType(UPDATE_ANUGA_RESOURCES)
        .switchMap(({action}) => {
            return Rx.Observable.defer(
                () => axios
                    .get(parseDevHostname('/anuga/api/project/'), {
                        params: {
                            page_size: 100,
                            page: 1
                        }
                    })
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

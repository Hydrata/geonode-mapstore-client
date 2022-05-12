import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";
import { addLayer } from '../../../../MapStore2/web/client/actions/layers';
import { zoomToExtent } from "../../../../MapStore2/web/client/actions/map";
import { saveDirectContent } from "../../../actions/gnsave";
import {CREATE_NEW_FEATURE, createNewFeatures} from "../../../../MapStore2/web/client/actions/featuregrid";

import {
    INIT_ANUGA,
    CREATE_ANUGA_BOUNDARY,
    CREATE_ANUGA_FRICTION,
    CREATE_ANUGA_INFLOW,
    CREATE_ANUGA_STRUCTURE,
    CREATE_ANUGA_MESH_REGION,
    ADD_ANUGA_BOUNDARY,
    ADD_ANUGA_FRICTION,
    ADD_ANUGA_INFLOW,
    ADD_ANUGA_STRUCTURE,
    ADD_ANUGA_MESH_REGION,
    CANCEL_ANUGA_RUN,
    RUN_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    START_ANUGA_ELEVATION_POLLING,
    STOP_ANUGA_ELEVATION_POLLING,
    DELETE_ANUGA_SCENARIO,
    UPDATE_COMPUTE_INSTANCE,
    addAnugaBoundary,
    addAnugaFriction,
    addAnugaInflow,
    addAnugaStructure,
    addAnugaMeshRegion,
    setAnugaScenarioData,
    setAnugaScenarioResultsLoaded,
    setAnugaPollingData,
    setAnugaProjectData,
    setAnugaElevationData,
    setAnugaBoundaryData,
    setAnugaInflowData,
    setAnugaStructureData,
    setAnugaFrictionData,
    setAnugaScenarioMenu,
    setAnugaMeshRegionData,
    updateComputeInstanceSuccess,
    startAnugaScenarioPolling,
    runAnugaScenarioSuccess,
    saveAnugaScenarioSuccess,
    deleteAnugaScenarioSuccess,
    initAnuga,
    setCreatingAnugaLayer
} from "./actionsAnuga";
import {
    updateUploadStatus
} from "../SimpleView/actionsSimpleView";

import {show} from '../../../../MapStore2/web/client/actions/notifications';


export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA)
        .filter(() => store.getState()?.gnresource.id)
        .switchMap(() => Rx.Observable
            .from(
                axios.post(`/anuga/api/project/get_project_from_map_id/`, {"mapId": store.getState()?.gnresource.id})
                    .catch((error) => error)
            )
            .filter(response1 => response1?.status >= 400)
            .switchMap(response1 => Rx.Observable
                .from(axios.get(`/anuga/api/project/${response1.data.projectId}/`))
                .switchMap(response2 => Rx.Observable
                    .of(setAnugaProjectData(response2.data))
                    .concat(
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
                            .from(axios.get(`/anuga/api/${response1.data.projectId}/mesh-region/`))
                            .switchMap((response9) => Rx.Observable.of(setAnugaMeshRegionData(response9.data))),
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

export const pollAnugaElevationEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_ELEVATION_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 5000)
                .takeUntil(action$.ofType(STOP_ANUGA_ELEVATION_POLLING))
                .switchMap(() =>
                    Rx.Observable
                        .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/elevation/available/`))
                        .catch((error) => error)
                )
                .filter(response1 => response1?.status >= 400)
                .switchMap(response => {
                    if (response.data?.length < 2) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addAnugaBoundary()),
                            Rx.Observable.of(addAnugaFriction()),
                            Rx.Observable.of(addAnugaStructure()),
                            Rx.Observable.of(addAnugaInflow()),
                            Rx.Observable.of(addAnugaMeshRegion())
                        );
                    }
                    return Rx.Observable.concat(
                        Rx.Observable.of(addLayer(response.data[0])),  // The elevation
                        Rx.Observable.of(addLayer(response.data?.[1])),  // The hillshade
                        Rx.Observable.of(zoomToExtent(
                            response.data[0]?.bbox?.bounds,
                            response.data[0]?.bbox?.crs,
                            20
                        )),
                        Rx.Observable.of(updateUploadStatus('Complete')),
                        Rx.Observable.of(saveDirectContent()),
                        Rx.Observable.of(initAnuga())
                    );
                })
        );

export const pollAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_SCENARIO_POLLING)
        .switchMap(() =>
            Rx.Observable
                .timer(0, 6000)
                .takeUntil(action$.ofType(STOP_ANUGA_SCENARIO_POLLING))
                .switchMap(() =>
                    Rx.Observable.from(
                        axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/`)
                            .catch((error) => error)
                    )
                        .filter(response1 => response1?.status >= 400)
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
                                        if (scenarioFrontEnd?.id === scenarioBackend.id && !scenarioFrontEnd.isLoaded) {
                                            // console.log('using scenarioBackend:', scenarioBackend);
                                            return scenarioBackend;
                                        }
                                        // console.log('rejecting scenarioBackend:', scenarioBackend);
                                        return null;
                                    })[0];
                                    // console.log('scenarioBackendTestResult:', scenarioBackendTestResult);
                                    return scenarioBackendTestResult;
                                })[0];
                                // console.log('frontend scenariosToLoadResults', scenarioToLoadResults);
                                // and check frontend
                                const currentLayerNames = store.getState()?.layers?.flat.map(layer => layer.name);
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
                                            Rx.Observable.of(setAnugaPollingData(action.scenarios)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_depth_integrated_velocity_max)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_depth_max)),
                                            Rx.Observable.of(addLayer(scenarioToLoadResults.latest_run.gn_layer_velocity_max)),
                                            Rx.Observable.of(setAnugaScenarioResultsLoaded(scenarioToLoadResults?.id, true))
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
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/run/`, action.scenario)))
        .concatMap((response) => Rx.Observable.of(
            runAnugaScenarioSuccess(response.data),
            setAnugaScenarioMenu(true)
        ));

export const cancelAnugaRunEpic = (action$, store) =>
    action$
        .ofType(CANCEL_ANUGA_RUN)
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/cancel/`, {"runId": action.scenario.latest_run.id})))
        .concatMap((response) => Rx.Observable.of(show({"message": "cancelling..."}, "warning")));


export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .concatMap((action) => {
            if (action.scenario.id) {
                return Rx.Observable.from(axios.put(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/${action.scenario.id}/`, action.scenario));
            }
            return Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/scenario/`, action.scenario));
        })
        .concatMap((response) => Rx.Observable.of(
            saveAnugaScenarioSuccess(response.data),
            setAnugaScenarioMenu(true)
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
        .filter(response1 => response1?.status >= 400)
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
                .filter(response1 => response1?.status >= 400)
                .switchMap((response) => {
                    if (response.data?.length === 0) {
                        return Rx.Observable.empty();
                    } else if (store.getState().layers.flat.filter(layer => layer.name === response.data[0]?.name).length === 0) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addLayer(response.data[0])),
                            // Rx.Observable.of(saveDirectContent()),
                            Rx.Observable.of(initAnuga()),
                            Rx.Observable.of(setCreatingAnugaLayer(false))
                        );
                    }
                    return Rx.Observable.empty();
                })
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
        .filter(response1 => response1?.status >= 400)
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
                .filter(response1 => response1?.status >= 400)
                .switchMap((response) => {
                    if (response.data?.length === 0) {
                        return Rx.Observable.empty();
                    } else if (store.getState().layers.flat.filter(layer => layer.name === response.data[0]?.name).length === 0) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addLayer(response.data[0])),
                            // Rx.Observable.of(saveDirectContent()),
                            Rx.Observable.of(initAnuga()),
                            Rx.Observable.of(setCreatingAnugaLayer(false))
                        );
                    }
                    return Rx.Observable.empty();
                })
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
        .filter(response1 => response1?.status >= 400)
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
                .filter(response1 => response1?.status >= 400)
                .switchMap((response) => {
                    if (response.data?.length === 0) {
                        return Rx.Observable.empty();
                    } else if (store.getState().layers.flat.filter(layer => layer.name === response.data[0]?.name).length === 0) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addLayer(response.data[0])),
                            // Rx.Observable.of(saveDirectContent()),
                            Rx.Observable.of(initAnuga()),
                            Rx.Observable.of(setCreatingAnugaLayer(false))
                        );
                    }
                    return Rx.Observable.empty();
                })
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
        .filter(response1 => response1?.status >= 400)
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
                .filter(response1 => response1?.status >= 400)
                .switchMap((response) => {
                    if (response.data?.length === 0) {
                        return Rx.Observable.empty();
                    } else if (store.getState().layers.flat.filter(layer => layer.name === response.data[0]?.name).length === 0) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addLayer(response.data[0])),
                            // Rx.Observable.of(saveDirectContent()),
                            Rx.Observable.of(initAnuga()),
                            Rx.Observable.of(setCreatingAnugaLayer(false))
                        );
                    }
                    return Rx.Observable.empty();
                })
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
        .filter(response1 => response1?.status >= 400)
        .switchMap(() => {
            return Rx.Observable.of(addAnugaMeshRegion());
        });

export const addAnugaMeshRegionEpic = (action$, store) =>
    action$
        .ofType(ADD_ANUGA_MESH_REGION)
        .switchMap(() =>
            Rx.Observable
                .from(axios.get(`/anuga/api/${store.getState()?.anuga?.projectData?.id}/mesh-region/available/`)
                    .catch((error) => error)
                )
                .filter(response1 => response1?.status >= 400)
                .switchMap((response) => {
                    if (response.data?.length === 0) {
                        return Rx.Observable.empty();
                    } else if (store.getState().layers.flat.filter(layer => layer.name === response.data[0]?.name).length === 0) {
                        return Rx.Observable.concat(
                            Rx.Observable.of(addLayer(response.data[0])),
                            // Rx.Observable.of(saveDirectContent()),
                            Rx.Observable.of(initAnuga()),
                            Rx.Observable.of(setCreatingAnugaLayer(false))
                        );
                    }
                    return Rx.Observable.empty();
                })
        );

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
        .take(1)
        .concatMap((action) => {
            console.log('store.getState()?.featuregrid?.selectedLayer', store.getState()?.featuregrid?.selectedLayer);
            console.log('!!store.getState()?.featuregrid?.selectedLayer?.includes(\'geonode:bdy_\')', !!store.getState()?.featuregrid?.selectedLayer?.includes('geonode:bdy_'));
            console.log('* action', action);
            return Rx.Observable.of(action);
        })
        .filter(() => ['geonode:bdy_', 'geonode:inf_', 'geonode:str_', 'geonode:fri_', 'geonode:mes_'].some(layerType => store.getState()?.featuregrid?.selectedLayer.includes(layerType)))
        .concatMap((action) => {
            console.log('** CREATE_NEW_FEATURE action', action);
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
                    resolution: 100
                }
            };
            return Rx.Observable.of(createNewFeatures([{
                properties: defaultPropertyMap[store.getState()?.featuregrid?.selectedLayer.substring(0, 12)]
            }]));
        }
        );

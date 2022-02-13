import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";
import { addLayer } from '../../../../MapStore2/web/client/actions/layers';
import { zoomToExtent} from "../../../../MapStore2/web/client/actions/map";
import {saveDirectContent} from "../../../actions/gnsave";

import {
    INIT_ANUGA,
    SET_ADD_ANUGA_ELEVATION_DATA,
    CREATE_ANUGA_BOUNDARY,
    BUILD_ANUGA_SCENARIO,
    RUN_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    START_ANUGA_ELEVATION_POLLING,
    STOP_ANUGA_ELEVATION_POLLING,
    DELETE_ANUGA_SCENARIO,
    setAnugaScenarioData,
    setAnugaScenarioResultsLoaded,
    setAnugaPollingData,
    setAnugaProjectData,
    setAnugaElevationData,
    setAnugaAvailableElevationData,
    setAnugaBoundaryData,
    setAnugaInflowData,
    setAnugaStructureData,
    setAnugaFrictionData,
    setAnugaScenarioMenu,
    stopAnugaElevationPolling,
    runAnugaScenarioSuccess,
    saveAnugaScenarioSuccess,
    deleteAnugaScenarioSuccess,
    initAnuga,
    setCreatingAnugaLayer
} from "./actionsAnuga";
import {
    updateUploadStatus
} from "../SimpleView/actionsSimpleView";


export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA)
        .switchMap(() => Rx.Observable
            .from(axios.post(`/anuga/api/project/get_project_from_map_id/`, {"mapId": store.getState()?.map?.present?.info?.id}))
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
                            .switchMap((response8) => Rx.Observable.of(setAnugaFrictionData(response8.data)))
                    )
                )
                .catch(error => Rx.Observable.of(() => console.log('Error getting available elevations: ', error)))
            )
        );


export const getAnugaAvailElevationsEpic = (action$, store) =>
    action$
        .ofType(SET_ADD_ANUGA_ELEVATION_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/available/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaAvailableElevationData(response.data)));

export const pollAnugaElevationEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_ELEVATION_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 5000)
                .takeUntil(action$.ofType(STOP_ANUGA_ELEVATION_POLLING))
                .switchMap(() =>
                    Rx.Observable
                        .from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/available/`))
                        // .map(response => setAnugaAvailableElevationData(response.data))
                        // .catch(error => Rx.Observable.of(() => window.alert('Error getting available elevations: ' + JSON.stringify(error))))
                )
                .switchMap(action => {
                    if (action.data?.length === 0) {
                        return Rx.Observable.empty();
                    }
                    return Rx.Observable.concat(
                        Rx.Observable.of(addLayer(action.data[0])),
                        Rx.Observable.of(addLayer(action.data?.[1])),
                        Rx.Observable.of(zoomToExtent(
                            action.data[0]?.bbox?.bounds,
                            action.data[0]?.bbox?.crs,
                            20
                        )),
                        Rx.Observable.of(updateUploadStatus('Complete')),
                        Rx.Observable.of(saveDirectContent()),
                        Rx.Observable.of(initAnuga()),
                        Rx.Observable.of(stopAnugaElevationPolling())
                    );
                })
        );

export const createAnugaBoundaryEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_BOUNDARY)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/`, {
                    "project": store.getState()?.anuga?.project?.id,
                    "title": action.boundaryTitle
                }))
                .switchMap(() =>
                    Rx.Observable
                        .from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/available/`))
                        .switchMap((response) => {
                            if (response.data?.length === 0) {
                                return Rx.Observable.empty();
                            }
                            return Rx.Observable.concat(
                                Rx.Observable.of(addLayer(response.data[0])),
                                Rx.Observable.of(saveDirectContent()),
                                Rx.Observable.of(initAnuga()),
                                Rx.Observable.of(setCreatingAnugaLayer(false))
                            );
                        })
                )
        );

export const pollAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(START_ANUGA_SCENARIO_POLLING)
        .switchMap(() =>
            Rx.Observable.timer(0, 6000)
                .takeUntil(action$.ofType(STOP_ANUGA_SCENARIO_POLLING))
                .switchMap(() =>
                    Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/`))
                        .map(res => setAnugaPollingData(res.data))
                        .catch(error => Rx.Observable.of(() => console.log(error)))
                        .switchMap((action) => {
                            console.log('filter this:', action.scenarios);
                            // check backend
                            let scenariosToLoadResults = action.scenarios?.filter(scenario => scenario.latest_run?.status === 'complete');
                            console.log('backend scenariosToLoadResults', scenariosToLoadResults);
                            // now swap to frontend
                            scenariosToLoadResults = store.getState()?.anuga?.scenarios?.filter(scenario => scenario.id === scenariosToLoadResults[0].id);
                            console.log('frontend scenariosToLoadResults', scenariosToLoadResults);
                            // and check frontend
                            if (scenariosToLoadResults?.length > 0 && !scenariosToLoadResults[0].isLoaded) {
                                console.log('turning on: scenariosToLoadResults[0]', scenariosToLoadResults[0]);
                                return Rx.Observable.concat(
                                    Rx.Observable.of(addLayer(scenariosToLoadResults[0].latest_run.gn_layer_depth_integrated_velocity_max)),
                                    Rx.Observable.of(addLayer(scenariosToLoadResults[0].latest_run.gn_layer_depth_max)),
                                    Rx.Observable.of(addLayer(scenariosToLoadResults[0].latest_run.gn_layer_velocity_max)),
                                    Rx.Observable.of(setAnugaScenarioResultsLoaded(scenariosToLoadResults[0].id, true))
                                );
                            }
                            return Rx.Observable.empty();
                        })
                )
        );

export const deleteAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(DELETE_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(axios.delete(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/`)))
        .concatMap((response) => Rx.Observable.of(deleteAnugaScenarioSuccess(response.data)));

export const buildAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(BUILD_ANUGA_SCENARIO)
        .concatMap((action) =>
            Rx.Observable
                .from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/build/`, action.scenario))
                .map(response => saveAnugaScenarioSuccess(response.data))
                .catch(error => Rx.Observable.of(() => console.log(error)))
        );

export const runAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/run/`, action.scenario)))
        .concatMap((response) => Rx.Observable.of(
            runAnugaScenarioSuccess(response.data),
            setAnugaScenarioMenu(true)
        ));


export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .concatMap((action) => {
            if (action.scenario.id) {
                return Rx.Observable.from(axios.put(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/`, action.scenario));
            }
            return Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/`, action.scenario));
        })
        .concatMap((response) => Rx.Observable.of(
            saveAnugaScenarioSuccess(response.data),
            setAnugaScenarioMenu(true)
        ));

import Rx from "rxjs";

import {
    INIT_ANUGA,
    SET_ANUGA_PROJECT_DATA,
    setAnugaScenarioData,
    setAnugaProjectData,
    setAnugaElevationData,
    setAnugaBoundaryData,
    setAnugaInflowData,
    setAnugaStageData,
    setAnugaFrictionData
} from "./actionsAnuga";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA)
        .concatMap(() => Rx.Observable.from(axios.post(`/anuga/api/get_project_from_map_id/`, {"mapId": store.getState()?.map?.present?.info?.id})))
        .concatMap((response) => Rx.Observable.from(axios.get(`/anuga/api/${response.data.projectId}/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaProjectData(response.data)));


export const initAnugaScenarios = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaScenarioData(response.data)));


export const initAnugaElevations = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaElevationData(response.data)));


export const initAnugaBoundaries = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaBoundaryData(response.data)));


export const initAnugaInflows = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/inflow/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaInflowData(response.data)));


export const initAnugaStages = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/stage/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaStageData(response.data)));


export const initAnugaFrictions = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/friction/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaFrictionData(response.data)));

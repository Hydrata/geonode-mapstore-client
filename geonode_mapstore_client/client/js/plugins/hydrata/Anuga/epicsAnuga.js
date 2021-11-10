import Rx from "rxjs";

import {
    INIT_ANUGA,
    SET_ANUGA_PROJECT_DATA,
    SET_ADD_ANUGA_ELEVATION_DATA,
    CREATE_ANUGA_ELEVATION_FROM_LAYER,
    setAnugaScenarioData,
    setAnugaProjectData,
    setAnugaElevationData,
    setAnugaAvailableElevationData,
    setAnugaBoundaryData,
    setAnugaInflowData,
    setAnugaStructureData,
    setAnugaFrictionData
} from "./actionsAnuga";
import {
    textSearch
} from '../../../../MapStore2/web/client/actions/catalog';
import {
    recordToLayer
} from '../../../../MapStore2/web/client/utils/CatalogUtils';
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA)
        .concatMap(() => Rx.Observable.from(axios.post(`/anuga/api/project/get_project_from_map_id/`, {"mapId": store.getState()?.map?.present?.info?.id})))
        .concatMap((response) => Rx.Observable.from(axios.get(`/anuga/api/project/${response.data.projectId}/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaProjectData(response.data)));


export const initAnugaScenariosEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaScenarioData(response.data)));


export const initAnugaElevationsEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaElevationData(response.data)));


export const getAnugaAvailElevationsEpic = (action$, store) =>
    action$
        .ofType(SET_ADD_ANUGA_ELEVATION_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/available/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaAvailableElevationData(response.data)));


export const createAnugaElevationEpic = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_ELEVATION_FROM_LAYER)
        .mergeMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/`, {
            "gn_layer": action.pk,
            "project": store.getState()?.anuga?.project?.id
        })))
        // .concatMap((response) => Rx.Observable.of(addLayersMapViewerUrl(["geonode:existing_surface_utm" || response?.data?.name], ["GeoNode Catalogue"])));
        .mergeMap((response) => Rx.Observable.of(
            textSearch({
                format: 'csw',
                url: 'http://localhost:8000/catalogue/csw',
                startPosition: 1,
                maxRecords: 4,
                text: response?.data?.name,
                options: {}
            })))
        .mergeMap((action) => {
            console.log('map 1', action);
            return Rx.Observable.of(action)
                .mergeMap(() => {
                    console.log('map 2', action);
                    return Rx.Observable.of(action);
                });
        })
        .mergeMap((action) => {
            console.log('map 3', action);
            return Rx.Observable.of(action);
        });

export const initAnugaBoundariesEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaBoundaryData(response.data)));


export const initAnugaInflowsEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/inflow/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaInflowData(response.data)));


export const initAnugaStructuresEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/structure/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaStructureData(response.data)));


export const initAnugaFrictionsEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/friction/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaFrictionData(response.data)));

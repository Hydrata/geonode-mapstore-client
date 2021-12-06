import Rx from "rxjs";

import {
    INIT_ANUGA,
    SET_ANUGA_PROJECT_DATA,
    SET_ADD_ANUGA_ELEVATION_DATA,
    CREATE_ANUGA_ELEVATION_FROM_LAYER,
    CREATE_NEW_BOUNDARY,
    RUN_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO,
    setAnugaScenarioData,
    setAnugaProjectData,
    setAnugaElevationData,
    setAnugaAvailableElevationData,
    setAnugaBoundaryData,
    setAnugaInflowData,
    setAnugaStructureData,
    setAnugaFrictionData,
    runAnugaScenarioSuccess,
    saveAnugaScenarioSuccess
} from "./actionsAnuga";
import {
    textSearch,
    RECORD_LIST_LOADED
} from '../../../../MapStore2/web/client/actions/catalog';
import { ADD_LAYER, addLayer } from '../../../../MapStore2/web/client/actions/layers';
import axios from "../../../../MapStore2/web/client/libs/ajax";
import {zoomToExtent} from "../../../../MapStore2/web/client/actions/map";
import {saveDirectContent} from "../../../actions/gnsave";

const makeBboxFromCSW = (bbox) => {
    return {
        "crs": bbox.crs,
        "bounds": {
            "minx": bbox.extent[0],
            "miny": bbox.extent[1],
            "maxx": bbox.extent[2],
            "maxy": bbox.extent[3]
        }
    };
};

const menuNames = {
    "ele": "Elevations",
    "bdy": "Boundaries",
    "str": "Structures",
    "inf": "Inflows",
    "fri": "Friction Maps"
};

const makeLayerFromTemplate = (id, name, title, bbox) => {
    const menu = menuNames[name.split("geonode:")[1].substring(0, 3)];
    const layer = {
        "type": "wms",
        "format": "image/png",
        "url": "http://localhost:8080/geoserver/ows",
        "visibility": true,
        "opacity": 1,
        "dimensions": [],
        "name": name,
        "title": title,
        "group": `Input Data.${menu}`,
        "description": "No abstract provided",
        "bbox": makeBboxFromCSW(bbox),
        "links": [],
        "params": {},
        "allowedSRS": {},
        "catalogURL": `http://localhost:8000/catalogue/csw?request=GetRecordById&service=CSW&version=2.0.2&elementSetName=full&id=${id}`,
        "tileSize": 512,
        "imageFormats": [
            {
                "label": "image/png",
                "value": "image/png"
            },
            {
                "label": "image/png8",
                "value": "image/png8"
            },
            {
                "label": "image/jpeg",
                "value": "image/jpeg"
            },
            {
                "label": "image/vnd.jpeg-png",
                "value": "image/vnd.jpeg-png"
            },
            {
                "label": "image/vnd.jpeg-png8",
                "value": "image/vnd.jpeg-png8"
            },
            {
                "label": "image/gif",
                "value": "image/gif"
            }
        ],
        "infoFormats": [
            "text/plain",
            "text/html",
            "application/json"
        ]
    };
    console.log('layer:', layer);
    return layer;
};


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


export const createAnugaElevationEpic1 = (action$, store) =>
    action$
        .ofType(CREATE_ANUGA_ELEVATION_FROM_LAYER)
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/elevation/`, {
            "gn_layer": action.pk,
            "project": store.getState()?.anuga?.project?.id
        })))
        .concatMap((response) => {
            console.log('point 3', response);
            return Rx.Observable.of(
                textSearch({
                    format: 'csw',
                    url: '/catalogue/csw',
                    startPosition: 1,
                    maxRecords: 1000,
                    text: response?.data?.name,
                    options: {}
                })
            );
        });

export const createAnugaLayerFromCatSearch = (action$) =>
    action$
        .ofType(RECORD_LIST_LOADED)
        .map(action => action.result.records.filter((record) => record.dc.alternative === 'geonode:' + action.searchOptions.text)[0])
        .concatMap((record) => Rx.Observable.of(
            addLayer(makeLayerFromTemplate(
                record.dc.identifier,
                record.dc.alternative,
                record.dc.title,
                record.boundingBox
            )),
            zoomToExtent(
                makeBboxFromCSW(record.boundingBox).bounds,
                makeBboxFromCSW(record.boundingBox).crs,
                20
            )
        ));

export const autoSaveOnAnugaAddLayer = (action$) =>
    action$
        .ofType(ADD_LAYER)
        .filter((action) => action?.layer?.group.substring(0, 10) === "Input Data")
        .mergeMap(() => Rx.Observable.of(saveDirectContent()));


export const runAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(RUN_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/run/`, action.scenario)))
        .concatMap((response) => Rx.Observable.of(runAnugaScenarioSuccess(response.data)));


export const saveAnugaScenarioEpic = (action$, store) =>
    action$
        .ofType(SAVE_ANUGA_SCENARIO)
        .concatMap((action) => Rx.Observable.from(axios.put(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/${action.scenario.id}/`, action.scenario)))
        .concatMap((response) => Rx.Observable.of(saveAnugaScenarioSuccess(response.data)));

export const initAnugaBoundariesEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaBoundaryData(response.data)));


export const createAnugaBoundary1 = (action$, store) =>
    action$
        .ofType(CREATE_NEW_BOUNDARY)
        .concatMap((action) => Rx.Observable.from(axios.post(`/anuga/api/${store.getState()?.anuga?.project?.id}/boundary/`, {
            "project": store.getState()?.anuga?.project?.id,
            "title": action.boundaryTitle
        })))
        .concatMap((response) => {
            return Rx.Observable.of(
                textSearch({
                    format: 'csw',
                    url: '/catalogue/csw',
                    startPosition: 1,
                    maxRecords: 4,
                    text: response?.data?.name,
                    options: {}
                })
            );
        });


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

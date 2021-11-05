import Rx from "rxjs";

import {
    INIT_ANUGA,
    SET_ANUGA_PROJECT_DATA,
    setAnugaScenarioData,
    setAnugaProjectData
} from "./actionsAnuga";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const initAnugaEpic = (action$, store) =>
    action$
        .ofType(INIT_ANUGA)
        .concatMap(() => Rx.Observable.from(axios.post(`/anuga/api/get_project_from_map_id/`, {"mapId": store.getState()?.map?.present?.info?.id})))
        .concatMap((response) => Rx.Observable.from(axios.get(`/anuga/api/${response.data.projectId}/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaProjectData(response.data)));
        // .concatMap((response) => Rx.Observable.from(axios.get(`/anuga/api/${response.data.id}/scenario/`)))
        // .concatMap((response) => Rx.Observable.of(setAnugaScenarioData(response.data)));


export const initAnugaScenarios = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .concatMap(() => Rx.Observable.from(axios.get(`/anuga/api/${store.getState()?.anuga?.project?.id}/scenario/`)))
        .concatMap((response) => Rx.Observable.of(setAnugaScenarioData(response.data)));


import Rx from "rxjs";
import axios from "../../../../MapStore2/web/client/libs/ajax";

import {
    INIT_HYDROLOGY,
    FETCH_HYDROLOGY_TIME_SERIES_DATA,
    fetchHydrologyTimeSeriesData,
    setHydrologyTimeSeriesData,
    errorHydrologyTimeSeriesData,
    FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    fetchHydrologyTemporalPatternData,
    setHydrologyTemporalPatternData,
    errorHydrologyTemporalPatternData,
    FETCH_HYDROLOGY_IDF_TABLE_DATA,
    fetchHydrologyIdfTableData,
    setHydrologyIdfTableData,
    errorHydrologyIdfTableData,
    SAVE_HYDROLOGY_ITEM,
    saveHydrologyItemSuccess,
    saveHydrologyItemFailure,
    createHydrologyItemSuccess,
    createHydrologyItemFailure,
    DELETE_HYDROLOGY_ITEM,
    deleteHydrologyItemSuccess,
    deleteHydrologyItemFailure
} from "../Hydrology/actionsHydrology";
import {show} from '../../../../MapStore2/web/client/actions/notifications';

// V2P-79 / V2P-77 — V1 hydrology routes were /anuga/api/{pid}/<endpoint>/
// where <endpoint> was 'time-series' / 'temporal-pattern' / 'idf-table'
// (singular, the V1 route segments). V2 paths nest under projects with
// pluralised segments per /opt/hydrata/apps/gn_anuga/urls.py:
//   * /api/v2/anuga/projects/{pid}/idf-tables/
//   * /api/v2/anuga/projects/{pid}/time-series/        (already plural)
//   * /api/v2/anuga/projects/{pid}/temporal-patterns/
//
// Action `activeHydrologyPage` historically carries the V1 route segment
// (also matches the per-page UI tab). Map at the API boundary so callers
// stay unchanged.
const V1_TO_V2_HYDROLOGY = {
    'time-series': 'time-series',
    'temporal-pattern': 'temporal-patterns',
    'idf-table': 'idf-tables'
};

const v2Hydrology = (page) => V1_TO_V2_HYDROLOGY[page] || page;

async function fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction) {
    try {
        const response = await axios.get(
            `/api/v2/anuga/projects/${projectId}/${v2Hydrology(endpoint)}/`
        );
        return dispatchFunction(response.data);
    } catch (error) {
        return errorFunction(error);
    }
}

export const initHydrologyEpic = (action$, store) =>
    action$
        .ofType(INIT_HYDROLOGY)
        .filter(() => store.getState()?.gnresource.id)
        .filter(() => store.getState()?.anuga?.projectData?.id)
        .mergeMap(() => {
            let response;
            try {
                const user = store.getState()?.security?.user;
                if (!user) return null;

                response = Rx.Observable.of(
                    fetchHydrologyTimeSeriesData(),
                    fetchHydrologyTemporalPatternData(),
                    fetchHydrologyIdfTableData()
                );
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTimeSeriesEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TIME_SERIES_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                const endpoint = "time-series";
                const dispatchFunction = setHydrologyTimeSeriesData;
                const errorFunction = errorHydrologyTimeSeriesData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTemporalPatternEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                const endpoint = "temporal-pattern";
                const dispatchFunction = setHydrologyTemporalPatternData;
                const errorFunction = errorHydrologyTemporalPatternData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchIdfTableEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_IDF_TABLE_DATA)
        .mergeMap(() => {
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                const endpoint = "idf-table";
                const dispatchFunction = setHydrologyIdfTableData;
                const errorFunction = errorHydrologyIdfTableData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                response = Rx.Observable.empty();
            }
            return response;
        });

export const saveHydrologyItemEpic = (action$, store) =>
    action$
        .ofType(SAVE_HYDROLOGY_ITEM)
        .mergeMap(action => {
            const postData = {
                headers: {
                    'Accept': 'application/json'
                },
                ...action.item,
                data: action.item.data
            };
            const projectId = store.getState()?.anuga?.projectData?.id;
            if (typeof action.item?.id === 'number' || typeof action.item?.id === 'string' && !isNaN(Number(action.item?.id))) {
                return Rx.Observable.from(
                    axios.patch(
                        `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/${action.item.id}/`,
                        postData
                    )
                )
                    .mergeMap(response =>
                        Rx.Observable.from([
                            saveHydrologyItemSuccess(action.activeHydrologyPage, response.data),
                            show({
                                "message": `Successfully saved ${response.data.name}`,
                                "title": "hydrata.hydrology.success",
                                "uid": 1000,
                                "position": "tc"
                            })
                        ])
                    )
                    .catch(error => Rx.Observable.from([
                        saveHydrologyItemFailure(error.data),
                        show({
                            "message": `Error: ${error.data?.errors}`,
                            "title": "hydrata.hydrology.error",
                            "uid": 6000,
                            "position": "tc"
                        }, 'error')
                    ]));
            }
            return Rx.Observable.from(
                axios.post(
                    `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/`,
                    postData
                )
            )
                .mergeMap(response =>
                    Rx.Observable.from([
                        createHydrologyItemSuccess(action.activeHydrologyPage, response.data),
                        show({
                            "message": `Successfully created ${response.data.name}`,
                            "title": "hydrata.hydrology.success",
                            "uid": 1000,
                            "position": "tc"
                        })
                    ])
                )
                .catch(error => Rx.Observable.from([
                    createHydrologyItemFailure(error.data),
                    show({
                        "message": `Error: ${error.data?.errors}`,
                        "title": "hydrata.hydrology.error",
                        "uid": 6000,
                        "position": "tc"
                    }, 'error')
                ]));
        });


export const deleteHydrologyItemEpic = (action$, store) =>
    action$
        .ofType(DELETE_HYDROLOGY_ITEM)
        .mergeMap(action => {
            const projectId = store.getState()?.anuga?.projectData?.id;
            return Rx.Observable.from(
                axios.delete(
                    `/api/v2/anuga/projects/${projectId}/${v2Hydrology(action.activeHydrologyPage)}/${action.item.id}/`
                )
            )
                .mergeMap(() =>
                    Rx.Observable.from([
                        deleteHydrologyItemSuccess(action.activeHydrologyPage, action.item),
                        show({
                            "message": `Successfully deleted ${action.item.name}`,
                            "title": "hydrata.hydrology.success",
                            "uid": 1000,
                            "position": "tc"
                        })
                    ])
                )
                .catch(error => Rx.Observable.from([
                    deleteHydrologyItemFailure(error.data),
                    show({
                        "message": `Error: ${error.data?.errors}`,
                        "title": "hydrata.hydrology.error",
                        "uid": 6000,
                        "position": "tc"
                    }, 'error')
                ]));
        });

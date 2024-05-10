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
    errorHydrologyIdfTableData
} from "../Hydrology/actionsHydrology";


async function fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction) {
    try {
        const response = await axios.get(`/anuga/api/${projectId}/${endpoint}/`);
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
            console.log('initHydrologyEpic 1');
            try {
                // const mapId = store.getState()?.gnresource.id;
                const user = store.getState()?.security?.user;
                if (!user) return null;
                // const projectResponse = axios.post(`/anuga/api/project/get_project_from_map_id/`, {"mapId": mapId});
                // const projectId = projectResponse.data.projectId;
                // if (projectResponse.status > 400 || !projectId) return null;
                console.log('initHydrologyEpic 1');

                response = Rx.Observable.of(
                    fetchHydrologyTimeSeriesData(),
                    fetchHydrologyTemporalPatternData(),
                    fetchHydrologyIdfTableData()
                );
            } catch (error) {
                console.log('initHydrologyEpic 1 error', error);
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTimeSeriesEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TIME_SERIES_DATA)
        .mergeMap(() => {
            console.log('fetchTimeSeriesEpic 1 state', store.getState());
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                console.log('fetchTimeSeriesEpic projectId', projectId);
                const endpoint = "time-series";
                const dispatchFunction = setHydrologyTimeSeriesData;
                const errorFunction = errorHydrologyTimeSeriesData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                console.log('fetchTimeSeriesEpic error', error);
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchTemporalPatternEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_TEMPORAL_PATTERN_DATA)
        .mergeMap(() => {
            console.log('fetchTemporalPatternEpic 1');
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                const endpoint = "temporal-pattern";
                const dispatchFunction = setHydrologyTemporalPatternData;
                const errorFunction = errorHydrologyTemporalPatternData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                console.log('fetchTemporalPatternEpic error', error);
                response = Rx.Observable.empty();
            }
            return response;
        });

export const fetchIdfTableEpic = (action$, store) =>
    action$
        .ofType(FETCH_HYDROLOGY_IDF_TABLE_DATA)
        .mergeMap(() => {
            console.log('fetchIdfTableEpic 1');
            let response;
            try {
                const projectId = store.getState()?.anuga?.projectData?.id;
                const endpoint = "idf-table";
                const dispatchFunction = setHydrologyIdfTableData;
                const errorFunction = errorHydrologyIdfTableData;
                response = fetchAndDispatch(projectId, endpoint, dispatchFunction, errorFunction);
            } catch (error) {
                console.log('fetchIdfTableEpic error', error);
                response = Rx.Observable.empty();
            }
            return response;
        });

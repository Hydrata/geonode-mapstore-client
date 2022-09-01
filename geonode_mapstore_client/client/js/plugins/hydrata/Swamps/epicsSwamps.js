import Rx from "rxjs";

import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";
import {setLayer} from "../../../../MapStore2/web/client/actions/featuregrid";
import {
    featureTypeSelected,
    query,
    FEATURE_TYPE_LOADED,
    FEATURE_TYPE_SELECTED,
    QUERY_RESULT
} from "../../../../MapStore2/web/client/actions/wfsquery";
import {
    INIT_SWAMPS,
    REFRESH_SWAMPS,
    saveSwampQueryToStore,
    setVisibleSwampsChart,
    setSelectedSwampId,
    processSurveySites
} from "./actionsSwamps";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const refreshSwampsEpic = (action$) =>
    action$.ofType(REFRESH_SWAMPS)
        .mergeMap(() => {
            return Rx.Observable.from(
                axios.get(`/swamps/api/update-from-airtables`)
            );
        })
        .mergeMap((response) => {
            console.log('refreshSwampsEpic Exhaust', response);
            if (response) {
                return Rx.Observable.of(
                    window.location.reload(false)
                );
            }
            return null;
        });


export const initSwampsEpic = (action$) =>
    action$.ofType(INIT_SWAMPS)
        .mergeMap(() => {
            return Rx.Observable.from(
                axios.get(`/swamps/api/survey-site`)
            );
        })
        .mergeMap((response) => {
            if (response) {
                return Rx.Observable.of(
                    processSurveySites(response.data)
                );
            }
            return null;
        });

export const queryLayerAttributesToStoreStep1 = (action$, store) =>
    action$
        .ofType(LOAD_FEATURE_INFO)
        .filter((action) => {
            console.log('LOAD_FEATURE_INFO unfiltered:', action);
            if (action?.layer?.id?.includes('bluemountains_thpss')) {
                console.log('queryLayerAttributesToStoreStep1', action);
                return action;
            }
            console.log('LOAD_FEATURE_INFO returning null');
            return null;
        })
        .mergeMap((action) => Rx.Observable.merge(
            Rx.Observable.of(setVisibleSwampsChart(true)),
            Rx.Observable.of(setSelectedSwampId(action?.data?.substring(action?.data.indexOf("FID_1 = ") + 8, action?.data.lastIndexOf('\nSWAMP')))),
            Rx.Observable.of(closeIdentify()),
            Rx.Observable.of(setLayer(action?.layer.id)),
            Rx.Observable.of(featureTypeSelected(store.getState()?.gnsettings?.geoserverUrl + '/wfs', action?.layer?.name))
        ));


export const queryLayerAttributesToStoreStep2 = (action$, store) =>
    action$
        .ofType(FEATURE_TYPE_LOADED, FEATURE_TYPE_SELECTED)
        .filter((action) => {
            if (action?.typeName?.includes('bluemountains_thpss')) {
                console.log('queryLayerAttributesToStoreStep2', action);
                return action;
            }
            return null;
        })
        .mergeMap((action) => Rx.Observable.of(
            query(
                store.getState()?.gnsettings?.geoserverUrl + '/ows',
                {
                    "featureTypeName": "bluemountains_thpss_e_4480_32756",
                    "filterType": "OGC",
                    "ogcVersion": "1.1.0",
                    "pagination": {
                        "startIndex": 0,
                        "maxFeatures": 2000
                    }
                },
                {},
                'swamps: get bluemountains_thpss data'
            )
        ));


export const queryLayerAttributesToStoreStep3 = (action$, store) =>
    action$
        .ofType(QUERY_RESULT)
        .filter((action) => action?.reason === 'swamps: get bluemountains_thpss data')
        .mergeMap((action) => {
            console.log('queryLayerAttributesToStoreStep3', action);
            const selectedSwampId = store.getState().swamps?.selectedSwampId;
            const selectedSwampIdInt = parseInt(selectedSwampId.split('.')[1], 10);
            const selectedSwampData = action.result.features.filter((feature) => feature.id === selectedSwampId)[0];
            selectedSwampData.sites = store.getState().swamps?.surveySites?.filter((site) => site?.swamp === selectedSwampIdInt);
            return Rx.Observable.of(
                saveSwampQueryToStore(selectedSwampData)
            );
        }
        );

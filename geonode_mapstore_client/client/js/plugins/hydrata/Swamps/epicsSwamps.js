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
    setCurrentSwampId,
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
            if (action?.data?.features?.[0]?.id?.includes('bluemountains_thpss')) {
                console.log('queryLayerAttributesToStoreStep1', action);
                return action;
            }
            return null;
        })
        .mergeMap((action) => Rx.Observable.merge(
            Rx.Observable.of(setVisibleSwampsChart(true)),
            Rx.Observable.of(setCurrentSwampId(action?.data?.features?.[0]?.id)),
            Rx.Observable.of(closeIdentify()),
            Rx.Observable.of(setLayer(action?.layer.id)),
            Rx.Observable.of(featureTypeSelected(store.getState()?.gnsettings?.geoserverUrl + '/wfs', "geonode:" + action?.data?.features?.[0]?.id.split('.')[0]))
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
                    "featureTypeName": action.typeName,
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
            const currentSwampId = store.getState().swamps?.currentSwampId;
            const currentSwampIdInt = parseInt(currentSwampId.split('.')[1], 10);
            const currentSwampData = action.result.features.filter((feature) => feature.id === currentSwampId)[0];
            currentSwampData.sites = store.getState().swamps?.surveySites?.filter((site) => site?.swamp === currentSwampIdInt);
            return Rx.Observable.of(
                saveSwampQueryToStore(currentSwampData)
            );
        }
        );

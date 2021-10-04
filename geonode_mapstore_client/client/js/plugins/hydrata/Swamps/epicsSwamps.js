import Rx from "rxjs";

import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";
import {setLayer} from "../../../../MapStore2/web/client/actions/featuregrid";
import {featureTypeSelected, query, FEATURE_TYPE_LOADED, QUERY_RESULT} from "../../../../MapStore2/web/client/actions/wfsquery";
import {
    INIT_SWAMPS,
    saveSwampQueryToStore,
    setVisibleSwampsChart,
    setCurrentSwampId,
    refreshPage
} from "./actionsSwamps";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const initSwampsEpic = (action$) =>
    action$.ofType(INIT_SWAMPS)
        .mergeMap(() => {
            return Rx.Observable.from(
                axios.get(`/swamps/api/update-from-airtables`)
            );
        })
        .mergeMap((response) => {
            console.log('initSwmap Exhaust', response);
            if (response) {
                return Rx.Observable.of(
                    refreshPage()
                );
            }
            return null;
        });

export const queryLayerAttributesToStoreStep1 = (action$, store) =>
    action$
        .ofType(LOAD_FEATURE_INFO)
        .filter((action) => {
            if (action?.data?.features?.[0]?.id?.includes('bluemountains_thpss')) {
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
        .ofType(FEATURE_TYPE_LOADED)
        .filter((action) => {
            if (action?.typeName?.includes('bluemountains_thpss')) {
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
            const currentSwampId = store.getState().swamps?.currentSwampId;
            return Rx.Observable.of(
                saveSwampQueryToStore(action.result.features.filter((feature) => feature.id === currentSwampId)[0])
            );
        }
        );

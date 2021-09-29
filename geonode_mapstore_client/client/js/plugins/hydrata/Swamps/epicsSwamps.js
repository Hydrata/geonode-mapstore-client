import Rx from "rxjs";
import {saveSwampsQueryToStore, setVisibleSwampsChart, setCurrentSwampsSurveySiteId} from "./actionsSwamps";
import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";
import {setLayer} from "../../../../MapStore2/web/client/actions/featuregrid";
import {featureTypeSelected, query, FEATURE_TYPE_LOADED, QUERY_RESULT} from "../../../../MapStore2/web/client/actions/wfsquery";


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
            Rx.Observable.of(setCurrentSwampsSurveySiteId(action?.data?.features?.[0]?.properties?.site_id)),
            Rx.Observable.of(closeIdentify()),
            Rx.Observable.of(setLayer(action?.layer.id)),
            Rx.Observable.of(featureTypeSelected(store.getState()?.gnsettings?.geoserverUrl + '/wfs', "geonode:swamps_surveysite"))
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
                'swamps: get swamps_surveysite data'
            )
        ));


export const queryLayerAttributesToStoreStep3 = (action$, store) =>
    action$
        .ofType(QUERY_RESULT)
        .filter((action) => action?.reason === 'swamps: get bluemountains_thpss data')
        .mergeMap((action) => Rx.Observable.of(
            saveSwampsQueryToStore(action.result.features)
        ));

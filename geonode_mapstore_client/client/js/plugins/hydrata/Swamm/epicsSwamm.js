import Rx from "rxjs";
import {
    QUERY_RESULT,
    query,
    createQuery,
    FEATURE_TYPE_LOADED,
    FEATURE_TYPE_SELECTED,
    resetQuery,
    featureTypeSelected
} from "../../../../MapStore2/web/client/actions/wfsquery";
const axios = require('../../../../MapStore2/web/client/libs/ajax');
import {
    clearDrawingBmpLayerName,
    hideBmpForm,
    submitBmpForm,
    UPDATE_BMP_FORM,
    makeExistingBmpForm,
    getBmpFormSuccess,
    clearEditingBmpFeatureId,
    createBmpFeatureId,
    SHOW_SWAMM_FEATURE_GRID,
    showBmpForm,
    setUpdatingBmp,
    registerMissingBmpFeatureId
} from "./actionsSwamm";
import {
    toggleEditMode,
    toggleViewMode,
    createNewFeatures,
    startDrawingFeature,
    selectFeatures,
    setLayer,
    openFeatureGrid,
    SAVE_SUCCESS,
    GRID_QUERY_RESULT
} from "../../../../MapStore2/web/client/actions/featuregrid";
import {
    drawStopped
} from "../../../../MapStore2/web/client/actions/draw";
import { setHighlightFeaturesPath } from "../../../../MapStore2/web/client/actions/highlight";

import { get } from 'lodash';
import {reset} from '../../../../MapStore2/web/client/actions/queryform';
import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";

const createInitialQueryFlow = (action$, store, {url, name, id} = {}) => {
    const filterObj = get(store.getState(), `featuregrid.advancedFilters["${id}"]`);
    const createInitialQuery = () => createQuery(url, filterObj || {
        featureTypeName: name,
        filterType: 'OGC',
        ogcVersion: '1.1.0'
    });

    // if (isDescribeLoaded(store.getState(), name)) {
    //     return Rx.Observable.of(createInitialQuery(), featureTypeSelected(url, name));
    // }
    return Rx.Observable.of(featureTypeSelected(url, name)).merge(
        action$.ofType(FEATURE_TYPE_LOADED).filter(({typeName} = {}) => typeName === name)
            .map(createInitialQuery)
    );
};


export const catchBmpFeatureClick = (action$, store) =>
    action$
        .ofType(LOAD_FEATURE_INFO)
        .filter((action) => {
            const possibleBmpFeatures = action?.data?.features?.map((feature) => {
                if (
                    /([a-zA-Z0-9]{3}_){2}outlet/.test(feature.id) ||
                    /([a-zA-Z0-9]{3}_){2}footprint/.test(feature.id) ||
                    /([a-zA-Z0-9]{3}_){2}watershed/.test(feature.id)
                ) { return feature;}
                return null;
            });
            return !!possibleBmpFeatures[0];
        })
        .mergeMap((action) => {
            const possibleBmpFeature = action?.data?.features?.map((feature) => {
                if (
                    /([a-zA-Z0-9]{3}_){2}outlet/.test(feature.id) ||
                    /([a-zA-Z0-9]{3}_){2}footprint/.test(feature.id) ||
                    /([a-zA-Z0-9]{3}_){2}watershed/.test(feature.id)
                ) {
                    return feature;
                }
                return null;
            });
            const mapId = store.getState()?.swamm?.data?.base_map;
            return Rx.Observable.from(axios.get(`/swamm/api/${mapId}/bmps/${possibleBmpFeature[0]?.properties?.id}/`));
        })
        .mergeMap((response) => Rx.Observable.of(
            closeIdentify(),
            getBmpFormSuccess(response.data),
            makeExistingBmpForm(response.data),
            setUpdatingBmp(response.data),
            showBmpForm()
        ));

export const setBmpDrawingLayerEpic = (action$, store) =>
    action$
        .ofType(FEATURE_TYPE_LOADED)
        .filter((action) => {
            return action?.typeName?.includes(store.getState()?.swamm?.data?.code + '_bmp_');
        })
        .flatMap((action) => Rx.Observable.of(
            query(
                'http://localhost:8080/geoserver/wfs',
                {
                    featureTypeName: action?.typeName,
                    filterType: 'OGC',
                    ogcVersion: '1.1.0'
                },
                {},
                'querySetNewBmpLayer'
            )
        ));

export const startBmpCreateFeatureEpic = (action$, store) =>
    action$.ofType(QUERY_RESULT)
        .filter(() => {
            console.log('startBmpCreateFeatureEpic1', !store.getState()?.swamm?.editingBmpFeatureId);
            return !store.getState()?.swamm?.editingBmpFeatureId;
        })
        .filter((action) => {
            console.log('startBmpCreateFeatureEpic2', action?.filterObj?.featureTypeName.includes(store.getState()?.swamm?.drawingBmpLayerName));
            return action?.filterObj?.featureTypeName.includes(store.getState()?.swamm?.drawingBmpLayerName);
        })
        .filter(action => {
            console.log('startBmpCreateFeatureEpic3', action?.reason === 'querySetNewBmpLayer');
            return action?.reason === 'querySetNewBmpLayer';
        })
        .flatMap(() => Rx.Observable.of(
            toggleEditMode(),
            createNewFeatures([{}]),
            startDrawingFeature(),
            setHighlightFeaturesPath('draw.tempFeatures'),
            hideBmpForm()
        ));

export const finishBmpCreateFeatureEpic = (action$, store) =>
    action$.ofType(QUERY_RESULT)
        .filter(() => {
            console.log('finishBmpCreateFeatureEpic1', !store.getState()?.swamm?.editingBmpFeatureId);
            return !store.getState()?.swamm?.editingBmpFeatureId;
        })
        .filter(() => {
            console.log('finishBmpCreateFeatureEpic2', store.getState()?.swamm?.missingBmpFeatureId);
            return store.getState()?.swamm?.missingBmpFeatureId;
        })
        .flatMap((action) => Rx.Observable.of(
            createBmpFeatureId(action),
            registerMissingBmpFeatureId(false),
            clearDrawingBmpLayerName(),
            drawStopped(),
            toggleViewMode(),
            setHighlightFeaturesPath('highlight.emptyFeatures'),
            submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.data?.base_map),
            resetQuery()
        ));

export const startBmpEditFeatureEpic = (action$, store) =>
    action$.ofType(QUERY_RESULT)
        .filter(() => {
            console.log('startBmpEditFeatureEpic1', store.getState()?.swamm?.editingBmpFeatureId);
            return store.getState()?.swamm?.editingBmpFeatureId;
        })
        .filter(action => {
            console.log('startBmpEditFeatureEpic2', action?.reason === 'querySetNewBmpLayer');
            return action?.reason === 'querySetNewBmpLayer';
        })
        .flatMap(() => Rx.Observable.of(
            selectFeatures(store.getState()?.query?.result?.features.filter((feature) => feature?.id === store.getState()?.swamm?.editingBmpFeatureId)),
            toggleEditMode(),
            hideBmpForm(),
            resetQuery()
        ));

export const saveBmpCreateFeatureEpic = (action$, store) =>
    action$.ofType(SAVE_SUCCESS)
        .filter(() => {
            console.log('saveBmpCreateFeatureEpic1', store.getState()?.swamm?.drawingBmpLayerName);
            return store.getState()?.swamm?.drawingBmpLayerName;
        })
        .filter(() => {
            console.log('WARNING: saveBmpCreateFeatureEpic2', !store.getState()?.swamm?.editingBmpFeatureId);
            return !store.getState()?.swamm?.editingBmpFeatureId;
        })
        .flatMap(() => Rx.Observable.of(
            registerMissingBmpFeatureId(true)
            // query('http://localhost:8080/geoserver/wfs',
            //     {
            //         featureTypeName: store.getState()?.swamm?.drawingBmpLayerName,
            //         filterType: 'OGC',
            //         ogcVersion: '1.1.0',
            //         pagination: {maxFeatures: 2000000}
            //     },
            //     {},
            //     'queryGetNewBmpId'
            // )
        ));

export const saveBmpEditFeatureEpic = (action$, store) =>
    action$.ofType(SAVE_SUCCESS)
        .filter(() => {
            console.log('saveBmpEditFeatureEpic', store.getState()?.swamm?.editingBmpFeatureId);
            return store.getState()?.swamm?.editingBmpFeatureId;
        })
        .flatMap(() => Rx.Observable.of(
            clearEditingBmpFeatureId(),
            clearDrawingBmpLayerName(),
            drawStopped(),
            toggleViewMode(),
            setHighlightFeaturesPath('highlight.emptyFeatures'),
            submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.data?.base_map)
        ));

export const autoSaveBmpFormEpic = (action$, store) =>
    action$.ofType(UPDATE_BMP_FORM)
        .flatMap(() => {
            if (store.getState()?.swamm?.storedBmpForm?.groupProfile && store.getState()?.swamm?.storedBmpForm?.bmpName) {
                return Rx.Observable.of(
                    // submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.projectManager?.data?.base_map)
                );
            }
            return null;
        });

export const showBmpFeatureGridEpic = (action$, store) =>
    action$.ofType(SHOW_SWAMM_FEATURE_GRID)
        .flatMap( (action) => {
            const currentTypeName = get(store.getState(), "query.typeName");
            return Rx.Observable.of(
                ...(currentTypeName !== action?.layer.name ? [reset()] : []),
                // setControlProperty('drawer', 'enabled', false),
                setLayer(action?.layer.id),
                openFeatureGrid()
            ).merge(
                createInitialQueryFlow(action$, store, action?.layer)
            );
        });

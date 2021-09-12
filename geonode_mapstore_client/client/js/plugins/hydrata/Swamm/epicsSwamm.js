import Rx from "rxjs";
const axios = require('../../../../MapStore2/web/client/libs/ajax');
import {
    QUERY_RESULT,
    query,
    FEATURE_TYPE_LOADED,
    FEATURE_TYPE_SELECTED,
    resetQuery
} from "../../../../MapStore2/web/client/actions/wfsquery";
import {
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    clearDrawingBmpLayerName,
    hideLoadingBmp,
    submitBmpForm,
    MAKE_EXISTING_BMP_FORM,
    makeExistingBmpForm,
    updateBmpForm,
    getBmpFormSuccess,
    clearEditingBmpFeatureId,
    showBmpForm,
    setUpdatingBmp,
    registerMissingBmpFeatureId,
    updateBmpTypeGroups
} from "./actionsSwamm";
import {
    toggleEditMode,
    toggleViewMode,
    createNewFeatures,
    startDrawingFeature,
    selectFeatures,
    SAVE_SUCCESS
} from "../../../../MapStore2/web/client/actions/featuregrid";
import {drawStopped} from "../../../../MapStore2/web/client/actions/draw";
import { setHighlightFeaturesPath } from "../../../../MapStore2/web/client/actions/highlight";
import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";


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

export const setCreateBmpDrawingLayerEpic = (action$, store) =>
    action$
        .ofType(FEATURE_TYPE_LOADED)
        .filter((action) => {
            console.log('setBmpDrawingLayerEpic1', action?.typeName?.includes(store.getState()?.swamm?.data?.code + '_bmp_'));
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

export const setEditBmpDrawingLayerEpic = (action$, store) =>
    action$
        .ofType(FEATURE_TYPE_SELECTED)
        .filter((action) => {
            console.log('setBmpDrawingLayerEpic1', action?.typeName?.includes(store.getState()?.swamm?.data?.code + '_bmp_'));
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
            hideLoadingBmp()
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
        .mergeMap(() => {
            const mapId = store.getState()?.swamm?.data?.base_map;
            const geomType = store.getState()?.swamm?.drawingBmpLayerName?.slice(8);
            return Rx.Observable.from(
                axios.get(`/swamm/api/${mapId}/bmps/get-latest-feature-id/${geomType}/`)
            );
        })
        .mergeMap((response) => Rx.Observable.of(
            updateBmpForm(response.data),
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
            hideLoadingBmp(),
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
            registerMissingBmpFeatureId(store.getState()?.swamm?.drawingBmpLayerName)
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
    action$.ofType(MAKE_EXISTING_BMP_FORM)
        .filter(() =>
            (store.getState()?.swamm?.storedBmpForm?.footprint_fid && !store.getState()?.swamm?.storedBmpForm?.calculated_footprint_area) ||
            (store.getState()?.swamm?.storedBmpForm?.watershed_fid && !store.getState()?.swamm?.storedBmpForm?.calculated_watershed_area)
        )
        .flatMap(() => {
            return Rx.Observable.of(
                submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.data?.base_map)
            );
        });


export const getBmpTypeGroups = (action$, store) =>
    action$.ofType(FETCH_PROJECT_MANAGER_CONFIG_SUCCESS)
        .mergeMap(() => {
            const mapId = store.getState()?.swamm?.data?.base_map;
            return Rx.Observable.from(
                axios.get(`/swamm/api/${mapId}/bmp-type/bmp_type_group_list/`)
            );
        })
        .mergeMap((response) => Rx.Observable.of(
            updateBmpTypeGroups(response.data)
        ));

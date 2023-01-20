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
    changeLayerProperties,
    refreshLayerVersion,
    addLayer
} from "../../../../MapStore2/web/client/actions/layers";
import {show} from '../../../../MapStore2/web/client/actions/notifications';
import {
    INIT_SWAMM,
    setSwammProjectData,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    DOWNLOAD_BMP_REPORT,
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
    updateBmpTypeGroups,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    setBmpLayers, TOGGLE_BMP_PRIORITY_VISIBILITY,
    fetchSwammBmpTypesSuccess,
    fetchGroupProfilesSuccess,
    fetchSwammBmpStatusesSuccess,
    fetchSwammTargetsSuccess
} from "@js/plugins/hydrata/Swamm/actionsSwamm";
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

const addLayerFromGeonodeResponse = (layerToAdd, store, group) => {
    let actions = [];
    if (store.getState().layers.flat.filter(layer => layer.name === layerToAdd?.name).length === 0) {
        layerToAdd.visibility = true;
        layerToAdd.opacity = 1;
        layerToAdd.group = group;
        actions.push(addLayer(layerToAdd));
        actions.push(
            show({
                "message": "BMP layers added.",
                "title": "Layers added",
                "uid": 1000,
                "position": "tc"
            })
        );
    }
    console.log('layerToAdd:', layerToAdd);
    console.log('actions:', actions);
    return Rx.Observable.from(actions);
};


export const initSwammEpic = (action$, store) =>
    action$
        .ofType(INIT_SWAMM)
        .filter(() => store.getState()?.gnresource.id)
        .switchMap(() => Rx.Observable
            .from(
                axios.post(`/swamm/api/project/get_project_from_map_id/`, {"mapId": store.getState()?.gnresource.id})
                    .catch((error) => {
                        console.log('** swamm get_project_from_map_id', error); return 'error';
                    })
            )
            .filter(response1 => response1?.status <= 400)
            .filter(() => !!store.getState()?.security?.user)
            .switchMap(response1 => Rx.Observable
                .from(axios.get(`/swamm/api/project/${response1.data.projectId}/`))
                // .filter(response2 => response2?.status <= 400)
                .switchMap(response2 => Rx.Observable
                    .of(setSwammProjectData(response2.data))
                    .concat(
                        // Rx.Observable.from(addLayerFromGeonodeResponse(response2.data?.bmp_outlet, store, "View BMPs")),
                        // Rx.Observable.from(addLayerFromGeonodeResponse(response2.data?.bmp_footprint, store, "View BMPs")),
                        // Rx.Observable.from(addLayerFromGeonodeResponse(response2.data?.bmp_watershed, store, "View BMPs")),
                        Rx.Observable.from(axios.get(`/swamm/api/${response1.data.projectId}/bmp-type/`))
                            .switchMap((response3) => Rx.Observable.of(fetchSwammBmpTypesSuccess(response3.data))),
                        Rx.Observable.from(axios.get(`/api/v2/groups?page_size=1000`))
                            .switchMap((response4) => Rx.Observable.of(fetchGroupProfilesSuccess(response4.data?.group_profiles))),
                        Rx.Observable.from(axios.get(`/swamm/api/${response1.data.projectId}/bmps/status_list/`))
                            .switchMap((response5) => Rx.Observable.of(fetchSwammBmpStatusesSuccess(response5.data))),
                        Rx.Observable.from(axios.get(`/swamm/api/${response1.data.projectId}/pollutant-loading-target/`))
                            .switchMap((response6) => Rx.Observable.of(fetchSwammTargetsSuccess(response6.data))),
                        Rx.Observable.from(axios.get(`/swamm/api/${response1.data.projectId}/bmp-type/bmp_type_group_list/`))
                            .switchMap((response7) => Rx.Observable.of(updateBmpTypeGroups(response7.data)))
                    )
                )
            )
        );


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
            drawStopped(),
            toggleViewMode(),
            setHighlightFeaturesPath('highlight.emptyFeatures'),
            submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.data?.base_map),
            resetQuery(),
            refreshLayerVersion(store.getState()?.layers?.flat?.filter((layer) => layer?.name.includes(store.getState()?.swamm?.drawingBmpLayerName))[0].id),
            clearDrawingBmpLayerName()
        ));

export const saveBmpEditFeatureEpic = (action$, store) =>
    action$.ofType(SAVE_SUCCESS)
        .filter(() => {
            console.log('saveBmpEditFeatureEpic', store.getState()?.swamm?.editingBmpFeatureId);
            return store.getState()?.swamm?.editingBmpFeatureId;
        })
        .flatMap(() => Rx.Observable.of(
            clearEditingBmpFeatureId(),
            drawStopped(),
            toggleViewMode(),
            setHighlightFeaturesPath('highlight.emptyFeatures'),
            submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.data?.base_map),
            resetQuery(),
            refreshLayerVersion(store.getState()?.layers?.flat?.filter((layer) => layer?.name.includes(store.getState()?.swamm?.drawingBmpLayerName))[0].id),
            clearDrawingBmpLayerName()
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
        .exhaustMap((response) => {
            const bmpOutletLayer = store.getState()?.layers?.flat?.filter((layer) => layer.name.includes(store.getState()?.swamm?.data?.code + "_bmp_outlet"))[0];
            const bmpFootprintLayer = store.getState()?.layers?.flat?.filter((layer) => layer.name.includes(store.getState()?.swamm?.data?.code + "_bmp_footprint"))[0];
            const bmpWatershedLayer = store.getState()?.layers?.flat?.filter((layer) => layer.name.includes(store.getState()?.swamm?.data?.code + "_bmp_watershed"))[0];
            return Rx.Observable.of(
                updateBmpTypeGroups(response.data),
                setBmpLayers(bmpOutletLayer, bmpFootprintLayer, bmpWatershedLayer)
            );
        });


export const downloadBmpReportEpic = (action$) =>
    action$.ofType(DOWNLOAD_BMP_REPORT)
        .mergeMap((action) => {
            return Rx.Observable.from(
                window.open(`/swamm/print/${action.bmpId}/download/`, "_blank")
            );
        });

const createFilterField = (attribute, value) => ({
    "attribute": attribute,
    "rowId": 123456,
    "type": "number",
    "groupId": `${attribute}_1`,
    "operator": "=",
    "value": value
});

const wmsFilterTemplate = {
    "filterObj": {
        "featureTypeName": null,
        "filterType": "OGC",
        "ogcVersion": "1.1.0",
        "groupFields": [
            {
                "id": 123456,
                "index": 0,
                "logic": "AND"
            },
            {
                "id": "type_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "priority_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "group_profile_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "status_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            }
        ],
        "filterFields": [],
        "spatialField": [],
        "spatialFieldOperator": "AND"
    }
};

export const filterBmpEpic = (action$, store) =>
    action$.ofType(
        TOGGLE_BMP_TYPE_VISIBILITY,
        SET_ALL_BMP_TYPES_VISIBILITY,
        TOGGLE_BMP_PRIORITY_VISIBILITY,
        TOGGLE_BMP_STATUS_VISIBILITY,
        TOGGLE_BMP_GROUP_PROFILE_VISIBILITY
    )
        .mergeMap(() => {
            const newFilter = JSON.parse(JSON.stringify(wmsFilterTemplate));
            let atLeastOneBmpTypeVisible = false;
            let atLeastOneBmpPriorityVisible = false;
            store.getState()?.swamm?.bmpTypes.map((bmpType) => {
                if (bmpType.visibility) {
                    const filterField = createFilterField('type', bmpType.id);
                    newFilter.filterObj.filterFields.push(filterField);
                    atLeastOneBmpTypeVisible = true;
                }
            });
            if (!atLeastOneBmpTypeVisible) {
                const filterField = createFilterField('type', -1);
                newFilter.filterObj.filterFields.push(filterField);
            }
            store.getState()?.swamm?.priorities.map((priority) => {
                if (priority.visibility) {
                    const filterField = createFilterField('priority', priority.id);
                    newFilter.filterObj.filterFields.push(filterField);
                    atLeastOneBmpPriorityVisible = true;
                }
            });
            if (!atLeastOneBmpPriorityVisible) {
                const filterField = createFilterField('priority', -1);
                newFilter.filterObj.filterFields.push(filterField);
            }
            store.getState()?.swamm?.groupProfiles.map((groupProfile) => {
                if (groupProfile.visibility) {
                    const filterField = createFilterField('group_profile', groupProfile.id);
                    newFilter.filterObj.filterFields.push(filterField);
                    // atLeastOnegroupProfileVisible = true;
                }
            });
            store.getState()?.swamm?.statuses.map((status) => {
                if (status.visibility) {
                    const filterField = createFilterField('status', status.name);
                    newFilter.filterObj.filterFields.push(filterField);
                    // atLeastOnegroupProfileVisible = true;
                }
            });
            const outletFilter = JSON.parse(JSON.stringify(newFilter));
            const footprintFilter = JSON.parse(JSON.stringify(newFilter));
            const watershedFilter = JSON.parse(JSON.stringify(newFilter));
            outletFilter.filterObj.featureTypeName = store.getState()?.swamm?.bmpOutletLayer?.name;
            footprintFilter.filterObj.featureTypeName = store.getState()?.swamm?.bmpFootprintLayer?.name;
            watershedFilter.filterObj.featureTypeName = store.getState()?.swamm?.bmpWatershedLayer?.name;
            console.log('watershed filter: ', watershedFilter);
            return Rx.Observable.of(
                changeLayerProperties(store.getState()?.swamm?.bmpOutletLayer?.id, outletFilter),
                changeLayerProperties(store.getState()?.swamm?.bmpFootprintLayer?.id, footprintFilter),
                changeLayerProperties(store.getState()?.swamm?.bmpWatershedLayer?.id, watershedFilter)
            );
        });

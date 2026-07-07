import Rx from "rxjs";
import { LOCATION_CHANGE } from 'connected-react-router';

import {
    UPDATE_DATASET_TITLE,
    SV_DOWNLOAD_LAYER,
    SUBMIT_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SET_OPEN_MENU_GROUP_ID,
    updateDatasetTitleSuccess,
    submitSimpleViewAttributeFormSuccess,
    setVisibleSimpleViewAttributeForm,
    setVisibleUploaderPanel,
    setProcessingSimpleViewAttributeForm,
    setVisibleSimpleViewAttributeResult,
    setSimpleViewAttributeResult,
    createSimpleViewAttributeForm
} from "./actionsSimpleView";

import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";
import {show} from '../../../../MapStore2/web/client/actions/notifications';

import {
    download,
    selectNode
} from "../../../../MapStore2/web/client/actions/layers";

import axios from "../../../../MapStore2/web/client/libs/ajax";
// TASK-1651 (W1.5): terrain export routes through Tasks Panel, not WFS dialog.
import { terrainExport } from '../TaskMonitor/actionsTaskMonitor';
import { getProjectId } from '../Anuga/selectorsAnuga';
import { trackPageview } from '@js/utils/analytics';


export const beginEditLayerEpic = (action$) =>
    action$.ofType(GRID_QUERY_RESULT)
        .concatMap(() => {
            return Rx.Observable.of(toggleEditMode());
        });


export const updateDatasetTitleEpic = (action$) =>
    action$
        .ofType(UPDATE_DATASET_TITLE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.get(`/api/v2/datasets?search=${action.datasetName.split('geonode:')[1]}&search_fields=name`))
                .concatMap(response => Rx.Observable
                    .from(axios.patch(`/api/v2/datasets/${response?.data?.datasets?.[0]?.pk}/`, {"title": action.newTitle}))
                )
                .concatMap(() => Rx.Observable.of(updateDatasetTitleSuccess()))
                .catch(() => Rx.Observable.of(show({
                    "message": "hydrata.simpleView.failedToUpdateTitle",
                    "title": "hydrata.simpleView.error",
                    "uid": 6000,
                    "position": "tc"
                }, "error")))
        );


export const submitAttributeFormEpic = (action$, store) =>
    action$
        .ofType(SUBMIT_SV_ATTRIBUTE_FORM)
        .switchMap((action) =>
            Rx.Observable
                .from(
                    axios.post(
                        store.getState()?.simpleView?.submitUrl,
                        {
                            form: action?.form,
                            project_id: action?.projectId,
                            importer_session_id: action?.simpleViewImporterSessionId
                        }
                    )
                )
                .switchMap(response => {
                    if (response.data?.submitUrl) {
                        return Rx.Observable.of(createSimpleViewAttributeForm(response.data));
                    }
                    return Rx.Observable.of(submitSimpleViewAttributeFormSuccess(response.data));
                })
                .catch(() => Rx.Observable.of(
                    setProcessingSimpleViewAttributeForm(false),
                    show({
                        "message": "hydrata.simpleView.importFailed",
                        "title": "hydrata.simpleView.error",
                        "uid": 6000,
                        "position": "tc"
                    }, "error")
                ))
        );


export const submitSimpleViewAttributeFormSuccessEpic = (action$) =>
    action$.ofType(SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS)
        .concatMap((action) => Rx.Observable.of(
            setVisibleSimpleViewAttributeForm(false),
            setVisibleUploaderPanel(false),
            setProcessingSimpleViewAttributeForm(false),
            setVisibleSimpleViewAttributeResult(true),
            setSimpleViewAttributeResult(action.data),
            show({
                "message": "hydrata.simpleView.importSuccessful",
                "title": "hydrata.simpleView.featuresAdded",
                "uid": 1000,
                "position": "tc"
            })
        ));


// TASK-1651 (W1.5): terrain layer downloads route through the Tasks Panel.
// A terrain layer (group==='Input Data.Terrain') maps to an anuga.resources.terrain
// row via gn_layer_name===layer.name. We cross-reference the store to find the
// terrain id and title, then dispatch terrainExport() which enqueues a synthetic
// process in the Tasks Panel and fetches a presigned S3 URL.
// Non-terrain layers continue to use the MapStore2 WFS download dialog.
export const svDownloadLayerEpic = (action$, store) =>
    action$
        .ofType(SV_DOWNLOAD_LAYER)
        .concatMap((action) => {
            const layer = action?.layer;
            const isTerrainLayer = layer?.group === 'Input Data.Terrain';
            if (isTerrainLayer) {
                const state = store.getState();
                const projectId = getProjectId(state);
                // Find the matching terrain resource by its gn_layer_name.
                const terrainModels = state?.anuga?.resources?.terrain || [];
                const terrainModel = terrainModels.find(
                    t => t.gn_layer_name === layer.name || t.gn_layer_hillshade_name === layer.name
                );
                if (terrainModel && projectId) {
                    return Rx.Observable.of(
                        terrainExport(projectId, terrainModel.id, terrainModel.title || terrainModel.name)
                    );
                }
                // Fallback: terrain model not found in store (shouldn't happen in
                // practice since terrainModels is fetched at initAnuga); log a
                // warning and fall through to the WFS dialog so the user sees
                // something rather than nothing.
            }
            return Rx.Observable.concat(
                Rx.Observable.of(selectNode(layer?.id, 'layer')),
                Rx.Observable.of(download(layer))
            );
        });

// TASK-2141 (a) — SPA virtual pageviews. MapStore is a hash-routed SPA:
// LOCATION_CHANGE (connected-react-router) fires on every hash-route change
// (e.g. dashboard -> map viewer, or between maps); SET_OPEN_MENU_GROUP_ID is
// the SAME action type SimpleView/Anuga/Swamm/Hydrology all dispatch when the
// user switches major panel groups (Inputs/Scenarios/Results/Networks) inside
// a single map — a pure-Redux transition that never touches window.location.
// Without the second trigger, a multi-hour session parked on one map/route
// stays ONE Umami pageview for its whole lifetime (the 07-06 forensics
// finding). Each occurrence fires a virtual pageview exactly once (a plain
// action-stream map, no polling/dedup needed).
export const trackVirtualPageviewEpic = (action$) =>
    action$
        .ofType(LOCATION_CHANGE, SET_OPEN_MENU_GROUP_ID)
        .mergeMap((action) => {
            const basePath = (action.type === LOCATION_CHANGE && action.payload?.location?.pathname)
                || (typeof window !== 'undefined' && window.location.pathname)
                || '/';
            const hash = (typeof window !== 'undefined' && window.location.hash) || '';
            // Query-suffix (not a second '#') so the virtual pageview stays
            // parseable by Umami's path/query dimensions instead of colliding
            // with the real route hash.
            const url = action.type === SET_OPEN_MENU_GROUP_ID
                ? `${basePath}${hash}?panel=${action.openMenuGroupId || 'none'}`
                : `${basePath}${hash}`;
            trackPageview(url);
            return Rx.Observable.empty();
        });

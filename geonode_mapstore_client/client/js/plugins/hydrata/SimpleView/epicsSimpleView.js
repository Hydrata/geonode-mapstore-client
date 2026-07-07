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
import { SET_ANUGA_INPUT_MENU, SET_ANUGA_SCENARIO_MENU } from '../Anuga/actionsAnuga';


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
// (dashboard -> map viewer, or between maps). A pure-Redux PANEL switch never
// touches window.location, so without extra triggers a multi-hour session
// parked on one map stays ONE Umami pageview for its lifetime (07-06 forensics).
//
// PANEL DISCRIMINATION (W2 red-team fix, operator-approved): the Results group
// is the only one that dispatches a real openMenuGroupId; the Anuga
// Inputs/Scenarios toolbar buttons dispatch setOpenMenuGroupId(null) PLUS a
// separate boolean action (setAnugaInputMenu / setAnugaScenarioMenu carrying
// {visible}). So we fire panel=Inputs/Scenarios off those two boolean actions
// (on OPEN only), panel=<id> off a truthy SET_OPEN_MENU_GROUP_ID (Results), and
// SUPPRESS the null-group case entirely — it is only ever the side-effect of the
// Inputs/Scenarios toggles above or a close-all, so firing panel=none there
// would double-count. The Hydrology/Networks toggle carries its own
// trackEvent('button','click','hydrology-main-menu-toggle') and is intentionally
// not a panel pageview.
//
// URL FORM: every branch emits the clean logical hash-route WITHOUT the leading
// '#' (LOCATION_CHANGE uses the action's already-parsed pathname; panel branches
// strip '#' off window.location.hash) so Umami groups one map under one path,
// with the panel as a ?panel= query suffix.
//
// NOTE (W2 red-team, ACCEPTED as-is by the operator): connected-react-router
// also dispatches an initial LOCATION_CHANGE (isFirstRendering=true) on mount,
// so a hard page-load emits this virtual route pageview in addition to Umami's
// own automatic initial pageview. Kept as-is: firing the real entry hash-route
// is the valuable signal; the extra constant '/' pageview is a filterable
// artifact (guarding isFirstRendering would re-blind the entry route).
export const trackVirtualPageviewEpic = (action$) =>
    action$
        .ofType(LOCATION_CHANGE, SET_OPEN_MENU_GROUP_ID, SET_ANUGA_INPUT_MENU, SET_ANUGA_SCENARIO_MENU)
        .mergeMap((action) => {
            if (action.type === LOCATION_CHANGE) {
                // createHashHistory: action.payload.location.pathname IS ALREADY
                // the full logical hash-route (no leading '#').
                const pathname = action.payload?.location?.pathname
                    || (typeof window !== 'undefined' && window.location.pathname)
                    || '/';
                trackPageview(pathname);
                return Rx.Observable.empty();
            }
            // Resolve the panel name; fire only on a real OPEN. A null/closed
            // panel resolves to null and is suppressed (no pageview).
            let panel = null;
            if (action.type === SET_ANUGA_INPUT_MENU) {
                panel = action.visible ? 'Inputs' : null;
            } else if (action.type === SET_ANUGA_SCENARIO_MENU) {
                panel = action.visible ? 'Scenarios' : null;
            } else {
                // SET_OPEN_MENU_GROUP_ID: a truthy id (e.g. 'Results') is a real
                // open; null is a toggle side-effect / close-all -> suppress.
                panel = action.openMenuGroupId || null;
            }
            if (!panel) {
                return Rx.Observable.empty();
            }
            // Same clean hash-route form as the LOCATION_CHANGE branch, with the
            // panel as a ?panel= suffix (strip leading '#' and any prior query).
            const rawHash = (typeof window !== 'undefined' && window.location.hash) || '';
            const hashRoute = rawHash.replace(/^#/, '').split('?')[0]
                || (typeof window !== 'undefined' && window.location.pathname) || '/';
            trackPageview(`${hashRoute}?panel=${panel}`);
            return Rx.Observable.empty();
        });

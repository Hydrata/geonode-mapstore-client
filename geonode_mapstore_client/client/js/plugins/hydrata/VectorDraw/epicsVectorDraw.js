import Rx from 'rxjs';
import { changeDrawingStatus, END_DRAWING, drawSupportReset } from '../../../../MapStore2/web/client/actions/draw';
import { refreshLayerVersion } from '../../../../MapStore2/web/client/actions/layers';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { describeFeatureType } from '../../../../MapStore2/web/client/api/WFS';
import { reprojectGeoJson } from '../../../../MapStore2/web/client/utils/CoordinatesUtils';
import { wfstInsert, wfstUpdate, loadFeature, loadAllFeatures } from './wfstApi';
import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    SELECT_EXISTING_FEATURE,
    drawingComplete,
    saveSuccess,
    saveError,
    vectorDrawReset,
    describeComplete,
    seedFormValues,
    loadFeatureList,
    selectExistingFeature,
    startVectorDraw
} from './actionsVectorDraw';

const VECTOR_DRAW_OWNER = 'vectorDraw';

const getWfsUrl = (store) => {
    // Use geoserverUrl from store (handles localhost dev where GeoServer is on a different port)
    const geoserverUrl = store.getState()?.gnsettings?.geoserverUrl;
    if (geoserverUrl) {
        // geoserverUrl is like "http://localhost:8080/geoserver/" — append "wfs"
        return geoserverUrl.replace(/\/$/, '') + '/wfs';
    }
    // Fallback: construct from window.location (works in production behind nginx)
    return `${window.location.protocol}//${window.location.host}/geoserver/wfs`;
};

/**
 * Inner helper: handles the describe → (load + edit) | (draw + wait) flow once
 * a definitive `config` is known. Used both for the no-picker path and after
 * a feature is selected from the picker (re-entered via SELECT_EXISTING_FEATURE
 * → startVectorDraw → vectorDrawStartEpic).
 */
const runDescribeAndDrawFlow = (action$, wfsUrl, config) =>
    Rx.Observable.from(describeFeatureType(wfsUrl, config.layerName))
        .switchMap(() => {
            if (config.featureId) {
                // EDIT mode: load existing feature, seed form values, start edit drawing
                return Rx.Observable.from(
                    loadFeature(wfsUrl, config.layerName, config.featureId)
                )
                    .switchMap((existingFeature) => {
                        const features = existingFeature ? [{
                            type: 'Feature',
                            geometry: existingFeature.geometry,
                            properties: existingFeature.properties || {}
                        }] : [];
                        // Dispatch seedFormValues BEFORE describeComplete so the
                        // form values are present in Redux by the time the popup
                        // mounts in the next render. Without this, wfstUpdate would
                        // send schema defaults and silently overwrite real values.
                        return Rx.Observable.of(
                            seedFormValues(existingFeature?.properties || {}),
                            describeComplete(),
                            changeDrawingStatus('drawOrEdit', config.geomType, VECTOR_DRAW_OWNER, features, {
                                featureProjection: 'EPSG:4326',
                                stopAfterDrawing: false,
                                drawEnabled: false,
                                editEnabled: true
                            })
                        );
                    });
            }
            // CREATE mode: start draw, wait for END_DRAWING
            // Must pass a feature with empty geometry — DrawSupport's drawend handler
            // accesses features[0].properties (line 704) and crashes if features is empty.
            const emptyFeature = { type: 'Feature', geometry: null, properties: {} };
            return Rx.Observable.of(
                describeComplete(),
                changeDrawingStatus('drawOrEdit', config.geomType, VECTOR_DRAW_OWNER, [emptyFeature], {
                    stopAfterDrawing: true,
                    drawEnabled: true,
                    editEnabled: false
                })
            ).concat(
                action$.ofType(END_DRAWING)
                    .filter(a => a.owner === VECTOR_DRAW_OWNER)
                    .take(1)
                    .map(a => {
                        // END_DRAWING geometry is in map CRS (typically EPSG:3857).
                        // Reproject to EPSG:4326 for WFS-T.
                        const geom = a.geometry;
                        const fromCrs = geom?.projection || 'EPSG:3857';
                        const reprojected = reprojectGeoJson(
                            { type: geom.type, coordinates: geom.coordinates },
                            fromCrs,
                            'EPSG:4326'
                        );
                        return drawingComplete(reprojected);
                    })
            );
        });

/**
 * Start epic: handles describe → draw for CREATE mode, describe → load → edit
 * for EDIT mode, and the optional feature-picker phase when `config.allowPick`
 * is set without a `featureId`.
 *
 * PICK:    loadAllFeatures → if any → loadFeatureList (popup renders picker)
 *                          → if none → selectExistingFeature(null) (skip flash, go straight to create)
 *          User clicks a row → SELECT_EXISTING_FEATURE → vectorDrawSelectExistingEpic
 *          re-dispatches startVectorDraw with featureId (or null for create) and allowPick:false.
 *
 * CREATE:  describe → changeDrawingStatus(drawEnabled) → END_DRAWING → drawingComplete
 * EDIT:    describe → loadFeature → seedFormValues → changeDrawingStatus(editEnabled)
 *          → user clicks Save in popup
 *
 * For EDIT mode, the popup's Save button dispatches drawingComplete directly.
 */
export const vectorDrawStartEpic = (action$, store) =>
    action$.ofType(START_VECTOR_DRAW)
        .switchMap((action) => {
            const { config } = action;
            const wfsUrl = getWfsUrl(store);

            // PICKER branch: only when allowPick is explicitly true AND no
            // featureId is preselected. Backwards-compatible — default behaviour
            // (no allowPick) is unchanged.
            if (config?.allowPick === true && !config.featureId) {
                return Rx.Observable.from(loadAllFeatures(wfsUrl, config.layerName))
                    .switchMap((features) => {
                        if (!features || features.length === 0) {
                            // Empty layer: skip the picker UI flash, go straight to
                            // create. selectExistingFeature(null) → vectorDrawSelectExistingEpic
                            // → startVectorDraw with allowPick:false → CREATE flow.
                            return Rx.Observable.of(selectExistingFeature(null));
                        }
                        return Rx.Observable.of(loadFeatureList(features));
                    })
                    .catch((err) => {
                        console.error('VectorDraw picker load error:', err);
                        return Rx.Observable.of(
                            show({
                                title: 'Drawing Error',
                                message: 'Failed to load features: ' + (err?.message || 'Unknown error'),
                                position: 'tc',
                                autoDismiss: 10
                            }, 'error'),
                            vectorDrawReset()
                        );
                    })
                    .takeUntil(action$.ofType(CANCEL_VECTOR_DRAW));
            }

            return runDescribeAndDrawFlow(action$, wfsUrl, config)
                .catch((err) => {
                    console.error('VectorDraw start error:', err);
                    return Rx.Observable.of(
                        show({
                            title: 'Drawing Error',
                            message: 'Failed to start drawing: ' + (err?.message || 'Unknown error'),
                            position: 'tc',
                            autoDismiss: 10
                        }, 'error'),
                        vectorDrawReset()
                    );
                })
                .takeUntil(action$.ofType(CANCEL_VECTOR_DRAW));
        });

/**
 * Select-existing epic: when the user clicks a row in the picker (or the
 * empty-list shortcut fires selectExistingFeature(null)), re-dispatch
 * startVectorDraw with the resolved featureId and allowPick cleared. This
 * re-enters vectorDrawStartEpic cleanly via the START_VECTOR_DRAW reducer
 * which rebuilds state from initialState.
 */
export const vectorDrawSelectExistingEpic = (action$, store) =>
    action$.ofType(SELECT_EXISTING_FEATURE)
        .switchMap((action) => {
            const config = store.getState()?.vectorDraw?.config || {};
            const effectiveConfig = {
                ...config,
                featureId: action.featureId,
                allowPick: false
            };
            return Rx.Observable.of(startVectorDraw(effectiveConfig));
        });

/**
 * Save epic: performs WFS-T insert or update when phase transitions to 'saving'.
 * Triggered by DRAWING_COMPLETE (no form → reducer goes directly to saving)
 * or SUBMIT_FORM (with form → reducer transitions form → saving).
 */
export const vectorDrawSaveEpic = (action$, store) =>
    action$.ofType(SUBMIT_FORM, DRAWING_COMPLETE)
        .filter(() => {
            const phase = store.getState()?.vectorDraw?.phase;
            return phase === 'saving';
        })
        .switchMap(() => {
            const state = store.getState()?.vectorDraw;
            const { config, geometry, formValues } = state;
            const wfsUrl = getWfsUrl(store);

            const savePromise = config.featureId
                ? wfstUpdate(wfsUrl, config.layerName, config.featureId, geometry, formValues)
                : wfstInsert(wfsUrl, config.layerName, geometry, formValues);

            return Rx.Observable.from(savePromise)
                .switchMap((fid) => {
                    const layers = store.getState()?.layers?.flat || [];
                    const layer = layers.find(l => l?.name === config.layerName);

                    const actions = [
                        {
                            type: config.onComplete,
                            fid: fid || config.featureId,
                            geometry,
                            formValues,
                            meta: config.meta
                        },
                        drawSupportReset(VECTOR_DRAW_OWNER),
                        show({
                            title: 'Success',
                            message: 'Feature saved',
                            position: 'tc',
                            autoDismiss: 3
                        }, 'success'),
                        saveSuccess(fid)
                    ];

                    if (layer?.id) {
                        actions.push(refreshLayerVersion(layer.id));
                    }

                    return Rx.Observable.from(actions);
                })
                .catch((err) => {
                    console.error('VectorDraw save error:', err);
                    const { config: cfg } = store.getState()?.vectorDraw || {};
                    const cancelActions = [
                        drawSupportReset(VECTOR_DRAW_OWNER),
                        show({
                            title: 'Save Error',
                            message: 'Failed to save feature: ' + (err?.message || 'Unknown error'),
                            position: 'tc',
                            autoDismiss: 10
                        }, 'error'),
                        saveError(err?.message || 'Unknown error')
                    ];
                    if (cfg?.onCancel) {
                        cancelActions.push({
                            type: cfg.onCancel,
                            meta: cfg.meta
                        });
                    }
                    return Rx.Observable.from(cancelActions);
                });
        });

/**
 * Cancel epic: clean up drawing state and notify the calling plugin.
 */
export const vectorDrawCancelEpic = (action$, store) =>
    action$.ofType(CANCEL_VECTOR_DRAW)
        .switchMap(() => {
            const config = store.getState()?.vectorDraw?.config;
            const actions = [
                drawSupportReset(VECTOR_DRAW_OWNER),
                vectorDrawReset()
            ];
            if (config?.onCancel) {
                actions.push({
                    type: config.onCancel,
                    meta: config.meta
                });
            }
            return Rx.Observable.from(actions);
        });

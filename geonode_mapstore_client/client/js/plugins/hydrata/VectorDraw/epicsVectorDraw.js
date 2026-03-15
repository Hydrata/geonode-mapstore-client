import Rx from 'rxjs';
import { changeDrawingStatus, END_DRAWING, drawSupportReset } from '../../../../MapStore2/web/client/actions/draw';
import { refreshLayerVersion } from '../../../../MapStore2/web/client/actions/layers';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { describeFeatureType } from '../../../../MapStore2/web/client/api/WFS';
import { reprojectGeoJson } from '../../../../MapStore2/web/client/utils/CoordinatesUtils';
import { wfstInsert, wfstUpdate, loadFeature } from './wfstApi';
import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    drawingComplete,
    saveSuccess,
    saveError,
    vectorDrawReset,
    describeComplete
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
 * Start epic: handles describe → draw for CREATE mode only.
 * For EDIT mode, the popup's Save button dispatches drawingComplete directly.
 *
 * CREATE: describe → changeDrawingStatus(drawEnabled) → END_DRAWING → drawingComplete
 * EDIT:   describe → loadFeature → changeDrawingStatus(editEnabled) → user clicks Save in popup
 */
export const vectorDrawStartEpic = (action$, store) =>
    action$.ofType(START_VECTOR_DRAW)
        .switchMap((action) => {
            const { config } = action;
            const wfsUrl = getWfsUrl(store);

            return Rx.Observable.from(
                describeFeatureType(wfsUrl, config.layerName)
            )
                .switchMap(() => {
                    if (config.featureId) {
                        // EDIT mode: load existing feature, start edit drawing
                        return Rx.Observable.from(
                            loadFeature(wfsUrl, config.layerName, config.featureId)
                        )
                            .switchMap((existingFeature) => {
                                const features = existingFeature ? [{
                                    type: 'Feature',
                                    geometry: existingFeature.geometry,
                                    properties: existingFeature.properties || {}
                                }] : [];
                                // Dispatch describeComplete + changeDrawingStatus.
                                // The popup shows Save/Cancel for edit mode.
                                // User clicks Save → dispatches drawingComplete(geometry from draw state).
                                return Rx.Observable.of(
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
                })
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

import Rx from 'rxjs';
import { changeDrawingStatus, END_DRAWING, drawSupportReset } from '../../../../MapStore2/web/client/actions/draw';
import { refreshLayerVersion } from '../../../../MapStore2/web/client/actions/layers';
import { show } from '../../../../MapStore2/web/client/actions/notifications';
import { describeFeatureType } from '../../../../MapStore2/web/client/api/WFS';
import { reprojectGeoJson } from '../../../../MapStore2/web/client/utils/CoordinatesUtils';
import {
    wfstInsert, wfstUpdate, wfstDelete, loadFeature, loadAllFeatures
} from './wfstApi';
import { getTranslate, deriveTranslateKey } from './translateRegistry';
import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    SELECT_EXISTING_FEATURE,
    DELETE_FEATURE,
    drawingComplete,
    saveSuccess,
    saveError,
    vectorDrawReset,
    describeComplete,
    seedFormValues,
    loadFeatureList,
    selectExistingFeature,
    startVectorDraw,
    returnToPicker
} from './actionsVectorDraw';

export const VECTOR_DRAW_OWNER = 'vectorDraw';

/**
 * Normalise an END_DRAWING payload to a bare GeoJSON geometry. DrawSupport's
 * onEndDrawing has multiple call sites (DrawSupport.jsx:610 a FeatureCollection
 * from `geojsonFormat.writeFeaturesObject`; :728 a flat geometry-like object
 * from `fromOLFeature`; :424/:450 a flat geometry-like object too). The
 * previous fast path that built `{type: payload.type, coordinates: payload.coordinates}`
 * crashed on FeatureCollection inputs because it produced
 * `{type: 'FeatureCollection', coordinates: undefined}` which reprojectGeoJson
 * → traverseGeoJson then dereferenced as `r.features.map(...)` (or recursed
 * into undefined geometry, surfacing as `Cannot read properties of undefined
 * (reading 'type')`).
 */
// TASK-795 review NIT-2 (TASK-804) — depth guard so a malformed payload
// (e.g. a Feature whose geometry is itself a FeatureCollection — invalid
// GeoJSON, but not unheard of from third-party tooling) can't drive the
// recursion arbitrarily deep. DrawSupport doesn't produce nested FCs today;
// this is pure safety.
const _MAX_EXTRACT_DEPTH = 4;
export const extractDrawGeometry = (payload, _depth = 0) => {
    if (!payload || _depth > _MAX_EXTRACT_DEPTH) return null;
    if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) {
        const first = payload.features.find(f => f && f.geometry) || payload.features[0];
        return first ? extractDrawGeometry(first, _depth + 1) : null;
    }
    if (payload.type === 'Feature') {
        return payload.geometry || null;
    }
    if (payload.type && payload.coordinates) {
        return { type: payload.type, coordinates: payload.coordinates };
    }
    return null;
};

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
                        //
                        // TASK-795 review I9 (TASK-802) — synthesize the
                        // structured `data` shape HERE (load time) so the
                        // picker reads it straight from formValues, instead
                        // of running the synthesis on every render. Pre-fix,
                        // a render-time synth meant the structured shape
                        // wasn't persisted in Redux until the user touched
                        // the picker — leading to: (a) `effectiveFormValues`
                        // diverging from `formValues` (TimeDataPicker `value`
                        // came from the synth, but the validate guard read
                        // the raw `formValues.data` until the user typed
                        // something), and (b) C6 needing a per-column
                        // fallback branch that's now dead code. Synthesize
                        // once, persist once.
                        //
                        // TASK-813 (W1.2) — Dispatch through the translate
                        // registry. For 'bdy_*' layers this routes to
                        // boundaryTranslate.synthesizeIn (the former
                        // synthesizeTimeBoundaryFormValue — see
                        // boundaryTranslate.js). Unregistered prefixes get
                        // the identity pass-through, so EDIT-load behaviour
                        // is unchanged for non-Boundary layers (which had no
                        // synth contract anyway).
                        const seededProps = getTranslate(deriveTranslateKey(config.layerName)).synthesizeIn(
                            existingFeature?.properties || {}
                        );
                        return Rx.Observable.of(
                            seedFormValues(seededProps),
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
                    .switchMap(a => {
                        // END_DRAWING geometry is in map CRS (typically
                        // EPSG:3857). Reproject to EPSG:4326 for WFS-T.
                        // See extractDrawGeometry for the shape-normalisation
                        // rationale (DrawSupport's payload varies by call site).
                        const inner = extractDrawGeometry(a.geometry);
                        if (!inner) {
                            console.error(
                                'VectorDraw: END_DRAWING with unrecognised geometry shape',
                                a.geometry
                            );
                            return Rx.Observable.of(drawingComplete(null));
                        }
                        const fromCrs = inner.projection
                            || a.geometry?.projection
                            || a.geometry?.featureProjection
                            || 'EPSG:3857';
                        const reprojected = reprojectGeoJson(
                            { type: inner.type, coordinates: inner.coordinates },
                            fromCrs,
                            'EPSG:4326'
                        );
                        // TASK-1407 (ISSUE 9) — after drawing, if a form is present
                        // (formConfig is set), re-enable vertex editing on the drawn
                        // geometry so the user can adjust vertices before submitting.
                        // The save epic reads draw.tempFeatures / draw.features geometry
                        // first (updated by vertex drags) so the edits are preserved on
                        // save. Without this, stopAfterDrawing:true leaves the draw
                        // interaction dead and vertices are un-grabbable in form phase.
                        const drawCompleteAction = drawingComplete(reprojected);
                        if (config.formConfig) {
                            const drawnFeature = {
                                type: 'Feature',
                                geometry: reprojected,
                                properties: {}
                            };
                            return Rx.Observable.of(
                                drawCompleteAction,
                                changeDrawingStatus('drawOrEdit', config.geomType, VECTOR_DRAW_OWNER, [drawnFeature], {
                                    stopAfterDrawing: false,
                                    drawEnabled: false,
                                    editEnabled: true,
                                    featureProjection: 'EPSG:4326'
                                })
                            );
                        }
                        return Rx.Observable.of(drawCompleteAction);
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
            const vd = store.getState()?.vectorDraw || {};
            const config = vd.config || {};
            const effectiveConfig = {
                ...config,
                featureId: action.featureId,
                allowPick: false,
                // TASK-784 picker-return — thread cameFromPicker through the
                // re-dispatched START_VECTOR_DRAW so the reducer's reset to
                // initialState preserves the flag. Without this, picking a
                // row → editing → saving would lose the breadcrumb and the
                // save epic would route to idle instead of back to picker.
                cameFromPicker: vd.cameFromPicker === true
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
            const { config, formValues } = state;
            const wfsUrl = getWfsUrl(store);

            // TASK-1407 (ISSUE 9) — prefer geometry from draw state (draw.tempFeatures
            // for vertex-dragged edits, draw.features for the initial drawn shape) over
            // the snapshot stored in vectorDraw.geometry at END_DRAWING time. This lets
            // vertex modifications made in the form phase (editEnabled=true after drawing)
            // be captured without needing a separate "geometry changed" reducer action.
            const drawState = store.getState()?.draw;
            const editedGeometry = drawState?.tempFeatures?.[0]?.geometry
                || drawState?.features?.[0]?.geometry;
            const geometry = editedGeometry || state.geometry;

            // Defensive: extractDrawGeometry returns null on unrecognised
            // shapes; saveEpic must not call wfstInsert/Update with null
            // geometry (server would reject + we'd surface a confusing
            // error rather than the real "no geometry" cause).
            if (!geometry || !geometry.type || !geometry.coordinates) {
                return Rx.Observable.of(saveError('No geometry was captured. Please draw a feature first.'));
            }

            const savePromise = config.featureId
                ? wfstUpdate(wfsUrl, config.layerName, config.featureId, geometry, formValues)
                : wfstInsert(wfsUrl, config.layerName, geometry, formValues);

            // TASK-795 review C2 — takeUntil(CANCEL) so the user clicking the
            // close X mid-save aborts the in-flight chain instead of letting
            // the post-save dispatches (RETURN_TO_PICKER, refreshLayerVersion)
            // land on a state that has already been reset by the cancel
            // epic's vectorDrawReset(). Without this, the tail RETURN_TO_PICKER
            // would re-mount the picker on top of an idle reducer state with
            // a null config, leaving a header-less picker the user can't
            // recover from without a full toolbar re-open.
            return Rx.Observable.from(savePromise)
                .switchMap((fid) => {
                    const layers = store.getState()?.layers?.flat || [];
                    const layer = layers.find(l => l?.name === config.layerName);
                    const cameFromPicker = state.cameFromPicker === true;

                    // Common post-save side-effects fire regardless of which
                    // tail we take (picker-return vs idle).
                    const baseActions = [
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
                        }, 'success')
                    ];
                    if (layer?.id) {
                        baseActions.push(refreshLayerVersion(layer.id));
                    }

                    // TASK-784 picker-return — when the original flow entered
                    // through the picker, re-fetch the WFS feature list and
                    // dispatch RETURN_TO_PICKER instead of SAVE_SUCCESS. Falls
                    // back to idle path on re-fetch failure (network error)
                    // so the user isn't stuck in a half-state.
                    if (cameFromPicker) {
                        // TASK-795 review NIT-6 (TASK-804) — pass the
                        // just-saved fid through to RETURN_TO_PICKER so the
                        // picker can highlight the row the user just
                        // committed. Falls back to config.featureId for
                        // EDIT-mode (where wfstUpdate returns the input fid
                        // unchanged) and null for INSERT-without-fid edge
                        // cases (the picker just doesn't highlight anything).
                        const lastSavedFid = fid || config.featureId || null;
                        return Rx.Observable.from(baseActions)
                            .concat(
                                Rx.Observable.from(loadAllFeatures(wfsUrl, config.layerName))
                                    .map((features) => returnToPicker(features, lastSavedFid))
                                    .catch((err) => {
                                        console.error('VectorDraw picker re-fetch error:', err);
                                        return Rx.Observable.of(
                                            show({
                                                title: 'Refresh Error',
                                                message: 'Saved, but could not refresh the list: ' + (err?.message || 'Unknown error'),
                                                position: 'tc',
                                                autoDismiss: 6
                                            }, 'warning'),
                                            saveSuccess(fid)
                                        );
                                    })
                            );
                    }

                    return Rx.Observable.from([...baseActions, saveSuccess(fid)]);
                })
                .catch((err) => {
                    console.error('VectorDraw save error:', err);
                    // TASK-795 review I1 (TASK-797) — pre-fix this branch
                    // dispatched cfg.onCancel preemptively, then the user
                    // closing the error toast would dispatch CANCEL_VECTOR_DRAW
                    // which the cancel epic re-routed to cfg.onCancel a second
                    // time. The calling plugin's onCancel handler therefore
                    // landed twice for a single save-error. Now: drop the
                    // preemptive dispatch — the cancel epic owns the single
                    // canonical onCancel. The error toast's Close button is
                    // the only path forward from phase==='error', so the
                    // canonical signal still fires exactly once when the
                    // user dismisses the error.
                    return Rx.Observable.of(
                        drawSupportReset(VECTOR_DRAW_OWNER),
                        show({
                            title: 'Save Error',
                            message: 'Failed to save feature: ' + (err?.message || 'Unknown error'),
                            position: 'tc',
                            autoDismiss: 10
                        }, 'error'),
                        saveError(err?.message || 'Unknown error')
                    );
                })
                .takeUntil(action$.ofType(CANCEL_VECTOR_DRAW));
        });

/**
 * Cancel epic: clean up drawing state and notify the calling plugin.
 *
 * TASK-784 picker-return — when the original flow entered through the
 * picker, route back to the picker phase instead of resetting to idle.
 * No re-fetch needed (cancel didn't change anything), so reuse the existing
 * featureList in state. The `onCancel` callback is also skipped on the
 * in-flow cancel because the calling plugin's "vector draw is done"
 * handler should only fire when we actually exit to idle.
 */
export const vectorDrawCancelEpic = (action$, store) =>
    action$.ofType(CANCEL_VECTOR_DRAW)
        .switchMap(() => {
            const vd = store.getState()?.vectorDraw || {};
            const config = vd.config;
            const cameFromPicker = vd.cameFromPicker === true;
            // Cancel from the picker itself (X button on the picker header)
            // must exit to idle, not loop back to picker — otherwise the
            // close button re-renders the same picker the user just dismissed.
            // The reducer flips phase to 'cancelling' synchronously before
            // the epic sees CANCEL_VECTOR_DRAW (Redux ordering: reducer →
            // middleware), so we read previousPhase (captured by the reducer
            // at the same moment) instead of the now-stale `phase`.
            const cancellingPicker = vd.previousPhase === 'picking';
            // TASK-795 review I4 (TASK-799) — when the user closes the error
            // toast (previousPhase==='error'), a save was actually attempted.
            // It usually failed end-to-end, but occasionally the BE commits
            // and then the response times out — leaving the row in PostGIS
            // even though the FE saw an error. Re-fetch on this branch so
            // the picker doesn't re-render with a stale list missing the
            // committed row. Other cancel paths (drawing, form, idle) made
            // no BE state change and can keep using the cached list.
            const cancellingAfterError = vd.previousPhase === 'error';

            if (cameFromPicker && !cancellingPicker) {
                if (cancellingAfterError && config?.layerName) {
                    const wfsUrl = getWfsUrl(store);
                    return Rx.Observable.of(drawSupportReset(VECTOR_DRAW_OWNER))
                        .concat(
                            Rx.Observable.from(loadAllFeatures(wfsUrl, config.layerName))
                                .map((features) => returnToPicker(features))
                                .catch((err) => {
                                    // Re-fetch failed — fall back to the
                                    // cached pre-save list so the user is
                                    // still in the picker and can retry.
                                    console.error('VectorDraw cancel-after-error refetch failed:', err);
                                    return Rx.Observable.of(returnToPicker(vd.featureList || []));
                                })
                        );
                }
                return Rx.Observable.from([
                    drawSupportReset(VECTOR_DRAW_OWNER),
                    returnToPicker(vd.featureList || [])
                ]);
            }

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

/**
 * Delete epic: performs WFS-T delete for a single feature, refreshes the
 * layer's tile version (so the deleted feature drops off the map), re-fetches
 * the WFS feature list, and returns to the picker so the user sees the
 * updated row set. The trash icon in VectorDrawPopup confirms client-side
 * before dispatching DELETE_FEATURE — no double-confirm here.
 *
 * On WFS-T error: surface a toast and re-render the picker with the
 * un-modified list (server didn't delete the row).
 */
export const vectorDrawDeleteEpic = (action$, store) =>
    action$.ofType(DELETE_FEATURE)
        // TASK-795 review I2 (TASK-798) — mergeMap (not switchMap) so a
        // second DELETE arriving before the first chain finishes does NOT
        // unsubscribe the first's tail (toast + refreshLayerVersion +
        // re-fetch + RETURN_TO_PICKER). With switchMap, rapid trash on row
        // A then row B before A's WFS-T POST returned dropped A's tile-cache
        // refresh — so the deleted row stayed visible on the map until the
        // user panned. Deletes are independent (different fids), so parallel
        // execution is safe and correct.
        .mergeMap((action) => {
            const vd = store.getState()?.vectorDraw || {};
            const config = vd.config || {};
            const wfsUrl = getWfsUrl(store);
            const featureId = action.featureId;

            if (!featureId || !config.layerName) {
                return Rx.Observable.of(
                    show({
                        title: 'Delete Error',
                        message: 'Cannot delete: missing feature id or layer.',
                        position: 'tc',
                        autoDismiss: 6
                    }, 'error')
                );
            }

            return Rx.Observable.from(wfstDelete(wfsUrl, config.layerName, featureId))
                .switchMap(() => {
                    const layers = store.getState()?.layers?.flat || [];
                    const layer = layers.find(l => l?.name === config.layerName);
                    const baseActions = [
                        show({
                            title: 'Deleted',
                            message: 'Feature deleted',
                            position: 'tc',
                            autoDismiss: 3
                        }, 'success')
                    ];
                    if (layer?.id) {
                        baseActions.push(refreshLayerVersion(layer.id));
                    }
                    return Rx.Observable.from(baseActions)
                        .concat(
                            Rx.Observable.from(loadAllFeatures(wfsUrl, config.layerName))
                                .map((features) => returnToPicker(features))
                                .catch((err) => {
                                    console.error('VectorDraw post-delete refetch error:', err);
                                    // Server delete succeeded; re-fetch failed.
                                    // Drop the deleted row locally so the picker
                                    // is at least consistent with what the user
                                    // just did. Cached list lives in vd.featureList.
                                    const localFiltered = (vd.featureList || []).filter(
                                        f => f && f.id !== featureId
                                    );
                                    return Rx.Observable.of(
                                        show({
                                            title: 'Refresh Error',
                                            message: 'Deleted, but could not refresh the list: ' + (err?.message || 'Unknown error'),
                                            position: 'tc',
                                            autoDismiss: 6
                                        }, 'warning'),
                                        returnToPicker(localFiltered)
                                    );
                                })
                        );
                })
                .catch((err) => {
                    console.error('VectorDraw delete error:', err);
                    return Rx.Observable.of(
                        show({
                            title: 'Delete Error',
                            message: 'Failed to delete feature: ' + (err?.message || 'Unknown error'),
                            position: 'tc',
                            autoDismiss: 10
                        }, 'error'),
                        // Re-render picker with the un-modified cached list so
                        // the user can retry without re-opening the toolbar.
                        returnToPicker(vd.featureList || [])
                    );
                })
                // TASK-795 review C2 — abort the delete chain if the user
                // closes the picker mid-delete. Otherwise the tail
                // RETURN_TO_PICKER would re-mount the picker on top of the
                // already-reset state.
                .takeUntil(action$.ofType(CANCEL_VECTOR_DRAW));
        });

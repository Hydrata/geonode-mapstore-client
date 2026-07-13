import Rx from 'rxjs';
import {trackEvent} from '@js/utils/analytics';
import {recalcDatasetBbox} from '../api/anugaApi';

/**
 * TASK-793 — handlers for ANUGA:VECTOR_DRAW_COMPLETE / CANCELLED.
 *
 * VectorDraw's vectorDrawSaveEpic already dispatches refreshLayerVersion on
 * save success (epicsVectorDraw.js), so WMS tile invalidation is handled.
 *
 * TASK-2140 (c) — OUTCOME event: geometry save-success. This is the ONE
 * place every ANUGA vector draw/edit (boundary/inflow/rainfall/friction/
 * mesh-region/structure — the 8 ANUGA_VECTOR_PREFIXES) lands on save,
 * whether entered via a map click (anugaClickTargets.js) or the SimpleView
 * pencil (simpleViewMenuRow.js onEdit) — both wire onComplete to this same
 * action type. Pairs with the existing `anuga-input-menu-create-new-*`
 * INTENT events so a "drew it, never attached to a scenario" mismatch
 * becomes measurable: intent fires but this OUTCOME event's prefix count
 * stays below the eventual scenario-attach rate. meta.prefix is drawn from
 * ANUGA_FEATURE_CONFIG (a fixed, bounded set — anugaClickTargets.js) so
 * folding it into the label stays low-cardinality; still a no-op on Redux
 * (emits nothing) — only the trackEvent side effect is new.
 */
export const vectorDrawAnugaCompleteEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_COMPLETE')
        .mergeMap((action) => {
            const prefix = (action.meta && action.meta.prefix) || 'unknown';
            trackEvent('process', 'complete', `anuga-vector-draw-save-${prefix.replace(/_$/, '')}`);
            return Rx.Observable.empty();
        });

export const vectorDrawAnugaCancelledEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_CANCELLED')
        .switchMap(() => Rx.Observable.empty());

/**
 * TASK-2165 — after a successful WFS-T save, recalculate the dataset's bbox.
 *
 * VectorDraw saves geometry straight to GeoServer/PostGIS, bypassing Django,
 * so the createlayer world-extent placeholder on the GeoServer featuretype
 * AND the GeoNode Dataset is never corrected — zoom-to-layer then falls back
 * to the stale world extent and zooms to the planet. POSTing the layer name
 * to /api/v2/anuga/datasets/recalc-bbox/ makes GeoServer recompute the bbox
 * from PostGIS and syncs it onto the GeoNode Dataset.
 *
 * Fire-and-forget: emits NO redux action and NEVER blocks the save UX —
 * failures are console-only (a missed recalc stays repairable via the bulk
 * `manage.py recalculate_layer_extents` command). mergeMap (not switchMap)
 * so rapid consecutive saves each get their recalc.
 *
 * layerName comes from action.meta.layerName (set by both dispatch sites:
 * simpleViewMenuRow onEdit + anugaClickTargets), with the live
 * state.vectorDraw.config.layerName as fallback — VECTOR_DRAW_COMPLETE is
 * dispatched before the save epic's reset actions, so config is still intact.
 */
export const vectorDrawRecalcBboxEpic = (action$, store) =>
    action$.ofType('ANUGA:VECTOR_DRAW_COMPLETE')
        .mergeMap((action) => {
            const layerName = action.meta?.layerName
                || store.getState()?.vectorDraw?.config?.layerName;
            if (!layerName) {
                return Rx.Observable.empty();
            }
            return Rx.Observable.from(recalcDatasetBbox(layerName))
                .ignoreElements()
                .catch((err) => {
                    console.error('ANUGA recalc-bbox after WFS-T save failed:', err);
                    return Rx.Observable.empty();
                });
        });

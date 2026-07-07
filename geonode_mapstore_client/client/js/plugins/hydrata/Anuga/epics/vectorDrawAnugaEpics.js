import Rx from 'rxjs';
import {trackEvent} from '@js/utils/analytics';

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

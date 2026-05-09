import Rx from 'rxjs';

/**
 * TASK-793 — handlers for ANUGA:VECTOR_DRAW_COMPLETE / CANCELLED.
 *
 * VectorDraw's vectorDrawSaveEpic already dispatches refreshLayerVersion on
 * save success (epicsVectorDraw.js), so WMS tile invalidation is handled.
 * These epics are placeholder no-ops to keep the action contract live and
 * provide the slot for future per-prefix follow-ups via action.meta.prefix.
 */
export const vectorDrawAnugaCompleteEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_COMPLETE')
        .switchMap(() => Rx.Observable.empty());

export const vectorDrawAnugaCancelledEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_CANCELLED')
        .switchMap(() => Rx.Observable.empty());

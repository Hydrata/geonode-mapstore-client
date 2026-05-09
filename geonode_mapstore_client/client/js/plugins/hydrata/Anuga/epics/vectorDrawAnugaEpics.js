import Rx from 'rxjs';

/**
 * TASK-793 — handler for ANUGA:VECTOR_DRAW_COMPLETE / CANCELLED.
 *
 * VectorDraw's vectorDrawSaveEpic already dispatches refreshLayerVersion
 * on save success (epicsVectorDraw.js:140-167), so the WMS tile invalidation
 * is handled. This epic exists for symmetry + future per-prefix follow-ups
 * (e.g. forcing an Anuga resources refresh after a boundary save). For the
 * five in-scope feature types in the v1 cut, no extra work is needed —
 * we keep the action contract live so callers can rely on it and so future
 * post-save polish lands here without re-touching MenuRow.
 *
 * Returns Observable.empty() for the moment. The action.meta.prefix tells
 * future readers which feature type fired.
 */
export const vectorDrawAnugaCompleteEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_COMPLETE')
        .switchMap(() => Rx.Observable.empty());

export const vectorDrawAnugaCancelledEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_CANCELLED')
        .switchMap(() => Rx.Observable.empty());

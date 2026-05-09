import Rx from 'rxjs';
import { setVisibleSimpleViewSidePanel } from '../../SimpleView/actionsSimpleView';

/**
 * TASK-793 + polish — handlers for ANUGA:VECTOR_DRAW_COMPLETE / CANCELLED.
 *
 * VectorDraw's vectorDrawSaveEpic already dispatches refreshLayerVersion on
 * save success (epicsVectorDraw.js), so WMS tile invalidation is handled.
 * These epics restore the SimpleView side panel that was hidden when the
 * pencil was clicked (so the user focused on the popup). They will also be
 * the slot for any per-prefix follow-up via action.meta.prefix.
 */
export const vectorDrawAnugaCompleteEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_COMPLETE')
        .switchMap(() => Rx.Observable.of(setVisibleSimpleViewSidePanel(true)));

export const vectorDrawAnugaCancelledEpic = (action$) =>
    action$.ofType('ANUGA:VECTOR_DRAW_CANCELLED')
        .switchMap(() => Rx.Observable.of(setVisibleSimpleViewSidePanel(true)));

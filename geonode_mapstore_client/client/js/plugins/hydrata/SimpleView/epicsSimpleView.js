import Rx from "rxjs";

import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";


export const beginEditLayerEpic = (action$) =>
    action$.ofType(GRID_QUERY_RESULT)
        .concatMap((action) => {
            console.log('point GRID_QUERY_RESULT', action);
            return Rx.Observable.of(toggleEditMode());
        });

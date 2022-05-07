import Rx from "rxjs";

import {UPDATE_DATASET_TITLE} from "./actionsSimpleView";
import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";
import axios from "../../../../MapStore2/web/client/libs/ajax";

import {
    refreshlayerVersion
} from "../../../../MapStore2/web/client/actions/layers";


export const beginEditLayerEpic = (action$) =>
    action$.ofType(GRID_QUERY_RESULT)
        .concatMap((action) => {
            return Rx.Observable.of(toggleEditMode());
        });


export const updateDatasetTitle = (action$) =>
    action$
        .ofType(UPDATE_DATASET_TITLE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.get(`/api/v2/datasets?search=${action.datasetName.split('geonode:')[1]}&search_fields=name`))
                .switchMap(response => Rx.Observable
                    .from(axios.patch(`/api/v2/datasets/${response?.data?.datasets?.[0]?.pk}/`, {"title": action.newTitle}))
                )
                .switchMap((response) => {
                    return Rx.Observable.of(refreshlayerVersion([response?.data?.datasets?.[0]?.id]));
                })
        );

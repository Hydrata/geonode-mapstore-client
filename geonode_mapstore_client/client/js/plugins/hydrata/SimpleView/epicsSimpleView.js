import Rx from "rxjs";

import {UPDATE_DATASET_TITLE, SV_DOWNLOAD_LAYER} from "./actionsSimpleView";
import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";
import {
    download,
    selectNode
} from "../../../../MapStore2/web/client/actions/layers";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const beginEditLayerEpic = (action$) =>
    action$.ofType(GRID_QUERY_RESULT)
        .concatMap(() => {
            return Rx.Observable.of(toggleEditMode());
        });


export const updateDatasetTitleEpic = (action$) =>
    action$
        .ofType(UPDATE_DATASET_TITLE)
        .switchMap((action) =>
            Rx.Observable
                .from(axios.get(`/api/v2/datasets?search=${action.datasetName.split('geonode:')[1]}&search_fields=name`))
                .switchMap(response => Rx.Observable
                    .from(axios.patch(`/api/v2/datasets/${response?.data?.datasets?.[0]?.pk}/`, {"title": action.newTitle}))
                )
                .switchMap(response => Rx.Observable.empty())
        );


export const svDownloadLayerEpic = (action$) =>
    action$
        .ofType(SV_DOWNLOAD_LAYER)
        .concatMap((action) =>
            Rx.Observable.concat(
                Rx.Observable.of(selectNode(action?.layer?.id)),
                Rx.Observable.of(download(action?.layer))
            )
        );

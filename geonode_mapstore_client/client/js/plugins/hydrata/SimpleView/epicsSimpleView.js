import Rx from "rxjs";

import {
    UPDATE_DATASET_TITLE,
    SV_DOWNLOAD_LAYER,
    SUBMIT_SV_ATTRIBUTE_FORM,
    updateDatasetTitleSuccess,
    submitSimpleViewAttributeFormSuccess
} from "./actionsSimpleView";

import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";

import {
    download,
    selectNode
} from "../../../../MapStore2/web/client/actions/layers";

import axios from "../../../../MapStore2/web/client/libs/ajax";
import {runAnugaScenarioSuccess, setAnugaScenarioMenu} from "@js/plugins/hydrata/Anuga/actionsAnuga";


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
                .concatMap(response => Rx.Observable
                    .from(axios.patch(`/api/v2/datasets/${response?.data?.datasets?.[0]?.pk}/`, {"title": action.newTitle}))
                )
                .concatMap(() => Rx.Observable.of(updateDatasetTitleSuccess()))
        );


export const submitAttributeFormEpic = (action$, store) =>
    action$
        .ofType(SUBMIT_SV_ATTRIBUTE_FORM)
        .switchMap((action) =>
            Rx.Observable
                .from(
                    axios.post(
                        `/${store.getState()?.simpleView?.config?.importer_config[store.getState()?.simpleView?.importerConfigKey]?.app_name}/api/${store.getState()?.simpleView?.config?.project_id}/${store.getState()?.simpleView?.importerConfigKey}/${store.getState()?.simpleView?.importerTargetObjectId}/importer-execute/`,
                        {
                            form: action?.form,
                            project_id: action?.projectId,
                            importer_session_id: action?.simpleViewImporterSessionId
                        }
                    )
                        .then(response => submitSimpleViewAttributeFormSuccess(response.data))
                )
        )
        .concatMap(() => Rx.Observable.of(
            setAnugaScenarioMenu(true)
        ));


export const svDownloadLayerEpic = (action$) =>
    action$
        .ofType(SV_DOWNLOAD_LAYER)
        .concatMap((action) =>
            Rx.Observable.concat(
                Rx.Observable.of(selectNode(action?.layer?.id, 'layer')),
                Rx.Observable.of(download(action?.layer))
            )
        );

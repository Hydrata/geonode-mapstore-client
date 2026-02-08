import Rx from "rxjs";

import {
    UPDATE_DATASET_TITLE,
    SV_DOWNLOAD_LAYER,
    SUBMIT_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    updateDatasetTitleSuccess,
    submitSimpleViewAttributeFormSuccess,
    setVisibleSimpleViewAttributeForm,
    setVisibleUploaderPanel,
    setProcessingSimpleViewAttributeForm,
    setVisibleSimpleViewAttributeResult,
    setSimpleViewAttributeResult,
    createSimpleViewAttributeForm
} from "./actionsSimpleView";

import {toggleEditMode, GRID_QUERY_RESULT} from "../../../../MapStore2/web/client/actions/featuregrid";
import {show} from '../../../../MapStore2/web/client/actions/notifications';

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
                        store.getState()?.simpleView?.submitUrl,
                        {
                            form: action?.form,
                            project_id: action?.projectId,
                            importer_session_id: action?.simpleViewImporterSessionId
                        }
                    )
                        .then(response => {
                            console.log('SUBMIT_SV_ATTRIBUTE_FORM response:', response);
                            if (response.data?.submitUrl) {
                                return createSimpleViewAttributeForm(response.data);
                            }
                            return submitSimpleViewAttributeFormSuccess(response.data);
                        })
                )
        );


export const submitSimpleViewAttributeFormSuccessEpic = (action$) =>
    action$.ofType(SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS)
        .concatMap((action) => Rx.Observable.of(
            setVisibleSimpleViewAttributeForm(false),
            setVisibleUploaderPanel(false),
            setProcessingSimpleViewAttributeForm(false),
            setVisibleSimpleViewAttributeResult(true),
            setSimpleViewAttributeResult(action.data),
            show({
                "message": "Import successful",
                "title": "Features added",
                "uid": 1000,
                "position": "tc"
            })
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

const axios = require('../../../../MapStore2/web/client/libs/ajax');

const FETCH_SWAMM_BMPTYPES = 'FETCH_SWAMM_BMPTYPES';
const FETCH_SWAMM_BMPTYPES_ERROR = 'FETCH_SWAMM_BMPTYPES_ERROR';
const FETCH_SWAMM_BMPTYPES_SUCCESS = 'FETCH_SWAMM_BMPTYPES_SUCCESS';

const FETCH_SWAMM_ALL_BMPS = 'FETCH_SWAMM_ALL_BMPS';
const FETCH_SWAMM_ALL_BMPS_ERROR = 'FETCH_SWAMM_ALL_BMPS_ERROR';
const FETCH_SWAMM_ALL_BMPS_SUCCESS = 'FETCH_SWAMM_ALL_BMPS_SUCCESS';

const FETCH_SWAMM_BMP_STATUSES = 'FETCH_SWAMM_BMP_STATUSES';
const FETCH_SWAMM_BMP_STATUSES_ERROR = 'FETCH_SWAMM_BMP_STATUSES_ERROR';
const FETCH_SWAMM_BMP_STATUSES_SUCCESS = 'FETCH_SWAMM_BMP_STATUSES_SUCCESS';

const FETCH_SWAMM_TARGETS = 'FETCH_SWAMM_TARGETS';
const FETCH_SWAMM_TARGETS_ERROR = 'FETCH_SWAMM_TARGETS_ERROR';
const FETCH_SWAMM_TARGETS_SUCCESS = 'FETCH_SWAMM_TARGETS_SUCCESS';
const SELECT_SWAMM_TARGET_ID = 'SELECT_SWAMM_TARGET_ID';

const SHOW_SWAMM_BMP_CHART = 'SHOW_SWAMM_BMP_CHART';
const HIDE_SWAMM_BMP_CHART = 'HIDE_SWAMM_BMP_CHART';

const SHOW_TARGET_FORM = 'SHOW_TARGET_FORM';
const HIDE_TARGET_FORM = 'HIDE_TARGET_FORM';
const UPDATE_TARGET_FORM = 'UPDATE_TARGET_FORM';
const CLEAR_TARGET_FORM = 'CLEAR_TARGET_FORM';
const SUBMIT_TARGET_FORM = 'SUBMIT_TARGET_FORM';
const SUBMIT_TARGET_FORM_SUCCESS = 'SUBMIT_TARGET_FORM_SUCCESS';
const SUBMIT_TARGET_FORM_ERROR = 'SUBMIT_TARGET_FORM_ERROR';
const DELETE_TARGET = 'DELETE_TARGET';
const DELETE_TARGET_SUCCESS = 'DELETE_TARGET_SUCCESS';
const DELETE_TARGET_ERROR = 'DELETE_TARGET_ERROR';

const SHOW_SWAMM_DATA_GRID = 'SHOW_SWAMM_DATA_GRID';
const HIDE_SWAMM_DATA_GRID = 'HIDE_SWAMM_DATA_GRID';
const SHOW_SWAMM_FEATURE_GRID = 'SHOW_SWAMM_FEATURE_GRID';

const SHOW_BMP_MANAGER = 'SHOW_BMP_MANAGER';
const HIDE_BMP_MANAGER = 'HIDE_BMP_MANAGER';
const TOGGLE_BMP_MANAGER = 'TOGGLE_BMP_MANAGER';

// const TOGGLE_OUTLETS = 'TOGGLE_OUTLETS';
// const TOGGLE_FOOTPRINTS = 'TOGGLE_FOOTPRINTS';
// const TOGGLE_WATERSHEDS = 'TOGGLE_WATERSHEDS';
const TOGGLE_BMP_TYPE = 'TOGGLE_BMP_TYPE';
const SET_BMP_TYPE = 'SET_BMP_TYPE';

const SET_STATUS_FILTER = 'SET_STATUS_FILTER';

const SHOW_BMP_FORM = 'SHOW_BMP_FORM';
const HIDE_BMP_FORM = 'HIDE_BMP_FORM';
const SUBMIT_BMP_FORM = 'SUBMIT_BMP_FORM';
const SUBMIT_BMP_FORM_SUCCESS = 'SUBMIT_BMP_FORM_SUCCESS';
const SUBMIT_BMP_FORM_ERROR = 'SUBMIT_BMP_FORM_ERROR';
const MAKE_BMP_FORM = 'MAKE_BMP_FORM';
const CLEAR_BMP_FORM = 'CLEAR_BMP_FORM';
const MAKE_DEFAULTS_BMP_FORM = 'MAKE_DEFAULTS_BMP_FORM';
const MAKE_EXISTING_BMP_FORM = 'MAKE_EXISTING_BMP_FORM';
const UPDATE_BMP_FORM = 'UPDATE_BMP_FORM';
const SET_DRAWING_BMP_LAYER_NAME = 'SET_DRAWING_BMP_LAYER_NAME';
const START_DRAWING_BMP = 'START_DRAWING_BMP';
const CLEAR_DRAWING_BMP_LAYER_NAME = 'CLEAR_DRAWING_BMP_LAYER_NAME';
const CREATE_BMP_FEATURE_ID = 'CREATE_BMP_FEATURE_ID';
const SET_EDITING_BMP_FEATURE_ID = 'SET_EDITING_BMP_FEATURE_ID';
const CLEAR_EDITING_BMP_FEATURE_ID = 'CLEAR_EDITING_BMP_FEATURE_ID';
const DELETE_BMP = 'DELETE_BMP';
const DELETE_BMP_SUCCESS = 'DELETE_BMP_SUCCESS';
const DELETE_BMP_ERROR = 'DELETE_BMP_ERROR';
const SET_BMP_FILTER_MODE = 'SET_BMP_FILTER_MODE';

const uuidv1 = require('uuid/v1');
const { SHOW_NOTIFICATION } = require('../../../../MapStore2/web/client/actions/notifications');

const fetchSwammBmpTypesSuccess = (config) => {
    return {
        type: FETCH_SWAMM_BMPTYPES_SUCCESS,
        bmpTypes: config
    };
};

function fetchSwammBmpTypesError(e) {
    console.log('fetchSwammBmpTypesError', e);
    return {
        type: SHOW_NOTIFICATION,
        title: 'Fetch Swamm Bmp Types Error',
        autoDismiss: 600,
        position: 'tc',
        message: `${e?.data}`,
        uid: uuidv1(),
        level: 'error'
    };
}

const fetchSwammBmpTypes = (mapId) => {
    return (dispatch) => {
        return axios.get(`/swamm/api/${mapId}/bmp-type/`
        ).then(
            response => {
                dispatch(fetchSwammBmpTypesSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchSwammBmpTypesError(e));
            }
        );
    };
};

const setStatusFilter = (statuses) => {
    return {
        type: SET_STATUS_FILTER,
        statuses: statuses
    };
};

const fetchSwammAllBmpsSuccess = (allBmps) => {
    return {
        type: FETCH_SWAMM_ALL_BMPS_SUCCESS,
        allBmps: allBmps
    };
};

function fetchSwammAllBmpsError(e) {
    console.log('fetchSwammAllBmpsError', e);
    return {
        type: SHOW_NOTIFICATION,
        title: 'Fetch Swamm All Bmps Error',
        autoDismiss: 600,
        position: 'tc',
        message: `${e?.data}`,
        uid: uuidv1(),
        level: 'error'
    };
}

const fetchSwammAllBmps = (mapId) => {
    return (dispatch) => {
        return axios.get(`/swamm/api/${mapId}/bmps/`
        ).then(
            response => {
                dispatch(fetchSwammAllBmpsSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchSwammAllBmpsError(e));
            }
        );
    };
};

const fetchSwammBmpStatusesSuccess = (statuses) => {
    return {
        type: FETCH_SWAMM_BMP_STATUSES_SUCCESS,
        statuses: statuses
    };
};

function fetchSwammBmpStatusesError(e) {
    console.log('fetchSwammBmpStatusesError', e);
    return {
        type: SHOW_NOTIFICATION,
        title: 'Fetch Swamm Bmp Statuses Error',
        autoDismiss: 600,
        position: 'tc',
        message: `${e?.data}`,
        uid: uuidv1(),
        level: 'error'
    };
}

const fetchSwammBmpStatuses = (mapId) => {
    return (dispatch) => {
        return axios.get(`/swamm/api/${mapId}/bmps/status_list/`
        ).then(
            response => {
                dispatch(fetchSwammBmpStatusesSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchSwammBmpStatusesError(e));
            }
        );
    };
};

const toggleBmpType = (bmpType) => {
    return (dispatch) => {
        dispatch({
            type: 'TOGGLE_BMP_TYPE',
            bmpType: bmpType
        });
    };
};

const setBmpType = (bmpType, isVisible) => {
    return (dispatch) => {
        dispatch({
            type: 'SET_BMP_TYPE',
            bmpType: bmpType,
            isVisible: isVisible
        });
    };
};

const makeBmpForm = () => {
    return {
        type: MAKE_BMP_FORM
    };
};

const showBmpForm = () => {
    return {
        type: SHOW_BMP_FORM
    };
};

const hideBmpForm = () => {
    return {
        type: HIDE_BMP_FORM
    };
};

const showSwammDataGrid = () => {
    return {
        type: SHOW_SWAMM_DATA_GRID
    };
};

const showSwammFeatureGrid = (layer) => {
    return {
        type: SHOW_SWAMM_FEATURE_GRID,
        layer
    };
};

const hideSwammDataGrid = () => {
    return {
        type: HIDE_SWAMM_DATA_GRID
    };
};

const showSwammBmpChart = () => {
    return {
        type: SHOW_SWAMM_BMP_CHART
    };
};

const hideSwammBmpChart = () => {
    return {
        type: HIDE_SWAMM_BMP_CHART
    };
};

const showBmpManager = () => {
    return {
        type: SHOW_BMP_MANAGER
    };
};

const hideBmpManager = () => {
    return {
        type: HIDE_BMP_MANAGER
    };
};

const toggleBmpManager = () => {
    return {
        type: TOGGLE_BMP_MANAGER
    };
};

const makeDefaultsBmpForm = (bmpType) => {
    return {
        type: MAKE_DEFAULTS_BMP_FORM,
        bmpType: bmpType
    };
};

const makeExistingBmpForm = (bmp) => {
    return {
        type: MAKE_EXISTING_BMP_FORM,
        bmp: bmp
    };
};

const clearBmpForm = () => {
    return {
        type: CLEAR_BMP_FORM
    };
};

const updateBmpForm = (kv) => {
    return {
        type: UPDATE_BMP_FORM,
        kv: kv
    };
};

const startDrawingBmp = () => {
    return {
        type: START_DRAWING_BMP
    };
};

const setDrawingBmpLayerName = (layerName) => {
    console.log('setDrawingBmpLayerName', layerName);
    return {
        type: SET_DRAWING_BMP_LAYER_NAME,
        drawingBmpLayerName: layerName
    };
};

const clearDrawingBmpLayerName = () => {
    return {
        type: CLEAR_DRAWING_BMP_LAYER_NAME
    };
};

const setEditingBmpFeatureId = (featureId) => {
    console.log('setEditingBmpFeatureId', featureId);
    return {
        type: SET_EDITING_BMP_FEATURE_ID,
        editingBmpFeatureId: featureId
    };
};

const createBmpFeatureId = (action) => {
    console.log('createBmpFeatureId action:', action);
    let newBmpId = null;
    let shapeId = null;
    const ids = action.result.features.map(feature => feature.id.split('.')[1]);
    console.log('createBmpFeatureId ids:', ids);
    // TODO: It would be much better to get this Id from the WFS response XML,
    //  rather than assume it's the largest one.
    newBmpId = Math.max(...ids);
    const featureBmpType = action.filterObj.featureTypeName.split("_")[2];
    console.log('createBmpFeatureId newBmpId: ', newBmpId);
    console.log('createBmpFeatureId featureBmpType: ', featureBmpType);
    const featureId = action.filterObj.featureTypeName + '.' + newBmpId;
    console.log('createBmpFeatureId assigning: ', featureId);
    switch (featureBmpType) {
    case "outlet":
        shapeId = {outlet_fid: featureId};
        break;
    case "footprint":
        shapeId = {footprint_fid: featureId};
        break;
    case "watershed":
        shapeId = {watershed_fid: featureId};
        break;
    default:
        shapeId = {};
    }
    console.log('createBmpFeatureId shapeId: ', shapeId);
    return {
        type: UPDATE_BMP_FORM,
        kv: shapeId
    };
};

const clearEditingBmpFeatureId = () => {
    console.log('clearEditingBmpFeatureId');
    return {
        type: CLEAR_EDITING_BMP_FEATURE_ID
    };
};

const fetchSwammTargetsSuccess = (data) => {
    return (dispatch) => {
        dispatch({
            type: FETCH_SWAMM_TARGETS_SUCCESS,
            targets: data
        });
    };
};

const fetchSwammTargetsError = (e) => {
    console.log('*** error:', e);
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Failed to load Targets',
            autoDismiss: 60,
            position: 'tc',
            message: `${e?.data}`,
            uid: uuidv1(),
            level: 'error'
        });
        dispatch({
            type: FETCH_SWAMM_TARGETS_ERROR,
            error: e
        });
    };
};

const fetchSwammTargets = (mapId) => {
    return (dispatch) => {
        return axios.get(`/swamm/api/${mapId}/pollutant-loading-target/`
        ).then(
            response => {
                dispatch(fetchSwammTargetsSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchSwammTargetsError(e));
            }
        );
    };
};

const submitBmpFormSuccess = (bmp) => {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `BMP ID: ${bmp.id} saved`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: SUBMIT_BMP_FORM_SUCCESS,
            bmp
        });
    };
};

function submitBmpFormError(e) {
    console.log('submitBmpFormError', e);
    return {
        type: SHOW_NOTIFICATION,
        title: 'Submit Bmp Form Error',
        autoDismiss: 600,
        position: 'tc',
        message: `Error saving BMP: ${e?.data}`,
        uid: uuidv1(),
        level: 'error'
    };
}

const submitBmpForm = (newBmp, mapId) => {
    if (newBmp.id) {
        return (dispatch) => {
            console.log('updating existing BMP: ', newBmp);
            return axios.patch(`/swamm/api/${mapId}/bmps/${newBmp.id}/`, newBmp
            ).then(
                response => {
                    dispatch(submitBmpFormSuccess(response.data));
                    // dispatch(fetchSwammAllBmps(mapId));
                    dispatch(makeExistingBmpForm(response.data));
                    dispatch(fetchSwammTargets(mapId));
                }
            ).catch(
                e => {
                    dispatch(submitBmpFormError(e));
                }
            );
        };
    }
    return (dispatch) => {
        console.log('creating new BMP: ', newBmp);
        return axios.post(`/swamm/api/${mapId}/bmps/`, newBmp
        ).then(
            response => {
                dispatch(submitBmpFormSuccess(response.data));
                // dispatch(fetchSwammAllBmps(mapId));
                dispatch(makeExistingBmpForm(response.data));
                dispatch(fetchSwammTargets(mapId));
            }
        ).catch(
            e => {
                dispatch(submitBmpFormError(e));
            }
        );
    };
};

const deleteBmpSuccess = (bmpId) => {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Delete BMP Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Successfully deleted BMP: ${bmpId}`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: DELETE_BMP_SUCCESS,
            bmpId
        });
    };
};

const deleteBmpError = (e) => {
    console.log('*** error:', e);
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Delete BMP Error',
            autoDismiss: 60,
            position: 'tc',
            message: `${e?.data}`,
            uid: uuidv1(),
            level: 'error'
        });
        dispatch({
            type: DELETE_BMP_ERROR,
            error: e
        });
    };
};

const deleteBmp = (mapId, bmpId) => {
    return (dispatch) => {
        return axios.delete(`/swamm/api/${mapId}/bmps/${bmpId}/`, {}
        ).then(
            response => {
                dispatch(deleteBmpSuccess(bmpId));
                dispatch(hideBmpForm());
                dispatch(clearBmpForm());
                dispatch(clearEditingBmpFeatureId());
                dispatch(clearDrawingBmpLayerName());
            }
        ).catch(
            e => {
                dispatch(deleteBmpError(e));
            }
        );
    };
};

const selectSwammTargetId = (selectedTargetId) => {
    return {
        type: SELECT_SWAMM_TARGET_ID,
        selectedTargetId
    };
};

const setBmpFilterMode = (bmpFilterMode) => {
    return {
        type: SET_BMP_FILTER_MODE,
        bmpFilterMode
    };
};


const hideTargetForm = () => {
    return {
        type: HIDE_TARGET_FORM,
        visibleTargetForm: false
    };
};


const showTargetForm = (target = null) => {
    return {
        type: SHOW_TARGET_FORM,
        visibleTargetForm: true,
        target: target
    };
};


const clearTargetForm = () => {
    return {
        type: CLEAR_TARGET_FORM,
        targetForm: null
    };
};


const updateTargetForm = (kv) => {
    return {
        type: UPDATE_TARGET_FORM,
        kv
    };
};

const submitTargetFormSuccess = (target) => {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Target: ${target.id} saved`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: SUBMIT_TARGET_FORM_SUCCESS,
            target
        });
    };
};

function submitTargetFormError(e) {
    console.log('submitTargetFormError', e);
    return {
        type: SHOW_NOTIFICATION,
        title: 'Submit Target Form Error',
        autoDismiss: 600,
        position: 'tc',
        message: `Error saving Target: ${e?.data}`,
        uid: uuidv1(),
        level: 'error'
    };
}

const submitTargetForm = (target, mapId) => {
    if (target.id) {
        return (dispatch) => {
            console.log('updating existing Target: ', target);
            return axios.patch(`/swamm/api/${mapId}/pollutant-loading-target/${target.id}/`, target
            ).then(
                response => {
                    dispatch(submitTargetFormSuccess(response.data));
                    dispatch(fetchSwammTargets(mapId));
                    dispatch(hideTargetForm());
                    dispatch(clearTargetForm());
                }
            ).catch(
                e => {
                    dispatch(submitTargetFormError(e));
                }
            );
        };
    }
    return (dispatch) => {
        console.log('creating new Target: ', target);
        return axios.post(`/swamm/api/${mapId}/pollutant-loading-target/`, target
        ).then(
            response => {
                dispatch(submitTargetFormSuccess(response.data));
                dispatch(fetchSwammTargets(mapId));
                dispatch(hideTargetForm());
                dispatch(clearTargetForm());
            }
        ).catch(
            e => {
                dispatch(submitTargetFormError(e));
            }
        );
    };
};


const deleteTargetSuccess = (targetId) => {
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Delete Target Success',
            autoDismiss: 6,
            position: 'tc',
            message: `Successfully deleted Target: ${targetId}`,
            uid: uuidv1(),
            level: 'success'
        });
        dispatch({
            type: DELETE_TARGET_SUCCESS,
            targetId
        });
    };
};

const deleteTargetError = (e) => {
    console.log('*** error:', e);
    return (dispatch) => {
        dispatch({
            type: SHOW_NOTIFICATION,
            title: 'Delete Target Error',
            autoDismiss: 60,
            position: 'tc',
            message: `${e?.data}`,
            uid: uuidv1(),
            level: 'error'
        });
        dispatch({
            type: DELETE_TARGET_ERROR,
            error: e
        });
    };
};

const deleteTarget = (mapId, targetId) => {
    return (dispatch) => {
        return axios.delete(`/swamm/api/${mapId}/pollutant-loading-target/${targetId}/`, {}
        ).then(
            response => {
                dispatch(deleteTargetSuccess(targetId));
                dispatch(fetchSwammTargets(mapId));
                dispatch(hideTargetForm());
                dispatch(clearTargetForm());
            }
        ).catch(
            e => {
                dispatch(deleteTargetError(e));
            }
        );
    };
};


module.exports = {
    FETCH_SWAMM_BMPTYPES, fetchSwammBmpTypes,
    FETCH_SWAMM_BMPTYPES_ERROR, fetchSwammBmpTypesError,
    FETCH_SWAMM_BMPTYPES_SUCCESS, fetchSwammBmpTypesSuccess,
    FETCH_SWAMM_ALL_BMPS, fetchSwammAllBmps,
    FETCH_SWAMM_ALL_BMPS_ERROR, fetchSwammAllBmpsError,
    FETCH_SWAMM_ALL_BMPS_SUCCESS, fetchSwammAllBmpsSuccess,
    FETCH_SWAMM_BMP_STATUSES, fetchSwammBmpStatuses,
    FETCH_SWAMM_BMP_STATUSES_ERROR, fetchSwammBmpStatusesError,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS, fetchSwammBmpStatusesSuccess,
    FETCH_SWAMM_TARGETS, fetchSwammTargets,
    FETCH_SWAMM_TARGETS_ERROR, fetchSwammTargetsError,
    FETCH_SWAMM_TARGETS_SUCCESS, fetchSwammTargetsSuccess,
    SELECT_SWAMM_TARGET_ID, selectSwammTargetId,
    SUBMIT_BMP_FORM, submitBmpForm,
    SUBMIT_BMP_FORM_ERROR, submitBmpFormError,
    SUBMIT_BMP_FORM_SUCCESS, submitBmpFormSuccess,
    TOGGLE_BMP_TYPE, toggleBmpType,
    SET_BMP_TYPE, setBmpType,
    SET_STATUS_FILTER, setStatusFilter,
    SHOW_BMP_FORM, showBmpForm,
    HIDE_BMP_FORM, hideBmpForm,
    SHOW_SWAMM_DATA_GRID, showSwammDataGrid,
    HIDE_SWAMM_DATA_GRID, hideSwammDataGrid,
    SHOW_SWAMM_FEATURE_GRID, showSwammFeatureGrid,
    SHOW_SWAMM_BMP_CHART, showSwammBmpChart,
    HIDE_SWAMM_BMP_CHART, hideSwammBmpChart,
    SHOW_BMP_MANAGER, showBmpManager,
    HIDE_BMP_MANAGER, hideBmpManager,
    TOGGLE_BMP_MANAGER, toggleBmpManager,
    CLEAR_BMP_FORM, clearBmpForm,
    MAKE_BMP_FORM, makeBmpForm,
    MAKE_DEFAULTS_BMP_FORM, makeDefaultsBmpForm,
    MAKE_EXISTING_BMP_FORM, makeExistingBmpForm,
    UPDATE_BMP_FORM, updateBmpForm,
    START_DRAWING_BMP, startDrawingBmp,
    SET_DRAWING_BMP_LAYER_NAME, setDrawingBmpLayerName,
    CLEAR_DRAWING_BMP_LAYER_NAME, clearDrawingBmpLayerName,
    CREATE_BMP_FEATURE_ID, createBmpFeatureId,
    SET_EDITING_BMP_FEATURE_ID, setEditingBmpFeatureId,
    CLEAR_EDITING_BMP_FEATURE_ID, clearEditingBmpFeatureId,
    DELETE_BMP, deleteBmp,
    DELETE_BMP_ERROR, deleteBmpError,
    DELETE_BMP_SUCCESS, deleteBmpSuccess,
    SET_BMP_FILTER_MODE, setBmpFilterMode,
    SHOW_TARGET_FORM, showTargetForm,
    HIDE_TARGET_FORM, hideTargetForm,
    UPDATE_TARGET_FORM, updateTargetForm,
    CLEAR_TARGET_FORM, clearTargetForm,
    SUBMIT_TARGET_FORM, submitTargetForm,
    SUBMIT_TARGET_FORM_SUCCESS, submitTargetFormSuccess,
    SUBMIT_TARGET_FORM_ERROR, submitTargetFormError,
    DELETE_TARGET, deleteTarget,
    DELETE_TARGET_SUCCESS, deleteTargetSuccess,
    DELETE_TARGET_ERROR, deleteTargetError
};

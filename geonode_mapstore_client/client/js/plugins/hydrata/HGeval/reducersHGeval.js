import {
    HGEVAL_SET_STEP,
    HGEVAL_SET_COORDINATES,
    HGEVAL_UPDATE_FORM,
    HGEVAL_START_REPORT,
    HGEVAL_QUERY_PROGRESS,
    HGEVAL_QUERY_RESULT,
    HGEVAL_RASTER_RESULT,
    HGEVAL_REPORT_COMPLETE,
    HGEVAL_REPORT_ERROR,
    HGEVAL_SAVE_SUCCESS,
    HGEVAL_SAVE_ERROR,
    HGEVAL_RESET,
    HGEVAL_VALIDATION_ERROR,
    HGEVAL_SIGNUP_AND_SAVE,
    HGEVAL_SIGNUP_SUCCESS,
    HGEVAL_SIGNUP_ERROR,
    HGEVAL_LOGIN_AND_SAVE,
    HGEVAL_LOGIN_SUCCESS,
    HGEVAL_LOGIN_ERROR,
    HGEVAL_MAP_IMAGE_RESULT
} from "./actionsHGeval";

const initialState = {
    step: 'idle', // idle | selecting | form | loading | report
    coordinates: null, // {lon, lat}
    form: {
        name: '',
        description: '',
        sector: '',
        contact_email: '',
        contact_phone_number: ''
    },
    reportData: {}, // { 'geonode:layer_name': {field: value, ...}, ... }
    rasterValues: null, // {elevation, precip_annual, precip_driest_quarter}
    warnings: [],
    queryProgress: { completed: 0, total: 0 },
    loading: false,
    error: null,
    validationError: null,
    savedReport: null,
    signupErrors: null,
    signingUp: false,
    loginErrors: null,
    loggingIn: false,
    mapImageDataUrl: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case HGEVAL_SET_STEP:
        return { ...state, step: action.step, error: null, validationError: null };
    case HGEVAL_SET_COORDINATES:
        return {
            ...state,
            coordinates: { lon: action.lon, lat: action.lat },
            validationError: null
        };
    case HGEVAL_UPDATE_FORM:
        return {
            ...state,
            form: { ...state.form, [action.field]: action.value }
        };
    case HGEVAL_START_REPORT:
        return {
            ...state,
            step: 'loading',
            loading: true,
            reportData: {},
            rasterValues: null,
            warnings: [],
            queryProgress: { completed: 0, total: 0 },
            error: null
        };
    case HGEVAL_QUERY_PROGRESS:
        return {
            ...state,
            queryProgress: { completed: action.completed, total: action.total }
        };
    case HGEVAL_QUERY_RESULT:
        return {
            ...state,
            reportData: { ...state.reportData, [action.layerName]: action.data }
        };
    case HGEVAL_RASTER_RESULT:
        return { ...state, rasterValues: action.values };
    case HGEVAL_REPORT_COMPLETE:
        return {
            ...state,
            step: 'report',
            loading: false,
            warnings: action.warnings
        };
    case HGEVAL_REPORT_ERROR:
        return { ...state, step: 'selecting', loading: false, error: action.error };
    case HGEVAL_SAVE_SUCCESS:
        return { ...state, savedReport: action.report };
    case HGEVAL_SAVE_ERROR:
        return { ...state, error: action.error };
    case HGEVAL_VALIDATION_ERROR:
        return { ...state, validationError: action.error };
    case HGEVAL_SIGNUP_AND_SAVE:
        return { ...state, signingUp: true, signupErrors: null };
    case HGEVAL_SIGNUP_SUCCESS:
        return { ...state, signingUp: false, savedReport: action.report };
    case HGEVAL_SIGNUP_ERROR:
        return { ...state, signingUp: false, signupErrors: action.errors };
    case HGEVAL_LOGIN_AND_SAVE:
        return { ...state, loggingIn: true, loginErrors: null };
    case HGEVAL_LOGIN_SUCCESS:
        return { ...state, loggingIn: false, savedReport: action.report };
    case HGEVAL_LOGIN_ERROR:
        return { ...state, loggingIn: false, loginErrors: action.errors };
    case HGEVAL_MAP_IMAGE_RESULT:
        return { ...state, mapImageDataUrl: action.mapImageDataUrl };
    case HGEVAL_RESET:
        return { ...initialState };
    default:
        return state;
    }
};

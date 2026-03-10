const HGEVAL_SET_STEP = 'HGEVAL_SET_STEP';
const HGEVAL_SET_COORDINATES = 'HGEVAL_SET_COORDINATES';
const HGEVAL_UPDATE_FORM = 'HGEVAL_UPDATE_FORM';
const HGEVAL_START_REPORT = 'HGEVAL_START_REPORT';
const HGEVAL_QUERY_PROGRESS = 'HGEVAL_QUERY_PROGRESS';
const HGEVAL_QUERY_RESULT = 'HGEVAL_QUERY_RESULT';
const HGEVAL_RASTER_RESULT = 'HGEVAL_RASTER_RESULT';
const HGEVAL_REPORT_COMPLETE = 'HGEVAL_REPORT_COMPLETE';
const HGEVAL_REPORT_ERROR = 'HGEVAL_REPORT_ERROR';
const HGEVAL_SAVE_REPORT = 'HGEVAL_SAVE_REPORT';
const HGEVAL_SAVE_SUCCESS = 'HGEVAL_SAVE_SUCCESS';
const HGEVAL_SAVE_ERROR = 'HGEVAL_SAVE_ERROR';
const HGEVAL_RESET = 'HGEVAL_RESET';
const HGEVAL_VALIDATION_ERROR = 'HGEVAL_VALIDATION_ERROR';
const HGEVAL_SIGNUP_AND_SAVE = 'HGEVAL_SIGNUP_AND_SAVE';
const HGEVAL_SIGNUP_SUCCESS = 'HGEVAL_SIGNUP_SUCCESS';
const HGEVAL_SIGNUP_ERROR = 'HGEVAL_SIGNUP_ERROR';
const HGEVAL_LOGIN_AND_SAVE = 'HGEVAL_LOGIN_AND_SAVE';
const HGEVAL_LOGIN_SUCCESS = 'HGEVAL_LOGIN_SUCCESS';
const HGEVAL_LOGIN_ERROR = 'HGEVAL_LOGIN_ERROR';
const HGEVAL_MAP_IMAGE_RESULT = 'HGEVAL_MAP_IMAGE_RESULT';

function setStep(step) {
    return { type: HGEVAL_SET_STEP, step };
}

function setCoordinates(lon, lat) {
    return { type: HGEVAL_SET_COORDINATES, lon, lat };
}

function updateForm(field, value) {
    return { type: HGEVAL_UPDATE_FORM, field, value };
}

function startReport() {
    return { type: HGEVAL_START_REPORT };
}

function queryProgress(completed, total) {
    return { type: HGEVAL_QUERY_PROGRESS, completed, total };
}

function queryResult(layerName, data) {
    return { type: HGEVAL_QUERY_RESULT, layerName, data };
}

function rasterResult(values) {
    return { type: HGEVAL_RASTER_RESULT, values };
}

function reportComplete(warnings) {
    return { type: HGEVAL_REPORT_COMPLETE, warnings };
}

function reportError(error) {
    return { type: HGEVAL_REPORT_ERROR, error };
}

function saveReport() {
    return { type: HGEVAL_SAVE_REPORT };
}

function saveSuccess(report) {
    return { type: HGEVAL_SAVE_SUCCESS, report };
}

function saveError(error) {
    return { type: HGEVAL_SAVE_ERROR, error };
}

function reset() {
    return { type: HGEVAL_RESET };
}

function validationError(error) {
    return { type: HGEVAL_VALIDATION_ERROR, error };
}

function signupAndSave(signupData) {
    return { type: HGEVAL_SIGNUP_AND_SAVE, signupData };
}

function signupSuccess(report, accessToken, user) {
    return { type: HGEVAL_SIGNUP_SUCCESS, report, accessToken, user };
}

function signupError(errors) {
    return { type: HGEVAL_SIGNUP_ERROR, errors };
}

function loginAndSave(credentials) {
    return { type: HGEVAL_LOGIN_AND_SAVE, credentials };
}

function loginSuccess(report) {
    return { type: HGEVAL_LOGIN_SUCCESS, report };
}

function loginError(errors) {
    return { type: HGEVAL_LOGIN_ERROR, errors };
}

function mapImageResult(mapImageDataUrl) {
    return { type: HGEVAL_MAP_IMAGE_RESULT, mapImageDataUrl };
}

module.exports = {
    HGEVAL_SET_STEP, setStep,
    HGEVAL_SET_COORDINATES, setCoordinates,
    HGEVAL_UPDATE_FORM, updateForm,
    HGEVAL_START_REPORT, startReport,
    HGEVAL_QUERY_PROGRESS, queryProgress,
    HGEVAL_QUERY_RESULT, queryResult,
    HGEVAL_RASTER_RESULT, rasterResult,
    HGEVAL_REPORT_COMPLETE, reportComplete,
    HGEVAL_REPORT_ERROR, reportError,
    HGEVAL_SAVE_REPORT, saveReport,
    HGEVAL_SAVE_SUCCESS, saveSuccess,
    HGEVAL_SAVE_ERROR, saveError,
    HGEVAL_RESET, reset,
    HGEVAL_VALIDATION_ERROR, validationError,
    HGEVAL_SIGNUP_AND_SAVE, signupAndSave,
    HGEVAL_SIGNUP_SUCCESS, signupSuccess,
    HGEVAL_SIGNUP_ERROR, signupError,
    HGEVAL_LOGIN_AND_SAVE, loginAndSave,
    HGEVAL_LOGIN_SUCCESS, loginSuccess,
    HGEVAL_LOGIN_ERROR, loginError,
    HGEVAL_MAP_IMAGE_RESULT, mapImageResult
};

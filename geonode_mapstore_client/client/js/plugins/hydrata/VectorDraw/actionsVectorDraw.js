export const START_VECTOR_DRAW = 'VECTOR_DRAW:START';
export const CANCEL_VECTOR_DRAW = 'VECTOR_DRAW:CANCEL';
export const DRAWING_COMPLETE = 'VECTOR_DRAW:DRAWING_COMPLETE';
export const SUBMIT_FORM = 'VECTOR_DRAW:SUBMIT_FORM';
export const UPDATE_FORM_VALUES = 'VECTOR_DRAW:UPDATE_FORM_VALUES';
export const SAVE_SUCCESS = 'VECTOR_DRAW:SAVE_SUCCESS';
export const SAVE_ERROR = 'VECTOR_DRAW:SAVE_ERROR';
export const RESET = 'VECTOR_DRAW:RESET';
export const DESCRIBE_COMPLETE = 'VECTOR_DRAW:DESCRIBE_COMPLETE';
export const SEED_FORM_VALUES = 'VECTOR_DRAW:SEED_FORM_VALUES';
export const LOAD_FEATURE_LIST = 'VECTOR_DRAW:LOAD_FEATURE_LIST';
export const SELECT_EXISTING_FEATURE = 'VECTOR_DRAW:SELECT_EXISTING_FEATURE';
// TASK-784 picker-return — after a save/cancel completes, if the original
// flow entered through the picker, transition back to the picker phase
// (instead of idle) so the user can quickly edit another feature without
// re-clicking the toolbar pencil. The features payload is the refreshed
// list (save path re-fetches WFS) or the existing list (cancel path).
export const RETURN_TO_PICKER = 'VECTOR_DRAW:RETURN_TO_PICKER';

export const startVectorDraw = (config) => ({ type: START_VECTOR_DRAW, config });
export const cancelVectorDraw = () => ({ type: CANCEL_VECTOR_DRAW });
export const drawingComplete = (geometry) => ({ type: DRAWING_COMPLETE, geometry });
export const submitForm = () => ({ type: SUBMIT_FORM });
export const updateFormValues = (fieldName, value) => ({ type: UPDATE_FORM_VALUES, fieldName, value });
export const saveSuccess = (fid) => ({ type: SAVE_SUCCESS, fid });
export const saveError = (error) => ({ type: SAVE_ERROR, error });
export const vectorDrawReset = () => ({ type: RESET });
export const describeComplete = () => ({ type: DESCRIBE_COMPLETE });
export const seedFormValues = (properties) => ({ type: SEED_FORM_VALUES, properties });
export const loadFeatureList = (features) => ({ type: LOAD_FEATURE_LIST, features });
export const selectExistingFeature = (featureId) => ({ type: SELECT_EXISTING_FEATURE, featureId });
export const returnToPicker = (features) => ({ type: RETURN_TO_PICKER, features: features || [] });

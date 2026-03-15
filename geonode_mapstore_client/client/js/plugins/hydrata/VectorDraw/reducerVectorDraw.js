import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    UPDATE_FORM_VALUES,
    SAVE_SUCCESS,
    SAVE_ERROR,
    RESET,
    DESCRIBE_COMPLETE
} from './actionsVectorDraw';

const initialState = {
    phase: 'idle',
    config: null,
    geometry: null,
    formValues: {},
    error: null
};

const buildDefaults = (formConfig) => {
    if (!formConfig || !formConfig.fields) return {};
    const defaults = {};
    formConfig.fields.forEach(field => {
        if (field.default !== undefined) {
            defaults[field.name] = field.default;
        }
    });
    return defaults;
};

export default function vectorDraw(state = initialState, action) {
    switch (action.type) {
    case START_VECTOR_DRAW:
        return {
            ...initialState,
            phase: 'describing',
            config: action.config,
            formValues: buildDefaults(action.config?.formConfig)
        };
    case DESCRIBE_COMPLETE:
        return {
            ...state,
            phase: 'drawing'
        };
    case DRAWING_COMPLETE:
        if (state.config?.formConfig) {
            return { ...state, phase: 'form', geometry: action.geometry };
        }
        return { ...state, phase: 'saving', geometry: action.geometry };
    case SUBMIT_FORM:
        return { ...state, phase: 'saving' };
    case UPDATE_FORM_VALUES:
        return {
            ...state,
            formValues: { ...state.formValues, [action.fieldName]: action.value }
        };
    case SAVE_SUCCESS:
    case RESET:
        return { ...initialState };
    case CANCEL_VECTOR_DRAW:
        // Don't reset here — the cancel epic needs to read config.onCancel
        // before dispatching vectorDrawReset(). Epic handles cleanup.
        return { ...state, phase: 'cancelling' };
    case SAVE_ERROR:
        return { ...state, phase: 'error', error: action.error };
    default:
        return state;
    }
}

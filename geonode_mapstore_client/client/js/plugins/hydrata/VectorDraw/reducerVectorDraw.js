import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    DRAWING_COMPLETE,
    SUBMIT_FORM,
    UPDATE_FORM_VALUES,
    SAVE_SUCCESS,
    SAVE_ERROR,
    RESET,
    DESCRIBE_COMPLETE,
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    SELECT_EXISTING_FEATURE
} from './actionsVectorDraw';

const initialState = {
    phase: 'idle',
    config: null,
    geometry: null,
    formValues: {},
    featureList: [],
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
    case SEED_FORM_VALUES:
        // Overlay defaults with the feature's existing properties.
        // Feature values win over schema defaults; non-form-managed properties
        // pass through so wfstUpdate preserves them on Save.
        return {
            ...state,
            formValues: { ...state.formValues, ...(action.properties || {}) }
        };
    case LOAD_FEATURE_LIST:
        return {
            ...state,
            phase: 'picking',
            featureList: action.features || []
        };
    case SELECT_EXISTING_FEATURE:
        // Transition back to 'describing' and (optionally) merge the chosen
        // featureId into config. featureList is always cleared. The cancel
        // epic / vectorDrawSelectExistingEpic re-enters START_VECTOR_DRAW so
        // the reducer's START handler will rebuild state from initialState
        // anyway, but we keep this defensive in case the flow diverges.
        return {
            ...state,
            phase: 'describing',
            featureList: [],
            config: {
                ...(state.config || {}),
                featureId: action.featureId
            }
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

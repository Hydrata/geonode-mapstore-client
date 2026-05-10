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
    SELECT_EXISTING_FEATURE,
    RETURN_TO_PICKER
} from './actionsVectorDraw';

const initialState = {
    phase: 'idle',
    config: null,
    geometry: null,
    formValues: {},
    featureList: [],
    // TASK-784 picker-return — sticky flag set by LOAD_FEATURE_LIST. Tells
    // the save/cancel epics to dispatch RETURN_TO_PICKER after the in-flight
    // edit/create finishes, instead of falling through to RESET → idle.
    // Persists across SELECT_EXISTING_FEATURE → describing → drawing →
    // form → saving so the post-save handler still knows the user wants to
    // stay in picker mode. Cleared on START_VECTOR_DRAW (new flow) and RESET.
    cameFromPicker: false,
    // TASK-784 close-button — capture the phase that was active when
    // CANCEL_VECTOR_DRAW dispatched. The reducer flips phase to 'cancelling'
    // synchronously, so by the time the cancel epic reads state, the
    // original phase is gone. previousPhase preserves it so the epic can
    // tell "X clicked while in picker (→ exit idle)" from "X clicked while
    // drawing/form (→ return to picker)".
    previousPhase: null,
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
            formValues: buildDefaults(action.config?.formConfig),
            // TASK-784 picker-return — the internal re-dispatch from
            // vectorDrawSelectExistingEpic threads `cameFromPicker` through
            // action.config so it survives the reset to initialState. A
            // brand-new external startVectorDraw from a plugin won't set
            // this, so the flag stays false and behaviour is unchanged.
            cameFromPicker: !!action.config?.cameFromPicker
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
        // First time we render the picker in this flow → mark
        // cameFromPicker so the save/cancel epics know to come back here
        // when the in-flight edit/create finishes.
        return {
            ...state,
            phase: 'picking',
            featureList: action.features || [],
            cameFromPicker: true
        };
    case RETURN_TO_PICKER:
        // Re-enter the picker phase after a save or cancel. The epic supplies
        // the refreshed feature list (save path) or the existing list (cancel
        // path). Drop ephemeral edit state (geometry, featureId, formValues)
        // but keep config so the picker can re-render with the same prefix /
        // formConfig the user originally opened.
        return {
            ...state,
            phase: 'picking',
            featureList: action.features || [],
            geometry: null,
            formValues: buildDefaults(state.config?.formConfig),
            error: null,
            // SELECT_EXISTING_FEATURE may have set state.config.featureId
            // when the user picked a row earlier — strip it so the picker
            // is back to the "no feature chosen yet" state.
            config: state.config
                ? { ...state.config, featureId: undefined, allowPick: true }
                : state.config,
            cameFromPicker: true
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
        // and cameFromPicker before deciding whether to vectorDrawReset()
        // (idle path) or returnToPicker() (in-flow path). Epic handles both.
        // Capture previousPhase so the epic can distinguish picker-X
        // (→ idle) from drawing/form-X (→ return-to-picker). See
        // initialState.previousPhase for the rationale.
        return { ...state, phase: 'cancelling', previousPhase: state.phase };
    case SAVE_ERROR:
        return { ...state, phase: 'error', error: action.error };
    default:
        return state;
    }
}

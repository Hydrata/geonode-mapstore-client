import expect from 'expect';
import reducer from '../reducerVectorDraw';
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
} from '../actionsVectorDraw';

describe('VectorDraw Reducer', () => {
    const initialState = {
        phase: 'idle',
        config: null,
        geometry: null,
        formValues: {},
        error: null
    };

    it('should return initial state', () => {
        const state = reducer(undefined, { type: 'UNKNOWN' });
        expect(state.phase).toBe('idle');
        expect(state.config).toBe(null);
        expect(state.geometry).toBe(null);
    });

    it('should handle START_VECTOR_DRAW', () => {
        const config = { layerName: 'geonode:test', geomType: 'Polygon', formConfig: null };
        const state = reducer(initialState, { type: START_VECTOR_DRAW, config });
        expect(state.phase).toBe('describing');
        expect(state.config).toBe(config);
        expect(state.geometry).toBe(null);
    });

    it('should build default form values from formConfig on START', () => {
        const config = {
            layerName: 'geonode:test',
            formConfig: {
                title: 'Test',
                fields: [
                    { name: 'location', type: 'select', default: 'External' },
                    { name: 'value', type: 'number', default: 42 },
                    { name: 'notes', type: 'text' }
                ]
            }
        };
        const state = reducer(initialState, { type: START_VECTOR_DRAW, config });
        expect(state.formValues).toEqual({ location: 'External', value: 42 });
    });

    it('should handle DESCRIBE_COMPLETE', () => {
        const prev = { ...initialState, phase: 'describing', config: {} };
        const state = reducer(prev, { type: DESCRIBE_COMPLETE });
        expect(state.phase).toBe('drawing');
    });

    it('should handle DRAWING_COMPLETE without formConfig → saving', () => {
        const prev = { ...initialState, phase: 'drawing', config: { formConfig: null } };
        const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
        const state = reducer(prev, { type: DRAWING_COMPLETE, geometry });
        expect(state.phase).toBe('saving');
        expect(state.geometry).toBe(geometry);
    });

    it('should handle DRAWING_COMPLETE with formConfig → form', () => {
        const prev = {
            ...initialState,
            phase: 'drawing',
            config: { formConfig: { title: 'Test', fields: [] } }
        };
        const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
        const state = reducer(prev, { type: DRAWING_COMPLETE, geometry });
        expect(state.phase).toBe('form');
        expect(state.geometry).toBe(geometry);
    });

    it('should handle SUBMIT_FORM → saving', () => {
        const prev = { ...initialState, phase: 'form', geometry: {}, formValues: { a: 1 } };
        const state = reducer(prev, { type: SUBMIT_FORM });
        expect(state.phase).toBe('saving');
    });

    it('should handle UPDATE_FORM_VALUES', () => {
        const prev = { ...initialState, formValues: { a: 1 } };
        const state = reducer(prev, { type: UPDATE_FORM_VALUES, fieldName: 'b', value: 2 });
        expect(state.formValues).toEqual({ a: 1, b: 2 });
    });

    it('should handle SAVE_SUCCESS → reset to initial', () => {
        const prev = { ...initialState, phase: 'saving', geometry: {}, config: {} };
        const state = reducer(prev, { type: SAVE_SUCCESS });
        expect(state.phase).toBe('idle');
        expect(state.config).toBe(null);
    });

    it('should handle SAVE_ERROR', () => {
        const prev = { ...initialState, phase: 'saving' };
        const state = reducer(prev, { type: SAVE_ERROR, error: 'Network error' });
        expect(state.phase).toBe('error');
        expect(state.error).toBe('Network error');
    });

    it('should handle CANCEL_VECTOR_DRAW → cancelling (preserves config for epic)', () => {
        const config = { layerName: 'test', onCancel: 'TEST:CANCEL' };
        const prev = { ...initialState, phase: 'drawing', config };
        const state = reducer(prev, { type: CANCEL_VECTOR_DRAW });
        expect(state.phase).toBe('cancelling');
        expect(state.config).toBe(config);
    });

    it('should handle RESET → reset to initial', () => {
        const prev = { ...initialState, phase: 'error', error: 'some error' };
        const state = reducer(prev, { type: RESET });
        expect(state.phase).toBe('idle');
        expect(state.error).toBe(null);
    });
});

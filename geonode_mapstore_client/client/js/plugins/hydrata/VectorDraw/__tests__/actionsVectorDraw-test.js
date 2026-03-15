import expect from 'expect';
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
    startVectorDraw,
    cancelVectorDraw,
    drawingComplete,
    submitForm,
    updateFormValues,
    saveSuccess,
    saveError,
    vectorDrawReset,
    describeComplete
} from '../actionsVectorDraw';

describe('VectorDraw Actions', () => {
    it('startVectorDraw should create correct action', () => {
        const config = { layerName: 'geonode:test', geomType: 'Polygon' };
        const action = startVectorDraw(config);
        expect(action.type).toBe(START_VECTOR_DRAW);
        expect(action.config).toBe(config);
    });

    it('cancelVectorDraw should create correct action', () => {
        const action = cancelVectorDraw();
        expect(action.type).toBe(CANCEL_VECTOR_DRAW);
    });

    it('drawingComplete should include geometry', () => {
        const geometry = { type: 'Point', coordinates: [0, 0] };
        const action = drawingComplete(geometry);
        expect(action.type).toBe(DRAWING_COMPLETE);
        expect(action.geometry).toBe(geometry);
    });

    it('submitForm should create correct action', () => {
        const action = submitForm();
        expect(action.type).toBe(SUBMIT_FORM);
    });

    it('updateFormValues should include field name and value', () => {
        const action = updateFormValues('location', 'External');
        expect(action.type).toBe(UPDATE_FORM_VALUES);
        expect(action.fieldName).toBe('location');
        expect(action.value).toBe('External');
    });

    it('saveSuccess should include fid', () => {
        const action = saveSuccess('layer.42');
        expect(action.type).toBe(SAVE_SUCCESS);
        expect(action.fid).toBe('layer.42');
    });

    it('saveError should include error', () => {
        const action = saveError('Network error');
        expect(action.type).toBe(SAVE_ERROR);
        expect(action.error).toBe('Network error');
    });

    it('vectorDrawReset should create correct action', () => {
        const action = vectorDrawReset();
        expect(action.type).toBe(RESET);
    });

    it('describeComplete should create correct action', () => {
        const action = describeComplete();
        expect(action.type).toBe(DESCRIBE_COMPLETE);
    });
});

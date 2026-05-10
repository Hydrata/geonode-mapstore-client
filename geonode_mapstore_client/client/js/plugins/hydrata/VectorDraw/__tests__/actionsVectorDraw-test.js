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
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    SELECT_EXISTING_FEATURE,
    RETURN_TO_PICKER,
    DELETE_FEATURE,
    startVectorDraw,
    cancelVectorDraw,
    drawingComplete,
    submitForm,
    updateFormValues,
    saveSuccess,
    saveError,
    vectorDrawReset,
    describeComplete,
    seedFormValues,
    loadFeatureList,
    selectExistingFeature,
    returnToPicker,
    deleteFeature
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

    it('seedFormValues should include feature properties', () => {
        const properties = { name: 'A', value: 42 };
        const action = seedFormValues(properties);
        expect(action.type).toBe(SEED_FORM_VALUES);
        expect(action.properties).toBe(properties);
    });

    it('loadFeatureList should include features array', () => {
        const features = [{ id: 'l.1' }, { id: 'l.2' }];
        const action = loadFeatureList(features);
        expect(action.type).toBe(LOAD_FEATURE_LIST);
        expect(action.features).toBe(features);
    });

    it('selectExistingFeature should include featureId', () => {
        const action = selectExistingFeature('l.42');
        expect(action.type).toBe(SELECT_EXISTING_FEATURE);
        expect(action.featureId).toBe('l.42');
    });

    it('selectExistingFeature(null) should signal create-path', () => {
        const action = selectExistingFeature(null);
        expect(action.type).toBe(SELECT_EXISTING_FEATURE);
        expect(action.featureId).toBe(null);
    });

    it('returnToPicker should include features array', () => {
        const features = [{ id: 'l.1' }];
        const action = returnToPicker(features);
        expect(action.type).toBe(RETURN_TO_PICKER);
        expect(action.features).toEqual(features);
    });

    it('returnToPicker with no arg defaults to empty array', () => {
        const action = returnToPicker();
        expect(action.type).toBe(RETURN_TO_PICKER);
        expect(action.features).toEqual([]);
    });

    it('deleteFeature should include featureId', () => {
        const action = deleteFeature('pkr.42');
        expect(action.type).toBe(DELETE_FEATURE);
        expect(action.featureId).toBe('pkr.42');
    });
});

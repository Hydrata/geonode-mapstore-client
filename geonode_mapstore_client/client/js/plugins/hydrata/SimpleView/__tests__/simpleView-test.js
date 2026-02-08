import expect from 'expect';
import reducer from '../reducersSimpleView';
import {
    SET_OPEN_MENU_GROUP_ID,
    SET_VISIBLE_LEGEND_PANEL,
    SET_VISIBLE_INTRODUCTION,
    SET_VISIBLE_UPLOADER_PANEL,
    SET_VISIBLE_SV_ATTRIBUTE_FORM,
    SET_VISIBLE_SV_ATTRIBUTE_RESULT,
    SET_SV_ATTRIBUTE_RESULT,
    UPDATE_UPLOAD_STATUS,
    SV_SELECT_LAYER,
    SET_SV_CONFIG,
    CREATE_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SET_PROCESSING_SV_ATTRIBUTE_FORM,
    setOpenMenuGroupId,
    setVisibleLegendPanel,
    setVisibleIntroduction,
    setVisibleUploaderPanel,
    setVisibleSimpleViewAttributeForm,
    setVisibleSimpleViewAttributeResult,
    setSimpleViewAttributeResult,
    updateUploadStatus,
    svSelectLayer,
    setSvConfig,
    createSimpleViewAttributeForm,
    setProcessingSimpleViewAttributeForm
} from '../actionsSimpleView';

describe('SimpleView Plugin', () => {
    describe('Action Creators', () => {
        it('setOpenMenuGroupId creates correct action', () => {
            const action = setOpenMenuGroupId('group1');
            expect(action.type).toBe(SET_OPEN_MENU_GROUP_ID);
            expect(action.openMenuGroupId).toBe('group1');
        });

        it('setVisibleLegendPanel creates correct action', () => {
            const action = setVisibleLegendPanel(true);
            expect(action.type).toBe(SET_VISIBLE_LEGEND_PANEL);
            expect(action.visible).toBe(true);
        });

        it('setVisibleIntroduction creates correct action', () => {
            const action = setVisibleIntroduction(true);
            expect(action.type).toBe(SET_VISIBLE_INTRODUCTION);
            expect(action.visible).toBe(true);
        });

        it('setVisibleUploaderPanel creates correct action', () => {
            const action = setVisibleUploaderPanel(true, 'configKey', 123);
            expect(action.type).toBe(SET_VISIBLE_UPLOADER_PANEL);
            expect(action.visible).toBe(true);
            expect(action.importerConfigKey).toBe('configKey');
            expect(action.importerTargetObjectId).toBe(123);
        });

        it('setVisibleSimpleViewAttributeForm creates correct action', () => {
            const action = setVisibleSimpleViewAttributeForm(true);
            expect(action.type).toBe(SET_VISIBLE_SV_ATTRIBUTE_FORM);
            expect(action.visible).toBe(true);
        });

        it('setVisibleSimpleViewAttributeResult creates correct action', () => {
            const action = setVisibleSimpleViewAttributeResult(true);
            expect(action.type).toBe(SET_VISIBLE_SV_ATTRIBUTE_RESULT);
            expect(action.visible).toBe(true);
        });

        it('setSimpleViewAttributeResult creates correct action', () => {
            const data = { result: 'success' };
            const action = setSimpleViewAttributeResult(data);
            expect(action.type).toBe(SET_SV_ATTRIBUTE_RESULT);
            expect(action.data).toEqual(data);
        });

        it('updateUploadStatus creates correct action', () => {
            const action = updateUploadStatus('uploading');
            expect(action.type).toBe(UPDATE_UPLOAD_STATUS);
            expect(action.status).toBe('uploading');
        });

        it('svSelectLayer creates correct action', () => {
            const layer = { id: 1, name: 'Test Layer' };
            const action = svSelectLayer(layer);
            expect(action.type).toBe(SV_SELECT_LAYER);
            expect(action.layer).toEqual(layer);
        });

        it('setSvConfig creates correct action', () => {
            const config = { theme: 'dark' };
            const action = setSvConfig(config);
            expect(action.type).toBe(SET_SV_CONFIG);
            expect(action.config).toEqual(config);
        });

        it('createSimpleViewAttributeForm creates correct action', () => {
            const data = {
                form: { field1: { value: '' } },
                importer_session_id: 'session123',
                submitUrl: '/api/submit'
            };
            const action = createSimpleViewAttributeForm(data);
            expect(action.type).toBe(CREATE_SV_ATTRIBUTE_FORM);
            expect(action.form).toEqual(data.form);
            expect(action.simpleViewImporterSessionId).toBe('session123');
            expect(action.submitUrl).toBe('/api/submit');
        });

        it('setProcessingSimpleViewAttributeForm creates correct action', () => {
            const action = setProcessingSimpleViewAttributeForm(true);
            expect(action.type).toBe(SET_PROCESSING_SV_ATTRIBUTE_FORM);
            expect(action.processing).toBe(true);
        });
    });

    describe('Reducer', () => {
        const initialState = {};

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should handle SET_PROCESSING_SV_ATTRIBUTE_FORM', () => {
            const state = reducer(initialState, {
                type: SET_PROCESSING_SV_ATTRIBUTE_FORM,
                processing: true
            });
            expect(state.processingSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SET_SV_CONFIG', () => {
            const config = { theme: 'dark', mode: 'simple' };
            const state = reducer(initialState, {
                type: SET_SV_CONFIG,
                config: config
            });
            expect(state.config).toEqual(config);
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - set new group', () => {
            const state = reducer(initialState, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group1'
            });
            expect(state.openMenuGroupId).toBe('group1');
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - toggle off same group', () => {
            const stateWithGroup = { ...initialState, openMenuGroupId: 'group1' };
            const state = reducer(stateWithGroup, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group1'
            });
            expect(state.openMenuGroupId).toBe(null);
        });

        it('should handle SET_OPEN_MENU_GROUP_ID - switch groups', () => {
            const stateWithGroup = { ...initialState, openMenuGroupId: 'group1' };
            const state = reducer(stateWithGroup, {
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'group2'
            });
            expect(state.openMenuGroupId).toBe('group2');
        });

        it('should handle SET_VISIBLE_LEGEND_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_LEGEND_PANEL,
                visible: true
            });
            expect(state.visibleLegendPanel).toBe(true);
        });

        it('should handle SET_VISIBLE_INTRODUCTION', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_INTRODUCTION,
                visible: true
            });
            expect(state.visibleIntroduction).toBe(true);
        });

        it('should handle SET_VISIBLE_SV_ATTRIBUTE_FORM', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_SV_ATTRIBUTE_FORM,
                visible: true
            });
            expect(state.visibleSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SET_VISIBLE_SV_ATTRIBUTE_RESULT', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_SV_ATTRIBUTE_RESULT,
                visible: true
            });
            expect(state.visibleSimpleViewAttributeResult).toBe(true);
        });

        it('should handle SET_SV_ATTRIBUTE_RESULT', () => {
            const data = { result: 'success', value: 42 };
            const state = reducer(initialState, {
                type: SET_SV_ATTRIBUTE_RESULT,
                data: data
            });
            expect(state.simpleViewAttributeResult).toEqual(data);
        });

        it('should handle CREATE_SV_ATTRIBUTE_FORM', () => {
            const form = { field1: { value: 'test' } };
            const state = reducer(initialState, {
                type: CREATE_SV_ATTRIBUTE_FORM,
                form: form,
                simpleViewImporterSessionId: 'session123',
                submitUrl: '/api/submit'
            });
            expect(state.simpleViewAttributeForm).toEqual(form);
            expect(state.simpleViewImporterSessionId).toBe('session123');
            expect(state.submitUrl).toBe('/api/submit');
            expect(state.visibleSimpleViewAttributeForm).toBe(true);
        });

        it('should handle SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS', () => {
            const state = reducer(initialState, {
                type: SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
                data: { importer_session_id: 'newSession' }
            });
            expect(state.simpleViewImporterSessionId).toBe('newSession');
        });

        it('should handle SET_VISIBLE_UPLOADER_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_UPLOADER_PANEL,
                visible: true,
                importerConfigKey: 'configKey',
                importerTargetObjectId: 123
            });
            expect(state.visibleUploaderPanel).toBe(true);
            expect(state.importerConfigKey).toBe('configKey');
            expect(state.importerTargetObjectId).toBe(123);
        });

        it('should handle UPDATE_UPLOAD_STATUS', () => {
            const state = reducer(initialState, {
                type: UPDATE_UPLOAD_STATUS,
                status: 'complete'
            });
            expect(state.uploadStatus).toBe('complete');
        });

        it('should handle SV_SELECT_LAYER', () => {
            const layer = { id: 1, name: 'Test Layer' };
            const state = reducer(initialState, {
                type: SV_SELECT_LAYER,
                layer: layer
            });
            expect(state.selectedLayer).toEqual(layer);
        });
    });
});

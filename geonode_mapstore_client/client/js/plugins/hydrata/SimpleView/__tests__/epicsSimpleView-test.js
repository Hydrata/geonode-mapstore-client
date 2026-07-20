/**
 * TASK-1230 (2290 W-test-coverage) — smoke coverage for epicsSimpleView.js
 * (zero prior coverage). One happy-path + one unrelated-action guard per
 * epic: updateDatasetTitleEpic, beginEditLayerEpic, submitAttributeFormEpic,
 * svDownloadLayerEpic.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    updateDatasetTitleEpic,
    beginEditLayerEpic,
    submitAttributeFormEpic,
    svDownloadLayerEpic
} from '../epicsSimpleView';
import {
    UPDATE_DATASET_TITLE,
    UPDATE_DATASET_TITLE_SUCCESS,
    SUBMIT_SV_ATTRIBUTE_FORM,
    SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS,
    SV_DOWNLOAD_LAYER
} from '../actionsSimpleView';
import { GRID_QUERY_RESULT, toggleEditMode } from '../../../../../MapStore2/web/client/actions/featuregrid';
import { TM_TERRAIN_EXPORT, terrainExport } from '../../TaskMonitor/actionsTaskMonitor';

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('TASK-1230 epicsSimpleView', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('updateDatasetTitleEpic: GET+PATCH succeed -> emits UPDATE_DATASET_TITLE_SUCCESS', (done) => {
        mockAxios.onGet(/\/api\/v2\/datasets\?search=/).reply(200, {
            datasets: [{ pk: 9 }]
        });
        mockAxios.onPatch('/api/v2/datasets/9/').reply(200, { title: 'New Title' });

        const action$ = mockActions([{
            type: UPDATE_DATASET_TITLE,
            datasetName: 'geonode:my_layer',
            newTitle: 'New Title'
        }]);
        const emitted = [];

        updateDatasetTitleEpic(action$)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(UPDATE_DATASET_TITLE_SUCCESS);
                done();
            });
    });

    it('updateDatasetTitleEpic only listens for UPDATE_DATASET_TITLE action type', (done) => {
        const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
        const emitted = [];

        updateDatasetTitleEpic(action$)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('beginEditLayerEpic: GRID_QUERY_RESULT -> emits toggleEditMode (FEATUREGRID:TOGGLE_MODE/EDIT)', (done) => {
        const action$ = mockActions([{ type: GRID_QUERY_RESULT }]);
        const emitted = [];

        beginEditLayerEpic(action$)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0]).toEqual(toggleEditMode());
                done();
            });
    });

    it('beginEditLayerEpic only listens for GRID_QUERY_RESULT action type', (done) => {
        const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
        const emitted = [];

        beginEditLayerEpic(action$)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('submitAttributeFormEpic: POST to store.simpleView.submitUrl succeeds (no submitUrl in response) -> emits SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS', (done) => {
        const store = { getState: () => ({ simpleView: { submitUrl: '/api/v2/uploads/upload/42/' } }) };
        mockAxios.onPost('/api/v2/uploads/upload/42/').reply(200, { status: 'ok' });

        const action$ = mockActions([{
            type: SUBMIT_SV_ATTRIBUTE_FORM,
            form: { field: 'value' },
            projectId: 7,
            simpleViewImporterSessionId: 'sess-1'
        }]);
        const emitted = [];

        submitAttributeFormEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS);
                expect(emitted[0].data).toEqual({ status: 'ok' });
                done();
            });
    });

    it('submitAttributeFormEpic only listens for SUBMIT_SV_ATTRIBUTE_FORM action type', (done) => {
        const store = { getState: () => ({ simpleView: {} }) };
        const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
        const emitted = [];

        submitAttributeFormEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('svDownloadLayerEpic: terrain layer resolves via store -> emits terrainExport (TM_TERRAIN_EXPORT)', (done) => {
        const store = {
            getState: () => ({
                anuga: {
                    projects: { data: { id: 55 } },
                    resources: { terrain: [{ id: 3, gn_layer_name: 'dem_layer', title: 'DEM Title' }] }
                }
            })
        };
        const action$ = mockActions([{
            type: SV_DOWNLOAD_LAYER,
            layer: { id: 'l1', name: 'dem_layer', group: 'Input Data.Terrain' }
        }]);
        const emitted = [];

        svDownloadLayerEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(TM_TERRAIN_EXPORT);
                expect(emitted[0]).toEqual(terrainExport(55, 3, 'DEM Title'));
                done();
            });
    });

    it('svDownloadLayerEpic only listens for SV_DOWNLOAD_LAYER action type', (done) => {
        const store = { getState: () => ({}) };
        const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
        const emitted = [];

        svDownloadLayerEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });
});

/**
 * TASK-1230 (2290 W-test-coverage) — smoke coverage for epicsSimpleView.js
 * (zero prior coverage). One happy-path + one unrelated-action guard.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { updateDatasetTitleEpic } from '../epicsSimpleView';
import { UPDATE_DATASET_TITLE, UPDATE_DATASET_TITLE_SUCCESS } from '../actionsSimpleView';

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
});

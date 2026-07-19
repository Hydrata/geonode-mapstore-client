/**
 * TASK-1230 (2290 W-test-coverage) — smoke coverage for createTerrainFromBboxEpic
 * (terrainBboxEpic.js). Happy-path 202 create + an unrelated-action guard.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { createTerrainFromBboxEpic } from '../epics/terrainBboxEpic';
import { CREATE_TERRAIN_FROM_BBOX, CREATE_TERRAIN_FROM_BBOX_SUCCESS } from '../actionsAnuga';

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

const storeWithProjectId = (id) => ({
    getState: () => ({ anuga: { projects: { data: { id } } } })
});

describe('TASK-1230 createTerrainFromBboxEpic', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('202 -> dispatches CREATE_TERRAIN_FROM_BBOX_SUCCESS', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/7/terrain/create-from-bbox/').reply(202, {
            id: 55, title: 'GLO-30 extract'
        });

        const action$ = mockActions([{
            type: CREATE_TERRAIN_FROM_BBOX,
            title: 'GLO-30 extract',
            bbox: [151.0, -33.5, 151.5, -33.0]
        }]);
        const emitted = [];

        createTerrainFromBboxEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                const success = emitted.find(a => a.type === CREATE_TERRAIN_FROM_BBOX_SUCCESS);
                expect(success).toExist();
                expect(success.data.id).toBe(55);
                done();
            });
    });

    it('only listens for CREATE_TERRAIN_FROM_BBOX action type', (done) => {
        const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
        const emitted = [];

        createTerrainFromBboxEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });
});

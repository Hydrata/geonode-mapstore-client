/**
 * TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic,
    __resetComputeMeterInitForTests
} from '../epics/computeMeterEpics';
import {INIT_ANUGA} from '../actionsAnuga';
import {FETCH_COMPUTE_BALANCE, SET_COMPUTE_BALANCE} from '../../Paywall/meter/actions';

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

describe('TASK-2100 computeMeterEpics', () => {
    beforeEach(() => { __resetComputeMeterInitForTests(); });

    describe('triggerFetchBalanceOnInitEpic', () => {
        it('emits FETCH_COMPUTE_BALANCE on the first INIT_ANUGA', (done) => {
            const action$ = mockActions([{type: INIT_ANUGA}]);
            const emitted = [];
            triggerFetchBalanceOnInitEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(FETCH_COMPUTE_BALANCE);
                    done();
                });
        });

        it('a second INIT_ANUGA in the same session is deduped', (done) => {
            const action$ = mockActions([{type: INIT_ANUGA}, {type: INIT_ANUGA}]);
            const emitted = [];
            triggerFetchBalanceOnInitEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    done();
                });
        });
    });

    describe('fetchComputeBalanceEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('GET /commerce/balance/ -> SET_COMPUTE_BALANCE with the response body', (done) => {
            const payload = {enabled: true, balance: '10.00', available_packs: [], recent_entries: []};
            mockAxios.onGet('/commerce/balance/').reply(200, payload);

            const action$ = mockActions([{type: FETCH_COMPUTE_BALANCE}]);
            const emitted = [];

            fetchComputeBalanceEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_COMPUTE_BALANCE);
                    expect(emitted[0].data).toEqual(payload);
                    done();
                });
        });

        it('a failed fetch (e.g. anon 401) is swallowed — panel just stays dark, no crash', (done) => {
            mockAxios.onGet('/commerce/balance/').reply(401);

            const action$ = mockActions([{type: FETCH_COMPUTE_BALANCE}]);
            const emitted = [];

            fetchComputeBalanceEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });
    });
});

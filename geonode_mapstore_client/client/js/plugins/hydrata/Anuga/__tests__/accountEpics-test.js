/**
 * TASK-2420 (epic 2359 W4.5) — Account panel fetch/portal epics.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    triggerFetchAccountSummaryOnInitEpic,
    triggerFetchAccountSummaryOnBillingTabOpenEpic,
    fetchAccountSummaryEpic,
    requestBillingPortalEpic,
    __resetAccountSummaryInitForTests,
    __setRedirectForTests
} from '../epics/accountEpics';
import { INIT_ANUGA, SET_MEMBERSHIP_PANEL_TAB } from '../actionsAnuga';
import { FETCH_ACCOUNT_SUMMARY, SET_ACCOUNT_SUMMARY, REQUEST_BILLING_PORTAL, SET_BILLING_PORTAL_ERROR } from '../../Paywall/account/actions';

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

describe('TASK-2420 accountEpics', () => {
    beforeEach(() => { __resetAccountSummaryInitForTests(); });
    afterEach(() => { __setRedirectForTests(null); });

    describe('triggerFetchAccountSummaryOnInitEpic', () => {
        it('emits FETCH_ACCOUNT_SUMMARY on the first INIT_ANUGA', (done) => {
            const action$ = mockActions([{ type: INIT_ANUGA }]);
            const emitted = [];
            triggerFetchAccountSummaryOnInitEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(FETCH_ACCOUNT_SUMMARY);
                    done();
                });
        });

        it('a second INIT_ANUGA in the same session is deduped', (done) => {
            const action$ = mockActions([{ type: INIT_ANUGA }, { type: INIT_ANUGA }]);
            const emitted = [];
            triggerFetchAccountSummaryOnInitEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    done();
                });
        });
    });

    describe('triggerFetchAccountSummaryOnBillingTabOpenEpic', () => {
        it('emits FETCH_ACCOUNT_SUMMARY when the Billing tab opens', (done) => {
            const action$ = mockActions([{ type: SET_MEMBERSHIP_PANEL_TAB, tab: 'billing' }]);
            const emitted = [];
            triggerFetchAccountSummaryOnBillingTabOpenEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(FETCH_ACCOUNT_SUMMARY);
                    done();
                });
        });

        it('does NOT fire for the Sharing tab', (done) => {
            const action$ = mockActions([{ type: SET_MEMBERSHIP_PANEL_TAB, tab: 'sharing' }]);
            const emitted = [];
            triggerFetchAccountSummaryOnBillingTabOpenEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('refetches on EVERY open (not deduped) — panel must never show a stale balance', (done) => {
            const action$ = mockActions([
                { type: SET_MEMBERSHIP_PANEL_TAB, tab: 'billing' },
                { type: SET_MEMBERSHIP_PANEL_TAB, tab: 'sharing' },
                { type: SET_MEMBERSHIP_PANEL_TAB, tab: 'billing' }
            ]);
            const emitted = [];
            triggerFetchAccountSummaryOnBillingTabOpenEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(2);
                    done();
                });
        });
    });

    describe('fetchAccountSummaryEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('GET /commerce/account/ -> SET_ACCOUNT_SUMMARY with the response body', (done) => {
            const payload = { organisation: 'Acme', is_manager: true, balance: '5.00' };
            mockAxios.onGet('/commerce/account/').reply(200, payload);

            const action$ = mockActions([{ type: FETCH_ACCOUNT_SUMMARY }]);
            const emitted = [];
            fetchAccountSummaryEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_ACCOUNT_SUMMARY);
                    expect(emitted[0].data).toEqual(payload);
                    done();
                });
        });

        it('a failed fetch is swallowed — no crash', (done) => {
            mockAxios.onGet('/commerce/account/').reply(401);
            const action$ = mockActions([{ type: FETCH_ACCOUNT_SUMMARY }]);
            const emitted = [];
            fetchAccountSummaryEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });
    });

    describe('requestBillingPortalEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('POST /commerce/billing-portal/ success -> redirects to the returned url, emits nothing', (done) => {
            mockAxios.onPost('/commerce/billing-portal/').reply(200, { url: 'https://billing.stripe.com/p/session/test_x' });
            let redirectedTo = null;
            __setRedirectForTests((url) => { redirectedTo = url; });

            const action$ = mockActions([{ type: REQUEST_BILLING_PORTAL }]);
            const emitted = [];
            requestBillingPortalEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    expect(redirectedTo).toBe('https://billing.stripe.com/p/session/test_x');
                    done();
                });
        });

        it('a 403 (non-manager) -> SET_BILLING_PORTAL_ERROR with the server detail', (done) => {
            mockAxios.onPost('/commerce/billing-portal/').reply(403, { detail: 'Only the account manager can manage billing.' });

            const action$ = mockActions([{ type: REQUEST_BILLING_PORTAL }]);
            const emitted = [];
            requestBillingPortalEpic(action$)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_BILLING_PORTAL_ERROR);
                    expect(emitted[0].detail).toBe('Only the account manager can manage billing.');
                    done();
                });
        });
    });
});

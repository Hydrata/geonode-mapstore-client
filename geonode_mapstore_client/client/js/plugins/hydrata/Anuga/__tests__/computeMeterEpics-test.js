/**
 * TASK-2100 (epic 2092 W4.2) — compute-meter balance-fetch epics.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic,
    refetchBalanceOnAccountSummaryEpic,
    __resetComputeMeterInitForTests
} from '../epics/computeMeterEpics';
import {INIT_ANUGA} from '../actionsAnuga';
import {FETCH_COMPUTE_BALANCE, SET_COMPUTE_BALANCE} from '../../Paywall/meter/actions';
import {SET_ACCOUNT_SUMMARY} from '../../Paywall/account/actions';

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

        // ── TASK-2513 (epic 2425 W3d): the boot fetch retries ONCE ───────────
        //
        // triggerFetchBalanceOnInitEpic is once per session and this epic caught
        // every error to Observable.empty(), so ONE transient failure left
        // state.anuga.computeMeter at initialState for the rest of the session
        // with no retry and no user-visible sign. The consumers of a dark slice
        // are not cosmetic: ComputeMeterPanel uses `enabled` as a hard
        // render-null kill-switch, so all three refusal modals render NOTHING
        // and a 402 refusal becomes a silently dead Run button.
        it('a 500 is retried exactly once, and the retry is a REAL second request', (done) => {
            const payload = {enabled: true, balance: '10.00', available_packs: [], recent_entries: []};
            mockAxios.onGet('/commerce/balance/').replyOnce(500);
            mockAxios.onGet('/commerce/balance/').reply(200, payload);

            const emitted = [];
            fetchComputeBalanceEpic(mockActions([{type: FETCH_COMPUTE_BALANCE}]))
                .subscribe(a => emitted.push(a), done, () => {
                    try {
                        // THE ASSERTION IS A REQUEST COUNT, NOT AN EMISSION COUNT.
                        // `.retry(1)` on Rx.Observable.from(anugaApi.getComputeBalance())
                        // re-subscribes to an ALREADY-SETTLED promise: it re-emits
                        // the same rejection without issuing a second HTTP request,
                        // so an emission count would pass a no-op fix. The call has
                        // to be inside Rx.Observable.defer(...).
                        expect(mockAxios.history.get.length).toBe(
                            2,
                            'the retry re-subscribed to a settled promise instead of '
                            + 'issuing a second request — the fix is a no-op'
                        );
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_COMPUTE_BALANCE);
                        expect(emitted[0].data).toEqual(payload);
                        done();
                    } catch (err) { done(err); }
                });
        });

        // The one existing green test this change comes closest to inverting.
        // Without this sibling, "retries once" would silently DOUBLE the request
        // count for every logged-out visitor on a public map.
        it('a 401 is NOT retried — the anonymous viewer costs exactly one request', (done) => {
            mockAxios.onGet('/commerce/balance/').reply(401);
            fetchComputeBalanceEpic(mockActions([{type: FETCH_COMPUTE_BALANCE}]))
                .subscribe(() => {}, done, () => {
                    try {
                        expect(mockAxios.history.get.length).toBe(
                            1,
                            'an auth failure was retried — every anonymous visitor on a '
                            + 'public map now costs two requests instead of one'
                        );
                        done();
                    } catch (err) { done(err); }
                });
        });

        it('a 403 is NOT retried either', (done) => {
            mockAxios.onGet('/commerce/balance/').reply(403);
            fetchComputeBalanceEpic(mockActions([{type: FETCH_COMPUTE_BALANCE}]))
                .subscribe(() => {}, done, () => {
                    try {
                        expect(mockAxios.history.get.length).toBe(1);
                        done();
                    } catch (err) { done(err); }
                });
        });

        it('a doubly-failed fetch is still swallowed — dark panel, no crash', (done) => {
            mockAxios.onGet('/commerce/balance/').reply(500);
            const emitted = [];
            fetchComputeBalanceEpic(mockActions([{type: FETCH_COMPUTE_BALANCE}]))
                .subscribe(a => emitted.push(a), done, () => {
                    try {
                        expect(emitted.length).toBe(0);
                        expect(mockAxios.history.get.length).toBe(2);
                        done();
                    } catch (err) { done(err); }
                });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TASK-2513 (epic 2425 W3d) — the SECOND TRIGGER.
    //
    // The only other non-test dispatchers of fetchComputeBalance() are
    // accountEpics.js's window-focus epic (gated on accountSummary.loaded, so it
    // needs a real blur/focus round trip) and paywallEpics.js's poll tick (only
    // while a checkout is pending). So a boot-time miss is permanent for the
    // session unless something re-reads the balance when the account summary
    // reports a live account the meter slice has never seen.
    // ─────────────────────────────────────────────────────────────────────────
    describe('refetchBalanceOnAccountSummaryEpic', () => {
        const liveSummary = () => ({
            type: SET_ACCOUNT_SUMMARY,
            // account_views.py always sends `manager` on the live branch; the
            // dark branch returns {'enabled': False} and sends none. Read off the
            // ACTION, not the store, so this cannot depend on reducer-vs-epic
            // ordering.
            data: {manager: 'someone', is_personal: true, balance: '0.00'}
        });
        const storeWithMeter = (computeMeter) => ({
            getState: () => ({anuga: {computeMeter}})
        });

        // ── THE RED ONE ──────────────────────────────────────────────────────
        it('a live account summary refetches a NEVER-OBSERVED balance', (done) => {
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(
                mockActions([liveSummary()]),
                storeWithMeter({loaded: false, enabled: false, balance: null})
            ).subscribe(a => emitted.push(a), done, () => {
                try {
                    expect(emitted.length).toBe(
                        1,
                        'a transient failure of the boot fetch left the meter slice dark '
                        + 'for the whole session — every refusal modal renders null'
                    );
                    expect(emitted[0].type).toBe(FETCH_COMPUTE_BALANCE);
                    done();
                } catch (err) { done(err); }
            });
        });

        it('a DARK meter that has answered is NOT refetched', (done) => {
            // balance_views.py _dark_response reduces to the SAME
            // {enabled: false, balance: null} as initialState — which is exactly
            // why `balance === null` cannot be the trigger. Three of the four prod
            // sites ship COMPUTE_METER_ENABLED off, so a literal null-balance rule
            // would fetch on every summary for the life of every dark session.
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(
                mockActions([liveSummary()]),
                storeWithMeter({loaded: true, enabled: false, balance: null})
            ).subscribe(a => emitted.push(a), done, () => {
                try {
                    expect(emitted.length).toBe(
                        0,
                        'a genuinely dark meter is being refetched on every account '
                        + 'summary — that is most of the fleet'
                    );
                    done();
                } catch (err) { done(err); }
            });
        });

        it('the NO-ACCOUNT-AT-BOOT shape is deliberately NOT refetched', (done) => {
            // balance_views.py's resolve-only no-account response: enabled true,
            // balance null. No live consumer misbehaves on it —
            // ComputeMeterContainer reads only `enabled` (TASK-2435 dropped
            // `balance`), the Billing tab's figure is the ACCOUNT slice, and
            // recentEntries: [] is a correct reading of an empty ledger. Pinned so
            // a later worker cannot "helpfully" reintroduce a per-summary fetch.
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(
                mockActions([liveSummary()]),
                storeWithMeter({loaded: true, enabled: true, balance: null})
            ).subscribe(a => emitted.push(a), done, () => {
                try {
                    expect(emitted.length).toBe(0);
                    done();
                } catch (err) { done(err); }
            });
        });

        it('a DARK account body (no manager) triggers nothing, even unobserved', (done) => {
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(
                mockActions([{type: SET_ACCOUNT_SUMMARY, data: {enabled: false}}]),
                storeWithMeter({loaded: false, enabled: false, balance: null})
            ).subscribe(a => emitted.push(a), done, () => {
                try {
                    expect(emitted.length).toBe(0);
                    done();
                } catch (err) { done(err); }
            });
        });

        it('N successive summaries against an OBSERVED meter emit nothing', (done) => {
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(
                mockActions([liveSummary(), liveSummary(), liveSummary()]),
                storeWithMeter({loaded: true, enabled: true, balance: '5.00'})
            ).subscribe(a => emitted.push(a), done, () => {
                try {
                    expect(emitted.length).toBe(0);
                    done();
                } catch (err) { done(err); }
            });
        });

        it('`loaded` is the SOLE gate — one emission across two summaries, no once-guard', (done) => {
            // A module-level once-guard mirroring _initialFetchHandled would be
            // wrong: Anuga.js registers the balance epic and this one separately
            // and response order is not guaranteed, so a summary landing first
            // would burn the guard and permanently disable the only repair path.
            // `loaded` self-clears on ANY response, including a dark one, which
            // bounds this without a guard.
            let loaded = false;
            const store = {getState: () => ({anuga: {computeMeter: {loaded, enabled: false, balance: null}}})};
            const emitted = [];
            refetchBalanceOnAccountSummaryEpic(mockActions([liveSummary()]), store)
                .subscribe(a => emitted.push(a), done, () => {
                    loaded = true;
                    refetchBalanceOnAccountSummaryEpic(mockActions([liveSummary()]), store)
                        .subscribe(a => emitted.push(a), done, () => {
                            try {
                                expect(emitted.length).toBe(
                                    1,
                                    'the transition observed -> no further fetch did not hold'
                                );
                                done();
                            } catch (err) { done(err); }
                        });
                });
        });
    });
});

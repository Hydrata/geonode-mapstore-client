import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic
} from '../epicsAnuga';
import { __setVisibilityForTests } from '../epics/pollingEpics';
import {
    INIT_ANUGA
} from '../actionsAnuga';
import {
    cancelAnugaRunEpic,
    retryAnugaRunEpic,
    runAnugaScenarioEpic,
    saveNetworkEpic
} from '../epics/crudEpics';

/**
 * Helper: create a mock action$ observable from an array of actions.
 */
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

describe('ANUGA Epics', () => {

    describe('initAnugaEpic', () => {
        it('should not emit when gnresource.id is falsy', (done) => {
            const store = {
                getState: () => ({
                    gnresource: { id: null },
                    security: { user: { pk: 1 } }
                })
            };
            const action$ = mockActions([{ type: INIT_ANUGA }]);
            const emitted = [];

            initAnugaEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should filter out when user is not logged in', (done) => {
            const store = {
                getState: () => ({
                    gnresource: { id: 42 },
                    security: { user: null }
                })
            };
            const action$ = mockActions([{ type: INIT_ANUGA }]);
            const emitted = [];

            initAnugaEpic(action$, store)
                .take(1)
                .timeout(500)
                .subscribe(
                    action => emitted.push(action),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    },
                    () => done()
                );
        });
    });

    // TASK-793 — VectorDraw editor handlers replace prePopulateAnugaFeatureGridWithDefaults.
    describe('vectorDrawAnugaCompleteEpic / vectorDrawAnugaCancelledEpic', () => {
        it('vectorDrawAnugaCompleteEpic should be a function', () => {
            expect(typeof vectorDrawAnugaCompleteEpic).toBe('function');
        });

        it('vectorDrawAnugaCancelledEpic should be a function', () => {
            expect(typeof vectorDrawAnugaCancelledEpic).toBe('function');
        });

        it('vectorDrawAnugaCompleteEpic only listens for ANUGA:VECTOR_DRAW_COMPLETE', (done) => {
            const action$ = mockActions([
                { type: 'SOME_OTHER_ACTION' },
                { type: 'ANUGA:VECTOR_DRAW_CANCELLED', meta: { prefix: 'bdy_' } }
            ]);
            const emitted = [];

            vectorDrawAnugaCompleteEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('vectorDrawAnugaCancelledEpic only listens for ANUGA:VECTOR_DRAW_CANCELLED', (done) => {
            const action$ = mockActions([
                { type: 'SOME_OTHER_ACTION' },
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'bdy_' } }
            ]);
            const emitted = [];

            vectorDrawAnugaCancelledEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        // v2 (TASK-2140c) — still emits NO Redux actions (VectorDraw's
        // vectorDrawSaveEpic already dispatches refreshLayerVersion on save
        // success). The epic now ALSO fires a trackEvent side effect — see
        // the dedicated Umami-spy test below for that assertion.
        it('vectorDrawAnugaCompleteEpic emits nothing (Redux contract unchanged)', (done) => {
            const action$ = mockActions([
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'bdy_' }, fid: 'feature.1' },
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'fri_' }, fid: 'feature.2' }
            ]);
            const emitted = [];

            vectorDrawAnugaCompleteEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        // TASK-2140 (c) — geometry save-success OUTCOME event. Verifies the
        // trackEvent side effect fires once per completion with a
        // low-cardinality, prefix-derived label.
        it('vectorDrawAnugaCompleteEpic fires anuga-vector-draw-save-<prefix> per completion', (done) => {
            const origUmami = window.umami;
            const calls = [];
            window.umami = { track: (label, payload) => calls.push({ label, ...payload }) };

            const action$ = mockActions([
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'inf_' }, fid: 'feature.1' },
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'rai_' }, fid: 'feature.2' },
                { type: 'ANUGA:VECTOR_DRAW_COMPLETE', meta: { prefix: 'mes_' }, fid: 'feature.3' }
            ]);

            vectorDrawAnugaCompleteEpic(action$)
                .subscribe(
                    () => {},
                    err => { window.umami = origUmami; done(err); },
                    () => {
                        window.umami = origUmami;
                        const labels = calls.map(c => c.label);
                        expect(labels).toInclude('anuga-vector-draw-save-inf');
                        expect(labels).toInclude('anuga-vector-draw-save-rai');
                        expect(labels).toInclude('anuga-vector-draw-save-mes');
                        expect(calls.length).toBe(3);
                        done();
                    }
                );
        });

        it('vectorDrawAnugaCancelledEpic emits nothing (v1 contract)', (done) => {
            const action$ = mockActions([
                { type: 'ANUGA:VECTOR_DRAW_CANCELLED', meta: { prefix: 'bdy_' } },
                { type: 'ANUGA:VECTOR_DRAW_CANCELLED', meta: { prefix: 'mes_' } }
            ]);
            const emitted = [];

            vectorDrawAnugaCancelledEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });
    });

    describe('cancelAnugaRunEpic', () => {
        it('should be a function', () => {
            expect(typeof cancelAnugaRunEpic).toBe('function');
        });

        it('should only listen for CANCEL_ANUGA_RUN action type', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION', runId: 1 }]);
            const emitted = [];

            cancelAnugaRunEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });
    });

    describe('retryAnugaRunEpic', () => {
        it('should be a function', () => {
            expect(typeof retryAnugaRunEpic).toBe('function');
        });

        it('should only listen for RETRY_ANUGA_RUN action type', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION', runId: 1 }]);
            const emitted = [];

            retryAnugaRunEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });
    });

    describe('runAnugaScenarioEpic', () => {
        it('should be a function', () => {
            expect(typeof runAnugaScenarioEpic).toBe('function');
        });

        it('should only listen for RUN_ANUGA_SCENARIO action type', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: { id: 1 } } }
                })
            };
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            runAnugaScenarioEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        // TASK-1227 — happy-path 202 + 5xx coverage for the core dispatch flow.
        describe('TASK-1227 happy-path 202 + 5xx', () => {
            const MockAdapter = require('axios-mock-adapter');
            const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
            const { RUN_ANUGA_SCENARIO_SUCCESS } = require('../actions/scenarioActions');
            const { START_ACTIVE_RUN_POLLING } = require('../actions/pollingActions');

            let mockAxios;
            beforeEach(() => { mockAxios = new MockAdapter(axios); });
            afterEach(() => { mockAxios.restore(); });

            it('202 -> dispatches success thunk + startActiveRunPolling(runId)', (done) => {
                mockAxios.onPost('/api/v2/anuga/scenarios/7/run/').reply(202, {
                    id: 501, status: 'created'
                });

                const action$ = mockActions([{ type: 'RUN_ANUGA_SCENARIO', scenario: { id: 7 } }]);
                const emitted = [];

                runAnugaScenarioEpic(action$, { getState: () => ({}) })
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(3);
                        expect(typeof emitted[0]).toBe('function');
                        const { SET_ANUGA_SCENARIO_MENU } = require('../actions/uiActions');
                        expect(emitted[1].type).toBe(SET_ANUGA_SCENARIO_MENU);
                        expect(emitted[1].visible).toBe(true);
                        const dispatched = [];
                        emitted[0]((a) => dispatched.push(a));
                        const successAction = dispatched.find(d => d.type === RUN_ANUGA_SCENARIO_SUCCESS);
                        expect(successAction).toExist();
                        expect(emitted[2].type).toBe(START_ACTIVE_RUN_POLLING);
                        expect(emitted[2].runId).toBe(501);
                        done();
                    });
            });

            it('5xx -> silently swallowed (no emission)', (done) => {
                mockAxios.onPost('/api/v2/anuga/scenarios/8/run/').reply(500, { detail: 'boom' });

                const action$ = mockActions([{ type: 'RUN_ANUGA_SCENARIO', scenario: { id: 8 } }]);
                const emitted = [];

                runAnugaScenarioEpic(action$, { getState: () => ({}) })
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(0);
                        done();
                    });
            });
        });

        // TASK-2100 (epic 2092 W4.2) — StartRunView's meter gate 402/429.
        describe('TASK-2100 meter-gate 402/429 interception', () => {
            const MockAdapter = require('axios-mock-adapter');
            const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
            const {SET_METER_INSUFFICIENT_BALANCE, SET_METER_CAP_EXCEEDED} = require('../../Paywall/meter/actions');

            let mockAxios;
            beforeEach(() => { mockAxios = new MockAdapter(axios); });
            afterEach(() => { mockAxios.restore(); });

            it('402 insufficient_balance -> SET_METER_INSUFFICIENT_BALANCE with checkout_url + detail', (done) => {
                mockAxios.onPost('/api/v2/anuga/scenarios/7/run/').reply(402, {
                    state: 'insufficient_balance',
                    checkout_url: 'https://x/commerce/checkout/create-session/',
                    detail: 'This run is priced at $5; your compute balance is $0.'
                });

                const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 7}, computeTarget: 'batch-x32'}]);
                const emitted = [];

                runAnugaScenarioEpic(action$, {getState: () => ({})})
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_METER_INSUFFICIENT_BALANCE);
                        expect(emitted[0].checkoutUrl).toBe('https://x/commerce/checkout/create-session/');
                        expect(emitted[0].detail).toInclude('priced at $5');
                        done();
                    });
            });

            it('429 FREE_CAP_EXCEEDED -> SET_METER_CAP_EXCEEDED (distinct from insufficient_balance)', (done) => {
                mockAxios.onPost('/api/v2/anuga/scenarios/7/run/').reply(429, {
                    error_code: 'FREE_CAP_EXCEEDED',
                    detail: 'Free daily compute-run cap (3) reached for this account.'
                });

                const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 7}, computeTarget: 'batch-x32'}]);
                const emitted = [];

                runAnugaScenarioEpic(action$, {getState: () => ({})})
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_METER_CAP_EXCEEDED);
                        expect(emitted[0].detail).toInclude('Free daily compute-run cap');
                        done();
                    });
            });

            it('an unrelated error is still silently swallowed (pre-existing behaviour, unchanged)', (done) => {
                mockAxios.onPost('/api/v2/anuga/scenarios/7/run/').reply(500, {detail: 'boom'});

                const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 7}, computeTarget: 'local'}]);
                const emitted = [];

                runAnugaScenarioEpic(action$, {getState: () => ({})})
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(0);
                        done();
                    });
            });
        });
    });

    describe('saveNetworkEpic', () => {
        it('should be a function', () => {
            expect(typeof saveNetworkEpic).toBe('function');
        });

        it('should only listen for SAVE_NETWORK action type', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: { id: 1 } } }
                })
            };
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            saveNetworkEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // V2P-21 — lazy-fetch my_perms on Anuga panel open
    // ─────────────────────────────────────────────────────────────────────
    describe('V2P-21 triggerFetchMyPermsOnInitEpic', () => {
        const {
            triggerFetchMyPermsOnInitEpic,
            __resetPermsCacheForTests
        } = require('../epics/permsEpics');
        const {
            FETCH_MY_PERMS,
            SET_ANUGA_PROJECT_DATA
        } = require('../actionsAnuga');

        beforeEach(() => __resetPermsCacheForTests());

        it('emits FETCH_MY_PERMS when INIT_ANUGA fires and project id known', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: { id: 42 } } }
                })
            };
            const action$ = mockActions([{ type: INIT_ANUGA }]);
            const emitted = [];

            triggerFetchMyPermsOnInitEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(FETCH_MY_PERMS);
                        expect(emitted[0].projectId).toBe(42);
                        done();
                    }
                );
        });

        it('emits FETCH_MY_PERMS on SET_ANUGA_PROJECT_DATA when project id arrives', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: { id: 99 } } }
                })
            };
            const action$ = mockActions([{ type: SET_ANUGA_PROJECT_DATA, data: { id: 99 } }]);
            const emitted = [];

            triggerFetchMyPermsOnInitEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(FETCH_MY_PERMS);
                        expect(emitted[0].projectId).toBe(99);
                        done();
                    }
                );
        });

        it('does NOT emit when project id is null (anuga panel never opened)', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: null } }
                })
            };
            const action$ = mockActions([{ type: INIT_ANUGA }]);
            const emitted = [];

            triggerFetchMyPermsOnInitEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        // AC#1 — TASK-658 perf budget regression guard.
        // Cold-anon median interactive_s = 13.60s; an eager perm fetch on map
        // init would push past the 14.28s 5% budget. INIT_ANUGA fires from
        // AnugaContainer's componentDidUpdate (= panel open) — NOT from the
        // mapstore map-init action chain. We assert that none of the typical
        // map-init actions trigger this epic.
        it('REGRESSION GUARD: does NOT fetch on map-init actions (TASK-658)', (done) => {
            const store = {
                getState: () => ({
                    // Project IS loaded (so the projectId guard wouldn't suppress)
                    anuga: { projects: { data: { id: 42 } } }
                })
            };
            // These are common map-init / map-render actions from MapStore2.
            // None of them should produce a FETCH_MY_PERMS dispatch.
            const action$ = mockActions([
                { type: 'MAP_CONFIG_LOADED' },
                { type: 'CHANGE_MAP_VIEW' },
                { type: 'MAP_INFO_LOAD_START' },
                { type: 'LAYER_LOAD' },
                { type: 'CHANGE_LAYER_PROPERTIES' },
                { type: 'INIT_LAYER' },
                { type: 'CHANGE_MOUSE_POINTER' },
                { type: 'MAP_BOUNDING_BOX_CHANGED' }
            ]);
            const emitted = [];

            triggerFetchMyPermsOnInitEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Critical assertion — zero fetches on any map-init action.
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('dedupes consecutive triggers for the same project id', (done) => {
            const store = {
                getState: () => ({
                    anuga: { projects: { data: { id: 42 } } }
                })
            };
            // 3 INIT_ANUGA in a row + 2 SET_ANUGA_PROJECT_DATA — distinctUntilChanged
            // should collapse them to a single emission since project id is constant.
            const action$ = mockActions([
                { type: INIT_ANUGA },
                { type: SET_ANUGA_PROJECT_DATA, data: { id: 42 } },
                { type: INIT_ANUGA },
                { type: SET_ANUGA_PROJECT_DATA, data: { id: 42 } },
                { type: INIT_ANUGA }
            ]);
            const emitted = [];

            triggerFetchMyPermsOnInitEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // distinctUntilChanged on the projectId stream collapses the run.
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].projectId).toBe(42);
                        done();
                    }
                );
        });
    });

    describe('V2P-21 fetchMyPermsEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            fetchMyPermsEpic,
            __resetPermsCacheForTests,
            __setNowForTests
        } = require('../epics/permsEpics');
        const {
            FETCH_MY_PERMS,
            SET_ANUGA_RESOURCE_PERMS,
            SET_PERMS_LOAD_FAILED
        } = require('../actionsAnuga');

        let mockAxios;

        beforeEach(() => {
            __resetPermsCacheForTests();
            __setNowForTests(null);  // restore real clock
            mockAxios = new MockAdapter(axios);
        });

        afterEach(() => {
            mockAxios.restore();
        });

        it('dispatches SET_ANUGA_RESOURCE_PERMS on successful fetch', (done) => {
            const payload = {
                my_role: 'editor',
                visibility: 'private',
                scenarios: { 1: ['view_resourcebase', 'change_resourcebase'] },
                terrain: {},
                boundaries: { 7: ['view_resourcebase'] }
            };
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(200, payload);

            const action$ = mockActions([{ type: FETCH_MY_PERMS, projectId: 42 }]);
            const emitted = [];

            fetchMyPermsEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_ANUGA_RESOURCE_PERMS);
                        expect(emitted[0].payload).toEqual(payload);
                        done();
                    }
                );
        });

        it('retries once on 5xx then succeeds', (done) => {
            // First call: 503. Second call: 200.
            let callCount = 0;
            mockAxios.onGet('/api/v2/anuga/projects/77/my-perms/').reply(() => {
                callCount += 1;
                if (callCount === 1) return [503, { detail: 'Service Unavailable' }];
                return [200, { my_role: 'viewer', visibility: 'public', scenarios: {} }];
            });

            const action$ = mockActions([{ type: FETCH_MY_PERMS, projectId: 77 }]);
            const emitted = [];

            fetchMyPermsEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(callCount).toBe(2);
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_ANUGA_RESOURCE_PERMS);
                        done();
                    }
                );
        });

        it('surfaces toast + permsLoadFailed=true on 2nd failure (final 5xx)', (done) => {
            mockAxios.onGet('/api/v2/anuga/projects/88/my-perms/').reply(500, { detail: 'boom' });

            const action$ = mockActions([{ type: FETCH_MY_PERMS, projectId: 88 }]);
            const emitted = [];

            fetchMyPermsEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Two emissions: setPermsLoadFailed + show notification
                        expect(emitted.length).toBe(2);
                        expect(emitted[0].type).toBe(SET_PERMS_LOAD_FAILED);
                        expect(emitted[0].failed).toBe(true);
                        // Notifications action type is 'NOTIFICATIONS:SHOW_NOTIFICATION'
                        // (via MapStore2 notifications.show)
                        expect(typeof emitted[1].type).toBe('string');
                        expect(emitted[1].type.indexOf('NOTIFICATION') !== -1).toBe(true);
                        done();
                    }
                );
        }, 6000);  // long-ish timeout — retry adds 1s backoff before the second 500

        it('does NOT retry on 4xx (e.g. 404 anon-on-private)', function _t(done) {
            this.timeout(8000);
            // axios-mock-adapter 1.16.0 produces an Error with `error.response`
            // set when validateStatus rejects. We surface a 404 here.
            mockAxios.onGet('/api/v2/anuga/projects/99/my-perms/').reply(404, { detail: 'Not Found' });

            const action$ = mockActions([{ type: FETCH_MY_PERMS, projectId: 99 }]);
            const emitted = [];
            const sub = fetchMyPermsEpic(action$)
                .take(2)
                .subscribe(
                    (action) => emitted.push(action),
                    (err) => done(new Error(`subscribe error: ${err && err.message}`)),
                    () => {
                        try {
                            // mockAxios.history.get records every matched
                            // request — assert we hit the network exactly once.
                            // (4xx is non-retryable per V2P-21 spec; only 5xx /
                            // network errors get the 1-retry treatment.)
                            expect(mockAxios.history.get.length).toBe(1);
                            // Final-failure path emits 2 actions:
                            //   [SET_PERMS_LOAD_FAILED, NOTIFICATIONS:SHOW_NOTIFICATION]
                            expect(emitted.length).toBe(2);
                            expect(emitted[0].type).toBe(SET_PERMS_LOAD_FAILED);
                            expect(emitted[0].failed).toBe(true);
                            done();
                        } catch (e) {
                            done(e);
                        }
                        if (sub) sub.unsubscribe();
                    }
                );
        });

        it('dedupes within the 30s cache window', (done) => {
            // Pin clock so window math is deterministic.
            let nowMs = 1700000000000;
            __setNowForTests(() => nowMs);

            let callCount = 0;
            mockAxios.onGet('/api/v2/anuga/projects/55/my-perms/').reply(() => {
                callCount += 1;
                return [200, { my_role: 'editor', visibility: 'private', scenarios: {} }];
            });

            const action$ = mockActions([
                { type: FETCH_MY_PERMS, projectId: 55 },
                // 2nd call 10s later — well within 30s window
                { type: FETCH_MY_PERMS, projectId: 55 }
            ]);
            // Advance the clock between the two emissions a bit — 10s.
            // (We can't drive the inner setTimeout, but the dedupe check uses
            // _now() at the FETCH_MY_PERMS handler, so by re-stubbing _now
            // before the second action we simulate elapsed time.)
            // Since mockActions emits both in the same setTimeout(0), the
            // dedupe will short-circuit the 2nd one because nowMs hasn't
            // advanced by 30s.
            const emitted = [];

            fetchMyPermsEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Only one HTTP call, only one SET emission
                        expect(callCount).toBe(1);
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SET_ANUGA_RESOURCE_PERMS);
                        done();
                    }
                );
        });

        it('refetches after dedupe window expires (>30s)', (done) => {
            // Pin clock; advance past 30s on the second action.
            let nowMs = 1700000000000;
            __setNowForTests(() => nowMs);

            let callCount = 0;
            mockAxios.onGet('/api/v2/anuga/projects/56/my-perms/').reply(() => {
                callCount += 1;
                return [200, { my_role: 'editor', visibility: 'private', scenarios: {} }];
            });

            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
            const emitted = [];

            fetchMyPermsEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(callCount).toBe(2);
                        expect(emitted.length).toBe(2);
                        done();
                    }
                );

            // First emission, then advance clock past 30s, then second emission.
            setTimeout(() => subject.next({ type: FETCH_MY_PERMS, projectId: 56 }), 0);
            setTimeout(() => {
                nowMs += 31000;  // advance 31s past the cache window
                subject.next({ type: FETCH_MY_PERMS, projectId: 56 });
                subject.complete();
            }, 50);
        });
    });

    describe('V2P-714 cascade-delete epics', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            deleteTerrainEpic,
            deleteBoundaryEpic,
            deleteFrictionEpic,
            deleteInflowEpic
        } = require('../epics/crudEpics');
        const {
            DELETE_TERRAIN,
            DELETE_TERRAIN_SUCCESS,
            DELETE_TERRAIN_BLOCKED,
            DELETE_TERRAIN_ERROR,
            DELETE_BOUNDARY,
            DELETE_FRICTION,
            DELETE_INFLOW
        } = require('../actionsAnuga');

        const REMOVE_NODE = 'REMOVE_NODE';
        const REMOVE_LAYER = 'REMOVE_LAYER';
        // V2P-714 sibling-orphan: epic now emits saveDirectContent after the
        // layer-removal so the saved blob loses the deleted refs and the
        // user-perceived "delete" actually persists across page refresh.
        const GN_SAVE_CONTENT = 'GEONODE:SAVE_DIRECT_CONTENT';

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('deleteTerrainEpic: 204 -> SUCCESS + removeNode + removeLayer + saveDirectContent (single layer back-compat)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(204);
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    // success + removeNode + removeLayer + saveDirectContent
                    expect(emitted.length).toBe(4);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_SUCCESS);
                    expect(emitted[0].id).toBe(99);
                    expect(emitted[1].type).toBe(REMOVE_NODE);
                    expect(emitted[2].type).toBe(REMOVE_LAYER);
                    expect(emitted[3].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('deleteTerrainEpic: 204 with layerIds array removes ALL siblings + saves once', (done) => {
            // V2P-714 sibling-orphan: Terrain has utm + hillshade siblings.
            // Cascade-delete must remove BOTH FE layers — not just one —
            // otherwise the un-removed sibling stays as a ghost ref in the
            // saved blob and re-renders WMS-broken on page reload.
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(204);
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99,
                layerIds: ['utm-layer-id', 'hillshade-layer-id']
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    // success + 2x (removeNode + removeLayer) + saveDirectContent
                    expect(emitted.length).toBe(6);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_SUCCESS);
                    expect(emitted[0].layerIds).toEqual(['utm-layer-id', 'hillshade-layer-id']);
                    expect(emitted[1].type).toBe(REMOVE_NODE);
                    expect(emitted[1].node).toBe('utm-layer-id');
                    expect(emitted[2].type).toBe(REMOVE_LAYER);
                    expect(emitted[2].layerId).toBe('utm-layer-id');
                    expect(emitted[3].type).toBe(REMOVE_NODE);
                    expect(emitted[3].node).toBe('hillshade-layer-id');
                    expect(emitted[4].type).toBe(REMOVE_LAYER);
                    expect(emitted[4].layerId).toBe('hillshade-layer-id');
                    expect(emitted[5].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('deleteTerrainEpic: 409 ACTIVE_REFERENCES -> BLOCKED with blocking list', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(409, {
                error_code: 'ACTIVE_REFERENCES',
                message: 'Cannot delete: 2 active scenarios reference this terrain',
                blocking: [
                    { type: 'scenario', id: 11, name: 'Scenario A', state: 'computing' },
                    { type: 'scenario', id: 12, name: 'Scenario B', state: 'queued' }
                ]
            });
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_BLOCKED);
                    expect(emitted[0].id).toBe(99);
                    expect(emitted[0].blocking.length).toBe(2);
                    expect(emitted[0].blocking[0].name).toBe('Scenario A');
                    expect(emitted[0].message).toBe('Cannot delete: 2 active scenarios reference this terrain');
                    done();
                });
        });

        it('deleteTerrainEpic: 500 -> ERROR (no SUCCESS)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(500, { detail: 'boom' });
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_ERROR);
                    expect(emitted[0].id).toBe(99);
                    expect(emitted[0].error.status).toBe(500);
                    done();
                });
        });

        it('deleteTerrainEpic: 403 -> ERROR (caller distinguishes via .status)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(403, { detail: 'forbidden' });
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_ERROR);
                    expect(emitted[0].error.status).toBe(403);
                    done();
                });
        });

        it('deleteTerrainEpic: 409 without ACTIVE_REFERENCES error_code -> ERROR (not BLOCKED)', (done) => {
            // Defensive: we only treat 409 as "blocked by scenarios" when the
            // BE explicitly tags error_code:ACTIVE_REFERENCES. Other 409s
            // should fall through to the generic error path.
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(409, { detail: 'conflict' });
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_ERROR);
                    done();
                });
        });

        it('deleteTerrainEpic: success without layerId emits only SUCCESS', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/terrain/99/').reply(204);
            const action$ = mockActions([{
                type: DELETE_TERRAIN, projectId: 7, id: 99
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_SUCCESS);
                    done();
                });
        });

        it('deleteBoundaryEpic hits /boundaries/ (URL parity)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/boundaries/12/').reply(204);
            const action$ = mockActions([{
                type: DELETE_BOUNDARY, projectId: 7, id: 12, layerId: 'l1'
            }]);
            const emitted = [];
            deleteBoundaryEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.delete.slice(-1)[0].url).toBe('/api/v2/anuga/projects/7/boundaries/12/');
                    // success + removeNode + removeLayer + saveDirectContent
                    expect(emitted.length).toBe(4);
                    expect(emitted[3].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('deleteFrictionEpic hits /frictions/ (URL parity)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/frictions/13/').reply(204);
            const action$ = mockActions([{
                type: DELETE_FRICTION, projectId: 7, id: 13, layerId: 'l1'
            }]);
            const emitted = [];
            deleteFrictionEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.delete.slice(-1)[0].url).toBe('/api/v2/anuga/projects/7/frictions/13/');
                    expect(emitted.length).toBe(4);
                    expect(emitted[3].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('deleteInflowEpic hits /inflows/ (URL parity)', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/7/inflows/14/').reply(204);
            const action$ = mockActions([{
                type: DELETE_INFLOW, projectId: 7, id: 14, layerId: 'l1'
            }]);
            const emitted = [];
            deleteInflowEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.delete.slice(-1)[0].url).toBe('/api/v2/anuga/projects/7/inflows/14/');
                    expect(emitted.length).toBe(4);
                    expect(emitted[3].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('falls back to projectId from store when not in action', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/42/terrain/99/').reply(204);
            const action$ = mockActions([{
                // no projectId on action — epic should resolve from store
                type: DELETE_TERRAIN, id: 99, layerId: 'l1'
            }]);
            const emitted = [];
            deleteTerrainEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.delete.slice(-1)[0].url).toBe('/api/v2/anuga/projects/42/terrain/99/');
                    expect(emitted[0].type).toBe(DELETE_TERRAIN_SUCCESS);
                    done();
                });
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Self-heal: pruneOrphanTerrainLayersEpic. A re-derived combined surface
    // (or any server-side terrain delete while the map was closed) leaves a
    // ghost layer in base_resourcebase.blob. On terrain load the epic confirms
    // the backing Dataset is GONE (hard 404 by PK) and removes + persists it —
    // but keeps a layer whose Dataset still exists (200) or is ambiguous, and
    // does nothing for a viewer who cannot save.
    // ─────────────────────────────────────────────────────────────────────
    describe('pruneOrphanTerrainLayersEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const { pruneOrphanTerrainLayersEpic } = require('../epics/crudEpics');
        const { SET_ANUGA_TERRAIN_DATA } = require('../actionsAnuga');

        const REMOVE_NODE = 'REMOVE_NODE';
        const REMOVE_LAYER = 'REMOVE_LAYER';
        const GN_SAVE_CONTENT = 'GEONODE:SAVE_DIRECT_CONTENT';

        // One live source terrain (matched to a model) + the two ghost combined-
        // surface layers (no model, deleted Datasets) — mirrors the real
        // hydrata.com/map/5528 blob that triggered this fix.
        const liveModel = { id: 510, gn_layer_name: 'ele_510_utm_spa_dcp3_cog', gn_layer_hillshade_name: 'ele_510_hillshade_spa_dcp3_cog' };
        const liveLayer = { id: 'live-uuid', name: 'geonode:ele_510_utm_spa_dcp3_cog', group: 'Input Data.Terrain', geonode_id: 5538 };
        const ghostDem = { id: 'ghost-dem-uuid', name: 'geonode:ele_512_utm_combined_surface_derived_cog', group: 'Input Data.Terrain', geonode_id: 5552 };
        const ghostHill = { id: 'ghost-hill-uuid', name: 'geonode:ele_512_hillshade_combined_surface_derived_cog', group: 'Input Data.Terrain', geonode_id: 5553 };

        const storeWith = ({ myRole = 'owner', terrain = [liveModel], flat }) => ({
            getState: () => ({
                anuga: { projects: { data: { id: 649, my_role: myRole } }, resources: { terrain, terrainLoaded: true } },
                layers: { flat }
            })
        });

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('removes a confirmed-gone ghost (404 by PK) + saves once, leaving live layers untouched', (done) => {
            mockAxios.onGet('/api/v2/datasets/5552/').reply(404);
            mockAxios.onGet('/api/v2/datasets/5553/').reply(404);
            const action$ = mockActions([{ type: SET_ANUGA_TERRAIN_DATA, data: [liveModel] }]);
            const emitted = [];
            pruneOrphanTerrainLayersEpic(action$, storeWith({ flat: [liveLayer, ghostDem, ghostHill] }))
                .subscribe(a => emitted.push(a), done, () => {
                    // 2 ghosts × (removeNode + removeLayer) + one saveDirectContent
                    expect(emitted.length).toBe(5);
                    const removedLayerIds = emitted.filter(a => a.type === REMOVE_LAYER).map(a => a.layerId);
                    expect(removedLayerIds).toContain('ghost-dem-uuid');
                    expect(removedLayerIds).toContain('ghost-hill-uuid');
                    // the live, model-matched layer is never probed nor removed
                    expect(removedLayerIds).toNotContain('live-uuid');
                    expect(emitted.filter(a => a.type === REMOVE_NODE).length).toBe(2);
                    expect(emitted[emitted.length - 1].type).toBe(GN_SAVE_CONTENT);
                    done();
                });
        });

        it('keeps a model-less layer whose Dataset still exists (200) — no removal, no save', (done) => {
            // Publish-race / still-valid derived surface: the PK GET resolves 200.
            mockAxios.onGet('/api/v2/datasets/5552/').reply(200, { pk: 5552 });
            mockAxios.onGet('/api/v2/datasets/5553/').reply(200, { pk: 5553 });
            const action$ = mockActions([{ type: SET_ANUGA_TERRAIN_DATA, data: [liveModel] }]);
            const emitted = [];
            pruneOrphanTerrainLayersEpic(action$, storeWith({ flat: [liveLayer, ghostDem, ghostHill] }))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('keeps a model-less layer on an AMBIGUOUS probe (500) — never deletes on uncertainty', (done) => {
            mockAxios.onGet('/api/v2/datasets/5552/').reply(500);
            mockAxios.onGet('/api/v2/datasets/5553/').reply(500);
            const action$ = mockActions([{ type: SET_ANUGA_TERRAIN_DATA, data: [liveModel] }]);
            const emitted = [];
            pruneOrphanTerrainLayersEpic(action$, storeWith({ flat: [liveLayer, ghostDem, ghostHill] }))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('does nothing for a viewer (cannot persist a blob save)', (done) => {
            mockAxios.onGet('/api/v2/datasets/5552/').reply(404);
            const action$ = mockActions([{ type: SET_ANUGA_TERRAIN_DATA, data: [liveModel] }]);
            const emitted = [];
            pruneOrphanTerrainLayersEpic(action$, storeWith({ myRole: 'viewer', flat: [liveLayer, ghostDem] }))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    // a viewer must not even probe the Datasets API
                    expect(mockAxios.history.get.length).toBe(0);
                    done();
                });
        });

        it('emits nothing when every terrain layer matches a model (healthy map)', (done) => {
            const action$ = mockActions([{ type: SET_ANUGA_TERRAIN_DATA, data: [liveModel] }]);
            const emitted = [];
            pruneOrphanTerrainLayersEpic(action$, storeWith({ flat: [liveLayer] }))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    expect(mockAxios.history.get.length).toBe(0);
                    done();
                });
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // TASK-937 (W2.2) — Scenario PATCH allow-list regression guard.
    //
    // Post-W1, Scenario.status is a read-only @property derived from
    // latest_run.status; the underlying DB column was dropped in hydrata
    // migration 0103. ScenarioUpdateSerializerV2 silently drops any field
    // outside the 10-field writable allow-list. Sending the full scenario
    // object on PATCH was therefore dead payload — BE was already ignoring
    // it. This test pins the FE wire contract so future refactors can't
    // quietly re-introduce read-only fields (status, computed_status,
    // latest_run, log, …) into the PATCH body.
    // ─────────────────────────────────────────────────────────────────────
    describe('TASK-879 duplicateAnugaScenarioEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            duplicateAnugaScenarioEpic
        } = require('../epics/crudEpics');
        const {
            DUPLICATE_ANUGA_SCENARIO
        } = require('../actionsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('is a function exported from crudEpics', () => {
            expect(typeof duplicateAnugaScenarioEpic).toBe('function');
        });

        it('POST 201 → dispatches duplicateAnugaScenarioSuccess thunk', (done) => {
            // Wire correct project id (7) so the epic's URL path resolves.
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/42/duplicate/').reply(
                201,
                { id: 99, name: 'source-copy', project: 7 }
            );
            const sourceScenario = { id: 42, name: 'source' };
            const action$ = mockActions([{ type: DUPLICATE_ANUGA_SCENARIO, scenario: sourceScenario }]);
            const emitted = [];

            duplicateAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.post.length).toBe(1);
                    // The epic emits the success thunk (a function), not a plain
                    // action — duplicateAnugaScenarioSuccess wraps SHOW_NOTIFICATION
                    // + DUPLICATE_ANUGA_SCENARIO_SUCCESS dispatches.
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    // Drive the thunk to confirm it dispatches the success type.
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));
                    // SHOW_NOTIFICATION first, then DUPLICATE_ANUGA_SCENARIO_SUCCESS
                    expect(dispatched.length).toBe(2);
                    expect(dispatched[1].type).toBe('DUPLICATE_ANUGA_SCENARIO_SUCCESS');
                    expect(dispatched[1].scenario).toEqual({ id: 99, name: 'source-copy', project: 7 });
                    done();
                });
        });

        it('Only listens for DUPLICATE_ANUGA_SCENARIO action type', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            duplicateAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(
                    a => emitted.push(a),
                    done,
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });
    });

    describe('TASK-880 archive/unarchive scenario epics', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            archiveAnugaScenarioEpic,
            unarchiveAnugaScenarioEpic
        } = require('../epics/crudEpics');
        const {
            ARCHIVE_ANUGA_SCENARIO,
            UNARCHIVE_ANUGA_SCENARIO
        } = require('../actionsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('archiveAnugaScenarioEpic is a function exported from crudEpics', () => {
            expect(typeof archiveAnugaScenarioEpic).toBe('function');
        });

        it('unarchiveAnugaScenarioEpic is a function exported from crudEpics', () => {
            expect(typeof unarchiveAnugaScenarioEpic).toBe('function');
        });

        it('Archive POST 200 → dispatches archiveAnugaScenarioSuccess thunk', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/42/archive/').reply(
                200,
                { id: 42, name: 'source', archived_at: '2026-05-14T13:00:00Z', archived_by: 9 }
            );
            const scenario = { id: 42, name: 'source' };
            const action$ = mockActions([{ type: ARCHIVE_ANUGA_SCENARIO, scenario }]);
            const emitted = [];

            archiveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.post.length).toBe(1);
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));
                    // SHOW_NOTIFICATION + ARCHIVE_ANUGA_SCENARIO_SUCCESS
                    expect(dispatched.length).toBe(2);
                    expect(dispatched[1].type).toBe('ARCHIVE_ANUGA_SCENARIO_SUCCESS');
                    expect(dispatched[1].scenario.archived_at).toBe('2026-05-14T13:00:00Z');
                    done();
                });
        });

        it('Archive POST 412 → routes the detail to BOTH the toast and the in-pane surface (TASK-2264)', (done) => {
            // 412 = active run blocker. BE returns `{detail: '...'}` body.
            // TASK-2264 (was Wave 3C C5 toast-only): the catch now dispatches
            // BOTH the toast thunk (showArchiveError) AND
            // archiveAnugaScenarioError, whose detail the reducer stashes as
            // `archiveError` so the pane's consolidated notices surface can
            // anchor it (W4.2: the toast alone was missed).
            const detail = 'Cannot archive — scenario has an active or queued compute job. Cancel the run first.';
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/42/archive/').reply(
                412,
                { detail }
            );
            const scenario = { id: 42, name: 'source' };
            const action$ = mockActions([{ type: ARCHIVE_ANUGA_SCENARIO, scenario }]);
            const emitted = [];
            let finished = false;
            const finish = (err) => {
                if (finished) return;
                finished = true;
                done(err);
            };

            archiveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(
                    a => emitted.push(a),
                    err => finish(err),
                    () => {
                        try {
                            // Two emissions: the toast thunk, then the plain
                            // ARCHIVE_ANUGA_SCENARIO_ERROR action.
                            expect(emitted.length).toBe(2);
                            // [0] toast thunk (redux-thunk fn) → SHOW_NOTIFICATION.
                            expect(typeof emitted[0]).toBe('function');
                            const dispatched = [];
                            emitted[0]((d) => dispatched.push(d));
                            expect(dispatched.length).toBe(1);
                            expect(dispatched[0].type).toBe('SHOW_NOTIFICATION');
                            expect(dispatched[0].level).toBe('warning');
                            expect(dispatched[0].message).toBe(detail);
                            // [1] plain action carrying the detail into Redux.
                            expect(emitted[1].type).toBe('ARCHIVE_ANUGA_SCENARIO_ERROR');
                            expect(emitted[1].scenarioId).toBe(42);
                            expect(emitted[1].detail).toBe(detail);
                            finish();
                        } catch (e) { finish(e); }
                    }
                );
        });

        it('Archive only listens for ARCHIVE_ANUGA_SCENARIO action type', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            archiveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('Unarchive POST 200 → dispatches unarchiveAnugaScenarioSuccess thunk', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/42/unarchive/').reply(
                200,
                { id: 42, name: 'source', archived_at: null, archived_by: null }
            );
            const scenario = { id: 42, name: 'source' };
            const action$ = mockActions([{ type: UNARCHIVE_ANUGA_SCENARIO, scenario }]);
            const emitted = [];

            unarchiveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.post.length).toBe(1);
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));
                    // SHOW_NOTIFICATION + UNARCHIVE_ANUGA_SCENARIO_SUCCESS
                    expect(dispatched.length).toBe(2);
                    expect(dispatched[1].type).toBe('UNARCHIVE_ANUGA_SCENARIO_SUCCESS');
                    expect(dispatched[1].scenario.archived_at).toBe(null);
                    done();
                });
        });
    });

    describe('TASK-937 saveAnugaScenarioEpic PATCH allow-list', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            saveAnugaScenarioEpic,
            SCENARIO_PATCH_FIELDS
        } = require('../epics/crudEpics');
        const { SAVE_ANUGA_SCENARIO } = require('../actionsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('PATCH body contains EXACTLY the 11 allow-list keys (no read-only leakage)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/42/').reply(200, { id: 42 });

            // Scenario with EVERY known read-only field populated alongside
            // the writable fields. The epic must strip all read-only fields
            // before PATCH; anything else is a regression.
            // TASK-955 (W2.2 FE) — `rainfall` added to the allow-list as the
            // 11th writable field; same shape as inflow.
            const fatScenario = {
                // Writable allow-list (all 11):
                id: 42,
                name: 'my-scenario',
                terrain: 1,
                boundary: 2,
                friction: 3,
                inflow: 4,
                rainfall: 14,
                structure: 5,
                mesh_region: 6,
                network: 7,
                resolution: 5,
                duration: 3600,
                // Read-only fields that MUST be stripped:
                status: 'created',
                computed_status: 'building',
                latest_run: { id: 99, status: 'queued' },
                latest_run_is_valid: true,
                created_by: 9999,
                created_by_username: 'me',
                unsaved: true,
                log: 'something-noisy'
            };

            const action$ = mockActions([{ type: SAVE_ANUGA_SCENARIO, scenario: fatScenario }]);
            const emitted = [];

            saveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.patch.length).toBe(1);
                    const body = JSON.parse(mockAxios.history.patch[0].data);
                    const keys = Object.keys(body).sort();
                    expect(keys).toEqual([...SCENARIO_PATCH_FIELDS].sort());
                    // Spot-check that the values flowed through correctly for
                    // both an identifier-typed and a primitive-typed field.
                    expect(body.name).toBe('my-scenario');
                    expect(body.terrain).toBe(1);
                    expect(body.duration).toBe(3600);
                    // Explicit negative assertions on the read-only fields
                    // most likely to drift back in.
                    expect(body.status).toBe(undefined);
                    expect(body.computed_status).toBe(undefined);
                    expect(body.latest_run).toBe(undefined);
                    expect(body.log).toBe(undefined);
                    expect(body.created_by).toBe(undefined);
                    expect(body.unsaved).toBe(undefined);
                    // Epic should still emit the success thunk — response
                    // handling is untouched. (saveAnugaScenarioSuccess is a
                    // redux-thunk that fires SHOW_NOTIFICATION +
                    // SAVE_ANUGA_SCENARIO_SUCCESS on dispatch.)
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    done();
                });
        });

        it('PATCH body omits undefined allow-list fields (does not send `null`-padded contract)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/42/').reply(200, { id: 42 });

            // Only a subset of writable fields set. Undefined keys must be
            // omitted (not coerced to null). Explicit null is preserved
            // (the user is clearing a relation — that's a legitimate write).
            const partial = {
                id: 42,
                name: 'partial',
                terrain: 1,
                boundary: null    // explicit clear
                // friction, inflow, structure, mesh_region, network, resolution, duration: undefined
            };

            const action$ = mockActions([{ type: SAVE_ANUGA_SCENARIO, scenario: partial }]);
            const emitted = [];

            saveAnugaScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    const body = JSON.parse(mockAxios.history.patch[0].data);
                    expect(Object.keys(body).sort()).toEqual(['boundary', 'name', 'terrain']);
                    expect(body.name).toBe('partial');
                    expect(body.terrain).toBe(1);
                    expect(body.boundary).toBe(null);
                    done();
                });
        });
    });

    // TASK-958 — explicit Build endpoint, decoupled from PATCH side-effect.
    describe('TASK-958 buildScenarioExplicit action + buildScenarioEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const { buildScenarioEpic } = require('../epics/crudEpics');
        const {
            BUILD_SCENARIO,
            BUILD_SCENARIO_SUCCESS,
            BUILD_SCENARIO_ERROR,
            buildScenarioExplicit
        } = require('../actionsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('buildScenarioExplicit returns a BUILD_SCENARIO action with scenarioId', () => {
            const action = buildScenarioExplicit(42);
            expect(action.type).toBe(BUILD_SCENARIO);
            expect(action.scenarioId).toBe(42);
        });

        it('buildScenarioEpic POSTs to /build/ and emits success thunk on 202', (done) => {
            // TASK-2079: build() now creates the Run at request time and
            // returns its id — {'status': 'created', run_id, scenario_id}.
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/42/build/').reply(202, {
                status: 'created', run_id: 501, scenario_id: 42
            });

            const action$ = mockActions([{ type: BUILD_SCENARIO, scenarioId: 42 }]);
            const emitted = [];

            buildScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(mockAxios.history.post.length).toBe(1);
                    expect(mockAxios.history.post[0].url).toBe(
                        '/api/v2/anuga/projects/7/scenarios/42/build/'
                    );
                    // success is a redux-thunk (function), not a plain action.
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    // dispatch the thunk to assert it fires BUILD_SCENARIO_SUCCESS.
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));
                    const successAction = dispatched.find(
                        d => d.type === BUILD_SCENARIO_SUCCESS
                    );
                    expect(successAction).toExist();
                    expect(successAction.scenarioId).toBe(42);
                    done();
                });
        });

        it('buildScenarioEpic emits error thunk on 5xx', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/99/build/').reply(500, {
                detail: 'boom'
            });

            const action$ = mockActions([{ type: BUILD_SCENARIO, scenarioId: 99 }]);
            const emitted = [];

            buildScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));
                    const errorAction = dispatched.find(
                        d => d.type === BUILD_SCENARIO_ERROR
                    );
                    expect(errorAction).toExist();
                    expect(errorAction.scenarioId).toBe(99);
                    // A real (5xx) failure DOES show the 'Build failed' toast.
                    const notification = dispatched.find(
                        d => typeof d.type === 'string' && d.type.indexOf('NOTIFICATION') !== -1
                    );
                    expect(notification).toExist();
                    done();
                });
        });

        // TASK-2079: the BE build-dedup guard 409s when a build is already in
        // flight for the scenario — this must surface as benign inline info
        // near the Build button (scenarioHeaderActions.js reads
        // scenario.buildConflict), NOT the 'Build failed' toast.
        it('buildScenarioEpic emits a benign (non-toast) error thunk on 409 conflict', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/55/build/').reply(409, {
                status: 'building', run_id: 501, detail: 'A build is already in progress for this scenario.'
            });

            const action$ = mockActions([{ type: BUILD_SCENARIO, scenarioId: 55 }]);
            const emitted = [];

            buildScenarioEpic(action$, storeWithProjectId(7))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(typeof emitted[0]).toBe('function');
                    const dispatched = [];
                    emitted[0]((a) => dispatched.push(a));

                    // NO 'Build failed' toast for a 409.
                    const notification = dispatched.find(
                        d => typeof d.type === 'string' && d.type.indexOf('NOTIFICATION') !== -1
                    );
                    expect(notification).toNotExist();

                    // BUILD_SCENARIO_ERROR still fires, but flagged benign
                    // with the real in-flight run's status/id carried through.
                    const errorAction = dispatched.find(
                        d => d.type === BUILD_SCENARIO_ERROR
                    );
                    expect(errorAction).toExist();
                    expect(errorAction.scenarioId).toBe(55);
                    expect(errorAction.conflict).toBe(true);
                    expect(errorAction.runId).toBe(501);
                    expect(errorAction.runStatus).toBe('building');
                    expect(errorAction.detail).toBe('A build is already in progress for this scenario.');
                    done();
                });
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // TASK-860 / TASK-862 — W3 membership epics coverage
    // ─────────────────────────────────────────────────────────────────────
    describe('TASK-860 membershipEpics', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            fetchInvitationsEpic,
            sendInvitationEpic,
            revokeInvitationEpic,
            resendInvitationEpic
        } = require('../epics/membershipEpics');
        const {
            FETCH_INVITATIONS,
            SEND_INVITATION_REQUEST,
            REVOKE_INVITATION_REQUEST,
            RESEND_INVITATION_REQUEST,
            SET_INVITATIONS
        } = require('../actionsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        // fetchInvitationsEpic
        it('fetchInvitationsEpic: 200 -> emits SET_INVITATIONS with response data', (done) => {
            const payload = {
                invitations_enabled: true,
                results: [
                    {id: 1, email: 'a@b.com', status: 'pending', role: 1, role_label: 'Viewer'}
                ]
            };
            mockAxios.onGet('/api/v2/anuga/projects/42/invitations/').reply(200, payload);

            const action$ = mockActions([{type: FETCH_INVITATIONS}]);
            const emitted = [];

            fetchInvitationsEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_INVITATIONS);
                    expect(emitted[0].payload).toEqual(payload);
                    done();
                });
        });

        it('fetchInvitationsEpic: empty project id -> emits nothing', (done) => {
            const store = {getState: () => ({anuga: {projects: {data: null}}})};
            const action$ = mockActions([{type: FETCH_INVITATIONS}]);
            const emitted = [];

            fetchInvitationsEpic(action$, store)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('fetchInvitationsEpic: API error -> emits SHOW_NOTIFICATION (no crash)', (done) => {
            mockAxios.onGet('/api/v2/anuga/projects/42/invitations/').reply(500, {detail: 'boom'});

            const action$ = mockActions([{type: FETCH_INVITATIONS}]);
            const emitted = [];

            fetchInvitationsEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        // sendInvitationEpic
        it('sendInvitationEpic: 202 -> emits fetchInvitations + SHOW_NOTIFICATION', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/42/invitations/').reply(202, {
                created_count: 0, queued_count: 1
            });

            const action$ = mockActions([{
                type: SEND_INVITATION_REQUEST,
                email: 'new@example.com',
                role: 1
            }]);
            const emitted = [];

            sendInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(2);
                    // First emission is fetchInvitations action
                    expect(emitted[0].type).toBe(FETCH_INVITATIONS);
                    // Second is the success notification
                    expect(emitted[1].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        it('sendInvitationEpic: API error surfaces SHOW_NOTIFICATION (no crash)', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/42/invitations/').reply(429, {
                detail: 'Throttled'
            });

            const action$ = mockActions([{
                type: SEND_INVITATION_REQUEST,
                email: 'thr@x.com',
                role: 1
            }]);
            const emitted = [];

            sendInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        // revokeInvitationEpic
        it('revokeInvitationEpic: 204 -> emits fetchInvitations + SHOW_NOTIFICATION', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/42/invitations/7/').reply(204);

            const action$ = mockActions([{
                type: REVOKE_INVITATION_REQUEST,
                invitationId: 7
            }]);
            const emitted = [];

            revokeInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(2);
                    expect(emitted[0].type).toBe(FETCH_INVITATIONS);
                    expect(emitted[1].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        it('revokeInvitationEpic: API error surfaces SHOW_NOTIFICATION', (done) => {
            mockAxios.onDelete('/api/v2/anuga/projects/42/invitations/7/').reply(403, {
                detail: 'Forbidden'
            });

            const action$ = mockActions([{type: REVOKE_INVITATION_REQUEST, invitationId: 7}]);
            const emitted = [];

            revokeInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        // resendInvitationEpic
        it('resendInvitationEpic: 200 -> emits fetchInvitations + SHOW_NOTIFICATION', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/42/invitations/7/resend/').reply(200, {});

            const action$ = mockActions([{type: RESEND_INVITATION_REQUEST, invitationId: 7}]);
            const emitted = [];

            resendInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(2);
                    expect(emitted[0].type).toBe(FETCH_INVITATIONS);
                    expect(emitted[1].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        it('resendInvitationEpic: 429 throttle surfaces SHOW_NOTIFICATION (not crash)', (done) => {
            mockAxios.onPost('/api/v2/anuga/projects/42/invitations/7/resend/').reply(429, {
                detail: 'Resend cooldown active'
            });

            const action$ = mockActions([{type: RESEND_INVITATION_REQUEST, invitationId: 7}]);
            const emitted = [];

            resendInvitationEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
                    done();
                });
        });

        // TASK-1230 — unrelated-action guard for the membershipEpics module.
        it('fetchInvitationsEpic only listens for FETCH_INVITATIONS action type', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            fetchInvitationsEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });

        it('revokeInvitationEpic: empty project id -> emits nothing', (done) => {
            const store = {getState: () => ({anuga: {projects: {data: null}}})};
            const action$ = mockActions([{type: REVOKE_INVITATION_REQUEST, invitationId: 1}]);
            const emitted = [];

            revokeInvitationEpic(action$, store)
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // TASK-2099 (epic 2092 W4.1) — Paywall FE: 402 interception on the
    // visibility PATCH, checkout-return parsing, and the checkout POST.
    // ─────────────────────────────────────────────────────────────────────
    describe('TASK-2099 updateProjectVisibilityEpic — 402 interception', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {updateProjectVisibilityEpic} = require('../epics/membershipEpics');
        const {
            UPDATE_PROJECT_VISIBILITY_REQUEST,
            UPDATE_PROJECT_VISIBILITY_SETTLED,
            updateProjectVisibilityRequest,
            updateProjectVisibilitySettled
        } = require('../actionsAnuga');
        const {SET_PAYWALL_UPGRADE_PROMPT} = require('../../Paywall/actions');
        const projectsReducer = require('../reducers/projectsReducer').default;
        const {getProjectVisibilityPending} = require('../selectorsAnuga');

        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('402 -> SET_PAYWALL_UPGRADE_PROMPT with checkout_url (NOT the generic error toast)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(402, {
                state: 'upgrade_prompt',
                checkout_url: 'https://example.com/commerce/checkout/create-session/',
                read_only: false
            });

            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
            const emitted = [];

            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    // TASK-2440 — the refusal AND the in-flight settle. A 402 is
                    // one of the three ways this request ends; if it did not
                    // settle, every Sharing row would stay disabled forever
                    // after a single refusal.
                    expect(emitted.length).toBe(2);
                    expect(emitted[0].type).toBe(SET_PAYWALL_UPGRADE_PROMPT);
                    expect(emitted[0].checkoutUrl).toBe('https://example.com/commerce/checkout/create-session/');
                    expect(emitted[1].type).toBe(UPDATE_PROJECT_VISIBILITY_SETTLED);
                    done();
                });
        });

        it('non-402 error still surfaces the generic SHOW_NOTIFICATION toast', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(500, {detail: 'boom'});

            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
            const emitted = [];

            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    // TASK-2440 — the toast AND the in-flight settle.
                    expect(emitted.length).toBe(2);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
                    expect(emitted[1].type).toBe(UPDATE_PROJECT_VISIBILITY_SETTLED);
                    done();
                });
        });

        // TASK-2464 (epic 2425 W2.5) — the indicator went stale because NOTHING
        // asked the server again after a visibility change. state.anuga.paywall
        // .steady has exactly one writer (SET_ANUGA_RESOURCE_PERMS), emitted by
        // exactly one thing (a getMyPerms fetch), and nothing dispatched
        // FETCH_MY_PERMS after the PATCH. The operator saw "Public — Current"
        // in the Sharing panel while the badge still read Private.
        it('SUCCESS -> dispatches a FORCED FETCH_MY_PERMS (server truth, not optimism)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(200, {
                id: 42, visibility: 'public', my_role: 'owner'
            });

            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'public'}]);
            const emitted = [];

            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    const refetch = emitted.filter(a => a.type === 'ANUGA:FETCH_MY_PERMS');
                    expect(refetch.length).toBe(1, 'no my_perms refetch after a successful visibility PATCH');
                    expect(refetch[0].projectId).toBe(42);
                    // `force` is the whole point: permsEpics' 30s dedupe is only
                    // invalidated on FAILURE, and the panel-open fetch happened
                    // seconds ago, so an unforced re-dispatch is swallowed
                    // silently. See the dedupe test below.
                    expect(refetch[0].force).toBe(true, 'the refetch is not forced — the dedupe will eat it');
                    // Still writes the server's own response and still toasts.
                    expect(emitted.some(a => a.type === 'SET_ANUGA_PROJECT_DATA')).toBe(true);
                    expect(emitted.some(a => a.type.includes('NOTIFICATION'))).toBe(true);
                    done();
                });
        });

        // AC4 — a REFUSED change must not move the indicator.
        it('402 REFUSAL -> NO refetch and NO project-data write (the server stored nothing)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(402, {
                state: 'upgrade_prompt', checkout_url: 'https://example.com/x', read_only: false
            });

            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
            const emitted = [];

            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.some(a => a.type === 'ANUGA:FETCH_MY_PERMS')).toBe(false);
                    expect(emitted.some(a => a.type === 'SET_ANUGA_PROJECT_DATA')).toBe(false);
                    expect(emitted[0].type).toBe(SET_PAYWALL_UPGRADE_PROMPT);
                    done();
                });
        });

        it('a 500 error also leaves the indicator alone', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(500, {detail: 'boom'});
            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
            const emitted = [];
            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.some(a => a.type === 'ANUGA:FETCH_MY_PERMS')).toBe(false);
                    expect(emitted.some(a => a.type === 'SET_ANUGA_PROJECT_DATA')).toBe(false);
                    done();
                });
        });

        // ── TASK-2440 (epic 2425 W4.1): the visibility in-flight flag ───────
        //
        // The reducer contract lives here beside the epic because the epic's
        // emission is only meaningful as the thing that clears this flag, and a
        // settle emitted into a reducer that ignores it is exactly the bug the
        // pair has to rule out.
        describe('visibilityPending flag (TASK-2440)', () => {
            const mount = (projects) => ({anuga: {projects}});
            const anugaApi = require('../api/anugaApi');
            const {REQUEST_DEADLINE_MS} = anugaApi;

            it('starts null', () => {
                expect(projectsReducer(undefined, {type: '@@INIT'}).visibilityPending).toBe(null);
            });

            it('UPDATE_PROJECT_VISIBILITY_REQUEST stores the REQUESTED destination, not a bare bool', () => {
                // The destination is what identifies the clicked row, so the
                // busy affordance can land on it rather than on all three.
                expect(projectsReducer(undefined, updateProjectVisibilityRequest('private')).visibilityPending)
                    .toBe('private');
                expect(projectsReducer(undefined, updateProjectVisibilityRequest('organization')).visibilityPending)
                    .toBe('organization');
                expect(projectsReducer(undefined, updateProjectVisibilityRequest('public')).visibilityPending)
                    .toBe('public');
            });

            it('the settle action returns it to null', () => {
                const armed = projectsReducer(undefined, updateProjectVisibilityRequest('private'));
                expect(projectsReducer(armed, updateProjectVisibilitySettled()).visibilityPending).toBe(null);
            });

            it('an unrelated action leaves it untouched', () => {
                const armed = projectsReducer(undefined, updateProjectVisibilityRequest('private'));
                expect(projectsReducer(armed, {type: 'SOMETHING:ELSE'}).visibilityPending).toBe('private');
            });

            it('arming does NOT touch projects.data — the flag describes the REQUEST, never the stored value', () => {
                const withData = projectsReducer(undefined, {
                    type: 'SET_ANUGA_PROJECT_DATA', data: {id: 42, visibility: 'public'}
                });
                const armed = projectsReducer(withData, updateProjectVisibilityRequest('private'));
                expect(armed.data.visibility).toBe('public');
                expect(armed.visibilityPending).toBe('private');
            });

            it('the selector reads it and is null-safe', () => {
                const armed = projectsReducer(undefined, updateProjectVisibilityRequest('organization'));
                expect(getProjectVisibilityPending(mount(armed))).toBe('organization');
                expect(getProjectVisibilityPending({})).toBe(null);
                expect(getProjectVisibilityPending({anuga: {}})).toBe(null);
                expect(getProjectVisibilityPending(undefined)).toBe(null);
            });

            // ── W3c adversarial: the flag is about ONE project ───────────────
            //
            // Nothing resets this slice on an SPA nav, so an in-flight PATCH for
            // A used to disable B's three Sharing rows and render the "Working…"
            // pill on a row nobody clicked. The reducer three cases above already
            // refuses a my_perms payload stamped for another project, and says
            // why; this is the same guard on the half TASK-2440 added later.
            describe('and it is scoped to the project it was clicked on', () => {
                const onProject = (id) => projectsReducer(undefined, {
                    type: 'SET_ANUGA_PROJECT_DATA', data: {id, visibility: 'public'}
                });

                it('records which project the request is about', () => {
                    const armed = projectsReducer(onProject(42), updateProjectVisibilityRequest('private'));
                    expect(armed.visibilityPendingProjectId).toBe(42);
                });

                it('reads through on the project it was armed for', () => {
                    const armed = projectsReducer(onProject(42), updateProjectVisibilityRequest('private'));
                    expect(getProjectVisibilityPending(mount(armed))).toBe('private');
                });

                it('goes SILENT after a nav to another project — B was never asked to change', () => {
                    let state = projectsReducer(onProject(42), updateProjectVisibilityRequest('private'));
                    state = projectsReducer(state, {
                        type: 'SET_ANUGA_PROJECT_DATA', data: {id: 77, visibility: 'public'}
                    });
                    expect(getProjectVisibilityPending(mount(state))).toBe(
                        null,
                        'a PATCH in flight for project A disabled project B\'s Sharing rows '
                        + 'and put "Working…" on one of them'
                    );
                    // The request itself is untouched — A's settle still clears it.
                    expect(state.visibilityPending).toBe('private');
                });

                it('an UNSTAMPED flag still reads through (fail-safe, matching the perms guard)', () => {
                    const armed = projectsReducer(undefined, updateProjectVisibilityRequest('private'));
                    expect(armed.visibilityPendingProjectId).toBe(null);
                    expect(getProjectVisibilityPending(mount({...armed, data: {id: 9}}))).toBe('private');
                });

                it('the settle clears the stamp with the flag', () => {
                    let state = projectsReducer(onProject(42), updateProjectVisibilityRequest('private'));
                    state = projectsReducer(state, {type: UPDATE_PROJECT_VISIBILITY_SETTLED});
                    expect(state.visibilityPending).toBe(null);
                    expect(state.visibilityPendingProjectId).toBe(null);
                });
            });

            it('SUCCESS emits exactly one settle, AFTER the project data write', (done) => {
                mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(200, {
                    id: 42, visibility: 'public', my_role: 'owner'
                });
                const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'public'}]);
                const emitted = [];
                updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        const settles = emitted.filter(a => a.type === UPDATE_PROJECT_VISIBILITY_SETTLED);
                        expect(settles.length).toBe(1);
                        // Ordering is load-bearing: unlocking the control before
                        // the new visibility is written would render an enabled
                        // row beside a stale "Current" pill for one frame.
                        const dataIdx = emitted.findIndex(a => a.type === 'SET_ANUGA_PROJECT_DATA');
                        const settleIdx = emitted.findIndex(a => a.type === UPDATE_PROJECT_VISIBILITY_SETTLED);
                        expect(dataIdx).toBeLessThan(settleIdx, 'the rows unlocked before the new visibility landed');
                        done();
                    });
            });

            // W3c adversarial — the flag has NO release but the promise settling,
            // and MapStore's ajax lib sets no axios timeout. A PATCH that
            // establishes and then stalls left all three Sharing rows disabled
            // with "Working…" pinned on one for the life of the page. Before
            // TASK-2440 the same hang left the rows usable.
            it('a STALLED request settles on the deadline rather than pinning the rows forever', (done) => {
                mockAxios.onPatch('/api/v2/anuga/projects/42/').timeout();
                const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
                const emitted = [];
                updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.some(a => a.type === UPDATE_PROJECT_VISIBILITY_SETTLED)).toBe(
                                true,
                                'a request that never answers leaves every Sharing row disabled '
                                + 'with no dismiss, no explanation and no retry short of a reload'
                            );
                            // And the customer is told, rather than left guessing.
                            expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(true);
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('the PATCH carries a request deadline', () => {
                // Structural: axios-mock-adapter cannot observe a real network
                // stall, so the behavioural test above rides its `.timeout()`
                // rejection. This pins the config that makes it reachable in a
                // browser at all.
                let seen = null;
                mockAxios.onPatch('/api/v2/anuga/projects/42/').reply((config) => {
                    seen = config.timeout;
                    return [200, {id: 42, visibility: 'private'}];
                });
                return anugaApi.updateProjectVisibility(42, 'private').then(() => {
                    expect(seen).toBe(REQUEST_DEADLINE_MS);
                });
            });

            it('a request with NO project loaded still settles — no permanent lock-out', (done) => {
                // The epic short-circuits on a missing project id. Without a
                // settle here the flag would arm on the click and never clear,
                // disabling all three rows for the rest of the session.
                const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
                const emitted = [];
                updateProjectVisibilityEpic(action$, {getState: () => ({anuga: {projects: {data: null}}})})
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(UPDATE_PROJECT_VISIBILITY_SETTLED);
                        done();
                    });
            });
        });
    });

    // TASK-2464 AC3 — "two changes in a row and BOTH are reflected". The dedupe
    // is the reason a naive one-line dispatch would not have been enough: it is
    // invalidated only on FAILURE, so within 30s of any successful fetch a
    // re-dispatch returns Observable.empty() with no HTTP call, no action and
    // no log. These drive fetchMyPermsEpic directly (the unit under test) with
    // a frozen clock, so "two in a row" means "inside the same dedupe window",
    // which is the situation that actually bit.
    describe('TASK-2464 fetchMyPermsEpic — force bypasses the dedupe', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            fetchMyPermsEpic, __resetPermsCacheForTests, __setNowForTests
        } = require('../epics/permsEpics');
        const {fetchMyPerms} = require('../actionsAnuga');

        let mockAxios;
        let calls;
        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            __resetPermsCacheForTests();
            __setNowForTests(() => 1000000); // frozen: every dispatch is "just now"
            calls = 0;
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                calls += 1;
                return [200, {my_role: 'owner', visibility: 'private',
                    paywall: {state: 'paid_private', checkout_url: null, read_only: false}}];
            });
        });
        afterEach(() => {
            mockAxios.restore();
            __resetPermsCacheForTests();
            __setNowForTests(null);
        });

        it('UNFORCED: a second dispatch inside the window is swallowed — the bug', (done) => {
            const action$ = mockActions([fetchMyPerms(42), fetchMyPerms(42)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done, () => {
                expect(calls).toBe(1);
                expect(emitted.length).toBe(1);
                done();
            });
        });

        it('FORCED: two changes in a row BOTH reach the server and BOTH update the slice', (done) => {
            const action$ = mockActions([fetchMyPerms(42, true), fetchMyPerms(42, true)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done, () => {
                expect(calls).toBe(2, 'the second forced refetch was swallowed by the dedupe');
                const perms = emitted.filter(a => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS');
                expect(perms.length).toBe(2);
                done();
            });
        });

        it('a forced fetch still RE-ARMS the window for ordinary triggers', (done) => {
            // force must bypass the gate, not disable it: an unforced dispatch
            // immediately after a forced one is still deduped.
            const action$ = mockActions([fetchMyPerms(42, true), fetchMyPerms(42)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done, () => {
                expect(calls).toBe(1);
                expect(emitted.length).toBe(1);
                done();
            });
        });
    });

    // TASK-2463 (epic 2425 W2.8) — the race `force: true` opened and W2.7 left
    // open. W2.7 turned 20 byte-identical browser-cache hits into 20 real
    // network reads; fetchMyPermsEpic answers them with mergeMap and no
    // ordering guard, so a slow tick-1 response carrying the PRE-webhook body
    // can land AFTER a later tick already delivered the post-webhook one —
    // overwriting a correct padlock with a stale "public", after takeWhile has
    // killed the poll so nothing will ever correct it again. Silent, and on the
    // money path.
    describe('TASK-2463 (W2.8) fetchMyPermsEpic — a stale response cannot win', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            fetchMyPermsEpic, __resetPermsCacheForTests, __setNowForTests
        } = require('../epics/permsEpics');
        const {fetchMyPerms} = require('../actionsAnuga');

        const body = (visibility, state) => ({
            my_role: 'owner', visibility,
            paywall: {state, checkout_url: null, read_only: false}
        });

        /**
         * Assert after `ms`, reporting a failed expectation as a FAILED TEST.
         * A bare `setTimeout(() => expect(...))` throws asynchronously, mocha
         * never sees it, and the run reports "Timeout of 2000ms exceeded" with
         * no message — which is how a genuinely red assertion can be mistaken
         * for a flaky test and re-run until it is ignored.
         */
        const assertAfter = (ms, done, fn) => setTimeout(() => {
            try {
                fn();
                done();
            } catch (err) {
                done(err);
            }
        }, ms);

        let mockAxios;
        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            __resetPermsCacheForTests();
            __setNowForTests(() => 2000000);
        });
        afterEach(() => {
            mockAxios.restore();
            __resetPermsCacheForTests();
            __setNowForTests(null);
        });

        it('a tick-1 response that arrives LAST does not overwrite the newer state', (done) => {
            // Tick 1 asks first and answers second (the pre-webhook body); tick 2
            // asks second and answers first (the post-webhook body). Exactly the
            // shape of a slow first request on a 3s poll.
            let call = 0;
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                call += 1;
                return call === 1
                    ? new Promise((resolve) => setTimeout(
                        () => resolve([200, body('public', 'free_public')]), 40))
                    : [200, body('private', 'paid_private')];
            });

            const action$ = mockActions([fetchMyPerms(42, true), fetchMyPerms(42, true)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done);

            assertAfter(120, done, () => {
                const perms = emitted.filter(a => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS');
                expect(call).toBe(2, 'both forced fetches must have reached the server');
                expect(perms.length).toBeGreaterThan(0, 'no perms action was emitted at all');
                const last = perms[perms.length - 1];
                expect(last.payload.visibility).toBe(
                    'private',
                    'the LAST write to the slice was the stale tick-1 body — the padlock '
                    + 'has just been overwritten with the pre-webhook state and the poll is dead'
                );
                expect(last.payload.paywall.state).toBe('paid_private');
                // Stronger than "the last one wins": the stale response must be
                // DROPPED, not merely re-overwritten. Re-overwriting depends on a
                // third response arriving, and after takeWhile there is none.
                expect(perms.length).toBe(
                    1,
                    'the superseded response was still applied to the store; '
                    + `emitted visibilities: ${perms.map(p => p.payload.visibility).join(',')}`
                );
            });
        });

        // TASK-2463 (epic 2425 W2.9) — W2.8's guard wrapped only the SUCCESS
        // write. The failure branch was left outside it, and it is the branch that
        // dispatches setPermsLoadFailed(true).
        //
        // The shape: tick 1 (asked first) is slow and eventually 500s after its
        // retry; tick 2 (asked second) answers fast with the post-webhook paid
        // body and is applied. Tick 1's failure then lands and flips
        // permsLoadFailed to true — which is what the V2P-02 helpers read as
        // "ignore state.anuga.resources and fall back to project my_role". So a
        // customer whose correct, paid perms are already in the store has them
        // discounted by an older request's failure, and nothing further is coming.
        it('a superseded FAILURE cannot mark the perms load failed after a newer one succeeded', (done) => {
            let call = 0;
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                call += 1;
                // Calls 1 and 3 belong to tick 1 (the request plus its single
                // 1s-backoff retry); call 2 is tick 2, which succeeds at once.
                if (call === 2) {
                    return [200, body('private', 'paid_private')];
                }
                return new Promise((resolve) => setTimeout(() => resolve([500, {}]), 20));
            });

            const action$ = mockActions([fetchMyPerms(42, true), fetchMyPerms(42, true)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done);

            // > 1s: the failure branch is only reached after the 1s backoff retry.
            assertAfter(1400, done, () => {
                const perms = emitted.filter(a => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS');
                expect(perms.length).toBe(1, 'the newer, successful response was not applied');
                expect(perms[0].payload.paywall.state).toBe('paid_private');
                expect(emitted.some(a => a.type === 'ANUGA:SET_PERMS_LOAD_FAILED')).toBe(
                    false,
                    'a superseded request\'s failure marked the perms load failed AFTER the '
                    + 'paid response had already landed — the V2P-02 helpers now discard the '
                    + 'correct perms and fall back to project my_role, and no further '
                    + 'response is coming'
                );
                expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(
                    false, 'and the customer is shown a permissions-unavailable toast as well'
                );
            });
        }).timeout(5000);

        it('a failure that is NOT superseded still reports — the guard must not silence it', (done) => {
            // The counterpart, so the fix above cannot be "never report failures".
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(500, {});
            const action$ = mockActions([fetchMyPerms(42, true)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done);
            assertAfter(1400, done, () => {
                expect(emitted.some(a => a.type === 'ANUGA:SET_PERMS_LOAD_FAILED')).toBe(
                    true, 'a genuine, un-superseded failure is now silent'
                );
                expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(true);
            });
        }).timeout(5000);

        it('two fetches for DIFFERENT projects do not cancel or drop each other', (done) => {
            // The guard must be per-project. A global "newest wins" would make an
            // SPA nav A -> B drop B's answer whenever A's landed second.
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(
                () => new Promise((resolve) => setTimeout(
                    () => resolve([200, body('private', 'paid_private')]), 30)));
            mockAxios.onGet('/api/v2/anuga/projects/43/my-perms/').reply(
                200, body('organization', 'paid_organization'));

            const action$ = mockActions([fetchMyPerms(42, true), fetchMyPerms(43, true)]);
            const emitted = [];
            fetchMyPermsEpic(action$).subscribe(a => emitted.push(a), done);

            assertAfter(120, done, () => {
                const perms = emitted.filter(a => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS');
                expect(perms.length).toBe(2, 'a per-project guard must not drop the other project');
                expect(perms.map(p => p.projectId).sort()).toEqual([42, 43]);
            });
        });
    });

    /**
     * TASK-2498 (epic 2425 W3d) — the ordering guard was blind to the ONE writer
     * that is not a my_perms response.
     *
     * fetchMyPermsEpic sequences my_perms answers against each other
     * (permsEpics.js `_fetchSeq` / `_appliedSeqByProjectId`), and the visibility
     * PATCH writes the same slice — `setAnugaProjectData(response.data)` in
     * membershipEpics' updateProjectVisibilityEpic — with NO sequence number at
     * all. So a my_perms request issued BEFORE the PATCH could be applied AFTER
     * it, and the guard had no way to know.
     *
     * The interleaving, which is the poll's own shape plus one click:
     *   t0    panel-open fetch for A is seq 1; it 500s and enters the 1s backoff.
     *   t30   the user flips A to Public. The PATCH succeeds, the store says
     *         public, the success toast fires, and the forced refetch goes out.
     *   t1000 seq 1's RETRY lands carrying the PRE-patch `private`. Nothing has
     *         been applied for A yet, so isSuperseded() is false and it wins.
     *   t1030 the forced refetch fails its second attempt, so buildFailureBranch
     *         fires setPermsLoadFailed(true) + the permsUnavailable toast — and
     *         no further response is coming.
     * The padlock is left PERMANENTLY on the pre-PATCH value with "Project is now
     * public" still on screen.
     *
     * The fix is a seam, not a new guard: the PATCH claims the next sequence
     * number from the SAME counter and records itself as the newest applied write
     * for that project. The reducer's four guards were always correct; the bug is
     * that a stale action reached them at all.
     */
    describe('TASK-2498 (W3d) — the visibility PATCH takes part in the my_perms sequence', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            fetchMyPermsEpic, __resetPermsCacheForTests, __setNowForTests
        } = require('../epics/permsEpics');
        const {updateProjectVisibilityEpic} = require('../epics/membershipEpics');
        const {
            UPDATE_PROJECT_VISIBILITY_REQUEST, FETCH_MY_PERMS, SET_ANUGA_PROJECT_DATA
        } = require('../actionsAnuga');
        const projectsReducer = require('../reducers/projectsReducer').default;

        const body = (visibility) => ({
            my_role: 'owner', visibility,
            paywall: {state: visibility === 'public' ? 'free_public' : 'paid_private',
                checkout_url: null, read_only: false}
        });

        const assertAfter = (ms, done, fn) => setTimeout(() => {
            try {
                fn();
                done();
            } catch (err) {
                done(err);
            }
        }, ms);

        let mockAxios;
        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            __resetPermsCacheForTests();
            __setNowForTests(() => 3000000);
        });
        afterEach(() => {
            mockAxios.restore();
            __resetPermsCacheForTests();
            __setNowForTests(null);
        });

        /**
         * A one-project action loop: both epics read the SAME stream, and every
         * action an epic emits is fed back in — which is what the MapStore epic
         * middleware does, and is the only way the PATCH's own
         * `fetchMyPerms(42, true)` reaches fetchMyPermsEpic.
         */
        const runLoop = (initialActions, emitted) => {
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
            const sink = (a) => {
                emitted.push(a);
                subject.next(a);
            };
            const subs = [
                fetchMyPermsEpic(action$).subscribe(sink),
                updateProjectVisibilityEpic(action$, storeWithProjectId(42)).subscribe(sink)
            ];
            setTimeout(() => initialActions.forEach(a => subject.next(a)), 0);
            return () => subs.forEach(s => s.unsubscribe());
        };

        /** Replay the emitted store writes through the real reducer, in order. */
        const finalVisibility = (emitted) => emitted
            .filter(a => a.type === SET_ANUGA_PROJECT_DATA
                || a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS')
            .reduce(
                (acc, a) => projectsReducer(acc, a),
                projectsReducer(undefined, {
                    type: SET_ANUGA_PROJECT_DATA,
                    data: {id: 42, name: 'Merewether', visibility: 'private', my_role: 'owner'}
                })
            ).data.visibility;

        it('a my_perms answer issued BEFORE the PATCH cannot be applied after it', (done) => {
            // Call order is fixed by the timers: 1 = seq-1 first attempt (t0),
            // 2 = the PATCH's forced refetch, first attempt (t~30), 3 = seq-1's
            // 1s-backoff RETRY carrying the PRE-patch body (t~1000), 4 = the
            // forced refetch's retry (t~1030). Only call 3 answers 200.
            let permsCall = 0;
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                permsCall += 1;
                return permsCall === 3 ? [200, body('private')] : [500, {}];
            });
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(
                () => new Promise((resolve) => setTimeout(
                    () => resolve([200, {id: 42, visibility: 'public', my_role: 'owner'}]), 30)));

            const emitted = [];
            const stop = runLoop([
                {type: FETCH_MY_PERMS, projectId: 42, force: true},
                {type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'public'}
            ], emitted);

            assertAfter(1500, done, () => {
                stop();
                expect(permsCall).toBe(
                    4,
                    'the interleaving did not happen as written — the assertions below '
                    + `would prove nothing. my-perms calls: ${permsCall}`
                );
                const patchWrite = emitted.findIndex(a => a.type === SET_ANUGA_PROJECT_DATA);
                expect(patchWrite > -1).toBe(true, 'the visibility PATCH never succeeded');

                const stale = emitted
                    .map((a, i) => ({a, i}))
                    .filter(({a, i}) => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS'
                        && i > patchWrite
                        && a.payload?.visibility === 'private');
                expect(stale.length).toBe(
                    0,
                    'a my_perms answer stamped BEFORE the visibility PATCH was applied '
                    + 'AFTER it, folding the pre-PATCH visibility back over the new one'
                );
                expect(finalVisibility(emitted)).toBe(
                    'public',
                    'the padlock is stranded on the pre-PATCH visibility while the '
                    + '"Project is now public" success toast is still on screen'
                );
            });
        }).timeout(5000);

        it('the failed refresh that follows still reports, and leaves the PATCHed value standing', (done) => {
            // AC3 counterpart. The forced refetch fails twice, so
            // buildFailureBranch legitimately fires setPermsLoadFailed(true) — it
            // is NOT superseded, and silencing it would be the TASK-2463 W2.9 bug
            // in reverse. What must NOT happen is the padlock reverting.
            let permsCall = 0;
            mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                permsCall += 1;
                return permsCall === 3 ? [200, body('private')] : [500, {}];
            });
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(
                () => new Promise((resolve) => setTimeout(
                    () => resolve([200, {id: 42, visibility: 'public', my_role: 'owner'}]), 30)));

            const emitted = [];
            const stop = runLoop([
                {type: FETCH_MY_PERMS, projectId: 42, force: true},
                {type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'public'}
            ], emitted);

            assertAfter(1500, done, () => {
                stop();
                expect(emitted.some(a => a.type === 'ANUGA:SET_PERMS_LOAD_FAILED')).toBe(
                    true, 'a genuine, un-superseded failure went silent'
                );
                expect(finalVisibility(emitted)).toBe('public');
            });
        }).timeout(5000);

        it('the stamp is PER PROJECT — flipping A does not supersede B\'s in-flight answer', (done) => {
            // The same trap the per-project isolation spec above guards for
            // my_perms: a global "newest wins" here would make a PATCH on A
            // discard an unrelated, newer answer for B.
            mockAxios.onGet('/api/v2/anuga/projects/43/my-perms/').reply(
                () => new Promise((resolve) => setTimeout(
                    () => resolve([200, body('private')]), 60)));
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(
                200, {id: 42, visibility: 'public', my_role: 'owner'});

            const emitted = [];
            const stop = runLoop([
                {type: FETCH_MY_PERMS, projectId: 43, force: true},
                {type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'public'}
            ], emitted);

            assertAfter(200, done, () => {
                stop();
                const forB = emitted.filter(a => a.type === 'ANUGA:SET_ANUGA_RESOURCE_PERMS'
                    && a.projectId === 43);
                expect(forB.length).toBe(
                    1, 'a PATCH on project 42 dropped project 43\'s my_perms answer'
                );
            });
        }).timeout(5000);
    });

    describe('TASK-2099 paywallEpics', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const paywallEpicsModule = require('../epics/paywallEpics');
        const {
            checkoutReturnEpic,
            pollMyPermsWhilePendingEpic,
            refreshMyPermsOnTabVisibleEpic,
            subscribeCheckoutEpic,
            clearPendingOnPurchaseRowEpic,
            CHECKOUT_ANCHOR_STORAGE_KEY,
            __resetCheckoutReturnForTests,
            __resetCheckoutDepartureForTests,
            __setPollIntervalForTests,
            __setDocumentVisibleForTests,
            __setRedirectForTests
        } = paywallEpicsModule;
        const {FETCH_MY_PERMS} = require('../actionsAnuga');
        const {
            SUBSCRIBE_CHECKOUT_REQUEST,
            SUBSCRIBE_CHECKOUT_SETTLED,
            SET_PAYWALL_PENDING,
            CLEAR_PAYWALL_PENDING
        } = require('../../Paywall/actions');
        const paywallReducer = require('../../Paywall/reducer').default;
        const {isCheckoutInFlight} = require('../../Paywall/reducer');
        const {FETCH_COMPUTE_BALANCE, SET_COMPUTE_BALANCE} = require('../../Paywall/meter/actions');
        const {FETCH_ACCOUNT_SUMMARY, SET_ACCOUNT_SUMMARY} = require('../../Paywall/account/actions');
        const SET_ANUGA_RESOURCE_PERMS = 'ANUGA:SET_ANUGA_RESOURCE_PERMS';

        let mockAxios;
        const originalPath = window.location.pathname;

        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            __resetCheckoutReturnForTests();
            // TASK-2496 AC6 — BLOCKING, not optional. The `TASK-2489 checkout
            // anchor (AC2)` block below drives several SUCCESSFUL create-sessions
            // through subscribeCheckoutEpic, which now also arms the per-tab
            // departure flag. Without this reset that flag leaks forward into
            // `refreshMyPermsOnTabVisibleEpic`'s "outside a confirmation it is
            // UNFORCED" spec and turns it red for a reason unrelated to the
            // change under test.
            __resetCheckoutDepartureForTests();
            try { window.localStorage.removeItem(CHECKOUT_ANCHOR_STORAGE_KEY); } catch (e) { /* private mode */ }
        });
        afterEach(() => {
            mockAxios.restore();
            __setPollIntervalForTests(null); // restore real interval
            __setDocumentVisibleForTests(null); // restore the real visibility probe
            __setRedirectForTests(null); // restore real redirect
            window.history.pushState({}, '', originalPath);
            try { window.localStorage.removeItem(CHECKOUT_ANCHOR_STORAGE_KEY); } catch (e) { /* private mode */ }
        });

        describe('checkoutReturnEpic', () => {
            it('?checkout=success -> emits SET_PAYWALL_PENDING + clears any stale meter modal (TASK-2100) + opens the Account panel on Billing, refreshed (TASK-2420)', (done) => {
                window.history.pushState({}, '', '?checkout=success');
                const action$ = mockActions([{type: INIT_ANUGA}]);
                const emitted = [];

                checkoutReturnEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(5);
                        expect(emitted.some(a => a.type === SET_PAYWALL_PENDING)).toBe(true);
                        expect(emitted.some(a => a.type === 'METER:DISMISS_MODAL')).toBe(true);
                        expect(emitted.some(a => a.type === 'SET_MEMBERSHIP_PANEL' && a.visible === true)).toBe(true);
                        expect(emitted.some(a => a.type === 'SET_MEMBERSHIP_PANEL_TAB' && a.tab === 'billing')).toBe(true);
                        expect(emitted.some(a => a.type === 'ACCOUNT:FETCH_SUMMARY')).toBe(true);
                        done();
                    });
            });

            it('?checkout=cancel -> emits a notification, NOT the pending overlay', (done) => {
                window.history.pushState({}, '', '?checkout=cancel');
                const action$ = mockActions([{type: INIT_ANUGA}]);
                const emitted = [];

                checkoutReturnEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toInclude('NOTIFICATION');
                        done();
                    });
            });

            it('no ?checkout param -> emits nothing', (done) => {
                const action$ = mockActions([{type: INIT_ANUGA}]);
                const emitted = [];

                checkoutReturnEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(0);
                        done();
                    });
            });

            // TASK-2486 (epic 2425 W2.9) — the module-level `_checkoutReturnHandled`
            // guard only covers repeat INIT_ANUGA within ONE page life. A RELOAD, or
            // the customer bookmarking/sharing the URL they landed on, re-reads the
            // same marker and re-arms the whole confirming flow on a checkout settled
            // minutes ago. The hash must survive because it carries the MapStore
            // route (CheckoutReturnView.APP_MAP_ROUTE is
            // `/catalogue/?checkout=success#/map/<id>`).
            it('strips ?checkout from the URL, keeping the SPA route, so a reload cannot re-arm it', (done) => {
                window.history.pushState({}, '', '/catalogue/?checkout=success&foo=1#/map/7');
                const action$ = mockActions([{type: INIT_ANUGA}]);

                checkoutReturnEpic(action$, storeWithProjectId(42))
                    .subscribe(() => {}, done, () => {
                        try {
                            expect(new URLSearchParams(window.location.search).get('checkout')).toBe(
                                null,
                                'the return marker survived in the address bar — a reload re-arms '
                                + 'the confirming flow on a purchase that already settled'
                            );
                            expect(new URLSearchParams(window.location.search).get('foo')).toBe(
                                '1', 'unrelated query params were collateral damage'
                            );
                            expect(window.location.hash).toBe(
                                '#/map/7', 'the MapStore route was dropped — the SPA lands on home'
                            );
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('a second INIT_ANUGA in the same session is deduped (no re-arm)', (done) => {
                window.history.pushState({}, '', '?checkout=success');
                const action$ = mockActions([{type: INIT_ANUGA}, {type: INIT_ANUGA}]);
                const emitted = [];

                checkoutReturnEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        // 5 actions from the ONE handled INIT_ANUGA, not 10 — the
                        // second INIT_ANUGA is a full no-op.
                        expect(emitted.length).toBe(5);
                        done();
                    });
            });
        });

        describe('pollMyPermsWhilePendingEpic', () => {
            it('polls FETCH_MY_PERMS + FETCH_COMPUTE_BALANCE on the interval while pending, stops once resolved', (done) => {
                __setPollIntervalForTests(10); // fast interval for the test
                let pending = true;
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {overlay: pending ? {state: 'pending'} : null, steady: null}
                        }
                    })
                };
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];

                const sub = pollMyPermsWhilePendingEpic(action$, store).subscribe(a => emitted.push(a));

                setTimeout(() => {
                    expect(emitted.length).toBeGreaterThan(0);
                    // TASK-2100: each tick emits BOTH the balance refresh (shared
                    // checkout-return machinery) and, when a project is known,
                    // the my_perms fetch.
                    expect(emitted.some(a => a.type === FETCH_COMPUTE_BALANCE)).toBe(true);
                    expect(emitted.some(a => a.type === FETCH_MY_PERMS)).toBe(true);
                    pending = false; // simulate the webhook flip clearing the overlay
                    const countAtClear = emitted.length;
                    setTimeout(() => {
                        // takeWhile stops emitting once isPaywallPending() goes false —
                        // the count should not keep growing unbounded.
                        expect(emitted.length).toBeLessThanOrEqualTo(countAtClear + 2);
                        sub.unsubscribe();
                        done();
                    }, 50);
                }, 35);
            });

            // TASK-2464 — every tick must be FORCED. The poll runs at 3s against
            // permsEpics' 30s dedupe window (invalidated only on failure), so
            // unforced ticks 2..10 were returning Observable.empty() with no HTTP
            // call and no log. The poll looked like it was working and was not.
            it('every FETCH_MY_PERMS tick is forced, or the dedupe eats 9 of the first 10', (done) => {
                __setPollIntervalForTests(10);
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {overlay: {state: 'pending'}, steady: null}
                        }
                    })
                };
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];
                const sub = pollMyPermsWhilePendingEpic(action$, store).subscribe(a => emitted.push(a));
                setTimeout(() => {
                    const fetches = emitted.filter(a => a.type === FETCH_MY_PERMS);
                    expect(fetches.length).toBeGreaterThan(0);
                    expect(fetches.every(a => a.force === true)).toBe(
                        true, 'an unforced poll tick is a silent no-op inside the 30s dedupe window'
                    );
                    sub.unsubscribe();
                    done();
                }, 35);
            });

            // TASK-2457 (adversarial R2) second half — an abandoned poll must not
            // strand the customer. The overlay MASKS steady in
            // getEffectivePaywallPayload, so "pending forever" means the app keeps
            // insisting it is confirming a subscription the server already
            // answered about. An un-dismissable state is a trap.
            //
            // W2.10 (operator decision 2026-07-26) restored this after W2.8 replaced
            // it with a STALL marker + a Billing-tab notice and W2.9 rewrote that
            // notice. The clear reveals `steady` and nothing more; ACKNOWLEDGING a
            // purchase whose webhook outlived the 60s budget is TASK-2489, and it
            // needs a server-side "was this session processed" read that no test
            // here can stand in for.
            it('EXHAUSTION -> emits CLEAR_PENDING rather than stopping silently', (done) => {
                __setPollIntervalForTests(1);
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            // never resolves — the lost/slow-webhook case
                            paywall: {overlay: {state: 'pending'}, steady: null}
                        }
                    })
                };
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];
                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBeGreaterThan(0);
                            // TASK-2489 — the tail now emits the give-up CLEAR
                            // followed by ONE account refetch (AC5), so the
                            // Billing panel the customer was returned to stops
                            // showing pre-purchase money. The assertion is on
                            // the PAIR and their order, not on "last action".
                            const tail = emitted.slice(-2).map(a => a.type);
                            expect(tail).toEqual(
                                [CLEAR_PAYWALL_PENDING, FETCH_ACCOUNT_SUMMARY],
                                'the poll ran out of attempts and left the overlay armed, '
                                + 'or refreshed the panel before clearing it'
                            );
                            expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length).toBe(
                                1, 'the give-up path refetched the account summary more than once'
                            );
                            // No toast either. W2.8 raised an autoDismiss:0 warning
                            // here; there is no notification-retraction path in this
                            // codebase, so it could not be taken back when the webhook
                            // landed a minute later and refuted it.
                            expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(
                                false, 'the give-up tail raised a toast nothing can take back'
                            );
                            done();
                        } catch (err) { done(err); }
                    }
                );
            });

            it('RESOLVED -> completes WITHOUT a CLEAR_PENDING (nothing left to clear)', (done) => {
                __setPollIntervalForTests(1);
                let pending = true;
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {overlay: pending ? {state: 'pending'} : null, steady: {state: 'paid_organization'}}
                        }
                    })
                };
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];
                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        expect(emitted.some(a => a.type === 'PAYWALL:CLEAR_PENDING')).toBe(false);
                        expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(false);
                        // TASK-2489 AC5 — the resolved branch still refetches the
                        // account summary EXACTLY once. The Billing tab renders the
                        // ACCOUNT slice (BillingTabContainer.js), not the per-tick
                        // meter slice, so without this the panel the customer was
                        // returned to keeps showing pre-purchase money.
                        expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length).toBe(
                            1, 'the resolved branch refetched the account summary 0 or >1 times'
                        );
                        done();
                    }
                );
                setTimeout(() => { pending = false; }, 5);
            });

            // ── W3c adversarial: giving ROW 4 the per-tick channel it lacked ──
            //
            // An account-scoped subscription bought while viewing a PUBLIC
            // project surfaces on neither my_perms nor the ledger. Without a
            // per-tick read of /commerce/account/ the notice could not be
            // retracted by anything short of the 60s tail, while the panel below
            // it already read "Active since today".
            describe('the SUBSCRIPTION anchor also polls /commerce/account/', () => {
                const pollStore = (anchor) => {
                    let pending = true;
                    return {
                        settle: () => { pending = false; },
                        getState: () => ({
                            anuga: {
                                projects: {data: {id: 42}},
                                paywall: {
                                    overlay: pending ? {state: 'pending', anchor} : null,
                                    overlayProjectId: null, steady: pending ? null : {state: 'paid_private'}
                                },
                                computeMeter: {enabled: true, balance: '0.00', recentEntries: []},
                                accountSummary: {loaded: true, subscription: {active: false, since: null}}
                            }
                        })
                    };
                };

                it('a SUBSCRIPTION anchor refetches the summary on every tick, not just at the tail', (done) => {
                    __setPollIntervalForTests(1);
                    const store = pollStore({
                        purchaseType: 'subscription', accountOnly: true, projectId: null,
                        departedAtIso: null
                    });
                    const emitted = [];
                    pollMyPermsWhilePendingEpic(mockActions([{type: SET_PAYWALL_PENDING}]), store)
                        .subscribe(a => emitted.push(a), done, () => {
                            try {
                                expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length)
                                    .toBeGreaterThan(
                                        1,
                                        'the one channel that can observe an account-scoped '
                                        + 'subscription was read once, at the 60s tail'
                                    );
                                done();
                            } catch (err) { done(err); }
                        });
                });

                it('a CREDIT-PACK anchor does NOT — its evidence is the balance row already fetched', (done) => {
                    __setPollIntervalForTests(1);
                    const store = pollStore({
                        purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
                        departedAtIso: null
                    });
                    const emitted = [];
                    pollMyPermsWhilePendingEpic(mockActions([{type: SET_PAYWALL_PENDING}]), store)
                        .subscribe(a => emitted.push(a), done, () => {
                            try {
                                expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length).toBe(
                                    1,
                                    'a credit pack is paying for a per-tick account fetch it has '
                                    + 'no use for — that is the unbounded fetch 26e4aab36 reverted'
                                );
                                done();
                            } catch (err) { done(err); }
                        });
                });
            });

            it('no project id -> still refreshes the balance (account-scoped, not project-scoped), but never emits FETCH_MY_PERMS', (done) => {
                __setPollIntervalForTests(10);
                const store = {getState: () => ({anuga: {projects: {data: null}, paywall: {overlay: {state: 'pending'}}}})};
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];

                const sub = pollMyPermsWhilePendingEpic(action$, store).subscribe(a => emitted.push(a));

                setTimeout(() => {
                    expect(emitted.length).toBeGreaterThan(0);
                    expect(emitted.every(a => a.type === FETCH_COMPUTE_BALANCE)).toBe(true);
                    sub.unsubscribe();
                    done();
                }, 35);
            });
        });

        // ─────────────────────────────────────────────────────────────────────
        // TASK-2489 (epic 2425 W3c) — the post-checkout confirmation, on the
        // channel that is actually POLLED.
        //
        // Three earlier attempts failed by inventing a client-side detector.
        // The signal was there the whole time: /commerce/balance/ is re-fetched
        // on EVERY 3s poll tick (pollMyPermsWhilePendingEpic -> fetchComputeBalance
        // -> Paywall/meter/reducer.js recentEntries), its rows carry the SERVER's
        // `created_at` (balance_views.py:73-83), and a credit pack writes exactly
        // one row with entry_type='purchase' (checkout_views.py:791-796).
        //
        // The anchor is captured BEFORE departure and persisted to localStorage,
        // because the Stripe return lands in a DIFFERENT TAB (paywallEpics.js
        // _openInNewTab) — sessionStorage and module state do not survive that.
        // Comparing a server timestamp against a server timestamp is what makes
        // this immune to the cold-boot race that defeated W2.9: the webhook is
        // allowed to win, and the FE can still see that it did.
        // ─────────────────────────────────────────────────────────────────────
        describe('TASK-2489 clearPendingOnPurchaseRowEpic', () => {
            const OLD_PURCHASE = '2026-07-27T01:00:00+00:00';
            const NEW_PURCHASE = '2026-07-27T01:00:05+00:00';

            const purchaseRow = (createdAt) => ({entry_type: 'purchase', amount: '10.00', created_at: createdAt});
            const debitRow = (createdAt) => ({entry_type: 'debit', amount: '0.42', created_at: createdAt});

            /**
             * A store already in the post-return shape: `pending` armed and
             * carrying the departure anchor checkoutReturnEpic lifted out of
             * localStorage, plus whatever the last /commerce/balance/ read left
             * in the meter slice.
             */
            const pendingStore = ({anchor, entries = [], enabled = true, balance = '5.00', pending = true}) => ({
                getState: () => ({
                    anuga: {
                        projects: {data: {id: 42}},
                        paywall: {
                            overlay: pending ? {state: 'pending', anchor: anchor || null} : null,
                            overlayProjectId: null,
                            steady: null
                        },
                        computeMeter: {enabled, balance, recentEntries: entries}
                    }
                })
            });

            const creditPackAnchor = (departedAtIso) => ({
                purchaseType: 'credit_pack',
                accountOnly: false,
                projectId: 42,
                departedAtIso
            });

            const runEpic = (actions, store, assertFn, done) => {
                const emitted = [];
                clearPendingOnPurchaseRowEpic(mockActions(actions), store).subscribe(
                    a => emitted.push(a), done, () => {
                        try { assertFn(emitted); done(); } catch (err) { done(err); }
                    }
                );
            };

            // ── THE DESIGNATED RED CRITERION (AC3) ──────────────────────────
            it('a purchase row dated AFTER the departure anchor clears the pending overlay', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor(OLD_PURCHASE),
                    entries: [purchaseRow(NEW_PURCHASE), purchaseRow(OLD_PURCHASE)]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        1, 'the detector emitted something other than exactly one clear'
                    );
                    expect(emitted[0].type).toBe(
                        CLEAR_PAYWALL_PENDING,
                        'a purchase row newer than the checkout anchor did not clear the '
                        + 'confirming state — the customer sits on "confirming" over money '
                        + 'that has already landed'
                    );
                    // AC3: the clear is the epic's ONLY output. The single account
                    // refetch belongs to the poll tail (AC5); emitting it here too
                    // would make it two.
                    expect(emitted.some(a => a.type === FETCH_ACCOUNT_SUMMARY)).toBe(
                        false, 'the detector also fetched the account summary — that is the tail\'s job'
                    );
                }, done);
            });

            it('a purchase row NOT strictly newer than the anchor is the row we already saw — no clear', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor(OLD_PURCHASE),
                    entries: [purchaseRow(OLD_PURCHASE)]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        0, 'the row present at departure was mistaken for the new purchase'
                    );
                }, done);
            });

            it('deletes the localStorage anchor when it clears, so an abandoned record cannot outlive its checkout', (done) => {
                window.localStorage.setItem(
                    CHECKOUT_ANCHOR_STORAGE_KEY, JSON.stringify(creditPackAnchor(OLD_PURCHASE))
                );
                const store = pendingStore({
                    anchor: creditPackAnchor(OLD_PURCHASE),
                    entries: [purchaseRow(NEW_PURCHASE)]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(1);
                    expect(window.localStorage.getItem(CHECKOUT_ANCHOR_STORAGE_KEY)).toBe(null);
                }, done);
            });

            // ── AC4: the cold-boot race that defeated W2.9 ──────────────────
            //
            // Stripe posts checkout.session.completed server-to-server in
            // seconds, while the return goes through a synchronous
            // Session.retrieve and then a full cold MapStore boot (13.6s median,
            // permsEpics.js:18). So the webhook routinely wins and the credit is
            // ALREADY in the very first reading the SPA takes. W2.9 adopted its
            // baseline from that first reading and could therefore never see the
            // change. A departure-time SERVER timestamp can.
            it('the webhook winning the cold-boot race is still observed — clears on the FIRST reading, no second one needed', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor(OLD_PURCHASE),
                    // The row exists at server time before this SPA even booted.
                    entries: [purchaseRow(NEW_PURCHASE)]
                });
                // SET_PAYWALL_PENDING is the arming action itself: the epic must
                // evaluate against the store as it already stands rather than
                // waiting 3s for a tick that would tell it nothing new. A design
                // that lazily adopts a baseline from a post-arming reading emits
                // nothing here, which is exactly the W2.9 defect.
                runEpic([{type: SET_PAYWALL_PENDING}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        1,
                        'the purchase had already landed before the SPA booted and the '
                        + 'confirming state never cleared — a client-side before/after '
                        + 'diff cannot see a change that happened before the client existed'
                    );
                    expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                }, done);
            });

            it('and on the FIRST SET_COMPUTE_BALANCE when the row lands mid-poll', (done) => {
                let entries = [];
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: {state: 'pending', anchor: creditPackAnchor(OLD_PURCHASE)},
                                overlayProjectId: null, steady: null
                            },
                            computeMeter: {enabled: true, balance: '5.00', recentEntries: entries}
                        }
                    })
                };
                const emitted = [];
                const subject = new Rx.Subject();
                const action$ = subject.asObservable();
                action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
                clearPendingOnPurchaseRowEpic(action$, store).subscribe(a => emitted.push(a));
                setTimeout(() => {
                    // Tick 1 — the webhook has not landed yet.
                    subject.next({type: SET_COMPUTE_BALANCE});
                    expect(emitted.length).toBe(0, 'cleared before any purchase row existed');
                    // Tick 2 — it lands.
                    entries = [purchaseRow(NEW_PURCHASE)];
                    store.getState = () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: {state: 'pending', anchor: creditPackAnchor(OLD_PURCHASE)},
                                overlayProjectId: null, steady: null
                            },
                            computeMeter: {enabled: true, balance: '15.00', recentEntries: entries}
                        }
                    });
                    subject.next({type: SET_COMPUTE_BALANCE});
                    try {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                        subject.complete();
                        done();
                    } catch (err) { done(err); }
                }, 0);
            });

            // ── AC9a: the comparison is anchor-relative, never clock-relative ──
            //
            // A `Date.now()` on either side of the freshness test makes a browser
            // whose clock runs fast see no row as new — the sticky "still
            // confirming" this task exists to prevent. Both timestamps here are
            // decades in the past, so any now-relative rule emits nothing.
            it('compares two SERVER timestamps, not the client clock', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor('2000-01-01T00:00:00+00:00'),
                    entries: [purchaseRow('2000-01-01T00:00:01+00:00')]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        1,
                        'a row one second newer than a decades-old anchor did not clear — '
                        + 'the freshness test is reading the client clock'
                    );
                }, done);
            });

            it('a row far in the FUTURE of the client clock but older than the anchor still does not clear', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor('2099-01-01T00:00:00+00:00'),
                    entries: [purchaseRow('2098-01-01T00:00:00+00:00')]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(0);
                }, done);
            });

            // ── TASK-2511 (W3d): NO FLOOR MEANS NO CLAIM ────────────────────
            //
            // The four specs that stood here pinned the old null-anchor rule and
            // its "was the balance window observed" gate. Both are DELETED, not
            // overlooked: that gate existed only because a CLIENT-side floor
            // cannot distinguish "fetched and empty" from "never fetched", and a
            // SERVER departure timestamp has no such ambiguity. What replaces
            // them is the fail-safe below.
            it('a legacy anchor with no departure timestamp never clears — fail-safe', (done) => {
                // Written by a previous bundle in another tab, or by a hydrata
                // backend deployed behind this gmc bundle. Consequence, bounded:
                // that checkout's notice runs to the 60s cap, where the poll tail
                // still dispatches clearPaywallPending() AND fetchAccountSummary(),
                // so the panel never keeps showing pre-purchase money.
                const store = pendingStore({
                    anchor: {purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
                        latestPurchaseIso: OLD_PURCHASE, balanceObserved: true},
                    entries: [purchaseRow(NEW_PURCHASE)]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        0,
                        'a legacy-shape anchor carrying no departure timestamp still '
                        + 'cleared the confirming state — that is a claim with no floor '
                        + 'behind it'
                    );
                }, done);
            });

            // ── TASK-2511 THE RED CRITERION: the SHARED ACCOUNT ──────────────
            //
            // resolve_account_for_user resolves an Account shared by every
            // AccountUser on it (on hydrata.com prod, Account pk=1 carries 47
            // users via `registered-members`), and balance_views serialises every
            // row of it. The old floor was the newest row the CLIENT happened to
            // hold at click time, refreshed only at boot / on focus / during a
            // pending poll. So a colleague's purchase, landing between this tab's
            // last balance fetch and the departure click, read as "newer than the
            // floor" and retracted THIS customer's confirmation ~3s in — ending
            // the poll before their own webhook ever landed.
            //
            // The anchor is built by running the REAL subscribeCheckoutEpic: a
            // hand-built {departedAtIso} would pass against the OLD code too
            // (no latestPurchaseIso -> the observed-window branch -> undefined ->
            // false -> zero emissions), i.e. prove nothing.
            it('a COLLEAGUE\'s purchase row, dated before departure, does NOT clear', (done) => {
                const P0 = '2026-07-20T09:00:00+00:00';
                const COLLEAGUE = '2026-07-27T09:40:00+00:00';
                const DEPARTED = '2026-07-27T09:50:00+00:00';

                mockAxios.onPost('/commerce/checkout/create-session/').reply(200, {
                    checkout_url: 'https://checkout.stripe.com/pay/cs_test_shared',
                    departed_at: DEPARTED
                });
                __setRedirectForTests(() => {});
                subscribeCheckoutEpic(
                    mockActions([{
                        type: SUBSCRIBE_CHECKOUT_REQUEST,
                        purchaseType: 'credit_pack', priceId: 'price_x'
                    }]),
                    {getState: () => ({anuga: {
                        projects: {data: {id: 42}},
                        computeMeter: {enabled: true, balance: '5.00', recentEntries: [purchaseRow(P0)]}
                    }})}
                ).subscribe(() => {}, done, () => {
                    const anchor = JSON.parse(
                        window.localStorage.getItem(CHECKOUT_ANCHOR_STORAGE_KEY)
                    );
                    const store = pendingStore({
                        anchor,
                        entries: [purchaseRow(COLLEAGUE), purchaseRow(P0)]
                    });
                    runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                        expect(emitted.length).toBe(
                            0,
                            'a purchase row belonging to another member of the SHARED '
                            + 'account, dated BEFORE this checkout departed the server, '
                            + 'retracted the confirmation and ended the poll'
                        );
                    }, done);
                });
            });

            it('the SAME account\'s row dated AFTER departure still clears', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor('2026-07-27T09:50:00+00:00'),
                    entries: [purchaseRow('2026-07-27T09:50:01+00:00')]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(
                        1, 'the customer\'s own webhook row no longer clears the notice'
                    );
                }, done);
            });

            it('a DEBIT row after departure clears nothing — only a purchase confirms a purchase', (done) => {
                // A run debited mid-checkout is not evidence of the pack landing.
                const store = pendingStore({
                    anchor: creditPackAnchor('2026-07-27T09:50:00+00:00'),
                    entries: [debitRow('2026-07-27T09:50:01+00:00')]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(0);
                }, done);
            });

            // ── W3c adversarial (money-path CRITICAL): the SUBSCRIPTION channel ──
            //
            // An account-scoped subscription bought while viewing a PUBLIC
            // project is observable on NEITHER polled channel:
            // _derive_paywall_state returns free_public before and after
            // entitlement, and a subscription writes no ledger row. So the
            // notice ran the full 60s while SubscriptionSection — four lines
            // below it in the same panel, off the same store — already read
            // "Active since today".
            describe('the SUBSCRIPTION channel (W3c adversarial)', () => {
                const subAnchor = () => ({
                    purchaseType: 'subscription', accountOnly: true, projectId: null,
                    departedAtIso: null
                });
                const subStore = ({active, loaded = true, pending = true}) => ({
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: pending ? {state: 'pending', anchor: subAnchor()} : null,
                                overlayProjectId: null, steady: null
                            },
                            computeMeter: {enabled: true, balance: '0.00', recentEntries: []},
                            accountSummary: {loaded, subscription: {active, since: active ? '2026-07-27' : null}}
                        }
                    })
                });

                it('an ACTIVE subscription on the account summary clears the pending overlay', (done) => {
                    runEpic([{type: SET_ACCOUNT_SUMMARY}], subStore({active: true}), (emitted) => {
                        expect(emitted.length).toBe(
                            1,
                            'the account summary already said the subscription was active and '
                            + 'the confirming state stayed armed — the notice and the panel '
                            + 'beneath it contradict each other for 60s'
                        );
                        expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                    }, done);
                });

                it('an INACTIVE subscription is not evidence — nothing is claimed either way', (done) => {
                    runEpic([{type: SET_ACCOUNT_SUMMARY}], subStore({active: false}), (emitted) => {
                        expect(emitted.length).toBe(0);
                    }, done);
                });

                it('an UNLOADED summary carrying a stale active flag does not clear', (done) => {
                    runEpic(
                        [{type: SET_ACCOUNT_SUMMARY}], subStore({active: true, loaded: false}),
                        (emitted) => expect(emitted.length).toBe(0), done
                    );
                });

                it('a CREDIT-PACK anchor is never cleared by subscription.active', (done) => {
                    // An entitled customer buying a pack has active===true and
                    // always did. Reading it as evidence retracts on the wrong
                    // purchase entirely.
                    const store = {
                        getState: () => ({
                            anuga: {
                                projects: {data: {id: 42}},
                                paywall: {
                                    overlay: {state: 'pending', anchor: creditPackAnchor(OLD_PURCHASE)},
                                    overlayProjectId: null, steady: null
                                },
                                computeMeter: {enabled: true, balance: '5.00', recentEntries: []},
                                accountSummary: {loaded: true, subscription: {active: true, since: '2026-01-01'}}
                            }
                        })
                    };
                    runEpic([{type: SET_ACCOUNT_SUMMARY}], store, (emitted) => {
                        expect(emitted.length).toBe(0);
                    }, done);
                });

                it('it clears on the ARMING action too, when the summary already landed', (done) => {
                    // The webhook routinely wins the cold-boot race, so the very
                    // first summary read can already be the answer.
                    runEpic([{type: SET_PAYWALL_PENDING}], subStore({active: true}), (emitted) => {
                        expect(emitted.length).toBe(1);
                    }, done);
                });
            });

            // ── Scope: a SUBSCRIPTION writes NO ledger row ──────────────────
            it('a SUBSCRIPTION anchor is never cleared by a purchase row (that channel is my_perms)', (done) => {
                // checkout_views.py has exactly one ENTRY_TYPE_PURCHASE write and
                // it is on the credit-pack path; a subscription sets
                // has_paid_private_entitlement and flips the project. Clearing a
                // subscription's confirming state off someone else's credit pack
                // would be a claim about the wrong purchase.
                const store = pendingStore({
                    anchor: {purchaseType: 'subscription', accountOnly: true, projectId: null,
                        departedAtIso: OLD_PURCHASE},
                    entries: [purchaseRow(NEW_PURCHASE)]
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(0);
                }, done);
            });

            it('no anchor (localStorage unavailable, or a return this tab did not start) -> no clear', (done) => {
                const store = pendingStore({anchor: null, entries: [purchaseRow(NEW_PURCHASE)]});
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(0);
                }, done);
            });

            it('not pending -> inert, so a later purchase cannot re-fire it', (done) => {
                const store = pendingStore({
                    anchor: creditPackAnchor(OLD_PURCHASE),
                    entries: [purchaseRow(NEW_PURCHASE)],
                    pending: false
                });
                runEpic([{type: SET_COMPUTE_BALANCE}], store, (emitted) => {
                    expect(emitted.length).toBe(0);
                }, done);
            });
        });

        // ─────────────────────────────────────────────────────────────────────
        // TASK-2489 AC2 — the departure anchor, and AC9b: it is persisted where
        // a DIFFERENT TAB can read it.
        // ─────────────────────────────────────────────────────────────────────
        describe('TASK-2489 checkout anchor (AC2)', () => {
            const storeWithMeter = (meter) => ({
                getState: () => ({anuga: {projects: {data: {id: 42}}, computeMeter: meter}})
            });
            const readAnchor = () => JSON.parse(window.localStorage.getItem(CHECKOUT_ANCHOR_STORAGE_KEY));

            const DEPARTED_AT = '2026-07-27T09:50:00+00:00';

            const departAndAssert = (store, assertFn, done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply(200, {
                    checkout_url: 'https://checkout.stripe.com/pay/cs_test_anchor',
                    // TASK-2511 — the SERVER's departure timestamp, which is now
                    // the anchor's only floor.
                    departed_at: DEPARTED_AT
                });
                __setRedirectForTests(() => {});
                const action$ = mockActions([
                    {type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'credit_pack', priceId: 'price_x'}
                ]);
                subscribeCheckoutEpic(action$, store).subscribe(() => {}, done, () => {
                    try { assertFn(readAnchor()); done(); } catch (err) { done(err); }
                });
            };

            // ── TASK-2511 (W3d): INVERTED, deliberately ──────────────────────
            //
            // This spec used to assert the anchor persisted "the newest purchase
            // row's SERVER created_at, verbatim". That floor was a snapshot of a
            // SHARED account's ledger taken at click time, so it could not
            // establish what its docstring claimed. Same three-row meter window;
            // the assertion is now that the rows did NOT influence the anchor at
            // all, and that the floor is the server's own departure stamp.
            it('persists the SERVER departure timestamp, and no reading of the ledger', (done) => {
                departAndAssert(
                    storeWithMeter({
                        enabled: true, balance: '5.00',
                        recentEntries: [
                            {entry_type: 'purchase', amount: '10.00', created_at: '2026-07-27T01:00:00+00:00'},
                            {entry_type: 'debit', amount: '2.00', created_at: '2026-07-27T02:00:00+00:00'},
                            {entry_type: 'purchase', amount: '10.00', created_at: '2026-07-26T09:00:00+00:00'}
                        ]
                    }),
                    (anchor) => {
                        expect(anchor.departedAtIso).toBe(
                            DEPARTED_AT,
                            'the anchor did not carry the server departure timestamp verbatim'
                        );
                        expect(anchor.purchaseType).toBe('credit_pack');
                        expect(Object.keys(anchor).sort()).toEqual(
                            ['accountOnly', 'departedAtIso', 'projectId', 'purchaseType'],
                            'the anchor still carries a field derived from the meter slice'
                        );
                    },
                    done
                );
            });

            // The meter slice no longer reaches the anchor at all, so the four
            // specs that pinned its shapes (DARK, no-account, never-fetched, and
            // debit-only) are DELETED rather than left asserting fields that do
            // not exist. This one covers what actually matters now: whatever the
            // meter says, the floor is the server's.
            it('the DARK meter shape changes nothing — the floor is the server\'s', (done) => {
                departAndAssert(
                    storeWithMeter({enabled: false, balance: null, recentEntries: []}),
                    (anchor) => expect(anchor.departedAtIso).toBe(DEPARTED_AT),
                    done
                );
            });

            it('a backend with no departed_at yields a floorless anchor, not a guess', (done) => {
                // A hydrata deployed behind this gmc bundle. The compare side
                // then refuses to clear at all (see the fail-safe spec above).
                mockAxios.onPost('/commerce/checkout/create-session/')
                    .reply(200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_legacy'});
                __setRedirectForTests(() => {});
                subscribeCheckoutEpic(
                    mockActions([{
                        type: SUBSCRIBE_CHECKOUT_REQUEST,
                        purchaseType: 'credit_pack', priceId: 'price_x'
                    }]),
                    storeWithMeter({enabled: true, balance: '5.00', recentEntries: []})
                ).subscribe(() => {}, done, () => {
                    try {
                        expect(readAnchor().departedAtIso).toBe(null);
                        done();
                    } catch (err) { done(err); }
                });
            });

            // W3c adversarial — THE RECORD IS CONSUMED, not merely read. Its
            // three deletion sites all missed the commonest success path (a
            // subscription clearing via the PAID steady state happens in a
            // REDUCER, which cannot reach localStorage), so the record survived
            // indefinitely and a later checkout whose own write threw inherited
            // a months-old floor.
            it('checkoutReturnEpic DELETES the record once it has lifted it into the store', (done) => {
                window.localStorage.setItem(CHECKOUT_ANCHOR_STORAGE_KEY, JSON.stringify({
                    purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
                    departedAtIso: '2026-07-27T01:00:00+00:00'
                }));
                window.history.pushState({}, '', '?checkout=success');
                const emitted = [];
                checkoutReturnEpic(mockActions([{type: INIT_ANUGA}]), storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.find(a => a.type === SET_PAYWALL_PENDING).anchor).toNotBe(null);
                            expect(window.localStorage.getItem(CHECKOUT_ANCHOR_STORAGE_KEY)).toBe(
                                null,
                                'the departure record outlived the return that consumed it — '
                                + 'a later checkout can adopt it as its own floor'
                            );
                            done();
                        } catch (err) { done(err); }
                    });
            });

            // AC9b — the Stripe return lands in a NEW TAB (_openInNewTab), so a
            // module-level variable or sessionStorage would be gone by the time
            // anything reads it. checkoutReturnEpic must pick the record up out
            // of localStorage, which is the only store the other tab shares.
            it('checkoutReturnEpic lifts an anchor written by ANOTHER TAB onto SET_PAYWALL_PENDING', (done) => {
                const written = {
                    purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
                    departedAtIso: '2026-07-27T01:00:00+00:00'
                };
                // Written by the originating tab; this tab shares nothing else.
                window.localStorage.setItem(CHECKOUT_ANCHOR_STORAGE_KEY, JSON.stringify(written));
                window.history.pushState({}, '', '?checkout=success');
                const emitted = [];
                checkoutReturnEpic(mockActions([{type: INIT_ANUGA}]), storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            const armed = emitted.find(a => a.type === SET_PAYWALL_PENDING);
                            expect(armed.anchor).toEqual(
                                written,
                                'the departure anchor did not survive into the return tab — '
                                + 'the detector has nothing to compare against'
                            );
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('a corrupt or absent record degrades to no anchor rather than throwing', (done) => {
                window.localStorage.setItem(CHECKOUT_ANCHOR_STORAGE_KEY, 'not json{');
                window.history.pushState({}, '', '?checkout=success');
                const emitted = [];
                checkoutReturnEpic(mockActions([{type: INIT_ANUGA}]), storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(5);
                            expect(emitted.find(a => a.type === SET_PAYWALL_PENDING).anchor).toBe(null);
                            done();
                        } catch (err) { done(err); }
                    });
            });
        });

        // ─────────────────────────────────────────────────────────────────────
        // TASK-2489 AC5 — ONE account refetch per armed checkout, EDGE-triggered.
        //
        // Both tests run the module's WHOLE epic set (Object.values of its default
        // export) rather than the poll epic alone. That is deliberate: the
        // forbidden mechanism is a NEW epic on SET_ANUGA_RESOURCE_PERMS that
        // fetches whenever the state is paid, and a test aimed only at the poll
        // would stay green while it shipped. Enumerating the default export means
        // any epic added to this module is counted here automatically.
        // ─────────────────────────────────────────────────────────────────────
        describe('TASK-2489 exactly-one account refetch (AC5)', () => {
            const allEpics = () => Object.keys(paywallEpicsModule.default)
                .map(k => paywallEpicsModule.default[k]);

            const paidPerms = () => ({
                type: SET_ANUGA_RESOURCE_PERMS,
                projectId: 42,
                payload: {paywall: {state: 'paid_private', checkout_url: null, read_only: false}}
            });

            /** A stream we can feed on a schedule; mockActions fires everything at once. */
            const timedActions = () => {
                const subject = new Rx.Subject();
                const action$ = subject.asObservable();
                action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
                return {action$, emit: (a) => subject.next(a), end: () => subject.complete()};
            };

            it('the confirming edge refetches the account summary exactly once', (done) => {
                __setPollIntervalForTests(2);
                let pending = true;
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: pending ? {state: 'pending', anchor: null} : null,
                                overlayProjectId: null,
                                steady: pending ? null : {state: 'paid_private'}
                            },
                            computeMeter: {enabled: true, balance: '0.00', recentEntries: []}
                        }
                    })
                };
                const {action$, emit, end} = timedActions();
                const emitted = [];
                const sub = Rx.Observable.merge(...allEpics().map(e => e(action$, store)))
                    .subscribe(a => emitted.push(a));

                emit({type: SET_PAYWALL_PENDING});
                // The webhook flips the project: the reducer's PAID_STEADY_STATES
                // case nulls the overlay (Paywall/reducer.js:85-88). A reducer
                // cannot dispatch, which is exactly why the tail exists.
                setTimeout(() => { pending = false; }, 8);
                setTimeout(() => {
                    try {
                        expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length).toBe(
                            1,
                            'the Billing tab renders the ACCOUNT slice, so without exactly one '
                            + 'refetch on the confirming edge it shows pre-purchase money over '
                            + 'an unlocked padlock'
                        );
                        sub.unsubscribe(); end(); done();
                    } catch (err) { sub.unsubscribe(); end(); done(err); }
                }, 120);
            });

            // THE TEST THAT FALSIFIES THE FORBIDDEN EPIC (AC18). An epic on
            // SET_ANUGA_RESOURCE_PERMS that fetches whenever paywall.state is paid
            // fires on EVERY 3s tick for as long as the customer is paid — the
            // per-tick account fetch 26e4aab36 reverted. It passes the test above
            // and fails this one.
            it('subsequent PAID ticks do NOT refetch again — the per-tick fetch stays reverted', (done) => {
                __setPollIntervalForTests(2);
                let pending = true;
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: pending ? {state: 'pending', anchor: null} : null,
                                overlayProjectId: null,
                                steady: pending ? null : {state: 'paid_private'}
                            },
                            computeMeter: {enabled: true, balance: '0.00', recentEntries: []}
                        }
                    })
                };
                const {action$, emit, end} = timedActions();
                const emitted = [];
                const sub = Rx.Observable.merge(...allEpics().map(e => e(action$, store)))
                    .subscribe(a => emitted.push(a));

                emit({type: SET_PAYWALL_PENDING});
                setTimeout(() => { pending = false; }, 8);
                // Three more paid my_perms readings, exactly as the poll would
                // deliver them while the customer keeps looking at the map.
                [40, 60, 80].forEach(t => setTimeout(() => emit(paidPerms()), t));
                setTimeout(() => {
                    try {
                        const fetches = emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY);
                        expect(fetches.length).toBe(
                            1,
                            `${fetches.length} account-summary fetches: a paid steady state is `
                            + 'firing one per tick, which is the reverted per-tick fetch (AC9c)'
                        );
                        sub.unsubscribe(); end(); done();
                    } catch (err) { sub.unsubscribe(); end(); done(err); }
                }, 160);
            });

            it('the credit-pack path clears AND refetches once, with no duplicate from the detector', (done) => {
                __setPollIntervalForTests(2);
                let pending = true;
                const anchor = {
                    purchaseType: 'credit_pack', accountOnly: false, projectId: 42,
                    departedAtIso: '2026-07-27T01:00:00+00:00'
                };
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: pending ? {state: 'pending', anchor} : null,
                                overlayProjectId: null, steady: null
                            },
                            computeMeter: {
                                enabled: true, balance: '15.00',
                                recentEntries: [{
                                    entry_type: 'purchase', amount: '10.00',
                                    created_at: '2026-07-27T01:00:05+00:00'
                                }]
                            }
                        }
                    })
                };
                const {action$, emit, end} = timedActions();
                const emitted = [];
                const sub = Rx.Observable.merge(...allEpics().map(e => e(action$, store)))
                    // The real store would reduce the clear; mirror that so the
                    // poll's takeWhile sees it.
                    .subscribe(a => {
                        emitted.push(a);
                        if (a.type === CLEAR_PAYWALL_PENDING) pending = false;
                    });

                emit({type: SET_PAYWALL_PENDING});
                setTimeout(() => {
                    try {
                        expect(emitted.some(a => a.type === CLEAR_PAYWALL_PENDING)).toBe(true);
                        expect(emitted.filter(a => a.type === FETCH_ACCOUNT_SUMMARY).length).toBe(
                            1, 'the detector and the tail both fetched the summary'
                        );
                        sub.unsubscribe(); end(); done();
                    } catch (err) { sub.unsubscribe(); end(); done(err); }
                }, 120);
            });
        });

        describe('refreshMyPermsOnTabVisibleEpic', () => {
            const fireVisibilityChange = () => {
                document.dispatchEvent(new Event('visibilitychange'));
            };
            const stateWith = (pending) => ({
                anuga: {
                    projects: {data: {id: 42}},
                    paywall: {overlay: pending ? {state: 'pending'} : null, steady: null}
                }
            });

            it('a tab becoming visible re-reads my_perms — FORCED while a purchase is being confirmed', (done) => {
                __setDocumentVisibleForTests(() => true);
                const emitted = [];
                const sub = refreshMyPermsOnTabVisibleEpic(
                    mockActions([]), {getState: () => stateWith(true)}
                ).subscribe(a => emitted.push(a));
                fireVisibilityChange();
                setTimeout(() => {
                    try {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(FETCH_MY_PERMS);
                        expect(emitted[0].projectId).toBe(42);
                        expect(emitted[0].force).toBe(true);
                        sub.unsubscribe();
                        done();
                    } catch (err) { sub.unsubscribe(); done(err); }
                }, 400);
            });

            it('outside a confirmation it is UNFORCED, so tab-flipping cannot become a fetch per switch', (done) => {
                __setDocumentVisibleForTests(() => true);
                const emitted = [];
                const sub = refreshMyPermsOnTabVisibleEpic(
                    mockActions([]), {getState: () => stateWith(false)}
                ).subscribe(a => emitted.push(a));
                fireVisibilityChange();
                setTimeout(() => {
                    try {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].force).toBe(
                            false, 'an unconditional forced refetch on every tab switch defeats the 30s dedupe'
                        );
                        sub.unsubscribe();
                        done();
                    } catch (err) { sub.unsubscribe(); done(err); }
                }, 400);
            });

            // Two separate subscriptions, deliberately: both epics listen to the
            // SAME document event, so a single test that flips the probe mid-way
            // has the first subscription react to the second event too. That is
            // how the first draft of this test reported a phantom emission.
            it('emits NOTHING when the document is going HIDDEN', (done) => {
                __setDocumentVisibleForTests(() => false);
                const emitted = [];
                const sub = refreshMyPermsOnTabVisibleEpic(
                    mockActions([]), {getState: () => stateWith(true)}
                ).subscribe(a => emitted.push(a));
                fireVisibilityChange();
                setTimeout(() => {
                    try {
                        expect(emitted.length).toBe(0);
                        sub.unsubscribe();
                        done();
                    } catch (err) { sub.unsubscribe(); done(err); }
                }, 400);
            });

            it('emits NOTHING when no project is loaded (my_perms is project-scoped)', (done) => {
                __setDocumentVisibleForTests(() => true);
                const emitted = [];
                const sub = refreshMyPermsOnTabVisibleEpic(
                    mockActions([]), {getState: () => ({anuga: {projects: {data: null}, paywall: {}}})}
                ).subscribe(a => emitted.push(a));
                fireVisibilityChange();
                setTimeout(() => {
                    try {
                        expect(emitted.length).toBe(0);
                        sub.unsubscribe();
                        done();
                    } catch (err) { sub.unsubscribe(); done(err); }
                }, 400);
            });

            // ── TASK-2496 (epic 2425 W3d): THE ORIGINATING TAB ───────────────
            //
            // `force` was `confirming`, and `confirming` is isPaywallPending —
            // which is armed ONLY by checkoutReturnEpic off a ?checkout=success
            // marker. Checkout opens in a NEW tab (UAT-2), so the tab the
            // customer STARTED from never sees that marker and `confirming` is
            // structurally false there, for the whole life of the page.
            //
            // The old justification measured the wrong interval: "the customer
            // was away completing a Stripe checkout, which takes far longer than
            // 30s". permsEpics' gate is keyed to the last ACTUAL FETCH IN THIS
            // TAB, not to time away — so a mid-checkout glance back at the map
            // re-stamps it and the post-payment refresh is swallowed.
            describe('TASK-2496 the per-tab checkout-departure flag', () => {
                const {
                    fetchMyPermsEpic, __resetPermsCacheForTests, __setNowForTests
                } = require('../epics/permsEpics');
                const {fetchMyPerms} = require('../actionsAnuga');

                // These are permsEpics seams and are NOT restored by the outer
                // afterEach, so a frozen clock would leak into every later spec
                // in this 3800-line file.
                afterEach(() => {
                    __resetPermsCacheForTests();
                    __setNowForTests(null);
                });

                /**
                 * Arm the departure THROUGH THE REAL WIRING — a successful
                 * create-session driven through subscribeCheckoutEpic — rather
                 * than by poking module state. Poking it would pass even if the
                 * set site were deleted.
                 */
                const departFromThisTab = (onArmed, done) => {
                    mockAxios.onPost('/commerce/checkout/create-session/')
                        .reply(200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_depart'});
                    __setRedirectForTests(() => {});
                    subscribeCheckoutEpic(
                        mockActions([{
                            type: SUBSCRIBE_CHECKOUT_REQUEST,
                            purchaseType: 'credit_pack', priceId: 'price_x'
                        }]),
                        storeWithProjectId(42)
                    ).subscribe(() => {}, done, () => {
                        try { onArmed(); } catch (err) { done(err); }
                    });
                };

                // ── AC5: THE RED ONE ─────────────────────────────────────────
                //
                // The exact interleaving, through BOTH epics composed, asserting
                // a real HTTP my_perms lands. t=0 flip to Stripe; t=60 a glance
                // back at the map (a real fetch, stamp = 60); t=80 pay, t=82 the
                // webhook lands; t=85 return -> 85-60 = 25s < 30s, so the
                // unforced refetch was Observable.empty(): no HTTP, no action,
                // no log, and the padlock stays stale.
                it('the post-payment refresh is NOT swallowed by the 30s dedupe', (done) => {
                    let nowMs = 0;
                    let calls = 0;
                    __resetPermsCacheForTests();
                    __setNowForTests(() => nowMs);
                    mockAxios.onGet('/api/v2/anuga/projects/42/my-perms/').reply(() => {
                        calls += 1;
                        return [200, {my_role: 'owner', visibility: 'private',
                            paywall: {state: 'paid_private', checkout_url: null, read_only: false}}];
                    });

                    departFromThisTab(() => {
                        // t=60: the customer glances back at the map. A real,
                        // unforced fetch — this is the stamp that defeats them.
                        nowMs = 60000;
                        fetchMyPermsEpic(mockActions([fetchMyPerms(42)]))
                            .subscribe(() => {}, done, () => {
                                try {
                                    expect(calls).toBe(1, 'the t=60 stamping fetch never happened');
                                } catch (err) { done(err); return; }

                                // t=85: they come back from Stripe, having paid.
                                nowMs = 85000;
                                __setDocumentVisibleForTests(() => true);
                                const emitted = [];
                                const sub = refreshMyPermsOnTabVisibleEpic(
                                    mockActions([]), {getState: () => stateWith(false)}
                                ).subscribe(a => emitted.push(a));
                                fireVisibilityChange();
                                setTimeout(() => {
                                    sub.unsubscribe();
                                    try {
                                        expect(emitted.length).toBe(1);
                                    } catch (err) { done(err); return; }
                                    fetchMyPermsEpic(mockActions([emitted[0]]))
                                        .subscribe(() => {}, done, () => {
                                            try {
                                                expect(calls).toBe(
                                                    2,
                                                    'the originating tab is 25s inside the dedupe '
                                                    + 'window and the post-payment refresh was '
                                                    + 'swallowed — the customer who has paid sees '
                                                    + 'an unpaid padlock'
                                                );
                                                done();
                                            } catch (err) { done(err); }
                                        });
                                }, 400);
                            });
                    }, done);
                });

                // ── AC2: consumed AFTER the projectId filter, never before ────
                //
                // The `.map` that computes `confirming` runs on EVERY visible
                // transition, including ones that emit nothing because no project
                // is loaded yet. Consuming there burns the flag on a
                // visibilitychange that produces no action, and the forced
                // refetch is then lost permanently.
                it('a visibilitychange that emits NOTHING does not burn the flag', (done) => {
                    __setDocumentVisibleForTests(() => true);
                    let loadedId = null;
                    const store = {getState: () => ({
                        anuga: {
                            projects: {data: loadedId === null ? null : {id: loadedId}},
                            paywall: {overlay: null, steady: null}
                        }
                    })};

                    departFromThisTab(() => {
                        const emitted = [];
                        const sub = refreshMyPermsOnTabVisibleEpic(
                            mockActions([]), store
                        ).subscribe(a => emitted.push(a));
                        fireVisibilityChange();
                        setTimeout(() => {
                            try {
                                expect(emitted.length).toBe(
                                    0, 'my_perms is project-scoped — nothing should have been emitted'
                                );
                            } catch (err) { sub.unsubscribe(); done(err); return; }
                            loadedId = 42;
                            fireVisibilityChange();
                            setTimeout(() => {
                                sub.unsubscribe();
                                try {
                                    expect(emitted.length).toBe(1);
                                    expect(emitted[0].force).toBe(
                                        true,
                                        'the departure was consumed by a visibilitychange that '
                                        + 'emitted no action, so the forced refetch is lost forever'
                                    );
                                    done();
                                } catch (err) { done(err); }
                            }, 400);
                        }, 400);
                    }, done);
                });

                // ── AC3: exactly ONCE per checkout, not once per focus ────────
                //
                // This is the whole rate story, and the reason the consume must
                // be its own statement rather than the right operand of `||`:
                // `confirming || _consumeCheckoutDeparture()` short-circuits, so
                // the flag would survive any focus taken while a confirmation is
                // already in flight and later behaviour becomes order-dependent.
                it('is consumed EXACTLY ONCE — the second and third focus are unforced again', (done) => {
                    __setDocumentVisibleForTests(() => true);
                    departFromThisTab(() => {
                        const emitted = [];
                        const sub = refreshMyPermsOnTabVisibleEpic(
                            mockActions([]), {getState: () => stateWith(false)}
                        ).subscribe(a => emitted.push(a));
                        fireVisibilityChange();
                        setTimeout(() => {
                            fireVisibilityChange();
                            setTimeout(() => {
                                fireVisibilityChange();
                                setTimeout(() => {
                                    sub.unsubscribe();
                                    try {
                                        expect(emitted.length).toBe(3);
                                        expect(emitted[0].force).toBe(
                                            true, 'the departure never forced anything'
                                        );
                                        expect(emitted[1].force).toBe(
                                            false,
                                            'one checkout bought MORE than one forced my_perms — '
                                            + 'ordinary tab-flipping is turning into a fetch per switch'
                                        );
                                        expect(emitted[2].force).toBe(false);
                                        done();
                                    } catch (err) { done(err); }
                                }, 400);
                            }, 400);
                        }, 400);
                    }, done);
                });

                // AC8 — the pending-poll path is untouched: with `pending` armed
                // the emission is forced whether or not a departure was recorded.
                it('a pending confirmation still forces, with no departure recorded', (done) => {
                    __setDocumentVisibleForTests(() => true);
                    const emitted = [];
                    const sub = refreshMyPermsOnTabVisibleEpic(
                        mockActions([]), {getState: () => stateWith(true)}
                    ).subscribe(a => emitted.push(a));
                    fireVisibilityChange();
                    setTimeout(() => {
                        sub.unsubscribe();
                        try {
                            expect(emitted.length).toBe(1);
                            expect(emitted[0].force).toBe(true);
                            done();
                        } catch (err) { done(err); }
                    }, 400);
                });

                // A create-session that returned NO url means nothing left the
                // tab, so there is nothing to come back from.
                it('a FAILED create-session arms nothing', (done) => {
                    __setDocumentVisibleForTests(() => true);
                    mockAxios.onPost('/commerce/checkout/create-session/').reply(200, {});
                    __setRedirectForTests(() => {});
                    subscribeCheckoutEpic(
                        mockActions([{
                            type: SUBSCRIBE_CHECKOUT_REQUEST,
                            purchaseType: 'credit_pack', priceId: 'price_x'
                        }]),
                        storeWithProjectId(42)
                    ).subscribe(() => {}, done, () => {
                        const emitted = [];
                        const sub = refreshMyPermsOnTabVisibleEpic(
                            mockActions([]), {getState: () => stateWith(false)}
                        ).subscribe(a => emitted.push(a));
                        fireVisibilityChange();
                        setTimeout(() => {
                            sub.unsubscribe();
                            try {
                                expect(emitted.length).toBe(1);
                                expect(emitted[0].force).toBe(
                                    false,
                                    'a create-session that produced no checkout url still bought '
                                    + 'a forced refetch — nothing left the tab'
                                );
                                done();
                            } catch (err) { done(err); }
                        }, 400);
                    });
                });
            });
        });

        describe('subscribeCheckoutEpic', () => {
            it('POSTs create-session then redirects to the returned session.url (never a raw <a href> nav)', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    expect(JSON.parse(config.data)).toEqual({purchase_type: 'subscription', project_id: 42});
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_abc'}];
                });
                let redirectedTo = null;
                __setRedirectForTests((url) => { redirectedTo = url; });

                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                const emitted = [];

                subscribeCheckoutEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        // TASK-2441 — the redirect is still the substantive side
                        // effect, but the in-flight flag must also be cleared:
                        // the new tab leaves THIS page alive, so nothing else
                        // ever would (see AC#3).
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SUBSCRIBE_CHECKOUT_SETTLED);
                        expect(redirectedTo).toBe('https://checkout.stripe.com/pay/cs_test_abc');
                        done();
                    });
            });

            // W3c adversarial — TASK-2441's flag has no release but the promise
            // settling, and MapStore's ajax lib sets no axios timeout. A
            // create-session that establishes and then stalls therefore left
            // EVERY buy control in the app disabled for the life of the page —
            // and `exhaustMap` swallowed every retry click on top. Before 2441 a
            // second click at least started a fresh POST.
            it('a STALLED create-session settles on the deadline, so the buy controls come back', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').timeout();
                __setRedirectForTests(() => {});
                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                const emitted = [];
                subscribeCheckoutEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.some(a => a.type === SUBSCRIBE_CHECKOUT_SETTLED)).toBe(
                                true,
                                'a request that never answers locks every buy control in the '
                                + 'app until the page is reloaded'
                            );
                            expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(true);
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('the create-session POST carries a request deadline', () => {
                const anugaApi = require('../api/anugaApi');
                let seen = null;
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    seen = config.timeout;
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_x'}];
                });
                return anugaApi.createCheckoutSession(42, 'subscription').then(() => {
                    expect(seen).toBe(anugaApi.REQUEST_DEADLINE_MS);
                });
            });

            // ── W3d: the customer is sold the tier they actually chose ──────
            //
            // The 402 branch kept only checkout_url, the session carried no
            // visibility, and the webhook flipped to a hardcoded 'private'. A
            // customer who picked Organization paid for Organization and got
            // Private, with no surface saying so.
            it('sends desired_visibility from the live refusal, so Organization is what is bought', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    expect(JSON.parse(config.data)).toEqual({
                        purchase_type: 'subscription',
                        project_id: 42,
                        desired_visibility: 'organization'
                    });
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_org'}];
                });
                __setRedirectForTests(() => {});

                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: {
                                    state: 'upgrade_prompt',
                                    checkout_url: 'https://x/',
                                    read_only: false,
                                    visibility: 'organization'
                                },
                                overlayProjectId: 42
                            }
                        }
                    })
                };
                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                subscribeCheckoutEpic(action$, store)
                    .subscribe(() => {}, done, () => done());
            });

            it('omits desired_visibility when the armed refusal belongs to ANOTHER project', (done) => {
                // The wrong-project purchase: a refusal armed on project 7 must
                // not decide what tier project 42 is bought at. Routed through
                // the same stamp guard as the modal itself.
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    expect(JSON.parse(config.data)).toEqual({
                        purchase_type: 'subscription',
                        project_id: 42
                    });
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_x'}];
                });
                __setRedirectForTests(() => {});

                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            paywall: {
                                overlay: {
                                    state: 'upgrade_prompt',
                                    checkout_url: 'https://x/',
                                    read_only: false,
                                    visibility: 'organization'
                                },
                                overlayProjectId: 7
                            }
                        }
                    })
                };
                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                subscribeCheckoutEpic(action$, store)
                    .subscribe(() => {}, done, () => done());
            });

            it('accountOnly (Billing tab Subscribe) POSTs create-session with NO project_id', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    // UAT-2: account-scoped subscription — no project rides the
                    // session, so no post-payment visibility flip.
                    expect(JSON.parse(config.data)).toEqual({purchase_type: 'subscription'});
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_acct'}];
                });
                let redirectedTo = null;
                __setRedirectForTests((url) => { redirectedTo = url; });

                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription', accountOnly: true}]);
                const emitted = [];

                subscribeCheckoutEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SUBSCRIBE_CHECKOUT_SETTLED);
                        expect(redirectedTo).toBe('https://checkout.stripe.com/pay/cs_test_acct');
                        done();
                    });
            });

            it('sends return_map_id (the viewed map) so a project-less session returns to the map, not app home', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply((config) => {
                    expect(JSON.parse(config.data)).toEqual({purchase_type: 'subscription', return_map_id: '1418'});
                    return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_rmid'}];
                });
                let redirectedTo = null;
                __setRedirectForTests((url) => { redirectedTo = url; });

                const store = {
                    getState: () => ({
                        anuga: { projects: { data: { id: null } } },
                        gnresource: { id: '1418' }
                    })
                };
                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription', accountOnly: true}]);
                const emitted = [];

                subscribeCheckoutEpic(action$, store)
                    .subscribe(a => emitted.push(a), done, () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SUBSCRIBE_CHECKOUT_SETTLED);
                        expect(redirectedTo).toBe('https://checkout.stripe.com/pay/cs_test_rmid');
                        done();
                    });
            });

            it('API error -> emits SHOW_NOTIFICATION at level error (no crash, no redirect)', (done) => {
                mockAxios.onPost('/commerce/checkout/create-session/').reply(400, {error: 'boom'});
                let redirectedTo = null;
                __setRedirectForTests((url) => { redirectedTo = url; });

                const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                const emitted = [];

                subscribeCheckoutEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        // TASK-2441 — notification AND the in-flight clear, so a
                        // failed create is retryable.
                        expect(emitted.length).toBe(2);
                        expect(emitted[0].type).toInclude('NOTIFICATION');
                        // UAT-2 green-error-toast regression: show()'s level is
                        // its SECOND ARG — a level key inside opts is silently
                        // overwritten to 'success'.
                        expect(emitted[0].level).toBe('error');
                        expect(emitted[1].type).toBe(SUBSCRIBE_CHECKOUT_SETTLED);
                        expect(redirectedTo).toBe(null);
                        done();
                    });
            });

            // ── TASK-2441 (epic 2425 W4.2): two clicks, ONE Stripe session ──
            //
            // The headline defect. `switchMap` is NOT a double-submit guard:
            // anugaApi.createCheckoutSession(...) is invoked EAGERLY in the
            // projection, so the first POST has already left the browser by the
            // time the second action unsubscribes the first inner stream.
            // `exhaustMap` is the guard — it never enters the projection at all
            // while the first inner stream is running.
            describe('double-submit guard (TASK-2441)', () => {
                // The store stub reduces through the REAL paywall reducer as
                // each action is emitted, in redux-observable's REAL order:
                // reducer first, epic second (redux-observable@0.19.0,
                // createEpicMiddleware.js:79-80). mockActions pairs with a
                // STATIC store, which would prove nothing here.
                //
                // That ordering is also why the guard cannot be the store read
                // `.filter(() => !isCheckoutInFlight(store.getState()))` this
                // task first specified: the flag is armed by the reducer before
                // the epic ever sees the action, so such a filter refuses the
                // FIRST click too and every buy control is dead. This test
                // caught exactly that (it reported "0 Stripe checkout sessions"
                // for two clicks), so keep the reduce-then-emit order below —
                // a stub that emits before reducing would let the broken design
                // pass.
                const storeReducingPaywall = (projectId) => {
                    let paywall = paywallReducer(undefined, {type: '@@INIT'});
                    return {
                        getState: () => ({anuga: {projects: {data: {id: projectId}}, paywall}}),
                        __reduce: (action) => { paywall = paywallReducer(paywall, action); }
                    };
                };
                const actionsThroughStore = (actions, store) => {
                    const subject = new Rx.Subject();
                    const action$ = subject.asObservable();
                    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
                    setTimeout(() => {
                        actions.forEach(a => { store.__reduce(a); subject.next(a); });
                        subject.complete();
                    }, 0);
                    return action$;
                };

                it('a second click while a create is in flight POSTs create-session exactly ONCE', (done) => {
                    let posts = 0;
                    mockAxios.onPost('/commerce/checkout/create-session/').reply(() => {
                        posts += 1;
                        return [200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_dupe'}];
                    });
                    __setRedirectForTests(() => {});

                    const store = storeReducingPaywall(42);
                    const action$ = actionsThroughStore([
                        {type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'credit_pack', priceId: 'price_x'},
                        {type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'credit_pack', priceId: 'price_x'}
                    ], store);

                    subscribeCheckoutEpic(action$, store).subscribe(() => {}, done, () => {
                        // Counted on the POST handler, NOT inferred from an
                        // absent second redirect: two live Stripe sessions is
                        // the defect, and the second one redirects nowhere.
                        setTimeout(() => {
                            try {
                                expect(posts).toBe(1, `two clicks created ${posts} Stripe checkout sessions`);
                                done();
                            } catch (err) { done(err); }
                        }, 100);
                    });
                });

                it('a 200 carrying NO checkout_url still clears the flag (no permanent lock-out)', (done) => {
                    mockAxios.onPost('/commerce/checkout/create-session/').reply(200, {});
                    let redirectedTo = null;
                    __setRedirectForTests((url) => { redirectedTo = url; });

                    const action$ = mockActions([{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}]);
                    const emitted = [];

                    subscribeCheckoutEpic(action$, storeWithProjectId(42))
                        .subscribe(a => emitted.push(a), done, () => {
                            // This branch used to emit NOTHING at all, which with
                            // a flag added disables every buy control forever.
                            expect(emitted.length).toBe(1);
                            expect(emitted[0].type).toBe(SUBSCRIBE_CHECKOUT_SETTLED);
                            expect(redirectedTo).toBe(null);
                            done();
                        });
                });

                it('the flag ends up clear after a successful create, so the NEXT purchase is possible', (done) => {
                    mockAxios.onPost('/commerce/checkout/create-session/')
                        .reply(200, {checkout_url: 'https://checkout.stripe.com/pay/cs_test_ok'});
                    __setRedirectForTests(() => {});

                    const store = storeReducingPaywall(42);
                    const action$ = actionsThroughStore(
                        [{type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType: 'subscription'}], store
                    );

                    subscribeCheckoutEpic(action$, store).subscribe(
                        (a) => { store.__reduce(a); },
                        done,
                        () => {
                            setTimeout(() => {
                                try {
                                    expect(isCheckoutInFlight(store.getState())).toBe(false);
                                    done();
                                } catch (err) { done(err); }
                            }, 100);
                        }
                    );
                });
            });
        });
    });
});

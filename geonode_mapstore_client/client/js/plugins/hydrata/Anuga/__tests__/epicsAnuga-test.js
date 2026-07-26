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
        const {UPDATE_PROJECT_VISIBILITY_REQUEST} = require('../actionsAnuga');
        const {SET_PAYWALL_UPGRADE_PROMPT} = require('../../Paywall/actions');

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
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_PAYWALL_UPGRADE_PROMPT);
                    expect(emitted[0].checkoutUrl).toBe('https://example.com/commerce/checkout/create-session/');
                    done();
                });
        });

        it('non-402 error still surfaces the generic SHOW_NOTIFICATION toast', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/42/').reply(500, {detail: 'boom'});

            const action$ = mockActions([{type: UPDATE_PROJECT_VISIBILITY_REQUEST, visibility: 'private'}]);
            const emitted = [];

            updateProjectVisibilityEpic(action$, storeWithProjectId(42))
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toInclude('NOTIFICATION');
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

    describe('TASK-2099 paywallEpics', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        const {
            checkoutReturnEpic,
            pollMyPermsWhilePendingEpic,
            clearPendingOnBalanceIncreaseEpic,
            recheckPaymentEpic,
            refreshMyPermsOnTabVisibleEpic,
            subscribeCheckoutEpic,
            PAYWALL_POLL_MAX_ATTEMPTS,
            PAYWALL_POLL_SLOW_ATTEMPTS,
            __resetCheckoutReturnForTests,
            __setPollIntervalForTests,
            __setDocumentVisibleForTests,
            __setRedirectForTests
        } = require('../epics/paywallEpics');
        const {FETCH_MY_PERMS} = require('../actionsAnuga');
        const {
            SUBSCRIBE_CHECKOUT_REQUEST, SET_PAYWALL_PENDING, CLEAR_PAYWALL_PENDING
        } = require('../../Paywall/actions');
        const {FETCH_COMPUTE_BALANCE, SET_COMPUTE_BALANCE} = require('../../Paywall/meter/actions');
        const {SET_ACCOUNT_SUMMARY} = require('../../Paywall/account/actions');

        let mockAxios;
        const originalPath = window.location.pathname;

        beforeEach(() => {
            mockAxios = new MockAdapter(axios);
            __resetCheckoutReturnForTests();
        });
        afterEach(() => {
            mockAxios.restore();
            __setPollIntervalForTests(null); // restore real interval
            __setDocumentVisibleForTests(null); // restore the real visibility probe
            __setRedirectForTests(null); // restore real redirect
            window.history.pushState({}, '', originalPath);
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
            it('polls FETCH_MY_PERMS + FETCH_COMPUTE_BALANCE on the interval while pending, and stops after the clear', (done) => {
                __setPollIntervalForTests(1);
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

                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        try {
                            // TASK-2100: each tick emits BOTH the balance refresh (shared
                            // checkout-return machinery) and, when a project is known,
                            // the my_perms fetch.
                            expect(emitted.some(a => a.type === FETCH_COMPUTE_BALANCE)).toBe(true);
                            expect(emitted.some(a => a.type === FETCH_MY_PERMS)).toBe(true);
                            // The clear happens at tick ~2, but the poll does NOT stop
                            // there: TASK-2486 (W2.9) gives it a floor of the whole fast
                            // phase. It DOES stop at the floor rather than running the
                            // slow phase out.
                            const ticks = emitted.filter(a => a.type === FETCH_MY_PERMS).length;
                            expect(ticks).toBe(
                                PAYWALL_POLL_MAX_ATTEMPTS,
                                'the poll ran past its floor after the overlay cleared — the '
                                + 'terminal marker is what ends it, not the clear'
                            );
                            done();
                        } catch (err) { done(err); }
                    }
                );
                setTimeout(() => { pending = false; }, 3);
            });

            // TASK-2486 (epic 2425 W2.9) — THE MINIMUM FLOOR, and the regression it
            // repairs. The poll's lifetime used to be exactly the overlay's, so any
            // clear stopped the balance refresh with it. A customer who was ALREADY
            // subscribed and bought a credit pack has `subscription.active` true in
            // the very first summary, so Paywall/reducer.js cleared at tick 1 and the
            // refresh died ~3s in — while the 20 x 3s poll that predates W2.8 would
            // have kept reading for a minute and picked the pack up. That is a shape
            // made strictly WORSE by W2.8 than by the code before it.
            it('keeps refreshing the balance for the whole fast phase after an early clear (W2.9)', (done) => {
                __setPollIntervalForTests(1);
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
                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        try {
                            const balances = emitted.filter(a => a.type === FETCH_COMPUTE_BALANCE).length;
                            expect(balances).toBe(
                                PAYWALL_POLL_MAX_ATTEMPTS,
                                'the overlay cleared at the first tick and took the balance '
                                + 'refresh with it — an already-subscribed customer who just '
                                + 'bought a credit pack is left with a stale balance and no notice'
                            );
                            done();
                        } catch (err) { done(err); }
                    }
                );
                // Clear immediately — the already-subscribed-buys-a-pack shape.
                setTimeout(() => { pending = false; }, 0);
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

            // TASK-2457 (W2.5) required the poll to stop stranding the customer in
            // `pending`, and it did that by CLEARING the overlay. TASK-2463 (W2.8)
            // is the other half: W2.5 also deleted PendingSpinner, so from that
            // point clearing the overlay revealed NOTHING — a webhook slower than
            // 60s left no padlock, no spinner, no toast and no retry, with every
            // surface reading the pre-payment state. Silence is not an acceptable
            // terminal state on the money path.
            //
            // This test drives the epic to exhaustion and then reduces what it
            // emitted through the REAL paywall reducer, because "did the customer
            // end up with a signal" is a question about resulting STATE, not about
            // which action name was last.
            it('EXHAUSTION -> the customer is NOT left silent (W2.8)', (done) => {
                __setPollIntervalForTests(1);
                const store = {
                    getState: () => ({
                        anuga: {
                            projects: {data: {id: 42}},
                            // never resolves — the lost/slow-webhook case. `steady`
                            // is the pre-payment answer the server keeps giving.
                            paywall: {overlay: {state: 'pending'}, steady: {state: 'free_public'}}
                        }
                    })
                };
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];
                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        // try/catch, not a bare assertion: a throw from inside a
                        // subscribe COMPLETE handler never reaches mocha, which
                        // reports "Timeout of 2000ms exceeded" with no message —
                        // and a red assertion that looks like a flaky timeout is a
                        // red assertion that gets re-run until it is ignored.
                        try {
                            expect(emitted.length).toBeGreaterThan(0);
                            const paywallReducer = require('../../Paywall/reducer').default;
                            let st = paywallReducer(undefined, {type: 'PAYWALL:SET_PENDING'});
                            emitted.forEach(a => { st = paywallReducer(st, a); });
                            expect(st.overlay).toNotBe(
                                null,
                                'the poll gave up and disarmed the overlay, and W2.5 deleted the '
                                + 'only thing that rendered it — the customer has PAID and every '
                                + 'surface now reads the pre-payment state with no acknowledgement '
                                + 'of any kind'
                            );
                            expect(st.overlay.stalled).toBe(
                                true,
                                'the overlay survived but nothing marked it, so the Billing tab '
                                + 'still shows the bare spinner copy with no way to re-check'
                            );
                            // TASK-2486 (W2.9). W2.8 ALSO raised a warning toast here
                            // with autoDismiss: 0. There is no notification-retraction
                            // path in this codebase (`grep -rn "hide(" js/plugins/hydrata`
                            // finds one unrelated hit in SimpleView Tooltip.js), so that
                            // toast outlived its own refutation: on the subscription path
                            // the webhook lands a minute later, the padlock goes private,
                            // and a permanent toast sits on screen contradicting it. The
                            // marker above is state-driven and retracts with the state.
                            expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(
                                false,
                                'the give-up tail raised a toast that nothing in this codebase '
                                + 'can ever take back'
                            );
                            done();
                        } catch (err) {
                            done(err);
                        }
                    }
                );
            });

            // TASK-2463 (W2.8) — the budget itself. The old poll was 20 x 3s = 60s,
            // described in its own comment as "comfortably longer than a normal
            // webhook round trip" — which covered only the customers who never
            // needed a poll. A second, slower phase runs after it. Asserted by
            // COUNTING ticks rather than by reading the constants back, so shrinking
            // phase 2 to nothing goes red.
            it('runs BOTH phases before giving up, not just the fast one', (done) => {
                __setPollIntervalForTests(1);
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
                pollMyPermsWhilePendingEpic(action$, store).subscribe(
                    a => emitted.push(a), done, () => {
                        try {
                            const ticks = emitted.filter(a => a.type === FETCH_MY_PERMS).length;
                            expect(PAYWALL_POLL_SLOW_ATTEMPTS).toBeGreaterThan(0);
                            expect(ticks).toBe(
                                PAYWALL_POLL_MAX_ATTEMPTS + PAYWALL_POLL_SLOW_ATTEMPTS,
                                'the poll gave up after the fast phase alone — a webhook retry '
                                + 'measured in minutes is exactly the case the budget exists for'
                            );
                            done();
                        } catch (err) {
                            done(err);
                        }
                    }
                );
            });

            it('RESOLVED -> completes WITHOUT stalling the overlay (nothing to confirm)', (done) => {
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
                        // Neither the give-up marker nor a toast: the happy path must
                        // stay completely quiet. Both names are asserted so that
                        // renaming the give-up action cannot make this vacuous.
                        expect(emitted.some(a => a.type === 'PAYWALL:STALL_PENDING')).toBe(false);
                        expect(emitted.some(a => a.type === 'PAYWALL:CLEAR_PENDING')).toBe(false);
                        expect(emitted.some(a => a.type === 'SHOW_NOTIFICATION')).toBe(false);
                        done();
                    }
                );
                setTimeout(() => { pending = false; }, 5);
            });

            it('no project id -> still refreshes the ACCOUNT-scoped endpoints, but never emits FETCH_MY_PERMS', (done) => {
                __setPollIntervalForTests(10);
                const store = {getState: () => ({anuga: {projects: {data: null}, paywall: {overlay: {state: 'pending'}}}})};
                const action$ = mockActions([{type: 'PAYWALL:SET_PENDING'}]);
                const emitted = [];

                const sub = pollMyPermsWhilePendingEpic(action$, store).subscribe(a => emitted.push(a));

                setTimeout(() => {
                    try {
                        expect(emitted.length).toBeGreaterThan(0);
                        // Both account-scoped fetches are legitimate without a project;
                        // a project-scoped my_perms fetch is not (it would 404 on
                        // `undefined`). W2.8 added the summary refetch — the balance
                        // alone cannot confirm an account-scoped subscription.
                        expect(emitted.some(a => a.type === FETCH_COMPUTE_BALANCE)).toBe(true);
                        expect(emitted.some(a => a.type === 'ACCOUNT:FETCH_SUMMARY')).toBe(true);
                        expect(emitted.some(a => a.type === FETCH_MY_PERMS)).toBe(false);
                        sub.unsubscribe();
                        done();
                    } catch (err) {
                        sub.unsubscribe();
                        done(err);
                    }
                }, 35);
            });
        });

        // TASK-2486 (epic 2425 W2.9) — the CREDIT PACK's confirmation channel.
        //
        // Verified in the backend before this was written, because W2.8 wired its
        // clear to a field the pack never touches: commerce/checkout_views.py's
        // stripe_webhook routes `metadata.purchase_type == 'credit_pack'` to
        // _handle_credit_pack_checkout_completed, which writes ONE
        // ComputeLedgerEntry and never sets has_paid_private_entitlement (the
        // field AccountSummaryView serialises as `subscription.active`) and never
        // flips Project.visibility. So for an UNSUBSCRIBED pack buyer — 84 of 84
        // prod owners have no subscription — neither of W2.8's two clears could
        // EVER fire, and the poll always ran its full 5-minute budget before
        // telling a customer whose balance was already correct that it was "still
        // confirming" their purchase.
        describe('clearPendingOnBalanceIncreaseEpic (W2.9)', () => {
            const meterStore = (balance, pendingRef) => ({
                getState: () => ({
                    anuga: {
                        computeMeter: {balance},
                        paywall: {overlay: pendingRef.pending ? {state: 'pending'} : null, steady: null}
                    }
                })
            });

            it('a credit pack landing mid-poll clears the overlay — the balance is its ONLY signal', (done) => {
                const pendingRef = {pending: true};
                const action$ = mockActions([
                    {type: SET_PAYWALL_PENDING},
                    // Cold tab: the SPA has no balance yet when the overlay arms,
                    // so the first reading is the BASELINE, not a confirmation.
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '4.00'}},
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '4.00'}},
                    // The webhook credits the ledger.
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '54.00'}}
                ]);
                const emitted = [];
                clearPendingOnBalanceIncreaseEpic(action$, meterStore(null, pendingRef))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(
                                1,
                                'the compute balance went up by the price of a pack and nothing '
                                + 'disarmed the confirming notice — for an unsubscribed pack buyer '
                                + 'no other channel can'
                            );
                            expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                            expect(emitted[0].reason).toBe('balance');
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('a balance re-read UNCHANGED on every tick never clears (2486 AC1/AC4)', (done) => {
                const pendingRef = {pending: true};
                const ticks = [{type: SET_PAYWALL_PENDING}];
                for (let i = 0; i < 12; i++) {
                    ticks.push({type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '4.00'}});
                }
                const action$ = mockActions(ticks);
                const emitted = [];
                clearPendingOnBalanceIncreaseEpic(action$, meterStore(null, pendingRef))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(
                                0,
                                'the overlay was disarmed merely because a balance ACTION arrived; '
                                + 'the poll emits one every tick whether or not anything landed'
                            );
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('a DEBIT mid-poll re-baselines, so the credit that follows is still seen', (done) => {
                const pendingRef = {pending: true};
                const action$ = mockActions([
                    {type: SET_PAYWALL_PENDING},
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '50.00'}},
                    // A run dispatched from another tab debits more than the pack
                    // is worth. Without a re-baseline the credit below stays under
                    // the original 50.00 and is never observed.
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '20.00'}},
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '30.00'}}
                ]);
                const emitted = [];
                clearPendingOnBalanceIncreaseEpic(action$, meterStore('50.00', pendingRef))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(
                                1, 'a debit during the poll permanently masked the credit after it'
                            );
                            expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('the ACCOUNT SUMMARY carries the balance too, so either endpoint can confirm', (done) => {
                const pendingRef = {pending: true};
                const action$ = mockActions([
                    {type: SET_PAYWALL_PENDING},
                    {type: SET_ACCOUNT_SUMMARY, data: {balance: '0.00', subscription: {active: false}}},
                    {type: SET_ACCOUNT_SUMMARY, data: {balance: '25.00', subscription: {active: false}}}
                ]);
                const emitted = [];
                clearPendingOnBalanceIncreaseEpic(action$, meterStore(null, pendingRef))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(1);
                            expect(emitted[0].type).toBe(CLEAR_PAYWALL_PENDING);
                            done();
                        } catch (err) { done(err); }
                    });
            });

            it('stops watching once the overlay is no longer pending', (done) => {
                const pendingRef = {pending: true};
                const action$ = mockActions([
                    {type: SET_PAYWALL_PENDING},
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '4.00'}},
                    // The subscription clear (Paywall/reducer.js SET_ACCOUNT_SUMMARY)
                    // has already disarmed the overlay by this point.
                    {type: 'MARK_RESOLVED'},
                    {type: SET_COMPUTE_BALANCE, data: {enabled: true, balance: '99.00'}}
                ]);
                const emitted = [];
                // Flip the store's answer as the marker action goes past.
                action$.filter(a => a.type === 'MARK_RESOLVED')
                    .subscribe(() => { pendingRef.pending = false; });
                clearPendingOnBalanceIncreaseEpic(action$, meterStore(null, pendingRef))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(
                                0,
                                'a balance increase after the overlay was already cleared still '
                                + 'emitted a clear — it would disarm the NEXT purchase notice'
                            );
                            done();
                        } catch (err) { done(err); }
                    });
            });
        });

        // TASK-2463 (epic 2425 W2.8) — the two extra ways a customer can get an
        // answer once the poll is no longer the only mechanism.
        describe('recheckPaymentEpic ("Check again")', () => {
            it('re-asks all three channels, and my_perms FORCED', (done) => {
                const action$ = mockActions([{type: 'PAYWALL:RECHECK_PAYMENT'}]);
                const emitted = [];
                recheckPaymentEpic(action$, storeWithProjectId(42))
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.some(a => a.type === FETCH_COMPUTE_BALANCE)).toBe(true);
                            expect(emitted.some(a => a.type === 'ACCOUNT:FETCH_SUMMARY')).toBe(true);
                            const perms = emitted.filter(a => a.type === FETCH_MY_PERMS);
                            expect(perms.length).toBe(1);
                            // Unforced, a press made within 30s of the last poll tick
                            // would be swallowed by permsEpics' dedupe and the button
                            // would silently do nothing — which is when an impatient
                            // customer presses it.
                            expect(perms[0].force).toBe(true, 'the re-check is swallowed by the 30s dedupe');
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
            });

            it('with no project loaded it still re-asks the account-scoped channels', (done) => {
                const action$ = mockActions([{type: 'PAYWALL:RECHECK_PAYMENT'}]);
                const emitted = [];
                recheckPaymentEpic(action$, {getState: () => ({anuga: {projects: {data: null}}})})
                    .subscribe(a => emitted.push(a), done, () => {
                        try {
                            expect(emitted.length).toBe(2);
                            expect(emitted.some(a => a.type === FETCH_MY_PERMS)).toBe(false);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
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
                        expect(emitted.length).toBe(0); // no action emitted; redirect is the side effect
                        expect(redirectedTo).toBe('https://checkout.stripe.com/pay/cs_test_abc');
                        done();
                    });
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
                        expect(emitted.length).toBe(0);
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
                        expect(emitted.length).toBe(0);
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
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toInclude('NOTIFICATION');
                        // UAT-2 green-error-toast regression: show()'s level is
                        // its SECOND ARG — a level key inside opts is silently
                        // overwritten to 'success'.
                        expect(emitted[0].level).toBe('error');
                        expect(redirectedTo).toBe(null);
                        done();
                    });
            });
        });
    });
});

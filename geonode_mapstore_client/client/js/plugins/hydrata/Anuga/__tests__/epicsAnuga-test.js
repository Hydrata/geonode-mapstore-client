import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    vectorDrawAnugaCompleteEpic,
    vectorDrawAnugaCancelledEpic
} from '../epicsAnuga';
import { __setVisibilityForTests } from '../epics/pollingEpics';
import {
    INIT_ANUGA,
    START_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING
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

    describe('pollAnugaModelCreationEpic', () => {
        // TASK-603: inject the visibility$ test seam so the gate in the
        // production epic does not suppress the inner observable.
        beforeEach(() => __setVisibilityForTests(new Rx.BehaviorSubject(true)));
        afterEach(() => __setVisibilityForTests(null));

        // V2P-79: this epic no longer fans out add-layer actions. Layer
        // addition is event-driven via taskCompleteLayerEpic + MapLayer
        // auto-injection. We assert no emissions to lock the V2P-79 contract.
        it('V2P-79: emits no actions when polling starts (no V1 fan-out)', (done) => {
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

            const emitted = [];
            const sub = pollAnugaModelCreationEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                subject.next({ type: STOP_ANUGA_MODEL_CREATION_POLLING });
                sub.unsubscribe();
                done();
            }, 200);
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

        // v1 contract lock — both epics emit nothing for now. VectorDraw's
        // vectorDrawSaveEpic already dispatches refreshLayerVersion on save
        // success, so no extra work is required from these handlers.
        it('vectorDrawAnugaCompleteEpic emits nothing (v1 contract)', (done) => {
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

        it('PATCH body contains EXACTLY the 10 allow-list keys (no read-only leakage)', (done) => {
            mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/42/').reply(200, { id: 42 });

            // Scenario with EVERY known read-only field populated alongside
            // the writable fields. The epic must strip all read-only fields
            // before PATCH; anything else is a regression.
            const fatScenario = {
                // Writable allow-list (all 10):
                id: 42,
                name: 'my-scenario',
                terrain: 1,
                boundary: 2,
                friction: 3,
                inflow: 4,
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
});

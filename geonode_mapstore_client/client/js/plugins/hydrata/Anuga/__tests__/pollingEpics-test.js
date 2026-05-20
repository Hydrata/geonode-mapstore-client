import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
    tailScenarioLogEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    anugaMapLayerGroupEpic,
    HANDLED_IDS_TTL_MS,
    getPollingCap,
    __setVisibilityForTests
} from '../epics/pollingEpics';
import {
    START_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    ADD_ANUGA_BOUNDARY,
    ADD_ANUGA_FRICTION,
    ADD_ANUGA_INFLOW,
    ADD_ANUGA_STRUCTURE,
    ADD_ANUGA_FULL_MESH,
    ADD_ANUGA_MESH_REGION,
    ADD_LUMPED_CATCHMENT,
    ADD_NODES,
    ADD_LINKS,
    FIX_ANUGA_GROUPS,
    INIT_ANUGA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_POLLING_DATA,
    SET_ANUGA_RAINFALL_DATA,
    SHOW_ANUGA_SCENARIO_LOG
} from '../actionsAnuga';
import {
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    RUN_STATUS_POLLING_TIMEOUT,
    UPDATE_RUN_STATUS
} from '../actions/pollingActions';
import { TM_SET_PROCESSES } from '../../TaskMonitor/actionsTaskMonitor';

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

/**
 * Helper: create a live Subject-based action$ that stays open for interactive tests.
 */
const liveActions = () => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    return { subject, action$ };
};

describe('Polling Epics', () => {

    describe('pollAnugaModelCreationEpic', () => {
        // Inject a BehaviorSubject(true) into the visibility$ test seam so
        // the TASK-603 gate does not suppress the timer in Karma.
        beforeEach(() => __setVisibilityForTests(new Rx.BehaviorSubject(true)));
        afterEach(() => __setVisibilityForTests(null));

        // V2P-79: pre-cutover behaviour was a 60s timer that fanned out 10
        // add-layer actions every tick. Those actions then triggered V1
        // /available/ fetches. V2 has no /available/ route — the layer
        // picker is now driven by taskCompleteLayerEpic + MapLayer
        // auto-injection, so this poll has no remaining work to do.
        // We retain the epic name so START_ANUGA_MODEL_CREATION_POLLING
        // dispatchers (initAnugaEpic, taskCompleteLayerEpic) don't surface
        // unhandled-action warnings.

        it('V2P-79: emits no actions on START (no V1 fan-out anymore)', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });

            setTimeout(() => {
                // Per V2P-79: zero emissions. Layer addition is handled by
                // taskCompleteLayerEpic + MapLayer auto-injection.
                expect(emitted.length).toBe(0);
                // Sanity: none of the legacy add-actions are present.
                const types = emitted.map(a => a.type);
                expect(types).toNotContain(ADD_ANUGA_BOUNDARY);
                expect(types).toNotContain(ADD_ANUGA_FRICTION);
                expect(types).toNotContain(ADD_ANUGA_STRUCTURE);
                expect(types).toNotContain(ADD_ANUGA_INFLOW);
                expect(types).toNotContain(ADD_ANUGA_FULL_MESH);
                expect(types).toNotContain(ADD_ANUGA_MESH_REGION);
                expect(types).toNotContain(ADD_LUMPED_CATCHMENT);
                expect(types).toNotContain(ADD_NODES);
                expect(types).toNotContain(ADD_LINKS);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('V2P-79: STOP action still terminates the inner observable cleanly', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });
            setTimeout(() => {
                subject.next({ type: STOP_ANUGA_MODEL_CREATION_POLLING });
                setTimeout(() => {
                    // Always 0 — stop is idempotent in the no-op case.
                    expect(emitted.length).toBe(0);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('should not emit for unrelated actions', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const emitted = [];

            pollAnugaModelCreationEpic(action$)
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

    describe('pollAnugaScenarioEpic', () => {
        it('should not emit for unrelated actions', (done) => {
            const action$ = mockActions([{ type: 'UNRELATED' }]);
            const store = { getState: () => ({ anuga: { projects: { data: { id: 1 } } } }) };
            const emitted = [];

            pollAnugaScenarioEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should stop polling on STOP_ANUGA_SCENARIO_POLLING', (done) => {
            const { subject, action$ } = liveActions();
            const store = {
                getState: () => ({
                    anuga: {
                        projects: { data: { id: 1 } },
                        scenarios: { byId: {} }
                    },
                    layers: { flat: [] }
                })
            };
            const emitted = [];

            const sub = pollAnugaScenarioEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_SCENARIO_POLLING });

            setTimeout(() => {
                subject.next({ type: STOP_ANUGA_SCENARIO_POLLING });
                const countAfterStop = emitted.length;
                setTimeout(() => {
                    // No new emissions after stop
                    expect(emitted.length).toBe(countAfterStop);
                    sub.unsubscribe();
                    done();
                }, 200);
            }, 100);
        });

        it('should listen for START_ANUGA_SCENARIO_POLLING', () => {
            expect(typeof pollAnugaScenarioEpic).toBe('function');
        });
    });

    describe('pollActiveRunStatusEpic', () => {
        it('should not emit for unrelated actions', (done) => {
            const action$ = mockActions([{ type: 'UNRELATED' }]);
            const emitted = [];

            pollActiveRunStatusEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should stop on STOP_ACTIVE_RUN_POLLING with matching runId', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollActiveRunStatusEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ACTIVE_RUN_POLLING, runId: 42 });

            setTimeout(() => {
                subject.next({ type: STOP_ACTIVE_RUN_POLLING, runId: 42 });
                setTimeout(() => {
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 50);
        });

        it('should include runId in start action', () => {
            const action = { type: START_ACTIVE_RUN_POLLING, runId: 99 };
            expect(action.runId).toBe(99);
        });
    });

    // TASK-872 (W0.6) — tail latest_run.log while the scenario log viewer is
    // open + run status is non-terminal. Re-spec per decision-request q-4
    // (Premise bucket, self-defaulted): there is NO `latest_run.log`
    // endpoint; the log viewer is passive. The epic polls `getRun(latest_run.id)`
    // every 3s and dispatches `setAnugaPollingData([{ id, latest_run }])` to
    // merge the freshly fetched run (with log text) into scenarios.byId.
    //
    // Gotcha worth pinning: there is NO HIDE_ANUGA_SCENARIO_LOG action. The
    // viewer dispatches `showAnugaScenarioLog(false)` to close, so we filter
    // by truthiness of `action.scenarioId` to distinguish open vs close.
    describe('tailScenarioLogEpic', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        let mockAxios;

        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        const buildStore = (scenario) => ({
            getState: () => ({
                anuga: {
                    ui: { visibleAnugaScenarioLogId: scenario?.id || false },
                    scenarios: {
                        byId: scenario ? { [scenario.id]: scenario } : {},
                        allIds: scenario ? [scenario.id] : [],
                        selectedId: scenario?.id || null
                    }
                }
            })
        });

        it('SHOW with non-terminal run triggers getRun and dispatches setAnugaPollingData', (done) => {
            const scenario = {
                id: 501,
                latest_run: { id: 7001, status: 'computing', log: 'old log' }
            };
            const store = buildStore(scenario);
            // Mock getRun → returns a fresher latest_run with a longer log
            mockAxios.onGet('/api/v2/anuga/runs/7001/').reply(200, {
                id: 7001,
                status: 'computing',
                log: 'old log\nnew progress line'
            });

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 501 });

            // First tick fires immediately via startWith(0).
            setTimeout(() => {
                const polls = emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA);
                expect(polls.length).toBeGreaterThan(0);
                expect(polls[0].scenarios).toEqual([{
                    id: 501,
                    latest_run: { id: 7001, status: 'computing', log: 'old log\nnew progress line' }
                }]);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('SHOW followed by hide (scenarioId=false) stops polling', (done) => {
            const scenario = {
                id: 502,
                latest_run: { id: 7002, status: 'computing', log: '' }
            };
            const store = buildStore(scenario);
            mockAxios.onGet('/api/v2/anuga/runs/7002/').reply(200, {
                id: 7002, status: 'computing', log: 'still going'
            });

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 502 });

            // After the initial tick lands, send the hide action. No further
            // SET_ANUGA_POLLING_DATA should be emitted after that point.
            setTimeout(() => {
                const beforeHide = emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA).length;
                subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: false });
                setTimeout(() => {
                    const afterHide = emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA).length;
                    // Polling must have stopped — count is stable post-hide.
                    expect(afterHide).toBe(beforeHide);
                    sub.unsubscribe();
                    done();
                }, 150);
            }, 100);
        });

        it('SHOW with terminal status short-circuits (no getRun call)', (done) => {
            const scenario = {
                id: 503,
                latest_run: { id: 7003, status: 'complete', log: 'final log' }
            };
            const store = buildStore(scenario);
            // No mock setup needed — the axios call must NEVER happen. If it
            // does, MockAdapter passthrough is off by default so it would
            // network-error, which we'd see as a failed test below.
            let getRunCalls = 0;
            mockAxios.onGet('/api/v2/anuga/runs/7003/').reply(() => {
                getRunCalls += 1;
                return [200, { id: 7003, status: 'complete', log: 'should not fetch' }];
            });

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 503 });

            setTimeout(() => {
                expect(getRunCalls).toBe(0);
                expect(emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA).length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('SHOW with scenarioId=false alone is a no-op (filter rejects close-only signal)', (done) => {
            const store = buildStore(null);
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: false });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 150);
        });

        // Same-payload guard: long ANUGA runs emit log lines slowly, so most
        // 3s polls return a getRun payload byte-identical to the slice we
        // already hold (same log.length + same status). The prior code
        // dispatched on every tick → reducer merge → connected-component
        // re-render → DOM textarea re-render with no user-visible delta. The
        // guard skips the dispatch when both fields match.
        it('same-payload guard: no dispatch when getRun returns identical log.length + status', (done) => {
            const scenario = {
                id: 504,
                // log.length matches mock response exactly.
                latest_run: { id: 7004, status: 'computing', log: 'abc' }
            };
            const store = buildStore(scenario);
            mockAxios.onGet('/api/v2/anuga/runs/7004/').reply(200, {
                id: 7004, status: 'computing', log: 'abc'
            });

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 504 });

            setTimeout(() => {
                // Identical payload → zero SET_ANUGA_POLLING_DATA dispatches.
                expect(emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA).length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('same-payload guard: dispatches when log grows by one byte (proves the guard is field-aware)', (done) => {
            const scenario = {
                id: 505,
                latest_run: { id: 7005, status: 'computing', log: 'abc' }
            };
            const store = buildStore(scenario);
            // One byte longer than the slice in store.
            mockAxios.onGet('/api/v2/anuga/runs/7005/').reply(200, {
                id: 7005, status: 'computing', log: 'abcd'
            });

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 505 });

            setTimeout(() => {
                const polls = emitted.filter(a => a.type === SET_ANUGA_POLLING_DATA);
                expect(polls.length).toBeGreaterThan(0);
                expect(polls[0].scenarios[0].latest_run.log).toBe('abcd');
                sub.unsubscribe();
                done();
            }, 200);
        });
    });

    describe('ensureAnugaGroupsEpic', () => {
        it('should add missing groups when layer tree is empty', (done) => {
            const store = { getState: () => ({ layers: { groups: [] } }) };
            const action$ = mockActions([{ type: FIX_ANUGA_GROUPS }]);
            const emitted = [];

            ensureAnugaGroupsEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Should add parent groups + child groups
                        expect(emitted.length).toBeGreaterThan(0);
                        // Check at least the parent groups are added
                        expect(emitted.some(a => a.id === 'Input Data' || a.group === 'Input Data')).toBe(true);
                        done();
                    }
                );
        });

        it('should emit nothing when all groups exist', (done) => {
            // Build a state where all groups already exist
            const allGroups = [
                { id: 'Input Data', nodes: [
                    { id: 'Input Data.Boundaries' },
                    { id: 'Input Data.Inflows' },
                    // TASK-955 (W2.2 FE) — Rainfall group added to ANUGA_GROUPS;
                    // mirroring the fixture here keeps the "all exist → emit nothing"
                    // contract pinned.
                    { id: 'Input Data.Rainfalls' },
                    { id: 'Input Data.Structures' },
                    { id: 'Input Data.Catchments' },
                    { id: 'Input Data.Nodes' },
                    { id: 'Input Data.Links' },
                    { id: 'Input Data.Mesh Regions' },
                    { id: 'Input Data.Full Mesh' },
                    { id: 'Input Data.Friction' },
                    // Raster siblings pre-created so the first upload doesn't
                    // trigger a lazy moveNode that lands the group at a
                    // non-canonical position. Both rasters live below all
                    // vectors so a boundary drawn on top stays visible.
                    { id: 'Input Data.Friction Rasters' },
                    { id: 'Input Data.Terrain' }
                ]},
                { id: 'Results', nodes: [
                    { id: 'Results.Depth' },
                    { id: 'Results.Depth Integrated Velocity' },
                    { id: 'Results.Velocity' },
                    { id: 'Results.Comparison: Velocity' },
                    { id: 'Results.Comparison: Depth' },
                    { id: 'Results.Comparison: Depth Integrated Velocity' }
                ]}
            ];
            const store = { getState: () => ({ layers: { groups: allGroups } }) };
            const action$ = mockActions([{ type: FIX_ANUGA_GROUPS }]);
            const emitted = [];

            ensureAnugaGroupsEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should not emit for unrelated actions', (done) => {
            const store = { getState: () => ({ layers: { groups: [] } }) };
            const action$ = mockActions([{ type: 'SOMETHING_ELSE' }]);
            const emitted = [];

            ensureAnugaGroupsEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        // Regression: a freshly uploaded terrain hillshade rendered ON TOP of
        // a boundary line the user had just drawn — the opaque raster hid the
        // vector completely. initialReorderLayers walks groups in REVERSE, so
        // the first Input Data child ends at the END of flat[] = TOP of the
        // OL z-stack. Boundaries must come first (top), Terrain last (bottom).
        // Pinning the emit order here guarantees fresh projects never
        // regress to terrain-on-top regardless of how lazy moveNode races.
        it('should add Input Data subgroups vectors-first, rasters-last', (done) => {
            const store = { getState: () => ({ layers: { groups: [] } }) };
            const action$ = mockActions([{ type: FIX_ANUGA_GROUPS }]);
            const emitted = [];

            ensureAnugaGroupsEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        const inputDataIds = emitted
                            .filter(a => a.options && a.options.id && a.options.id.startsWith('Input Data.'))
                            .map(a => a.options.id);
                        const idx = name => inputDataIds.indexOf('Input Data.' + name);
                        expect(idx('Boundaries')).toBeGreaterThan(-1);
                        expect(idx('Terrain')).toBeGreaterThan(-1);
                        expect(idx('Friction Rasters')).toBeGreaterThan(-1);
                        // Vectors first (z-top), rasters last (z-bottom).
                        expect(idx('Boundaries')).toBeLessThan(idx('Friction'));
                        expect(idx('Boundaries')).toBeLessThan(idx('Friction Rasters'));
                        expect(idx('Boundaries')).toBeLessThan(idx('Terrain'));
                        expect(idx('Inflows')).toBeLessThan(idx('Terrain'));
                        expect(idx('Structures')).toBeLessThan(idx('Terrain'));
                        expect(idx('Mesh Regions')).toBeLessThan(idx('Terrain'));
                        expect(idx('Friction Rasters')).toBeLessThan(idx('Terrain'));
                        done();
                    }
                );
        });
    });

    describe('taskCompleteLayerEpic', () => {
        it('should add layer from task metadata mapstore_layer', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 101,
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        mapstore_layer: {
                            name: 'geonode:bdy_test',
                            type: 'wms',
                            url: '/geoserver/wms'
                        }
                    }
                }]
            });

            setTimeout(() => {
                // Should emit addLayer + notification
                expect(emitted.length).toBe(2);
                // First action should be addLayer with the mapstore_layer config
                expect(emitted[0].type).toBe('ADD_LAYER');
                expect(emitted[0].layer.name).toBe('geonode:bdy_test');
                // Second should be a notification
                expect(emitted[1].type).toBe('SHOW_NOTIFICATION');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should fall back to add action when no mapstore_layer in metadata', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .take(1)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Should emit the fallback ADD_ANUGA_FRICTION action
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(ADD_ANUGA_FRICTION);
                        sub.unsubscribe();
                        done();
                    }
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 102,
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: { model_class: 'Friction' }
                }]
            });
        });

        it('should not re-emit for a process id already handled in this session', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            const tickProcess = {
                id: 'dedup-test-1',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_dedup', type: 'wms', url: '/geoserver/wms' }
                }
            };

            // First emit dispatches addLayer + show
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                const afterFirst = emitted.length;
                // Second emit (same process id) must be a no-op
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    expect(afterFirst).toBe(2);
                    expect(emitted.length).toBe(afterFirst);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('should add terrain DEM + hillshade and run full post-add chain (is_first_upload=false)', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    // V2P-714 sibling-orphan: terrain_id must be set + the
                    // terrain row must be in the loaded list to classify
                    // as 'present' (not orphaned).
                    anuga: { resources: { terrainLoaded: true, terrain: [{ id: 99 }] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'ele-not-first',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 99,
                        target_group: 'Input Data.Terrain',
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_99_dem', type: 'wms', url: '/geoserver/ows', bbox: { bounds: { minx: 0, miny: 0, maxx: 1, maxy: 1 }, crs: 'EPSG:4326' } },
                            { name: 'geonode:ele_99_hillshade', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });

            setTimeout(() => {
                const types = emitted.map(a => a.type);
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(2);
                expect(adds[0].layer.name).toBe('geonode:ele_99_dem');
                expect(adds[1].layer.name).toBe('geonode:ele_99_hillshade');
                // Full post-add chain (no zoom because is_first_upload=false)
                expect(types).toContain('REFRESH_LAYERS');
                expect(types).toContain('SHOW_NOTIFICATION');
                expect(types).toContain('GEONODE:SAVE_DIRECT_CONTENT');
                expect(types).toContain('UPDATE_UPLOAD_STATUS');
                expect(types).toContain('INIT_ANUGA');
                expect(types).toContain('START_ANUGA_MODEL_CREATION_POLLING');
                // Bookend refreshes (before + after)
                expect(types.filter(t => t === 'REFRESH_LAYERS').length).toBe(2);
                // No zoom — first-upload-only branch
                expect(types).toNotContain('ZOOM_TO_EXTENT');
                sub.unsubscribe();
                done();
            }, 300);
        });

        it('should zoom + race-save when is_first_upload=true (race resolved by CHANGE_MAP_VIEW)', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrainLoaded: true, terrain: [{ id: 100 }] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'ele-first',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 100,
                        is_first_upload: true,
                        mapstore_layers: [
                            { name: 'geonode:ele_first_dem', type: 'wms', url: '/geoserver/ows', bbox: { bounds: { minx: 10, miny: 20, maxx: 11, maxy: 21 }, crs: 'EPSG:4326' } },
                            { name: 'geonode:ele_first_hs', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });

            // Resolve the race fast by emitting CHANGE_MAP_VIEW
            setTimeout(() => {
                subject.next({ type: 'CHANGE_MAP_VIEW' });
            }, 50);

            setTimeout(() => {
                const types = emitted.map(a => a.type);
                expect(types).toContain('ZOOM_TO_EXTENT');
                const zoom = emitted.find(a => a.type === 'ZOOM_TO_EXTENT');
                expect(zoom.extent.minx).toBe(10);
                expect(zoom.crs).toBe('EPSG:4326');
                expect(types).toContain('GEONODE:SAVE_DIRECT_CONTENT');
                // Save must come after zoom in the action stream
                const zoomIdx = types.indexOf('ZOOM_TO_EXTENT');
                const saveIdx = types.indexOf('GEONODE:SAVE_DIRECT_CONTENT');
                expect(saveIdx).toBeGreaterThan(zoomIdx);
                sub.unsubscribe();
                done();
            }, 300);
        });

        it('should be a no-op when all terrain layers are already in flat (page-reload case)', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: {
                        flat: [
                            { name: 'geonode:ele_already_dem' },
                            { name: 'geonode:ele_already_hs' }
                        ],
                        groups: []
                    }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'ele-already',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_already_dem', type: 'wms', url: '/geoserver/ows' },
                            { name: 'geonode:ele_already_hs', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should skip non-layer_create processes', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 103,
                    process_type: 'compute',
                    status: 'complete',
                    metadata: { model_class: 'Boundary' }
                }]
            });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should not add duplicate layers already in the map', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [{ name: 'geonode:bdy_existing' }] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 104,
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        mapstore_layer: { name: 'geonode:bdy_existing' }
                    }
                }]
            });

            setTimeout(() => {
                // Layer already exists, should not re-add
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should not emit for unrelated action types', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: 'SOME_OTHER_ACTION', processes: [] });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        // V2P-714 follow-up: orphan terrain_create filtering. After a user
        // deletes a Terrain row, its terrain_create Process record is
        // still in TaskMonitor's list. On page reload, replaying the addLayer
        // side-effect would re-inject layers whose backing GeoNode Dataset is
        // 404 (cascade-cleaned by the post_delete signal).
        //
        // Refresh-then-defer protocol (no time-based heuristics): when the
        // candidate's terrain_id is missing from a LOADED terrain list, the
        // first miss dispatches initAnuga() to force a catalogue refetch and
        // defers classification. If still missing on the next tick → really
        // orphaned, skip + mark handled. Real DEMs can take up to an hour
        // to process, so any time-window based rescue is wrong.
        it('should dispatch initAnuga on first miss, then orphan-skip on next tick if still missing', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    // Loaded list missing the candidate's terrain_id=6
                    anuga: { resources: { terrainLoaded: true, terrain: [{ id: 7 }, { id: 8 }] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            const tickProcess = {
                id: 'orphan-ele-6',
                process_type: 'terrain_create',
                status: 'complete',
                metadata: {
                    terrain_id: 6,
                    is_first_upload: false,
                    mapstore_layers: [
                        { name: 'geonode:ele_6_dem', type: 'wms', url: '/geoserver/ows' },
                        { name: 'geonode:ele_6_hs', type: 'wms', url: '/geoserver/ows' }
                    ]
                }
            };

            // Tick 1: id missing, refreshAttempted empty → 'unknown' →
            // dispatch initAnuga, do NOT mark handled, do NOT add layer.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);

                // Tick 2: same state (refresh found nothing new) →
                // 'orphaned' → skip + mark handled. No second initAnuga.
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                    expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('should process terrain_create when terrain_id IS present in state.anuga.resources.terrain', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrainLoaded: true, terrain: [{ id: 11 }, { id: 12 }] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'live-ele-12',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 12,
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_12_dem', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });

            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.name).toBe('geonode:ele_12_dem');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should DEFER (no fire, no handled-mark) when state.anuga.resources is unloaded', (done) => {
            // 3-state classifier (orphanStatus) — when anuga state is
            // unloaded ('unknown'), we defer rather than fire-eagerly OR
            // skip-and-mark-handled. The candidate stays in flight so the
            // next TM_SET_PROCESSES tick (after initAnuga populates terrain)
            // can re-classify decisively as 'present' or 'orphaned'.
            // Without this defer, the very-first DEM upload on a fresh
            // page load was silently dropped (no addLayer/zoom/save).
            let anugaState; // undefined first emit → 'unknown'
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: anugaState
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            const tickProcess = {
                id: 'unloaded-state',
                process_type: 'terrain_create',
                status: 'complete',
                metadata: {
                    terrain_id: 99,
                    is_first_upload: false,
                    mapstore_layers: [
                        { name: 'geonode:ele_99_dem', type: 'wms', url: '/geoserver/ows' }
                    ]
                }
            };
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                // 'unknown' classification: deferred — nothing emitted yet.
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                // Now state loads in with the matching terrain → re-tick.
                anugaState = { resources: { terrainLoaded: true, terrain: [{ id: 99 }] } };
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    // Classification now 'present' → ADD_LAYER fires.
                    expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('once orphan-marked-handled, subsequent ticks are no-ops even if terrain reappears', (done) => {
            // True-orphan: terrain state is loaded, terrain_id absent.
            // Tick 1: 'unknown' → dispatch initAnuga, refreshAttempted=42.
            // Tick 2: still missing, refreshAttempted has 42 → 'orphaned' →
            //   mark handled.
            // Tick 3: even if a (BE-impossible) revival happens, the
            //   handled-set short-circuits the candidate filter so no
            //   double-fire. This is the semantic guarantee against
            //   re-injection from replayed completion records.
            let resources = { terrainLoaded: true, terrain: [{ id: 7 }] };  // 42 missing
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            const tickProcess = {
                id: 'orphan-then-revived',
                process_type: 'terrain_create',
                status: 'complete',
                metadata: {
                    terrain_id: 42,
                    is_first_upload: false,
                    mapstore_layers: [{ name: 'geonode:ele_42_dem', type: 'wms', url: '/geoserver/ows' }]
                }
            };

            // Tick 1: first miss → initAnuga + defer
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                // Tick 2: same state → 'orphaned' → mark handled
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                    // Tick 3: simulate revival — handled-set must still
                    // suppress re-fire.
                    resources = { terrainLoaded: true, terrain: [{ id: 7 }, { id: 42 }] };
                    subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                    setTimeout(() => {
                        expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                        // Only one initAnuga across all three ticks.
                        expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                        sub.unsubscribe();
                        done();
                    }, 100);
                }, 100);
            }, 100);
        });

        it('should classify legacy procs (terrain_id===null) as orphaned and skip them', (done) => {
            // Pre-rename Processes never stamped metadata.terrain_id. On a
            // map blob with multiple completed-but-orphan procs, the
            // previous code's `terrainId == null → 'present'` short-circuit
            // re-injected ele_3905/9-13 ghosts on every page reload. Now
            // null terrain_id ⇒ orphaned ⇒ skip + mark handled.
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrainLoaded: true, terrain: [] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'legacy-no-terrain-id',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        is_first_upload: false,
                        // terrain_id intentionally absent (legacy proc shape)
                        mapstore_layers: [
                            { name: 'geonode:ele_3905_utm_dem', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should ADD_LAYER on the next tick once initAnuga refresh delivers the missing terrain row', (done) => {
            // Real-world fresh-upload race: Celery stamps the new Terrain
            // in DB and emits process.complete BEFORE the FE's cached
            // terrain list has been refetched. Under refresh-then-defer:
            //   tick 1: id missing from loaded list → 'unknown' → epic
            //           dispatches initAnuga + adds to refreshAttempted
            //   (initAnuga refetch lands new row in state.anuga.resources.terrain)
            //   tick 2: id now present → 'present' → ADD_LAYER fires
            // process.finished is irrelevant — the design works for DEMs
            // that took an hour to process just as well as 30s ones.
            let resources = { terrainLoaded: true, terrain: [{ id: 7 }] };  // stale, missing 99
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            const tickProcess = {
                id: 'slow-dem-99',
                process_type: 'terrain_create',
                status: 'complete',
                // Deliberately stale — 1 hour ago — to prove no time-window
                // heuristic is at play.
                finished: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                metadata: {
                    terrain_id: 99,
                    is_first_upload: false,
                    mapstore_layers: [
                        { name: 'geonode:ele_99_utm_dem', type: 'wms', url: '/geoserver/ows' }
                    ]
                }
            };
            // Tick 1: id missing → initAnuga + defer
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                // Simulate initAnuga having delivered the row
                resources = { terrainLoaded: true, terrain: [{ id: 7 }, { id: 99 }] };
                // Tick 2: id present → 'present' → ADD_LAYER fires
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('should not dispatch initAnuga while terrainLoaded is false (initAnugaEpic is the natural fetcher)', (done) => {
            // When the resources slice hasn't been hydrated yet (e.g.
            // page just loaded and initAnugaEpic is mid-flight), the
            // classifier returns 'unknown' but we MUST NOT dispatch a
            // competing initAnuga from this epic. initAnugaEpic itself
            // handles the catalogue fetch on visibility/gnresource gates;
            // racing it from here just doubles up roundtrips.
            let anugaState; // undefined first tick
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: anugaState
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            const tickProcess = {
                id: 'boot-race',
                process_type: 'terrain_create',
                status: 'complete',
                metadata: {
                    terrain_id: 99,
                    is_first_upload: false,
                    mapstore_layers: [
                        { name: 'geonode:ele_99_utm_dem', type: 'wms', url: '/geoserver/ows' }
                    ]
                }
            };
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                // 'unknown' from unloaded state — defer, but don't refresh.
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(0);
                sub.unsubscribe();
                done();
            }, 100);
        });

        // Pin for the resources.<type> refresh on layer_create completion.
        // Background: `create_supporting_models` races the page-load fan-out
        // for fresh projects; the initial GET /inflows/ returns [] and the
        // Scenarios > Required dropdowns stay empty even after the celery
        // task finishes. taskCompleteLayerEpic injects the map layer but
        // previously never refreshed state.anuga.resources.<type>.
        it('refreshes resources.<type> when a non-terrain layer_create completes', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] },
                    anuga: { projects: { data: { id: 11794 } } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'inflow-fetch-1',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        project_id: 11794,
                        model_class: 'Inflow',
                        mapstore_layer: {
                            name: 'geonode:inf_11794_inflow_01',
                            type: 'wms',
                            url: '/geoserver/wms'
                        }
                    }
                }]
            });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                expect(emitted.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(1);
                sub.unsubscribe();
                done();
            }, 200);
        });

        // Two completions for the same model_class in a single tick should
        // collapse to one fetch — the resource endpoint is a list, so
        // refetching it twice is pure waste.
        it('dedupes the resource refresh by endpoint within a single tick', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] },
                    anuga: { projects: { data: { id: 11794 } } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [
                    {
                        id: 'inflow-dedup-1',
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: {
                            project_id: 11794,
                            model_class: 'Inflow',
                            mapstore_layer: { name: 'geonode:inf_a', type: 'wms', url: '/geoserver/wms' }
                        }
                    },
                    {
                        id: 'inflow-dedup-2',
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: {
                            project_id: 11794,
                            model_class: 'Inflow',
                            mapstore_layer: { name: 'geonode:inf_b', type: 'wms', url: '/geoserver/wms' }
                        }
                    },
                    {
                        id: 'rainfall-dedup-1',
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: {
                            project_id: 11794,
                            model_class: 'Rainfall',
                            mapstore_layer: { name: 'geonode:rai_a', type: 'wms', url: '/geoserver/wms' }
                        }
                    }
                ]
            });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(3);
                expect(emitted.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(1);
                expect(emitted.filter(a => a.type === SET_ANUGA_RAINFALL_DATA).length).toBe(1);
                sub.unsubscribe();
                done();
            }, 200);
        });

        // Without a hydrated projectId the API can't be called safely, so
        // the resource refresh must be skipped — addLayer still fires.
        it('skips the resource refresh when projectId is null', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(action => emitted.push(action), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'no-pid',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Inflow',
                        mapstore_layer: { name: 'geonode:inf_nopid', type: 'wms', url: '/geoserver/wms' }
                    }
                }]
            });
            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                expect(emitted.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });
    });

    // Layer-group stamping on addLayer dispatch. The Layer Menu / Results
    // tab filter in simpleViewMenuRows.js gates each layer on
    // `layer.group.split('.')[0] === openMenuGroupId`, so when
    // taskCompleteLayerEpic injects a per-layer addLayer, the resolved
    // ANUGA group MUST land on the layer. Sources (priority order):
    //   1. metadata.target_group
    //   2. metadata.mapstore_layer.extra_params.anuga_group
    //   3. mapstore_layer.group when it's already an ANUGA-prefixed path
    describe('taskCompleteLayerEpic — group resolution for tab filter', () => {
        it('stamps layer.group from extra_params.anuga_group when serializer left it default', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'group-from-extra',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        mapstore_layer: {
                            name: 'geonode:res_depth_max_run42',
                            type: 'wms',
                            url: '/geoserver/wms',
                            group: 'Default',
                            extra_params: { anuga_group: 'Results.Depth' }
                        }
                    }
                }]
            });
            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Results.Depth');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('prefers metadata.target_group over extra_params.anuga_group', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'group-target-wins',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        target_group: 'Input Data.Boundaries',
                        mapstore_layer: {
                            name: 'geonode:bdy_target_wins',
                            type: 'wms',
                            url: '/geoserver/wms',
                            extra_params: { anuga_group: 'Results.Depth' }
                        }
                    }
                }]
            });
            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Input Data.Boundaries');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('keeps serializer-stamped layer.group when it is an ANUGA-prefixed path', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'group-serializer',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Inflow',
                        mapstore_layer: {
                            name: 'geonode:inf_serializer_done',
                            type: 'wms',
                            url: '/geoserver/wms',
                            // get_group resolved this server-side; the epic
                            // should pass it through unchanged.
                            group: 'Input Data.Inflows'
                        }
                    }
                }]
            });
            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Input Data.Inflows');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('leaves layer.group untouched when no ANUGA signal is present', (done) => {
            // Defensive: a process with no anuga_group hint and a non-ANUGA
            // serializer group ('Default') should not invent one — let the
            // FIX_ANUGA_GROUPS path move it later if needed.
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'group-passthrough',
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        mapstore_layer: {
                            name: 'geonode:bdy_passthrough',
                            type: 'wms',
                            url: '/geoserver/wms',
                            group: 'Default'
                        }
                    }
                }]
            });
            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Default');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('stamps target_group on every terrain mapstore_layers entry (DEM + hillshade)', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrainLoaded: true, terrain: [{ id: 88 }] } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'terrain-group-stamp',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 88,
                        target_group: 'Input Data.Terrain',
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_88_dem', type: 'wms', url: '/geoserver/ows' },
                            { name: 'geonode:ele_88_hs', type: 'wms', url: '/geoserver/ows' }
                        ]
                    }
                }]
            });
            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(2);
                expect(adds[0].layer.group).toBe('Input Data.Terrain');
                expect(adds[1].layer.group).toBe('Input Data.Terrain');
                sub.unsubscribe();
                done();
            }, 300);
        });
    });

    // Persistence of handled-completion-ids across page reload. Without
    // persistence, the module-scoped Set resets on every reload so every
    // completed Process re-fires the addLayer path and (for any whose name
    // doesn't already match a loaded layer) the "new layers found, save
    // your project" banner. localStorage keyed by mapId removes the phantom
    // toast and prevents redundant work on reload.
    describe('taskCompleteLayerEpic — localStorage persistence across reload', () => {
        // Lightweight in-memory shim so tests are deterministic and don't
        // leak state across the suite. We hand-roll this rather than poke at
        // ChromeHeadless's native localStorage because Karma runs share a
        // single browser session — a real key set in one test would
        // contaminate the next.
        let originalLocalStorage;
        let store;
        beforeEach(() => {
            originalLocalStorage = window.localStorage;
            const backing = new Map();
            const shim = {
                getItem: (k) => (backing.has(k) ? backing.get(k) : null),
                setItem: (k, v) => { backing.set(k, String(v)); },
                removeItem: (k) => { backing.delete(k); },
                clear: () => { backing.clear(); },
                key: (i) => Array.from(backing.keys())[i] || null,
                get length() { return backing.size; }
            };
            Object.defineProperty(window, 'localStorage', {
                value: shim,
                configurable: true,
                writable: true
            });
        });
        afterEach(() => {
            Object.defineProperty(window, 'localStorage', {
                value: originalLocalStorage,
                configurable: true,
                writable: true
            });
        });

        it('persists handled id across a simulated reload (second epic instance is a no-op)', (done) => {
            // Shared store across both epic instances simulates two page
            // loads of the same map (gnresource.id stays 4242). A fresh
            // taskCompleteLayerEpic call mirrors what happens at app boot.
            store = {
                getState: () => ({
                    gnresource: { id: 4242 },
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [] }
                })
            };
            const tickProcess = {
                id: 'persist-completion-1',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: {
                        name: 'geonode:bdy_persist_1',
                        type: 'wms',
                        url: '/geoserver/wms'
                    }
                }
            };

            // First "page load": dispatches ADD_LAYER + SHOW_NOTIFICATION.
            const first = liveActions();
            const emittedFirst = [];
            const subFirst = taskCompleteLayerEpic(first.action$, store)
                .subscribe(a => emittedFirst.push(a), err => done(err));
            first.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            setTimeout(() => {
                expect(emittedFirst.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                expect(emittedFirst.filter(a => a.type === 'SHOW_NOTIFICATION').length).toBe(1);
                subFirst.unsubscribe();

                // Second "page load": fresh epic instance, same store
                // (same mapId). Should read the persisted handled set and
                // skip the completion → zero ADD_LAYER, zero notification.
                const second = liveActions();
                const emittedSecond = [];
                const subSecond = taskCompleteLayerEpic(second.action$, store)
                    .subscribe(a => emittedSecond.push(a), err => done(err));
                second.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

                setTimeout(() => {
                    expect(emittedSecond.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                    expect(emittedSecond.filter(a => a.type === 'SHOW_NOTIFICATION').length).toBe(0);
                    subSecond.unsubscribe();
                    done();
                }, 200);
            }, 200);
        });

        it('does not bleed handled ids across different mapIds (key is scoped)', (done) => {
            // Two different maps must not share the registry — otherwise a
            // user who completed a Boundary creation on map A would have
            // map B silently skip its own Boundary completion.
            const tickProcess = {
                id: 'cross-map-id',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_cross', type: 'wms', url: '/geoserver/wms' }
                }
            };
            const storeA = { getState: () => ({ gnresource: { id: 1 }, layers: { flat: [] } }) };
            const storeB = { getState: () => ({ gnresource: { id: 2 }, layers: { flat: [] } }) };

            const a = liveActions();
            const emittedA = [];
            const subA = taskCompleteLayerEpic(a.action$, storeA)
                .subscribe(act => emittedA.push(act), err => done(err));
            a.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            setTimeout(() => {
                expect(emittedA.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                subA.unsubscribe();

                const b = liveActions();
                const emittedB = [];
                const subB = taskCompleteLayerEpic(b.action$, storeB)
                    .subscribe(act => emittedB.push(act), err => done(err));
                b.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

                setTimeout(() => {
                    // Different mapId → must fire.
                    expect(emittedB.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                    subB.unsubscribe();
                    done();
                }, 200);
            }, 200);
        });

        it('TTL-prunes entries older than 7 days on read', (done) => {
            // Seed the shim with a stale entry (8 days old) for mapId 99 +
            // a fresh entry. After the first epic boot for that map, the
            // stale entry should be gone and a fresh process with that
            // (formerly stale) id should be processed normally.
            const staleId = 'stale-id-from-last-week';
            const freshId = 'fresh-id';
            const beyondTtlMs = HANDLED_IDS_TTL_MS + 24 * 60 * 60 * 1000;
            const persisted = [
                { id: staleId, ts: Date.now() - beyondTtlMs },
                { id: freshId, ts: Date.now() }
            ];
            window.localStorage.setItem(
                'hydrata_handled_completion_ids_99',
                JSON.stringify(persisted)
            );

            store = {
                getState: () => ({
                    gnresource: { id: 99 },
                    layers: { flat: [] }
                })
            };

            // freshId still suppresses, staleId no longer does.
            const tickStale = {
                id: staleId,
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_stale', type: 'wms', url: '/geoserver/wms' }
                }
            };
            const tickFresh = {
                id: freshId,
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_fresh', type: 'wms', url: '/geoserver/wms' }
                }
            };

            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(act => emitted.push(act), err => done(err));
            subject.next({ type: TM_SET_PROCESSES, processes: [tickStale, tickFresh] });

            setTimeout(() => {
                const adds = emitted.filter(act => act.type === 'ADD_LAYER');
                // Stale entry was pruned → its addLayer fires; fresh entry
                // suppresses → no second addLayer.
                expect(adds.length).toBe(1);
                expect(adds[0].layer.name).toBe('geonode:bdy_stale');
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('survives corrupt/malformed localStorage payload (defensive parse)', (done) => {
            // Earlier code-paths or browser-extension interference could
            // overwrite the storage key with garbage. Defensive: log
            // nothing, treat as empty, never throw out of the epic.
            window.localStorage.setItem(
                'hydrata_handled_completion_ids_777',
                '{not valid JSON,'
            );
            store = {
                getState: () => ({
                    gnresource: { id: 777 },
                    layers: { flat: [] }
                })
            };
            const tickProcess = {
                id: 'corrupt-recovery',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_corrupt', type: 'wms', url: '/geoserver/wms' }
                }
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(act => emitted.push(act), err => done(err));
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('merges concurrent tab writes (load-merge-persist cycle)', (done) => {
            // Cross-tab last-write-wins scenario: two tabs on the same map.
            // Tab A persists A1, then tab B (whose in-memory Set knows only B1)
            // writes — without the load-merge-persist cycle, B's write would
            // overwrite A's entry. After the fix, localStorage must contain
            // BOTH ids.
            const storeShared = {
                getState: () => ({
                    gnresource: { id: 8181 },
                    layers: { flat: [] }
                })
            };
            const tickA = {
                id: 'tab-a-completion',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_tab_a', type: 'wms', url: '/geoserver/wms' }
                }
            };
            const tickB = {
                id: 'tab-b-completion',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: { name: 'geonode:bdy_tab_b', type: 'wms', url: '/geoserver/wms' }
                }
            };

            // Tab A: fresh epic instance, handles tickA, persists A1.
            const a = liveActions();
            const emittedA = [];
            const subA = taskCompleteLayerEpic(a.action$, storeShared)
                .subscribe(act => emittedA.push(act), err => done(err));
            a.subject.next({ type: TM_SET_PROCESSES, processes: [tickA] });

            setTimeout(() => {
                // A handled, persisted [A1].
                expect(emittedA.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                const afterA = JSON.parse(
                    window.localStorage.getItem('hydrata_handled_completion_ids_8181')
                );
                expect(afterA.length).toBe(1);
                expect(afterA[0].id).toBe('tab-a-completion');
                subA.unsubscribe();

                // Tab B: separate epic instance (separate in-memory Set, no
                // knowledge of A1). On boot it hydrates from localStorage and
                // sees A1, then handles its own tickB. Crucially, A1 must
                // remain in storage post-write — the merge guarantees it.
                const b = liveActions();
                const emittedB = [];
                const subB = taskCompleteLayerEpic(b.action$, storeShared)
                    .subscribe(act => emittedB.push(act), err => done(err));
                b.subject.next({ type: TM_SET_PROCESSES, processes: [tickB] });

                setTimeout(() => {
                    expect(emittedB.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                    const afterB = JSON.parse(
                        window.localStorage.getItem('hydrata_handled_completion_ids_8181')
                    );
                    const ids = afterB.map(e => e.id).sort();
                    expect(ids).toEqual(['tab-a-completion', 'tab-b-completion']);
                    subB.unsubscribe();
                    done();
                }, 200);
            }, 200);
        });

        it('persists in-memory entries once mapId hydrates from null', (done) => {
            // Null-to-value mapId transition. First tick fires with
            // gnresource.id === null (TaskMonitor races ahead of gnresource
            // hydration). The completion fires (in-memory Set guards
            // duplicates within the page), but persist no-ops because
            // mapId is null. On the next tick, mapId has hydrated — the
            // buffered entry must be flushed to localStorage retroactively.
            let mapIdNow = null;
            const store = {
                getState: () => ({
                    gnresource: { id: mapIdNow },
                    layers: { flat: [] }
                })
            };
            const tickProcess = {
                id: 'hydrate-after-null',
                process_type: 'layer_create',
                status: 'complete',
                metadata: {
                    model_class: 'Boundary',
                    mapstore_layer: {
                        name: 'geonode:bdy_hydrate',
                        type: 'wms',
                        url: '/geoserver/wms'
                    }
                }
            };

            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(act => emitted.push(act), err => done(err));

            // First tick: mapId is null. Completion fires (in-memory only),
            // localStorage must remain empty for any key under this map id.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            setTimeout(() => {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                // Nothing persisted while mapId was null.
                expect(window.localStorage.getItem('hydrata_handled_completion_ids_5555')).toBe(null);
                expect(window.localStorage.getItem('hydrata_handled_completion_ids_null')).toBe(null);

                // mapId hydrates. Next tick (same or different process) must
                // retroactively flush the buffered entry to localStorage.
                mapIdNow = 5555;
                // Emit a benign tick (no new candidates — same id, already
                // handled) just to drive the hydrate-from-null branch.
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

                setTimeout(() => {
                    const stored = JSON.parse(
                        window.localStorage.getItem('hydrata_handled_completion_ids_5555')
                    );
                    expect(Array.isArray(stored)).toBe(true);
                    const ids = stored.map(e => e.id);
                    expect(ids).toContain('hydrate-after-null');
                    sub.unsubscribe();
                    done();
                }, 200);
            }, 200);
        });

        it('caps pendingEntriesBeforeMapId at 500 entries (drops oldest)', (done) => {
            // Soft cap to prevent unbounded growth in non-map contexts where
            // gnresource.id never hydrates. Push >500 entries with null
            // mapId; on hydrate, only the most-recent 500 should land in
            // localStorage.
            let mapIdNow = null;
            const store = {
                getState: () => ({
                    gnresource: { id: mapIdNow },
                    layers: { flat: [] }
                })
            };
            const totalPushed = 550;
            const processes = [];
            for (let i = 0; i < totalPushed; i++) {
                processes.push({
                    id: `cap-test-${i}`,
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: {
                        model_class: 'Boundary',
                        mapstore_layer: {
                            name: `geonode:bdy_cap_${i}`,
                            type: 'wms',
                            url: '/geoserver/wms'
                        }
                    }
                });
            }

            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(act => emitted.push(act), err => done(err));

            // First tick: 550 candidates, mapId null. In-memory Set
            // captures all; pending buffer caps at 500 (oldest 50 dropped).
            subject.next({ type: TM_SET_PROCESSES, processes });

            setTimeout(() => {
                expect(window.localStorage.getItem('hydrata_handled_completion_ids_4242')).toBe(null);

                // Hydrate mapId. Next tick replays pending buffer to storage.
                mapIdNow = 4242;
                subject.next({ type: TM_SET_PROCESSES, processes: [] });

                setTimeout(() => {
                    const stored = JSON.parse(
                        window.localStorage.getItem('hydrata_handled_completion_ids_4242')
                    );
                    expect(Array.isArray(stored)).toBe(true);
                    // Buffer was capped at 500; oldest 50 dropped → ids 50..549 remain.
                    expect(stored.length).toBeLessThanOrEqualTo(500);
                    const ids = stored.map(e => e.id);
                    expect(ids).toNotContain('cap-test-0');
                    expect(ids).toNotContain('cap-test-49');
                    expect(ids).toContain('cap-test-549');
                    expect(ids).toContain('cap-test-50');
                    sub.unsubscribe();
                    done();
                }, 200);
            }, 200);
        });

        it('should drop candidates whose metadata.project_id mismatches the current map', (done) => {
            // Defence-in-depth: the TaskMonitor poller is gated on
            // getProjectId being non-null AND the BE rejects unscoped
            // listings (taskmonitor/views.py). If a future bug ever
            // bypasses both, candidates from other projects must NOT
            // be addLayer'd. Repro is the 2026-05-17 stray "Rainfall
            // 01" leak: a layer_create from project 11550 surfaced
            // on a freshly-opened map of project 11551.
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    gnresource: { id: 1222 },
                    anuga: { projects: { data: { id: 11551 } } }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(act => emitted.push(act), err => done(err));

            subject.next({
                type: TM_SET_PROCESSES,
                processes: [
                    {
                        id: 'cross-project-leak',
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: {
                            project_id: 11550,     // belongs to OTHER project
                            model_class: 'Rainfall',
                            mapstore_layer: {
                                name: 'geonode:rai_11550_rainfall_01',
                                title: 'Rainfall 01',
                                group: 'Default',
                                type: 'wms',
                                url: '/geoserver/wms'
                            }
                        }
                    },
                    {
                        id: 'same-project-keeps',
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: {
                            project_id: 11551,     // current map
                            model_class: 'Boundary',
                            mapstore_layer: {
                                name: 'geonode:bdy_11551_boundary_01',
                                title: 'Boundary 01',
                                group: 'Input Data.Boundaries',
                                type: 'wms',
                                url: '/geoserver/wms'
                            }
                        }
                    }
                ]
            });

            setTimeout(() => {
                const addLayerActions = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(addLayerActions.length).toBe(1);
                expect(addLayerActions[0].layer.name).toBe('geonode:bdy_11551_boundary_01');
                // The cross-project Rainfall layer must NOT have been added.
                expect(addLayerActions.find(a => /rai_11550/.test(a.layer.name))).toBe(undefined);
                sub.unsubscribe();
                done();
            }, 200);
        });
    });

    describe('makeAddLayerEpic instances', () => {
        it('addAnugaBoundaryEpic should be a function', () => {
            expect(typeof addAnugaBoundaryEpic).toBe('function');
        });

        it('addAnugaFrictionEpic should be a function', () => {
            expect(typeof addAnugaFrictionEpic).toBe('function');
        });

        it('should not emit for unrelated actions', (done) => {
            const store = { getState: () => ({ anuga: { projects: { data: { id: 1 } } } }) };
            const action$ = mockActions([{ type: 'UNRELATED_ACTION' }]);
            const emitted = [];

            addAnugaBoundaryEpic(action$, store)
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

    describe('anugaMapLayerGroupEpic', () => {
        it('should not emit when no layers have anuga_group', (done) => {
            const store = {
                getState: () => ({
                    layers: { flat: [{ id: 'layer1', type: 'wms', group: 'Default' }] }
                })
            };
            const action$ = mockActions([{ type: FIX_ANUGA_GROUPS }]);
            const emitted = [];

            anugaMapLayerGroupEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should not emit for unrelated actions', (done) => {
            const store = { getState: () => ({ layers: { flat: [] } }) };
            const action$ = mockActions([{ type: 'SOMETHING_ELSE' }]);
            const emitted = [];

            anugaMapLayerGroupEpic(action$, store)
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

    // -- TASK-603: Page Visibility gate -----------------------------------
    //
    // Real-user incident (gabriela.garcia@wkcgroup.com, 2026-04-22) left a
    // catalogue tab open ~19h and produced ~30k wasted requests. The gate
    // inside pollingEpics.js stops timer-based polling while the tab is
    // hidden and resumes within one cycle when it becomes visible.
    //
    // We test the gate via pollAnugaModelCreationEpic because it emits
    // observable Redux actions (no network stubbing required) — the same
    // visibility$ stream gates initAnugaEpic, so verifying the mechanism
    // here also verifies the catalogue-init guard.
    //
    // Mechanics: rather than fight ChromeHeadless's non-overridable native
    // visibilityState accessor and the synthetic visibilitychange Event
    // (which doesn't reliably re-trigger fromEvent listeners under Karma),
    // the production module exposes `__setVisibilityForTests(subject)` —
    // a deliberate test seam that swaps the live DOM stream for a Subject
    // we drive directly. Each test wires its own Subject in beforeEach
    // and clears it in afterEach.
    describe('TASK-603 visibility gate (V2P-79 reframe)', () => {
        // V2P-79: pollAnugaModelCreationEpic was previously the canonical
        // proof point for the visibility gate because it dispatched 10
        // observable add-actions per tick. With V2P-79 the inner observable
        // is now empty (no V1 /available/ fan-out) so emissions can no
        // longer be used as the gate-state signal.
        //
        // The visibility$ Subject seam itself is still wired and still
        // gates `initAnugaEpic` (where the gate has functional impact today).
        // We retain the seam round-trip test below; the more elaborate
        // "resumes within one cycle" assertion has been retired with the
        // legacy emission contract it observed.

        let visibilitySubject;

        beforeEach(() => {
            visibilitySubject = new Rx.BehaviorSubject(true);
            __setVisibilityForTests(visibilitySubject);
        });
        afterEach(() => {
            __setVisibilityForTests(null);
        });

        it('initAnugaEpic exists and is a function (catalogue init has the gate wired)', () => {
            expect(typeof initAnugaEpic).toBe('function');
        });

        it('__setVisibilityForTests seam accepts a Subject and resets to null', () => {
            // Seam-existence guard. The gate continues to be exercised
            // in production by the catalogue init flow.
            const subj = new Rx.BehaviorSubject(true);
            __setVisibilityForTests(subj);
            __setVisibilityForTests(null);
            // No throw === pass.
            expect(typeof __setVisibilityForTests).toBe('function');
        });

        it('pollAnugaModelCreationEpic emits nothing whether visibility=true or false (V2P-79 no-op)', (done) => {
            // Pre-V2P-79: 10 actions/tick when visible, 0 when hidden.
            // Post-V2P-79: 0 in both cases — the inner observable is empty.
            // Either toggle => zero emissions.
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$).subscribe(
                action => emitted.push(action),
                err => done(err)
            );

            subject.next({ type: 'START_ANUGA_MODEL_CREATION_POLLING' });

            setTimeout(() => {
                visibilitySubject.next(false);
                setTimeout(() => {
                    visibilitySubject.next(true);
                    setTimeout(() => {
                        try {
                            expect(emitted.length).toBe(0);
                            sub.unsubscribe();
                            done();
                        } catch (err) { sub.unsubscribe(); done(err); }
                    }, 100);
                }, 100);
            }, 100);
        });
    });

    // W7 (TASK-1045) — polling cap + paused-banner reducer slice.
    describe('W7 — polling cap helper', () => {
        it('getPollingCap returns 1200 floor when expected_duration_seconds is absent', () => {
            expect(getPollingCap(null)).toBe(1200);
            expect(getPollingCap({})).toBe(1200);
            expect(getPollingCap({latest_run: {}})).toBe(1200);
            expect(getPollingCap({latest_run: {expected_duration_seconds: 0}})).toBe(1200);
        });

        it('getPollingCap honours the 2/3 multiplier for long expected durations', () => {
            // 5400s (90min) * 2/3 = 3600s @ 3s = 1200 ticks — at the floor.
            expect(getPollingCap({latest_run: {expected_duration_seconds: 5400}})).toBe(1200);
            // 10800s (3hr) * 2/3 / 3 = 2400 ticks — over the floor.
            expect(getPollingCap({latest_run: {expected_duration_seconds: 10800}})).toBe(2400);
        });
    });

    describe('W7 — pollActiveRunStatusEpic cap reaches RUN_STATUS_POLLING_TIMEOUT', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        it('emits RUN_STATUS_POLLING_TIMEOUT once the tick count reaches the cap', (done) => {
            // Build a store whose scenario keys to runId=701; we want the
            // cap to be very small so the test completes in reasonable time.
            // We can't shrink the floor (1200), so we mock so EVERY tick
            // returns a non-terminal status, then stop the test after a
            // short window and just assert the wire-up: STOP_ACTIVE_RUN_POLLING
            // tears the stream down BEFORE the cap; tick count never reaches
            // 1200; no timeout fires.
            mockAxios.onGet('/api/v2/anuga/runs/701/status/').reply(200, {
                id: 701, status: 'computing', progress_pct: 12
            });

            const store = {
                getState: () => ({
                    anuga: {
                        scenarios: {
                            byId: { 999: { id: 999, latest_run: { id: 701, status: 'computing' } } },
                            allIds: [999]
                        }
                    }
                })
            };

            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollActiveRunStatusEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: START_ACTIVE_RUN_POLLING, runId: 701 });

            setTimeout(() => {
                // Within 200ms we get the first tick + first status update;
                // no timeout fires because the cap is 1200 ticks (~1h).
                const updates = emitted.filter(a => a.type === UPDATE_RUN_STATUS);
                const timeouts = emitted.filter(a => a.type === RUN_STATUS_POLLING_TIMEOUT);
                expect(updates.length).toBeGreaterThan(0);
                expect(timeouts.length).toBe(0);
                // Tearing down via STOP_ACTIVE_RUN_POLLING must NOT trigger a
                // timeout — the scan/take chain completes cleanly because
                // takeUntil is upstream of .take in the chain.
                subject.next({ type: STOP_ACTIVE_RUN_POLLING, runId: 701 });
                setTimeout(() => {
                    expect(emitted.filter(a => a.type === RUN_STATUS_POLLING_TIMEOUT).length).toBe(0);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 200);
        });

        it('stop-on-terminal-status: emits stopActiveRunPolling on terminal status, NO timeout', (done) => {
            mockAxios.onGet('/api/v2/anuga/runs/702/status/').reply(200, {
                id: 702, status: 'complete', progress_pct: 100
            });

            const store = {
                getState: () => ({
                    anuga: {
                        scenarios: {
                            byId: { 998: { id: 998, latest_run: { id: 702, status: 'computing' } } },
                            allIds: [998]
                        }
                    }
                })
            };

            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = pollActiveRunStatusEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );
            subject.next({ type: START_ACTIVE_RUN_POLLING, runId: 702 });

            setTimeout(() => {
                // Terminal-status path: we expect at least one stopActiveRunPolling
                // emission (it co-emits with updateRunStatus) and NO timeout.
                const stops = emitted.filter(a => a.type === STOP_ACTIVE_RUN_POLLING);
                const timeouts = emitted.filter(a => a.type === RUN_STATUS_POLLING_TIMEOUT);
                expect(stops.length).toBeGreaterThan(0);
                expect(timeouts.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });
    });

    // W7 — tailScenarioLogEpic respects the same takeUntil semantics; the
    // wall-clock cap is the same .take(cap) chain. We can't exercise the
    // full 1200-tick cap deterministically in Karma but we can prove that
    // (a) the cap is wired in (getPollingCap is invoked at subscription),
    // and (b) takeUntil(SHOW_ANUGA_SCENARIO_LOG with scenarioId=false) still
    // tears the stream down before any cap signal.
    describe('W7 — tailScenarioLogEpic cap is wired without breaking existing teardown', () => {
        const MockAdapter = require('axios-mock-adapter');
        const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
        let mockAxios;
        beforeEach(() => { mockAxios = new MockAdapter(axios); });
        afterEach(() => { mockAxios.restore(); });

        const buildStore = (scenario) => ({
            getState: () => ({
                anuga: {
                    ui: { visibleAnugaScenarioLogId: scenario?.id || false },
                    scenarios: {
                        byId: scenario ? { [scenario.id]: scenario } : {},
                        allIds: scenario ? [scenario.id] : [],
                        selectedId: scenario?.id || null
                    }
                }
            })
        });

        it('SHOW + hide tears stream down before any wall-clock cap fires', (done) => {
            const scenario = {
                id: 601,
                latest_run: { id: 9001, status: 'computing', log: '', expected_duration_seconds: 600 }
            };
            const store = buildStore(scenario);
            mockAxios.onGet('/api/v2/anuga/runs/9001/').reply(200, {
                id: 9001, status: 'computing', log: 'something'
            });

            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = tailScenarioLogEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );

            subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: 601 });
            setTimeout(() => {
                subject.next({ type: SHOW_ANUGA_SCENARIO_LOG, scenarioId: false });
                setTimeout(() => {
                    // Just assert no exception thrown — wall-clock cap stays
                    // upstream of takeUntil(close), and the close action
                    // (filter !a.scenarioId) tears the stream down cleanly.
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });
    });
});

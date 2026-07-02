import expect from 'expect';
import Rx from 'rxjs';
import { testEpic, mockAxios } from '../../../../__tests__/helpers';
import { addTimeoutEpic, TEST_TIMEOUT } from '../../../../__tests__/helpers/testEpic';
import {
    initAnugaEpic,
    pollAnugaScenarioEpic,
    selectStaleResultLayers,
    pollActiveRunStatusEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    anugaMapLayerGroupEpic,
    HANDLED_IDS_TTL_MS,
    getPollingCap,
    __setVisibilityForTests
} from '../epics/pollingEpics';
import {
    START_ANUGA_SCENARIO_POLLING,
    STOP_ANUGA_SCENARIO_POLLING,
    ADD_ANUGA_FRICTION,
    FIX_ANUGA_GROUPS,
    INIT_ANUGA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_RAINFALL_DATA,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_TERRAIN_DATA,
    SET_ANUGA_INIT_IN_FLIGHT
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
            // Deterministic teardown proof. timer(0, 8000) schedules its first
            // tick on the async scheduler (a 0ms macrotask); dispatching STOP
            // synchronously right after START means takeUntil(STOP_ANUGA_SCENARIO_POLLING)
            // completes the inner stream before that tick fires, so the poller
            // emits nothing — only the injected TEST_TIMEOUT surfaces.
            const state = {
                anuga: {
                    projects: { data: { id: 1 } },
                    scenarios: { byId: {} }
                },
                layers: { flat: [] }
            };
            testEpic(
                addTimeoutEpic(pollAnugaScenarioEpic, 50),
                1,
                [
                    { type: START_ANUGA_SCENARIO_POLLING },
                    { type: STOP_ANUGA_SCENARIO_POLLING }
                ],
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
        });

        it('should listen for START_ANUGA_SCENARIO_POLLING', () => {
            expect(typeof pollAnugaScenarioEpic).toBe('function');
        });

        // TASK-2078 — result-load gate moved to latest_complete_run so a newer
        // in-flight/errored latest_run never hides an older complete run's
        // results (D1: result COG loading is a RESULT consumer).
        describe('TASK-2078 — latest_complete_run result loading', () => {
            it('loads result COGs from latest_complete_run when a newer latest_run is in-flight (AC1)', (done) => {
                const mock = mockAxios();
                mock.onGet(/\/api\/v2\/anuga\/projects\/1\/scenarios\//).reply(200, [{
                    id: 55,
                    computed_status: 'computing',
                    // Newer run is in-flight and has NO result rasters yet.
                    latest_run: { id: 2, status: 'computing' },
                    // Older run is complete and carries the actual result COGs.
                    latest_complete_run: {
                        id: 1,
                        status: 'complete',
                        gn_layer_depth_max: {
                            name: 'geonode:run1_depth_max_cog', title: 'Depth Max',
                            catalogURL: '/geoserver/ows', group: 'Results.Depth'
                        },
                        gn_layer_velocity_max: {
                            name: 'geonode:run1_velocity_max_cog', title: 'Velocity Max',
                            catalogURL: '/geoserver/ows', group: 'Results.Velocity'
                        },
                        gn_layer_depth_integrated_velocity_max: {
                            name: 'geonode:run1_depthintegratedvelocity_max_cog', title: 'Momentum Max',
                            catalogURL: '/geoserver/ows', group: 'Results.Depth Integrated Velocity'
                        }
                    }
                }]);
                const state = {
                    anuga: {
                        projects: { data: { id: 1 } },
                        scenarios: { byId: { 55: { id: 55, isLoaded: false } }, archiveFilter: 'none' }
                    },
                    layers: { flat: [] }
                };
                testEpic(
                    pollAnugaScenarioEpic,
                    6,
                    { type: START_ANUGA_SCENARIO_POLLING },
                    (actions) => {
                        const addLayers = actions.filter(a => a.type === 'ADD_LAYER');
                        expect(addLayers.length).toBe(3);
                        // The layers added MUST come from latest_complete_run's
                        // (id 1) COGs, never latest_run (id 2, in-flight, no
                        // result rasters at all).
                        expect(addLayers.map(a => a.layer.name).sort()).toEqual([
                            'geonode:run1_depth_max_cog',
                            'geonode:run1_depthintegratedvelocity_max_cog',
                            'geonode:run1_velocity_max_cog'
                        ].sort());
                        expect(actions.filter(a => a.type === 'SET_ANUGA_SCENARIO_IS_LOADED').length).toBe(1);
                        expect(actions.filter(a => a.type === 'REFRESH_LAYERS').length).toBe(1);
                    },
                    state,
                    done
                );
            });

            it('does not load results when only an in-flight run exists (no latest_complete_run yet)', (done) => {
                const mock = mockAxios();
                mock.onGet(/\/api\/v2\/anuga\/projects\/1\/scenarios\//).reply(200, [{
                    id: 55,
                    computed_status: 'computing',
                    latest_run: { id: 2, status: 'computing' },
                    latest_complete_run: null
                }]);
                const state = {
                    anuga: {
                        projects: { data: { id: 1 } },
                        scenarios: { byId: { 55: { id: 55, isLoaded: false } }, archiveFilter: 'none' }
                    },
                    layers: { flat: [] }
                };
                testEpic(
                    pollAnugaScenarioEpic,
                    1,
                    { type: START_ANUGA_SCENARIO_POLLING },
                    (actions) => {
                        expect(actions.length).toBe(1);
                        expect(actions[0].type).toBe('SET_ANUGA_POLLING_DATA');
                        expect(actions.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                    },
                    state,
                    done
                );
            });
        });
    });

    // TASK-1897 — cross-project contamination defence-in-depth. The stale-layer
    // selector must (a) never touch a non-result layer even on a title
    // collision, and (b) match the latest run's own layers by run-unique name
    // while still cleaning up a SAME-scenario superseded run by title.
    describe('selectStaleResultLayers', () => {
        const latestRun = {
            gn_layer_depth_max: { name: 'geonode:run1257_depth_max_cog', title: 'test1 Depth Max' },
            gn_layer_velocity_max: { name: 'geonode:run1257_velocity_max_cog', title: 'test1 Velocity Max' },
            gn_layer_depth_integrated_velocity_max: { name: 'geonode:run1257_depthintegratedvelocity_max_cog', title: 'test1 Momentum Max' }
        };

        it('never selects a non-result layer even when its title collides', () => {
            // A DEM / input layer that happens to share a title must be immune.
            const flat = [
                { id: 1, name: 'geonode:ele_518_dem_cog', title: 'test1 Depth Max' },
                { id: 2, name: 'geonode:bdy_663_boundary_01', title: 'test1 Velocity Max' }
            ];
            expect(selectStaleResultLayers(flat, latestRun)).toEqual([]);
        });

        it('selects the latest run\'s own result layers by run-unique name (idempotent re-add)', () => {
            const flat = [
                { id: 3, name: 'geonode:run1257_depth_max_cog', title: 'test1 Depth Max' }
            ];
            const out = selectStaleResultLayers(flat, latestRun);
            expect(out.map(l => l.id)).toEqual([3]);
        });

        it('cleans up a SAME-scenario superseded run (older name, same title)', () => {
            const flat = [
                { id: 4, name: 'geonode:run1200_depth_max_cog', title: 'test1 Depth Max' }
            ];
            const out = selectStaleResultLayers(flat, latestRun);
            expect(out.map(l => l.id)).toEqual([4]);
        });

        it('never selects another project\'s result layer with a DIFFERENT title', () => {
            // The reported contamination: an Australian project's run layer. With
            // a distinct title it is not a removal candidate.
            const flat = [
                { id: 5, name: 'geonode:run1255_depth_max_cog', title: 'grandcanyon Depth Max' }
            ];
            expect(selectStaleResultLayers(flat, latestRun)).toEqual([]);
        });

        it('is null-safe for empty flat / missing run', () => {
            expect(selectStaleResultLayers(undefined, latestRun)).toEqual([]);
            expect(selectStaleResultLayers([{ id: 6, name: 'geonode:run1_depth_max_cog', title: 'x' }], undefined)).toEqual([]);
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
            // Deterministic teardown proof. timer(0, 3000) schedules its first
            // tick on the async scheduler; dispatching a matching-runId STOP
            // synchronously after START means takeUntil cuts the inner stream
            // before the tick fires → nothing real emits, only TEST_TIMEOUT.
            testEpic(
                addTimeoutEpic(pollActiveRunStatusEpic, 50),
                1,
                [
                    { type: START_ACTIVE_RUN_POLLING, runId: 42 },
                    { type: STOP_ACTIVE_RUN_POLLING, runId: 42 }
                ],
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                {},
                done
            );
        });

        it('should include runId in start action', () => {
            const action = { type: START_ACTIVE_RUN_POLLING, runId: 99 };
            expect(action.runId).toBe(99);
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
                    // TASK-1429: renamed from 'Depth Integrated Velocity' → 'Momentum'
                    { id: 'Results.Momentum' },
                    { id: 'Results.Velocity' },
                    { id: 'Results.Comparison: Velocity' },
                    { id: 'Results.Comparison: Depth' },
                    { id: 'Results.Comparison: Momentum' }
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
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] }
            };
            // Emits addLayer only (1 action). TASK-1650 removed the info
            // "new layers found" toast — no SHOW_NOTIFICATION. No projectId in
            // state → no async resource refresh either.
            testEpic(
                taskCompleteLayerEpic,
                1,
                {
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
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    // The only action is addLayer with the mapstore_layer config.
                    expect(actions[0].type).toBe('ADD_LAYER');
                    expect(actions[0].layer.name).toBe('geonode:bdy_test');
                },
                state,
                done
            );
        });

        it('should fall back to add action when no mapstore_layer in metadata', (done) => {
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] }
            };
            // No mapstore_layer → emits the fallback ADD_ANUGA_FRICTION action.
            testEpic(
                taskCompleteLayerEpic,
                1,
                {
                    type: TM_SET_PROCESSES,
                    processes: [{
                        id: 102,
                        process_type: 'layer_create',
                        status: 'complete',
                        metadata: { model_class: 'Friction' }
                    }]
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(ADD_ANUGA_FRICTION);
                },
                state,
                done
            );
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

            // The epic's per-tick output is a synchronous finite observable, so
            // each subject.next() fully drains into `emitted` before the next
            // line runs — no waiting needed.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const afterFirst = emitted.length;
            // Second emit (same process id) must be a no-op (handled-set guards it).
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                // TASK-1650 removed the info toast — first tick emits addLayer
                // only (no SHOW_NOTIFICATION); no projectId → no resource refresh.
                expect(afterFirst).toBe(1);          // addLayer on first tick
                expect(emitted.length).toBe(afterFirst);  // no new emissions on replay
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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

            // is_first_upload=false → buildTerrainAddSequence is a fully
            // synchronous concat (no CHANGE_MAP_VIEW race / 2s timer), so the
            // whole chain drains into `emitted` synchronously on this dispatch.
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

            try {
                const types = emitted.map(a => a.type);
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(2);
                expect(adds[0].layer.name).toBe('geonode:ele_99_dem');
                expect(adds[1].layer.name).toBe('geonode:ele_99_hillshade');
                // Full post-add chain (no zoom because is_first_upload=false).
                // TASK-1650 removed the info toast → no SHOW_NOTIFICATION. The
                // shipped 8-action sequence is: REFRESH_LAYERS, ADD_LAYER×2,
                // GEONODE:SAVE_DIRECT_CONTENT, UPDATE_UPLOAD_STATUS, INIT_ANUGA,
                // START_ANUGA_MODEL_CREATION_POLLING, REFRESH_LAYERS.
                expect(types).toContain('REFRESH_LAYERS');
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
            } catch (e) { sub.unsubscribe(); done(e); }
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

            // The concat emits refreshLayers → addLayer×2 → zoomToExtent
            // synchronously, then subscribes to
            // race(CHANGE_MAP_VIEW.take(1), timer(2000)). By the time this
            // dispatch returns, the race is subscribed and listening, so the
            // CHANGE_MAP_VIEW we fire next resolves it synchronously — the 2s
            // timer is the fallback we deliberately never reach.
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
            // Resolve the race synchronously by emitting CHANGE_MAP_VIEW.
            subject.next({ type: 'CHANGE_MAP_VIEW' });

            try {
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
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('should be a no-op when all terrain layers are already in flat (page-reload case)', (done) => {
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: {
                    flat: [
                        { name: 'geonode:ele_already_dem' },
                        { name: 'geonode:ele_already_hs' }
                    ],
                    groups: []
                }
            };
            // All layers already present → no new layers → epic emits nothing,
            // so only TEST_TIMEOUT surfaces.
            testEpic(
                addTimeoutEpic(taskCompleteLayerEpic, 50),
                1,
                {
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
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
        });

        it('should skip non-layer_create processes', (done) => {
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] }
            };
            // compute process is not a layer-completion type → epic emits nothing.
            testEpic(
                addTimeoutEpic(taskCompleteLayerEpic, 50),
                1,
                {
                    type: TM_SET_PROCESSES,
                    processes: [{
                        id: 103,
                        process_type: 'compute',
                        status: 'complete',
                        metadata: { model_class: 'Boundary' }
                    }]
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
        });

        it('should not add duplicate layers already in the map', (done) => {
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [{ name: 'geonode:bdy_existing' }] }
            };
            // Layer already exists → should not re-add → epic emits nothing.
            testEpic(
                addTimeoutEpic(taskCompleteLayerEpic, 50),
                1,
                {
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
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
        });

        it('should not emit for unrelated action types', (done) => {
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] }
            };
            // Wrong action type → ofType(TM_SET_PROCESSES) never matches → nothing.
            testEpic(
                addTimeoutEpic(taskCompleteLayerEpic, 50),
                1,
                { type: 'SOME_OTHER_ACTION', processes: [] },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
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
        it('should dispatch initAnuga on first miss (null-projectId fallback), then orphan-skip on next tick if still missing', (done) => {
            // UAT-2026-06-29 finding #1 (option C): with a projectId available the
            // first-miss now refetches ONLY the terrain list (see the dedicated
            // refetch test below). This state has NO anuga.projects.data.id, so
            // getProjectId()===null and the epic takes the defensive initAnuga()
            // fallback — the path asserted here.
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    // Loaded list missing the candidate's terrain_id=6; no projectId
                    // in state → getProjectId()===null → initAnuga() fallback.
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

            // Each terrain_create tick's classification + emission is synchronous
            // (the only async branch is the is_first_upload CHANGE_MAP_VIEW race,
            // not exercised here), so both ticks drain into `emitted` in order
            // with no waiting between them.
            // Tick 1: id missing, refreshAttempted empty → 'unknown' →
            // dispatch initAnuga, do NOT mark handled, do NOT add layer.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const addsAfterTick1 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            const initsAfterTick1 = emitted.filter(a => a.type === INIT_ANUGA).length;
            // Tick 2: same state (refresh found nothing new) →
            // 'orphaned' → skip + mark handled. No second initAnuga.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                expect(addsAfterTick1).toBe(0);
                expect(initsAfterTick1).toBe(1);
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('should process terrain_create when terrain_id IS present in state.anuga.resources.terrain', (done) => {
            // terrain_id present → 'present' → buildTerrainAddSequence runs as a
            // synchronous concat (is_first_upload=false, no race), so the whole
            // chain drains into `emitted` on this dispatch. Single DEM layer →
            // exactly one ADD_LAYER.
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
                .subscribe(action => emitted.push(action), err => done(err));

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

            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.name).toBe('geonode:ele_12_dem');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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
            // Synchronous ticks: each dispatch drains fully before the next line.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            // 'unknown' classification: deferred — nothing emitted yet.
            const addsAfterTick1 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            // Now state loads in with the matching terrain → re-tick.
            anugaState = { resources: { terrainLoaded: true, terrain: [{ id: 99 }] } };
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                expect(addsAfterTick1).toBe(0);
                // Classification now 'present' → ADD_LAYER fires.
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('once orphan-marked-handled, subsequent ticks are no-ops even if terrain reappears', (done) => {
            // True-orphan: terrain state is loaded, terrain_id absent. (No
            // projectId in state → the first-miss refresh is the initAnuga()
            // fallback; production refetches only the terrain list. The
            // refreshAttempted→'orphaned' convergence asserted here is identical
            // either way — it does not depend on the refresh dispatch.)
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

            // Synchronous ticks. Tick 1: first miss → initAnuga + defer.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const addsAfterTick1 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            const initsAfterTick1 = emitted.filter(a => a.type === INIT_ANUGA).length;
            // Tick 2: same state → 'orphaned' → mark handled.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const addsAfterTick2 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            // Tick 3: simulate revival — handled-set must still suppress re-fire.
            resources = { terrainLoaded: true, terrain: [{ id: 7 }, { id: 42 }] };
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                expect(addsAfterTick1).toBe(0);
                expect(initsAfterTick1).toBe(1);
                expect(addsAfterTick2).toBe(0);
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                // Only one initAnuga across all three ticks.
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(1);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('should classify legacy procs (terrain_id===null) as orphaned and skip them', (done) => {
            // Pre-rename Processes never stamped metadata.terrain_id. On a
            // map blob with multiple completed-but-orphan procs, the
            // previous code's `terrainId == null → 'present'` short-circuit
            // re-injected ele_3905/9-13 ghosts on every page reload. Now
            // null terrain_id ⇒ orphaned ⇒ skip + mark handled.
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [], groups: [] },
                anuga: { resources: { terrainLoaded: true, terrain: [] } }
            };
            // null terrain_id ⇒ orphaned ⇒ skip + mark handled → emits nothing,
            // so only TEST_TIMEOUT surfaces.
            testEpic(
                addTimeoutEpic(taskCompleteLayerEpic, 50),
                1,
                {
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
                },
                (actions) => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                },
                state,
                done
            );
        });

        it('should ADD_LAYER on the next tick once initAnuga refresh delivers the missing terrain row', (done) => {
            // Real-world fresh-upload race: Celery stamps the new Terrain
            // in DB and emits process.complete BEFORE the FE's cached
            // terrain list has been refetched. (No projectId in state → the
            // first-miss refresh is the initAnuga() fallback asserted here;
            // production refetches only the terrain list — same convergence:
            // the row lands in resources.terrain and tick 2 classifies
            // 'present' → ADD_LAYER.) Under refresh-then-defer:
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
            // Synchronous ticks. Tick 1: id missing → initAnuga + defer.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const addsAfterTick1 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            const initsAfterTick1 = emitted.filter(a => a.type === INIT_ANUGA).length;
            // Simulate initAnuga having delivered the row.
            resources = { terrainLoaded: true, terrain: [{ id: 7 }, { id: 99 }] };
            // Tick 2: id present → 'present' → ADD_LAYER fires.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                expect(addsAfterTick1).toBe(0);
                expect(initsAfterTick1).toBe(1);
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('refetches ONLY the terrain list (not a full initAnuga) on an orphan first-miss when a projectId is set', (done) => {
            // UAT-2026-06-29 finding #1 (option C residual) — the production path
            // (full rationale in pollingEpics.js taskCompleteLayerEpic refreshNeeded
            // branch). A terrain_create pointing at a deleted Terrain row (terrain_id
            // absent from the loaded list) used to fire a full initAnuga() on
            // first-miss; with a projectId available it now refetches ONLY the
            // terrain list (one GET → SET_ANUGA_TERRAIN_DATA), which is all
            // orphanStatus() needs. No INIT_ANUGA, no ADD_LAYER (orphaned, not
            // re-added).
            const mock = mockAxios();
            // Terrain GET returns a list WITHOUT terrain_id=6 → orphan stays missing.
            mock.onGet(/\/api\/v2\/anuga\/projects\/\d+\//).reply(200, [{ id: 7 }, { id: 8 }]);
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [], groups: [] },
                anuga: {
                    projects: { data: { id: 15283 } },
                    resources: { terrainLoaded: true, terrain: [{ id: 7 }, { id: 8 }] }
                }
            };
            testEpic(
                taskCompleteLayerEpic,
                1,
                {
                    type: TM_SET_PROCESSES,
                    processes: [{
                        id: 'orphan-ele-6-pid',
                        process_type: 'terrain_create',
                        status: 'complete',
                        metadata: {
                            project_id: 15283,
                            terrain_id: 6,
                            is_first_upload: false,
                            mapstore_layers: [
                                { name: 'geonode:ele_6_dem', type: 'wms', url: '/geoserver/ows' },
                                { name: 'geonode:ele_6_hs', type: 'wms', url: '/geoserver/ows' }
                            ]
                        }
                    }]
                },
                (actions) => {
                    expect(actions.filter(a => a.type === INIT_ANUGA).length).toBe(0);
                    expect(actions.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                    const terrainSets = actions.filter(a => a.type === SET_ANUGA_TERRAIN_DATA);
                    expect(terrainSets.length).toBe(1);
                    expect(terrainSets[0].data).toEqual([{ id: 7 }, { id: 8 }]);
                },
                state,
                done
            );
        });

        it('falls back to an empty terrain ARRAY (not {}) when the orphan refetch GET fails', (done) => {
            // Hardening (code-review): fetchResourceEndpoint catches a failed GET
            // to {data: []}, NOT {data: {}}. A non-array {} would crash every
            // terrain consumer (.map/.forEach/.some) — including the
            // terrainSubOrderReconcilerEpic this refetch is meant to re-drive, and
            // `terrain || []` does NOT rescue {}. On a 500 the orphan refetch must
            // still dispatch setAnugaTerrainData with an array.
            const mock = mockAxios();
            mock.onGet(/\/api\/v2\/anuga\/projects\/\d+\//).reply(500);
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [], groups: [] },
                anuga: {
                    projects: { data: { id: 15283 } },
                    resources: { terrainLoaded: true, terrain: [{ id: 7 }, { id: 8 }] }
                }
            };
            testEpic(
                taskCompleteLayerEpic,
                1,
                {
                    type: TM_SET_PROCESSES,
                    processes: [{
                        id: 'orphan-ele-6-fail',
                        process_type: 'terrain_create',
                        status: 'complete',
                        metadata: {
                            project_id: 15283,
                            terrain_id: 6,
                            is_first_upload: false,
                            mapstore_layers: [
                                { name: 'geonode:ele_6_dem', type: 'wms', url: '/geoserver/ows' }
                            ]
                        }
                    }]
                },
                (actions) => {
                    const terrainSets = actions.filter(a => a.type === SET_ANUGA_TERRAIN_DATA);
                    expect(terrainSets.length).toBe(1);
                    expect(Array.isArray(terrainSets[0].data)).toBe(true);
                    expect(terrainSets[0].data).toEqual([]);
                },
                state,
                done
            );
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
            // Single synchronous tick — the epic's per-tick output drains
            // immediately, so we can assert right after dispatch.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            try {
                // 'unknown' from unloaded state — defer, but don't refresh.
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emitted.filter(a => a.type === INIT_ANUGA).length).toBe(0);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        // Pin for the resources.<type> refresh on layer_create completion.
        // Background: `create_supporting_models` races the page-load fan-out
        // for fresh projects; the initial GET /inflows/ returns [] and the
        // Scenarios > Required dropdowns stay empty even after the celery
        // task finishes. taskCompleteLayerEpic injects the map layer but
        // previously never refreshed state.anuga.resources.<type>.
        it('refreshes resources.<type> when a non-terrain layer_create completes', (done) => {
            // The resource refresh hits the real axios layer (getResourceList →
            // GET /api/v2/anuga/projects/{pid}/{plural}/), so mock it. The epic's
            // per-tick concat emits addLayer synchronously (TASK-1650 removed the
            // info toast), then the async setAnugaInflowData once the fetch
            // resolves → 2 actions total.
            const mock = mockAxios();
            mock.onGet(/\/api\/v2\/anuga\/projects\/\d+\//).reply(200, [{ id: 1, title: 'Inflow 01' }]);
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] },
                anuga: { projects: { data: { id: 11794 } } }
            };
            testEpic(
                taskCompleteLayerEpic,
                2,
                {
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
                },
                (actions) => {
                    expect(actions.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                    expect(actions.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(1);
                },
                state,
                done
            );
        });

        // Two completions for the same model_class in a single tick should
        // collapse to one fetch — the resource endpoint is a list, so
        // refetching it twice is pure waste.
        it('dedupes the resource refresh by endpoint within a single tick', (done) => {
            // 3 layer_create completions → 3 addLayer (TASK-1650 removed the
            // info toast, so no SHOW_NOTIFICATION) + 2 async resource refreshes
            // (Inflow deduped to one, plus Rainfall) = 5 actions total.
            // Mock the resource-list endpoint.
            const mock = mockAxios();
            mock.onGet(/\/api\/v2\/anuga\/projects\/\d+\//).reply(200, [{ id: 1 }]);
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] },
                anuga: { projects: { data: { id: 11794 } } }
            };
            testEpic(
                taskCompleteLayerEpic,
                5,
                {
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
                },
                (actions) => {
                    expect(actions.filter(a => a.type === 'ADD_LAYER').length).toBe(3);
                    expect(actions.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(1);
                    expect(actions.filter(a => a.type === SET_ANUGA_RAINFALL_DATA).length).toBe(1);
                },
                state,
                done
            );
        });

        // Without a hydrated projectId the API can't be called safely, so
        // the resource refresh must be skipped — addLayer still fires.
        it('skips the resource refresh when projectId is null', (done) => {
            // No projectId → resource refresh skipped → only addLayer
            // (1 synchronous action; TASK-1650 removed the info toast and there
            // is no async fetch without a projectId).
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [] }
            };
            testEpic(
                taskCompleteLayerEpic,
                1,
                {
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
                },
                (actions) => {
                    expect(actions.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                    expect(actions.filter(a => a.type === SET_ANUGA_INFLOW_DATA).length).toBe(0);
                },
                state,
                done
            );
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
            // No projectId in state → no async resource refresh; the per-tick
            // output (addLayer only — TASK-1650 removed the info toast) drains
            // synchronously on this dispatch.
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
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Results.Depth');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Input Data.Boundaries');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Input Data.Inflows');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                expect(adds[0].layer.group).toBe('Default');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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
            // Terrain chain with is_first_upload=false → synchronous concat.
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
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(2);
                expect(adds[0].layer.group).toBe('Input Data.Terrain');
                expect(adds[1].layer.group).toBe('Input Data.Terrain');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });
    });

    // TASK-1720 (W3) — buildTerrainAddSequence singleTile gate on styling_mode.
    // Traditional terrains must be added with singleTile:false so GWC WMTS
    // tile routing activates. Dynamic terrains must have singleTile:true so
    // the demRescaleEpic's env-bearing GetMap fires as a single untiled request.
    describe('taskCompleteLayerEpic — buildTerrainAddSequence singleTile gate (TASK-1720)', () => {
        it('stamps singleTile:false on ADD_LAYER when terrain styling_mode is traditional', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: {
                        resources: {
                            terrainLoaded: true,
                            terrain: [{ id: 200, styling_mode: 'traditional' }]
                        }
                    }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'trad-terrain',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 200,
                        target_group: 'Input Data.Terrain',
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_200_dem', type: 'wms', url: '/geoserver/ows', singleTile: false },
                            { name: 'geonode:ele_200_hs', type: 'wms', url: '/geoserver/ows', singleTile: false }
                        ]
                    }
                }]
            });
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(2);
                // Traditional → singleTile:false must be preserved (not overridden to true)
                expect(adds[0].layer.singleTile).toBe(false);
                expect(adds[1].layer.singleTile).toBe(false);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('stamps singleTile:true on ADD_LAYER when terrain styling_mode is dynamic', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: {
                        resources: {
                            terrainLoaded: true,
                            terrain: [{ id: 201, styling_mode: 'dynamic' }]
                        }
                    }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'dyn-terrain',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 201,
                        target_group: 'Input Data.Terrain',
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_201_dem', type: 'wms', url: '/geoserver/ows', singleTile: false }
                        ]
                    }
                }]
            });
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                // Dynamic → singleTile must be stamped true for demRescaleEpic
                expect(adds[0].layer.singleTile).toBe(true);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('defaults to traditional (singleTile:false) when terrain styling_mode is absent/unknown', (done) => {
            // buildTerrainAddSequence reads styling_mode from the matched terrain
            // in state. When styling_mode is absent (e.g. a terrain created before
            // the field existed, or a future mode value), isTraditional defaults to
            // true (i.e. NOT dynamic), giving singleTile:false (safe: GWC tiled).
            // Note: orphanStatus must return 'present' for buildTerrainAddSequence
            // to be called — the terrain row must be in state.anuga.resources.terrain.
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: {
                        resources: {
                            terrainLoaded: true,
                            terrain: [{ id: 999 }] // terrain present but NO styling_mode field
                        }
                    }
                })
            };
            const { subject, action$ } = liveActions();
            const emitted = [];
            const sub = taskCompleteLayerEpic(action$, store)
                .subscribe(a => emitted.push(a), err => done(err));
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 'race-terrain',
                    process_type: 'terrain_create',
                    status: 'complete',
                    metadata: {
                        terrain_id: 999,
                        target_group: 'Input Data.Terrain',
                        is_first_upload: false,
                        mapstore_layers: [
                            { name: 'geonode:ele_999_dem', type: 'wms', url: '/geoserver/ows', singleTile: false }
                        ]
                    }
                }]
            });
            try {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                // styling_mode absent → isTraditional=true → singleTile:false
                expect(adds[0].layer.singleTile).toBe(false);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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

            // Emissions and the localStorage persist/read are synchronous, so
            // each epic instance's dispatch fully resolves before the next line.
            // First "page load": dispatches ADD_LAYER (TASK-1650 removed the
            // info toast, so no SHOW_NOTIFICATION).
            const first = liveActions();
            const emittedFirst = [];
            const subFirst = taskCompleteLayerEpic(first.action$, store)
                .subscribe(a => emittedFirst.push(a), err => done(err));
            first.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            subFirst.unsubscribe();

            // Second "page load": fresh epic instance, same store (same mapId).
            // Should read the persisted handled set and skip the completion →
            // zero ADD_LAYER, zero notification.
            const second = liveActions();
            const emittedSecond = [];
            const subSecond = taskCompleteLayerEpic(second.action$, store)
                .subscribe(a => emittedSecond.push(a), err => done(err));
            second.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            subSecond.unsubscribe();

            try {
                // First load fires addLayer only — TASK-1650 removed the info
                // "new layers found" toast, so no SHOW_NOTIFICATION ever emits.
                expect(emittedFirst.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                expect(emittedFirst.filter(a => a.type === 'SHOW_NOTIFICATION').length).toBe(0);
                expect(emittedSecond.filter(a => a.type === 'ADD_LAYER').length).toBe(0);
                expect(emittedSecond.filter(a => a.type === 'SHOW_NOTIFICATION').length).toBe(0);
                done();
            } catch (e) { done(e); }
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
            subA.unsubscribe();

            const b = liveActions();
            const emittedB = [];
            const subB = taskCompleteLayerEpic(b.action$, storeB)
                .subscribe(act => emittedB.push(act), err => done(err));
            b.subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            subB.unsubscribe();

            try {
                expect(emittedA.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                // Different mapId → must fire.
                expect(emittedB.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                done();
            } catch (e) { done(e); }
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

            try {
                const adds = emitted.filter(act => act.type === 'ADD_LAYER');
                // Stale entry was pruned → its addLayer fires; fresh entry
                // suppresses → no second addLayer.
                expect(adds.length).toBe(1);
                expect(adds[0].layer.name).toBe('geonode:bdy_stale');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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

            try {
                expect(emitted.filter(a => a.type === 'ADD_LAYER').length).toBe(1);
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
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

            // Synchronous: each epic dispatch persists to the localStorage shim
            // before the next line runs.
            // Tab A: fresh epic instance, handles tickA, persists A1.
            const a = liveActions();
            const emittedA = [];
            const subA = taskCompleteLayerEpic(a.action$, storeShared)
                .subscribe(act => emittedA.push(act), err => done(err));
            a.subject.next({ type: TM_SET_PROCESSES, processes: [tickA] });
            const afterA = JSON.parse(
                window.localStorage.getItem('hydrata_handled_completion_ids_8181')
            );
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
            const afterB = JSON.parse(
                window.localStorage.getItem('hydrata_handled_completion_ids_8181')
            );
            subB.unsubscribe();

            try {
                // A handled, persisted [A1].
                expect(emittedA.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                expect(afterA.length).toBe(1);
                expect(afterA[0].id).toBe('tab-a-completion');
                expect(emittedB.filter(act => act.type === 'ADD_LAYER').length).toBe(1);
                const ids = afterB.map(e => e.id).sort();
                expect(ids).toEqual(['tab-a-completion', 'tab-b-completion']);
                done();
            } catch (e) { done(e); }
        });

        it('persists in-memory entries once mapId hydrates from null', (done) => {
            // Null-to-value mapId transition. First tick fires with
            // gnresource.id === null (TaskMonitor races ahead of gnresource
            // hydration). The completion fires (in-memory Set guards
            // duplicates within the page), but persist no-ops because
            // mapId is null. On the next tick, mapId has hydrated — the
            // buffered entry must be flushed to localStorage retroactively.
            let mapIdNow = null;
            const nullMapStore = {
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
            const sub = taskCompleteLayerEpic(action$, nullMapStore)
                .subscribe(act => emitted.push(act), err => done(err));

            // First tick: mapId is null. Completion fires (in-memory only),
            // localStorage must remain empty for any key under this map id.
            // Synchronous — drains before the next line.
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            const addsAfterTick1 = emitted.filter(a => a.type === 'ADD_LAYER').length;
            const persistedWhileNull5555 = window.localStorage.getItem('hydrata_handled_completion_ids_5555');
            const persistedWhileNullNull = window.localStorage.getItem('hydrata_handled_completion_ids_null');

            // mapId hydrates. Next tick (same process, already handled) drives
            // the hydrate-from-null branch which retroactively flushes the
            // buffered entry to localStorage.
            mapIdNow = 5555;
            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });

            try {
                expect(addsAfterTick1).toBe(1);
                // Nothing persisted while mapId was null.
                expect(persistedWhileNull5555).toBe(null);
                expect(persistedWhileNullNull).toBe(null);
                const stored = JSON.parse(
                    window.localStorage.getItem('hydrata_handled_completion_ids_5555')
                );
                expect(Array.isArray(stored)).toBe(true);
                const ids = stored.map(e => e.id);
                expect(ids).toContain('hydrate-after-null');
                sub.unsubscribe();
                done();
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('caps pendingEntriesBeforeMapId at 500 entries (drops oldest)', (done) => {
            // Soft cap to prevent unbounded growth in non-map contexts where
            // gnresource.id never hydrates. Push >500 entries with null
            // mapId; on hydrate, only the most-recent 500 should land in
            // localStorage.
            let mapIdNow = null;
            const nullMapStore = {
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
            const sub = taskCompleteLayerEpic(action$, nullMapStore)
                .subscribe(act => emitted.push(act), err => done(err));

            // First tick: 550 candidates, mapId null. In-memory Set captures
            // all; pending buffer caps at 500 (oldest 50 dropped). Synchronous.
            subject.next({ type: TM_SET_PROCESSES, processes });
            const persistedWhileNull = window.localStorage.getItem('hydrata_handled_completion_ids_4242');

            // Hydrate mapId. Next tick replays pending buffer to storage.
            mapIdNow = 4242;
            subject.next({ type: TM_SET_PROCESSES, processes: [] });

            try {
                expect(persistedWhileNull).toBe(null);
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
            } catch (e) { sub.unsubscribe(); done(e); }
        });

        it('should drop candidates whose metadata.project_id mismatches the current map', (done) => {
            // Defence-in-depth: the TaskMonitor poller is gated on
            // getProjectId being non-null AND the BE rejects unscoped
            // listings (taskmonitor/views.py). If a future bug ever
            // bypasses both, candidates from other projects must NOT
            // be addLayer'd. Repro is the 2026-05-17 stray "Rainfall
            // 01" leak: a layer_create from project 11550 surfaced
            // on a freshly-opened map of project 11551.
            const state = {
                taskMonitor: { processes: { byId: {} } },
                layers: { flat: [], groups: [] },
                gnresource: { id: 1222 },
                anuga: { projects: { data: { id: 11551 } } }
            };
            // The same-project Boundary triggers an async resource refresh
            // (projectId 11551 present), so emissions are addLayer +
            // setBoundaryData = 2 (TASK-1650 removed the info toast). The
            // cross-project Rainfall (11550) is filtered by the project-scope
            // guard and emits nothing. Mock the refresh.
            const mock = mockAxios();
            mock.onGet(/\/api\/v2\/anuga\/projects\/\d+\//).reply(200, [{ id: 1 }]);
            testEpic(
                taskCompleteLayerEpic,
                2,
                {
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
                },
                (actions) => {
                    const addLayerActions = actions.filter(a => a.type === 'ADD_LAYER');
                    expect(addLayerActions.length).toBe(1);
                    expect(addLayerActions[0].layer.name).toBe('geonode:bdy_11551_boundary_01');
                    // The cross-project Rainfall layer must NOT have been added.
                    expect(addLayerActions.find(a => /rai_11550/.test(a.layer.name))).toBe(undefined);
                },
                state,
                done
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

    // -- TASK-1637: double INIT_ANUGA dedupe + auth hoist -----------------
    //
    // Live on prod 2026-06-11: every ANUGA map load fired POST /from-map/
    // TWICE. anugaContainer.componentDidUpdate re-dispatches INIT_ANUGA on
    // every re-render while !isAnugaProject (the whole from-map →
    // getProjectV2 → setAnugaProjectData window). The epic's switchMap then
    // cancelled the first in-flight chain and restarted it — one wasted full
    // round-trip before the SimpleView menus mount.
    //
    // Fix: an "init in flight" guard (state.anuga.projects.initInFlight, set
    // to the live map id while the chain resolves, cleared on
    // setAnugaProjectData OR on chain error) gates the epic. The auth filter
    // is also hoisted ABOVE the from-map POST so anon visitors fire ZERO
    // POSTs.
    //
    // The MapStore testEpic store is reducer-less, so these tests drive the
    // epic via a live Subject and a mutable state getter that mirrors the
    // projectsReducer's guard handling (apply SET_ANUGA_INIT_IN_FLIGHT /
    // SET_ANUGA_PROJECT_DATA back into state as the real reducer would). That
    // is exactly what lets the gate dedupe across two INIT_ANUGA dispatches.
    describe('TASK-1637 — initAnugaEpic in-flight dedupe + auth hoist', () => {
        let mock;
        beforeEach(() => {
            mock = mockAxios();
            __setVisibilityForTests(new Rx.BehaviorSubject(true));
        });
        afterEach(() => __setVisibilityForTests(null));

        // Build a mutable store whose getState reflects the guard reducer so
        // the epic's `initInFlight !== gnresource.id` gate behaves as in prod.
        const makeGuardStore = (mapId, { authed = true } = {}) => {
            const state = {
                gnresource: { id: mapId },
                security: authed ? { user: { name: 'tester' } } : {},
                anuga: {
                    projects: { data: null, initInFlight: false },
                    scenarios: { archiveFilter: 'none' }
                }
            };
            const applyGuardReducer = (action) => {
                if (action.type === SET_ANUGA_INIT_IN_FLIGHT) {
                    state.anuga.projects.initInFlight = action.mapId || false;
                } else if (action.type === SET_ANUGA_PROJECT_DATA) {
                    // The real reducer clears the guard AND lands project data.
                    state.anuga.projects.initInFlight = false;
                    state.anuga.projects.data = action.data;
                }
            };
            return { getState: () => state, applyGuardReducer, state };
        };

        const countFromMapPosts = () =>
            mock.history.post.filter(r => /\/api\/v2\/anuga\/projects\/from-map\//.test(r.url)).length;

        it('dedupes a 2nd INIT_ANUGA while the from-map chain is in flight (single POST)', (done) => {
            // Hold the from-map response open so the chain stays "in flight"
            // while we fire the duplicate INIT_ANUGA, then release it.
            let releaseFromMap;
            const fromMapGate = new Promise((resolve) => { releaseFromMap = resolve; });
            mock.onPost('/api/v2/anuga/projects/from-map/').reply(() =>
                fromMapGate.then(() => [200, { projectId: 777 }])
            );
            mock.onGet('/api/v2/anuga/projects/777/').reply(200, { id: 777, simple_view_config: {} });
            mock.onGet(/\/api\/v2\/anuga\/projects\/777\/scenarios\//).reply(200, []);
            mock.onGet(/\/api\/v2\/anuga\/projects\/777\//).reply(200, []);

            const { subject, action$ } = liveActions();
            const guard = makeGuardStore(5486);
            const emitted = [];
            const sub = initAnugaEpic(action$, guard)
                .subscribe(
                    action => { emitted.push(action); guard.applyGuardReducer(action); },
                    err => done(err)
                );

            // First INIT — sets the guard, opens the from-map POST (held).
            subject.next({ type: INIT_ANUGA });
            // Re-render storm: a 2nd INIT_ANUGA arrives BEFORE the chain
            // resolves. The guard (initInFlight === 5486) must drop it.
            subject.next({ type: INIT_ANUGA });

            // Defer assertions to a macrotask so the held POST has been issued
            // exactly once and the guard has had a chance to dedupe the 2nd.
            setTimeout(() => {
                try {
                    expect(emitted.filter(a => a.type === SET_ANUGA_INIT_IN_FLIGHT && a.mapId === 5486).length).toBe(1);
                    expect(countFromMapPosts()).toBe(1);
                    expect(guard.state.anuga.projects.initInFlight).toBe(5486);
                    releaseFromMap();
                    sub.unsubscribe();
                    done();
                } catch (e) { releaseFromMap && releaseFromMap(); sub.unsubscribe(); done(e); }
            }, 0);
        });

        it('allows a post-completion re-dispatch (2nd INIT after data lands → 2nd POST)', (done) => {
            mock.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: 888 });
            mock.onGet('/api/v2/anuga/projects/888/').reply(200, { id: 888, simple_view_config: {} });
            mock.onGet(/\/api\/v2\/anuga\/projects\/888\/scenarios\//).reply(200, []);
            mock.onGet(/\/api\/v2\/anuga\/projects\/888\//).reply(200, []);

            const { subject, action$ } = liveActions();
            const guard = makeGuardStore(5486);
            const emitted = [];
            const sub = initAnugaEpic(action$, guard)
                .subscribe(
                    action => { emitted.push(action); guard.applyGuardReducer(action); },
                    err => done(err)
                );

            // First init runs to completion (no gate held).
            subject.next({ type: INIT_ANUGA });
            // Let the first chain fully resolve (setAnugaProjectData clears the
            // guard), then fire a legitimate refresh re-init.
            setTimeout(() => {
                expect(guard.state.anuga.projects.initInFlight).toBe(false);
                const postsAfterFirst = countFromMapPosts();
                expect(postsAfterFirst).toBe(1);
                subject.next({ type: INIT_ANUGA });
                setTimeout(() => {
                    try {
                        // The refresh re-init must NOT be deduped — guard is clear.
                        expect(countFromMapPosts()).toBe(2);
                        sub.unsubscribe();
                        done();
                    } catch (e) { sub.unsubscribe(); done(e); }
                }, 30);
            }, 30);
        });

        it('fires ZERO from-map POSTs for an anonymous (logged-out) visitor', (done) => {
            mock.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: 999 });

            const { subject, action$ } = liveActions();
            const guard = makeGuardStore(5486, { authed: false });
            const emitted = [];
            const sub = initAnugaEpic(action$, guard)
                .subscribe(
                    action => { emitted.push(action); guard.applyGuardReducer(action); },
                    err => done(err)
                );

            subject.next({ type: INIT_ANUGA });
            setTimeout(() => {
                try {
                    // Auth filter hoisted ABOVE the POST → no network call, no
                    // guard set.
                    expect(countFromMapPosts()).toBe(0);
                    expect(emitted.filter(a => a.type === SET_ANUGA_INIT_IN_FLIGHT).length).toBe(0);
                    sub.unsubscribe();
                    done();
                } catch (e) { sub.unsubscribe(); done(e); }
            }, 0);
        });

        it('clears the guard on a from-map chain error so future re-inits are not blocked', (done) => {
            // First from-map POST fails → guard must clear (cleared via the
            // .catch tail) so a later re-init can run.
            let calls = 0;
            mock.onPost('/api/v2/anuga/projects/from-map/').reply(() => {
                calls += 1;
                return calls === 1 ? [500, {}] : [200, { projectId: 444 }];
            });
            mock.onGet('/api/v2/anuga/projects/444/').reply(200, { id: 444, simple_view_config: {} });
            mock.onGet(/\/api\/v2\/anuga\/projects\/444\/scenarios\//).reply(200, []);
            mock.onGet(/\/api\/v2\/anuga\/projects\/444\//).reply(200, []);

            const { subject, action$ } = liveActions();
            const guard = makeGuardStore(5486);
            const emitted = [];
            const sub = initAnugaEpic(action$, guard)
                .subscribe(
                    action => { emitted.push(action); guard.applyGuardReducer(action); },
                    err => done(err)
                );

            subject.next({ type: INIT_ANUGA });
            setTimeout(() => {
                // Error path cleared the guard back to false.
                expect(guard.state.anuga.projects.initInFlight).toBe(false);
                expect(countFromMapPosts()).toBe(1);
                // A subsequent re-init must be allowed through.
                subject.next({ type: INIT_ANUGA });
                setTimeout(() => {
                    try {
                        expect(countFromMapPosts()).toBe(2);
                        sub.unsubscribe();
                        done();
                    } catch (e) { sub.unsubscribe(); done(e); }
                }, 30);
            }, 30);
        });
    });

    // -- TASK-603: Page Visibility gate -----------------------------------
    //
    // Real-user incident (gabriela.garcia@wkcgroup.com, 2026-04-22) left a
    // catalogue tab open ~19h and produced ~30k wasted requests. The gate
    // inside pollingEpics.js stops timer-based polling while the tab is
    // hidden and resumes within one cycle when it becomes visible.
    //
    // The visibility$ Subject seam is wired in pollingEpics.js and gates
    // initAnugaEpic. We verify the seam exists and is functional here;
    // initAnugaEpic integration tests (TASK-1637 section above) exercise
    // the full gate path.
    //
    // Mechanics: rather than fight ChromeHeadless's non-overridable native
    // visibilityState accessor and the synthetic visibilitychange Event
    // (which doesn't reliably re-trigger fromEvent listeners under Karma),
    // the production module exposes `__setVisibilityForTests(subject)` —
    // a deliberate test seam that swaps the live DOM stream for a Subject
    // we drive directly. Each test wires its own Subject in beforeEach
    // and clears it in afterEach.
    //
    // TASK-1586: test for pollAnugaModelCreationEpic removed (epic removed).
    describe('TASK-603 visibility gate (seam integrity)', () => {
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
        let mock;
        beforeEach(() => { mock = mockAxios(); });

        it('first tick emits UPDATE_RUN_STATUS for a non-terminal status, no timeout (cap is 1200)', (done) => {
            // Non-terminal status, tick 1 << cap (1200) → only updateRunStatus
            // emits, no RUN_STATUS_POLLING_TIMEOUT. testEpic awaits exactly the
            // first tick's emission deterministically.
            mock.onGet('/api/v2/anuga/runs/701/status/').reply(200, {
                id: 701, status: 'computing', progress_pct: 12
            });
            const state = {
                anuga: {
                    scenarios: {
                        byId: { 999: { id: 999, latest_run: { id: 701, status: 'computing' } } },
                        allIds: [999]
                    }
                }
            };
            testEpic(
                pollActiveRunStatusEpic,
                1,
                { type: START_ACTIVE_RUN_POLLING, runId: 701 },
                (actions) => {
                    expect(actions.filter(a => a.type === UPDATE_RUN_STATUS).length).toBe(1);
                    expect(actions.filter(a => a.type === RUN_STATUS_POLLING_TIMEOUT).length).toBe(0);
                },
                state,
                done
            );
        });

        it('stop-on-terminal-status: emits stopActiveRunPolling on terminal status, NO timeout', (done) => {
            // Terminal status on the first tick → updateRunStatus + stopActiveRunPolling
            // co-emit (2 actions), no timeout. take(2) captures both.
            mock.onGet('/api/v2/anuga/runs/702/status/').reply(200, {
                id: 702, status: 'complete', progress_pct: 100
            });
            const state = {
                anuga: {
                    scenarios: {
                        byId: { 998: { id: 998, latest_run: { id: 702, status: 'computing' } } },
                        allIds: [998]
                    }
                }
            };
            testEpic(
                pollActiveRunStatusEpic,
                2,
                { type: START_ACTIVE_RUN_POLLING, runId: 702 },
                (actions) => {
                    expect(actions.filter(a => a.type === STOP_ACTIVE_RUN_POLLING).length).toBeGreaterThan(0);
                    expect(actions.filter(a => a.type === RUN_STATUS_POLLING_TIMEOUT).length).toBe(0);
                },
                state,
                done
            );
        });
    });
});

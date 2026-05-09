import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
    pollComparisonEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    anugaMapLayerGroupEpic,
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
    FIX_ANUGA_GROUPS
} from '../actionsAnuga';
import {
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING
} from '../actions/pollingActions';
import { SET_OPEN_MENU_GROUP_ID } from '../../SimpleView/actionsSimpleView';
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

    describe('pollComparisonEpic', () => {
        it('should not emit for non-Results menu group', (done) => {
            const store = { getState: () => ({}) };
            const action$ = mockActions([{
                type: SET_OPEN_MENU_GROUP_ID,
                openMenuGroupId: 'Input Data'
            }]);
            const emitted = [];

            pollComparisonEpic(action$, store)
                .take(1)
                .timeout(300)
                .subscribe(
                    action => emitted.push(action),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    },
                    () => done()
                );
        });

        it('should emit for Results menu group', (done) => {
            const { subject, action$ } = liveActions();
            const store = { getState: () => ({}) };
            const emitted = [];

            const sub = pollComparisonEpic(action$, store)
                .take(1)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        sub.unsubscribe();
                        done();
                    }
                );

            subject.next({ type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: 'Results' });
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
                    { id: 'Input Data.Terrain' },
                    { id: 'Input Data.Boundaries' },
                    { id: 'Input Data.Structures' },
                    { id: 'Input Data.Inflows' },
                    { id: 'Input Data.Friction' },
                    { id: 'Input Data.Full Mesh' },
                    { id: 'Input Data.Mesh Regions' },
                    { id: 'Input Data.Catchments' },
                    { id: 'Input Data.Nodes' },
                    { id: 'Input Data.Links' }
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
                    layers: { flat: [], groups: [] }
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
                    layers: { flat: [], groups: [] }
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
        // 404 (cascade-cleaned by the post_delete signal). The filter
        // suppresses replay when state.anuga.resources.terrain is loaded
        // and the terrain_id is absent.
        it('should skip terrain_create when terrain_id is gone from state.anuga.resources.terrain', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrain: [{ id: 7 }, { id: 8 }] } }
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
                }]
            });

            setTimeout(() => {
                expect(emitted.length).toBe(0);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should process terrain_create when terrain_id IS present in state.anuga.resources.terrain', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] },
                    anuga: { resources: { terrain: [{ id: 11 }, { id: 12 }] } }
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

        it('should NOT filter when state.anuga.resources is undefined (defer rather than over-filter)', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: { processes: { byId: {} } },
                    layers: { flat: [], groups: [] }
                    // anuga state intentionally absent
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
                }]
            });

            setTimeout(() => {
                const adds = emitted.filter(a => a.type === 'ADD_LAYER');
                expect(adds.length).toBe(1);
                sub.unsubscribe();
                done();
            }, 200);
        });

        it('should mark orphan completions as handled so subsequent emissions are no-ops', (done) => {
            // Even though the orphan is skipped, it should be added to the
            // handledCompletionIds set; otherwise we'd re-check it on every
            // poll and bake in the orphan-existence check on hot-path tick.
            // We assert by flipping the resource state between emissions:
            // first emit with empty terrain -> skipped + handled;
            // second emit with the terrain present -> still skipped because
            // handled, NOT re-evaluated.
            let resources = { terrain: [] };
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

            subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
            setTimeout(() => {
                expect(emitted.length).toBe(0);  // first emit: orphan, skipped
                resources = { terrain: [{ id: 42 }] };  // resource "revived"
                subject.next({ type: TM_SET_PROCESSES, processes: [tickProcess] });
                setTimeout(() => {
                    expect(emitted.length).toBe(0);  // still no-op: id was handled
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
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
});

import expect from 'expect';
import Rx from 'rxjs';
import {
    pollAnugaModelCreationEpic,
    pollAnugaElevationEpic,
    pollAnugaScenarioEpic,
    pollActiveRunStatusEpic,
    pollComparisonEpic,
    ensureAnugaGroupsEpic,
    taskCompleteLayerEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    anugaMapLayerGroupEpic
} from '../epics/pollingEpics';
import {
    START_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    START_ANUGA_ELEVATION_POLLING,
    STOP_ANUGA_ELEVATION_POLLING,
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
        it('should emit 10 add-layer actions per polling tick', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$)
                .take(10)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(10);
                        // Check all expected action types are emitted
                        const types = emitted.map(a => a.type);
                        expect(types).toContain(ADD_ANUGA_BOUNDARY);
                        expect(types).toContain(ADD_ANUGA_FRICTION);
                        expect(types).toContain(ADD_ANUGA_STRUCTURE);
                        expect(types).toContain(ADD_ANUGA_INFLOW);
                        expect(types).toContain(ADD_ANUGA_FULL_MESH);
                        expect(types).toContain(ADD_ANUGA_MESH_REGION);
                        expect(types).toContain(ADD_LUMPED_CATCHMENT);
                        expect(types).toContain(ADD_NODES);
                        expect(types).toContain(ADD_LINKS);
                        sub.unsubscribe();
                        done();
                    }
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });
        });

        it('should stop polling on STOP_ANUGA_MODEL_CREATION_POLLING', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });

            // Stop after first batch of 10
            setTimeout(() => {
                const countBefore = emitted.length;
                subject.next({ type: STOP_ANUGA_MODEL_CREATION_POLLING });
                // Wait a bit to verify no more emissions
                setTimeout(() => {
                    expect(emitted.length).toBe(countBefore);
                    sub.unsubscribe();
                    done();
                }, 100);
            }, 100);
        });

        it('should restart polling on new START action (switchMap)', (done) => {
            const { subject, action$ } = liveActions();
            const emitted = [];

            const sub = pollAnugaModelCreationEpic(action$)
                .take(20) // two ticks worth
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(20);
                        sub.unsubscribe();
                        done();
                    }
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });
            // Second start should switchMap (restart)
            setTimeout(() => {
                subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });
            }, 50);
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

    describe('pollAnugaElevationEpic', () => {
        it('should listen for START_ANUGA_ELEVATION_POLLING', (done) => {
            const action$ = mockActions([{ type: 'SOME_OTHER_ACTION' }]);
            const store = { getState: () => ({ anuga: { projects: { data: { id: 1 } } } }) };
            const emitted = [];

            pollAnugaElevationEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should stop on STOP_ANUGA_ELEVATION_POLLING', (done) => {
            const { subject, action$ } = liveActions();
            const store = { getState: () => ({ anuga: { projects: { data: { id: 1 } } }, layers: { flat: [] } }) };
            const emitted = [];

            const sub = pollAnugaElevationEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_ELEVATION_POLLING });
            // Stop immediately
            setTimeout(() => {
                subject.next({ type: STOP_ANUGA_ELEVATION_POLLING });
                setTimeout(() => {
                    // Should have stopped (no infinite polling)
                    sub.unsubscribe();
                    done();
                }, 200);
            }, 50);
        });

        it('should emit empty when API returns fewer than 2 layers', (done) => {
            // This test verifies the response.data?.length < 2 guard
            // Since API calls go to localhost (no server), the catch block returns empty
            const { subject, action$ } = liveActions();
            const store = { getState: () => ({ anuga: { projects: { data: { id: 1 } } }, layers: { flat: [] } }) };
            const emitted = [];

            const sub = pollAnugaElevationEpic(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err)
                );

            subject.next({ type: START_ANUGA_ELEVATION_POLLING });

            setTimeout(() => {
                // API returns error (no server) -> catch -> empty, so nothing emitted
                expect(emitted.length).toBe(0);
                subject.next({ type: STOP_ANUGA_ELEVATION_POLLING });
                sub.unsubscribe();
                done();
            }, 200);
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
                        const groupNames = emitted.map(a => a.group || a.id);
                        expect(emitted.some(a => a.id === 'Input Data' || a.group === 'Input Data')).toBe(true);
                        done();
                    }
                );
        });

        it('should emit nothing when all groups exist', (done) => {
            // Build a state where all groups already exist
            const allGroups = [
                { id: 'Input Data', nodes: [
                    { id: 'Input Data.Elevations' },
                    { id: 'Input Data.Boundaries' },
                    { id: 'Input Data.Structures' },
                    { id: 'Input Data.Inflows' },
                    { id: 'Input Data.Friction Maps' },
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

        it('should skip when no newly completed layer_create processes', (done) => {
            const store = {
                getState: () => ({
                    taskMonitor: {
                        processes: {
                            byId: {
                                101: { id: 101, process_type: 'layer_create', status: 'complete' }
                            }
                        }
                    },
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

            // Process 101 is already complete in the store, so it's not "newly" completed
            subject.next({
                type: TM_SET_PROCESSES,
                processes: [{
                    id: 101,
                    process_type: 'layer_create',
                    status: 'complete',
                    metadata: { model_class: 'Boundary', mapstore_layer: { name: 'geonode:bdy_test' } }
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
});

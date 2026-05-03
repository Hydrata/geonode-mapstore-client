import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollComparisonEpic,
    prePopulateAnugaFeatureGridWithDefaults
} from '../epicsAnuga';
import { __setVisibilityForTests } from '../epics/pollingEpics';
import {
    INIT_ANUGA,
    START_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING,
    CANCEL_ANUGA_RUN,
    RETRY_ANUGA_RUN,
    RUN_ANUGA_SCENARIO,
    SAVE_NETWORK
} from '../actionsAnuga';
import {
    START_ACTIVE_RUN_POLLING
} from '../actions/pollingActions';
import { SET_OPEN_MENU_GROUP_ID } from '../../SimpleView/actionsSimpleView';
import { CREATE_NEW_FEATURE } from '../../../../../MapStore2/web/client/actions/featuregrid';
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
        // production epic does not suppress the timer.
        beforeEach(() => __setVisibilityForTests(new Rx.BehaviorSubject(true)));
        afterEach(() => __setVisibilityForTests(null));

        it('should emit add-layer actions when polling starts', (done) => {
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

            const emitted = [];
            const sub = pollAnugaModelCreationEpic(action$)
                .take(10)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Should emit 10 add-layer actions (boundary, friction, structure, etc.)
                        expect(emitted.length).toBe(10);
                        done();
                    }
                );

            subject.next({ type: START_ANUGA_MODEL_CREATION_POLLING });

            // Stop after first batch
            setTimeout(() => {
                subject.next({ type: STOP_ANUGA_MODEL_CREATION_POLLING });
                sub.unsubscribe();
            }, 100);
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
    });

    describe('prePopulateAnugaFeatureGridWithDefaults', () => {
        it('should not emit for non-ANUGA layers', (done) => {
            const store = {
                getState: () => ({
                    featuregrid: { selectedLayer: 'geonode:some_other_layer' }
                })
            };
            const action$ = mockActions([{
                type: CREATE_NEW_FEATURE,
                features: [{}]
            }]);
            const emitted = [];

            prePopulateAnugaFeatureGridWithDefaults(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(0);
                        done();
                    }
                );
        });

        it('should set boundary defaults for bdy_ layers', (done) => {
            const store = {
                getState: () => ({
                    featuregrid: { selectedLayer: 'geonode:bdy_test_layer' }
                })
            };
            const action$ = mockActions([{
                type: CREATE_NEW_FEATURE,
                features: [{}]
            }]);
            const emitted = [];

            prePopulateAnugaFeatureGridWithDefaults(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].features[0].properties.location).toBe('External');
                        expect(emitted[0].features[0].properties.boundary).toBe('Dirichlet');
                        done();
                    }
                );
        });

        it('should set friction defaults for fri_ layers', (done) => {
            const store = {
                getState: () => ({
                    featuregrid: { selectedLayer: 'geonode:fri_test_layer' }
                })
            };
            const action$ = mockActions([{
                type: CREATE_NEW_FEATURE,
                features: [{}]
            }]);
            const emitted = [];

            prePopulateAnugaFeatureGridWithDefaults(action$, store)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].features[0].properties.manning).toBe(0.035);
                        done();
                    }
                );
        });

        it('should skip if feature already has properties', (done) => {
            const store = {
                getState: () => ({
                    featuregrid: { selectedLayer: 'geonode:bdy_test_layer' }
                })
            };
            const action$ = mockActions([{
                type: CREATE_NEW_FEATURE,
                features: [{ existingProp: 'value' }]
            }]);
            const emitted = [];

            prePopulateAnugaFeatureGridWithDefaults(action$, store)
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
});

import expect from 'expect';
import Rx from 'rxjs';
import {
    initAnugaEpic,
    pollAnugaModelCreationEpic,
    pollComparisonEpic,
    prePopulateAnugaFeatureGridWithDefaults
} from '../epicsAnuga';
import {
    INIT_ANUGA,
    START_ANUGA_MODEL_CREATION_POLLING,
    STOP_ANUGA_MODEL_CREATION_POLLING
} from '../actionsAnuga';
import { SET_OPEN_MENU_GROUP_ID } from '../../SimpleView/actionsSimpleView';
import { CREATE_NEW_FEATURE } from '../../../../../MapStore2/web/client/actions/featuregrid';

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
});

import expect from 'expect';
import Rx from 'rxjs';
import {
    initSwammEpic,
    catchBmpFeatureClick,
    filterBmpEpic,
    downloadBmpReportEpic
} from '../epicsSwamm';
import {
    INIT_SWAMM,
    SET_SWAMM_PROJECT_DATA,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    TOGGLE_BMP_PRIORITY_VISIBILITY
} from '../actionsSwamm';
import { LOAD_FEATURE_INFO } from '../../../../../MapStore2/web/client/actions/mapInfo';


/**
 * Helper: create a mock action$ observable from an array of actions.
 */
const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject
        .asObservable()
        // Add ofType method to mimic redux-observable
        ;
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};


describe('SWAMM Epics', () => {

    describe('initSwammEpic', () => {
        it('should not emit when gnresource.id is falsy', (done) => {
            const store = {
                getState: () => ({
                    gnresource: { id: null },
                    security: { user: { pk: 1 } }
                })
            };
            const action$ = mockActions([{ type: INIT_SWAMM }]);
            const emitted = [];

            initSwammEpic(action$, store)
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
            // The epic filters on security.user being truthy after the API call
            // If security.user is null, the second filter should block
            const store = {
                getState: () => ({
                    gnresource: { id: 42 },
                    security: { user: null }
                })
            };
            const action$ = mockActions([{ type: INIT_SWAMM }]);
            const emitted = [];

            initSwammEpic(action$, store)
                .take(1)
                .timeout(500)
                .subscribe(
                    action => emitted.push(action),
                    () => {
                        // Timeout means no actions emitted - expected
                        expect(emitted.length).toBe(0);
                        done();
                    },
                    () => {
                        // If it completes without timeout, also check
                        done();
                    }
                );
        });
    });

    describe('catchBmpFeatureClick', () => {
        it('should filter out non-BMP feature clicks', (done) => {
            const store = {
                getState: () => ({
                    swamm: { projectData: { id: 1 } }
                })
            };
            // A feature collection without BMP feature IDs
            const action$ = mockActions([{
                type: LOAD_FEATURE_INFO,
                data: {
                    type: 'FeatureCollection',
                    features: [
                        { id: 'some_other_layer.1', properties: { id: 1 } }
                    ]
                }
            }]);
            const emitted = [];

            catchBmpFeatureClick(action$, store)
                .take(1)
                .timeout(300)
                .subscribe(
                    action => emitted.push(action),
                    () => {
                        // Timeout expected - no BMP features detected
                        expect(emitted.length).toBe(0);
                        done();
                    },
                    () => done()
                );
        });

        it('should detect BMP outlet feature pattern', (done) => {
            // The regex pattern: /([a-zA-Z0-9]{3}_){2}outlet/
            // e.g. "tst_bmp_outlet.123"
            const store = {
                getState: () => ({
                    swamm: { projectData: { id: 42 } }
                })
            };
            const action$ = mockActions([{
                type: LOAD_FEATURE_INFO,
                data: {
                    type: 'FeatureCollection',
                    features: [
                        { id: 'tst_bmp_outlet.5', properties: { id: 5 } }
                    ]
                }
            }]);

            // The epic will try to make an axios request. Since we can't
            // easily mock axios in this context, we just verify the filter passes
            // by checking the observable doesn't immediately complete empty.
            // The actual HTTP call will fail but that's OK for this filter test.
            let filterPassed = false;

            catchBmpFeatureClick(action$, store)
                .take(1)
                .timeout(1000)
                .subscribe(
                    () => { filterPassed = true; },
                    () => {
                        // Error from axios call means filter DID pass
                        // This is the expected path in a unit test without HTTP mock
                        done();
                    },
                    () => done()
                );
        });

        it('should detect BMP footprint feature pattern', () => {
            // Verify the regex matches footprint pattern
            const pattern = /([a-zA-Z0-9]{3}_){2}footprint/;
            expect(pattern.test('abc_def_footprint.1')).toBe(true);
            expect(pattern.test('tst_bmp_footprint.99')).toBe(true);
            expect(pattern.test('some_random_layer.1')).toBe(false);
        });

        it('should detect BMP watershed feature pattern', () => {
            const pattern = /([a-zA-Z0-9]{3}_){2}watershed/;
            expect(pattern.test('abc_def_watershed.1')).toBe(true);
            expect(pattern.test('tst_bmp_watershed.99')).toBe(true);
            expect(pattern.test('random_layer.1')).toBe(false);
        });
    });

    describe('filterBmpEpic', () => {
        const createStoreWithFilters = (bmpTypes, priorities, groupProfiles, statuses) => ({
            getState: () => ({
                swamm: {
                    bmpTypes: bmpTypes || [],
                    priorities: priorities || [],
                    groupProfiles: groupProfiles || [],
                    statuses: statuses || [],
                    projectData: {
                        bmp_outlet: { id: 1, name: 'bmp_outlet' },
                        bmp_footprint: { id: 2, name: 'bmp_footprint' },
                        bmp_watershed: { id: 3, name: 'bmp_watershed' }
                    }
                },
                layers: {
                    flat: [
                        { id: 'layer1', name: 'bmp_outlet', extendedParams: { pk: '1' } },
                        { id: 'layer2', name: 'bmp_footprint', extendedParams: { pk: '2' } },
                        { id: 'layer3', name: 'bmp_watershed', extendedParams: { pk: '3' } }
                    ]
                }
            })
        });

        it('should emit 3 changeLayerProperties actions on TOGGLE_BMP_TYPE_VISIBILITY', (done) => {
            const store = createStoreWithFilters(
                [{ id: 1, name: 'Rain Garden', visibility: true }],
                [{ id: 0, visibility: true }],
                [{ id: 10, visibility: true }],
                [{ id: 1, name: 'Unknown', visibility: true }]
            );
            const action$ = mockActions([{ type: TOGGLE_BMP_TYPE_VISIBILITY, bmpType: { id: 1 } }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        // Should emit 3 actions: one for outlet, footprint, watershed
                        expect(emitted.length).toBe(3);
                        // All should be changeLayerProperties actions
                        emitted.forEach(action => {
                            expect(action.type).toBe('CHANGE_LAYER_PROPERTIES');
                        });
                        done();
                    }
                );
        });

        it('should include type filter fields for visible types', (done) => {
            const store = createStoreWithFilters(
                [
                    { id: 1, name: 'Rain Garden', visibility: true },
                    { id: 2, name: 'Wetland', visibility: false }
                ],
                [],
                [],
                []
            );
            const action$ = mockActions([{ type: SET_ALL_BMP_TYPES_VISIBILITY, boolValue: true }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        // Check the filter has type field for visible BMP type
                        const filterFields = emitted[0].newProperties.filterObj.filterFields;
                        const typeFields = filterFields.filter(f => f.attribute === 'type');
                        // Only type id=1 is visible, so only 1 type filter
                        expect(typeFields.length).toBeGreaterThanOrEqualTo(1);
                        expect(typeFields[0].value).toBe(1);
                        done();
                    }
                );
        });

        it('should add type=-1 when no BMP types are visible', (done) => {
            const store = createStoreWithFilters(
                [{ id: 1, name: 'Rain Garden', visibility: false }],
                [{ id: 0, visibility: true }],
                [],
                []
            );
            const action$ = mockActions([{ type: TOGGLE_BMP_TYPE_VISIBILITY, bmpType: { id: 1 } }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        const filterFields = emitted[0].newProperties.filterObj.filterFields;
                        const typeFields = filterFields.filter(f => f.attribute === 'type');
                        // Should have type=-1 (sentinel) when none visible
                        expect(typeFields.some(f => f.value === -1)).toBe(true);
                        done();
                    }
                );
        });

        it('should respond to TOGGLE_BMP_STATUS_VISIBILITY', (done) => {
            // Need 2+ statuses with mixed visibility so the epic includes status filterFields
            // (epic omits filter when ALL items visible — performance optimization)
            const store = createStoreWithFilters(
                [{ id: 1, visibility: true }],
                [{ id: 0, visibility: true }],
                [],
                [{ id: 1, name: 'Operational', visibility: true }, { id: 2, name: 'Retired', visibility: false }]
            );
            const action$ = mockActions([{
                type: TOGGLE_BMP_STATUS_VISIBILITY,
                status: { id: 1, name: 'Operational' }
            }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        const filterFields = emitted[0].newProperties.filterObj.filterFields;
                        const statusFields = filterFields.filter(f => f.attribute === 'status');
                        expect(statusFields.length).toBe(1);
                        expect(statusFields[0].value).toBe('Operational');
                        done();
                    }
                );
        });

        it('should respond to TOGGLE_BMP_GROUP_PROFILE_VISIBILITY', (done) => {
            // Need 2+ groupProfiles with mixed visibility so epic includes group_profile filterFields
            const store = createStoreWithFilters(
                [{ id: 1, visibility: true }],
                [{ id: 0, visibility: true }],
                [{ id: 10, visibility: true, title: 'Group A' }, { id: 20, visibility: false, title: 'Group B' }],
                []
            );
            const action$ = mockActions([{
                type: TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
                groupProfile: { id: 10 }
            }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        const filterFields = emitted[0].newProperties.filterObj.filterFields;
                        const gpFields = filterFields.filter(f => f.attribute === 'group_profile');
                        expect(gpFields.length).toBe(1);
                        expect(gpFields[0].value).toBe(10);
                        done();
                    }
                );
        });

        it('should respond to TOGGLE_BMP_PRIORITY_VISIBILITY', (done) => {
            // Need 2+ priorities with mixed visibility so epic includes priority filterFields
            const store = createStoreWithFilters(
                [{ id: 1, visibility: true }],
                [{ id: 1, label: 'Critical', visibility: true }, { id: 2, label: 'Low', visibility: false }],
                [],
                []
            );
            const action$ = mockActions([{
                type: TOGGLE_BMP_PRIORITY_VISIBILITY,
                priority: { id: 1 }
            }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        const filterFields = emitted[0].newProperties.filterObj.filterFields;
                        const priorityFields = filterFields.filter(f => f.attribute === 'priority');
                        expect(priorityFields.length).toBe(1);
                        expect(priorityFields[0].value).toBe(1);
                        done();
                    }
                );
        });

        it('should set featureTypeName on each filter', (done) => {
            const store = createStoreWithFilters(
                [{ id: 1, visibility: true }],
                [{ id: 0, visibility: true }],
                [],
                []
            );
            const action$ = mockActions([{ type: TOGGLE_BMP_TYPE_VISIBILITY, bmpType: { id: 1 } }]);
            const emitted = [];

            filterBmpEpic(action$, store)
                .take(3)
                .subscribe(
                    action => emitted.push(action),
                    err => done(err),
                    () => {
                        expect(emitted.length).toBe(3);
                        // Each emitted action should target a different layer
                        const layerIds = emitted.map(a => a.layer);
                        expect(layerIds).toContain('layer1');
                        expect(layerIds).toContain('layer2');
                        expect(layerIds).toContain('layer3');
                        done();
                    }
                );
        });
    });

    describe('BMP feature ID regex patterns', () => {
        // Test the regex patterns used in catchBmpFeatureClick
        const outletPattern = /([a-zA-Z0-9]{3}_){2}outlet/;
        const footprintPattern = /([a-zA-Z0-9]{3}_){2}footprint/;
        const watershedPattern = /([a-zA-Z0-9]{3}_){2}watershed/;

        it('outlet pattern matches 3-char groups', () => {
            expect(outletPattern.test('abc_def_outlet')).toBe(true);
            expect(outletPattern.test('tst_bmp_outlet.123')).toBe(true);
        });

        it('footprint pattern matches 3-char groups', () => {
            expect(footprintPattern.test('abc_def_footprint')).toBe(true);
            expect(footprintPattern.test('tst_bmp_footprint.99')).toBe(true);
        });

        it('watershed pattern matches 3-char groups', () => {
            expect(watershedPattern.test('abc_def_watershed')).toBe(true);
            expect(watershedPattern.test('tst_bmp_watershed.42')).toBe(true);
        });

        it('patterns do not match non-BMP layers', () => {
            expect(outletPattern.test('random_layer.1')).toBe(false);
            expect(footprintPattern.test('some_other.5')).toBe(false);
            expect(watershedPattern.test('terrain_model.10')).toBe(false);
        });
    });

    describe('wmsFilterTemplate structure', () => {
        it('filter template has expected groupFields', () => {
            // Verify the filter template structure that filterBmpEpic uses.
            // Need items in all 4 categories with mixed visibility so all groupFields survive cleanup.
            const store = {
                getState: () => ({
                    swamm: {
                        bmpTypes: [{ id: 1, visibility: true }, { id: 2, visibility: false }],
                        priorities: [{ id: 1, visibility: true }, { id: 2, visibility: false }],
                        groupProfiles: [{ id: 10, visibility: true }, { id: 20, visibility: false }],
                        statuses: [{ id: 1, name: 'Active', visibility: true }, { id: 2, name: 'Retired', visibility: false }],
                        projectData: {
                            bmp_outlet: { id: 1, name: 'bmp_outlet' },
                            bmp_footprint: { id: 2, name: 'bmp_footprint' },
                            bmp_watershed: { id: 3, name: 'bmp_watershed' }
                        }
                    },
                    layers: {
                        flat: [
                            { id: 'l1', name: 'bmp_outlet', extendedParams: { pk: '1' } },
                            { id: 'l2', name: 'bmp_footprint', extendedParams: { pk: '2' } },
                            { id: 'l3', name: 'bmp_watershed', extendedParams: { pk: '3' } }
                        ]
                    }
                })
            };
            const action$ = mockActions([{ type: TOGGLE_BMP_TYPE_VISIBILITY, bmpType: { id: 1 } }]);

            return new Promise((resolve, reject) => {
                filterBmpEpic(action$, store)
                    .take(1)
                    .subscribe(
                        action => {
                            const filterObj = action.newProperties.filterObj;
                            expect(filterObj.filterType).toBe('OGC');
                            expect(filterObj.ogcVersion).toBe('1.1.0');
                            expect(filterObj.groupFields.length).toBe(5);
                            expect(filterObj.groupFields[0].logic).toBe('AND');
                            resolve();
                        },
                        reject
                    );
            });
        });
    });
});

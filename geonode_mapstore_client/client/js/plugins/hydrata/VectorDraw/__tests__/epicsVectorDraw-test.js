/**
 * TASK-792 — VectorDraw epic tests.
 *
 * Mock pattern: intercept the underlying axios used by MapStore2's
 * WFS API (`getFeatureSimple` and `describeFeatureType`) via
 * axios-mock-adapter, then route by URL substring.
 *
 *  GET ...?request=DescribeFeatureType    → simple JSON describe stub
 *  GET ...?request=GetFeature (no featureID) → loadAllFeatures path
 *  GET ...?request=GetFeature&featureID=…    → loadFeature path
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';

const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

const {
    vectorDrawStartEpic,
    vectorDrawSelectExistingEpic,
    vectorDrawSaveEpic,
    vectorDrawCancelEpic,
    vectorDrawDeleteEpic,
    extractDrawGeometry
} = require('../epicsVectorDraw');

const {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    SELECT_EXISTING_FEATURE,
    SUBMIT_FORM,
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    DESCRIBE_COMPLETE,
    SAVE_ERROR,
    SAVE_SUCCESS,
    RETURN_TO_PICKER,
    DELETE_FEATURE,
    RESET
} = require('../actionsVectorDraw');

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

// Minimal store factory; tests can override pieces of state as needed.
const makeStore = (vectorDrawState = {}) => ({
    getState: () => ({
        gnsettings: { geoserverUrl: 'http://localhost:8080/geoserver/' },
        vectorDraw: vectorDrawState,
        layers: { flat: [] }
    })
});

// Stub describe response — RequestBuilder happily accepts a minimal shape
// because we never reach the WFS-T transaction in these tests.
const DESCRIBE_STUB = {
    targetPrefix: 'geonode',
    targetNamespace: 'http://geonode.org',
    featureTypes: [{
        typeName: 'test',
        properties: [
            { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon' },
            { name: 'name', type: 'xsd:string', localType: 'string' }
        ]
    }]
};

const installWfsMock = ({
    features = [],
    feature = null,
    describeFails = false
} = {}) => {
    const mock = new MockAdapter(axios);
    mock.onGet(/\/geoserver\/wfs/).reply((cfg) => {
        const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
        if (/DescribeFeatureType/i.test(url)) {
            if (describeFails) return [500, 'describe error'];
            return [200, DESCRIBE_STUB];
        }
        // GetFeature: featureID present → single feature; absent → list
        const params = cfg.params || {};
        if (params.featureID) {
            return [200, { type: 'FeatureCollection', features: feature ? [feature] : [] }];
        }
        return [200, { type: 'FeatureCollection', features }];
    });
    mock.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse fid="test.99"/>');
    return mock;
};

describe('VectorDraw Epics', () => {
    let mock;

    afterEach(() => {
        if (mock) {
            mock.restore();
            mock = null;
        }
    });

    describe('vectorDrawStartEpic — picker branch (allowPick: true)', () => {
        it('with features ≥ 1 → dispatches LOAD_FEATURE_LIST', (done) => {
            const features = [
                { id: 'test.1', properties: { title: 'Alpha' } },
                { id: 'test.2', properties: { title: 'Beta' } }
            ];
            mock = installWfsMock({ features });

            const action$ = mockActions([{
                type: START_VECTOR_DRAW,
                config: {
                    layerName: 'geonode:test',
                    geomType: 'Polygon',
                    allowPick: true
                }
            }]);

            const emitted = [];
            const sub = vectorDrawStartEpic(action$, makeStore())
                .take(1)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(LOAD_FEATURE_LIST);
                        expect(emitted[0].features).toEqual(features);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('with empty layer → dispatches SELECT_EXISTING_FEATURE(null) (skips picker UI)', (done) => {
            mock = installWfsMock({ features: [] });

            const action$ = mockActions([{
                type: START_VECTOR_DRAW,
                config: {
                    layerName: 'geonode:test',
                    geomType: 'Polygon',
                    allowPick: true
                }
            }]);

            const emitted = [];
            const sub = vectorDrawStartEpic(action$, makeStore())
                .take(1)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(SELECT_EXISTING_FEATURE);
                        expect(emitted[0].featureId).toBe(null);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    describe('vectorDrawStartEpic — edit branch (featureId set, no allowPick)', () => {
        it('dispatches SEED_FORM_VALUES with feature.properties', (done) => {
            const feature = {
                id: 'test.5',
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                properties: { name: 'Existing', value: 42 }
            };
            mock = installWfsMock({ feature });

            const action$ = mockActions([{
                type: START_VECTOR_DRAW,
                config: {
                    layerName: 'geonode:test',
                    geomType: 'Polygon',
                    featureId: 'test.5'
                }
            }]);

            const emitted = [];
            const sub = vectorDrawStartEpic(action$, makeStore())
                .take(3) // seedFormValues, describeComplete, changeDrawingStatus
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const seed = emitted.find(a => a.type === SEED_FORM_VALUES);
                        expect(seed).toExist();
                        expect(seed.properties).toEqual({ name: 'Existing', value: 42 });
                        // Order: seed precedes describeComplete (so popup mounts with values)
                        const seedIdx = emitted.findIndex(a => a.type === SEED_FORM_VALUES);
                        const dcIdx = emitted.findIndex(a => a.type === DESCRIBE_COMPLETE);
                        expect(seedIdx).toBeLessThan(dcIdx);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    describe('vectorDrawStartEpic — SWAMM regression (no allowPick, featureId set)', () => {
        it('does NOT trigger the picker branch when allowPick is omitted', (done) => {
            // Use the existing-feature stub. If the picker branch fires, it would
            // call loadAllFeatures (no featureID) and emit LOAD_FEATURE_LIST.
            // We assert that DESCRIBE_COMPLETE shows up instead, proving the
            // edit flow (not picker) ran.
            const feature = {
                id: 'bmp.5',
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                properties: { name: 'BMP-five' }
            };
            mock = installWfsMock({ feature, features: [{ id: 'should-not-be-seen' }] });

            const action$ = mockActions([{
                type: START_VECTOR_DRAW,
                config: {
                    layerName: 'geonode:dec_bmp_watershed',
                    geomType: 'Polygon',
                    featureId: 'bmp.5',
                    formConfig: null,
                    owner: 'swamm'
                }
            }]);

            const emitted = [];
            const sub = vectorDrawStartEpic(action$, makeStore())
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        // Picker branch would have emitted LOAD_FEATURE_LIST;
                        // verify that did NOT happen.
                        expect(emitted.find(a => a.type === LOAD_FEATURE_LIST)).toBe(undefined);
                        // But the edit branch should have dispatched seed + describeComplete.
                        expect(emitted.find(a => a.type === SEED_FORM_VALUES)).toExist();
                        expect(emitted.find(a => a.type === DESCRIBE_COMPLETE)).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    describe('vectorDrawSelectExistingEpic', () => {
        it('dispatches startVectorDraw with featureId set + allowPick:false', (done) => {
            const config = {
                layerName: 'geonode:test',
                geomType: 'Polygon',
                allowPick: true,
                meta: { foo: 'bar' }
            };
            // cameFromPicker=true on the store (picker rendered earlier in the
            // flow) — must be threaded into the re-dispatched config so the
            // breadcrumb survives the START_VECTOR_DRAW reducer's reset.
            const store = makeStore({ config, cameFromPicker: true });
            const action$ = mockActions([{
                type: SELECT_EXISTING_FEATURE,
                featureId: 'test.7'
            }]);

            const emitted = [];
            const sub = vectorDrawSelectExistingEpic(action$, store)
                .take(1)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(START_VECTOR_DRAW);
                        expect(emitted[0].config.featureId).toBe('test.7');
                        expect(emitted[0].config.allowPick).toBe(false);
                        // TASK-784 picker-return — flag threaded through
                        expect(emitted[0].config.cameFromPicker).toBe(true);
                        // Existing config keys preserved
                        expect(emitted[0].config.layerName).toBe('geonode:test');
                        expect(emitted[0].config.meta).toEqual({ foo: 'bar' });
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('with featureId=null re-dispatches startVectorDraw for create flow', (done) => {
            const config = { layerName: 'geonode:test', geomType: 'Polygon', allowPick: true };
            const store = makeStore({ config });
            const action$ = mockActions([{
                type: SELECT_EXISTING_FEATURE,
                featureId: null
            }]);

            const emitted = [];
            const sub = vectorDrawSelectExistingEpic(action$, store)
                .take(1)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        expect(emitted.length).toBe(1);
                        expect(emitted[0].type).toBe(START_VECTOR_DRAW);
                        expect(emitted[0].config.featureId).toBe(null);
                        expect(emitted[0].config.allowPick).toBe(false);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    // TASK-784 polish — DrawSupport's onEndDrawing has multiple call sites
    // that pass differently-shaped payloads. extractDrawGeometry normalises
    // them. The previous fast path crashed on FeatureCollection inputs with
    // "Cannot read properties of undefined (reading 'type')" — exact bug
    // hit on first user-test of create-mode save.
    describe('extractDrawGeometry (END_DRAWING shape normalisation)', () => {
        it('returns the bare geometry from a flat geometry-like payload', () => {
            const payload = {
                type: 'LineString',
                coordinates: [[0, 0], [1, 1]],
                projection: 'EPSG:3857'
            };
            const out = extractDrawGeometry(payload);
            expect(out).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
        });

        it('extracts the inner geometry from a Feature wrapper', () => {
            const payload = {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                properties: {}
            };
            const out = extractDrawGeometry(payload);
            expect(out.type).toBe('Polygon');
            expect(out.coordinates.length).toBe(1);
        });

        it('extracts the first feature\'s geometry from a FeatureCollection', () => {
            const payload = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: [[0, 0], [2, 2]] },
                        properties: {}
                    }
                ]
            };
            const out = extractDrawGeometry(payload);
            expect(out.type).toBe('LineString');
            expect(out.coordinates).toEqual([[0, 0], [2, 2]]);
        });

        it('skips empty FeatureCollection features without crashing', () => {
            expect(extractDrawGeometry({ type: 'FeatureCollection', features: [] })).toBe(null);
        });

        it('returns null for null/undefined/empty', () => {
            expect(extractDrawGeometry(null)).toBe(null);
            expect(extractDrawGeometry(undefined)).toBe(null);
            expect(extractDrawGeometry({})).toBe(null);
        });

        it('returns null for a Feature with no geometry', () => {
            expect(extractDrawGeometry({ type: 'Feature', properties: {} })).toBe(null);
        });
    });

    // CREATE-mode save bug repro: in production we observed
    // "Failed to save feature: Cannot read properties of undefined (reading 'type')"
    // after Save was clicked in the form phase. Two sub-tests verify the round-
    // trip through vectorDrawSaveEpic with a realistic Anuga Boundaries layer
    // describe stub and form values.
    describe('vectorDrawSaveEpic — CREATE mode', () => {
        const BDY_DESCRIBE_STUB = {
            targetPrefix: 'geonode',
            targetNamespace: 'http://geonode.org',
            featureTypes: [{
                typeName: 'bdy_4_test',
                properties: [
                    { name: 'the_geom', type: 'gml:LineString', localType: 'LineString', minOccurs: 0, nillable: true },
                    { name: 'Description', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true },
                    { name: 'Boundary', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true },
                    { name: 'Location', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true },
                    { name: 'Data', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true }
                ]
            }]
        };

        const installBdyMock = () => {
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply((cfg) => {
                const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
                if (/DescribeFeatureType/i.test(url)) {
                    return [200, BDY_DESCRIBE_STUB];
                }
                return [200, { type: 'FeatureCollection', features: [] }];
            });
            m.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse><wfs:InsertResults><wfs:Feature><ogc:FeatureId fid="bdy_4_test.42"/></wfs:Feature></wfs:InsertResults></wfs:TransactionResponse>');
            return m;
        };

        it('emits SAVE_SUCCESS for a complete CREATE-mode save (geometry + form values)', (done) => {
            mock = installBdyMock();
            const store = makeStore({
                phase: 'saving',
                config: {
                    layerName: 'geonode:bdy_4_test',
                    geomType: 'LineString',
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE',
                    onCancel: 'ANUGA:VECTOR_DRAW_CANCELLED'
                },
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1], [2, 0]]
                },
                formValues: {
                    Description: 'Inlet north',
                    Boundary: 'Dirichlet',
                    Location: 'External',
                    Data: ''
                }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(4)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const success = emitted.find(a => a.type === SAVE_SUCCESS);
                        const errored = emitted.find(a => a.type === SAVE_ERROR);
                        expect(errored).toBe(undefined);
                        expect(success).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        // Locks in the wfstApi defensive wrap: if a malformed describe
        // (e.g., GeoServer returns a schema without the geometry column) makes
        // RequestBuilder throw a synchronous "(reading 'type')" or
        // "(reading 'name')" stack frame, the user-facing toast must NOT
        // leak the raw stack — it must be the friendlier "Could not build
        // WFS-T insert" message wrapping the original error.
        it('surfaces a friendly SAVE_ERROR (not raw stack) for malformed describe', (done) => {
            const NO_GEOM_DESCRIBE = {
                targetPrefix: 'geonode',
                targetNamespace: 'http://geonode.org',
                featureTypes: [{
                    typeName: 'bdy_4_test',
                    properties: [
                        { name: 'Description', type: 'xsd:string', localType: 'string' }
                    ]
                }]
            };
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply(200, NO_GEOM_DESCRIBE);
            mock = m;

            const store = makeStore({
                phase: 'saving',
                config: { layerName: 'geonode:bdy_4_test', geomType: 'LineString', onComplete: 'X' },
                geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                formValues: { Description: 'foo' }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const errored = emitted.find(a => a.type === SAVE_ERROR);
                        expect(errored).toExist();
                        // Friendly prefix from wfstInsert defensive wrap;
                        // raw "(reading 'type')" / "(reading 'name')" must
                        // not be the *only* user-visible text.
                        expect(errored.error).toMatch(/Could not build WFS-T insert/);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        // Regression for the user-reported toast text. If wfstInsert throws
        // synchronously while building the WFS-T body (e.g., undefined property
        // descriptor in `getValue`), the catch handler emits SAVE_ERROR carrying
        // the raw `Cannot read properties of undefined (reading 'type')` text.
        // The fix validated here is that wfstInsert no longer crashes for this
        // shape, so SAVE_ERROR must NOT carry that string.
        it('does not emit a "reading \'type\'" SAVE_ERROR for a normal CREATE save', (done) => {
            mock = installBdyMock();
            const store = makeStore({
                phase: 'saving',
                config: {
                    layerName: 'geonode:bdy_4_test',
                    geomType: 'LineString',
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE'
                },
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1], [2, 0]]
                },
                formValues: {
                    Description: 'Inlet north',
                    Boundary: 'Dirichlet',
                    Location: 'External',
                    Data: ''
                }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(4)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const errored = emitted.find(a => a.type === SAVE_ERROR);
                        if (errored) {
                            expect(errored.error).toNotMatch(/reading 'type'/);
                        }
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    // TASK-795 review C2 — CANCEL_VECTOR_DRAW mid-save must abort the chain.
    // Pre-fix, the post-save dispatches (refreshLayerVersion, RETURN_TO_PICKER)
    // would still land on a state that the cancel epic had already reset to
    // initialState — leaving a config-less header-less picker the user can't
    // recover from without re-opening the toolbar.
    describe('vectorDrawSaveEpic — TASK-795 review C2 takeUntil(CANCEL)', () => {
        const BDY_DESCRIBE_STUB = {
            targetPrefix: 'geonode',
            targetNamespace: 'http://geonode.org',
            featureTypes: [{
                typeName: 'bdy_4_test',
                properties: [
                    { name: 'the_geom', type: 'gml:LineString', localType: 'LineString', minOccurs: 0, nillable: true },
                    { name: 'Description', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true }
                ]
            }]
        };

        it('CANCEL_VECTOR_DRAW after save POST resolves but before tail dispatch → no SAVE_SUCCESS / no RETURN_TO_PICKER', (done) => {
            // Slow the WFS-T POST so we can land CANCEL_VECTOR_DRAW between
            // SUBMIT_FORM and the post-save dispatches. The save promise
            // resolves with a fid; if the takeUntil weren't in place, the
            // tail would emit SAVE_SUCCESS (no cameFromPicker) or
            // RETURN_TO_PICKER (cameFromPicker). With the takeUntil, the
            // chain is unsubscribed before the tail fires.
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply(200, BDY_DESCRIBE_STUB);
            m.onPost(/\/geoserver\/wfs/).reply(() =>
                new Promise(resolve => setTimeout(() =>
                    resolve([200, '<wfs:TransactionResponse><wfs:InsertResults><wfs:Feature><ogc:FeatureId fid="bdy_4_test.42"/></wfs:Feature></wfs:InsertResults></wfs:TransactionResponse>']),
                80))
            );
            mock = m;

            const store = makeStore({
                phase: 'saving',
                config: {
                    layerName: 'geonode:bdy_4_test',
                    geomType: 'LineString',
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE'
                },
                geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                formValues: { Description: 'X' }
            });
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        // Tail must NOT fire — takeUntil unsubscribed the chain.
                        expect(emitted.find(a => a.type === SAVE_SUCCESS)).toBe(undefined);
                        expect(emitted.find(a => a.type === RETURN_TO_PICKER)).toBe(undefined);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );

            setTimeout(() => subject.next({ type: SUBMIT_FORM }), 0);
            // Cancel mid-save: 30ms in, before the slow POST resolves at 80ms.
            setTimeout(() => subject.next({ type: CANCEL_VECTOR_DRAW }), 30);
            setTimeout(() => subject.complete(), 200);
        });
    });

    // TASK-784 picker-return — after save (or cancel), if the original flow
    // entered through the picker, transition back to the picker phase
    // (instead of idle) so the user can quickly edit another feature.
    describe('vectorDrawSaveEpic — picker-return (cameFromPicker=true)', () => {
        const PICKER_DESCRIBE_STUB = {
            targetPrefix: 'geonode',
            targetNamespace: 'http://geonode.org',
            featureTypes: [{
                typeName: 'pkr',
                properties: [
                    { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon', minOccurs: 0, nillable: true },
                    { name: 'name', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true }
                ]
            }]
        };
        const installPickerMock = (refreshedFeatures) => {
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply((cfg) => {
                const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
                if (/DescribeFeatureType/i.test(url)) {
                    return [200, PICKER_DESCRIBE_STUB];
                }
                return [200, { type: 'FeatureCollection', features: refreshedFeatures }];
            });
            m.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse fid="pkr.42"/>');
            return m;
        };

        it('with cameFromPicker=true → re-fetches features + dispatches RETURN_TO_PICKER (NOT SAVE_SUCCESS)', (done) => {
            const refreshed = [
                { id: 'pkr.1', properties: { name: 'Alpha' } },
                { id: 'pkr.2', properties: { name: 'Beta' } },
                { id: 'pkr.42', properties: { name: 'Just-saved' } }
            ];
            mock = installPickerMock(refreshed);
            const store = makeStore({
                phase: 'saving',
                cameFromPicker: true,
                config: {
                    layerName: 'geonode:pkr',
                    geomType: 'Polygon',
                    onComplete: 'TEST:COMPLETE'
                },
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                formValues: { name: 'Just-saved' }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(5)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        const success = emitted.find(a => a.type === SAVE_SUCCESS);
                        expect(ret).toExist();
                        expect(ret.features).toEqual(refreshed);
                        // Picker-return path: SAVE_SUCCESS is NOT emitted (would
                        // have reduced phase → idle and dropped config).
                        expect(success).toBe(undefined);
                        // onComplete callback still fires (calling plugin needs
                        // to know the new feature exists)
                        expect(emitted.find(a => a.type === 'TEST:COMPLETE')).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('with cameFromPicker=false → idle path: SAVE_SUCCESS, no RETURN_TO_PICKER', (done) => {
            mock = installPickerMock([]);
            const store = makeStore({
                phase: 'saving',
                cameFromPicker: false,
                config: {
                    layerName: 'geonode:pkr',
                    geomType: 'Polygon',
                    onComplete: 'TEST:COMPLETE'
                },
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                formValues: { name: 'Solo' }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(4)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        const success = emitted.find(a => a.type === SAVE_SUCCESS);
                        expect(ret).toBe(undefined);
                        expect(success).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('with cameFromPicker=true and re-fetch fails → falls back to SAVE_SUCCESS (idle) so user is not stuck', (done) => {
            // Describe + insert succeed; the post-save GetFeature call (no
            // featureID) returns a server error → re-fetch promise rejects.
            const m = new MockAdapter(axios);
            let getCallCount = 0;
            m.onGet(/\/geoserver\/wfs/).reply((cfg) => {
                const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
                if (/DescribeFeatureType/i.test(url)) {
                    return [200, PICKER_DESCRIBE_STUB];
                }
                getCallCount += 1;
                return [500, 'simulated picker re-fetch failure'];
            });
            m.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse fid="pkr.42"/>');
            mock = m;

            const store = makeStore({
                phase: 'saving',
                cameFromPicker: true,
                config: {
                    layerName: 'geonode:pkr',
                    geomType: 'Polygon',
                    onComplete: 'TEST:COMPLETE'
                },
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                formValues: { name: 'Just-saved' }
            });
            const action$ = mockActions([{ type: SUBMIT_FORM }]);

            const emitted = [];
            const sub = vectorDrawSaveEpic(action$, store)
                .take(6)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        // The re-fetch failed → fall back: emit SAVE_SUCCESS
                        // (reducer transitions phase → idle), don't dispatch
                        // RETURN_TO_PICKER (would render an empty picker).
                        const success = emitted.find(a => a.type === SAVE_SUCCESS);
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        expect(success).toExist();
                        expect(ret).toBe(undefined);
                        expect(getCallCount).toBeGreaterThan(0);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    describe('vectorDrawCancelEpic — picker-return (cameFromPicker=true)', () => {
        it('with cameFromPicker=true → dispatches RETURN_TO_PICKER with existing list (NO re-fetch)', (done) => {
            const existingList = [
                { id: 'pkr.1', properties: { name: 'A' } },
                { id: 'pkr.2', properties: { name: 'B' } }
            ];
            // Install a mock that would FAIL if hit — proves re-fetch is skipped.
            const m = new MockAdapter(axios);
            let httpHits = 0;
            m.onAny().reply(() => {
                httpHits += 1;
                return [500, 'cancel epic should not call WFS'];
            });
            mock = m;

            const store = makeStore({
                // After CANCEL_VECTOR_DRAW reducer runs: phase='cancelling',
                // previousPhase=<whatever it was> (here 'drawing'). Tests must
                // mirror this — the epic reads state AFTER the reducer.
                phase: 'cancelling',
                previousPhase: 'drawing',
                cameFromPicker: true,
                featureList: existingList,
                config: {
                    layerName: 'geonode:pkr',
                    onCancel: 'TEST:CANCEL'
                }
            });
            const action$ = mockActions([{ type: CANCEL_VECTOR_DRAW }]);

            const emitted = [];
            const sub = vectorDrawCancelEpic(action$, store)
                .take(2)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        expect(ret).toExist();
                        // existing list is reused untouched (no re-fetch)
                        expect(ret.features).toEqual(existingList);
                        // RESET should NOT be emitted (would lose config)
                        expect(emitted.find(a => a.type === RESET)).toBe(undefined);
                        // onCancel callback should NOT fire (in-flow cancel)
                        expect(emitted.find(a => a.type === 'TEST:CANCEL')).toBe(undefined);
                        // proves no WFS call
                        expect(httpHits).toBe(0);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('with cameFromPicker=false → existing idle path: RESET + onCancel', (done) => {
            const store = makeStore({
                phase: 'cancelling',
                previousPhase: 'drawing',
                cameFromPicker: false,
                config: {
                    layerName: 'geonode:pkr',
                    onCancel: 'TEST:CANCEL'
                }
            });
            const action$ = mockActions([{ type: CANCEL_VECTOR_DRAW }]);

            const emitted = [];
            const sub = vectorDrawCancelEpic(action$, store)
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        const reset = emitted.find(a => a.type === RESET);
                        const cancel = emitted.find(a => a.type === 'TEST:CANCEL');
                        expect(ret).toBe(undefined);
                        expect(reset).toExist();
                        expect(cancel).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('cancelling FROM the picker itself (previousPhase=picking) → exits to idle, NOT loop back to picker', (done) => {
            // Regression: clicking X on the picker header dispatches
            // CANCEL_VECTOR_DRAW. cameFromPicker is sticky-true (set on
            // LOAD_FEATURE_LIST). Without the previousPhase check the same
            // picker re-renders forever — close button does nothing.
            // Real-world state shape: reducer set phase='cancelling' first,
            // then captured the prior phase as previousPhase='picking'.
            const store = makeStore({
                phase: 'cancelling',
                previousPhase: 'picking',
                cameFromPicker: true,
                featureList: [{ id: 'x.1', properties: { name: 'A' } }],
                config: {
                    layerName: 'geonode:pkr',
                    onCancel: 'TEST:CANCEL'
                }
            });
            const action$ = mockActions([{ type: CANCEL_VECTOR_DRAW }]);

            const emitted = [];
            const sub = vectorDrawCancelEpic(action$, store)
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        // MUST exit to idle: RESET fires + onCancel callback fires
                        expect(emitted.find(a => a.type === RETURN_TO_PICKER)).toBe(undefined);
                        expect(emitted.find(a => a.type === RESET)).toExist();
                        expect(emitted.find(a => a.type === 'TEST:CANCEL')).toExist();
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });

    // TASK-784 picker-delete — trash icon on each picker row dispatches
    // DELETE_FEATURE → epic does WFS-T delete → re-fetches → RETURN_TO_PICKER.
    describe('vectorDrawDeleteEpic', () => {
        const DEL_DESCRIBE_STUB = {
            targetPrefix: 'geonode',
            targetNamespace: 'http://geonode.org',
            featureTypes: [{
                typeName: 'pkr',
                properties: [
                    { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon', minOccurs: 0, nillable: true },
                    { name: 'name', type: 'xsd:string', localType: 'string', minOccurs: 0, nillable: true }
                ]
            }]
        };

        const installDeleteMock = (refreshedFeatures, { failPost = false, failGet = false } = {}) => {
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply((cfg) => {
                const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
                if (/DescribeFeatureType/i.test(url)) {
                    return [200, DEL_DESCRIBE_STUB];
                }
                if (failGet) return [500, 'simulated re-fetch failure'];
                return [200, { type: 'FeatureCollection', features: refreshedFeatures }];
            });
            if (failPost) {
                m.onPost(/\/geoserver\/wfs/).reply(
                    200,
                    '<ows:ExceptionReport><ows:Exception><ows:ExceptionText>simulated delete failure</ows:ExceptionText></ows:Exception></ows:ExceptionReport>'
                );
            } else {
                m.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse/>');
            }
            return m;
        };

        it('happy path: delete → toast + RETURN_TO_PICKER with refreshed list (deleted row gone)', (done) => {
            const refreshed = [
                { id: 'pkr.1', properties: { name: 'Alpha' } }
                // pkr.2 deleted, no longer in refreshed list
            ];
            mock = installDeleteMock(refreshed);
            const store = makeStore({
                phase: 'picking',
                cameFromPicker: true,
                featureList: [
                    { id: 'pkr.1', properties: { name: 'Alpha' } },
                    { id: 'pkr.2', properties: { name: 'Beta' } }
                ],
                config: { layerName: 'geonode:pkr' }
            });
            const action$ = mockActions([{ type: DELETE_FEATURE, featureId: 'pkr.2' }]);

            const emitted = [];
            const sub = vectorDrawDeleteEpic(action$, store)
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        expect(ret).toExist();
                        expect(ret.features).toEqual(refreshed);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('WFS-T delete error → error toast + RETURN_TO_PICKER with original list (no row removed)', (done) => {
            mock = installDeleteMock([], { failPost: true });
            const original = [
                { id: 'pkr.1', properties: { name: 'Alpha' } },
                { id: 'pkr.2', properties: { name: 'Beta' } }
            ];
            const store = makeStore({
                phase: 'picking',
                cameFromPicker: true,
                featureList: original,
                config: { layerName: 'geonode:pkr' }
            });
            const action$ = mockActions([{ type: DELETE_FEATURE, featureId: 'pkr.2' }]);

            const emitted = [];
            const sub = vectorDrawDeleteEpic(action$, store)
                .take(2)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        expect(ret).toExist();
                        // Server delete failed → cached list reused untouched.
                        expect(ret.features).toEqual(original);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        it('delete succeeds + re-fetch fails → warning toast + local-filtered list (deleted row dropped client-side)', (done) => {
            mock = installDeleteMock([], { failGet: true });
            const original = [
                { id: 'pkr.1', properties: { name: 'Alpha' } },
                { id: 'pkr.2', properties: { name: 'Beta' } }
            ];
            const store = makeStore({
                phase: 'picking',
                cameFromPicker: true,
                featureList: original,
                config: { layerName: 'geonode:pkr' }
            });
            const action$ = mockActions([{ type: DELETE_FEATURE, featureId: 'pkr.2' }]);

            const emitted = [];
            const sub = vectorDrawDeleteEpic(action$, store)
                .take(3)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        const ret = emitted.find(a => a.type === RETURN_TO_PICKER);
                        expect(ret).toExist();
                        expect(ret.features.length).toBe(1);
                        expect(ret.features[0].id).toBe('pkr.1');
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });

        // TASK-795 review C2 — CANCEL_VECTOR_DRAW mid-delete must abort the
        // chain so the tail RETURN_TO_PICKER doesn't land on already-reset
        // state. Pre-fix, the post-delete refresh would still resolve and
        // re-mount the picker on a config-less idle state.
        it('CANCEL_VECTOR_DRAW mid-delete aborts the post-delete chain (no RETURN_TO_PICKER)', (done) => {
            // The post-delete chain does the WFS-T POST first, then a GET
            // re-fetch. We slow the GET so the cancel can land before the
            // chain emits RETURN_TO_PICKER.
            const m = new MockAdapter(axios);
            m.onGet(/\/geoserver\/wfs/).reply((cfg) => {
                const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
                if (/DescribeFeatureType/i.test(url)) {
                    return [200, {
                        targetPrefix: 'geonode',
                        targetNamespace: 'http://geonode.org',
                        featureTypes: [{
                            typeName: 'pkr',
                            properties: [
                                { name: 'the_geom', type: 'gml:Polygon', localType: 'Polygon', minOccurs: 0, nillable: true }
                            ]
                        }]
                    }];
                }
                // Slow re-fetch: gives the cancel a window to land first.
                return new Promise(resolve => setTimeout(() => resolve([200, { type: 'FeatureCollection', features: [] }]), 80));
            });
            m.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse/>');
            mock = m;

            const store = makeStore({
                phase: 'picking',
                cameFromPicker: true,
                featureList: [{ id: 'pkr.1' }, { id: 'pkr.2' }],
                config: { layerName: 'geonode:pkr' }
            });
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

            const emitted = [];
            const sub = vectorDrawDeleteEpic(action$, store)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        // Tail RETURN_TO_PICKER must NOT have landed because
                        // CANCEL_VECTOR_DRAW unsubscribed the chain mid-flight.
                        expect(emitted.find(a => a.type === RETURN_TO_PICKER)).toBe(undefined);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );

            setTimeout(() => subject.next({ type: DELETE_FEATURE, featureId: 'pkr.2' }), 0);
            // Cancel mid-delete: after the WFS-T POST returns but before the
            // re-fetch resolves (re-fetch is delayed 80ms above).
            setTimeout(() => subject.next({ type: CANCEL_VECTOR_DRAW }), 30);
            setTimeout(() => subject.complete(), 200);
        });

        it('missing layerName → error toast, no WFS call, no RETURN_TO_PICKER', (done) => {
            const m = new MockAdapter(axios);
            let httpHits = 0;
            m.onAny().reply(() => { httpHits += 1; return [500, 'should not be called']; });
            mock = m;

            const store = makeStore({
                phase: 'picking',
                cameFromPicker: true,
                featureList: [],
                config: {} // no layerName
            });
            const action$ = mockActions([{ type: DELETE_FEATURE, featureId: 'pkr.2' }]);

            const emitted = [];
            const sub = vectorDrawDeleteEpic(action$, store)
                .take(1)
                .timeout(2000)
                .subscribe(
                    (a) => emitted.push(a),
                    (err) => done(err),
                    () => {
                        expect(emitted.find(a => a.type === RETURN_TO_PICKER)).toBe(undefined);
                        expect(httpHits).toBe(0);
                        if (sub) sub.unsubscribe();
                        done();
                    }
                );
        });
    });
});

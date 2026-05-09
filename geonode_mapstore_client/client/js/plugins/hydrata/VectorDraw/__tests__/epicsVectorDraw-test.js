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
    extractDrawGeometry
} = require('../epicsVectorDraw');

const {
    START_VECTOR_DRAW,
    SELECT_EXISTING_FEATURE,
    SUBMIT_FORM,
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    DESCRIBE_COMPLETE,
    SAVE_ERROR,
    SAVE_SUCCESS
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
            const store = makeStore({ config });
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
});

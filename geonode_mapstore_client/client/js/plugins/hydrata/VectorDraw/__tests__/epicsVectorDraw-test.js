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
    extractDrawGeometry
} = require('../epicsVectorDraw');

const {
    START_VECTOR_DRAW,
    SELECT_EXISTING_FEATURE,
    SEED_FORM_VALUES,
    LOAD_FEATURE_LIST,
    DESCRIBE_COMPLETE
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
});

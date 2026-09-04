/**
 * TASK-1407 (ISSUE 9) + TASK-1408 (ISSUE 11) — VectorDraw fix tests.
 *
 * TASK-1407: After drawing a boundary (CREATE mode), the vertex-edit interaction
 * should be re-enabled so the user can adjust vertices before saving.
 * Tests: save epic reads from draw.tempFeatures geometry if available (vertex edits
 * are in draw state, not vectorDraw.geometry).
 *
 * TASK-1408: Cancel after drawing a boundary should return to the picker with the
 * populated feature list (not an empty list).
 * Tests: START_VECTOR_DRAW with cameFromPicker=true preserves featureList.
 *
 * These tests are RED before the fixes and GREEN after.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import reducer from '../reducerVectorDraw';
import { vectorDrawSaveEpic } from '../epicsVectorDraw';
import {
    START_VECTOR_DRAW,
    SUBMIT_FORM,
    LOAD_FEATURE_LIST
} from '../actionsVectorDraw';

// ── TASK-1408 tests (reducer) ──────────────────────────────────────────────

describe('TASK-1408 reducerVectorDraw — featureList preserved on picker re-entry', () => {

    const stateWithFeatures = {
        phase: 'picking',
        config: { layerName: 'geonode:bdy_1_boundary_01', geomType: 'LineString', allowPick: true },
        geometry: null,
        formValues: {},
        featureList: [
            { id: 'bdy_1_boundary_01.1', properties: { title: 'outside bdy' } },
            { id: 'bdy_1_boundary_01.2', properties: { title: 'inner bdy' } }
        ],
        cameFromPicker: true,
        previousPhase: null,
        error: null
    };

    it('preserves featureList when START_VECTOR_DRAW has cameFromPicker=true (ISSUE 11 fix)', () => {
        // Simulate vectorDrawSelectExistingEpic re-dispatching startVectorDraw
        // with cameFromPicker=true. Without the fix, ...initialState resets
        // featureList=[] and Cancel returns an empty picker.
        const config = {
            layerName: 'geonode:bdy_1_boundary_01',
            geomType: 'LineString',
            featureId: null,
            allowPick: false,
            cameFromPicker: true
        };
        const nextState = reducer(stateWithFeatures, { type: START_VECTOR_DRAW, config });
        // featureList must survive the transition (was cleared by ...initialState before fix)
        expect(nextState.featureList).toEqual(stateWithFeatures.featureList);
        expect(nextState.featureList.length).toBe(2);
        expect(nextState.cameFromPicker).toBe(true);
        expect(nextState.phase).toBe('describing');
    });

    it('clears featureList on a fresh (non-picker) START_VECTOR_DRAW', () => {
        const config = {
            layerName: 'geonode:bdy_1_boundary_01',
            geomType: 'LineString',
            cameFromPicker: false
        };
        const nextState = reducer(stateWithFeatures, { type: START_VECTOR_DRAW, config });
        // cameFromPicker=false → featureList is cleared (correct, not a picker flow)
        expect(nextState.featureList).toEqual([]);
    });

    it('clears featureList when cameFromPicker is absent (external startVectorDraw)', () => {
        const config = { layerName: 'geonode:bdy_1_boundary_01', geomType: 'LineString' };
        const nextState = reducer(stateWithFeatures, { type: START_VECTOR_DRAW, config });
        expect(nextState.featureList).toEqual([]);
    });

    it('LOAD_FEATURE_LIST still populates featureList as before', () => {
        const features = [{ id: 'bdy.1', properties: { title: 'north' } }];
        const base = { ...reducer(undefined, { type: '@@INIT' }) };
        const next = reducer(base, { type: LOAD_FEATURE_LIST, features });
        expect(next.phase).toBe('picking');
        expect(next.featureList).toEqual(features);
        expect(next.cameFromPicker).toBe(true);
    });
});

// ── TASK-1407 tests (save epic) ─────────────────────────────────────────────

describe('TASK-1407 vectorDrawSaveEpic — prefers draw state geometry for vertex edits', () => {

    const drawnGeometry = {
        type: 'LineString',
        coordinates: [[151.0, -33.0], [151.5, -33.0]]
    };
    const editedGeometry = {
        type: 'LineString',
        coordinates: [[151.0, -33.0], [151.3, -33.2], [151.5, -33.0]]
    };

    // Create a mock store that simulates the save phase
    const makeMockStore = ({ vectorDrawGeometry, tempFeatures, features } = {}) => ({
        getState: () => ({
            vectorDraw: {
                phase: 'saving',
                config: {
                    layerName: 'geonode:bdy_1_boundary_01',
                    featureId: null,
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE'
                },
                geometry: vectorDrawGeometry || drawnGeometry,
                formValues: { title: 'North boundary' }
            },
            draw: {
                tempFeatures: tempFeatures !== undefined ? tempFeatures : [],
                features: features !== undefined ? features : []
            },
            layers: { flat: [] },
            gnsettings: { geoserverUrl: null }
        })
    });

    it('uses vectorDraw.geometry when no draw.tempFeatures or draw.features (no vertex edit)', (done) => {
        const store = makeMockStore({ vectorDrawGeometry: drawnGeometry });
        // We can't easily mock the import, so we check the saveError is NOT dispatched
        // (geometry is present → save is attempted) and no "No geometry" error.
        const action$ = new Rx.Subject();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const emitted = [];
        vectorDrawSaveEpic(action$, store)
            .take(1)
            .timeout(500)
            .subscribe(
                a => emitted.push(a),
                () => {
                    // Timeout or error — geometry was present so save was attempted (not a "no geometry" error)
                    // This is expected since wfstInsert would fail (no real GeoServer)
                    expect(emitted.filter(a => a.type === 'VECTOR_DRAW:SAVE_ERROR' &&
                        a.error && a.error.includes('No geometry'))).toEqual([]);
                    done();
                },
                () => {
                    expect(emitted.filter(a => a.type === 'VECTOR_DRAW:SAVE_ERROR' &&
                        a.error && a.error.includes('No geometry'))).toEqual([]);
                    done();
                }
            );
        action$.next({ type: SUBMIT_FORM });
    });

    it('uses draw.tempFeatures[0].geometry when vertex edit occurred (ISSUE 9 fix)', (done) => {
        // tempFeatures = vertex-edited geometry (from DrawSupport GEOMETRY_CHANGED)
        const store = makeMockStore({
            vectorDrawGeometry: drawnGeometry,
            tempFeatures: [{ type: 'Feature', geometry: editedGeometry, properties: {} }],
            features: [{ type: 'Feature', geometry: drawnGeometry, properties: {} }]
        });

        const action$ = new Rx.Subject();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const emitted = [];
        vectorDrawSaveEpic(action$, store)
            .take(1)
            .timeout(500)
            .subscribe(
                a => emitted.push(a),
                () => {
                    // Timeout means save was attempted (not blocked by "no geometry")
                    const noGeomErrors = emitted.filter(a =>
                        a.type === 'VECTOR_DRAW:SAVE_ERROR' && a.error && a.error.includes('No geometry')
                    );
                    expect(noGeomErrors.length).toBe(0, 'Should not emit "No geometry" error when tempFeatures has geometry');
                    done();
                },
                () => {
                    const noGeomErrors = emitted.filter(a =>
                        a.type === 'VECTOR_DRAW:SAVE_ERROR' && a.error && a.error.includes('No geometry')
                    );
                    expect(noGeomErrors.length).toBe(0);
                    done();
                }
            );
        action$.next({ type: SUBMIT_FORM });
    });

    it('falls back to vectorDraw.geometry when draw.tempFeatures is empty', (done) => {
        const store = makeMockStore({
            vectorDrawGeometry: drawnGeometry,
            tempFeatures: [],
            features: []
        });
        const action$ = new Rx.Subject();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const emitted = [];
        vectorDrawSaveEpic(action$, store)
            .take(1)
            .timeout(500)
            .subscribe(
                a => emitted.push(a),
                () => {
                    const noGeomErrors = emitted.filter(a =>
                        a.type === 'VECTOR_DRAW:SAVE_ERROR' && a.error && a.error.includes('No geometry')
                    );
                    expect(noGeomErrors.length).toBe(0, 'Should not emit "No geometry" error when vectorDraw.geometry is valid');
                    done();
                },
                () => {
                    const noGeomErrors = emitted.filter(a =>
                        a.type === 'VECTOR_DRAW:SAVE_ERROR' && a.error && a.error.includes('No geometry')
                    );
                    expect(noGeomErrors.length).toBe(0);
                    done();
                }
            );
        action$.next({ type: SUBMIT_FORM });
    });

    it('emits saveError with "No geometry" when ALL geometry sources are null', (done) => {
        const store = {
            getState: () => ({
                vectorDraw: {
                    phase: 'saving',
                    config: {
                        layerName: 'geonode:bdy_1_boundary_01',
                        featureId: null,
                        onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE'
                    },
                    geometry: null,  // No original geometry
                    formValues: {}
                },
                draw: {
                    tempFeatures: [],
                    features: []
                },
                layers: { flat: [] },
                gnsettings: { geoserverUrl: null }
            })
        };
        const action$ = new Rx.Subject();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const emitted = [];
        vectorDrawSaveEpic(action$, store)
            .timeout(1000)
            .subscribe(
                a => emitted.push(a),
                () => done(),
                () => {
                    const noGeomError = emitted.find(a =>
                        a.type === 'VECTOR_DRAW:SAVE_ERROR'
                    );
                    expect(noGeomError).toExist('Should emit SAVE_ERROR when no geometry in any source');
                    done();
                }
            );
        action$.next({ type: SUBMIT_FORM });
    });
});

// ── TASK-2830 (W2V) — WHICH geometry actually goes on the wire ───────────────
//
// The four specs above assert only that no "No geometry" error is emitted, so a
// wrong fix (e.g. reversing the tempFeatures/features precedence, which would
// silently discard the user's vertex edit and revert gmc 9875b2f76) passes them
// while destroying exactly what TASK-1407 was written to protect. These specs
// capture the WFS-T transaction body — the precedent is
// wfstApiInsertClear-test.js:84/:121 — and assert the coordinates it carries.

describe('TASK-1407 + TASK-2830 vectorDrawSaveEpic — the geometry put on the wire', () => {
    const drawn = { type: 'LineString', coordinates: [[151.0, -33.0], [151.5, -33.0]] };
    const vertexEdited = { type: 'LineString', coordinates: [[151.0, -33.0], [151.3, -33.2], [151.5, -33.0]] };
    const snapshotOnly = { type: 'LineString', coordinates: [[10.0, 20.0], [10.5, 20.5]] };

    const DESCRIBE = {
        targetPrefix: 'geonode',
        targetNamespace: 'http://geonode.org',
        featureTypes: [{
            typeName: 'mes_1_meshregion_01',
            properties: [
                { name: 'the_geom', type: 'gml:Geometry', localType: 'Geometry' },
                { name: 'description', type: 'xsd:string', localType: 'string' }
            ]
        }]
    };

    let mock;
    let bodies;

    beforeEach(() => {
        bodies = [];
        mock = new MockAdapter(axios);
        mock.onGet(/\/geoserver\/wfs/).reply(() => [200, DESCRIBE]);
        mock.onPost(/\/geoserver\/wfs/).reply((cfg) => {
            bodies.push(cfg.data);
            return [200, '<wfs:TransactionResponse xmlns:wfs="http://www.opengis.net/wfs">'
                + '<wfs:InsertResults><wfs:Feature><ogc:FeatureId fid="mes_1_meshregion_01.7"'
                + ' xmlns:ogc="http://www.opengis.net/ogc"/></wfs:Feature></wfs:InsertResults>'
                + '</wfs:TransactionResponse>'];
        });
    });

    afterEach(() => {
        if (mock) { mock.restore(); mock = null; }
    });

    const storeWith = ({ tempFeatures, features, geometry }) => ({
        getState: () => ({
            vectorDraw: {
                phase: 'saving',
                config: {
                    layerName: 'geonode:mes_1_meshregion_01',
                    featureId: null,
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE'
                },
                geometry,
                formValues: { description: 'unit' }
            },
            draw: { tempFeatures: tempFeatures || [], features: features || [] },
            layers: { flat: [] },
            gnsettings: { geoserverUrl: 'http://localhost:8080/geoserver/' }
        })
    });

    const runSave = (store, done, assertFn) => {
        const action$ = new Rx.Subject();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        const finish = () => {
            try { assertFn(); done(); } catch (e) { done(e); }
        };
        vectorDrawSaveEpic(action$, store)
            .take(1)
            .timeout(4000)
            .subscribe(() => {}, () => finish(), () => finish());
        action$.next({ type: SUBMIT_FORM });
    };

    it('sends the VERTEX-EDITED geometry from draw.tempFeatures, not the originally drawn one', (done) => {
        const store = storeWith({
            tempFeatures: [{ type: 'Feature', geometry: vertexEdited, properties: {} }],
            features: [{ type: 'Feature', geometry: drawn, properties: {} }],
            geometry: drawn
        });
        runSave(store, done, () => {
            expect(bodies.length).toBe(1);
            // the vertex the user dragged in must be on the wire …
            expect(bodies[0].indexOf('151.3 -33.2')).toNotBe(-1);
            // … and the pre-edit two-point shape must not be all that was sent.
            expect(bodies[0].indexOf('151 -33 151.5 -33<')).toBe(-1);
        });
    });

    it('sends draw.features geometry when no vertex edit happened', (done) => {
        const store = storeWith({
            tempFeatures: [],
            features: [{ type: 'Feature', geometry: drawn, properties: {} }],
            geometry: snapshotOnly
        });
        runSave(store, done, () => {
            expect(bodies.length).toBe(1);
            expect(bodies[0].indexOf('151 -33 151.5 -33')).toNotBe(-1);
            expect(bodies[0].indexOf('10 20')).toBe(-1);
        });
    });

    it('falls back to the vectorDraw.geometry snapshot when the draw slice is empty', (done) => {
        const store = storeWith({ tempFeatures: [], features: [], geometry: snapshotOnly });
        runSave(store, done, () => {
            expect(bodies.length).toBe(1);
            expect(bodies[0].indexOf('10 20 10.5 20.5')).toNotBe(-1);
        });
    });
});

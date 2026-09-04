/**
 * TASK-2830 (W2V) — session-scoped invalidation of a stale `draw.tempFeatures`.
 *
 * THE BUG (reproduced live on :8081, project 15834, 2026-09-04):
 *   1. Map-click the Rainfall polygon -> VectorDraw EDIT session -> drag one vertex.
 *      OpenLayers `DrawSupport.jsx:1520` fires `onGeometryChanged(features, drawOwner)`
 *      -> `GEOMETRY_CHANGED` -> `reducers/draw.js:49-50` pins `draw.tempFeatures`.
 *   2. Cancel that session. `drawSupportReset` (`actions/draw.js:81`) is
 *      `changeDrawingStatus("clean", ...)`, and `CHANGE_DRAWING_STATUS`
 *      (`reducers/draw.js:36-44`) never touches `tempFeatures` — so the Polygon
 *      SURVIVES, globally, for the rest of the map session.
 *   3. Map-click an Inflow LINE and Save. `epicsVectorDraw.js:318-321` and
 *      `components/VectorDrawPopup.js:545-546` BOTH prefer
 *      `draw.tempFeatures[0].geometry` — so the WFS-T Update posts the stale
 *      Polygon into `inf_*`'s `com.vividsolutions.jts.geom.LineString` column and
 *      GeoServer's `UpdateElementHandler.checkConsistentGeometryDimensions`
 *      rejects it: "Incorrect geometry dimension for property the_geom".
 *      Same-family (Polygon -> Polygon) it is ACCEPTED, silently corrupting the row.
 *
 * WHY THE SEAM IS `drawStopped()` AT `START_VECTOR_DRAW` AND NOT A GUARD:
 *   - An OWNER guard is provably inert: the poisoning geometry is produced BY
 *     VectorDraw itself (`epicsVectorDraw.js:30` VECTOR_DRAW_OWNER = 'vectorDraw',
 *     dispatched at :129/:144/:191 for rai_/mes_ polygons and inf_ lines alike).
 *   - A geomType/family guard is inert for the same-family corruption above.
 *   - Reversing the tempFeatures/features precedence would REVERT TASK-1407
 *     (gmc 9875b2f76): a vertex drag after a fresh draw lands ONLY in tempFeatures.
 *   `DRAW_SUPPORT_STOPPED` (`reducers/draw.js:51-52`) is the ONLY action that
 *   empties `tempFeatures`, and the OpenLayers renderer Hydrata uses never fires it
 *   (only `leaflet/DrawSupport.jsx:597` does). Dispatching it at the session
 *   boundary fixes both consumers at once, without touching the MapStore2 submodule.
 */
import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import { combineEpics, createEpicMiddleware } from 'redux-observable';

import axios from '../../../../../MapStore2/web/client/libs/ajax';
import drawReducer from '../../../../../MapStore2/web/client/reducers/draw';
import {
    changeDrawingStatus, geometryChanged, drawStopped, drawSupportReset
} from '../../../../../MapStore2/web/client/actions/draw';
import createTestStore from '../../../../__tests__/helpers/createTestStore';

import VectorDrawPlugin from '../VectorDraw';
import vectorDrawReducer from '../reducerVectorDraw';
import { VECTOR_DRAW_OWNER } from '../epicsVectorDraw';
import { startVectorDraw } from '../actionsVectorDraw';

// The exact shape the live capture recorded in draw.tempFeatures after a real
// vertex-drag on rai_15834_rainfall_01 (EPSG:4326, from DrawSupport.jsx:1520).
const POISON_POLYGON = {
    type: 'Polygon',
    coordinates: [[
        [151.74088008267103, -32.940173400919385],
        [151.74351136000004, -32.9400634],
        [151.74353375, -32.943252460000004],
        [151.74044292, -32.943233660000004],
        [151.74088008267103, -32.940173400919385]
    ]]
};
const poisonFeature = () => ({ type: 'Feature', geometry: POISON_POLYGON, properties: {} });

// The LineString the operator is actually editing (inf_15834_inflow_01.1).
const INFLOW_LINE = {
    type: 'LineString',
    coordinates: [[151.74062217, -32.94270072], [151.74114475, -32.94298888]]
};

const DESCRIBE_STUB = {
    targetPrefix: 'geonode',
    targetNamespace: 'http://geonode.org',
    featureTypes: [{
        typeName: 'inf_1_x',
        properties: [
            { name: 'the_geom', type: 'gml:LineString', localType: 'LineString' },
            { name: 'description', type: 'xsd:string', localType: 'string' }
        ]
    }]
};

const EDIT_CONFIG = {
    layerName: 'geonode:inf_1_x',
    geomType: 'LineString',
    featureId: 'inf_1_x.1',
    allowPick: false,
    owner: 'anuga'
};

describe('TASK-2830 — stale draw.tempFeatures is invalidated at the VectorDraw session boundary', () => {
    let mock;

    // Real reducers + the plugin's REAL registered epic map. Running the plugin's
    // own epics (not a hand-picked one) is deliberate: an epic that is written but
    // never registered in VectorDraw.js is dead code in the running app.
    const makeStore = () => createTestStore({
        reducers: {
            draw: drawReducer,
            vectorDraw: vectorDrawReducer,
            gnsettings: (s = { geoserverUrl: 'http://localhost:8080/geoserver/' }) => s,
            layers: (s = { flat: [] }) => s
        },
        middleware: [createEpicMiddleware(combineEpics(...Object.values(VectorDrawPlugin.epics)))]
    });

    beforeEach(() => {
        mock = new MockAdapter(axios);
        mock.onGet(/\/geoserver\/wfs/).reply((cfg) => {
            const url = (cfg.url || '') + '?' + new URLSearchParams(cfg.params || {}).toString();
            if (/DescribeFeatureType/i.test(url)) {
                return [200, DESCRIBE_STUB];
            }
            return [200, { type: 'FeatureCollection', features: [
                { type: 'Feature', id: 'inf_1_x.1', geometry: INFLOW_LINE, properties: { description: 'Creek inflow' } }
            ] }];
        });
    });

    afterEach(() => {
        if (mock) { mock.restore(); mock = null; }
    });

    it('drops a Polygon left in draw.tempFeatures by a PREVIOUS session when a new EDIT session starts', () => {
        const store = makeStore();

        // --- poison, exactly as the live drive did: a rai_ EDIT session owned by
        // VECTOR_DRAW_OWNER, then a vertex drag.
        store.dispatch(changeDrawingStatus('drawOrEdit', 'Polygon', VECTOR_DRAW_OWNER, [poisonFeature()], {
            featureProjection: 'EPSG:4326', stopAfterDrawing: false, drawEnabled: false, editEnabled: true
        }));
        store.dispatch(geometryChanged([poisonFeature()], VECTOR_DRAW_OWNER, true));
        // Cancelling that session does NOT clear it — this is the leak.
        store.dispatch(drawSupportReset(VECTOR_DRAW_OWNER));

        expect(store.getState().draw.tempFeatures.length).toBe(1);
        expect(store.getState().draw.tempFeatures[0].geometry.type).toBe('Polygon');
        // C1: the stale geometry carries VectorDraw's OWN owner, so an owner
        // guard could never have been the fix.
        expect(store.getState().draw.drawOwner).toBe(VECTOR_DRAW_OWNER);

        // --- a NEW session begins (this is the action a map-click on the inflow
        // emits: anugaClickTargets.js:88).
        store.dispatch(startVectorDraw(EDIT_CONFIG));

        expect(store.getState().draw.tempFeatures).toEqual([]);
    });

    it('leaves nothing for VectorDrawPopup Save to pick up either (the second stale read, :545-546)', () => {
        const store = makeStore();
        store.dispatch(geometryChanged([poisonFeature()], VECTOR_DRAW_OWNER, true));
        store.dispatch(startVectorDraw(EDIT_CONFIG));

        // VectorDrawPopup mapStateToProps :691-692 -> drawTempFeatures / drawFeatures.
        const drawTempFeatures = store.getState().draw.tempFeatures;
        const geomThePopupWouldSend = drawTempFeatures?.[0]?.geometry
            || store.getState().draw.features?.[0]?.geometry;
        expect(drawTempFeatures).toEqual([]);
        expect(geomThePopupWouldSend === POISON_POLYGON).toBe(false);
    });

    it('keeps geometry captured AFTER the session start (TASK-1407 vertex editing still works)', () => {
        const store = makeStore();
        store.dispatch(geometryChanged([poisonFeature()], VECTOR_DRAW_OWNER, true));
        store.dispatch(startVectorDraw(EDIT_CONFIG));

        const edited = {
            type: 'LineString',
            coordinates: [[151.74062217, -32.94270072], [151.7409, -32.9428], [151.74114475, -32.94298888]]
        };
        store.dispatch(geometryChanged([{ type: 'Feature', geometry: edited, properties: {} }], VECTOR_DRAW_OWNER, true));

        expect(store.getState().draw.tempFeatures.length).toBe(1);
        expect(store.getState().draw.tempFeatures[0].geometry).toEqual(edited);
    });

    it('registers the invalidation epic on the VectorDraw plugin (an unregistered epic is dead code)', () => {
        const names = Object.keys(VectorDrawPlugin.epics);
        expect(names.indexOf('vectorDrawClearStaleGeometryEpic') > -1).toBe(true);
    });

    it('DRAW_SUPPORT_STOPPED is the only action that empties draw.tempFeatures (wiring assertion)', () => {
        const seeded = drawReducer(undefined, geometryChanged([poisonFeature()], VECTOR_DRAW_OWNER, true));
        expect(seeded.tempFeatures.length).toBe(1);
        // CHANGE_DRAWING_STATUS (what drawSupportReset emits) leaves it alone …
        expect(drawReducer(seeded, drawSupportReset(VECTOR_DRAW_OWNER)).tempFeatures.length).toBe(1);
        // … only DRAW_SUPPORT_STOPPED clears it.
        expect(drawReducer(seeded, drawStopped()).tempFeatures).toEqual([]);
    });
});

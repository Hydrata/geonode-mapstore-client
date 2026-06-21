/**
 * TASK-1856 (epic 1814 W3.2) — cursorElevationEpic spec.
 *
 * Pure data epic: on debounced MOUSE_MOVE → GET elevation point → dispatch
 * SET_TERRAIN_CURSOR_ELEVATION with float or null.
 *
 * Spec:
 *   1. debounce collapses rapid MOUSE_MOVE events to one trailing request
 *   2. dispatch SET_TERRAIN_CURSOR_ELEVATION(float) on a successful response
 *   3. no-op (empty) when no DEM is loaded (hasDemReady=false)
 *   4. dispatch null on error (network / 4xx / 5xx)
 *   5. dispatch null on endpoint returning null (nodata / out-of-bounds)
 *   6. dispatch null on MOUSE_OUT
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';

import {
    cursorElevationEpic,
    hasDemReady,
    findActiveTerrain
} from '../epics/cursorElevationEpic';
import { MOUSE_MOVE, MOUSE_OUT } from '../../../../../MapStore2/web/client/actions/map';

// ── State helpers ──────────────────────────────────────────────────────────

const makeState = ({ terrainLoaded = true, terrainReady = true, withLayer = true } = {}) => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: {
            terrainLoaded,
            terrain: terrainReady ? [
                {
                    id: 7,
                    status: 'ready',
                    gn_layer_name: withLayer ? 'ele_7_blue_mountains' : null,
                    gn_layer_name_qualified: withLayer ? 'geonode:ele_7_blue_mountains' : null
                }
            ] : []
        }
    },
    layers: {
        flat: [
            {
                id: 'layer-dem-7',
                // Real GeoNode WMS layers carry the workspace prefix; the terrain
                // resource's gn_layer_name (above) is bare. findActiveTerrain must
                // match across that prefix difference (TASK-1856 W3 live-UAT fix).
                name: 'geonode:ele_7_blue_mountains',
                type: 'wms',
                group: 'Input Data.Terrain'
            }
        ]
    }
});

const storeFrom = (state) => ({ getState: () => state });

// ── Action helpers ─────────────────────────────────────────────────────────

const mouseMoveAt = (lng, lat) => ({
    type: MOUSE_MOVE,
    position: { x: lng, y: lat, crs: 'EPSG:4326' }
});

const mouseOut = () => ({ type: MOUSE_OUT });

// mockActions: emits the actions after a short async delay (matching the
// pattern in demRescaleEpic-test.js).  Subject remains open after emit so
// the epic's debounced switchMap can fire without the source completing.
const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
    }, 0);
    return action$;
};

// Convenience: run the epic and collect emitted actions.
// timeout must exceed DEBOUNCE_MS (250ms) + network latency buffer.
const DEBOUNCE_MS = 250;
const COLLECT_AFTER_MS = 600;

const runEpic = (action$, state, done, assert) => {
    const store = storeFrom(state);
    const emitted = [];
    cursorElevationEpic(action$, store).subscribe(
        a => emitted.push(a),
        err => done(err)
    );
    setTimeout(() => {
        try {
            assert(emitted);
            done();
        } catch (e) {
            done(e);
        }
    }, COLLECT_AFTER_MS);
};

// ── Unit tests: pure helpers ───────────────────────────────────────────────

describe('cursorElevationEpic — pure helpers (TASK-1856)', () => {
    describe('hasDemReady', () => {
        it('returns true when terrainLoaded + a ready terrain with gn_layer_name', () => {
            expect(hasDemReady(makeState())).toBe(true);
        });

        it('returns false when terrainLoaded is false', () => {
            expect(hasDemReady(makeState({ terrainLoaded: false }))).toBe(false);
        });

        it('returns false when terrain array is empty', () => {
            expect(hasDemReady(makeState({ terrainReady: false }))).toBe(false);
        });

        it('returns false when the only terrain has no gn_layer_name', () => {
            expect(hasDemReady(makeState({ withLayer: false }))).toBe(false);
        });
    });

    describe('findActiveTerrain', () => {
        it('returns the terrain matching the best DEM layer', () => {
            const state = makeState();
            const terrain = findActiveTerrain(state);
            expect(terrain).toExist();
            expect(terrain.id).toBe(7);
        });

        it('returns null when no DEM layer is in the map', () => {
            const state = makeState();
            state.layers.flat = []; // no layers → findBestDemLayer returns null
            expect(findActiveTerrain(state)).toBe(null);
        });

        it('matches across the geonode: workspace prefix (layer prefixed, gn_layer_name bare)', () => {
            // Regression for the W3 live-UAT bug: real map layers are
            // "geonode:ele_*" while the terrain resource gn_layer_name is bare.
            const state = makeState();
            expect(state.layers.flat[0].name).toBe('geonode:ele_7_blue_mountains');
            expect(state.anuga.resources.terrain[0].gn_layer_name).toBe('ele_7_blue_mountains');
            expect(findActiveTerrain(state).id).toBe(7);
        });
    });
});

// ── Epic end-to-end tests ──────────────────────────────────────────────────

describe('cursorElevationEpic — end-to-end (TASK-1856)', () => {
    let mockAdapter;

    beforeEach(() => {
        mockAdapter = new MockAdapter(axios);
    });

    afterEach(() => {
        mockAdapter.restore();
    });

    it('dispatches SET_TERRAIN_CURSOR_ELEVATION(float) on a successful response', function(done) {
        this.timeout(3000);
        mockAdapter.onGet(/elevation/).reply(200, { elevation: 427.5, lon: 150.3, lat: -33.6, crs: 'EPSG:4326' });

        const action$ = mockActions([mouseMoveAt(150.3, -33.6)]);
        runEpic(action$, makeState(), done, (emitted) => {
            const elevAction = emitted.find(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION');
            expect(elevAction).toExist('expected SET_TERRAIN_CURSOR_ELEVATION to be dispatched');
            expect(elevAction.elevation).toBe(427.5);
        });
    });

    it('debounce: collapses rapid MOUSE_MOVE events to one trailing request', function(done) {
        this.timeout(4000);
        let requestCount = 0;
        mockAdapter.onGet(/elevation/).reply(() => {
            requestCount++;
            return [200, { elevation: 100.0, lon: 10, lat: -33, crs: 'EPSG:4326' }];
        });

        // Emit 5 rapid mouse moves before debounce fires.
        const subject = new Rx.Subject();
        const action$ = subject.asObservable();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

        const store = storeFrom(makeState());
        const emitted = [];
        cursorElevationEpic(action$, store).subscribe(a => emitted.push(a));

        // Emit 5 moves in quick succession (well within the 250ms debounce window).
        [1, 2, 3, 4, 5].forEach(i => subject.next(mouseMoveAt(10 + i * 0.001, -33)));

        setTimeout(() => {
            // After debounce + network + buffer, only ONE request must have fired.
            expect(requestCount).toBe(1, `expected 1 request, got ${requestCount}`);
            expect(emitted.filter(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION').length).toBe(1);
            done();
        }, COLLECT_AFTER_MS);
    });

    it('no-op (emits nothing) when no DEM is loaded', function(done) {
        this.timeout(3000);
        mockAdapter.onGet(/elevation/).reply(200, { elevation: 100.0 });

        const state = makeState({ terrainReady: false });
        const action$ = mockActions([mouseMoveAt(150.3, -33.6)]);
        runEpic(action$, state, done, (emitted) => {
            const elevActions = emitted.filter(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION');
            expect(elevActions.length).toBe(0, 'expected no elevation actions when no DEM loaded');
        });
    });

    it('dispatches SET_TERRAIN_CURSOR_ELEVATION(null) on a network error', function(done) {
        this.timeout(3000);
        mockAdapter.onGet(/elevation/).reply(500);

        const action$ = mockActions([mouseMoveAt(150.3, -33.6)]);
        runEpic(action$, makeState(), done, (emitted) => {
            const elevAction = emitted.find(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION');
            expect(elevAction).toExist('expected SET_TERRAIN_CURSOR_ELEVATION on error');
            expect(elevAction.elevation).toBe(null);
        });
    });

    it('dispatches SET_TERRAIN_CURSOR_ELEVATION(null) when endpoint returns null (nodata/out-of-bounds)', function(done) {
        this.timeout(3000);
        mockAdapter.onGet(/elevation/).reply(200, { elevation: null, lon: 0, lat: 0, crs: 'EPSG:4326' });

        const action$ = mockActions([mouseMoveAt(0.0, 0.0)]);
        runEpic(action$, makeState(), done, (emitted) => {
            const elevAction = emitted.find(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION');
            expect(elevAction).toExist('expected SET_TERRAIN_CURSOR_ELEVATION on null elevation');
            expect(elevAction.elevation).toBe(null);
        });
    });

    it('dispatches SET_TERRAIN_CURSOR_ELEVATION(null) on MOUSE_OUT', function(done) {
        this.timeout(3000);
        const action$ = mockActions([mouseOut()]);
        runEpic(action$, makeState(), done, (emitted) => {
            const elevAction = emitted.find(a => a.type === 'ANUGA:SET_TERRAIN_CURSOR_ELEVATION');
            expect(elevAction).toExist('expected SET_TERRAIN_CURSOR_ELEVATION on MOUSE_OUT');
            expect(elevAction.elevation).toBe(null);
        });
    });
});

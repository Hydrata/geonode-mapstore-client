/**
 * TASK-1861 (epic 1814 W4.4) — profileEpic spec.
 *
 * The depth/result line-profile tool: the user draws a LineString; on
 * END_DRAWING (owner='terrain-profile') the epic extracts the WGS84 line,
 * discovers the layers to sample (the active terrain DEM + the selected
 * scenario's result rasters), calls the W4.3 endpoint and dispatches the
 * sampled series.
 *
 * Pure helpers under test:
 *   - coordsToWkt          — [[lon,lat],...] -> "LINESTRING(lon lat, ...)"
 *   - extractLineFromDrawAction — END_DRAWING geometry -> WGS84 [[lon,lat],...]
 *                            (reprojected from the map CRS, like the bbox tool)
 *   - getProfileLayers     — selected-scenario result rasters + DEM, geonode:
 *                            prefix STRIPPED to bare names for the BE param
 *
 * Epic behaviour:
 *   1. START_PROFILE_DRAW -> SET_PROFILE_DRAWING(true) + changeDrawingStatus start
 *   2. END_DRAWING(owner='terrain-profile') with a valid line + a DEM ready ->
 *      SET_PROFILE_LOADING(true) then SET_PROFILE_SAMPLES(series, traces)
 *   3. END_DRAWING with no DEM ready -> SET_PROFILE_ERROR (no crash, no call)
 *   4. endpoint error -> SET_PROFILE_ERROR
 *   5. a < 2-vertex line -> SET_PROFILE_ERROR (cannot profile a point)
 *
 * W3 LESSON (TASK-1856): real map/serializer layer names carry the geonode:
 * workspace prefix; the BE strips it.  The mocks below use the geonode:-prefixed
 * shape so a regression that forgets to strip is caught.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';

import {
    profileStartDrawEpic,
    profileEndDrawingEpic,
    coordsToWkt,
    extractLineFromDrawAction,
    getProfileLayers,
    getProfileTraces
} from '../epics/profileEpic';
import { END_DRAWING, CHANGE_DRAWING_STATUS } from '../../../../../MapStore2/web/client/actions/draw';

// ── State helpers ──────────────────────────────────────────────────────────
// A WGS84 project so reprojection is a pass-through and we can assert the WKT
// numerically.  The DEM map layer + terrain resource match across the geonode:
// prefix (terrain gn_layer_name is bare).  The selected scenario carries a
// latest_run with the three result gn_layer_* objects (geonode:-prefixed names).
const makeState = ({
    terrainLoaded = true,
    withResults = true,
    withSelectedScenario = true
} = {}) => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: {
            terrainLoaded,
            terrain: [
                {
                    id: 7,
                    status: 'ready',
                    gn_layer_name: 'ele_7_blue_mountains'
                }
            ]
        },
        scenarios: {
            selectedId: withSelectedScenario ? 3 : null,
            byId: {
                3: {
                    id: 3,
                    selected: true,
                    latest_run: withResults ? {
                        id: 99,
                        gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog', title: 'Depth max' },
                        gn_layer_velocity_max: { name: 'geonode:run_42_3_99_velocity_max_cog', title: 'Velocity max' },
                        gn_layer_depth_integrated_velocity_max: { name: 'geonode:run_42_3_99_depthintegratedvelocity_max_cog', title: 'Momentum max' }
                    } : null
                }
            }
        }
    },
    layers: {
        flat: [
            {
                id: 'layer-dem-7',
                name: 'geonode:ele_7_blue_mountains',
                type: 'wms',
                group: 'Input Data.Terrain'
            }
        ]
    }
});

const storeFrom = (state) => ({ getState: () => state });

// END_DRAWING geometry for a LineString as DrawSupport emits it: coordinates in
// the map projection, plus a `projection` field.  WGS84 here so it's a no-op.
const endDrawingLine = (coords, owner = 'terrain-profile', projection = 'EPSG:4326') => ({
    type: END_DRAWING,
    owner,
    geometry: { type: 'LineString', coordinates: coords, projection }
});

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => actions.forEach(a => subject.next(a)), 0);
    return action$;
};

const COLLECT_AFTER_MS = 400;
const runEpic = (epic, action$, state, done, assert) => {
    const store = storeFrom(state);
    const emitted = [];
    epic(action$, store).subscribe(a => emitted.push(a), err => done(err));
    setTimeout(() => {
        try { assert(emitted); done(); } catch (e) { done(e); }
    }, COLLECT_AFTER_MS);
};

// ── Pure helpers ───────────────────────────────────────────────────────────

describe('profileEpic — pure helpers (TASK-1861)', () => {
    describe('coordsToWkt', () => {
        it('builds a LINESTRING WKT from lon/lat pairs', () => {
            expect(coordsToWkt([[150.1, -33.6], [150.2, -33.7]]))
                .toBe('LINESTRING(150.1 -33.6, 150.2 -33.7)');
        });
        it('returns null for fewer than 2 vertices', () => {
            expect(coordsToWkt([[150.1, -33.6]])).toBe(null);
            expect(coordsToWkt([])).toBe(null);
            expect(coordsToWkt(null)).toBe(null);
        });
    });

    describe('extractLineFromDrawAction', () => {
        it('returns WGS84 coords for a WGS84 line (pass-through)', () => {
            const coords = extractLineFromDrawAction(
                endDrawingLine([[150.1, -33.6], [150.2, -33.7]])
            );
            expect(coords).toEqual([[150.1, -33.6], [150.2, -33.7]]);
        });
        it('returns null when there is no geometry', () => {
            expect(extractLineFromDrawAction({ type: END_DRAWING, owner: 'terrain-profile' })).toBe(null);
        });
        it('returns null for a single-vertex line', () => {
            expect(extractLineFromDrawAction(endDrawingLine([[150.1, -33.6]]))).toBe(null);
        });
    });

    describe('getProfileLayers', () => {
        it('includes the DEM + result layers with the geonode: prefix STRIPPED', () => {
            // W3 LESSON: serializer names carry geonode:; the BE strips it. The
            // FE must send bare names so resolve_coverage_vsi_path matches.
            const keys = getProfileLayers(makeState());
            expect(keys).toContain('dem');
            expect(keys).toContain('run_42_3_99_depth_max_cog');
            expect(keys).toContain('run_42_3_99_velocity_max_cog');
            // none of the result keys retain the workspace prefix
            keys.filter(k => k !== 'dem').forEach(k => {
                expect(k.indexOf('geonode:')).toBe(-1);
            });
        });
        it('returns just dem when no scenario/run results exist', () => {
            const keys = getProfileLayers(makeState({ withResults: false }));
            expect(keys).toEqual(['dem']);
        });
    });

    describe('getProfileTraces', () => {
        it('labels each result raster AUTHORITATIVELY from the run field, not the name', () => {
            // Localhost result layers are temp-file-named (tmp*_cog); the label
            // must STILL be "Depth (max)" etc. — sourced from the gn_layer_* field,
            // not sniffed from the layer name.
            const state = makeState();
            // Swap in temp-file-style names that DON'T contain the *_max tokens.
            const run = state.anuga.scenarios.byId[3].latest_run;
            run.gn_layer_depth_max.name = 'geonode:tmpabc_cog';
            run.gn_layer_velocity_max.name = 'geonode:tmpdef_cog';
            run.gn_layer_depth_integrated_velocity_max.name = 'geonode:tmpghi_cog';
            const traces = getProfileTraces(state);
            const byKey = Object.fromEntries(traces.map(t => [t.key, t.label]));
            expect(byKey.dem).toBe('Elevation');
            expect(byKey.tmpabc_cog).toBe('Depth (max)');
            expect(byKey.tmpdef_cog).toBe('Velocity (max)');
            expect(byKey.tmpghi_cog).toBe('Momentum (max)');
        });
        it('keys match getProfileLayers exactly (no drift)', () => {
            const state = makeState();
            expect(getProfileTraces(state).map(t => t.key)).toEqual(getProfileLayers(state));
        });
    });
});

// ── Epic: start draw ────────────────────────────────────────────────────────

describe('profileStartDrawEpic (TASK-1861)', () => {
    it('on START_PROFILE_DRAW dispatches drawing-active + starts a LineString draw', function(done) {
        const action$ = mockActions([{ type: 'ANUGA:START_PROFILE_DRAW' }]);
        runEpic(profileStartDrawEpic, action$, makeState(), done, (emitted) => {
            const draw = emitted.find(a => a.type === CHANGE_DRAWING_STATUS);
            expect(draw).toExist('expected a CHANGE_DRAWING_STATUS start');
            expect(draw.status).toBe('start');
            expect(draw.method).toBe('LineString');
            expect(draw.owner).toBe('terrain-profile');
            const drawing = emitted.find(a => a.type === 'ANUGA:SET_PROFILE_DRAWING');
            expect(drawing).toExist();
            expect(drawing.active).toBe(true);
        });
    });
});

// ── Epic: end drawing -> sample ─────────────────────────────────────────────

describe('profileEndDrawingEpic (TASK-1861)', () => {
    let mock;
    beforeEach(() => { mock = new MockAdapter(axios); });
    afterEach(() => { mock.restore(); });

    it('samples the line and dispatches SET_PROFILE_SAMPLES on success', function(done) {
        this.timeout(3000);
        const series = [
            { distance_m: 0, dem: 100.0, run_42_3_99_depth_max_cog: 0.5 },
            { distance_m: 50, dem: 98.0, run_42_3_99_depth_max_cog: 1.2 }
        ];
        mock.onGet(/profile/).reply((cfg) => {
            // The line must be sent as WKT and the layers param must carry BARE
            // names (geonode: stripped) — assert the request shape.
            expect(cfg.params.line).toContain('LINESTRING(');
            expect(cfg.params.layers).toContain('dem');
            expect(cfg.params.layers.indexOf('geonode:')).toBe(-1);
            return [200, { samples: series, crs: 'EPSG:4326' }];
        });

        const action$ = mockActions([endDrawingLine([[150.1, -33.6], [150.2, -33.7]])]);
        runEpic(profileEndDrawingEpic, action$, makeState(), done, (emitted) => {
            expect(emitted.some(a => a.type === 'ANUGA:SET_PROFILE_LOADING' && a.loading === true))
                .toBe(true, 'expected a loading=true dispatch');
            const samplesAction = emitted.find(a => a.type === 'ANUGA:SET_PROFILE_SAMPLES');
            expect(samplesAction).toExist('expected SET_PROFILE_SAMPLES');
            expect(samplesAction.samples).toEqual(series);
            // traces describe the present raster keys (used by the chart)
            expect(Array.isArray(samplesAction.traces)).toBe(true);
            expect(samplesAction.traces.map(t => t.key)).toContain('dem');
        });
    });

    it('ignores END_DRAWING for a DIFFERENT owner', function(done) {
        this.timeout(3000);
        mock.onGet(/profile/).reply(200, { samples: [], crs: 'EPSG:4326' });
        const action$ = mockActions([endDrawingLine([[1, 2], [3, 4]], 'terrain-bbox')]);
        runEpic(profileEndDrawingEpic, action$, makeState(), done, (emitted) => {
            expect(emitted.filter(a => String(a.type).startsWith('ANUGA:SET_PROFILE')).length)
                .toBe(0, 'expected no profile actions for a foreign owner');
        });
    });

    it('dispatches SET_PROFILE_ERROR when no DEM is ready (no crash, no call)', function(done) {
        this.timeout(3000);
        let called = false;
        mock.onGet(/profile/).reply(() => { called = true; return [200, {}]; });
        const action$ = mockActions([endDrawingLine([[150.1, -33.6], [150.2, -33.7]])]);
        runEpic(profileEndDrawingEpic, action$, makeState({ terrainLoaded: false }), done, (emitted) => {
            expect(called).toBe(false, 'must NOT call the endpoint with no DEM');
            expect(emitted.some(a => a.type === 'ANUGA:SET_PROFILE_ERROR')).toBe(true);
        });
    });

    it('dispatches SET_PROFILE_ERROR for a single-vertex line', function(done) {
        this.timeout(3000);
        let called = false;
        mock.onGet(/profile/).reply(() => { called = true; return [200, {}]; });
        const action$ = mockActions([endDrawingLine([[150.1, -33.6]])]);
        runEpic(profileEndDrawingEpic, action$, makeState(), done, (emitted) => {
            expect(called).toBe(false);
            expect(emitted.some(a => a.type === 'ANUGA:SET_PROFILE_ERROR')).toBe(true);
        });
    });

    it('dispatches SET_PROFILE_ERROR on an endpoint error', function(done) {
        this.timeout(3000);
        mock.onGet(/profile/).reply(500);
        const action$ = mockActions([endDrawingLine([[150.1, -33.6], [150.2, -33.7]])]);
        runEpic(profileEndDrawingEpic, action$, makeState(), done, (emitted) => {
            const err = emitted.find(a => a.type === 'ANUGA:SET_PROFILE_ERROR');
            expect(err).toExist('expected SET_PROFILE_ERROR on a 500');
        });
    });
});

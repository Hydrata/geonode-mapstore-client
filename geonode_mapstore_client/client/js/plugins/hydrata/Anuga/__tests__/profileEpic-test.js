/**
 * TASK-1861 (epic 1814 W4.4) — profileEpic spec.
 * TASK-2255 (epic 2249 W2) — sampling epic REWORKED: single call over every
 * CHECKED terrain + CHECKED scenario (state.anuga.ui.checkedTerrainIds /
 * checkedScenarioIds, TASK-2254), published stage_max ONLY (no velocity/
 * momentum, no terrain+depth derivation), dry-mask epsilon.
 *
 * The cross-section tool: the user draws a LineString; on END_DRAWING
 * (owner='terrain-profile') the epic extracts the WGS84 line, builds the
 * layer tokens for every checked terrain (dem-role, keyed by the terrain's
 * OWN bare layer name — never the literal 'dem') and every checked,
 * stage-published scenario (stage-role, keyed by its bare stage_max name,
 * plus a maskKey to its bare depth_max name for the dry-mask), calls the
 * profile endpoint ONCE and dry-masks the response before storing it.
 *
 * Pure helpers under test:
 *   - coordsToWkt / extractLineFromDrawAction — unchanged (line geometry).
 *   - getProfileTraces  — the checked-entity trace list (dem + stage roles).
 *   - getProfileLayers  — the deduped request token set (dem + stage + mask
 *                          tokens), derived from getProfileTraces.
 *   - applyDryMask      — depth_max < 0.02 m or null -> null stage (AC2/AC4).
 *
 * Epic behaviour:
 *   1. START_PROFILE_DRAW -> SET_PROFILE_DRAWING(true) + changeDrawingStatus start
 *   2. END_DRAWING(owner='terrain-profile') with a valid line + a DEM ready ->
 *      SET_PROFILE_LOADING(true) then SET_PROFILE_SAMPLES(series, traces) —
 *      exactly ONE request regardless of how many terrains/scenarios checked.
 *   3. END_DRAWING with no DEM ready -> SET_PROFILE_ERROR (no crash, no call)
 *   4. nothing checked at all -> SET_PROFILE_ERROR (no crash, no call)
 *   5. endpoint error -> SET_PROFILE_ERROR
 *   6. a < 2-vertex line -> SET_PROFILE_ERROR (cannot profile a point)
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
    clearProfileLineEpic,
    pruneSupersededCheckedTerrainsEpic,
    coordsToWkt,
    extractLineFromDrawAction,
    getTerrainPickerRows,
    getProfileLayers,
    getProfileTraces,
    applyDryMask,
    PROFILE_DRAW_OWNER
} from '../epics/profileEpic';
import { END_DRAWING, CHANGE_DRAWING_STATUS } from '../../../../../MapStore2/web/client/actions/draw';
import { clearProfile, clearProfileLine, SET_ANUGA_TERRAIN_DATA, SET_CHECKED_TERRAINS } from '../actionsAnuga';

// ── State helpers ──────────────────────────────────────────────────────────
// A WGS84 project so reprojection is a pass-through and we can assert the WKT
// numerically. `terrain` = the project's Terrain resources; `scenarios` =
// {id: scenario} keyed by id; `checkedTerrainIds`/`checkedScenarioIds` drive
// getProfileTraces (TASK-2254 picker state) — the epic samples exactly what
// is checked, nothing implicit.
const makeState = ({
    terrainLoaded = true,
    terrain = [{ id: 7, status: 'ready', gn_layer_name: 'ele_7_blue_mountains' }],
    scenarios = {
        3: {
            id: 3,
            name: 'Baseline',
            latest_complete_run: {
                id: 99,
                gn_layer_stage_max: { name: 'geonode:run_42_3_99_stage_max_cog' },
                gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog' }
            }
        }
    },
    checkedTerrainIds = [7],
    checkedScenarioIds = [3],
    layers = [
        { id: 'layer-dem-7', name: 'geonode:ele_7_blue_mountains', type: 'wms', group: 'Input Data.Terrain' }
    ]
} = {}) => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: { terrainLoaded, terrain },
        scenarios: {
            selectedId: Object.keys(scenarios).length ? Number(Object.keys(scenarios)[0]) : null,
            allIds: Object.keys(scenarios).map(Number),
            byId: scenarios
        },
        ui: { checkedTerrainIds, checkedScenarioIds }
    },
    layers: { flat: layers }
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

// ── Pure helpers: line geometry (unchanged by TASK-2255) ───────────────────

describe('profileEpic — pure helpers: line geometry (TASK-1861)', () => {
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
});

// ── getProfileTraces / getProfileLayers — multi-terrain/multi-scenario ─────

describe('getProfileTraces / getProfileLayers — checked-entity model (TASK-2255)', () => {
    it('AC1: 2 checked terrains + 2 checked scenarios -> exactly the deduped expected token set, no "dem"', () => {
        const terrain = [
            { id: 7, status: 'ready', gn_layer_name: 'ele_7_a' },
            { id: 8, status: 'ready', gn_layer_name: 'ele_8_b' }
        ];
        const scenarios = {
            3: {
                id: 3,
                latest_complete_run: {
                    id: 99,
                    gn_layer_stage_max: { name: 'geonode:run_42_3_99_stage_max_cog' },
                    gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog' }
                }
            },
            4: {
                id: 4,
                latest_complete_run: {
                    id: 100,
                    gn_layer_stage_max: { name: 'geonode:run_42_4_100_stage_max_cog' },
                    gn_layer_depth_max: { name: 'geonode:run_42_4_100_depth_max_cog' }
                }
            }
        };
        const state = makeState({ terrain, scenarios, checkedTerrainIds: [7, 8], checkedScenarioIds: [3, 4] });
        const layers = getProfileLayers(state);
        expect([...layers].sort()).toEqual([
            'ele_7_a', 'ele_8_b',
            'run_42_3_99_stage_max_cog', 'run_42_3_99_depth_max_cog',
            'run_42_4_100_stage_max_cog', 'run_42_4_100_depth_max_cog'
        ].sort());
        // NOTE: this repo's expect (mjackson/expect@1.20.1) has no `.not`
        // chain — use its own toNotContain negation (see meterReducer-test.js).
        expect(layers).toNotContain('dem');
        expect(new Set(layers).size).toBe(layers.length); // deduped, no repeats
    });

    it('AC2: traces are keyed per entity — dem-role per checked terrain, stage-role per checked scenario, with maskKey attached', () => {
        const traces = getProfileTraces(makeState());
        expect(traces.length).toBe(2);
        const dem = traces.find(t => t.role === 'dem');
        const stage = traces.find(t => t.role === 'stage');
        expect(dem).toExist();
        expect(dem.key).toBe('ele_7_blue_mountains');
        expect(stage).toExist();
        expect(stage.key).toBe('run_42_3_99_stage_max_cog');
        expect(stage.maskKey).toBe('run_42_3_99_depth_max_cog');
    });

    it('AC3: a checked scenario without gn_layer_stage_max issues NO stage/depth tokens', () => {
        const scenarios = {
            3: {
                id: 3,
                latest_complete_run: {
                    id: 99,
                    gn_layer_stage_max: null,
                    gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog' }
                }
            }
        };
        const state = makeState({ scenarios, checkedScenarioIds: [3] });
        expect(getProfileTraces(state).some(t => t.role === 'stage')).toBe(false);
        expect(getProfileLayers(state)).toNotContain('run_42_3_99_depth_max_cog');
    });

    it('a checked scenario with no completed run at all issues no tokens (never crashes)', () => {
        const scenarios = { 3: { id: 3, latest_complete_run: null } };
        // No terrain checked either, so getProfileTraces is EXACTLY the
        // scenario's (empty) contribution — isolates the assertion.
        const state = makeState({ scenarios, checkedTerrainIds: [], checkedScenarioIds: [3] });
        expect(getProfileTraces(state)).toEqual([]);
        expect(getProfileLayers(state)).toEqual([]);
    });

    it('nothing checked -> no traces, no request tokens (never falls back to an implicit selection)', () => {
        const state = makeState({ checkedTerrainIds: [], checkedScenarioIds: [] });
        expect(getProfileTraces(state)).toEqual([]);
        expect(getProfileLayers(state)).toEqual([]);
    });

    it('a checked-but-NOT-ready terrain id (stale id, e.g. terrain since deleted) is silently ignored', () => {
        const state = makeState({ checkedTerrainIds: [7, 999] });
        expect(getProfileTraces(state).filter(t => t.role === 'dem').length).toBe(1);
    });
});

// ── TASK-2577 (gap in TASK-2572) — superseded terrains stay OUT of the picker ──
describe('getTerrainPickerRows — excludes datum-shift-superseded terrains (TASK-2577, AC1)', () => {
    it('excludes a ready terrain whose metadata.superseded_by is set', () => {
        const state = makeState({
            terrain: [
                { id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: 14226 } },
                { id: 14226, status: 'ready', gn_layer_name: 'ele_14226_egm2008' }
            ]
        });
        const rows = getTerrainPickerRows(state);
        expect(rows.map(r => r.id)).toEqual([14226]);
    });

    it('AC4: un-supersede (superseded_by cleared) restores the row', () => {
        const state = makeState({
            terrain: [
                { id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: null } },
                { id: 14226, status: 'ready', gn_layer_name: 'ele_14226_egm2008' }
            ]
        });
        const rows = getTerrainPickerRows(state);
        expect(rows.map(r => r.id)).toEqual([14225, 14226]);
    });

    it('a terrain with no metadata at all is unaffected (superseded_by absent, not just falsy-cleared)', () => {
        const state = makeState({
            terrain: [{ id: 7, status: 'ready', gn_layer_name: 'ele_7_blue_mountains' }]
        });
        expect(getTerrainPickerRows(state).map(r => r.id)).toEqual([7]);
    });
});

describe('pruneSupersededCheckedTerrainsEpic — checked-set hygiene on terrain refetch (TASK-2577, AC2)', () => {
    const runOnTerrainData = (state) => {
        const store = { getState: () => state };
        const action$ = Rx.Observable.of({ type: SET_ANUGA_TERRAIN_DATA, data: state.anuga.resources.terrain });
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
        let emitted = null;
        pruneSupersededCheckedTerrainsEpic(action$, store).subscribe(a => { emitted = a; });
        return emitted;
    };

    it('drops a checked id that has become superseded, with NO ready substitute available', () => {
        const state = makeState({
            terrain: [{ id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: 14226 } }],
            checkedTerrainIds: [14225]
        });
        const action = runOnTerrainData(state);
        expect(action).toExist();
        expect(action.type).toBe(SET_CHECKED_TERRAINS);
        expect(action.ids).toEqual([]);
    });

    it('substitutes the superseding terrain when it is itself a ready picker row', () => {
        const state = makeState({
            terrain: [
                { id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: 14226 } },
                { id: 14226, status: 'ready', gn_layer_name: 'ele_14226_egm2008' }
            ],
            checkedTerrainIds: [14225]
        });
        const action = runOnTerrainData(state);
        expect(action).toExist();
        expect(action.ids).toEqual([14226]);
    });

    it('does NOT substitute when the superseding terrain is not itself ready (e.g. still processing)', () => {
        const state = makeState({
            terrain: [
                { id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: 14226 } },
                { id: 14226, status: 'creating', gn_layer_name: null }
            ],
            checkedTerrainIds: [14225]
        });
        const action = runOnTerrainData(state);
        expect(action).toExist();
        expect(action.ids).toEqual([]);
    });

    it('respects the 3-cap when a substitution would otherwise exceed it', () => {
        const state = makeState({
            terrain: [
                { id: 1, status: 'ready', gn_layer_name: 'ele_1' },
                { id: 2, status: 'ready', gn_layer_name: 'ele_2' },
                { id: 3, status: 'ready', gn_layer_name: 'ele_3', metadata: { superseded_by: 4 } },
                { id: 4, status: 'ready', gn_layer_name: 'ele_4' }
            ],
            checkedTerrainIds: [1, 2, 3]
        });
        const action = runOnTerrainData(state);
        expect(action).toExist();
        expect(action.ids.length).toBeLessThanOrEqualTo(3);
        expect(action.ids).toEqual([1, 2, 4]);
    });

    it('is a no-op (no dispatch) when nothing checked is superseded', () => {
        const state = makeState({
            terrain: [{ id: 7, status: 'ready', gn_layer_name: 'ele_7_blue_mountains' }],
            checkedTerrainIds: [7]
        });
        expect(runOnTerrainData(state)).toBe(null);
    });

    it('is a no-op when nothing is checked at all', () => {
        const state = makeState({
            terrain: [{ id: 14225, status: 'ready', gn_layer_name: 'ele_14225_ellipsoid', metadata: { superseded_by: 14226 } }],
            checkedTerrainIds: []
        });
        expect(runOnTerrainData(state)).toBe(null);
    });
});

describe('applyDryMask — dry-mask epsilon (TASK-2255, AC2/AC4)', () => {
    const traces = [
        { key: 'dem_a', role: 'dem' },
        { key: 'stage_a', role: 'stage', maskKey: 'depth_a' }
    ];

    it('masks a sample to null when depth < 0.02 m', () => {
        const samples = [{ dem_a: 100, stage_a: 100.5, depth_a: 0.01 }];
        expect(applyDryMask(samples, traces)[0].stage_a).toBe(null);
    });

    it('masks a sample to null when depth is null (nodata)', () => {
        const samples = [{ dem_a: 100, stage_a: 100.5, depth_a: null }];
        expect(applyDryMask(samples, traces)[0].stage_a).toBe(null);
    });

    it('keeps the stage value when depth >= 0.02 m', () => {
        const samples = [{ dem_a: 100, stage_a: 100.5, depth_a: 0.02 }];
        expect(applyDryMask(samples, traces)[0].stage_a).toBe(100.5);
    });

    it('AC4: the kept value is the RAW stage sample — never computed from dem+depth', () => {
        // dem+depth would be 105; the raw stage sample (42) is nonsense next to
        // it on purpose, to prove nothing recombines them.
        const samples = [{ dem_a: 100, stage_a: 42, depth_a: 5 }];
        expect(applyDryMask(samples, traces)[0].stage_a).toBe(42);
    });

    it('is a no-op for a trace list with no maskable (stage) entries', () => {
        const samples = [{ dem_a: 100 }];
        const demOnly = [{ key: 'dem_a', role: 'dem' }];
        expect(applyDryMask(samples, demOnly)).toEqual(samples);
    });

    it('is null-safe for missing/malformed samples', () => {
        expect(applyDryMask(null, traces)).toBe(null);
        expect(applyDryMask([null, undefined], traces)).toEqual([null, undefined]);
    });
});

// ── Epic: start draw (unchanged) ────────────────────────────────────────────

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

// ── Epic: end drawing -> ONE multi-entity sample call ───────────────────────

describe('profileEndDrawingEpic — single call, multi-terrain/multi-scenario (TASK-2255)', () => {
    let mock;
    beforeEach(() => { mock = new MockAdapter(axios); });
    afterEach(() => { mock.restore(); });

    it('samples 2 terrains + 2 scenarios in exactly ONE request and dry-masks the response', function(done) {
        this.timeout(3000);
        const terrain = [
            { id: 7, status: 'ready', gn_layer_name: 'ele_7_a' },
            { id: 8, status: 'ready', gn_layer_name: 'ele_8_b' }
        ];
        const scenarios = {
            3: {
                id: 3,
                latest_complete_run: {
                    id: 99,
                    gn_layer_stage_max: { name: 'geonode:run_3_99_stage_max_cog' },
                    gn_layer_depth_max: { name: 'geonode:run_3_99_depth_max_cog' }
                }
            },
            4: {
                id: 4,
                latest_complete_run: {
                    id: 100,
                    gn_layer_stage_max: { name: 'geonode:run_4_100_stage_max_cog' },
                    gn_layer_depth_max: { name: 'geonode:run_4_100_depth_max_cog' }
                }
            }
        };
        const state = makeState({ terrain, scenarios, checkedTerrainIds: [7, 8], checkedScenarioIds: [3, 4] });

        const series = [
            {
                distance_m: 0,
                ele_7_a: 100, ele_8_b: 102,
                run_3_99_stage_max_cog: 100.5, run_3_99_depth_max_cog: 0.5,
                run_4_100_stage_max_cog: 101.0, run_4_100_depth_max_cog: 0.01 // dry -> masked
            },
            {
                distance_m: 50,
                ele_7_a: 98, ele_8_b: 99,
                run_3_99_stage_max_cog: 98.5, run_3_99_depth_max_cog: 0.5,
                run_4_100_stage_max_cog: 99.0, run_4_100_depth_max_cog: 0.5 // wet -> kept
            }
        ];
        let capturedParams;
        mock.onGet(/profile/).reply((cfg) => {
            capturedParams = cfg.params;
            return [200, { samples: series, crs: 'EPSG:4326' }];
        });

        const action$ = mockActions([endDrawingLine([[150.1, -33.6], [150.2, -33.7]])]);
        runEpic(profileEndDrawingEpic, action$, state, done, (emitted) => {
            // Exactly ONE profile GET for the whole drawn line.
            const calls = mock.history.get.filter(c => /profile/.test(c.url));
            expect(calls.length).toBe(1);
            expect(capturedParams.layers).toNotContain('dem');
            expect(capturedParams.layers.indexOf('geonode:')).toBe(-1);
            ['ele_7_a', 'ele_8_b', 'run_3_99_stage_max_cog', 'run_3_99_depth_max_cog',
                'run_4_100_stage_max_cog', 'run_4_100_depth_max_cog'].forEach((tok) => {
                expect(capturedParams.layers).toContain(tok);
            });

            const samplesAction = emitted.find(a => a.type === 'ANUGA:SET_PROFILE_SAMPLES');
            expect(samplesAction).toExist('expected SET_PROFILE_SAMPLES');
            // Scenario 4 sample 0 is dry (depth 0.01 < 0.02) -> stage masked null.
            expect(samplesAction.samples[0].run_4_100_stage_max_cog).toBe(null);
            // Scenario 3 stays wet throughout -> stage kept, unmodified.
            expect(samplesAction.samples[0].run_3_99_stage_max_cog).toBe(100.5);
            expect(samplesAction.samples[1].run_4_100_stage_max_cog).toBe(99.0);
            // traces describe both checked terrains + both checked scenarios.
            expect(samplesAction.traces.filter(t => t.role === 'dem').length).toBe(2);
            expect(samplesAction.traces.filter(t => t.role === 'stage').length).toBe(2);
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

    // W5 review fix (TASK-2272): a "Clear" mid-sample must cancel the in-flight
    // request, else the late response repopulates the chart after Clear wiped the
    // state + map line. CLEAR_PROFILE fires synchronously right after END_DRAWING
    // (same tick), before the mocked response resolves on a microtask, so takeUntil
    // cancels deterministically — no SET_PROFILE_SAMPLES is ever emitted.
    it('CLEAR_PROFILE mid-sample cancels the request (no late SET_PROFILE_SAMPLES)', function(done) {
        this.timeout(3000);
        let _called = false;
        mock.onGet(/profile/).reply(() => {
            _called = true;
            return [200, { samples: [{ distance_m: 0, ele_7_blue_mountains: 100 }], crs: 'EPSG:4326' }];
        });
        const action$ = mockActions([
            endDrawingLine([[150.1, -33.6], [150.2, -33.7]]),
            clearProfile()
        ]);
        runEpic(profileEndDrawingEpic, action$, makeState(), done, (emitted) => {
            // Loading was flipped on before the cancel...
            expect(emitted.some(a => a.type === 'ANUGA:SET_PROFILE_LOADING' && a.loading === true)).toBe(true);
            // ...but the (cancelled) response never repopulated the chart.
            expect(emitted.some(a => a.type === 'ANUGA:SET_PROFILE_SAMPLES')).toBe(false);
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

    it('AC (defensive): nothing checked at all -> SET_PROFILE_ERROR, no call', function(done) {
        this.timeout(3000);
        let called = false;
        mock.onGet(/profile/).reply(() => { called = true; return [200, {}]; });
        const action$ = mockActions([endDrawingLine([[150.1, -33.6], [150.2, -33.7]])]);
        const state = makeState({ checkedTerrainIds: [], checkedScenarioIds: [] });
        runEpic(profileEndDrawingEpic, action$, state, done, (emitted) => {
            expect(called).toBe(false, 'must NOT call the endpoint with nothing checked');
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

// ── clearProfileLineEpic — owner-guarded Clear (TASK-2276) ─────────────────
// The Clear button dispatches CLEAR_PROFILE_LINE (a plain UI action) instead
// of changeDrawingStatus('clean', ...) directly — DrawSupport's 'clean' case
// honours NO owner (it wipes ANY tool's in-progress draw + sketch layer), so
// the actual changeDrawingStatus dispatch is gated here on state.draw.drawOwner
// being idle (falsy) or already this tool's own (PROFILE_DRAW_OWNER). Mirrors
// profileEndDrawingEpic's own 'stop' dispatch, which is inherently safe
// because it only ever fires from an END_DRAWING this tool's own draw ended —
// Clear has no such natural gate (the user can click it any time), hence the
// explicit owner check.
describe('clearProfileLineEpic — guard changeDrawingStatus(clean) to the profile draw owner (TASK-2276)', () => {
    it('dispatches clean(PROFILE_DRAW_OWNER) when no tool currently owns the draw (idle)', function(done) {
        this.timeout(3000);
        const action$ = mockActions([clearProfileLine()]);
        const state = { draw: { drawOwner: null } };
        runEpic(clearProfileLineEpic, action$, state, done, (emitted) => {
            expect(emitted.length).toBe(1);
            expect(emitted[0].type).toBe(CHANGE_DRAWING_STATUS);
            expect(emitted[0].status).toBe('clean');
            expect(emitted[0].owner).toBe(PROFILE_DRAW_OWNER);
        });
    });

    it('dispatches clean(PROFILE_DRAW_OWNER) when the profile tool already owns the draw', function(done) {
        this.timeout(3000);
        const action$ = mockActions([clearProfileLine()]);
        const state = { draw: { drawOwner: PROFILE_DRAW_OWNER } };
        runEpic(clearProfileLineEpic, action$, state, done, (emitted) => {
            expect(emitted.length).toBe(1);
            expect(emitted[0].status).toBe('clean');
            expect(emitted[0].owner).toBe(PROFILE_DRAW_OWNER);
        });
    });

    it('does NOT dispatch clean while ANOTHER tool (e.g. terrain-bbox) owns an active draw', function(done) {
        this.timeout(3000);
        const action$ = mockActions([clearProfileLine()]);
        const state = { draw: { drawOwner: 'terrain-bbox' } };
        runEpic(clearProfileLineEpic, action$, state, done, (emitted) => {
            expect(emitted.length).toBe(0, 'must NOT clobber another tool\'s active draw');
        });
    });
});

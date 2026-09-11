/**
 * TASK-2973 — "nothing result-shaped on map load, ever".
 *
 * resultRasterVisibilityEpic hides every result-shaped raster (a run's three
 * max-value COGs, a RunComparison diff raster, a pre-token result name) on
 * MAP_CONFIG_LOADED and ADD_LAYER, display-only; resultRasterToggleEpic is the
 * session-only show/hide behind every Results row's toggle.
 *
 * The two epics are imported from the BARREL (../../epicsAnuga), not from
 * their own module, so a missing barrel export reds this file — and
 * epicRegistrationCompleteness-test.js then insists on the Anuga.js
 * registration. isResultShapedLayer is a plain predicate (not an epic), so it
 * comes from its own module: the barrel exports epics only, and the
 * completeness sweep would demand a registration for any function it finds.
 *
 * Fixtures use the REAL layer shape captured on localhost map 1418 (twelve
 * run*_max_cog rows across four runs, arriving INSIDE the MAP_CONFIG_LOADED
 * config with no ADD_LAYER): a uuid `id` distinct from `name`, a `geonode:`
 * prefix, a `Results.*` group, `opacity: null`, `extendedParams.mapLayer`.
 *
 * Harness: a manual Rx.Subject action stream + a stub store whose state is
 * MUTATED the way the real reducers would — ADD_LAYER appends to
 * layers.flat, every emitted CHANGE_LAYER_PROPERTIES is applied to the
 * layer's visibility, and the anuga.ui slice runs the REAL uiReducer. That
 * last two matter: without applying the toggle's `visibility:true` back into
 * state, the "keeps them shown through the next sweep" spec would pass
 * vacuously (the sweep skips already-hidden layers regardless of E1).
 * Assertions are collected past the epic's 300 ms debounce and compare the
 * WHOLE emitted stream, never "contains".
 */
import expect from 'expect';
import Rx from 'rxjs';
import { ADD_LAYER, CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';
import { MAP_CONFIG_LOADED } from '@mapstore/framework/actions/config';
import { SAVE_DIRECT_CONTENT } from '@js/actions/gnsave';

import { resultRasterVisibilityEpic, resultRasterToggleEpic } from '../../epicsAnuga';
import { isResultShapedLayer } from '../resultRasterVisibilityEpic';
import { setAnugaResultRastersShown } from '../../actionsAnuga';
import uiReducer from '../../reducers/uiReducer';
import { PLAYBACK_FALLBACK } from '../../playback/actions/playbackActions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Deterministic uuid-SHAPED ids (8-4-4-4-12 hex) so a fixture id can never be
// mistaken for a layer name — the real ids are uuid()s from resourceToLayerConfig.
const uuidFor = (seed) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hex = (n) => (h * n >>> 0).toString(16).padStart(8, '0');
    return `${hex(1)}-${hex(3).slice(0, 4)}-4${hex(5).slice(0, 3)}-a${hex(7).slice(0, 3)}-${hex(11)}${hex(13).slice(0, 4)}`;
};

const RUNS_1418 = [67139, 61670, 60957, 51208];
const QUANTITIES = [
    { token: 'depthintegratedvelocity', group: 'Results.Depth Integrated Velocity', title: 'Momentum Max' },
    { token: 'velocity', group: 'Results.Velocity', title: 'Velocity Max' },
    { token: 'depth', group: 'Results.Depth', title: 'Depth Max' }
];

// One map-1418-shaped result layer: the row-fold shape addMapLayers builds.
const resultLayer = (runId, { token, group, title }, visibility = true) => {
    const name = `geonode:run${runId}_${token}_max_cog`;
    return {
        id: uuidFor(name),
        name,
        title: `run ${runId} ${title}`,
        group,
        type: 'wms',
        url: 'http://localhost:8081/geoserver/ows',
        visibility,
        opacity: null,
        hideInToc: null,
        extendedParams: {
            mapLayer: {
                pk: 1000 + runId,
                name,
                current_style: '',
                extra_params: { anuga_group: group }
            }
        }
    };
};

const twelve = (visibility = true) => RUNS_1418.reduce(
    (acc, runId) => acc.concat(QUANTITIES.map((q) => resultLayer(runId, q, visibility))),
    []
);

const nonResultLayers = () => [
    { id: 'mapnik__0', name: 'mapnik', group: 'background', type: 'osm', visibility: false },
    { id: 'maptiler_satellite__1', name: 'maptiler_satellite', group: 'background', type: 'tileprovider', visibility: true },
    { id: uuidFor('ele_91158_utm'), name: 'geonode:ele_91158_utm_dem_cog', group: 'Input Data.Terrain', type: 'wms', visibility: true, opacity: null },
    { id: uuidFor('ele_91158_hs'), name: 'geonode:ele_91158_hillshade_dem_cog', group: 'Input Data.Terrain', type: 'wms', visibility: true, opacity: null },
    { id: uuidFor('fri_15834'), name: 'geonode:fri_15834_friction_01', group: 'Input Data.Friction', type: 'wms', visibility: true, opacity: null }
];

// A scenario row as ScenarioSerializerV2 nests it: latest_complete_run with
// the three gn_layer_*_max dicts naming the run's COGs (geonode: prefixed).
const scenarioFor = (scenarioId, runId, hasStore = false) => ({
    id: scenarioId,
    name: `scenario ${scenarioId}`,
    latest_complete_run: {
        id: runId,
        status: 'complete',
        has_playback_store: hasStore,
        gn_layer_depth_max: { name: `geonode:run${runId}_depth_max_cog`, catalogURL: `/catalogue/#/dataset/${runId}1` },
        gn_layer_velocity_max: { name: `geonode:run${runId}_velocity_max_cog`, catalogURL: `/catalogue/#/dataset/${runId}2` },
        gn_layer_depth_integrated_velocity_max: { name: `geonode:run${runId}_depthintegratedvelocity_max_cog`, catalogURL: `/catalogue/#/dataset/${runId}3` }
    }
});

const makeState = ({ flat = [], scenarios = [], playback = {} } = {}) => ({
    layers: { flat },
    anuga: {
        scenarios: {
            selectedId: null,
            allIds: scenarios.map((s) => s.id),
            byId: scenarios.reduce((acc, s) => Object.assign(acc, { [s.id]: s }), {})
        },
        ui: uiReducer(undefined, { type: '@@TASK-2973/PROBE' })
    },
    anugaPlayback: { status: 'idle', runId: null, layerId: null, ...playback }
});

// ── Harness ───────────────────────────────────────────────────────────────────

const COLLECT_MS = 500; // > the 300 ms debounce
const SETTLE_MS = 80;   // for the undebounced toggle epic

// Every action any spec in this file ever saw emitted — the
// "never dispatches saveDirectContent" assertion sweeps ALL of it.
const allEmitted = [];

const makeRig = (state, epics) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter((a) => types.includes(a.type));
    const store = { getState: () => state };
    const emitted = [];

    // Apply an emitted action to the stub state the way the real layers
    // reducer would, so a later sweep sees the layer's CURRENT visibility.
    const apply = (a) => {
        if (a.type === CHANGE_LAYER_PROPERTIES) {
            state.layers.flat = state.layers.flat.map((l) => (l.id === a.layer
                ? { ...l, ...a.newProperties }
                : l));
        }
    };

    Rx.Observable.merge(...epics.map((epic) => epic(action$, store))).subscribe(
        (a) => { emitted.push(a); allEmitted.push(a); apply(a); },
        (err) => { throw err; }
    );

    const dispatch = (a) => {
        if (a.type === ADD_LAYER) {
            const layer = a.layer.id ? a.layer : { ...a.layer, id: `${a.layer.name}__${uuidFor(a.layer.name)}` };
            state.layers.flat = state.layers.flat.concat([layer]);
        }
        state.anuga.ui = uiReducer(state.anuga.ui, a);
        subject.next(a);
    };

    return { dispatch, emitted, state };
};

const collect = (ms, fn, done) => setTimeout(() => {
    try {
        fn();
    } catch (e) {
        done(e);
    }
}, ms);

const hideIds = (emitted) => emitted
    .filter((a) => a.type === CHANGE_LAYER_PROPERTIES && a.newProperties && a.newProperties.visibility === false)
    .map((a) => a.layer);
const showIds = (emitted) => emitted
    .filter((a) => a.type === CHANGE_LAYER_PROPERTIES && a.newProperties && a.newProperties.visibility === true)
    .map((a) => a.layer);
const sorted = (xs) => xs.slice().sort();

// ── Specs ─────────────────────────────────────────────────────────────────────

describe('TASK-2973 resultRasterVisibilityEpic — nothing result-shaped on load', () => {

    it('classifies result-shaped layers by Results group or max or diff name token', () => {
        // The four RESULTS_GROUP_MAP tokens (apps/gn_anuga/utils.py), prefix-agnostic.
        expect(isResultShapedLayer({ name: 'geonode:run1412_depth_max_cog' })).toBe(true);
        expect(isResultShapedLayer({ name: 'run1412_velocity_max_cog' })).toBe(true);
        // ONE word, no underscores — the real momentum token.
        expect(isResultShapedLayer({ name: 'geonode:run1412_depthintegratedvelocity_max_cog' })).toBe(true);
        // RunComparison diff rasters (models/run.py creates them visible).
        expect(isResultShapedLayer({ name: 'geonode:depth_diff__1412__1400_cog', group: 'Results.Comparison: Depth' })).toBe(true);
        // Pre-token result names (migration 0093 era), no group at all.
        expect(isResultShapedLayer({ name: 'geonode:a__155_88_195_depth_max' })).toBe(true);
        // picker-test's fixture spelling (underscore after `run`).
        expect(isResultShapedLayer({ name: 'run_2_11_depth_max_cog' })).toBe(true);
        // No token, but the group says Results.
        expect(isResultShapedLayer({ name: 'geonode:tmp1234_cog', group: 'Results.Depth' })).toBe(true);
        // ...also when the group only survives on the folded MapLayer row.
        expect(isResultShapedLayer({
            name: 'geonode:tmp1234_cog',
            extendedParams: { mapLayer: { extra_params: { anuga_group: 'Results.Velocity' } } }
        })).toBe(true);

        // Terrain, boundary, backgrounds, the playback overlay: never.
        expect(isResultShapedLayer({ name: 'geonode:ele_14196_utm', group: 'Input Data.Terrain' })).toBe(false);
        expect(isResultShapedLayer({ name: 'bdy_42_x', group: 'Input Data.Boundary' })).toBe(false);
        expect(isResultShapedLayer({ name: 'mapnik', group: 'background' })).toBe(false);
        expect(isResultShapedLayer({ id: 'anuga-results-playback', type: 'anuga-playback', group: 'Default' })).toBe(false);
        expect(isResultShapedLayer(null)).toBe(false);
        expect(isResultShapedLayer({})).toBe(false);
    });

    it('hides every result-shaped layer present at MAP_CONFIG_LOADED with no ADD_LAYER', function(done) {
        this.timeout(3000);
        // Map 1418's arrival shape: the twelve are IN the config (blob rows),
        // no scenario state yet, playback idle. No ADD_LAYER is ever dispatched.
        const state = makeState({ flat: nonResultLayers().concat(twelve(true)) });
        const expectedIds = twelve(true).map((l) => l.id);
        const { dispatch, emitted } = makeRig(state, [resultRasterVisibilityEpic]);

        dispatch({ type: MAP_CONFIG_LOADED, config: { map: { layers: state.layers.flat } }, mapId: 1418 });

        collect(COLLECT_MS, () => {
            expect(emitted.length).toBe(12);
            emitted.forEach((a) => {
                expect(a.type).toBe(CHANGE_LAYER_PROPERTIES);
                expect(a.newProperties).toEqual({ visibility: false });
                expect(/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(a.layer)).toBe(true, `dispatched on a name, not an id: ${a.layer}`);
            });
            expect(sorted(emitted.map((a) => a.layer))).toEqual(sorted(expectedIds));
            done();
        }, done);
    });

    it('hides result-shaped layers that arrive by ADD_LAYER in the poll shape', function(done) {
        this.timeout(3000);
        const state = makeState({ flat: nonResultLayers() });
        const { dispatch, emitted } = makeRig(state, [resultRasterVisibilityEpic]);

        // selectMaxResultLayers output: the gn_layer_depth_max dict, no id yet
        // (the layers reducer assigns one — the rig mimics getLayerId).
        const pollShape = {
            name: 'geonode:run1412_depth_max_cog',
            title: 'run 1412 Depth Max',
            type: 'wms',
            url: '/geoserver/ows',
            group: 'Results.Depth',
            visibility: true,
            opacity: 1,
            catalogURL: '/catalogue/#/dataset/14121'
        };
        const diffShape = {
            name: 'geonode:depth_diff__1412__1400_cog',
            title: 'Depth difference 1412 vs 1400',
            type: 'wms',
            group: 'Results.Comparison: Depth',
            visibility: true
        };
        const terrainShape = {
            name: 'geonode:ele_555_utm_dem_cog',
            title: 'DEM 555',
            type: 'wms',
            group: 'Input Data.Terrain',
            visibility: true
        };
        dispatch({ type: ADD_LAYER, layer: pollShape, foreground: true });
        dispatch({ type: ADD_LAYER, layer: diffShape, foreground: true });
        dispatch({ type: ADD_LAYER, layer: terrainShape, foreground: true });

        collect(COLLECT_MS, () => {
            const byName = (n) => state.layers.flat.find((l) => l.name === n).id;
            expect(emitted.length).toBe(2);
            expect(sorted(hideIds(emitted))).toEqual(sorted([
                byName('geonode:run1412_depth_max_cog'),
                byName('geonode:depth_diff__1412__1400_cog')
            ]));
            done();
        }, done);
    });

    it('is silent on an already-hidden map and never dispatches saveDirectContent', function(done) {
        this.timeout(3000);
        const state = makeState({ flat: nonResultLayers().concat(twelve(false)) });
        const { dispatch, emitted } = makeRig(state, [resultRasterVisibilityEpic, resultRasterToggleEpic]);

        dispatch({ type: MAP_CONFIG_LOADED, config: { map: { layers: state.layers.flat } }, mapId: 1418 });
        dispatch({
            type: ADD_LAYER,
            layer: { ...resultLayer(99999, QUANTITIES[2], false), id: undefined },
            foreground: true
        });

        collect(COLLECT_MS, () => {
            expect(emitted.length).toBe(0);
            // Across EVERY spec so far in this file: display-only, no save.
            // Positive control first — the earlier specs did emit — so the
            // absence below is an absence, not an empty collector.
            expect(allEmitted.length > 0).toBe(true);
            expect(allEmitted.filter((a) => a.type === SAVE_DIRECT_CONTENT).length).toBe(0);
            done();
        }, done);
    });

    it("leaves the active playback run's rasters alone in the real fallback order", function(done) {
        this.timeout(3000);
        // showFallbackEnvelope (TASK-2986) emits its visibility:true / addLayer
        // one synchronous tick BEFORE playbackFallback flips status to
        // 'fallback' — so at sweep time status may still read 'loading'.
        // E2 keys on runId alone, which makes that ordering irrelevant.
        const state = makeState({
            flat: nonResultLayers(),
            scenarios: [scenarioFor(417, 1412, true), scenarioFor(400, 1400, true)],
            playback: { status: 'loading', runId: '1412', layerId: 'anuga-results-playback' }
        });
        const { dispatch, emitted } = makeRig(state, [resultRasterVisibilityEpic]);

        const fallbackAdd = { ...resultLayer(1412, QUANTITIES[2], true), id: undefined };
        const strangerRun = resultLayer(1400, QUANTITIES[2], true);
        dispatch({ type: ADD_LAYER, layer: fallbackAdd, foreground: true });
        dispatch({ type: PLAYBACK_FALLBACK, runId: '1412', reason: 'memory-policy' });
        dispatch({ type: ADD_LAYER, layer: strangerRun, foreground: true });

        collect(COLLECT_MS, () => {
            // The whole stream: ONE hide, and it is run 1400's — proof the
            // epic is alive while it leaves run 1412 alone.
            expect(emitted.length).toBe(1);
            expect(hideIds(emitted)).toEqual([strangerRun.id]);
            const run1412 = state.layers.flat.find((l) => l.name === 'geonode:run1412_depth_max_cog');
            expect(run1412.visibility).toBe(true);
            done();
        }, done);
    });

    it("shows a toggled run's rasters and keeps them shown through the next sweep", function(done) {
        this.timeout(4000);
        const shown = QUANTITIES.map((q) => resultLayer(60957, q, false));
        const state = makeState({
            flat: nonResultLayers().concat(shown),
            scenarios: [scenarioFor(69344, 60957), scenarioFor(80535, 51208)]
        });
        // ONE subscription over both epics: the toggle's show must survive
        // the hide epic's next sweep via E1 (state.anuga.ui.shownResultRunIds).
        const { dispatch, emitted } = makeRig(state, [resultRasterVisibilityEpic, resultRasterToggleEpic]);
        const shownIds = sorted(shown.map((l) => l.id));
        const later = resultLayer(51208, QUANTITIES[2], true);

        dispatch(setAnugaResultRastersShown(60957, true));

        collect(SETTLE_MS, () => {
            expect(emitted.length).toBe(3);
            expect(sorted(showIds(emitted))).toEqual(shownIds);
            expect(state.anuga.ui.shownResultRunIds).toEqual(['60957']);

            dispatch({ type: ADD_LAYER, layer: later, foreground: true });
            collect(COLLECT_MS, () => {
                // Exactly ONE more action: 51208 hidden, 60957 NOT re-hidden
                // even though its three layers now read visibility:true.
                expect(emitted.length).toBe(4);
                expect(hideIds(emitted)).toEqual([later.id]);
                shown.forEach((l) => {
                    expect(state.layers.flat.find((x) => x.id === l.id).visibility).toBe(true);
                });

                dispatch(setAnugaResultRastersShown('60957', false));
                collect(SETTLE_MS, () => {
                    expect(emitted.length).toBe(7);
                    expect(sorted(hideIds(emitted.slice(4)))).toEqual(shownIds);
                    expect(state.anuga.ui.shownResultRunIds).toEqual([]);
                    done();
                }, done);
            }, done);
        }, done);
    });

    after(() => {
        // Belt and braces for the display-only contract: nothing this file
        // ever saw emitted was a save.
        expect(allEmitted.some((a) => a.type === SAVE_DIRECT_CONTENT)).toBe(false);
    });
});

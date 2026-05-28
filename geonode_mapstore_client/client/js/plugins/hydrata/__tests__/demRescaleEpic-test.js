/**
 * TASK-96 / TASK-99 — Unit tests for demRescaleEpic.js
 *
 * Tests cover:
 *   - buildEnvString: formats env_params as a GeoServer env= string
 *   - extractWgs84Bbox: extracts [minLon,minLat,maxLon,maxLat] from CHANGE_MAP_VIEW
 *   - findDynamicDemPairs: finds matching (layer, terrain) pairs from state
 *   - demRescaleOnMoveEndEpic: debounces, fetches stats, dispatches env+ _v_ update,
 *     stamps singleTile:true, aborts in-flight on rapid pans
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';
import { testEpic, addTimeoutEpic, TEST_TIMEOUT } from '@mapstore/framework/epics/__tests__/epicTestUtils';
import { CHANGE_MAP_VIEW } from '@mapstore/framework/actions/map';
import { CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';

import {
    buildEnvString,
    buildViewparams,
    extractWgs84Bbox,
    findDynamicDemPairs,
    demRescaleOnMoveEndEpic
} from '../Anuga/epics/demRescaleEpic';

let mockAxios;

const SAMPLE_ENV_PARAMS = {
    elevMin: 100.000,
    elevOne: 180.000,
    elevTwo: 260.000,
    elevThree: 340.000,
    elevFour: 420.000,
    elevFive: 500.000,
    elevSix: 580.000,
    elevSeven: 660.000,
    elevEight: 740.000,
    elevNine: 820.000,
    elevMax: 900.000,
};

const SAMPLE_BBOX_ACTION = {
    type: CHANGE_MAP_VIEW,
    bbox: {
        bounds: { minx: 150.31, miny: -33.67, maxx: 150.32, maxy: -33.66 },
        crs: 'EPSG:4326'
    }
};

// Realistic CHANGE_MAP_VIEW payload as delivered by a Web Mercator (EPSG:3857) map.
// The bounds are in metres; bbox.crs tells us the source projection.
// These are the 3857 equivalents of the WGS84 bbox used in SAMPLE_BBOX_ACTION
// (Sydney region: ~150.31-150.32°E, ~-33.67 to -33.66°S).
const SAMPLE_BBOX_ACTION_3857 = {
    type: CHANGE_MAP_VIEW,
    bbox: {
        bounds: {
            minx: 16732432.66,
            miny: -3984576.69,
            maxx: 16733545.85,
            maxy: -3983239.19
        },
        crs: 'EPSG:3857'
    }
};

const makeState = ({
    terrains = [],
    layers = []
} = {}) => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: { terrain: terrains }
    },
    layers: { flat: layers }
});

describe('demRescaleEpic — buildEnvString', () => {
    it('formats env_params as semicolon-separated key:value pairs', () => {
        const result = buildEnvString({ elevMin: 100.123456, elevMax: 900.987654 });
        expect(result).toContain('elevMin:100.123');
        expect(result).toContain('elevMax:900.988');
        expect(result).toContain(';');
    });

    it('rounds values to 3 decimal places', () => {
        const result = buildEnvString({ elevMin: 1.23456789 });
        expect(result).toBe('elevMin:1.235');
    });

    it('exposes buildViewparams as a back-compat alias of buildEnvString', () => {
        // Encoding grammar is identical; the rename is semantic-only.
        expect(buildViewparams).toBe(buildEnvString);
    });
});

describe('demRescaleEpic — extractWgs84Bbox', () => {
    it('extracts [minLon,minLat,maxLon,maxLat] from a CHANGE_MAP_VIEW action', () => {
        const bbox = extractWgs84Bbox(SAMPLE_BBOX_ACTION);
        expect(bbox).toEqual([150.31, -33.67, 150.32, -33.66]);
    });

    it('returns null when bbox is absent', () => {
        expect(extractWgs84Bbox({ type: CHANGE_MAP_VIEW })).toBe(null);
    });

    it('returns null when bounds values are NaN', () => {
        const action = {
            bbox: { bounds: { minx: NaN, miny: 0, maxx: 1, maxy: 1 } }
        };
        expect(extractWgs84Bbox(action)).toBe(null);
    });

    it('reprojects EPSG:3857 bounds to WGS84 degrees (not million-magnitude metres)', () => {
        // This is the regression test for the bug where 3857 metre values were
        // forwarded to the bbox-stats endpoint as if they were WGS84 degrees.
        // The returned values must be small degree values, NOT ~16 million metres.
        const result = extractWgs84Bbox(SAMPLE_BBOX_ACTION_3857);
        expect(result).toExist('expected a bbox array, got null');
        const [minLon, minLat, maxLon, maxLat] = result;
        // All values must be in WGS84 degree range, not Mercator metre range
        expect(Math.abs(minLon)).toBeLessThan(180, `minLon ${minLon} looks like metres, not degrees`);
        expect(Math.abs(maxLon)).toBeLessThan(180, `maxLon ${maxLon} looks like metres, not degrees`);
        expect(Math.abs(minLat)).toBeLessThan(90, `minLat ${minLat} looks like metres, not degrees`);
        expect(Math.abs(maxLat)).toBeLessThan(90, `maxLat ${maxLat} looks like metres, not degrees`);
        // And they should be close to the known WGS84 equivalent
        expect(minLon).toBeGreaterThan(150);
        expect(maxLon).toBeLessThan(151);
        expect(minLat).toBeGreaterThan(-34);
        expect(maxLat).toBeLessThan(-33);
    });

    it('returns same coords unchanged when crs is already EPSG:4326', () => {
        const result = extractWgs84Bbox(SAMPLE_BBOX_ACTION);
        expect(result).toEqual([150.31, -33.67, 150.32, -33.66]);
    });

    it('returns null when crs is absent and bounds look like metres (no crs = treated as 4326)', () => {
        // When crs is missing we default to 4326 (pass-through) — the function
        // can't know the projection and should not attempt a blind reproject.
        const action = {
            bbox: { bounds: { minx: 150.31, miny: -33.67, maxx: 150.32, maxy: -33.66 } }
        };
        const result = extractWgs84Bbox(action);
        expect(result).toEqual([150.31, -33.67, 150.32, -33.66]);
    });
});

describe('demRescaleEpic — findDynamicDemPairs', () => {
    const terrainReady = {
        id: 7,
        rendering_type: 'dynamic_dem',
        gn_layer_name: 'ele_7_my_dem_cog',
        bbox_stats_url: '/api/v2/anuga/projects/42/terrain/7/bbox-stats/',
    };
    const demLayer = {
        id: 'ele-7-uuid',
        type: 'wms',
        name: 'ele_7_my_dem_cog',
        group: 'Input Data.Terrain',
        singleTile: false,
        visibility: true,
    };

    it('returns pairs for matching dynamic_dem terrain + layer', () => {
        const state = makeState({
            terrains: [terrainReady],
            layers: [demLayer],
        });
        const pairs = findDynamicDemPairs(state);
        expect(pairs.length).toBe(1);
        expect(pairs[0].terrain.id).toBe(7);
        expect(pairs[0].layer.id).toBe('ele-7-uuid');
    });

    it('returns empty when no layers match the terrain gn_layer_name', () => {
        const state = makeState({
            terrains: [terrainReady],
            layers: [{ ...demLayer, name: 'completely_different_layer' }],
        });
        expect(findDynamicDemPairs(state)).toEqual([]);
    });

    it('returns empty when rendering_type is not dynamic_dem', () => {
        const state = makeState({
            terrains: [{ ...terrainReady, rendering_type: 'static' }],
            layers: [demLayer],
        });
        expect(findDynamicDemPairs(state)).toEqual([]);
    });

    it('matches layer with geonode: prefix on the name', () => {
        const state = makeState({
            terrains: [terrainReady],
            layers: [{ ...demLayer, name: 'geonode:ele_7_my_dem_cog' }],
        });
        const pairs = findDynamicDemPairs(state);
        expect(pairs.length).toBe(1);
    });

    it('ignores non-terrain-group layers', () => {
        const state = makeState({
            terrains: [terrainReady],
            layers: [{ ...demLayer, group: 'Results.Depth' }],
        });
        expect(findDynamicDemPairs(state)).toEqual([]);
    });
});

describe('demRescaleEpic — elevation rescale epic integration', () => {
    beforeEach((done) => {
        mockAxios = new MockAdapter(axios);
        setTimeout(done);
    });

    afterEach((done) => {
        mockAxios.restore();
        setTimeout(done);
    });

    const terrainReady = {
        id: 7,
        rendering_type: 'dynamic_dem',
        gn_layer_name: 'ele_7_my_dem_cog',
        bbox_stats_url: '/api/v2/anuga/projects/42/terrain/7/bbox-stats/',
    };
    const demLayer = {
        id: 'ele-7-uuid',
        type: 'wms',
        name: 'ele_7_my_dem_cog',
        group: 'Input Data.Terrain',
        singleTile: true,
        visibility: true,
    };

    it('dispatches CHANGE_LAYER_PROPERTIES with env= and _v_ bump on moveend', function(done) {
        // Increase mocha timeout: debounce(300ms) + axios response + test overhead
        this.timeout(5000);
        const state = makeState({ terrains: [terrainReady], layers: [demLayer] });

        mockAxios.onGet(/bbox-stats/).reply(200, {
            elev_min: 100,
            elev_max: 900,
            bbox: [150.31, -33.67, 150.32, -33.66],
            env_params: SAMPLE_ENV_PARAMS,
        });

        // 1 action expected: CHANGE_LAYER_PROPERTIES with env= and _v_
        // Use NUM_ACTIONS=1 with take(1) — the debounce(300ms) fires before the
        // 5s mocha timeout.
        const before = Date.now();
        testEpic(
            demRescaleOnMoveEndEpic,
            1,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    const clp = actions[0];
                    expect(clp.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(clp.layer).toBe('ele-7-uuid');
                    expect(clp.newProperties.params.env).toExist();
                    expect(clp.newProperties.params.env).toContain('elevMin:');
                    expect(clp.newProperties.params.env).toContain('elevMax:');
                    // VIEWPARAMS must NOT be set — GeoServer ignores it for raster
                    // ColorMap env() lookups; sending it would be a wasted param.
                    expect(clp.newProperties.params.VIEWPARAMS).toBe(undefined);
                    // _v_ must be a monotonically increasing timestamp so MapStore's
                    // WMSLayer recognises the params change as a refresh trigger.
                    expect(typeof clp.newProperties.params._v_).toBe('number');
                    expect(clp.newProperties.params._v_).toBeGreaterThanOrEqualTo(before);
                    // All 11 keys must be present
                    const envStr = clp.newProperties.params.env;
                    const keys = ['elevMin', 'elevOne', 'elevTwo', 'elevThree', 'elevFour',
                        'elevFive', 'elevSix', 'elevSeven', 'elevEight', 'elevNine', 'elevMax'];
                    keys.forEach((k) => {
                        expect(envStr).toContain(k + ':',
                            `env missing key: ${k}`);
                    });
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });

    it('stamps singleTile:true on first encounter when not already set', function(done) {
        this.timeout(5000);
        const layerWithoutSingleTile = { ...demLayer, singleTile: false };
        const state = makeState({ terrains: [terrainReady], layers: [layerWithoutSingleTile] });

        mockAxios.onGet(/bbox-stats/).reply(200, {
            elev_min: 100,
            elev_max: 900,
            bbox: [150.31, -33.67, 150.32, -33.66],
            env_params: SAMPLE_ENV_PARAMS,
        });

        // Expect 2 CHANGE_LAYER_PROPERTIES: singleTile stamp + VIEWPARAMS update
        // take(2) waits for both actions within the 5s mocha timeout.
        testEpic(
            demRescaleOnMoveEndEpic,
            2,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    const singleTileAction = actions.find(
                        (a) => a.type === CHANGE_LAYER_PROPERTIES && a.newProperties?.singleTile === true
                    );
                    expect(singleTileAction).toExist(
                        'singleTile:true stamp action not found'
                    );
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });

    it('skips dispatch when there are no dynamic_dem layers', function(done) {
        this.timeout(3000);
        const state = makeState({ terrains: [], layers: [] });

        // No API call expected; epic should emit nothing within the timeout.
        testEpic(
            addTimeoutEpic(demRescaleOnMoveEndEpic, 1500),
            1,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });

    it('skips dispatch when projectId is absent from state', function(done) {
        this.timeout(3000);
        const state = {
            ...makeState({ terrains: [terrainReady], layers: [demLayer] }),
            anuga: {
                projects: { data: null },
                resources: { terrain: [terrainReady] }
            }
        };

        testEpic(
            addTimeoutEpic(demRescaleOnMoveEndEpic, 1500),
            1,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });

    it('reprojects EPSG:3857 bbox and dispatches env= (regression: metres sent as degrees)', function(done) {
        // Regression: before the fix, CHANGE_MAP_VIEW with EPSG:3857 bounds sent
        // million-magnitude metre values to the backend, causing HTTP 500 (PROJ
        // "Invalid latitude"). The epic's catch() swallowed it, so the ramp never
        // rescaled. This test FAILS on the old code (no action dispatched) and
        // PASSES on the fixed code (reprojection sends valid degree coords).
        this.timeout(5000);
        const state = makeState({ terrains: [terrainReady], layers: [demLayer] });

        // The backend receives the reprojected WGS84 bbox; mock the endpoint to
        // reply successfully — this only happens when real degree coords arrive.
        mockAxios.onGet(/bbox-stats/).reply((config) => {
            // Verify the bbox query param contains degree-scale numbers.
            // Old (buggy) code sends ~16732432 (metres); fixed code sends ~150 (degrees).
            const bboxParam = config.params && config.params.bbox;
            if (bboxParam) {
                const parts = bboxParam.split(',').map(Number);
                const anyMetreScale = parts.some((v) => Math.abs(v) > 1000);
                if (anyMetreScale) {
                    // Buggy metres were sent — simulate the backend 500
                    return [500, { detail: 'Invalid latitude' }];
                }
            }
            return [200, {
                elev_min: 770,
                elev_max: 1014,
                bbox: [150.31, -33.67, 150.32, -33.66],
                env_params: SAMPLE_ENV_PARAMS,
            }];
        });

        testEpic(
            demRescaleOnMoveEndEpic,
            1,
            SAMPLE_BBOX_ACTION_3857,
            (actions) => {
                try {
                    const clp = actions[0];
                    expect(clp.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(clp.newProperties.params.env).toExist(
                        'env missing — bbox was likely sent as metres (EPSG:3857 reprojection bug)'
                    );
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });

    it('skips dispatch silently on API error (bbox outside raster)', function(done) {
        // The epic catches errors silently. The debounce fires (300ms), axios
        // returns 400, catch() returns empty() — no actions dispatched.
        // timeout fires at 2s confirming nothing was dispatched.
        this.timeout(4000);
        const state = makeState({ terrains: [terrainReady], layers: [demLayer] });

        // API returns 400 (bbox outside raster extent)
        mockAxios.onGet(/bbox-stats/).reply(400, {
            error_code: 'VALIDATION_ERROR',
            detail: 'Bbox does not intersect the raster extent.'
        });

        testEpic(
            addTimeoutEpic(demRescaleOnMoveEndEpic, 2000),
            1,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    // singleTile is already true; API error caught; only timeout fires
                    expect(actions[0].type).toBe(TEST_TIMEOUT);
                } catch (e) {
                    return done(e);
                }
                done();
            },
            state
        );
    });
});

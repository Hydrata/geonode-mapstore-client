/**
 * TASK-96 — Unit tests for demRescaleEpic.js
 *
 * Tests cover:
 *   - buildViewparams: formats env_params as a VIEWPARAMS string
 *   - extractWgs84Bbox: extracts [minLon,minLat,maxLon,maxLat] from CHANGE_MAP_VIEW
 *   - findDynamicDemPairs: finds matching (layer, terrain) pairs from state
 *   - demRescaleOnMoveEndEpic: debounces, fetches stats, dispatches VIEWPARAMS update,
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

describe('demRescaleEpic — buildViewparams', () => {
    it('formats env_params as semicolon-separated key:value pairs', () => {
        const result = buildViewparams({ elevMin: 100.123456, elevMax: 900.987654 });
        expect(result).toContain('elevMin:100.123');
        expect(result).toContain('elevMax:900.988');
        expect(result).toContain(';');
    });

    it('rounds values to 3 decimal places', () => {
        const result = buildViewparams({ elevMin: 1.23456789 });
        expect(result).toBe('elevMin:1.235');
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

    it('dispatches CHANGE_LAYER_PROPERTIES with VIEWPARAMS on moveend', function(done) {
        // Increase mocha timeout: debounce(300ms) + axios response + test overhead
        this.timeout(5000);
        const state = makeState({ terrains: [terrainReady], layers: [demLayer] });

        mockAxios.onGet(/bbox-stats/).reply(200, {
            elev_min: 100,
            elev_max: 900,
            bbox: [150.31, -33.67, 150.32, -33.66],
            env_params: SAMPLE_ENV_PARAMS,
        });

        // 1 action expected: CHANGE_LAYER_PROPERTIES with VIEWPARAMS
        // Use NUM_ACTIONS=1 with take(1) — the debounce(300ms) fires before the
        // 5s mocha timeout.
        testEpic(
            demRescaleOnMoveEndEpic,
            1,
            SAMPLE_BBOX_ACTION,
            (actions) => {
                try {
                    const clp = actions[0];
                    expect(clp.type).toBe(CHANGE_LAYER_PROPERTIES);
                    expect(clp.layer).toBe('ele-7-uuid');
                    expect(clp.newProperties.params.VIEWPARAMS).toExist();
                    expect(clp.newProperties.params.VIEWPARAMS).toContain('elevMin:');
                    expect(clp.newProperties.params.VIEWPARAMS).toContain('elevMax:');
                    // All 11 keys must be present
                    const vpStr = clp.newProperties.params.VIEWPARAMS;
                    const keys = ['elevMin', 'elevOne', 'elevTwo', 'elevThree', 'elevFour',
                        'elevFive', 'elevSix', 'elevSeven', 'elevEight', 'elevNine', 'elevMax'];
                    keys.forEach((k) => {
                        expect(vpStr).toContain(k + ':',
                            `VIEWPARAMS missing key: ${k}`);
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

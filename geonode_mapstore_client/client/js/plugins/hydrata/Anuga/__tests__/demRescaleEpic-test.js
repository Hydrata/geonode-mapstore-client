/*
 * TASK-1850 (epic 1814 W2) — demRescaleEpic PART-A failure-hardening spec.
 *
 * The dynamic-DEM colour ramp must NEVER silently collapse to its green SLD
 * default when the live windowed bbox-stats fetch fails or returns a malformed
 * env_params. Both failure paths must instead:
 *   1. stamp a FULL-RANGE env (all 11 keys) computed from the terrain row's
 *      stored dem_elev_min/dem_elev_max, so the ramp spans the whole DEM, and
 *   2. raise setDemRampDegraded(layerId, true) so the failure is visible.
 *
 * We exercise the pure helper buildDegradedFallback directly (the core PART-A
 * contract) and the epic end-to-end via a MockAdapter on the shared axios
 * instance for both the network-error and malformed-shape branches.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';

import {
    demRescaleOnMoveEndEpic,
    buildDegradedFallback,
    buildEnvString
} from '../epics/demRescaleEpic';
import { computeDemRampStops, DEM_ENV_KEYS } from '../utils/demRamp';
import { CHANGE_MAP_VIEW } from '../../../../../MapStore2/web/client/actions/map';
import { CHANGE_LAYER_PARAMS } from '../../../../../MapStore2/web/client/actions/layers';

const DEM_ELEV_MIN = 120;
const DEM_ELEV_MAX = 480;

const makeState = () => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: {
            terrain: [
                {
                    id: 7,
                    gn_layer_name: 'dem_xyz',
                    rendering_type: 'dynamic_dem',
                    styling_mode: 'dynamic',
                    dem_elev_min: DEM_ELEV_MIN,
                    dem_elev_max: DEM_ELEV_MAX
                }
            ]
        }
    },
    layers: {
        flat: [
            {
                id: 'layer-dem-1',
                name: 'dem_xyz',
                type: 'wms',
                group: 'Input Data.Terrain',
                singleTile: true,
                params: {}
            }
        ]
    }
});

const storeFrom = (state) => ({ getState: () => state });

// A CHANGE_MAP_VIEW action carrying a WGS84 bbox so extractWgs84Bbox returns it.
const moveAction = () => ({
    type: CHANGE_MAP_VIEW,
    bbox: { crs: 'EPSG:4326', bounds: { minx: 10, miny: 20, maxx: 11, maxy: 21 } }
});

// mockActions helper mirroring epicsAnuga-test.js — emits the action(s) then completes.
const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        // do NOT complete immediately — the epic debounces 300ms; completing the
        // source does not cancel the in-flight debounced emission in rxjs5, but
        // we leave the subject open and rely on the test's own timeout/collection.
    }, 0);
    return action$;
};

describe('demRescaleEpic — TASK-1850 PART A failure hardening', () => {
    describe('buildDegradedFallback (pure helper)', () => {
        it('stamps a full-range 11-key env + degraded=true from stored min/max', () => {
            const layer = { id: 'layer-dem-1' };
            const terrain = { dem_elev_min: DEM_ELEV_MIN, dem_elev_max: DEM_ELEV_MAX };
            const emitted = [];
            buildDegradedFallback(layer, terrain).subscribe(a => emitted.push(a));

            // Expect exactly two actions: the env stamp + the degraded flag.
            expect(emitted.length).toBe(2);

            const paramsAction = emitted.find(a => a.type === CHANGE_LAYER_PARAMS);
            const degradedAction = emitted.find(a => a.type === 'SET_DEM_RAMP_DEGRADED');
            expect(paramsAction).toExist();
            expect(degradedAction).toExist();
            expect(degradedAction.degraded).toBe(true);
            expect(degradedAction.layerId).toBe('layer-dem-1');

            // The env string must contain ALL 11 keys (GeoServer rejects partial sets).
            const env = paramsAction.params.env;
            DEM_ENV_KEYS.forEach((k) => {
                expect(env.indexOf(`${k}:`)).toNotBe(-1, `env missing key ${k}`);
            });
            // And it must equal the full-range env from the stored min/max.
            const expectedEnv = buildEnvString(computeDemRampStops(DEM_ELEV_MIN, DEM_ELEV_MAX));
            expect(env).toBe(expectedEnv);
            expect(paramsAction.params._v_).toExist();
        });

        it('raises degraded but stamps NO partial env when stored min/max are missing', () => {
            const layer = { id: 'layer-dem-1' };
            const terrain = {}; // no dem_elev_min/max
            const emitted = [];
            buildDegradedFallback(layer, terrain).subscribe(a => emitted.push(a));

            expect(emitted.length).toBe(1);
            expect(emitted[0].type).toBe('SET_DEM_RAMP_DEGRADED');
            expect(emitted[0].degraded).toBe(true);
            // No env stamp — a partial/invalid env would 400 at GeoServer.
            expect(emitted.find(a => a.type === CHANGE_LAYER_PARAMS)).toNotExist();
        });
    });

    describe('epic end-to-end (MockAdapter)', () => {
        let mock;
        beforeEach(() => { mock = new MockAdapter(axios); });
        afterEach(() => { mock.restore(); });

        const runEpic = (done, assert) => {
            const store = storeFrom(makeState());
            const action$ = mockActions([moveAction()]);
            const emitted = [];
            demRescaleOnMoveEndEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err)
            );
            // The epic debounces 300ms then fires the stats request. Collect after.
            setTimeout(() => {
                try {
                    assert(emitted);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 700);
        };

        it('on a bbox-stats NETWORK error → full-range env + degraded (not empty)', function(testDone) {
            this.timeout(4000);
            mock.onGet(/bbox-stats/).reply(500);
            runEpic(testDone, (emitted) => {
                const degraded = emitted.find(a => a.type === 'SET_DEM_RAMP_DEGRADED' && a.degraded === true);
                const paramsAction = emitted.find(a => a.type === CHANGE_LAYER_PARAMS && a.params && a.params.env);
                expect(degraded).toExist('expected a degraded action');
                expect(paramsAction).toExist('expected a full-range env stamp');
                DEM_ENV_KEYS.forEach((k) => {
                    expect(paramsAction.params.env.indexOf(`${k}:`)).toNotBe(-1);
                });
            });
        });

        it('on a 400 bbox-outside (benign pan-off-DEM) → stays quiet (no degraded, no env stamp)', function(testDone) {
            this.timeout(4000);
            // The BE returns 400 VALIDATION_ERROR when the bbox is outside the raster
            // (a normal pan-off moveend). The epic must keep the last-good ramp quietly,
            // NOT flip to degraded/full-range (which would flicker the legend badge).
            mock.onGet(/bbox-stats/).reply(400, { error_code: 'VALIDATION_ERROR', detail: 'bbox outside raster' });
            runEpic(testDone, (emitted) => {
                const degraded = emitted.find(a => a.type === 'SET_DEM_RAMP_DEGRADED');
                const paramsAction = emitted.find(a => a.type === CHANGE_LAYER_PARAMS && a.params && a.params.env);
                expect(degraded).toNotExist('a benign 400 pan-off must NOT raise degraded');
                expect(paramsAction).toNotExist('a benign 400 pan-off must NOT stamp a full-range env');
            });
        });

        it('on a MALFORMED env_params (wrong key count) → full-range env + degraded (not empty)', function(testDone) {
            this.timeout(4000);
            // 2 keys, not 11 → shape-guard tripped.
            mock.onGet(/bbox-stats/).reply(200, { env_params: { elevMin: 100, elevMax: 200 } });
            runEpic(testDone, (emitted) => {
                const degraded = emitted.find(a => a.type === 'SET_DEM_RAMP_DEGRADED' && a.degraded === true);
                const paramsAction = emitted.find(a => a.type === CHANGE_LAYER_PARAMS && a.params && a.params.env);
                expect(degraded).toExist('expected a degraded action');
                expect(paramsAction).toExist('expected a full-range env stamp');
                // The stamped env is the FULL-range fallback, not the 2-key malformed payload.
                const expectedEnv = buildEnvString(computeDemRampStops(DEM_ELEV_MIN, DEM_ELEV_MAX));
                expect(paramsAction.params.env).toBe(expectedEnv);
            });
        });

        it('on a VALID 11-key response → env stamp + degraded=false (clears the flag)', function(testDone) {
            this.timeout(4000);
            const validEnv = computeDemRampStops(200, 300); // a valid 11-key windowed set
            mock.onGet(/bbox-stats/).reply(200, { env_params: validEnv });
            runEpic(testDone, (emitted) => {
                const paramsAction = emitted.find(a => a.type === CHANGE_LAYER_PARAMS && a.params && a.params.env);
                const cleared = emitted.find(a => a.type === 'SET_DEM_RAMP_DEGRADED' && a.degraded === false);
                expect(paramsAction).toExist('expected a live env stamp');
                expect(cleared).toExist('a successful fetch must clear the degraded flag');
                expect(paramsAction.params.env).toBe(buildEnvString(validEnv));
            });
        });
    });
});

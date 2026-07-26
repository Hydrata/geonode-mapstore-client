// TASK-1930 W2.6 — tests for the map-OPEN GWC tile prefetch epic.
//
// Proof points:
//   (a) selectWarmableAlternates picks visible terrain/result COGs, excludes
//       hidden / non-wms / dynamic(env|CQL|SLD) / non-COG layers, de-dupes.
//   (b) on MAP_CONFIG_LOADED an authenticated session POSTs the visible COG
//       alternates to /projects/<pid>/warm-tiles/ (pid from Redux).
//   (c) an anonymous session resolves the project id via from-map then warms.
//   (d) no warmable layers -> no warm-tiles POST.
//   (e) the same map is warmed at most once per session (dedupe).

import expect from 'expect';
import Rx from 'rxjs';
import axios from '../../../../../../MapStore2/web/client/libs/ajax';
import { MAP_CONFIG_LOADED } from '../../../../../../MapStore2/web/client/actions/config';
import {
    warmTilesOnMapOpenEpic,
    selectWarmableAlternates,
    TERRAIN_COG_NAME_RE,
    __resetWarmedMapIdsForTest
} from '../warmTilesEpic';

const MockAdapter = require('axios-mock-adapter');

const makeActions$ = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

// TASK-2427: `projectBaseMapId` is the map the cached Redux project belongs to.
// It defaults to `mapId` (the consistent case). Passing a DIFFERENT value models
// the stale-Redux state after SPA navigation to another project's map — the
// state that made the prod prefetch warm 0/7.
const makeStore = ({ mapId = 100, flat = [], projectId = null,
    projectBaseMapId = undefined } = {}) => ({
    getState: () => ({
        gnresource: { id: mapId },
        layers: { flat },
        anuga: {
            projects: {
                data: projectId
                    ? { id: projectId,
                        base_map: projectBaseMapId === undefined ? mapId : projectBaseMapId }
                    : null
            }
        }
    })
});

const wms = (name, extra = {}) => ({ type: 'wms', name, visibility: true, ...extra });

const TERRAIN = 'geonode:ele_518_utm_copernicus_glo_30_dem_cog';
const HILLSHADE = 'geonode:ele_518_hillshade_copernicus_glo_30_dem_cog';
const RESULT = 'geonode:run1255_depth_max_cog';

const warmPosts = (mockAxios) =>
    (mockAxios.history.post || []).filter(r => /\/warm-tiles\/$/.test(r.url));

describe('TASK-1930 W2.6 warmTilesOnMapOpenEpic', () => {

    describe('selectWarmableAlternates', () => {
        it('picks visible terrain + result COGs', () => {
            const flat = [wms(TERRAIN), wms(HILLSHADE), wms(RESULT)];
            expect(selectWarmableAlternates({ layers: { flat } }))
                .toEqual([TERRAIN, HILLSHADE, RESULT]);
        });
        it('excludes hidden, non-wms, dynamic, and non-COG layers', () => {
            const flat = [
                wms(TERRAIN, { visibility: false }),                 // hidden
                wms('geonode:ele_519_utm_x_cog', { params: { env: 'elevMin:1' } }), // dynamic terrain
                wms('geonode:bdy_659_boundary_01'),                  // vector input (not a COG)
                { type: 'osm', name: 'OSM' },                        // non-wms
                wms(RESULT, { params: { CQL_FILTER: "a='b'" } }),    // CQL-parameterised
                wms(HILLSHADE)                                        // the one keeper
            ];
            expect(selectWarmableAlternates({ layers: { flat } })).toEqual([HILLSHADE]);
        });
        it('de-dupes repeated names and tolerates empty state', () => {
            expect(selectWarmableAlternates({ layers: { flat: [wms(TERRAIN), wms(TERRAIN)] } }))
                .toEqual([TERRAIN]);
            expect(selectWarmableAlternates({})).toEqual([]);
        });
        it('TERRAIN_COG_NAME_RE matches ele_<id>_*_cog (with/without workspace)', () => {
            expect(TERRAIN_COG_NAME_RE.test(TERRAIN)).toBe(true);
            expect(TERRAIN_COG_NAME_RE.test('ele_3_utm_x_cog')).toBe(true);
            expect(TERRAIN_COG_NAME_RE.test('geonode:bdy_1_x')).toBe(false);
        });
    });

    describe('the epic', () => {
        let mockAxios;
        beforeEach(() => {
            __resetWarmedMapIdsForTest();
            mockAxios = new MockAdapter(axios);
            mockAxios.onPost(/\/from-map\/$/).reply(200, { projectId: 7 });
            mockAxios.onAny().reply(202, {});
        });
        afterEach(() => { mockAxios.restore(); });

        it('(b) authenticated: POSTs visible COG alternates to /projects/<pid>/warm-tiles/', (done) => {
            const store = makeStore({ mapId: 201, projectId: 1, flat: [wms(TERRAIN), wms(RESULT)] });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            const emitted = [];
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err),
                () => {
                    const posts = warmPosts(mockAxios);
                    expect(posts.length).toBe(1);
                    expect(posts[0].url).toBe('/api/v2/anuga/projects/1/warm-tiles/');
                    expect(JSON.parse(posts[0].data)).toEqual({ alternates: [TERRAIN, RESULT] });
                    // Fire-and-forget (ignoreElements): the epic emits NO redux action.
                    expect(emitted.length).toBe(0);
                    done();
                }
            );
        });

        it('(c) anonymous: resolves project id via from-map then warms', (done) => {
            const store = makeStore({ mapId: 202, projectId: null, flat: [wms(RESULT)] });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            const emitted = [];
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                a => emitted.push(a),
                err => done(err),
                () => {
                    const posts = warmPosts(mockAxios);
                    expect(posts.length).toBe(1);
                    expect(posts[0].url).toBe('/api/v2/anuga/projects/7/warm-tiles/');
                    // Fire-and-forget (ignoreElements): the epic emits NO redux action.
                    expect(emitted.length).toBe(0);
                    done();
                }
            );
        });

        it('(d) no warmable layers -> no warm-tiles POST', (done) => {
            const store = makeStore({ mapId: 203, projectId: 1, flat: [{ type: 'osm', name: 'OSM' }] });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                () => {},
                err => done(err),
                () => { expect(warmPosts(mockAxios).length).toBe(0); done(); }
            );
        });

        // -------------------------------------------------------------------
        // TASK-2427 — the Redux project id must belong to THIS map.
        //
        // Prod, 2026-07-26: `project 712 warmed 0/7`, `project 704 warmed 0/9`.
        // The BE ownership guard was correct; the epic was handing it the
        // CURRENT map's layer names paired with the PREVIOUS project's id,
        // because `state.anuga.projects.data` survives SPA navigation and the
        // old code short-circuited on its truthiness. Anonymous sessions, which
        // always resolved from the map id, scored 4/4 and 9/9 in the same period.
        // -------------------------------------------------------------------
        it('(f) stale Redux project (belongs to another map) is IGNORED; resolves from map id', (done) => {
            // Redux still holds project 1, but that project's base map is 999 —
            // we are opening map 205. The stale id must not be used.
            const store = makeStore({
                mapId: 205, projectId: 1, projectBaseMapId: 999, flat: [wms(TERRAIN)]
            });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                () => {},
                err => done(err),
                () => {
                    const posts = warmPosts(mockAxios);
                    expect(posts.length).toBe(1);
                    // 7 is what the mocked from-map endpoint resolves to; the
                    // stale Redux id (1) must NOT appear in the URL.
                    expect(posts[0].url).toBe('/api/v2/anuga/projects/7/warm-tiles/');
                    done();
                }
            );
        });

        it('(g) project payload with no recognisable base map falls back to from-map (fail-safe)', (done) => {
            const store = makeStore({
                mapId: 206, projectId: 1, projectBaseMapId: null, flat: [wms(TERRAIN)]
            });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                () => {},
                err => done(err),
                () => {
                    const posts = warmPosts(mockAxios);
                    expect(posts.length).toBe(1);
                    expect(posts[0].url).toBe('/api/v2/anuga/projects/7/warm-tiles/');
                    done();
                }
            );
        });

        it('(e) same map warmed at most once per session (double-dispatch dedupe)', (done) => {
            // Two SEPARATE MAP_CONFIG_LOADED opens of the same map (each its own
            // debounce window, so this exercises the _warmedMapIds Set guard, not
            // debounceTime collapsing). The second open must NOT re-POST.
            const store = makeStore({ mapId: 204, projectId: 1, flat: [wms(TERRAIN)] });
            const open = () => new Promise((resolve, reject) => {
                warmTilesOnMapOpenEpic(makeActions$([{ type: MAP_CONFIG_LOADED }]), store)
                    .subscribe(() => {}, reject, resolve);
            });
            open().then(open).then(() => {
                expect(warmPosts(mockAxios).length).toBe(1);
                done();
            }).catch(done);
        });
    });
});

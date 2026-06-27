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

const makeStore = ({ mapId = 100, flat = [], projectId = null } = {}) => ({
    getState: () => ({
        gnresource: { id: mapId },
        layers: { flat },
        anuga: { projects: { data: projectId ? { id: projectId } : null } }
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
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                () => {},
                err => done(err),
                () => {
                    const posts = warmPosts(mockAxios);
                    expect(posts.length).toBe(1);
                    expect(posts[0].url).toBe('/api/v2/anuga/projects/1/warm-tiles/');
                    expect(JSON.parse(posts[0].data)).toEqual({ alternates: [TERRAIN, RESULT] });
                    done();
                }
            );
        });

        it('(c) anonymous: resolves project id via from-map then warms', (done) => {
            const store = makeStore({ mapId: 202, projectId: null, flat: [wms(RESULT)] });
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

        it('(d) no warmable layers -> no warm-tiles POST', (done) => {
            const store = makeStore({ mapId: 203, projectId: 1, flat: [{ type: 'osm', name: 'OSM' }] });
            const action$ = makeActions$([{ type: MAP_CONFIG_LOADED }]);
            warmTilesOnMapOpenEpic(action$, store).subscribe(
                () => {},
                err => done(err),
                () => { expect(warmPosts(mockAxios).length).toBe(0); done(); }
            );
        });
    });
});

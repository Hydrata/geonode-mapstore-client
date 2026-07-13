/*
 * TASK-2165 — tests for the post-WFS-T-save bbox recalc trigger (the BE
 * half of the onZoom planet-zoom root fix).
 *
 * VectorDraw saves geometry via WFS-T straight to GeoServer/PostGIS,
 * bypassing Django — so the createlayer world-extent placeholder on the
 * GeoServer featuretype + GeoNode Dataset is never corrected. On
 * ANUGA:VECTOR_DRAW_COMPLETE this epic fires a fire-and-forget POST to
 * /api/v2/anuga/datasets/recalc-bbox/ so both are recalculated from
 * PostGIS truth.
 *
 * Proof points:
 *   (a) save-complete with meta.layerName -> POSTs {layer_name} once
 *   (b) no meta.layerName -> falls back to state.vectorDraw.config.layerName
 *   (c) no layer name anywhere -> no POST
 *   (d) POST failure -> swallowed (no redux action, no crash) — the UI is
 *       never blocked; stale extents remain repairable via the bulk
 *       recalculate_layer_extents command
 */
import expect from 'expect';
import Rx from 'rxjs';
import axios from '../../../../../../MapStore2/web/client/libs/ajax';
import { vectorDrawRecalcBboxEpic } from '../vectorDrawAnugaEpics';

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

const makeStore = (layerName = null) => ({
    getState: () => ({
        vectorDraw: { config: layerName ? { layerName } : {} }
    })
});

const recalcPosts = (mockAxios) =>
    (mockAxios.history.post || []).filter(r => /\/recalc-bbox\/$/.test(r.url));

const saveComplete = (meta) => ({ type: 'ANUGA:VECTOR_DRAW_COMPLETE', fid: 'f.1', meta });

describe('vectorDrawRecalcBboxEpic (TASK-2165 recalc after WFS-T save)', () => {
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('(a) POSTs the saved layer name from action.meta', (done) => {
        mockAxios.onPost(/\/recalc-bbox\/$/).reply(200, { recalculated: true });
        const emitted = [];
        vectorDrawRecalcBboxEpic(
            makeActions$([saveComplete({ prefix: 'bdy_', layerName: 'geonode:bdy_1_boundary_01' })]),
            makeStore()
        ).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                const posts = recalcPosts(mockAxios);
                expect(posts.length).toBe(1);
                expect(posts[0].url).toBe('/api/v2/anuga/datasets/recalc-bbox/');
                expect(JSON.parse(posts[0].data)).toEqual({ layer_name: 'geonode:bdy_1_boundary_01' });
                // Fire-and-forget: the epic emits NO redux action.
                expect(emitted.length).toBe(0);
                done();
            }
        );
    });

    it('(b) falls back to state.vectorDraw.config.layerName when meta lacks it', (done) => {
        mockAxios.onPost(/\/recalc-bbox\/$/).reply(200, { recalculated: true });
        vectorDrawRecalcBboxEpic(
            makeActions$([saveComplete({ prefix: 'inf_' })]),
            makeStore('geonode:inf_2_inflow_01')
        ).subscribe(
            () => {},
            err => done(err),
            () => {
                const posts = recalcPosts(mockAxios);
                expect(posts.length).toBe(1);
                expect(JSON.parse(posts[0].data)).toEqual({ layer_name: 'geonode:inf_2_inflow_01' });
                done();
            }
        );
    });

    it('(c) no layer name anywhere -> no POST', (done) => {
        vectorDrawRecalcBboxEpic(
            makeActions$([saveComplete({ prefix: 'bdy_' })]),
            makeStore()
        ).subscribe(
            () => {},
            err => done(err),
            () => { expect(recalcPosts(mockAxios).length).toBe(0); done(); }
        );
    });

    it('(d) POST failure is swallowed — no redux action, no crash', (done) => {
        mockAxios.onPost(/\/recalc-bbox\/$/).reply(500, { recalculated: false });
        const emitted = [];
        vectorDrawRecalcBboxEpic(
            makeActions$([saveComplete({ prefix: 'bdy_', layerName: 'geonode:bdy_1_boundary_01' })]),
            makeStore()
        ).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                expect(recalcPosts(mockAxios).length).toBe(1);
                expect(emitted.length).toBe(0);
                done();
            }
        );
    });
});

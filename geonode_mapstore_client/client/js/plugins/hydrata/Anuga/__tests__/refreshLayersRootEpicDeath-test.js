/**
 * TASK-2382 — refresh epic root-epic death regression (glossary: "Root-epic death").
 *
 * redux-observable 0.19: ONE uncaught error in any epic's output stream
 * terminates the ROOT epic — every epic in the app (saves / polling /
 * taskmonitor) is silently dead until page reload while reducers keep
 * running. The live prod trigger: refreshLayers(layers) dispatched with NO
 * options + the unguarded Object.keys(options) in the core refresh epic
 * (MapStore2/web/client/epics/layers.js getUpdates). It throws only after
 * GetCapabilities SUCCEEDS, so a flaky dev GeoServer masks it on localhost.
 *
 * These tests drive the REAL core `refresh` epic merged with a sibling
 * probe epic — the same composition combineEpics produces (an error in one
 * epic's output errors the merged stream and kills the sibling) — and prove:
 *   1. getUpdates survives undefined/null options (the guard);
 *   2. a bare REFRESH_LAYERS dispatch on the caps-SUCCESS path (the exact
 *      prod trigger) neither errors the merged stream nor kills the sibling;
 *   3. an in-epic throw is surfaced via console.error (no silent swallow),
 *      recovered as LAYERS_REFRESH_ERROR, and the sibling stays alive.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { refresh, getUpdates } from '../../../../../MapStore2/web/client/epics/layers';
import layersReducer from '../../../../../MapStore2/web/client/reducers/layers';
import Api from '../../../../../MapStore2/web/client/api/WMS';
import {
    refreshLayers,
    REFRESH_LAYERS,
    LAYERS_REFRESHED,
    LAYERS_REFRESH_ERROR,
    UPDATE_NODE
} from '../../../../../MapStore2/web/client/actions/layers';

const PROBE = 'TASK2382_PROBE';
const PROBE_ACK = 'TASK2382_PROBE_ACK';
const probeEpic = action$ => action$.ofType(PROBE).map(() => ({ type: PROBE_ACK }));

/**
 * Helper: a live Subject-based action$ (same idiom as pollingEpics-test.js).
 */
const liveActions = () => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    return { subject, action$ };
};

describe('refresh epic root-epic death regression (TASK-2382, RefreshLayers)', () => {
    afterEach(() => {
        expect.restoreSpies();
    });

    it('getUpdates tolerates undefined/null options (the prod crash input)', () => {
        expect(getUpdates({ bbox: 'b' }, undefined)).toEqual({});
        expect(getUpdates({ bbox: 'b' }, null)).toEqual({});
        // behaviour with real options is unchanged
        expect(getUpdates({ bbox: 'b', title: 't' }, { bbox: true, title: false })).toEqual({ bbox: 'b' });
    });

    it('bare REFRESH_LAYERS (no options) on the caps-success path does not kill the root epic — sibling epic still responds', (done) => {
        expect.spyOn(Api, 'getCapabilities').andReturn(Promise.resolve({ Capability: {} }));
        expect.spyOn(Api, 'flatLayers').andReturn([{ Name: 'tasmania', Title: 'Tasmania' }]);
        expect.spyOn(Api, 'describeLayer').andReturn(Promise.resolve(null));
        const { subject, action$ } = liveActions();
        const emitted = [];
        let streamError = null;
        const root$ = Rx.Observable.merge(refresh(action$), probeEpic(action$));
        const sub = root$.subscribe(
            (a) => {
                emitted.push(a);
                if (a.type === UPDATE_NODE) {
                    // the refresh cycle reached getUpdates and completed
                    // without throwing — now prove the sibling is alive
                    subject.next({ type: PROBE });
                }
                if (a.type === PROBE_ACK) {
                    expect(streamError).toBe(null);
                    expect(emitted.some(x => x.type === LAYERS_REFRESHED)).toBe(true);
                    sub.unsubscribe();
                    done();
                }
            },
            (e) => {
                streamError = e;
                done(new Error('root epic DIED: ' + e));
            }
        );
        // the exact prod dispatch shape: layers array, NO options argument
        subject.next({ ...refreshLayers([{ id: 'l1', name: 'tasmania', url: 'http://fake/geoserver/wms' }]), debounceTime: 0 });
    });

    it('an in-epic throw is console.error-surfaced, recovered as LAYERS_REFRESH_ERROR, and the sibling epic survives', (done) => {
        const errorSpy = expect.spyOn(console, 'error');
        const { subject, action$ } = liveActions();
        let streamError = null;
        const root$ = Rx.Observable.merge(refresh(action$), probeEpic(action$));
        const sub = root$.subscribe(
            (a) => {
                if (a.type === LAYERS_REFRESH_ERROR) {
                    expect(errorSpy).toHaveBeenCalled();
                    subject.next({ type: PROBE });
                }
                if (a.type === PROBE_ACK) {
                    expect(streamError).toBe(null);
                    sub.unsubscribe();
                    done();
                }
            },
            (e) => {
                streamError = e;
                done(new Error('root epic DIED: ' + e));
            }
        );
        // layers: null → action.layers.map throws synchronously inside the
        // epic — the class of error that used to zombie the whole app
        subject.next({ type: REFRESH_LAYERS, layers: null, options: {}, debounceTime: 0 });
    });

    it('catch-path recovery with NON-EMPTY layers survives the REAL layers reducer (no fullLayer TypeError, refreshing cleared) and the sibling survives', (done) => {
        // Adversarial-review finding (TASK-2382): raw layer objects in the
        // recovery action made the LAYERS_REFRESH_ERROR reducer throw on
        // err.fullLayer.title inside store.dispatch — re-killing the root
        // epic from the recovery emission itself. The catch must emit the
        // wrapper shape {layer: <id>, fullLayer: <layer>}.
        expect.spyOn(console, 'error');
        // sync throw in the defer factory (NOT a promise rejection — the
        // per-promise .catch handlers cannot absorb it)
        expect.spyOn(Api, 'getCapabilities').andThrow(new Error('sync caps boom'));
        const layer = { id: 'layer-1', name: 'ws:layer1', url: 'http://fake/geoserver/wms', title: 'L1' };
        const { subject, action$ } = liveActions();
        let streamError = null;
        const root$ = Rx.Observable.merge(refresh(action$), probeEpic(action$));
        const sub = root$.subscribe(
            (a) => {
                if (a.type === LAYERS_REFRESH_ERROR) {
                    // the recovery action must be digestible by the REAL
                    // reducer — this is what store.dispatch does in prod
                    const pre = layersReducer(undefined, { type: REFRESH_LAYERS, layers: [layer] });
                    let post;
                    expect(() => { post = layersReducer(pre, a); }).toNotThrow();
                    expect((post.refreshing || []).length).toBe(0);
                    subject.next({ type: PROBE });
                }
                if (a.type === PROBE_ACK) {
                    expect(streamError).toBe(null);
                    sub.unsubscribe();
                    done();
                }
            },
            (e) => {
                streamError = e;
                done(new Error('root epic DIED: ' + e));
            }
        );
        subject.next({ ...refreshLayers([layer]), debounceTime: 0 });
    });
});

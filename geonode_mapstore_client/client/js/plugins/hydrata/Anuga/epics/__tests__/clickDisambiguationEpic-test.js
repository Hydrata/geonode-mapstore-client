/*
 * TASK-1991 (W1.2) — clickDisambiguationEpic tests.
 *
 * Proof points:
 *   (a) buildCandidates filters empty-id (raster) + un-parseable + unmatched
 *       features, resolves label() to a plain object, and stores only
 *       {kind, featureId, layerName, label}.
 *   (b) epic branches LOAD_FEATURE_INFO: 0 editable -> no-op; 1 -> direct
 *       buildOpenActions dispatched; >=2 -> showClickDisambiguation dispatched.
 *   (c) non-FeatureCollection data -> no-op.
 *   (d) D6: no function values in any dispatched action or candidate state.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { LOAD_FEATURE_INFO } from '../../../../../../MapStore2/web/client/actions/mapInfo';
import {
    registerClickTarget,
    cleanClickTargets
} from '../../../shared/clickTargetRegistry';
import {
    SHOW_CLICK_DISAMBIGUATION,
    showClickDisambiguation,
    hideClickDisambiguation
} from '../../actions/clickDisambiguationActions';
import clickDisambiguationReducer from '../../reducers/clickDisambiguationReducer';
import { clickDisambiguationEpic, buildCandidates } from '../clickDisambiguationEpic';

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

const store = { getState: () => ({}) };

// Deep walk collecting function paths (D6 guard).
const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') {
            acc.push(`${path}.${k}`);
        } else if (v && typeof v === 'object') {
            collectFunctionPaths(v, `${path}.${k}`, acc);
        }
    });
    return acc;
};

const feature = (id, props = {}) => ({ type: 'Feature', id, properties: props });
const fc = (...features) => ({ type: 'FeatureCollection', features });

// Two fake editable targets keyed by layer-name prefix; one opener each.
const registerFakeTargets = () => {
    registerClickTarget('aaa_', {
        match: (featureId, layerName) => String(layerName).startsWith('aaa_'),
        label: (f) => ({ title: 'Alpha', subtitle: f.properties.description || '', icon: 'a-icon' }),
        buildOpenActions: (f) => [{ type: 'AAA:OPEN', featureId: f.id }]
    });
    registerClickTarget('bbb_', {
        match: (featureId, layerName) => String(layerName).startsWith('bbb_'),
        label: () => ({ title: 'Beta', subtitle: '', icon: 'b-icon' }),
        buildOpenActions: (f) => [{ type: 'BBB:OPEN', featureId: f.id }]
    });
};

describe('clickDisambiguationEpic (TASK-1991 W1.2)', () => {

    beforeEach(() => {
        cleanClickTargets();
        registerFakeTargets();
    });
    afterEach(() => cleanClickTargets());

    describe('buildCandidates', () => {

        it('filters empty-id (raster) and un-parseable features', () => {
            const collection = fc(
                feature(''),                       // raster -> empty id
                feature('no_dot_here'),            // un-parseable
                feature('aaa_1_alpha.7', { description: 'My Alpha' })
            );
            const candidates = buildCandidates(collection);
            expect(candidates.length).toBe(1);
            expect(candidates[0]).toEqual({
                kind: 'aaa_',
                featureId: 'aaa_1_alpha.7',
                layerName: 'aaa_1_alpha',
                label: { title: 'Alpha', subtitle: 'My Alpha', icon: 'a-icon' }
            });
        });

        it('drops features that match no registered target', () => {
            const candidates = buildCandidates(fc(feature('zzz_9_other.1')));
            expect(candidates).toEqual([]);
        });

        it('candidate state carries no function values (D6)', () => {
            const candidates = buildCandidates(fc(
                feature('aaa_1_alpha.7'),
                feature('bbb_2_beta.3')
            ));
            expect(candidates.length).toBe(2);
            expect(collectFunctionPaths(candidates)).toEqual([]);
        });
    });

    describe('epic branching', () => {

        it('0 editable candidates -> no-op (default Identify popup shows)', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(feature(''), feature('zzz_9_x.1')) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });

        it('1 candidate -> dispatches that target buildOpenActions directly', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_alpha.7')) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out).toEqual([{ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' }]);
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });

        it('>=2 candidates -> dispatches showClickDisambiguation with plain candidates', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7', { description: 'A' }),
                feature('bbb_2_beta.3')
            ) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.length).toBe(1);
                    expect(out[0].type).toBe(SHOW_CLICK_DISAMBIGUATION);
                    expect(out[0].candidates.map(c => c.kind)).toEqual(['aaa_', 'bbb_']);
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });

        it('non-FeatureCollection data -> no-op', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: 'fid = 5\nthe_geom = ...' }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });
    });

    describe('reducer slice', () => {

        it('defaults to {candidates: []}', () => {
            expect(clickDisambiguationReducer(undefined, { type: '@@INIT' }))
                .toEqual({ candidates: [] });
        });

        it('SHOW stores the candidates', () => {
            const candidates = [{ kind: 'aaa_', featureId: 'aaa_1_x.1', layerName: 'aaa_1_x', label: { title: 'A', subtitle: '', icon: '' } }];
            expect(clickDisambiguationReducer(undefined, showClickDisambiguation(candidates)))
                .toEqual({ candidates });
        });

        it('HIDE clears the candidates', () => {
            const seeded = { candidates: [{ kind: 'aaa_' }] };
            expect(clickDisambiguationReducer(seeded, hideClickDisambiguation()))
                .toEqual({ candidates: [] });
        });

        it('SHOW with no candidates falls back to []', () => {
            expect(clickDisambiguationReducer(undefined, { type: SHOW_CLICK_DISAMBIGUATION }))
                .toEqual({ candidates: [] });
        });
    });
});

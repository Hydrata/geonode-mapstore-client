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
import {
    LOAD_FEATURE_INFO,
    TOGGLE_MAPINFO_STATE,
    CHANGE_MAPINFO_FORMAT,
    PURGE_MAPINFO_RESULTS,
    HIDE_MAPINFO_MARKER
} from '../../../../../../MapStore2/web/client/actions/mapInfo';
import { setAnugaProjectData } from '../../actions/dataActions';
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
import {
    clickDisambiguationEpic,
    buildCandidates,
    filterEditableCandidates,
    isVectorDrawActive,
    anugaIdentifyEnableEpic,
    anugaIdentifyJsonFormatEpic
} from '../clickDisambiguationEpic';

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

// TASK-1994 (W2.2) — the epic now perms-gates candidates, so the branching
// tests need a state where the clicked layers ARE editable. Project my_role
// 'editor' grants edit on any layer (role-based), and the fake-target layer
// names are present in state.layers.flat (workspace-qualified, as live layers
// are). Without this, every candidate would be dropped fail-closed.
// W2 self-verify FIX-2: the epic now ALSO gates on canEditMap (mirrors the
// SimpleView pencil: canEditMap && canEditLayer). canEditMap needs
// gnresource.initialResource.perms to include 'change_resourcebase'; without it
// every candidate is dropped (map-level fail-closed). Editable fixtures grant it.
const store = { getState: () => ({
    layers: { flat: [
        { name: 'geonode:aaa_1_alpha', perms: [] },
        { name: 'geonode:bbb_2_beta', perms: [] }
    ] },
    anuga: { projects: { data: { my_role: 'editor' } } },
    security: { user: { pk: 1 } },
    gnresource: { initialResource: { perms: ['change_resourcebase'] } }
}) };

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

        it('plainLabel coerces non-string label VALUES to strings (FIX-4)', () => {
            // A target whose label() returns a function-valued title + numeric
            // subtitle + null icon: plainLabel must String()-coerce each so no
            // function/object leaks into candidate state (D6 + render hazard).
            registerClickTarget('ccc_', {
                match: (featureId, layerName) => String(layerName).startsWith('ccc_'),
                label: () => ({ title: () => 'fn-title', subtitle: 42, icon: null }),
                buildOpenActions: () => []
            });
            const cand = buildCandidates(fc(feature('ccc_3_gamma.1')))[0];
            expect(typeof cand.label.title).toBe('string');
            expect(typeof cand.label.subtitle).toBe('string');
            expect(typeof cand.label.icon).toBe('string');
            expect(cand.label.subtitle).toBe('42');   // number -> '42'
            expect(cand.label.icon).toBe('');          // null -> ''
            expect(collectFunctionPaths([cand])).toEqual([]);
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

        it('1 candidate -> tears down Identify popup+marker FIRST, then buildOpenActions', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_alpha.7')) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    // W2 self-verify FIX-1: PURGE + HIDE marker precede the opener.
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        'AAA:OPEN'
                    ]);
                    expect(out[2]).toEqual({ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' });
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });

        it('>=2 candidates -> tears down Identify popup+marker FIRST, then showClickDisambiguation', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7', { description: 'A' }),
                feature('bbb_2_beta.3')
            ) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    // W2 self-verify FIX-1: PURGE + HIDE marker precede the panel.
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        SHOW_CLICK_DISAMBIGUATION
                    ]);
                    expect(out[2].candidates.map(c => c.kind)).toEqual(['aaa_', 'bbb_']);
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

    describe('permissions gate (TASK-1994 W2.2)', () => {

        // canEditMap defaults ON here (mapPerms includes change_resourcebase) so
        // these tests isolate the layer-level canEditLayer behaviour; the dedicated
        // canEditMap describe-block below varies the map-level perm.
        const stateWith = (flat, { myRole = 'editor', pk = 1, mapPerms = ['change_resourcebase'] } = {}) => ({
            layers: { flat },
            anuga: { projects: { data: { my_role: myRole } } },
            security: { user: { pk } },
            gnresource: { initialResource: { perms: mapPerms } }
        });
        const candAaa = { kind: 'aaa_', featureId: 'aaa_1_alpha.7', layerName: 'aaa_1_alpha', label: { title: 'Alpha', subtitle: '', icon: '' } };

        it('keeps a candidate whose layer the user may edit (role editor)', () => {
            const state = stateWith([{ name: 'geonode:aaa_1_alpha', perms: [] }], { myRole: 'editor' });
            expect(filterEditableCandidates([candAaa], state)).toEqual([candAaa]);
        });

        it('drops a candidate whose layer the user may NOT edit (viewer, no perms)', () => {
            const state = stateWith([{ name: 'geonode:aaa_1_alpha', perms: [] }], { myRole: 'viewer' });
            expect(filterEditableCandidates([candAaa], state)).toEqual([]);
        });

        it('keeps when the layer carries an explicit change_resourcebase perm even for a viewer', () => {
            const state = stateWith([{ name: 'geonode:aaa_1_alpha', perms: ['change_resourcebase'] }], { myRole: 'viewer' });
            expect(filterEditableCandidates([candAaa], state)).toEqual([candAaa]);
        });

        it('drops (fail-closed) when the layer is not present in state.layers.flat', () => {
            expect(filterEditableCandidates([candAaa], stateWith([], { myRole: 'editor' }))).toEqual([]);
        });

        it('matches a BARE candidate layerName against a geonode:-qualified flat layer name', () => {
            const state = stateWith([{ name: 'geonode:aaa_1_alpha', perms: [] }], { myRole: 'editor' });
            expect(filterEditableCandidates([candAaa], state).length).toBe(1);
        });

        it('epic: with only one of two layers editable, the >=2 path collapses to the single editable opener', (done) => {
            // aaa_ editable (explicit perm), bbb_ absent from flat -> dropped.
            const permStore = { getState: () => stateWith(
                [{ name: 'geonode:aaa_1_alpha', perms: ['change_resourcebase'] }],
                { myRole: 'viewer' }
            ) };
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7'),
                feature('bbb_2_beta.3')
            ) }]);
            const out = [];
            clickDisambiguationEpic(action$, permStore).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        'AAA:OPEN'
                    ]);
                    expect(out[2]).toEqual({ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' });
                    done();
                }
            );
        });

        it('epic: when NO clicked layer is editable, falls through to the default Identify popup (no-op)', (done) => {
            const permStore = { getState: () => stateWith([], { myRole: 'viewer' }) };
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7'),
                feature('bbb_2_beta.3')
            ) }]);
            const out = [];
            clickDisambiguationEpic(action$, permStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });

        // W2 self-verify FIX-2: a map click must never be MORE permissive than the
        // SimpleView pencil (canEditMap && canEditLayer). canEditMap requires
        // change_resourcebase on the MAP's initialResource.
        it('drops an EDIT candidate when canEditMap is false even though canEditLayer would pass', () => {
            // role editor => canEditLayer true on aaa_, but mapPerms lacks
            // change_resourcebase => canEditMap false => candidate dropped.
            const state = stateWith(
                [{ name: 'geonode:aaa_1_alpha', perms: [] }],
                { myRole: 'editor', mapPerms: [] }
            );
            expect(filterEditableCandidates([candAaa], state)).toEqual([]);
        });

        it('keeps an EDIT candidate when BOTH canEditMap and canEditLayer pass', () => {
            const state = stateWith(
                [{ name: 'geonode:aaa_1_alpha', perms: [] }],
                { myRole: 'editor', mapPerms: ['change_resourcebase'] }
            );
            expect(filterEditableCandidates([candAaa], state)).toEqual([candAaa]);
        });

        it('drops on an excluded site (canEditMap false via isExcludedSite) even with map+layer perms', () => {
            const state = {
                ...stateWith([{ name: 'geonode:aaa_1_alpha', perms: ['change_resourcebase'] }], { myRole: 'editor' }),
                gnsettings: { geonodeUrl: 'https://placeholder.com' }
            };
            expect(filterEditableCandidates([candAaa], state)).toEqual([]);
        });
    });

    describe('drawing-mode guard + identify enablement (TASK-1995 W2.3)', () => {

        const editableFlat = [
            { name: 'geonode:aaa_1_alpha', perms: ['change_resourcebase'] },
            { name: 'geonode:bbb_2_beta', perms: ['change_resourcebase'] }
        ];
        const baseState = (vectorDraw) => ({
            layers: { flat: editableFlat },
            anuga: { projects: { data: { my_role: 'editor' } } },
            security: { user: { pk: 1 } },
            gnresource: { initialResource: { perms: ['change_resourcebase'] } },
            vectorDraw
        });
        const twoFeatureClick = () => makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
            feature('aaa_1_alpha.7'),
            feature('bbb_2_beta.3')
        ) }]);

        it('isVectorDrawActive: true for an in-flight phase, false for idle / cancelling / unset', () => {
            expect(isVectorDrawActive({ vectorDraw: { phase: 'drawing' } })).toBe(true);
            expect(isVectorDrawActive({ vectorDraw: { phase: 'form' } })).toBe(true);
            expect(isVectorDrawActive({ vectorDraw: { phase: 'idle' } })).toBe(false);
            expect(isVectorDrawActive({ vectorDraw: { phase: 'cancelling' } })).toBe(false);
            expect(isVectorDrawActive({})).toBe(false);
        });

        it('suppresses disambiguation while a VectorDraw draw/edit phase is active (AC1)', (done) => {
            const drawingStore = { getState: () => baseState({ phase: 'drawing' }) };
            const out = [];
            clickDisambiguationEpic(twoFeatureClick(), drawingStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });

        it('when VectorDraw is idle the click flows to the classifier (AC2)', (done) => {
            const idleStore = { getState: () => baseState({ phase: 'idle' }) };
            const out = [];
            clickDisambiguationEpic(twoFeatureClick(), idleStore).subscribe(
                a => out.push(a),
                done,
                () => {
                    // FIX-1 teardown precedes the panel here too.
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        SHOW_CLICK_DISAMBIGUATION
                    ]);
                    done();
                }
            );
        });

        it('anugaIdentifyEnableEpic turns Identify ON when it is disabled on ANUGA project load (AC3)', (done) => {
            const epicStore = { getState: () => ({ mapInfo: { enabled: false } }) };
            const out = [];
            anugaIdentifyEnableEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out.map(a => a.type)).toEqual([TOGGLE_MAPINFO_STATE]); done(); }
            );
        });

        it('anugaIdentifyEnableEpic fires AT MOST ONCE across multiple SET_ANUGA_PROJECT_DATA (one-shot)', (done) => {
            // W2 self-verify FIX-3: identify stays disabled across 3 project-data
            // refreshes, but .take(1) means only the FIRST flips it on — a later
            // deliberate user off-toggle is never fought.
            const epicStore = { getState: () => ({ mapInfo: { enabled: false } }) };
            const out = [];
            anugaIdentifyEnableEpic(makeActions$([
                setAnugaProjectData({ id: 5 }),
                setAnugaProjectData({ id: 5 }),
                setAnugaProjectData({ id: 5 })
            ]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out.map(a => a.type)).toEqual([TOGGLE_MAPINFO_STATE]); done(); }
            );
        });

        it('anugaIdentifyEnableEpic is a no-op when Identify is already enabled', (done) => {
            const epicStore = { getState: () => ({ mapInfo: { enabled: true } }) };
            const out = [];
            anugaIdentifyEnableEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });

        it('anugaIdentifyEnableEpic is a no-op when mapInfo state is absent (enabled unset)', (done) => {
            const epicStore = { getState: () => ({}) };
            const out = [];
            anugaIdentifyEnableEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out).toEqual([]); done(); }
            );
        });

        // W2 CORRECTIVE — anugaIdentifyJsonFormatEpic forces application/json
        // info_format. The bug it fixes: the live Identify default is text/plain,
        // so the classifier's `data.type === 'FeatureCollection'` guard dropped
        // EVERY real GFI click (text/plain is "no features were found", not a
        // FeatureCollection) — disambiguation never fired on a real on-map click.
        it('anugaIdentifyJsonFormatEpic forces application/json when the live default is text/plain', (done) => {
            const epicStore = { getState: () => ({ mapInfo: { configuration: { infoFormat: 'text/plain' } } }) };
            const out = [];
            anugaIdentifyJsonFormatEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([CHANGE_MAPINFO_FORMAT]);
                    expect(out[0].infoFormat).toEqual('application/json');
                    done();
                }
            );
        });

        it('anugaIdentifyJsonFormatEpic forces application/json when no infoFormat is configured (the live default path)', (done) => {
            // configuration absent => infoFormat undefined !== application/json =>
            // MapStore falls back to text/plain at GFI time, so we MUST set json.
            const epicStore = { getState: () => ({ mapInfo: {} }) };
            const out = [];
            anugaIdentifyJsonFormatEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([CHANGE_MAPINFO_FORMAT]);
                    expect(out[0].infoFormat).toEqual('application/json');
                    done();
                }
            );
        });

        it('anugaIdentifyJsonFormatEpic fires AT MOST ONCE across multiple SET_ANUGA_PROJECT_DATA (one-shot)', (done) => {
            // .take(1): only the FIRST load sets json; a later deliberate user
            // format switch is never fought on the next refresh.
            const epicStore = { getState: () => ({ mapInfo: { configuration: { infoFormat: 'text/plain' } } }) };
            const out = [];
            anugaIdentifyJsonFormatEpic(makeActions$([
                setAnugaProjectData({ id: 5 }),
                setAnugaProjectData({ id: 5 }),
                setAnugaProjectData({ id: 5 })
            ]), epicStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out.map(a => a.type)).toEqual([CHANGE_MAPINFO_FORMAT]); done(); }
            );
        });

        it('anugaIdentifyJsonFormatEpic is a no-op when the format is already application/json', (done) => {
            const epicStore = { getState: () => ({ mapInfo: { configuration: { infoFormat: 'application/json' } } }) };
            const out = [];
            anugaIdentifyJsonFormatEpic(makeActions$([setAnugaProjectData({ id: 5 })]), epicStore).subscribe(
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

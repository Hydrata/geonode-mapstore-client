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
    FEATURE_INFO_CLICK,
    NEW_MAPINFO_REQUEST,
    TOGGLE_MAPINFO_STATE,
    CHANGE_MAPINFO_FORMAT,
    PURGE_MAPINFO_RESULTS,
    HIDE_MAPINFO_MARKER
} from '../../../../../../MapStore2/web/client/actions/mapInfo';
import mapInfoReducer from '../../../../../../MapStore2/web/client/reducers/mapInfo';
import { setAnugaProjectData } from '../../actions/dataActions';
import {
    registerClickTarget,
    cleanClickTargets
} from '../../../shared/clickTargetRegistry';
import {
    SHOW_CLICK_DISAMBIGUATION,
    HIDE_CLICK_DISAMBIGUATION,
    ARM_CLICK_AGGREGATION,
    showClickDisambiguation,
    hideClickDisambiguation,
    armClickAggregation
} from '../../actions/clickDisambiguationActions';
import clickDisambiguationReducer from '../../reducers/clickDisambiguationReducer';
import {
    clickDisambiguationEpic,
    buildCandidates,
    filterEditableCandidates,
    isLayerVisible,
    isVectorDrawActive,
    anugaIdentifyEnableEpic,
    anugaIdentifyJsonFormatEpic
} from '../clickDisambiguationEpic';
// W4 (TASK-2000) integration imports — real ANUGA click-target registrar + panel resolver
import { registerAnugaClickTargets } from '../../anugaClickTargets';
import { resolveCandidateOpenActions } from '../../../shared/components/ClickDisambiguationPanel';
import { START_VECTOR_DRAW } from '../../../VectorDraw/actionsVectorDraw';
import { ANUGA_FEATURE_CONFIG } from '../../../SimpleView/components/simpleViewMenuRow';

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

        it('0 editable candidates -> clears aggregating so the default Identify popup shows', (done) => {
            // W2-corrective-4: was a bare no-op ([]); now the branch emits
            // hideClickDisambiguation() to CLEAR the dock-suppression flag (without
            // purging), revealing the default Identify popup as the final state.
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(feature(''), feature('zzz_9_x.1')) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([HIDE_CLICK_DISAMBIGUATION]);
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });

        it('1 candidate -> tears down Identify popup+marker FIRST, clears aggregating, then buildOpenActions', (done) => {
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_alpha.7')) }]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    // W2 self-verify FIX-1: PURGE + HIDE marker precede the opener.
                    // W2-corrective-4: HIDE_CLICK_DISAMBIGUATION clears `aggregating`
                    // AFTER the purge (requests already empty => no dock re-open).
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        HIDE_CLICK_DISAMBIGUATION,
                        'AAA:OPEN'
                    ]);
                    expect(out[3]).toEqual({ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' });
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

        // W2 CORRECTIVE-3 — the headline regression guard. MapStore issues ONE
        // LOAD_FEATURE_INFO PER LAYER (getFeatureInfoOnFeatureInfoClick mergeMaps
        // over queryableLayers), so a click on an inflow inside a rainfall polygon
        // arrives as a BURST of single-layer single-feature actions, NOT one
        // multi-feature action. The epic must buffer the burst and classify the
        // UNION — else the >=2 panel never fires for cross-layer clicks and multiple
        // 1-candidate opens race (last layer wins). Pre-fix this was the operator's
        // W2-UAT failure: "inflow/boundary inside a rainfall polygon doesn't disambiguate".
        it('aggregates a BURST of per-layer LOAD_FEATURE_INFO actions -> >=2 across layers shows the panel', (done) => {
            const action$ = makeActions$([
                { type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_alpha.7', { description: 'A' })) },
                { type: LOAD_FEATURE_INFO, data: fc(feature('bbb_2_beta.3')) }
            ]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        SHOW_CLICK_DISAMBIGUATION
                    ]);
                    // both layers' features classified into the one panel
                    expect(out[2].candidates.map(c => c.kind)).toEqual(['aaa_', 'bbb_']);
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });

        it('aggregates a per-layer burst where only ONE layer is editable -> opens that one directly', (done) => {
            // e.g. click hits an editable inflow + a NON-registered/zero-id raster layer:
            // union has 1 editable candidate -> direct open, no panel.
            const action$ = makeActions$([
                { type: LOAD_FEATURE_INFO, data: fc(feature('zzz_9_unregistered.1')) },
                { type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_alpha.7')) }
            ]);
            const out = [];
            clickDisambiguationEpic(action$, store).subscribe(
                a => out.push(a),
                done,
                () => {
                    expect(out.map(a => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        HIDE_CLICK_DISAMBIGUATION,
                        'AAA:OPEN'
                    ]);
                    expect(out[3]).toEqual({ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' });
                    done();
                }
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
                        HIDE_CLICK_DISAMBIGUATION,
                        'AAA:OPEN'
                    ]);
                    expect(out[3]).toEqual({ type: 'AAA:OPEN', featureId: 'aaa_1_alpha.7' });
                    done();
                }
            );
        });

        it('epic: when NO clicked layer is editable, clears aggregating + falls through to the default Identify popup', (done) => {
            // W2-corrective-4: was [] (bare no-op); now hideClickDisambiguation() clears
            // the dock-suppression flag so the default popup reveals.
            const permStore = { getState: () => stateWith([], { myRole: 'viewer' }) };
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7'),
                feature('bbb_2_beta.3')
            ) }]);
            const out = [];
            clickDisambiguationEpic(action$, permStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out.map(a => a.type)).toEqual([HIDE_CLICK_DISAMBIGUATION]); done(); }
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
            // W2-corrective-4: was [] (bare no-op); now hideClickDisambiguation() clears
            // the dock-suppression flag (the click belongs to the draw flow).
            const drawingStore = { getState: () => baseState({ phase: 'drawing' }) };
            const out = [];
            clickDisambiguationEpic(twoFeatureClick(), drawingStore).subscribe(
                a => out.push(a),
                done,
                () => { expect(out.map(a => a.type)).toEqual([HIDE_CLICK_DISAMBIGUATION]); done(); }
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

    // W2-corrective-4 (epic 1969) — the epic ARMS the dock-suppression flag once per
    // click, on the FIRST FeatureCollection of the burst, via
    // switchMap(FEATURE_INFO_CLICK -> featureInfo$.take(1)). This is the per-click latch
    // that defeats the straggler re-arm flicker (a layer answering AFTER the branch
    // cannot re-suppress the revealed popup) and, being epic-driven, makes a stuck flag
    // on a muted page structurally impossible.
    describe('arm$ per-click latch (W2-corrective-4)', () => {
        const armsIn = (out) => out.filter(a => a.type === ARM_CLICK_AGGREGATION).length;
        // non-matching feature -> classify yields 0 candidates -> branch is [HIDE], so the
        // only ARM(s) come from arm$, isolating the latch behaviour.
        const click = { type: FEATURE_INFO_CLICK };
        const fcLoad = () => ({ type: LOAD_FEATURE_INFO, data: fc(feature('zzz_9_x.1')) });

        it('does NOT arm without a FEATURE_INFO_CLICK (a bare GFI response never arms)', (done) => {
            const out = [];
            clickDisambiguationEpic(makeActions$([fcLoad()]), store).subscribe(
                a => out.push(a), done,
                () => { expect(armsIn(out)).toBe(0); done(); }
            );
        });

        it('does NOT arm on a click that yields NO FeatureCollection (the stuck-flag guard)', (done) => {
            // The load-bearing reason for switchMap(() => featureInfo$.take(1)) rather than
            // a naive .mapTo(arm) directly on FEATURE_INFO_CLICK: arm ONLY after a real
            // FeatureCollection arrives. A click returning text/plain "no features were
            // found" (non-FeatureCollection) must NOT arm — otherwise the flag would be set
            // with no classify flush ever firing to clear it (stuck dock; breaks
            // invariants #1/#5). A naive mapTo(arm)-on-click would (wrongly) arm here.
            const out = [];
            clickDisambiguationEpic(makeActions$([
                { type: FEATURE_INFO_CLICK },
                { type: LOAD_FEATURE_INFO, data: 'fid = 5\nno features were found' }
            ]), store).subscribe(
                a => out.push(a), done,
                () => { expect(armsIn(out)).toBe(0); done(); }
            );
        });

        it('does NOT arm on a bare click with no GFI response at all', (done) => {
            const out = [];
            clickDisambiguationEpic(makeActions$([{ type: FEATURE_INFO_CLICK }]), store).subscribe(
                a => out.push(a), done,
                () => { expect(armsIn(out)).toBe(0); done(); }
            );
        });

        it('arms exactly ONCE per click even across a multi-layer burst (no re-arm within a click)', (done) => {
            const out = [];
            clickDisambiguationEpic(makeActions$([click, fcLoad(), fcLoad(), fcLoad()]), store).subscribe(
                a => out.push(a), done,
                () => {
                    expect(armsIn(out)).toBe(1);
                    // the single ARM precedes the flush branch
                    expect(out[0].type).toBe(ARM_CLICK_AGGREGATION);
                    done();
                }
            );
        });

        it('re-arms on a NEW click (the latch resets per click)', (done) => {
            const out = [];
            clickDisambiguationEpic(makeActions$([click, fcLoad(), click, fcLoad()]), store).subscribe(
                a => out.push(a), done,
                () => { expect(armsIn(out)).toBe(2); done(); }
            );
        });
    });

    describe('reducer slice', () => {

        it('defaults to {candidates: [], aggregating: false}', () => {
            expect(clickDisambiguationReducer(undefined, { type: '@@INIT' }))
                .toEqual({ candidates: [], aggregating: false });
        });

        it('SHOW stores the candidates and clears aggregating', () => {
            const candidates = [{ kind: 'aaa_', featureId: 'aaa_1_x.1', layerName: 'aaa_1_x', label: { title: 'A', subtitle: '', icon: '' } }];
            expect(clickDisambiguationReducer({ candidates: [], aggregating: true }, showClickDisambiguation(candidates)))
                .toEqual({ candidates, aggregating: false });
        });

        it('HIDE clears the candidates and aggregating', () => {
            const seeded = { candidates: [{ kind: 'aaa_' }], aggregating: true };
            expect(clickDisambiguationReducer(seeded, hideClickDisambiguation()))
                .toEqual({ candidates: [], aggregating: false });
        });

        it('SHOW with no candidates falls back to []', () => {
            expect(clickDisambiguationReducer(undefined, { type: SHOW_CLICK_DISAMBIGUATION }))
                .toEqual({ candidates: [], aggregating: false });
        });
    });

    // W2-corrective-4 (epic 1969) — the Identify-dock-flash fix. The reducer holds a
    // plain `aggregating` boolean that the core Identify dock gate AND-s with as
    // `!anugaAggregating`. SET is epic-driven (ARM_CLICK_AGGREGATION) and CLEAR is on
    // every branch + FEATURE_INFO_CLICK, so a stuck flag is structurally impossible.
    describe('aggregating flag — reducer lifecycle + stuck-proofing', () => {

        it('ARM_CLICK_AGGREGATION sets aggregating true (epic-driven SET, idempotent)', () => {
            expect(clickDisambiguationReducer({ candidates: [], aggregating: false }, armClickAggregation()).aggregating).toBe(true);
            // idempotent: a second arm returns the SAME object (no redundant render)
            const armed = { candidates: [], aggregating: true };
            expect(clickDisambiguationReducer(armed, armClickAggregation())).toBe(armed);
        });

        it('does NOT arm on a raw LOAD_FEATURE_INFO (FeatureCollection or not) — only the epic arms', () => {
            // The high-severity stuck trap was a reducer that armed on a raw
            // FeatureCollection LOAD_FEATURE_INFO; the globally-mounted slice would then
            // get stuck true on a page where the epic is muted. The reducer must NOT
            // react to LOAD_FEATURE_INFO at all.
            const s = { candidates: [], aggregating: false };
            expect(clickDisambiguationReducer(s, { type: LOAD_FEATURE_INFO, data: fc(feature('aaa_1_x.1')) }).aggregating).toBe(false);
            expect(clickDisambiguationReducer(s, { type: LOAD_FEATURE_INFO, data: 'text/plain blob' }).aggregating).toBe(false);
        });

        it('FEATURE_INFO_CLICK clears aggregating (start-of-click + cross-map stuck recovery)', () => {
            expect(clickDisambiguationReducer({ candidates: [], aggregating: true }, { type: FEATURE_INFO_CLICK }).aggregating).toBe(false);
            // no-op (same object) when already false
            const idle = { candidates: [], aggregating: false };
            expect(clickDisambiguationReducer(idle, { type: FEATURE_INFO_CLICK })).toBe(idle);
        });

        it('CANNOT get stuck: an armed flag is always cleared by the next click', () => {
            let s = clickDisambiguationReducer(undefined, armClickAggregation());
            expect(s.aggregating).toBe(true);
            s = clickDisambiguationReducer(s, { type: FEATURE_INFO_CLICK });
            expect(s.aggregating).toBe(false);
        });
    });

    // The behavioural proof the corrective targets: compute the core Identify dock gate
    // (IdentifyContainer.jsx: `enabled && requests.length !== 0 && !anugaAggregating`)
    // from the REAL core mapInfo reducer + our anuga reducer across a click's lifecycle.
    describe('dock gate behaviour (combines core mapInfo reducer + anuga reducer)', () => {
        // mirrors IdentifyContainer.jsx:117 exactly
        const gateOpen = (mi, cd) => true && (mi.requests || []).length !== 0 && !cd.aggregating;
        const aRequest = { type: NEW_MAPINFO_REQUEST, reqId: 0, request: {} };

        it('>=1-candidate click: dock is NEVER open (suppressed during aggregation, requests purged after)', () => {
            // click fired a GFI request -> requests non-empty
            let mi = mapInfoReducer(undefined, aRequest);
            expect(mi.requests.length).toBe(1);
            // first FeatureCollection -> epic arms -> aggregating true
            let cd = clickDisambiguationReducer(undefined, armClickAggregation());
            expect(gateOpen(mi, cd)).toBe(false);   // suppressed DURING the 300ms window
            // branch (>=2): purge empties requests, SHOW clears aggregating
            mi = mapInfoReducer(mi, { type: PURGE_MAPINFO_RESULTS });
            cd = clickDisambiguationReducer(cd, showClickDisambiguation([{ kind: 'aaa_' }, { kind: 'bbb_' }]));
            expect(gateOpen(mi, cd)).toBe(false);   // still closed AFTER the branch (requests empty)
        });

        it('0-candidate click: dock STAYS open as the default popup (invariant #1 — reveal, not flash)', () => {
            let mi = mapInfoReducer(undefined, aRequest);   // requests non-empty
            let cd = clickDisambiguationReducer(undefined, armClickAggregation());
            expect(gateOpen(mi, cd)).toBe(false);   // suppressed during the window
            // 0-candidate branch: HIDE clears aggregating WITHOUT a purge -> requests survive
            cd = clickDisambiguationReducer(cd, hideClickDisambiguation());
            expect(mi.requests.length).toBe(1);     // not purged
            expect(gateOpen(mi, cd)).toBe(true);    // default Identify popup REVEALED
        });
    });

    // =========================================================================
    // W3 (TASK-1996/1997/1998) — read-only perms-gate partition (C1), raster
    // candidate classification (C5), and 0/1/>=2 UX across all kinds.
    // =========================================================================
    describe('W3 — read-only perms-gate partition (C1, TASK-1996/1997)', () => {

        // A readOnly target registered for 'ro_' prefix.
        const registerReadOnlyTarget = () => {
            registerClickTarget('ro_', {
                match: (featureId, layerName) => !!featureId && String(layerName).startsWith('ro_'),
                label: (f) => ({ title: 'Read Only', subtitle: f.properties?.name || '', icon: 'list' }),
                buildOpenActions: (f) => [{ type: 'RO:VIEW', featureId: f.id }],
                readOnly: true
            });
        };

        // isLayerVisible helper tests
        describe('isLayerVisible', () => {
            const candidate = (layerName) => ({ kind: 'ro_', featureId: `${layerName}.1`, layerName });

            it('returns true when layer.visibility is unset (default)', () => {
                const state = { layers: { flat: [{ name: 'geonode:ro_1_x' }] } };
                expect(isLayerVisible(candidate('ro_1_x'), state)).toBe(true);
            });

            it('returns true when layer.visibility is true', () => {
                const state = { layers: { flat: [{ name: 'geonode:ro_1_x', visibility: true }] } };
                expect(isLayerVisible(candidate('ro_1_x'), state)).toBe(true);
            });

            it('returns false when layer.visibility is false (layer turned off)', () => {
                const state = { layers: { flat: [{ name: 'geonode:ro_1_x', visibility: false }] } };
                expect(isLayerVisible(candidate('ro_1_x'), state)).toBe(false);
            });

            it('returns false when layer is absent from state.layers.flat (fail-closed)', () => {
                expect(isLayerVisible(candidate('ro_1_x'), { layers: { flat: [] } })).toBe(false);
            });
        });

        // C1: read-only candidate on a layer the user CANNOT edit still appears
        describe('perms-gate partition via buildCandidates + filterEditableCandidates', () => {

            beforeEach(() => {
                cleanClickTargets();
                // one edit target + one readOnly target
                registerClickTarget('aaa_', {
                    match: (id, ln) => String(ln).startsWith('aaa_'),
                    label: () => ({ title: 'Edit', subtitle: '', icon: 'pencil' }),
                    buildOpenActions: (f) => [{ type: 'AAA:OPEN', featureId: f.id }]
                });
                registerReadOnlyTarget();
            });
            afterEach(() => cleanClickTargets());

            it('read-only candidate on non-editable layer is NOT dropped by filterEditableCandidates', () => {
                // viewer role + no mapPerms => editCandidates filtered to []
                // but the readOnly candidate bypasses the filter
                const viewerState = {
                    layers: { flat: [{ name: 'geonode:ro_1_x' }] },
                    anuga: { projects: { data: { my_role: 'viewer' } } },
                    security: { user: { pk: 1 } },
                    gnresource: { initialResource: { perms: [] } }  // no change_resourcebase
                };
                const candidates = buildCandidates({ type: 'FeatureCollection', features: [
                    { type: 'Feature', id: 'ro_1_x.3', properties: {} }
                ] });
                expect(candidates.length).toBe(1);
                expect(candidates[0].kind).toBe('ro_');
                // filterEditableCandidates only processes edit targets — it should NOT
                // drop the readOnly candidate (it is not in its input set).
                // Directly verify: filterEditableCandidates receives ONLY non-readOnly candidates
                const editOnly = candidates.filter((c) => !store.getState && true);  // all
                // Simulate the partition: readOnly candidates bypass the filter entirely
                const editCandidates = filterEditableCandidates(
                    candidates.filter((c) => c.kind !== 'ro_'),  // no edit candidates
                    viewerState
                );
                const readOnlyCandidates = candidates.filter((c) => c.kind === 'ro_');
                expect(editCandidates.length).toBe(0);
                expect(readOnlyCandidates.length).toBe(1);
                expect(readOnlyCandidates[0].kind).toBe('ro_');
            });

            it('epic: read-only candidate on a non-editable layer survives (C1)', (done) => {
                // User is a viewer (can't edit), layer IS visible.
                // The ro_ candidate should survive the W3 partition and trigger a direct open.
                const viewerStore = { getState: () => ({
                    layers: { flat: [{ name: 'geonode:ro_1_x', visibility: true }] },
                    anuga: { projects: { data: { my_role: 'viewer' } } },
                    security: { user: { pk: 1 } },
                    gnresource: { initialResource: { perms: [] } }  // no edit perm
                }) };
                const action$ = makeActions$([{
                    type: LOAD_FEATURE_INFO,
                    data: { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'ro_1_x.3', properties: {} }] },
                    layer: { name: 'geonode:ro_1_x' }
                }]);
                const out = [];
                clickDisambiguationEpic(action$, viewerStore).subscribe(
                    (a) => out.push(a), done,
                    () => {
                        // 1 readOnly candidate -> teardown + HIDE + RO:VIEW
                        expect(out.map((a) => a.type)).toEqual([
                            PURGE_MAPINFO_RESULTS,
                            HIDE_MAPINFO_MARKER,
                            HIDE_CLICK_DISAMBIGUATION,
                            'RO:VIEW'
                        ]);
                        expect(out[3].featureId).toBe('ro_1_x.3');
                        expect(collectFunctionPaths(out)).toEqual([]);
                        done();
                    }
                );
            });

            it('epic: read-only candidate on a hidden layer is dropped (visibility gate)', (done) => {
                const hiddenLayerStore = { getState: () => ({
                    layers: { flat: [{ name: 'geonode:ro_1_x', visibility: false }] },
                    anuga: { projects: { data: { my_role: 'editor' } } },
                    security: { user: { pk: 1 } },
                    gnresource: { initialResource: { perms: ['change_resourcebase'] } }
                }) };
                const action$ = makeActions$([{
                    type: LOAD_FEATURE_INFO,
                    data: { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'ro_1_x.3', properties: {} }] },
                    layer: { name: 'geonode:ro_1_x' }
                }]);
                const out = [];
                clickDisambiguationEpic(action$, hiddenLayerStore).subscribe(
                    (a) => out.push(a), done,
                    () => {
                        // 0 candidates -> fallthrough
                        expect(out.map((a) => a.type)).toEqual([HIDE_CLICK_DISAMBIGUATION]);
                        done();
                    }
                );
            });

            it('epic: mixed edit+readOnly — both survive when user CAN edit', (done) => {
                const editableStore = { getState: () => ({
                    layers: { flat: [
                        { name: 'geonode:aaa_1_alpha', perms: [] },
                        { name: 'geonode:ro_1_x', visibility: true }
                    ] },
                    anuga: { projects: { data: { my_role: 'editor' } } },
                    security: { user: { pk: 1 } },
                    gnresource: { initialResource: { perms: ['change_resourcebase'] } }
                }) };
                const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                    feature('aaa_1_alpha.7'),
                    feature('ro_1_x.3')
                ), layer: null }]);
                const out = [];
                clickDisambiguationEpic(action$, editableStore).subscribe(
                    (a) => out.push(a), done,
                    () => {
                        // 2 candidates (edit + readOnly) → panel shown
                        expect(out.map((a) => a.type)).toEqual([
                            PURGE_MAPINFO_RESULTS,
                            HIDE_MAPINFO_MARKER,
                            SHOW_CLICK_DISAMBIGUATION
                        ]);
                        expect(out[2].candidates.map((c) => c.kind).sort()).toEqual(['aaa_', 'ro_']);
                        expect(collectFunctionPaths(out)).toEqual([]);
                        done();
                    }
                );
            });

            it('epic: edit dropped (no perm) + readOnly survives → 1 candidate opens directly (W3.3)', (done) => {
                // Viewer can't edit aaa_, but ro_ is visible.
                const viewerStore2 = { getState: () => ({
                    layers: { flat: [
                        { name: 'geonode:aaa_1_alpha', perms: [] },
                        { name: 'geonode:ro_1_x', visibility: true }
                    ] },
                    anuga: { projects: { data: { my_role: 'viewer' } } },
                    security: { user: { pk: 1 } },
                    gnresource: { initialResource: { perms: [] } }
                }) };
                const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                    feature('aaa_1_alpha.7'),
                    feature('ro_1_x.3')
                ), layer: null }]);
                const out = [];
                clickDisambiguationEpic(action$, viewerStore2).subscribe(
                    (a) => out.push(a), done,
                    () => {
                        // edit dropped -> only ro_ survives -> 1 candidate -> direct open
                        expect(out.map((a) => a.type)).toEqual([
                            PURGE_MAPINFO_RESULTS,
                            HIDE_MAPINFO_MARKER,
                            HIDE_CLICK_DISAMBIGUATION,
                            'RO:VIEW'
                        ]);
                        expect(out[3].featureId).toBe('ro_1_x.3');
                        done();
                    }
                );
            });
        });
    });

    describe('W3 — raster candidate classification (C5, TASK-1997)', () => {

        const registerRasterTarget = () => {
            registerClickTarget('fri_raster_', {
                match: (featureId, layerName) => String(layerName).startsWith('fri_raster_'),
                label: (f) => {
                    const v = f && f.properties && typeof f.properties.GRAY_INDEX === 'number'
                        ? f.properties.GRAY_INDEX : null;
                    return {
                        title: 'Friction raster',
                        subtitle: v !== null ? `Mannings n = ${v}` : 'Value unavailable',
                        icon: 'check-circle'
                    };
                },
                buildOpenActions: (f) => [{ type: 'RASTER:READOUT', id: f.id }],
                readOnly: true
            });
        };

        beforeEach(() => { cleanClickTargets(); registerRasterTarget(); });
        afterEach(() => cleanClickTargets());

        it('buildCandidates includes a raster feature annotated with _anugaLayerName', () => {
            const rasterFeature = {
                type: 'Feature',
                id: '',
                properties: { GRAY_INDEX: 0.04 },
                _anugaLayerName: 'geonode:fri_raster_4_friction'
            };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [rasterFeature] });
            expect(candidates.length).toBe(1);
            expect(candidates[0].kind).toBe('fri_raster_');
            expect(candidates[0].layerName).toBe('fri_raster_4_friction');
            // Synthetic featureId encodes the band value
            expect(candidates[0].featureId).toContain('fri_raster_4_friction#raster');
            expect(candidates[0].label.subtitle).toBe('Mannings n = 0.04');
        });

        it('buildCandidates: raster feature without _anugaLayerName is still skipped', () => {
            const rasterFeature = { type: 'Feature', id: '', properties: { GRAY_INDEX: 0.04 } };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [rasterFeature] });
            expect(candidates.length).toBe(0);
        });

        it('buildCandidates: raster candidate featureId is structuredClone-safe (D6)', () => {
            const rasterFeature = {
                type: 'Feature', id: '',
                properties: { GRAY_INDEX: 0.04 },
                _anugaLayerName: 'fri_raster_4_friction'
            };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [rasterFeature] });
            expect(collectFunctionPaths(candidates)).toEqual([]);
            expect(() => structuredClone(candidates)).toNotThrow();
        });

        it('epic: raster feature is classified via _anugaLayerName annotation (C5)', (done) => {
            const rasterStore = { getState: () => ({
                layers: { flat: [{ name: 'geonode:fri_raster_4_friction', visibility: true }] },
                anuga: { projects: { data: { my_role: 'viewer' } } },
                security: { user: { pk: 1 } },
                gnresource: { initialResource: { perms: [] } }
            }) };
            const action$ = makeActions$([{
                type: LOAD_FEATURE_INFO,
                data: { type: 'FeatureCollection', features: [
                    { type: 'Feature', id: '', properties: { GRAY_INDEX: 0.04 } }
                ] },
                layer: { name: 'geonode:fri_raster_4_friction' }
            }]);
            const out = [];
            clickDisambiguationEpic(action$, rasterStore).subscribe(
                (a) => out.push(a), done,
                () => {
                    // 1 readOnly raster candidate -> direct opener
                    expect(out.map((a) => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS,
                        HIDE_MAPINFO_MARKER,
                        HIDE_CLICK_DISAMBIGUATION,
                        'RASTER:READOUT'
                    ]);
                    // featureId in opener is the synthetic id
                    expect(out[3].id).toContain('fri_raster_4_friction#raster');
                    expect(collectFunctionPaths(out)).toEqual([]);
                    done();
                }
            );
        });
    });

    describe('W3.3 — 0/1/>=2 branch UX across all kinds (TASK-1998)', () => {

        beforeEach(() => {
            cleanClickTargets();
            // Edit target
            registerClickTarget('aaa_', {
                match: (id, ln) => String(ln).startsWith('aaa_'),
                label: () => ({ title: 'Edit', subtitle: '', icon: 'pencil' }),
                buildOpenActions: (f) => [{ type: 'AAA:OPEN', featureId: f.id }]
            });
            // ReadOnly target
            registerClickTarget('ro_', {
                match: (id, ln) => !!id && String(ln).startsWith('ro_'),
                label: () => ({ title: 'ReadOnly', subtitle: '', icon: 'list' }),
                buildOpenActions: (f) => [{ type: 'RO:VIEW', featureId: f.id }],
                readOnly: true
            });
        });
        afterEach(() => cleanClickTargets());

        const editableState = {
            layers: { flat: [
                { name: 'geonode:aaa_1_alpha', perms: [], visibility: true },
                { name: 'geonode:ro_1_x', visibility: true }
            ] },
            anuga: { projects: { data: { my_role: 'editor' } } },
            security: { user: { pk: 1 } },
            gnresource: { initialResource: { perms: ['change_resourcebase'] } }
        };

        it('0 candidates (no registered layers hit) → fallthrough to default Identify (W3.3 AC2)', (done) => {
            const zeroStore = { getState: () => editableState };
            const action$ = makeActions$([{
                type: LOAD_FEATURE_INFO,
                data: fc(feature('zzz_9_other.1')),
                layer: null
            }]);
            const out = [];
            clickDisambiguationEpic(action$, zeroStore).subscribe(
                (a) => out.push(a), done,
                () => { expect(out.map((a) => a.type)).toEqual([HIDE_CLICK_DISAMBIGUATION]); done(); }
            );
        });

        it('1 readOnly candidate → opens directly, no list (W3.3 AC1)', (done) => {
            const oneReadOnlyStore = { getState: () => editableState };
            const action$ = makeActions$([{
                type: LOAD_FEATURE_INFO,
                data: fc(feature('ro_1_x.3')),
                layer: null
            }]);
            const out = [];
            clickDisambiguationEpic(action$, oneReadOnlyStore).subscribe(
                (a) => out.push(a), done,
                () => {
                    expect(out.map((a) => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS, HIDE_MAPINFO_MARKER, HIDE_CLICK_DISAMBIGUATION, 'RO:VIEW'
                    ]);
                    done();
                }
            );
        });

        it('1 edit candidate → opens directly, no list (W3.3 AC1)', (done) => {
            const oneEditStore = { getState: () => editableState };
            const action$ = makeActions$([{
                type: LOAD_FEATURE_INFO,
                data: fc(feature('aaa_1_alpha.7')),
                layer: null
            }]);
            const out = [];
            clickDisambiguationEpic(action$, oneEditStore).subscribe(
                (a) => out.push(a), done,
                () => {
                    expect(out.map((a) => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS, HIDE_MAPINFO_MARKER, HIDE_CLICK_DISAMBIGUATION, 'AAA:OPEN'
                    ]);
                    done();
                }
            );
        });

        it('>=2 candidates (1 edit + 1 readOnly) → shows list (W3.3 AC3)', (done) => {
            const twoStore = { getState: () => editableState };
            const action$ = makeActions$([{ type: LOAD_FEATURE_INFO, data: fc(
                feature('aaa_1_alpha.7'),
                feature('ro_1_x.3')
            ), layer: null }]);
            const out = [];
            clickDisambiguationEpic(action$, twoStore).subscribe(
                (a) => out.push(a), done,
                () => {
                    expect(out.map((a) => a.type)).toEqual([
                        PURGE_MAPINFO_RESULTS, HIDE_MAPINFO_MARKER, SHOW_CLICK_DISAMBIGUATION
                    ]);
                    // Both kinds in the panel
                    const kinds = out[2].candidates.map((c) => c.kind).sort();
                    expect(kinds).toEqual(['aaa_', 'ro_']);
                    done();
                }
            );
        });
    });
});

// =============================================================================
// W4 integration (TASK-2000) — bdy_ + inf_ overlap → panel → select boundary
//   → startVectorDraw EDIT (the full end-to-end path with REAL registrars).
//
// This test drives the EXACT production sequence:
//   1. Map click hits TWO overlapping layers (bdy_ + inf_): MapStore fires one
//      LOAD_FEATURE_INFO per layer — the W2 corrective-3 burst pattern.
//   2. clickDisambiguationEpic buffers the burst → buildClickActions → 2 edit
//      candidates → SHOW_CLICK_DISAMBIGUATION (panel shows).
//   3. User clicks the BOUNDARY row in the panel → resolveCandidateOpenActions
//      (ClickDisambiguationPanel.js:51-61) is called at click time (D6: no
//      function ever entered state; opener resolved from the module-side registry).
//   4. startVectorDraw is dispatched with the boundary layerName, featureId,
//      allowPick:false, and the bdy_ formConfig (seeding the EDIT branch).
// =============================================================================
describe('W4 integration — bdy_ + inf_ overlap → panel → select boundary → startVectorDraw EDIT (TASK-2000)', () => {

    // Both bdy_ and inf_ layers present + editor role: both candidates survive
    // filterEditableCandidates (my_role editor + change_resourcebase on map).
    const integStore = { getState: () => ({
        layers: { flat: [
            { name: 'geonode:bdy_1_boundary', perms: [] },
            { name: 'geonode:inf_1_inflow', perms: [] }
        ] },
        anuga: { projects: { data: { my_role: 'editor' } } },
        security: { user: { pk: 1 } },
        gnresource: { initialResource: { perms: ['change_resourcebase'] } }
    }) };

    beforeEach(() => {
        cleanClickTargets();
        registerAnugaClickTargets();
    });
    afterEach(() => cleanClickTargets());

    it('burst of bdy_+inf_ LOAD_FEATURE_INFO → SHOW panel with 2 candidates', (done) => {
        const action$ = makeActions$([
            { type: LOAD_FEATURE_INFO,
              data: fc(feature('bdy_1_boundary.3', { description: 'My Boundary' })),
              layer: { name: 'geonode:bdy_1_boundary' } },
            { type: LOAD_FEATURE_INFO,
              data: fc(feature('inf_1_inflow.7', { description: 'My Inflow' })),
              layer: { name: 'geonode:inf_1_inflow' } }
        ]);
        const out = [];
        clickDisambiguationEpic(action$, integStore).subscribe(
            (a) => out.push(a),
            done,
            () => {
                expect(out.map((a) => a.type)).toEqual([
                    PURGE_MAPINFO_RESULTS,
                    HIDE_MAPINFO_MARKER,
                    SHOW_CLICK_DISAMBIGUATION
                ]);
                const candidates = out[2].candidates;
                expect(candidates.map((c) => c.kind).sort()).toEqual(['bdy_', 'inf_']);
                // D6: no functions in the dispatched action
                expect(collectFunctionPaths(out)).toEqual([]);
                done();
            }
        );
    });

    it('selecting the boundary candidate resolves startVectorDraw EDIT with correct params', (done) => {
        const action$ = makeActions$([
            { type: LOAD_FEATURE_INFO,
              data: fc(feature('bdy_1_boundary.3', { description: 'My Boundary' })),
              layer: { name: 'geonode:bdy_1_boundary' } },
            { type: LOAD_FEATURE_INFO,
              data: fc(feature('inf_1_inflow.7', { description: 'My Inflow' })),
              layer: { name: 'geonode:inf_1_inflow' } }
        ]);
        const out = [];
        clickDisambiguationEpic(action$, integStore).subscribe(
            (a) => out.push(a),
            done,
            () => {
                // Extract the boundary candidate from the disambiguation panel action
                const showAction = out.find((a) => a.type === SHOW_CLICK_DISAMBIGUATION);
                expect(showAction).toExist();
                const bdyCandidate = showAction.candidates.find((c) => c.kind === 'bdy_');
                expect(bdyCandidate).toExist();
                expect(bdyCandidate.featureId).toBe('bdy_1_boundary.3');
                expect(bdyCandidate.layerName).toBe('bdy_1_boundary');

                // Simulate panel row-click: resolveCandidateOpenActions resolves the
                // opener at click time from the module-side registry (D6 — no function
                // was ever stored in the candidate or Redux state).
                const openActions = resolveCandidateOpenActions(bdyCandidate, integStore.getState);
                expect(openActions.length).toBe(1);
                const openAction = openActions[0];

                // Assert startVectorDraw EDIT parameters (the EDIT branch: featureId
                // set, allowPick:false, per-prefix formConfig seeding the popup).
                expect(openAction.type).toBe(START_VECTOR_DRAW);
                expect(openAction.config.layerName).toBe('geonode:bdy_1_boundary');
                expect(openAction.config.featureId).toBe('bdy_1_boundary.3');
                expect(openAction.config.allowPick).toBe(false);
                expect(openAction.config.formConfig).toBe(ANUGA_FEATURE_CONFIG['bdy_'].formConfig);
                expect(openAction.config.owner).toBe('anuga');

                // D6: the resolved open action must also be function-free
                expect(collectFunctionPaths([openAction])).toEqual([]);
                done();
            }
        );
    });
});

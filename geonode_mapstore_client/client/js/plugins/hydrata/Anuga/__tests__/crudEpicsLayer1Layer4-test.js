/*
 * TASK-2953 (epic 2815 W3, Layers 0/1/2) + TASK-2890 (Layer 4) — the
 * commit/lazy-create write path, the chained save->build->arm mechanism, and
 * the toast-wording fix.
 *
 * Amendment A2 (red-team, comment #2007's parent task): every PATCH mock
 * here replies WITHOUT an `id` — the PROVEN real backend contract for
 * ScenarioUpdateSerializerV2 — unlike the pre-existing TASK-937 describe
 * block's `.reply(200, { id: 42 })` idiom, which hid the exact byId[undefined]
 * bug amendment A1 found.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {
    saveAnugaScenarioEpic,
    commitAnugaScenarioFieldEpic,
    SCENARIO_PATCH_FIELDS,
    __resetInFlightScenarioCreatesForTests,
    // TASK-3012 (epic 2815 W5) — the PATCH-path queue's test reset, mirroring
    // __resetInFlightScenarioCreatesForTests.
    __resetInFlightScenarioCommitsForTests
} from '../epics/crudEpics';
import {
    SAVE_ANUGA_SCENARIO,
    COMMIT_ANUGA_SCENARIO_FIELD,
    COMMIT_ANUGA_SCENARIO_FIELD_SETTLED,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    SAVE_ANUGA_SCENARIO_ERROR,
    saveAnugaScenarioSuccess,
    saveAnugaScenarioError
} from '../actions/scenarioActions';
import scenariosReducer from '../reducers/scenariosReducer';
import {isScenarioCommitInFlight} from '../selectorsAnuga';
import {BUILD_SCENARIO} from '../actions/comparisonActions';

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

const storeWithProjectId = (id) => ({
    getState: () => ({ anuga: { projects: { data: { id } } } })
});

// Runs a redux-thunk action creator's dispatched actions through a fake
// dispatch that recurses into nested thunks, collecting every PLAIN action.
const collectDispatched = (thunkOrAction) => {
    const collected = [];
    const dispatch = (a) => {
        if (typeof a === 'function') {
            a(dispatch);
        } else {
            collected.push(a);
        }
    };
    dispatch(thunkOrAction);
    return collected;
};

describe('TASK-2953 saveAnugaScenarioEpic — mechanism 1/2 (chained build + Redux arm)', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); __resetInFlightScenarioCreatesForTests(); });
    afterEach(() => { mockAxios.restore(); });

    it('AC1 (RED-FIRST target) — a FRESH scenario (id null, _tempId set) Build-and-Run: exactly one build dispatch AND one armed run keyed on the CREATE RESPONSE id', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/').reply(201, {id: 555, name: 'fresh'});

        const freshScenario = {id: null, _tempId: 'new_1', name: 'fresh', terrain: 3};
        const action$ = mockActions([{
            type: SAVE_ANUGA_SCENARIO, scenario: freshScenario, buildAfterSave: true, runAfterBuild: true
        }]);
        const emitted = [];

        saveAnugaScenarioEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                const buildActions = emitted.filter(a => a && a.type === BUILD_SCENARIO);
                const armActions = emitted.filter(a => a && a.type === 'ARM_RUN_AFTER_BUILD');
                expect(buildActions.length).toBe(1);
                expect(buildActions[0].scenarioId).toBe(555);
                expect(armActions.length).toBe(1);
                expect(armActions[0].scenarioId).toBe(555);
                done();
            });
    });

    it('AC2 — an EXISTING scenario with unsaved edits: one Build click emits SAVE then BUILD_SCENARIO in that order, PATCH body unchanged from the allow-list', (done) => {
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/42/').reply(200, {name: 'edited', terrain: 9});

        const action$ = mockActions([{
            type: SAVE_ANUGA_SCENARIO,
            scenario: {id: 42, name: 'edited', terrain: 9, unsaved: true},
            buildAfterSave: true,
            runAfterBuild: false
        }]);
        const emitted = [];

        saveAnugaScenarioEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                const body = JSON.parse(mockAxios.history.patch[0].data);
                expect(Object.keys(body).sort()).toEqual(['name', 'terrain']);
                expect(SCENARIO_PATCH_FIELDS.indexOf('name') > -1).toBe(true);
                expect(SCENARIO_PATCH_FIELDS.indexOf('terrain') > -1).toBe(true);
                // Order: the save (thunk, index 0) resolves before BUILD_SCENARIO (index 1).
                expect(emitted.length).toBe(2);
                expect(typeof emitted[0]).toBe('function'); // saveAnugaScenarioSuccess thunk
                expect(emitted[1].type).toBe(BUILD_SCENARIO);
                expect(emitted[1].scenarioId).toBe(42);
                // No armed run — runAfterBuild was false (plain Build, not Build-and-Run).
                const armActions = emitted.filter(a => a && a.type === 'ARM_RUN_AFTER_BUILD');
                expect(armActions.length).toBe(0);
                done();
            });
    });

    it('a PATCH response with NO id (real contract) still resolves to a success thunk carrying the injected id', (done) => {
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/42/').reply(200, {name: 'x'});
        const action$ = mockActions([{
            type: SAVE_ANUGA_SCENARIO, scenario: {id: 42, name: 'x'}, buildAfterSave: false, runAfterBuild: false
        }]);
        const emitted = [];
        saveAnugaScenarioEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                const dispatched = collectDispatched(emitted[0]);
                const success = dispatched.find(a => a.type === 'SAVE_ANUGA_SCENARIO_SUCCESS');
                expect(success).toExist();
                expect(success.scenario.id).toBe(42);
                done();
            });
    });
});

describe('TASK-2953 AC3 — saveAnugaScenarioSuccess toast wording', () => {
    it('says "saved", never "building", for a plain save', () => {
        const dispatched = collectDispatched(saveAnugaScenarioSuccess({id: 1, name: 'S'}, {}));
        const toast = dispatched.find(a => a.type === 'SHOW_NOTIFICATION');
        expect(toast).toExist();
        expect(toast.message.toLowerCase()).toNotInclude('building');
    });
    it('suppresses the toast entirely when buildAfterSave is set (the chained build owns the notice)', () => {
        const dispatched = collectDispatched(saveAnugaScenarioSuccess({id: 1, name: 'S'}, {buildAfterSave: true}));
        const toast = dispatched.find(a => a.type === 'SHOW_NOTIFICATION');
        expect(toast).toBe(undefined);
        const success = dispatched.find(a => a.type === 'SAVE_ANUGA_SCENARIO_SUCCESS');
        expect(success).toExist();
    });
});

describe('TASK-2953 AC4 / TASK-2890 finding 2 — SAVE_ANUGA_SCENARIO_ERROR clears the arm', () => {
    it('dispatches CLEAR_RUN_AFTER_BUILD for the scenario whose save just failed', () => {
        const dispatched = collectDispatched(saveAnugaScenarioError({data: 'boom'}, {scenarioId: 42}));
        const clear = dispatched.find(a => a.type === 'CLEAR_RUN_AFTER_BUILD');
        expect(clear).toExist();
        expect(clear.scenarioId).toBe(42);
    });
    it('does not dispatch CLEAR_RUN_AFTER_BUILD when no scenarioId is known (a failed CREATE — nothing could have armed yet)', () => {
        const dispatched = collectDispatched(saveAnugaScenarioError({data: 'boom'}, {}));
        const clear = dispatched.find(a => a.type === 'CLEAR_RUN_AFTER_BUILD');
        expect(clear).toBe(undefined);
    });
});

describe('TASK-2953 Layer 1 (H4) — commitAnugaScenarioFieldEpic lazy create + in-flight guard', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); __resetInFlightScenarioCreatesForTests(); });
    afterEach(() => { mockAxios.restore(); });

    it('the FIRST commit on an id-less scenario POSTs a create (lazy create), never before', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/').reply(201, {id: 900, name: 'S', terrain: 3});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD,
            scenario: {id: null, _tempId: 'new_2', name: 'S', terrain: 3}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                const posted = JSON.parse(mockAxios.history.post[0].data);
                expect(posted.terrain).toBe(3);
                expect(emitted.length).toBe(1);
                done();
            });
    });

    it('a second commit for the SAME tempId while the create is still in flight does NOT fire a second create — it PATCHes once the create resolves', (done) => {
        // Delay the create response so the second commit's dispatch genuinely
        // lands while the first is still in flight (a REAL race, not a timing
        // fluke — axios-mock-adapter's delay makes this deterministic).
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/')
            .reply(() => new Promise((resolve) => setTimeout(() => resolve([201, {id: 901, name: 'S1'}]), 40)));
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/901/').reply(200, {terrain: 5});

        const tempId = 'new_3';
        const action$ = mockActions([
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: null, _tempId: tempId, name: 'S1'}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: null, _tempId: tempId, name: 'S1', terrain: 5}}
        ]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                expect(mockAxios.history.patch.length).toBe(1);
                const patchBody = JSON.parse(mockAxios.history.patch[0].data);
                expect(patchBody.terrain).toBe(5);
                expect(emitted.length).toBe(2);
                done();
            });
    });

    it('a commit on a scenario that already has an id PATCHes directly (no create)', (done) => {
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/77/').reply(200, {terrain: 4});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 77, terrain: 4}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(0);
                expect(mockAxios.history.patch.length).toBe(1);
                done();
            });
    });
});

// Review fixes (adversarial pass, TASK-2953/2890) — two independent-lens
// findings against the shipped commit (hydrata 1120c87, gmc f3e39c1a1).
describe('Review fix (data-loss/blocker finding 1) — a CREATE response must not clobber a field a SECOND, still-racing local commit already set', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); __resetInFlightScenarioCreatesForTests(); });
    afterEach(() => { mockAxios.restore(); });

    it('RED-FIRST target: boundary, committed locally AFTER the terrain commit posted the lazy create, survives the create response merge', (done) => {
        // (a) terrain commit -> lazy CREATE fires with a {terrain:5} snapshot;
        // the create response below deliberately echoes boundary:null (the
        // server's view at THAT moment) — matching the real
        // createScenarioV2 contract (echoes the full row as it stood when
        // the create was processed).
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/')
            .reply(201, {id: 501, name: 'S', terrain: 5, boundary: null});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD,
            scenario: {id: null, _tempId: 'new_9', name: 'S', terrain: 5}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                const dispatched = collectDispatched(emitted[0]);
                const success = dispatched.find(a => a.type === SAVE_ANUGA_SCENARIO_SUCCESS);
                expect(success).toExist();

                // (b) BEFORE the create resolved, a SECOND commit (boundary)
                // landed locally (the optimistic UPDATE_ANUGA_SCENARIO write)
                // -- local state now shows boundary: 9.
                const localStateAfterSecondCommit = {
                    byId: {new_9: {id: null, _tempId: 'new_9', name: 'S', terrain: 5, boundary: 9, selected: false}},
                    allIds: ['new_9'],
                    selectedId: null,
                    archiveFilter: 'none',
                    runAfterBuild: {}
                };
                // (c) the CREATE's own success (captured above, exactly as
                // the epic actually dispatches it) now lands.
                const merged = scenariosReducer(localStateAfterSecondCommit, success);
                expect(merged.byId[501]).toExist();
                expect(merged.byId[501].boundary).toBe(9);
                done();
            });
    });
});

describe('Review fix (data-loss/major finding 3) — an UNRELATED field-commit failure must not clear an already-armed run', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); __resetInFlightScenarioCreatesForTests(); });
    afterEach(() => { mockAxios.restore(); });

    it('RED-FIRST target: a failed PATCH from an unrelated field commit on a scenario with an ALREADY-ARMED run does not clear it', (done) => {
        // Scenario 88 already has an armed Build-and-Run in flight (set by
        // an EARLIER, unrelated click) -- this test only proves
        // commitAnugaScenarioFieldEpic's OWN failure handling never touches
        // it; the arm itself lives in Redux, not exercised here directly.
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/88/').reply(400, {detail: 'boom'});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 88, terrain: 9}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                const dispatched = collectDispatched(emitted[0]);
                const clear = dispatched.find(a => a.type === 'CLEAR_RUN_AFTER_BUILD');
                expect(clear).toBe(undefined);
                done();
            });
    });
});

// TASK-2972 (epic 2815 W3 restart, W3.6) — quiet per-field auto-save. Since
// TASK-2953 every discrete-field commit in the scenario pane (the terrain/
// boundary/inflow/rainfall/friction/structure/mesh_region selects, the
// resolution/duration steppers, the debounced name) PATCHes through
// commitAnugaScenarioFieldEpic, and EVERY success toasted "'<name>' saved" —
// ~10 identical top-centre notices while one scenario is configured. The
// toast is owed ONCE, on the lazy CREATE (the draft now exists on the
// server); both PATCH branches pass meta.quiet. saveAnugaScenarioError is
// deliberately untouched and stays loud (a failed auto-save must surface).
describe('quiet auto-save toast', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); __resetInFlightScenarioCreatesForTests(); });
    afterEach(() => { mockAxios.restore(); });

    const toastsIn = (dispatched) => dispatched.filter(a => a.type === 'SHOW_NOTIFICATION');
    // The epic's completion lands inside a promise chain, so a throwing
    // expect() there would surface only as a 2 s mocha timeout; route it to
    // done(err) so a failure names the assertion.
    const onComplete = (done, assertions) => () => {
        try {
            assertions();
            done();
        } catch (e) {
            done(e);
        }
    };

    it('AC1 (unit) — saveAnugaScenarioSuccess with meta.quiet dispatches SAVE_ANUGA_SCENARIO_SUCCESS and NO SHOW_NOTIFICATION', () => {
        const dispatched = collectDispatched(saveAnugaScenarioSuccess({id: 1, name: 'S'}, {quiet: true}));
        expect(toastsIn(dispatched).length).toBe(0);
        const success = dispatched.find(a => a.type === SAVE_ANUGA_SCENARIO_SUCCESS);
        expect(success).toExist();
        expect(success.scenario.id).toBe(1);
    });

    it('AC2 (RED-on-HEAD target) — a commit on a scenario WITH an id: one PATCH, and its success thunk dispatches no SHOW_NOTIFICATION', (done) => {
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/77/').reply(200, {terrain: 4});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 77, name: 'S', terrain: 4}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                expect(mockAxios.history.post.length).toBe(0);
                expect(mockAxios.history.patch.length).toBe(1);
                expect(emitted.length).toBe(1);
                const dispatched = collectDispatched(emitted[0]);
                expect(toastsIn(dispatched).length).toBe(0);
                // Quiet, not silent: the reducer's no-clobber merge input still lands.
                const success = dispatched.find(a => a.type === SAVE_ANUGA_SCENARIO_SUCCESS);
                expect(success).toExist();
                expect(success.scenario.id).toBe(77);
                expect(success.sentPayload.terrain).toBe(4);
            }));
    });

    it('AC2 (H4) — a second commit for the SAME tempId while the create is in flight: exactly ONE toast overall (the create\'s), none from the follow-up PATCH', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/')
            .reply(() => new Promise((resolve) => setTimeout(() => resolve([201, {id: 902, name: 'S2'}]), 40)));
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/902/').reply(200, {terrain: 6});

        const tempId = 'new_4';
        const action$ = mockActions([
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: null, _tempId: tempId, name: 'S2'}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: null, _tempId: tempId, name: 'S2', terrain: 6}}
        ]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                expect(mockAxios.history.patch.length).toBe(1);
                expect(emitted.length).toBe(2);
                // Order-independent: attribute each success thunk by what it
                // carried on the wire (the PATCH's sentPayload has terrain 6,
                // the create's snapshot does not).
                const perThunk = emitted.map(collectDispatched);
                const patchThunk = perThunk.find(d => d.some(a =>
                    a.type === SAVE_ANUGA_SCENARIO_SUCCESS && a.sentPayload && a.sentPayload.terrain === 6));
                const createThunk = perThunk.find(d => d !== patchThunk);
                expect(patchThunk).toExist();
                expect(createThunk).toExist();
                expect(toastsIn(patchThunk).length).toBe(0);
                expect(toastsIn(createThunk).length).toBe(1);
                expect(toastsIn(createThunk)[0].message).toInclude('saved');
                const allToasts = perThunk.reduce((acc, d) => acc.concat(toastsIn(d)), []);
                expect(allToasts.length).toBe(1);
            }));
    });

    it('AC3 (regression PIN — already true at HEAD) — the FIRST commit on an id-less scenario (lazy create) still dispatches exactly one SHOW_NOTIFICATION whose message includes "saved"', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/').reply(201, {id: 903, name: 'Trial 01', terrain: 3});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD,
            scenario: {id: null, _tempId: 'new_5', name: 'Trial 01', terrain: 3}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                expect(emitted.length).toBe(1);
                const toasts = toastsIn(collectDispatched(emitted[0]));
                expect(toasts.length).toBe(1);
                expect(toasts[0].level).toBe('success');
                expect(toasts[0].message).toInclude('saved');
                expect(toasts[0].message).toInclude('Trial 01');
            }));
    });

    it('errors stay LOUD (pin) — a failed per-field PATCH commit still surfaces a SHOW_NOTIFICATION at level error', (done) => {
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/78/').reply(400, {detail: 'nope'});
        const action$ = mockActions([{
            type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 78, terrain: 9}
        }]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                expect(emitted.length).toBe(1);
                const toasts = toastsIn(collectDispatched(emitted[0]));
                expect(toasts.length).toBe(1);
                expect(toasts[0].level).toBe('error');
            }));
    });
});

// TASK-3012 (epic 2815 W5) — per-scenario commit SERIALISATION. Found on
// live production 2026-09-08: four required selects set ~2.5 s apart left
// the server holding rainfall:null while the UI select read 1505. The
// client store is NOT the victim (TASK-2953's no-clobber merge already
// keeps whichever field moved on locally, and is pinned green by
// scenariosReducerLayer2-test.js:57) — the SERVER is: two overlapping
// PATCHes each carry a full 12-key snapshot taken when their action was
// created, so whichever lands LAST writes its older snapshot over the
// newer one. These specs therefore assert on the WIRE, never on redux.
describe('TASK-3012 — overlapping field commits for one scenario are serialised on the wire', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __resetInFlightScenarioCreatesForTests();
        __resetInFlightScenarioCommitsForTests();
    });
    afterEach(() => { mockAxios.restore(); });

    const onComplete = (done, assertions) => () => {
        try {
            assertions();
            done();
        } catch (e) {
            done(e);
        }
    };

    it('AC2 (RED-on-HEAD target) — while the FIRST PATCH is outstanding, the second commit for the SAME scenario has not been sent', (done) => {
        // The reading MUST be taken inside the deferred reply's macrotask,
        // NOT on its synchronous entry. axios dispatches through a .then
        // microtask and axios-mock-adapter pushes to `history` inside its
        // own async handleRequest, so on the first reply fn's SYNCHRONOUS
        // entry history.patch.length reads 1 even at HEAD — the obvious
        // assertion point is vacuous. One macrotask later HEAD reads 2
        // (mergeMap issued both immediately) and a serialised epic reads 1.
        const seenWhileFirstOutstanding = [];
        let nth = 0;
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/419/').reply(() => {
            const mine = ++nth;
            return new Promise((resolve) => setTimeout(() => {
                if (mine === 1) seenWhileFirstOutstanding.push(mockAxios.history.patch.length);
                resolve([200, {}]);
            }, 40));
        });

        // The live prod repro: scenario 419, terrain=586 committed, then
        // rainfall=1505 committed before the first PATCH came back.
        const action$ = mockActions([
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 419, name: 'W5', terrain: 586, rainfall: null}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 419, name: 'W5', terrain: 586, rainfall: 1505}}
        ]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                expect(seenWhileFirstOutstanding.length).toBe(1);
                expect(seenWhileFirstOutstanding[0]).toBe(1);
                // ...and the queued one IS sent once the first settles,
                // carrying the NEWER snapshot (never dropped).
                expect(mockAxios.history.patch.length).toBe(2);
                const second = JSON.parse(mockAxios.history.patch[1].data);
                expect(second.terrain).toBe(586);
                expect(second.rainfall).toBe(1505);
                expect(emitted.length).toBe(2);
            }));
    });

    it('AC6 — three back-to-back commits on one scenario: three PATCHes, strictly one at a time, in dispatch order', (done) => {
        const observed = [];
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/55/')
            .reply(() => new Promise((resolve) => setTimeout(() => {
                observed.push(mockAxios.history.patch.length);
                resolve([200, {}]);
            }, 20)));
        const action$ = mockActions([
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 55, terrain: 1}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 55, terrain: 1, boundary: 2}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 55, terrain: 1, boundary: 2, inflow: 3}}
        ]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                // Staged, so this cannot pass vacuously: as the Nth reply
                // settles exactly N PATCHes have reached the wire.
                expect(observed.length).toBe(3);
                expect(observed[0]).toBe(1);
                expect(observed[1]).toBe(2);
                expect(observed[2]).toBe(3);
                expect(mockAxios.history.patch.length).toBe(3);
                const bodies = mockAxios.history.patch.map(p => JSON.parse(p.data));
                expect(bodies[0].terrain).toBe(1);
                expect(bodies[0].boundary).toBe(undefined);
                expect(bodies[1].boundary).toBe(2);
                expect(bodies[1].inflow).toBe(undefined);
                // Nothing dropped: the last body on the wire carries all three.
                expect(bodies[2].terrain).toBe(1);
                expect(bodies[2].boundary).toBe(2);
                expect(bodies[2].inflow).toBe(3);
                expect(emitted.length).toBe(3);
            }));
    });

    it('AC6 (regression PIN — true at HEAD, must stay true) — commits on DIFFERENT scenarios still overlap freely', (done) => {
        const inFlightWhen61Settles = [];
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/61/').reply(() => new Promise((resolve) => setTimeout(() => {
            inFlightWhen61Settles.push(mockAxios.history.patch.length);
            resolve([200, {}]);
        }, 40)));
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/62/')
            .reply(() => new Promise((resolve) => setTimeout(() => resolve([200, {}]), 40)));

        const action$ = mockActions([
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 61, terrain: 1}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 62, terrain: 2}}
        ]);
        const emitted = [];
        commitAnugaScenarioFieldEpic(action$, storeWithProjectId(7))
            .subscribe(a => emitted.push(a), done, onComplete(done, () => {
                // Both were on the wire together — the queue is per-id, not global.
                expect(inFlightWhen61Settles.length).toBe(1);
                expect(inFlightWhen61Settles[0]).toBe(2);
                expect(emitted.length).toBe(2);
            }));
    });
});

// TASK-3012 AC5 (epic 2815 W5) — the STORE-VISIBLE half. TASK-2826's
// dispatchBuild is a connected component: it cannot read crudEpics.js's
// module-level _inFlightScenarioCommits map, so the same fact has to exist in
// redux. The specs below drive COMMIT_ANUGA_SCENARIO_FIELD *alone* — never
// the UPDATE_ANUGA_SCENARIO that commitAnugaScenarioField pairs with it — so
// a selector re-badged onto the existing `unsaved` flag (which TASK-2826
// exists to retire, and which UPDATE_ANUGA_SCENARIO is what sets) cannot pass.
describe('TASK-3012 AC5 — isScenarioCommitInFlight, the redux signal TASK-2826 reads', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
    let mockAxios;
    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __resetInFlightScenarioCreatesForTests();
        __resetInFlightScenarioCommitsForTests();
    });
    afterEach(() => { mockAxios.restore(); });

    const onComplete = (done, assertions) => () => {
        try {
            assertions();
            done();
        } catch (e) {
            done(e);
        }
    };
    const stateOf = (scenarios) => ({anuga: {scenarios}});
    const seededWith = (byId) => ({
        ...scenariosReducer(undefined, {type: '@@INIT'}),
        byId,
        allIds: Object.keys(byId)
    });

    it('AC5 — false before the commit, TRUE while the PATCH is on the wire, false once it settles', (done) => {
        // A mini store: every action the epic emits is reduced into `state`,
        // so the "during" reading is taken against real reducer output while
        // the request is genuinely outstanding, not against a hand-built object.
        let state = seededWith({77: {id: 77, name: 'S', terrain: null, unsaved: false}});
        const duringReadings = [];

        expect(isScenarioCommitInFlight(stateOf(state), 77)).toBe(false);

        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/77/').reply(() => new Promise((resolve) => {
            setTimeout(() => {
                duringReadings.push(isScenarioCommitInFlight(stateOf(state), 77));
                resolve([200, {terrain: 4}]);
            }, 30);
        }));

        const commit = {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 77, name: 'S', terrain: 4}};
        state = scenariosReducer(state, commit);
        expect(isScenarioCommitInFlight(stateOf(state), 77)).toBe(true);
        // Proves it is a NEW signal, not `unsaved` under another name: only
        // COMMIT_ANUGA_SCENARIO_FIELD was dispatched, so `unsaved` never moved.
        expect(state.byId[77].unsaved).toBe(false);

        const settledSeen = [];
        commitAnugaScenarioFieldEpic(mockActions([commit]), storeWithProjectId(7))
            .subscribe((emittedAction) => {
                collectDispatched(emittedAction).forEach((a) => {
                    if (a.type === COMMIT_ANUGA_SCENARIO_FIELD_SETTLED) settledSeen.push(a);
                    state = scenariosReducer(state, a);
                });
            }, done, onComplete(done, () => {
                expect(duringReadings.length).toBe(1);
                expect(duringReadings[0]).toBe(true);
                expect(settledSeen.length).toBe(1);
                expect(settledSeen[0].scenarioId).toBe(77);
                expect(isScenarioCommitInFlight(stateOf(state), 77)).toBe(false);
                // Cleared by deletion, not by a lingering zero.
                expect(state.commitsInFlight[77]).toBe(undefined);
            }));
    });

    it('AC5 — a FAILED commit clears the flag too (a 400 must never strand it on)', (done) => {
        // Without a settled action of its own this is unfixable: the plain
        // SAVE_ANUGA_SCENARIO_ERROR carries NO scenario id (deliberately —
        // review fix TASK-2953/2890 finding 3), so a slice keyed on scenario
        // id could never clear itself from a failure and TASK-2826's
        // dispatchBuild would detour that scenario forever.
        let state = seededWith({78: {id: 78, name: 'S', unsaved: false}});
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/78/').reply(400, {detail: 'nope'});

        const commit = {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 78, terrain: 9}};
        state = scenariosReducer(state, commit);
        expect(isScenarioCommitInFlight(stateOf(state), 78)).toBe(true);

        const dispatchedAll = [];
        commitAnugaScenarioFieldEpic(mockActions([commit]), storeWithProjectId(7))
            .subscribe((emittedAction) => {
                collectDispatched(emittedAction).forEach((a) => {
                    dispatchedAll.push(a);
                    state = scenariosReducer(state, a);
                });
            }, done, onComplete(done, () => {
                const settled = dispatchedAll.filter(a => a.type === COMMIT_ANUGA_SCENARIO_FIELD_SETTLED);
                expect(settled.length).toBe(1);
                expect(settled[0].scenarioId).toBe(78);
                expect(isScenarioCommitInFlight(stateOf(state), 78)).toBe(false);
                // PIN — the finding-3 fix is NOT reverted: the error action
                // still carries no scenarioId (which is why the settled
                // action had to exist at all).
                const err = dispatchedAll.find(a => a.type === SAVE_ANUGA_SCENARIO_ERROR);
                expect(err).toExist();
                expect(err.scenarioId).toBe(undefined);
            }));
    });

    it('AC5 — a still-uncreated draft is answerable under its _tempId, and the lazy CREATE clears it', (done) => {
        // TASK-2826 asks with `scenario.id || scenario._tempId`; a draft the
        // user is still filling in has only the tempId, and its first commit
        // is a POST, not a PATCH — that branch must emit the settled action too.
        let state = seededWith({new_12: {id: null, _tempId: 'new_12', name: 'D', unsaved: false}});
        mockAxios.onPost('/api/v2/anuga/projects/7/scenarios/')
            .reply(() => new Promise((resolve) => setTimeout(() => resolve([201, {id: 950, name: 'D'}]), 20)));

        const commit = {
            type: COMMIT_ANUGA_SCENARIO_FIELD,
            scenario: {id: null, _tempId: 'new_12', name: 'D', terrain: 3}
        };
        state = scenariosReducer(state, commit);
        expect(isScenarioCommitInFlight(stateOf(state), 'new_12')).toBe(true);

        const settledSeen = [];
        commitAnugaScenarioFieldEpic(mockActions([commit]), storeWithProjectId(7))
            .subscribe((emittedAction) => {
                collectDispatched(emittedAction).forEach((a) => {
                    if (a.type === COMMIT_ANUGA_SCENARIO_FIELD_SETTLED) settledSeen.push(a);
                    state = scenariosReducer(state, a);
                });
            }, done, onComplete(done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                expect(settledSeen.length).toBe(1);
                expect(settledSeen[0].scenarioId).toBe('new_12');
                expect(isScenarioCommitInFlight(stateOf(state), 'new_12')).toBe(false);
            }));
    });

    it('AC5 — the count survives overlapping commits: still TRUE after the FIRST of three settles', (done) => {
        // A boolean flag would read false here while two PATCHes were still
        // queued behind the first, telling TASK-2826's dispatchBuild the
        // scenario was safe to build mid-write.
        let state = seededWith({56: {id: 56, name: 'S', unsaved: false}});
        const afterEachSettle = [];
        mockAxios.onPatch('/api/v2/anuga/projects/7/scenarios/56/')
            .reply(() => new Promise((resolve) => setTimeout(() => resolve([200, {}]), 15)));

        const commits = [
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 56, terrain: 1}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 56, terrain: 1, boundary: 2}},
            {type: COMMIT_ANUGA_SCENARIO_FIELD, scenario: {id: 56, terrain: 1, boundary: 2, inflow: 3}}
        ];
        commits.forEach((c) => { state = scenariosReducer(state, c); });
        expect(state.commitsInFlight[56]).toBe(3);

        commitAnugaScenarioFieldEpic(mockActions(commits), storeWithProjectId(7))
            .subscribe((emittedAction) => {
                collectDispatched(emittedAction).forEach((a) => { state = scenariosReducer(state, a); });
                afterEachSettle.push(isScenarioCommitInFlight(stateOf(state), 56));
            }, done, onComplete(done, () => {
                expect(afterEachSettle.length).toBe(3);
                expect(afterEachSettle[0]).toBe(true);
                expect(afterEachSettle[1]).toBe(true);
                expect(afterEachSettle[2]).toBe(false);
                expect(state.commitsInFlight[56]).toBe(undefined);
            }));
    });
});

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
    __resetInFlightScenarioCreatesForTests
} from '../epics/crudEpics';
import {
    SAVE_ANUGA_SCENARIO,
    COMMIT_ANUGA_SCENARIO_FIELD,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    saveAnugaScenarioSuccess,
    saveAnugaScenarioError
} from '../actions/scenarioActions';
import scenariosReducer from '../reducers/scenariosReducer';
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

/*
 * TASK-2953 (epic 2815 W3, Layers 1/2) + TASK-2890 (Layer 4) — scenariosReducer
 * additions: the ADD_ANUGA_SCENARIO default-name seed, the SAVE_ANUGA_SCENARIO_SUCCESS
 * no-clobber merge (amendment A1/A2, Layer 2), and the runAfterBuild arm/advance/clear
 * slice (Layer 4).
 */
import expect from 'expect';
import scenariosReducer from '../scenariosReducer';
import {
    ADD_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    ARM_RUN_AFTER_BUILD,
    ADVANCE_RUN_AFTER_BUILD,
    CLEAR_RUN_AFTER_BUILD
} from '../../actions/scenarioActions';

describe('TASK-2953 Layer 1 — ADD_ANUGA_SCENARIO seeds a non-blank default name', () => {
    it('stamps the new temp scenario with a non-blank name (Scenario.name is required non-blank server-side)', () => {
        const state = scenariosReducer(undefined, {type: ADD_ANUGA_SCENARIO});
        const tempId = state.allIds[0];
        expect(state.byId[tempId].name).toExist();
        expect(state.byId[tempId].name.length > 0).toBe(true);
    });
});

describe('TASK-2953 Layer 2 (amendment A1) — SAVE_ANUGA_SCENARIO_SUCCESS no-clobber merge', () => {
    const baseState = () => ({
        byId: {
            42: {
                id: 42, _tempId: undefined, name: 'Old name', description: 'd',
                terrain: 7, unsaved: true, selected: true,
                latest_run_is_valid: null
            }
        },
        allIds: [42],
        selectedId: 42,
        archiveFilter: 'none',
        runAfterBuild: {}
    });

    it('a PATCH response with NO id (the real backend contract) still lands on the correct existing entry, not byId[undefined]', () => {
        // PROVEN live: ScenarioUpdateSerializerV2's response carries ONLY its
        // writable fields — no id. crudEpics.js must inject the real id
        // before dispatching; this reducer test locks that contract in.
        const state = scenariosReducer(baseState(), {
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario: {id: 42, name: 'Old name', description: 'd', terrain: 7, computed_status: 'created'},
            sentPayload: {name: 'Old name', description: 'd', terrain: 7},
            tempId: null
        });
        expect(state.byId[undefined]).toBe(undefined);
        expect(state.byId[42]).toExist();
        expect(state.byId[42].unsaved).toBe(false);
        expect(state.byId[42].computed_status).toBe('created');
    });

    it('keeps a field that changed LOCALLY after the PATCH was sent (does not clobber a superseding edit)', () => {
        // Local state already moved on (name edited again) since the PATCH
        // for 'Old name' went out — the server's 'Old name' must NOT win.
        let state = baseState();
        state = {
            ...state,
            byId: {...state.byId, 42: {...state.byId[42], name: 'Newer name typed after the PATCH'}}
        };
        state = scenariosReducer(state, {
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario: {id: 42, name: 'Old name', description: 'd', terrain: 7},
            sentPayload: {name: 'Old name', description: 'd', terrain: 7},
            tempId: null
        });
        expect(state.byId[42].name).toBe('Newer name typed after the PATCH');
        // A field that did NOT move on locally still accepts the server value.
        expect(state.byId[42].terrain).toBe(7);
    });

    it('a CREATE response (tempId set, no sentPayload) replaces the temp entry with the real id', () => {
        const state = scenariosReducer({
            byId: {new_1: {id: null, _tempId: 'new_1', name: 'New scenario', selected: true}},
            allIds: ['new_1'],
            selectedId: 'new_1',
            archiveFilter: 'none',
            runAfterBuild: {}
        }, {
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario: {id: 99, name: 'New scenario', computed_status: 'created'},
            sentPayload: null,
            tempId: 'new_1'
        });
        expect(state.byId.new_1).toBe(undefined);
        expect(state.byId[99]).toExist();
        expect(state.byId[99].unsaved).toBe(false);
        expect(state.allIds.indexOf(99) > -1).toBe(true);
        expect(state.allIds.indexOf('new_1')).toBe(-1);
    });
});

describe('TASK-2890 Layer 4 — runAfterBuild arm/advance/clear', () => {
    it('ARM_RUN_AFTER_BUILD sets awaiting-inflight for the scenario id', () => {
        const state = scenariosReducer(undefined, {type: ARM_RUN_AFTER_BUILD, scenarioId: 7});
        expect(state.runAfterBuild[7]).toBe('awaiting-inflight');
    });
    it('ADVANCE_RUN_AFTER_BUILD moves awaiting-inflight -> awaiting-built, and no-ops otherwise', () => {
        let state = scenariosReducer(undefined, {type: ARM_RUN_AFTER_BUILD, scenarioId: 7});
        state = scenariosReducer(state, {type: ADVANCE_RUN_AFTER_BUILD, scenarioId: 7});
        expect(state.runAfterBuild[7]).toBe('awaiting-built');
        // No-op: not armed at all.
        const before = state;
        state = scenariosReducer(state, {type: ADVANCE_RUN_AFTER_BUILD, scenarioId: 999});
        expect(state).toBe(before);
    });
    it('CLEAR_RUN_AFTER_BUILD removes the key', () => {
        let state = scenariosReducer(undefined, {type: ARM_RUN_AFTER_BUILD, scenarioId: 7});
        state = scenariosReducer(state, {type: CLEAR_RUN_AFTER_BUILD, scenarioId: 7});
        expect(Object.prototype.hasOwnProperty.call(state.runAfterBuild, 7)).toBe(false);
    });
});

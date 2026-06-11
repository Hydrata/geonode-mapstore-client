import expect from 'expect';
import reducer from '../reducersAnuga';
import {
    INIT_ANUGA,
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_PUBLICATION_PANEL,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_INIT_IN_FLIGHT,
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_TERRAIN_DATA,
    SET_CREATING_ANUGA_LAYER,
    ADD_ANUGA_SCENARIO,
    SELECT_ANUGA_SCENARIO,
    TOGGLE_SCENARIO_SELECTED,
    UPDATE_ANUGA_SCENARIO,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    setNetworkMenu,
    setPublicationPanel,
    setAnugaProjectData,
    setAnugaInflowData,
    setCreatingAnugaLayer,
    selectAnugaScenario,
    toggleScenarioSelected,
    initAnuga,
    retryAnugaRun,
    cancelAnugaRun,
    RETRY_ANUGA_RUN,
    CANCEL_ANUGA_RUN,
    SET_ANUGA_POLLING_DATA,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    DUPLICATE_ANUGA_SCENARIO,
    DUPLICATE_ANUGA_SCENARIO_SUCCESS,
    duplicateAnugaScenario,
    ARCHIVE_ANUGA_SCENARIO,
    ARCHIVE_ANUGA_SCENARIO_SUCCESS,
    UNARCHIVE_ANUGA_SCENARIO,
    UNARCHIVE_ANUGA_SCENARIO_SUCCESS,
    SET_ANUGA_SCENARIO_ARCHIVE_FILTER,
    archiveAnugaScenario,
    // Wave 3C C5: archiveAnugaScenarioError (and ARCHIVE_ANUGA_SCENARIO_ERROR)
    // replaced with showArchiveError — toast-only thunk, no Redux action.
    showArchiveError,
    unarchiveAnugaScenario,
    setAnugaScenarioArchiveFilter
} from '../actionsAnuga';
import {
    START_ACTIVE_RUN_POLLING,
    STOP_ACTIVE_RUN_POLLING,
    UPDATE_RUN_STATUS,
    startActiveRunPolling,
    stopActiveRunPolling,
    updateRunStatus
} from '../actions/pollingActions';

describe('Anuga Plugin', () => {
    describe('Action Creators', () => {
        it('initAnuga creates correct action', () => {
            const action = initAnuga();
            expect(action.type).toBe(INIT_ANUGA);
        });

        it('setAnugaInputMenu creates correct action', () => {
            const action = setAnugaInputMenu(true);
            expect(action.type).toBe(SET_ANUGA_INPUT_MENU);
            expect(action.visible).toBe(true);
        });

        it('setAnugaScenarioMenu creates correct action', () => {
            const action = setAnugaScenarioMenu(true);
            expect(action.type).toBe(SET_ANUGA_SCENARIO_MENU);
            expect(action.visible).toBe(true);
        });

        it('setAnugaResultMenu creates correct action', () => {
            const action = setAnugaResultMenu(false);
            expect(action.type).toBe(SET_ANUGA_RESULT_MENU);
            expect(action.visible).toBe(false);
        });

        it('setNetworkMenu creates correct action', () => {
            const action = setNetworkMenu(true);
            expect(action.type).toBe(SET_NETWORK_MENU);
            expect(action.visible).toBe(true);
        });

        it('setPublicationPanel creates correct action', () => {
            const action = setPublicationPanel(true);
            expect(action.type).toBe(SET_PUBLICATION_PANEL);
            expect(action.visible).toBe(true);
        });

        it('setAnugaProjectData creates correct action', () => {
            const data = { id: 1, name: 'Test Project' };
            const action = setAnugaProjectData(data);
            expect(action.type).toBe(SET_ANUGA_PROJECT_DATA);
            expect(action.data).toEqual(data);
        });

        it('setAnugaInflowData creates correct action', () => {
            const data = [{ id: 1, name: 'Inflow 1' }];
            const action = setAnugaInflowData(data);
            expect(action.type).toBe(SET_ANUGA_INFLOW_DATA);
            expect(action.data).toEqual(data);
        });

        it('setCreatingAnugaLayer creates correct action', () => {
            const action = setCreatingAnugaLayer(true);
            expect(action.type).toBe(SET_CREATING_ANUGA_LAYER);
            expect(action.isCreatingAnugaLayer).toBe(true);
        });

        // TASK-955 (W2.2 FE) — createAnugaRainfall is a thin {type, rainfallTitle}
        // action consumed by createAnugaRainfallEpic (makeCreateEpic on
        // CREATE_ANUGA_RAINFALL with 'rainfall' resourceType, 'rainfallTitle' key).
        it('createAnugaRainfall creates correct action', () => {
            const {CREATE_ANUGA_RAINFALL, createAnugaRainfall} = require('../actionsAnuga');
            const action = createAnugaRainfall('Rainfall 02');
            expect(action.type).toBe(CREATE_ANUGA_RAINFALL);
            expect(action.rainfallTitle).toBe('Rainfall 02');
        });
        it('addAnugaRainfall emits ADD_ANUGA_RAINFALL', () => {
            const {ADD_ANUGA_RAINFALL, addAnugaRainfall} = require('../actionsAnuga');
            const action = addAnugaRainfall();
            expect(action.type).toBe(ADD_ANUGA_RAINFALL);
        });

        it('selectAnugaScenario creates correct action', () => {
            const scenario = { id: 1, name: 'Test Scenario' };
            const action = selectAnugaScenario(scenario);
            expect(action.type).toBe(SELECT_ANUGA_SCENARIO);
            expect(action.scenario).toEqual(scenario);
        });

        it('toggleScenarioSelected creates correct action', () => {
            const scenario = { id: 1, name: 'Test Scenario' };
            const action = toggleScenarioSelected(scenario);
            expect(action.type).toBe(TOGGLE_SCENARIO_SELECTED);
            expect(action.scenario).toEqual(scenario);
        });

        it('retryAnugaRun creates correct action', () => {
            const action = retryAnugaRun(42);
            expect(action.type).toBe(RETRY_ANUGA_RUN);
            expect(action.runId).toBe(42);
        });

        it('cancelAnugaRun creates correct action', () => {
            const action = cancelAnugaRun(42);
            expect(action.type).toBe(CANCEL_ANUGA_RUN);
            expect(action.runId).toBe(42);
        });

        it('startActiveRunPolling creates correct action', () => {
            const action = startActiveRunPolling(99);
            expect(action.type).toBe(START_ACTIVE_RUN_POLLING);
            expect(action.runId).toBe(99);
        });

        it('stopActiveRunPolling creates correct action', () => {
            const action = stopActiveRunPolling(99);
            expect(action.type).toBe(STOP_ACTIVE_RUN_POLLING);
            expect(action.runId).toBe(99);
        });

        it('updateRunStatus creates correct action', () => {
            const action = updateRunStatus(99, { status: 'computing', progress_pct: 50 });
            expect(action.type).toBe(UPDATE_RUN_STATUS);
            expect(action.runId).toBe(99);
            expect(action.status).toBe('computing');
            expect(action.progress_pct).toBe(50);
        });
    });

    describe('Reducer — normalized state shape', () => {
        it('should return initial combined state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            // Normalized: projects, scenarios, runs, ui, resources
            expect(state.projects).toExist();
            expect(state.scenarios).toExist();
            expect(state.runs).toExist();
            expect(state.ui).toExist();
            expect(state.resources).toExist();
        });

        it('scenarios sub-state has byId and allIds', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.scenarios.byId).toEqual({});
            expect(state.scenarios.allIds).toEqual([]);
            expect(state.scenarios.selectedId).toBe(null);
        });

        it('runs sub-state has byId and activePolling', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.runs.byId).toEqual({});
            expect(state.runs.activePolling).toEqual([]);
        });
    });

    describe('Reducer — UI sub-reducer', () => {
        it('should handle SET_ANUGA_INPUT_MENU', () => {
            const state = reducer(undefined, {
                type: SET_ANUGA_INPUT_MENU,
                visible: true
            });
            expect(state.ui.showAnugaInputMenu).toBe(true);
            expect(state.ui.showAnugaScenarioMenu).toBe(false);
            expect(state.ui.showAnugaResultMenu).toBe(false);
            expect(state.ui.showNetworkMenu).toBe(false);
        });

        it('should handle SET_ANUGA_SCENARIO_MENU', () => {
            const state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_MENU,
                visible: true
            });
            expect(state.ui.showAnugaInputMenu).toBe(false);
            expect(state.ui.showAnugaScenarioMenu).toBe(true);
            expect(state.ui.showAnugaResultMenu).toBe(false);
        });

        it('should handle SET_ANUGA_RESULT_MENU', () => {
            const state = reducer(undefined, {
                type: SET_ANUGA_RESULT_MENU,
                visible: true
            });
            expect(state.ui.showAnugaInputMenu).toBe(false);
            expect(state.ui.showAnugaScenarioMenu).toBe(false);
            expect(state.ui.showAnugaResultMenu).toBe(true);
        });

        it('should handle SET_NETWORK_MENU', () => {
            const state = reducer(undefined, {
                type: SET_NETWORK_MENU,
                visible: true
            });
            expect(state.ui.showNetworkMenu).toBe(true);
            expect(state.ui.showAnugaInputMenu).toBe(false);
        });

        it('should handle SET_PUBLICATION_PANEL', () => {
            const state = reducer(undefined, {
                type: SET_PUBLICATION_PANEL,
                visible: true
            });
            expect(state.ui.showPublicationPanel).toBe(true);
        });

        it('should handle SET_CREATING_ANUGA_LAYER', () => {
            const state = reducer(undefined, {
                type: SET_CREATING_ANUGA_LAYER,
                isCreatingAnugaLayer: true
            });
            expect(state.ui.isCreatingAnugaLayer).toBe(true);
        });

    });

    describe('Reducer — projects sub-reducer', () => {
        it('should handle SET_ANUGA_PROJECT_DATA', () => {
            const projectData = { id: 1, name: 'Test Project' };
            const state = reducer(undefined, {
                type: SET_ANUGA_PROJECT_DATA,
                data: projectData
            });
            expect(state.projects.data).toEqual(projectData);
        });

        // TASK-1637 — the in-flight guard slice.
        it('defaults projects.initInFlight to false', () => {
            const state = reducer(undefined, { type: '@@INIT' });
            expect(state.projects.initInFlight).toBe(false);
        });

        it('SET_ANUGA_INIT_IN_FLIGHT stores the map id and clears on false', () => {
            const set = reducer(undefined, { type: SET_ANUGA_INIT_IN_FLIGHT, mapId: 5486 });
            expect(set.projects.initInFlight).toBe(5486);
            const cleared = reducer(set, { type: SET_ANUGA_INIT_IN_FLIGHT, mapId: false });
            expect(cleared.projects.initInFlight).toBe(false);
        });

        it('SET_ANUGA_PROJECT_DATA clears the in-flight guard (init completed)', () => {
            const inFlight = reducer(undefined, { type: SET_ANUGA_INIT_IN_FLIGHT, mapId: 5486 });
            expect(inFlight.projects.initInFlight).toBe(5486);
            const done = reducer(inFlight, { type: SET_ANUGA_PROJECT_DATA, data: { id: 1 } });
            expect(done.projects.initInFlight).toBe(false);
            expect(done.projects.data).toEqual({ id: 1 });
        });
    });

    describe('Reducer — scenarios sub-reducer', () => {
        it('should handle SET_ANUGA_SCENARIO_DATA', () => {
            const scenarios = [{ id: 1, name: 'Scenario 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: scenarios
            });
            expect(state.scenarios.byId[1]).toExist();
            expect(state.scenarios.byId[1].name).toBe('Scenario 1');
            expect(state.scenarios.allIds).toContain(1);
        });

        it('should handle ADD_ANUGA_SCENARIO', () => {
            const state = reducer(undefined, { type: ADD_ANUGA_SCENARIO });
            expect(state.scenarios.allIds.length).toBe(1);
            const newId = state.scenarios.allIds[0];
            expect(state.scenarios.byId[newId]).toExist();
            expect(state.scenarios.byId[newId].resolution).toBe(1000);
            expect(state.scenarios.byId[newId].id).toBe(null);
        });

        it('should handle SELECT_ANUGA_SCENARIO', () => {
            const scenario = { id: 1, name: 'Test Scenario' };
            const state = reducer(undefined, {
                type: SELECT_ANUGA_SCENARIO,
                scenario: scenario
            });
            expect(state.scenarios.selectedId).toBe(1);
        });

        it('should handle UPDATE_ANUGA_SCENARIO with merged scenario', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'Scenario 1' }, { id: 2, name: 'Scenario 2' }]
            });

            // Action creator merges kv into scenario: { ...scenario, ...kv }
            const originalAction = {
                type: UPDATE_ANUGA_SCENARIO,
                scenario: { id: 1, name: 'Updated' }
            };
            Object.freeze(originalAction);
            Object.freeze(originalAction.scenario);

            state = reducer(state, originalAction);
            expect(state.scenarios.byId[1].name).toBe('Updated');
            expect(state.scenarios.byId[1].unsaved).toBe(true);
            expect(state.scenarios.byId[2].name).toBe('Scenario 2');
        });

        it('should handle TOGGLE_SCENARIO_SELECTED', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [
                    { id: 1, name: 'Scenario 1', selected: false },
                    { id: 2, name: 'Scenario 2', selected: false }
                ]
            });
            state = reducer(state, {
                type: TOGGLE_SCENARIO_SELECTED,
                scenario: { id: 1 }
            });
            expect(state.scenarios.byId[1].selected).toBe(true);
            expect(state.scenarios.byId[2].selected).toBe(false);
        });
    });

    describe('Reducer — scenarios polling merge', () => {
        it('should merge backend polling data into existing scenarios', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'Scenario 1', unsaved: true, selected: true }]
            });
            state = reducer(state, {
                type: SET_ANUGA_POLLING_DATA,
                scenarios: [{ id: 1, computed_status: 'computing', latest_run: { id: 10, status: 'computing' } }]
            });
            // Backend fields updated
            expect(state.scenarios.byId[1].computed_status).toBe('computing');
            expect(state.scenarios.byId[1].latest_run.id).toBe(10);
            // Local fields preserved
            expect(state.scenarios.byId[1].unsaved).toBe(true);
            expect(state.scenarios.byId[1].selected).toBe(true);
            expect(state.scenarios.byId[1].name).toBe('Scenario 1');
        });

        it('should add new backend-created scenarios', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'Scenario 1' }]
            });
            state = reducer(state, {
                type: SET_ANUGA_POLLING_DATA,
                scenarios: [
                    { id: 1, computed_status: 'built' },
                    { id: 2, name: 'Copy of Scenario 1', computed_status: 'created' }
                ]
            });
            expect(state.scenarios.allIds).toContain(2);
            expect(state.scenarios.byId[2].name).toBe('Copy of Scenario 1');
        });

        it('should set latest_run to null when backend returns null', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, latest_run: { id: 5 } }]
            });
            state = reducer(state, {
                type: SET_ANUGA_POLLING_DATA,
                scenarios: [{ id: 1, latest_run: null, computed_status: 'created' }]
            });
            expect(state.scenarios.byId[1].latest_run).toBe(null);
        });
    });

    describe('TASK-879 duplicate scenario action + reducer', () => {
        it('duplicateAnugaScenario creates DUPLICATE_ANUGA_SCENARIO with scenario payload', () => {
            const action = duplicateAnugaScenario({ id: 42, name: 'src' });
            expect(action.type).toBe(DUPLICATE_ANUGA_SCENARIO);
            expect(action.scenario).toEqual({ id: 42, name: 'src' });
        });

        it('Reducer appends the new scenario on DUPLICATE_ANUGA_SCENARIO_SUCCESS', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'src' }]
            });
            state = reducer(state, {
                type: DUPLICATE_ANUGA_SCENARIO_SUCCESS,
                scenario: { id: 2, name: 'src-copy', project: 7 }
            });
            expect(state.scenarios.byId[2]).toExist();
            expect(state.scenarios.byId[2].name).toBe('src-copy');
            expect(state.scenarios.byId[2].unsaved).toBe(false);
            expect(state.scenarios.allIds).toInclude(2);
            // Original still present.
            expect(state.scenarios.byId[1]).toExist();
        });

        it('Reducer is a no-op when scenario id is missing', () => {
            const initial = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'src' }]
            });
            const after = reducer(initial, {
                type: DUPLICATE_ANUGA_SCENARIO_SUCCESS,
                scenario: { name: 'no-id' }
            });
            expect(after).toBe(initial);
        });
    });

    describe('TASK-880 archive/unarchive scenario action + reducer', () => {
        it('archiveAnugaScenario creates ARCHIVE_ANUGA_SCENARIO with scenario payload', () => {
            const action = archiveAnugaScenario({ id: 42, name: 'src' });
            expect(action.type).toBe(ARCHIVE_ANUGA_SCENARIO);
            expect(action.scenario).toEqual({ id: 42, name: 'src' });
        });

        it('unarchiveAnugaScenario creates UNARCHIVE_ANUGA_SCENARIO with scenario payload', () => {
            const action = unarchiveAnugaScenario({ id: 42, name: 'src' });
            expect(action.type).toBe(UNARCHIVE_ANUGA_SCENARIO);
            expect(action.scenario).toEqual({ id: 42, name: 'src' });
        });

        it('setAnugaScenarioArchiveFilter creates SET_ANUGA_SCENARIO_ARCHIVE_FILTER with mode', () => {
            const action = setAnugaScenarioArchiveFilter('only');
            expect(action.type).toBe(SET_ANUGA_SCENARIO_ARCHIVE_FILTER);
            expect(action.mode).toBe('only');
        });

        it('Reducer updates byId archive metadata on ARCHIVE_ANUGA_SCENARIO_SUCCESS', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'src', archived_at: null, archived_by: null }]
            });
            state = reducer(state, {
                type: ARCHIVE_ANUGA_SCENARIO_SUCCESS,
                scenario: { id: 1, name: 'src', archived_at: '2026-05-14T13:00:00Z', archived_by: 9, archived_by_username: 'me' }
            });
            expect(state.scenarios.byId[1].archived_at).toBe('2026-05-14T13:00:00Z');
            expect(state.scenarios.byId[1].archived_by).toBe(9);
            expect(state.scenarios.byId[1].archived_by_username).toBe('me');
            // Other fields preserved.
            expect(state.scenarios.byId[1].name).toBe('src');
        });

        it('Reducer clears archive metadata on UNARCHIVE_ANUGA_SCENARIO_SUCCESS', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'src', archived_at: '2026-05-14T13:00:00Z', archived_by: 9 }]
            });
            state = reducer(state, {
                type: UNARCHIVE_ANUGA_SCENARIO_SUCCESS,
                scenario: { id: 1, name: 'src', archived_at: null, archived_by: null }
            });
            expect(state.scenarios.byId[1].archived_at).toBe(null);
            expect(state.scenarios.byId[1].archived_by).toBe(null);
        });

        it('Reducer is no-op on archive success when id is missing or unknown', () => {
            const initial = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'src' }]
            });
            const noId = reducer(initial, {
                type: ARCHIVE_ANUGA_SCENARIO_SUCCESS,
                scenario: { archived_at: 'x' }
            });
            expect(noId).toBe(initial);
            const unknownId = reducer(initial, {
                type: ARCHIVE_ANUGA_SCENARIO_SUCCESS,
                scenario: { id: 9999, archived_at: 'x' }
            });
            expect(unknownId).toBe(initial);
        });

        it('Reducer updates archiveFilter on SET_ANUGA_SCENARIO_ARCHIVE_FILTER', () => {
            const initial = reducer(undefined, { type: '@@INIT' });
            expect(initial.scenarios.archiveFilter).toBe('none');
            const next = reducer(initial, setAnugaScenarioArchiveFilter('only'));
            expect(next.scenarios.archiveFilter).toBe('only');
            const all = reducer(next, setAnugaScenarioArchiveFilter('all'));
            expect(all.scenarios.archiveFilter).toBe('all');
        });

        it('Reducer rejects invalid archiveFilter values', () => {
            const initial = reducer(undefined, { type: '@@INIT' });
            const bogus = reducer(initial, { type: SET_ANUGA_SCENARIO_ARCHIVE_FILTER, mode: 'BOGUS' });
            expect(bogus.scenarios.archiveFilter).toBe('none');
        });

        // Wave 3C C5: archiveAnugaScenarioError → showArchiveError. Toast-only;
        // the prior ARCHIVE_ANUGA_SCENARIO_ERROR Redux action had no consumer.
        it('showArchiveError surfaces BE detail in the toast message', () => {
            const dispatched = [];
            const errorBody = { detail: 'active run blocker' };
            const thunk = showArchiveError(errorBody);
            thunk((a) => dispatched.push(a));
            // Single SHOW_NOTIFICATION — no follow-up ARCHIVE_ANUGA_SCENARIO_ERROR.
            expect(dispatched.length).toBe(1);
            expect(dispatched[0].type).toBe('SHOW_NOTIFICATION');
            expect(dispatched[0].message).toBe('active run blocker');
            expect(dispatched[0].level).toBe('warning');
        });

        it('showArchiveError uses a fallback message when BE body is missing', () => {
            const dispatched = [];
            const thunk = showArchiveError(undefined);
            thunk((a) => dispatched.push(a));
            expect(dispatched[0].message).toMatch(/could not archive/i);
        });
    });

    describe('Reducer — scenarios save success', () => {
        it('should replace temp scenario with saved ID', () => {
            let state = reducer(undefined, { type: ADD_ANUGA_SCENARIO });
            const tempId = state.scenarios.allIds[0];
            expect(state.scenarios.byId[tempId].id).toBe(null);

            state = reducer(state, {
                type: SAVE_ANUGA_SCENARIO_SUCCESS,
                scenario: { id: 42, name: 'Saved Scenario', resolution: 100 }
            });
            expect(state.scenarios.byId[42]).toExist();
            expect(state.scenarios.byId[42].unsaved).toBe(false);
            expect(state.scenarios.allIds).toContain(42);
            expect(state.scenarios.byId[tempId]).toNotExist();
        });

        it('should allow SET_ANUGA_SCENARIO_DATA to refresh after data exists', () => {
            let state = reducer(undefined, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'Original' }]
            });
            expect(state.scenarios.byId[1].name).toBe('Original');

            // Second dispatch should replace (fix for Critical #1)
            state = reducer(state, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: [{ id: 1, name: 'Refreshed' }]
            });
            expect(state.scenarios.byId[1].name).toBe('Refreshed');
        });
    });

    describe('Reducer — resources sub-reducer', () => {
        it('should handle SET_ANUGA_INFLOW_DATA', () => {
            const inflows = [{ id: 1, name: 'Inflow 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_INFLOW_DATA,
                data: inflows
            });
            expect(state.resources.inflows).toEqual(inflows);
        });

        // TASK-955 (W2.2 FE) — Rainfall slice (polygon sibling to Inflow).
        // Verifies the reducer wires SET_ANUGA_RAINFALL_DATA onto the
        // `rainfalls` slot mirror to the Inflow check above.
        it('should handle SET_ANUGA_RAINFALL_DATA', () => {
            const {SET_ANUGA_RAINFALL_DATA} = require('../actionsAnuga');
            const rainfalls = [{ id: 1, name: 'Rainfall 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_RAINFALL_DATA,
                data: rainfalls
            });
            expect(state.resources.rainfalls).toEqual(rainfalls);
        });

        it('should handle SET_ANUGA_FRICTION_DATA', () => {
            const frictions = [{ id: 1, name: 'Friction 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_FRICTION_DATA,
                data: frictions
            });
            expect(state.resources.frictions).toEqual(frictions);
        });

        it('should handle SET_ANUGA_BOUNDARY_DATA', () => {
            const boundaries = [{ id: 1, name: 'Boundary 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_BOUNDARY_DATA,
                data: boundaries
            });
            expect(state.resources.boundaries).toEqual(boundaries);
        });

        it('should handle SET_ANUGA_TERRAIN_DATA', () => {
            const terrain = [{ id: 1, name: 'Terrain 1' }];
            const state = reducer(undefined, {
                type: SET_ANUGA_TERRAIN_DATA,
                data: terrain
            });
            expect(state.resources.terrain).toEqual(terrain);
        });
    });

    describe('Reducer — runs sub-reducer', () => {
        it('should handle START_ACTIVE_RUN_POLLING', () => {
            const state = reducer(undefined, {
                type: START_ACTIVE_RUN_POLLING,
                runId: 42
            });
            expect(state.runs.activePolling).toContain(42);
        });

        it('should not duplicate run IDs in activePolling', () => {
            let state = reducer(undefined, { type: START_ACTIVE_RUN_POLLING, runId: 42 });
            state = reducer(state, { type: START_ACTIVE_RUN_POLLING, runId: 42 });
            expect(state.runs.activePolling.length).toBe(1);
        });

        it('should handle STOP_ACTIVE_RUN_POLLING', () => {
            let state = reducer(undefined, { type: START_ACTIVE_RUN_POLLING, runId: 42 });
            state = reducer(state, { type: STOP_ACTIVE_RUN_POLLING, runId: 42 });
            expect(state.runs.activePolling.length).toBe(0);
        });

        it('should handle UPDATE_RUN_STATUS', () => {
            const state = reducer(undefined, {
                type: UPDATE_RUN_STATUS,
                runId: 42,
                status: 'computing',
                progress_pct: 75,
                eta_seconds: 120
            });
            expect(state.runs.byId[42]).toExist();
            expect(state.runs.byId[42].status).toBe('computing');
            expect(state.runs.byId[42].progress_pct).toBe(75);
            expect(state.runs.byId[42].eta_seconds).toBe(120);
        });
    });

    // V2P-21 — lazy-fetch my_perms on Anuga panel open
    describe('V2P-21 action creators', () => {
        const {
            FETCH_MY_PERMS,
            SET_ANUGA_RESOURCE_PERMS,
            SET_PERMS_LOAD_FAILED,
            fetchMyPerms,
            setAnugaResourcePerms,
            setPermsLoadFailed
        } = require('../actionsAnuga');

        it('fetchMyPerms creates {type, projectId}', () => {
            const action = fetchMyPerms(42);
            expect(action.type).toBe(FETCH_MY_PERMS);
            expect(action.projectId).toBe(42);
        });

        it('setAnugaResourcePerms creates {type, payload}', () => {
            const payload = { my_role: 'editor', visibility: 'private', scenarios: { 1: ['view_resourcebase'] } };
            const action = setAnugaResourcePerms(payload);
            expect(action.type).toBe(SET_ANUGA_RESOURCE_PERMS);
            expect(action.payload).toEqual(payload);
        });

        it('setPermsLoadFailed creates {type, failed}', () => {
            const action = setPermsLoadFailed(true);
            expect(action.type).toBe(SET_PERMS_LOAD_FAILED);
            expect(action.failed).toBe(true);
        });
    });

    describe('V2P-21 reducer SET_ANUGA_RESOURCE_PERMS', () => {
        const { SET_ANUGA_RESOURCE_PERMS, SET_PERMS_LOAD_FAILED, setAnugaResourcePerms } = require('../actionsAnuga');

        it('populates state.anuga.resources.scenarios as array of {id, perms}', () => {
            const state = reducer(undefined, setAnugaResourcePerms({
                my_role: 'editor',
                visibility: 'private',
                scenarios: { 1: ['view_resourcebase', 'change_resourcebase'] },
                terrain: { 5: ['view_resourcebase'] }
            }));
            // V2P-02 reading convention: state.anuga.resources.<type> is an array
            expect(Array.isArray(state.resources.scenarios)).toBe(true);
            expect(state.resources.scenarios).toEqual([
                { id: 1, perms: ['view_resourcebase', 'change_resourcebase'] }
            ]);
            expect(state.resources.terrain).toEqual([
                { id: 5, perms: ['view_resourcebase'] }
            ]);
        });

        it('preserves existing entry fields when merging perms', () => {
            // Boundary list-endpoint loaded first with title + name
            let state = reducer(undefined, {
                type: 'SET_ANUGA_BOUNDARY_DATA',
                data: [{ id: 7, title: 'Inflow North', name: 'bdy_north' }]
            });
            // Then my-perms arrives with perms for that boundary
            state = reducer(state, setAnugaResourcePerms({
                boundaries: { 7: ['view_resourcebase', 'change_resourcebase'] }
            }));
            // All original fields preserved + perms added
            expect(state.resources.boundaries.length).toBe(1);
            expect(state.resources.boundaries[0].id).toBe(7);
            expect(state.resources.boundaries[0].title).toBe('Inflow North');
            expect(state.resources.boundaries[0].name).toBe('bdy_north');
            expect(state.resources.boundaries[0].perms).toEqual(['view_resourcebase', 'change_resourcebase']);
        });

        it('stub-creates entries for ids in payload but not in existing state', () => {
            // No prior boundary data — perms-only payload
            const state = reducer(undefined, setAnugaResourcePerms({
                boundaries: { 99: ['view_resourcebase'] }
            }));
            // Should create stub {id, perms}
            expect(state.resources.boundaries).toEqual([
                { id: 99, perms: ['view_resourcebase'] }
            ]);
        });

        it('maps BE kebab-case keys to FE camelCase (mesh-regions -> meshRegions)', () => {
            const state = reducer(undefined, setAnugaResourcePerms({
                'mesh-regions': { 11: ['view_resourcebase'] },
                'full-meshes': { 22: ['view_resourcebase'] },
                'compute-instances': {}  // always {} per V2P-20 contract
            }));
            expect(state.resources.meshRegions).toEqual([
                { id: 11, perms: ['view_resourcebase'] }
            ]);
            expect(state.resources.fullMeshes).toEqual([
                { id: 22, perms: ['view_resourcebase'] }
            ]);
            // computeInstances starts as [] in initial state and stays []
            // because the BE payload key was empty.
            expect(state.resources.computeInstances).toEqual([]);
        });

        it('skips members and runs (they live in their own reducers)', () => {
            const stateBefore = reducer(undefined, { type: 'UNKNOWN' });
            const state = reducer(undefined, setAnugaResourcePerms({
                members: { 1: ['view_resourcebase'] },
                runs: { 2: ['view_resourcebase'] }
            }));
            // resources slice should be unchanged for these keys (no 'members'
            // / 'runs' key created on the resources slice).
            expect(state.resources.members).toBe(undefined);
            expect(state.resources.runs).toBe(undefined);
            // memberships + runs sub-reducers untouched
            expect(state.memberships).toEqual(stateBefore.memberships);
            expect(state.runs).toEqual(stateBefore.runs);
        });

        it('ignores my_role and visibility top-level keys (not resource_types)', () => {
            const state = reducer(undefined, setAnugaResourcePerms({
                my_role: 'editor',
                visibility: 'public',
                boundaries: { 1: ['view_resourcebase'] }
            }));
            // No bogus my_role / visibility keys appear on resources
            expect(state.resources.my_role).toBe(undefined);
            expect(state.resources.visibility).toBe(undefined);
            // boundaries still populated correctly
            expect(state.resources.boundaries).toEqual([
                { id: 1, perms: ['view_resourcebase'] }
            ]);
        });

        it('clears permsLoadFailed flag on a successful set', () => {
            // Start with a failed state
            let state = reducer(undefined, { type: SET_PERMS_LOAD_FAILED, failed: true });
            expect(state.resources.permsLoadFailed).toBe(true);
            // Successful payload clears it
            state = reducer(state, setAnugaResourcePerms({ scenarios: {} }));
            expect(state.resources.permsLoadFailed).toBe(false);
        });

        it('handles empty {} payload gracefully (V2P-15 anon-on-public contract)', () => {
            // Anon hitting public project: my_role=null + every type as {}
            const state = reducer(undefined, setAnugaResourcePerms({
                my_role: null,
                visibility: 'public',
                scenarios: {},
                terrain: {},
                boundaries: {}
            }));
            // Initial state arrays preserved (empty), no stubs created
            expect(state.resources.scenarios).toEqual([]);
            expect(state.resources.terrain).toEqual([]);
            expect(state.resources.boundaries).toEqual([]);
            expect(state.resources.permsLoadFailed).toBe(false);
        });

        it('handles undefined / null payload defensively', () => {
            // Should not throw
            const state = reducer(undefined, { type: SET_ANUGA_RESOURCE_PERMS, payload: undefined });
            expect(state.resources.permsLoadFailed).toBe(false);
        });

        it('SET_PERMS_LOAD_FAILED toggles flag without touching resource arrays', () => {
            // First populate some resources
            let state = reducer(undefined, {
                type: 'SET_ANUGA_BOUNDARY_DATA',
                data: [{ id: 1, title: 'Boundary 1' }]
            });
            // Then fail
            state = reducer(state, { type: SET_PERMS_LOAD_FAILED, failed: true });
            expect(state.resources.permsLoadFailed).toBe(true);
            // Existing data preserved
            expect(state.resources.boundaries).toEqual([{ id: 1, title: 'Boundary 1' }]);
        });
    });

    // V2P-714 — cascade-delete dataset rows
    describe('V2P-714 cascade-delete action creators', () => {
        const {
            DELETE_TERRAIN,
            DELETE_TERRAIN_SUCCESS,
            DELETE_TERRAIN_BLOCKED,
            DELETE_TERRAIN_ERROR,
            DELETE_BOUNDARY,
            DELETE_BOUNDARY_SUCCESS,
            DELETE_BOUNDARY_BLOCKED,
            DELETE_BOUNDARY_ERROR,
            DELETE_FRICTION,
            DELETE_FRICTION_SUCCESS,
            DELETE_FRICTION_BLOCKED,
            DELETE_FRICTION_ERROR,
            DELETE_INFLOW,
            DELETE_INFLOW_SUCCESS,
            DELETE_INFLOW_BLOCKED,
            DELETE_INFLOW_ERROR,
            // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
            DELETE_FRICTION_RASTER,
            deleteTerrain,
            deleteTerrainSuccess,
            deleteTerrainBlocked,
            deleteTerrainError,
            deleteBoundary,
            deleteBoundarySuccess,
            deleteBoundaryBlocked,
            deleteBoundaryError,
            deleteFriction,
            deleteFrictionSuccess,
            deleteFrictionBlocked,
            deleteFrictionError,
            deleteInflow,
            deleteInflowSuccess,
            deleteInflowBlocked,
            deleteInflowError,
            // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
            deleteFrictionRaster
        } = require('../actionsAnuga');

        it('deleteTerrain creates {type, projectId, id, layerIds: [..]}', () => {
            // V2P-714 sibling-orphan: signature is now an array (Terrain
            // has utm + hillshade siblings). Single string still accepted
            // for backward compat — coerced to a 1-element array.
            const a = deleteTerrain(7, 99, ['l1', 'l2']);
            expect(a.type).toBe(DELETE_TERRAIN);
            expect(a.projectId).toBe(7);
            expect(a.id).toBe(99);
            expect(a.layerIds).toEqual(['l1', 'l2']);
        });
        it('deleteTerrain coerces single layerId string to array', () => {
            const a = deleteTerrain(7, 99, 'l1');
            expect(a.layerIds).toEqual(['l1']);
        });
        it('deleteTerrain handles missing layerIds gracefully', () => {
            const a = deleteTerrain(7, 99);
            expect(a.layerIds).toEqual([]);
        });
        it('deleteTerrainSuccess creates {type, id, layerIds: [..]}', () => {
            const a = deleteTerrainSuccess(99, ['l1', 'l2']);
            expect(a.type).toBe(DELETE_TERRAIN_SUCCESS);
            expect(a.id).toBe(99);
            expect(a.layerIds).toEqual(['l1', 'l2']);
        });
        it('deleteTerrainBlocked carries blocking + message', () => {
            const a = deleteTerrainBlocked(99, [{type: 'scenario', id: 1, name: 'A', state: 'computing'}], 'cannot delete');
            expect(a.type).toBe(DELETE_TERRAIN_BLOCKED);
            expect(a.id).toBe(99);
            expect(a.blocking).toEqual([{type: 'scenario', id: 1, name: 'A', state: 'computing'}]);
            expect(a.message).toBe('cannot delete');
        });
        it('deleteTerrainError carries error', () => {
            const a = deleteTerrainError(99, {status: 500, data: {}});
            expect(a.type).toBe(DELETE_TERRAIN_ERROR);
            expect(a.id).toBe(99);
            expect(a.error.status).toBe(500);
        });

        it('deleteBoundary actions are typed distinctly', () => {
            expect(deleteBoundary(1, 2).type).toBe(DELETE_BOUNDARY);
            expect(deleteBoundarySuccess(2).type).toBe(DELETE_BOUNDARY_SUCCESS);
            expect(deleteBoundaryBlocked(2, [], '').type).toBe(DELETE_BOUNDARY_BLOCKED);
            expect(deleteBoundaryError(2, {}).type).toBe(DELETE_BOUNDARY_ERROR);
        });
        it('deleteFriction actions are typed distinctly', () => {
            expect(deleteFriction(1, 2).type).toBe(DELETE_FRICTION);
            expect(deleteFrictionSuccess(2).type).toBe(DELETE_FRICTION_SUCCESS);
            expect(deleteFrictionBlocked(2, [], '').type).toBe(DELETE_FRICTION_BLOCKED);
            expect(deleteFrictionError(2, {}).type).toBe(DELETE_FRICTION_ERROR);
        });
        it('deleteInflow actions are typed distinctly', () => {
            expect(deleteInflow(1, 2).type).toBe(DELETE_INFLOW);
            expect(deleteInflowSuccess(2).type).toBe(DELETE_INFLOW_SUCCESS);
            expect(deleteInflowBlocked(2, [], '').type).toBe(DELETE_INFLOW_BLOCKED);
            expect(deleteInflowError(2, {}).type).toBe(DELETE_INFLOW_ERROR);
        });
        // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
        // Same V2P-714 shape — these tests pin the action-type surface so a
        // future rename can't silently break the dispatch contract.
        it('deleteRainfall actions are typed distinctly', () => {
            const {
                DELETE_RAINFALL,
                DELETE_RAINFALL_SUCCESS,
                DELETE_RAINFALL_BLOCKED,
                DELETE_RAINFALL_ERROR,
                deleteRainfall,
                deleteRainfallSuccess,
                deleteRainfallBlocked,
                deleteRainfallError
            } = require('../actionsAnuga');
            expect(deleteRainfall(1, 2).type).toBe(DELETE_RAINFALL);
            expect(deleteRainfallSuccess(2).type).toBe(DELETE_RAINFALL_SUCCESS);
            expect(deleteRainfallBlocked(2, [], '').type).toBe(DELETE_RAINFALL_BLOCKED);
            expect(deleteRainfallError(2, {}).type).toBe(DELETE_RAINFALL_ERROR);
        });
        it('deleteRainfall layerIds coerce array signature like the V2P-714 four', () => {
            const {deleteRainfall, deleteRainfallSuccess} = require('../actionsAnuga');
            expect(deleteRainfall(1, 2, 'lyr-1').layerIds).toEqual(['lyr-1']);
            expect(deleteRainfallSuccess(2, ['l1', 'l2']).layerIds).toEqual(['l1', 'l2']);
        });
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain).
        it('deleteFrictionRaster actions are typed distinctly', () => {
            expect(deleteFrictionRaster(1, 2).type).toBe(DELETE_FRICTION_RASTER);
            expect(deleteFrictionRaster(1, 2, [10]).layerIds).toEqual([10]);
        });
    });

    describe('V2P-714 cascade-delete reducer', () => {
        // SET_* constants come from the top-of-file imports; redeclaring here
        // would shadow them.
        const {
            DELETE_TERRAIN,
            DELETE_TERRAIN_SUCCESS,
            DELETE_TERRAIN_BLOCKED,
            DELETE_TERRAIN_ERROR,
            DELETE_BOUNDARY_SUCCESS,
            DELETE_FRICTION_SUCCESS,
            DELETE_INFLOW_SUCCESS
        } = require('../actionsAnuga');

        const seed = (type, slot, data) => reducer(undefined, { type, [slot]: data });

        it('DELETE_TERRAIN marks deleting:true on the target row', () => {
            let state = seed(SET_ANUGA_TERRAIN_DATA, 'data', [
                { id: 1, title: 'A' }, { id: 2, title: 'B' }
            ]);
            state = reducer(state, { type: DELETE_TERRAIN, projectId: 7, id: 1, layerIds: ['l1'] });
            expect(state.resources.terrain[0].deleting).toBe(true);
            expect(state.resources.terrain[1].deleting).toBe(undefined);
        });

        it('DELETE_TERRAIN_SUCCESS removes the row by id', () => {
            let state = seed(SET_ANUGA_TERRAIN_DATA, 'data', [
                { id: 1, title: 'A' }, { id: 2, title: 'B' }
            ]);
            state = reducer(state, { type: DELETE_TERRAIN_SUCCESS, id: 1 });
            expect(state.resources.terrain.length).toBe(1);
            expect(state.resources.terrain[0].id).toBe(2);
        });

        it('DELETE_TERRAIN_BLOCKED stamps blockingError with blocking list', () => {
            let state = seed(SET_ANUGA_TERRAIN_DATA, 'data', [{ id: 1, title: 'A' }]);
            state = reducer(state, {
                type: DELETE_TERRAIN_BLOCKED,
                id: 1,
                message: 'Cannot delete: scenario X references this',
                blocking: [{ type: 'scenario', id: 11, name: 'X', state: 'computing' }]
            });
            const row = state.resources.terrain[0];
            expect(row.deleting).toBe(false);
            expect(row.blockingError.message).toBe('Cannot delete: scenario X references this');
            expect(row.blockingError.blocking.length).toBe(1);
            expect(row.blockingError.blocking[0].name).toBe('X');
            expect(row.deleteError).toBe(null);
        });

        it('DELETE_TERRAIN_ERROR stamps deleteError', () => {
            let state = seed(SET_ANUGA_TERRAIN_DATA, 'data', [{ id: 1, title: 'A' }]);
            state = reducer(state, {
                type: DELETE_TERRAIN_ERROR,
                id: 1,
                error: { status: 500, data: { detail: 'boom' } }
            });
            const row = state.resources.terrain[0];
            expect(row.deleting).toBe(false);
            expect(row.blockingError).toBe(null);
            expect(row.deleteError.status).toBe(500);
        });

        it('DELETE_BOUNDARY_SUCCESS removes from boundaries slot only', () => {
            let state = seed(SET_ANUGA_BOUNDARY_DATA, 'data', [
                { id: 1, title: 'A' }, { id: 2, title: 'B' }
            ]);
            state = reducer(state, { type: DELETE_BOUNDARY_SUCCESS, id: 2 });
            expect(state.resources.boundaries.length).toBe(1);
            expect(state.resources.boundaries[0].id).toBe(1);
        });

        it('DELETE_FRICTION_SUCCESS removes from frictions slot only', () => {
            let state = seed(SET_ANUGA_FRICTION_DATA, 'data', [{ id: 5, title: 'F' }]);
            state = reducer(state, { type: DELETE_FRICTION_SUCCESS, id: 5 });
            expect(state.resources.frictions).toEqual([]);
        });

        it('DELETE_INFLOW_SUCCESS removes from inflows slot only', () => {
            let state = seed(SET_ANUGA_INFLOW_DATA, 'data', [{ id: 7, title: 'I' }]);
            state = reducer(state, { type: DELETE_INFLOW_SUCCESS, id: 7 });
            expect(state.resources.inflows).toEqual([]);
        });

        // TASK-955 (W2.2 FE) — Rainfall cascade-delete reducer pin. Identical
        // shape to DELETE_INFLOW_SUCCESS above; row removal must target only
        // the rainfalls slot so a stray rainfall delete can't take a sibling
        // inflow/boundary row with it.
        it('DELETE_RAINFALL_SUCCESS removes from rainfalls slot only', () => {
            const {SET_ANUGA_RAINFALL_DATA, DELETE_RAINFALL_SUCCESS} = require('../actionsAnuga');
            let state = seed(SET_ANUGA_RAINFALL_DATA, 'data', [{ id: 8, title: 'R' }]);
            state = reducer(state, { type: DELETE_RAINFALL_SUCCESS, id: 8 });
            expect(state.resources.rainfalls).toEqual([]);
        });

        it('SUCCESS for a missing id leaves the slot unchanged', () => {
            let state = seed(SET_ANUGA_TERRAIN_DATA, 'data', [{ id: 1, title: 'A' }]);
            state = reducer(state, { type: DELETE_TERRAIN_SUCCESS, id: 999 });
            expect(state.resources.terrain.length).toBe(1);
        });
    });
});

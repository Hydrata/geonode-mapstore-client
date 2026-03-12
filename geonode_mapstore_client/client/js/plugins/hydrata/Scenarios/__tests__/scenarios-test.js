import expect from 'expect';
import reducer from '../reducersScenarios';
import {
    FETCH_SCENARIOS_CONFIG,
    FETCH_SCENARIOS_CONFIG_SUCCESS,
    FETCH_SCENARIO_OVERVIEW,
    FETCH_SCENARIO_OVERVIEW_SUCCESS,
    TOGGLE_SCENARIO_MANAGER,
    HIDE_SCENARIO_MANAGER,
    SHOW_SCENARIO_OVERVIEW,
    HIDE_SCENARIO_OVERVIEW,
    UPDATE_SCENARIO,
    SELECT_SCENARIO,
    CREATE_SCENARIO,
    SAVE_SCENARIO_SUCCESS,
    DELETE_SCENARIO_SUCCESS
} from '../actionsScenarios';

describe('Scenarios Plugin', () => {
    describe('reducer', () => {
        it('should return default state for unknown action', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual({});
        });

        it('FETCH_SCENARIOS_CONFIG sets fetching to mapId', () => {
            const state = reducer({}, { type: FETCH_SCENARIOS_CONFIG, mapId: 42 });
            expect(state.fetching).toBe(42);
        });

        it('FETCH_SCENARIOS_CONFIG_SUCCESS stores config and clears fetching', () => {
            const config = { scenarios: [{ slug: 'flood' }] };
            const state = reducer(
                { fetching: 42 },
                { type: FETCH_SCENARIOS_CONFIG_SUCCESS, payload: config }
            );
            expect(state.fetching).toBe(null);
            expect(state.hasScenarioConfig).toBe(true);
            expect(state.config).toEqual(config);
        });

        it('FETCH_SCENARIO_OVERVIEW sets fetchingOverview', () => {
            const state = reducer({}, { type: FETCH_SCENARIO_OVERVIEW, mapId: 10 });
            expect(state.fetchingOverview).toBe(10);
        });

        it('FETCH_SCENARIO_OVERVIEW_SUCCESS stores scenarios', () => {
            const scenarios = [{ id: 1, name: 'Run 1' }];
            const state = reducer(
                { fetchingOverview: 10 },
                { type: FETCH_SCENARIO_OVERVIEW_SUCCESS, data: scenarios }
            );
            expect(state.fetchingOverview).toBe(null);
            expect(state.hasScenarioOverview).toBe(true);
            expect(state.scenarioOverview.scenarios).toEqual(scenarios);
        });

        it('TOGGLE_SCENARIO_MANAGER toggles visibility', () => {
            const state1 = reducer({}, { type: TOGGLE_SCENARIO_MANAGER });
            expect(state1.visibleScenarioManager).toBe(true);
            const state2 = reducer(state1, { type: TOGGLE_SCENARIO_MANAGER });
            expect(state2.visibleScenarioManager).toBe(false);
        });

        it('HIDE_SCENARIO_MANAGER sets visibility false', () => {
            const state = reducer(
                { visibleScenarioManager: true },
                { type: HIDE_SCENARIO_MANAGER }
            );
            expect(state.visibleScenarioManager).toBe(false);
        });

        it('SHOW_SCENARIO_OVERVIEW sets visibility and overview data', () => {
            const state = reducer({}, {
                type: SHOW_SCENARIO_OVERVIEW,
                slug: 'flood',
                title: 'Flood Scenarios'
            });
            expect(state.visibleScenarioOverview).toBe(true);
            expect(state.activeScenarioClass).toBe('flood');
            expect(state.scenarioOverview.title).toBe('Flood Scenarios');
            expect(state.scenarioOverview.slug).toBe('flood');
        });

        it('HIDE_SCENARIO_OVERVIEW clears overview', () => {
            const state = reducer(
                {
                    activeScenarioClass: 'flood',
                    visibleScenarioOverview: true,
                    scenarioOverview: { title: 'Flood', slug: 'flood', scenarios: [{ id: 1 }] }
                },
                { type: HIDE_SCENARIO_OVERVIEW }
            );
            expect(state.activeScenarioClass).toBe(null);
            expect(state.visibleScenarioOverview).toBe(false);
            expect(state.scenarioOverview.scenarios).toEqual([]);
        });

        it('SELECT_SCENARIO sets selectedScenario', () => {
            const scenario = { id: 5, name: 'Test' };
            const state = reducer({}, { type: SELECT_SCENARIO, scenario });
            expect(state.selectedScenario).toEqual(scenario);
        });

        it('UPDATE_SCENARIO marks scenario as unsaved', () => {
            const existing = { id: 1, name: 'Original' };
            const updated = { id: 1, name: 'Modified' };
            const state = reducer(
                { scenarioOverview: { scenarios: [existing] } },
                { type: UPDATE_SCENARIO, scenario: updated }
            );
            expect(state.scenarioOverview.scenarios[0].name).toBe('Modified');
            expect(state.scenarioOverview.scenarios[0].unsaved).toBe(true);
        });

        it('SAVE_SCENARIO_SUCCESS clears unsaved flag', () => {
            const saved = { id: 1, name: 'Saved', unsaved: true };
            const state = reducer(
                { scenarioOverview: { scenarios: [saved] } },
                { type: SAVE_SCENARIO_SUCCESS, scenario: { id: 1, name: 'Saved' } }
            );
            expect(state.scenarioOverview.scenarios[0].unsaved).toBe(false);
        });

        it('SAVE_SCENARIO_SUCCESS replaces new scenario (no id)', () => {
            const newScen = { name: 'New', project: 1 };
            const serverScen = { id: 99, name: 'New', project: 1 };
            const state = reducer(
                { scenarioOverview: { scenarios: [newScen] } },
                { type: SAVE_SCENARIO_SUCCESS, scenario: serverScen }
            );
            expect(state.scenarioOverview.scenarios[0].id).toBe(99);
        });

        it('DELETE_SCENARIO_SUCCESS removes scenario', () => {
            const state = reducer(
                { scenarioOverview: { scenarios: [{ id: 1 }, { id: 2 }] } },
                { type: DELETE_SCENARIO_SUCCESS, scenario: { id: 1 } }
            );
            expect(state.scenarioOverview.scenarios.length).toBe(1);
            expect(state.scenarioOverview.scenarios[0].id).toBe(2);
        });

        it('CREATE_SCENARIO adds new scenario from fields', () => {
            const fields = [
                { name: 'depth', widget: 'number' },
                { name: 'label', widget: 'text' }
            ];
            const state = reducer(
                { activeScenarioClass: 'flood', scenarioOverview: { scenarios: [] } },
                { type: CREATE_SCENARIO, fields, projectId: 42 }
            );
            const newScen = state.scenarioOverview.scenarios[0];
            expect(newScen.depth).toBe(0);
            expect(newScen.label).toBe('');
            expect(newScen.project).toBe(42);
            expect(newScen.slug).toBe('flood');
            expect(newScen.unsaved).toBe(true);
            expect(newScen.state).toBe('active');
        });
    });
});

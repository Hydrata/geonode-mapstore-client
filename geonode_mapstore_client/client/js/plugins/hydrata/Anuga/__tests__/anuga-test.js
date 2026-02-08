import expect from 'expect';
import reducer from '../reducersAnuga';
import {
    INIT_ANUGA,
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_REVIEW_PANEL,
    SET_PUBLICATION_PANEL,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_ELEVATION_DATA,
    SET_CREATING_ANUGA_LAYER,
    ADD_ANUGA_SCENARIO,
    SELECT_ANUGA_SCENARIO,
    TOGGLE_SCENARIO_SELECTED,
    UPDATE_ANUGA_SCENARIO,
    SHOW_ANUGA_SCENARIO_LOG,
    SHOW_ANUGA_RUN_MENU,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    setNetworkMenu,
    setReviewPanel,
    setPublicationPanel,
    setAnugaProjectData,
    setAnugaInflowData,
    setCreatingAnugaLayer,
    selectAnugaScenario,
    toggleScenarioSelected,
    showAnugaScenarioLog,
    showAnugaRunMenu,
    initAnuga
} from '../actionsAnuga';

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

        it('setReviewPanel creates correct action', () => {
            const action = setReviewPanel(true);
            expect(action.type).toBe(SET_REVIEW_PANEL);
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

        it('showAnugaScenarioLog creates correct action', () => {
            const action = showAnugaScenarioLog(123);
            expect(action.type).toBe(SHOW_ANUGA_SCENARIO_LOG);
            expect(action.scenarioId).toBe(123);
        });

        it('showAnugaRunMenu creates correct action', () => {
            const action = showAnugaRunMenu(true);
            expect(action.type).toBe(SHOW_ANUGA_RUN_MENU);
            expect(action.visible).toBe(true);
        });
    });

    describe('Reducer', () => {
        const initialState = {
            showAddAnugaElevationData: false,
            visibleAnugaScenarioLogId: false,
            scenarios: []
        };

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should handle SET_CREATING_ANUGA_LAYER', () => {
            const state = reducer(initialState, {
                type: SET_CREATING_ANUGA_LAYER,
                isCreatingAnugaLayer: true
            });
            expect(state.isCreatingAnugaLayer).toBe(true);
        });

        it('should handle SET_ANUGA_INPUT_MENU - show input menu', () => {
            const state = reducer(initialState, {
                type: SET_ANUGA_INPUT_MENU,
                visible: true
            });
            expect(state.showAnugaInputMenu).toBe(true);
            expect(state.showAnugaScenarioMenu).toBe(false);
            expect(state.showAnugaResultMenu).toBe(false);
            expect(state.showNetworkMenu).toBe(false);
        });

        it('should handle SET_ANUGA_SCENARIO_MENU - show scenario menu', () => {
            const state = reducer(initialState, {
                type: SET_ANUGA_SCENARIO_MENU,
                visible: true
            });
            expect(state.showAnugaInputMenu).toBe(false);
            expect(state.showAnugaScenarioMenu).toBe(true);
            expect(state.showAnugaResultMenu).toBe(false);
        });

        it('should handle SET_ANUGA_RESULT_MENU - show result menu', () => {
            const state = reducer(initialState, {
                type: SET_ANUGA_RESULT_MENU,
                visible: true
            });
            expect(state.showAnugaInputMenu).toBe(false);
            expect(state.showAnugaScenarioMenu).toBe(false);
            expect(state.showAnugaResultMenu).toBe(true);
        });

        it('should handle SET_NETWORK_MENU', () => {
            const state = reducer(initialState, {
                type: SET_NETWORK_MENU,
                visible: true
            });
            expect(state.showNetworkMenu).toBe(true);
            expect(state.showAnugaInputMenu).toBe(false);
        });

        it('should handle SET_REVIEW_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_REVIEW_PANEL,
                visible: true
            });
            expect(state.showReviewPanel).toBe(true);
            expect(state.showAnugaInputMenu).toBe(false);
        });

        it('should handle SET_PUBLICATION_PANEL', () => {
            const state = reducer(initialState, {
                type: SET_PUBLICATION_PANEL,
                visible: true
            });
            expect(state.showPublicationPanel).toBe(true);
            expect(state.showReviewPanel).toBe(false);
        });

        it('should handle SET_ANUGA_PROJECT_DATA', () => {
            const projectData = { id: 1, name: 'Test Project' };
            const state = reducer(initialState, {
                type: SET_ANUGA_PROJECT_DATA,
                data: projectData
            });
            expect(state.projectData).toEqual(projectData);
        });

        it('should handle SET_ANUGA_SCENARIO_DATA with empty scenarios', () => {
            const scenarios = [{ id: 1, name: 'Scenario 1' }];
            const state = reducer(initialState, {
                type: SET_ANUGA_SCENARIO_DATA,
                scenarios: scenarios
            });
            expect(state.scenarios).toEqual(scenarios);
        });

        it('should handle SET_ANUGA_INFLOW_DATA', () => {
            const inflows = [{ id: 1, name: 'Inflow 1' }];
            const state = reducer(initialState, {
                type: SET_ANUGA_INFLOW_DATA,
                data: inflows
            });
            expect(state.inflows).toEqual(inflows);
        });

        it('should handle SET_ANUGA_FRICTION_DATA', () => {
            const frictions = [{ id: 1, name: 'Friction 1' }];
            const state = reducer(initialState, {
                type: SET_ANUGA_FRICTION_DATA,
                data: frictions
            });
            expect(state.frictions).toEqual(frictions);
        });

        it('should handle SET_ANUGA_BOUNDARY_DATA', () => {
            const boundaries = [{ id: 1, name: 'Boundary 1' }];
            const state = reducer(initialState, {
                type: SET_ANUGA_BOUNDARY_DATA,
                data: boundaries
            });
            expect(state.boundaries).toEqual(boundaries);
        });

        it('should handle SET_ANUGA_ELEVATION_DATA', () => {
            const elevations = [{ id: 1, name: 'Elevation 1' }];
            const state = reducer(initialState, {
                type: SET_ANUGA_ELEVATION_DATA,
                data: elevations
            });
            expect(state.elevations).toEqual(elevations);
        });

        it('should handle ADD_ANUGA_SCENARIO', () => {
            const stateWithProject = {
                ...initialState,
                projectData: { id: 123 }
            };
            const state = reducer(stateWithProject, {
                type: ADD_ANUGA_SCENARIO
            });
            expect(state.scenarios.length).toBe(1);
            expect(state.scenarios[0].status).toBe('new');
            expect(state.scenarios[0].project).toBe(123);
        });

        it('should handle SELECT_ANUGA_SCENARIO', () => {
            const scenario = { id: 1, name: 'Test Scenario' };
            const state = reducer(initialState, {
                type: SELECT_ANUGA_SCENARIO,
                scenario: scenario
            });
            expect(state.selectedScenarioId).toBe(1);
            expect(state.selectedScenario).toEqual(scenario);
        });

        it('should handle TOGGLE_SCENARIO_SELECTED', () => {
            const stateWithScenarios = {
                ...initialState,
                scenarios: [
                    { id: 1, name: 'Scenario 1', selected: false },
                    { id: 2, name: 'Scenario 2', selected: false }
                ]
            };
            const state = reducer(stateWithScenarios, {
                type: TOGGLE_SCENARIO_SELECTED,
                scenario: { id: 1, name: 'Scenario 1', selected: false }
            });
            expect(state.scenarios[0].selected).toBe(true);
            expect(state.scenarios[1].selected).toBe(false);
        });

        it('should handle UPDATE_ANUGA_SCENARIO', () => {
            const stateWithScenarios = {
                ...initialState,
                scenarios: [
                    { id: 1, name: 'Scenario 1' },
                    { id: 2, name: 'Scenario 2' }
                ]
            };
            const state = reducer(stateWithScenarios, {
                type: UPDATE_ANUGA_SCENARIO,
                scenario: { id: 1, name: 'Updated Scenario 1' }
            });
            expect(state.scenarios[0].name).toBe('Updated Scenario 1');
            expect(state.scenarios[0].unsaved).toBe(true);
            expect(state.scenarios[1].name).toBe('Scenario 2');
        });

        it('should handle SHOW_ANUGA_SCENARIO_LOG', () => {
            const state = reducer(initialState, {
                type: SHOW_ANUGA_SCENARIO_LOG,
                scenarioId: 123
            });
            expect(state.visibleAnugaScenarioLogId).toBe(123);
        });

        it('should handle SHOW_ANUGA_RUN_MENU', () => {
            const state = reducer(initialState, {
                type: SHOW_ANUGA_RUN_MENU,
                visible: true
            });
            expect(state.visibleAnugaRunMenu).toBe(true);
        });
    });
});

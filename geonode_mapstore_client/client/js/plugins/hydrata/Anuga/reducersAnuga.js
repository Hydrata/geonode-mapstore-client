import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_SCENARIO_DATA,
    UPDATE_ANUGA_SCENARIO,
    SELECT_ANUGA_SCENARIO,
    ADD_ANUGA_SCENARIO,
    SHOW_ANUGA_SCENARIO_LOG,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    SET_ANUGA_POLLING_DATA,
    SET_ANUGA_INFLOW_DATA,
    ADD_ANUGA_INFLOW,
    SET_ANUGA_FRICTION_DATA,
    ADD_ANUGA_FRICTION,
    SET_ANUGA_STRUCTURE_DATA,
    ADD_ANUGA_STRUCTURE,
    SET_ANUGA_BOUNDARY_DATA,
    ADD_ANUGA_BOUNDARY,
    SET_ANUGA_ELEVATION_DATA,
    SET_ADD_ANUGA_ELEVATION_DATA,
    SET_ANUGA_AVAILABLE_ELEVATION_DATA
} from "./actionsAnuga";

const initialState = {
    showAddAnugaElevationData: false,
    visibleAnugaScenarioLog: false
};

export default ( state = initialState, action) => {
    console.log('anuga:', action);
    switch (action.type) {
    case UPDATE_ANUGA_SCENARIO:
        return {
            ...state,
            scenarios: state.scenarios.map((scenario) => {
                if (scenario.id === action.scenario.id) {
                    action.scenario.unsaved = true;
                    return action.scenario;
                }
                return scenario;
            })
        };
    case SET_ANUGA_POLLING_DATA:
        return {
            ...state,
            scenarios: state.scenarios.map(scenario => {
                const newScenario = action.scenarios.filter(actionScenario => scenario.id === actionScenario.id)[0];
                scenario.latest_output.log = newScenario.latest_output.log;
                scenario.status = newScenario.status;
                return scenario;
            })
        };
    case ADD_ANUGA_SCENARIO:
        return {
            ...state,
            scenarios: [
                ...state.scenarios,
                {
                    "name": "Enter Name",
                    "code": null,
                    "description": "",
                    "maximum_triangle_area": 10,
                    "status": "new",
                    "project": state?.project?.id,
                    "boundary": null,
                    "elevation": null,
                    "unsaved": false
                }]
        };
    case SHOW_ANUGA_SCENARIO_LOG:
        return {
            ...state,
            visibleAnugaScenarioLog: action.scenario
        };
    case SAVE_ANUGA_SCENARIO_SUCCESS:
        return {
            ...state,
            scenarios: state.scenarios.map((scenario) => {
                if (scenario.id === action.scenario.id) {
                    action.scenario.unsaved = false;
                    return action.scenario;
                }
                return scenario;
            })
        };
    case SELECT_ANUGA_SCENARIO:
        return {
            ...state,
            selectedScenario: action.scenario
        };
    case SET_ANUGA_PROJECT_DATA:
        return {
            ...state,
            project: action.data
        };
    case SET_ANUGA_SCENARIO_DATA:
        return {
            ...state,
            scenarios: action.data.map(scenario => {
                scenario.unsaved = false;
                return scenario;
            })
        };
    case SET_ANUGA_INFLOW_DATA:
        return {
            ...state,
            inflows: action.data
        };
    case ADD_ANUGA_INFLOW:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_FRICTION_DATA:
        return {
            ...state,
            frictions: action.data
        };
    case ADD_ANUGA_FRICTION:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_STRUCTURE_DATA:
        return {
            ...state,
            structures: action.data
        };
    case ADD_ANUGA_STRUCTURE:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_BOUNDARY_DATA:
        return {
            ...state,
            boundaries: action.data
        };
    case ADD_ANUGA_BOUNDARY:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_ELEVATION_DATA:
        return {
            ...state,
            elevations: action.data
        };
    case SET_ADD_ANUGA_ELEVATION_DATA:
        return {
            ...state,
            showAddAnugaElevationData: action.visible,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_AVAILABLE_ELEVATION_DATA:
        return {
            ...state,
            availableElevations: action.data
        };
    case SET_ANUGA_INPUT_MENU:
        return {
            ...state,
            showAnugaInputMenu: action.visible,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_SCENARIO_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: action.visible,
            showAnugaResultMenu: false
        };
    case SET_ANUGA_RESULT_MENU:
        return {
            ...state,
            showAnugaScenarioMenu: false,
            showAnugaInputMenu: false,
            showAnugaResultMenu: action.visible
        };
    default:
        return state;
    }
};

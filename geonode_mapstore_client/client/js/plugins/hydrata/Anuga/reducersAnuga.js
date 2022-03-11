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
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_STRUCTURE_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_MESH_REGION_DATA,
    SET_ANUGA_ELEVATION_DATA,
    SET_CREATING_ANUGA_LAYER,
    BUILD_ANUGA_SCENARIO,
    SET_ANUGA_SCENARIO_IS_LOADED
} from "./actionsAnuga";

import {
    SET_OPEN_MENU_GROUP_ID
} from "../SimpleView/actionsSimpleView";

const initialState = {
    showAddAnugaElevationData: false,
    visibleAnugaScenarioLogId: false,
    scenarios: []
};

export default ( state = initialState, action) => {
    console.log('anuga:', action);
    switch (action.type) {
    case SET_CREATING_ANUGA_LAYER:
        return {
            ...state,
            isCreatingAnugaLayer: action.isCreatingAnugaLayer
        };
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
                scenario.latest_run = newScenario?.latest_run || {status: 'unsaved'};
                scenario.status = newScenario?.status || 'unsaved';
                return scenario;
            })
        };
    case ADD_ANUGA_SCENARIO:
        return {
            ...state,
            scenarios: [
                ...state.scenarios,
                {
                    "id": null,
                    "name": "",
                    "code": null,
                    "description": "",
                    "maximum_triangle_area": 10,
                    "constant_rainfall": null,
                    "duration": null,
                    "status": "new",
                    "project": state?.project?.id,
                    "boundary": "",
                    "elevation": "",
                    "unsaved": false
                }]
        };
    case BUILD_ANUGA_SCENARIO:
        return {
            ...state,
            scenarios: state.scenarios?.map(scenario => {
                if (scenario.id === action.scenario.id) {
                    scenario.status = 'building';
                }
                return scenario;
            })
        };
    case SET_ANUGA_SCENARIO_IS_LOADED:
        return {
            ...state,
            scenarios: state.scenarios.map((scenario) => {
                if (scenario.id === action.scenarioId) {
                    scenario.isLoaded = action.isLoaded;
                    return scenario;
                }
                return scenario;
            })
        };
    case SHOW_ANUGA_SCENARIO_LOG:
        return {
            ...state,
            visibleAnugaScenarioLogId: action.scenarioId
        };
    case SAVE_ANUGA_SCENARIO_SUCCESS:
        return {
            ...state,
            scenarios: state.scenarios.map((scenario) => {
                if (scenario.id === action.scenario.id) {
                    action.scenario.unsaved = false;
                    return action.scenario;
                }
                if (!scenario.id) {
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
        if (action.data) {
            return {
                ...state,
                project: action.data
            };
        }
        return state;
    case SET_ANUGA_SCENARIO_DATA:
        if (state.scenarios.length === 0) {
            return {
                ...state,
                scenarios: action.scenarios
            };
        }
        return {
            ...state,
            scenarios: state.scenarios?.map((scenario) => {
                if (scenario.unsaved) {
                    return {
                        ...action.scenario,
                        unsaved: true
                    };
                }
                if (scenario?.id === action.scenario.id) {
                    action.scenario.unsaved = false;
                    return action.scenario;
                }
                return scenario;
            })
        };
    case SET_ANUGA_INFLOW_DATA:
        return {
            ...state,
            inflows: action.data
        };
    case SET_ANUGA_FRICTION_DATA:
        return {
            ...state,
            frictions: action.data
        };
    case SET_ANUGA_STRUCTURE_DATA:
        return {
            ...state,
            structures: action.data
        };
    case SET_ANUGA_BOUNDARY_DATA:
        return {
            ...state,
            boundaries: action.data
        };
    case SET_ANUGA_ELEVATION_DATA:
        return {
            ...state,
            elevations: action.data
        };
    case SET_ANUGA_MESH_REGION_DATA:
        return {
            ...state,
            meshRegions: action.data
        };
    case SET_OPEN_MENU_GROUP_ID:
        if (action.openMenuGroupId) {
            return {
                ...state,
                showAnugaInputMenu: false,
                showAnugaScenarioMenu: false,
                showAnugaResultMenu: false
            };
        }
        return state;
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

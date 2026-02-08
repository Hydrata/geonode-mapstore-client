import {
    FETCH_SCENARIOS_CONFIG_SUCCESS,
    FETCH_SCENARIOS_CONFIG,
    FETCH_SCENARIO_OVERVIEW_SUCCESS,
    FETCH_SCENARIO_OVERVIEW,
    TOGGLE_SCENARIO_MANAGER,
    HIDE_SCENARIO_MANAGER,
    SHOW_SCENARIO_OVERVIEW,
    HIDE_SCENARIO_OVERVIEW,
    CREATE_SCENARIO,
    SELECT_SCENARIO,
    UPDATE_SCENARIO,
    SAVE_SCENARIO_SUCCESS,
    RUN_SCENARIO,
    RUN_SCENARIO_SUCCESS,
    DELETE_SCENARIO,
    DELETE_SCENARIO_SUCCESS
} from "./actionsScenarios";

const widgetDefaults = {
    'number': 0,
    'text': '',
    'select': '',
    'resultButton': ''
};

export default ( state = {}, action) => {
    switch (action.type) {
    case FETCH_SCENARIOS_CONFIG:
        return {
            ...state,
            fetching: action.mapId
        };
    case FETCH_SCENARIOS_CONFIG_SUCCESS:
        return {
            ...state,
            fetching: null,
            hasScenarioConfig: true,
            config: action.payload
        };
    case FETCH_SCENARIO_OVERVIEW:
        return {
            ...state,
            fetchingOverview: action.mapId
        };
    case FETCH_SCENARIO_OVERVIEW_SUCCESS:
        return {
            ...state,
            fetchingOverview: null,
            hasScenarioOverview: true,
            scenarioOverview: {
                ...state?.scenarioOverview,
                scenarios: action.data
            }
        };
    case TOGGLE_SCENARIO_MANAGER:
        return {
            ...state,
            visibleScenarioManager: !state.visibleScenarioManager
        };
    case HIDE_SCENARIO_MANAGER:
        return {
            ...state,
            visibleScenarioManager: false
        };
    case SHOW_SCENARIO_OVERVIEW:
        return {
            ...state,
            activeScenarioClass: action?.slug,
            visibleScenarioOverview: true,
            scenarioOverview: {
                ...state.scenarioOverview,
                title: action?.title,
                slug: action?.slug
            }
        };
    case HIDE_SCENARIO_OVERVIEW:
        return {
            ...state,
            activeScenarioClass: null,
            visibleScenarioOverview: false,
            scenarioOverview: {
                ...state.scenarioOverview,
                title: null,
                slug: null,
                scenarios: []
            }
        };
    case UPDATE_SCENARIO:
        return {
            ...state,
            scenarioOverview: {
                ...state.scenarioOverview,
                scenarios: state.scenarioOverview.scenarios.map((scen) => {
                    if (scen.id === action.scenario.id) {
                        action.scenario.unsaved = true;
                        return action.scenario;
                    }
                    return scen;
                })
            }
        };
    case SAVE_SCENARIO_SUCCESS:
        return {
            ...state,
            scenarioOverview: {
                ...state.scenarioOverview,
                scenarios: state.scenarioOverview.scenarios.map((scen) => {
                    if (scen && !scen.id) {
                        return action.scenario;
                    }
                    if (scen.id === action.scenario.id) {
                        action.scenario.unsaved = false;
                        return action.scenario;
                    }
                    return scen;
                })
            }
        };
    case DELETE_SCENARIO_SUCCESS:
        return {
            ...state,
            scenarioOverview: {
                ...state.scenarioOverview,
                scenarios: state.scenarioOverview.scenarios.filter((scen) => scen?.id !== action.scenario.id)
            }
        };
    case SELECT_SCENARIO:
        return {
            ...state,
            selectedScenario: action.scenario
        };
    case CREATE_SCENARIO:
        const newScenario = {};
        action.fields.map((field) => {
            newScenario[field.name] = widgetDefaults[field.widget];
            newScenario.project = action.projectId;
            newScenario.slug = state.activeScenarioClass;
            newScenario.unsaved = true;
            newScenario.state = 'active';
        });
        return {
            ...state,
            scenarioOverview: {
                ...state.scenarioOverview,
                scenarios: [...state.scenarioOverview.scenarios, newScenario]
            }
        };
    default:
        return state;
    }
};

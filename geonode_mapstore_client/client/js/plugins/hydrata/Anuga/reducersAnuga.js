import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_NETWORK_MENU,
    SET_REVIEW_PANEL,
    SET_PUBLICATION_PANEL,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_SCENARIO_DATA,
    SET_PUBLICATION_DATA,
    UPDATE_ANUGA_SCENARIO,
    UPDATE_NETWORK,
    SELECT_ANUGA_SCENARIO,
    ADD_ANUGA_SCENARIO,
    SHOW_ANUGA_SCENARIO_LOG,
    SHOW_ANUGA_RUN_MENU,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    SET_ANUGA_POLLING_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_STRUCTURE_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_FULL_MESH_DATA,
    SET_ANUGA_MESH_REGION_DATA,
    SET_LUMPED_CATCHMENT_DATA,
    SET_NETWORK_DATA,
    SET_ANUGA_NODES_DATA,
    SET_ANUGA_LINKS_DATA,
    SET_ANUGA_ELEVATION_DATA,
    SET_COMPARISON_DATA,
    SET_CREATING_ANUGA_LAYER,
    SET_ANUGA_SCENARIO_IS_LOADED,
    UPDATE_COMPUTE_INSTANCE_SUCCESS,
    TOGGLE_SCENARIO_SELECTED,
    SET_ANUGA_RESOURCES
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
    // console.log('state ar: ', state);
    console.log('action for Anuga: ', action);
    switch (action.type) {
    case SET_CREATING_ANUGA_LAYER:
        return {
            ...state,
            isCreatingAnugaLayer: action.isCreatingAnugaLayer
        };
    case SET_ANUGA_RESOURCES:
        // console.log('** anugaHomePageResources', action.data);
        return {
            ...state,
            anugaHomePageResources: {
                ...action.data,
                projects: action.data?.projects
                    ?.map(project => project?.base_map_full)
                    .filter(map => !map.featured)
            }
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
    case UPDATE_NETWORK:
        return {
            ...state,
            networks: state.networks.map((network) => {
                if (network.id === action.network.id) {
                    action.network.unsaved = true;
                    return action.network;
                }
                return network;
            })
        };
    case TOGGLE_SCENARIO_SELECTED:
        return {
            ...state,
            scenarios: state.scenarios.map((scenario) => {
                if (scenario.id === action.scenario.id) {
                    action.scenario.selected = !scenario.selected;
                    return action.scenario;
                }
                return scenario;
            })
        };
    case SET_ANUGA_POLLING_DATA:
        let scenarios = state.scenarios.map(scenario => {
            const newScenario = action.scenarios.filter(actionScenario => scenario.id === actionScenario.id)[0];
            scenario.latest_run = {...newScenario?.latest_run};
            scenario.status = newScenario?.status || 'unsaved';
            scenario.latest_run_is_valid = newScenario?.latest_run_is_valid;
            return scenario;
        });
        // also check for copied new scenarios (this happens on the backend):
        const frontendScenarioIds = state.scenarios?.map(scenario => scenario?.id);
        const newCopiedScenario = action.scenarios?.filter(backendScenario => !frontendScenarioIds.includes(backendScenario.id))?.[0];
        if (newCopiedScenario) {
            scenarios = [
                ...scenarios,
                newCopiedScenario
            ];
        }
        return {
            ...state,
            scenarios: scenarios,
            selectedScenario: action.scenarios.filter(actionScenario => state.selectedScenarioId === actionScenario.id)[0]
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
                    "maximum_triangle_area": 1000,
                    "constant_rainfall": null,
                    "duration": null,
                    "status": "new",
                    "project": state?.projectData?.id,
                    "boundary": "",
                    "elevation": "",
                    "log": "log placeholder",
                    "unsaved": false,
                    "selected": false
                }]
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
    case SHOW_ANUGA_RUN_MENU:
        return {
            ...state,
            visibleAnugaRunMenu: action.visible
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
            selectedScenarioId: action.scenario.id,
            selectedScenario: action.scenario
        };
    case SET_ANUGA_PROJECT_DATA:
        return {
            ...state,
            projectData: action.data
        };
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
                if (scenario?.id === action.scenario?.id) {
                    action.scenario.unsaved = false;
                    return action.scenario;
                }
                return scenario;
            })
        };
    case UPDATE_COMPUTE_INSTANCE_SUCCESS:
        return {
            ...state,
            computeInstances: action.data
        };
    case SET_COMPARISON_DATA:
        return {
            ...state,
            comparisons: action.data
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
    case SET_ANUGA_FULL_MESH_DATA:
        return {
            ...state,
            fullMeshes: action.data
        };
    case SET_ANUGA_MESH_REGION_DATA:
        return {
            ...state,
            meshRegions: action.data
        };
    case SET_NETWORK_DATA:
        return {
            ...state,
            networks: action.data
        };
    case SET_LUMPED_CATCHMENT_DATA:
        return {
            ...state,
            catchments: action.data
        };
    case SET_ANUGA_NODES_DATA:
        return {
            ...state,
            nodes: action.data
        };
    case SET_ANUGA_LINKS_DATA:
        return {
            ...state,
            links: action.data
        };
    case SET_PUBLICATION_DATA:
        return {
            ...state,
            publications: action.data
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
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showReviewPanel: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_SCENARIO_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: action.visible,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showReviewPanel: false,
            showPublicationPanel: false
        };
    case SET_ANUGA_RESULT_MENU:
        return {
            ...state,
            showAnugaScenarioMenu: false,
            showAnugaInputMenu: false,
            showAnugaResultMenu: action.visible,
            showNetworkMenu: false,
            showReviewPanel: false,
            showPublicationPanel: false
        };
    case SET_NETWORK_MENU:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: action.visible,
            showReviewPanel: false,
            showPublicationPanel: false
        };
    case SET_REVIEW_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showReviewPanel: action.visible,
            showPublicationPanel: false
        };
    case SET_PUBLICATION_PANEL:
        return {
            ...state,
            showAnugaInputMenu: false,
            showAnugaScenarioMenu: false,
            showAnugaResultMenu: false,
            showNetworkMenu: false,
            showReviewPanel: false,
            showPublicationPanel: action.visible
        };
    default:
        return state;
    }
};

import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_INFLOW_DATA,
    SET_ANUGA_FRICTION_DATA,
    SET_ANUGA_STAGE_DATA,
    SET_ANUGA_BOUNDARY_DATA,
    SET_ANUGA_ELEVATION_DATA
} from "./actionsAnuga";

const initialState = {
};

export default ( state = initialState, action) => {
    // console.log(action);
    switch (action.type) {
    case SET_ANUGA_PROJECT_DATA:
        return {
            ...state,
            project: action.data
        };
    case SET_ANUGA_SCENARIO_DATA:
        return {
            ...state,
            scenarios: action.data
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
    case SET_ANUGA_STAGE_DATA:
        return {
            ...state,
            stages: action.data
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

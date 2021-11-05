import {
    SET_ANUGA_INPUT_MENU,
    SET_ANUGA_SCENARIO_MENU,
    SET_ANUGA_RESULT_MENU,
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_SCENARIO_DATA
} from "./actionsAnuga";

const initialState = {
};

export default ( state = initialState, action) => {
    // console.log(action);
    switch (action.type) {
    case SET_ANUGA_PROJECT_DATA:
        console.log('SET_ANUGA_PROJECT_DATA heard', action);
        return {
            ...state,
            project: action.data
        };
    case SET_ANUGA_SCENARIO_DATA:
        console.log('SET_ANUGA_SCENARIO_DATA heard', action);
        return {
            ...state,
            scenarios: action.data
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

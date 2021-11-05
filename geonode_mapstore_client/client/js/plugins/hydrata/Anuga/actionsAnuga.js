const INIT_ANUGA = 'INIT_ANUGA';
const SET_ANUGA_INPUT_MENU = 'SET_ANUGA_INPUT_MENU';
const SET_ANUGA_SCENARIO_MENU = 'SET_ANUGA_SCENARIO_MENU';
const SET_ANUGA_RESULT_MENU = 'SET_ANUGA_RESULT_MENU';
const SET_ANUGA_PROJECT_DATA = 'SET_ANUGA_PROJECT_DATA';
const SET_ANUGA_SCENARIO_DATA = 'SET_ANUGA_SCENARIO_DATA';

function initAnuga() {
    return {
        type: INIT_ANUGA
    };
}

function setAnugaInputMenu(visible) {
    return {
        type: SET_ANUGA_INPUT_MENU,
        visible
    };
}

function setAnugaScenarioMenu(visible) {
    return {
        type: SET_ANUGA_SCENARIO_MENU,
        visible
    };
}

function setAnugaResultMenu(visible) {
    return {
        type: SET_ANUGA_RESULT_MENU,
        visible
    };
}

function setAnugaProjectData(data) {
    console.log('setAnugaProjectData', data);
    return {
        type: SET_ANUGA_PROJECT_DATA,
        data
    };
}

function setAnugaScenarioData(data) {
    return {
        type: SET_ANUGA_SCENARIO_DATA,
        data
    };
}

module.exports = {
    INIT_ANUGA, initAnuga,
    SET_ANUGA_INPUT_MENU, setAnugaInputMenu,
    SET_ANUGA_SCENARIO_MENU, setAnugaScenarioMenu,
    SET_ANUGA_RESULT_MENU, setAnugaResultMenu,
    SET_ANUGA_PROJECT_DATA, setAnugaProjectData,
    SET_ANUGA_SCENARIO_DATA, setAnugaScenarioData
};

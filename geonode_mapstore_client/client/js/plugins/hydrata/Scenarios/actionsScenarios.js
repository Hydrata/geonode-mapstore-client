const axios = require('../../libs/ajax');

const FETCH_SCENARIOS_CONFIG = 'FETCH_SCENARIOS_CONFIG';
const FETCH_SCENARIOS_CONFIG_ERROR = 'FETCH_SCENARIOS_CONFIG_ERROR';
const FETCH_SCENARIOS_CONFIG_SUCCESS = 'FETCH_SCENARIOS_CONFIG_SUCCESS';
const FETCH_SCENARIO_OVERVIEW = 'FETCH_SCENARIO_OVERVIEW';
const FETCH_SCENARIO_OVERVIEW_ERROR = 'FETCH_SCENARIO_OVERVIEW_ERROR';
const FETCH_SCENARIO_OVERVIEW_SUCCESS = 'FETCH_SCENARIO_OVERVIEW_SUCCESS';
const TOGGLE_SCENARIO_MANAGER = 'TOGGLE_SCENARIO_MANAGER';
const HIDE_SCENARIO_MANAGER = 'HIDE_SCENARIO_MANAGER';
const SHOW_SCENARIO_OVERVIEW = 'SHOW_SCENARIO_OVERVIEW';
const HIDE_SCENARIO_OVERVIEW = 'HIDE_SCENARIO_OVERVIEW';
const UPDATE_SCENARIO = 'UPDATE_SCENARIO';
const CREATE_SCENARIO = 'CREATE_SCENARIO';
const SELECT_SCENARIO = 'SELECT_SCENARIO';
const SAVE_SCENARIO = 'SAVE_SCENARIO';
const SAVE_SCENARIO_SUCCESS = 'SAVE_SCENARIO_SUCCESS';
const SAVE_SCENARIO_ERROR = 'SAVE_SCENARIO_ERROR';
const RUN_SCENARIO = 'RUN_SCENARIO';
const RUN_SCENARIO_SUCCESS = 'RUN_SCENARIO_SUCCESS';
const RUN_SCENARIO_ERROR = 'RUN_SCENARIO_ERROR';
const DELETE_SCENARIO = 'DELETE_SCENARIO';
const DELETE_SCENARIO_SUCCESS = 'DELETE_SCENARIO_SUCCESS';
const DELETE_SCENARIO_ERROR = 'DELETE_SCENARIO_ERROR';

const fetchScenariosConfigSuccess = (config) => {
    return {
        type: FETCH_SCENARIOS_CONFIG_SUCCESS,
        payload: config
    };
};

function fetchScenariosConfigError(e) {
    // console.log('*** error:', e);
    return {
        type: FETCH_SCENARIOS_CONFIG_ERROR,
        error: e
    };
}

const fetchScenariosConfig = (dispatch) => {
    return (mapId) => {
        return axios.get(`/scenarios/api/${mapId}/config/`
        ).then(
            response => {
                dispatch(fetchScenariosConfigSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchScenariosConfigError(e));
            }
        );
    };
};

const fetchScenarioOverviewSuccess = (data) => {
    return {
        type: FETCH_SCENARIO_OVERVIEW_SUCCESS,
        data: data
    };
};

function fetchScenarioOverviewError(e) {
    // console.log('*** error:', e);
    return {
        type: FETCH_SCENARIO_OVERVIEW_ERROR,
        error: e
    };
}

const fetchScenarioOverview = (mapId, scenarioSlug) => {
    console.log('fetchScenarioOverview', mapId, scenarioSlug);
    return (dispatch) => {
        return axios.get(`/scenarios/api/${mapId}/${scenarioSlug}/`
        ).then(
            response => {
                dispatch(fetchScenarioOverviewSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(fetchScenarioOverviewError(e));
            }
        );
    };
};

const saveScenarioSuccess = (data) => {
    return {
        type: SAVE_SCENARIO_SUCCESS,
        scenario: data
    };
};

function saveScenarioError(e) {
    // console.log('*** error:', e);
    return {
        type: SAVE_SCENARIO_ERROR,
        error: e
    };
}

const saveScenario = (mapId, scenario) => {
    if (scenario.id) {
        return (dispatch) => {
            return axios.put(`/scenarios/api/${mapId}/${scenario.slug}/${scenario.id}/`, scenario
            ).then(
                response => {
                    dispatch(saveScenarioSuccess(response.data));
                }
            ).catch(
                e => {
                    dispatch(saveScenarioError(e));
                }
            );
        };
    }
    return (dispatch) => {
        return axios.post(`/scenarios/api/${mapId}/${scenario.slug}/`, scenario
        ).then(
            response => {
                dispatch(saveScenarioSuccess(response.data));
            }
        ).catch(
            e => {
                dispatch(saveScenarioError(e));
            }
        );
    };
};

const runScenarioSuccess = (data) => {
    return {
        type: RUN_SCENARIO_SUCCESS,
        data: data
    };
};

function runScenarioError(e) {
    // console.log('*** error:', e);
    return {
        type: RUN_SCENARIO_ERROR,
        error: e
    };
}

const runScenario = (mapId, scenario) => {
    return (dispatch) => {
        return axios.post(`/scenarios/api/${mapId}/${scenario.slug}/${scenario.id}/run/`, scenario
        ).then(
            response => {
                dispatch(runScenarioSuccess(scenario));
                dispatch(fetchScenarioOverview(mapId, scenario.slug));
            }
        ).catch(
            e => {
                dispatch(runScenarioError(e));
            }
        );
    };
};

const deleteScenarioSuccess = (scenario) => {
    return {
        type: DELETE_SCENARIO_SUCCESS,
        scenario: scenario
    };
};

function deleteScenarioError(e) {
    // console.log('*** error:', e);
    return {
        type: DELETE_SCENARIO_ERROR,
        error: e
    };
}

const deleteScenario = (mapId, scenario) => {
    return (dispatch) => {
        return axios.delete(`/scenarios/api/${mapId}/${scenario.slug}/${scenario.id}/`, scenario
        ).then(
            response => {
                dispatch(deleteScenarioSuccess(scenario));
            }
        ).catch(
            e => {
                dispatch(deleteScenarioError(e));
            }
        );
    };
};

const createScenario = (fields, projectId) => {
    return {
        type: CREATE_SCENARIO,
        fields,
        projectId: projectId
    };
};

const toggleScenarioManager = () => {
    return {
        type: TOGGLE_SCENARIO_MANAGER
    };
};

const hideScenarioManager = () => {
    return {
        type: HIDE_SCENARIO_MANAGER
    };
};

const showScenarioOverview = (scen) => {
    return {
        type: SHOW_SCENARIO_OVERVIEW,
        slug: scen?.slug,
        title: scen?.title
    };
};

const hideScenarioOverview = () => {
    return {
        type: HIDE_SCENARIO_OVERVIEW
    };
};

const selectScenario = (scenario) => {
    return {
        type: SELECT_SCENARIO,
        scenario
    };
};

const updateScenario = (scenario, kv) => {
    return {
        type: UPDATE_SCENARIO,
        scenario: {
            ...scenario,
            ...kv
        }
    };
};

module.exports = {
    FETCH_SCENARIOS_CONFIG, fetchScenariosConfig,
    FETCH_SCENARIOS_CONFIG_ERROR, fetchScenariosConfigError,
    FETCH_SCENARIOS_CONFIG_SUCCESS, fetchScenariosConfigSuccess,
    FETCH_SCENARIO_OVERVIEW, fetchScenarioOverview,
    FETCH_SCENARIO_OVERVIEW_ERROR, fetchScenarioOverviewError,
    FETCH_SCENARIO_OVERVIEW_SUCCESS, fetchScenarioOverviewSuccess,
    TOGGLE_SCENARIO_MANAGER, toggleScenarioManager,
    HIDE_SCENARIO_MANAGER, hideScenarioManager,
    SHOW_SCENARIO_OVERVIEW, showScenarioOverview,
    HIDE_SCENARIO_OVERVIEW, hideScenarioOverview,
    UPDATE_SCENARIO, updateScenario,
    CREATE_SCENARIO, createScenario,
    SELECT_SCENARIO, selectScenario,
    SAVE_SCENARIO, saveScenario,
    SAVE_SCENARIO_SUCCESS, saveScenarioSuccess,
    SAVE_SCENARIO_ERROR, saveScenarioError,
    RUN_SCENARIO_SUCCESS, runScenario,
    RUN_SCENARIO_ERROR, runScenarioSuccess,
    RUN_SCENARIO, runScenarioError,
    DELETE_SCENARIO_SUCCESS, deleteScenarioSuccess,
    DELETE_SCENARIO_ERROR, deleteScenarioError,
    DELETE_SCENARIO, deleteScenario
};

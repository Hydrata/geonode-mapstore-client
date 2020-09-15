const axios = require('../../MapStore2/web/client/libs/ajax');

const FETCH_PROJECT_MANAGER_CONFIG = 'FETCH_PROJECT_MANAGER_CONFIG';
const FETCH_PROJECT_MANAGER_CONFIG_ERROR = 'FETCH_PROJECT_MANAGER_CONFIG_ERROR';
const SET_PROJECT_MANAGER_CONFIG = 'SET_PROJECT_MANAGER_CONFIG';

const setProjectManagerConfig = (config) => {
    return {
        type: SET_PROJECT_MANAGER_CONFIG,
        config
    };
};

function fetchProjectManagerConfigError(e) {
    return {
        type: FETCH_PROJECT_MANAGER_CONFIG_ERROR,
        error: e
    };
}

function fetchProjectManagerConfig(mapId) {
    return (dispatch) => {
        return axios.get(`/projects/api/maps/${mapId}/`
        ).then(
            response => {
                dispatch(setProjectManagerConfig(response.data.project));
            }
        ).catch((e) => {
            dispatch(fetchProjectManagerConfigError(e));
        });
    };
}


module.exports = {
    FETCH_PROJECT_MANAGER_CONFIG, fetchProjectManagerConfig,
    SET_PROJECT_MANAGER_CONFIG, setProjectManagerConfig
};

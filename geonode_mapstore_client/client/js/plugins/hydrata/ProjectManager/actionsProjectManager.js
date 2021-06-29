const axios = require('../../../../MapStore2/web/client/libs/ajax');

const FETCH_PROJECT_MANAGER_CONFIG = 'FETCH_PROJECT_MANAGER_CONFIG';
const FETCH_PROJECT_MANAGER_CONFIG_ERROR = 'FETCH_PROJECT_MANAGER_CONFIG_ERROR';
const FETCH_PROJECT_MANAGER_CONFIG_SUCCESS = 'FETCH_PROJECT_MANAGER_CONFIG_SUCCESS';
const SET_MENU_GROUP = 'SET_MENU_GROUP';
const SET_ORG_VISIBILITY = 'SET_ORG_VISIBILITY';

const fetchProjectManagerConfigSuccess = (config) => {
    return {
        type: FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
        payload: config
    };
};

function fetchProjectManagerConfigError(e) {
    console.log('*** error:', e);
    return {
        type: FETCH_PROJECT_MANAGER_CONFIG_ERROR,
        error: e
    };
}

const fetchProjectManagerConfig = (dispatch) => {
    return (mapId) => {
        return axios.get(`/projects/api/maps/${mapId}/`
        ).then(
            response => {
                dispatch(fetchProjectManagerConfigSuccess(response.data.project));
            }
        ).catch(
            e => {
                dispatch(fetchProjectManagerConfigError(e));
            }
        );
    };
};

function setMenuGroup(menuGroup) {
    return {
        type: SET_MENU_GROUP,
        payload: menuGroup
    };
}

const setOrgVisibility = (org, isVisible) => {
    console.log('setOrgVisibility:', org, isVisible);
    return (dispatch) => {
        dispatch({
            type: 'SET_ORG_VISIBILITY',
            org: org,
            isVisible: isVisible
        });
    };
};


module.exports = {
    FETCH_PROJECT_MANAGER_CONFIG, fetchProjectManagerConfig,
    FETCH_PROJECT_MANAGER_CONFIG_ERROR, fetchProjectManagerConfigError,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS, fetchProjectManagerConfigSuccess,
    SET_MENU_GROUP, setMenuGroup,
    SET_ORG_VISIBILITY, setOrgVisibility
};

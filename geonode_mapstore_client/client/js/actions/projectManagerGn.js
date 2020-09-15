const LOAD_PROJECT_MANAGER_CONFIG = 'LOAD_PROJECT_MANAGER_CONFIG';


const loadProjectManagerConfig = (mapId) => {
    return {
        type: LOAD_PROJECT_MANAGER_CONFIG,
        mapId
    };
};


module.exports = {
    LOAD_PROJECT_MANAGER_CONFIG, loadProjectManagerConfig
};

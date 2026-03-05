import { combineReducers } from 'redux';
import projects from './reducers/projectsReducer';
import scenarios from './reducers/scenariosReducer';
import runs from './reducers/runsReducer';
import ui from './reducers/uiReducer';
import resources from './reducers/resourcesReducer';

export default combineReducers({ projects, scenarios, runs, ui, resources });

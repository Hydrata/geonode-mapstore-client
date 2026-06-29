import { combineReducers } from 'redux';
import projects from './reducers/projectsReducer';
import scenarios from './reducers/scenariosReducer';
import runs from './reducers/runsReducer';
import ui from './reducers/uiReducer';
import resources from './reducers/resourcesReducer';
import memberships from './reducers/membershipsReducer';
// TASK-1993 (W2.1): mount the map-click disambiguation slice under the ANUGA
// plugin's combineReducers -> state.anuga.clickDisambiguation (mirrors Swamm's
// state.swamm.bmpChooserCandidates precedent). W1 (TASK-1991) shipped it unmounted.
import clickDisambiguation from './reducers/clickDisambiguationReducer';

export default combineReducers({ projects, scenarios, runs, ui, resources, memberships, clickDisambiguation });

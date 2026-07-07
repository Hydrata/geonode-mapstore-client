import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import TaskMonitorContainer from './components/TaskMonitorContainer';
import processReducer from './reducers/processReducer';
import uiReducer from './reducers/uiReducer';
import {
    autoStartTaskMonitorEpic,
    pollActiveCountEpic,
    pollProcessListEpic,
    loadProcessDetailEpic,
    cancelProcessEpic,
    terrainExportEpic,
    trackTaskMonitorPanelToggleEpic,
    trackTerminalStatusSeenEpic
} from './epicsTaskMonitor';

// Combined reducer
const taskMonitor = (state = {}, action) => ({
    processes: processReducer(state.processes, action),
    ui: uiReducer(state.ui, action)
});

export default createPlugin('TaskMonitor', {
    component: TaskMonitorContainer,
    reducers: {
        taskMonitor
    },
    epics: {
        autoStartTaskMonitorEpic,
        pollActiveCountEpic,
        pollProcessListEpic,
        loadProcessDetailEpic,
        cancelProcessEpic,
        terrainExportEpic,
        trackTaskMonitorPanelToggleEpic,
        trackTerminalStatusSeenEpic
    }
});

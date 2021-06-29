import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import projectManager from "./reducersProjectManager";
import projectManagerContainer from "./components/projectManagerContainer";

export default createPlugin('ProjectManager', {
    component: projectManagerContainer,
    reducers: {
        projectManager
    }
});

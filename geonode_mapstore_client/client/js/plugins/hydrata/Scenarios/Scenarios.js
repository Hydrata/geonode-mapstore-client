import { createPlugin } from '../../utils/PluginsUtils';
import scenarios from "./reducersScenarios";
import ScenariosContainer from "./components/scenariosContainer";

export default createPlugin('Scenarios', {
    component: ScenariosContainer,
    reducers: {
        scenarios
    }
});

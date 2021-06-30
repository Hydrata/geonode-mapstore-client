import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import simpleView from "./reducersSimpleView";
import simpleViewContainer from "./components/simpleViewContainer";

export default createPlugin('SimpleView', {
    component: simpleViewContainer,
    reducers: {
        simpleView
    }
});

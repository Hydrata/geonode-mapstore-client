import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import simpleView from "./reducersSimpleView";
import simpleViewContainer from "./components/simpleViewContainer";
import {
    beginEditLayerEpic,
    updateDatasetTitle
} from "./epicsSimpleView";

export default createPlugin('SimpleView', {
    component: simpleViewContainer,
    reducers: {
        simpleView
    },
    epics: {
        beginEditLayerEpic,
        updateDatasetTitle
    }
});

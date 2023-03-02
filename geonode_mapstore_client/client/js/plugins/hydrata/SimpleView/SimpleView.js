import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import simpleView from "./reducersSimpleView";
import simpleViewContainer from "./components/simpleViewContainer";
import {
    beginEditLayerEpic,
    updateDatasetTitleEpic,
    svDownloadLayerEpic,
    submitAttributeFormEpic
} from "./epicsSimpleView";

export default createPlugin('SimpleView', {
    component: simpleViewContainer,
    reducers: {
        simpleView
    },
    epics: {
        beginEditLayerEpic,
        updateDatasetTitleEpic,
        svDownloadLayerEpic,
        submitAttributeFormEpic
    }
});

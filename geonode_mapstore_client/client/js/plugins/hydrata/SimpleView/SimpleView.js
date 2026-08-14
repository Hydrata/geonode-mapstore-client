import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import simpleView from "./reducersSimpleView";
import simpleViewContainer from "./components/simpleViewContainer";
import {
    beginEditLayerEpic,
    updateDatasetTitleEpic,
    svDownloadLayerEpic,
    submitAttributeFormEpic,
    submitSimpleViewAttributeFormSuccessEpic,
    trackVirtualPageviewEpic
} from "./epicsSimpleView";
// Epic 2765 W3 — the project introduction. It lives on the SimpleView plugin
// because simpleViewContainer is what RENDERS the modal (line ~350) and
// SimpleView is the one Hydrata plugin every site's map_viewer carries; the
// ANUGA-only gate is inside introductionGate.js, not in this registration.
import {
    introductionFetchEpic,
    introductionAutoShowEpic,
    introductionAcceptEpic
} from "./epicsIntroduction";

export default createPlugin('SimpleView', {
    component: simpleViewContainer,
    reducers: {
        simpleView
    },
    epics: {
        beginEditLayerEpic,
        updateDatasetTitleEpic,
        svDownloadLayerEpic,
        submitAttributeFormEpic,
        submitSimpleViewAttributeFormSuccessEpic,
        trackVirtualPageviewEpic,
        introductionFetchEpic,
        introductionAutoShowEpic,
        introductionAcceptEpic
    }
});

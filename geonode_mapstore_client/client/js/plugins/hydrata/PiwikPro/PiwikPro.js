import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import piwikPro from "./reducersPiwikPro";
import piwikProContainer from "./components/piwikProContainer";

export default createPlugin('piwikPro', {
    component: piwikProContainer,
    reducers: {
        piwikPro
    },
    epics: {}
});

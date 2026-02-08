import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import swamps from "./reducersSwamps";
import swampsContainer from "./components/swampsContainer";
import {
    initSwampsEpic,
    refreshSwampsEpic,
    queryLayerAttributesToStoreStep1,
    queryLayerAttributesToStoreStep2,
    queryLayerAttributesToStoreStep3
} from "./epicsSwamps";

export default createPlugin('Swamps', {
    component: swampsContainer,
    reducers: {
        swamps
    },
    epics: {
        initSwampsEpic,
        refreshSwampsEpic,
        queryLayerAttributesToStoreStep1,
        queryLayerAttributesToStoreStep2,
        queryLayerAttributesToStoreStep3
    }
});

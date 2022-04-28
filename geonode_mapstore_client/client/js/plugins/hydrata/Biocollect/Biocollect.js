import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import biocollect from "./reducersBiocollect";
import biocollectContainer from "./components/biocollectContainer";
import {
    queryLayerAttributesToStoreStep1,
    queryLayerAttributesToStoreStep2,
    queryLayerAttributesToStoreStep3
} from "./epicsBiocollect";

export default createPlugin('Biocollect', {
    component: biocollectContainer,
    reducers: {
        biocollect
    },
    epics: {
        queryLayerAttributesToStoreStep1,
        queryLayerAttributesToStoreStep2,
        queryLayerAttributesToStoreStep3
    }
});

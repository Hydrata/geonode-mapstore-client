import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import biocollect from "./reducersBiocollect";
import biocollectContainer from "./components/biocollectContainer";

export default createPlugin('Biocollect', {
    component: biocollectContainer,
    reducers: {
        biocollect
    }
});

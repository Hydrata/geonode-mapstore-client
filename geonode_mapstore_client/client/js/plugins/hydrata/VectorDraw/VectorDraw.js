import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import VectorDrawPopup from './components/VectorDrawPopup';
import vectorDraw from './reducerVectorDraw';
import {
    vectorDrawStartEpic,
    vectorDrawSelectExistingEpic,
    vectorDrawSaveEpic,
    vectorDrawCancelEpic
} from './epicsVectorDraw';

export default createPlugin('VectorDraw', {
    component: VectorDrawPopup,
    reducers: { vectorDraw },
    epics: {
        vectorDrawStartEpic,
        vectorDrawSelectExistingEpic,
        vectorDrawSaveEpic,
        vectorDrawCancelEpic
    }
});

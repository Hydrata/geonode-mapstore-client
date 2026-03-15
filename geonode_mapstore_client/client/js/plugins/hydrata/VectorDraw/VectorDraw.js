import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import VectorDrawPopup from './components/VectorDrawPopup';
import vectorDraw from './reducerVectorDraw';
import {
    vectorDrawStartEpic,
    vectorDrawSaveEpic,
    vectorDrawCancelEpic
} from './epicsVectorDraw';

export default createPlugin('VectorDraw', {
    component: VectorDrawPopup,
    reducers: { vectorDraw },
    epics: {
        vectorDrawStartEpic,
        vectorDrawSaveEpic,
        vectorDrawCancelEpic
    }
});

import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import VectorDrawPopup from './components/VectorDrawPopup';
import vectorDraw from './reducerVectorDraw';
import {
    vectorDrawClearStaleGeometryEpic,
    vectorDrawStartEpic,
    vectorDrawSelectExistingEpic,
    vectorDrawSaveEpic,
    vectorDrawCancelEpic,
    vectorDrawDeleteEpic
} from './epicsVectorDraw';

export default createPlugin('VectorDraw', {
    component: VectorDrawPopup,
    reducers: { vectorDraw },
    epics: {
        // TASK-2830 — must be registered: an unregistered epic is dead code, and
        // this one is what stops a previous session's geometry being saved onto
        // the feature the operator just map-clicked.
        vectorDrawClearStaleGeometryEpic,
        vectorDrawStartEpic,
        vectorDrawSelectExistingEpic,
        vectorDrawSaveEpic,
        vectorDrawCancelEpic,
        vectorDrawDeleteEpic
    }
});

import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import swamm from "./reducersSwamm";
import SwammContainer from "./components/swammContainer";
import {
    startBmpCreateFeatureEpic,
    saveBmpCreateFeatureEpic,
    setCreateBmpDrawingLayerEpic,
    setEditBmpDrawingLayerEpic,
    startBmpEditFeatureEpic,
    saveBmpEditFeatureEpic,
    finishBmpCreateFeatureEpic,
    autoSaveBmpFormEpic,
    catchBmpFeatureClick,
    getBmpTypeGroups,
    downloadBmpReportEpic,
    updateBmpFilterEpic
} from "./epicsSwamm";

export default createPlugin('Swamm', {
    component: SwammContainer,
    reducers: {swamm},
    epics: {
        startBmpCreateFeatureEpic,
        saveBmpCreateFeatureEpic,
        setCreateBmpDrawingLayerEpic,
        setEditBmpDrawingLayerEpic,
        startBmpEditFeatureEpic,
        saveBmpEditFeatureEpic,
        finishBmpCreateFeatureEpic,
        autoSaveBmpFormEpic,
        catchBmpFeatureClick,
        getBmpTypeGroups,
        downloadBmpReportEpic,
        updateBmpFilterEpic
    }
});

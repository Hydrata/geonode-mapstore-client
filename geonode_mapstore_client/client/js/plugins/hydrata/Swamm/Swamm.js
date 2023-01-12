import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import swamm from "./reducersSwamm";
import SwammContainer from "./components/swammContainer";
import {
    initSwammEpic,
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
    filterBmpEpic
} from "./epicsSwamm";

export default createPlugin('Swamm', {
    component: SwammContainer,
    reducers: {swamm},
    epics: {
        initSwammEpic,
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
        filterBmpEpic
    }
});

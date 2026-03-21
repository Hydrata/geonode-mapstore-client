import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import swamm from "./reducersSwamm";
import SwammContainer from "./components/swammContainer";
import {
    initSwammEpic,
    initSwammFallbackEpic,
    vectorDrawSwammCompleteEpic,
    vectorDrawSwammCancelEpic,
    autoSaveBmpFormEpic,
    catchBmpFeatureClick,
    getBmpTypeGroups,
    downloadBmpReportEpic,
    filterBmpEpic,
    ensureBmpGeometriesGroupEpic
} from "./epicsSwamm";

export default createPlugin('Swamm', {
    component: SwammContainer,
    reducers: {swamm},
    epics: {
        initSwammEpic,
        initSwammFallbackEpic,
        vectorDrawSwammCompleteEpic,
        vectorDrawSwammCancelEpic,
        autoSaveBmpFormEpic,
        catchBmpFeatureClick,
        getBmpTypeGroups,
        downloadBmpReportEpic,
        filterBmpEpic,
        ensureBmpGeometriesGroupEpic
    }
});

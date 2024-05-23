import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import hydrology from "./reducersHydrology";
import hydrologyContainer from "./components/hydrologyContainer";
import {
    initHydrologyEpic,
    fetchTimeSeriesEpic,
    fetchTemporalPatternEpic,
    fetchIdfTableEpic,
    saveHydrologyItemEpic
} from "./epicsHydrology";

export default createPlugin('Hydrology', {
    component: hydrologyContainer,
    reducers: {
        hydrology
    },
    epics: {
        initHydrologyEpic,
        fetchTimeSeriesEpic,
        fetchTemporalPatternEpic,
        fetchIdfTableEpic,
        saveHydrologyItemEpic
    }
});

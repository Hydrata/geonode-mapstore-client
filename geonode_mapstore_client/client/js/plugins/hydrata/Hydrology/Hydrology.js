import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import hydrology from "./reducersHydrology";
import hydrologyContainer from "./components/hydrologyContainer";
import {
    initHydrologyEpic,
    fetchTimeSeriesEpic,
    fetchTemporalPatternEpic,
    fetchIdfTableEpic,
    saveHydrologyItemEpic,
    deleteHydrologyItemEpic,
    deriveIdfEpic,
    idfDeriveCompleteEpic,
    idfDeriveMapPickEpic,
    hydrologyIdfPickManagerEpic,
    loadAnugaConfigEpic,
    // TASK-1561 (W3b) — Hybrid Derive: preview the filtered storms + bulk-save
    // the ticked subset. (The W4b reproject/attach/derive epics are exported +
    // unit-tested but intentionally NOT registered here — they drive the demoted
    // W4b browser / a separate attach path; deliberately activating them is a
    // tracked follow-up, not part of the Hybrid Derive keystone.)
    previewDesignStormsEpic,
    saveDesignStormsEpic
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
        saveHydrologyItemEpic,
        deleteHydrologyItemEpic,
        deriveIdfEpic,
        idfDeriveCompleteEpic,
        idfDeriveMapPickEpic,
        hydrologyIdfPickManagerEpic,
        loadAnugaConfigEpic,
        previewDesignStormsEpic,
        saveDesignStormsEpic
    }
});

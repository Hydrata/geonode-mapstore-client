import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    cancelAnugaRunEpic,
    pollAnugaElevationEpic,
    runAnugaScenarioEpic,
    saveAnugaScenarioEpic,
    pollAnugaScenarioEpic,
    deleteAnugaScenarioEpic,
    createAnugaBoundaryEpic,
    createAnugaFrictionEpic,
    createAnugaInflowEpic,
    createAnugaStructureEpic,
    createAnugaMeshRegionEpic,
    addAnugaFrictionEpic,
    addAnugaInflowEpic,
    addAnugaStructureEpic,
    addAnugaMeshRegionEpic,
    addAnugaBoundaryEpic,
    prePopulateAnugaFeatureGridWithDefaults,
    updateComputeInstanceEpic,
    updateAnugaModelTitle
} from "./epicsAnuga";

export default createPlugin('Anuga', {
    component: anugaContainer,
    reducers: {
        anuga
    },
    epics: {
        initAnugaEpic,
        cancelAnugaRunEpic,
        pollAnugaElevationEpic,
        runAnugaScenarioEpic,
        saveAnugaScenarioEpic,
        pollAnugaScenarioEpic,
        deleteAnugaScenarioEpic,
        createAnugaFrictionEpic,
        createAnugaInflowEpic,
        createAnugaStructureEpic,
        createAnugaMeshRegionEpic,
        createAnugaBoundaryEpic,
        addAnugaFrictionEpic,
        addAnugaInflowEpic,
        addAnugaStructureEpic,
        addAnugaMeshRegionEpic,
        addAnugaBoundaryEpic,
        prePopulateAnugaFeatureGridWithDefaults,
        updateComputeInstanceEpic,
        updateAnugaModelTitle
    }
});

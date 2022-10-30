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
    runLumpedCatchmentEpic,
    createAnugaBoundaryEpic,
    createAnugaFrictionEpic,
    createAnugaInflowEpic,
    createAnugaStructureEpic,
    createAnugaMeshRegionEpic,
    createAnugaLumpedCatchmentEpic,
    createAnugaNodesEpic,
    createAnugaLinksEpic,
    addAnugaBoundaryEpic,
    addAnugaFrictionEpic,
    addAnugaInflowEpic,
    addAnugaStructureEpic,
    addAnugaFullMeshEpic,
    addAnugaMeshRegionEpic,
    addAnugaLumpedCatchmentEpic,
    addAnugaNodesEpic,
    addAnugaLinksEpic,
    prePopulateAnugaFeatureGridWithDefaults,
    updateComputeInstanceEpic,
    updateAnugaModelTitle,
    pollAnugaModelCreationEpic
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
        runLumpedCatchmentEpic,
        createAnugaBoundaryEpic,
        createAnugaFrictionEpic,
        createAnugaInflowEpic,
        createAnugaStructureEpic,
        createAnugaMeshRegionEpic,
        createAnugaLumpedCatchmentEpic,
        createAnugaNodesEpic,
        createAnugaLinksEpic,
        addAnugaBoundaryEpic,
        addAnugaFrictionEpic,
        addAnugaInflowEpic,
        addAnugaStructureEpic,
        addAnugaFullMeshEpic,
        addAnugaMeshRegionEpic,
        addAnugaLumpedCatchmentEpic,
        addAnugaNodesEpic,
        addAnugaLinksEpic,
        prePopulateAnugaFeatureGridWithDefaults,
        updateComputeInstanceEpic,
        updateAnugaModelTitle,
        pollAnugaModelCreationEpic
    }
});

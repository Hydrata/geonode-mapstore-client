import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    getAnugaAvailElevationsEpic,
    pollAnugaElevationEpic,
    createAnugaBoundaryEpic,
    buildAnugaScenarioEpic,
    runAnugaScenarioEpic,
    saveAnugaScenarioEpic,
    pollAnugaScenarioEpic,
    deleteAnugaScenarioEpic
} from "./epicsAnuga";

export default createPlugin('Anuga', {
    component: anugaContainer,
    reducers: {
        anuga
    },
    epics: {
        initAnugaEpic,
        getAnugaAvailElevationsEpic,
        pollAnugaElevationEpic,
        createAnugaBoundaryEpic,
        buildAnugaScenarioEpic,
        runAnugaScenarioEpic,
        saveAnugaScenarioEpic,
        pollAnugaScenarioEpic,
        deleteAnugaScenarioEpic
    }
});

import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    initAnugaScenariosEpic,
    initAnugaInflowsEpic,
    initAnugaFrictionsEpic,
    initAnugaStructuresEpic,
    initAnugaBoundariesEpic,
    initAnugaElevationsEpic,
    getAnugaAvailElevationsEpic,
    runAnugaScenarioEpic,
    saveAnugaScenarioEpic,
    pollAnugaElevationEpic,
    createAnugaBoundary1,
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
        initAnugaScenariosEpic,
        initAnugaInflowsEpic,
        initAnugaFrictionsEpic,
        initAnugaStructuresEpic,
        initAnugaBoundariesEpic,
        initAnugaElevationsEpic,
        getAnugaAvailElevationsEpic,
        runAnugaScenarioEpic,
        saveAnugaScenarioEpic,
        pollAnugaElevationEpic,
        createAnugaBoundary1,
        pollAnugaScenarioEpic,
        deleteAnugaScenarioEpic
    }
});

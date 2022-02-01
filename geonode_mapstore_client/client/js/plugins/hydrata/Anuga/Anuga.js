import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
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
        getAnugaAvailElevationsEpic,
        runAnugaScenarioEpic,
        saveAnugaScenarioEpic,
        pollAnugaElevationEpic,
        createAnugaBoundary1,
        pollAnugaScenarioEpic,
        deleteAnugaScenarioEpic
    }
});

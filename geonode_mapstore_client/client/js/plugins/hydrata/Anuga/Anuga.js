import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import anuga from "./reducersAnuga";
import anugaContainer from "./components/anugaContainer";
import {
    initAnugaEpic,
    initAnugaScenarios,
    initAnugaInflows,
    initAnugaFrictions,
    initAnugaStages,
    initAnugaBoundaries,
    initAnugaElevations
} from "./epicsAnuga";

export default createPlugin('Anuga', {
    component: anugaContainer,
    reducers: {
        anuga
    },
    epics: {
        initAnugaEpic,
        initAnugaScenarios,
        initAnugaInflows,
        initAnugaFrictions,
        initAnugaStages,
        initAnugaBoundaries,
        initAnugaElevations
    }
});

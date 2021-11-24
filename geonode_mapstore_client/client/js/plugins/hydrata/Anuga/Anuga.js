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
    createAnugaElevationEpic1,
    createAnugaLayerFromCatSearch,
    createAnugaBoundary1,
    autoSaveOnAnugaAddLayer
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
        createAnugaElevationEpic1,
        createAnugaLayerFromCatSearch,
        createAnugaBoundary1,
        autoSaveOnAnugaAddLayer
    }
});

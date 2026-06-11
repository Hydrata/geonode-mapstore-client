import {
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_INIT_IN_FLIGHT,
    SET_ANUGA_RESOURCES
} from "../actionsAnuga";

const initialState = {
    data: null,
    loading: false,
    // TASK-1637 — id of the map whose init chain is currently in flight, or
    // false when no init is running. Set by initAnugaEpic at the top of the
    // from-map waterfall; cleared (false) the moment project data lands or the
    // chain errors. anugaContainer.componentDidUpdate consults it so a
    // re-render before setAnugaProjectData can't re-fire INIT_ANUGA.
    initInFlight: false,
    anugaHomePageResources: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_PROJECT_DATA:
        return {
            ...state,
            // Project data landed → the init waterfall is done. Clear the
            // guard here too (belt-and-braces with the epic's explicit clear)
            // so a re-init is always permitted once data is present.
            initInFlight: false,
            data: action.data
        };
    case SET_ANUGA_INIT_IN_FLIGHT:
        // action.mapId is the live gnresource.id when set, or false to clear.
        return {
            ...state,
            initInFlight: action.mapId || false
        };
    case SET_ANUGA_RESOURCES: {
        let projects = action.data?.projects
            ?.map(project => project?.base_map_full)
            .filter(map => !map?.featured);
        if (projects) {
            projects.sort((a, b) => {
                let dateA = a?.base_map_full ? new Date(a.base_map_full.last_updated) : new Date(0);
                let dateB = b?.base_map_full ? new Date(b.base_map_full.last_updated) : new Date(0);
                return dateB - dateA;
            });
        }
        return {
            ...state,
            anugaHomePageResources: {
                ...action.data,
                projects: projects
            }
        };
    }
    default:
        return state;
    }
};

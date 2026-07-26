import {
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_INIT_IN_FLIGHT,
    SET_ANUGA_RESOURCES,
    SET_ANUGA_RESOURCE_PERMS
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
    /**
     * TASK-2463 (epic 2425 W2.6) — my_perms REFRESHES `visibility` here.
     *
     * THE BUG THIS CLOSES: the padlock never appeared after a paid checkout.
     * `visibility` had exactly one writer, SET_ANUGA_PROJECT_DATA, dispatched
     * by exactly two things: initAnugaEpic's project fetch, and the Sharing
     * panel's PATCH response. Neither runs on the checkout path — the
     * authoritative flipper there is the Stripe WEBHOOK (apps/commerce/
     * checkout_views.py), server-side, with no FE action at all. The one thing
     * that does run is pollMyPermsWhilePendingEpic, and my_perms has always
     * carried `visibility` (gn_anuga/api_v2.py) — resourcesReducer's
     * _NON_RESOURCE_KEYS just threw it away. So the customer paid, the server
     * made the project private, and the UI showed no sign of it.
     *
     * NOT A THIRD SOURCE OF TRUTH — the opposite. `projects.data.visibility`
     * stays the ONE place the padlock and the Sharing panel both read
     * (getProjectVisibility, selectorsAnuga.js): this adds a second SERVER
     * channel writing that one slice, it does not add a second slice. Writing
     * `visibility` into the resources slice instead — the other obvious way to
     * "stop discarding it" — is what would have created a rival copy, so
     * _NON_RESOURCE_KEYS still skips it over there, and its comment says why.
     *
     * `my_role` is deliberately NOT folded in the same way even though the
     * payload carries it too: it gates far more than an indicator (every
     * canX/isX selector in selectorsAnuga.js), so widening its writer set is a
     * change with its own blast radius and belongs to whoever needs it.
     *
     * Four guards, each load-bearing:
     *   - no `data` yet -> ignore. Creating one here would put an id-less
     *     project object in the slice that anugaContainer's init guard and
     *     every getProjectId caller read.
     *   - `action.projectId` not the loaded project -> ignore. A my_perms
     *     response for the project the user just navigated AWAY from must not
     *     relabel the new one. An action with no projectId at all also lands
     *     here: fail-SAFE, the padlock keeps the project fetch's value.
     *   - no `visibility` key -> ignore, rather than writing undefined. Anon
     *     callers and any future partial payload must not blank the field.
     *   - value unchanged -> return `state` UNTOUCHED. The poll fires every 3s
     *     and connect() shallow-compares; a fresh `data` object each tick would
     *     re-render every consumer of project data on a timer.
     */
    case SET_ANUGA_RESOURCE_PERMS: {
        const payload = action.payload || {};
        if (!state.data) return state;
        if (action.projectId !== state.data.id) return state;
        if (!Object.prototype.hasOwnProperty.call(payload, 'visibility')) return state;
        if (payload.visibility === state.data.visibility) return state;
        return { ...state, data: { ...state.data, visibility: payload.visibility } };
    }
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

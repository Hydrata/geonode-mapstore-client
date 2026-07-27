import {
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_INIT_IN_FLIGHT,
    SET_ANUGA_RESOURCES,
    SET_ANUGA_RESOURCE_PERMS,
    UPDATE_PROJECT_VISIBILITY_REQUEST,
    UPDATE_PROJECT_VISIBILITY_SETTLED
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
    // TASK-2440 (epic 2425 W4.1) — the visibility the server is being ASKED for
    // right now ('private' | 'organization' | 'public'), or null. It stores the
    // destination rather than a bare boolean so the Sharing panel can put the
    // busy affordance on the row that was actually clicked.
    //
    // This describes the REQUEST, never the stored value: `data.visibility`
    // stays the one source of truth for what the project IS, and is only ever
    // written by a server response. An optimistic copy here is how a privacy
    // control starts claiming a change the server refused.
    //
    // Deliberately NOT getMembershipsLoading (membershipPanel.js's existing
    // `loading` prop): that means the memberships LIST, and reusing it would
    // grey out the visibility rows on an unrelated list refresh.
    visibilityPending: null,
    // W3c adversarial — WHICH project `visibilityPending` is about. It carried
    // no identity and nothing resets it on an SPA nav, so an in-flight PATCH on
    // project A disabled project B's Sharing rows and rendered the "Working…"
    // pill on a row nobody clicked — a claim that B's visibility was being
    // changed when nothing about B was ever requested. The SET_ANUGA_RESOURCE_PERMS
    // case below already refuses a payload stamped for another project, for the
    // same reason and in the same words; this is that guard applied to the half
    // of the slice TASK-2440 added afterwards. Stamped from `data.id` at reduce
    // time rather than carried on the action, so the two can never disagree.
    visibilityPendingProjectId: null,
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
     * TASK-2497 (epic 2425 W3d) — `my_role` IS FOLDED HERE TOO now. This
     * paragraph used to say it deliberately was not, on the grounds that it
     * gates far more than an indicator (every canX/isX selector in
     * selectorsAnuga.js) so widening its writer set carried its own blast
     * radius. That blast radius is now the POINT, not a side effect: without
     * this, a role change was invisible to the affected user until a full page
     * reload — and in the demotion direction that meant showing them the
     * padlock and the Sharing radios after the server had already taken the
     * authority away, so they click Private and the backend 403s.
     *
     * Same "no new slice" argument as `visibility`, and for a stronger reason:
     * both channels derive my_role from ONE ladder over ONE helper — the
     * my-perms view (api_v2.py: get_user_role -> 'owner' special case ->
     * ProjectMembership.Role(role).label.lower() -> None) and
     * ProjectSerializerV2.get_my_role are character-for-character that ladder.
     * my_perms cannot produce a value the project fetch could not, including
     * `null` for a non-member on a public project.
     *
     * SCOPE — what this fold does and does not cover. It covers role changes
     * that still return 200: manager->editor, ->viewer, and ->null on a PUBLIC
     * project. It does NOT cover removal from a PRIVATE project: api_v2.py
     * raises NotFound for an authenticated non-member on a non-public project,
     * so that arrives as a 404, which permsEpics classes non-retryable ->
     * buildFailureBranch -> setPermsLoadFailed(true), and the V2P-02 helpers
     * then fall back to the STALE project my_role. Closing that needs a
     * permsLoadFailed-aware treatment in the epic's failure branch and is
     * deliberately not attempted here. Demotion is not "handled"; the 200 cases
     * are.
     *
     * Four guards, each load-bearing, and applied PER KEY so a payload carrying
     * one and not the other still works:
     *   - no `data` yet -> ignore. Creating one here would put an id-less
     *     project object in the slice that anugaContainer's init guard and
     *     every getProjectId caller read.
     *   - `action.projectId` not the loaded project -> ignore. A my_perms
     *     response for the project the user just navigated AWAY from must not
     *     relabel the new one. An action with no projectId at all also lands
     *     here: fail-SAFE, the padlock keeps the project fetch's value, and the
     *     role keeps whatever the project fetch established.
     *   - key absent -> ignore THAT key, rather than writing undefined. Anon
     *     callers and any future partial payload must not blank a field, and a
     *     payload with no `visibility` must still be able to move `my_role`.
     *   - value unchanged -> that key contributes nothing, and if NEITHER key
     *     moved we return `state` UNTOUCHED. The poll fires every 3s and
     *     connect() shallow-compares; a fresh `data` object each tick would
     *     re-render every consumer of project data on a timer.
     */
    case SET_ANUGA_RESOURCE_PERMS: {
        const payload = action.payload || {};
        if (!state.data) return state;
        if (action.projectId !== state.data.id) return state;
        const patch = {};
        ['visibility', 'my_role'].forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
            if (payload[key] === state.data[key]) return;
            patch[key] = payload[key];
        });
        if (Object.keys(patch).length === 0) return state;
        return { ...state, data: { ...state.data, ...patch } };
    }
    // TASK-2440 — armed on the click, cleared by the epic on every branch of
    // the round-trip. Same shape as the shipped REQUEST_BILLING_PORTAL ->
    // portalLoading pair (Paywall/account/reducer.js).
    case UPDATE_PROJECT_VISIBILITY_REQUEST:
        return {
            ...state,
            visibilityPending: action.visibility || null,
            visibilityPendingProjectId: (state.data && state.data.id) ?? null
        };
    case UPDATE_PROJECT_VISIBILITY_SETTLED:
        return { ...state, visibilityPending: null, visibilityPendingProjectId: null };
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

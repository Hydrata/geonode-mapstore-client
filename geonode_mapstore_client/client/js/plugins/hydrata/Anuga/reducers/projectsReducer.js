import {
    SET_ANUGA_PROJECT_DATA,
    SET_ANUGA_INIT_IN_FLIGHT,
    SET_ANUGA_RESOURCES,
    SET_ANUGA_RESOURCE_PERMS,
    UPDATE_PROJECT_VISIBILITY_REQUEST,
    UPDATE_PROJECT_VISIBILITY_SETTLED
} from "../actionsAnuga";
// TASK-2548 — the single writer of `gnresource.id` (reducers/gnresource.js is
// the only case for it, and actions/gnresource.js the only creator). That makes
// it the exact "the map changed" signal, and NOT @@router/LOCATION_CHANGE,
// which also fires for every non-map route in the SPA.
import { SET_RESOURCE_ID } from "@js/actions/gnresource";

// The my_perms top-level keys this reducer OWNS — the ones it folds into
// state.anuga.projects.data. The same two are skipped by resourcesReducer's
// _NON_RESOURCE_KEYS, and that is not a coincidence: skipped there means owned
// here, so the two lists must be read together. See the SET_ANUGA_RESOURCE_PERMS
// case below for why folding is not a second source of truth.
const _PROJECT_KEYS_FROM_MY_PERMS = ['visibility', 'my_role'];

// TASK-2548 — the keys that describe THE LOADED PROJECT, as opposed to the
// slice's map-independent contents. A map change invalidates all of them at
// once, so they are reset together; naming them here (rather than spreading
// `initialState`) keeps the two deliberate EXCLUSIONS visible:
//   - `anugaHomePageResources` is the catalogue list, not this project — it is
//     fetched once and must survive a map switch;
//   - `loading` has no writer anywhere in this reducer, so resetting it would
//     be dead code claiming to do something.
const _NO_PROJECT_LOADED = {
    data: null,
    initInFlight: false,
    visibilityPending: null,
    visibilityPendingProjectId: null
};

// `gnresource.id` is a STRING on the SPA route path (measured live: "1418"),
// while other setResourceId callers pass a numeric pk. A type-only difference
// must never read as "different map" — that would clear a live project on the
// map it belongs to. Null/undefined on either side is NOT a match: an unknown
// map id fails closed, into the reset branch.
const _isSameMap = (a, b) => {
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (a == null || b == null) return false;
    return String(a) === String(b);
};

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
    // TASK-2548 (epic 2425 W3e) — WHICH MAP THIS SLICE IS ABOUT.
    //
    // THE MONEY BUG THIS CLOSES. `data` used to be write-once per document.
    // The only dispatcher of INIT_ANUGA is anugaContainer.componentDidUpdate,
    // gated on `!isAnugaProject` — which mapStateToProps defines as literally
    // `projects.data.id` — and NO case here ever cleared `data`. So the first
    // project to load stayed loaded for the life of the document, and a
    // same-document map switch (/catalogue/#/map/<id>) could not update it.
    // Every project-scoped paywall guard then compared against the wrong
    // project: measured on localhost, standing on map 1404 (project 15283),
    // the checkout POST carried {"project_id":15834, ..., "return_map_id":
    // "1404"} — the customer bought and PRIVATISED the project they were not
    // looking at.
    //
    // WHY A STAMP AND NOT A FIELD OF `data`. The retrieve serializer is
    // ProjectSerializerV2 (api_v2.py get_serializer_class); only
    // ProjectSerializerV2Full adds `base_map`. Measured live, `data` carries
    // exactly [id, name, projection, simple_view_config, visibility,
    // owner_username, my_role] — there is no map id in the payload to compare
    // against. So the fetcher stamps it (see setAnugaProjectData).
    //
    // WHY CLEARING, NOT A SMARTER READ (AC5, option (b)). The alternative was
    // to leave `data` in place and have every reader compare it against the
    // live map. That keeps project A readable for the whole window while B
    // loads, which is the exact shape of the bug — stale data read as current —
    // and it puts the burden on every future reader. Clearing makes the stale
    // value UNREADABLE, so a reader that forgets the comparison gets "no
    // project" (fail-closed) instead of the wrong one. On a money path a
    // transient dead edit-pencil beats a transient wrong project_id.
    mapId: null,
    anugaHomePageResources: null
};

export default (state = initialState, action) => {
    switch (action.type) {
    /**
     * TASK-2548 (epic 2425 W3e) — THE PROJECT FOLLOWS THE MAP.
     *
     * This is the whole fix. `gnresource.id` moving is what "the map changed"
     * MEANS in this app, and SET_RESOURCE_ID is its only writer, so this case
     * fires exactly once per map switch (measured: one GEONODE:SET_RESOURCE_ID
     * across a hash nav, carrying the new id) and never on a non-map route.
     * Dropping the loaded project here makes anugaContainer's existing gate
     * — `gnResourceLoaded && !isAnugaProject && !initRunningForThisMap` —
     * true again, so the init it has always been able to run for the new map
     * finally runs. Nothing else needed changing; the gate was never wrong
     * about what it was asking, it was asking about a value that never moved.
     *
     * SAME MAP → SAME OBJECT, deliberately. Returning a fresh object for a
     * repeat SET_RESOURCE_ID would re-render every consumer of project data
     * and, worse, would clear `data` under a map that is still loaded — the
     * container would then re-init on a map it had already initialised, which
     * is the re-dispatch storm TASK-1637 fixed, re-entered through a new door.
     */
    case SET_RESOURCE_ID: {
        if (_isSameMap(state.mapId, action.id)) return state;
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        return { ...state, ..._NO_PROJECT_LOADED, mapId: action.id == null ? null : action.id };
    }
    case SET_ANUGA_PROJECT_DATA: {
        // TASK-2548 — REFUSE data fetched for a map we have since left.
        //
        // initAnugaEpic's switchMap cancels its own in-flight waterfall when a
        // new INIT_ANUGA arrives, so the init path cannot land late. The
        // visibility PATCH can: updateProjectVisibilityEpic dispatches
        // setAnugaProjectData from its own response, and nothing cancels it on
        // a nav — a PATCH issued on map A and answered after the switch would
        // otherwise re-poison this slice with A's project, undoing the reset
        // above with no further SET_RESOURCE_ID coming to clear it again.
        //
        // Only a stamp that POSITIVELY disagrees is refused — an unstamped
        // dispatch (a caller that has not been taught to stamp) still reads
        // through, the same fail-safe rule SET_ANUGA_RESOURCE_PERMS applies
        // below. Both shipped dispatchers stamp.
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (action.mapId != null && state.mapId != null && !_isSameMap(action.mapId, state.mapId)) {
            return state;
        }
        return {
            ...state,
            // Project data landed → the init waterfall is done. Clear the
            // guard here too (belt-and-braces with the epic's explicit clear)
            // so a re-init is always permitted once data is present.
            initInFlight: false,
            data: action.data,
            // Adopt the stamp only when the slice has no map identity yet (no
            // SET_RESOURCE_ID seen — unit tests, and any host that mounts the
            // reducer without the GeoNode resource lifecycle). Where the two
            // are both known they already agree, checked immediately above.
            // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
            mapId: state.mapId != null ? state.mapId : (action.mapId ?? null)
        };
    }
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
        _PROJECT_KEYS_FROM_MY_PERMS.forEach((key) => {
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

/**
 * Project-introduction epics (epic 2765 W3, extended in W4).
 *
 * Four of them, one per job:
 *
 *   introductionFetchEpic     resolve the project for the map that just opened
 *                             and pull its introduction payload.
 *   introductionAutoShowEpic  ask the ORDERING GUARD (introductionGate.js) when
 *                             — or whether — to open the modal.
 *   introductionAcceptEpic    persist an acceptance the way settled decision 3
 *                             says it must be persisted for this viewer.
 *   introductionSaveEpic      (W4) PATCH an owner/manager edit-in-place.
 *
 * ── WHY TWO TRIGGERS, AND WHY INIT_ANUGA IS THE LOAD-BEARING ONE ─────────────
 *
 * ⚠ MAP_CONFIG_LOADED ALONE DOES NOT WORK, MEASURED ON LOCALHOST 2026-08-14.
 * SimpleView is a LAZY module plugin (`toModulePlugin`, js/plugins/index.js), so
 * its epics are injected into redux-observable only when the chunk finishes
 * loading — and redux-observable's action$ has no replay, so anything dispatched
 * before that instant is never seen. Instrumented on a cold anonymous load of
 * /catalogue/#/map/118:
 *
 *     INTRO-DEBUG module evaluated at 1786719569284
 *     INTRO-DEBUG saw INIT_ANUGA     1786719570214
 *     INTRO-DEBUG saw INIT_ANUGA     1786719570557
 *     (MAP_CONFIG_LOADED: never seen)
 *
 * i.e. the map config had already loaded ~a second before this module existed.
 * This is precisely the "green in tests, dead live" failure this epic exists to
 * avoid: every karma assertion below passes against a synthetic MAP_CONFIG_LOADED.
 *
 * INIT_ANUGA is dispatched by `anugaContainer.componentDidUpdate` on every
 * re-render while `gnResourceLoaded && !isAnugaProject` — so it lands AFTER the
 * plugin chunks have mounted, and it keeps landing until a project resolves.
 * That is what makes it reliable, and it is also a genuine ANUGA-context
 * signal: only `anugaContainer` dispatches it, and it only mounts where the
 * Anuga plugin is configured.
 *
 * MAP_CONFIG_LOADED IS RETAINED as a second trigger for the SPA case — a
 * same-document hop to another map, where the chunk is long since loaded and
 * the config action does arrive. The ask-once-per-map guard below makes the
 * overlap free: whichever trigger arrives first for the map on screen is the
 * one that asks.
 *
 * ⚠ NOT `initAnugaEpic`'s OUTPUT, and not INIT_ANUGA's handler either: that
 * epic is LOGIN-GATED (pollingEpics.js `.filter(() => !!state.security.user)`),
 * so an anonymous viewer never populates `state.anuga` at all. We listen to the
 * ACTION, which is dispatched for everyone, not to the login-gated chain it
 * feeds.
 *
 * ── WHY THE PROJECT ID IS ALWAYS RESOLVED FROM THE MAP ───────────────────────
 *
 * `state.anuga.projects.data` is the ANUGA panel's LAST-loaded project and is
 * not reset on SPA navigation, so it is stale-but-truthy after a hop between
 * maps (TASK-2427, measured on prod: the tile prefetch paired one map's layers
 * with the previous project's id for months). Reusing it here would fetch the
 * WRONG project's disclaimer. `POST /projects/from-map/` is AllowAny and a pure
 * lookup, so it is both correct and available anonymously — and its 404 is
 * simultaneously the MAP-level ANUGA gate: a plain GeoNode map on hydrata.com
 * owns no project, gets no payload, and can never reach the modal.
 */
import Rx from 'rxjs';
import { MAP_CONFIG_LOADED } from '../../../../MapStore2/web/client/actions/config';
import * as anugaApi from '../Anuga/api/anugaApi';
import { INIT_ANUGA, SET_ANUGA_PROJECT_DATA } from '../Anuga/actionsAnuga';
import {
    SET_PAYWALL_UPGRADE_PROMPT,
    DISMISS_PAYWALL_UPGRADE,
    SET_PAYWALL_PENDING,
    CLEAR_PAYWALL_PENDING
} from '../Paywall/actions';
import {
    ACCEPT_INTRODUCTION,
    INTRODUCTION_LOADED,
    SAVE_INTRODUCTION,
    introductionAccepted,
    introductionLoaded,
    introductionSaved,
    introductionSaveFailed,
    setVisibleIntroduction
} from './actionsSimpleView';
import {
    INTRODUCTION_SHOW,
    INTRODUCTION_WAIT,
    isAnugaContext,
    introductionVerdictFor
} from './introductionGate';
import {
    anonymousAcceptedVersion,
    rememberAnonymousAcceptance
} from './introductionStorage';

// ── TWO ONCE-PER-MAP PROPERTIES, DELIBERATELY SEPARATE (TASK-2804) ───────────
//
// ONE module-level Set used to do both jobs, and only one of them may survive a
// return hop. A viewer who opened map A, hopped to map B and came back found
// the About button GONE (measured on localhost 2026-08-15, anonymous, same
// document): TASK-2790 clears the slice on SET_RESOURCE_ID, the permanent fetch
// dedupe then refused the re-fetch, and TASK-2796 gates the button on payload
// presence — so the introduction was unreachable until a full page reload.
//
// The split:
//
//   THE PAYLOAD is always available. Arriving at map A again re-asks for A.
//   THE INTERRUPTION happens once per map per page session — and it is the
//   AUTO-SHOW that must not repeat, not the request. That is what the old
//   comment here actually described ("without this a re-fire would re-open a
//   modal the viewer had just closed with the cross"), so it moved down to
//   `introductionAutoShowEpic` where it belongs.
//
// ── THE FETCH GUARD IS NOT AN IN-FLIGHT GUARD, AND THAT IS THE TRAP ──────────
//
// INIT_ANUGA is re-dispatched by `anugaContainer.componentDidUpdate` on EVERY
// re-render while no project has resolved — for an anonymous viewer that is
// forever, since `initAnugaEpic` is login-gated and never populates
// `state.anuga`. A guard covering only the round-trip would let every later
// re-render fire another from-map + introduction pair: a request storm traded
// for a missing button, which is the worse bug. So the question this asks is
// "have we already asked about the map that is on screen?", not "is a request
// running?".
//
// A SINGLE VALUE, NOT A SET, and that is the mechanism rather than a
// simplification: exactly one map is on screen at a time, so "the map we last
// asked about" IS the dedupe. It keeps matching through the burst on one map,
// and stops matching the instant `gnresource.id` moves — which is precisely a
// hop, including the hop BACK.
//
// MARKED BEFORE THE REQUEST, not after it, so an endpoint that fails is asked
// once per visit rather than once per re-render (unchanged from the Set this
// replaces, which was also added up-front).
let _askedForMapId = null;

// Maps whose introduction has already volunteered itself in this page session.
// Written only where the modal actually opens — see `introductionAutoShowEpic`.
const _autoShownMapKeys = new Set();

/** Test seam — reset both per-session dedupes. No production caller. */
export const __resetIntroductionDedupe = () => {
    _askedForMapId = null;
    _autoShownMapKeys.clear();
};

// String comparison, and a missing id NEVER matches. `gnresource.id` is a
// STRING on the SPA route path (measured live: "1418") and a numeric pk from
// other callers, and a type-only difference must not read as "a different map"
// — that would re-ask on every re-render. Same rule and same reason as
// `_isSameMapId` in reducersSimpleView.js.
const _sameMapId = (a, b) => !!a && !!b && String(a) === String(b);

// Which map an INTRODUCTION_LOADED describes. The action's own stamp (added by
// the fetch below for TASK-2790) rather than `gnresource.id`: it is the map the
// payload was fetched FOR, which is exactly the subject of the interruption.
// Falls back to the project, and to "no key" for an unstamped dispatch — an
// action that cannot be identified is never deduped, so a future caller that
// has not been taught to stamp still gets its modal.
const _autoShowKey = (action) => {
    const key = action?.mapId || action?.projectId;
    return key ? String(key) : null;
};

export const introductionFetchEpic = (action$, store) =>
    action$.ofType(INIT_ANUGA, MAP_CONFIG_LOADED)
        // mergeMap, not switchMap: INIT_ANUGA re-fires every re-render until a
        // project resolves, and a switchMap would let the second one CANCEL the
        // first fetch mid-flight, forever. The ask-once-per-map guard below
        // means only the first of that burst ever starts work, so nothing is
        // duplicated — and it stays true after the burst, not just during it.
        .mergeMap(() => {
            const state = store.getState();
            // SITE gate (settled decision 1). SWAMM / Sarara / NICP run this
            // same build with SimpleView but WITHOUT the Anuga plugin, so this
            // is where they stop — before any request is made.
            if (!isAnugaContext(state)) {
                return Rx.Observable.empty();
            }
            const mapId = state?.gnresource?.id;
            if (!mapId || _sameMapId(_askedForMapId, mapId)) {
                return Rx.Observable.empty();
            }
            _askedForMapId = mapId;

            return Rx.Observable.from(anugaApi.getProjectFromMapId(mapId))
                .map(response => response?.data?.projectId)
                .switchMap((projectId) => {
                    // MAP gate: no ANUGA project owns this map.
                    if (!projectId) {
                        return Rx.Observable.empty();
                    }
                    return Rx.Observable.from(anugaApi.getProjectIntroduction(projectId))
                        .map(response => introductionLoaded(
                            projectId,
                            response?.data,
                            // ⚠ SEEDED FOR ANONYMOUS VIEWERS ONLY, and the guard
                            // is load-bearing rather than tidy.
                            //
                            // `hasAcceptedCurrentIntroduction` is an OR: the
                            // local flag satisfies it even when the server says
                            // `accepted_current_version: false`. So reading
                            // localStorage for a signed-in viewer would let a
                            // flag this browser wrote while logged OUT suppress
                            // the modal for a named user who has NO acceptance
                            // row — the platform would stop asking while its own
                            // record shows nobody ever agreed. Settled decision
                            // 3 says an anonymous acceptance is explicitly NOT
                            // evidence; that has to mean it cannot stand in for
                            // an authenticated one.
                            state?.security?.user
                                ? null
                                : anonymousAcceptedVersion(projectId),
                            // TASK-2790 — WHICH MAP this fetch was for. The
                            // outer `mergeMap` deliberately does not cancel on
                            // a new INIT_ANUGA, so this request can still be in
                            // flight when the viewer hops to another map; the
                            // reducer refuses a reply stamped for a map it has
                            // since left rather than painting the previous
                            // project's disclaimer over the new one.
                            mapId
                        ));
                })
                // Silent on failure, deliberately. A 404 is the ordinary
                // non-ANUGA-map answer, and a viewer who cannot be shown an
                // orientation modal is no worse off than one on today's build;
                // a toast here would fire on every SWAMM-shaped map.
                .catch(() => Rx.Observable.empty());
        });

/**
 * Open the modal when — and only when — the ordering guard says so.
 *
 * The guard can answer WAIT (something ahead of the introduction in the queue
 * is unresolved or on screen), so this re-asks on the actions that change any
 * of the guard's inputs, and takes the FIRST non-WAIT answer:
 *
 *   SET_ANUGA_PROJECT_DATA  the viewer's role for this project (auth, step 1)
 *   the four paywall actions the blocking overlay (step 2)
 *
 * A named trigger list rather than every action: it keeps the cost at zero for
 * an idle map, and it documents what the contract actually depends on. If a
 * future clause reads a new slice, its action belongs in this list — that
 * omission is the realistic way this breaks.
 *
 * ── ONCE PER MAP PER PAGE SESSION (TASK-2804) ────────────────────────────────
 *
 * THE INTERRUPTION IS THE THING THAT MUST NOT REPEAT — this is where the
 * property the fetch dedupe used to carry actually lives. A viewer who closed
 * this modal with the cross on map A, wandered off to map B and came back must
 * get the payload (so the About button is there) WITHOUT having the dialog
 * volunteer itself over their map a second time. Consent is not re-asked for by
 * re-interrupting: they can reopen it whenever they want, and the accept path
 * is unchanged.
 *
 * The filter is OUTSIDE the switchMap on purpose. It only ever drops a repeat
 * for a map already shown, and dropping it there leaves any verdict still
 * WAITing for that same map running; letting it through would restart that wait
 * for nothing. A LOADED for a DIFFERENT map is not filtered and still switches,
 * which is what cancels a pending wait on the map just left.
 *
 * Recorded at the moment it OPENS, never when the verdict is computed: a
 * viewer whose verdict never resolved (a paywall that stayed up) has not been
 * interrupted, and must still be able to be.
 *
 * KEYED ON THE MAP AND NOTHING ELSE, which has one deliberate consequence: if
 * an owner edits the text while a viewer who has already seen it this session
 * is off on another map, the return hop hands them the NEW text on the About
 * button but does not re-interrupt them with it. The re-prompt-on-edit contract
 * (introductionGate.js `hasAcceptedCurrentIntroduction`) is a per-page-session
 * one and still holds: this memo dies with the document, and their next load
 * compares versions and shows the new content. Adding the version to the key
 * would buy a same-session re-prompt for a same-session edit — not worth a
 * second interruption per map to a viewer who did not ask for one.
 */
export const introductionAutoShowEpic = (action$, store) =>
    action$.ofType(INTRODUCTION_LOADED)
        .filter((action) => {
            const key = _autoShowKey(action);
            return !key || !_autoShownMapKeys.has(key);
        })
        .switchMap((action) => action$
            .ofType(
                SET_ANUGA_PROJECT_DATA,
                SET_PAYWALL_UPGRADE_PROMPT,
                DISMISS_PAYWALL_UPGRADE,
                SET_PAYWALL_PENDING,
                CLEAR_PAYWALL_PENDING
            )
            .startWith(null)
            .map(() => introductionVerdictFor(store.getState()))
            .filter(verdict => verdict !== INTRODUCTION_WAIT)
            .take(1)
            .filter(verdict => verdict === INTRODUCTION_SHOW)
            .do(() => {
                const key = _autoShowKey(action);
                if (key) {
                    _autoShownMapKeys.add(key);
                }
            })
            .map(() => setVisibleIntroduction(true))
        );

/**
 * Persist an acceptance — by the route settled decision 3 allows for THIS
 * viewer, and no other.
 *
 * AUTHENTICATED: POST the acceptance row, and record the version from the
 * SERVER's fresh response rather than from the payload in the store, so a
 * concurrent owner edit can never leave us claiming acceptance of text the
 * server has already replaced.
 *
 * ANONYMOUS: localStorage ONLY, and NO REQUEST AT ALL. `/accept/` is
 * IsAuthenticated and answers an anonymous POST 401 with a
 * `WWW-Authenticate: Basic` header, which a browser may surface as a native
 * password prompt — on the anonymous-link path this epic exists to serve. That
 * is the trap; `epicsIntroduction-test.js` pins that no request is issued.
 */
export const introductionAcceptEpic = (action$, store) =>
    action$.ofType(ACCEPT_INTRODUCTION)
        .switchMap(() => {
            const state = store.getState();
            const introduction = state?.simpleView?.introduction;
            const projectId = introduction?.projectId;
            const contentVersion = introduction?.data?.content_version;
            if (!projectId || !contentVersion) {
                return Rx.Observable.empty();
            }
            if (!state?.security?.user) {
                rememberAnonymousAcceptance(projectId, contentVersion);
                return Rx.Observable.of(introductionAccepted(projectId, contentVersion));
            }
            return Rx.Observable.from(anugaApi.acceptProjectIntroduction(projectId))
                .map(response => introductionAccepted(
                    projectId,
                    response?.data?.content_version || contentVersion
                ))
                // A failed POST must not fake a recorded acceptance: leave the
                // slice alone so the next session asks again. The modal has
                // already closed under the viewer's click, which is the right
                // trade — re-asking is cheap, and pretending a liability
                // acknowledgement was stored when it was not is the one outcome
                // that matters here.
                .catch(() => Rx.Observable.empty());
        });

/**
 * Save an owner/manager edit-in-place (epic 2765 W4, TASK-2778).
 *
 * ⚠ EMITS INTRODUCTION_SAVED, NEVER INTRODUCTION_LOADED — and that is the whole
 * reason a fourth action type exists. The PATCH response IS the read payload,
 * so `introductionLoaded(projectId, response.data)` would have been the obvious
 * one-liner, and it would have been wrong twice over:
 *
 *   - `introductionAutoShowEpic` above is `ofType(INTRODUCTION_LOADED)`, so
 *     every Save would restart the show-verdict pipeline underneath the modal
 *     the owner is currently editing in;
 *   - the INTRODUCTION_LOADED reducer case rewrites `acceptedVersion` from the
 *     action, which carries none here — erasing this browser's anonymous
 *     acceptance stamp as a side effect of an owner fixing a typo.
 *
 * (This is NOT the redux-observable self-trigger livelock — this epic does not
 * listen for INTRODUCTION_LOADED. It is the quieter version: emitting an action
 * a DIFFERENT epic owns.)
 *
 * A FAILED SAVE EMITS A FAILURE, it does not go silent like the accept path.
 * Accept can afford silence because re-asking next session is cheap; here the
 * owner has just typed several paragraphs, and a Save button that quietly does
 * nothing is how that text gets lost.
 */
export const introductionSaveEpic = (action$) =>
    action$.ofType(SAVE_INTRODUCTION)
        // switchMap: a double-clicked Save should end on the LAST payload, and
        // the BE absorbs the concurrent-first-write case with get_or_create.
        .switchMap((action) => {
            const { projectId, source } = action;
            if (!projectId || !source) {
                return Rx.Observable.empty();
            }
            return Rx.Observable.from(anugaApi.updateProjectIntroduction(projectId, source))
                .map(response => introductionSaved(projectId, response?.data))
                .catch(() => Rx.Observable.of(introductionSaveFailed(projectId)));
        });

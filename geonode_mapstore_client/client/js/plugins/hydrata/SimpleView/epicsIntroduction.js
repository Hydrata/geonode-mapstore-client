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
 * the config action does arrive. The per-map dedupe below makes the overlap
 * free.
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

// Fetch at most once per map per page session. MAP_CONFIG_LOADED re-fires on
// map switch and on reconfig (warmTilesEpic carries the same dedupe for the
// same reason); without this a re-fire would re-open a modal the viewer had
// just closed with the cross.
const _fetchedMapIds = new Set();

/** Test seam — reset the per-session dedupe. */
export const __resetIntroductionFetchDedupe = () => _fetchedMapIds.clear();

export const introductionFetchEpic = (action$, store) =>
    action$.ofType(INIT_ANUGA, MAP_CONFIG_LOADED)
        // mergeMap, not switchMap: INIT_ANUGA re-fires every re-render until a
        // project resolves, and a switchMap would let the second one CANCEL the
        // first fetch mid-flight, forever. The per-map dedupe below means only
        // the first of that burst ever starts work, so nothing is duplicated.
        .mergeMap(() => {
            const state = store.getState();
            // SITE gate (settled decision 1). SWAMM / Sarara / NICP run this
            // same build with SimpleView but WITHOUT the Anuga plugin, so this
            // is where they stop — before any request is made.
            if (!isAnugaContext(state)) {
                return Rx.Observable.empty();
            }
            const mapId = state?.gnresource?.id;
            if (!mapId || _fetchedMapIds.has(mapId)) {
                return Rx.Observable.empty();
            }
            _fetchedMapIds.add(mapId);

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
                                : anonymousAcceptedVersion(projectId)
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
 */
export const introductionAutoShowEpic = (action$, store) =>
    action$.ofType(INTRODUCTION_LOADED)
        .switchMap(() => action$
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

/**
 * V2P-21 — Lazy-fetch my_perms on Anuga panel open.
 *
 * Wires the V2P-20 backend endpoint
 *   GET /api/v2/anuga/projects/<pid>/my-perms/
 * into Redux so the V2P-02 helpers (canEditLayer/canDeleteLayer/canDownloadLayer
 * in selectorsAnuga.js) can read state.anuga.resources.<type>[i].perms instead
 * of the legacy project my_role gate.
 *
 * Trigger: INIT_ANUGA (= componentDidUpdate on AnugaContainer = panel-open).
 *   This is the SAME action that initAnugaEpic uses to fan-out the v1 catalogue
 *   list endpoints, so we already know the user has the panel visible. The
 *   action is NOT dispatched on map init — that's MAP_CONFIG_LOADED in
 *   MapStore2's stack. Test suite below explicitly asserts no fetch on
 *   MAP_CONFIG_LOADED to guard the TASK-658 perf budget (cold-anon
 *   interactive_s median 13.60s; an eager perm fetch on map init would push
 *   past the 14.28s 5% budget).
 *
 * Dedupe: 30-second module-level cache keyed by projectId. This window is now
 *   the ONLY thing suppressing repeat panel-open fetches — TASK-2463 (W2.7)
 *   changed the backend header to `private, no-cache` + ETag, so the browser no
 *   longer holds a 60s freshness window of its own. This comment used to say
 *   "half the backend max-age, to be conservative against clock skew"; that
 *   reasoning is gone, and 30s is now simply the chosen budget. Why the header
 *   had to change: my_perms is mutated OUT OF BAND by the Stripe webhook, and a
 *   max-age with no validator made the post-checkout poll re-read its own cache
 *   for the full 60s it runs. See gn_anuga/api_v2.py::my_perms.
 *
 * Error handling: retry once on 5xx / network error with 1s backoff. On final
 *   failure, dispatch setPermsLoadFailed(true) + a non-blocking toast. The
 *   V2P-02 helpers MUST treat permsLoadFailed=true as "fall back to project
 *   my_role" (they already do — _resolveResourcePerms returns layer.perms ||
 *   [] when state.anuga.resources[type] is missing the id, and the helpers
 *   then defer to myRole).
 */
import Rx from 'rxjs';
import { show } from '../../../../../MapStore2/web/client/actions/notifications';
import * as anugaApi from '../api/anugaApi';
import {
    INIT_ANUGA,
    FETCH_MY_PERMS,
    fetchMyPerms,
    setAnugaResourcePerms,
    setPermsLoadFailed
} from '../actionsAnuga';

const getProjectId = (state) => state?.anuga?.projects?.data?.id;

// Module-level dedupe cache. Map<projectId, lastFetchTimestamp>.
// 30s window — half the backend Cache-Control max-age=60 to be safe.
// Exported `__resetPermsCacheForTests` lets tests start from a clean slate.
const _DEDUPE_WINDOW_MS = 30000;
let _lastFetchByProjectId = new Map();
export const __resetPermsCacheForTests = () => { _lastFetchByProjectId = new Map(); };

// Test seam — lets tests inject a deterministic clock.
let _now = () => Date.now();
export const __setNowForTests = (fn) => { _now = fn || (() => Date.now()); };

/**
 * Fan-in epic: when the user opens the Anuga panel (INIT_ANUGA fires from
 * AnugaContainer's componentDidUpdate), schedule a my-perms fetch IF we
 * already have a project id. INIT_ANUGA may fire BEFORE setAnugaProjectData
 * has populated state.anuga.projects.data.id (initAnugaEpic resolves
 * project_id later in its switchMap chain), so we listen to project-data
 * SET as well; whichever happens second triggers the fetch once.
 *
 * Critical: this epic does NOT fetch — it only emits FETCH_MY_PERMS. The
 * actual axios call lives in fetchMyPermsEpic below. This separation lets
 * the regression-guard test (no-fetch-on-map-init) assert nothing happens
 * just by checking that no INIT_ANUGA action was dispatched.
 */
export const triggerFetchMyPermsOnInitEpic = (action$, store) => action$
    .ofType(INIT_ANUGA, 'SET_ANUGA_PROJECT_DATA')
    .map(() => getProjectId(store.getState()))
    .filter((projectId) => Boolean(projectId))
    .distinctUntilChanged()  // dedupe consecutive same-project triggers
    .map((projectId) => fetchMyPerms(projectId));

/**
 * Workhorse epic: dispatches the axios call, populates Redux on success, or
 * surfaces a toast + sets permsLoadFailed on final failure. Implements the
 * 30s in-memory dedupe and the 1-retry/1s-backoff policy.
 *
 * Uses mergeMap (NOT switchMap) so that a 2nd FETCH_MY_PERMS arriving while
 * the 1st is still in flight does NOT cancel the in-flight request. The
 * dedupe gate above ensures the 2nd one short-circuits to Observable.empty()
 * without issuing a duplicate HTTP call, so mergeMap is safe.
 *
 * TASK-2464 (epic 2425 W2.5) — `action.force` BYPASSES the dedupe.
 *
 * The dedupe was written to protect the TASK-658 cold-start perf budget from
 * repeated panel opens. It was ALSO, silently, suppressing every refetch after
 * a write: the window is only invalidated on FAILURE (buildFailureBranch's
 * `_lastFetchByProjectId.delete`), never on success, so for 30s after any
 * successful fetch a re-dispatch returned Observable.empty() with no HTTP
 * call, no action, and no log. Two live consequences, both fixed by `force`:
 *   1. A visibility PATCH lands seconds after the panel-open fetch, squarely
 *      inside the window — the paywall steady state never refreshed and the
 *      indicator stayed stale (this task).
 *   2. pollMyPermsWhilePendingEpic polls every 3s for up to 20 attempts against
 *      a 30s window, so 9 of the first 10 ticks were no-ops. The poll looked
 *      like it was working and was mostly not.
 *
 * `force` still WRITES the timestamp, so a forced fetch re-arms the window for
 * ordinary triggers rather than disabling the dedupe from then on.
 */
export const fetchMyPermsEpic = (action$) => action$
    .ofType(FETCH_MY_PERMS)
    .mergeMap((action) => {
        const { projectId, force } = action;

        // 30s dedupe gate. Skip if we fetched within the window — unless the
        // caller knows the server-side answer just changed.
        const now = _now();
        const last = _lastFetchByProjectId.get(projectId);
        if (!force && last !== undefined && now - last < _DEDUPE_WINDOW_MS) {
            return Rx.Observable.empty();
        }
        _lastFetchByProjectId.set(projectId, now);

        // Manual single-retry: catch handles the first failure, decides
        // whether to retry (5xx/network) or bail (4xx), then re-runs
        // fetchOnce or returns the inline failure branch.
        const fetchOnce = Rx.Observable
            .defer(() => Rx.Observable.from(anugaApi.getMyPerms(projectId)));

        const buildFailureBranch = () => {
            // Inline (per-subscription): invalidate dedupe so the next panel-
            // open can retry, and emit setPermsLoadFailed + toast.
            _lastFetchByProjectId.delete(projectId);
            return Rx.Observable.of(
                setPermsLoadFailed(true),
                show({
                    title: 'hydrata.anuga.permsUnavailable.title',
                    message: 'hydrata.anuga.permsUnavailable.message',
                    autoDismiss: 5,
                    position: 'tc'
                }, 'warning')
            );
        };

        return fetchOnce
            .map((response) => setAnugaResourcePerms(response?.data || {}, projectId))
            .catch((err) => {
                // First failure. Retry once on 5xx or network error.
                // 4xx (e.g. 404 anon-on-private) — bail to the failure branch
                // immediately (NO 1s delay).
                //
                // ⚠ MapStore2's libs/ajax.js response interceptor rewrites
                // axios rejections to be the response BLOB (status, data,
                // headers, originalError) directly — NOT a stock axios Error
                // where .response holds the response. So we read `err.status`
                // (top-level), not `err.response.status`. A network error
                // (interceptor's `errorResponseFunc` returns the original
                // Error) has no `status` field — fall through to retryable.
                const status = err?.status;
                const isRetryable = (typeof status !== 'number') || (status >= 500 && status < 600);
                if (!isRetryable) {
                    return buildFailureBranch();
                }
                // 1s backoff, then try again exactly once. If the second
                // attempt also fails, propagate to the failure branch.
                return Rx.Observable.timer(1000).mergeMap(() =>
                    fetchOnce
                        .map((response) => setAnugaResourcePerms(response?.data || {}, projectId))
                        .catch(() => buildFailureBranch())
                );
            });
    });

export default {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
};

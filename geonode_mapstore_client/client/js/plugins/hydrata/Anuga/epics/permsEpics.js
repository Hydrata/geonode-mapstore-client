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
 * Dedupe: 30-second module-level cache keyed by projectId. Backend sets
 *   Cache-Control: private, max-age=60; we use half that interval to be
 *   conservative against clock skew.
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
 */
export const fetchMyPermsEpic = (action$) => action$
    .ofType(FETCH_MY_PERMS)
    .mergeMap((action) => {
        const { projectId } = action;

        // 30s dedupe gate. Skip if we fetched within the window.
        const now = _now();
        const last = _lastFetchByProjectId.get(projectId);
        if (last !== undefined && now - last < _DEDUPE_WINDOW_MS) {
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
                    position: 'tc',
                    level: 'warning'
                })
            );
        };

        return fetchOnce
            .map((response) => setAnugaResourcePerms(response?.data || {}))
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
                        .map((response) => setAnugaResourcePerms(response?.data || {}))
                        .catch(() => buildFailureBranch())
                );
            });
    });

export default {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
};

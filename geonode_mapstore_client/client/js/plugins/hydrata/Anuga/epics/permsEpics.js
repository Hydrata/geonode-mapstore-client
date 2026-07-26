/**
 * V2P-21 — Lazy-fetch my_perms on Anuga panel open.
 *
 * Wires the V2P-20 backend endpoint
 *   GET /api/v2/anuga/projects/<pid>/my-perms/
 * into Redux so the V2P-02 helpers (canEditLayer/canDeleteLayer/canDownloadLayer
 * in selectorsAnuga.js) can read state.anuga.resources.<type>[i].perms instead
 * of the legacy project my_role gate.
 *
 * Trigger: INIT_ANUGA (= componentDidUpdate on AnugaContainer = panel-open), OR
 *   SET_ANUGA_PROJECT_DATA — whichever happens second, since INIT_ANUGA may fire
 *   before the project id exists (see triggerFetchMyPermsOnInitEpic). INIT_ANUGA
 *   is the SAME action initAnugaEpic uses to fan out the v1 catalogue list
 *   endpoints, so we already know the user has the panel visible. Neither action
 *   is dispatched on map init — that's MAP_CONFIG_LOADED in MapStore2's stack.
 *   The test suite explicitly asserts no fetch on MAP_CONFIG_LOADED to guard the
 *   TASK-658 perf budget (cold-anon interactive_s median 13.60s; an eager perm
 *   fetch on map init would push past the 14.28s 5% budget).
 *
 * Dedupe: 30-second module-level cache keyed by projectId, in fetchMyPermsEpic.
 *   TASK-2463 (epic 2425 W2.9) — a correction. W2.8 wrote here that this window
 *   is "now the ONLY thing suppressing repeat panel-open fetches", which is
 *   false, and the thing that refutes it is 20 lines below in this same file:
 *   triggerFetchMyPermsOnInitEpic ends in `.distinctUntilChanged()`, so repeat
 *   panel-opens on an UNCHANGED project emit no FETCH_MY_PERMS at all and never
 *   reach the window. What the window actually suppresses is the fetches that DO
 *   get through it — an A -> B -> A nav inside 30s, and any other dispatcher of
 *   FETCH_MY_PERMS (the post-checkout poll, the tab-visible re-read, "Check
 *   again"), all of which pass `force: true` where being suppressed would be a
 *   bug. Two independent mechanisms, different jobs.
 *
 *   What W2.8 got right and is still true: the window is no longer sized against
 *   a backend max-age. This used to say "half the backend max-age, to be
 *   conservative against clock skew"; TASK-2463 (W2.7) changed the header to
 *   `private, no-cache` + ETag, so there is no freshness window left to be half
 *   of and 30s is simply the chosen budget. Why the header had to change:
 *   my_perms is mutated OUT OF BAND by the Stripe webhook, and a max-age with no
 *   validator made the post-checkout poll re-read its own cache for the whole
 *   time it ran. See gn_anuga/api_v2.py::my_perms.
 *
 * Error handling: retry once on 5xx / network error with 1s backoff. On final
 *   failure — AND only if no newer response for the same project has already
 *   been applied (the ordering guard below covers both branches as of W2.9) —
 *   dispatch setPermsLoadFailed(true) + a non-blocking toast. The V2P-02 helpers
 *   MUST treat permsLoadFailed=true as "fall back to project my_role" (they
 *   already do — _resolveResourcePerms returns layer.perms || [] when
 *   state.anuga.resources[type] is missing the id, and the helpers then defer to
 *   myRole). That fallback is exactly why a STALE failure matters: it discards
 *   perms that are already correct in the store.
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
//
// 30s window. This used to say "half the backend Cache-Control max-age=60 to be
// safe" — that reasoning is GONE: TASK-2463 (W2.7) changed the header to
// `private, no-cache` + ETag, so there is no backend freshness window left to be
// half of. See the header docstring. 30s is now simply the chosen budget.
const _DEDUPE_WINDOW_MS = 30000;
let _lastFetchByProjectId = new Map();

// ── Response-ordering guard (TASK-2463, epic 2425 W2.8) ─────────────────────
//
// Monotonic sequence per dispatched fetch, plus the highest sequence whose
// response has been APPLIED, per project. A response whose sequence is older
// than one already applied is dropped instead of written to the store.
//
// WHY THIS IS NEEDED NOW, when it was not before. Until W2.7 the post-checkout
// poll's 2nd..20th ticks were answered from the browser's own HTTP cache — 20
// byte-identical bodies, so ordering was unobservable. W2.7 correctly made every
// tick a real network read, which also made them real, independently-timed,
// out-of-order-capable responses for the FIRST time. The failure it opens is
// specific and silent: tick 1 (pre-webhook, `public`) is slow, tick 2
// (post-webhook, `private`) is fast, tick 2 lands, the padlock appears, the
// reducer's PAID clear disarms `pending`, `takeWhile` ends the poll — and THEN
// tick 1 lands and overwrites the slice with `public`. No further response is
// coming, so the customer who has paid ends on the pre-payment state.
//
// WHY A SEQUENCE NUMBER AND NOT switchMap. switchMap would cancel the in-flight
// request on every new FETCH_MY_PERMS, including one for a DIFFERENT project
// (an SPA nav A -> B would kill A's fetch, and B's would kill nothing useful),
// and it would silently drop the single retry below. The ordering problem is
// "which answer is newest", not "is more than one request allowed" — so the fix
// is stated as that, and mergeMap's concurrency is deliberately kept.
//
// KEYED PER PROJECT, not globally: a global newest-wins would make B's answer
// discard A's whenever A's landed second, which is a different bug in the same
// family (see the paired karma test).
let _fetchSeq = 0;
const _appliedSeqByProjectId = new Map();

/** Test seam. Resets BOTH module caches — a half-reset leaks state between tests. */
export const __resetPermsCacheForTests = () => {
    _lastFetchByProjectId = new Map();
    _appliedSeqByProjectId.clear();
    _fetchSeq = 0;
};

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
 * Uses mergeMap (NOT switchMap) so that a 2nd FETCH_MY_PERMS arriving while the
 * 1st is still in flight does NOT cancel the in-flight request — which matters
 * most across projects, where cancelling A because B asked would lose A's perms
 * while A is still loaded.
 *
 * ⚠ CONCURRENCY IS THEREFORE REAL, and this comment used to deny it. It said the
 * dedupe gate "ensures the 2nd one short-circuits to Observable.empty() without
 * issuing a duplicate HTTP call, so mergeMap is safe". TASK-2464 then added
 * `force`, which bypasses that gate by design, and the post-checkout poll passes
 * `force: true` on EVERY tick (paywallEpics.js) — so from that moment the stated
 * premise was false and the conclusion drawn from it unsupported. Two forced
 * fetches for the same project genuinely do run concurrently and genuinely can
 * complete out of order. What makes mergeMap safe is now the explicit
 * `_appliedSeqByProjectId` ordering guard below, not the dedupe.
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
 *   2. pollMyPermsWhilePendingEpic polled every 3s against a 30s window, so 9 of
 *      the first 10 ticks were no-ops. The poll looked like it was working and
 *      was mostly not. (Its budget has since grown a second, slower phase —
 *      PAYWALL_POLL_SLOW_* in paywallEpics.js — which does not change the point.)
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

        // Sequence stamped at REQUEST time, so "newest" means "asked most
        // recently" — the order the caller intended. The retry below deliberately
        // re-uses this same sequence: a retry is the same logical request, so if a
        // newer answer has landed while it was backing off, its result is stale
        // and must be dropped too.
        const seq = ++_fetchSeq;

        // Manual single-retry: catch handles the first failure, decides
        // whether to retry (5xx/network) or bail (4xx), then re-runs
        // fetchOnce or returns the inline failure branch.
        const fetchOnce = Rx.Observable
            .defer(() => Rx.Observable.from(anugaApi.getMyPerms(projectId)));

        /** Has a NEWER request for this project already had its answer applied? */
        const isSuperseded = () => {
            const applied = _appliedSeqByProjectId.get(projectId);
            return applied !== undefined && applied > seq;
        };

        /**
         * Apply a response ONLY if no newer one has already been applied for this
         * project. Emits the store write, or nothing at all.
         *
         * Silent by design: dropping a superseded answer is correct behaviour, not
         * an error, and the state the user sees is the newer one either way.
         */
        const applyIfNewest = (response) => {
            if (isSuperseded()) {
                return Rx.Observable.empty();
            }
            _appliedSeqByProjectId.set(projectId, seq);
            return Rx.Observable.of(setAnugaResourcePerms(response?.data || {}, projectId));
        };

        const buildFailureBranch = () => {
            // THE FAILURE BRANCH IS UNDER THE SAME ORDERING GUARD (TASK-2463, epic
            // 2425 W2.9). W2.8 wrapped only the success write, and this is the
            // branch that dispatches setPermsLoadFailed(true) — which the V2P-02
            // helpers read as "ignore state.anuga.resources, fall back to project
            // my_role". So on the poll's own shape (tick 1 slow and eventually
            // 5xx, tick 2 fast and paid) a customer's correct, already-applied
            // paid perms were discounted by an older request's failure, plus a
            // permissions-unavailable toast, with no further response coming.
            // Ordering was the whole point of the guard; a stale FAILURE is as
            // stale as a stale success.
            if (isSuperseded()) {
                return Rx.Observable.empty();
            }
            // Inline (per-subscription): invalidate dedupe so the next panel-
            // open can retry, and emit setPermsLoadFailed + toast. The
            // invalidation is inside the guard too — a newer request has already
            // re-stamped the window with its own timestamp, and deleting it on
            // behalf of a superseded one would only buy a redundant refetch.
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
            .mergeMap(applyIfNewest)
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
                        .mergeMap(applyIfNewest)
                        .catch(() => buildFailureBranch())
                );
            });
    });

export default {
    triggerFetchMyPermsOnInitEpic,
    fetchMyPermsEpic
};

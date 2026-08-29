/**
 * Compute-meter balance-fetch epics (TASK-2100, epic 2092 W4.2).
 *
 * Balance is Account-scoped (not project-scoped), but INIT_ANUGA is still
 * the right trigger — it's the same "panel is open, user is authenticated"
 * signal permsEpics.js uses for the my_perms fetch, and firing an extra GET
 * for an anonymous/logged-out viewer would just 401 harmlessly (the FE
 * balance surface only ever renders for an authenticated user anyway).
 */
import Rx from 'rxjs';
import * as anugaApi from '../api/anugaApi';
import { INIT_ANUGA } from '../actionsAnuga';
import { readErrStatus, readErrData } from '../utils/apiErrorUtils';
import {
    FETCH_COMPUTE_BALANCE,
    fetchComputeBalance,
    setComputeBalance,
    RESEND_EMAIL_VERIFICATION_REQUEST,
    setResendEmailVerificationResult
} from '../../Paywall/meter/actions';
import { SET_ACCOUNT_SUMMARY } from '../../Paywall/account/actions';
import { getComputeMeterState } from '../../Paywall/meter/reducer';

// TASK-2513 (epic 2425 W3d) — one retry, and only for a failure that could
// plausibly be transient. 401/403 are excluded because they are the ANONYMOUS
// VIEWER on a public map, which is the common case: retrying those would double
// the request count for every logged-out visitor and never succeed.
const _isRetryableBalanceError = (err) => {
    const status = readErrStatus(err);
    return status !== 401 && status !== 403;
};

// Module-level "already fired the initial fetch" guard — mirrors
// permsEpics.js's dedupe idiom (this fetch is cheap/idempotent, but there is
// no reason to re-fire it on every INIT_ANUGA the way my_perms's dedupe
// window works either; a simple once-per-session gate is enough here).
let _initialFetchHandled = false;
export const __resetComputeMeterInitForTests = () => { _initialFetchHandled = false; };

export const triggerFetchBalanceOnInitEpic = (action$) => action$
    .ofType(INIT_ANUGA)
    .filter(() => !_initialFetchHandled)
    .map(() => {
        _initialFetchHandled = true;
        return fetchComputeBalance();
    });

export const fetchComputeBalanceEpic = (action$) => action$
    .ofType(FETCH_COMPUTE_BALANCE)
    .switchMap(() => Rx.Observable
        // TASK-2513 — `defer`, and it is the whole fix, not a style choice.
        // `anugaApi.getComputeBalance()` is EAGER: called outside a defer, the
        // promise is created once and `.retryWhen` re-subscribes to an
        // ALREADY-SETTLED promise, re-emitting the same rejection WITHOUT
        // issuing a second HTTP request. The paired test asserts a REQUEST
        // COUNT rather than an emission count for exactly that reason — an
        // emission assertion would pass the no-op version.
        .defer(() => Rx.Observable.from(anugaApi.getComputeBalance()))
        .retryWhen((errors) => errors
            // One retry, and only for a plausibly-transient failure. `zip` with
            // a 1-based index turns "re-throw after the first retry" into a
            // condition rather than a counter.
            .zip(Rx.Observable.range(1, 2), (err, attempt) => ({err, attempt}))
            .mergeMap(({err, attempt}) => (
                attempt < 2 && _isRetryableBalanceError(err)
                    ? Rx.Observable.of(null)
                    : Rx.Observable.throw(err)
            ))
        )
        .map((response) => setComputeBalance(response?.data || {}))
        // A failed balance fetch (401 for an anon viewer, or a 5xx that failed
        // twice) is non-fatal — the panel simply stays in its default
        // `enabled: false` state (dark), same visual outcome as the flag
        // genuinely being off.
        .catch(() => Rx.Observable.empty())
    );

/**
 * TASK-2513 (epic 2425 W3d) — the SECOND TRIGGER for the balance.
 *
 * triggerFetchBalanceOnInitEpic is once per session and fetchComputeBalanceEpic
 * swallows every error, so before this a single transient failure of the boot
 * fetch left `state.anuga.computeMeter` at initialState for the rest of the
 * session, with no retry and no user-visible sign — the meter simply read as
 * dark. That is not cosmetic: `enabled` is a hard render-null kill-switch in
 * ComputeMeterPanel, so all three refusal modals (insufficient_balance /
 * cap_exceeded / estimate_ceiling) render NOTHING and a 402 refusal becomes a
 * silently dead Run button.
 *
 * THE TRIGGER IS READ OFF THE ACTION, NOT THE STORE. `data.manager` is a
 * non-null username string on account_views.py's LIVE branch and absent from its
 * dark branch (`{'enabled': False}`), so this cannot depend on whether the
 * summary reducer ran before or after the epic saw the action.
 *
 * THE GATE IS `loaded === false`, AND NOTHING ELSE. Not `balance === null`:
 * initialState and the backend's dark response are the identical
 * {enabled: false, balance: null}, so that rule would fire on every summary for
 * the life of every dark session — and three of the four prod sites ship
 * COMPUTE_METER_ENABLED off. And deliberately NOT a module-level once-guard
 * mirroring `_initialFetchHandled`: Anuga.js registers the balance epic and this
 * one separately with no guaranteed response order, so a summary landing first
 * would burn the guard and permanently disable the only repair path there is.
 * `loaded` self-clears on ANY response, including a dark one, which bounds this
 * without a guard.
 *
 * The no-account-at-boot shape (enabled true, balance null) is deliberately NOT
 * refetched — no live consumer misbehaves on it, and a rule that did would be
 * the per-summary fetch this docstring exists to prevent.
 */
export const refetchBalanceOnAccountSummaryEpic = (action$, store) => action$
    .ofType(SET_ACCOUNT_SUMMARY)
    .filter((action) => typeof action?.data?.manager === 'string' && !!action.data.manager)
    .filter(() => getComputeMeterState(store.getState()).loaded === false)
    .map(() => fetchComputeBalance());

/**
 * TASK-2849 (epic 2839 W2.2) — resend surface for TASK-2844's BE dispatch
 * gate. Reads `resendUrl` off the OPEN email_unverified modal in the store
 * (the 403 body's `resend_url`, never hardcoded) rather than off the action,
 * because the click carries no payload — it can only ever mean "resend for
 * whatever refusal is currently on screen".
 *
 * `switchMap` (not `exhaustMap`): a genuine double-click is already guarded
 * by the BE's own 5-minute cooldown (EmailVerificationResendView), and the
 * button disables locally via `pending` for the same reason
 * subscribeCheckoutEpic's buttons do — this just needs to not pile up
 * concurrent requests if the user mashes it before `pending` paints.
 */
export const resendEmailVerificationEpic = (action$, store) => action$
    .ofType(RESEND_EMAIL_VERIFICATION_REQUEST)
    .switchMap(() => {
        const resendUrl = getComputeMeterState(store.getState())?.modal?.resendUrl;
        if (!resendUrl) {
            // No open modal to resend for — a stray/late click. Say nothing
            // rather than guess at a URL.
            return Rx.Observable.of(setResendEmailVerificationResult('error'));
        }
        return Rx.Observable
            .defer(() => Rx.Observable.from(anugaApi.resendEmailVerification(resendUrl)))
            .map((response) => {
                const data = response?.data || {};
                // EmailVerificationResendView's status values: 'sent' |
                // 'already_verified' | 'send_failed' (all HTTP 200) — never
                // guess a status this view didn't send.
                return setResendEmailVerificationResult(data.status || 'sent', data.detail);
            })
            .catch((err) => {
                const status = readErrStatus(err);
                const data = readErrData(err);
                // 429 cooldown carries its own detail + retry_after_seconds —
                // surfaced as 'cooldown', distinct from a hard failure.
                if (status === 429 && data?.status === 'cooldown') {
                    return Rx.Observable.of(setResendEmailVerificationResult('cooldown', data.detail));
                }
                return Rx.Observable.of(setResendEmailVerificationResult('error'));
            });
    });

export default {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic,
    refetchBalanceOnAccountSummaryEpic,
    resendEmailVerificationEpic
};

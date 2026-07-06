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
import {
    FETCH_COMPUTE_BALANCE,
    fetchComputeBalance,
    setComputeBalance
} from '../../Paywall/meter/actions';

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
    .switchMap(() => Rx.Observable.from(anugaApi.getComputeBalance())
        .map((response) => setComputeBalance(response?.data || {}))
        // A failed balance fetch (401 for an anon viewer, 5xx) is non-fatal —
        // the panel simply stays in its default `enabled: false` state
        // (dark), same visual outcome as the flag genuinely being off.
        .catch(() => Rx.Observable.empty())
    );

export default {
    triggerFetchBalanceOnInitEpic,
    fetchComputeBalanceEpic
};

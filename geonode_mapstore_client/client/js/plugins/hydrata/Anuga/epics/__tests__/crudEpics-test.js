/*
 * TASK-2042 (F2-residual, epic 2037 W2) — retryAnugaRunEpic.
 *
 * Dogfood finding: retry reset an errored run to 'created' and stopped
 * there — permanently stuck, no re-enqueue. The BE fix (RunViewSetV2.retry)
 * now dispatches a fresh build for the run's SCENARIO (a brand-new Run row;
 * build_simulation_package always creates one), so action.runId is
 * SUPERSEDED the instant retry succeeds — it stays 'created' forever. This
 * epic must therefore no longer arm startActiveRunPolling(action.runId): that
 * would poll a run that can never progress, which is misleading, not merely
 * wasteful. The Scenarios panel's own scenario-status poll (already running
 * whenever Retry is reachable — see anugaContainer.js's Scenarios-tab toggle)
 * is what reflects created -> building -> built for the caller.
 *
 * Proof points:
 *   (a) success -> dispatches the retrySuccess toast, and NOTHING else (in
 *       particular, no START_ACTIVE_RUN_POLLING for the old/superseded run).
 *   (b) failure -> dispatches the retryError toast.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../../MapStore2/web/client/libs/ajax';
import { retryAnugaRunEpic } from '../crudEpics';
import { retryAnugaRun } from '../../actions/scenarioActions';
import { START_ACTIVE_RUN_POLLING } from '../../actions/pollingActions';
import { SHOW_NOTIFICATION } from '../../../../../../MapStore2/web/client/actions/notifications';

const makeActions$ = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('TASK-2042 retryAnugaRunEpic', () => {
    let mockAxios;

    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
    });
    afterEach(() => { mockAxios.restore(); });

    it('success: shows the retrySuccess toast and does NOT poll the (now-superseded) old run', (done) => {
        mockAxios.onPost(/\/runs\/501\/retry\/$/).reply(202, {
            id: 501, status: 'created', rebuilding: true
        });
        const action$ = makeActions$([retryAnugaRun(501)]);
        const emitted = [];
        retryAnugaRunEpic(action$).subscribe(
            (a) => emitted.push(a),
            (err) => done(err),
            () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SHOW_NOTIFICATION);
                expect(emitted[0].message).toBe('hydrata.anuga.retrySuccess');
                expect(emitted[0].level).toBe('success');
                // The load-bearing regression guard: no poll armed on the
                // superseded run id.
                expect(emitted.some((a) => a.type === START_ACTIVE_RUN_POLLING)).toBe(false);
                done();
            }
        );
    });

    it('failure: shows the retryError toast', (done) => {
        mockAxios.onPost(/\/runs\/502\/retry\/$/).reply(409, {
            error_code: 'INVALID_TRANSITION', detail: "Cannot transition from 'built' to 'created'."
        });
        const action$ = makeActions$([retryAnugaRun(502)]);
        const emitted = [];
        retryAnugaRunEpic(action$).subscribe(
            (a) => emitted.push(a),
            (err) => done(err),
            () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SHOW_NOTIFICATION);
                expect(emitted[0].message).toBe('hydrata.anuga.retryError');
                expect(emitted[0].level).toBe('error');
                done();
            }
        );
    });
});

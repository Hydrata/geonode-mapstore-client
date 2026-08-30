/**
 * TASK-2645 (epic 2635 W1) — a 400 PRICING_UNAVAILABLE from the dispatch
 * endpoint must produce a visible, actionable message — NOT
 * Rx.Observable.empty() (the pre-2645 behaviour: the Run button did
 * nothing at all).
 *
 * Sibling to the "TASK-2100 meter-gate 402/429 interception" describe
 * block in epicsAnuga-test.js (same epic, same mock pattern) — kept in its
 * own file/require.context registration per this wave's karma-scoping
 * method (memory: a new spec executes nothing until named in
 * tests-paywall-scoped.webpack.js; verified via the before/after count).
 *
 * ANTI-VACUITY: AC1 fails at HEAD — pre-2645, runAnugaScenarioEpic's catch
 * block has no branch for status===400/PRICING_UNAVAILABLE, so it falls
 * through to `return Rx.Observable.empty()` and this test's
 * `emitted.length === 1` assertion goes red (0 emitted, not 1).
 */
import expect from 'expect';
import Rx from 'rxjs';

import { runAnugaScenarioEpic } from '../epics/crudEpics';
import { SHOW_NOTIFICATION } from '../../../../../MapStore2/web/client/actions/notifications';

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

describe('TASK-2645 runAnugaScenarioEpic — PRICING_UNAVAILABLE', () => {
    const MockAdapter = require('axios-mock-adapter');
    const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;

    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('AC1 — 400 PRICING_UNAVAILABLE emits a visible warning notification, NOT Rx.Observable.empty()', (done) => {
        mockAxios.onPost('/api/v2/anuga/scenarios/9/run/').reply(400, {
            error_code: 'PRICING_UNAVAILABLE',
            detail: "Run 9: cannot price from build-frozen inputs (mesh_triangle_count=0, provenance duration_seconds=None) — refuse dispatch rather than default to $0."
        });

        const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 9}, computeTarget: 'batch-x32'}]);
        const emitted = [];

        runAnugaScenarioEpic(action$, {getState: () => ({})})
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SHOW_NOTIFICATION);
                // AC1 — actionable: tells the user what to DO, not the raw
                // error code / raw BE detail string.
                expect(emitted[0].message.toLowerCase()).toInclude('build the mesh');
                // memory mapstore-show-notification-level-second-arg — the
                // level MUST be 'warning', proving level was passed as the
                // second positional arg (a `level` key inside opts would be
                // silently overwritten to 'success' by show()'s default).
                expect(emitted[0].level).toBe('warning');
                done();
            });
    });

    it('AC2 — the 402 estimate_ceiling branch is unchanged (regression arm)', (done) => {
        const { SET_METER_ESTIMATE_CEILING } = require('../../Paywall/meter/actions');
        mockAxios.onPost('/api/v2/anuga/scenarios/10/run/').reply(402, {
            state: 'estimate_ceiling',
            detail: 'Estimated at $45.00, above the $20.00 automatic dispatch ceiling.'
        });

        const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 10}, computeTarget: 'batch-x32'}]);
        const emitted = [];

        runAnugaScenarioEpic(action$, {getState: () => ({})})
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SET_METER_ESTIMATE_CEILING);
                done();
            });
    });

    it('AC2 — the 429 FREE_CAP_EXCEEDED branch is unchanged (regression arm)', (done) => {
        const { SET_METER_CAP_EXCEEDED } = require('../../Paywall/meter/actions');
        mockAxios.onPost('/api/v2/anuga/scenarios/11/run/').reply(429, {
            error_code: 'FREE_CAP_EXCEEDED',
            detail: 'Free daily compute-run cap (3) reached for this account.'
        });

        const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 11}, computeTarget: 'batch-x32'}]);
        const emitted = [];

        runAnugaScenarioEpic(action$, {getState: () => ({})})
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(SET_METER_CAP_EXCEEDED);
                done();
            });
    });

    it('PRICING_UNAVAILABLE is NOT folded into the meter modal (no SET_METER_* action emitted)', (done) => {
        const { SET_METER_INSUFFICIENT_BALANCE, SET_METER_CAP_EXCEEDED, SET_METER_ESTIMATE_CEILING } =
            require('../../Paywall/meter/actions');
        mockAxios.onPost('/api/v2/anuga/scenarios/12/run/').reply(400, {
            error_code: 'PRICING_UNAVAILABLE',
            detail: 'cannot price from build-frozen inputs'
        });

        const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 12}, computeTarget: 'batch-x32'}]);
        const emitted = [];

        runAnugaScenarioEpic(action$, {getState: () => ({})})
            .subscribe(a => emitted.push(a), done, () => {
                const meterTypes = [SET_METER_INSUFFICIENT_BALANCE, SET_METER_CAP_EXCEEDED, SET_METER_ESTIMATE_CEILING];
                expect(emitted.some((a) => meterTypes.includes(a.type))).toBe(false);
                done();
            });
    });

    // TASK-2869 (epic 2839 W4-pre) — GpuOversizeForTarget's 402
    // (api_v2.py:3862-3877, TASK-2840's batch-gpu-l40s pre-dispatch memory
    // gate). Same "no CTA fixes this, contact us" family as estimate_ceiling
    // — reuses that EXACT modal via the EXACT same action (not a new
    // surface), so a size-refused Run shows the BE's detail text instead of
    // the pre-2869 silent no-op.
    //
    // ANTI-VACUITY: AC1 fails at HEAD — pre-2869, runAnugaScenarioEpic's
    // catch block has no branch for status===402/state==='oversize', so it
    // falls through to `return Rx.Observable.empty()` and this test's
    // `emitted.length === 1` assertion goes red (0 emitted, not 1).
    describe('TASK-2869 — 402 oversize', () => {
        it('AC1 — 402 oversize emits SET_METER_ESTIMATE_CEILING with the BE detail text (was a silent no-op)', (done) => {
            const { SET_METER_ESTIMATE_CEILING } = require('../../Paywall/meter/actions');
            mockAxios.onPost('/api/v2/anuga/scenarios/13/run/').reply(402, {
                state: 'oversize',
                detail: 'This run is predicted to need 42000 MiB of memory, above the 32000 MiB batch-gpu-l40s dispatch capacity. Contact us for a custom quote.'
            });

            const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 13}, computeTarget: 'batch-gpu-l40s'}]);
            const emitted = [];

            runAnugaScenarioEpic(action$, {getState: () => ({})})
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(1);
                    expect(emitted[0].type).toBe(SET_METER_ESTIMATE_CEILING);
                    expect(emitted[0].detail).toInclude('Contact us for a custom quote');
                    done();
                });
        });

        it('a 402 with an unrecognized state still falls through silently (regression guard — unknown-shape errors stay a no-op)', (done) => {
            mockAxios.onPost('/api/v2/anuga/scenarios/14/run/').reply(402, {
                state: 'some_future_state',
                detail: 'unrelated'
            });

            const action$ = mockActions([{type: 'RUN_ANUGA_SCENARIO', scenario: {id: 14}, computeTarget: 'batch-gpu-l40s'}]);
            const emitted = [];

            runAnugaScenarioEpic(action$, {getState: () => ({})})
                .subscribe(a => emitted.push(a), done, () => {
                    expect(emitted.length).toBe(0);
                    done();
                });
        });
    });
});

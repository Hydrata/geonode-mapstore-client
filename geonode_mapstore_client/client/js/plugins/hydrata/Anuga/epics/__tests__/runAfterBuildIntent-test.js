/*
 * TASK-2890 (epic 2815 W3, Layer 4) — the deferred Build-and-Run intent must
 * survive the Scenarios menu unmounting. anugaContainer.js:286 stops scenario
 * polling AND unmounts anugaScenarioMenu (destroying its local
 * this.state.runAfterBuild machine) the instant the menu closes; if the build
 * is still running at that point, the pre-existing component-local-only
 * design loses the intent forever and the run never dispatches.
 *
 * This spec exercises the Redux-held backstop (runAfterBuildEpic +
 * hasArmedRunAfterBuild, epics/pollingEpics.js) DIRECTLY off
 * SET_ANUGA_POLLING_DATA, independent of the real 8s timer — the timer's own
 * continuity fix (pollAnugaScenarioEpic's takeWhile) is proven separately by
 * unit-testing hasArmedRunAfterBuild, the exact predicate that drives it.
 */
import expect from 'expect';
import Rx from 'rxjs';
import {runAfterBuildEpic, hasArmedRunAfterBuild} from '../pollingEpics';
import {SET_ANUGA_POLLING_DATA} from '../../actions/dataActions';
import {RUN_ANUGA_SCENARIO} from '../../actions/scenarioActions';

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

const storeWith = (runAfterBuild, extra = {}) => ({
    getState: () => ({
        anuga: {
            scenarios: {runAfterBuild},
            ui: {showAnugaScenarioMenu: false, meshDivergenceThreshold: null, sessionComputeTargets: {}, ...extra}
        }
    })
});

describe('TASK-2890 hasArmedRunAfterBuild — the exact predicate that keeps polling alive past a menu close', () => {
    it('is false with no arms', () => {
        expect(hasArmedRunAfterBuild(storeWith({}))).toBe(false);
    });
    it('is true with an arm pending, regardless of phase', () => {
        expect(hasArmedRunAfterBuild(storeWith({7: 'awaiting-inflight'}))).toBe(true);
        expect(hasArmedRunAfterBuild(storeWith({7: 'awaiting-built'}))).toBe(true);
    });
});

describe('TASK-2890 AC1 — runAfterBuildEpic resolves an armed run with the menu UNMOUNTED', () => {
    it('RED-FIRST target: advances awaiting-inflight -> awaiting-built once the build is observed in flight, does not fire yet', (done) => {
        const store = storeWith({7: 'awaiting-inflight'});
        const action$ = mockActions([{
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 7, status: 'building', computed_status: 'building'}]
        }]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe('ADVANCE_RUN_AFTER_BUILD');
                expect(emitted[0].scenarioId).toBe(7);
                const runDispatches = emitted.filter(a => a.type === RUN_ANUGA_SCENARIO);
                expect(runDispatches.length).toBe(0);
                done();
            });
    });

    it('fires EXACTLY ONE run dispatch on the awaiting-built -> built transition, with the menu unmounted, and clears the arm', (done) => {
        const store = storeWith({7: 'awaiting-built'});
        const action$ = mockActions([{
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 7, status: 'built', computed_status: 'built', latest_run: {mesh_provenance: null}}]
        }]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                const runDispatches = emitted.filter(a => a.type === RUN_ANUGA_SCENARIO);
                expect(runDispatches.length).toBe(1);
                expect(runDispatches[0].scenario.id).toBe(7);
                const clears = emitted.filter(a => a.type === 'CLEAR_RUN_AFTER_BUILD');
                expect(clears.length).toBe(1);
                expect(clears[0].scenarioId).toBe(7);
                // Reopens the panel so the dispatched run is visible.
                const reopen = emitted.find(a => a.type === 'SET_ANUGA_SCENARIO_MENU');
                expect(reopen).toExist();
                expect(reopen.visible).toBe(true);
                done();
            });
    });

    it('does NOT resolve (leaves it for the mounted component) while the menu IS mounted', (done) => {
        const store = storeWith({7: 'awaiting-built'}, {showAnugaScenarioMenu: true});
        const action$ = mockActions([{
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 7, status: 'built', computed_status: 'built'}]
        }]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });
});

describe('TASK-2890 AC2 (epic-side) — a terminal failure clears the arm without firing a run', () => {
    it('clears the arm on an error status, dispatches no run', (done) => {
        const store = storeWith({7: 'awaiting-built'});
        const action$ = mockActions([{
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 7, status: 'error', computed_status: 'error'}]
        }]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe('CLEAR_RUN_AFTER_BUILD');
                expect(emitted[0].scenarioId).toBe(7);
                done();
            });
    });

    it('clears the arm when the awaited scenario has vanished from a successful poll response', (done) => {
        const store = storeWith({7: 'awaiting-built'});
        const action$ = mockActions([{type: SET_ANUGA_POLLING_DATA, scenarios: []}]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe('CLEAR_RUN_AFTER_BUILD');
                done();
            });
    });
});

describe('TASK-2890 divergence decision (documented reversal, unmounted-arm resolution only)', () => {
    it('an unmounted-resolved arm still fires (bypasses the TASK-2211 pause) when the build diverged', (done) => {
        const store = storeWith({7: 'awaiting-built'}, {meshDivergenceThreshold: 2});
        const action$ = mockActions([{
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{
                id: 7, status: 'built', computed_status: 'built',
                latest_run: {
                    status: 'complete',
                    mesh_triangle_count: 300000,
                    mesh_provenance: {pre_build_triangle_estimate: 100000}
                }
            }]
        }]);
        const emitted = [];
        runAfterBuildEpic(action$, store)
            .subscribe(a => emitted.push(a), done, () => {
                const runDispatches = emitted.filter(a => a.type === RUN_ANUGA_SCENARIO);
                expect(runDispatches.length).toBe(1);
                done();
            });
    });
});

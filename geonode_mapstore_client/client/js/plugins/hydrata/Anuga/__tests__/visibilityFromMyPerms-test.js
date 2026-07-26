/**
 * TASK-2463 (epic 2425 W2.6) — my_perms is the SECOND server channel that
 * refreshes a project's `visibility`, and the post-checkout poll is the thing
 * that uses it.
 *
 * THE DEFECT THESE PIN: the padlock never appeared after a paid checkout. The
 * chain had two independent breaks, and each of them alone was enough:
 *
 *   1. `visibility` had one writer, SET_ANUGA_PROJECT_DATA, dispatched only by
 *      the project fetch and the Sharing PATCH — neither of which runs on the
 *      checkout path, where the flip is made by the Stripe webhook. my_perms
 *      carried the new value all along and resourcesReducer discarded it.
 *   2. pollMyPermsWhilePendingEpic read the project id ONCE, when the poll was
 *      armed. On a checkout return that moment is INIT_ANUGA, which fires
 *      before initAnugaEpic has resolved the project — so `projectId` was
 *      undefined and the poll never dispatched FETCH_MY_PERMS at all.
 *
 * WHAT KARMA CAN AND CANNOT SAY HERE. These are reducer/epic wiring tests: they
 * prove the actions and the state transitions, and nothing about pixels. That
 * the padlock actually APPEARS on screen after a real checkout return is proved
 * only by test_padlock_appears_after_a_paid_checkout_return in the deploy repo
 * (tests/e2e/test_paywall_money_path.py) — jsdom has no layout engine, and this
 * epic has already been bitten by a test that asserted a callback fired instead
 * of the effect happening.
 */
import expect from 'expect';
import Rx from 'rxjs';

import projectsReducer from '../reducers/projectsReducer';
import resourcesReducer from '../reducers/resourcesReducer';
import { SET_ANUGA_RESOURCE_PERMS, SET_ANUGA_PROJECT_DATA, FETCH_MY_PERMS,
    setAnugaResourcePerms } from '../actionsAnuga';
import { getProjectVisibility } from '../selectorsAnuga';
import { pollMyPermsWhilePendingEpic, __setPollIntervalForTests } from '../epics/paywallEpics';

const permsAction = (projectId, payload) => setAnugaResourcePerms(payload, projectId);

describe('TASK-2463 W2.6 — visibility refreshed from my_perms', () => {

    describe('projectsReducer folds payload.visibility into projects.data', () => {

        const loaded = (over = {}) => projectsReducer(undefined, {
            type: SET_ANUGA_PROJECT_DATA,
            data: { id: 15834, name: 'Merewether', visibility: 'public', my_role: 'owner', ...over }
        });

        it('applies a NEW visibility for the matching project', () => {
            const next = projectsReducer(loaded(), permsAction(15834, { visibility: 'private' }));
            expect(next.data.visibility).toBe('private');
        });

        it('leaves every other field of projects.data intact (no wholesale replace)', () => {
            const next = projectsReducer(loaded(), permsAction(15834, {
                visibility: 'private',
                my_role: 'viewer',            // present in the payload, deliberately NOT folded
                scenarios: { '1': ['view'] }  // a resource_type map, not ours to write
            }));
            expect(next.data.id).toBe(15834);
            expect(next.data.name).toBe('Merewether');
            // my_role gates every can*/is* selector; my_perms must not move it.
            expect(next.data.my_role).toBe('owner');
            expect(next.data.scenarios).toBe(undefined);
        });

        it('IGNORES a payload for a DIFFERENT project (late response after SPA nav)', () => {
            const before = loaded();
            const next = projectsReducer(before, permsAction(999, { visibility: 'private' }));
            expect(next).toBe(before);
            expect(next.data.visibility).toBe('public');
        });

        it('IGNORES a payload with no project id at all — fail-safe, not fail-open', () => {
            const before = loaded();
            expect(projectsReducer(before, { type: SET_ANUGA_RESOURCE_PERMS, payload: { visibility: 'private' } }))
                .toBe(before);
        });

        it('IGNORES a payload carrying no visibility key', () => {
            const before = loaded();
            expect(projectsReducer(before, permsAction(15834, { my_role: 'owner' }))).toBe(before);
        });

        it('is a no-op before project data has landed', () => {
            const before = projectsReducer(undefined, { type: '@@INIT' });
            const next = projectsReducer(before, permsAction(15834, { visibility: 'private' }));
            expect(next).toBe(before);
            expect(next.data).toBe(null);
        });

        it('returns the SAME state object when the value has not changed', () => {
            // The poll runs every 3s and connect() shallow-compares. A fresh
            // `data` object per tick would re-render every consumer on a timer.
            const before = loaded({ visibility: 'private' });
            const next = projectsReducer(before, permsAction(15834, { visibility: 'private' }));
            expect(next).toBe(before);
            expect(next.data).toBe(before.data);
        });

        it('the padlock selector reads the refreshed value', () => {
            const projects = projectsReducer(loaded(), permsAction(15834, { visibility: 'organization' }));
            expect(getProjectVisibility({ anuga: { projects } })).toBe('organization');
        });
    });

    describe('the resources slice stays out of it — one source of truth', () => {
        it('does NOT copy visibility into state.anuga.resources', () => {
            const next = resourcesReducer(undefined, permsAction(15834, {
                visibility: 'private',
                boundaries: { '5': ['view'] }
            }));
            // A second copy here could disagree with the Sharing panel, which
            // reads projects.data through the same selector the padlock uses.
            expect(next.visibility).toBe(undefined);
            expect(next.boundaries.length).toBe(1);
        });
    });

    describe('pollMyPermsWhilePendingEpic resolves the project id per TICK', () => {
        beforeEach(() => __setPollIntervalForTests(10));
        afterEach(() => __setPollIntervalForTests(null));

        /** A store whose project data lands only after the poll has been armed
         *  — exactly the checkout-return ordering (INIT_ANUGA -> SET_PENDING
         *  happens before initAnugaEpic resolves the project). */
        const lateProjectStore = () => {
            const state = {
                anuga: {
                    projects: { data: null },
                    paywall: { steady: null, overlay: { state: 'pending' } }
                }
            };
            return { getState: () => state, state };
        };

        const actionsOf = (list) => {
            const subject = new Rx.Subject();
            const action$ = subject.asObservable();
            action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
            setTimeout(() => list.forEach(a => subject.next(a)), 0);
            return action$;
        };

        it('dispatches FETCH_MY_PERMS once the project lands, even though it was absent when the poll armed', (done) => {
            const store = lateProjectStore();
            const emitted = [];
            const sub = pollMyPermsWhilePendingEpic(
                actionsOf([{ type: 'PAYWALL:SET_PENDING' }]), store
            ).subscribe(a => emitted.push(a));

            // The project resolves after the poll is already running.
            setTimeout(() => { store.state.anuga.projects.data = { id: 15834 }; }, 25);
            setTimeout(() => {
                sub.unsubscribe();
                const perms = emitted.filter(a => a.type === FETCH_MY_PERMS);
                expect(perms.length > 0).toBe(true);
                expect(perms[0].projectId).toBe(15834);
                // TASK-2464: the poll must bypass the 30s dedupe or 9 of the
                // first 10 ticks are silent no-ops.
                expect(perms[0].force).toBe(true);
                done();
            }, 90);
        });

        it('still emits the balance refresh while the project is unknown', (done) => {
            const store = lateProjectStore();
            const emitted = [];
            const sub = pollMyPermsWhilePendingEpic(
                actionsOf([{ type: 'PAYWALL:SET_PENDING' }]), store
            ).subscribe(a => emitted.push(a));
            setTimeout(() => {
                sub.unsubscribe();
                expect(emitted.length > 0).toBe(true);
                expect(emitted.filter(a => a.type === FETCH_MY_PERMS).length).toBe(0);
                done();
            }, 45);
        });
    });
});

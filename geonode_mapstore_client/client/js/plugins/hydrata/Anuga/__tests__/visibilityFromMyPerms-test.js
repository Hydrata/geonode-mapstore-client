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
import { getProjectVisibility, getProjectMyRole, canManageAnugaMap } from '../selectorsAnuga';
import { canSeeVisibilityIndicator } from '../../Paywall/selectors';
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
                my_role: 'viewer',            // TASK-2497 — now folded too (see below)
                scenarios: { '1': ['view'] }  // a resource_type map, not ours to write
            }));
            expect(next.data.id).toBe(15834);
            expect(next.data.name).toBe('Merewether');
            // TASK-2497 (epic 2425 W3d) — this assertion was `toBe('owner')` and
            // was INVERTED deliberately. my_role is now folded off my_perms, and
            // that is safe because both channels derive it from ONE ladder over
            // ONE helper: api_v2.py's my-perms view and ProjectSerializerV2 both
            // call get_user_role() and map it through ProjectMembership.Role, so
            // my_perms cannot produce a value the project fetch could not. What
            // "no wholesale replace" was really pinning is the rest of this test:
            // id, name and the resource maps stay out of projects.data.
            expect(next.data.my_role).toBe('viewer');
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

        // TASK-2497 — the single spec that used to live here ('IGNORES a payload
        // carrying no visibility key') asserted `.toBe(before)` for a payload of
        // `{ my_role: 'owner' }` against a store seeded with `my_role: 'owner'`.
        // Once my_role is folded that spec still PASSES, but for a new reason —
        // guard (d) returns the identical object because neither key moved — so
        // it silently stops proving the visibility guard. Split in two: (i) keeps
        // the identity assertion honest by moving NOTHING, (ii) is the one that
        // actually pins per-key independence.
        it('IGNORES a payload carrying no visibility key (and no role change)', () => {
            const before = loaded();
            expect(projectsReducer(before, permsAction(15834, { my_role: 'owner' }))).toBe(before);
        });

        it('folds a CHANGED my_role with no visibility key, leaving visibility untouched', () => {
            const before = loaded();
            const next = projectsReducer(before, permsAction(15834, { my_role: 'editor' }));
            expect(next).toNotBe(before);
            expect(next.data.my_role).toBe('editor');
            expect(next.data.visibility).toBe('public');
        });

        it('folds a CHANGED visibility with no my_role key, leaving my_role untouched', () => {
            const before = loaded();
            const next = projectsReducer(before, permsAction(15834, { visibility: 'private' }));
            expect(next.data.visibility).toBe('private');
            expect(next.data.my_role).toBe('owner');
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

    /**
     * TASK-2497 (epic 2425 W3d) — a role change reaches the selectors without a
     * reload, in BOTH directions.
     *
     * DEMOTION IS THE FAIL-DANGEROUS ONE. Before this fold, an owner demoting a
     * manager left that manager's open tab showing the padlock and the Sharing
     * radios: the user clicks Private, the backend 403s, and they were shown
     * authority they no longer had. These specs drive the REAL selectors
     * (canManageAnugaMap, and canSeeVisibilityIndicator through it) rather than
     * re-reading state.data.my_role, because the selectors are what the panels
     * render off.
     *
     * WHAT THIS DOES **NOT** COVER — removal from a PRIVATE project. Since epic
     * commit 07c8f4e, api_v2.py:492-493 raises NotFound for an authenticated
     * non-member on a non-public project, so that case never arrives as a
     * my_perms payload at all; it arrives as a 404, which permsEpics.js classes
     * non-retryable -> buildFailureBranch -> setPermsLoadFailed(true), and the
     * V2P-02 helpers then fall back to the STALE project my_role. That hole is
     * open and is not this task's to close.
     */
    describe('TASK-2497 — my_role folded from my_perms reaches the role selectors', () => {

        const withRole = (role) => projectsReducer(undefined, {
            type: SET_ANUGA_PROJECT_DATA,
            data: { id: 15834, name: 'Merewether', visibility: 'private', my_role: role }
        });
        const stateOf = (projects) => ({ anuga: { projects } });

        it('DEMOTION manager -> editor withdraws the padlock and the Sharing radios', () => {
            const before = withRole('manager');
            expect(canManageAnugaMap(stateOf(before))).toBe(true);
            expect(canSeeVisibilityIndicator(stateOf(before))).toBe(true);

            const projects = projectsReducer(before, permsAction(15834, { my_role: 'editor' }));
            expect(getProjectMyRole(stateOf(projects))).toBe('editor');
            expect(canManageAnugaMap(stateOf(projects))).toBe(false);
            expect(canSeeVisibilityIndicator(stateOf(projects))).toBe(false);
        });

        it('REMOVAL from a PUBLIC project arrives as my_role: null and withdraws them too', () => {
            // A 200 with my_role null — the public-project removal case, which is
            // the only removal shape that reaches the reducer (see the 404 note
            // above for the private one).
            const projects = projectsReducer(withRole('manager'), permsAction(15834, { my_role: null }));
            expect(getProjectMyRole(stateOf(projects))).toBe(null);
            expect(canManageAnugaMap(stateOf(projects))).toBe(false);
            expect(canSeeVisibilityIndicator(stateOf(projects))).toBe(false);
        });

        it('PROMOTION editor -> manager grants them, with no reload', () => {
            const before = withRole('editor');
            expect(canManageAnugaMap(stateOf(before))).toBe(false);

            const projects = projectsReducer(before, permsAction(15834, { my_role: 'manager' }));
            expect(getProjectMyRole(stateOf(projects))).toBe('manager');
            expect(canManageAnugaMap(stateOf(projects))).toBe(true);
            expect(canSeeVisibilityIndicator(stateOf(projects))).toBe(true);
        });

        it('a my_perms payload for a DIFFERENT project cannot demote the loaded one', () => {
            const before = withRole('manager');
            const projects = projectsReducer(before, permsAction(999, { my_role: 'viewer' }));
            expect(projects).toBe(before);
            expect(canManageAnugaMap(stateOf(projects))).toBe(true);
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

        it('does NOT copy my_role into state.anuga.resources either (TASK-2497)', () => {
            // my_role stays in _NON_RESOURCE_KEYS *because* projectsReducer now
            // owns it. Deleting it from that Set to "stop dropping it" would push
            // it into the merge loop below and land the rival copy the whole
            // block exists to prevent.
            const next = resourcesReducer(undefined, permsAction(15834, {
                my_role: 'manager',
                boundaries: { '5': ['view'] }
            }));
            expect(next.my_role).toBe(undefined);
        });

        /**
         * TASK-2497 AC8/AC9 (folded from the archived TASK-2500) — the generic
         * merge loop's behaviour for a top-level key that is NOT a resource_type
         * map and is NOT listed in _NON_RESOURCE_KEYS. This is folklore made into
         * a pin: it is exactly the trap 'paywall' hit (TASK-2099), and the next
         * top-level key the backend adds will hit it again unless somebody
         * notices. Silent corruption becomes a console.warn.
         */
        describe('an UNLISTED top-level key — the trap that caught `paywall`', () => {
            let warnings;
            let realWarn;
            beforeEach(() => {
                warnings = [];
                realWarn = console.warn;
                console.warn = (...args) => { warnings.push(args.join(' ')); };
            });
            afterEach(() => { console.warn = realWarn; });

            it('drops an unlisted BOOLEAN silently — the typeof guard eats it', () => {
                const next = resourcesReducer(undefined, permsAction(15834, {
                    is_member: true,
                    boundaries: { '5': ['view'] }
                }));
                expect(next.is_member).toBe(undefined);
                // A non-object never reaches the merge loop, so there is nothing
                // to warn about: no half-written array is produced.
                expect(warnings.length).toBe(0);
            });

            it('turns an unlisted OBJECT into [] — and now says so out loud', () => {
                const next = resourcesReducer(undefined, permsAction(15834, {
                    organisation: { name: 'Hydrata', id_str: 'x' },
                    boundaries: { '5': ['view'] }
                }));
                // The corruption itself is unchanged (parseInt fails on every
                // key, so the payload is dropped and the key lands as []) —
                // byte-for-byte what `paywall` did before TASK-2099 listed it.
                expect(Array.isArray(next.organisation)).toBe(true);
                expect(next.organisation.length).toBe(0);
                // ...but it is no longer silent.
                expect(warnings.length).toBe(1);
                expect(warnings[0].indexOf('organisation') > -1).toBe(true);
                expect(warnings[0].indexOf('_NON_RESOURCE_KEYS') > -1).toBe(true);
                // The real resource map beside it is unaffected.
                expect(next.boundaries.length).toBe(1);
            });

            it('is SILENT for the payload the backend actually sends today', () => {
                // api_v2.py:507-517 — my_role, visibility, paywall, and the 20
                // resource_type maps. `compute-instances` is ALWAYS {} (sync.py's
                // get_user_resource_perms_batch hard-codes it), so an empty map
                // MUST NOT trip the warn or every single poll tick would log.
                const next = resourcesReducer(undefined, permsAction(15834, {
                    my_role: 'owner',
                    visibility: 'private',
                    paywall: { state: 'paid_private', checkout_url: null, read_only: false },
                    boundaries: { '5': ['view'] },
                    scenarios: {},
                    'compute-instances': {},
                    members: { '7': ['view'] },   // _SKIP_RESOURCE_KEYS
                    runs: { '9': ['view'] }       // _SKIP_RESOURCE_KEYS
                }));
                expect(warnings.length).toBe(0);
                expect(next.boundaries.length).toBe(1);
                expect(next.scenarios.length).toBe(0);
            });
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

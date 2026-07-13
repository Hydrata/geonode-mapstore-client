// TASK-2232 — ANUGA model-builder bootstrap recovery epics.
//
// INIT_ANUGA has exactly ONE trigger (anugaContainer.componentDidUpdate), which
// leaves two blind spots that strand the builder menus:
//   Mode A — hidden-tab drop: the TASK-603 visibility gate drops INIT_ANUGA
//     while the tab is backgrounded, and tab-focus fires no re-render to retry.
//   Mode B — wedged guard: a switchMap teardown of the in-flight from-map
//     waterfall leaves initInFlight === mapId forever, deadlocking both the
//     epic gate and componentDidUpdate's own guard.
//
// Proof points:
//   (A1) hidden→visible transition + recorded INIT_ANUGA + no data + clear
//        guard → exactly one initAnuga() re-dispatch.
//   (A2) initial/steady visibility value never fires (no double-init on a
//        normal foreground load).
//   (A3) a map that never emitted INIT_ANUGA never fires (no spurious
//        from-map get-or-create on a non-ANUGA map).
//   (A4) data already loaded / init already in flight → no dispatch.
//   (B1) SET_ANUGA_INIT_IN_FLIGHT(mapId) arms a watchdog; still wedged after
//        ANUGA_INIT_WATCHDOG_MS → setAnugaInitInFlight(false) + initAnuga().
//   (B2) data landed (or guard cleared) before the timeout → no-op.
//   (B3) a newer guard-set restarts the timer (switchMap) → one recovery
//        pair, never two.
//   (B4) guard-clear actions (mapId=false) arm nothing; navigating to a
//        different map suppresses the re-trigger.

import expect from 'expect';
import Rx from 'rxjs';
import {
    anugaVisibilityBootstrapEpic,
    anugaInitWatchdogEpic,
    ANUGA_INIT_WATCHDOG_MS,
    __setVisibilityForTests,
    __resetInitRequestedForTests
} from '../pollingEpics';
import {
    INIT_ANUGA,
    SET_ANUGA_INIT_IN_FLIGHT,
    setAnugaInitInFlight
} from '../../actionsAnuga';

// Live Subject-based action$ (same idiom as Anuga/__tests__/pollingEpics-test.js).
const liveActions = () => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    return { subject, action$ };
};

// Mutable store: tests flip projects/gnresource state between emissions to
// model data landing, guard clears, and SPA map navigation.
const makeStore = ({ mapId = '1418', projects = { data: null, initInFlight: false } } = {}) => {
    const state = {
        gnresource: { id: mapId },
        anuga: { projects }
    };
    return { getState: () => state, state };
};

describe('TASK-2232 anugaVisibilityBootstrapEpic — hidden-tab Bootstrap recovery (Mode A)', () => {
    let vis$;
    beforeEach(() => {
        __resetInitRequestedForTests();
        vis$ = new Rx.Subject();
        __setVisibilityForTests(vis$);
    });
    afterEach(() => __setVisibilityForTests(null));

    it('(A1) re-dispatches initAnuga() ONCE on hidden→visible for a recorded map with no data', () => {
        const { subject, action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        // Container requested init for 1418 (the 603 gate drops it while hidden).
        subject.next({ type: INIT_ANUGA });
        vis$.next(false); // backgrounded load
        vis$.next(true);  // user focuses the tab
        expect(emitted.length).toBe(1);
        expect(emitted[0].type).toBe(INIT_ANUGA);
        sub.unsubscribe();
    });

    it('(A2) does NOT fire on the initial/steady visibility value (normal foreground load)', () => {
        const { subject, action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        subject.next({ type: INIT_ANUGA });
        vis$.next(true); // initial value: already visible — no transition
        vis$.next(true); // steady repeat — still no transition
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(A3) does NOT fire for a map that never emitted INIT_ANUGA (no spurious from-map create)', () => {
        const { action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        vis$.next(false);
        vis$.next(true);
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(A4) does NOT fire when project data is already loaded', () => {
        const { subject, action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        subject.next({ type: INIT_ANUGA });
        store.state.anuga.projects = { data: { id: 15834 }, initInFlight: false };
        vis$.next(false);
        vis$.next(true);
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(A4) does NOT fire while an init for this map is already in flight', () => {
        const { subject, action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        subject.next({ type: INIT_ANUGA });
        store.state.anuga.projects = { data: null, initInFlight: '1418' };
        vis$.next(false);
        vis$.next(true);
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(A3) recovery is scoped to the recorded map — a later map id is not covered by it', () => {
        const { subject, action$ } = liveActions();
        const store = makeStore();
        const emitted = [];
        const sub = anugaVisibilityBootstrapEpic(action$, store).subscribe(a => emitted.push(a));
        subject.next({ type: INIT_ANUGA }); // recorded for 1418
        store.state.gnresource = { id: '9999' }; // SPA-navigate to a map with no container evidence
        vis$.next(false);
        vis$.next(true);
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });
});

describe('TASK-2232 anugaInitWatchdogEpic — wedged-guard Watchdog recovery (Mode B)', () => {
    const virtualScheduler = () => new Rx.VirtualTimeScheduler(undefined, Number.POSITIVE_INFINITY);

    it('exports ANUGA_INIT_WATCHDOG_MS (~7s)', () => {
        expect(ANUGA_INIT_WATCHDOG_MS).toBe(7000);
    });

    it('(B1) unwedges the guard then re-triggers initAnuga when still wedged after the timeout', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: '1418' } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight('1418'));
        scheduler.flush(); // advance virtual time past ANUGA_INIT_WATCHDOG_MS
        expect(emitted.map(a => a.type)).toEqual([SET_ANUGA_INIT_IN_FLIGHT, INIT_ANUGA]);
        expect(emitted[0].mapId).toBe(false);
        sub.unsubscribe();
    });

    it('(B2) no-ops when project data landed before the timeout', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: '1418' } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight('1418'));
        // Success path: setAnugaProjectData landed and the reducer cleared the guard.
        store.state.anuga.projects = { data: { id: 15834 }, initInFlight: false };
        scheduler.flush();
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(B2) no-ops when the guard was cleared (error path) before the timeout', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: '1418' } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight('1418'));
        store.state.anuga.projects = { data: null, initInFlight: false };
        scheduler.flush();
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(B3) a newer guard-set restarts the timer — one recovery pair, never two', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: '1418' } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight('1418'));
        subject.next(setAnugaInitInFlight('1418')); // switchMap cancels the first timer
        scheduler.flush();
        expect(emitted.map(a => a.type)).toEqual([SET_ANUGA_INIT_IN_FLIGHT, INIT_ANUGA]);
        sub.unsubscribe();
    });

    it('(B4) guard-clear actions (mapId=false) never arm the watchdog', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: false } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight(false));
        scheduler.flush();
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });

    it('(B4) does NOT re-trigger when the user has navigated to a different map', () => {
        const scheduler = virtualScheduler();
        const { subject, action$ } = liveActions();
        const store = makeStore({ projects: { data: null, initInFlight: '1418' } });
        const emitted = [];
        const sub = anugaInitWatchdogEpic(action$, store, scheduler).subscribe(a => emitted.push(a));
        subject.next(setAnugaInitInFlight('1418'));
        store.state.gnresource = { id: '9999' }; // SPA nav away mid-init
        scheduler.flush();
        expect(emitted.length).toBe(0);
        sub.unsubscribe();
    });
});

/**
 * The ANONYMOUS acceptance flag, and what a hostile localStorage may not do to
 * it (epic 2765 W4 coverage sweep, TASK-2781).
 *
 * ⚠ WHY THIS FILE EXISTS. `introductionStorage.js` shipped in W3 with three
 * try/catch blocks and a docstring promising the module "fails toward SHOWING
 * the modal on every storage fault (private browsing, quota, storage
 * disabled)". Nothing tested that promise: every existing assertion runs
 * against the karma browser's REAL, working localStorage, so all three catch
 * blocks were dead code as far as the suite was concerned and could have been
 * deleted by a refactor without turning anything red.
 *
 * The failure that costs is not the storage write. It is what a thrown
 * SecurityError does to the two call sites:
 *
 *   epicsIntroduction.js:148  the read happens inside the fetch chain, and that
 *                             chain ends `.catch(() => Rx.Observable.empty())`.
 *                             A throw there is swallowed as if the map had no
 *                             ANUGA project: no INTRODUCTION_LOADED, no modal,
 *                             EVER — a liability disclaimer silently suppressed
 *                             for a viewer who has never seen it, which is the
 *                             one outcome the module says it exists to prevent.
 *   epicsIntroduction.js:217  the write is a bare synchronous call inside the
 *                             accept switchMap. A throw kills the epic stream,
 *                             so the viewer's click neither records nor emits
 *                             INTRODUCTION_ACCEPTED.
 *
 * Both are invisible in normal browsing and certain in Safari private mode,
 * where `localStorage` exists and every write throws QuotaExceededError. So the
 * last two describes drive the real epics with a hostile storage installed,
 * rather than only asserting that the module's own functions return.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../MapStore2/web/client/libs/ajax';

import {
    anonymousAcceptedVersion,
    rememberAnonymousAcceptance,
    __forgetAnonymousAcceptance
} from '../introductionStorage';
import { introductionFetchEpic, introductionAcceptEpic, __resetIntroductionFetchDedupe } from '../epicsIntroduction';
import { ACCEPT_INTRODUCTION, INTRODUCTION_LOADED, INTRODUCTION_ACCEPTED } from '../actionsSimpleView';
import { INIT_ANUGA } from '../../Anuga/actionsAnuga';

const PROJECT_ID = 13422;
const OTHER_PROJECT_ID = 999;
const MAP_ID = 118;
const VERSION_A = 'a'.repeat(64);
const VERSION_B = 'b'.repeat(64);
const keyFor = (id) => `hydrata.introduction.acceptedVersion.v1.${id}`;

/**
 * Install a fake `window.localStorage` and hand back an undo.
 *
 * `localStorage` is an accessor, and whether it is an OWN property of `window`
 * or inherited from `Window.prototype` differs between engines — so capture
 * whichever it is and restore exactly that, deleting the shadow when there was
 * no own descriptor to put back. A botched restore would not fail here; it
 * would poison every later file in the karma bundle, which is why `afterEach`
 * re-proves that the real storage round-trips again.
 */
const swapStorage = (fake) => {
    const own = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
        configurable: true, enumerable: true, writable: true, value: fake
    });
    return () => {
        if (own) {
            Object.defineProperty(window, 'localStorage', own);
        } else {
            delete window.localStorage;
        }
    };
};

/** A storage whose named operations throw, as Safari private mode's does. */
const hostileStorage = (...throwingOps) => {
    const base = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    throwingOps.forEach((op) => {
        base[op] = () => {
            throw new Error('SecurityError: the operation is insecure');
        };
    });
    return base;
};

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

const storeOf = (state) => ({ getState: () => state });

const payload = (over = {}) => ({
    project_id: PROJECT_ID,
    project_name: 'Msimbazi baseline',
    content_version: VERSION_A,
    accepted_current_version: false,
    can_edit: false,
    baseline: { message_id: 'hydrata.introduction.baseline', version: '2' },
    description_html: '', body_html: '', owner_limitations_html: '', source: null,
    stats: {},
    ...over
});

describe('introductionStorage — the anonymous acceptance flag (TASK-2774)', () => {
    afterEach(() => {
        __forgetAnonymousAcceptance(PROJECT_ID);
        __forgetAnonymousAcceptance(OTHER_PROJECT_ID);
    });

    it('reads back the version it wrote, under a per-project key', () => {
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_A);
        expect(anonymousAcceptedVersion(PROJECT_ID)).toBe(VERSION_A);
        // The key shape is not cosmetic: the gate compares the stored value
        // with the CURRENT content_version, so the flag has to be per project.
        expect(window.localStorage.getItem(keyFor(PROJECT_ID))).toBe(VERSION_A);
    });

    it('reads null for a project that was never accepted', () => {
        expect(anonymousAcceptedVersion(PROJECT_ID)).toBe(null);
    });

    it('does not let one project\'s acceptance answer for another', () => {
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_A);
        expect(anonymousAcceptedVersion(OTHER_PROJECT_ID)).toBe(null);
    });

    it('overwrites on re-acceptance rather than accumulating versions', () => {
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_A);
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_B);
        expect(anonymousAcceptedVersion(PROJECT_ID)).toBe(VERSION_B);
    });

    it('writes nothing when the project or the version is missing', () => {
        // A half-loaded payload must not stamp a truthy flag that then
        // suppresses the modal for content nobody read.
        rememberAnonymousAcceptance(null, VERSION_A);
        rememberAnonymousAcceptance(PROJECT_ID, null);
        rememberAnonymousAcceptance(PROJECT_ID, undefined);
        expect(window.localStorage.getItem(keyFor(PROJECT_ID))).toBe(null);
        expect(anonymousAcceptedVersion(null)).toBe(null);
        expect(anonymousAcceptedVersion(undefined)).toBe(null);
    });
});

describe('introductionStorage — a hostile localStorage fails OPEN (2765 W4)', () => {
    let undo = null;
    afterEach(() => {
        if (undo) {
            undo();
            undo = null;
        }
        // Prove the real storage is back, or every later file in the bundle
        // inherits the fake.
        window.localStorage.setItem(keyFor('restore-probe'), 'ok');
        expect(window.localStorage.getItem(keyFor('restore-probe'))).toBe('ok');
        window.localStorage.removeItem(keyFor('restore-probe'));
    });

    it('reads as NOT accepted when getItem throws — never lets the throw escape', () => {
        undo = swapStorage(hostileStorage('getItem'));
        expect(anonymousAcceptedVersion(PROJECT_ID)).toBe(null);
    });

    it('swallows a throwing setItem — the acceptance just does not persist', () => {
        undo = swapStorage(hostileStorage('setItem'));
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_A);
    });

    it('swallows a throwing removeItem', () => {
        undo = swapStorage(hostileStorage('removeItem'));
        __forgetAnonymousAcceptance(PROJECT_ID);
    });

    it('survives storage being absent entirely', () => {
        undo = swapStorage(undefined);
        expect(anonymousAcceptedVersion(PROJECT_ID)).toBe(null);
        rememberAnonymousAcceptance(PROJECT_ID, VERSION_A);
        __forgetAnonymousAcceptance(PROJECT_ID);
    });
});

describe('introductionStorage — a storage fault must not eat the modal (2765 W4)', () => {
    let mockAxios;
    let undo = null;
    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __resetIntroductionFetchDedupe();
    });
    afterEach(() => {
        mockAxios.restore();
        if (undo) {
            undo();
            undo = null;
        }
        window.localStorage.removeItem(keyFor(PROJECT_ID));
    });

    const mapOpenState = () => storeOf({
        localConfig: { plugins: { map_viewer: [
            { name: 'Anuga', cfg: { paywallEnabled: true } },
            { name: 'Paywall', cfg: { paywallEnabled: true } },
            { name: 'SimpleView' }
        ] } },
        gnresource: { id: MAP_ID },
        security: {},
        anuga: {},
        simpleView: {}
    });

    it('still emits INTRODUCTION_LOADED for an anonymous viewer whose storage throws', (done) => {
        // The read at epicsIntroduction.js:148 sits inside a chain that ends
        // `.catch(() => Rx.Observable.empty())`. Without the catch inside the
        // storage module a SecurityError here is indistinguishable from "no
        // ANUGA project owns this map": the payload is dropped and the
        // disclaimer never appears for anyone browsing privately.
        undo = swapStorage(hostileStorage('getItem'));
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: INIT_ANUGA }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_LOADED);
                // Unreadable storage means "no acceptance on record", so the
                // gate shows the modal — the fail-OPEN direction.
                expect(emitted[0].acceptedVersion).toBe(null);
                done();
            });
    });

    it('still emits INTRODUCTION_ACCEPTED when the anonymous write throws', (done) => {
        // The write at epicsIntroduction.js:217 is a bare synchronous call
        // inside the accept switchMap; an escaping throw would kill the stream,
        // so the click would neither persist nor close the loop.
        undo = swapStorage(hostileStorage('setItem'));
        const emitted = [];

        introductionAcceptEpic(
            mockActions([{ type: ACCEPT_INTRODUCTION }]),
            storeOf({
                security: {},
                simpleView: { introduction: { projectId: PROJECT_ID, data: payload() } }
            })
        ).subscribe(a => emitted.push(a), done, () => {
            expect(emitted.length).toBe(1);
            expect(emitted[0].type).toBe(INTRODUCTION_ACCEPTED);
            expect(emitted[0].contentVersion).toBe(VERSION_A);
            // And still no request — decision 3 holds on the fault path too.
            expect(mockAxios.history.post.length).toBe(0);
            done();
        });
    });
});

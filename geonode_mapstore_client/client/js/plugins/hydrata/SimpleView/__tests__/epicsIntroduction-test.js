/**
 * Project-introduction epics (epic 2765 W3).
 *
 * THE ONE THAT MATTERS MOST is
 * `introductionAcceptEpic … issues NO request when logged out`. An anonymous
 * POST to /accept/ answers 401 WITH a `WWW-Authenticate: Basic` header, which a
 * browser may render as a NATIVE PASSWORD PROMPT — on precisely the anonymous
 * link-recipient path this whole epic exists to serve. Settled decision 3 makes
 * anonymous acceptance localStorage-only, so the fix is "never call it", and a
 * comment cannot enforce that. This test can.
 */
import expect from 'expect';
import Rx from 'rxjs';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../MapStore2/web/client/libs/ajax';

import {
    introductionFetchEpic,
    introductionAutoShowEpic,
    introductionAcceptEpic,
    introductionSaveEpic,
    __resetIntroductionFetchDedupe
} from '../epicsIntroduction';
import {
    ACCEPT_INTRODUCTION,
    INTRODUCTION_LOADED,
    INTRODUCTION_ACCEPTED,
    SAVE_INTRODUCTION,
    INTRODUCTION_SAVED,
    INTRODUCTION_SAVE_FAILED,
    SET_VISIBLE_INTRODUCTION
} from '../actionsSimpleView';
import { MAP_CONFIG_LOADED } from '../../../../../MapStore2/web/client/actions/config';
import { INIT_ANUGA, SET_ANUGA_PROJECT_DATA } from '../../Anuga/actionsAnuga';
import { __forgetAnonymousAcceptance } from '../introductionStorage';

const PROJECT_ID = 13422;
const MAP_ID = 118;
const VERSION_A = 'a'.repeat(64);
const VERSION_B = 'b'.repeat(64);

const payload = (over = {}) => ({
    project_id: PROJECT_ID,
    project_name: 'Msimbazi baseline',
    content_version: VERSION_A,
    accepted_current_version: false,
    can_edit: false,
    baseline: { message_id: 'hydrata.introduction.baseline', version: '1' },
    description_html: '', body_html: '', owner_limitations_html: '', source: null,
    stats: {},
    ...over
});

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

const anugaSite = [
    { name: 'Anuga', cfg: { paywallEnabled: true } },
    { name: 'Paywall', cfg: { paywallEnabled: true } },
    { name: 'SimpleView' }
];

const storeOf = (state) => ({ getState: () => state });

describe('introductionFetchEpic (epic 2765 W3)', () => {
    let mockAxios;
    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __resetIntroductionFetchDedupe();
    });
    afterEach(() => mockAxios.restore());

    const mapOpenState = (plugins = anugaSite) => storeOf({
        localConfig: { plugins: { map_viewer: plugins } },
        gnresource: { id: MAP_ID },
        security: {},
        anuga: {},
        simpleView: {}
    });

    it('fires on INIT_ANUGA — the trigger that actually arrives in the live app', (done) => {
        // ⚠ THE LOAD-BEARING TRIGGER. SimpleView is a lazy module plugin, so its
        // epics are injected into redux-observable only once the chunk loads,
        // and redux-observable's action$ does not replay. Instrumented on a cold
        // anonymous load of /catalogue/#/map/118, MAP_CONFIG_LOADED had fired
        // ~930ms BEFORE this module was even evaluated and was never seen;
        // INIT_ANUGA (dispatched by anugaContainer.componentDidUpdate, and
        // re-dispatched until a project resolves) arrived twice, after.
        //
        // Every other assertion in this describe passes against a synthetic
        // MAP_CONFIG_LOADED, which is exactly why the feature was dead live
        // while the suite was green. This test is the one that pins the fix.
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: INIT_ANUGA }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_LOADED);
                expect(emitted[0].projectId).toBe(PROJECT_ID);
                done();
            });
    });

    it('survives the INIT_ANUGA burst with exactly one fetch', (done) => {
        // anugaContainer re-dispatches INIT_ANUGA on every re-render while no
        // project has resolved — for an anonymous viewer that is forever, since
        // initAnugaEpic drops them. The per-map dedupe absorbs the burst; a
        // switchMap here would instead have each dispatch CANCEL the previous
        // in-flight fetch, so the payload would never arrive at all.
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(
            mockActions([{ type: INIT_ANUGA }, { type: INIT_ANUGA }, { type: INIT_ANUGA }]),
            mapOpenState()
        ).subscribe(a => emitted.push(a), done, () => {
            expect(emitted.length).toBe(1);
            expect(mockAxios.history.post.length).toBe(1);
            expect(mockAxios.history.get.length).toBe(1);
            done();
        });
    });

    it('resolves the project from the MAP and emits INTRODUCTION_LOADED', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: MAP_CONFIG_LOADED }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_LOADED);
                expect(emitted[0].projectId).toBe(PROJECT_ID);
                expect(emitted[0].data.content_version).toBe(VERSION_A);
                done();
            });
    });

    it('fires for an ANONYMOUS viewer — the audience this epic exists for', (done) => {
        // The store below has an EMPTY security slice and an empty `anuga`
        // slice, i.e. the anonymous reality: initAnugaEpic is login-gated, so it
        // never populates state.anuga for this viewer. Nothing in the fetch path
        // may depend on that slice — the project id comes from the map.
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: MAP_CONFIG_LOADED }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                done();
            });
    });

    it('makes NO request at all off-ANUGA (SWAMM / Sarara / NICP) — TASK-2777', (done) => {
        const swammSite = [{ name: 'SimpleView' }, { name: 'Swamm' }, { name: 'TaskMonitor' }];
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: INIT_ANUGA }, { type: MAP_CONFIG_LOADED }]), mapOpenState(swammSite))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                // The site gate must stop it BEFORE the wire, not just before
                // the modal — three sites would otherwise pay a round-trip per
                // map open for a feature they can never show.
                expect(mockAxios.history.post.length).toBe(0);
                expect(mockAxios.history.get.length).toBe(0);
                done();
            });
    });

    it('emits nothing when no ANUGA project owns this map (the MAP gate)', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(404, { projectId: null });
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: MAP_CONFIG_LOADED }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('stays silent when the introduction endpoint 404s', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(404);
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: MAP_CONFIG_LOADED }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('seeds the anonymous localStorage acceptance for a LOGGED-OUT viewer', (done) => {
        window.localStorage.setItem(
            `hydrata.introduction.acceptedVersion.v1.${PROJECT_ID}`, VERSION_A
        );
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(mockActions([{ type: INIT_ANUGA }]), mapOpenState())
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted[0].acceptedVersion).toBe(VERSION_A);
                __forgetAnonymousAcceptance(PROJECT_ID);
                done();
            });
    });

    it('IGNORES localStorage for a SIGNED-IN viewer — decision 3 (an anonymous flag is not evidence)', (done) => {
        // `hasAcceptedCurrentIntroduction` is an OR, so a seeded local flag
        // satisfies it even when the server reports
        // `accepted_current_version: false`. Reading it for a named user would
        // let a flag written while logged OUT suppress the modal for someone
        // with no acceptance row — the platform would stop asking while its own
        // record shows nobody agreed.
        window.localStorage.setItem(
            `hydrata.introduction.acceptedVersion.v1.${PROJECT_ID}`, VERSION_A
        );
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        const signedIn = storeOf({
            localConfig: { plugins: { map_viewer: anugaSite } },
            gnresource: { id: MAP_ID },
            security: { user: { pk: 5 } },
            anuga: {},
            simpleView: {}
        });

        introductionFetchEpic(mockActions([{ type: INIT_ANUGA }]), signedIn)
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].acceptedVersion).toBe(null);
                __forgetAnonymousAcceptance(PROJECT_ID);
                done();
            });
    });

    it('fetches once per map — a MAP_CONFIG_LOADED re-fire must not re-open a closed modal', (done) => {
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply(200, { projectId: PROJECT_ID });
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`).reply(200, payload());
        const emitted = [];

        introductionFetchEpic(
            mockActions([{ type: MAP_CONFIG_LOADED }, { type: MAP_CONFIG_LOADED }]),
            mapOpenState()
        ).subscribe(a => emitted.push(a), done, () => {
            expect(emitted.length).toBe(1);
            done();
        });
    });
});

describe('introductionAutoShowEpic — the guard, wired (TASK-2776)', () => {
    const baseState = (over = {}) => ({
        localConfig: { plugins: { map_viewer: anugaSite } },
        security: {},
        anuga: { projects: {}, paywall: {} },
        simpleView: {
            introduction: {
                projectId: PROJECT_ID,
                data: payload(),
                acceptedVersion: null
            }
        },
        ...over
    });

    it('opens the modal for an eligible anonymous viewer', (done) => {
        const emitted = [];
        introductionAutoShowEpic(
            mockActions([{ type: INTRODUCTION_LOADED }]),
            storeOf(baseState())
        ).subscribe(a => emitted.push(a), done, () => {
            expect(emitted.length).toBe(1);
            expect(emitted[0].type).toBe(SET_VISIBLE_INTRODUCTION);
            expect(emitted[0].visible).toBe(true);
            done();
        });
    });

    it('does NOT open it for the owner (AC10)', (done) => {
        const state = baseState();
        state.security = { user: { pk: 1 } };
        state.anuga.projects = { data: { id: PROJECT_ID, my_role: 'owner' } };
        const emitted = [];

        introductionAutoShowEpic(mockActions([{ type: INTRODUCTION_LOADED }]), storeOf(state))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('does NOT open it while the paywall dialog is up, and DOES once it clears', (done) => {
        // A mutable store: the paywall clears between the two evaluations,
        // exactly as DISMISS_PAYWALL_UPGRADE would do live. This is the
        // ordering assertion AC1 asks for — paywall first, introduction after.
        const state = baseState();
        state.anuga.paywall = { overlay: { state: 'upgrade_prompt' }, overlayProjectId: null };
        const emitted = [];
        const seenWhileBlocked = [];

        const subject = new Rx.Subject();
        const action$ = subject.asObservable();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

        introductionAutoShowEpic(action$, storeOf(state))
            .subscribe(a => emitted.push(a), done, () => {
                expect(seenWhileBlocked).toEqual([], 'the introduction opened behind the paywall');
                expect(emitted.length).toBe(1);
                expect(emitted[0].visible).toBe(true);
                done();
            });

        setTimeout(() => {
            subject.next({ type: INTRODUCTION_LOADED });
            // Nothing may have been emitted while the refusal modal is on screen.
            seenWhileBlocked.push(...emitted);
            state.anuga.paywall = { overlay: null, steady: null };
            subject.next({ type: 'PAYWALL:DISMISS_UPGRADE' });
            subject.complete();
        }, 0);
    });

    it('waits for a logged-in viewer role, then opens for a NON-member (AC9)', (done) => {
        const state = baseState();
        state.security = { user: { pk: 7 } };
        const emitted = [];
        const seenWhileUnresolved = [];

        const subject = new Rx.Subject();
        const action$ = subject.asObservable();
        action$.ofType = (...types) => action$.filter(a => types.includes(a.type));

        introductionAutoShowEpic(action$, storeOf(state))
            .subscribe(a => emitted.push(a), done, () => {
                expect(seenWhileUnresolved).toEqual([], 'decided before auth resolved');
                expect(emitted.length).toBe(1);
                done();
            });

        setTimeout(() => {
            subject.next({ type: INTRODUCTION_LOADED });
            seenWhileUnresolved.push(...emitted);
            state.anuga.projects = { data: { id: PROJECT_ID, my_role: null } };
            subject.next({ type: SET_ANUGA_PROJECT_DATA });
            subject.complete();
        }, 0);
    });

    it('does not re-open after the viewer has accepted the current version', (done) => {
        const state = baseState();
        state.simpleView.introduction.acceptedVersion = VERSION_A;
        const emitted = [];

        introductionAutoShowEpic(mockActions([{ type: INTRODUCTION_LOADED }]), storeOf(state))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('RE-PROMPTS when the content version has moved past what was accepted', (done) => {
        const state = baseState();
        state.simpleView.introduction.data = payload({ content_version: VERSION_B });
        state.simpleView.introduction.acceptedVersion = VERSION_A;
        const emitted = [];

        introductionAutoShowEpic(mockActions([{ type: INTRODUCTION_LOADED }]), storeOf(state))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                done();
            });
    });
});

describe('introductionAcceptEpic — settled decision 3', () => {
    let mockAxios;
    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __forgetAnonymousAcceptance(PROJECT_ID);
    });
    afterEach(() => {
        mockAxios.restore();
        __forgetAnonymousAcceptance(PROJECT_ID);
    });

    const acceptState = (user) => storeOf({
        security: user ? { user } : {},
        simpleView: { introduction: { projectId: PROJECT_ID, data: payload() } }
    });

    it('POSTs the acceptance row for an AUTHENTICATED viewer (AC4)', (done) => {
        mockAxios
            .onPost(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/accept/`)
            .reply(200, payload({ accepted_current_version: true }));
        const emitted = [];

        introductionAcceptEpic(mockActions([{ type: ACCEPT_INTRODUCTION }]), acceptState({ pk: 3 }))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(1);
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_ACCEPTED);
                expect(emitted[0].contentVersion).toBe(VERSION_A);
                done();
            });
    });

    it('issues NO request when logged out — the WWW-Authenticate trap (AC4)', (done) => {
        // An anonymous POST to /accept/ answers 401 with `WWW-Authenticate:
        // Basic`, which a browser may render as a native password prompt. This
        // assertion, not the comment above the call site, is what keeps that
        // dialog off an anonymous link-recipient's screen.
        const emitted = [];

        introductionAcceptEpic(mockActions([{ type: ACCEPT_INTRODUCTION }]), acceptState(null))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.post.length).toBe(0);
                expect(mockAxios.history.get.length).toBe(0);
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_ACCEPTED);
                expect(emitted[0].contentVersion).toBe(VERSION_A);
                done();
            });
    });

    it('records the anonymous acceptance in localStorage only', (done) => {
        introductionAcceptEpic(mockActions([{ type: ACCEPT_INTRODUCTION }]), acceptState(null))
            .subscribe(() => {}, done, () => {
                expect(window.localStorage.getItem(
                    `hydrata.introduction.acceptedVersion.v1.${PROJECT_ID}`
                )).toBe(VERSION_A);
                done();
            });
    });

    it('does NOT record an acceptance when the POST fails', (done) => {
        // Better to ask again next session than to claim a liability
        // acknowledgement was stored when the server never got it.
        mockAxios
            .onPost(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/accept/`)
            .reply(500);
        const emitted = [];

        introductionAcceptEpic(mockActions([{ type: ACCEPT_INTRODUCTION }]), acceptState({ pk: 3 }))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(0);
                done();
            });
    });

    it('emits nothing when there is no payload to accept', (done) => {
        const emitted = [];
        introductionAcceptEpic(
            mockActions([{ type: ACCEPT_INTRODUCTION }]),
            storeOf({ security: {}, simpleView: {} })
        ).subscribe(a => emitted.push(a), done, () => {
            expect(emitted.length).toBe(0);
            done();
        });
    });
});

describe('introductionSaveEpic (epic 2765 W4, TASK-2778)', () => {
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => mockAxios.restore());

    const source = {
        description: 'A rain-on-grid model of the lower Msimbazi.',
        body: 'Built from 2 m LiDAR.',
        owner_limitations: 'Culverts are not represented.'
    };
    const save = () => ({ type: SAVE_INTRODUCTION, projectId: PROJECT_ID, source });

    it('PATCHes the owner-authored fields and emits INTRODUCTION_SAVED', (done) => {
        mockAxios
            .onPatch(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`)
            .reply(200, payload({ content_version: VERSION_B, can_edit: true, source }));
        const emitted = [];

        introductionSaveEpic(mockActions([save()]), storeOf({}))
            .subscribe(a => emitted.push(a), done, () => {
                expect(mockAxios.history.patch.length).toBe(1);
                expect(JSON.parse(mockAxios.history.patch[0].data)).toEqual(source);
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_SAVED);
                expect(emitted[0].projectId).toBe(PROJECT_ID);
                // The PATCH response IS the full read payload, with a
                // recomputed version — so a save needs no follow-up GET.
                expect(emitted[0].data.content_version).toBe(VERSION_B);
                done();
            });
    });

    it('NEVER emits INTRODUCTION_LOADED — the two live wires that would break', (done) => {
        // ⚠ THE ONE THAT MATTERS HERE. The PATCH response is byte-for-byte the
        // GET payload, so `introductionLoaded(...)` is the obvious one-liner.
        // It would (1) re-run introductionAutoShowEpic, which is
        // ofType(INTRODUCTION_LOADED), underneath the modal the owner is
        // editing in, and (2) hit the INTRODUCTION_LOADED reducer case, which
        // rewrites `acceptedVersion` from the action — erasing this browser's
        // anonymous acceptance stamp every time an owner fixes a typo.
        mockAxios
            .onPatch(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`)
            .reply(200, payload({ content_version: VERSION_B }));
        const emitted = [];

        introductionSaveEpic(mockActions([save()]), storeOf({}))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.filter(a => a.type === INTRODUCTION_LOADED).length).toBe(0);
                done();
            });
    });

    it('emits a FAILURE rather than going silent when the PATCH is refused', (done) => {
        // Unlike the accept path, silence is not affordable here: the owner has
        // just typed several paragraphs, and a Save that quietly does nothing
        // is how that text gets lost. 403 is the shape a demoted manager sees.
        mockAxios
            .onPatch(`/api/v2/anuga/projects/${PROJECT_ID}/introduction/`)
            .reply(403);
        const emitted = [];

        introductionSaveEpic(mockActions([save()]), storeOf({}))
            .subscribe(a => emitted.push(a), done, () => {
                expect(emitted.length).toBe(1);
                expect(emitted[0].type).toBe(INTRODUCTION_SAVE_FAILED);
                expect(emitted[0].projectId).toBe(PROJECT_ID);
                done();
            });
    });

    it('issues no request without a project or a payload', (done) => {
        const emitted = [];
        introductionSaveEpic(
            mockActions([
                { type: SAVE_INTRODUCTION, projectId: null, source },
                { type: SAVE_INTRODUCTION, projectId: PROJECT_ID, source: null }
            ]),
            storeOf({})
        ).subscribe(a => emitted.push(a), done, () => {
            expect(mockAxios.history.patch.length).toBe(0);
            expect(emitted.length).toBe(0);
            done();
        });
    });
});

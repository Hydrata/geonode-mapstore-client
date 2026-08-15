/*
 * TASK-2804 (epic 2765) — A -> B -> A, END TO END, AT THE RENDERED TOOLBAR.
 *
 * The defect this file pins was invisible to every test either subtask owned,
 * because it lives in the INTERACTION between three of them:
 *
 *   TASK-2790  clears `state.simpleView.introduction` on SET_RESOURCE_ID;
 *   the fetch dedupe refused a second ask for a map already seen this session;
 *   TASK-2796  gates BOTH the About button and the modal on payload presence.
 *
 * Individually correct; together, a viewer who opened map A, hopped to map B
 * and came back had no way to reach A's introduction short of a full page
 * reload. Measured on localhost 2026-08-15 (anonymous, same-document hops):
 *
 *   1. arrive 118   [Search, Measure, Legend, About this project]   modal "TASK-2630 W6 live-verify"
 *   2. hop to 104   [Search, Measure, Legend, About this project]   modal "test2"
 *   3. hop back     [Search, Measure, Legend]                       no About, no modal
 *
 * ⚠ SO THIS TEST DRIVES THE REAL THINGS, and that is the point of it existing
 * separately from the epic and reducer unit specs. A real redux store, the real
 * `simpleView` reducer, the real `gnresource` reducer, the real fetch and
 * auto-show epics wired through redux-observable, and the real connected
 * container. The only fake is the network. A hand-written "after" state would
 * have proved nothing here: every ingredient of the bug was already green in
 * isolation, and the falsehood was in the composition.
 *
 * WHAT MUST BE TRUE AFTER THE HOP BACK (the split TASK-2804 shipped):
 *   the PAYLOAD returns  — the About button is offered again and names project A;
 *   the INTERRUPTION does not — the modal, dismissed with the cross on the first
 *   visit, must not volunteer itself over the map a second time.
 */
import expect from 'expect';
import React from 'react';
import { act, fireEvent } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import createTestStore from '../../../../__tests__/helpers/createTestStore';
import mountWithProviders from '../../../../__tests__/helpers/mountWithProviders';
import ConnectedSimpleView from '../components/simpleViewContainer';
import svReducer from '../reducersSimpleView';
import gnresource from '@js/reducers/gnresource';
import { setResourceId } from '@js/actions/gnresource';
import { INIT_ANUGA } from '../../Anuga/actionsAnuga';
import {
    introductionFetchEpic,
    introductionAutoShowEpic,
    __resetIntroductionDedupe
} from '../epicsIntroduction';

// The live fixtures, mirrored: map 118 belongs to project 13422, map 104 to
// another project entirely. Ids are strings because that is what the SPA route
// path puts in `gnresource.id` (measured live: "1418").
const MAP_A = '118';
const MAP_B = '104';
const PROJECT_A = 13422;
const PROJECT_B = 555;

const introductionFor = (projectId, name) => ({
    project_id: projectId,
    project_name: name,
    content_version: `v-${projectId}`,
    accepted_current_version: false,
    can_edit: false,
    baseline: { message_id: 'hydrata.introduction.baseline', version: '1' },
    description_html: '',
    body_html: '',
    owner_limitations_html: '',
    source: null,
    stats: {}
});

// Constant slices: the container reads them, nothing under test writes them.
// Frozen module-level objects rather than fresh literals per action, so
// connect()'s shallow compare is not defeated by identity churn.
const ANUGA = { projects: {}, ui: {} };
const LAYERS = { groups: [] };
// Anuga IS in map_viewer — this is hydrata.com, the one site where the
// introduction exists at all (settled decision 1).
const LOCAL_CONFIG = { plugins: { map_viewer: [{ name: 'Anuga' }] } };
const SECURITY = {};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('TASK-2804 — the introduction survives A -> B -> A (rendered toolbar)', () => {
    let mockAxios;
    let mounted;

    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        __resetIntroductionDedupe();
        mockAxios.onPost('/api/v2/anuga/projects/from-map/').reply((config) => (
            String(JSON.parse(config.data).mapId) === MAP_B
                ? [200, { projectId: PROJECT_B }]
                : [200, { projectId: PROJECT_A }]
        ));
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_A}/introduction/`)
            .reply(200, introductionFor(PROJECT_A, 'Project A'));
        mockAxios.onGet(`/api/v2/anuga/projects/${PROJECT_B}/introduction/`)
            .reply(200, introductionFor(PROJECT_B, 'Project B'));
    });

    afterEach(() => {
        if (mounted) {
            mounted.unmount();
            mounted = null;
        }
        mockAxios.restore();
        __resetIntroductionDedupe();
    });

    const makeStore = () => createTestStore({
        reducers: {
            simpleView: svReducer,
            gnresource,
            security: () => SECURITY,
            anuga: () => ANUGA,
            layers: () => LAYERS,
            localConfig: () => LOCAL_CONFIG
        },
        middleware: [createEpicMiddleware(combineEpics(
            introductionFetchEpic,
            introductionAutoShowEpic
        ))]
    });

    // A same-document hop, as the SPA performs it: SET_RESOURCE_ID names the
    // map, then the map's own INIT_ANUGA lands (anugaContainer dispatches it on
    // every re-render until a project resolves — the trigger that actually
    // arrives for a lazily-loaded plugin).
    const hopTo = async(store, mapId) => {
        await act(async() => {
            store.dispatch(setResourceId(mapId));
            store.dispatch({ type: INIT_ANUGA });
            await flush();
            await flush();
            await flush();
        });
    };

    const aboutButton = (container) =>
        container.querySelector('.simple-view-right-toolbar button[title="About this project"]');
    const modalTitle = () =>
        document.querySelector('.sv-introduction-modal-host .modal-title');
    const closeCross = () =>
        document.querySelector('.sv-introduction-modal-host button.close');

    it('AC1 + AC2 — the About button comes back, the modal does not re-interrupt', async() => {
        const store = makeStore();
        mounted = mountWithProviders(<ConnectedSimpleView />, { store });
        const { container } = mounted;

        // 1. ARRIVE ON A. Positive control for everything below: if this does
        //    not hold, an absent button later would prove nothing.
        await hopTo(store, MAP_A);
        expect(aboutButton(container)).toBeTruthy();
        expect(modalTitle()).toBeTruthy();
        expect(modalTitle().textContent).toContain('Project A');

        // The viewer closes it with the cross — no acceptance recorded. This is
        // the state that made a re-fetch look dangerous, and the reason the
        // interruption is deduped separately from the payload.
        await act(async() => {
            fireEvent.click(closeCross());
            await flush();
        });
        expect(document.querySelector('.sv-introduction-modal-host')).toBe(null);
        expect(aboutButton(container)).toBeTruthy();

        // 2. HOP TO B. TASK-2790's clear plus B's own fetch: the toolbar keeps
        //    its About button and the modal now names B, never A.
        await hopTo(store, MAP_B);
        expect(aboutButton(container)).toBeTruthy();
        expect(modalTitle().textContent).toContain('Project B');
        expect(modalTitle().textContent).toNotContain('Project A');

        await act(async() => {
            fireEvent.click(closeCross());
            await flush();
        });

        // 3. HOP BACK TO A — the defect. Pre-fix the toolbar came back as
        //    [Search, Measure, Legend] with no About control at all.
        await hopTo(store, MAP_A);

        // AC1: the payload is available again...
        expect(aboutButton(container)).toBeTruthy();
        // AC2: ...but nothing volunteered itself. The viewer dismissed this
        // modal earlier in the same page session and has not accepted.
        expect(document.querySelector('.sv-introduction-modal-host')).toBe(null);
        expect(store.getState().simpleView.visibleIntroduction).toBe(false);

        // ...and one click reaches A's introduction, naming A.
        await act(async() => {
            fireEvent.click(aboutButton(container));
            await flush();
        });
        expect(modalTitle()).toBeTruthy();
        expect(modalTitle().textContent).toContain('Project A');
        expect(modalTitle().textContent).toNotContain('Project B');
        // The slice describes A, not the project we were just standing on.
        expect(store.getState().simpleView.introduction.projectId).toBe(PROJECT_A);
    });

    it('asks the server exactly three times for the three arrivals', async() => {
        // The other half of the fix: making the payload available again must
        // not turn INIT_ANUGA's re-render storm into a request storm. Three
        // arrivals, three from-map calls — not one per re-render.
        const store = makeStore();
        mounted = mountWithProviders(<ConnectedSimpleView />, { store });

        await hopTo(store, MAP_A);
        // The burst, on the map already answered.
        await act(async() => {
            store.dispatch({ type: INIT_ANUGA });
            store.dispatch({ type: INIT_ANUGA });
            store.dispatch({ type: INIT_ANUGA });
            await flush();
            await flush();
        });
        await hopTo(store, MAP_B);
        await hopTo(store, MAP_A);
        await act(async() => {
            store.dispatch({ type: INIT_ANUGA });
            await flush();
            await flush();
        });

        expect(mockAxios.history.post.length).toBe(3);
        expect(mockAxios.history.get.length).toBe(3);
    });
});

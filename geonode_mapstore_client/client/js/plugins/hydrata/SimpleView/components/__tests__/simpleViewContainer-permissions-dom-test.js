/*
 * RHS Permissions padlock → custom MembershipPanel.
 *
 * The padlock replaces the old left-rail "Permissions" (members) button. It must:
 *   - render only when the user can manage members (ANUGA owner/manager), since
 *     the MembershipPanel only mounts on ANUGA maps for that audience;
 *   - dispatch setMembershipPanel (our custom permissions panel) on click — NOT
 *     the old GeoNode ResourceDetails (setShowDetails) action;
 *   - reflect state.anuga.ui.showMembershipPanel as its active state.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ConnectedSimpleView from '../simpleViewContainer';
// TASK-2790 — driven through the REAL reducer, so the map-switch assertions
// cannot pass against a reducer that never clears.
import svReducer from '../../reducersSimpleView';
import { INTRODUCTION_LOADED } from '../../actionsSimpleView';
import { SET_RESOURCE_ID } from '@js/actions/gnresource';

// TASK-2796 — a MINIMAL arrived payload. Deliberately not a realistic one: the
// gate is `!!introduction.data`, so the smallest object that satisfies it is
// the honest fixture, and anything richer would imply the gate reads fields it
// does not read.
const LOADED_PAYLOAD = { project_name: 'Msimbazi baseline', content_version: 'v1' };

function makeStore(state) {
    const dispatched = [];
    return {
        dispatched,
        store: {
            getState: () => state,
            subscribe: () => () => {},
            dispatch: (a) => { dispatched.push(a); return a; }
        }
    };
}

const ownerState = (showMembershipPanel = false) => ({
    anuga: { projects: { data: { my_role: 'owner' } }, ui: { showMembershipPanel } },
    security: { user: { pk: 1 } },
    simpleView: {},
    // layers has no `flat` — exercises the optional-chain guard in
    // simpleViewLegend mapStateToProps (state?.layers?.flat?.filter)
    layers: { groups: [] },
    localConfig: { plugins: { map_viewer: [] } }
});

describe('SimpleView RHS Permissions padlock', () => {
    it('dispatches setMembershipPanel(true) on click — not ResourceDetails', () => {
        const { store, dispatched } = makeStore(ownerState(false));
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        const padlock = container.querySelector('button[title="Permissions"]');
        expect(padlock).toBeTruthy();
        expect(padlock.className).toNotContain('active');

        fireEvent.click(padlock);

        const membershipActions = dispatched.filter(a => a && a.type === 'SET_MEMBERSHIP_PANEL');
        expect(membershipActions.length).toBe(1);
        expect(membershipActions[0].visible).toBe(true);
    });

    it('shows the padlock active when the MembershipPanel is open', () => {
        const { store } = makeStore(ownerState(true));
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        const padlock = container.querySelector('button[title="Permissions"]');
        expect(padlock).toBeTruthy();
        expect(padlock.className).toContain('active');
    });

    it('hides the padlock when the user cannot manage members', () => {
        const state = ownerState(false);
        state.anuga.projects.data.my_role = 'viewer'; // not owner/manager
        const { store } = makeStore(state);
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
    });
});

// TASK-2420 (epic 2359 W4.5) — the padlock -> Account panel button. AC1:
// flags-off is covered above (byte-identical, untouched by these new
// tests). AC2: flags-on renders for ANY authenticated user (not just a
// project manager), glyph 'user', title 'Account'.
describe('SimpleView RHS Account button (TASK-2420, paywallEnabled=true)', () => {
    // paywallEnabled is read off ownProps (mapStateToProps(state, ownProps)) —
    // it arrives as a genuine ownProp via MapStore's createPlugin cfg-spread
    // in the real app (localConfig.json's SimpleView plugin cfg, map_viewer
    // block), so these tests pass it the same way: a JSX prop on the
    // connected component, not via state.
    const paywallOnState = (myRole, loggedIn = true) => ({
        anuga: { projects: { data: { my_role: myRole } }, ui: { showMembershipPanel: false } },
        security: { user: loggedIn ? { pk: 1 } : null },
        simpleView: {},
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: [] } }
    });

    it('renders for a non-manager authenticated user (hidden under flags-off) as "Account" with the user glyph', () => {
        const { store } = makeStore(paywallOnState('viewer'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
        const btn = container.querySelector('button[title="Account"]');
        expect(btn).toBeTruthy();
        expect(btn.querySelector('.glyphicon-user')).toBeTruthy();
    });

    it('still renders for a manager too (title flips from Permissions to Account)', () => {
        const { store } = makeStore(paywallOnState('manager'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Permissions"]')).toBe(null);
        expect(container.querySelector('button[title="Account"]')).toBeTruthy();
    });

    it('renders nothing for an anonymous (logged-out) visitor', () => {
        const { store } = makeStore(paywallOnState('viewer', false));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(container.querySelector('button[title="Account"]')).toBe(null);
    });

    it('dispatches setMembershipPanel(true) on click, same as the flags-off padlock', () => {
        const { store, dispatched } = makeStore(paywallOnState('viewer'));
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        fireEvent.click(container.querySelector('button[title="Account"]'));
        const membershipActions = dispatched.filter(a => a && a.type === 'SET_MEMBERSHIP_PANEL');
        expect(membershipActions.length).toBe(1);
        expect(membershipActions[0].visible).toBe(true);
    });
});

// TASK-2465 (epic 2425 W2.5) — the Account button is the TOPMOST button in the
// right-hand vertical toolbar.
//
// SCOPE OF PROOF — read before trusting this: `.simple-view-right-toolbar` is a
// plain CSS flex column with no `order` declared on any child, so visual order
// is DOM order. jsdom has no layout engine, so these tests prove DOM ORDER ONLY.
// They are a genuine regression pin for a source-order reorder (which is the
// mechanism actually in use) but they would NOT catch someone adding a CSS
// `order`/`flex-direction: column-reverse` in simpleView.css. That is exactly
// why the task forbids a CSS `order` hack, and why the padlock/geometry claims
// in this wave are carried by the Playwright suite, not by karma.
describe('SimpleView RHS toolbar order (TASK-2465)', () => {
    // Every conditional button switched ON, so the assertion covers the full
    // six-button column rather than the degenerate two-button case.
    const fullToolbarState = () => ({
        anuga: { projects: { data: { my_role: 'owner' } }, ui: { showMembershipPanel: false } },
        security: { user: { pk: 1, is_superuser: true } },
        gnresource: { permissions: { canEdit: true } },
        // TASK-2796 — the About button is now payload-gated, so "every
        // conditional button switched ON" includes an arrived introduction.
        simpleView: { introduction: { projectId: 13422, data: LOADED_PAYLOAD } },
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: [{ name: 'Search' }, { name: 'Measure' }] } }
    });

    const titlesOf = (container) => Array.from(
        container.querySelectorAll('.simple-view-right-toolbar > button')
    ).map(b => b.getAttribute('title'));

    it('renders Account first, with every other button intact and in its original relative order', () => {
        const { store } = makeStore(fullToolbarState());
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(titlesOf(container)).toEqual(
            ['Account', 'Search', 'Measure', 'Legend', 'Layer Menu', 'Save', 'About this project']
        );
    });

    it('puts the flags-off Permissions padlock first too — the same slot, not a second control', () => {
        const { store } = makeStore(fullToolbarState());
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(titlesOf(container)).toEqual(
            ['Permissions', 'Search', 'Measure', 'Legend', 'Layer Menu', 'Save', 'About this project']
        );
    });

    it('keeps About this project LAST, whichever buttons are showing', () => {
        // TASK-2775 (epic 2765 W3) — the About button is appended, so the
        // relative order of all six pre-existing buttons is byte-identical and
        // TASK-2465's Account-first decision is untouched. The two assertions
        // above already pin the full six-button column; this one states the new
        // rule on its own so a reorder fails with the reason visible.
        const { store } = makeStore(fullToolbarState());
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        const titles = titlesOf(container);
        expect(titles[titles.length - 1]).toBe('About this project');
    });

    it('stays first when the buttons below it are conditionally hidden', () => {
        // canEdit false + no Search/Measure plugins: the ONLY thing left below
        // Account is Legend. A CSS `order` keyed to a fixed button count would
        // break here; source order cannot.
        const state = fullToolbarState();
        state.gnresource = {};
        state.localConfig = { plugins: { map_viewer: [] } };
        const { store } = makeStore(state);
        const { container } = mountWithProviders(<ConnectedSimpleView paywallEnabled />, { store });
        expect(titlesOf(container)).toEqual(['Account', 'Legend', 'About this project']);
    });
});

// TASK-2775 (epic 2765 W3) — the "About this project" button. Settled decision
// 10: reopen-any-time is what makes the one-click accept acceptable, so it is
// visible to EVERY role, anonymous included.
describe('SimpleView RHS "About this project" button (TASK-2775)', () => {
    const anonState = () => ({
        anuga: { projects: {}, ui: {} },
        security: {},
        // TASK-2796 — every case in this block is about WHO may reach the
        // control, so each one now starts from a surface that has something to
        // show. The no-payload surface has its own block below.
        simpleView: { introduction: { projectId: 13422, data: LOADED_PAYLOAD } },
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: [] } }
    });

    const aboutButton = (container) =>
        container.querySelector('.simple-view-right-toolbar button[title="About this project"]');

    it('renders for an ANONYMOUS viewer — the audience this epic serves (AC11)', () => {
        const { store } = makeStore(anonState());
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBeTruthy();
    });

    it('renders for a project VIEWER', () => {
        const state = anonState();
        state.security = { user: { pk: 2 } };
        state.anuga.projects = { data: { my_role: 'viewer' } };
        const { store } = makeStore(state);
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBeTruthy();
    });

    it('renders for the OWNER — members never auto-see it, but must still reach it', () => {
        const state = anonState();
        state.security = { user: { pk: 1 } };
        state.anuga.projects = { data: { my_role: 'owner' } };
        const { store } = makeStore(state);
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBeTruthy();
    });

    it('reopens the introduction on click', () => {
        const { store, dispatched } = makeStore(anonState());
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });

        fireEvent.click(aboutButton(container));

        const shown = dispatched.filter(a => a && a.type === 'SET_VISIBLE_INTRODUCTION');
        expect(shown.length).toBe(1);
        expect(shown[0].visible).toBe(true);
    });

    it('carries the info glyph', () => {
        const { store } = makeStore(anonState());
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container).querySelector('.glyphicon-info-sign')).toBeTruthy();
    });

    it('is the LAST child of the toolbar column (AC3)', () => {
        // Source order IS the ordering mechanism: `.simple-view-right-toolbar`
        // is a flex column with no `order` on any child, so DOM order is visual
        // order. Pinned here so an accidental reorder fails loudly.
        const { store } = makeStore(anonState());
        const { container } = mountWithProviders(<ConnectedSimpleView />, { store });
        const buttons = Array.from(
            container.querySelectorAll('.simple-view-right-toolbar > button')
        );
        expect(buttons[buttons.length - 1].getAttribute('title')).toBe('About this project');
    });
});

// TASK-2796 (epic 2765 W5) — THE NO-PAYLOAD SURFACE.
//
// W3 shipped the About button unconditionally and W4 (TASK-2779) removed the
// one unconditional element in the modal body, so a surface with no
// introduction payload got: title "Welcome to Hydrata", a COMPLETELY EMPTY
// body, and a lone Accept. Reproduced live on localhost before the fix — a
// 131px dialog with nothing in it.
//
// That surface is not hypothetical. theswamm.com / sararaportal.com /
// nicaraguahydroportal.com all ship SimpleView in `plugins.map_viewer` WITHOUT
// Anuga (ansible/playbooks/roles/ansible-geonode/files/*.json, re-verified
// 2026-08-15), and `introductionFetchEpic` bails on `!isAnugaContext` before it
// makes a request, so `state.simpleView.introduction` is never written there at
// all. A plain GeoNode map on hydrata.com arrives at the same state through the
// other door: `POST /projects/from-map/` 404s and the epic stops.
//
// ⚠ THE POSITIVE CONTROL IS PART OF THE PROOF. "No `.modal-body` in the
// document" is only evidence of an absent modal once the same query has been
// shown to FIND a populated one; the first test below does that, so a query
// that silently matches nothing (wrong selector, portal moved) cannot pass this
// block by accident.
describe('SimpleView "About this project" with no introduction payload (TASK-2796)', () => {
    const surfaceState = (introduction, mapViewer = []) => ({
        anuga: { projects: {}, ui: {} },
        security: {},
        simpleView: { visibleIntroduction: true, ...(introduction ? { introduction } : {}) },
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: mapViewer } }
    });

    const aboutButton = (container) =>
        container.querySelector('.simple-view-right-toolbar button[title="About this project"]');
    // The modal portals to document.body, so query the document.
    const modalBody = () => document.querySelector('.sv-introduction-modal-host .modal-body');

    it('POSITIVE CONTROL — with a payload the modal mounts and its body is NOT empty', () => {
        const withPayload = {
            projectId: 13422,
            data: {
                project_name: 'Msimbazi baseline',
                content_version: 'v1',
                baseline: { message_id: 'hydrata.introduction.baseline', version: '1' }
            }
        };
        const { store } = makeStore(surfaceState(withPayload));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });

        expect(aboutButton(container)).toBeTruthy();
        const body = modalBody();
        expect(body).toBeTruthy();
        // Asserting on the BODY, not on the button: this is the thing the bug
        // was about. The baseline block alone guarantees content here.
        expect(body.textContent.trim().length).toBeGreaterThan(0);
        expect(body.querySelector('.sv-introduction-baseline-block')).toBeTruthy();
        unmount();
    });

    it('offers no About button when no payload ever arrived', () => {
        const { store } = makeStore(surfaceState(null));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBe(null);
        unmount();
    });

    it('renders NO modal body at all — never an empty one — with visibleIntroduction latched true', () => {
        // The flag is deliberately set: this pins the TERMINAL gate rather than
        // the button's, so a payload that vanishes under an already-open modal
        // (a map switch clears the slice — TASK-2790) stands the dialog down
        // instead of blanking it in place.
        const { store } = makeStore(surfaceState(null));
        const { unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(modalBody()).toBe(null);
        unmount();
    });

    it('offers no About button on a SimpleView-without-Anuga site (theswamm / sarara / nicp)', () => {
        // The three sites' shipped config shape: SimpleView present, Anuga
        // absent, so the fetch epic never runs and the slice stays unwritten.
        const { store } = makeStore(surfaceState(null, [{ name: 'Search' }, { name: 'Measure' }]));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBe(null);
        unmount();
    });

    it('AC5 — a hydrata.com plain GeoNode map (Anuga configured, no project) sees exactly the same', () => {
        // Anuga IS in map_viewer here, so the SITE gate passes and the fetch
        // runs; the MAP gate is what stops it (from-map 404 -> no payload).
        // The user therefore sees the rest of the RHS toolbar with NO About
        // control, and no dialog can be opened — identical to the three
        // non-ANUGA sites, and identical to today's shipped 5.x, where this
        // modal does not exist at all.
        const { store } = makeStore(surfaceState(null, [{ name: 'Anuga' }, { name: 'Search' }]));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBe(null);
        expect(modalBody()).toBe(null);
        // The column is still there and still populated — this hides ONE
        // control, it does not empty the toolbar.
        expect(container.querySelectorAll('.simple-view-right-toolbar > button').length)
            .toBeGreaterThan(0);
        unmount();
    });

    it('an arriving payload turns the control back on — the gate is state, not a one-way kill', () => {
        const { store } = makeStore(surfaceState(null));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBe(null);
        unmount();

        const loaded = makeStore(surfaceState({ projectId: 13422, data: LOADED_PAYLOAD }));
        const second = mountWithProviders(<ConnectedSimpleView />, { store: loaded.store });
        expect(aboutButton(second.container)).toBeTruthy();
        second.unmount();
    });
});

// TASK-2790 (epic 2765 W5) — AC2, at the DOM.
//
// The reducer proof lives in SimpleView/__tests__/simpleView-test.js. This is
// the consequence the task is actually about: the "About this project" button
// is a direct `setVisibleIntroduction(true)` with no guard, so if the slice
// still held the previous project after an SPA hop, one click would show a
// stranger project A's name and A's liability disclaimer while they are looking
// at project B.
//
// Driven through the REAL reducer rather than a hand-written "after" state, so
// this cannot pass against a reducer that never clears.
describe('SimpleView "About this project" across a map switch (TASK-2790)', () => {
    const stateAfter = (svSlice) => ({
        anuga: { projects: {}, ui: {} },
        security: {},
        simpleView: { visibleIntroduction: true, ...svSlice },
        layers: { groups: [] },
        localConfig: { plugins: { map_viewer: [{ name: 'Anuga' }] } }
    });

    const onMapA = () => svReducer(
        svReducer(undefined, { type: SET_RESOURCE_ID, id: '118' }),
        {
            type: INTRODUCTION_LOADED,
            projectId: 13422,
            data: {
                project_name: 'Project A',
                content_version: 'va',
                baseline: { message_id: 'hydrata.introduction.baseline', version: '1' }
            },
            mapId: '118'
        }
    );

    const aboutButton = (container) =>
        container.querySelector('.simple-view-right-toolbar button[title="About this project"]');
    const modalTitle = () =>
        document.querySelector('.sv-introduction-modal-host .modal-title');

    it('POSITIVE CONTROL — on map A the button is offered and the modal names Project A', () => {
        const { store } = makeStore(stateAfter(onMapA()));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });
        expect(aboutButton(container)).toBeTruthy();
        expect(modalTitle().textContent).toContain('Project A');
        unmount();
    });

    it('AC2 — after the map changes, nothing can render the previous project', () => {
        const afterHop = svReducer(onMapA(), { type: SET_RESOURCE_ID, id: '200' });
        const { store } = makeStore(stateAfter(afterHop));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });

        // No control to click...
        expect(aboutButton(container)).toBe(null);
        // ...and nothing on screen even with visibleIntroduction latched true
        // from before the hop.
        expect(document.querySelector('.sv-introduction-modal-host')).toBe(null);
        expect(document.body.textContent).toNotContain('Project A');
        unmount();
    });

    it('comes back naming the NEW project once B\'s payload lands', () => {
        const afterHop = svReducer(onMapA(), { type: SET_RESOURCE_ID, id: '200' });
        const loadedB = svReducer(afterHop, {
            type: INTRODUCTION_LOADED,
            projectId: 555,
            data: {
                project_name: 'Project B',
                content_version: 'vb',
                baseline: { message_id: 'hydrata.introduction.baseline', version: '1' }
            },
            mapId: '200'
        });
        const { store } = makeStore(stateAfter(loadedB));
        const { container, unmount } = mountWithProviders(<ConnectedSimpleView />, { store });

        expect(aboutButton(container)).toBeTruthy();
        expect(modalTitle().textContent).toContain('Project B');
        expect(modalTitle().textContent).toNotContain('Project A');
        unmount();
    });
});

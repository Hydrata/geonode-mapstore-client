/**
 * TASK-2548 (epic 2425 W3e) — THE ANUGA PROJECT FOLLOWS THE MAP.
 *
 * THE BUG. `state.anuga.projects.data` was write-once per document. The only
 * dispatcher of INIT_ANUGA is anugaContainer.componentDidUpdate, gated on
 * `!isAnugaProject` — which mapStateToProps defines as literally
 * `projects.data.id` — and no case in projectsReducer ever cleared `data`. So
 * the first project to load stayed loaded for the life of the document, and a
 * same-document map switch (/catalogue/#/map/<id>) could not update it. Every
 * project-scoped paywall guard then compared against the wrong project.
 * Measured live on localhost, standing on map 1404 (project 15283), the
 * checkout POST carried {"project_id":15834, ..., "return_map_id":"1404"}: the
 * customer bought and PRIVATISED the project they were not looking at.
 *
 * WHY THESE SPECS ARE SHAPED THIS WAY. The bug is invisible to a test that
 * seeds `projects.data` directly — seeding is exactly what hid it, because a
 * seeded store already has the identity the app failed to update. So every
 * spec below drives the slice through the REAL action sequence a map switch
 * produces (SET_RESOURCE_ID → INIT_ANUGA → SET_ANUGA_INIT_IN_FLIGHT →
 * SET_ANUGA_PROJECT_DATA) and asserts on what falls out, rather than asserting
 * a hand-built store reads the way we hoped.
 *
 * The container spec at the end is the TASK-1637 non-regression (AC2): it
 * replays the prop sequence a real switch presents and counts initAnuga()
 * calls across the whole from-map → getProjectV2 → setAnugaProjectData window,
 * where the pre-1637 code re-dispatched INIT_ANUGA on every re-render.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import expect from 'expect';

import projectsReducer from '../reducers/projectsReducer';
// Every action below comes from the real creator, never a hand-written
// `{type: '...'}` literal. A literal that misses the real constant dispatches
// something no reducer case matches, and the spec then measures the reducer
// doing nothing while reading as a test of it — `UPDATE_PROJECT_VISIBILITY_
// REQUEST` in particular is NOT namespaced (dataActions.js:49) while its
// neighbour SET_ANUGA_RESOURCE_PERMS is, so guessing the prefix is a coin flip.
import {
    setAnugaProjectData,
    setAnugaInitInFlight,
    setAnugaResources,
    updateProjectVisibilityRequest
} from '../actionsAnuga';
import { setResourceId } from '@js/actions/gnresource';
import { getProjectId } from '../selectorsAnuga';
import { getEffectivePaywallPayload } from '../../Paywall/reducer';
import { AnugaContainer } from '../components/anugaContainer';

// The two real maps/projects the live measurement used.
const MAP_A = '1418';
const PROJECT_A = 15834;
const MAP_B = '1404';
const PROJECT_B = 15283;

const projectPayload = (id, name) => ({
    id,
    name,
    projection: 'EPSG:28356',
    visibility: 'public',
    owner_username: 'testuser',
    my_role: 'owner'
});

// Drive the slice the way the app does: the resource lands, then the init
// waterfall runs. Returns the slice as it stands with map A fully loaded.
const loadedOnMapA = () => {
    let s = projectsReducer(undefined, setResourceId(MAP_A));
    s = projectsReducer(s, setAnugaInitInFlight(MAP_A));
    return projectsReducer(s, setAnugaProjectData(projectPayload(PROJECT_A, 'Merewether Flood Study'), MAP_A));
};

describe('TASK-2548 — the ANUGA project follows the map', () => {
    it('drops the loaded project when the map changes, so the container gate can re-fire', () => {
        const onA = loadedOnMapA();
        expect(onA.data.id).toBe(PROJECT_A);
        expect(onA.mapId).toBe(MAP_A);

        const onB = projectsReducer(onA, setResourceId(MAP_B));

        // `!isAnugaProject` — the container's gate — is what has to become
        // true again. It reads projects.data.id.
        expect(onB.data).toBe(null);
        expect(onB.mapId).toBe(MAP_B);
        expect(onB.initInFlight).toBe(false);
    });

    it('leaves the slice untouched when SET_RESOURCE_ID repeats for the same map', () => {
        const onA = loadedOnMapA();

        // Same map, and the numeric form of the same id: gnresource.id is a
        // string on the SPA route path but a number from other setResourceId
        // callers, and a type-only difference must not read as a map change.
        expect(projectsReducer(onA, setResourceId(MAP_A))).toBe(onA);
        expect(projectsReducer(onA, setResourceId(Number(MAP_A)))).toBe(onA);
    });

    it('drops an in-flight visibility request stamped for the project being left', () => {
        let onA = loadedOnMapA();
        onA = projectsReducer(onA, updateProjectVisibilityRequest('private'));
        expect(onA.visibilityPending).toBe('private');
        expect(onA.visibilityPendingProjectId).toBe(PROJECT_A);

        const onB = projectsReducer(onA, setResourceId(MAP_B));

        expect(onB.visibilityPending).toBe(null);
        expect(onB.visibilityPendingProjectId).toBe(null);
    });

    it('keeps the catalogue list across a map switch', () => {
        let onA = loadedOnMapA();
        onA = projectsReducer(onA, setAnugaResources({ projects: [] }));
        const before = onA.anugaHomePageResources;
        expect(before).toExist();

        const onB = projectsReducer(onA, setResourceId(MAP_B));

        // anugaHomePageResources is catalogue-scoped, not project-scoped: the
        // reset must not take it with it.
        expect(onB.anugaHomePageResources).toBe(before);
    });

    it('refuses project data stamped for a map that has been left', () => {
        const onA = loadedOnMapA();
        const onB = projectsReducer(onA, setResourceId(MAP_B));

        // The visibility PATCH is not cancelled by a nav (initAnugaEpic's
        // switchMap cancels its own chain; membershipEpics has no such thing),
        // so its response can land here after the switch carrying A.
        const late = projectsReducer(onB, setAnugaProjectData(projectPayload(PROJECT_A, 'Merewether Flood Study'), MAP_A));

        expect(late).toBe(onB);
        expect(late.data).toBe(null);
    });

    it('stores project data stamped for the map on screen', () => {
        const onA = loadedOnMapA();
        let onB = projectsReducer(onA, setResourceId(MAP_B));
        onB = projectsReducer(onB, setAnugaInitInFlight(MAP_B));
        onB = projectsReducer(onB, setAnugaProjectData(projectPayload(PROJECT_B, 'test27'), MAP_B));

        expect(onB.data.id).toBe(PROJECT_B);
        expect(onB.mapId).toBe(MAP_B);
        expect(onB.initInFlight).toBe(false);
    });

    it('accepts an unstamped dispatch, and adopts a stamp when no map is known yet', () => {
        // Fail-safe, matching SET_ANUGA_RESOURCE_PERMS: refuse only a stamp
        // that POSITIVELY disagrees. A caller that has not been taught to
        // stamp must not have its data silently discarded.
        const unstamped = projectsReducer(loadedOnMapA(), setAnugaProjectData(projectPayload(PROJECT_B, 'test27')));
        expect(unstamped.data.id).toBe(PROJECT_B);
        expect(unstamped.mapId).toBe(MAP_A);

        // No SET_RESOURCE_ID seen at all (a host mounting the reducer outside
        // the GeoNode resource lifecycle): the stamp establishes the identity.
        const fresh = projectsReducer(undefined, setAnugaProjectData(projectPayload(PROJECT_B, 'test27'), MAP_B));
        expect(fresh.mapId).toBe(MAP_B);
    });

    it('carries the map stamp on the action', () => {
        const action = setAnugaProjectData({ id: PROJECT_B }, MAP_B);
        expect(action.mapId).toBe(MAP_B);
        expect(setAnugaProjectData({ id: PROJECT_B }).mapId).toBe(undefined);
    });

    it('MONEY PATH: the checkout can no longer name project A the moment the map changes', () => {
        // The exact live repro: a 402 upgrade_prompt armed on map A, then a
        // same-document hash nav to map B, then Subscribe. subscribeCheckoutEpic
        // resolves getProjectId at CLICK time, so what it reads BETWEEN the map
        // change and B's data landing is what the customer's money buys.
        //
        // NOTE THE ASSERTION POINT. It is deliberately the switch itself and
        // not "once B has loaded": under the bug, INIT_ANUGA never fires for B,
        // so SET_ANUGA_PROJECT_DATA(B) never happens and a spec that hand-feeds
        // it proves nothing (it makes the buggy reducer look fixed). What has
        // to be true is that A stops being readable the instant the map moves.
        const paywall = {
            overlay: { state: 'upgrade_prompt', visibility: 'private' },
            overlayProjectId: PROJECT_A
        };
        const stateOn = (projects) => ({ anuga: { projects, paywall } });

        const onA = loadedOnMapA();
        expect(getProjectId(stateOn(onA))).toBe(PROJECT_A);
        expect(getEffectivePaywallPayload(stateOn(onA))).toBe(paywall.overlay);

        const switched = projectsReducer(onA, setResourceId(MAP_B));

        // Measured live before the fix, standing on map B: project_id 15834.
        // createCheckoutSession omits project_id entirely when it is falsy, so
        // a click inside the load window buys an account-scoped subscription —
        // no purchase against a project the customer is not looking at.
        expect(getProjectId(stateOn(switched))).toBe(null);

        // And once B's own init completes, A's refusal positively disagrees
        // with the loaded project, so it stops rendering at all.
        let onB = projectsReducer(switched, setAnugaInitInFlight(MAP_B));
        onB = projectsReducer(onB, setAnugaProjectData(projectPayload(PROJECT_B, 'test27'), MAP_B));
        expect(getProjectId(stateOn(onB))).toBe(PROJECT_B);
        expect(getEffectivePaywallPayload(stateOn(onB))).toBe(null);
    });

    it('AC2 — dispatches INIT_ANUGA exactly once across a map switch, not once per re-render', () => {
        // TASK-1637 non-regression. The window between INIT_ANUGA and
        // SET_ANUGA_PROJECT_DATA is many re-renders long and isAnugaProject is
        // falsy throughout it; before the initInFlight guard every one of those
        // re-renders re-dispatched INIT_ANUGA and the epic's switchMap
        // cancelled and restarted the whole waterfall.
        const container = document.createElement('div');
        document.body.appendChild(container);

        let initCalls = 0;
        const noop = () => {};
        const store = {
            getState: () => ({
                anuga: { ui: {}, projects: {}, resources: {} },
                layers: { flat: [], groups: [] },
                simpleView: {},
                controls: {},
                localConfig: { plugins: {} }
            }),
            subscribe: () => () => {},
            dispatch: noop
        };
        const props = (over) => ({
            initAnuga: () => { initCalls++; },
            canViewAnugaMap: true,
            canEditAnugaMap: true,
            hasEPSGset: true,
            setAnugaInputMenu: noop,
            setAnugaScenarioMenu: noop,
            setAnugaResultMenu: noop,
            setPublicationPanel: noop,
            setOpenMenuGroupId: noop,
            startAnugaScenarioPolling: noop,
            stopAnugaScenarioPolling: noop,
            setMembershipPanel: noop,
            setHydrologyMainMenu: noop,
            setProfilePanelVisible: noop,
            showProfilePanel: false,
            ...over
        });
        const render = (over) => ReactDOM.render(
            <Provider store={store}><AnugaContainer {...props(over)} /></Provider>,
            container
        );

        // Settled on map A.
        render({ gnResourceLoaded: MAP_A, isAnugaProject: PROJECT_A, initInFlight: false });
        render({ gnResourceLoaded: MAP_A, isAnugaProject: PROJECT_A, initInFlight: false, showProfilePanel: true });
        expect(initCalls).toBe(0);

        // The switch: SET_RESOURCE_ID lands, projectsReducer clears the slice.
        render({ gnResourceLoaded: MAP_B, isAnugaProject: undefined, initInFlight: false });
        expect(initCalls).toBe(1);

        // The epic answers with the map-keyed guard, then the from-map →
        // getProjectV2 window re-renders repeatedly with no project yet.
        for (let i = 0; i < 5; i++) {
            render({
                gnResourceLoaded: MAP_B, isAnugaProject: undefined, initInFlight: MAP_B,
                showProfilePanel: i % 2 === 0
            });
        }
        expect(initCalls).toBe(1);

        // B's project data lands.
        render({ gnResourceLoaded: MAP_B, isAnugaProject: PROJECT_B, initInFlight: false });
        render({ gnResourceLoaded: MAP_B, isAnugaProject: PROJECT_B, initInFlight: false, showProfilePanel: true });
        expect(initCalls).toBe(1);

        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('WHY THE SLICE MUST BE CLEARED: a project id that outlives the map closes the gate forever', () => {
        // The bug at container altitude, kept executable. `!isAnugaProject` is
        // not a question about the map on screen — isAnugaProject IS the loaded
        // project's id — so while that id survives a map switch the only
        // dispatcher of INIT_ANUGA can never fire again, whatever the map does.
        //
        // This is also the answer to "why not just add another guard": a second
        // guard reading the same slice would be blind in the same way. The
        // value has to move.
        const container = document.createElement('div');
        document.body.appendChild(container);

        let initCalls = 0;
        const noop = () => {};
        const store = {
            getState: () => ({
                anuga: { ui: {}, projects: {}, resources: {} },
                layers: { flat: [], groups: [] },
                simpleView: {},
                controls: {},
                localConfig: { plugins: {} }
            }),
            subscribe: () => () => {},
            dispatch: noop
        };
        const render = (over) => ReactDOM.render(
            <Provider store={store}>
                <AnugaContainer
                    initAnuga={() => { initCalls++; }}
                    canViewAnugaMap canEditAnugaMap hasEPSGset
                    setAnugaInputMenu={noop} setAnugaScenarioMenu={noop}
                    setAnugaResultMenu={noop} setPublicationPanel={noop}
                    setOpenMenuGroupId={noop} startAnugaScenarioPolling={noop}
                    stopAnugaScenarioPolling={noop} setMembershipPanel={noop}
                    setHydrologyMainMenu={noop} setProfilePanelVisible={noop}
                    {...over}
                />
            </Provider>,
            container
        );

        render({ gnResourceLoaded: MAP_A, isAnugaProject: PROJECT_A, initInFlight: false });
        // The map changes but the stale project id stays — the pre-fix store.
        for (let i = 0; i < 6; i++) {
            render({
                gnResourceLoaded: MAP_B, isAnugaProject: PROJECT_A, initInFlight: false,
                showProfilePanel: i % 2 === 0
            });
        }
        expect(initCalls).toBe(0);

        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});

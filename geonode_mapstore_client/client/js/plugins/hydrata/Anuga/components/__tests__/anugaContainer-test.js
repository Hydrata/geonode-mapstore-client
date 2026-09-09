/*
 * TASK-1491 regression — AnugaContainer.mapStateToProps must be safe for an
 * ANONYMOUS viewer whose SimpleView/ANUGA slices were never populated.
 *
 * Root cause: the selector read `state?.simpleView.hasOwnProperty('visibleIntroduction')`
 * — the optional chain stopped at `.simpleView`, so `.hasOwnProperty(...)` was
 * invoked on `undefined` and threw `Cannot read properties of undefined
 * (reading 'hasOwnProperty')`. That escaped to the MapStore error boundary and
 * replaced the entire ViewerRoute ("Oops, something has gone wrong"), so no map
 * or plugins mounted. initAnugaEpic is auth-gated (pollingEpics.js:174), so for
 * an anon user state.simpleView / state.anuga are undefined — i.e. the `{}`-ish
 * state below is the anon viewer's reality, not a synthetic edge case.
 *
 * TASK-2777 (epic 2765 W3) — THE READ ITSELF IS GONE, so the crash it caused
 * cannot recur by construction rather than by guard. `visibleIntroduction` was
 * mapped into props that this container never rendered, with an absent-key
 * default of TRUE; the introduction's visibility now lives entirely in
 * SimpleView (introductionGate.js decides, simpleViewContainer renders).
 *
 * The COVERAGE IS UPDATED, NOT DELETED. The valuable half of TASK-1491 was
 * never the default — it was "this selector runs, unthrown, against the
 * anonymous viewer's empty state", which is still true of the ~20 reads that
 * remain and is still the shape that took the whole ViewerRoute down. The
 * defaulting assertions are replaced by an assertion that the prop is GONE, so
 * a future re-introduction of an always-on default has to argue with a test.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import expect from 'expect';
import { mapStateToProps, AnugaContainer } from '../anugaContainer';

describe('AnugaContainer resultsPlaybackEnabled (TASK-2631, W6.2 — dark-ship default)', () => {
    it('defaults to false — the whole playback surface (control bar, legend, identify readout, W6.1 preview button) ships dark by construction', () => {
        expect(AnugaContainer.defaultProps.resultsPlaybackEnabled).toBe(false);
    });
});

describe('anugaContainer mapStateToProps (TASK-1491 anon null-guard)', () => {
    it('does not throw when state.simpleView is undefined (anon viewer)', () => {
        expect(() => mapStateToProps({})).toNotThrow();
    });
    it('does not throw when simpleView exists but is empty', () => {
        expect(() => mapStateToProps({ simpleView: {} })).toNotThrow();
    });
    it('still resolves the props it does map, against the anon empty state', () => {
        // The crash took the ViewerRoute down for everyone, so the assertion
        // that matters is that this selector completes for the anon shape and
        // returns a usable object — not the value of any one key.
        const props = mapStateToProps({});
        expect(typeof props).toBe('object');
        expect(props.isAnugaProject).toBe(undefined);
    });
});

describe('anugaContainer no longer maps visibleIntroduction (TASK-2777)', () => {
    // It was a dead prop with an always-on default: nothing here rendered it,
    // and `state.simpleView` is undefined for an anonymous viewer, so the
    // absent-key branch returned TRUE for exactly the audience that would have
    // been trapped behind a permanently open modal had anyone wired a render
    // to it. Visibility is now decided by SimpleView/introductionGate.js alone.
    it('does not emit visibleIntroduction for the anon empty state', () => {
        expect('visibleIntroduction' in mapStateToProps({})).toBe(false);
    });
    it('does not emit it even when the SimpleView slice carries the key', () => {
        expect('visibleIntroduction' in mapStateToProps({
            simpleView: { visibleIntroduction: false }
        })).toBe(false);
    });
    it('does not declare it as a prop', () => {
        expect(AnugaContainer.propTypes.visibleIntroduction).toBe(undefined);
    });
});

/*
 * ===========================================================================
 * TASK-2993 (W4.2, epic 2981) — WHAT A STRANGER SEES IN THE TOOLBAR.
 *
 * The 2026-09-07 anonymous drive found 0 of 4 tabs and no container at all,
 * because every ANUGA read was IsAuthenticated and initAnugaEpic dropped
 * anonymous visitors before its first network call. W4.1 opened the reads and
 * W4.2 branches the epic, so this container now MOUNTS for a stranger — and
 * the question becomes which of its four toolbar entries they get.
 *
 * Inputs and Results: yes — that is the shared model.
 * Hydraulics and Hydrology: no — those are the BUILDER. Hydrology in
 * particular had NO role gate at all before this task (it rendered on plugin
 * presence alone), which was invisible only because the container never
 * mounted for a stranger.
 * ===========================================================================
 */
describe('AnugaContainer — TASK-2993 (W4.2, epic 2981) the stranger toolbar', () => {
    const noop = () => {};
    const makeStore = () => ({
        getState: () => ({
            anuga: { ui: {}, projects: {}, resources: {} },
            layers: { flat: [], groups: [] },
            simpleView: {},
            controls: {},
            localConfig: { plugins: {} }
        }),
        subscribe: () => () => {},
        dispatch: () => {}
    });

    // A STRANGER: no role, so canViewAnugaMap/canEditAnugaMap are false, but
    // the project is public so canViewAnugaResults is true. hasEPSGset comes
    // from the project retrieve TASK-2992 opened (projects.data.projection).
    const strangerProps = (over = {}) => ({
        isAnugaProject: 42,
        canViewAnugaMap: false,
        canEditAnugaMap: false,
        canViewAnugaResults: true,
        hasEPSGset: true,
        hydrologyPluginPresent: true,
        openMenuGroupId: null,
        initAnuga: noop,
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

    const memberProps = (over = {}) => strangerProps({
        canViewAnugaMap: true,
        canEditAnugaMap: true,
        canViewAnugaResults: true,
        ...over
    });

    let host;
    let toolbar;
    let resultsPanel;
    const render = (props) => {
        ReactDOM.render(
            <Provider store={makeStore()}>
                <AnugaContainer {...props} />
            </Provider>,
            host
        );
    };
    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        toolbar = document.createElement('div');
        toolbar.className = 'simple-view-left-toolbar';
        document.body.appendChild(toolbar);
        resultsPanel = document.createElement('div');
        resultsPanel.className = 'simple-view-panel simple-view-panel--miller';
        document.body.appendChild(resultsPanel);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(host);
        [host, toolbar, resultsPanel].forEach(n => n && n.parentNode && n.parentNode.removeChild(n));
    });

    const present = (testid) => !!toolbar.querySelector(`[data-testid="${testid}"]`);

    it('AC2 a stranger on a PUBLIC project gets Inputs and Results, and NOT Hydraulics or Hydrology', () => {
        render(strangerProps());
        expect(present('anuga-inputs-button')).toBe(true);
        expect(present('anuga-results-button')).toBe(true);
        expect(present('anuga-hydraulics-button')).toBe(false);
        expect(present('hydrology-main-menu-button')).toBe(false);
    });

    it('AC2 a MEMBER still gets all four — the gate is role-scoped, not a global trim', () => {
        render(memberProps());
        expect(present('anuga-inputs-button')).toBe(true);
        expect(present('anuga-results-button')).toBe(true);
        expect(present('anuga-hydraulics-button')).toBe(true);
        expect(present('hydrology-main-menu-button')).toBe(true);
    });

    it('a stranger on a PRIVATE project gets neither Results nor Hydraulics', () => {
        // canViewAnugaResults is false here — the selector's private answer.
        // (Reaching this state at all needs a project the BE refused to serve,
        // so it is a belt-and-braces gate, not the primary defence: TASK-2992
        // answers 404 long before the FE renders anything.)
        render(strangerProps({ canViewAnugaResults: false }));
        expect(present('anuga-results-button')).toBe(false);
        expect(present('anuga-hydraulics-button')).toBe(false);
        expect(present('hydrology-main-menu-button')).toBe(false);
        // Inputs is unconditional — its edit affordances self-gate on
        // canEditAnugaMap, which is false for a stranger.
        expect(present('anuga-inputs-button')).toBe(true);
    });

    it('the cross-section button rides canViewAnugaResults, not canViewAnugaMap', () => {
        render(strangerProps({ openMenuGroupId: 'Results' }));
        expect(resultsPanel.querySelector('[data-testid="anuga-profile-button"]')).toExist();
    });

    it('and it is absent when the viewer may not see results', () => {
        render(strangerProps({ openMenuGroupId: 'Results', canViewAnugaResults: false }));
        expect(resultsPanel.querySelector('[data-testid="anuga-profile-button"]')).toBe(null);
    });

    it('mapStateToProps derives canViewAnugaResults from role OR public visibility', () => {
        const publicStranger = mapStateToProps({
            anuga: { projects: { data: { id: 1, my_role: null, visibility: 'public' } }, ui: {} }
        });
        expect(publicStranger.canViewAnugaMap).toBe(false);
        expect(publicStranger.canViewAnugaResults).toBe(true);

        const privateStranger = mapStateToProps({
            anuga: { projects: { data: { id: 1, my_role: null, visibility: 'private' } }, ui: {} }
        });
        expect(privateStranger.canViewAnugaResults).toBe(false);

        const viewer = mapStateToProps({
            anuga: { projects: { data: { id: 1, my_role: 'viewer', visibility: 'private' } }, ui: {} }
        });
        expect(viewer.canViewAnugaResults).toBe(true);
    });
});


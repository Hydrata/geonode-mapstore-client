/**
 * W4 UAT — the depth/elevation profile entry moved from a standalone toolbar tab
 * to a BUTTON inside the Results tab.
 *
 * This spec pins the move on the unconnected AnugaContainer:
 *   - the toolbar (portaled into .simple-view-left-toolbar) no longer carries a
 *     standalone profile button;
 *   - when the Results tab is the open menu group the profile button is portaled
 *     into the .simple-view-panel--miller Results panel and dispatches the SAME
 *     setProfilePanelVisible action the old tab used;
 *   - when a different group is open the Results-tab button is absent.
 *
 * AnugaContainer mounts several connected children (TerrainBboxPanel,
 * TerrainProfilePanel, MergeTerrainsPanel, RunPollingPausedBanner), so the tree
 * is wrapped in a minimal redux <Provider> (mock store) — the same pattern as
 * anugaInputMenu-test.js.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import expect from 'expect';

import { AnugaContainer } from '../components/anugaContainer';

const noop = () => {};

// Minimal mock store: the connected children self-gate to null off these slices,
// so an empty-ish state is enough to mount the tree without crashing.
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

const baseProps = (over = {}) => ({
    isAnugaProject: 42,
    canViewAnugaMap: true,
    canEditAnugaMap: true,
    hasEPSGset: true,
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

const renderContainer = (props, host) => {
    ReactDOM.render(
        <Provider store={makeStore()}>
            <AnugaContainer {...props} />
        </Provider>,
        host
    );
};

describe('AnugaContainer — profile entry moved to Results tab (W4 UAT)', () => {
    let host;
    let toolbar;
    let resultsPanel;
    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        // The toolbar + Results miller panel are owned by sibling components;
        // stand them up so the container's portals have a target.
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

    it('does NOT render a standalone profile button in the toolbar', () => {
        renderContainer(baseProps({ openMenuGroupId: null }), host);
        // No toolbar tab carries the profile button any more.
        expect(toolbar.querySelector('[data-testid="anuga-profile-button"]')).toBe(null);
    });

    it('renders the profile button inside the Results panel when the Results tab is open', () => {
        renderContainer(baseProps({ openMenuGroupId: 'Results' }), host);
        const btn = resultsPanel.querySelector('[data-testid="anuga-profile-button"]');
        expect(btn).toExist('expected the profile button in the Results panel');
        // Still NOT in the toolbar.
        expect(toolbar.querySelector('[data-testid="anuga-profile-button"]')).toBe(null);
    });

    it('does NOT render the Results-tab button when a different group is open', () => {
        renderContainer(baseProps({ openMenuGroupId: 'basemaps' }), host);
        expect(resultsPanel.querySelector('[data-testid="anuga-profile-button"]')).toBe(null);
    });

    // TASK-2253 — the resultsProfile launch gate is DELETED: the Results-tab
    // button is live (enabled, no badge) and toggles the profile panel.
    it('the Results-tab button is enabled and toggles the profile panel', () => {
        let toggled = null;
        renderContainer(baseProps({
            openMenuGroupId: 'Results',
            showProfilePanel: false,
            setProfilePanelVisible: (v) => { toggled = v; }
        }), host);
        const btn = resultsPanel.querySelector('[data-testid="anuga-profile-button"]');
        expect(btn.disabled).toBe(false);
        expect(btn.querySelector('.sv-coming-soon-badge')).toBe(null);
        btn.click();
        expect(toggled).toBe(true);
    });

    // TASK-2277 (operator UAT 2026-07-14 headline polish item).
    describe('launcher rework — fixed-width, top of panel, closes Results (TASK-2277)', () => {
        it('clicking the button ALSO closes the Results panel (openMenuGroupId -> null)', () => {
            let toggled = null;
            let closedGroupId = 'never-called';
            renderContainer(baseProps({
                openMenuGroupId: 'Results',
                showProfilePanel: false,
                setProfilePanelVisible: (v) => { toggled = v; },
                setOpenMenuGroupId: (id) => { closedGroupId = id; }
            }), host);
            const btn = resultsPanel.querySelector('[data-testid="anuga-profile-button"]');
            btn.click();
            // AC3: opens the Cross-section panel...
            expect(toggled).toBe(true);
            // ...AND closes Results (the SAME action the Results toolbar button
            // uses to open it — see renderToolbarButtons' setOpenMenuGroupId('Results')).
            expect(closedGroupId).toBe(null);
        });

        it('the wrapper does not stretch to the panel width (fixed-width, not full-width)', () => {
            renderContainer(baseProps({ openMenuGroupId: 'Results' }), host);
            const wrapper = resultsPanel.querySelector('[data-testid="anuga-results-profile-action"]');
            const btn = resultsPanel.querySelector('[data-testid="anuga-profile-button"]');
            expect(wrapper).toExist();
            // .simple-view-panel is a flex column (align-items defaults to
            // 'stretch') — the wrapper must opt OUT of that stretch so it
            // shrinks to its content instead of spanning the panel's width.
            expect(window.getComputedStyle(wrapper).alignSelf).toBe('flex-start');
            // The button itself shrink-wraps its label (was display:block;
            // width:100% before this fix).
            expect(window.getComputedStyle(btn).display).toBe('inline-flex');
        });

        it('the button is ordered ABOVE the result-type rows (flex `order`, since createPortal always appends LAST)', () => {
            renderContainer(baseProps({ openMenuGroupId: 'Results' }), host);
            const wrapper = resultsPanel.querySelector('[data-testid="anuga-results-profile-action"]');
            // .simple-view-panel--miller renders <MenuRows/> (the Depth/Velocity/
            // etc result-type rows) as its only OTHER flex child, at the default
            // order (0); a negative order here sorts this action before it.
            expect(window.getComputedStyle(wrapper).order).toBe('-1');
        });
    });
});

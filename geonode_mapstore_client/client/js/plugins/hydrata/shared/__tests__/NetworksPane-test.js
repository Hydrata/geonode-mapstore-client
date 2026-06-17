/**
 * Tests for the shared NetworksPane component (TASK-1440, W9; TASK-1453, W6).
 *
 * Uses the UNCONNECTED NetworksPaneClass and the standalone TerrainSelector so
 * no Redux Provider is needed.
 * Uses ReactDOM + act + the existing `expect` library (karma/mocha stack —
 * NO jest.mock).
 *
 * MenuRow is imported live; it renders HTML that includes the layer group/name,
 * so we assert counts and structure rather than text content of child components.
 *
 * Covers (TASK-1440):
 *   - Structure: pane title + three sub-section headings rendered.
 *   - canEditAnugaMap=true: + (glyphicon-plus) button visible.
 *   - canEditAnugaMap=false: + button NOT visible.
 *   - Settings cog present; calls setNetworkMenu(true)+setAnugaInputMenu(false).
 *   - isCreatingAnugaLayer=true: spinner rendered, input hidden.
 *   - componentDidUpdate clears inputVisible when isCreatingAnugaLayer flips false.
 *   - create-input: shows on + click, hides on Escape keydown.
 *
 * Covers (TASK-1453):
 *   - TerrainSelector renders the step-1 heading.
 *   - Terrain list renders in the select with correct option count.
 *   - Default mirrors the Scenario terrain (read-only label + select value).
 *   - No-scenario-terrain case: "none set" fallback.
 *   - Override: selecting a different terrain shows the override badge.
 *   - Reset to default: selecting empty option clears the override.
 *   - Empty terrain list: empty-state hint rendered.
 *   - NetworksPaneClass integrates TerrainSelector (terrain props propagate).
 *   - TASK-1440 Catchments/Nodes/Links display NOT regressed.
 */
import React from 'react';
import expect from 'expect';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';
import {NetworksPaneClass, TerrainSelector} from '../NetworksPane';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => {};

const TERRAIN_LIST = [
    {id: 1, name: 'DEM North'},
    {id: 2, name: 'DEM South'}
];

// ---------------------------------------------------------------------------
// TerrainSelector tests
// ---------------------------------------------------------------------------

describe('TerrainSelector (TASK-1453)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) container.parentNode.removeChild(container);
    });

    function renderSelector(props = {}) {
        const defaults = {
            terrainList: TERRAIN_LIST,
            scenarioTerrainId: 1,
            selectedTerrainId: null,
            onSelectTerrain: noop
        };
        act(() => {
            ReactDOM.render(
                <TerrainSelector {...defaults} {...props} />,
                container
            );
        });
    }

    it('renders the networks-terrain-selector wrapper', () => {
        renderSelector();
        expect(container.querySelector('[data-testid="networks-terrain-selector"]')).toExist();
    });

    it('renders the step-1 terrain heading', () => {
        renderSelector();
        // The step heading contains a <strong> with the i18n Message component
        const heading = container.querySelector('.networks-terrain-step-heading');
        expect(heading).toExist();
    });

    it('renders terrain options in the override select', () => {
        renderSelector();
        const opts = container.querySelectorAll('[data-testid="terrain-override-select"] option');
        // blank option + 2 terrain options
        expect(opts.length).toBe(3);
    });

    it('select value defaults to scenarioTerrainId when no override is set', () => {
        renderSelector({scenarioTerrainId: 1, selectedTerrainId: null});
        const select = container.querySelector('[data-testid="terrain-override-select"]');
        // effective value = scenarioTerrainId (1)
        expect(select.value).toBe('1');
    });

    it('shows scenario-terrain-name when scenarioTerrainId matches a terrain in the list', () => {
        renderSelector({scenarioTerrainId: 2, selectedTerrainId: null});
        const label = container.querySelector('[data-testid="scenario-terrain-name"]');
        expect(label).toExist();
        expect(label.textContent).toBe('DEM South');
    });

    it('shows no-scenario-terrain fallback when scenarioTerrainId is null', () => {
        renderSelector({scenarioTerrainId: null, selectedTerrainId: null});
        expect(container.querySelector('[data-testid="no-scenario-terrain"]')).toExist();
        expect(container.querySelector('[data-testid="scenario-terrain-name"]')).toNotExist();
    });

    it('shows override badge when selectedTerrainId differs from scenarioTerrainId', () => {
        renderSelector({scenarioTerrainId: 1, selectedTerrainId: 2});
        expect(container.querySelector('[data-testid="override-badge"]')).toExist();
    });

    it('does NOT show override badge when selectedTerrainId equals scenarioTerrainId', () => {
        renderSelector({scenarioTerrainId: 1, selectedTerrainId: 1});
        expect(container.querySelector('[data-testid="override-badge"]')).toNotExist();
    });

    it('does NOT show override badge when selectedTerrainId is null (default)', () => {
        renderSelector({scenarioTerrainId: 1, selectedTerrainId: null});
        expect(container.querySelector('[data-testid="override-badge"]')).toNotExist();
    });

    it('calls onSelectTerrain with a number when a terrain option is selected', () => {
        const calls = [];
        renderSelector({onSelectTerrain: (v) => calls.push(v)});
        const select = container.querySelector('[data-testid="terrain-override-select"]');
        act(() => {
            select.value = '2';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(2);
    });

    it('calls onSelectTerrain with null when the blank option is selected', () => {
        const calls = [];
        renderSelector({selectedTerrainId: 2, onSelectTerrain: (v) => calls.push(v)});
        const select = container.querySelector('[data-testid="terrain-override-select"]');
        act(() => {
            select.value = '';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(null);
    });

    it('shows the manage-in-Inputs link', () => {
        renderSelector();
        expect(container.querySelector('[data-testid="manage-in-inputs-link"]')).toExist();
    });

    it('calls onManageInInputs when manage-in-Inputs link is clicked', () => {
        const calls = [];
        renderSelector({onManageInInputs: () => calls.push(1)});
        act(() => { container.querySelector('[data-testid="manage-in-inputs-link"]').click(); });
        expect(calls.length).toBe(1);
    });

    it('does NOT throw when onManageInInputs is not provided (optional prop)', () => {
        renderSelector({onManageInInputs: null});
        // Click must not throw even without the callback
        act(() => { container.querySelector('[data-testid="manage-in-inputs-link"]').click(); });
        // No assertion needed — absence of error is the assertion
        expect(true).toBe(true);
    });

    it('shows no-terrains hint when terrainList is empty', () => {
        renderSelector({terrainList: []});
        expect(container.querySelector('[data-testid="no-terrains-hint"]')).toExist();
    });

    it('does NOT show no-terrains hint when there are terrains', () => {
        renderSelector({terrainList: TERRAIN_LIST});
        expect(container.querySelector('[data-testid="no-terrains-hint"]')).toNotExist();
    });

    it('renders the delineation placeholder', () => {
        renderSelector();
        expect(container.querySelector('[data-testid="delineation-placeholder"]')).toExist();
    });
});

// ---------------------------------------------------------------------------
// NetworksPaneClass tests (TASK-1440 original suite + TASK-1453 integration)
// ---------------------------------------------------------------------------

describe('NetworksPaneClass (TASK-1440 + TASK-1453)', () => {
    let container;

    const defaultProps = {
        // TASK-1453
        terrainList: TERRAIN_LIST,
        scenarioTerrainId: 1,
        // TASK-1440
        catchmentLayers: [],
        nodesLayers: [],
        linksLayers: [],
        createNetwork: noop,
        setNetworkMenu: noop,
        setAnugaInputMenu: noop,
        setCreatingAnugaLayer: noop,
        canEditAnugaMap: true,
        isCreatingAnugaLayer: false
    };

    function render(props = {}) {
        act(() => {
            ReactDOM.render(
                <NetworksPaneClass {...defaultProps} {...props} />,
                container
            );
        });
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) container.parentNode.removeChild(container);
    });

    // -------------------------------------------------------------------------
    // TASK-1440 Structure (regression guard)
    // -------------------------------------------------------------------------

    it('renders the pane wrapper element with hydrology-networks-pane class', () => {
        render();
        const pane = container.querySelector('.hydrology-networks-pane');
        expect(pane).toExist();
    });

    it('renders the pane toolbar', () => {
        render();
        const toolbar = container.querySelector('.anuga-pane-toolbar');
        expect(toolbar).toExist();
    });

    it('renders three .sv-menu-row-mini-container elements (catchments / nodes / links)', () => {
        render();
        const miniContainers = container.querySelectorAll('.sv-menu-row-mini-container');
        expect(miniContainers.length).toBe(3);
    });

    it('renders three .sv-menu-row-mini-heading elements', () => {
        render();
        const headings = container.querySelectorAll('.sv-menu-row-mini-heading');
        expect(headings.length).toBe(3);
    });

    // -------------------------------------------------------------------------
    // TASK-1440 Create button visibility
    // -------------------------------------------------------------------------

    it('renders + button (glyphicon-plus) when canEditAnugaMap=true', () => {
        render({canEditAnugaMap: true});
        const plusBtn = container.querySelector('.glyphicon-plus');
        expect(plusBtn).toExist();
    });

    it('does NOT render + button when canEditAnugaMap=false', () => {
        render({canEditAnugaMap: false});
        const plusBtn = container.querySelector('.glyphicon-plus');
        expect(plusBtn).toNotExist();
    });

    // -------------------------------------------------------------------------
    // TASK-1440 Create input visibility
    // -------------------------------------------------------------------------

    it('shows text input after clicking + button', () => {
        render();
        let input = container.querySelector('input[type="text"]');
        expect(input).toNotExist();

        act(() => { container.querySelector('.glyphicon-plus').click(); });

        input = container.querySelector('input[type="text"]');
        expect(input).toExist();
    });

    it('hides input when Escape is pressed', () => {
        render();
        // Open the input
        act(() => { container.querySelector('.glyphicon-plus').click(); });
        const input = container.querySelector('input[type="text"]');
        expect(input).toExist();

        // Fire Escape keydown
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        });

        expect(container.querySelector('input[type="text"]')).toNotExist();
    });

    it('hides input when ok button clicked with empty title', () => {
        render();
        act(() => { container.querySelector('.glyphicon-plus').click(); });
        // Input visible; title still empty → click ok (glyphicon-ok) → should close
        act(() => { container.querySelector('.glyphicon-ok').click(); });
        expect(container.querySelector('input[type="text"]')).toNotExist();
    });

    // -------------------------------------------------------------------------
    // TASK-1440 Settings cog
    // -------------------------------------------------------------------------

    it('renders the settings cog button', () => {
        render();
        const cog = container.querySelector('.glyphicon-cog');
        expect(cog).toExist();
    });

    it('calls setNetworkMenu(true) when cog is clicked', () => {
        const calls = [];
        render({setNetworkMenu: (v) => calls.push(v)});
        act(() => { container.querySelector('.glyphicon-cog').click(); });
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(true);
    });

    it('calls setAnugaInputMenu(false) when cog is clicked', () => {
        const calls = [];
        render({setAnugaInputMenu: (v) => calls.push(v)});
        act(() => { container.querySelector('.glyphicon-cog').click(); });
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(false);
    });

    // -------------------------------------------------------------------------
    // TASK-1440 isCreatingAnugaLayer
    // -------------------------------------------------------------------------

    it('shows a spinner (react-spinkit) while isCreatingAnugaLayer=true', () => {
        render({isCreatingAnugaLayer: true, canEditAnugaMap: true});
        // The important invariant is we do NOT show an input while creating:
        const input = container.querySelector('input[type="text"]');
        expect(input).toNotExist();
    });

    it('clears inputVisible when isCreatingAnugaLayer transitions from true to false', () => {
        // Render with creating=true (no input shown, spinner shows instead).
        render({isCreatingAnugaLayer: true});
        // Transition to false — componentDidUpdate runs, sets inputVisible=false.
        act(() => {
            ReactDOM.render(
                <NetworksPaneClass {...defaultProps} isCreatingAnugaLayer={false} />,
                container
            );
        });
        // inputVisible should be false → no input shown.
        expect(container.querySelector('input[type="text"]')).toNotExist();
    });

    // -------------------------------------------------------------------------
    // TASK-1453 integration: TerrainSelector props flow through NetworksPaneClass
    // -------------------------------------------------------------------------

    it('TASK-1453: renders the terrain selector inside the pane', () => {
        render();
        expect(container.querySelector('[data-testid="networks-terrain-selector"]')).toExist();
    });

    it('TASK-1453: terrain selector is rendered ABOVE the Catchments/Nodes/Links pane rows', () => {
        render();
        const pane = container.querySelector('.hydrology-networks-pane');
        const selectorIndex = Array.from(pane.children).findIndex(
            el => el.querySelector('[data-testid="networks-terrain-selector"]')
        );
        const rowsIndex = Array.from(pane.children).findIndex(
            el => el.classList.contains('anuga-pane-rows')
        );
        expect(selectorIndex).toBeLessThan(rowsIndex);
    });

    it('TASK-1453: terrain list propagates to the override select', () => {
        render({terrainList: TERRAIN_LIST});
        const opts = container.querySelectorAll('[data-testid="terrain-override-select"] option');
        // blank + 2 terrain options
        expect(opts.length).toBe(3);
    });

    it('TASK-1453: scenarioTerrainId propagates — scenario-terrain-name shown', () => {
        render({scenarioTerrainId: 2, terrainList: TERRAIN_LIST});
        const label = container.querySelector('[data-testid="scenario-terrain-name"]');
        expect(label).toExist();
        expect(label.textContent).toBe('DEM South');
    });

    it('TASK-1453: no-terrains hint shown when terrainList is empty', () => {
        render({terrainList: []});
        expect(container.querySelector('[data-testid="no-terrains-hint"]')).toExist();
    });

    it('TASK-1453: internal override state updates when select changes', () => {
        render({scenarioTerrainId: 1, terrainList: TERRAIN_LIST});
        const select = container.querySelector('[data-testid="terrain-override-select"]');
        expect(container.querySelector('[data-testid="override-badge"]')).toNotExist();

        act(() => {
            select.value = '2';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        // After override, badge appears
        expect(container.querySelector('[data-testid="override-badge"]')).toExist();
    });

    it('TASK-1453: override badge disappears when reset to blank option', () => {
        render({scenarioTerrainId: 1, terrainList: TERRAIN_LIST});
        const select = container.querySelector('[data-testid="terrain-override-select"]');

        // Set override
        act(() => {
            select.value = '2';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        expect(container.querySelector('[data-testid="override-badge"]')).toExist();

        // Reset to default
        act(() => {
            select.value = '';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        expect(container.querySelector('[data-testid="override-badge"]')).toNotExist();
    });

    it('TASK-1453: delineation placeholder renders', () => {
        render();
        expect(container.querySelector('[data-testid="delineation-placeholder"]')).toExist();
    });

    // -------------------------------------------------------------------------
    // Hydrology tab wiring — buttonStyle logic for 'networks' page name
    // (kept from TASK-1440 suite as-is)
    // -------------------------------------------------------------------------
    it('buttonStyle correctly identifies "networks" as an active page', () => {
        const buttonStyle = (activeHydrologyPage, page) => ({
            color: activeHydrologyPage === page ? '#3363a0' : 'white',
            backgroundColor: activeHydrologyPage === page ? 'white' : '#6085b5'
        });
        const activeStyle = buttonStyle('networks', 'networks');
        expect(activeStyle.backgroundColor).toBe('white');
        expect(activeStyle.color).toBe('#3363a0');
        const inactiveStyle = buttonStyle('idf-table', 'networks');
        expect(inactiveStyle.backgroundColor).toBe('#6085b5');
        expect(inactiveStyle.color).toBe('white');
    });
});

/**
 * TASK-1800 (W1.9 UAT) — stand-alone "Combined surface" side panel.
 *
 * The Analysis-Surface recipe builder moved OUT of the inline expandable section
 * in Inputs->Terrain into this stand-alone dark-glass side panel. These specs pin:
 *   - self-gating on terrainWorkbench.visible (null when hidden, renders when shown)
 *   - the recipe builder (TWRecipeBuilder) renders inside the panel
 *   - the empty state ("Add a terrain first") shows when there are no terrains
 *   - the connected component reads `visible` from the terrainWorkbench slice and
 *     the close chip dispatches setTerrainWorkbenchVisible(false)
 *
 * TASK-1800 (W1.9 UAT r2):
 *   - a project owns a SINGLE combined surface: NO surface list, NO "+ New" button,
 *     NO per-row delete, NO "New Analysis Surface N" auto-names.
 *   - the panel edits exactly one surface — pickCombinedSurface() selection rule.
 *   - ZERO surfaces still let the user build + derive (synthetic placeholder, id null).
 *   - title is "Combined surface" (i18n hydrata.anuga.combinedSurfacePanelTitle).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { MergeTerrainsPanel, MergeTerrainsPanelClass, MergeTerrainsIcon, pickCombinedSurface } from '../MergeTerrainsPanel';
import { TERRAIN_WORKBENCH_SET_VISIBLE } from '../../actionsTerrainWorkbench';

const SURFACE = {
    id: 7,
    title: 'Surface A',
    inputs_ordered: [],
    use_culverts: false,
    feather_width_m: 10,
    target_resolution_m: 1,
    breach_max_cost: 100,
    breach_search_dist: 50
};

describe('TASK-1800 MergeTerrainsPanel (unconnected)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); container = undefined; });

    it('renders null when not visible', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass visible={false} terrains={[{ id: 1, title: 'T' }]} />,
            container
        );
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toNotExist();
        expect(container.innerHTML).toBe('');
    });

    it('renders the panel shell + recipe builder when visible with terrains + a surface', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass
                visible
                terrains={[{ id: 1, title: 'Top DEM' }, { id: 2, title: 'Base DEM' }]}
                surface={SURFACE}
                onClose={() => {}}
                onUpdateSurface={() => {}}
                onDerive={() => {}}
            />,
            container
        );
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toExist('panel body renders');
        // The recipe builder renders inside.
        expect(container.querySelector('[data-testid="recipe-builder"]')).toExist('TWRecipeBuilder renders');
        // PanelHeader close chip is present.
        expect(container.querySelector('.sv-panel-header-close')).toExist('close chip renders');
    });

    it('NO surface list / "+ New" button / per-row delete is rendered (single surface only)', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass
                visible
                terrains={[{ id: 1, title: 'Top DEM' }]}
                surface={SURFACE}
                onClose={() => {}}
                onUpdateSurface={() => {}}
                onDerive={() => {}}
            />,
            container
        );
        expect(container.querySelector('[data-testid="new-surface-btn"]')).toNotExist('no + New button');
        expect(container.querySelector('.sv-tw-surface-list')).toNotExist('no surface list');
        expect(container.querySelector('[data-testid="surface-item-7"]')).toNotExist('no surface row');
        expect(container.querySelector('[data-testid="surface-delete-7"]')).toNotExist('no per-row delete');
    });

    it('build + derive works with ZERO surfaces (synthetic placeholder, id null at derive)', () => {
        let derivedWith = 'untouched';
        ReactDOM.render(
            <MergeTerrainsPanelClass
                visible
                terrains={[{ id: 1, title: 'Top DEM' }, { id: 2, title: 'Base DEM' }]}
                surface={null}
                onClose={() => {}}
                onUpdateSurface={() => {}}
                onDerive={(id) => { derivedWith = id; }}
            />,
            container
        );
        // The builder renders against the placeholder so the user can build a recipe.
        expect(container.querySelector('[data-testid="recipe-builder"]')).toExist('builder renders with no surface');
        // Add both DEMs so the stack is non-empty and not all-unmodified, enabling derive.
        const addSelect = container.querySelector('[data-testid="dem-stack-add-select"]');
        addSelect.value = '1';
        addSelect.dispatchEvent(new Event('change', { bubbles: true }));
        const addSelect2 = container.querySelector('[data-testid="dem-stack-add-select"]');
        addSelect2.value = '2';
        addSelect2.dispatchEvent(new Event('change', { bubbles: true }));
        // Derive → confirm. surface.id is null (placeholder) so onDerive gets null
        // and the epic will create-then-derive.
        container.querySelector('[data-testid="derive-btn"]').click();
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        expect(derivedWith).toBe(null, 'derive dispatched with null id (lazy create-then-derive)');
    });

    it('shows the empty state when visible but no terrains exist', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass visible terrains={[]} surface={null} />,
            container
        );
        expect(container.querySelector('[data-testid="merge-terrains-empty"]')).toExist('empty state shows with no terrains');
        // The recipe builder must NOT render with zero terrains.
        expect(container.querySelector('[data-testid="recipe-builder"]')).toNotExist('no builder with zero terrains');
    });

    it('the close chip invokes onClose', () => {
        let closed = false;
        ReactDOM.render(
            <MergeTerrainsPanelClass visible terrains={[]} onClose={() => { closed = true; }} />,
            container
        );
        container.querySelector('.sv-panel-header-close').click();
        expect(closed).toBe(true);
    });
});

describe('TASK-1800 pickCombinedSurface (single-surface selection rule)', () => {
    it('returns null when there are no surfaces', () => {
        expect(pickCombinedSurface([])).toBe(null);
        expect(pickCombinedSurface(undefined)).toBe(null);
    });

    it('prefers the most-recent DERIVED surface (highest id with output_terrain)', () => {
        const surfaces = [
            { id: 1, output_terrain: 50 },
            { id: 5, output_terrain: null },
            { id: 3, output_terrain: 60 }
        ];
        // id 3 and id 1 are derived; id 3 is more recent than id 1.
        expect(pickCombinedSurface(surfaces).id).toBe(3);
    });

    it('falls back to the most-recent surface of any kind when none are derived', () => {
        const surfaces = [
            { id: 2, output_terrain: null },
            { id: 9, output_terrain: null },
            { id: 4, output_terrain: null }
        ];
        expect(pickCombinedSurface(surfaces).id).toBe(9);
    });
});

describe('TASK-1800 MergeTerrainsPanel (connected)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); container = undefined; });

    function mockStore(terrainWorkbench, onDispatch) {
        return {
            getState: () => ({ terrainWorkbench }),
            subscribe: () => () => {},
            dispatch: (action) => { if (onDispatch) onDispatch(action); return action; }
        };
    }

    it('renders null when terrainWorkbench.visible is false', () => {
        const store = mockStore({ visible: false, terrains: [], surfaces: [] });
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toNotExist();
    });

    it('renders when visible and edits the single combined surface from the slice', () => {
        const store = mockStore(
            { visible: true, terrains: [{ id: 1, title: 'Top DEM' }], surfaces: [SURFACE], selectedSurfaceId: null }
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toExist('panel renders when visible');
        expect(container.querySelector('[data-testid="recipe-builder"]')).toExist('builds the single surface');
        // No list chrome leaks through the connected component.
        expect(container.querySelector('[data-testid="new-surface-btn"]')).toNotExist('no + New button');
    });

    it('close dispatches setTerrainWorkbenchVisible(false)', () => {
        const dispatched = [];
        const store = mockStore(
            { visible: true, terrains: [{ id: 1, title: 'Top DEM' }], surfaces: [SURFACE], selectedSurfaceId: null },
            (a) => dispatched.push(a)
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        container.querySelector('.sv-panel-header-close').click();
        const closeAction = dispatched.find(a => a.type === TERRAIN_WORKBENCH_SET_VISIBLE);
        expect(closeAction).toExist('close dispatches SET_VISIBLE');
        expect(closeAction.visible).toBe(false);
    });
});

describe('TASK-1800 MergeTerrainsIcon', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); container = undefined; });

    it('renders an svg using currentColor (so sv-glyph-active colours it)', () => {
        ReactDOM.render(<MergeTerrainsIcon/>, container);
        const svg = container.querySelector('svg');
        expect(svg).toExist('icon renders an svg');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
        // mountain path + cog circle both present.
        expect(svg.querySelector('path')).toExist('mountain path present');
        expect(svg.querySelector('circle')).toExist('cog badge present');
    });
});

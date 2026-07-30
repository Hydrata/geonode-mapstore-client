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
import {
    TERRAIN_WORKBENCH_SET_VISIBLE,
    // TASK-2582 (W2a) — Merge extent draw lifecycle.
    TW_SET_MERGE_EXTENT_DRAWING,
    TW_SET_MERGE_EXTENT
} from '../../actionsTerrainWorkbench';

const SURFACE = {
    id: 7,
    title: 'Surface A',
    inputs_ordered: [],
    feather_width_m: 10,
    target_resolution_m: 1
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

// TASK-2582 (W2a) — Merge extent draw lifecycle wired through the connected
// component: mapStateToProps reads terrainWorkbench.mergeExtent/mergeExtentDrawing;
// mapDispatchToProps' onStartMergeExtentDraw/onCancelMergeExtentDraw/onClearMergeExtent
// dispatch the owner-isolated ('merge-extent') draw actions, mirroring
// terrainBboxPanel.js's direct-dispatch handleDrawClick/handleCancel pattern.
describe('TASK-2582 MergeTerrainsPanel (connected) — Merge extent draw lifecycle', () => {
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

    it('"Set extent" dispatches CHANGE_DRAWING_STATUS start (owner=merge-extent) + TW_SET_MERGE_EXTENT_DRAWING(true)', () => {
        const dispatched = [];
        const store = mockStore(
            { visible: true, terrains: [{ id: 1, title: 'Top DEM' }], surfaces: [SURFACE], selectedSurfaceId: null, mergeExtent: null, mergeExtentDrawing: false },
            (a) => dispatched.push(a)
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        container.querySelector('[data-testid="merge-extent-set-btn"]').click();

        const drawStart = dispatched.find(a => a.type === 'CHANGE_DRAWING_STATUS');
        expect(drawStart).toExist('changeDrawingStatus dispatched');
        expect(drawStart.status).toBe('start');
        expect(drawStart.owner).toBe('merge-extent');

        const drawingFlag = dispatched.find(a => a.type === TW_SET_MERGE_EXTENT_DRAWING);
        expect(drawingFlag).toExist();
        expect(drawingFlag.active).toBe(true);
    });

    it('Cancel (mid-draw) resets the draw interaction THEN clears the drawing flag — no draw-state leak', () => {
        const dispatched = [];
        const store = mockStore(
            { visible: true, terrains: [{ id: 1, title: 'Top DEM' }], surfaces: [SURFACE], selectedSurfaceId: null, mergeExtent: null, mergeExtentDrawing: true },
            (a) => dispatched.push(a)
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        // While drawing, the button reads Cancel.
        container.querySelector('[data-testid="merge-extent-set-btn"]').click();

        expect(dispatched.length).toBeGreaterThan(1);
        // Reset FIRST (terrainBboxEpic.js precedent: draw cleanup before the flag flips).
        expect(dispatched[0].type).toBe('CHANGE_DRAWING_STATUS');
        expect(dispatched[0].status).toBe('clean');
        expect(dispatched[0].owner).toBe('merge-extent');
        expect(dispatched[1].type).toBe(TW_SET_MERGE_EXTENT_DRAWING);
        expect(dispatched[1].active).toBe(false);
    });

    it('Clear dispatches TW_SET_MERGE_EXTENT(null) — back to the full union', () => {
        const dispatched = [];
        const store = mockStore(
            {
                visible: true,
                terrains: [{ id: 1, title: 'Top DEM' }],
                surfaces: [SURFACE],
                selectedSurfaceId: null,
                mergeExtent: [140.0, -35.0, 140.5, -34.5],
                mergeExtentDrawing: false
            },
            (a) => dispatched.push(a)
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        container.querySelector('[data-testid="merge-extent-clear-btn"]').click();

        const clearAction = dispatched.find(a => a.type === TW_SET_MERGE_EXTENT);
        expect(clearAction).toExist();
        expect(clearAction.extent).toBe(null);
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

// TASK-2235 — the Combined-surface panel rides the MovablePanel primitive
// (replacing the PanelShell fixed shell): drag by header, corner resize,
// position/size persisted per panelId 'mergeTerrains'.
describe('TASK-2235 MergeTerrainsPanel — movable', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); container = undefined; });

    const renderPanel = (props = {}) => ReactDOM.render(
        <MergeTerrainsPanelClass
            visible
            terrains={[{ id: 1, title: 'Top DEM' }]}
            surface={SURFACE}
            onClose={() => {}}
            {...props}
        />,
        container
    );

    it('renders inside a MovablePanel; body testid + close chip intact', () => {
        renderPanel();
        const panel = container.querySelector('[data-testid="movable-panel-mergeTerrains"]');
        expect(panel).toExist('movable shell renders');
        expect(panel.className).toInclude('sv-merge-terrains-panel');
        expect(panel.querySelector('.sv-movable-panel-header')).toExist('drag header renders');
        expect(panel.querySelector('[data-testid="merge-terrains-panel"]')).toExist('panel body intact');
        expect(panel.querySelector('.sv-panel-header-close')).toExist('close chip intact');
    });

    it('applies a persisted position + size from panelState', () => {
        renderPanel({ panelState: { position: { x: 17, y: 28 }, size: { width: 640 } } });
        const panel = container.querySelector('[data-testid="movable-panel-mergeTerrains"]');
        expect(panel.style.transform).toInclude('17px');
        expect(panel.style.transform).toInclude('28px');
        expect(panel.style.width).toBe('640px');
    });

    it('drag-end persists via onPanelStateChange keyed by mergeTerrains', () => {
        const calls = [];
        renderPanel({ onPanelStateChange: (panelId, patch) => calls.push([panelId, patch]) });
        const header = container.querySelector('[data-testid="movable-panel-mergeTerrains"] .sv-movable-panel-header');
        header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 80, clientY: 90 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 80, clientY: 90 }));
        expect(calls.length).toBeGreaterThan(0, 'onPanelStateChange fired');
        const [panelId, patch] = calls[calls.length - 1];
        expect(panelId).toBe('mergeTerrains');
        expect(patch.position).toExist();
    });
});

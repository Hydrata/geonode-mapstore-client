/**
 * TASK-1800 (W1.9 UAT) — stand-alone "Merge terrains" side panel.
 *
 * The Analysis-Surface recipe builder moved OUT of the inline expandable section
 * in Inputs->Terrain into this stand-alone dark-glass side panel. These specs
 * pin:
 *   - self-gating on terrainWorkbench.visible (null when hidden, renders when shown)
 *   - the recipe builder (surface list + TWRecipeBuilder) renders inside the panel
 *   - the empty state ("Add a terrain first") shows when there are no terrains
 *   - the connected component reads `visible` from the terrainWorkbench slice and
 *     the close chip dispatches setTerrainWorkbenchVisible(false)
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { MergeTerrainsPanel, MergeTerrainsPanelClass, MergeTerrainsIcon } from '../MergeTerrainsPanel';
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

    it('renders the panel shell + recipe builder when visible with terrains + a selected surface', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass
                visible
                terrains={[{ id: 1, title: 'Top DEM' }, { id: 2, title: 'Base DEM' }]}
                surfaces={[SURFACE]}
                selectedSurfaceId={7}
                onClose={() => {}}
                onSelectSurface={() => {}}
                onCreateSurface={() => {}}
                onUpdateSurface={() => {}}
                onDeleteSurface={() => {}}
                onDerive={() => {}}
            />,
            container
        );
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toExist('panel body renders');
        // The recipe builder + surface list render inside.
        expect(container.querySelector('[data-testid="recipe-builder"]')).toExist('TWRecipeBuilder renders');
        expect(container.querySelector('[data-testid="new-surface-btn"]')).toExist('TWSurfaceList renders');
        // PanelHeader close chip is present.
        expect(container.querySelector('.sv-panel-header-close')).toExist('close chip renders');
    });

    it('shows the empty state when visible but no terrains exist', () => {
        ReactDOM.render(
            <MergeTerrainsPanelClass visible terrains={[]} surfaces={[]} />,
            container
        );
        expect(container.querySelector('[data-testid="merge-terrains-empty"]')).toExist('empty state shows with no terrains');
        // The recipe builder must NOT render with zero terrains.
        expect(container.querySelector('[data-testid="new-surface-btn"]')).toNotExist('no surface list with zero terrains');
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

    it('renders when terrainWorkbench.visible is true and close dispatches setTerrainWorkbenchVisible(false)', () => {
        const dispatched = [];
        const store = mockStore(
            { visible: true, terrains: [{ id: 1, title: 'Top DEM' }], surfaces: [SURFACE], selectedSurfaceId: 7 },
            (a) => dispatched.push(a)
        );
        ReactDOM.render(<Provider store={store}><MergeTerrainsPanel/></Provider>, container);
        expect(container.querySelector('[data-testid="merge-terrains-panel"]')).toExist('panel renders when visible');

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

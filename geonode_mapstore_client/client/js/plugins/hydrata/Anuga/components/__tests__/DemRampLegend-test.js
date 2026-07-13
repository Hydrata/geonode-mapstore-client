/*
 * TASK-1850 (epic 1814 W2) — DemRampLegend component spec.
 *
 * Asserts:
 *   - renders 11 swatches (one per fixed ramp colour),
 *   - elevation labels track the LIVE stops parsed from demLayer.params.env,
 *   - falls back to the terrain row's stored dem_elev_min/max when no live env,
 *   - shows the "full range" indicator when degraded (PART A) OR on the stored
 *     fallback range.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

import {
    DemRampLegendComponent,
    resolveLegendStops,
    FloatingDemLegendPanelComponent,
    DEM_LEGEND_PANEL_ID
} from '../DemRampLegend';
import {
    buildEnvString
} from '../../epics/demRescaleEpic';
import { computeDemRampStops } from '../../utils/demRamp';
import uiReducer from '../../reducers/uiReducer';
import { setMovablePanelState, setDemLegendPanel } from '../../actions/uiActions';
import { updateTerrainRow } from '../../actions/dataActions';

describe('DemRampLegend — TASK-1850', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const liveEnv = buildEnvString(computeDemRampStops(200, 400));

    it('renders 11 swatches', () => {
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded={false} />,
            container
        );
        const swatches = container.querySelectorAll('.sv-dem-legend-swatch');
        expect(swatches.length).toBe(11);
        const rows = container.querySelectorAll('.sv-dem-legend-row');
        expect(rows.length).toBe(11);
    });

    it('labels track the LIVE stops from demLayer.params.env', () => {
        // computeDemRampStops(200,400): min snaps to 200, max to 400, step 20 →
        // top stop (elevMax) = 400, bottom (elevMin) = 200.
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded={false} />,
            container
        );
        const labels = Array.from(container.querySelectorAll('.sv-dem-legend-label')).map(n => n.textContent);
        // Rendered high->low, so the FIRST label is elevMax (400), the LAST is elevMin (200).
        expect(labels[0]).toBe('400');
        expect(labels[labels.length - 1]).toBe('200');
        // No full-range badge when we have live stops and not degraded.
        expect(container.querySelector('.sv-dem-legend-fullrange')).toNotExist();
    });

    it('falls back to stored dem_elev_min/max when no live env, and shows full-range', () => {
        const demLayer = { id: 'l1', params: {} }; // no env yet
        const terrainModel = { dem_elev_min: 100, dem_elev_max: 300 };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={terrainModel} degraded={false} />,
            container
        );
        const labels = Array.from(container.querySelectorAll('.sv-dem-legend-label')).map(n => n.textContent);
        expect(labels[0]).toBe('300');           // elevMax (stored)
        expect(labels[labels.length - 1]).toBe('100'); // elevMin (stored)
        // Stored (whole-raster) range → full-range indicator shown.
        expect(container.querySelector('.sv-dem-legend-fullrange')).toExist();
    });

    it('shows the full-range indicator when degraded even with a live env present', () => {
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded />,
            container
        );
        expect(container.querySelector('.sv-dem-legend-fullrange')).toExist();
        expect(container.querySelector('[data-testid="dem-ramp-legend-fullrange"]').textContent).toBe('full range');
    });

    describe('resolveLegendStops (precedence)', () => {
        it('prefers the live env over the stored range', () => {
            const demLayer = { params: { env: liveEnv } };
            const { stops, source } = resolveLegendStops(demLayer, { dem_elev_min: 0, dem_elev_max: 50 });
            expect(source).toBe('live');
            expect(stops.elevMax).toBe(400);
        });
        it('falls back to stored when env absent', () => {
            const { stops, source } = resolveLegendStops({ params: {} }, { dem_elev_min: 100, dem_elev_max: 300 });
            expect(source).toBe('stored');
            expect(stops.elevMin).toBe(100);
        });
        it('returns source=none when neither is available', () => {
            const { source } = resolveLegendStops({ params: {} }, {});
            expect(source).toBe('none');
        });
    });
});

/*
 * TASK-2233 — the legend floats OUT of the Terrain panel as a stand-alone
 * MovablePanel mounted at anugaContainer level. Content contract (swatches,
 * stops, degraded badge) is unchanged and stays pinned by the suite above.
 */
describe('DemRampLegend floating panel — TASK-2233', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const liveEnv = buildEnvString(computeDemRampStops(200, 400));
    const pair = {
        layer: { id: 'layer1', params: { env: liveEnv } },
        terrain: { id: 7, title: 'Grand Canyon', styling_mode: 'dynamic' }
    };

    const render = (props = {}) => {
        ReactDOM.render(
            <FloatingDemLegendPanelComponent
                pair={pair}
                closed={false}
                degraded={false}
                onClose={() => {}}
                onPanelStateChange={() => {}}
                {...props}
            />,
            container
        );
    };

    it('renders null when there is no dynamic-mode DEM pair', () => {
        render({ pair: null });
        expect(container.querySelector('.sv-movable-panel')).toNotExist();
    });

    it('renders null when the user closed the panel', () => {
        render({ closed: true });
        expect(container.querySelector('.sv-movable-panel')).toNotExist();
    });

    it('renders the unchanged legend content inside a floating MovablePanel', () => {
        render();
        const panel = container.querySelector('.sv-movable-panel');
        expect(panel).toExist();
        // the legend content contract is intact inside the new mount
        expect(container.querySelectorAll('.sv-dem-legend-swatch').length).toBe(11);
        // titled by the terrain so the user knows which DEM it describes
        expect(container.querySelector('.sv-panel-header-title').textContent).toInclude('Grand Canyon');
    });

    it('applies the persisted position from panelState (in-session persistence)', () => {
        render({ panelState: { position: { x: 11, y: 22 } } });
        const panel = container.querySelector('.sv-movable-panel');
        expect(panel.style.transform).toInclude('11px');
        expect(panel.style.transform).toInclude('22px');
    });

    it('close chip dispatches onClose', () => {
        const onClose = expect.createSpy();
        render({ onClose });
        container.querySelector('.sv-panel-header-close').click();
        expect(onClose).toHaveBeenCalled();
    });

    it('drag-end persists the position via onPanelStateChange keyed by panel id', () => {
        const onPanelStateChange = expect.createSpy();
        render({ onPanelStateChange });
        const header = container.querySelector('.sv-movable-panel-header');
        header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 80, clientY: 90 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 80, clientY: 90 }));
        expect(onPanelStateChange).toHaveBeenCalled();
        const [panelId, patch] = onPanelStateChange.calls[onPanelStateChange.calls.length - 1].arguments;
        expect(panelId).toBe(DEM_LEGEND_PANEL_ID);
        expect(patch.position).toExist();
    });

    describe('ui reducer contract (visibility + per-panel persistence)', () => {
        it('defaults to not-closed with an empty movablePanels map', () => {
            const state = uiReducer(undefined, { type: '@@INIT' });
            expect(state.demLegendPanelClosed).toBe(false);
            expect(state.movablePanels).toEqual({});
        });

        it('setDemLegendPanel(false) marks the legend closed; (true) re-shows it', () => {
            let state = uiReducer(undefined, setDemLegendPanel(false));
            expect(state.demLegendPanelClosed).toBe(true);
            state = uiReducer(state, setDemLegendPanel(true));
            expect(state.demLegendPanelClosed).toBe(false);
        });

        it('re-entering dynamic styling mode re-shows a closed legend (AC2)', () => {
            let state = uiReducer(undefined, setDemLegendPanel(false));
            expect(state.demLegendPanelClosed).toBe(true);
            // switching a terrain back to dynamic clears the closed flag...
            state = uiReducer(state, updateTerrainRow(7, { styling_mode: 'dynamic' }));
            expect(state.demLegendPanelClosed).toBe(false);
            // ...but a traditional switch (or unrelated row update) does not
            state = uiReducer(state, setDemLegendPanel(false));
            state = uiReducer(state, updateTerrainRow(7, { styling_mode: 'traditional' }));
            expect(state.demLegendPanelClosed).toBe(true);
        });

        it('setMovablePanelState merges position and size per panel id', () => {
            let state = uiReducer(undefined, setMovablePanelState('demRampLegend', { position: { x: 1, y: 2 } }));
            state = uiReducer(state, setMovablePanelState('demRampLegend', { size: { width: 300, height: 400 } }));
            expect(state.movablePanels.demRampLegend).toEqual({
                position: { x: 1, y: 2 },
                size: { width: 300, height: 400 }
            });
            // a second panel id gets its own independent entry
            state = uiReducer(state, setMovablePanelState('other', { position: { x: 9, y: 9 } }));
            expect(state.movablePanels.demRampLegend.position).toEqual({ x: 1, y: 2 });
            expect(state.movablePanels.other.position).toEqual({ x: 9, y: 9 });
        });
    });
});

/**
 * TASK-1861 (epic 1814 W4.4) — TerrainProfilePanel spec.
 *
 * Covers the pure chart-data builder + the panel's gating render:
 *   - buildPlotlyData maps samples+traces to one trace per present raster,
 *     drops an all-null trace, preserves the distance x-axis.
 *   - the panel renders nothing when hidden.
 *   - with no DEM ready it shows the "no terrain" hint and NO draw button (AC-5).
 *   - with a DEM ready it shows the draw button.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';

import { TerrainProfilePanelClass, buildPlotlyData } from '../components/TerrainProfilePanel';

describe('TerrainProfilePanel — buildPlotlyData (TASK-1861)', () => {
    const samples = [
        { distance_m: 0, dem: 100, depth: 0.5 },
        { distance_m: 25, dem: 98, depth: 1.0 },
        { distance_m: 50, dem: 96, depth: null }
    ];
    const traces = [
        { key: 'dem', label: 'Elevation' },
        { key: 'depth', label: 'Depth (max)' }
    ];

    it('builds one Plotly trace per present raster key', () => {
        const data = buildPlotlyData(samples, traces);
        expect(data.length).toBe(2);
        expect(data[0].name).toBe('Elevation');
        expect(data[0].x).toEqual([0, 25, 50]);
        expect(data[0].y).toEqual([100, 98, 96]);
        // null sample is preserved as a gap (connectgaps:false), not coerced.
        expect(data[1].y).toEqual([0.5, 1.0, null]);
        expect(data[1].mode).toBe('lines');
    });

    it('drops a trace whose every value is null (raster not produced)', () => {
        const allNull = [
            { distance_m: 0, dem: 100, velocity: null },
            { distance_m: 25, dem: 98, velocity: null }
        ];
        const t = [{ key: 'dem', label: 'Elevation' }, { key: 'velocity', label: 'Velocity (max)' }];
        const data = buildPlotlyData(allNull, t);
        expect(data.length).toBe(1);
        expect(data[0].name).toBe('Elevation');
    });

    it('returns [] for empty/invalid input', () => {
        expect(buildPlotlyData(null, traces)).toEqual([]);
        expect(buildPlotlyData([], traces)).toEqual([]);
        expect(buildPlotlyData(samples, null)).toEqual([]);
    });
});

describe('TerrainProfilePanel — render gating (TASK-1861)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });

    const noop = () => {};

    it('renders nothing when not visible', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible={false} demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        expect(container.querySelector('[data-testid="profile-panel"]')).toBe(null);
    });

    it('AC-5: with no DEM ready shows the no-terrain hint and NO draw button', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady={false} setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        expect(container.querySelector('[data-testid="profile-panel"]')).toExist();
        expect(container.querySelector('[data-testid="profile-no-terrain"]')).toExist();
        expect(container.querySelector('[data-testid="profile-draw-button"]')).toBe(null);
    });

    it('with a DEM ready shows the draw button', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        expect(container.querySelector('[data-testid="profile-draw-button"]')).toExist();
        expect(container.querySelector('[data-testid="profile-no-terrain"]')).toBe(null);
    });

    it('renders the chart when samples are present', () => {
        const samples = [{ distance_m: 0, dem: 100 }, { distance_m: 10, dem: 99 }];
        const traces = [{ key: 'dem', label: 'Elevation' }];
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady samples={samples} traces={traces}
                setProfilePanelVisible={noop} startProfileDraw={noop}
            />,
            container
        );
        expect(container.querySelector('[data-testid="profile-chart"]')).toExist();
    });
});

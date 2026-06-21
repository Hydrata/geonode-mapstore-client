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

import { TerrainProfilePanelClass, buildPlotlyData, computeYRange } from '../components/TerrainProfilePanel';

describe('TerrainProfilePanel — computeYRange (W4 UAT, TASK-1861/1862)', () => {
    it('frames high-elevation terrain so the range EXCLUDES 0 (no zero baseline)', () => {
        // Terrain at ~800..985m: the y-range must hug the data, never reach 0.
        const data = [{ y: [800, 905, 985, 842, 933] }];
        const range = computeYRange(data);
        expect(range).toExist();
        const [lo, hi] = range;
        expect(lo).toBeGreaterThan(0);
        // tight framing: lo just below the min, hi just above the max.
        expect(lo).toBeLessThan(800);
        expect(hi).toBeGreaterThan(985);
        // span 185 -> pad ~9.25 each side.
        expect(lo).toBeGreaterThan(780);
        expect(hi).toBeLessThan(1005);
    });

    it('spans across multiple traces (cross-section terrain + stage)', () => {
        const data = [{ y: [810, 805, 800] }, { y: [811, 990, null] }];
        const range = computeYRange(data);
        expect(range[0]).toBeGreaterThan(0);
        expect(range[0]).toBeLessThan(800);
        expect(range[1]).toBeGreaterThan(990);
    });

    it('applies a small floor pad for a flat profile (no zero-height axis)', () => {
        const data = [{ y: [500, 500, 500] }];
        const [lo, hi] = computeYRange(data);
        expect(hi - lo).toBeGreaterThan(0);
        expect(lo).toBeGreaterThan(0);
    });

    it('returns null when nothing finite to frame (caller -> autorange)', () => {
        expect(computeYRange(null)).toBe(null);
        expect(computeYRange([])).toBe(null);
        expect(computeYRange([{ y: [null, null] }])).toBe(null);
        expect(computeYRange([{ y: [NaN, Infinity] }])).toBe(null);
    });
});

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

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

import {
    TerrainProfilePanelClass,
    buildPlotlyData,
    buildCrossSectionData,
    buildProfileLayout,
    computeYRange
} from '../components/TerrainProfilePanel';

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

describe('TerrainProfilePanel — dual y-axis (W4 UAT, TASK-1861/1862)', () => {
    // The real profile flow: elevation (role 'dem', 800..985) + depth (role
    // 'depth', 0..20) + velocity (role 'other', small) on ONE chart.
    const samples = [
        { distance_m: 0, dem: 800, depth: 0, velocity: 0 },
        { distance_m: 25, dem: 905, depth: 12, velocity: 3 },
        { distance_m: 50, dem: 985, depth: 20, velocity: 5 },
        { distance_m: 75, dem: 842, depth: 4, velocity: 1 }
    ];
    const traces = [
        { key: 'dem', label: 'Elevation', role: 'dem' },
        { key: 'depth', label: 'Depth (max)', role: 'depth' },
        { key: 'velocity', label: 'Velocity (max)', role: 'other' }
    ];

    it('assigns the elevation trace to yaxis y and result traces to y2 by role', () => {
        const data = buildPlotlyData(samples, traces);
        expect(data.length).toBe(3);
        const dem = data.find(d => d.name === 'Elevation');
        const depth = data.find(d => d.name === 'Depth (max)');
        const velocity = data.find(d => d.name === 'Velocity (max)');
        expect(dem.yaxis).toBe('y');
        expect(depth.yaxis).toBe('y2');
        expect(velocity.yaxis).toBe('y2');
    });

    it('a trace with no role defaults to the primary elevation axis y', () => {
        const data = buildPlotlyData(samples, [{ key: 'dem', label: 'Elevation' }]);
        expect(data[0].yaxis).toBe('y');
    });

    it('LEFT axis frames elevation relief (range excludes 0); RIGHT axis starts at 0', () => {
        const data = buildPlotlyData(samples, traces);
        const layout = buildProfileLayout(data);
        // Primary (left) = elevation: range hugs 800..985, never reaches 0.
        expect(layout.yaxis.range).toExist();
        expect(layout.yaxis.range[0]).toBeGreaterThan(0);
        expect(layout.yaxis.range[0]).toBeLessThan(800);
        expect(layout.yaxis.range[1]).toBeGreaterThan(985);
        expect(layout.yaxis.autorange).toBe(false);
        expect(layout.yaxis.title).toBe('Elevation (m)');
        // Secondary (right) = results: starts AT 0 (0 depth = dry is meaningful).
        expect(layout.yaxis2).toExist();
        expect(layout.yaxis2.range[0]).toBe(0);
        expect(layout.yaxis2.range[1]).toBeGreaterThan(20);
        expect(layout.yaxis2.overlaying).toBe('y');
        expect(layout.yaxis2.side).toBe('right');
        // No double gridlines on the overlay axis.
        expect(layout.yaxis2.showgrid).toBe(false);
    });

    it('elevation-only -> single axis framed to relief, NO empty y2', () => {
        const data = buildPlotlyData(
            [{ distance_m: 0, dem: 800 }, { distance_m: 50, dem: 985 }],
            [{ key: 'dem', label: 'Elevation', role: 'dem' }]
        );
        const layout = buildProfileLayout(data);
        expect(layout.yaxis2).toBe(undefined);
        expect(layout.yaxis.range[0]).toBeGreaterThan(0);
        expect(layout.yaxis.range[0]).toBeLessThan(800);
        expect(layout.yaxis.range[1]).toBeGreaterThan(985);
        expect(layout.yaxis.title).toBe('Elevation (m)');
    });

    it('results-only (no dem) -> single axis framed from 0', () => {
        const data = buildPlotlyData(
            [{ distance_m: 0, depth: 2 }, { distance_m: 50, depth: 20 }],
            [{ key: 'depth', label: 'Depth (max)', role: 'depth' }]
        );
        const layout = buildProfileLayout(data);
        expect(layout.yaxis2).toBe(undefined);
        expect(layout.yaxis.range[0]).toBe(0);
        expect(layout.yaxis.range[1]).toBeGreaterThan(20);
    });

    it('computeYRange honours a filter + zeroBased option', () => {
        const data = [
            { y: [800, 985], yaxis: 'y' },
            { y: [0, 20], yaxis: 'y2' }
        ];
        const elev = computeYRange(data, { filter: t => t.yaxis !== 'y2' });
        expect(elev[0]).toBeGreaterThan(0);
        expect(elev[0]).toBeLessThan(800);
        const result = computeYRange(data, { filter: t => t.yaxis === 'y2', zeroBased: true });
        expect(result[0]).toBe(0);
        expect(result[1]).toBeGreaterThan(20);
    });
});

describe('TerrainProfilePanel — cross-section UNCHANGED (W4.5)', () => {
    // Cross-section terrain + stage are BOTH elevation magnitude: single axis
    // framed to relief, no role-based y2 split. (Must not regress.)
    const samples = [
        { distance_m: 0, dem: 810, depth: 0 },
        { distance_m: 25, dem: 805, depth: 6 },
        { distance_m: 50, dem: 800, depth: 0 }
    ];
    const traces = [
        { key: 'dem', label: 'Elevation', role: 'dem' },
        { key: 'depth', label: 'Depth (max)', role: 'depth' }
    ];

    it('builds terrain (tozeroy) + water-surface (tonexty) on a SINGLE axis', () => {
        const data = buildCrossSectionData(samples, traces);
        expect(data.length).toBe(2);
        expect(data[0].fill).toBe('tozeroy');
        expect(data[1].fill).toBe('tonexty');
        // No dual-axis assignment leaked into cross-section traces.
        expect(data[0].yaxis).toBe(undefined);
        expect(data[1].yaxis).toBe(undefined);
        // stage = bed + depth.
        expect(data[1].y).toEqual([810, 811, 800]);
        // Single-axis range still frames to relief (excludes 0).
        const range = computeYRange(data);
        expect(range[0]).toBeGreaterThan(0);
        expect(range[0]).toBeLessThan(800);
        expect(range[1]).toBeGreaterThan(811);
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

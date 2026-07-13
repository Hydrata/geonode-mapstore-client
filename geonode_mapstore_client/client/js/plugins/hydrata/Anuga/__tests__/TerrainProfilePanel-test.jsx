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
    buildCrossSectionData,
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

describe('TerrainProfilePanel — cross-section (W4.5; TASK-2255 reworked stage sampling)', () => {
    // Cross-section terrain + stage are BOTH elevation magnitude: single axis
    // framed to relief, no role-based y2 split. (Must not regress.) Stage is
    // now the PUBLISHED value sampled directly (TASK-2255) — never bed+depth.
    const samples = [
        { distance_m: 0, dem: 810, stage: 810 },
        { distance_m: 25, dem: 805, stage: 811 },
        { distance_m: 50, dem: 800, stage: 800 }
    ];
    const traces = [
        { key: 'dem', label: 'Elevation', role: 'dem' },
        { key: 'stage', label: 'Water surface', role: 'stage' }
    ];

    it('builds terrain (tozeroy) + water-surface (tonexty) on a SINGLE axis', () => {
        const data = buildCrossSectionData(samples, traces);
        expect(data.length).toBe(2);
        expect(data[0].fill).toBe('tozeroy');
        expect(data[1].fill).toBe('tonexty');
        // No dual-axis assignment leaked into cross-section traces.
        expect(data[0].yaxis).toBe(undefined);
        expect(data[1].yaxis).toBe(undefined);
        // stage = the raw published value, sampled directly (never bed+depth).
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
        // TASK-2253 — the panel is cross-section-only now: buildCrossSectionData
        // finds the bed trace by role==='dem' (getProfileTraces always tags it).
        const samples = [{ distance_m: 0, dem: 100 }, { distance_m: 10, dem: 99 }];
        const traces = [{ key: 'dem', label: 'Elevation', role: 'dem' }];
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

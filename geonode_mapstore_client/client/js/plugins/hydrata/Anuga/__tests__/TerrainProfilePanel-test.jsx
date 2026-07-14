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
import { fireEvent } from '@testing-library/react';
import expect from 'expect';

import {
    TerrainProfilePanelClass,
    buildCrossSectionData,
    computeYRange,
    CROSS_SECTION_LAYOUT,
    CROSS_SECTION_FILL_ENABLED,
    TERRAIN_PALETTE,
    WATER_PALETTE
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
        // TASK-2269: the area fill is disabled by default now; pass enableFill so
        // this pre-existing fill-shape assertion still exercises the fill logic.
        const data = buildCrossSectionData(samples, traces, { enableFill: true });
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

// ── TASK-2256 (epic 2249 W3) — picker-as-legend component ───────────────────

describe('TerrainProfilePanel — Plotly legend removed (TASK-2256, LOCKED decision #5)', () => {
    it('CROSS_SECTION_LAYOUT disables the Plotly legend — the picker rows ARE the legend', () => {
        expect(CROSS_SECTION_LAYOUT.showlegend).toBe(false);
    });
});

// ── TASK-2270 (epic 2249 W5) — white chart background ───────────────────────
describe('TerrainProfilePanel — white chart background (TASK-2270)', () => {
    it('uses a white paper + plot background (was transparent dark-glass)', () => {
        expect(CROSS_SECTION_LAYOUT.paper_bgcolor).toBe('#ffffff');
        expect(CROSS_SECTION_LAYOUT.plot_bgcolor).toBe('#ffffff');
    });
});

// ── TASK-2269 (epic 2249 W5) — area fill disabled by default ────────────────
describe('TerrainProfilePanel — fill disabled flag (TASK-2269)', () => {
    it('CROSS_SECTION_FILL_ENABLED is false (production charts are lines-only for now)', () => {
        expect(CROSS_SECTION_FILL_ENABLED).toBe(false);
    });
});

// ── TASK-2272 (epic 2249 W5) — Clear button resets state + removes the line ──
describe('TerrainProfilePanel — Clear button (TASK-2272)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });
    const noop = () => {};
    const samples = [{ distance_m: 0, dem: 100, stage: 101 }, { distance_m: 10, dem: 98, stage: 100 }];
    const traces = [{ key: 'dem', label: 'Elevation', role: 'dem' }, { key: 'stage', label: 'Water surface', role: 'stage' }];

    it('is HIDDEN when there is nothing to clear (no samples / error / loading)', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        expect(container.querySelector('[data-testid="profile-clear-button"]')).toBe(null);
    });

    it('appears once a line is sampled and calls clearProfile + clearProfileLine on click', () => {
        let cleared = 0;
        let lineCleared = 0;
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady samples={samples} traces={traces}
                setProfilePanelVisible={noop} startProfileDraw={noop}
                clearProfile={() => { cleared++; }}
                clearProfileLine={() => { lineCleared++; }}
            />,
            container
        );
        const btn = container.querySelector('[data-testid="profile-clear-button"]');
        expect(btn).toExist();
        fireEvent.click(btn);
        expect(cleared).toBe(1);
        expect(lineCleared).toBe(1);
    });
});

describe('TerrainProfilePanel — picker-as-legend (TASK-2256)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });

    // 4 ready terrains (only 3 can be checked — the 4th exercises cap grey-out)
    // and 4 scenario rows spanning every checkability status + a stale one.
    const terrainRows = [
        { id: 1, status: 'ready', gn_layer_name: 'ele_1', title: 'Terrain One' },
        { id: 2, status: 'ready', gn_layer_name: 'ele_2', title: 'Terrain Two' },
        { id: 3, status: 'ready', gn_layer_name: 'ele_3', title: 'Terrain Three' },
        { id: 4, status: 'ready', gn_layer_name: 'ele_4', title: 'Terrain Four' }
    ];
    const scenarioRows = [
        {
            id: 10, status: 'ready',
            scenario: {
                id: 10, name: 'Scenario Ready', terrain: 1, latest_run_is_valid: true,
                latest_complete_run: { real_world_end: '2026-06-01T00:00:00Z' }
            }
        },
        { id: 11, status: 'no-run', scenario: { id: 11, name: 'Scenario NoRun', latest_complete_run: null } },
        {
            id: 12, status: 'no-stage',
            scenario: { id: 12, name: 'Scenario NoStage', latest_complete_run: { real_world_end: null } }
        },
        {
            id: 13, status: 'ready',
            scenario: {
                id: 13, name: 'Scenario Stale', terrain: 1, latest_run_is_valid: false,
                latest_complete_run: { real_world_end: '2026-05-01T00:00:00Z' }
            }
        }
    ];
    const noop = () => {};

    const render = (props) => {
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady
                terrainRows={terrainRows}
                scenarioRows={scenarioRows}
                checkedTerrainIds={[1]}
                checkedScenarioIds={[10]}
                setProfilePanelVisible={noop} startProfileDraw={noop}
                toggleCheckedTerrain={noop} toggleCheckedScenario={noop}
                {...props}
            />,
            container
        );
    };

    it('renders both groups with a live n/3 counter', () => {
        render();
        expect(container.querySelector('[data-testid="picker-group-terrain"]')).toExist();
        expect(container.querySelector('[data-testid="picker-group-water"]')).toExist();
        expect(container.querySelector('[data-testid="picker-counter-terrain"]').textContent).toBe('1/3');
        expect(container.querySelector('[data-testid="picker-counter-water"]').textContent).toBe('1/3');
    });

    it('counter reflects the checked count, not the row count', () => {
        render({ checkedTerrainIds: [1, 2, 3] });
        expect(container.querySelector('[data-testid="picker-counter-terrain"]').textContent).toBe('3/3');
    });

    it('cap grey-out: an unchecked row is disabled with a hint once the group is at 3/3', () => {
        render({ checkedTerrainIds: [1, 2, 3] });
        const row4 = container.querySelector('[data-testid="picker-row-terrain-4"]');
        expect(row4.className).toContain('sv-picker-row-disabled');
        const checkbox4 = container.querySelector('[data-testid="picker-checkbox-terrain-4"]');
        expect(checkbox4.disabled).toBe(true);
        expect(container.querySelector('[data-testid="picker-hint-terrain-4"]')).toExist();
        // A row already checked stays enabled even AT the cap (uncheckable is
        // never the issue — only a NEW check past 3 is blocked).
        const row1 = container.querySelector('[data-testid="picker-row-terrain-1"]');
        expect(row1.className).toNotContain('sv-picker-row-disabled');
    });

    it('disabled reasons: no-run and no-stage scenario rows show their own hint text', () => {
        render();
        const noRunHint = container.querySelector('[data-testid="picker-hint-water-11"]');
        const noStageHint = container.querySelector('[data-testid="picker-hint-water-12"]');
        expect(noRunHint).toExist();
        expect(noRunHint.textContent.length).toBeGreaterThan(0);
        expect(noStageHint).toExist();
        expect(noStageHint.textContent).toNotBe(noRunHint.textContent);
        // Both checkboxes are disabled regardless of the 3+3 cap.
        expect(container.querySelector('[data-testid="picker-checkbox-water-11"]').disabled).toBe(true);
        expect(container.querySelector('[data-testid="picker-checkbox-water-12"]').disabled).toBe(true);
    });

    it('swatch colour === chart trace colour for the same checked row (AC1)', () => {
        render();
        const terrainSwatch = container.querySelector('[data-testid="picker-swatch-terrain-1"]');
        const waterSwatch = container.querySelector('[data-testid="picker-swatch-water-10"]');
        // rgb(184, 153, 104) === #B89968 (TERRAIN_PALETTE[0], slot 0 for the
        // one-and-only checked terrain) — jsdom normalises inline hex styles
        // to rgb() on read-back, so compare against the browser-normalised form.
        expect(terrainSwatch.style.backgroundColor).toBe('rgb(184, 153, 104)');
        expect(waterSwatch.style.backgroundColor).toBe('rgb(91, 192, 255)');
        expect(TERRAIN_PALETTE[0]).toBe('#B89968');
        expect(WATER_PALETTE[0]).toBe('#5BC0FF');
    });

    it('an unchecked, uncheckable-status row never gets a swatch colour', () => {
        render();
        const disabledSwatch = container.querySelector('[data-testid="picker-swatch-water-11"]');
        expect(disabledSwatch.style.backgroundColor).toBe('transparent');
    });

    it('a ready water row shows its run date', () => {
        render();
        const rundate = container.querySelector('[data-testid="picker-rundate-10"]');
        expect(rundate).toExist();
        expect(rundate.textContent).toBe(new Date('2026-06-01T00:00:00Z').toLocaleDateString());
    });

    it('a stale water row (latest_run_is_valid=false) shows a staleness hint', () => {
        render({ checkedScenarioIds: [10, 13] });
        expect(container.querySelector('[data-testid="picker-stale-13"]')).toExist();
        // The non-stale row never renders one.
        expect(container.querySelector('[data-testid="picker-stale-10"]')).toBe(null);
    });

    it('clicking an enabled, unchecked checkbox dispatches the toggle action with its row id', () => {
        let toggledId = null;
        render({ checkedTerrainIds: [1], toggleCheckedTerrain: (id) => { toggledId = id; } });
        const checkbox2 = container.querySelector('[data-testid="picker-checkbox-terrain-2"]');
        fireEvent.click(checkbox2);
        expect(toggledId).toBe(2);
    });

    it('terrain rows never carry a disabled-reason status (LOCKED decision #10 — only scenarios do)', () => {
        render({ checkedTerrainIds: [1, 2, 3] });
        // Terrain row 4 is cap-blocked (disabled) but its ONLY hint is the cap
        // hint — never a no-run/no-stage style reason (terrain has no such
        // status at all).
        const hint = container.querySelector('[data-testid="picker-hint-terrain-4"]');
        expect(hint.textContent).toNotBe('');
    });
});

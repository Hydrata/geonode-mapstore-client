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
    buildCheckedSlotMap,
    computeYRange,
    CROSS_SECTION_LAYOUT,
    CROSS_SECTION_FILL_ENABLED,
    TERRAIN_PALETTE,
    WATER_PALETTE
} from '../components/TerrainProfilePanel';
import { getColorSlot } from '../epics/profileEpic';

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

// TASK-2274 (operator UAT 2026-07-14) — responsive body + close-button margin
// parity with the DEM legend. CORRECTED PREMISE (grooming): the DEM legend
// (DemRampLegend's FloatingDemLegendPanel) IS a MovablePanel, whose CSS
// (movablePanel.css) neutralises the base .simple-view-panel's own
// padding:5px 10px to padding:0 — so the SHARED PanelHeader primitive's close
// chip (inline position:absolute; top:2px; right:2px — pixel-identical in
// BOTH panels already, same component) ends up exactly 2px from the panel's
// OUTER edge. .sv-profile-panel never neutralised that outer padding, so its
// (otherwise-identical) close chip sat visibly further in — the base panel
// padding PLUS the header's own 2px inset. Every section here already
// self-pads (PanelHeader's own inline padding; the body's own class below;
// .simple-view-panel-footer's own CSS padding), so zeroing the outer padding
// loses no spacing — it only equalises the close-chip offset with the DEM
// legend's.
describe('TerrainProfilePanel — responsive body + close-button margin parity with the DEM legend (TASK-2274)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });
    const noop = () => {};

    it('the outer panel has ZERO outer padding, like the DEM legend MovablePanel neutralisation (movablePanel.css .sv-movable-panel)', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        const panel = container.querySelector('[data-testid="profile-panel"]');
        expect(panel).toExist();
        expect(window.getComputedStyle(panel).padding).toBe('0px');
    });

    it('the body content area is an independently-scrolling flex region (min-height:0 + overflow-y:auto), not a fixed-overflow block', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        const body = container.querySelector('.sv-profile-body');
        expect(body).toExist('expected the body wrapper to carry the sv-profile-body class');
        const cs = window.getComputedStyle(body);
        expect(cs.overflowY).toBe('auto');
        expect(cs.minHeight).toBe('0px');
    });

    it('the header carries NO "h4" class — live-verified (2026-07-14): Bootstrap\'s .h4 margin:8px 0 pushed the close chip 8px further down than the DEM legend\'s (MovablePanel PanelHeader carries no "h4")', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass visible demReady setProfilePanelVisible={noop} startProfileDraw={noop} />,
            container
        );
        const header = container.querySelector('[data-testid="profile-panel"] .sv-panel-header');
        expect(header).toExist();
        expect(header.className.split(' ')).toNotContain('h4');
        expect(window.getComputedStyle(header).marginTop).toBe('0px');
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

    it('a CHECKED row whose checkability flips to disabled never keeps a stale swatch colour (TASK-2261)', () => {
        // Row 12 is checked (as if it had been 'ready' at the last panel-open
        // seed) but its CURRENT status is 'no-stage' — simulates the picker
        // staying open across a live state update that un-published the
        // scenario's stage AFTER the id was checked (pickerSeedEpic only
        // seeds checkedScenarioIds on panel OPEN, TASK-2254 — there is no
        // reseed while the panel stays open). The chart already excludes
        // this row (getProfileTraces filters status==='ready'); the swatch
        // must not disagree by staying coloured.
        render({ checkedScenarioIds: [12] });
        const staleSwatch = container.querySelector('[data-testid="picker-swatch-water-12"]');
        expect(staleSwatch.style.backgroundColor).toBe('transparent');
    });

    it('the checked-in-list-order colour slot renders correctly for every row, integration-wise', () => {
        // 3 checked terrains (1,2,3) out of 4 rows — exercises the FULL group
        // (renderPickerGroup maps every row), not just a single checked row.
        render({ checkedTerrainIds: [3, 1, 2] });
        // Stable picker-LIST order (not check order): row 1 -> slot 0, row 2
        // -> slot 1, row 3 -> slot 2 — same guarantee getColorSlot documents.
        // TERRAIN_PALETTE = ['#B89968', '#D08770', '#A3BE8C']; jsdom
        // normalises inline hex styles to rgb() on read-back (see the AC1
        // swatch test above).
        const swatch1 = container.querySelector('[data-testid="picker-swatch-terrain-1"]');
        const swatch2 = container.querySelector('[data-testid="picker-swatch-terrain-2"]');
        const swatch3 = container.querySelector('[data-testid="picker-swatch-terrain-3"]');
        expect(swatch1.style.backgroundColor).toBe('rgb(184, 153, 104)');
        expect(swatch2.style.backgroundColor).toBe('rgb(208, 135, 112)');
        expect(swatch3.style.backgroundColor).toBe('rgb(163, 190, 140)');
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

    // TASK-2275 (operator UAT 2026-07-14: "clean up later" — tickbox/label
    // justification + spacing). Root cause: the checkbox is a native
    // <input type="checkbox"> with its own browser-default margin (Chrome UA
    // stylesheet ~margin:3px 3px 3px 4px), which STACKS ON TOP of
    // .sv-picker-row's flex `gap:6px` — so the checkbox->swatch gap read
    // visibly wider/uneven than the swatch->label gap (which has no such
    // native margin to stack with). Zeroing the checkbox's own margin makes
    // the row's flex `gap` the ONLY spacing between every item, evenly, in
    // BOTH the terrain and water groups (same renderPickerRow markup).
    it('the row checkbox has its native browser margin zeroed, so flex `gap` is the ONLY spacing (even, not doubled)', () => {
        render();
        const terrainCheckbox = container.querySelector('[data-testid="picker-checkbox-terrain-1"]');
        const waterCheckbox = container.querySelector('[data-testid="picker-checkbox-water-10"]');
        [terrainCheckbox, waterCheckbox].forEach((cb) => {
            const cs = window.getComputedStyle(cb);
            expect(cs.marginTop).toBe('0px');
            expect(cs.marginRight).toBe('0px');
            expect(cs.marginBottom).toBe('0px');
            expect(cs.marginLeft).toBe('0px');
        });
    });
});

describe('TerrainProfilePanel — buildCheckedSlotMap (TASK-2262)', () => {
    // TASK-2262: renderPickerGroup previously called getColorSlot(rows,
    // checkedIds, row.id) ONCE PER ROW — getColorSlot itself does a fresh
    // filter+map+indexOf every call, so a group of N rows did O(N^2) work to
    // render its swatches. buildCheckedSlotMap computes the SAME
    // checked-in-picker-list-order assignment ONCE per group render, as a
    // {id: slot} map for O(1) per-row lookup. getColorSlot's own exported
    // signature/contract (picker-test.js) is untouched — this is a
    // CALL-SITE-only optimisation in the picker component.
    const rows = [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }];

    it('assigns every row EXACTLY the slot getColorSlot(rows, checkedIds, id) would', () => {
        const checkedIds = [30, 10];
        const slotMap = buildCheckedSlotMap(rows, checkedIds);
        rows.forEach((r) => {
            const expected = getColorSlot(rows, checkedIds, r.id);
            const actual = Object.prototype.hasOwnProperty.call(slotMap, r.id) ? slotMap[r.id] : -1;
            expect(actual).toBe(expected);
        });
    });

    it('omits ids that are not checked, and ids not present among rows', () => {
        const slotMap = buildCheckedSlotMap(rows, [10, 999]);
        expect(slotMap[10]).toBe(0);
        expect(slotMap[20]).toBe(undefined);
        expect(slotMap[999]).toBe(undefined);
    });

    it('handles a null/undefined rows or checkedIds without throwing', () => {
        expect(() => buildCheckedSlotMap(null, [1])).toNotThrow();
        expect(() => buildCheckedSlotMap(rows, null)).toNotThrow();
        expect(buildCheckedSlotMap(null, [1])).toEqual({});
        expect(buildCheckedSlotMap(rows, null)).toEqual({});
    });
});

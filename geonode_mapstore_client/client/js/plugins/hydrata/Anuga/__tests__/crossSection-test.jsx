/**
 * TASK-1862 (epic 1814 W4.5) — cross-section builder spec.
 * TASK-2253 (epic 2249 W2) — Profile mode DELETED; cross-section is the only
 * mode now, so the mode-toggle / profileMode reducer coverage was retired
 * (git history keeps it).
 * TASK-2255 (epic 2249 W2) — getProfileTraces now tags a trace per CHECKED
 * terrain (role='dem', keyed by its own bare layer name) and per CHECKED,
 * stage-published scenario (role='stage', keyed by its bare stage_max name).
 * The water surface is the PUBLISHED stage sampled DIRECTLY — buildCrossSection
 * Data no longer computes terrain+depth (LOCKED decision #3, AC4). This spec
 * pins the surviving net-new pieces:
 *
 *   - buildCrossSectionData(samples, traces) -> Plotly data for the combined
 *     terrain + water-surface chart: terrain as a FILLED area (elevation vs
 *     distance) and the water surface (the raw sampled stage value, already
 *     dry-masked upstream) overlaid as a second trace, filled down to the
 *     terrain so the water body reads.
 *   - the panel renders the cross-section chart unconditionally, with no mode
 *     toggle.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';

import {
    TerrainProfilePanelClass,
    buildCrossSectionData
} from '../components/TerrainProfilePanel';
import { getProfileTraces } from '../epics/profileEpic';

// A state with one checked terrain + one checked scenario carrying a
// published stage_max + depth_max (geonode:-prefixed names — the real
// serializer shape).
const makeState = () => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: {
            terrainLoaded: true,
            terrain: [{ id: 7, status: 'ready', gn_layer_name: 'ele_7_blue_mountains' }]
        },
        scenarios: {
            selectedId: 3,
            allIds: [3],
            byId: {
                3: {
                    id: 3,
                    selected: true,
                    // TASK-2078: getProfileTraces samples the latest COMPLETE run's
                    // published stage (a completed run is both latest_run and
                    // latest_complete_run when no newer run exists).
                    latest_complete_run: {
                        id: 99,
                        gn_layer_stage_max: { name: 'geonode:run_42_3_99_stage_max_cog' },
                        gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog' }
                    }
                }
            }
        },
        ui: { checkedTerrainIds: [7], checkedScenarioIds: [3] }
    },
    layers: { flat: [{ id: 'layer-dem-7', name: 'geonode:ele_7_blue_mountains', type: 'wms', group: 'Input Data.Terrain' }] }
});

describe('cross-section — getProfileTraces role tagging (TASK-1862, reworked TASK-2255)', () => {
    it('tags the checked terrain role=dem, keyed by its OWN bare layer name (never the literal "dem")', () => {
        const traces = getProfileTraces(makeState());
        const dem = traces.find(t => t.role === 'dem');
        expect(dem).toExist();
        expect(dem.key).toBe('ele_7_blue_mountains');
    });
    it('tags the checked scenario\'s published stage role=stage, with its depth_max as maskKey', () => {
        const traces = getProfileTraces(makeState());
        const stage = traces.find(t => t.role === 'stage');
        expect(stage).toExist();
        expect(stage.key).toBe('run_42_3_99_stage_max_cog');
        expect(stage.maskKey).toBe('run_42_3_99_depth_max_cog');
    });
});

describe('cross-section — buildCrossSectionData (TASK-1862, reworked TASK-2255: stage sampled directly)', () => {
    const traces = [
        { key: 'dem', label: 'Elevation', role: 'dem' },
        { key: 'stage', label: 'Water surface', role: 'stage' }
    ];

    it('renders terrain as a filled area and the published stage sampled directly (never bed+depth)', () => {
        const samples = [
            { distance_m: 0, dem: 100, stage: 100.5 },
            { distance_m: 25, dem: 98, stage: 99.0 },
            { distance_m: 50, dem: 96, stage: 98.0 }
        ];
        const data = buildCrossSectionData(samples, traces);
        // Two traces: terrain (filled) + water surface (stage).
        expect(data.length).toBe(2);
        const terrain = data.find(d => d.name === 'Elevation');
        const water = data.find(d => d.name !== 'Elevation');
        expect(terrain).toExist('expected a terrain trace');
        expect(water).toExist('expected a water-surface trace');
        // Terrain is a filled area following the DEM.
        expect(terrain.x).toEqual([0, 25, 50]);
        expect(terrain.y).toEqual([100, 98, 96]);
        expect(terrain.fill).toExist();
        // Water surface = the raw sampled stage value, unmodified.
        expect(water.y).toEqual([100.5, 99.0, 98.0]);
    });

    it('a null stage sample (dry-masked upstream) is a gap, never a false water surface', () => {
        const samples = [
            { distance_m: 0, dem: 100, stage: 101.0 },
            { distance_m: 25, dem: 98, stage: null },
            { distance_m: 50, dem: 96, stage: 96.0 }
        ];
        const data = buildCrossSectionData(samples, traces);
        const water = data.find(d => d.name !== 'Elevation');
        expect(water.y).toEqual([101.0, null, 96.0]);
    });

    it('still renders terrain-only when no stage raster is present (DEM-only transect)', () => {
        const demOnly = [{ key: 'dem', label: 'Elevation', role: 'dem' }];
        const samples = [{ distance_m: 0, dem: 100 }, { distance_m: 10, dem: 99 }];
        const data = buildCrossSectionData(samples, demOnly);
        expect(data.length).toBe(1);
        expect(data[0].name).toBe('Elevation');
        expect(data[0].fill).toExist();
    });

    it('returns [] for empty/invalid input', () => {
        expect(buildCrossSectionData(null, traces)).toEqual([]);
        expect(buildCrossSectionData([], traces)).toEqual([]);
        expect(buildCrossSectionData([{ distance_m: 0, dem: 1 }], null)).toEqual([]);
    });

    it('returns terrain-only (no water) when no DEM trace exists', () => {
        // A degenerate trace set without role=dem can't anchor the chart;
        // render nothing rather than crash.
        const noDem = [{ key: 'stage', label: 'Water surface', role: 'stage' }];
        const samples = [{ distance_m: 0, stage: 1 }, { distance_m: 10, stage: 2 }];
        expect(buildCrossSectionData(samples, noDem)).toEqual([]);
    });

    // AC4 (TASK-2255) — no code path computes terrain+depth: the water trace
    // is the RAW sampled stage value even when it does NOT equal bed+anything.
    it('AC4: water trace equals the raw stage sample, never derived from bed+depth', () => {
        const samples = [{ distance_m: 0, dem: 100, stage: 42 }]; // nonsensical bed+depth relationship
        const data = buildCrossSectionData(samples, traces);
        const water = data.find(d => d.name !== 'Elevation');
        expect(water.y).toEqual([42]);
    });
});

// ── TASK-2256 (epic 2249 W3) — multi-series + fill rules (LOCKED decision #7) ─

describe('buildCrossSectionData — multi-terrain fill rules (TASK-2256)', () => {
    const samples = [
        { distance_m: 0, dem1: 100, dem2: 90, dem3: 80 },
        { distance_m: 10, dem1: 96, dem2: 88, dem3: 79 }
    ];
    const multiDemTraces = [
        { key: 'dem1', label: 'Terrain A', role: 'dem', terrainId: 1 },
        { key: 'dem2', label: 'Terrain B', role: 'dem', terrainId: 2 },
        { key: 'dem3', label: 'Terrain C', role: 'dem', terrainId: 3 }
    ];

    it('only slot-1 (the first dem trace) is a FILLED area — slots 2/3 are plain lines', () => {
        const data = buildCrossSectionData(samples, multiDemTraces);
        expect(data.length).toBe(3);
        expect(data[0].fill).toBe('tozeroy');
        expect(data[1].fill).toBe(undefined);
        expect(data[2].fill).toBe(undefined);
    });

    it('each terrain trace colour matches its stable slot (TERRAIN_PALETTE order)', () => {
        const data = buildCrossSectionData(samples, multiDemTraces);
        expect(data[0].line.color).toBe('#B89968');
        expect(data[1].line.color).toBe('#D08770');
        expect(data[2].line.color).toBe('#A3BE8C');
    });
});

describe('buildCrossSectionData — single-water conditional fill (TASK-2256, LOCKED decision #7)', () => {
    const samples = [
        { distance_m: 0, dem1: 100, stageA: 100.5 },
        { distance_m: 10, dem1: 96, stageA: 99.0 }
    ];
    const oneDemOneStage = [
        { key: 'dem1', label: 'Terrain A', role: 'dem', terrainId: 7 },
        { key: 'stageA', label: 'Scenario 1', role: 'stage', scenarioId: 3 }
    ];

    it('fills when the single water\'s scenario CURRENT terrain === slot-1 terrain', () => {
        const data = buildCrossSectionData(samples, oneDemOneStage, { scenarioTerrainById: { 3: 7 } });
        const water = data.find(d => d.name !== 'Terrain A');
        expect(water.fill).toBe('tonexty');
    });

    it('is a LINE (no fill) when the scenario\'s current terrain is a DIFFERENT terrain', () => {
        // Scenario 3's current terrain is 99, not 7 (slot-1) — a mismatch, e.g.
        // the scenario was re-pointed at a different terrain since this stage
        // was sampled against terrain 7.
        const data = buildCrossSectionData(samples, oneDemOneStage, { scenarioTerrainById: { 3: 99 } });
        const water = data.find(d => d.name !== 'Terrain A');
        expect(water.fill).toBe(undefined);
    });

    it('is a LINE when the scenario has no known current terrain at all (null/missing)', () => {
        const data = buildCrossSectionData(samples, oneDemOneStage, { scenarioTerrainById: { 3: null } });
        const water = data.find(d => d.name !== 'Terrain A');
        expect(water.fill).toBe(undefined);
    });
});

describe('buildCrossSectionData — multi-water: waters are ALWAYS lines when 2+ are checked (TASK-2256)', () => {
    const samples = [
        { distance_m: 0, dem1: 100, stageA: 100.5, stageB: 99.5 },
        { distance_m: 10, dem1: 96, stageA: 99.0, stageB: 97.0 }
    ];
    const oneDemTwoStages = [
        { key: 'dem1', label: 'Terrain A', role: 'dem', terrainId: 7 },
        { key: 'stageA', label: 'Scenario 1', role: 'stage', scenarioId: 3 },
        { key: 'stageB', label: 'Scenario 2', role: 'stage', scenarioId: 4 }
    ];

    it('neither water fills, even when BOTH scenarios currently point at slot-1 terrain', () => {
        const data = buildCrossSectionData(samples, oneDemTwoStages, {
            scenarioTerrainById: { 3: 7, 4: 7 }
        });
        expect(data.length).toBe(3);
        const waters = data.filter(d => d.name !== 'Terrain A');
        expect(waters.length).toBe(2);
        waters.forEach((w) => expect(w.fill).toBe(undefined));
    });

    it('each water colour matches its stable slot within the stage subset (WATER_PALETTE order)', () => {
        const data = buildCrossSectionData(samples, oneDemTwoStages, {
            scenarioTerrainById: { 3: 7, 4: 7 }
        });
        const waterA = data.find(d => d.name === 'Scenario 1');
        const waterB = data.find(d => d.name === 'Scenario 2');
        expect(waterA.line.color).toBe('#5BC0FF');
        expect(waterB.line.color).toBe('#38B2A3');
    });
});

describe('buildCrossSectionData — default seed reproduces pre-rework single-terrain/single-water look (TASK-2256, AC3)', () => {
    it('a scenario checked against its OWN current terrain (the default seed) fills exactly like today', () => {
        const samples = [
            { distance_m: 0, dem: 810, stage: 810 },
            { distance_m: 25, dem: 805, stage: 811 }
        ];
        const traces = [
            { key: 'dem', label: 'Active terrain', role: 'dem', terrainId: 1 },
            { key: 'stage', label: 'Selected scenario', role: 'stage', scenarioId: 1 }
        ];
        const data = buildCrossSectionData(samples, traces, { scenarioTerrainById: { 1: 1 } });
        expect(data.length).toBe(2);
        expect(data[0].fill).toBe('tozeroy');
        expect(data[0].line.color).toBe('#B89968');
        expect(data[1].fill).toBe('tonexty');
        expect(data[1].line.color).toBe('#5BC0FF');
    });
});

describe('TerrainProfilePanel — cross-section render (TASK-2253, cross-section-only)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });
    const noop = () => {};

    // TASK-2253 — the Profile/Cross-section mode toggle is DELETED; the panel
    // renders the combined terrain+water-surface chart unconditionally.
    it('does NOT show a mode toggle', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady
                setProfilePanelVisible={noop} startProfileDraw={noop}
            />, container
        );
        expect(container.querySelector('[data-testid="profile-mode-toggle"]')).toBe(null);
    });

    it('renders the combined terrain+water-surface chart', () => {
        const samples = [
            { distance_m: 0, dem: 100, stage: 101 },
            { distance_m: 10, dem: 98, stage: 100 }
        ];
        const traces = [
            { key: 'dem', label: 'Elevation', role: 'dem' },
            { key: 'stage', label: 'Water surface', role: 'stage' }
        ];
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady samples={samples} traces={traces}
                setProfilePanelVisible={noop} startProfileDraw={noop}
            />, container
        );
        expect(container.querySelector('[data-testid="profile-chart"]')).toExist();
    });
});

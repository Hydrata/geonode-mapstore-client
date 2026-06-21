/**
 * TASK-1862 (epic 1814 W4.5) — cross-section / transect MODE spec.
 *
 * The cross-section tool is added as a MODE of the W4.4 line-profile tool (same
 * draw interaction, same W4.3 multi-raster endpoint, same panel/epic) rather
 * than a duplicate tool. This spec pins the net-new pieces:
 *
 *   - getProfileTraces tags each trace with a `role` ('dem' | 'depth' | 'other')
 *     so the cross-section builder can find the terrain + depth rasters
 *     UNAMBIGUOUSLY (not by sniffing the layer name).
 *   - buildCrossSectionData(samples, traces) -> Plotly data for the combined
 *     terrain + water-surface chart: terrain as a FILLED area (elevation vs
 *     distance) and the water surface (terrain + depth = stage) overlaid as a
 *     second trace, also filled down to the terrain so the water body reads.
 *   - the uiReducer carries a `profileMode` ('profile' | 'crosssection') flipped
 *     by setProfileMode, defaulting to 'profile' (W4.4 behaviour unchanged).
 *   - the panel shows a mode toggle and renders the cross-section chart in
 *     cross-section mode.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';

import {
    TerrainProfilePanelClass,
    buildCrossSectionData
} from '../components/TerrainProfilePanel';
import { getProfileTraces } from '../epics/profileEpic';
import uiReducer from '../reducers/uiReducer';
import { setProfileMode } from '../actionsAnuga';

// A state with a selected scenario carrying a latest_run (depth/velocity/momentum
// result rasters, geonode:-prefixed names — the real serializer shape).
const makeState = () => ({
    anuga: {
        projects: { data: { id: 42 } },
        resources: {
            terrainLoaded: true,
            terrain: [{ id: 7, status: 'ready', gn_layer_name: 'ele_7_blue_mountains' }]
        },
        scenarios: {
            selectedId: 3,
            byId: {
                3: {
                    id: 3,
                    selected: true,
                    latest_run: {
                        id: 99,
                        gn_layer_depth_max: { name: 'geonode:run_42_3_99_depth_max_cog' },
                        gn_layer_velocity_max: { name: 'geonode:run_42_3_99_velocity_max_cog' },
                        gn_layer_depth_integrated_velocity_max: { name: 'geonode:run_42_3_99_depthintegratedvelocity_max_cog' }
                    }
                }
            }
        }
    },
    layers: { flat: [{ id: 'layer-dem-7', name: 'geonode:ele_7_blue_mountains', type: 'wms', group: 'Input Data.Terrain' }] }
});

describe('cross-section — getProfileTraces role tagging (TASK-1862)', () => {
    it('tags the DEM trace role=dem and the depth trace role=depth', () => {
        const traces = getProfileTraces(makeState());
        const byKey = Object.fromEntries(traces.map(t => [t.key, t]));
        expect(byKey.dem.role).toBe('dem');
        expect(byKey.run_42_3_99_depth_max_cog.role).toBe('depth');
    });
    it('tags velocity/momentum role=other (not the stage source)', () => {
        const traces = getProfileTraces(makeState());
        const byKey = Object.fromEntries(traces.map(t => [t.key, t]));
        expect(byKey.run_42_3_99_velocity_max_cog.role).toBe('other');
        expect(byKey.run_42_3_99_depthintegratedvelocity_max_cog.role).toBe('other');
    });
});

describe('cross-section — buildCrossSectionData (TASK-1862)', () => {
    const traces = [
        { key: 'dem', label: 'Elevation', role: 'dem' },
        { key: 'depth', label: 'Depth (max)', role: 'depth' }
    ];

    it('renders terrain as a filled area and water surface (terrain+depth=stage) overlaid', () => {
        const samples = [
            { distance_m: 0, dem: 100, depth: 0.5 },
            { distance_m: 25, dem: 98, depth: 1.0 },
            { distance_m: 50, dem: 96, depth: 2.0 }
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
        // Water surface = terrain + depth (stage), per-sample.
        expect(water.y).toEqual([100.5, 99.0, 98.0]);
    });

    it('drops a water sample to null where depth is null/dry (no false water surface)', () => {
        const samples = [
            { distance_m: 0, dem: 100, depth: 1.0 },
            { distance_m: 25, dem: 98, depth: null },
            { distance_m: 50, dem: 96, depth: 0.0 }
        ];
        const data = buildCrossSectionData(samples, traces);
        const water = data.find(d => d.name !== 'Elevation');
        // null depth -> null stage (gap); 0 depth -> stage == terrain (still water-level=ground).
        expect(water.y).toEqual([101.0, null, 96.0]);
    });

    it('still renders terrain-only when no depth raster is present (DEM-only transect)', () => {
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
        // A degenerate trace set without role=dem can't compute stage; render
        // nothing rather than crash.
        const noDem = [{ key: 'depth', label: 'Depth (max)', role: 'depth' }];
        const samples = [{ distance_m: 0, depth: 1 }, { distance_m: 10, depth: 2 }];
        expect(buildCrossSectionData(samples, noDem)).toEqual([]);
    });
});

describe('uiReducer — cross-section mode (TASK-1862)', () => {
    it('defaults profileMode to "profile"', () => {
        const s = uiReducer(undefined, { type: '@@INIT' });
        expect(s.profileMode).toBe('profile');
    });
    it('setProfileMode flips to crosssection and back', () => {
        let s = uiReducer(undefined, setProfileMode('crosssection'));
        expect(s.profileMode).toBe('crosssection');
        s = uiReducer(s, setProfileMode('profile'));
        expect(s.profileMode).toBe('profile');
    });
    it('closing the panel resets mode to profile', () => {
        let s = uiReducer(undefined, setProfileMode('crosssection'));
        s = uiReducer(s, { type: 'ANUGA:SET_PROFILE_PANEL_VISIBLE', visible: false });
        expect(s.profileMode).toBe('profile');
    });
});

describe('TerrainProfilePanel — cross-section mode render (TASK-1862)', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });
    const noop = () => {};

    it('shows the mode toggle when a DEM is ready', () => {
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady mode="profile"
                setProfilePanelVisible={noop} startProfileDraw={noop} setProfileMode={noop}
            />, container
        );
        expect(container.querySelector('[data-testid="profile-mode-toggle"]')).toExist();
    });

    it('in cross-section mode renders the combined terrain+water-surface chart', () => {
        const samples = [
            { distance_m: 0, dem: 100, depth: 1 },
            { distance_m: 10, dem: 98, depth: 2 }
        ];
        const traces = [
            { key: 'dem', label: 'Elevation', role: 'dem' },
            { key: 'depth', label: 'Depth (max)', role: 'depth' }
        ];
        ReactDOM.render(
            <TerrainProfilePanelClass
                visible demReady mode="crosssection" samples={samples} traces={traces}
                setProfilePanelVisible={noop} startProfileDraw={noop} setProfileMode={noop}
            />, container
        );
        expect(container.querySelector('[data-testid="profile-chart"]')).toExist();
    });
});

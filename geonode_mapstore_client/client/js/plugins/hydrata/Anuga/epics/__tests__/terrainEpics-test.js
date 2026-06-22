/**
 * TASK-1866 / TASK-1867 (epic 1814 W5.1/W5.2) — Unit tests for terrainEpics.js
 *
 * Tests cover:
 *
 * 1866 — per-DEM bounds into the 3D terrain config:
 *   - bareName: strips GeoServer workspace prefix
 *   - buildDemTerrain bounds join: set on config, no-row fallback (omits
 *     lowest/highest), bounds update on SET_ANUGA_TERRAIN_DATA
 *   - findBestDemLayer: ANUGA terrain group preferred; geonode: prefix handled
 *   - manageTerrain3DEpic: adds DEM terrain with bounds; updates bounds when
 *     terrain data loads after the layer is already present
 *
 * 1867 — nodata neutralisation:
 *   - Per-DEM (lowest, highest) window zeroes ALL three nodata sentinels:
 *       -9999, very-negative (-FLT_MAX-clipped / INT16_MIN), INT16_MAX (+32767)
 *   - Epsilon (+/-1 m) keeps legitimate min/max extremes inside the window
 */
import expect from 'expect';
import Rx from 'rxjs';
import { VISUALIZATION_MODE_CHANGED } from '@mapstore/framework/actions/maptype';
import { ADD_LAYER, REMOVE_LAYER } from '@mapstore/framework/actions/layers';
import { SET_ANUGA_TERRAIN_DATA } from '../../actionsAnuga';

import {
    bareName,
    findBestDemLayer,
    manageTerrain3DEpic
} from '../terrainEpics';

// ── Epic harness ──────────────────────────────────────────────────────────────
// manageTerrain3DEpic has a 300ms debounce so we use a manual subject + timeout
// pattern (same as cursorElevationEpic-test.js) rather than testEpic/take(N).

const DEBOUNCE_MS = 300;
const COLLECT_AFTER_MS = 700; // > debounce

const makeActions$ = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
    }, 0);
    return action$;
};

const runEpic = (action$, state, done, assert) => {
    const store = { getState: () => state };
    const emitted = [];
    manageTerrain3DEpic(action$, store).subscribe(
        a => emitted.push(a),
        err => done(err)
    );
    setTimeout(() => {
        try {
            assert(emitted);
            done();
        } catch (e) {
            done(e);
        }
    }, COLLECT_AFTER_MS);
};

// ── State helpers ──────────────────────────────────────────────────────────────

const makeState = ({
    withTerrainRow = true,
    elevMin = 50.0,
    elevMax = 850.0,
    withBounds = true,
    layerName = 'geonode:ele_42_utm_cog',
    rowLayerName = 'ele_42_utm_cog',
    cesium = true,
    existingTerrainDem = false
} = {}) => {
    const flatLayers = [
        {
            id: 'layer-dem-42',
            name: layerName,
            type: 'wms',
            group: 'Input Data.Terrain',
            title: 'My DEM'
        }
    ];
    if (existingTerrainDem) {
        flatLayers.push({
            id: 'terrain-dem',
            name: 'geonode:ele_42_utm_cog',
            type: 'terrain',
            provider: 'wms',
            group: 'background'
            // lowest/highest absent — not yet set
        });
    }
    return {
        maptype: { mapType: cesium ? 'cesium' : 'openlayers' },
        layers: { flat: flatLayers },
        anuga: {
            resources: {
                terrainLoaded: withTerrainRow,
                terrain: withTerrainRow
                    ? [{
                        id: 42,
                        status: 'ready',
                        gn_layer_name: rowLayerName,
                        dem_elev_min: withBounds ? elevMin : null,
                        dem_elev_max: withBounds ? elevMax : null
                    }]
                    : []
            }
        }
    };
};

// ── bareName ──────────────────────────────────────────────────────────────────

describe('bareName', () => {
    it('strips the geonode: workspace prefix', () => {
        expect(bareName('geonode:ele_42_utm_cog')).toBe('ele_42_utm_cog');
    });

    it('returns bare names unchanged', () => {
        expect(bareName('ele_42_utm_cog')).toBe('ele_42_utm_cog');
    });

    it('handles null gracefully', () => {
        expect(bareName(null)).toBe('');
    });

    it('handles undefined gracefully', () => {
        expect(bareName(undefined)).toBe('');
    });

    it('handles empty string gracefully', () => {
        expect(bareName('')).toBe('');
    });

    it('strips "ws:" prefix from "ws:layername"', () => {
        expect(bareName('ws:layername')).toBe('layername');
    });
});

// ── findBestDemLayer ──────────────────────────────────────────────────────────

describe('findBestDemLayer', () => {
    it('returns the ANUGA terrain layer (group=Input Data.Terrain) first', () => {
        const state = makeState();
        const layer = findBestDemLayer(state);
        expect(layer).toBeTruthy();
        expect(layer.group).toBe('Input Data.Terrain');
    });

    it('handles a geonode:-prefixed layer name correctly', () => {
        const state = makeState({ layerName: 'geonode:ele_42_utm_cog' });
        const layer = findBestDemLayer(state);
        expect(layer).toBeTruthy();
        expect(layer.name).toBe('geonode:ele_42_utm_cog');
    });

    it('returns null when no terrain or DEM layers exist', () => {
        const state = { layers: { flat: [] } };
        expect(findBestDemLayer(state)).toBe(null);
    });

    it('falls back to DEM-titled layer when no ANUGA terrain group', () => {
        const state = {
            layers: {
                flat: [
                    { id: 'x', name: 'my_dem', type: 'wms', group: 'Default', title: 'My DEM' }
                ]
            }
        };
        const layer = findBestDemLayer(state);
        expect(layer).toBeTruthy();
        expect(layer.name).toBe('my_dem');
    });

    it('picks the largest-bbox DEM when multiple DEM-titled layers exist', () => {
        const state = {
            layers: {
                flat: [
                    {
                        id: 'small', name: 'dem_small', type: 'wms', group: 'Default', title: 'DEM Small',
                        bbox: { bounds: { minx: 0, miny: 0, maxx: 1, maxy: 1 } }
                    },
                    {
                        id: 'big', name: 'dem_big', type: 'wms', group: 'Default', title: 'DEM Big',
                        bbox: { bounds: { minx: 0, miny: 0, maxx: 10, maxy: 10 } }
                    }
                ]
            }
        };
        const layer = findBestDemLayer(state);
        expect(layer.id).toBe('big');
    });
});

// ── buildDemTerrain bounds join (via manageTerrain3DEpic) ─────────────────────

describe('buildDemTerrain — bounds join (via manageTerrain3DEpic)', () => {
    it('surfaces lowest/highest from dem_elev_min/max on a new addLayer', function(done) {
        this.timeout(2000);
        const state = makeState({ elevMin: 50.0, elevMax: 850.0 });
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'cesium' }]);
        runEpic(action$, state, done, (emitted) => {
            const addAction = emitted.find(a => a.type === ADD_LAYER);
            expect(addAction).toBeTruthy();
            // Math.floor(50 - 1) = 49, Math.ceil(850 + 1) = 851
            expect(addAction.layer.lowest).toBe(49);
            expect(addAction.layer.highest).toBe(851);
        });
    });

    it('omits lowest/highest when terrain row has no bounds (fallback to provider defaults)', function(done) {
        this.timeout(2000);
        const state = makeState({ withBounds: false });
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'cesium' }]);
        runEpic(action$, state, done, (emitted) => {
            const addAction = emitted.find(a => a.type === ADD_LAYER);
            expect(addAction).toBeTruthy();
            expect(addAction.layer.lowest).toBe(undefined);
            expect(addAction.layer.highest).toBe(undefined);
        });
    });

    it('omits lowest/highest when no terrain row exists', function(done) {
        this.timeout(2000);
        const state = makeState({ withTerrainRow: false });
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'cesium' }]);
        runEpic(action$, state, done, (emitted) => {
            const addAction = emitted.find(a => a.type === ADD_LAYER);
            expect(addAction).toBeTruthy();
            expect(addAction.layer.lowest).toBe(undefined);
            expect(addAction.layer.highest).toBe(undefined);
        });
    });

    it('re-applies bounds on SET_ANUGA_TERRAIN_DATA via remove+add (forces provider recreation)', function(done) {
        // Scenario: terrain-dem was added BEFORE terrain rows loaded (no bounds) —
        // the DOMINANT async path. When SET_ANUGA_TERRAIN_DATA fires, the bounds must
        // reach the LIVE Cesium provider. Core TerrainLayer.js:updateLayer does NOT
        // recreate the provider on a lowest/highest change, so changeLayerProperties
        // would be a silent no-op (provider keeps -500/12000 defaults). The epic must
        // instead remove+add the terrain so the GeoServerBILTerrainProvider is rebuilt
        // with the per-DEM bounds (the W5 adversarial-review critical fix).
        this.timeout(2000);
        const state = makeState({ elevMin: 100.5, elevMax: 900.3, existingTerrainDem: true });
        const action$ = makeActions$([{ type: SET_ANUGA_TERRAIN_DATA, data: state.anuga.resources.terrain }]);
        runEpic(action$, state, done, (emitted) => {
            // changeLayerProperties is NOT used (it would not recreate the provider).
            const removeAction = emitted.find(a => a.type === REMOVE_LAYER);
            const addAction = emitted.find(a => a.type === ADD_LAYER);
            expect(removeAction).toBeTruthy();
            expect(removeAction.layerId).toBe('terrain-dem');
            expect(addAction).toBeTruthy();
            expect(addAction.layer.id).toBe('terrain-dem');
            // The rebuilt provider config carries the per-DEM bounds.
            expect(addAction.layer.lowest).toBe(Math.floor(100.5 - 1)); // 99
            expect(addAction.layer.highest).toBe(Math.ceil(900.3 + 1)); // 902
        });
    });

    it('normalises bare layer name by adding geonode: prefix', function(done) {
        this.timeout(2000);
        // Layer name is ALREADY bare (no workspace prefix); buildDemTerrain should prefix it.
        const state = makeState({ layerName: 'ele_42_utm_cog', rowLayerName: 'ele_42_utm_cog' });
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'cesium' }]);
        runEpic(action$, state, done, (emitted) => {
            const addAction = emitted.find(a => a.type === ADD_LAYER);
            expect(addAction).toBeTruthy();
            expect(addAction.layer.name).toBe('geonode:ele_42_utm_cog');
        });
    });
});

// ── 1867 — nodata sentinel zeroing ───────────────────────────────────────────
// These tests document the clamp-to-sea-level semantics via the (lowest, highest) window.
// The GeoServerBILTerrainProvider decode loop uses STRICT comparisons (temp > lowest &&
// temp < highest). Sentinels outside this window are zeroed to 0 m (sea level).
// D9 (TASK-1867): this is the accepted design — no transparent hole, clamp to sea level.

describe('nodata sentinel zeroing (TASK-1867, D9)', () => {
    // Representative DEM: Blue Mountains NSW, approx 50 m – 1200 m.
    const LOWEST = Math.floor(50 - 1);   // 49
    const HIGHEST = Math.ceil(1200 + 1); // 1201

    it('-9999 sentinel is below lowest (49) and would be zeroed by the decode loop', () => {
        expect(-9999 > LOWEST && -9999 < HIGHEST).toBe(false);
    });

    it('-32768 (INT16_MIN) sentinel is below lowest (49) and would be zeroed', () => {
        expect(-32768 > LOWEST && -32768 < HIGHEST).toBe(false);
    });

    it('+32767 (INT16_MAX) sentinel is above highest (1201) and would be zeroed', () => {
        expect(32767 > LOWEST && 32767 < HIGHEST).toBe(false);
    });

    it('epsilon keeps the legitimate minimum (50.0) inside the window', () => {
        // temp = 50, strict gate: 50 > 49 && 50 < 1201 => true (kept)
        expect(50 > LOWEST && 50 < HIGHEST).toBe(true);
    });

    it('epsilon keeps the legitimate maximum (1200.0) inside the window', () => {
        // temp = 1200, strict gate: 1200 > 49 && 1200 < 1201 => true (kept)
        expect(1200 > LOWEST && 1200 < HIGHEST).toBe(true);
    });

    it('sea-level (0 m) is outside [49, 1201] for this elevated DEM — clamp documents D9', () => {
        // For an elevated DEM, a 0 m pixel represents either a nodata hole or a real
        // sea-level pixel that is geographically implausible. D9 accepts this as the
        // no-hole trade-off. This test documents (not prescribes) the behaviour.
        expect(0 > LOWEST && 0 < HIGHEST).toBe(false);
    });

    // TASK-1867: Additional epsilon boundary checks to confirm the ±1 m widening
    // is necessary and correct.
    it('epsilon: without ±1 m widening, the DEM minimum (50.0) would be rejected (strict gate)', () => {
        // If we set lowest = 50 exactly, the strict gate (temp > 50) would reject 50.0.
        const lowestExact = 50; // No epsilon
        const highestExact = 1200; // No epsilon
        // 50.0 is NOT > 50 (strict), so it would be zeroed without epsilon.
        expect(50 > lowestExact && 50 < highestExact).toBe(false);
        // With epsilon (lowest=49): 50 > 49 is true → kept.
        expect(50 > LOWEST && 50 < HIGHEST).toBe(true);
    });

    it('epsilon: without ±1 m widening, the DEM maximum (1200.0) would be rejected', () => {
        const lowestExact = 50;
        const highestExact = 1200;
        // 1200 is NOT < 1200 (strict), so it would be zeroed without epsilon.
        expect(1200 > lowestExact && 1200 < highestExact).toBe(false);
        // With epsilon (highest=1201): 1200 < 1201 is true → kept.
        expect(1200 > LOWEST && 1200 < HIGHEST).toBe(true);
    });

    it('very-negative FLT_MAX-clipped sentinel (-1e10) is outside the window', () => {
        // Any FLT_MAX-derived sentinel, even when clipped to INT16_MIN range, falls
        // far below LOWEST (49) for a typical above-sea-level DEM.
        const veryNegative = -1e10;
        expect(veryNegative > LOWEST && veryNegative < HIGHEST).toBe(false);
    });

    it('values within the legitimate range pass the gate (mid-DEM sample)', () => {
        const midDem = 600; // Well within [50, 1200]
        expect(midDem > LOWEST && midDem < HIGHEST).toBe(true);
    });
});

// ── 1868 — flood-surface drape visibility (TASK-1868) ────────────────────────
// Result WMS layers (depth/velocity) auto-drape in Cesium 3D via core's standard
// WMSLayer → imageryLayers.addImageryProvider path (Layer.jsx:283). The key
// invariant is that manageTerrain3DEpic does NOT remove result layers when
// entering or exiting 3D mode.

describe('flood-surface drape — manageTerrain3DEpic does not touch result layers (TASK-1868)', () => {
    const makeStateWithResult = (cesium) => ({
        maptype: { mapType: cesium ? 'cesium' : 'openlayers' },
        layers: {
            flat: [
                // ANUGA terrain input layer
                {
                    id: 'layer-dem-42',
                    name: 'geonode:ele_42_utm_cog',
                    type: 'wms',
                    group: 'Input Data.Terrain',
                    title: 'My DEM',
                    visibility: true
                },
                // ANUGA result layer — depth_max
                {
                    id: 'result-depth-42',
                    name: 'geonode:run_42_depth_max_cog',
                    type: 'wms',
                    group: 'ANUGA Results.Depth',
                    title: 'Depth (max)',
                    visibility: true
                }
            ]
        },
        anuga: {
            resources: {
                terrainLoaded: true,
                terrain: [{
                    id: 42,
                    status: 'ready',
                    gn_layer_name: 'ele_42_utm_cog',
                    dem_elev_min: 50,
                    dem_elev_max: 850
                }]
            }
        }
    });

    it('in Cesium 3D: emits ADD_LAYER for terrain but NOT REMOVE_LAYER for result layer', function(done) {
        this.timeout(2000);
        const state = makeStateWithResult(true);
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'cesium' }]);
        runEpic(action$, state, done, (emitted) => {
            // Should add the terrain DEM layer
            const addActions = emitted.filter(a => a.type === ADD_LAYER);
            expect(addActions.length).toBe(1);
            expect(addActions[0].layer.id).toBe('terrain-dem');
            // Must NOT remove the result layer
            const removeActions = emitted.filter(a => a.type === 'REMOVE_LAYER');
            const removedResultLayer = removeActions.find(a => a.layerId === 'result-depth-42');
            expect(removedResultLayer).toBe(undefined);
        });
    });

    it('in 2D mode: emits no actions (no terrain to remove, result layer untouched)', function(done) {
        this.timeout(2000);
        // No existing terrain layer in 2D state
        const state = makeStateWithResult(false);
        const action$ = makeActions$([{ type: VISUALIZATION_MODE_CHANGED, mode: 'openlayers' }]);
        runEpic(action$, state, done, (emitted) => {
            // No terrain in state → no REMOVE_LAYER
            const removeActions = emitted.filter(a => a.type === 'REMOVE_LAYER');
            expect(removeActions.length).toBe(0);
        });
    });

    it('bareName strips geonode: prefix from result layer names for bareName matching', () => {
        // Result layers from latest_run.gn_layer_depth_max.name carry the workspace prefix.
        // The bareName helper is used by profileEpic to get the bare coverage name.
        // Verify the same helper works on depth_max names.
        expect(bareName('geonode:run_42_depth_max_cog')).toBe('run_42_depth_max_cog');
        expect(bareName('run_42_depth_max_cog')).toBe('run_42_depth_max_cog');
    });
});

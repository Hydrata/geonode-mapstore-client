/*
 * TASK-1997 (W3.2) — rasterClickTargets tests.
 *
 * Proof points:
 *   (a) extractBandValue: reads GRAY_INDEX, falls back to first numeric prop.
 *   (b) buildRasterFeatureId / parseRasterFeatureId: encode/decode value.
 *   (c) registerRasterClickTargets() registers fri_raster_ and terrain_raster
 *       with readOnly:true.
 *   (d) match(): correct prefix matching; empty featureId is ok (raster path).
 *   (e) label(): value in subtitle from feature.properties.GRAY_INDEX (UNCHANGED).
 *   (f) buildOpenActions(): returns [] — READ-ONLY value-readout (UAT 2026-06-30).
 *       The band value is shown in label.subtitle (panel row); clicking dispatches
 *       NO action. A lone raster click falls through to the default Identify popup.
 *       [] is trivially structuredClone-safe (D6 / C2).
 *   (g) parseRasterFeatureId is still exported and tested (now-unused-but-valid util).
 */
import expect from 'expect';
import {
    getClickTarget,
    cleanClickTargets
} from '../../shared/clickTargetRegistry';
import {
    extractBandValue,
    formatBandValue,
    buildRasterFeatureId,
    parseRasterFeatureId,
    registerRasterClickTargets
} from '../rasterClickTargets';
// TASK-2040 (F7) — end-to-end proof that the hillshade/terrain_raster overlap
// resolves to the RIGHT kind via the real classifier (resolveKind's
// longest-kind-wins rule), not just a unit-level match() call.
import { buildCandidates } from '../epics/clickDisambiguationEpic';

const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') { acc.push(`${path}.${k}`); } else if (v && typeof v === 'object') { collectFunctionPaths(v, `${path}.${k}`, acc); }
    });
    return acc;
};

const feature = (id, props = {}) => ({ type: 'Feature', id, properties: props });

describe('rasterClickTargets (TASK-1997 W3.2)', () => {

    beforeEach(() => {
        cleanClickTargets();
        registerRasterClickTargets();
    });
    afterEach(() => cleanClickTargets());

    describe('extractBandValue', () => {
        it('reads GRAY_INDEX from feature.properties', () => {
            expect(extractBandValue({ properties: { GRAY_INDEX: 0.04 } })).toBe(0.04);
        });
        it('falls back to first numeric property', () => {
            expect(extractBandValue({ properties: { band1: 12.3 } })).toBe(12.3);
        });
        it('returns null when no numeric property', () => {
            expect(extractBandValue({ properties: { foo: 'bar' } })).toBe(null);
        });
        it('returns null for null / missing properties', () => {
            expect(extractBandValue(null)).toBe(null);
            expect(extractBandValue({ properties: null })).toBe(null);
        });
    });

    describe('formatBandValue', () => {
        it('formats with trailing zero removal', () => {
            expect(formatBandValue(0.04, 3)).toBe('0.04');
            expect(formatBandValue(12.30, 2)).toBe('12.3');
            expect(formatBandValue(100.0, 2)).toBe('100');
        });
        it('returns null for null input', () => {
            expect(formatBandValue(null)).toBe(null);
        });
    });

    describe('buildRasterFeatureId / parseRasterFeatureId', () => {
        it('round-trips a numeric value', () => {
            const id = buildRasterFeatureId('fri_raster_4_friction', 0.04);
            expect(id).toContain('#raster=');
            expect(parseRasterFeatureId(id)).toBe(0.04);
        });
        it('produces a bare id when value is null', () => {
            const id = buildRasterFeatureId('fri_raster_4_friction', null);
            expect(id).toBe('fri_raster_4_friction#raster');
            expect(parseRasterFeatureId(id)).toBe(null);
        });
        it('parseRasterFeatureId returns null for non-raster ids', () => {
            expect(parseRasterFeatureId('nod_1_nodes.5')).toBe(null);
            expect(parseRasterFeatureId('')).toBe(null);
        });
    });

    describe('registration', () => {
        it('registers fri_raster_ and terrain_raster with readOnly:true', () => {
            expect(getClickTarget('fri_raster_').readOnly).toBe(true);
            expect(getClickTarget('terrain_raster').readOnly).toBe(true);
        });
    });

    describe('fri_raster_ target', () => {
        const t = () => getClickTarget('fri_raster_');

        describe('match()', () => {
            it('matches fri_raster_ layers regardless of featureId', () => {
                expect(t().match('', 'fri_raster_4_friction')).toBe(true);
                expect(t().match('', 'geonode:fri_raster_4_friction')).toBe(true);
                expect(t().match('nod_1.5', 'nod_1_nodes')).toBe(false);
            });
        });

        describe('label()', () => {
            it('puts the Mannings n value in subtitle from GRAY_INDEX', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 0.04 }));
                expect(lbl.title).toBe('Friction raster');
                expect(lbl.subtitle).toBe('Mannings n = 0.04');
                expect(lbl.icon).toExist();
            });
            it('shows "Value unavailable" when properties have no number', () => {
                const lbl = t().label(feature('', {}));
                expect(lbl.subtitle).toBe('Value unavailable');
            });
            it('label result is structuredClone-safe (D6)', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 0.04 }));
                expect(collectFunctionPaths(lbl)).toEqual([]);
                expect(() => structuredClone(lbl)).toNotThrow();
            });
        });

        describe('buildOpenActions()', () => {
            it('returns [] (read-only value-readout: Mannings n already shown in label.subtitle)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 0.04 }));
                expect(actions).toEqual([]);
            });
            it('returns [] with a synthetic featureId (fallthrough to default Identify popup, not a panel round-trip)', () => {
                const syntheticId = buildRasterFeatureId('fri_raster_4_friction', 0.04);
                const actions = t().buildOpenActions(feature(syntheticId));
                expect(actions).toEqual([]);
            });
            it('returns [] when no GRAY_INDEX (no toast, no action)', () => {
                const actions = t().buildOpenActions(feature('fri_raster_4_friction#raster', {}));
                expect(actions).toEqual([]);
            });
            it('[] is trivially structuredClone-safe (D6, C2)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 0.04 }));
                expect(collectFunctionPaths(actions)).toEqual([]);
                expect(() => structuredClone(actions)).toNotThrow();
            });
        });
    });

    describe('terrain_raster target', () => {
        const t = () => getClickTarget('terrain_raster');

        describe('match()', () => {
            it('matches ele_*_cog terrain rasters', () => {
                expect(t().match('', 'ele_42_utm_cog')).toBe(true);
                expect(t().match('', 'geonode:ele_42_utm_cog')).toBe(true);
                expect(t().match('', 'ele_7_grand_canyon_cog')).toBe(true);
            });
            it('does not match non-COG ele_ layers', () => {
                // A non-COG ele_ layer might be a legacy elevation vector (W3.1 handles it)
                expect(t().match('nod_1.5', 'nod_1_nodes')).toBe(false);
            });
        });

        describe('label()', () => {
            it('puts the elevation value in subtitle from GRAY_INDEX', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 12.34 }));
                expect(lbl.title).toBe('Terrain elevation');
                expect(lbl.subtitle).toBe('12.34 m');
            });
            it('shows "Value unavailable" when no GRAY_INDEX', () => {
                const lbl = t().label(feature('', {}));
                expect(lbl.subtitle).toBe('Value unavailable');
            });
        });

        describe('buildOpenActions()', () => {
            it('returns [] (read-only value-readout: elevation already shown in label.subtitle)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 12.34 }));
                expect(actions).toEqual([]);
            });
            it('returns [] regardless of feature input (no state fallback needed — opener is no-op)', () => {
                const getState = () => ({ anuga: { resources: { cursorElevation: 5.5 } } });
                const actions = t().buildOpenActions(
                    feature('ele_42_cog#raster'),
                    getState
                );
                expect(actions).toEqual([]);
            });
            it('[] is trivially structuredClone-safe (D6, C2)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 42.1 }));
                expect(collectFunctionPaths(actions)).toEqual([]);
                expect(() => structuredClone(actions)).toNotThrow();
            });
        });
    });

    // ── TASK-2040 (F7): terrain_hillshade split out of terrain_raster ──────
    describe('terrain_hillshade target', () => {
        const t = () => getClickTarget('terrain_hillshade');

        it('is registered readOnly', () => {
            expect(t().readOnly).toBe(true);
        });

        describe('match()', () => {
            it('matches a hillshade COG layer (which ALSO matches terrain_raster\'s regex)', () => {
                const hillshadeName = 'ele_91158_hillshade_merewether_cog';
                expect(t().match('', hillshadeName)).toBe(true);
                // The overlap this target exists to resolve: terrain_raster's regex is
                // permissive enough to ALSO match the hillshade filename.
                expect(getClickTarget('terrain_raster').match('', hillshadeName)).toBe(true);
            });
            it('does not match a true elevation COG layer (no "hillshade" token)', () => {
                expect(t().match('', 'ele_42_utm_cog')).toBe(false);
            });
        });

        describe('label()', () => {
            it('never renders a unit ("m") — a hillshade band is unitless shading, not elevation', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 142 }));
                expect(lbl.title).toBe('Terrain hillshade');
                expect(lbl.subtitle).toNotMatch(/\bm\b/);
                expect(lbl.subtitle).toMatch(/142/);
            });
            it('does NOT drop trailing zeros off an integer value (formatBandValue(v,0) regression)', () => {
                // formatBandValue's trailing-zero regex assumes a decimal-point
                // context; at decimals=0 it would wrongly strip "140" -> "14" and
                // "100" -> "1". terrain_hillshade must round directly instead.
                expect(t().label(feature('', { GRAY_INDEX: 140 })).subtitle).toBe('Shading: 140');
                expect(t().label(feature('', { GRAY_INDEX: 100 })).subtitle).toBe('Shading: 100');
            });
        });

        it('resolveKind (via the real classifier) picks terrain_hillshade over terrain_raster for a hillshade layer', () => {
            const hillshadeFeature = {
                type: 'Feature',
                id: '',
                properties: { GRAY_INDEX: 142 },
                _anugaLayerName: 'geonode:ele_91158_hillshade_merewether_cog'
            };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [hillshadeFeature] });
            expect(candidates.length).toBe(1);
            expect(candidates[0].kind).toBe('terrain_hillshade');
            expect(candidates[0].label.title).toBe('Terrain hillshade');
            expect(candidates[0].label.subtitle).toNotMatch(/\bm\b/);
        });

        it('resolveKind still picks terrain_raster for a true elevation layer (no regression)', () => {
            const elevationFeature = {
                type: 'Feature',
                id: '',
                properties: { GRAY_INDEX: 12.34 },
                _anugaLayerName: 'geonode:ele_91158_utm_merewether_cog'
            };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [elevationFeature] });
            expect(candidates.length).toBe(1);
            expect(candidates[0].kind).toBe('terrain_raster');
            expect(candidates[0].label.subtitle).toBe('12.34 m');
        });
    });

    // ── TASK-2040 (F7): ANUGA result rasters ────────────────────────────────
    describe('result raster targets (depth_max / velocity_max / depth_integrated_velocity_max)', () => {
        it('are registered readOnly', () => {
            expect(getClickTarget('depth_max').readOnly).toBe(true);
            expect(getClickTarget('velocity_max').readOnly).toBe(true);
            expect(getClickTarget('depth_integrated_velocity_max').readOnly).toBe(true);
        });

        describe('depth_max', () => {
            const t = () => getClickTarget('depth_max');
            it('matches the real published layer name (run<id>_depth_max_cog)', () => {
                expect(t().match('', 'run1255_depth_max_cog')).toBe(true);
                expect(t().match('', 'geonode:run1255_depth_max_cog')).toBe(true);
            });
            it('does not match a momentum layer (no accidental substring overlap)', () => {
                expect(t().match('', 'run1255_depthintegratedvelocity_max_cog')).toBe(false);
            });
            it('label() reads the depth value in metres', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 1.234 }));
                expect(lbl.title).toBe('Depth Max');
                expect(lbl.subtitle).toBe('Depth: 1.23 m');
            });
            it('buildOpenActions returns [] (read-only value-readout)', () => {
                expect(t().buildOpenActions(feature('', { GRAY_INDEX: 1.234 }))).toEqual([]);
            });
        });

        describe('velocity_max', () => {
            const t = () => getClickTarget('velocity_max');
            it('matches the real published layer name (run<id>_velocity_max_cog)', () => {
                expect(t().match('', 'run1255_velocity_max_cog')).toBe(true);
            });
            it('label() reads the velocity value in m/s', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 0.856 }));
                expect(lbl.title).toBe('Velocity Max');
                expect(lbl.subtitle).toBe('Velocity: 0.86 m/s');
            });
        });

        describe('depth_integrated_velocity_max (Momentum Max)', () => {
            const t = () => getClickTarget('depth_integrated_velocity_max');
            it('matches the real published layer name (run<id>_depthintegratedvelocity_max_cog)', () => {
                expect(t().match('', 'run1255_depthintegratedvelocity_max_cog')).toBe(true);
            });
            it('does not match a plain depth_max layer (no accidental substring overlap)', () => {
                expect(t().match('', 'run1255_depth_max_cog')).toBe(false);
            });
            it('label() reads the momentum value in m²/s, titled "Momentum Max"', () => {
                const lbl = t().label(feature('', { GRAY_INDEX: 2.5 }));
                expect(lbl.title).toBe('Momentum Max');
                expect(lbl.subtitle).toMatch(/2\.5/);
            });
        });

        it('resolveKind (via the real classifier) resolves a live depth_max GFI hit end to end', () => {
            const depthFeature = {
                type: 'Feature',
                id: '',
                properties: { GRAY_INDEX: 1.5 },
                _anugaLayerName: 'geonode:run1255_depth_max_cog'
            };
            const candidates = buildCandidates({ type: 'FeatureCollection', features: [depthFeature] });
            expect(candidates.length).toBe(1);
            expect(candidates[0].kind).toBe('depth_max');
            expect(candidates[0].label.subtitle).toBe('Depth: 1.5 m');
        });
    });
});

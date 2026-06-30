/*
 * TASK-1997 (W3.2) — rasterClickTargets tests.
 *
 * Proof points:
 *   (a) extractBandValue: reads GRAY_INDEX, falls back to first numeric prop.
 *   (b) buildRasterFeatureId / parseRasterFeatureId: encode/decode value.
 *   (c) registerRasterClickTargets() registers fri_raster_ and terrain_raster
 *       with readOnly:true.
 *   (d) match(): correct prefix matching; empty featureId is ok (raster path).
 *   (e) label(): value in subtitle from feature.properties.GRAY_INDEX.
 *   (f) buildOpenActions(): SHOW_NOTIFICATION action, plain, structuredClone-safe.
 *   (g) buildOpenActions() recovers value from synthetic featureId (panel path).
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

const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') { acc.push(`${path}.${k}`); }
        else if (v && typeof v === 'object') { collectFunctionPaths(v, `${path}.${k}`, acc); }
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
            it('returns a SHOW_NOTIFICATION action with the Mannings n value (C3)', () => {
                const actions = t().buildOpenActions(
                    feature('', { GRAY_INDEX: 0.04 })
                );
                expect(actions.length).toBe(1);
                expect(actions[0].type).toBe('SHOW_NOTIFICATION');
                expect(actions[0].message).toContain('0.04');
            });
            it('recovers value from synthetic featureId (panel round-trip)', () => {
                const syntheticId = buildRasterFeatureId('fri_raster_4_friction', 0.04);
                const actions = t().buildOpenActions(feature(syntheticId));
                expect(actions[0].type).toBe('SHOW_NOTIFICATION');
                expect(actions[0].message).toContain('0.04');
            });
            it('shows "Value unavailable" when no value found', () => {
                const actions = t().buildOpenActions(feature('fri_raster_4_friction#raster', {}));
                expect(actions[0].message).toContain('unavailable');
            });
            it('all actions are structuredClone-safe (D6, W4.1 AC3)', () => {
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
            it('returns a SHOW_NOTIFICATION action with elevation in metres (C3)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 12.34 }));
                expect(actions[0].type).toBe('SHOW_NOTIFICATION');
                expect(actions[0].message).toContain('12.34');
                expect(actions[0].message).toContain('m');
            });
            it('falls back to state.anuga.resources.cursorElevation when GRAY_INDEX absent', () => {
                const getState = () => ({ anuga: { resources: { cursorElevation: 5.5 } } });
                const actions = t().buildOpenActions(
                    feature('ele_42_cog#raster'),  // no value in synthetic id
                    getState
                );
                expect(actions[0].type).toBe('SHOW_NOTIFICATION');
                expect(actions[0].message).toContain('5.5');
            });
            it('all actions are structuredClone-safe (D6, W4.1 AC3)', () => {
                const actions = t().buildOpenActions(feature('', { GRAY_INDEX: 42.1 }));
                expect(collectFunctionPaths(actions)).toEqual([]);
                expect(() => structuredClone(actions)).toNotThrow();
            });
        });
    });
});

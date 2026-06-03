/**
 * TASK-1450 (W3) — Tests for temporalPatternPresets.js
 *
 * Covers:
 * - PRESET_FAMILIES lists the required pattern families
 * - getPreviewCurve returns null for alternating-block
 * - getPreviewCurve returns a non-empty curve for each named preset
 * - suggestPatternFromLatLon returns the correct suggestion for sample locations
 * - SET_TEMPORAL_PATTERN_PRESET reducer action
 */
import expect from 'expect';
import {
    PRESET_FAMILIES,
    ALTERNATING_BLOCK,
    SCS_TYPE_I,
    SCS_TYPE_IA,
    SCS_TYPE_II,
    SCS_TYPE_III,
    HUFF,
    SCS_SA,
    getPreviewCurve,
    suggestPatternFromLatLon,
    getSuggestionLabel
} from '../temporalPatternPresets';

import reducer from '../reducersHydrology';
import {
    setTemporalPatternPreset,
    SET_TEMPORAL_PATTERN_PRESET
} from '../actionsHydrology';

describe('TASK-1450 temporalPatternPresets', () => {
    // -------------------------------------------------------------------------
    describe('PRESET_FAMILIES', () => {
        it('contains alternating-block as first item (default)', () => {
            expect(PRESET_FAMILIES[0].id).toBe(ALTERNATING_BLOCK);
        });

        it('marks alternating-block as isMethod=true', () => {
            const ab = PRESET_FAMILIES.find(f => f.id === ALTERNATING_BLOCK);
            expect(ab.isMethod).toBe(true);
        });

        it('includes all required SCS types', () => {
            const ids = PRESET_FAMILIES.map(f => f.id);
            expect(ids.indexOf(SCS_TYPE_I)).toBeGreaterThan(-1);
            expect(ids.indexOf(SCS_TYPE_IA)).toBeGreaterThan(-1);
            expect(ids.indexOf(SCS_TYPE_II)).toBeGreaterThan(-1);
            expect(ids.indexOf(SCS_TYPE_III)).toBeGreaterThan(-1);
        });

        it('includes Huff family', () => {
            const ids = PRESET_FAMILIES.map(f => f.id);
            expect(ids.indexOf(HUFF)).toBeGreaterThan(-1);
        });

        it('includes SCS-SA family', () => {
            const ids = PRESET_FAMILIES.map(f => f.id);
            expect(ids.indexOf(SCS_SA)).toBeGreaterThan(-1);
        });

        it('every family has id, label, description', () => {
            PRESET_FAMILIES.forEach(f => {
                expect(f.id).toBeA('string');
                expect(f.label.length).toBeGreaterThan(0);
                expect(f.description.length).toBeGreaterThan(0);
            });
        });
    });

    // -------------------------------------------------------------------------
    describe('getPreviewCurve', () => {
        it('returns null for alternating_block', () => {
            expect(getPreviewCurve(ALTERNATING_BLOCK)).toBe(null);
        });

        it('returns null for an unknown key', () => {
            expect(getPreviewCurve('UNKNOWN_PATTERN')).toBe(null);
        });

        [SCS_TYPE_I, SCS_TYPE_IA, SCS_TYPE_II, SCS_TYPE_III, HUFF, SCS_SA].forEach(key => {
            it(`returns a non-empty {t, cum} array for ${key}`, () => {
                const curve = getPreviewCurve(key);
                expect(Array.isArray(curve)).toBe(true);
                expect(curve.length).toBeGreaterThan(5);
                // First point: t=0, cum=0
                expect(curve[0].t).toBe(0);
                expect(curve[0].cum).toBe(0);
                // Last point: t=1, cum=1
                const last = curve[curve.length - 1];
                expect(last.t).toBe(1);
                expect(last.cum).toBe(1);
                // Monotonically non-decreasing in cum
                for (let i = 1; i < curve.length; i++) {
                    expect(curve[i].cum).toBeGreaterThanOrEqualTo(curve[i - 1].cum);
                }
            });
        });
    });

    // -------------------------------------------------------------------------
    describe('suggestPatternFromLatLon', () => {
        it('returns ALTERNATING_BLOCK for null/undefined lat/lon', () => {
            expect(suggestPatternFromLatLon(null, null)).toBe(ALTERNATING_BLOCK);
            expect(suggestPatternFromLatLon(undefined, undefined)).toBe(ALTERNATING_BLOCK);
            expect(suggestPatternFromLatLon(null, 144)).toBe(ALTERNATING_BLOCK);
        });

        it('returns ALTERNATING_BLOCK for non-finite values', () => {
            expect(suggestPatternFromLatLon(NaN, 100)).toBe(ALTERNATING_BLOCK);
        });

        it('returns SCS_SA for Cape Town, South Africa (-33.9, 18.4)', () => {
            expect(suggestPatternFromLatLon(-33.9, 18.4)).toBe(SCS_SA);
        });

        it('returns SCS_SA for Johannesburg (-26.2, 28.0)', () => {
            expect(suggestPatternFromLatLon(-26.2, 28.0)).toBe(SCS_SA);
        });

        it('returns SCS_TYPE_II for most of CONUS — Chicago, IL (41.9, -87.6)', () => {
            // Chicago lat=41.9 is in Midwest lon range; expect HUFF
            expect(suggestPatternFromLatLon(41.9, -87.6)).toBe(HUFF);
        });

        it('returns HUFF for Kansas City, US Midwest (39.1, -94.6)', () => {
            expect(suggestPatternFromLatLon(39.1, -94.6)).toBe(HUFF);
        });

        it('returns SCS_TYPE_IA for Seattle, US Pacific NW (47.6, -122.3)', () => {
            expect(suggestPatternFromLatLon(47.6, -122.3)).toBe(SCS_TYPE_IA);
        });

        it('returns SCS_TYPE_III for Miami, US Gulf coast (25.8, -80.2)', () => {
            expect(suggestPatternFromLatLon(25.8, -80.2)).toBe(SCS_TYPE_III);
        });

        it('returns ALTERNATING_BLOCK for Mumbai, India (19.1, 72.9)', () => {
            expect(suggestPatternFromLatLon(19.1, 72.9)).toBe(ALTERNATING_BLOCK);
        });

        it('returns ALTERNATING_BLOCK for Nairobi, Kenya (-1.3, 36.8)', () => {
            expect(suggestPatternFromLatLon(-1.3, 36.8)).toBe(ALTERNATING_BLOCK);
        });

        it('returns ALTERNATING_BLOCK for Lagos, Nigeria (6.5, 3.4)', () => {
            expect(suggestPatternFromLatLon(6.5, 3.4)).toBe(ALTERNATING_BLOCK);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSuggestionLabel', () => {
        it('returns the family label for a known key', () => {
            const label = getSuggestionLabel(SCS_TYPE_II);
            expect(label.length).toBeGreaterThan(0);
            expect(label.toLowerCase().indexOf('type ii')).toBeGreaterThan(-1);
        });

        it('returns the key itself for an unknown key', () => {
            expect(getSuggestionLabel('UNKNOWN')).toBe('UNKNOWN');
        });
    });

    // -------------------------------------------------------------------------
    describe('SET_TEMPORAL_PATTERN_PRESET action + reducer', () => {
        it('setTemporalPatternPreset creates correct action', () => {
            const a = setTemporalPatternPreset('tp-1', SCS_TYPE_II);
            expect(a.type).toBe(SET_TEMPORAL_PATTERN_PRESET);
            expect(a.temporalPatternId).toBe('tp-1');
            expect(a.patternKey).toBe(SCS_TYPE_II);
        });

        it('reducer stores selectedPreset on the matching TemporalPattern', () => {
            // Seed a state with a temporal pattern item
            const { TemporalPattern } = require('../classesHydrology');
            const tp = new TemporalPattern();
            tp.id = 'tp-42';
            const stateBefore = reducer(undefined, { type: '@@INIT' });
            const stateWithTP = {
                ...stateBefore,
                temporalPatterns: [tp],
                activeHydrologyItem: tp
            };

            const stateAfter = reducer(
                stateWithTP,
                setTemporalPatternPreset('tp-42', SCS_SA)
            );
            expect(stateAfter.temporalPatterns[0].selectedPreset).toBe(SCS_SA);
            expect(stateAfter.activeHydrologyItem.selectedPreset).toBe(SCS_SA);
        });

        it('reducer leaves other patterns unchanged', () => {
            const { TemporalPattern } = require('../classesHydrology');
            const tp1 = new TemporalPattern();
            tp1.id = 'tp-1';
            const tp2 = new TemporalPattern();
            tp2.id = 'tp-2';
            const stateBefore = {
                ...reducer(undefined, { type: '@@INIT' }),
                temporalPatterns: [tp1, tp2],
                activeHydrologyItem: tp1
            };
            const stateAfter = reducer(
                stateBefore,
                setTemporalPatternPreset('tp-1', SCS_TYPE_III)
            );
            expect(stateAfter.temporalPatterns[0].selectedPreset).toBe(SCS_TYPE_III);
            // tp2 is unaffected
            expect(stateAfter.temporalPatterns[1].selectedPreset).toBe(undefined);
        });
    });
});

import expect from 'expect';
import {
    computePreview,
    isFieldPinned,
    parseLoadReductionFieldName,
    recomputeTotalsForPollutant,
    buildUnpinAllUpdates,
    PATHWAYS,
    POLLUTANTS
} from '../bmpPreviewMath';

describe('bmpPreviewMath', () => {
    describe('computePreview', () => {
        it('returns full reduction and zero new load when percent is 100', () => {
            const result = computePreview(100, 100);
            expect(result).toEqual({ reduction: 100, newLoad: 0 });
        });

        it('returns zero reduction and full new load when percent is 0', () => {
            const result = computePreview(50, 0);
            expect(result).toEqual({ reduction: 0, newLoad: 50 });
        });

        it('applies percentage correctly for typical value', () => {
            const result = computePreview(200, 25);
            expect(result.reduction).toBe(50);
            expect(result.newLoad).toBe(150);
        });

        it('handles null/undefined inputs gracefully', () => {
            expect(computePreview(null, 50)).toEqual({ reduction: 0, newLoad: 0 });
            expect(computePreview(100, null)).toEqual({ reduction: 0, newLoad: 100 });
            expect(computePreview(undefined, undefined)).toEqual({ reduction: 0, newLoad: 0 });
        });

        it('handles string inputs (coerces to number)', () => {
            const result = computePreview('100', '50');
            expect(result.reduction).toBe(50);
            expect(result.newLoad).toBe(50);
        });
    });

    describe('isFieldPinned', () => {
        it('returns true when the _manual companion is a number', () => {
            const form = { surface_n_load_reduction: 10, surface_n_load_reduction_manual: 12 };
            expect(isFieldPinned(form, 'surface_n_load_reduction')).toBe(true);
        });

        it('returns true when the _manual companion is 0 (0 is pinned)', () => {
            const form = { surface_n_load_reduction: 10, surface_n_load_reduction_manual: 0 };
            expect(isFieldPinned(form, 'surface_n_load_reduction')).toBe(true);
        });

        it('returns false when the _manual companion is null', () => {
            const form = { surface_n_load_reduction: 10, surface_n_load_reduction_manual: null };
            expect(isFieldPinned(form, 'surface_n_load_reduction')).toBe(false);
        });

        it('returns false when the _manual companion is undefined', () => {
            const form = { surface_n_load_reduction: 10 };
            expect(isFieldPinned(form, 'surface_n_load_reduction')).toBe(false);
        });

        it('returns false for null storedBmpForm', () => {
            expect(isFieldPinned(null, 'surface_n_load_reduction')).toBe(false);
        });

        it('returns false for empty field name', () => {
            expect(isFieldPinned({}, '')).toBe(false);
        });
    });

    describe('parseLoadReductionFieldName', () => {
        it('parses a standard load-reduction field', () => {
            expect(parseLoadReductionFieldName('surface_n_load_reduction'))
                .toEqual({ pathway: 'surface', pollutant: 'n' });
            expect(parseLoadReductionFieldName('tiled_p_load_reduction'))
                .toEqual({ pathway: 'tiled', pollutant: 'p' });
            expect(parseLoadReductionFieldName('erosion_s_load_reduction'))
                .toEqual({ pathway: 'erosion', pollutant: 's' });
        });

        it('returns null for non-load-reduction field names', () => {
            expect(parseLoadReductionFieldName('surface_previous_n_load')).toBe(null);
            expect(parseLoadReductionFieldName('surface_new_n_load')).toBe(null);
            expect(parseLoadReductionFieldName('total_n_load_reduction')).toBe(null);
        });

        it('returns null for invalid pathway or pollutant', () => {
            expect(parseLoadReductionFieldName('banana_n_load_reduction')).toBe(null);
            expect(parseLoadReductionFieldName('surface_x_load_reduction')).toBe(null);
        });

        it('returns null for non-string inputs', () => {
            expect(parseLoadReductionFieldName(null)).toBe(null);
            expect(parseLoadReductionFieldName(undefined)).toBe(null);
            expect(parseLoadReductionFieldName(42)).toBe(null);
        });
    });

    describe('recomputeTotalsForPollutant', () => {
        const baseForm = {
            surface_previous_n_load: 100,
            tiled_previous_n_load: 50,
            erosion_previous_n_load: 25,
            surface_n_load_reduction: 30,
            tiled_n_load_reduction: 10,
            erosion_n_load_reduction: 5,
            surface_new_n_load: 70,
            tiled_new_n_load: 40,
            erosion_new_n_load: 20
        };

        it('sums the three pathways using stored values when no updates', () => {
            const totals = recomputeTotalsForPollutant(baseForm, 'n', {});
            expect(totals.total_previous_n_load).toBe(175);
            expect(totals.total_n_load_reduction).toBe(45);
            expect(totals.total_new_n_load).toBe(130);
        });

        it('prefers _manual when pinned in store', () => {
            const form = { ...baseForm, surface_n_load_reduction_manual: 50 };
            const totals = recomputeTotalsForPollutant(form, 'n', {});
            expect(totals.total_n_load_reduction).toBe(65); // 50 + 10 + 5
        });

        it('prefers _manual in updates over stored _manual', () => {
            const form = { ...baseForm, surface_n_load_reduction_manual: 50 };
            const totals = recomputeTotalsForPollutant(form, 'n', {
                surface_n_load_reduction_manual: 99
            });
            expect(totals.total_n_load_reduction).toBe(114); // 99 + 10 + 5
        });

        it('treats explicit null in updates as unpinning (fall back to calculated)', () => {
            const form = { ...baseForm, surface_n_load_reduction_manual: 50 };
            const totals = recomputeTotalsForPollutant(form, 'n', {
                surface_n_load_reduction_manual: null
            });
            // unpinned => falls back to calculated surface_n_load_reduction (30)
            expect(totals.total_n_load_reduction).toBe(45); // 30 + 10 + 5
        });

        it('honors a direct updates[fieldName] value', () => {
            const totals = recomputeTotalsForPollutant(baseForm, 'n', {
                tiled_n_load_reduction: 77
            });
            expect(totals.total_n_load_reduction).toBe(112); // 30 + 77 + 5
        });

        it('returns empty dict for unknown pollutant', () => {
            expect(recomputeTotalsForPollutant(baseForm, 'x', {})).toEqual({});
        });

        it('derives new load as prev - red when no explicit new_load update', () => {
            const totals = recomputeTotalsForPollutant(baseForm, 'n', {
                surface_n_load_reduction_manual: 80
            });
            // surface: 100 - 80 = 20; tiled: 50 - 10 = 40; erosion: 25 - 5 = 20
            expect(totals.total_new_n_load).toBe(80);
        });
    });

    describe('buildUnpinAllUpdates', () => {
        it('returns nulls for every pathway x pollutant combination', () => {
            const updates = buildUnpinAllUpdates();
            expect(Object.keys(updates).length).toBe(9);
            for (const pathway of PATHWAYS) {
                for (const pollutant of POLLUTANTS) {
                    const key = `${pathway}_${pollutant}_load_reduction_manual`;
                    expect(updates[key]).toBe(null);
                }
            }
        });
    });

    describe('constants', () => {
        it('exports expected PATHWAYS and POLLUTANTS', () => {
            expect(PATHWAYS).toEqual(['surface', 'tiled', 'erosion']);
            expect(POLLUTANTS).toEqual(['n', 'p', 's']);
        });
    });
});

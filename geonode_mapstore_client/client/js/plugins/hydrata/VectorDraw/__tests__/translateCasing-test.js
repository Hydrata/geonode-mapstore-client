/*
 * TASK-824 (W3.1) — Tests for case-tolerant feature-property reads.
 *
 * Approach B (FE fallback chain): the `getProp` helper in translateRegistry.js
 * returns the first defined value across candidate keys. Translators
 * (boundaryTranslate.synthesizeIn, inflowTranslate.synthesizeIn) use it to
 * read both lowercase (current wire reality — PostGIS lowercases unquoted
 * identifiers) AND Title-case (legacy historical rows / server-side
 * serializer quirks) attribute keys.
 *
 * Approach A (ALTER COLUMN mgmt cmd to standardise wire column casing) was
 * rejected as too heavy for this bug class — could be done later as a one-
 * time clean break.
 *
 * Three pin sets:
 *   1. getProp() unit tests — precedence, falsy values, edge cases
 *   2. boundaryTranslate.synthesizeIn — Title-case fallback for data /
 *      data_constant / data_timeseries_id / boundary
 *   3. inflowTranslate.synthesizeIn — Title-case fallback for data /
 *      data_constant / data_timeseries_id
 */
import expect from 'expect';
import { getProp } from '../translateRegistry';
import { synthesizeIn as boundarySynthesizeIn } from '../boundaryTranslate';
import { synthesizeIn as inflowSynthesizeIn } from '../inflowTranslate';

describe('TASK-824 getProp helper', () => {

    it('returns the first-listed key when present (lowercase wins)', () => {
        // Lowercase comes first in the candidate list — PostGIS wire reality.
        expect(getProp({ data: 'A' }, 'data', 'Data')).toBe('A');
    });

    it('falls back to Title-case when lowercase is absent (legacy row path)', () => {
        expect(getProp({ Data: 'B' }, 'data', 'Data')).toBe('B');
    });

    it('precedence: when both casings present, lowercase wins (documented)', () => {
        // Documented precedence: lowercase wins. Matches the PostGIS wire
        // reality — the lowercase column is the source of truth, the
        // Title-case key is a legacy artefact.
        expect(getProp({ data: 'lower', Data: 'TITLE' }, 'data', 'Data')).toBe('lower');
    });

    it('returns undefined when no candidate key is present', () => {
        expect(getProp({ other: 1 }, 'data', 'Data')).toBe(undefined);
        expect(getProp({}, 'data', 'Data')).toBe(undefined);
    });

    it('treats null as defined (matches the cleared-column wire shape)', () => {
        // boundaryTranslate's non-Time branch strips per-column keys by
        // setting them to null on the wire. `null` must count as "present"
        // for the helper, or the Title-case fallback would mask a real
        // null and the picker would mis-read a cleared column as Set.
        expect(getProp({ data: null, Data: 'fallback' }, 'data', 'Data')).toBe(null);
    });

    it('skips undefined values (treats undefined as absent)', () => {
        expect(getProp({ data: undefined, Data: 'fallback' }, 'data', 'Data')).toBe('fallback');
    });

    it('falsy values (0, "", false) are treated as defined', () => {
        expect(getProp({ data: 0, Data: 'fallback' }, 'data', 'Data')).toBe(0);
        expect(getProp({ data: '', Data: 'fallback' }, 'data', 'Data')).toBe('');
        expect(getProp({ data: false, Data: 'fallback' }, 'data', 'Data')).toBe(false);
    });

    it('supports 3+ candidate keys', () => {
        expect(getProp({ DATA: 'shout' }, 'data', 'Data', 'DATA')).toBe('shout');
        expect(getProp({ data: 'lower', DATA: 'shout' }, 'data', 'Data', 'DATA')).toBe('lower');
    });

    it('handles null/undefined/non-object input defensively', () => {
        expect(getProp(null, 'data')).toBe(undefined);
        expect(getProp(undefined, 'data')).toBe(undefined);
        expect(getProp('not-an-object', 'data')).toBe(undefined);
        expect(getProp(42, 'data')).toBe(undefined);
    });

    it('skips empty/null candidate keys silently', () => {
        expect(getProp({ data: 'A' }, '', null, 'data')).toBe('A');
    });
});

describe('TASK-824 boundaryTranslate.synthesizeIn case-tolerance', () => {

    describe('Title-case fallback (legacy attributes_template casing)', () => {
        it('resolves Title-case Data_Constant → structured constant', () => {
            const out = boundarySynthesizeIn({
                Boundary: 'Time',
                Data_Constant: 5.5
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 5.5 });
            // Boundary discriminator normalized to lowercase so popup
            // validateTimeBoundaryFormValues + translateOut both read it.
            expect(out.boundary).toBe('Time');
            // Title-case keys stripped — they must NOT leak through to
            // formValues / wfstUpdate.
            expect(out.Boundary).toBe(undefined);
            expect(out.Data_Constant).toBe(undefined);
        });

        it('resolves Title-case Data_Timeseries_Id → structured timeseries', () => {
            const out = boundarySynthesizeIn({
                Boundary: 'Time',
                Data_Timeseries_Id: 17
            });
            expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 17 });
            expect(out.boundary).toBe('Time');
            expect(out.Data_Timeseries_Id).toBe(undefined);
        });

        it('resolves Title-case Data (legacy bare text) → numeric constant', () => {
            const out = boundarySynthesizeIn({
                Boundary: 'Time',
                Data: '42.0'
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 42 });
            expect(out.Data).toBe(undefined);
        });

        it('resolves Title-case Data (structured object) → preserved structured shape', () => {
            const out = boundarySynthesizeIn({
                Boundary: 'Time',
                Data: { kind: 'constant', constant: 9 }
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 9 });
            expect(out.Data).toBe(undefined);
        });
    });

    describe('lowercase precedence when both casings present', () => {
        it('lowercase data_constant wins over Title-case Data_Constant', () => {
            const out = boundarySynthesizeIn({
                boundary: 'Time',
                data_constant: 1,
                Data_Constant: 999
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 1 });
            expect(out.Data_Constant).toBe(undefined);
        });

        it('lowercase boundary wins over Title-case Boundary', () => {
            const out = boundarySynthesizeIn({
                boundary: 'Reflective',
                Boundary: 'Time'
            });
            expect(out.boundary).toBe('Reflective');
            expect(out.Boundary).toBe(undefined);
        });
    });

    describe('lowercase-only (current wire reality) still works', () => {
        it('lowercase data_constant continues to work unchanged', () => {
            const out = boundarySynthesizeIn({
                boundary: 'Time',
                data_constant: 7
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 7 });
            expect(out.boundary).toBe('Time');
            expect(out.data_constant).toBe(undefined);
        });
    });
});

describe('TASK-824 inflowTranslate.synthesizeIn case-tolerance', () => {

    describe('Title-case fallback', () => {
        it('resolves Title-case Data_Constant → structured constant', () => {
            const out = inflowSynthesizeIn({
                description: 'Storm',
                Data_Constant: 0.25
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 0.25 });
            expect(out.Data_Constant).toBe(undefined);
            expect(out.description).toBe('Storm');
        });

        it('resolves Title-case Data_Timeseries_Id → structured timeseries', () => {
            const out = inflowSynthesizeIn({
                Data_Timeseries_Id: 42
            });
            expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 42 });
            expect(out.Data_Timeseries_Id).toBe(undefined);
        });

        it('resolves Title-case Data (legacy numeric string) → constant', () => {
            const out = inflowSynthesizeIn({ Data: '100' });
            expect(out.data).toEqual({ kind: 'constant', constant: 100 });
            expect(out.Data).toBe(undefined);
        });

        it('resolves Title-case Data (non-numeric legacy) → drops data', () => {
            // Mirror of the lowercase non-numeric path: non-numeric legacy
            // text is a TimeSeries-name lookup the FE cannot resolve.
            const out = inflowSynthesizeIn({ Data: 'MyTimeSeries' });
            expect(out.data).toBe(undefined);
            expect(out.Data).toBe(undefined);
        });
    });

    describe('lowercase precedence when both casings present', () => {
        it('lowercase data_constant wins over Title-case Data_Constant', () => {
            const out = inflowSynthesizeIn({
                data_constant: 1.5,
                Data_Constant: 999
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 1.5 });
            expect(out.Data_Constant).toBe(undefined);
        });

        it('lowercase data_timeseries_id wins over Title-case Data_Timeseries_Id', () => {
            const out = inflowSynthesizeIn({
                data_timeseries_id: 3,
                Data_Timeseries_Id: 999
            });
            expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 3 });
            expect(out.Data_Timeseries_Id).toBe(undefined);
        });
    });

    describe('lowercase-only (current wire reality) still works', () => {
        it('lowercase data_constant continues to work unchanged', () => {
            const out = inflowSynthesizeIn({
                description: 'Rain',
                data_constant: 0.5
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 0.5 });
            expect(out.data_constant).toBe(undefined);
            expect(out.description).toBe('Rain');
        });
    });
});

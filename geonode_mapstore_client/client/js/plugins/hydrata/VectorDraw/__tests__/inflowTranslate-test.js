/*
 * TASK-850 (W2.3-FE) — Tests for the Inflow translator (translateOut +
 * synthesizeIn) registered under 'inf' in the VectorDraw translate registry.
 *
 * Mirrors wfstApiTimeBoundary-test.js (TASK-795) in structure — pure data
 * transforms, no axios / no Redux / no jsdom required.
 *
 * Wire contract being pinned here (Inflow has NO discriminator field, unlike
 * Boundary's `boundary === 'Time'` gate — every Inflow row carries a data
 * value, and the picker always renders):
 *   * kind='constant'   → emit data_constant only, strip data + data_timeseries_id
 *   * kind='timeseries' → emit data_timeseries_id only, strip data + data_constant
 *   * missing/empty     → strip all three (BE inf_data_xor CHECK fires)
 *   * legacy `data` text → NEVER emitted by new FE writes
 *
 * synthesizeIn is exercised separately so the EDIT-mode seeding path stays
 * correct when the BE returns a row that has either column populated (or a
 * legacy bare `data` text from pre-FeatureDataMixin migrations).
 */
import expect from 'expect';
import { translateOut, synthesizeIn } from '../inflowTranslate';
import {
    getTranslate,
    deriveTranslateKey,
    cleanTranslate
} from '../translateRegistry';

describe('TASK-850 inflowTranslate.translateOut', () => {

    describe('kind="constant"', () => {
        it('emits data_constant float, strips data + data_timeseries_id', () => {
            const input = {
                description: 'Rainfall north',
                type: 'Rainfall',
                data: { kind: 'constant', constant: 0.5 }
            };
            const out = translateOut(input);
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(0.5);
            // TASK-2159: the non-selected XOR column is emitted as explicit null
            // (not omitted) so a switch FROM timeseries clears the stale id.
            expect(out.data_timeseries_id).toBe(null);
            // Other fields preserved.
            expect(out.description).toBe('Rainfall north');
            expect(out.type).toBe('Rainfall');
        });

        it('coerces string constant to float (matches boundaryTranslate)', () => {
            const out = translateOut({
                type: 'Surface',
                data: { kind: 'constant', constant: '3.14' }
            });
            expect(out.data_constant).toBe(3.14);
            expect(typeof out.data_constant).toBe('number');
        });

        it('null/undefined/empty constant: strips data_constant (BE CHECK fires)', () => {
            const cases = [null, undefined, ''];
            cases.forEach(v => {
                const out = translateOut({
                    data: { kind: 'constant', constant: v }
                });
                expect(out.data).toBe(undefined);
                expect(out.data_constant).toBe(undefined);
                // Non-selected column cleared with explicit null (TASK-2159).
                expect(out.data_timeseries_id).toBe(null);
            });
        });
    });

    describe('kind="timeseries"', () => {
        it('emits data_timeseries_id int, strips data + data_constant', () => {
            const input = {
                description: 'Storm event',
                type: 'Surface',
                data: { kind: 'timeseries', timeseries_id: 42 }
            };
            const out = translateOut(input);
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(42);
            // Non-selected column cleared with explicit null (TASK-2159): a
            // switch FROM constant must NULL the stale data_constant.
            expect(out.data_constant).toBe(null);
        });

        it('coerces string timeseries_id to int', () => {
            const out = translateOut({
                data: { kind: 'timeseries', timeseries_id: '17' }
            });
            expect(out.data_timeseries_id).toBe(17);
            expect(typeof out.data_timeseries_id).toBe('number');
        });

        it('null/undefined/empty timeseries_id: strips data_timeseries_id (BE CHECK fires)', () => {
            const cases = [null, undefined, ''];
            cases.forEach(v => {
                const out = translateOut({
                    data: { kind: 'timeseries', timeseries_id: v }
                });
                expect(out.data).toBe(undefined);
                expect(out.data_timeseries_id).toBe(undefined);
                // Non-selected column cleared with explicit null (TASK-2159).
                expect(out.data_constant).toBe(null);
            });
        });
    });

    describe('missing / malformed shape', () => {
        it('no data key at all: strips both per-column keys (BE CHECK fires)', () => {
            const out = translateOut({ description: 'no-data-yet', type: 'Rainfall' });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
            expect(out.description).toBe('no-data-yet');
        });

        it('data is a bare string (legacy / not yet a structured shape): strips all three', () => {
            // FE never writes bare strings — but defensive: a stale legacy
            // row's `data` text could appear in formValues if a user opened
            // an old row, didn't interact with the picker, and saved.
            // synthesizeIn handles seeding from legacy bare strings; this
            // test pins that translateOut treats them as missing-shape.
            const out = translateOut({
                data: 'legacy-string-value',
                data_constant: 999,
                data_timeseries_id: 999
            });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });

        it('null/undefined input: returns an empty object (no crash)', () => {
            expect(translateOut(null)).toEqual({});
            expect(translateOut(undefined)).toEqual({});
        });

        it('input with neither boundary nor data: passes through other props', () => {
            const out = translateOut({ description: 'x', type: 'Rainfall' });
            expect(out.description).toBe('x');
            expect(out.type).toBe('Rainfall');
        });
    });

    describe('stale per-column keys are always overwritten/stripped', () => {
        // Defensive: if a row carries both a structured `data` shape AND
        // stale per-column keys from a previous save, translateOut must
        // emit only the column matching the structured kind.
        it('kind=constant + stale data_timeseries_id: emits constant, strips timeseries_id', () => {
            const out = translateOut({
                data: { kind: 'constant', constant: 1.5 },
                data_constant: 999,
                data_timeseries_id: 999
            });
            expect(out.data_constant).toBe(1.5);
            expect(out.data_timeseries_id).toBe(null);
        });

        it('kind=timeseries + stale data_constant: emits timeseries_id, strips constant', () => {
            const out = translateOut({
                data: { kind: 'timeseries', timeseries_id: 7 },
                data_constant: 999,
                data_timeseries_id: 999
            });
            expect(out.data_timeseries_id).toBe(7);
            expect(out.data_constant).toBe(null);
        });
    });
});

describe('TASK-850 inflowTranslate.synthesizeIn', () => {

    describe('reverse-maps per-column keys to structured shape', () => {
        it('data_constant=0.5 → {kind:"constant", constant:0.5}; strips per-column keys', () => {
            const out = synthesizeIn({
                description: 'Rain',
                type: 'Rainfall',
                data_constant: 0.5
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 0.5 });
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
            expect(out.description).toBe('Rain');
        });

        it('data_timeseries_id=42 → {kind:"hydrograph", timeseries_id:42}; strips per-column keys', () => {
            const out = synthesizeIn({
                description: 'Storm',
                type: 'Surface',
                data_timeseries_id: 42
            });
            // TASK-1970 W3: inf_ reconstructs to 'hydrograph', the inf_ timeseries-family kind.
            expect(out.data).toEqual({ kind: 'hydrograph', timeseries_id: 42 });
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });

        it('coerces string data_constant to float', () => {
            const out = synthesizeIn({ data_constant: '2.71' });
            expect(out.data).toEqual({ kind: 'constant', constant: 2.71 });
        });

        it('coerces string data_timeseries_id to int', () => {
            const out = synthesizeIn({ data_timeseries_id: '13' });
            expect(out.data).toEqual({ kind: 'hydrograph', timeseries_id: 13 });
        });

        // Timeseries beats constant when both are present (defensive — BE
        // CHECK forbids this state, but we should still produce a sensible
        // shape if a corrupted row sneaks in).
        it('both per-column keys present: timeseries-id column wins (→ hydrograph)', () => {
            const out = synthesizeIn({ data_constant: 1.5, data_timeseries_id: 9 });
            expect(out.data).toEqual({ kind: 'hydrograph', timeseries_id: 9 });
        });
    });

    describe('legacy bare `data` text fallback', () => {
        it("data='100' (numeric string) → {kind:'constant', constant:100}", () => {
            const out = synthesizeIn({ data: '100' });
            expect(out.data).toEqual({ kind: 'constant', constant: 100 });
        });

        it("data='3.14' (decimal string) → {kind:'constant', constant:3.14}", () => {
            const out = synthesizeIn({ data: '3.14' });
            expect(out.data).toEqual({ kind: 'constant', constant: 3.14 });
        });

        it("data='MyTimeSeries' (non-numeric) → drops data (user must re-pick)", () => {
            // TimeSeries-name lookups were a pre-FeatureDataMixin heuristic
            // the FE can't resolve without a server roundtrip. Drop and
            // force re-pick — surface as an unset picker rather than
            // auto-stuffing a stale name.
            const out = synthesizeIn({ data: 'MyTimeSeries' });
            expect(out.data).toBe(undefined);
        });

        it('data is a structured shape already: passes through unchanged', () => {
            const out = synthesizeIn({ data: { kind: 'timeseries', timeseries_id: 5 } });
            expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 5 });
        });
    });

    describe('edge cases', () => {
        it('null/undefined input: returns empty object', () => {
            expect(synthesizeIn(null)).toEqual({});
            expect(synthesizeIn(undefined)).toEqual({});
        });

        it('no data at all: returns input unchanged (sans per-column keys)', () => {
            const out = synthesizeIn({ description: 'x' });
            expect(out.description).toBe('x');
            expect(out.data).toBe(undefined);
        });
    });
});

describe('TASK-850 inflowTranslate registration side-effect', () => {
    // Importing ../inflowTranslate triggers registerTranslate('inf', ...)
    // at module-load time. Assert getTranslate('inf') returns a real
    // translator (not IDENTITY) and that the registry's deriveTranslateKey
    // resolves an `inf_*` typeName to this translator.
    it('getTranslate("inf") returns a non-IDENTITY translator', () => {
        const t = getTranslate('inf');
        // IDENTITY's translateOut is the identity function — calling it
        // with a structured shape preserves `data` as-is. Our real
        // translateOut strips `data`. Use that as the discriminator.
        const sample = { data: { kind: 'constant', constant: 1 } };
        const out = t.translateOut(sample);
        expect(out.data).toBe(undefined);
        expect(out.data_constant).toBe(1);
    });

    it('deriveTranslateKey("inf_3_inflow_north") resolves to the "inf" translator', () => {
        const key = deriveTranslateKey('inf_3_inflow_north');
        expect(key).toBe('inf');
        const t = getTranslate(key);
        // Same discriminator as above: real translator strips `data`.
        const out = t.translateOut({ data: { kind: 'timeseries', timeseries_id: 5 } });
        expect(out.data).toBe(undefined);
        expect(out.data_timeseries_id).toBe(5);
    });

    it('deriveTranslateKey("geonode:inf_3_inflow_north") (namespaced) also resolves', () => {
        const key = deriveTranslateKey('geonode:inf_3_inflow_north');
        expect(key).toBe('inf');
    });
});

// Cleanup hook intentionally NOT registered as afterAll/after — other tests
// that import boundaryTranslate / inflowTranslate after this file expect
// their side-effect registrations to persist. The translateRegistry-test.js
// file owns the cleanTranslate lifecycle for tests that need a fresh state.
// Reference cleanTranslate to silence the linter (used by sibling tests).
void cleanTranslate;

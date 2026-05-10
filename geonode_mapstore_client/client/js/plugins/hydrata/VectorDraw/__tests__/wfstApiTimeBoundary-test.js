/*
 * TASK-795 — Tests for the Time-boundary property translation helpers in
 * wfstApi.js. These are pure data transforms; no axios / no Redux / no
 * jsdom required.
 *
 * Wire contract being pinned here:
 *   * boundary !== 'Time'         → strip data, data_constant, data_timeseries_id
 *   * boundary === 'Time' (const) → emit data_constant only
 *   * boundary === 'Time' (ts)    → emit data_timeseries_id only
 *   * legacy `data` text column   → NEVER emitted by new FE writes
 *
 * The reverse (synthesizeTimeBoundaryFormValue) is exercised separately so
 * the EDIT-mode seeding path stays correct when the BE returns a row that
 * has either column populated.
 */
import expect from 'expect';
import {
    translateTimeBoundaryProperties,
    synthesizeTimeBoundaryFormValue
} from '../wfstApi';

describe('TASK-795 translateTimeBoundaryProperties', () => {

    describe('boundary !== "Time"', () => {
        it('strips legacy data + per-column data_constant + data_timeseries_id (Reflective)', () => {
            const input = {
                description: 'My Boundary',
                boundary: 'Reflective',
                location: 'External',
                data: { kind: 'constant', constant: 5 },
                data_constant: 5,
                data_timeseries_id: 42
            };
            const out = translateTimeBoundaryProperties(input);
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
            // Other fields preserved.
            expect(out.description).toBe('My Boundary');
            expect(out.boundary).toBe('Reflective');
            expect(out.location).toBe('External');
        });

        it('Dirichlet boundary: same strip behaviour', () => {
            const out = translateTimeBoundaryProperties({
                boundary: 'Dirichlet',
                data: { kind: 'constant', constant: 5 }
            });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });

        it('Transmissive boundary: same strip behaviour', () => {
            const out = translateTimeBoundaryProperties({
                boundary: 'Transmissive',
                data: 'legacy-string-value'
            });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
        });
    });

    describe('boundary === "Time" + kind="constant"', () => {
        it('emits data_constant float, omits data + data_timeseries_id', () => {
            const input = {
                description: 'Tide',
                boundary: 'Time',
                location: 'External',
                data: { kind: 'constant', constant: 5.5 }
            };
            const out = translateTimeBoundaryProperties(input);
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(5.5);
            expect(out.data_timeseries_id).toBe(undefined);
            expect(out.boundary).toBe('Time');
            expect(out.location).toBe('External');
            expect(out.description).toBe('Tide');
        });

        it('coerces string constant to float', () => {
            const out = translateTimeBoundaryProperties({
                boundary: 'Time',
                data: { kind: 'constant', constant: '3.14' }
            });
            expect(out.data_constant).toBe(3.14);
            expect(typeof out.data_constant).toBe('number');
        });

        it('null/undefined/empty constant: omits data_constant (BE CHECK fires)', () => {
            const cases = [null, undefined, ''];
            cases.forEach(v => {
                const out = translateTimeBoundaryProperties({
                    boundary: 'Time',
                    data: { kind: 'constant', constant: v }
                });
                expect(out.data_constant).toBe(undefined);
                expect(out.data_timeseries_id).toBe(undefined);
            });
        });
    });

    describe('boundary === "Time" + kind="timeseries"', () => {
        it('emits data_timeseries_id integer, omits data + data_constant', () => {
            const input = {
                description: 'T-series Inflow',
                boundary: 'Time',
                location: 'Internal',
                data: { kind: 'timeseries', timeseries_id: 42 }
            };
            const out = translateTimeBoundaryProperties(input);
            expect(out.data).toBe(undefined);
            expect(out.data_timeseries_id).toBe(42);
            expect(out.data_constant).toBe(undefined);
        });

        it('coerces string id to int', () => {
            const out = translateTimeBoundaryProperties({
                boundary: 'Time',
                data: { kind: 'timeseries', timeseries_id: '7' }
            });
            expect(out.data_timeseries_id).toBe(7);
            expect(typeof out.data_timeseries_id).toBe('number');
        });

        it('null/undefined/empty id: omits data_timeseries_id', () => {
            const cases = [null, undefined, ''];
            cases.forEach(v => {
                const out = translateTimeBoundaryProperties({
                    boundary: 'Time',
                    data: { kind: 'timeseries', timeseries_id: v }
                });
                expect(out.data_constant).toBe(undefined);
                expect(out.data_timeseries_id).toBe(undefined);
            });
        });
    });

    describe('non-Boundary layers (no `boundary` key)', () => {
        // Regression: pre-fix, translateTimeBoundaryProperties unconditionally
        // ran `delete props.data` before checking isTime, which silently
        // dropped Inflow's text `data: '100'` field. The next scenario run
        // would crash in Inflow.make_file's
        // `any(c.isalpha() for c in original_data)` heuristic with TypeError
        // on None. The function is now a pass-through when the props bag
        // lacks the `boundary` discriminator.
        it('inf_ formValues with `data` text: passes through unchanged', () => {
            const input = {
                description: 'Inflow A',
                location: 'External',
                data: '100'  // legitimate text column for inf_*
            };
            const out = translateTimeBoundaryProperties(input);
            expect(out.data).toBe('100');
            expect(out.description).toBe('Inflow A');
            expect(out.location).toBe('External');
        });

        it('inf_ formValues with `data` as TimeSeries name string: pass through', () => {
            const out = translateTimeBoundaryProperties({
                description: 'Inflow B',
                data: 'MyTimeSeriesName'  // legacy string-name lookup
            });
            expect(out.data).toBe('MyTimeSeriesName');
        });

        it('fri_ / str_ / mes_ formValues with no `boundary` key: pass through', () => {
            const inputs = [
                { description: 'Friction A', mannings_n: 0.04 },
                { description: 'Structure', kind: 'culvert' },
                { description: 'Mesh region', max_triangle_area: 100 }
            ];
            inputs.forEach(input => {
                const out = translateTimeBoundaryProperties(input);
                expect(out).toEqual(input);
            });
        });

        it('does NOT add data_constant or data_timeseries_id keys to a non-Boundary props bag', () => {
            const out = translateTimeBoundaryProperties({ description: 'X', data: '100' });
            expect('data_constant' in out).toBe(false);
            expect('data_timeseries_id' in out).toBe(false);
        });
    });

    describe('mixed / malformed inputs', () => {
        it('Time boundary with no data field at all: omits all three keys', () => {
            const out = translateTimeBoundaryProperties({
                boundary: 'Time',
                description: 'orphan'
            });
            expect(out.data).toBe(undefined);
            expect(out.data_constant).toBe(undefined);
            expect(out.data_timeseries_id).toBe(undefined);
            expect(out.boundary).toBe('Time');
        });

        it('null/undefined input: returns empty object', () => {
            expect(translateTimeBoundaryProperties(null)).toEqual({});
            expect(translateTimeBoundaryProperties(undefined)).toEqual({});
        });

        it('does NOT mutate the input object', () => {
            const input = {
                boundary: 'Time',
                data: { kind: 'constant', constant: 9 }
            };
            const before = JSON.stringify(input);
            translateTimeBoundaryProperties(input);
            expect(JSON.stringify(input)).toBe(before);
        });
    });
});

describe('TASK-795 synthesizeTimeBoundaryFormValue (EDIT-mode seeding)', () => {
    it('synthesises kind="constant" from data_constant column', () => {
        const out = synthesizeTimeBoundaryFormValue({
            description: 'Tide',
            boundary: 'Time',
            location: 'External',
            data_constant: 5.5,
            data_timeseries_id: null
        });
        expect(out.data).toEqual({ kind: 'constant', constant: 5.5 });
        // Per-column keys stripped — picker is the only reader.
        expect(out.data_constant).toBe(undefined);
        expect(out.data_timeseries_id).toBe(undefined);
        // Other fields preserved verbatim.
        expect(out.description).toBe('Tide');
        expect(out.boundary).toBe('Time');
        expect(out.location).toBe('External');
    });

    it('synthesises kind="timeseries" from data_timeseries_id column', () => {
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            data_constant: null,
            data_timeseries_id: 42
        });
        expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 42 });
        expect(out.data_constant).toBe(undefined);
        expect(out.data_timeseries_id).toBe(undefined);
    });

    it('prefers data_timeseries_id over data_constant when both populated (defensive)', () => {
        // BE CHECK should prevent this on the row, but defensive in case
        // a malformed seed slips through.
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            data_constant: 5.5,
            data_timeseries_id: 42
        });
        expect(out.data).toEqual({ kind: 'timeseries', timeseries_id: 42 });
    });

    it('preserves an existing structured data shape (idempotent on re-render)', () => {
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            data: { kind: 'constant', constant: 9 },
            data_constant: 99  // ignored: structured data wins
        });
        expect(out.data).toEqual({ kind: 'constant', constant: 9 });
    });

    it('parses legacy bare-text numeric `data` into kind="constant"', () => {
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            data: '7.25'
        });
        expect(out.data).toEqual({ kind: 'constant', constant: 7.25 });
    });

    it('drops legacy bare-text non-numeric `data` (no auto-stuff)', () => {
        // Legacy `data` was free text — could be a TimeSeries name. We
        // can't safely auto-resolve a name → id, so drop. The user must
        // re-pick on next save.
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            data: 'my-timeseries-name'
        });
        expect(out.data).toBe(undefined);
    });

    it('no data columns at all: data field stays absent', () => {
        const out = synthesizeTimeBoundaryFormValue({
            boundary: 'Time',
            description: 'Empty'
        });
        expect(out.data).toBe(undefined);
    });

    it('null/undefined input returns empty object', () => {
        expect(synthesizeTimeBoundaryFormValue(null)).toEqual({});
        expect(synthesizeTimeBoundaryFormValue(undefined)).toEqual({});
    });

    it('does NOT mutate the input object', () => {
        const input = {
            boundary: 'Time',
            data_constant: 5
        };
        const before = JSON.stringify(input);
        synthesizeTimeBoundaryFormValue(input);
        expect(JSON.stringify(input)).toBe(before);
    });
});

describe('TASK-795 round-trip: translate(synthesize(row)) == row (Time/constant)', () => {
    it('row with data_constant survives the full read→write cycle', () => {
        const seededRow = {
            description: 'My Boundary',
            boundary: 'Time',
            location: 'External',
            data_constant: 5.5,
            data_timeseries_id: null
        };
        // Read: BE row → seeded form values
        const formValues = synthesizeTimeBoundaryFormValue(seededRow);
        // Write: form values → wire properties
        const wireProps = translateTimeBoundaryProperties(formValues);
        // The data_timeseries_id is null in the seed and gets stripped by
        // synthesize → translate emits only data_constant + the unchanged
        // boundary/location/description fields.
        expect(wireProps).toEqual({
            description: 'My Boundary',
            boundary: 'Time',
            location: 'External',
            data_constant: 5.5
        });
        expect(wireProps.data).toBe(undefined);
        expect(wireProps.data_timeseries_id).toBe(undefined);
    });

    it('row with data_timeseries_id survives the full read→write cycle', () => {
        const seededRow = {
            description: 'TS Boundary',
            boundary: 'Time',
            location: 'Internal',
            data_constant: null,
            data_timeseries_id: 42
        };
        const formValues = synthesizeTimeBoundaryFormValue(seededRow);
        const wireProps = translateTimeBoundaryProperties(formValues);
        expect(wireProps).toEqual({
            description: 'TS Boundary',
            boundary: 'Time',
            location: 'Internal',
            data_timeseries_id: 42
        });
    });
});

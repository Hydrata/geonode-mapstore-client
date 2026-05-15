/*
 * TASK-795 / TASK-816 — Tests for the showWhen conditional-render predicate.
 *
 * The pure helper `matchesShowWhen(showWhen, formValues)` is exercised
 * directly. Supported predicates:
 *   { field: '<otherFieldName>', equals: <value> }       — TASK-795
 *   { field: '<otherFieldName>', notEquals: <value> }    — TASK-816
 *   { field: '<otherFieldName>', in: [<v1>, <v2>...] }   — TASK-816
 *
 * Add new predicate shapes by extending the helper + adding tests here.
 */
import expect from 'expect';
import { matchesShowWhen } from '../components/VectorDrawPopup';

describe('TASK-795 / TASK-816 matchesShowWhen', () => {
    it('returns true when showWhen is undefined (always render)', () => {
        expect(matchesShowWhen(undefined, { foo: 'bar' })).toBe(true);
    });

    it('returns true when showWhen is null', () => {
        expect(matchesShowWhen(null, { foo: 'bar' })).toBe(true);
    });

    describe('equals (TASK-795)', () => {
        it('returns true when the watched field equals the predicate', () => {
            expect(matchesShowWhen(
                { field: 'boundary', equals: 'Time' },
                { boundary: 'Time' }
            )).toBe(true);
        });

        it('returns false when the watched field does NOT equal the predicate', () => {
            expect(matchesShowWhen(
                { field: 'boundary', equals: 'Time' },
                { boundary: 'Reflective' }
            )).toBe(false);
        });

        it('returns false when the watched field is absent from formValues', () => {
            expect(matchesShowWhen(
                { field: 'boundary', equals: 'Time' },
                { description: 'no boundary key' }
            )).toBe(false);
        });

        it('returns false on null formValues for a known predicate', () => {
            expect(matchesShowWhen(
                { field: 'boundary', equals: 'Time' },
                null
            )).toBe(false);
        });
    });

    describe('notEquals (TASK-816)', () => {
        it('returns true when the watched field differs from the predicate', () => {
            expect(matchesShowWhen(
                { field: 'boundary', notEquals: 'Time' },
                { boundary: 'Reflective' }
            )).toBe(true);
        });

        it('returns false when the watched field equals the predicate', () => {
            expect(matchesShowWhen(
                { field: 'boundary', notEquals: 'Time' },
                { boundary: 'Time' }
            )).toBe(false);
        });

        it('returns true when the watched field is absent (undefined !== predicate)', () => {
            // Boundary case: missing field is "not equal" to any concrete
            // value — predicate matches, field renders. This is the inverse
            // behaviour of `equals` (which returns false when absent).
            expect(matchesShowWhen(
                { field: 'boundary', notEquals: 'Time' },
                { description: 'no boundary key' }
            )).toBe(true);
        });

        it('notEquals: null formValues → undefined !== predicate → true', () => {
            expect(matchesShowWhen(
                { field: 'boundary', notEquals: 'Time' },
                null
            )).toBe(true);
        });
    });

    describe('in (TASK-816)', () => {
        it('returns true when the current value is in the array', () => {
            expect(matchesShowWhen(
                { field: 'kind', "in": ['Culvert', 'Weir', 'Orifice'] },
                { kind: 'Weir' }
            )).toBe(true);
        });

        it('returns false when the current value is NOT in the array', () => {
            expect(matchesShowWhen(
                { field: 'kind', "in": ['Culvert', 'Weir'] },
                { kind: 'Orifice' }
            )).toBe(false);
        });

        it('returns false when the current value is undefined', () => {
            expect(matchesShowWhen(
                { field: 'kind', "in": ['Culvert', 'Weir'] },
                { description: 'no kind key' }
            )).toBe(false);
        });

        it('returns false when in:[] is empty (nothing to match)', () => {
            expect(matchesShowWhen(
                { field: 'kind', "in": [] },
                { kind: 'Culvert' }
            )).toBe(false);
        });

        it('returns false when `in` is malformed (not an array)', () => {
            // Recognised operator with bad value → predicate fails. Strict
            // (not defensive-true) because the developer typo'd — failing
            // closed is more debuggable than silently rendering.
            expect(matchesShowWhen(
                { field: 'kind', "in": 'Culvert' },
                { kind: 'Culvert' }
            )).toBe(false);
        });

        it('single-element in is equivalent to equals', () => {
            expect(matchesShowWhen(
                { field: 'kind', "in": ['Culvert'] },
                { kind: 'Culvert' }
            )).toBe(true);
            expect(matchesShowWhen(
                { field: 'kind', "in": ['Culvert'] },
                { kind: 'Weir' }
            )).toBe(false);
        });
    });

    it('returns true (defensive default) for unknown predicate operator keys', () => {
        // notEquals + in are now implemented (TASK-816). The
        // defensive-default branch still covers truly-unknown operators —
        // e.g. a typo'd `startsWith` — so a formConfig misstep renders
        // the field rather than silently hiding it.
        expect(matchesShowWhen(
            { field: 'boundary', startsWith: 'Ti' },
            { boundary: 'Reflective' }
        )).toBe(true);
    });
});

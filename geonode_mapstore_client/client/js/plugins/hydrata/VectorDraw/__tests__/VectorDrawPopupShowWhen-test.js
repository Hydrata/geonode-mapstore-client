/*
 * TASK-795 — Tests for the showWhen conditional-render predicate.
 *
 * The pure helper `matchesShowWhen(showWhen, formValues)` is exercised
 * directly. Only one predicate shape is supported today:
 *   { field: '<otherFieldName>', equals: <value> }
 *
 * Add new predicate shapes by extending the helper + adding tests here.
 */
import expect from 'expect';
import { matchesShowWhen } from '../components/VectorDrawPopup';

describe('TASK-795 matchesShowWhen', () => {
    it('returns true when showWhen is undefined (always render)', () => {
        expect(matchesShowWhen(undefined, { foo: 'bar' })).toBe(true);
    });

    it('returns true when showWhen is null', () => {
        expect(matchesShowWhen(null, { foo: 'bar' })).toBe(true);
    });

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

    it('returns true (defensive default) for unknown predicate shapes', () => {
        // Future predicate (e.g. notEquals) not yet implemented should
        // default to "render" so the field is at least visible — adding
        // a new predicate without updating call sites won't silently hide.
        expect(matchesShowWhen(
            { field: 'boundary', notEquals: 'Time' },
            { boundary: 'Reflective' }
        )).toBe(true);
    });
});

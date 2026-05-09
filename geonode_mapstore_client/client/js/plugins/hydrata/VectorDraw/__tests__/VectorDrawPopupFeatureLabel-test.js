import expect from 'expect';
import { featureLabel } from '../components/VectorDrawPopup';

/**
 * TASK-794 — Picker label fallback chain.
 *
 * Bug: pre-fix, the VectorDraw picker rows showed "Feature" (or the
 * numeric feature ID) instead of the user-typed Description. Root cause
 * was in ANUGA_FEATURE_CONFIG — Title-case `name` keys were silently
 * dropped by MapStore's WFS-T RequestBuilder because GeoServer's
 * DescribeFeatureType returns lowercase property names. New rows now
 * land with lowercase `description` columns populated, so the picker
 * label MUST prefer the lowercase casing.
 *
 * Title-case `Description` is retained as a fallback for legacy historical
 * rows that may have somehow round-tripped Title-case attribute values
 * pre-fix (case-insensitive PostGIS quirks on some GeoServer versions).
 */
describe('TASK-794 VectorDrawPopup featureLabel fallback chain', () => {

    it('returns properties.title (highest priority)', () => {
        const f = { properties: { title: 'tt', Title: 'TT', name: 'nn', description: 'dd', Description: 'DD' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('tt');
    });

    it('returns properties.Title when title absent', () => {
        const f = { properties: { Title: 'TT', name: 'nn', description: 'dd', Description: 'DD' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('TT');
    });

    it('returns properties.name when title/Title absent', () => {
        const f = { properties: { name: 'nn', description: 'dd', Description: 'DD' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('nn');
    });

    // BUG FIX: lowercase `description` MUST be preferred over Title-case
    // `Description` because new TASK-794 inserts land lowercase.
    it('returns lowercase description in preference to Title-case Description (TASK-794 bug fix)', () => {
        const f = { properties: { description: 'lower-wins', Description: 'TITLE_CASE_LOSES' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('lower-wins');
    });

    it('returns lowercase description on its own (typical post-TASK-794 row)', () => {
        const f = { properties: { description: 'TestPicker' }, id: 'bdy_4_test.42' };
        expect(featureLabel(f)).toBe('TestPicker');
    });

    it('returns Title-case Description as legacy back-compat (no lowercase available)', () => {
        const f = { properties: { Description: 'legacy' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('legacy');
    });

    it('returns feature.id when no descriptive properties present', () => {
        const f = { properties: {}, id: 'bdy_4_test.42' };
        expect(featureLabel(f)).toBe('bdy_4_test.42');
    });

    it('returns "Feature" when feature has no id and no descriptive properties', () => {
        const f = { properties: {} };
        expect(featureLabel(f)).toBe('Feature');
    });

    it('handles null feature gracefully', () => {
        expect(featureLabel(null)).toBe('Feature');
    });

    it('handles undefined feature gracefully', () => {
        expect(featureLabel(undefined)).toBe('Feature');
    });

    it('handles feature with no properties key', () => {
        const f = { id: 'fri_4_x.1' };
        expect(featureLabel(f)).toBe('fri_4_x.1');
    });

    it('skips empty string description (falsy → continues fallback chain)', () => {
        const f = { properties: { description: '', Description: 'fallback' }, id: 'x.1' };
        expect(featureLabel(f)).toBe('fallback');
    });
});

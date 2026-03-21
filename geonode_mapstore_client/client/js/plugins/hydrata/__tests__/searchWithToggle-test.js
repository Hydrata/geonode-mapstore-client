/**
 * Search plugin withToggle regression tests.
 *
 * Validates that Search.jsx getSearchAndToggleButton() respects
 * withToggle and enabled props on desktop screens. Also validates
 * the placeholder fallback logic.
 *
 * Regression guard for the 2026-03-19 bug where the desktop branch
 * returned (search) unconditionally, ignoring withToggle/enabled.
 *
 * These tests read the Search.jsx source via raw-loader to verify
 * the fix is present without needing the full MapStore store.
 */
import expect from 'expect';

// Load Search.jsx as raw text via webpack raw-loader
const rawResult = require(
    '!!raw-loader!@mapstore/framework/plugins/Search.jsx'
);
const searchSource = typeof rawResult === 'string' ? rawResult : (rawResult && rawResult.default);

describe('Search Plugin withToggle regression guard', () => {

    it('Search.jsx source is loaded', () => {
        expect(searchSource).toExist(
            'Search.jsx not found. Was the MapStore2 submodule updated?'
        );
        expect(searchSource.length).toBeGreaterThan(1000);
    });

    it('desktop branch respects withToggle and enabled props', () => {
        // The fix: desktop branch should check withToggle && !enabled
        // Before fix: ) : (search)
        // After fix:  ) : (this.props.withToggle && !this.props.enabled ? null : search)
        const hasWithToggleCheck = searchSource.includes(
            'this.props.withToggle && !this.props.enabled ? null : search'
        );
        expect(hasWithToggleCheck).toBe(true,
            'Search.jsx desktop branch does not check withToggle/enabled. ' +
            'The line should be: (this.props.withToggle && !this.props.enabled ? null : search). ' +
            'This was the root cause of the 2026-03-19 regression.'
        );
    });

    it('placeholder falls back to this.props.placeholder', () => {
        // The fix: placeholder={this.getServiceOverrides("placeholder") || this.props.placeholder}
        // Before fix: placeholder={this.getServiceOverrides("placeholder")}
        const hasPlaceholderFallback = searchSource.includes(
            'this.getServiceOverrides("placeholder") || this.props.placeholder'
        );
        expect(hasPlaceholderFallback).toBe(true,
            'Search.jsx does not fall back to this.props.placeholder when ' +
            'getServiceOverrides returns undefined. ' +
            'Fix: placeholder={this.getServiceOverrides("placeholder") || this.props.placeholder}'
        );
    });

    it('withToggle prop accepts array type for media queries', () => {
        const hasArrayType = searchSource.includes('PropTypes.array');
        const hasWithToggleProp = searchSource.includes('withToggle:');
        expect(hasWithToggleProp).toBe(true);
        expect(hasArrayType).toBe(true);
    });

    it('enabled prop reads from controls.search.enabled state', () => {
        const hasEnabledSelector = (
            searchSource.includes('controls') &&
            searchSource.includes('search') &&
            searchSource.includes('.enabled')
        );
        expect(hasEnabledSelector).toBe(true);
    });
});

/**
 * TASK-1857 (epic 1814 W3.3) — ElevationReadout component spec.
 *
 * Tests the pure ElevationReadout component (named export) independently of
 * Redux connect.  The connected default export is tested implicitly by
 * anugaContainer.js integration, not here.
 *
 * Spec:
 *   1. renders null when cursorElevation is null
 *   2. renders null when cursorElevation is undefined
 *   3. renders "Elevation: X.XX m" with 2 decimal places for a float
 *   4. renders negative elevation correctly
 *   5. renders zero correctly as "Elevation: 0.00 m"
 */
import React from 'react';
import expect from 'expect';
import { renderToStaticMarkup } from 'react-dom/server';

import { ElevationReadout } from '../components/ElevationReadout';

// Render helper: returns the outer HTML string or empty string for null.
const render = (props) => renderToStaticMarkup(<ElevationReadout {...props} />);

describe('ElevationReadout (TASK-1857)', () => {
    it('renders null when cursorElevation is null', () => {
        const html = render({ cursorElevation: null });
        expect(html).toBe('');
    });

    it('renders null when cursorElevation is undefined', () => {
        const html = render({ cursorElevation: undefined });
        expect(html).toBe('');
    });

    it('renders "Elevation: X.XX m" with 2 decimal places for a positive float', () => {
        const html = render({ cursorElevation: 427.5 });
        expect(html).toContain('Elevation: 427.50 m');
    });

    it('renders negative elevation correctly', () => {
        const html = render({ cursorElevation: -3.7 });
        expect(html).toContain('Elevation: -3.70 m');
    });

    it('renders zero as "Elevation: 0.00 m"', () => {
        const html = render({ cursorElevation: 0 });
        expect(html).toContain('Elevation: 0.00 m');
    });

    it('includes the anuga-elevation-readout class', () => {
        const html = render({ cursorElevation: 100 });
        expect(html).toContain('anuga-elevation-readout');
    });

    it('rounds to 2 decimal places (3.14159 → 3.14)', () => {
        const html = render({ cursorElevation: 3.14159 });
        expect(html).toContain('Elevation: 3.14 m');
    });
});

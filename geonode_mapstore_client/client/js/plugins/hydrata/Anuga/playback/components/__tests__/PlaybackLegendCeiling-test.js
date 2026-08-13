/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2751 (W6.3, epic 2706) — the legend's ceiling row.
 *
 * WHY A ROW OF ITS OWN, and not "make the top stop editable":
 *
 * The legend draws SLD-derived stops and clips them to `<= ceiling`
 * (PlaybackLegend's clipStops/visibleStops/topStop). Depth's stops are
 * 0, 0.05, 0.1, 0.2, 0.5, 1, 2, 3, 4, 5, 6 — so at a ceiling of 1.5 the top
 * VISIBLE stop is 1, rendered "1 m+". The ceiling is 1.5 and appears nowhere.
 *
 * Clicking that row to edit the ceiling would mean editing a number the user
 * was never shown, and the swatch beside it belongs to the 1 m stop, not to
 * the ceiling. So the ceiling gets its own row, above the swatch list, and
 * the swatch list is left exactly as it was.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { PlaybackLegendComponent } from '../PlaybackLegend';

describe('Playback legend ceiling row — TASK-2751', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function render(props) {
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" {...props} />, container);
    }
    const q = (sel) => container.querySelector(`[data-testid="${sel}"]`);

    it('shows the CEILING, which is not the top visible stop', () => {
        // Ceiling 1.5 clips depth's stops at 1 — the two numbers differ, and
        // that difference is the whole reason this row exists.
        render({ colorMaxOverride: 1.5 });
        const topSwatchRow = q('playback-legend-row-1');
        expect(topSwatchRow).toExist('depth clipped at 1.5 should still show the 1 m stop');
        expect(topSwatchRow.textContent).toInclude('1 m');

        const ceiling = q('playback-legend-ceiling');
        expect(ceiling).toExist('the legend needs a row that IS the ceiling');
        expect(ceiling.textContent).toInclude('1.5');
    });

    it('leaves the SLD swatch rows untouched', () => {
        render({ colorMaxOverride: 1.5 });
        ['playback-legend-row-0', 'playback-legend-row-0.5', 'playback-legend-row-1']
            .forEach((testid) => expect(q(testid)).toExist(`${testid} should survive`));
        expect(q('playback-legend-row-2')).toBe(null, 'stops above the ceiling stay clipped');
    });

    it('is editable, and commits against the displayed quantity', () => {
        const onSetColorMax = expect.createSpy();
        render({ quantity: 'speed', colorMaxOverride: 2, onSetColorMax });
        TestUtils.Simulate.click(q('playback-legend-ceiling'));
        const input = q('playback-legend-ceiling-input');
        expect(input).toExist();
        TestUtils.Simulate.change(input, { target: { value: '1.25' } });
        TestUtils.Simulate.keyDown(input, { key: 'Enter' });
        expect(onSetColorMax.calls.length).toBe(1);
        expect(onSetColorMax.calls[0].arguments[0]).toBe('speed');
        expect(onSetColorMax.calls[0].arguments[1]).toBe(1.25);
    });

    it('offers the reset-to-store affordance only while overridden', () => {
        render({ colorMaxOverride: 1.5 });
        expect(q('playback-legend-ceiling-reset')).toExist();
        render({ colorMaxOverride: undefined });
        expect(q('playback-legend-ceiling-reset')).toBe(null);
    });

    it('is absent for hazard — a classification has no ceiling to raise', () => {
        render({ quantity: 'hazard' });
        expect(q('playback-legend-ceiling')).toBe(null);
        expect(q('playback-legend-hazard-H1')).toExist('the discrete class list is unaffected');
    });

    it('never says "max" — that word is the temporal envelope (TASK-2752)', () => {
        render({ colorMaxOverride: 1.5 });
        const ceiling = q('playback-legend-ceiling');
        expect(ceiling.textContent.toLowerCase()).toNotInclude('max');
        expect((ceiling.getAttribute('aria-label') || '').toLowerCase()).toNotInclude('max');
    });
});

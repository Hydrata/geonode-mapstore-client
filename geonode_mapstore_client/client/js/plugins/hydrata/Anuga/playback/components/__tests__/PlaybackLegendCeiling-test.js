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
 * It is the one place the ceiling can be TYPED. It also used to be the only
 * place the ceiling appeared at all — the legend clipped its SLD stops to
 * `<= ceiling`, so at a ceiling of 1.5 depth's top visible stop was 1,
 * rendered "1 m+", and 1.5 showed nowhere. Clicking THAT row to edit the
 * ceiling would have meant editing a number the user was never shown.
 *
 * TASK-2784 (W7) removed the clipping — a reader-set ceiling now stretches
 * the ramp, so the top stop stands for the ceiling and the two agree. The row
 * survives on the first reason alone.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { PlaybackLegendComponent } from '../PlaybackLegend';
import { DEPTH_SLD_STOPS } from '../../playbackColormap';

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

    // TASK-2784 (W7) rewrote what this row sits beside. It used to assert the
    // OPPOSITE — that the ceiling and the top stop necessarily disagree,
    // because the stop list was clipped and its top row was the largest SLD
    // stop below the ceiling. Now the ramp stretches, so they agree; the row
    // remains as the place the number is typed.
    it('shows the CEILING, and the top stop now carries the same value', () => {
        render({ colorMaxOverride: 1.5 });

        const ceiling = q('playback-legend-ceiling');
        expect(ceiling).toExist('the legend needs a row that IS the ceiling');
        expect(ceiling.textContent).toInclude('1.5');

        // depth's top SLD stop is 6 m; under a 1.5 m ceiling it stands for 1.5
        const topSwatchRow = q('playback-legend-row-6');
        expect(topSwatchRow).toExist('the ramp\'s last stop must still be reachable');
        expect(topSwatchRow.textContent).toInclude('1.50 m+');
    });

    it('keeps every SLD swatch row, rescaled onto the new ceiling', () => {
        render({ colorMaxOverride: 1.5 });
        // The stop the OLD clipping behaviour dropped. Nothing is unreachable
        // any more, so nothing is hidden — 2 m of a 6 m ramp is a quarter of
        // the way up, which under a 1.5 m ceiling is 0.50 m.
        const rescaled = q('playback-legend-row-2');
        expect(rescaled).toExist('stops above the ceiling are rescaled, not clipped');
        expect(rescaled.textContent).toInclude('0.50 m');

        const rows = container.querySelectorAll('[data-testid^="playback-legend-row-"]');
        expect(rows.length).toBe(DEPTH_SLD_STOPS.length);
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

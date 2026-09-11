/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-3076 (AC8/AC9) — the legend's FLOOR, in the same row as its ceiling.
 *
 * The legend mounts the same EditableCeiling the drawer does, so the floor's
 * testid here is `playback-legend-ceiling-floor`. An ACTIVE floor adds one row
 * below the stop list — `below <floor> <unit>: hidden` — and mutes the stop
 * rows whose value sits under it (class only: same rows, same swatches, same
 * labels). "hidden", not "not drawn" or "dry": with a tinted dry sheet those
 * pixels ARE drawn, in the sheet's colour.
 *
 * Whether the floor is active is decided by playbackController's ONE
 * predicate, isColorFloorActive — the legend never compares numbers itself.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { PlaybackLegendComponent } from '../PlaybackLegend';
import { DEPTH_SLD_STOPS } from '../../playbackColormap';

const DEPTH_QUANTIZATION = { depth: { valid_max: 16.862720489501953 } };

describe('Playback legend floor — TASK-3076', () => {
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
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={DEPTH_QUANTIZATION} {...props} />, container);
    }
    const q = (sel) => container.querySelector(`[data-testid="${sel}"]`);
    const stopRows = () => Array.from(container.querySelectorAll('[data-testid^="playback-legend-row-"]')).map((row) => ({
        testid: row.getAttribute('data-testid'),
        swatch: row.querySelector('.sv-playback-legend-swatch').style.backgroundColor,
        label: row.querySelector('.sv-playback-legend-label').textContent,
        below: row.className.indexOf('is-below-floor') !== -1
    }));

    it('AC8 — the ceiling row carries the floor button too, reading ≥ — while unset', () => {
        render({});
        const floor = q('playback-legend-ceiling-floor');
        expect(floor).toExist('the legend needs a floor beside its ceiling');
        expect(floor.textContent).toInclude('≥');
        expect(floor.textContent).toInclude('—');
        expect(q('playback-legend-ceiling')).toExist('the ceiling testid survives verbatim');
        expect(q('playback-legend-floor-row')).toBe(null, 'no floor, no legend row');
    });

    it('AC8 — the floor commits through onSetColorFloor against the displayed quantity', () => {
        const onSetColorFloor = expect.createSpy();
        render({ quantity: 'speed', onSetColorFloor });
        TestUtils.Simulate.click(q('playback-legend-ceiling-floor'));
        const input = q('playback-legend-ceiling-floor-input');
        expect(input).toExist();
        TestUtils.Simulate.change(input, { target: { value: '0.2' } });
        TestUtils.Simulate.keyDown(input, { key: 'Enter' });
        expect(onSetColorFloor.calls.length).toBe(1);
        expect(onSetColorFloor.calls[0].arguments).toEqual(['speed', 0.2]);
    });

    it('AC9 — an ACTIVE floor adds the "below X: hidden" row and mutes only the stops under it', () => {
        render({});
        const before = stopRows();
        expect(before.length).toBe(DEPTH_SLD_STOPS.length);
        expect(before.some((r) => r.below)).toBe(false);

        render({ colorFloorOverride: 0.3 });
        const row = q('playback-legend-floor-row');
        expect(row).toExist('an active floor is stated in the legend');
        expect(row.textContent).toInclude('0.3');
        expect(row.textContent).toInclude('m');
        expect(row.textContent.toLowerCase()).toInclude('hidden');
        expect(row.textContent.toLowerCase()).toNotInclude('dry');
        expect(row.textContent.toLowerCase()).toNotInclude('not drawn');

        const after = stopRows();
        // same row set, same swatches, same labels — only the class differs
        expect(after.map((r) => r.testid)).toEqual(before.map((r) => r.testid));
        expect(after.map((r) => r.swatch)).toEqual(before.map((r) => r.swatch));
        expect(after.map((r) => r.label)).toEqual(before.map((r) => r.label));
        // rows render high -> low; depth's SLD stops under 0.3 m are 0.2, 0.1, 0.05 and 0
        const muted = after.filter((r) => r.below).map((r) => r.testid);
        expect(muted).toEqual(['playback-legend-row-0.2', 'playback-legend-row-0.1', 'playback-legend-row-0.05', 'playback-legend-row-0']);
        // the floor button itself reads the value and is styled as an override
        expect(q('playback-legend-ceiling-floor').textContent).toBe('≥ 0.3 m');
        expect(q('playback-legend-ceiling-floor').className).toInclude('is-override');
        expect(q('playback-legend-ceiling-floor-reset')).toExist();
    });

    it('AC9 — the muted set follows a RESCALED ramp: under a 1.5 m ceiling the labels move, and so does the cut', () => {
        // stops rescaled onto 1.5 m: 6 -> 1.5, 5 -> 1.25, 4 -> 1, 3 -> 0.75, 2 -> 0.5,
        // 1 -> 0.25, 0.5 -> 0.125, 0.2 -> 0.05, 0.1 -> 0.025, 0.05 -> 0.0125, 0 -> 0
        render({ colorMaxOverride: 1.5, colorFloorOverride: 0.3 });
        const muted = stopRows().filter((r) => r.below).map((r) => r.testid);
        expect(muted).toEqual([
            'playback-legend-row-1', 'playback-legend-row-0.5', 'playback-legend-row-0.2',
            'playback-legend-row-0.1', 'playback-legend-row-0.05', 'playback-legend-row-0'
        ]);
    });

    it('AC8 — an INERT stored floor (above the ceiling) shows muted with a reset, adds no row and mutes no stop', () => {
        render({ colorMaxOverride: 1.5, colorFloorOverride: 2 });
        const floor = q('playback-legend-ceiling-floor');
        expect(floor.textContent).toBe('≥ 2 m');
        expect(floor.className).toInclude('is-inert');
        expect(q('playback-legend-ceiling-floor-reset')).toExist('a stored floor can always be reset');
        expect(q('playback-legend-floor-row')).toBe(null);
        expect(stopRows().some((r) => r.below)).toBe(false);
    });

    it('AC8 — a floor of 0 on depth is inert (the ramp minimum is not inside the range)', () => {
        render({ colorFloorOverride: 0 });
        expect(q('playback-legend-ceiling-floor').className).toInclude('is-inert');
        expect(q('playback-legend-floor-row')).toBe(null);
    });

    it('AC7 — hazard has no floor: the whole range row is absent for a classification', () => {
        render({ quantity: 'hazard' });
        expect(q('playback-legend-ceiling-floor')).toBe(null);
        expect(q('playback-legend-ceiling')).toBe(null);
        expect(q('playback-legend-floor-row')).toBe(null);
    });

    it('the floor row never says min / minimum / max', () => {
        render({ colorFloorOverride: 0.3 });
        const floor = q('playback-legend-ceiling-floor');
        const visible = [floor.textContent, floor.getAttribute('aria-label') || '', floor.getAttribute('title') || '',
            q('playback-legend-floor-row').textContent].join(' ').toLowerCase();
        expect(visible).toNotInclude('min');
        expect(visible).toNotInclude('max');
    });
});

/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import expect from 'expect';

import {
    AnugaPlaybackControlBarComponent,
    scrubberTicks,
    tickUnitFor,
    tickBudgetForWidth
} from '../AnugaPlaybackControlBar';
import { createInitialPlaybackState, PLAYBACK_STATUS } from '../../playbackController';

/*
 * TASK-2751 follow-up — transient status moves OFF the transport row into a
 * floating toast, and the freed width goes to the scrubber, which gains a
 * tick axis with units.
 *
 * The width outcome itself is CSS and is measured live in the browser; what
 * this file pins is the structure that outcome depends on — that the status
 * elements are no longer children of the row, that the toast is absent when
 * there is nothing to say, and that the tick maths is right.
 */
describe('Playback status toast + scrubber tick axis', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // A uniform 31-frame / 30-minute run, the Msimbazi UAT fixture's shape.
    const uniformTime = () => Float64Array.from({ length: 31 }, (_, i) => i * 60);

    function readyState(over) {
        return {
            ...createInitialPlaybackState(),
            status: PLAYBACK_STATUS.READY,
            nTime: 31,
            time: uniformTime(),
            currentTimestep: 0,
            ...over
        };
    }
    function render(props) {
        ReactDOM.render(<AnugaPlaybackControlBarComponent {...props} />, container);
    }
    const q = (sel, root) => (root || container).querySelector(`[data-testid="${sel}"]`);

    describe('the toast', () => {
        it('does NOT mount when there is nothing to say', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-toast')).toBe(null);
        });

        it('mounts while buffering, and carries the buffering label', () => {
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING }) });
            const toast = q('anuga-playback-toast');
            expect(toast).toBeTruthy();
            expect(q('anuga-playback-buffering', toast)).toBeTruthy();
        });

        it('mounts for the degraded warning on its own', () => {
            render({ playback: readyState({ degraded: true }) });
            const toast = q('anuga-playback-toast');
            expect(toast).toBeTruthy();
            expect(q('anuga-playback-degraded', toast)).toBeTruthy();
            // Not buffering — the warning must not drag a stale status label in.
            expect(q('anuga-playback-buffering', toast)).toBe(null);
        });

        describe('dismissing the degraded warning', () => {
            it('offers a dismiss control beside the warning', () => {
                render({ playback: readyState({ degraded: true }) });
                expect(q('anuga-playback-degraded-dismiss')).toBeTruthy();
            });

            it('the control calls onDismissDegraded', () => {
                const onDismissDegraded = expect.createSpy();
                render({ playback: readyState({ degraded: true }), onDismissDegraded });
                TestUtils.Simulate.click(q('anuga-playback-degraded-dismiss'));
                expect(onDismissDegraded.calls.length).toBe(1);
            });

            it('a dismissed warning does not render', () => {
                render({ playback: readyState({ degraded: true, degradedDismissed: true }) });
                expect(q('anuga-playback-degraded')).toBe(null);
            });

            /* Dismissing the warning must not suppress the buffering label —
               they answer different questions ("is it working" vs "is it
               struggling"). */
            it('dismissing does not silence the buffering status', () => {
                render({ playback: readyState({
                    status: PLAYBACK_STATUS.BUFFERING, degraded: true, degradedDismissed: true
                }) });
                expect(q('anuga-playback-toast')).toBeTruthy();
                expect(q('anuga-playback-buffering')).toBeTruthy();
                expect(q('anuga-playback-degraded')).toBe(null);
            });

            it('with nothing else to say, a dismissed warning leaves no empty toast', () => {
                render({ playback: readyState({ degraded: true, degradedDismissed: true }) });
                expect(q('anuga-playback-toast')).toBe(null);
            });
        });

        it('carries the mesh-phase progress readout', () => {
            render({ playback: readyState({
                status: PLAYBACK_STATUS.LOADING_MESH,
                loadProgress: { objectsLoaded: 3, objectCount: 7, bytesLoaded: 1048576 }
            }) });
            const line = q('anuga-playback-load-progress', q('anuga-playback-toast'));
            expect(line).toBeTruthy();
            expect(line.textContent).toContain('3/7');
        });

        it('is announced politely rather than as an alert', () => {
            render({ playback: readyState({ degraded: true }) });
            const toast = q('anuga-playback-toast');
            expect(toast.getAttribute('role')).toBe('status');
            expect(toast.getAttribute('aria-live')).toBe('polite');
        });

        /* THE POINT OF THE CHANGE. Both of these used to be children of the
           transport row, holding 325.6px of it hostage to text that is empty
           most of the time. */
        it('neither status element is a descendant of the transport row', () => {
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING, degraded: true }) });
            const transport = q('anuga-playback-transport');
            expect(q('anuga-playback-buffering', transport)).toBe(null);
            expect(q('anuga-playback-degraded', transport)).toBe(null);
            expect(q('anuga-playback-load-progress', transport)).toBe(null);
        });

        it('the retired fixed-width status slot is gone entirely', () => {
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING }) });
            expect(q('anuga-playback-status')).toBe(null);
        });

        /* AC6 restated for the new mechanism: the toast is out of flow, so the
           row's child list cannot notice it at all. */
        it('mounting the toast does not change the transport row child list', () => {
            const ids = () => Array.from(q('anuga-playback-transport').children)
                .map((el) => el.getAttribute('data-testid'));
            render({ playback: readyState() });
            const atRest = ids();
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING, degraded: true }) });
            expect(ids()).toEqual(atRest);
        });
    });

    describe('the tick axis', () => {
        it('renders ticks inside the scrubber track', () => {
            render({ playback: readyState() });
            const axis = q('anuga-playback-ticks');
            expect(axis).toBeTruthy();
            expect(q('anuga-playback-scrubber-track').contains(axis)).toBe(true);
            expect(axis.querySelectorAll('.sv-playback-tick').length).toBeGreaterThan(2);
        });

        it('is hidden from screen readers — the slider already announces its value', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-ticks').getAttribute('aria-hidden')).toBe('true');
        });

        it('labels the axis with a unit exactly once, on the last tick', () => {
            render({ playback: readyState() });
            expect(container.querySelectorAll('[data-testid="anuga-playback-tick-unit"]').length).toBe(1);
            const marks = q('anuga-playback-ticks').querySelectorAll('.sv-playback-tick');
            expect(marks[marks.length - 1].querySelector('[data-testid="anuga-playback-tick-unit"]')).toBeTruthy();
        });

        it('still renders the axis band when the run has no time array', () => {
            // The band is reserved in CSS; the container must exist so the
            // height cannot change when `time` arrives.
            render({ playback: readyState({ time: null }) });
            const axis = q('anuga-playback-ticks');
            expect(axis).toBeTruthy();
            expect(axis.querySelectorAll('.sv-playback-tick').length).toBe(0);
        });
    });

    describe('scrubberTicks', () => {
        it('picks minutes and a 5-minute step for a 30-minute run', () => {
            const { unit, step, ticks } = scrubberTicks(uniformTime(), 31);
            expect(unit).toBe('min');
            expect(step).toBe(5);
            expect(ticks.map((t) => t.value)).toEqual([0, 5, 10, 15, 20, 25, 30]);
        });

        it('spans the full track, first tick at 0 and last at 1', () => {
            const { ticks } = scrubberTicks(uniformTime(), 31);
            expect(ticks[0].frac).toBe(0);
            expect(ticks[ticks.length - 1].frac).toBe(1);
        });

        it('never exceeds the requested tick budget', () => {
            [7, 31, 61, 145, 500].forEach((n) => {
                const time = Float64Array.from({ length: n }, (_, i) => i * 60);
                expect(scrubberTicks(time, n).ticks.length).toBeLessThan(11);
            });
        });

        /* The axis has to fit the track it is drawn in. Choosing the count from
           the time span alone put "25" and "30 min" 0.4px apart once the bar
           narrowed to 235.6px of track to clear the map's corner controls. */
        it('spends its tick budget on the width actually available', () => {
            expect(tickBudgetForWidth(235.6)).toBe(4);
            expect(tickBudgetForWidth(379.2)).toBe(6);
            expect(tickBudgetForWidth(1000)).toBe(8);   // capped — denser reads as noise
            expect(tickBudgetForWidth(60)).toBe(2);     // floored — one tick is not an axis
            expect(tickBudgetForWidth(0)).toBe(8);      // unmeasured keeps the default
        });

        it('thins the axis rather than colliding labels on a narrow track', () => {
            const time = Float64Array.from({ length: 31 }, (_, i) => i * 60);
            const narrow = scrubberTicks(time, 31, tickBudgetForWidth(235.6));
            expect(narrow.step).toBe(10);
            expect(narrow.ticks.map((t) => t.value)).toEqual([0, 10, 20, 30]);
            // The wide bar keeps the finer axis it had room for.
            const wide = scrubberTicks(time, 31, tickBudgetForWidth(379.2));
            expect(wide.step).toBe(5);
            expect(wide.ticks.length).toBe(7);
        });

        it('escalates the unit as the run gets longer', () => {
            expect(tickUnitFor(90).unit).toBe('s');
            expect(tickUnitFor(1800).unit).toBe('min');
            expect(tickUnitFor(36000).unit).toBe('h');
            expect(tickUnitFor(864000).unit).toBe('d');
        });

        /* THE REASON ticks interpolate into `time` rather than dividing the
           span: the thumb moves linearly in INDEX. On a run whose cadence
           changes partway, a time-fraction tick would sit away from the frame
           it labels. Here the first 10 frames cover 10s each and the next 10
           cover 100s each, so t=600s lands exactly on index 15 of 20 => frac
           0.75, whereas naive time-fraction would place it at 600/1100 = 0.545
           — a fifth of the track away from the frame it names. */
        it('places ticks by INDEX fraction on a non-uniform cadence', () => {
            const time = new Float64Array(21);
            for (let i = 0; i <= 10; i++) { time[i] = i * 10; }
            for (let i = 11; i <= 20; i++) { time[i] = 100 + (i - 10) * 100; }
            const { ticks } = scrubberTicks(time, 21);
            const t600 = ticks.find((t) => t.seconds === 600);
            expect(t600).toBeTruthy();
            expect(t600.frac).toBe(0.75);
            expect(Math.abs(t600.frac - 600 / 1100)).toBeGreaterThan(0.2);
        });

        it('returns nothing rather than guessing when there is no usable time', () => {
            expect(scrubberTicks(null, 31).ticks.length).toBe(0);
            expect(scrubberTicks(new Float64Array([0, 0, 0]), 3).ticks.length).toBe(0);
            expect(scrubberTicks(new Float64Array([5]), 1).ticks.length).toBe(0);
            // nTime longer than the array it was handed — a torn state.
            expect(scrubberTicks(new Float64Array([0, 60]), 31).ticks.length).toBe(0);
        });

        it('aligns labels to round numbers when the run does not start at zero', () => {
            const time = Float64Array.from({ length: 31 }, (_, i) => 130 + i * 60);
            const { ticks } = scrubberTicks(time, 31);
            expect(ticks[0].value).toBe(5);
            ticks.forEach((t) => expect(t.value % 5).toBe(0));
        });
    });
});

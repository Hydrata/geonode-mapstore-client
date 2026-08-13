/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2751 (W6.3, epic 2706) — the bar's LAYOUT contract.
 *
 * TASK-2744 made all sixteen controls correct; it left them all on one
 * wrapping row. This file pins the re-configuration:
 *
 *   card
 *     ├─ drawer      (order:-1 — grows UPWARD, always in the DOM, `hidden`
 *     │               when closed so the card's bottom edge never moves)
 *     └─ transport   (fixed-height row — play, scrubber, readout, speed,
 *                     status, THEN the primary-path group, then the tools)
 *
 * Widths and wrapping are CSS and are proven LIVE on map 1461, not here —
 * karma renders the component with no stylesheet, so every
 * getBoundingClientRect in this environment would be measuring nothing.
 * What IS provable here is the structural invariant underneath the CSS:
 * which controls live in which container, and in what order.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { AnugaPlaybackControlBarComponent } from '../AnugaPlaybackControlBar';
import { PLAYBACK_STATUS, createInitialPlaybackState } from '../../playbackController';

/* Controls that BELONG IN THE DRAWER after this card — every conditional
   slider group is in here, because those are what made the bar reflow. */
const DRAWER_CONTROLS = [
    'anuga-playback-opacity',
    'anuga-playback-wireframe-toggle',
    'anuga-playback-ceiling-table',
    'anuga-playback-flowviz-toggle',
    'anuga-playback-particles-toggle'
];

/* Controls that must stay on the primary path. */
const TRANSPORT_CONTROLS = [
    'anuga-playback-playpause',
    'anuga-playback-scrubber',
    'anuga-playback-readout',
    'anuga-playback-speed',
    'anuga-playback-status',
    'anuga-playback-quantity',
    'anuga-playback-ceiling',
    'anuga-playback-max-envelope',
    'anuga-playback-display-toggle',
    'anuga-playback-identify-toggle',
    'anuga-playback-legend-toggle',
    'anuga-playback-unload'
];

describe('Playback bar layout — TASK-2751', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function readyState(over) {
        return {
            ...createInitialPlaybackState(),
            status: PLAYBACK_STATUS.READY,
            nTime: 31,
            currentTimestep: 0,
            ...over
        };
    }
    function render(props) {
        ReactDOM.render(<AnugaPlaybackControlBarComponent {...props} />, container);
    }
    const q = (sel, root) => (root || container).querySelector(`[data-testid="${sel}"]`);

    describe('AC2 — the drawer', () => {
        it('the card holds a transport row and a drawer', () => {
            render({ playback: readyState() });
            const card = q('anuga-playback-bar');
            expect(card).toBeTruthy();
            expect(q('anuga-playback-transport', card)).toBeTruthy();
            expect(q('anuga-playback-drawer', card)).toBeTruthy();
        });

        it('the drawer is CLOSED on first render and the disclosure says so', () => {
            render({ playback: readyState() });
            expect(q('anuga-playback-drawer').hidden).toBe(true);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('false');
        });

        it('the disclosure opens and closes it, and keeps aria-expanded honest', () => {
            render({ playback: readyState() });
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(false);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('true');

            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(true);
            expect(q('anuga-playback-display-toggle').getAttribute('aria-expanded')).toBe('false');
        });

        it('the drawer renders BEFORE the transport row in the DOM, so it grows upward', () => {
            render({ playback: readyState() });
            const kids = Array.from(q('anuga-playback-bar').children);
            expect(kids.indexOf(q('anuga-playback-drawer')))
                .toBeLessThan(kids.indexOf(q('anuga-playback-transport')));
        });

        it('every render knob is inside the drawer and NONE of them is on the transport row', () => {
            render({ playback: readyState() });
            const drawer = q('anuga-playback-drawer');
            const transport = q('anuga-playback-transport');
            DRAWER_CONTROLS.forEach((testid) => {
                expect(q(testid, drawer)).toExist(`${testid} should be in the drawer`);
                expect(q(testid, transport)).toBe(null, `${testid} must NOT be on the transport row`);
            });
        });

        it('every primary-path control is on the transport row and none is in the drawer', () => {
            render({ playback: readyState() });
            const drawer = q('anuga-playback-drawer');
            const transport = q('anuga-playback-transport');
            TRANSPORT_CONTROLS.forEach((testid) => {
                expect(q(testid, transport)).toExist(`${testid} should be on the transport row`);
                expect(q(testid, drawer)).toBe(null, `${testid} must NOT be in the drawer`);
            });
        });

        it('Escape closes the drawer', () => {
            render({ playback: readyState() });
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(q('anuga-playback-drawer').hidden).toBe(false);
            TestUtils.Simulate.keyDown(q('anuga-playback-bar'), { key: 'Escape' });
            expect(q('anuga-playback-drawer').hidden).toBe(true);
        });
    });

    describe('AC1/AC7 — nothing that mounts may re-order the transport row', () => {
        /* The width guarantee is CSS and is measured live. The guarantee this
           file can make is that the row's OWN child list is invariant: in
           TASK-2744 the bar re-ordered itself because conditional groups
           mounted between controls. Now the only conditional content lives
           inside fixed slots. */
        function transportChildTestids() {
            return Array.from(q('anuga-playback-transport').children)
                .map((el) => el.getAttribute('data-testid'));
        }

        it('is identical whether buffering or ready', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            render({ playback: readyState({ status: PLAYBACK_STATUS.BUFFERING }) });
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical with both overlays on', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            render({ playback: readyState({ flowVizEnabled: true, particlesEnabled: true }) });
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical with the drawer open', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            TestUtils.Simulate.click(q('anuga-playback-display-toggle'));
            expect(transportChildTestids()).toEqual(atRest);
        });

        it('is identical while the ceiling is being edited', () => {
            render({ playback: readyState() });
            const atRest = transportChildTestids();
            TestUtils.Simulate.click(q('anuga-playback-ceiling'));
            expect(q('anuga-playback-ceiling-input')).toBeTruthy();
            expect(transportChildTestids()).toEqual(atRest);
        });
    });

    describe('AC3 — the result-quantity picker is on the primary path', () => {
        it('sits inside the primary group, after the status slot and before the divider', () => {
            render({ playback: readyState() });
            const kids = Array.from(q('anuga-playback-transport').children);
            const at = (testid) => kids.findIndex((el) => el.contains(q(testid)));
            expect(at('anuga-playback-quantity')).toBeGreaterThan(at('anuga-playback-status'));
            expect(at('anuga-playback-quantity')).toBeLessThan(at('anuga-playback-divider'));
            expect(q('anuga-playback-primary-group')).toBeTruthy();
        });

        it('is named "Result quantity", not "result set" and not the state key', () => {
            render({ playback: readyState() });
            const name = q('anuga-playback-quantity').getAttribute('aria-label');
            expect(name).toBe('Result quantity');
        });

        it('changing it calls onSetQuantity', () => {
            const onSetQuantity = expect.createSpy();
            render({ playback: readyState(), onSetQuantity });
            TestUtils.Simulate.change(q('anuga-playback-quantity'), { target: { value: 'speed' } });
            expect(onSetQuantity.calls.length).toBe(1);
            expect(onSetQuantity.calls[0].arguments[0]).toBe('speed');
        });
    });

    describe('AC4 — the colour-scale ceiling is on the primary path, per quantity', () => {
        it('renders the EFFECTIVE ceiling for the displayed quantity', () => {
            render({ playback: readyState({ quantity: 'depth', colorMaxOverride: { depth: 1.5 } }) });
            expect(q('anuga-playback-ceiling').textContent).toInclude('1.5');
        });

        it('commits through onSetColorMax against the DISPLAYED quantity', () => {
            const onSetColorMax = expect.createSpy();
            render({ playback: readyState({ quantity: 'speed' }), onSetColorMax });
            TestUtils.Simulate.click(q('anuga-playback-ceiling'));
            TestUtils.Simulate.change(q('anuga-playback-ceiling-input'), { target: { value: '2' } });
            TestUtils.Simulate.keyDown(q('anuga-playback-ceiling-input'), { key: 'Enter' });
            expect(onSetColorMax.calls.length).toBe(1);
            expect(onSetColorMax.calls[0].arguments[0]).toBe('speed');
            expect(onSetColorMax.calls[0].arguments[1]).toBe(2);
        });

        it('never shows the word "max" — that word belongs to the envelope (TASK-2752)', () => {
            render({ playback: readyState({ colorMaxOverride: { depth: 1.5 } }) });
            const group = q('anuga-playback-ceiling-group');
            expect(group.textContent.toLowerCase()).toNotInclude('max');
        });
    });

    describe('AC6 — the Max slot is reserved and inert until TASK-2752', () => {
        it('is present, disabled, and announces that it is disabled', () => {
            render({ playback: readyState() });
            const max = q('anuga-playback-max-envelope');
            expect(max).toBeTruthy();
            expect(max.disabled).toBe(true);
            expect(max.getAttribute('aria-disabled')).toBe('true');
        });

        it('explains itself rather than sitting there dead', () => {
            render({ playback: readyState() });
            const title = q('anuga-playback-max-envelope').getAttribute('title') || '';
            expect(title.length > 0).toBe(true);
        });

        it('dispatches nothing at all when clicked', () => {
            const spies = {
                onSetQuantity: expect.createSpy(),
                onSetColorMax: expect.createSpy(),
                onSeek: expect.createSpy(),
                onPlay: expect.createSpy()
            };
            render({ playback: readyState(), ...spies });
            TestUtils.Simulate.click(q('anuga-playback-max-envelope'));
            Object.keys(spies).forEach((k) => expect(spies[k].calls.length).toBe(0));
        });
    });
});

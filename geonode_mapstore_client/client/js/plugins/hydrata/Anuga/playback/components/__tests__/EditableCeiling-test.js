/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2751 (W6.3, epic 2706) — EditableCeiling.
 *
 * The colour-scale CEILING is the top of the rendered ramp for one result
 * quantity. It is deliberately NOT called "max" anywhere a user can see:
 * epic 2706 reserves that word for the temporal-max envelope (TASK-2752,
 * glossary "max-value raster"), and having two different numbers both
 * labelled "max" on the same bar is exactly the confusion this card exists
 * to avoid.
 *
 * One component, mounted twice — on the control bar and as the legend's
 * ceiling row — so the two can never disagree.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import EditableCeiling from '../EditableCeiling';

describe('EditableCeiling — TASK-2751', () => {
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
        ReactDOM.render(
            <EditableCeiling
                testid="ceiling"
                quantity="depth"
                value={1.5}
                unit="m"
                {...props}
            />,
            container
        );
    }
    const q = (sel) => container.querySelector(`[data-testid="${sel}"]`);

    it('renders the ceiling as a button reading "<= value unit", and NEVER the word max', () => {
        render({});
        const button = q('ceiling');
        expect(button).toBeTruthy();
        expect(button.tagName).toBe('BUTTON');
        expect(button.textContent).toInclude('1.5');
        expect(button.textContent).toInclude('m');
        expect(button.textContent).toInclude('≤');
        // The whole point of the name: "max" is the OTHER feature.
        expect(button.textContent.toLowerCase()).toNotInclude('max');
        expect((button.getAttribute('aria-label') || '').toLowerCase()).toNotInclude('max');
    });

    it('has an accessible name even though its visible text is only a number', () => {
        render({});
        const button = q('ceiling');
        const name = button.getAttribute('aria-label');
        expect(typeof name).toBe('string');
        expect(name.length > 0).toBe(true);
    });

    it('clicking swaps the button for a number input seeded with the current value', () => {
        render({});
        expect(q('ceiling-input')).toBe(null);
        TestUtils.Simulate.click(q('ceiling'));
        const input = q('ceiling-input');
        expect(input).toBeTruthy();
        expect(input.tagName).toBe('INPUT');
        expect(input.type).toBe('number');
        expect(Number(input.value)).toBe(1.5);
        expect(q('ceiling')).toBe(null);
    });

    it('Enter commits onChange(quantity, number) and leaves edit mode', () => {
        const onChange = expect.createSpy();
        render({ onChange });
        TestUtils.Simulate.click(q('ceiling'));
        const input = q('ceiling-input');
        TestUtils.Simulate.change(input, { target: { value: '0.8' } });
        TestUtils.Simulate.keyDown(input, { key: 'Enter' });
        expect(onChange.calls.length).toBe(1);
        expect(onChange.calls[0].arguments[0]).toBe('depth');
        expect(onChange.calls[0].arguments[1]).toBe(0.8);
        expect(q('ceiling-input')).toBe(null);
    });

    it('blur commits too — a click elsewhere must not silently discard the edit', () => {
        const onChange = expect.createSpy();
        render({ onChange });
        TestUtils.Simulate.click(q('ceiling'));
        const input = q('ceiling-input');
        TestUtils.Simulate.change(input, { target: { value: '2.25' } });
        TestUtils.Simulate.blur(input);
        expect(onChange.calls.length).toBe(1);
        expect(onChange.calls[0].arguments[1]).toBe(2.25);
    });

    it('Escape cancels — no onChange at all, and the original value is back', () => {
        const onChange = expect.createSpy();
        render({ onChange });
        TestUtils.Simulate.click(q('ceiling'));
        const input = q('ceiling-input');
        TestUtils.Simulate.change(input, { target: { value: '999' } });
        TestUtils.Simulate.keyDown(input, { key: 'Escape' });
        expect(onChange.calls.length).toBe(0);
        expect(q('ceiling').textContent).toInclude('1.5');
    });

    it('an emptied field commits NULL, which is how the store-derived ceiling is restored', () => {
        const onChange = expect.createSpy();
        render({ onChange });
        TestUtils.Simulate.click(q('ceiling'));
        const input = q('ceiling-input');
        TestUtils.Simulate.change(input, { target: { value: '' } });
        TestUtils.Simulate.keyDown(input, { key: 'Enter' });
        expect(onChange.calls.length).toBe(1);
        expect(onChange.calls[0].arguments[1]).toBe(null);
    });

    it('the reset affordance appears only when overridden, and clears to null', () => {
        const onChange = expect.createSpy();
        render({ onChange, overridden: false });
        expect(q('ceiling-reset')).toBe(null);

        render({ onChange, overridden: true });
        const reset = q('ceiling-reset');
        expect(reset).toBeTruthy();
        TestUtils.Simulate.click(reset);
        expect(onChange.calls.length).toBe(1);
        expect(onChange.calls[0].arguments[1]).toBe(null);
    });

    it('carries the quantity it was given, so editing one result quantity cannot write another', () => {
        const onChange = expect.createSpy();
        render({ onChange, quantity: 'shear', value: 512.7, unit: 'Pa' });
        TestUtils.Simulate.click(q('ceiling'));
        TestUtils.Simulate.change(q('ceiling-input'), { target: { value: '50' } });
        TestUtils.Simulate.keyDown(q('ceiling-input'), { key: 'Enter' });
        expect(onChange.calls[0].arguments[0]).toBe('shear');
    });

    /* TASK-3076 AC2 — the edit box SEEDS at three significant figures (the
       operator asked for 3 s.f. "in the input boxes") but an untouched blur
       commits NOTHING. At HEAD the seed was toFixed(3) and blur committed
       unconditionally, so merely clicking the store's 16.8627… ceiling and
       clicking away wrote 16.863 as an override, flipped colorRescaled and
       recoloured the map. */
    describe('AC2 — seed at 3 s.f., unchanged blur is a no-op (TASK-3076)', () => {
        it('click then blur — onChange is NOT called', () => {
            const onChange = expect.createSpy();
            render({ onChange, value: 16.862720489501953 });
            TestUtils.Simulate.click(q('ceiling'));
            TestUtils.Simulate.blur(q('ceiling-input'));
            expect(onChange.calls.length).toBe(0);
            expect(q('ceiling')).toBeTruthy('edit mode is left');
        });

        it('seeds the box at three significant figures', () => {
            render({ value: 16.862720489501953 });
            TestUtils.Simulate.click(q('ceiling'));
            expect(q('ceiling-input').value).toBe('16.9');
        });

        it('a typed edit commits at the TYPED precision — 1.2345 stays 1.2345', () => {
            const onChange = expect.createSpy();
            render({ onChange });
            TestUtils.Simulate.click(q('ceiling'));
            TestUtils.Simulate.change(q('ceiling-input'), { target: { value: '1.2345' } });
            TestUtils.Simulate.blur(q('ceiling-input'));
            expect(onChange.calls.length).toBe(1);
            expect(onChange.calls[0].arguments[1]).toBe(1.2345);
        });

        it('re-opening a 1.2345 ceiling shows 1.23, and a blur keeps 1.2345 (no commit)', () => {
            const onChange = expect.createSpy();
            render({ onChange, value: 1.2345, overridden: true });
            TestUtils.Simulate.click(q('ceiling'));
            expect(q('ceiling-input').value).toBe('1.23');
            TestUtils.Simulate.blur(q('ceiling-input'));
            expect(onChange.calls.length).toBe(0);
        });

        it('re-opening and typing 1.3 commits 1.3', () => {
            const onChange = expect.createSpy();
            render({ onChange, value: 1.2345, overridden: true });
            TestUtils.Simulate.click(q('ceiling'));
            TestUtils.Simulate.change(q('ceiling-input'), { target: { value: '1.3' } });
            TestUtils.Simulate.keyDown(q('ceiling-input'), { key: 'Enter' });
            expect(onChange.calls.length).toBe(1);
            expect(onChange.calls[0].arguments[1]).toBe(1.3);
        });

        it('retyping the seed in another spelling (16.90 for 16.9) is NOT an edit — nothing commits', () => {
            const onChange = expect.createSpy();
            render({ onChange, value: 16.862720489501953, overridden: false });
            TestUtils.Simulate.click(q('ceiling'));
            expect(q('ceiling-input').value).toBe('16.9');
            TestUtils.Simulate.change(q('ceiling-input'), { target: { value: '16.90' } });
            TestUtils.Simulate.blur(q('ceiling-input'));
            expect(onChange.calls.length).toBe(0);
        });

        it('an un-overridden ceiling, clicked and blurred, creates NO override', () => {
            const onChange = expect.createSpy();
            render({ onChange, value: 16.862720489501953, overridden: false });
            TestUtils.Simulate.click(q('ceiling'));
            TestUtils.Simulate.blur(q('ceiling-input'));
            expect(onChange.calls.length).toBe(0);
            expect(q('ceiling-reset')).toBe(null);
        });
    });

    it('is inert when disabled — no editor, no onChange', () => {
        const onChange = expect.createSpy();
        render({ onChange, disabled: true });
        const button = q('ceiling');
        expect(button.disabled).toBe(true);
        TestUtils.Simulate.click(button);
        expect(q('ceiling-input')).toBe(null);
        expect(onChange.calls.length).toBe(0);
    });

    /* TASK-3076 AC8 — THE FLOOR, paired with the ceiling in the same row:
       `≥ [floor] unit … ≤ [ceiling] unit`, TWO click targets joined by a static
       ellipsis. The floor mirrors the ceiling's gestures (Enter/blur commit,
       Escape cancel, empty = clear, seed/no-op) and gets its own -input and
       -reset testids under `<testid>-floor`. */
    describe('AC8 — the floor side of the range row (TASK-3076)', () => {
        it('renders ≥ — for an unset floor, and never the words min / minimum / max', () => {
            render({});
            const floor = q('ceiling-floor');
            expect(floor).toBeTruthy();
            expect(floor.tagName).toBe('BUTTON');
            expect(floor.textContent).toInclude('≥');
            expect(floor.textContent).toInclude('—');
            const visible = [floor.textContent, floor.getAttribute('aria-label') || '', floor.getAttribute('title') || ''].join(' ').toLowerCase();
            expect(visible).toNotInclude('min');
            expect(visible).toNotInclude('max');
            expect(q('ceiling-floor-reset')).toBe(null, 'nothing stored, nothing to reset');
        });

        it('a null floor is "none", not a stored floor of 0', () => {
            render({ floor: null, floorActive: false });
            expect(q('ceiling-floor').textContent).toBe('≥ —');
            expect(q('ceiling-floor').className).toNotInclude('is-inert');
            expect(q('ceiling-floor-reset')).toBe(null);
        });

        it('renders the stored floor with its unit, and the ceiling still renders its own value', () => {
            render({ floor: 0.1, floorActive: true });
            expect(q('ceiling-floor').textContent).toBe('≥ 0.1 m');
            expect(q('ceiling').textContent).toBe('≤ 1.5 m');
            // the static joiner sits between the two, and is not a button
            const group = q('ceiling-group');
            expect(group.textContent).toInclude('…');
            const order = Array.from(group.querySelectorAll('[data-testid]')).map((el) => el.getAttribute('data-testid'));
            expect(order.indexOf('ceiling-floor') < order.indexOf('ceiling')).toBe(true, 'floor before ceiling');
        });

        it('DOM order: the floor button precedes the joiner, which precedes the ceiling button', () => {
            render({ floor: 0.1, floorActive: true });
            const group = q('ceiling-group');
            const text = group.textContent;
            expect(text.indexOf('≥') < text.indexOf('…')).toBe(true);
            expect(text.indexOf('…') < text.indexOf('≤')).toBe(true);
        });

        it('an ACTIVE floor is styled is-override with the normal tooltip, and offers a reset', () => {
            const onChangeFloor = expect.createSpy();
            render({ floor: 0.1, floorActive: true, onChangeFloor });
            const floor = q('ceiling-floor');
            expect(floor.className).toInclude('is-override');
            expect(floor.className).toNotInclude('is-inert');
            const reset = q('ceiling-floor-reset');
            expect(reset).toBeTruthy();
            TestUtils.Simulate.click(reset);
            expect(onChangeFloor.calls.length).toBe(1);
            expect(onChangeFloor.calls[0].arguments).toEqual(['depth', null]);
        });

        it('an INERT-but-stored floor shows its value, muted (is-inert), a cause-neutral title, and still a reset', () => {
            render({ floor: 2, floorActive: false });
            const floor = q('ceiling-floor');
            expect(floor.textContent).toBe('≥ 2 m');
            expect(floor.className).toInclude('is-inert');
            expect(floor.className).toNotInclude('is-override');
            expect(floor.getAttribute('title')).toBe('Not applied: outside the colour scale');
            expect(q('ceiling-floor-reset')).toBeTruthy();
        });

        it('clicking opens a number input seeded at 3 s.f. with NO min attribute (a stage floor can be negative)', () => {
            render({ floor: 0.123456, floorActive: true });
            TestUtils.Simulate.click(q('ceiling-floor'));
            const input = q('ceiling-floor-input');
            expect(input).toBeTruthy();
            expect(input.type).toBe('number');
            expect(input.value).toBe('0.123');
            expect(input.hasAttribute('min')).toBe(false);
            expect(q('ceiling-floor')).toBe(null);
            // the ceiling is untouched by the floor being edited
            expect(q('ceiling')).toBeTruthy();
        });

        it('Enter commits onChangeFloor(quantity, number) at the typed precision', () => {
            const onChangeFloor = expect.createSpy();
            render({ onChangeFloor, quantity: 'shear', unit: 'Pa' });
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.change(q('ceiling-floor-input'), { target: { value: '12.345' } });
            TestUtils.Simulate.keyDown(q('ceiling-floor-input'), { key: 'Enter' });
            expect(onChangeFloor.calls.length).toBe(1);
            expect(onChangeFloor.calls[0].arguments).toEqual(['shear', 12.345]);
            expect(q('ceiling-floor-input')).toBe(null);
        });

        it('blur commits a typed edit; an untouched blur commits nothing', () => {
            const onChangeFloor = expect.createSpy();
            render({ onChangeFloor, floor: 0.1, floorActive: true });
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.blur(q('ceiling-floor-input'));
            expect(onChangeFloor.calls.length).toBe(0);
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.change(q('ceiling-floor-input'), { target: { value: '-2.5' } });
            TestUtils.Simulate.blur(q('ceiling-floor-input'));
            expect(onChangeFloor.calls.length).toBe(1);
            expect(onChangeFloor.calls[0].arguments[1]).toBe(-2.5);
        });

        it('Escape cancels and stops propagation, so the drawer behind it stays open', () => {
            const onChangeFloor = expect.createSpy();
            render({ onChangeFloor, floor: 0.1, floorActive: true });
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.change(q('ceiling-floor-input'), { target: { value: '999' } });
            const stopPropagation = expect.createSpy();
            TestUtils.Simulate.keyDown(q('ceiling-floor-input'), { key: 'Escape', stopPropagation });
            expect(stopPropagation.calls.length).toBe(1);
            expect(onChangeFloor.calls.length).toBe(0);
            expect(q('ceiling-floor').textContent).toBe('≥ 0.1 m');
        });

        it('an emptied field commits NULL, which clears the floor', () => {
            const onChangeFloor = expect.createSpy();
            render({ onChangeFloor, floor: 0.1, floorActive: true });
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.change(q('ceiling-floor-input'), { target: { value: '' } });
            TestUtils.Simulate.keyDown(q('ceiling-floor-input'), { key: 'Enter' });
            expect(onChangeFloor.calls.length).toBe(1);
            expect(onChangeFloor.calls[0].arguments[1]).toBe(null);
        });

        it('editing the floor never calls the ceiling\'s onChange, and vice versa', () => {
            const onChange = expect.createSpy();
            const onChangeFloor = expect.createSpy();
            render({ onChange, onChangeFloor });
            TestUtils.Simulate.click(q('ceiling-floor'));
            TestUtils.Simulate.change(q('ceiling-floor-input'), { target: { value: '0.2' } });
            TestUtils.Simulate.keyDown(q('ceiling-floor-input'), { key: 'Enter' });
            TestUtils.Simulate.click(q('ceiling'));
            TestUtils.Simulate.change(q('ceiling-input'), { target: { value: '3' } });
            TestUtils.Simulate.keyDown(q('ceiling-input'), { key: 'Enter' });
            expect(onChangeFloor.calls.length).toBe(1);
            expect(onChangeFloor.calls[0].arguments[1]).toBe(0.2);
            expect(onChange.calls.length).toBe(1);
            expect(onChange.calls[0].arguments[1]).toBe(3);
        });

        it('is inert when disabled, like the ceiling', () => {
            const onChangeFloor = expect.createSpy();
            render({ onChangeFloor, disabled: true, floor: 0.1, floorActive: true });
            expect(q('ceiling-floor').disabled).toBe(true);
            TestUtils.Simulate.click(q('ceiling-floor'));
            expect(q('ceiling-floor-input')).toBe(null);
            expect(onChangeFloor.calls.length).toBe(0);
        });
    });
});

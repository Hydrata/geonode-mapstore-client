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

    it('is inert when disabled — no editor, no onChange', () => {
        const onChange = expect.createSpy();
        render({ onChange, disabled: true });
        const button = q('ceiling');
        expect(button.disabled).toBe(true);
        TestUtils.Simulate.click(button);
        expect(q('ceiling-input')).toBe(null);
        expect(onChange.calls.length).toBe(0);
    });
});

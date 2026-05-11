/*
 * TASK-812 (W1.1) — VectorDraw widget registry tests.
 *
 * Two layers of coverage:
 *
 *   1. Unit tests against widgetRegistry directly (register/get/getAll/clean).
 *      These exercise the registry in isolation against a private "fake-widget"
 *      name so they don't perturb the 5 defaults (text/number/checkbox/select/
 *      time-data-picker) registered by FormField.js at module load.
 *
 *   2. Integration: FormField looks up its component via the registry. We
 *      register a fake widget under a unique name, render <FormField> with
 *      field.type matching that name, and assert the fake widget rendered.
 *
 * CROSS-TEST POLLUTION GUARDRAIL: this test file deliberately AVOIDS calling
 * `clean()` because the registry is process-global (one module instance shared
 * across all Karma test files). If we cleaned it, downstream tests that import
 * { FormField } would resolve `get(field.type)` to undefined and fall through
 * to `get('text')` — which would ALSO be undefined — and crash. Instead, we
 * register a uniquely-named fake widget that no other test cares about, and
 * we never remove the 5 defaults.
 *
 * The one `clean()` test below restores the 5 defaults manually before
 * letting Karma move on, so even an explicit clean test is safe for the
 * suite.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { FormField, TextWidget, NumberWidget, CheckboxWidget, SelectWidget, TimeDataPicker } from '../components/FormField';
import { register, get, getAll, clean } from '../widgetRegistry';

// Unique name so we don't collide with any default or another test file.
const FAKE_NAME = 'fake-widget-xyz-task812';

const FakeWidget = ({ field, value }) => (
    <div className="fake-widget-task812" data-name={field.name}>
        FAKE:{String(value ?? '')}
    </div>
);

describe('VectorDraw widgetRegistry (TASK-812 W1.1)', () => {

    describe('registry primitives', () => {

        afterEach(() => {
            // Remove the unique fake key by re-cleaning + restoring defaults.
            // (We can't `delete widgets[FAKE_NAME]` from outside, but the
            // clean+restore round-trip is cheap and leaves the registry in
            // the same state we found it.)
            clean();
            register({ name: 'text', component: TextWidget });
            register({ name: 'number', component: NumberWidget });
            register({ name: 'checkbox', component: CheckboxWidget });
            register({ name: 'select', component: SelectWidget });
            register({ name: 'time-data-picker', component: TimeDataPicker });
        });

        it('register({name, component}) adds an entry; get(name) returns it', () => {
            register({ name: FAKE_NAME, component: FakeWidget });
            expect(get(FAKE_NAME)).toBe(FakeWidget);
        });

        it('register overwrites an existing entry (last-write-wins)', () => {
            const First = () => <span>first</span>;
            const Second = () => <span>second</span>;
            register({ name: FAKE_NAME, component: First });
            expect(get(FAKE_NAME)).toBe(First);
            register({ name: FAKE_NAME, component: Second });
            expect(get(FAKE_NAME)).toBe(Second);
        });

        it('register ignores entries missing name or component (defensive)', () => {
            register({ name: '', component: FakeWidget });
            register({ name: FAKE_NAME, component: null });
            expect(get('')).toBe(undefined);
            expect(get(FAKE_NAME)).toBe(undefined);
        });

        it('get(name) returns undefined for unknown names', () => {
            expect(get('no-such-widget-zzz')).toBe(undefined);
        });

        it('getAll() returns the full registry map including the 5 defaults', () => {
            const all = getAll();
            expect(all.text).toBe(TextWidget);
            expect(all.number).toBe(NumberWidget);
            expect(all.checkbox).toBe(CheckboxWidget);
            expect(all.select).toBe(SelectWidget);
            expect(all['time-data-picker']).toBe(TimeDataPicker);
        });

        it('clean() empties the registry; afterEach restores the 5 defaults', () => {
            register({ name: FAKE_NAME, component: FakeWidget });
            expect(get(FAKE_NAME)).toBe(FakeWidget);
            clean();
            expect(get(FAKE_NAME)).toBe(undefined);
            expect(get('text')).toBe(undefined);
            expect(getAll()).toEqual({});
            // afterEach restores defaults so subsequent tests don't crash.
        });
    });

    describe('FormField → registry integration', () => {

        let container;

        beforeEach(() => {
            container = document.createElement('div');
            container.className = 'vector-draw-popup';
            document.body.appendChild(container);
        });

        afterEach(() => {
            ReactDOM.unmountComponentAtNode(container);
            container.remove();
            // We register FAKE_NAME below — the registry is process-global so
            // we don't bother removing it explicitly (a unique name = no
            // pollution risk to other tests). The 5 defaults are untouched.
        });

        it('FormField renders the registered widget when field.type matches a registered name', () => {
            register({ name: FAKE_NAME, component: FakeWidget });
            const field = { name: 'myfield', type: FAKE_NAME, label: 'Fake' };
            ReactDOM.render(<FormField field={field} value="hello" onChange={() => {}} />, container);
            const el = container.querySelector('.fake-widget-task812');
            expect(el).toExist();
            expect(el.getAttribute('data-name')).toBe('myfield');
            expect(el.textContent).toBe('FAKE:hello');
        });

        it('FormField falls back to the text widget when field.type is unknown', () => {
            const field = { name: 'mystery', type: 'no-such-widget-yyy', label: 'Mystery' };
            ReactDOM.render(<FormField field={field} value="fallback" onChange={() => {}} />, container);
            // text widget renders an <input type="text">
            const input = container.querySelector('input[type="text"]');
            expect(input).toExist();
            expect(input.value).toBe('fallback');
        });

        it('FormField dispatches text/number/checkbox/select via the registry (defaults still wired)', () => {
            // text
            ReactDOM.render(
                <FormField field={{ name: 'a', type: 'text', label: 'A' }} value="t" onChange={() => {}} />,
                container
            );
            expect(container.querySelector('input[type="text"]')).toExist();

            // number
            ReactDOM.unmountComponentAtNode(container);
            ReactDOM.render(
                <FormField field={{ name: 'b', type: 'number', label: 'B' }} value={5} onChange={() => {}} />,
                container
            );
            expect(container.querySelector('input[type="number"]')).toExist();

            // checkbox
            ReactDOM.unmountComponentAtNode(container);
            ReactDOM.render(
                <FormField field={{ name: 'c', type: 'checkbox', label: 'C' }} value onChange={() => {}} />,
                container
            );
            expect(container.querySelector('input[type="checkbox"]')).toExist();

            // select
            ReactDOM.unmountComponentAtNode(container);
            const selField = { name: 'd', type: 'select', label: 'D', options: [{value: 'x', label: 'X'}] };
            ReactDOM.render(
                <FormField field={selField} value="x" onChange={() => {}} />,
                container
            );
            expect(container.querySelector('select')).toExist();
        });
    });
});

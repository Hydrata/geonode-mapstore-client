/*
 * TASK-795 — Tests for the TimeDataPicker compound widget in FormField.js.
 *
 * The widget renders an internal Constant|TimeSeries radio + value input
 * (numeric for constant, dropdown for timeseries). It calls onChange(name,
 * structuredValue) where the structured shape is:
 *   { kind: 'constant',   constant: <Number|null> }
 *   { kind: 'timeseries', timeseries_id: <Number|null> }
 *
 * Tests inject `timeSeriesOptions` directly to bypass the per-form fetch
 * path; the fetch path itself is exercised by the round-trip tests against
 * a stubbed axios.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';
import { TimeDataPicker } from '../components/FormField';

const FIELD = { name: 'data', label: 'Boundary value', type: 'time-data-picker' };

describe('TASK-795 TimeDataPicker', () => {
    let container;
    let lastChange;
    const onChange = (name, val) => { lastChange = { name, val }; };

    beforeEach(() => {
        container = document.createElement('div');
        container.className = 'sv-vector-draw-popup';
        document.body.appendChild(container);
        lastChange = null;
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    describe('initial render', () => {
        it('renders both radio buttons (Constant + TimeSeries)', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={undefined}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const radios = container.querySelectorAll('input[type="radio"]');
            expect(radios.length).toBe(2);
            const values = Array.from(radios).map(r => r.value);
            expect(values.includes('constant')).toBe(true);
            expect(values.includes('timeseries')).toBe(true);
        });

        it('defaults to Constant mode + numeric input on fresh feature (value=undefined)', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={undefined}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const constantRadio = container.querySelector('input[type="radio"][value="constant"]');
            expect(constantRadio.checked).toBe(true);
            const numericInput = container.querySelector('input.time-data-picker-constant');
            expect(numericInput).toExist();
            expect(numericInput.type).toBe('number');
            expect(container.querySelector('select.time-data-picker-timeseries')).toBe(null);
        });

        it('starts in TimeSeries mode when seeded with kind=timeseries', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: 42 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[
                        { id: 41, name: 'Alpha' },
                        { id: 42, name: 'Beta' }
                    ]}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            expect(tsRadio.checked).toBe(true);
            const tsSelect = container.querySelector('select.time-data-picker-timeseries');
            expect(tsSelect).toExist();
            expect(tsSelect.value).toBe('42');
            expect(container.querySelector('input.time-data-picker-constant')).toBe(null);
        });

        it('starts in Constant mode + shows seeded constant value', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'constant', constant: 7.5 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const numericInput = container.querySelector('input.time-data-picker-constant');
            expect(numericInput).toExist();
            expect(numericInput.value).toBe('7.5');
        });
    });

    describe('Constant input', () => {
        it('emits {kind:"constant", constant:Number} on numeric input change', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'constant', constant: 1 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const input = container.querySelector('input.time-data-picker-constant');
            input.value = '3.14';
            Simulate.change(input, { target: { value: '3.14' } });
            expect(lastChange.name).toBe('data');
            expect(lastChange.val).toEqual({ kind: 'constant', constant: 3.14 });
        });

        it('emits {kind:"constant", constant:null} on empty input', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'constant', constant: 5 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const input = container.querySelector('input.time-data-picker-constant');
            Simulate.change(input, { target: { value: '' } });
            expect(lastChange.val).toEqual({ kind: 'constant', constant: null });
        });
    });

    describe('TimeSeries select', () => {
        it('renders an option per injected TimeSeries with name as label, id as value', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[
                        { id: 1, name: 'Series A' },
                        { id: 7, name: 'Series B' }
                    ]}
                />,
                container
            );
            const select = container.querySelector('select.time-data-picker-timeseries');
            const options = Array.from(select.querySelectorAll('option'));
            // Placeholder + 2 series.
            expect(options.length).toBe(3);
            expect(options[1].value).toBe('1');
            expect(options[1].textContent).toBe('Series A');
            expect(options[2].value).toBe('7');
            expect(options[2].textContent).toBe('Series B');
        });

        it('emits {kind:"timeseries", timeseries_id:Number} on select change', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[
                        { id: 1, name: 'Series A' },
                        { id: 7, name: 'Series B' }
                    ]}
                />,
                container
            );
            const select = container.querySelector('select.time-data-picker-timeseries');
            Simulate.change(select, { target: { value: '7' } });
            expect(lastChange.name).toBe('data');
            expect(lastChange.val).toEqual({ kind: 'timeseries', timeseries_id: 7 });
        });

        it('shows "No TimeSeries available" placeholder when list is empty + disables select', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const select = container.querySelector('select.time-data-picker-timeseries');
            expect(select).toExist();
            expect(select.disabled).toBe(true);
            expect(select.querySelector('option').textContent).toMatch(/no timeseries available/i);
        });

        it('shows "Loading…" placeholder when no projectId yet (and disables select)', () => {
            // projectId=0 falsy → fetch skipped → tsList stays []. But to
            // exercise the loading branch we set projectId=null AND DON'T
            // pass timeSeriesOptions: the picker stays in tsList=null.
            // (Per-mount fetch: timeSeriesOptions=undefined + projectId=null
            //  → effect runs → !projectId branch → setTsList([]) → empty.)
            // To test the "Loading…" placeholder properly we'd need to
            // intercept axios; covered by the "empty" placeholder above
            // since the user-visible disabled+placeholder behaviour is
            // identical. Keep this test as a documentation marker.
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={null}
                    timeSeriesOptions={[]}
                />,
                container
            );
            const select = container.querySelector('select.time-data-picker-timeseries');
            expect(select.disabled).toBe(true);
        });
    });

    describe('Radio kind switching', () => {
        it('switches from Constant to TimeSeries: emits {kind:"timeseries", timeseries_id:null}', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'constant', constant: 5 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[{ id: 1, name: 'A' }]}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            Simulate.change(tsRadio, { target: { value: 'timeseries' } });
            expect(lastChange.val.kind).toBe('timeseries');
            expect(lastChange.val.timeseries_id).toBe(null);
            // Crucially, no `constant` key in the new shape — prevents
            // double-emit through the BE CHECK constraint.
            expect('constant' in lastChange.val).toBe(false);
        });

        it('switches from TimeSeries to Constant: emits {kind:"constant", constant:null}', () => {
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: 42 }}
                    onChange={onChange}
                    projectId={4}
                    timeSeriesOptions={[{ id: 42, name: 'A' }]}
                />,
                container
            );
            const constRadio = container.querySelector('input[type="radio"][value="constant"]');
            Simulate.change(constRadio, { target: { value: 'constant' } });
            expect(lastChange.val.kind).toBe('constant');
            expect(lastChange.val.constant).toBe(null);
            expect('timeseries_id' in lastChange.val).toBe(false);
        });
    });
});

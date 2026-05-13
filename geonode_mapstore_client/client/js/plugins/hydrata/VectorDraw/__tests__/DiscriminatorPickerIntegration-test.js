/*
 * TASK-826 (W3.3) — Integration tests for the discriminator-picker widget as
 * it is wired into the VectorDraw widget registry + as it would be invoked
 * from ANUGA_FEATURE_CONFIG (Boundary + Inflow `data` fields).
 *
 * `discriminator-picker` resolves to `DiscriminatorPickerWidget` — a thin
 * wrapper around DiscriminatorPicker that:
 *   1. Adapts DiscriminatorPicker's 1-arg `onChange(value)` to the FormField
 *      contract `onChange(field.name, value)`.
 *   2. Renders the outer `simple-view-panel-item-row` div + visible
 *      `<label>{field.label}:</label>` so the DOM matches the legacy
 *      time-data-picker shape.
 *   3. Canonicalizes the kind-switch reset payload using each choice's
 *      optional `defaultValue` map, preserving typed-existing values.
 *
 * These tests are the regression guard for that wrapper: a 1-arg onChange
 * (mis-registration of the bare DiscriminatorPicker) or a dropped
 * field-label render would slip past the radio/DOM assertions in
 * DiscriminatorPicker-test.js — the FormField contract MUST be exercised
 * here.
 *
 * Render components (ConstantInput / TimeSeriesSelect) come from FormField.js
 * — they are `export`-ed so the Boundary + Inflow inline `choices` arrays in
 * simpleViewMenuRow.js reuse the canonical implementations.
 *
 * CROSS-TEST POLLUTION: widgetRegistry is process-global. We do NOT call
 * `clean()` because FormField.js's module-load `register(...)` calls only
 * fire once per process.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';
import {
    FormField,
    ConstantInput,
    TimeSeriesSelect,
    DiscriminatorPickerWidget
} from '../components/FormField';
import { get } from '../widgetRegistry';

describe('TASK-826 W3.3 — discriminator-picker widget integration', () => {
    let container;
    let lastChange;
    const onChange = (name, val) => { lastChange = { name, val }; };

    beforeEach(() => {
        container = document.createElement('div');
        container.className = 'vector-draw-popup';
        document.body.appendChild(container);
        lastChange = null;
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    describe('registry wiring', () => {
        it('widgetRegistry.get("discriminator-picker") returns the wrapper, not the bare DiscriminatorPicker', () => {
            // The wrapper is required because DiscriminatorPicker emits a
            // 1-arg onChange; FormField needs the 2-arg contract.
            expect(get('discriminator-picker')).toBe(DiscriminatorPickerWidget);
        });

        it('time-data-picker alias still registered (back-compat with external consumers)', () => {
            expect(get('time-data-picker')).toExist();
        });
    });

    describe('FormField → registry → DiscriminatorPickerWidget dispatch', () => {
        const FIELD = {
            name: 'integration_data',
            type: 'discriminator-picker',
            label: 'Integration data',
            choices: [
                { kind: 'constant', label: 'Constant', render: ConstantInput,
                    options: [], defaultValue: { constant: null } },
                { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                    options: [], defaultValue: { timeseries_id: null } }
            ]
        };

        it('renders the field-level label above the radios', () => {
            ReactDOM.render(
                <FormField field={FIELD} value={undefined} onChange={onChange} />,
                container
            );
            // The wrapper's outer label MUST render — without it, the user
            // doesn't see "Integration data:" / "Boundary value:" / "Data:".
            const labels = Array.from(container.querySelectorAll('label'))
                .map(l => l.textContent.trim());
            expect(labels.indexOf('Integration data:')).toNotBe(-1);
        });

        it('renders the outer simple-view-panel-item-row container', () => {
            ReactDOM.render(
                <FormField field={FIELD} value={undefined} onChange={onChange} />,
                container
            );
            // Sibling rows (text/number/checkbox/select widgets) all use this
            // class for layout consistency. Dropping it on discriminator-picker
            // would break visual alignment in the popup.
            expect(container.querySelector('.simple-view-panel-item-row')).toExist();
        });

        it('renders the radio row + active kind sub-widget via the registry', () => {
            ReactDOM.render(
                <FormField field={FIELD} value={undefined} onChange={onChange} />,
                container
            );
            const radios = container.querySelectorAll('input[type="radio"]');
            expect(radios.length).toBe(2);
            const values = Array.from(radios).map(r => r.value);
            expect(values.includes('constant')).toBe(true);
            expect(values.includes('timeseries')).toBe(true);
            // Default seed = first choice (constant), so ConstantInput renders.
            expect(container.querySelector('input.time-data-picker-constant')).toExist();
            expect(container.querySelector('select.time-data-picker-timeseries')).toBe(null);
        });
    });

    describe('FormField onChange contract — 2-arg with full canonical value', () => {
        // These tests are the CRITICAL regression guards. Direct registration
        // of the bare DiscriminatorPicker breaks the FormField onChange
        // contract: `field.name` becomes the value, real value becomes
        // undefined, reducer writes garbage. The wrapper translates the
        // 1-arg payload to a 2-arg call.
        const FIELD = {
            name: 'integration_data',
            type: 'discriminator-picker',
            label: 'Integration data',
            choices: [
                { kind: 'constant', label: 'Constant', render: ConstantInput,
                    options: [], defaultValue: { constant: null } },
                { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                    options: [], defaultValue: { timeseries_id: null } }
            ]
        };

        it('typing a constant value emits onChange(field.name, {kind:"constant", constant:Number})', () => {
            ReactDOM.render(
                <FormField field={FIELD} value={undefined} onChange={onChange} />,
                container
            );
            const numInput = container.querySelector('input.time-data-picker-constant');
            numInput.value = '3.14';
            Simulate.change(numInput);
            // 2-arg contract: name first, then full value object.
            expect(lastChange.name).toBe('integration_data');
            expect(lastChange.val).toEqual({ kind: 'constant', constant: 3.14 });
        });

        it('selecting a timeseries id emits onChange(field.name, {kind:"timeseries", timeseries_id:Number})', () => {
            const fieldWithTs = {
                ...FIELD,
                choices: [
                    FIELD.choices[0],
                    {
                        kind: 'timeseries',
                        label: 'TimeSeries',
                        render: TimeSeriesSelect,
                        options: [{ id: 7, name: 'TS7' }, { id: 9, name: 'TS9' }],
                        defaultValue: { timeseries_id: null }
                    }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={fieldWithTs}
                    value={{ kind: 'timeseries', timeseries_id: 7 }}
                    onChange={onChange}
                />,
                container
            );
            const select = container.querySelector('select.time-data-picker-timeseries');
            select.value = '9';
            Simulate.change(select);
            expect(lastChange.name).toBe('integration_data');
            expect(lastChange.val).toEqual({ kind: 'timeseries', timeseries_id: 9 });
        });

        it('switching from constant → timeseries canonicalizes via defaultValue (emits {kind, timeseries_id:null})', () => {
            ReactDOM.render(
                <FormField
                    field={FIELD}
                    value={{ kind: 'constant', constant: 5 }}
                    onChange={onChange}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            Simulate.change(tsRadio);
            // The wrapper merges defaultValue with the new kind. No existing
            // timeseries_id to preserve, so it's null. CRITICALLY: 'constant'
            // is NOT carried over — the wire payload is the BE CHECK shape.
            expect(lastChange.name).toBe('integration_data');
            expect(lastChange.val).toEqual({ kind: 'timeseries', timeseries_id: null });
            expect('constant' in lastChange.val).toBe(false);
        });

        it('switching with existing timeseries_id preserves the typed value through the reset', () => {
            // The user previously typed timeseries=7, then switched to
            // constant, then switched back to timeseries — their original
            // selection should come back. (Matches legacy TimeDataPicker.)
            ReactDOM.render(
                <FormField
                    field={FIELD}
                    value={{ kind: 'constant', constant: 5, timeseries_id: 7 }}
                    onChange={onChange}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            Simulate.change(tsRadio);
            expect(lastChange.val).toEqual({ kind: 'timeseries', timeseries_id: 7 });
        });
    });

    describe('round-trip seed via FormField + injected options', () => {
        it('value={kind:"timeseries", timeseries_id:7} → select shows option 7 selected', () => {
            const field = {
                name: 'integration_data',
                type: 'discriminator-picker',
                label: 'Integration data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    {
                        kind: 'timeseries',
                        label: 'TimeSeries',
                        render: TimeSeriesSelect,
                        options: [{ id: 7, name: 'TS7' }],
                        defaultValue: { timeseries_id: null }
                    }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: 7 }}
                    onChange={onChange}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            expect(tsRadio.checked).toBe(true);
            const tsSelect = container.querySelector('select.time-data-picker-timeseries');
            expect(tsSelect).toExist();
            expect(tsSelect.value).toBe('7');
            const opt7 = tsSelect.querySelector('option[value="7"]');
            expect(opt7).toExist();
            expect(opt7.textContent).toBe('TS7');
            expect(container.querySelector('input.time-data-picker-constant')).toBe(null);
        });

        it('value={kind:"constant", constant:0.42} → input shows 0.42 selected', () => {
            const field = {
                name: 'integration_data',
                type: 'discriminator-picker',
                label: 'Integration data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={field}
                    value={{ kind: 'constant', constant: 0.42 }}
                    onChange={onChange}
                />,
                container
            );
            const constRadio = container.querySelector('input[type="radio"][value="constant"]');
            expect(constRadio.checked).toBe(true);
            const numInput = container.querySelector('input.time-data-picker-constant');
            expect(numInput).toExist();
            expect(numInput.type).toBe('number');
            expect(numInput.value).toBe('0.42');
            expect(container.querySelector('select.time-data-picker-timeseries')).toBe(null);
        });
    });
});

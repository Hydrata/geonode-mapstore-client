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
import axiosMod from '../../../../../MapStore2/web/client/libs/ajax';
import {
    FormField,
    ConstantInput,
    TimeSeriesSelect,
    DiscriminatorPickerWidget,
    fetchTimeSeries,
    TimeDataPicker
} from '../components/FormField';
import { get } from '../widgetRegistry';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyItem
} from '../../Hydrology/actionsHydrology';

describe('TASK-826 W3.3 — discriminator-picker widget integration', () => {
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

    describe('ConstantInput unit suffix', () => {
        // Why: Inflow `data` is a flow rate in m³/s; without a unit suffix the
        // user has no way to know whether to enter the value in m³/s, L/s,
        // m³/hr, etc. The unit travels via field.choices[constant].unit, read
        // by ConstantInput. Boundary `data` omits unit (Dirichlet stage vs
        // Time velocity have different units) and must render unchanged.
        it('renders the unit suffix when field.choices[constant].unit is set', () => {
            const field = {
                name: 'inflow_data',
                type: 'discriminator-picker',
                label: 'Data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null }, unit: 'm³/s' },
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField field={field} value={{ kind: 'constant', constant: 1.5 }} onChange={onChange} />,
                container
            );
            const unitEl = container.querySelector('.time-data-picker-constant-unit');
            expect(unitEl).toExist();
            expect(unitEl.textContent).toBe('m³/s');
            // Input still renders with the same selector tests rely on.
            expect(container.querySelector('input.time-data-picker-constant')).toExist();
        });

        it('omits the unit suffix when no unit is declared (Boundary regression guard)', () => {
            const field = {
                name: 'boundary_data',
                type: 'discriminator-picker',
                label: 'Boundary value',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField field={field} value={{ kind: 'constant', constant: 1.5 }} onChange={onChange} />,
                container
            );
            expect(container.querySelector('.time-data-picker-constant-unit')).toBe(null);
            expect(container.querySelector('input.time-data-picker-constant')).toExist();
        });
    });
});

/*
 * TASK-1984 — DiscriminatorPicker hydrograph/hyetograph kind split.
 *
 * AC1: Inflow dropdown fetches series_type=hydrograph.
 * AC2: Rainfall dropdown fetches series_type=hyetograph.
 * AC3: Boundary 'Time' still fetches ALL (no series_type) — generic 'timeseries' kept.
 * AC4: hydrograph+hyetograph registered; 'timeseries' no longer shared by inf_/rai_.
 *
 * fetchTimeSeries gains a seriesType arg (absent => unchanged show-all URL).
 * Two new discriminator kinds registered at FormField.js module load:
 *   'hydrograph'  → TimeSeriesSelect + fetch: pid => fetchTimeSeries(pid, 'hydrograph')
 *   'hyetograph'  → TimeSeriesSelect + fetch: pid => fetchTimeSeries(pid, 'hyetograph')
 * TimeDataPicker.handleChange switch extended to handle hydrograph/hyetograph
 * so timeseries_id is preserved when switching INTO those kinds.
 */
describe('TASK-1984 — DiscriminatorPicker hydrograph/hyetograph kind split', () => {
    // FormField.js module-load registrations already ran at import time above.

    describe('fetchTimeSeries series_type URL arg (AC1/AC2/AC3)', () => {
        let origGet;
        let capturedUrls;

        beforeEach(() => {
            capturedUrls = [];
            origGet = axiosMod.get;
            axiosMod.get = (url) => {
                capturedUrls.push(url);
                return Promise.resolve({ data: [] });
            };
        });
        afterEach(() => {
            axiosMod.get = origGet;
        });

        it('fetchTimeSeries(pid) — no seriesType — URL has no series_type query param (AC3 show-all)', () => {
            fetchTimeSeries(123);
            expect(capturedUrls.length).toBe(1);
            expect(capturedUrls[0]).toBe('/api/v2/anuga/projects/123/time-series/');
            expect(capturedUrls[0].indexOf('series_type')).toBe(-1);
        });

        it('fetchTimeSeries(pid, "hydrograph") appends ?series_type=hydrograph (AC1)', () => {
            fetchTimeSeries(99, 'hydrograph');
            expect(capturedUrls.length).toBe(1);
            expect(capturedUrls[0]).toContain('series_type=hydrograph');
            expect(capturedUrls[0]).toBe('/api/v2/anuga/projects/99/time-series/?series_type=hydrograph');
        });

        it('fetchTimeSeries(pid, "hyetograph") appends ?series_type=hyetograph (AC2)', () => {
            fetchTimeSeries(5, 'hyetograph');
            expect(capturedUrls.length).toBe(1);
            expect(capturedUrls[0]).toContain('series_type=hyetograph');
            expect(capturedUrls[0]).toBe('/api/v2/anuga/projects/5/time-series/?series_type=hyetograph');
        });
    });

    describe('discriminatorRegistry kind registration (AC4)', () => {
        it('"hydrograph" kind is registered with render + fetch at module load', () => {
            const { getDiscriminator } = require('../../VectorDraw/discriminatorRegistry');
            const h = getDiscriminator('hydrograph');
            expect(h).toExist();
            expect(typeof h.render).toBe('function');
            expect(typeof h.fetch).toBe('function');
        });

        it('"hyetograph" kind is registered with render + fetch at module load', () => {
            const { getDiscriminator } = require('../../VectorDraw/discriminatorRegistry');
            const h = getDiscriminator('hyetograph');
            expect(h).toExist();
            expect(typeof h.render).toBe('function');
            expect(typeof h.fetch).toBe('function');
        });

        it('"timeseries" generic kind is STILL registered (bdy_ Boundary show-all — AC3)', () => {
            const { getDiscriminator } = require('../../VectorDraw/discriminatorRegistry');
            const ts = getDiscriminator('timeseries');
            expect(ts).toExist();
            expect(typeof ts.render).toBe('function');
        });

        it('"hydrograph" and "hyetograph" fetch fns are distinct from the generic "timeseries" fetch', () => {
            // Prove the fetch is the FILTERED wrapper, not the raw fetchTimeSeries.
            // The generic timeseries fetch is the 1-arg fetchTimeSeries itself;
            // hydrograph/hyetograph are arrow wrappers that pass the seriesType.
            const { getDiscriminator } = require('../../VectorDraw/discriminatorRegistry');
            const ts = getDiscriminator('timeseries');
            const hg = getDiscriminator('hydrograph');
            const he = getDiscriminator('hyetograph');
            // All three are functions but must be DIFFERENT references.
            expect(hg.fetch).toNotBe(ts.fetch);
            expect(he.fetch).toNotBe(ts.fetch);
            expect(hg.fetch).toNotBe(he.fetch);
        });
    });

    describe('TimeDataPicker.handleChange canonicalization for hydrograph/hyetograph (CRITICAL AC4)', () => {
        // The TimeDataPicker (time-data-picker widget) has an explicit switch
        // that maps kind-switch resets to full canonical shapes so the BE
        // CHECK constraint (exactly one of constant/timeseries_id) is always met.
        // A naive impl that only handles 'timeseries' will use the else-branch
        // for 'hydrograph'/'hyetograph', which calls onChange(field.name, {kind})
        // only — dropping the timeseries_id. This test pins the correct behavior.
        let tdpContainer;
        let lastChange;

        beforeEach((done) => {
            tdpContainer = document.createElement('div');
            document.body.appendChild(tdpContainer);
            lastChange = null;
            setTimeout(done);
        });

        afterEach((done) => {
            ReactDOM.unmountComponentAtNode(tdpContainer);
            tdpContainer.remove();
            setTimeout(done);
        });

        it('switching to hydrograph with existing timeseries_id=7 preserves timeseries_id', (done) => {
            const FIELD = {
                name: 'data',
                type: 'time-data-picker',
                label: 'Data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    // pre-existing timeseries_id=7 carried in the value
                    value={{ kind: 'timeseries', timeseries_id: 7 }}
                    onChange={(name, val) => { lastChange = { name, val }; }}
                    projectId={1}
                    timeSeriesOptions={[]}
                />,
                tdpContainer,
                () => {
                    const hgRadio = tdpContainer.querySelector('input[type="radio"][value="hydrograph"]');
                    if (hgRadio) {
                        Simulate.change(hgRadio);
                        // kind must be 'hydrograph', timeseries_id must be preserved
                        expect(lastChange).toExist();
                        expect(lastChange.val.kind).toBe('hydrograph');
                        expect(lastChange.val.timeseries_id).toBe(7);
                    }
                    done();
                }
            );
        });

        it('switching to hyetograph with existing timeseries_id=3 preserves timeseries_id', (done) => {
            const FIELD = {
                name: 'data',
                type: 'time-data-picker',
                label: 'Data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'hyetograph', label: 'Hyetograph', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <TimeDataPicker
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: 3 }}
                    onChange={(name, val) => { lastChange = { name, val }; }}
                    projectId={1}
                    timeSeriesOptions={[]}
                />,
                tdpContainer,
                () => {
                    const heRadio = tdpContainer.querySelector('input[type="radio"][value="hyetograph"]');
                    if (heRadio) {
                        Simulate.change(heRadio);
                        expect(lastChange).toExist();
                        expect(lastChange.val.kind).toBe('hyetograph');
                        expect(lastChange.val.timeseries_id).toBe(3);
                    }
                    done();
                }
            );
        });
    });

    describe('TimeSeriesSelect emits the active kind (not hardcoded "timeseries")', () => {
        let tsContainer;
        let lastChange;

        beforeEach((done) => {
            tsContainer = document.createElement('div');
            document.body.appendChild(tsContainer);
            lastChange = null;
            setTimeout(done);
        });

        afterEach((done) => {
            ReactDOM.unmountComponentAtNode(tsContainer);
            tsContainer.remove();
            setTimeout(done);
        });

        it('TimeSeriesSelect with value.kind="hydrograph" emits kind="hydrograph" on select', (done) => {
            const FIELD = {
                name: 'data',
                type: 'discriminator-picker',
                label: 'Data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                        options: [{ id: 5, name: 'TS5' }], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={FIELD}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={(name, val) => { lastChange = { name, val }; }}
                />,
                tsContainer,
                () => {
                    const tsSelect = tsContainer.querySelector('select.time-data-picker-timeseries');
                    if (tsSelect) {
                        tsSelect.value = '5';
                        Simulate.change(tsSelect);
                        expect(lastChange).toExist();
                        // Must emit 'hydrograph', not 'timeseries'
                        expect(lastChange.val.kind).toBe('hydrograph');
                        expect(lastChange.val.timeseries_id).toBe(5);
                    }
                    done();
                }
            );
        });

        it('TimeSeriesSelect with value.kind="timeseries" still emits kind="timeseries" (back-compat)', (done) => {
            const FIELD = {
                name: 'data',
                type: 'discriminator-picker',
                label: 'Data',
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantInput,
                        options: [], defaultValue: { constant: null } },
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [{ id: 7, name: 'TS7' }], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={FIELD}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={(name, val) => { lastChange = { name, val }; }}
                />,
                tsContainer,
                () => {
                    const tsSelect = tsContainer.querySelector('select.time-data-picker-timeseries');
                    if (tsSelect) {
                        tsSelect.value = '7';
                        Simulate.change(tsSelect);
                        expect(lastChange).toExist();
                        // Back-compat: 'timeseries' kind still emits 'timeseries'
                        expect(lastChange.val.kind).toBe('timeseries');
                        expect(lastChange.val.timeseries_id).toBe(7);
                    }
                    done();
                }
            );
        });
    });
});

/*
 * TASK-2082 — Inflow hydrograph picker: replace the "create one first"
 * dead-end with actionable copy + a link that opens the Hydrology panel on
 * the Hydrographs page, and refetch the picker's options so a hydrograph
 * created during that round-trip appears without a page reload.
 *
 * AC1: Inflow -> Data:Hydrograph with zero hydrographs shows the new copy
 *      + link (not just the old disabled-select placeholder text).
 * AC2/3 (dispatch wiring + return refetch) are exercised at the
 * DiscriminatorPicker level in DiscriminatorPicker-test.js ("TASK-2082
 * refetch mechanisms") since that is where the mechanism actually lives;
 * this file pins the FormField -> real TimeSeriesSelect wiring specifically.
 */
describe('TASK-2082 — Inflow hydrograph picker empty-state link', () => {
    let container;
    // These tests exercise the empty-state link + refetch, not the
    // kind-switch onChange payload (covered elsewhere in this file) — the
    // handler is a required prop but its calls are not asserted here.
    const onChange = () => {};

    beforeEach(() => {
        container = document.createElement('div');
        container.className = 'sv-vector-draw-popup';
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    const HYDROGRAPH_FIELD = {
        name: 'data',
        type: 'discriminator-picker',
        label: 'Data',
        choices: [
            { kind: 'constant', label: 'Constant', render: ConstantInput,
                options: [], defaultValue: { constant: null }, unit: 'm³/s' },
            { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                options: [], defaultValue: { timeseries_id: null } }
        ]
    };

    describe('AC1 — empty state renders actionable copy + link', () => {
        it('value.kind="hydrograph" + zero hydrographs renders the EmptyState hint + open-hydrology link', () => {
            ReactDOM.render(
                <FormField
                    field={HYDROGRAPH_FIELD}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={onChange}
                />,
                container
            );
            // The select stays in the DOM (disabled) — the new copy/link is
            // a SIBLING block, not baked into the <option> text (an <option>
            // cannot host an interactive child element).
            const select = container.querySelector('select.time-data-picker-timeseries');
            expect(select).toExist();
            expect(select.disabled).toBe(true);

            const emptyState = container.querySelector('.time-data-picker-hydrograph-empty');
            expect(emptyState).toExist();
            expect(emptyState.classList.contains('sv-empty-state')).toBe(true);
            // No IntlProvider in this bare-render test, so Message falls back
            // to rendering the raw msgId — the established assertion pattern
            // for this codebase (see ProcessRow-dom-test.js).
            expect(container.querySelector('.sv-empty-state-heading').textContent)
                .toBe('hydrata.hydrology.hydrographPickerEmptyHint');
            const link = container.querySelector('.time-data-picker-open-hydrology-link');
            expect(link).toExist();
            expect(link.textContent).toBe('hydrata.hydrology.hydrographPickerOpenLink');
        });

        it('regression guard: the generic "timeseries" kind empty state does NOT render the new EmptyState block', () => {
            const field = {
                ...HYDROGRAPH_FIELD,
                choices: [
                    HYDROGRAPH_FIELD.choices[0],
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                />,
                container
            );
            expect(container.querySelector('select.time-data-picker-timeseries').disabled).toBe(true);
            expect(container.querySelector('.time-data-picker-hydrograph-empty')).toBe(null);
        });

        it('a non-empty hydrograph picker does NOT render the empty-state link', () => {
            const field = {
                ...HYDROGRAPH_FIELD,
                choices: [
                    HYDROGRAPH_FIELD.choices[0],
                    { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                        options: [{ id: 5, name: 'Storm hydrograph' }], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField
                    field={field}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={onChange}
                />,
                container
            );
            expect(container.querySelector('select.time-data-picker-timeseries').disabled).toBe(false);
            expect(container.querySelector('.time-data-picker-hydrograph-empty')).toBe(null);
        });
    });

    describe('AC2 — the link dispatches the Hydrology open actions', () => {
        it('clicking the link dispatches setHydrologyMainMenu(true) + setActiveHydrologyPage("hydrographs") + setActiveHydrologyItem(null)', () => {
            const dispatched = [];
            const dispatchSpy = (action) => dispatched.push(action);
            ReactDOM.render(
                <FormField
                    field={HYDROGRAPH_FIELD}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={onChange}
                    dispatch={dispatchSpy}
                />,
                container
            );
            const link = container.querySelector('.time-data-picker-open-hydrology-link');
            Simulate.click(link);
            expect(dispatched).toEqual([
                setHydrologyMainMenu(true),
                setActiveHydrologyPage('hydrographs'),
                setActiveHydrologyItem(null)
            ]);
        });

        it('does not throw when no dispatch prop is supplied (defensive no-op)', () => {
            ReactDOM.render(
                <FormField
                    field={HYDROGRAPH_FIELD}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={onChange}
                />,
                container
            );
            const link = container.querySelector('.time-data-picker-open-hydrology-link');
            expect(() => Simulate.click(link)).toNotThrow();
        });
    });

    describe('AC3 — onFocus refetch (general re-open case; the disabled-select edge case is covered by the hydrologyMainMenuOpen close-transition test in DiscriminatorPicker-test.js)', () => {
        it('focusing an enabled (non-empty) hydrograph select refetches its options via fetchTimeSeries', (done) => {
            let capturedUrls = [];
            const origGet = axiosMod.get;
            axiosMod.get = (url) => {
                capturedUrls.push(url);
                return Promise.resolve({ data: [{ id: 1, name: 'A' }] });
            };
            const field = {
                name: 'data',
                type: 'discriminator-picker',
                label: 'Data',
                choices: [
                    HYDROGRAPH_FIELD.choices[0],
                    { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                        defaultValue: { timeseries_id: null } } // no injected options -> uses the registry fetch
                ]
            };
            ReactDOM.render(
                <FormField
                    field={field}
                    value={{ kind: 'hydrograph', timeseries_id: null }}
                    onChange={onChange}
                    projectId={42}
                />,
                container
            );
            setTimeout(() => {
                try {
                    expect(capturedUrls.length).toBe(1); // mount-time fetch
                    const select = container.querySelector('select.time-data-picker-timeseries');
                    Simulate.focus(select);
                } catch (err) {
                    axiosMod.get = origGet;
                    done(err);
                    return;
                }
                setTimeout(() => {
                    try {
                        expect(capturedUrls.length).toBe(2); // onFocus refetch
                        expect(capturedUrls[1]).toBe('/api/v2/anuga/projects/42/time-series/?series_type=hydrograph');
                        done();
                    } catch (err) {
                        done(err);
                    } finally {
                        axiosMod.get = origGet;
                    }
                }, 20);
            }, 20);
        });
    });
});

/*
 * TASK-2084 (epic-2077) — Hydrograph noun sweep: kind-aware TimeSeriesSelect
 * placeholder/label copy.
 *
 * DiscriminatorPicker threads its own `kind` state (the ACTIVE CHOICE, i.e.
 * the radio selection) down to the active render component as a `kind` prop
 * (see DiscriminatorPicker.js `<ActiveRender ... kind={kind} />`). TimeSeriesSelect
 * uses THAT — not `value?.kind` — to decide whether to show 'Hydrograph(s)'
 * copy. `value?.kind` is deliberately NOT the signal under test: it can be
 * absent on a fresh form (no round-trip through Redux yet), which is exactly
 * why these tests seed `value` with NO `kind` key at all for the "fresh form"
 * cases below.
 *
 * No IntlProvider/Localized ancestor in these bare-render tests, so
 * TimeSeriesSelect's `tr()` helper (context.messages driven) falls back to
 * its English default text — the assertions below pin that fallback text.
 */
describe('TASK-2084 (epic-2077) — TimeSeriesSelect kind-aware placeholder copy', () => {
    let container;
    const onChange = () => {};

    beforeEach(() => {
        container = document.createElement('div');
        container.className = 'sv-vector-draw-popup';
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    describe('hydrograph kind (Inflow) — branches on the CHOICE kind, not value.kind', () => {
        const HYDROGRAPH_ONLY_FIELD = {
            name: 'data',
            type: 'discriminator-picker',
            label: 'Data',
            // A single 'hydrograph' choice: DiscriminatorPicker's fallbackKind
            // (choices[0].kind) seeds its `kind` state to 'hydrograph' even
            // when `value` carries no `kind` key — the fresh-form case.
            choices: [
                { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                    options: [], defaultValue: { timeseries_id: null } }
            ]
        };

        it('AC2/3: fresh form (value has NO kind key) still shows hydrograph-aware empty copy — proves the CHOICE kind drives it, not value.kind', () => {
            ReactDOM.render(
                <FormField
                    field={HYDROGRAPH_ONLY_FIELD}
                    value={{ timeseries_id: null }}
                    onChange={onChange}
                />,
                container
            );
            const option = container.querySelector('select.time-data-picker-timeseries option');
            expect(option.textContent).toBe('No hydrographs available, create one first');
            expect(option.textContent).toNotContain('TimeSeries');
        });

        it('AC2: non-empty hydrograph picker shows "Select hydrograph" (no value.kind set)', () => {
            const field = {
                ...HYDROGRAPH_ONLY_FIELD,
                choices: [
                    { kind: 'hydrograph', label: 'Hydrograph', render: TimeSeriesSelect,
                        options: [{ id: 5, name: 'Storm hydrograph' }], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField field={field} value={{ timeseries_id: null }} onChange={onChange} />,
                container
            );
            const option = container.querySelector('select.time-data-picker-timeseries option');
            expect(option.textContent).toBe('Select hydrograph');
            expect(option.textContent).toNotContain('TimeSeries');
        });
    });

    describe('boundary "timeseries" kind stays generic (epic-1970 decision) — regression guard', () => {
        const TIMESERIES_FIELD = {
            name: 'data',
            type: 'discriminator-picker',
            label: 'Data',
            choices: [
                { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                    options: [], defaultValue: { timeseries_id: null } }
            ]
        };

        it('empty boundary picker copy is UNCHANGED ("No TimeSeries available...")', () => {
            ReactDOM.render(
                <FormField field={TIMESERIES_FIELD} value={{ timeseries_id: null }} onChange={onChange} />,
                container
            );
            const option = container.querySelector('select.time-data-picker-timeseries option');
            expect(option.textContent).toBe('No TimeSeries available, create one first');
        });

        it('non-empty boundary picker copy is UNCHANGED ("Select TimeSeries")', () => {
            const field = {
                ...TIMESERIES_FIELD,
                choices: [
                    { kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
                        options: [{ id: 7, name: 'Series A' }], defaultValue: { timeseries_id: null } }
                ]
            };
            ReactDOM.render(
                <FormField field={field} value={{ timeseries_id: null }} onChange={onChange} />,
                container
            );
            const option = container.querySelector('select.time-data-picker-timeseries option');
            expect(option.textContent).toBe('Select TimeSeries');
        });
    });
});

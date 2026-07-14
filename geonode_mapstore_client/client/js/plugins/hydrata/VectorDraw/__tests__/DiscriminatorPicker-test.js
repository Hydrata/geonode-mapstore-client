/*
 * TASK-825 (W3.2) — Tests for the generalized DiscriminatorPicker.
 *
 * DiscriminatorPicker is the generalization of the TASK-795 TimeDataPicker:
 * a radio row over a configurable list of "kinds", with the active kind's
 * render component receiving {value, onChange, options, loading, error,
 * field}. These tests exercise the component directly (not via FormField +
 * widgetRegistry) so the process-global registry from widgetRegistry.js
 * cannot pollute results.
 *
 * The wrapper-level behaviour (TimeDataPicker DOM, CSS classes, value
 * shape `{kind, constant}` / `{kind, timeseries_id}`) is covered by the
 * companion TimeDataPicker-test.js — those tests MUST keep passing
 * unchanged after this refactor.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';
import { DiscriminatorPicker } from '../components/DiscriminatorPicker';

const FIELD_BASE = { name: 'src', label: 'Source', type: 'discriminator-picker' };

// Three simple render components for the 3-kind generalization tests.
// They each emit the kind-canonical value shape via their onChange prop.
const ConstantRender = ({ value, onChange }) => (
    <input
        type="number"
        className="test-constant"
        value={value?.constant ?? ''}
        onChange={(e) => onChange({
            kind: 'constant',
            constant: e.target.value === '' ? null : parseFloat(e.target.value)
        })}
    />
);

const TimeSeriesRender = ({ value, onChange, options, loading, error }) => (
    <div>
        <select
            className="test-timeseries"
            value={value?.timeseries_id ?? ''}
            disabled={loading}
            onChange={(e) => onChange({
                kind: 'timeseries',
                timeseries_id: e.target.value === '' ? null : parseInt(e.target.value, 10)
            })}
        >
            <option value="">Pick</option>
            {(options || []).map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
            ))}
        </select>
        {error ? <p className="test-error">{error}</p> : null}
    </div>
);

const RainfallGridRender = ({ value, onChange, options }) => (
    <select
        className="test-rainfall"
        value={value?.rainfall_grid_id ?? ''}
        onChange={(e) => onChange({
            kind: 'rainfall-grid',
            rainfall_grid_id: e.target.value === '' ? null : parseInt(e.target.value, 10)
        })}
    >
        <option value="">Pick a grid</option>
        {(options || []).map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
        ))}
    </select>
);

describe('TASK-825 DiscriminatorPicker', () => {
    let container;
    let lastChange;
    const onChange = (val) => { lastChange = val; };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        lastChange = null;
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    describe('radio rendering', () => {
        it('renders one radio button per choice (3 choices proves it generalizes beyond 2)', () => {
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantRender },
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, options: [] },
                    { kind: 'rainfall-grid', label: 'Rainfall grid', render: RainfallGridRender, options: [] }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker field={field} value={undefined} onChange={onChange} />,
                container
            );
            const radios = container.querySelectorAll('input[type="radio"]');
            expect(radios.length).toBe(3);
            const values = Array.from(radios).map(r => r.value);
            expect(values).toEqual(['constant', 'timeseries', 'rainfall-grid']);
            // Labels also rendered (radio label text accompanies each radio).
            const labels = container.querySelectorAll('.discriminator-picker-radios label');
            expect(labels.length).toBe(3);
            const labelTexts = Array.from(labels).map(l => l.textContent.trim());
            expect(labelTexts).toEqual(['Constant', 'Time series', 'Rainfall grid']);
        });
    });

    describe('initial kind seeding', () => {
        it('defaults to first choice when value is undefined', () => {
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantRender },
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, options: [] }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker field={field} value={undefined} onChange={onChange} />,
                container
            );
            const constantRadio = container.querySelector('input[type="radio"][value="constant"]');
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            expect(constantRadio.checked).toBe(true);
            expect(tsRadio.checked).toBe(false);
            // Constant render is mounted; TimeSeries render is not.
            expect(container.querySelector('.test-constant')).toExist();
            expect(container.querySelector('.test-timeseries')).toBe(null);
        });

        it('seeds to value.kind when present and a declared choice', () => {
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantRender },
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, options: [{id: 1, name: 'A'}] }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: 1 }}
                    onChange={onChange}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            expect(tsRadio.checked).toBe(true);
            expect(container.querySelector('.test-timeseries')).toExist();
            expect(container.querySelector('.test-constant')).toBe(null);
        });
    });

    describe('kind switch', () => {
        it('emits onChange({kind:newKind}) on radio change (reset shape, no other keys)', () => {
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'constant', label: 'Constant', render: ConstantRender },
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, options: [] }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'constant', constant: 5 }}
                    onChange={onChange}
                />,
                container
            );
            const tsRadio = container.querySelector('input[type="radio"][value="timeseries"]');
            Simulate.change(tsRadio, { target: { value: 'timeseries' } });
            expect(lastChange).toEqual({ kind: 'timeseries' });
            // No leftover keys from the previous kind — the render fills in
            // its own fields on the next user interaction.
            expect('constant' in lastChange).toBe(false);
            expect(Object.keys(lastChange)).toEqual(['kind']);
        });
    });

    describe('render component prop contract', () => {
        it('active kind render receives {value, onChange, options, loading, error, field}', () => {
            let lastProps = null;
            const SpyRender = (props) => {
                lastProps = props;
                return <div className="spy-render" />;
            };
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'spy', label: 'Spy', render: SpyRender, options: [{id: 1, name: 'one'}] }
                ]
            };
            const seedValue = { kind: 'spy', spy_id: 99 };
            ReactDOM.render(
                <DiscriminatorPicker field={field} value={seedValue} onChange={onChange} />,
                container
            );
            expect(lastProps).toExist();
            // Full value object is passed through (NOT wrapped).
            expect(lastProps.value).toEqual({ kind: 'spy', spy_id: 99 });
            // onChange is a function and is the parent's onChange (passthrough).
            expect(typeof lastProps.onChange).toBe('function');
            // Options propagated from field.choices[i].options injection.
            expect(lastProps.options).toEqual([{id: 1, name: 'one'}]);
            // No fetch for this choice → loading=false from the start.
            expect(lastProps.loading).toBe(false);
            // No error.
            expect(lastProps.error).toBe(null);
            // Field is the parent field descriptor.
            expect(lastProps.field).toBe(field);
            // Direct passthrough — calling onChange in the render dispatches
            // verbatim to the parent's onChange.
            lastProps.onChange({ kind: 'spy', spy_id: 42 });
            expect(lastChange).toEqual({ kind: 'spy', spy_id: 42 });
        });
    });

    describe('fetch lifecycle', () => {
        it('triggers fetch on mount and populates options for the render', (done) => {
            const fetchSpy = (pid) => Promise.resolve([
                { id: 1, name: `A-${pid}` },
                { id: 2, name: `B-${pid}` }
            ]);
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, fetch: fetchSpy }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={7}
                />,
                container
            );
            // Initial render: loading=true → select disabled.
            const select = container.querySelector('.test-timeseries');
            expect(select).toExist();
            expect(select.disabled).toBe(true);
            // After the next microtask + the React re-render, options should
            // be populated. Use setTimeout(...,0) to give React time to commit
            // the state updates from the fetch resolution.
            setTimeout(() => {
                try {
                    const updatedSelect = container.querySelector('.test-timeseries');
                    expect(updatedSelect.disabled).toBe(false);
                    const options = updatedSelect.querySelectorAll('option');
                    // Placeholder + 2 fetched items.
                    expect(options.length).toBe(3);
                    expect(options[1].textContent).toBe('A-7');
                    expect(options[2].textContent).toBe('B-7');
                    done();
                } catch (err) {
                    done(err);
                }
            }, 20);
        });

        it('propagates error to the render component when fetch rejects', (done) => {
            const fetchSpy = () => Promise.reject(new Error('boom: cannot load'));
            const field = {
                ...FIELD_BASE,
                choices: [
                    { kind: 'timeseries', label: 'Time series', render: TimeSeriesRender, fetch: fetchSpy }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={3}
                />,
                container
            );
            setTimeout(() => {
                try {
                    const errEl = container.querySelector('.test-error');
                    expect(errEl).toExist();
                    expect(errEl.textContent).toBe('boom: cannot load');
                    done();
                } catch (err) {
                    done(err);
                }
            }, 20);
        });
    });

    describe('injected options bypass fetch', () => {
        it('does NOT call fetch when field.choices[i].options is pre-supplied', (done) => {
            let fetchCallCount = 0;
            const fetchSpy = () => {
                fetchCallCount += 1;
                return Promise.resolve([{ id: 99, name: 'should-not-appear' }]);
            };
            const field = {
                ...FIELD_BASE,
                choices: [
                    {
                        kind: 'timeseries',
                        label: 'Time series',
                        render: TimeSeriesRender,
                        // Both `options` (injection) AND `fetch` (would-be fetch).
                        // The injection must win.
                        options: [{ id: 1, name: 'Injected' }],
                        fetch: fetchSpy
                    }
                ]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={7}
                />,
                container
            );
            // The injected options should be reflected immediately + the
            // fetch must never run. Wait one tick to be sure the effect
            // had a chance to dispatch.
            setTimeout(() => {
                try {
                    expect(fetchCallCount).toBe(0);
                    const select = container.querySelector('.test-timeseries');
                    const options = select.querySelectorAll('option');
                    expect(options.length).toBe(2); // placeholder + 1 injected
                    expect(options[1].textContent).toBe('Injected');
                    done();
                } catch (err) {
                    done(err);
                }
            }, 20);
        });
    });

    /*
     * TASK-2082 — refetch mechanisms. The mount-time fetch effect (above)
     * only re-runs on [projectId]; a hydrograph created AFTER mount (e.g.
     * via the Hydrology panel, while this picker stays mounted) never
     * appears without an explicit refetch trigger.
     */
    describe('TASK-2082 refetch mechanisms', () => {
        it('passes dispatch + onRefetchOptions through to the active render component', () => {
            let lastProps = null;
            const SpyRender = (props) => {
                lastProps = props;
                return <div className="spy-render" />;
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'spy', label: 'Spy', render: SpyRender, options: [] }]
            };
            const dispatchSpy = () => {};
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'spy' }}
                    onChange={onChange}
                    dispatch={dispatchSpy}
                />,
                container
            );
            expect(lastProps.dispatch).toBe(dispatchSpy);
            expect(typeof lastProps.onRefetchOptions).toBe('function');
        });

        it('onRefetchOptions() re-invokes the active kind\'s fetch and updates its options', (done) => {
            let callCount = 0;
            const fetchSpy = () => {
                callCount += 1;
                return Promise.resolve([{ id: callCount, name: `Row-${callCount}` }]);
            };
            let lastProps = null;
            const SpyRender = (props) => {
                lastProps = props;
                return <div className="spy-render" />;
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'ts', label: 'TS', render: SpyRender, fetch: fetchSpy }]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'ts' }}
                    onChange={onChange}
                    projectId={9}
                />,
                container
            );
            setTimeout(() => {
                try {
                    expect(callCount).toBe(1);
                    expect(lastProps.options).toEqual([{ id: 1, name: 'Row-1' }]);
                    lastProps.onRefetchOptions();
                } catch (err) {
                    done(err);
                    return;
                }
                setTimeout(() => {
                    try {
                        expect(callCount).toBe(2);
                        expect(lastProps.options).toEqual([{ id: 2, name: 'Row-2' }]);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 20);
            }, 20);
        });

        it('refetches the active kind when hydrologyMainMenuOpen transitions true -> false (the Hydrology panel just closed)', (done) => {
            let callCount = 0;
            const fetchSpy = () => {
                callCount += 1;
                return Promise.resolve([{ id: callCount, name: `Row-${callCount}` }]);
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'ts', label: 'TS', render: TimeSeriesRender, fetch: fetchSpy }]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'ts', timeseries_id: null }}
                    onChange={onChange}
                    projectId={9}
                    hydrologyMainMenuOpen
                />,
                container
            );
            setTimeout(() => {
                try {
                    expect(callCount).toBe(1);
                } catch (err) {
                    done(err);
                    return;
                }
                // Hydrology panel closes: true -> false.
                ReactDOM.render(
                    <DiscriminatorPicker
                        field={field}
                        value={{ kind: 'ts', timeseries_id: null }}
                        onChange={onChange}
                        projectId={9}
                        hydrologyMainMenuOpen={false}
                    />,
                    container
                );
                setTimeout(() => {
                    try {
                        expect(callCount).toBe(2);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 20);
            }, 20);
        });

        it('does NOT refetch when hydrologyMainMenuOpen stays the same or flips false -> true (opening)', (done) => {
            let callCount = 0;
            const fetchSpy = () => {
                callCount += 1;
                return Promise.resolve([]);
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'ts', label: 'TS', render: TimeSeriesRender, fetch: fetchSpy }]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'ts', timeseries_id: null }}
                    onChange={onChange}
                    projectId={9}
                    hydrologyMainMenuOpen={false}
                />,
                container
            );
            setTimeout(() => {
                try {
                    expect(callCount).toBe(1);
                } catch (err) {
                    done(err);
                    return;
                }
                // Opening (false -> true) must NOT trigger a refetch — only
                // the close transition should.
                ReactDOM.render(
                    <DiscriminatorPicker
                        field={field}
                        value={{ kind: 'ts', timeseries_id: null }}
                        onChange={onChange}
                        projectId={9}
                        hydrologyMainMenuOpen
                    />,
                    container
                );
                setTimeout(() => {
                    try {
                        expect(callCount).toBe(1);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 20);
            }, 20);
        });
    });

    describe('TASK-2127 stale-while-revalidate (onFocus refetch must not disable a populated select)', () => {
        // Local double: wires onFocus -> onRefetchOptions, mirroring
        // FormField.js's real TimeSeriesSelect.handleFocus, so Simulate.focus
        // exercises the same refetchKind() path the production bug lived in.
        const TimeSeriesRenderWithFocus = ({ value, onChange: onSelect, options, loading, onRefetchOptions }) => (
            <select
                className="test-timeseries-focus"
                value={value?.timeseries_id ?? ''}
                disabled={loading}
                onFocus={() => { if (typeof onRefetchOptions === 'function') onRefetchOptions(); }}
                onChange={(e) => onSelect({
                    kind: 'timeseries',
                    timeseries_id: e.target.value === '' ? null : parseInt(e.target.value, 10)
                })}
            >
                <option value="">Pick</option>
                {(options || []).map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                ))}
            </select>
        );

        it("keeps a populated kind's select enabled during background refetch", (done) => {
            let callCount = 0;
            const fetchSpy = () => {
                callCount += 1;
                if (callCount === 1) {
                    return Promise.resolve([{ id: 1, name: 'Row-1' }]);
                }
                // The background refetch (2nd+ call) never resolves within
                // the test window — simulates an in-flight request so the
                // assertions below observe the "mid-refetch" state.
                return new Promise(() => {});
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'ts', label: 'TS', render: TimeSeriesRenderWithFocus, fetch: fetchSpy }]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={9}
                />,
                container
            );
            setTimeout(() => {
                let select;
                try {
                    select = container.querySelector('.test-timeseries-focus');
                    expect(callCount).toBe(1);
                    expect(select.disabled).toBe(false);
                    Simulate.focus(select);
                } catch (err) {
                    done(err);
                    return;
                }
                setTimeout(() => {
                    try {
                        expect(callCount).toBe(2);
                        // The background refetch is still in flight (never
                        // resolves) — the select must NOT have been disabled
                        // by it (TASK-2127 fix: no loading flip for an
                        // already-populated kind).
                        const stillThere = container.querySelector('.test-timeseries-focus');
                        expect(stillThere.disabled).toBe(false);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 20);
            }, 20);
        });

        it('preserves rendered options while refetch is in flight', (done) => {
            let callCount = 0;
            const fetchSpy = () => {
                callCount += 1;
                if (callCount === 1) {
                    return Promise.resolve([{ id: 1, name: 'Row-1' }, { id: 2, name: 'Row-2' }]);
                }
                return new Promise(() => {});
            };
            const field = {
                ...FIELD_BASE,
                choices: [{ kind: 'ts', label: 'TS', render: TimeSeriesRenderWithFocus, fetch: fetchSpy }]
            };
            ReactDOM.render(
                <DiscriminatorPicker
                    field={field}
                    value={{ kind: 'timeseries', timeseries_id: null }}
                    onChange={onChange}
                    projectId={9}
                />,
                container
            );
            setTimeout(() => {
                let select;
                try {
                    select = container.querySelector('.test-timeseries-focus');
                    expect(select.querySelectorAll('option').length).toBe(3); // placeholder + 2
                    Simulate.focus(select);
                } catch (err) {
                    done(err);
                    return;
                }
                setTimeout(() => {
                    try {
                        expect(callCount).toBe(2);
                        const stillThere = container.querySelector('.test-timeseries-focus');
                        // Previously-fetched options must still be rendered —
                        // an in-flight background refetch must never clear
                        // them (the old code's setOptionsByKind was only
                        // called on resolve, but the DISABLE was the visible
                        // symptom users hit; this pins the options side too).
                        expect(stillThere.querySelectorAll('option').length).toBe(3);
                        expect(stillThere.querySelectorAll('option')[1].textContent).toBe('Row-1');
                        expect(stillThere.querySelectorAll('option')[2].textContent).toBe('Row-2');
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 20);
            }, 20);
        });
    });
});

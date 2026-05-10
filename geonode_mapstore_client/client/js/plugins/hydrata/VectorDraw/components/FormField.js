import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import { getProjectId } from '../../Anuga/selectorsAnuga';

const FormField = ({ field, value, onChange, projectId, timeSeriesOptions }) => {
    const handleChange = (e) => {
        let val = e.target.value;
        if (field.type === 'number') {
            val = val === '' ? '' : parseFloat(val);
        } else if (field.type === 'checkbox') {
            val = e.target.checked;
        }
        onChange(field.name, val);
    };

    // TASK-784 polish — all font / size / weight rules live in
    // vectorDrawPopup.css (`.vector-draw-popup *` resets to inherit,
    // and select/input/button get `font: inherit`). Inline styles below
    // are pure layout (flex / spacing) only — no fonts, no colors.
    switch (field.type) {
    case 'select':
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <select
                    value={value ?? ''}
                    onChange={handleChange}
                    style={{flex: 1, marginLeft: 8}}
                >
                    {(field.options || []).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        );
    case 'number':
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={handleChange}
                    min={field.min}
                    max={field.max}
                    step={field.step || 'any'}
                    style={{flex: 1, marginLeft: 8, maxWidth: 120}}
                />
            </div>
        );
    case 'checkbox':
        return (
            <div className="simple-view-panel-item-row">
                <label>
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={handleChange}
                        style={{marginRight: 8}}
                    />
                    {field.label}
                </label>
            </div>
        );
    case 'time-data-picker':
        // TASK-795 — Compound widget for Time-boundary values.
        // Owned shape on the formValues key (default name='data'):
        //   { kind: 'constant',   constant: <Number> }
        //   { kind: 'timeseries', timeseries_id: <Number> }
        // The save epic reads this shape and translates to WFS-T props
        // `data_constant` (FLOAT) OR `data_timeseries_id` (INTEGER).
        return (
            <TimeDataPicker
                field={field}
                value={value}
                onChange={onChange}
                projectId={projectId}
                timeSeriesOptions={timeSeriesOptions}
            />
        );
    case 'text':
    default:
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <input
                    type="text"
                    value={value ?? ''}
                    onChange={handleChange}
                    style={{flex: 1, marginLeft: 8}}
                />
            </div>
        );
    }
};

/**
 * TASK-795 — TimeDataPicker
 *
 * Internal radio (Constant | TimeSeries) + value control. Emits the structured
 * shape `{kind, constant}` / `{kind, timeseries_id}` to the parent's onChange.
 * The save epic (vectorDrawSaveEpic) translates this into the WFS-T property
 * keys (`data_constant` or `data_timeseries_id`) before transaction build.
 *
 * Fetches /api/v2/anuga/projects/<pid>/time-series/ on mount when no
 * `timeSeriesOptions` prop is supplied (test injection point). The list is
 * project-scoped + small (typically a handful per project) so per-form fetch
 * is fine — no global cache needed.
 */
export const TimeDataPicker = ({ field, value, onChange, projectId, timeSeriesOptions }) => {
    // Initial radio state — read from value (seeded by SEED_FORM_VALUES on
    // edit) so the picker re-renders the row's last selection. Defaults to
    // 'constant' on a fresh feature where value is undefined.
    const initialKind = value?.kind === 'timeseries' ? 'timeseries' : 'constant';
    const [kind, setKind] = useState(initialKind);
    const [tsList, setTsList] = useState(
        Array.isArray(timeSeriesOptions) ? timeSeriesOptions : null
    );
    const [loadError, setLoadError] = useState(null);

    // Re-sync internal radio if `value.kind` flips externally (e.g. after
    // a SEED_FORM_VALUES on a re-entered edit flow). Cheap; no remount.
    useEffect(() => {
        if (value?.kind && value.kind !== kind) {
            setKind(value.kind);
        }
    }, [value?.kind]);

    // Per-form fetch when no options were injected. Skips fetch if projectId
    // is missing (defensive — picker shouldn't render without a project).
    // Wrapped so consistent-return is satisfied: the IIFE handles the
    // early-exit branches; the outer arrow always returns the cancel
    // function (which short-circuits if `cancelled` was already set).
    useEffect(() => {
        let cancelled = false;
        if (Array.isArray(timeSeriesOptions)) {
            setTsList(timeSeriesOptions);
        } else if (tsList === null) {
            if (!projectId) {
                setTsList([]);
            } else {
                axios.get(`/api/v2/anuga/projects/${projectId}/time-series/`)
                    .then(resp => {
                        if (cancelled) return;
                        const list = Array.isArray(resp?.data) ? resp.data
                            : Array.isArray(resp?.data?.results) ? resp.data.results
                                : [];
                        setTsList(list);
                    })
                    .catch(err => {
                        if (cancelled) return;
                        setLoadError(err?.message || 'Failed to load TimeSeries');
                        setTsList([]);
                    });
            }
        }
        return () => { cancelled = true; };
    }, [projectId, timeSeriesOptions]);

    const onKindChange = (e) => {
        const newKind = e.target.value;
        setKind(newKind);
        // Reset the value when switching modes so we never accidentally emit
        // both constant + timeseries_id keys downstream. Use null placeholders
        // so the BE CHECK constraint sees a clean "exactly one of" payload.
        if (newKind === 'constant') {
            const existing = typeof value?.constant === 'number' ? value.constant : null;
            onChange(field.name, { kind: 'constant', constant: existing });
        } else {
            const existing = typeof value?.timeseries_id === 'number' ? value.timeseries_id : null;
            onChange(field.name, { kind: 'timeseries', timeseries_id: existing });
        }
    };

    const onConstantChange = (e) => {
        const raw = e.target.value;
        const num = raw === '' ? null : parseFloat(raw);
        onChange(field.name, { kind: 'constant', constant: Number.isNaN(num) ? null : num });
    };

    const onTimeSeriesChange = (e) => {
        const raw = e.target.value;
        const id = raw === '' ? null : parseInt(raw, 10);
        onChange(field.name, { kind: 'timeseries', timeseries_id: Number.isNaN(id) ? null : id });
    };

    const constantValue = (typeof value?.constant === 'number' || typeof value?.constant === 'string')
        ? value.constant
        : '';
    const tsValue = (typeof value?.timeseries_id === 'number' || typeof value?.timeseries_id === 'string')
        ? value.timeseries_id
        : '';

    const tsArray = Array.isArray(tsList) ? tsList : [];
    const tsLoading = tsList === null;
    const tsEmpty = !tsLoading && tsArray.length === 0;

    return (
        <div className="time-data-picker simple-view-panel-item-row" style={{flexDirection: 'column', alignItems: 'stretch'}}>
            <label style={{marginBottom: 4}}>{field.label || 'Boundary value'}:</label>
            <div style={{display: 'flex', gap: 12, marginBottom: 6}}>
                <label style={{display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0, fontWeight: 'normal'}}>
                    <input
                        type="radio"
                        name={`${field.name}-kind`}
                        value="constant"
                        checked={kind === 'constant'}
                        onChange={onKindChange}
                    />
                    Constant
                </label>
                <label style={{display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0, fontWeight: 'normal'}}>
                    <input
                        type="radio"
                        name={`${field.name}-kind`}
                        value="timeseries"
                        checked={kind === 'timeseries'}
                        onChange={onKindChange}
                    />
                    TimeSeries
                </label>
            </div>
            {kind === 'constant' ? (
                <input
                    type="number"
                    className="time-data-picker-constant"
                    value={constantValue}
                    onChange={onConstantChange}
                    step="any"
                    style={{flex: 1, maxWidth: 160}}
                />
            ) : (
                <React.Fragment>
                    <select
                        className="time-data-picker-timeseries"
                        value={tsValue}
                        onChange={onTimeSeriesChange}
                        disabled={tsLoading || tsEmpty}
                        style={{flex: 1}}
                    >
                        <option value="">{tsLoading ? 'Loading…' : (tsEmpty ? 'No TimeSeries available — create one first' : '— Select TimeSeries —')}</option>
                        {tsArray.map(ts => (
                            <option key={ts.id} value={ts.id}>{ts.name}</option>
                        ))}
                    </select>
                    {loadError ? (
                        <p style={{color: 'red', margin: '4px 0 0 0', fontSize: '0.9em'}}>
                            {loadError}
                        </p>
                    ) : null}
                </React.Fragment>
            )}
        </div>
    );
};

const mapStateToProps = (state) => ({
    projectId: getProjectId(state)
});

// Default export is the redux-connected wrapper so the time-data-picker
// can read projectId from anuga state without the parent threading it down.
// The bare `FormField` and `TimeDataPicker` named exports are used by tests
// to inject props directly.
export { FormField };
export default connect(mapStateToProps)(FormField);

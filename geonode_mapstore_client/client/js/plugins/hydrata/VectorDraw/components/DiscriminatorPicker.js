import React, { useEffect, useState } from 'react';

/**
 * TASK-825 (W3.2) — DiscriminatorPicker
 *
 * Generalized compound widget that renders:
 *   1. A row of radio buttons, one per declared "choice" (kind).
 *   2. The active kind's render component, which receives the full value
 *      object plus a per-kind options array (optionally loaded by a fetch).
 *
 * The component is value-shape-agnostic: it does NOT wrap or unwrap values.
 * Each kind's render is responsible for the keys it cares about (e.g. the
 * `constant` kind owns `value.constant`; the `timeseries` kind owns
 * `value.timeseries_id`). DiscriminatorPicker only enforces the radio
 * state + emits a minimal `{kind}` reset on kind-switch.
 *
 * API
 * ----
 * Props:
 *   field      — parent field descriptor (has `.choices`, plus label/name).
 *   value      — current full value, e.g. `{kind: 'timeseries', timeseries_id: 7}`.
 *   onChange   — `(newValue) => void`. Receives the full value object;
 *                NOT wrapped by DiscriminatorPicker.
 *   projectId  — optional, threaded into per-kind `fetch(projectId)`.
 *
 * field.choices = [{ kind, label, options?, fetch?, render }]
 *   kind     — string identifier; appears as the radio value + as value.kind.
 *   label    — human-readable string for the radio button.
 *   options  — optional Array. If supplied, this kind's options are used
 *              directly (bypasses fetch entirely).
 *   fetch    — optional async fn `(projectId) => Promise<Array>`. Called on
 *              mount + on projectId change when no `options` are injected
 *              for this kind. Falsey resolution => empty list.
 *   render   — React component for the active kind. Receives:
 *                value    — the full value object
 *                onChange — emits the full value object (parent's onChange)
 *                options  — Array, populated from fetch or injected
 *                loading  — bool, true while fetch is in flight
 *                error    — string|null, fetch error message if any
 *                field    — parent field descriptor (for label/name access)
 *
 * Worked example — 3 discriminated boundary kinds:
 *
 *   const ConstantInput = ({ value, onChange, field }) => (
 *       <input
 *           type="number"
 *           value={value?.constant ?? ''}
 *           onChange={(e) => onChange({
 *               kind: 'constant',
 *               constant: e.target.value === '' ? null : parseFloat(e.target.value)
 *           })}
 *       />
 *   );
 *
 *   const TimeSeriesSelect = ({ value, onChange, options, loading, error }) => (
 *       <select
 *           value={value?.timeseries_id ?? ''}
 *           disabled={loading || options.length === 0}
 *           onChange={(e) => onChange({
 *               kind: 'timeseries',
 *               timeseries_id: e.target.value === '' ? null : parseInt(e.target.value, 10)
 *           })}
 *       >
 *           <option value="">{loading ? 'Loading…' : 'Pick one'}</option>
 *           {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
 *           {error ? <option disabled>{error}</option> : null}
 *       </select>
 *   );
 *
 *   const RainfallGridPick = ({ value, onChange, options }) => (
 *       <select
 *           value={value?.rainfall_grid_id ?? ''}
 *           onChange={(e) => onChange({
 *               kind: 'rainfall-grid',
 *               rainfall_grid_id: e.target.value === '' ? null : parseInt(e.target.value, 10)
 *           })}
 *       >
 *           <option value="">Pick a grid</option>
 *           {options.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
 *       </select>
 *   );
 *
 *   const field = {
 *       name: 'inflow_data',
 *       label: 'Inflow source',
 *       type: 'discriminator-picker',
 *       choices: [
 *           { kind: 'constant',      label: 'Constant',    render: ConstantInput },
 *           { kind: 'timeseries',    label: 'Time series', render: TimeSeriesSelect,
 *             fetch: (pid) => axios.get(`/api/v2/anuga/projects/${pid}/time-series/`)
 *                                  .then(r => r.data?.results ?? r.data ?? []) },
 *           { kind: 'rainfall-grid', label: 'Rainfall grid', render: RainfallGridPick,
 *             fetch: (pid) => axios.get(`/api/v2/anuga/projects/${pid}/rainfall-grids/`)
 *                                  .then(r => r.data ?? []) }
 *       ]
 *   };
 *
 *   <DiscriminatorPicker
 *       field={field}
 *       value={{kind: 'timeseries', timeseries_id: 42}}
 *       onChange={(v) => store.dispatch(updateField('inflow_data', v))}
 *       projectId={4}
 *   />
 */
export const DiscriminatorPicker = ({ field, value, onChange, projectId }) => {
    const choices = Array.isArray(field?.choices) ? field.choices : [];
    const fallbackKind = choices[0]?.kind;
    // Initial radio state: seed from value.kind when it matches a declared
    // choice, otherwise fall back to the first choice. Defensive against
    // unknown kinds in the persisted value.
    const knownKinds = choices.map(c => c.kind);
    const initialKind = (value?.kind && knownKinds.includes(value.kind))
        ? value.kind
        : fallbackKind;
    const [kind, setKind] = useState(initialKind);

    // Per-kind options + loading + error maps. Options arrive either:
    //   1. Injected via field.choices[i].options (test/prop bypass), OR
    //   2. Loaded via field.choices[i].fetch(projectId) on mount.
    // We seed the maps from any injected options so the very first render
    // (before useEffect runs) already exposes them to the active kind.
    const seedOptions = () => {
        const out = {};
        choices.forEach(c => {
            if (Array.isArray(c.options)) {
                out[c.kind] = c.options;
            }
        });
        return out;
    };
    const seedLoading = () => {
        const out = {};
        choices.forEach(c => {
            // A kind is "loading" iff it has a fetch AND no injected options.
            // Otherwise it has its options up-front (or doesn't need any).
            out[c.kind] = (typeof c.fetch === 'function') && !Array.isArray(c.options);
        });
        return out;
    };

    const [optionsByKind, setOptionsByKind] = useState(seedOptions);
    const [loadingByKind, setLoadingByKind] = useState(seedLoading);
    const [errorByKind, setErrorByKind] = useState({});

    // Re-sync the radio state if value.kind flips externally (e.g. a parent
    // SEED_FORM_VALUES dispatch on edit re-entry).
    useEffect(() => {
        if (value?.kind && knownKinds.includes(value.kind) && value.kind !== kind) {
            setKind(value.kind);
        }
    }, [value?.kind]);

    // Per-kind fetch effect. Cancellation pattern via `cancelled` flag drops
    // late axios resolutions on unmount (or projectId change) so tests that
    // tear down mid-fetch don't leak state updates.
    useEffect(() => {
        let cancelled = false;
        choices.forEach(c => {
            if (typeof c.fetch !== 'function') return;
            if (Array.isArray(c.options)) return;
            // Skip kinds whose options are already populated by a prior
            // mount/effect — re-running fetch on the same kind would double-
            // dispatch on re-renders where projectId didn't actually change.
            // We still re-fetch when projectId changes (because the effect
            // re-runs and per-kind state is independent of projectId).
            Promise.resolve()
                .then(() => c.fetch(projectId))
                .then(list => {
                    if (cancelled) return;
                    const arr = Array.isArray(list) ? list : [];
                    setOptionsByKind(prev => ({ ...prev, [c.kind]: arr }));
                    setLoadingByKind(prev => ({ ...prev, [c.kind]: false }));
                })
                .catch(err => {
                    if (cancelled) return;
                    setErrorByKind(prev => ({
                        ...prev,
                        [c.kind]: err?.message || 'Failed to load'
                    }));
                    setOptionsByKind(prev => ({ ...prev, [c.kind]: [] }));
                    setLoadingByKind(prev => ({ ...prev, [c.kind]: false }));
                });
        });
        return () => { cancelled = true; };
    }, [projectId]);

    // Radio change handler — emits the minimal reset value `{kind: newKind}`.
    // Each kind's render component fills in its own keys on the next user
    // interaction; this prevents stale keys from a previous kind leaking
    // through to the BE (e.g. emitting `{kind: 'timeseries', constant: 5}`).
    const onKindChange = (e) => {
        const newKind = e.target.value;
        if (!knownKinds.includes(newKind)) return;
        setKind(newKind);
        onChange({ kind: newKind });
    };

    const activeChoice = choices.find(c => c.kind === kind);
    if (!activeChoice) {
        // Defensive: no choices configured. Render nothing rather than crash.
        return null;
    }

    const ActiveRender = activeChoice.render;
    const activeOptions = optionsByKind[kind] || [];
    const activeLoading = !!loadingByKind[kind];
    const activeError = errorByKind[kind] || null;

    return (
        <div className="discriminator-picker">
            <div className="discriminator-picker-radios" style={{display: 'flex', gap: 12, marginBottom: 6}}>
                {choices.map(c => (
                    <label
                        key={c.kind}
                        style={{display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0, fontWeight: 'normal'}}
                    >
                        <input
                            type="radio"
                            name={`${field?.name || 'discriminator'}-kind`}
                            value={c.kind}
                            checked={kind === c.kind}
                            onChange={onKindChange}
                        />
                        {c.label}
                    </label>
                ))}
            </div>
            {ActiveRender ? (
                <ActiveRender
                    value={value}
                    onChange={onChange}
                    options={activeOptions}
                    loading={activeLoading}
                    error={activeError}
                    field={field}
                />
            ) : null}
        </div>
    );
};

export default DiscriminatorPicker;

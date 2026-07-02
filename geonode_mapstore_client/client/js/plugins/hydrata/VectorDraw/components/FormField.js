import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import axios from '../../../../../MapStore2/web/client/libs/ajax';
import { getProjectId } from '../../Anuga/selectorsAnuga';
import { register, get } from '../widgetRegistry';
import { registerDiscriminator, DISCRIMINATOR_KIND } from '../discriminatorRegistry';
import { DiscriminatorPicker } from './DiscriminatorPicker';
import { ErrorStrip, EmptyState } from '../../SimpleView/components/primitives';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
// TASK-2082 — the Inflow hydrograph picker's empty-state link opens the
// Hydrology panel on the Hydrographs page. actionsHydrology.js is a leaf
// module (no imports of its own) so this does not create an import cycle.
import { setHydrologyMainMenu, setActiveHydrologyPage, setActiveHydrologyItem } from '../../Hydrology/actionsHydrology';

// TASK-784 polish — all font / size / weight rules live in
// vectorDrawPopup.css (`.sv-vector-draw-popup *` resets to inherit,
// and select/input/button get `font: inherit`). Inline styles below
// are pure layout (flex / spacing) only — no fonts, no colors.
//
// TASK-812 (W1.1) — Each `switch (field.type)` case body is now a named
// widget component, registered against the VectorDraw widget registry at
// module load time. FormField just looks up the component by `field.type`
// and renders it. New widget types can be added by external callers via
// `register({name, component})` without touching this file.

// Each widget owns its own onChange handler so the type-coercion rules
// (parseFloat for number, e.target.checked for checkbox) stay co-located
// with the rendered control. Widgets ignore props they don't need
// (projectId / timeSeriesOptions are only used by TimeDataPicker).

export const TextWidget = ({ field, value, onChange }) => {
    const handleChange = (e) => onChange(field.name, e.target.value);
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
};

export const NumberWidget = ({ field, value, onChange }) => {
    const handleChange = (e) => {
        const raw = e.target.value;
        const val = raw === '' ? '' : parseFloat(raw);
        onChange(field.name, val);
    };
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
};

export const CheckboxWidget = ({ field, value, onChange }) => {
    const handleChange = (e) => onChange(field.name, e.target.checked);
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
};

export const SelectWidget = ({ field, value, onChange }) => {
    const handleChange = (e) => onChange(field.name, e.target.value);
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
};

/**
 * TASK-795 / TASK-825 (W3.2) — TimeDataPicker
 *
 * Thin wrapper over the generalized DiscriminatorPicker for the 2 Boundary
 * kinds (constant + timeseries). The previous inline implementation has been
 * promoted to DiscriminatorPicker.js so other compound widgets (e.g. inflow
 * source with rainfall-grid as a 3rd kind) can reuse it. The wrapper
 * preserves the original API exactly:
 *
 *   - Receives `{field, value, onChange, projectId, timeSeriesOptions}`.
 *   - Emits via `onChange(field.name, structuredValue)` where structuredValue is
 *       {kind: 'constant',   constant:      Number|null}  |
 *       {kind: 'timeseries', timeseries_id: Number|null}
 *   - Renders the DOM with classes `time-data-picker` (outer),
 *     `time-data-picker-constant` (number input) and
 *     `time-data-picker-timeseries` (select) so the scoped styles in
 *     vectorDrawPopup.css still apply.
 *
 * The `timeSeriesOptions` prop continues to bypass the per-form fetch
 * (test injection point). When omitted, DiscriminatorPicker calls the
 * `fetch` defined below, which hits
 * `/api/v2/anuga/projects/${projectId}/time-series/` and accepts either
 * `resp.data` as an array OR `resp.data.results`.
 */

// Render component for the 'constant' kind. Emits the canonical
// {kind:'constant', constant:Number|null} shape via its onChange prop.
// The outer wrapper translates this into onChange(field.name, value).
//
// `field` arrives from DiscriminatorPicker (it threads the outer field
// descriptor through to every render). When the matching choice declares
// a `unit` string (e.g. 'm³/s' for Inflow), the unit is rendered next to
// the input as a non-interactive suffix. Other consumers (Boundary value)
// omit `unit` and the input renders unchanged.
export const ConstantInput = ({ value, onChange, field }) => {
    const constantValue = (typeof value?.constant === 'number' || typeof value?.constant === 'string')
        ? value.constant
        : '';
    const handleChange = (e) => {
        const raw = e.target.value;
        const num = raw === '' ? null : parseFloat(raw);
        onChange({ kind: 'constant', constant: Number.isNaN(num) ? null : num });
    };
    const unit = field?.choices?.find(c => c.kind === 'constant')?.unit;
    const input = (
        <input
            type="number"
            className="time-data-picker-constant"
            value={constantValue}
            onChange={handleChange}
            step="any"
            style={{flex: 1, maxWidth: 160}}
        />
    );
    if (!unit) return input;
    return (
        <div className="time-data-picker-constant-row" style={{display: 'flex', alignItems: 'center', gap: 6}}>
            {input}
            <span className="time-data-picker-constant-unit">{unit}</span>
        </div>
    );
};

// Render component for the 'timeseries' / 'hydrograph' / 'hyetograph'
// kind family. Emits {kind:<currentKind>, timeseries_id:Number|null}.
//
// TASK-1984: handleChange emits `value?.kind || 'timeseries'` instead of
// the former hardcoded `'timeseries'`. This means a hydrograph picker
// (value.kind='hydrograph') correctly emits {kind:'hydrograph', ...} on
// every user selection, keeping the Redux value's kind stable. Back-compat:
// when value.kind is 'timeseries' (bdy_ / legacy rows), the emitted kind
// stays 'timeseries'. When value is absent/undefined, falls back to 'timeseries'.
//
// TASK-2082 — `dispatch` (optional) and `onRefetchOptions` (optional) are
// threaded down from DiscriminatorPicker (which gets `dispatch` from the
// FormField redux connect() default mapDispatchToProps, and computes
// `onRefetchOptions` itself — see DiscriminatorPicker.js). Only the
// HYDROGRAPH kind's empty state uses them:
//   - `dispatch` opens the Hydrology panel on the Hydrographs page from the
//     empty-state link so the user can go create one.
//   - `onRefetchOptions` (wired to the select's onFocus) re-fetches this
//     kind's options so a hydrograph created in the interim appears without
//     a page reload. NOTE: a disabled <select> can never receive focus, so
//     onFocus alone cannot cover the empty->non-empty transition — see the
//     hydrologyMainMenuOpen close-transition effect in DiscriminatorPicker.js
//     for the mechanism that actually closes that gap.
// TASK-2084 (epic-2077) — `kind` (added below, alongside the pre-existing
// props) is the ACTIVE CHOICE's kind, threaded down from DiscriminatorPicker's
// own radio-selection state (see `<ActiveRender ... kind={kind} />` in
// DiscriminatorPicker.js). It is the noun-sweep's kind-aware copy signal:
// 'hydrograph' (Inflow) gets Hydrograph(s) wording; every other kind
// (the boundary 'timeseries' kind, and 'hyetograph') keeps the existing
// generic 'TimeSeries' copy untouched, per the epic-1970 decision that the
// boundary 'Time' picker stays generic. `value?.kind` is intentionally NOT
// the primary signal here — it is unset on a fresh form (no radio touched
// yet / the kind-switch reset hasn't round-tripped through Redux), whereas
// `kind` is correct from this component's very first render (a choice's
// render is only ever mounted while that choice IS the active one). A
// `value?.kind` fallback is kept only for defensive back-compat with any
// caller that doesn't thread the new prop through.
export const TimeSeriesSelect = ({ value, onChange, options, loading, error, dispatch, onRefetchOptions, kind }, context) => {
    const tsValue = (typeof value?.timeseries_id === 'number' || typeof value?.timeseries_id === 'string')
        ? value.timeseries_id
        : '';
    const list = Array.isArray(options) ? options : [];
    const isEmpty = !loading && list.length === 0;
    const activeKind = kind || value?.kind || DISCRIMINATOR_KIND.TIMESERIES;
    const isHydrographKind = activeKind === DISCRIMINATOR_KIND.HYDROGRAPH;
    const isHydrographEmpty = isEmpty && isHydrographKind;
    // <option> content is plain-text-only (HTML content model — and this
    // codebase's own convention: <Message> renders a <span>, invalid inside
    // <option>; see NetworksPane.js). Resolve via legacy context.messages
    // instead, with an English fallback for pre-i18n-load / no-IntlProvider
    // renders — mirrors the `tr` idiom in hydrologyDetailIdfTable.js /
    // Anuga/scenarioHeaderActions.js.
    const tr = (msgId, fallback) => {
        const messages = (context && context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };
    const handleChange = (e) => {
        const raw = e.target.value;
        const id = raw === '' ? null : parseInt(raw, 10);
        // Use the current value's kind so hydrograph/hyetograph pickers emit
        // the correct kind, not always 'timeseries'. Falls back to 'timeseries'
        // when value is absent (initial mount before any radio selection).
        const emitKind = value?.kind || DISCRIMINATOR_KIND.TIMESERIES;
        onChange({ kind: emitKind, timeseries_id: Number.isNaN(id) ? null : id });
    };
    const handleFocus = () => {
        if (typeof onRefetchOptions === 'function') {
            onRefetchOptions();
        }
    };
    // TASK-2082 — opens the Hydrology panel on the Hydrographs page. Mirrors
    // hydrologyMainMenu.js's handleSelectCategory (the rail's own "jump to
    // category X" handler): setActiveHydrologyItem(null) is added on top of
    // the 2 actions named in the spec so the panel lands on a clean
    // create/select state rather than whatever item was last active on a
    // different page.
    const handleOpenHydrology = (e) => {
        e.preventDefault();
        if (typeof dispatch === 'function') {
            dispatch(setHydrologyMainMenu(true));
            dispatch(setActiveHydrologyPage('hydrographs'));
            dispatch(setActiveHydrologyItem(null));
        }
    };
    return (
        <React.Fragment>
            <select
                className="time-data-picker-timeseries"
                value={tsValue}
                onChange={handleChange}
                onFocus={handleFocus}
                disabled={loading || isEmpty}
                style={{flex: 1}}
            >
                <option value="">
                    {loading
                        ? 'Loading…'
                        : (isEmpty
                            ? (isHydrographKind
                                ? tr('hydrata.anuga.inflowNoHydrographsAvailable', 'No hydrographs available, create one first')
                                : 'No TimeSeries available, create one first')
                            : (isHydrographKind
                                ? tr('hydrata.anuga.inflowSelectHydrograph', 'Select hydrograph')
                                : 'Select TimeSeries'))}
                </option>
                {list.map(ts => (
                    <option key={ts.id} value={ts.id}>{ts.name}</option>
                ))}
            </select>
            {/* TASK-1758 W3 — the bespoke inline-red <p> is replaced by the
                shared ErrorStrip primitive (token-backed --sv-text-danger,
                role="alert"); its subtree owns its own typographic chrome and
                is exempt from the popup font-uniformity walk. */}
            <ErrorStrip message={error} style={{margin: '4px 0 0 0'}} />
            {/* ErrorStrip self-hides when message is empty/null. */}
            {/* TASK-2082 — the hydrograph-kind empty state gets actionable
                copy + a link, replacing the "create one first" dead-end. A
                <select><option> cannot host an interactive child element, so
                this renders as a sibling block below the (disabled) select,
                not inside the option text. */}
            {isHydrographEmpty ? (
                <EmptyState
                    extraClassName="time-data-picker-hydrograph-empty"
                    heading={<Message msgId="hydrata.hydrology.hydrographPickerEmptyHint" />}
                    style={{alignItems: 'flex-start', textAlign: 'left', padding: '6px 0 0 0'}}
                >
                    <Button
                        bsStyle="link"
                        bsSize="small"
                        className="time-data-picker-open-hydrology-link"
                        style={{padding: 0}}
                        onClick={handleOpenHydrology}
                    >
                        <Message msgId="hydrata.hydrology.hydrographPickerOpenLink" />
                    </Button>
                </EmptyState>
            ) : null}
        </React.Fragment>
    );
};

// Pull intl messages off React legacy context so the `tr` helper above can
// resolve the kind-aware placeholder copy at render time (mirrors
// Hydrology/hydrologyDetailIdfTable.js + Anuga/scenarioHeaderActions.js).
TimeSeriesSelect.contextTypes = {
    messages: PropTypes.object
};

// Fetch helper for the 'timeseries' / 'hydrograph' / 'hyetograph' kinds.
// Accepts either `resp.data` as an array OR `resp.data.results` (matches
// the existing TimeDataPicker behaviour pre-W3.2).
//
// TASK-1984: gains an optional `seriesType` arg. When provided, appends
// `?series_type=<seriesType>` to the URL so the BE filters by that type
// (e.g. only hydrograph rows for the Inflow picker). When absent the URL
// is unchanged — the BE returns all rows (back-compat for the Boundary
// 'Time' generic 'timeseries' kind and any direct callers).
export const fetchTimeSeries = (projectId, seriesType) => {
    if (!projectId) {
        return Promise.resolve([]);
    }
    const url = seriesType
        ? `/api/v2/anuga/projects/${projectId}/time-series/?series_type=${seriesType}`
        : `/api/v2/anuga/projects/${projectId}/time-series/`;
    return axios.get(url)
        .then(resp => {
            if (Array.isArray(resp?.data)) return resp.data;
            if (Array.isArray(resp?.data?.results)) return resp.data.results;
            return [];
        });
};

export const TimeDataPicker = ({ field, value, onChange, projectId, timeSeriesOptions, dispatch, hydrologyMainMenuOpen }) => {
    // Build the choices descriptor for DiscriminatorPicker. The 'timeseries'
    // kind's `options` prop is the injection point used by tests + by
    // callers that want to bypass the per-form fetch; when undefined,
    // DiscriminatorPicker invokes `fetch(projectId)`.
    const choices = [
        { kind: 'constant', label: 'Constant', render: ConstantInput },
        {
            kind: DISCRIMINATOR_KIND.TIMESERIES,
            label: 'TimeSeries',
            render: TimeSeriesSelect,
            // Pass timeSeriesOptions through as injected options when it's an
            // array (test path + caller-injected path). When undefined we
            // omit the key so DiscriminatorPicker falls through to fetch.
            ...(Array.isArray(timeSeriesOptions) ? { options: timeSeriesOptions } : {}),
            fetch: fetchTimeSeries
        }
    ];

    // DiscriminatorPicker emits the full value object; we translate to
    // (name, value) for the parent's onChange. On a kind-switch reset,
    // DiscriminatorPicker emits `{kind: newKind}` only — we canonicalize
    // to the full shape with the per-kind value preserved when possible
    // (number) else null. This preserves the contract from the original
    // TASK-795 implementation: the BE CHECK constraint requires exactly
    // one of `constant` / `timeseries_id` to be set.
    const handleChange = (newValue) => {
        const newKind = newValue?.kind;
        const isResetOnly = newValue && Object.keys(newValue).length === 1 && 'kind' in newValue;
        if (isResetOnly) {
            if (newKind === 'constant') {
                const existing = typeof value?.constant === 'number' ? value.constant : null;
                onChange(field.name, { kind: 'constant', constant: existing });
            } else if (newKind === DISCRIMINATOR_KIND.TIMESERIES || newKind === DISCRIMINATOR_KIND.HYDROGRAPH || newKind === DISCRIMINATOR_KIND.HYETOGRAPH) {
                // TASK-1984: hydrograph + hyetograph are timeseries-family kinds —
                // they carry timeseries_id (same shape as 'timeseries'). Preserve
                // an existing timeseries_id through the kind-switch reset so the
                // user's prior selection is not lost. A naive impl that only
                // checks for 'timeseries' drops the id for the new kinds.
                const existing = typeof value?.timeseries_id === 'number' ? value.timeseries_id : null;
                onChange(field.name, { kind: newKind, timeseries_id: existing });
            } else {
                onChange(field.name, newValue);
            }
            return;
        }
        onChange(field.name, newValue);
    };

    // The wrapper supplies an inner `discriminator-picker` from
    // DiscriminatorPicker plus its own outer `time-data-picker` div so the
    // scoped CSS in vectorDrawPopup.css continues to apply.
    const innerField = { ...field, choices };
    return (
        <div className="time-data-picker simple-view-panel-item-row" style={{flexDirection: 'column', alignItems: 'stretch'}}>
            <label style={{marginBottom: 4}}>{field.label || 'Boundary value'}:</label>
            <DiscriminatorPicker
                field={innerField}
                value={value}
                onChange={handleChange}
                projectId={projectId}
                dispatch={dispatch}
                hydrologyMainMenuOpen={hydrologyMainMenuOpen}
            />
        </div>
    );
};

// TASK-826 (W3.3) — Generalized discriminator-picker widget. Adapts
// DiscriminatorPicker (1-arg `onChange(value)`) to the FormField contract
// (`onChange(field.name, value)`) and renders the same outer row + field
// label that TimeDataPicker does — so a formConfig migration from
// `time-data-picker` to `discriminator-picker` is byte-identical for the
// 2 Boundary kinds.
//
// `field.choices` declares the kinds. Each choice may set an optional
// `defaultValue: {...}` (e.g. `{constant: null}`) used to canonicalize the
// kind-switch reset payload — the wrapper merges `defaultValue` with any
// typed-existing values from the current `value` so toggling kinds doesn't
// drop a value the user already typed.
const DiscriminatorPickerWidget = ({ field, value, onChange, projectId, dispatch, hydrologyMainMenuOpen }) => {
    const choices = Array.isArray(field?.choices) ? field.choices : [];

    const handleChange = (newValue) => {
        // DiscriminatorPicker emits `{kind: newKind}` on a radio change.
        // Canonicalize to the full shape so the reducer + save epic see
        // the same `{kind, key}` payload as the legacy TimeDataPicker.
        const isResetOnly = newValue
            && Object.keys(newValue).length === 1
            && 'kind' in newValue;
        if (isResetOnly) {
            const c = choices.find(choice => choice.kind === newValue.kind);
            const seed = (c && c.defaultValue) ? { ...c.defaultValue } : {};
            for (const k of Object.keys(seed)) {
                if (value && (typeof value[k] === 'number' || typeof value[k] === 'string')) {
                    seed[k] = value[k];
                }
            }
            onChange(field.name, { ...seed, kind: newValue.kind });
            return;
        }
        onChange(field.name, newValue);
    };

    return (
        <div className="simple-view-panel-item-row" style={{flexDirection: 'column', alignItems: 'stretch'}}>
            {field.label ? <label style={{marginBottom: 4}}>{field.label}:</label> : null}
            <DiscriminatorPicker
                field={field}
                value={value}
                onChange={handleChange}
                projectId={projectId}
                dispatch={dispatch}
                hydrologyMainMenuOpen={hydrologyMainMenuOpen}
            />
        </div>
    );
};

export { DiscriminatorPickerWidget };

// TASK-812 (W1.1) — Register the 5 default widgets at module load time.
// New widgets can be added by external callers via
// `import { register } from '../widgetRegistry'` before any FormField mounts.
// Overwriting an existing registration is allowed (last-write-wins) so test
// suites can inject mocks for a specific widget name.
register({ name: 'text', component: TextWidget });
register({ name: 'number', component: NumberWidget });
register({ name: 'checkbox', component: CheckboxWidget });
register({ name: 'select', component: SelectWidget });
register({ name: 'time-data-picker', component: TimeDataPicker });
// TASK-826 (W3.3) — Generalized discriminator-picker registered to the
// wrapper above. New formConfigs declare `type: 'discriminator-picker'` with
// inline `choices` arrays; `time-data-picker` stays registered as a
// back-compat alias.
register({ name: 'discriminator-picker', component: DiscriminatorPickerWidget });

// DataCloneError fix (2026-06-23) — register the default ANUGA discriminator
// kinds against the kind-keyed discriminatorRegistry so a choice descriptor in
// a `formConfig` (carried by the startVectorDraw Redux action) can declare just
// a serializable `kind` string and DiscriminatorPicker resolves the render
// component / fetch loader at render time. Keeping these FUNCTIONS out of the
// action payload is what makes startVectorDraw structured-clone-safe — see
// discriminatorRegistry.js. Registered here (not in the registry module) to
// avoid an import cycle: ConstantInput / TimeSeriesSelect / fetchTimeSeries
// are defined in this file.
//
// `constant` and `timeseries` are the two original ANUGA kinds.
// `timeseries` is kept for the Boundary 'Time' picker (show-all, no series_type
// filter) and for back-compat with any external callers (see AC3).
registerDiscriminator({ kind: 'constant', render: ConstantInput });
registerDiscriminator({ kind: DISCRIMINATOR_KIND.TIMESERIES, render: TimeSeriesSelect, fetch: fetchTimeSeries });

// TASK-1984 — split 'timeseries' into two filtered kinds for Inflow + Rainfall.
// Each is an arrow wrapper that calls fetchTimeSeries(pid, seriesType) so the
// BE only returns rows of the relevant type. The render component stays
// TimeSeriesSelect (same UI); only the fetch is filtered.
// 'timeseries' remains registered for the Boundary 'Time' generic show-all (AC3).
// NOTE: the 2nd arg to fetchTimeSeries is the series_type FILTER value
// (vocabulary B), NOT the registry kind — kept as a literal on purpose.
registerDiscriminator({ kind: DISCRIMINATOR_KIND.HYDROGRAPH, render: TimeSeriesSelect, fetch: (pid) => fetchTimeSeries(pid, 'hydrograph') });
registerDiscriminator({ kind: DISCRIMINATOR_KIND.HYETOGRAPH, render: TimeSeriesSelect, fetch: (pid) => fetchTimeSeries(pid, 'hyetograph') });

// TASK-2082 — `dispatch` and `hydrologyMainMenuOpen` are forwarded through to
// every widget (most ignore them; only the hydrograph-family discriminator
// picker uses them — see TimeSeriesSelect / DiscriminatorPicker.js).
// `dispatch` is not passed explicitly by any caller — it arrives on the
// CONNECTED default export below via react-redux's default
// mapDispatchToProps (`dispatch => ({dispatch})`, injected automatically
// when connect() is called with only mapStateToProps).
const FormField = ({ field, value, onChange, projectId, timeSeriesOptions, dispatch, hydrologyMainMenuOpen }) => {
    const Component = get(field.type) || get('text');
    return <Component field={field} value={value} onChange={onChange} projectId={projectId} timeSeriesOptions={timeSeriesOptions} dispatch={dispatch} hydrologyMainMenuOpen={hydrologyMainMenuOpen} />;
};

const mapStateToProps = (state) => ({
    projectId: getProjectId(state),
    // TASK-2082 — true while the Hydrology panel is open. DiscriminatorPicker
    // watches this for a true->false ("the user just closed it, probably
    // after creating a hydrograph") transition to refetch its options.
    hydrologyMainMenuOpen: !!state?.hydrology?.showHydrologyMainMenu
});

// Default export is the redux-connected wrapper so the time-data-picker
// can read projectId from anuga state without the parent threading it down.
// The bare `FormField` and `TimeDataPicker` named exports are used by tests
// to inject props directly.
export { FormField };
export default connect(mapStateToProps)(FormField);

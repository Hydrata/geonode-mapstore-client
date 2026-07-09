/*
 * TASK-813 (W1.2) — Boundary translator for the VectorDraw translate registry.
 *
 * Moved from wfstApi.js. The two functions were originally introduced by
 * TASK-795 (Time-boundary refactor) and refined through the T1+T2+T3 review
 * series (TASK-797/798/799/802/804). Their wire contract is verbose because
 * it pins five interlocking invariants — read the function-level comments
 * before changing anything.
 *
 * Registers under 'bdy' — the layer-prefix discriminator. All Boundary
 * layers have typeNames like 'bdy_{pid}_boundary_{name}' (see
 * simpleViewMenuRow.js ANUGA_FEATURE_CONFIG.bdy_). The registry consumer
 * (wfstApi.js wfstInsert/wfstUpdate + epicsVectorDraw.js edit-load) calls
 * deriveTranslateKey(typeName) -> 'bdy' -> getTranslate('bdy') -> this module.
 *
 * Inflow (W2 — TASK-820) will add inflowTranslate.js with the same shape
 * and registerTranslate('inf', ...) — no changes to wfstApi or
 * epicsVectorDraw required for that wave.
 */
import { registerTranslate, getProp } from './translateRegistry';
import { DISCRIMINATOR_KIND } from './discriminatorRegistry';

/**
 * TASK-795 — Translate a form's structured Time-boundary `data` value into
 * the per-column WFS-T properties the BE schema expects.
 *
 * The TimeDataPicker compound widget owns the structured shape:
 *   { kind: 'constant',   constant: <Number> }
 *   { kind: 'timeseries', timeseries_id: <Number> }
 *
 * The WFS schema has three relevant columns:
 *   * `data` (legacy text — DEPRECATED for new writes; back-compat reads only)
 *   * `data_constant` (FLOAT, NULL when data_timeseries_id is set)
 *   * `data_timeseries_id` (INTEGER FK, NULL when data_constant is set)
 *
 * BE-side CHECK constraint: when boundary='Time', exactly one of
 * data_constant/data_timeseries_id MUST be non-null. When boundary !== 'Time',
 * BOTH must be null.
 *
 * Wire contract (this function's output):
 *   * No `boundary` key in props → no-op (caller is not a Boundary layer;
 *     `inf_*` Inflow rows for example carry a legitimate `data` text column
 *     that the FE owns and the BE reads — see Inflow.make_file's TimeSeries
 *     name vs constant heuristic).
 *   (TASK-2159: the non-selected XOR column(s) ride the wire as explicit null,
 *   NOT omitted, so a switch actually clears the stale column on WFS-T UPDATE.)
 *   * boundary !== 'Time' → strip data; NULL data_constant + data_timeseries_id
 *     (BE requires BOTH null off-Time — the_geom + boundary + location + description)
 *   * boundary === 'Time' + kind='constant' → emit data_constant, strip data,
 *     NULL data_timeseries_id
 *   * boundary === 'Time' + kind='timeseries' → emit data_timeseries_id, strip data,
 *     NULL data_constant
 *
 * Pure function — no Redux, no axios. Called from wfstInsert/wfstUpdate
 * before WFS-T transaction build. Re-exported for unit tests.
 */
export const translateOut = (input) => {
    const props = { ...(input || {}) };
    // Pass-through for non-Boundary layers. The `boundary` key is the
    // discriminator: only bdy_*_boundary_* layers carry it (set by the
    // formConfig in simpleViewMenuRow.js's ANUGA_FEATURE_CONFIG.bdy_).
    // Every other prefix routed through wfstInsert/wfstUpdate (inf_, fri_,
    // str_, mes_) lacks `boundary`, so the Time-XOR contract doesn't apply
    // and we must NOT strip their `data` field — Inflow's `data: '100'`
    // string column would silently disappear, then Inflow.make_file would
    // raise TypeError on the `any(c.isalpha() for c in None)` legacy
    // heuristic during the next scenario run.
    if (!('boundary' in props)) {
        return props;
    }
    const isTime = props.boundary === 'Time';
    const data = props.data;
    // Always strip the structured shape — it is NOT a wire column.
    delete props.data;
    if (!isTime) {
        // Non-Time boundary types (Reflective / Dirichlet / Transmissive)
        // never carry a data value. Strip all three to be safe — protects
        // against stale formValues from a user toggling boundary type
        // mid-edit (e.g. picked Time, set a constant, then switched back
        // to Reflective without saving in between).
        //
        // TASK-2159: NULL both XOR columns (not omit). The BE CHECK requires
        // BOTH null off-Time; omitting them left a stale data_constant on the
        // row so a Time→Reflective UPDATE tripped the CHECK (silent no-clear
        // before TASK-2158 made it loud). Explicit null clears them on the wire.
        props.data_constant = null;
        props.data_timeseries_id = null;
        return props;
    }
    // boundary === 'Time'. Translate the structured value into one of the
    // two wire columns. Default to constant when shape is missing or
    // malformed — the BE CHECK will reject a fully-null payload, which
    // surfaces as a save error to the user (correct behaviour: they must
    // pick one).
    if (data && typeof data === 'object') {
        if (data.kind === DISCRIMINATOR_KIND.TIMESERIES) {
            const id = data.timeseries_id;
            // Only emit when an id was actually picked; otherwise leave
            // both null so the BE CHECK fires + save returns an error.
            if (id !== null && id !== undefined && id !== '') {
                props.data_timeseries_id = typeof id === 'number' ? id : parseInt(id, 10);
            } else {
                delete props.data_timeseries_id;
            }
            // TASK-2159: NULL the non-selected XOR column (not omit) so a switch
            // FROM constant clears the stale data_constant on the WFS-T UPDATE.
            props.data_constant = null;
            return props;
        }
        // Default branch: constant
        const c = data.constant;
        if (c !== null && c !== undefined && c !== '') {
            props.data_constant = typeof c === 'number' ? c : parseFloat(c);
        } else {
            delete props.data_constant;
        }
        // TASK-2159: NULL the non-selected XOR column (not omit) so a switch FROM
        // a timeseries clears the stale data_timeseries_id.
        props.data_timeseries_id = null;
        return props;
    }
    // Time boundary but no structured value at all — strip the per-column
    // keys so the BE rejects with a CHECK violation (forces the user to
    // pick a value).
    delete props.data_constant;
    delete props.data_timeseries_id;
    return props;
};

/**
 * TASK-795 — Reverse of translateOut (formerly translateTimeBoundaryProperties)
 * for the EDIT-mode seeding path. Given a row's WFS properties (with
 * `data_constant` and/or `data_timeseries_id` populated), synthesize the
 * structured `data` shape the TimeDataPicker reads. Removes the per-column
 * keys to avoid the picker getting confused about which is the source of
 * truth.
 *
 * Pure function. Used by VectorDrawPopup before passing seeded formValues
 * down to FormField.
 */
export const synthesizeIn = (props) => {
    const out = { ...(props || {}) };
    // why: TASK-824 (W3.1) — attributes_template casing varies across
    // ANUGA models. PostGIS lowercases wire columns, but historical rows
    // / server-side serializers may surface Title-case keys (TASK-794
    // class). Read via getProp(lowercase-first, Title-case-fallback) so
    // both casings resolve. Lowercase wins when both are present (matches
    // PostGIS wire reality).
    const dataValue = getProp(out, 'data', 'Data');
    const dataConstantValue = getProp(out, 'data_constant', 'Data_Constant');
    const dataTimeseriesIdValue = getProp(out, 'data_timeseries_id', 'Data_Timeseries_Id');
    // Normalize the `boundary` discriminator too — translateOut, the popup
    // validate guard, and the TimeDataPicker show-when all read lowercase
    // `boundary`. A Title-case `Boundary` from a Title-case attributes_template
    // row would silently bypass the Time-XOR validation otherwise.
    const boundaryValue = getProp(out, 'boundary', 'Boundary');
    if (boundaryValue !== undefined) {
        out.boundary = boundaryValue;
    }
    delete out.Boundary;
    // Prefer an existing structured `data` value if present — the picker
    // (TimeDataPicker) writes the structured shape on every keystroke /
    // radio change, so once the user has interacted, formValues.data is
    // the source of truth. Synthesis only fires when `data` is absent or
    // a stale text-string from the legacy bare-text-field BE column.
    const hasStructuredData = dataValue && typeof dataValue === 'object'
        && (dataValue.kind === 'constant' || dataValue.kind === DISCRIMINATOR_KIND.TIMESERIES);
    if (!hasStructuredData) {
        const hasConstant = dataConstantValue !== null && dataConstantValue !== undefined && dataConstantValue !== '';
        const hasTs = dataTimeseriesIdValue !== null && dataTimeseriesIdValue !== undefined && dataTimeseriesIdValue !== '';
        if (hasTs) {
            const id = dataTimeseriesIdValue;
            out.data = { kind: DISCRIMINATOR_KIND.TIMESERIES, timeseries_id: typeof id === 'number' ? id : parseInt(id, 10) };
        } else if (hasConstant) {
            const c = dataConstantValue;
            out.data = { kind: 'constant', constant: typeof c === 'number' ? c : parseFloat(c) };
        } else if (typeof dataValue === 'string') {
            // Legacy BE row: `data` was a bare text column. Try to parse as
            // a number → constant; otherwise drop (BE will require the user
            // to pick a value via the CHECK constraint).
            //
            // TASK-795 review NIT-3 (TASK-804) — pre-fix the check was
            // `String(n) === out.data.trim()` which silently rejects valid
            // numeric strings: '0.0' → "0", '1e5' → "100000", '3.140' →
            // "3.14", all reject and the user's data is dropped. Use
            // Number.isFinite instead — anything float-coercible is fine.
            const n = parseFloat(dataValue);
            if (Number.isFinite(n)) {
                out.data = { kind: 'constant', constant: n };
            } else {
                // Non-numeric legacy text (e.g. a TimeSeries name) — drop.
                // The user will need to re-pick on next save. Surface as
                // an unset picker rather than auto-stuffing a stale name.
                delete out.data;
            }
        } else if (dataValue === undefined) {
            // No data at all (neither casing) — leave out.data absent so
            // the picker renders unset. Below cleanup strips any Title-case
            // residue.
        }
    } else if (out.data !== dataValue) {
        // Structured value came from a Title-case `Data` key — normalize
        // to the lowercase `data` key the picker reads.
        out.data = dataValue;
    }
    // Strip the per-column keys regardless — the picker is the only thing
    // that should be reading these on the FE side, and it reads via the
    // structured `data` shape. Strip Title-case duplicates too so they
    // don't leak through to wfstUpdate via formValues.
    delete out.data_constant;
    delete out.data_timeseries_id;
    delete out.Data;
    delete out.Data_Constant;
    delete out.Data_Timeseries_Id;
    return out;
};

// Side-effect: register on module load. Side-effect imports preserve module
// execution in webpack — the parent client/package.json has no
// `sideEffects: false`, so tree-shaking will NOT strip this registration.
registerTranslate('bdy', { translateOut, synthesizeIn });

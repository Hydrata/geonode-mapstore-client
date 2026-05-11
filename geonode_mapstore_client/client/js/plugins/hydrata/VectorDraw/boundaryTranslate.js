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
import { registerTranslate } from './translateRegistry';

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
 *   * boundary !== 'Time' → strip data, data_constant, data_timeseries_id
 *     (BE will see only the_geom + boundary + location + description)
 *   * boundary === 'Time' + kind='constant' → emit data_constant only,
 *     OMIT data + data_timeseries_id
 *   * boundary === 'Time' + kind='timeseries' → emit data_timeseries_id only,
 *     OMIT data + data_constant
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
        delete props.data_constant;
        delete props.data_timeseries_id;
        return props;
    }
    // boundary === 'Time'. Translate the structured value into one of the
    // two wire columns. Default to constant when shape is missing or
    // malformed — the BE CHECK will reject a fully-null payload, which
    // surfaces as a save error to the user (correct behaviour: they must
    // pick one).
    if (data && typeof data === 'object') {
        if (data.kind === 'timeseries') {
            const id = data.timeseries_id;
            // Only emit when an id was actually picked; otherwise leave
            // both null so the BE CHECK fires + save returns an error.
            if (id !== null && id !== undefined && id !== '') {
                props.data_timeseries_id = typeof id === 'number' ? id : parseInt(id, 10);
            } else {
                delete props.data_timeseries_id;
            }
            delete props.data_constant;
            return props;
        }
        // Default branch: constant
        const c = data.constant;
        if (c !== null && c !== undefined && c !== '') {
            props.data_constant = typeof c === 'number' ? c : parseFloat(c);
        } else {
            delete props.data_constant;
        }
        delete props.data_timeseries_id;
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
    // Prefer an existing structured `data` value if present — the picker
    // (TimeDataPicker) writes the structured shape on every keystroke /
    // radio change, so once the user has interacted, formValues.data is
    // the source of truth. Synthesis only fires when `data` is absent or
    // a stale text-string from the legacy bare-text-field BE column.
    const hasStructuredData = out.data && typeof out.data === 'object'
        && (out.data.kind === 'constant' || out.data.kind === 'timeseries');
    if (!hasStructuredData) {
        const hasConstant = out.data_constant !== null && out.data_constant !== undefined && out.data_constant !== '';
        const hasTs = out.data_timeseries_id !== null && out.data_timeseries_id !== undefined && out.data_timeseries_id !== '';
        if (hasTs) {
            const id = out.data_timeseries_id;
            out.data = { kind: 'timeseries', timeseries_id: typeof id === 'number' ? id : parseInt(id, 10) };
        } else if (hasConstant) {
            const c = out.data_constant;
            out.data = { kind: 'constant', constant: typeof c === 'number' ? c : parseFloat(c) };
        } else if (typeof out.data === 'string') {
            // Legacy BE row: `data` was a bare text column. Try to parse as
            // a number → constant; otherwise drop (BE will require the user
            // to pick a value via the CHECK constraint).
            //
            // TASK-795 review NIT-3 (TASK-804) — pre-fix the check was
            // `String(n) === out.data.trim()` which silently rejects valid
            // numeric strings: '0.0' → "0", '1e5' → "100000", '3.140' →
            // "3.14", all reject and the user's data is dropped. Use
            // Number.isFinite instead — anything float-coercible is fine.
            const n = parseFloat(out.data);
            if (Number.isFinite(n)) {
                out.data = { kind: 'constant', constant: n };
            } else {
                // Non-numeric legacy text (e.g. a TimeSeries name) — drop.
                // The user will need to re-pick on next save. Surface as
                // an unset picker rather than auto-stuffing a stale name.
                delete out.data;
            }
        }
    }
    // Strip the per-column keys regardless — the picker is the only thing
    // that should be reading these on the FE side, and it reads via the
    // structured `data` shape.
    delete out.data_constant;
    delete out.data_timeseries_id;
    return out;
};

// Side-effect: register on module load. Side-effect imports preserve module
// execution in webpack — the parent client/package.json has no
// `sideEffects: false`, so tree-shaking will NOT strip this registration.
registerTranslate('bdy', { translateOut, synthesizeIn });

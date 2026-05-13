/*
 * TASK-850 (W2.3-FE) — Inflow translator for the VectorDraw translate registry.
 *
 * Registers under 'inf' — the layer-prefix discriminator for `inf_*` Inflow
 * layers (e.g. 'inf_3_inflow_north'). The registry consumer (wfstApi.js's
 * wfstInsert/wfstUpdate + epicsVectorDraw.js's EDIT-load path) calls
 * deriveTranslateKey(typeName) -> 'inf' -> getTranslate('inf') -> this module.
 *
 * Wire columns (post TASK-820 FeatureDataMixin):
 *   * `data_constant`      (FLOAT,   NULL when data_timeseries_id is set)
 *   * `data_timeseries_id` (INTEGER FK, NULL when data_constant is set)
 *
 * BE-side CHECK constraint (inf_data_xor — TASK-820): exactly one of
 * data_constant/data_timeseries_id MUST be non-null. The legacy bare `data`
 * text column is consumed by FeatureDataMixin via Inflow.make_file only as
 * back-compat for historical rows — new FE writes never populate it.
 *
 * Differs from boundaryTranslate.js: Inflow has NO discriminator field
 * (Boundary uses `boundary === 'Time'` to gate). Every Inflow row carries a
 * data value — the picker always renders, and translateOut always emits one
 * of the two per-column keys (never both, never the legacy `data` text).
 */
import { registerTranslate } from './translateRegistry';

/**
 * TASK-850 — Translate the structured form `data` value the TimeDataPicker
 * writes into the per-column WFS-T properties the BE schema expects.
 *
 * Structured shape (owned by TimeDataPicker, identical to bdy_ flow):
 *   { kind: 'constant',   constant: <Number> }
 *   { kind: 'timeseries', timeseries_id: <Number> }
 *
 * Wire contract (this function's output):
 *   * kind='constant'   → emit data_constant only, OMIT data + data_timeseries_id
 *   * kind='timeseries' → emit data_timeseries_id only, OMIT data + data_constant
 *   * missing/empty shape → strip all three (BE inf_data_xor CHECK fires,
 *     surfaces save error to user — correct behaviour: they must pick one)
 *
 * Pure function — no Redux, no axios. Called from wfstInsert/wfstUpdate before
 * WFS-T transaction build. Re-exported for unit tests.
 */
export const translateOut = (input) => {
    const props = { ...(input || {}) };
    const data = props.data;
    // Always strip the structured shape — it is NOT a wire column.
    delete props.data;
    // No discriminator (cf. boundaryTranslate.translateOut's
    // `if (!('boundary' in props))` short-circuit). Inflow has no
    // analogue — every Inflow row carries a data value, and the picker
    // always renders. Translate the structured value into one of the two
    // wire columns. Default to constant when shape is missing or malformed
    // — the BE inf_data_xor CHECK will reject a fully-null payload, which
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
    // No structured value at all — strip the per-column keys so the BE
    // rejects with a CHECK violation (forces the user to pick a value).
    delete props.data_constant;
    delete props.data_timeseries_id;
    return props;
};

/**
 * TASK-850 — Reverse of translateOut for the EDIT-mode seeding path. Given a
 * row's WFS properties (with `data_constant` and/or `data_timeseries_id`
 * populated, OR a legacy `data` text string for pre-FeatureDataMixin rows),
 * synthesize the structured `data` shape the TimeDataPicker reads. Removes
 * the per-column keys to avoid the picker getting confused about which is
 * the source of truth.
 *
 * Pure function. Invoked by epicsVectorDraw.js via the translate registry
 * (synthesizeIn) before passing seeded formValues down to FormField.
 */
export const synthesizeIn = (props) => {
    const out = { ...(props || {}) };
    // Prefer an existing structured `data` value if present — the picker
    // (TimeDataPicker) writes the structured shape on every keystroke /
    // radio change, so once the user has interacted, formValues.data is
    // the source of truth. Synthesis only fires when `data` is absent or
    // a stale text-string from the legacy bare-text BE column.
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
            // a number → constant; otherwise drop (BE inf_data_xor CHECK
            // will require the user to pick a value).
            //
            // Mirrors boundaryTranslate.synthesizeIn NIT-3 behaviour
            // (TASK-804) — use Number.isFinite, not stringified equality.
            // Non-numeric legacy strings were TimeSeries-name lookups
            // (Inflow.make_file's old heuristic) which the FE cannot
            // resolve without a server roundtrip — drop and force re-pick.
            const n = parseFloat(out.data);
            if (Number.isFinite(n)) {
                out.data = { kind: 'constant', constant: n };
            } else {
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
registerTranslate('inf', { translateOut, synthesizeIn });

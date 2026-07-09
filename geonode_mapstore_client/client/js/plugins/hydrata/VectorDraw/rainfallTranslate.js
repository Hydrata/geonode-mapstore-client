/*
 * TASK-1404 (W2 FE) — Rainfall translator for the VectorDraw translate registry.
 *
 * Registers under 'rai' — the layer-prefix discriminator for `rai_*` Rainfall
 * layers (e.g. 'rai_3_rainfall_01'). Mirrors inflowTranslate.js exactly; Rainfall
 * and Inflow share the same FeatureDataMixin wire schema.
 *
 * Wire columns (post TASK-955 FeatureDataMixin):
 *   * `data_constant`      (FLOAT,   NULL when data_timeseries_id is set)
 *   * `data_timeseries_id` (INTEGER FK, NULL when data_constant is set)
 *
 * BE-side CHECK constraint (rai_data_xor): exactly one of
 * data_constant/data_timeseries_id MUST be non-null. Without this translator
 * the identity fallback passes the structured `data` object straight through,
 * which the WFS-T XML serialiser stringifies as '[object Object]' and leaves
 * both XOR columns NULL → Postgres rejects with rai_data_xor violation.
 */
import { registerTranslate, getProp } from './translateRegistry';
import { DISCRIMINATOR_KIND } from './discriminatorRegistry';

/**
 * Translate the structured form `data` value the TimeDataPicker writes into
 * the per-column WFS-T properties the BE schema expects.
 *
 * Structured shape (owned by TimeDataPicker, identical to inf_ flow):
 *   { kind: 'constant',   constant: <Number> }
 *   { kind: 'timeseries', timeseries_id: <Number> }
 *
 * Wire contract (TASK-2159: the non-selected XOR column is emitted as explicit
 * null, NOT omitted, so a kind-switch actually clears the stale column on the
 * WFS-T UPDATE):
 *   * kind='constant'   → emit data_constant, NULL data_timeseries_id, strip data
 *   * kind='timeseries' → emit data_timeseries_id, NULL data_constant, strip data
 *   * missing/empty shape → strip all three (BE rai_data_xor CHECK fires)
 *
 * Pure function — no Redux, no axios.
 */
export const translateOut = (input) => {
    const props = { ...(input || {}) };
    const data = props.data;
    // Always strip the structured shape — it is NOT a wire column.
    delete props.data;

    if (data && typeof data === 'object') {
        // TASK-1984: hyetograph is the rai_ timeseries-family kind (filtered
        // fetch); it carries the same timeseries_id shape as 'timeseries' and
        // maps to the same wire column. Treat both identically.
        if (data.kind === DISCRIMINATOR_KIND.TIMESERIES || data.kind === DISCRIMINATOR_KIND.HYETOGRAPH) {
            const id = data.timeseries_id;
            if (id !== null && id !== undefined && id !== '') {
                props.data_timeseries_id = typeof id === 'number' ? id : parseInt(id, 10);
            } else {
                delete props.data_timeseries_id;
            }
            // TASK-2159: NULL the non-selected XOR column (not omit) so a switch
            // FROM constant clears data_constant on the WFS-T UPDATE. Omitting it
            // left the stale constant + new id both populated → rai_data_xor CHECK
            // violation (silent no-clear before TASK-2158 made it loud).
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
        // a hyetograph clears the stale data_timeseries_id.
        props.data_timeseries_id = null;
        return props;
    }
    // No structured value at all — strip the per-column keys so the BE
    // rejects with a CHECK violation (forces the user to pick a value).
    delete props.data_constant;
    delete props.data_timeseries_id;
    return props;
};

/**
 * Reverse of translateOut for the EDIT-mode seeding path. Mirrors
 * inflowTranslate.synthesizeIn exactly for the rai_ prefix.
 *
 * Pure function. Invoked by epicsVectorDraw.js via the translate registry
 * (synthesizeIn) before passing seeded formValues down to FormField.
 */
export const synthesizeIn = (props) => {
    const out = { ...(props || {}) };
    const dataValue = getProp(out, 'data', 'Data');
    const dataConstantValue = getProp(out, 'data_constant', 'Data_Constant');
    const dataTimeseriesIdValue = getProp(out, 'data_timeseries_id', 'Data_Timeseries_Id');

    // TASK-1984: 'hyetograph' is the rai_ timeseries-family kind; recognize it
    // as already-structured so a form value {kind:'hyetograph', timeseries_id:5}
    // is passed through unchanged (not re-synthesized from DB per-column keys).
    const hasStructuredData = dataValue && typeof dataValue === 'object'
        && (dataValue.kind === 'constant' || dataValue.kind === DISCRIMINATOR_KIND.TIMESERIES || dataValue.kind === DISCRIMINATOR_KIND.HYETOGRAPH);

    if (!hasStructuredData) {
        const hasConstant = dataConstantValue !== null && dataConstantValue !== undefined && dataConstantValue !== '';
        const hasTs = dataTimeseriesIdValue !== null && dataTimeseriesIdValue !== undefined && dataTimeseriesIdValue !== '';
        if (hasTs) {
            const id = dataTimeseriesIdValue;
            // TASK-1970 W3 fix: reconstruct an existing DB-loaded rainfall as the
            // 'hyetograph' kind (the rai_ timeseries-family choice), NOT the generic
            // 'timeseries' — that kind is no longer a rai_ DiscriminatorPicker choice,
            // so it would fall back to 'constant' and mis-show a rainfall-linked series as a
            // blank Constant (with a silent link-loss path if the user then typed a value).
            out.data = { kind: DISCRIMINATOR_KIND.HYETOGRAPH, timeseries_id: typeof id === 'number' ? id : parseInt(id, 10) };
        } else if (hasConstant) {
            const c = dataConstantValue;
            out.data = { kind: 'constant', constant: typeof c === 'number' ? c : parseFloat(c) };
        } else if (typeof dataValue === 'string') {
            const n = parseFloat(dataValue);
            if (Number.isFinite(n)) {
                out.data = { kind: 'constant', constant: n };
            } else {
                delete out.data;
            }
        }
    } else if (out.data !== dataValue) {
        out.data = dataValue;
    }
    // Strip per-column keys — the picker reads via the structured `data` shape.
    delete out.data_constant;
    delete out.data_timeseries_id;
    delete out.Data;
    delete out.Data_Constant;
    delete out.Data_Timeseries_Id;
    return out;
};

// Side-effect: register on module load.
registerTranslate('rai', { translateOut, synthesizeIn });

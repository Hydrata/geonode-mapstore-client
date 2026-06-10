/*
 * TASK-1594 (W1) — Culvert translator for the VectorDraw translate registry.
 *
 * Registers under 'cul' — the layer-prefix discriminator for `cul_*` Culvert
 * layers (e.g. 'cul_3_culvert_drainage'). The registry consumer (wfstApi.js's
 * wfstInsert/wfstUpdate + epicsVectorDraw.js's EDIT-load path) calls
 * deriveTranslateKey(typeName) -> 'cul' -> getTranslate('cul') -> this module.
 *
 * Culvert has no compound/structured fields (unlike Boundary's Time-XOR or
 * Inflow's data_constant/data_timeseries_id split). All hydraulic attributes
 * are simple scalar wire columns (shape string, numeric floats, barrels int,
 * description text). translateOut and synthesizeIn are therefore nearly
 * identity operations — the only work is casing normalisation via getProp
 * per the TASK-824 pattern.
 *
 * Wire columns (TASK-1593 D13 schema):
 *   shape                 VARCHAR (box | pipe | arch | null)
 *   width_m               FLOAT   null
 *   height_m              FLOAT   null
 *   diameter_m            FLOAT   null
 *   upstream_invert_m     FLOAT   null
 *   downstream_invert_m   FLOAT   null
 *   barrels               INTEGER default 1
 *   description           TEXT    null
 */
import { registerTranslate, getProp } from './translateRegistry';

const NUMERIC_FIELDS = [
    'width_m', 'height_m', 'diameter_m',
    'upstream_invert_m', 'downstream_invert_m',
];

/**
 * Translate form values to WFS-T wire properties.
 *
 * Numeric fields are coerced to float (empty string → null so the wire
 * doesn't send the string "". barrels is coerced to int (fallback 1).
 * shape is passed as-is (string or null). description passed as-is.
 *
 * Pure function — no Redux, no axios.
 */
export const translateOut = (input) => {
    const props = { ...(input || {}) };

    // Coerce numeric fields: empty string / undefined → omit (null on wire).
    for (const f of NUMERIC_FIELDS) {
        const v = props[f];
        if (v === null || v === undefined || v === '') {
            props[f] = null;
        } else if (typeof v === 'string') {
            const n = parseFloat(v);
            props[f] = Number.isFinite(n) ? n : null;
        }
        // Already a number — leave as-is.
    }

    // barrels: positive integer, default 1.
    const b = props.barrels;
    if (b === null || b === undefined || b === '') {
        props.barrels = 1;
    } else if (typeof b === 'string') {
        const n = parseInt(b, 10);
        props.barrels = Number.isFinite(n) && n > 0 ? n : 1;
    }

    return props;
};

/**
 * Reverse of translateOut for EDIT-mode seeding.
 *
 * Normalises Title-case WFS property keys to lowercase via getProp (TASK-824
 * pattern). Returns a flat formValues object the attribute form can render
 * directly — no structured compound values needed.
 *
 * Pure function.
 */
export const synthesizeIn = (wireProps) => {
    const out = { ...(wireProps || {}) };

    // Normalise casing: PostGIS lowercases columns but legacy WFS rows may
    // carry Title-case keys. Read lowercase-first, fall back to Title-case.
    const shape = getProp(out, 'shape', 'Shape');
    const widthM = getProp(out, 'width_m', 'Width_M');
    const heightM = getProp(out, 'height_m', 'Height_M');
    const diameterM = getProp(out, 'diameter_m', 'Diameter_M');
    const upstreamInvertM = getProp(out, 'upstream_invert_m', 'Upstream_Invert_M');
    const downstreamInvertM = getProp(out, 'downstream_invert_m', 'Downstream_Invert_M');
    const barrels = getProp(out, 'barrels', 'Barrels');
    const description = getProp(out, 'description', 'Description');

    // Rebuild as canonical lowercase keys, stripping Title-case duplicates.
    if (shape !== undefined) out.shape = shape;
    if (widthM !== undefined) out.width_m = widthM;
    if (heightM !== undefined) out.height_m = heightM;
    if (diameterM !== undefined) out.diameter_m = diameterM;
    if (upstreamInvertM !== undefined) out.upstream_invert_m = upstreamInvertM;
    if (downstreamInvertM !== undefined) out.downstream_invert_m = downstreamInvertM;
    if (barrels !== undefined) out.barrels = barrels;
    if (description !== undefined) out.description = description;

    // Strip Title-case residue.
    delete out.Shape;
    delete out.Width_M;
    delete out.Height_M;
    delete out.Diameter_M;
    delete out.Upstream_Invert_M;
    delete out.Downstream_Invert_M;
    delete out.Barrels;
    delete out.Description;

    return out;
};

// Side-effect: register on module load. Side-effect imports preserve module
// execution in webpack — the parent client/package.json has no
// `sideEffects: false`, so tree-shaking will NOT strip this registration.
registerTranslate('cul', { translateOut, synthesizeIn });

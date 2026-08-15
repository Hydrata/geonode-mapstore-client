/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackDerivedQuantities — the single source of truth for the eight
 * playback quantities' ids/labels/units and the SIX formulas derived at
 * render time from the store's primitive arrays (TASK-2629, W4.1, epic
 * 2618). "Derived quantity ... a formula, not a dataset" (glossary) — every
 * export here is a pure function over already-dequantized physical values,
 * mirrored byte-for-byte by:
 *   - playbackShaders.js's GLSL (the GPU render path, per-vertex)
 *   - playbackIdentify.js's sampleFieldAtPoint (the click-to-inspect path)
 *   - docs/reports/task-2618-w4-derived-quantity-fixtures/derived_quantity_reference.py
 *     (the independent Python parity fixture, reading the SAME store bytes)
 *
 * Formula authority (wave brief CONTEXT, LOCKED):
 *   stage    = elevation + depth
 *   dIV      = depth * speed                          (hazard-conveyance product)
 *   froude   = speed / sqrt(g * depth)
 *   shear    = rho_w * g * friction^2 * speed^2 / depth^(1/3)   (Manning form)
 *   courant  = sqrt(g * depth) * dt(t) / inradius      (celerity * dt / inradius),
 *              LABELLED approximate/global-dt (review F6) — dt(t) is the
 *              solver's single global timestep, not a per-cell CFL.
 *   hazard   = AIDR H1-H6 classification, see AIDR_HAZARD_TABLE below.
 *
 * All five scalar formulas are undefined/meaningless on a dry cell (depth at
 * or below the store's own `minimum_storable_height` wet floor — read from
 * store attrs by the caller, NEVER hardcoded here) — every formula below
 * returns 0 in that case (matching the existing depth/speed wet-mask
 * convention: dry cells render the flat dry-ground tint regardless of
 * colorMode, so the exact dry-cell numeric value is cosmetic, not load-
 * bearing; the parity fixtures therefore only compare wet cells, per the
 * brief's "velocity-family parity only on cells h>h_min" rule).
 */

export const QUANTITY_IDS = ['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear', 'courant'];

// uColorMode's int encoding in playbackShaders.js's MESH_VERTEX_SHADER —
// JS and GLSL must agree on this mapping; playbackColormap-test.js and the
// GL smoke test both assert against this same table so the two can't drift.
export const QUANTITY_MODE_INDEX = Object.freeze({
    depth: 0,
    speed: 1,
    stage: 2,
    div: 3,
    hazard: 4,
    froude: 5,
    shear: 6,
    courant: 7
});

export const QUANTITY_META = Object.freeze({
    depth: { unit: 'm', requiresDt: false, discrete: false },
    speed: { unit: 'm/s', requiresDt: false, discrete: false },
    stage: { unit: 'm', requiresDt: false, discrete: false },
    div: { unit: 'm²/s', requiresDt: false, discrete: false },
    hazard: { unit: '', requiresDt: false, discrete: true },
    froude: { unit: '', requiresDt: false, discrete: false },
    shear: { unit: 'Pa', requiresDt: false, discrete: false },
    courant: { unit: '', requiresDt: true, discrete: false }
});

/**
 * The eight quantities selectable in the picker, filtered for a store's own
 * `has_dt` attr (AC: "Courant hidden gracefully when dt absent" — schema §5
 * `has_dt` is first-class-absence metadata, not a 404 to catch).
 * @param {boolean} hasDt
 * @returns {string[]}
 */
export function availableQuantityIds(hasDt) {
    return QUANTITY_IDS.filter((id) => !QUANTITY_META[id].requiresDt || hasDt);
}

// ---------------------------------------------------------------------------
// TASK-2752 (W8.2, epic 2706) — temporal-max envelope capability mapping.
//
// The backend (run_anuga.playback_store.ENVELOPE_QUANTITIES) speaks
// 'depth'/'velocity'/'div'; this module's own QUANTITY_IDS calls the same
// concept 'speed', not 'velocity' (see QUANTITY_MODE_INDEX above). This is
// the ONE place that translation happens — every other envelope-aware
// module (playbackController, the control bar, the epic) goes through it
// rather than re-deriving the mapping.
// ---------------------------------------------------------------------------

/** FE quantity id -> the backend's own name for the same physical quantity. */
export const ENVELOPE_BACKEND_NAME = Object.freeze({ depth: 'depth', speed: 'velocity', div: 'div' });

/** The FE quantity ids that CAN ever have an envelope (a fixed subset of QUANTITY_IDS). */
export const ENVELOPE_QUANTITY_IDS = Object.freeze(Object.keys(ENVELOPE_BACKEND_NAME));

/**
 * The store's zarr array name for a quantity's envelope, e.g. 'speed' ->
 * 'velocity_max' (run_anuga.playback_store's `{name}_max` convention).
 * @param {string} quantityId one of ENVELOPE_QUANTITY_IDS
 * @returns {string|null} null for a quantity that can never have one
 *   (stage/hazard/froude/shear/courant — composite/derived, outside AC1's
 *   minimum set)
 */
export function envelopeArrayName(quantityId) {
    const backendName = ENVELOPE_BACKEND_NAME[quantityId];
    return backendName ? `${backendName}_max` : null;
}

/**
 * Translate a manifest's declared backend envelope names
 * (schema_metadata.envelope_quantities, e.g. ['depth','velocity','div']) into
 * the FE quantity ids that have one, e.g. ['depth','speed','div'].
 * First-class-absence, the SAME shape has_dt already uses: an
 * undeclared/empty/malformed list returns [], never throws — a store
 * exported before TASK-2752 (including every store in production today)
 * looks exactly like a store that was asked and said "none".
 * @param {*} declaredBackendNames manifest.schema_metadata.envelope_quantities
 * @returns {string[]}
 */
export function availableEnvelopeQuantityIds(declaredBackendNames) {
    const declared = Array.isArray(declaredBackendNames) ? declaredBackendNames : [];
    return ENVELOPE_QUANTITY_IDS.filter((feId) => declared.indexOf(ENVELOPE_BACKEND_NAME[feId]) !== -1);
}

// ---------------------------------------------------------------------------
// AIDR H1-H6 flood hazard classification
//
// Source: Australian Institute for Disaster Resilience, "Flood Hazard",
// Australian Disaster Resilience Guideline 7-3 (AIDR, 2017, 2nd ed.),
// Table 1 ("Combined hazard curves — vulnerability thresholds") and Table 2
// ("Combined hazard curves — vulnerability thresholds classification
// limits"), p.11. https://knowledge.aidr.org.au/media/3518/adr-guideline-7-3.pdf
//
// Table 2 verbatim (D = still water depth m, V = velocity m/s, D*V = m²/s):
//   H1  D*V<=0.3  D<=0.3  V<=2.0   generally safe for vehicles, people, buildings
//   H2  D*V<=0.6  D<=0.5  V<=2.0   unsafe for small vehicles
//   H3  D*V<=0.6  D<=1.2  V<=2.0   unsafe for vehicles, children and the elderly
//   H4  D*V<=1.0  D<=2.0  V<=2.0   unsafe for vehicles and people
//   H5  D*V<=4.0  D<=4.0  V<=4.0   unsafe for vehicles/people; all buildings
//                                  vulnerable to structural damage
//   H6  D*V>4.0   -       -       unsafe for vehicles/people; all building
//                                  types vulnerable to failure
//
// A point is classified into the LOWEST class whose three thresholds ALL
// hold (D*V, D, V); a point failing every H1-H5 test is H6 (Figure 6's own
// "anything past the H5 curve" catch-all — there is no upper bound on H6).
// ---------------------------------------------------------------------------
export const AIDR_HAZARD_CITATION = 'AIDR Guideline 7-3 "Flood Hazard" (2017), Table 2, p.11';

export const AIDR_HAZARD_TABLE = Object.freeze([
    Object.freeze({ classIndex: 0, className: 'H1', maxDV: 0.3, maxD: 0.3, maxV: 2.0 }),
    Object.freeze({ classIndex: 1, className: 'H2', maxDV: 0.6, maxD: 0.5, maxV: 2.0 }),
    Object.freeze({ classIndex: 2, className: 'H3', maxDV: 0.6, maxD: 1.2, maxV: 2.0 }),
    Object.freeze({ classIndex: 3, className: 'H4', maxDV: 1.0, maxD: 2.0, maxV: 2.0 }),
    Object.freeze({ classIndex: 4, className: 'H5', maxDV: 4.0, maxD: 4.0, maxV: 4.0 })
    // H6 (classIndex 5) is the catch-all — no thresholds, see classifyHazard.
]);

export const AIDR_HAZARD_CLASS_COUNT = 6; // H1..H6

/**
 * AIDR H1-H6 classification for one (depth, speed) pair. Pure, deterministic,
 * `<=` at every boundary (matches Table 2's own `<=` notation) — the ONLY
 * place classification tolerance is relaxed is the parity-fixture COMPARISON
 * (see isNearHazardBoundary below), never this function itself.
 * @param {number} depth metres
 * @param {number} speed m/s
 * @returns {{classIndex: number, className: string}}
 */
export function classifyHazard(depth, speed) {
    const d = Math.max(0, depth);
    const v = Math.max(0, speed);
    const dv = d * v;
    for (let i = 0; i < AIDR_HAZARD_TABLE.length; i++) {
        const row = AIDR_HAZARD_TABLE[i];
        if (dv <= row.maxDV && d <= row.maxD && v <= row.maxV) {
            return { classIndex: row.classIndex, className: row.className };
        }
    }
    return { classIndex: 5, className: 'H6' };
}

/**
 * Boundary-tolerance rule (review F8, wave brief): a class MISMATCH between
 * two independent implementations is tolerated when (d, v, or d*v) sits
 * within `eps` of any threshold this classification uses — floating-point/
 * quantization noise can legitimately push a near-boundary sample to either
 * side of a `<=` knife-edge in two implementations that round differently.
 * Used by the parity-fixture TEST comparator only; classifyHazard itself
 * stays a plain deterministic `<=`.
 * @param {number} depth
 * @param {number} speed
 * @param {number} [eps=1e-3]
 * @returns {boolean}
 */
export function isNearHazardBoundary(depth, speed, eps = 1e-3) {
    const d = Math.max(0, depth);
    const v = Math.max(0, speed);
    const dv = d * v;
    const dThresholds = [0.3, 0.5, 1.2, 2.0, 4.0];
    const vThresholds = [2.0, 4.0];
    const dvThresholds = [0.3, 0.6, 1.0, 4.0];
    const near = (value, thresholds) => thresholds.some((t) => Math.abs(value - t) <= eps);
    return near(d, dThresholds) || near(v, vThresholds) || near(dv, dvThresholds);
}

// ---------------------------------------------------------------------------
// Scalar formulas — each guards the dry/degenerate case by returning 0
// rather than propagating Infinity/NaN (schema §8: "GLSL divide-by-zero is
// undefined per spec ... the mask should be applied before the formula,
// client-side" — the same guard applies to the JS/Python mirrors).
// ---------------------------------------------------------------------------

/** stage = elevation + depth (datum-absolute water surface). */
export function computeStage(elevation, depth) {
    return elevation + Math.max(0, depth);
}

/** dIV = depth * speed, the m²/s hazard-conveyance product (glossary). */
export function computeDIV(depth, speed) {
    return Math.max(0, depth) * Math.max(0, speed);
}

/** Froude number = speed / sqrt(g * depth); 0 on a dry/degenerate cell. */
export function computeFroude(depth, speed, g) {
    const d = Math.max(0, depth);
    if (d <= 0) {
        return 0;
    }
    return Math.max(0, speed) / Math.sqrt(g * d);
}

/**
 * Manning bed shear stress tau = rho_w * g * n^2 * |v|^2 / h^(1/3).
 * @param {number} depth metres
 * @param {number} speed m/s
 * @param {number} frictionN per-vertex Manning's n (store's `friction` array)
 * @param {number} rhoW kg/m^3 (store attr `rho_w`)
 * @param {number} g m/s^2 (store attr `g`)
 */
export function computeShear(depth, speed, frictionN, rhoW, g) {
    const d = Math.max(0, depth);
    if (d <= 0) {
        return 0;
    }
    return (rhoW * g * frictionN * frictionN * speed * speed) / Math.cbrt(d);
}

/**
 * Courant = celerity * dt(t) / inradius, celerity = sqrt(g * depth) — LABELLED
 * approximate/global-dt (review F6): dt(t) is the solver's single global
 * timestep for the whole domain at this instant, not a per-cell CFL number.
 * @param {number} depth metres
 * @param {number} dtSeconds the (possibly frame-mixed) global dt, seconds
 * @param {number} inradius metres (store's per-face `inradius`, broadcast to
 *   vertices as the MIN of incident faces — playbackMeshGeometry.computeVertexInradius)
 * @param {number} g m/s^2
 */
export function computeCourant(depth, dtSeconds, inradius, g) {
    const d = Math.max(0, depth);
    if (d <= 0 || !(inradius > 0) || !(dtSeconds >= 0)) {
        return 0;
    }
    return (Math.sqrt(g * d) * dtSeconds) / inradius;
}

/**
 * Mix a per-timestep SCALAR (dt_ms) the same linear way the two-buffer
 * shader mixes per-vertex arrays — dt_ms[0] is always invalid (NaN, schema
 * §8: "the first sample is always invalid"), so a NaN endpoint falls back to
 * the other endpoint rather than poisoning the mix.
 * @param {Float32Array|number[]} dtMs
 * @param {number} t0 timestep index
 * @param {number} t1 timestep index
 * @param {number} mixT 0-1
 * @returns {number} seconds (NOT milliseconds)
 */
export function mixDtSeconds(dtMs, t0, t1, mixT) {
    if (!dtMs || dtMs.length === 0) {
        return 0;
    }
    const a = dtMs[t0];
    const b = dtMs[t1];
    const aOk = isFinite(a);
    const bOk = isFinite(b);
    let ms;
    if (aOk && bOk) {
        ms = a + (b - a) * mixT;
    } else if (bOk) {
        ms = b;
    } else if (aOk) {
        ms = a;
    } else {
        ms = 0;
    }
    return ms / 1000;
}

/**
 * TASK-1450 (W3) — Temporal Pattern preset library for the FE picker.
 *
 * Provides:
 * - PRESET_FAMILIES: ordered list of picker options (id, label, description).
 * - getPreviewCurve(patternKey): normalised cumulative ordinates for display.
 *   Returns an array of {t, cum} objects (t = fraction of duration 0..1,
 *   cum = fraction of total depth 0..1). Sampled at ~20 points.
 *   Returns null for 'alternating_block' and 'custom' (no fixed curve).
 * - suggestPatternFromLatLon(lat, lon): returns a patternKey string based on
 *   the geography rule from the epic proposal §5.
 *
 * All preview data is derived from the same source tables as the backend
 * design_storm.py — keeping FE and BE in sync at the spec level.
 *
 * TASK-1502 (W5): 'custom' entry added to PRESET_FAMILIES.
 */

// ---------------------------------------------------------------------------
// Pattern family identifiers (must match backend constants in design_storm.py)
// NOTE (TASK-1498 / DECISION Q11): SCS-SA removed from the pattern set.
// Final set: Alternating Block (default), SCS I/IA/II/III, Huff auto, Custom.
// TASK-1502 (W5): CUSTOM added.
// ---------------------------------------------------------------------------
export const ALTERNATING_BLOCK = 'alternating_block';
export const SCS_TYPE_I   = 'SCS_TYPE_I';
export const SCS_TYPE_IA  = 'SCS_TYPE_IA';
export const SCS_TYPE_II  = 'SCS_TYPE_II';
export const SCS_TYPE_III = 'SCS_TYPE_III';
export const HUFF         = 'HUFF';
// TASK-1502 (W5): user-defined custom cumulative curve.
export const CUSTOM = 'custom';

// ---------------------------------------------------------------------------
// Ordered preset-picker families
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} PresetFamily
 * @property {string} id          - pattern key (matches backend constant)
 * @property {string} label       - short human-readable name
 * @property {string} description - one-line description for the picker
 * @property {boolean} isMethod   - true when there is no fixed curve (alternating-block)
 */

/** @type {PresetFamily[]} */
// TASK-1498 (W1 / DECISION Q11):
//   - Alternating Block: removed "recommended" badge flag + recommending copy (issue 10).
//     "(Default)" is KEPT — it denotes the pre-selected option, not a recommendation.
//   - SCS order corrected to numeric I → IA → II → III (issue 11).
//   - SCS-SA (South Africa) entry removed entirely.
export const PRESET_FAMILIES = [
    {
        id: ALTERNATING_BLOCK,
        label: 'Alternating Block (Default)',
        description: 'IDF-exact method; arranges depth blocks around a peak.',
        isMethod: true
    },
    {
        id: SCS_TYPE_I,
        label: 'SCS / NRCS Type I',
        description: 'Pacific coast fringe, lower Midwest, Hawaii, Alaska, peak ~8 h.',
        isMethod: false
    },
    {
        id: SCS_TYPE_IA,
        label: 'SCS / NRCS Type IA',
        description: 'Pacific NW and N-California coast, least intense, peak ~8 h.',
        isMethod: false
    },
    {
        id: SCS_TYPE_II,
        label: 'SCS / NRCS Type II',
        description: 'Most of CONUS — convective storms, peak ~12 h. Widely used in US engineering practice.',
        isMethod: false
    },
    {
        id: SCS_TYPE_III,
        label: 'SCS / NRCS Type III',
        description: 'US Gulf and Atlantic coast, tropical/hurricane storms, peak ~16 h.',
        isMethod: false
    },
    {
        id: HUFF,
        label: 'Huff Quartile (auto)',
        description: 'US Midwest empirical — quartile auto-selected by storm duration. ISWS Circular 173.',
        isMethod: false
    },
    // TASK-1502 (W5): custom user-defined cumulative curve.
    // isMethod=true: no fixed dimensionless curve — the operator authors it.
    {
        id: CUSTOM,
        label: 'Custom (user-defined)',
        description: 'Author your own dimensionless cumulative curve. Project-scoped. Enter as a (time-fraction, cumulative-%) table.',
        isMethod: true
    }
];

// ---------------------------------------------------------------------------
// Preview curve data (sub-sampled dimensionless cumulative ordinates)
// ---------------------------------------------------------------------------
// 20 uniformly-sampled (t, cum) pairs from the 241-point SCS tables and the
// 11-point Huff tables. t is fraction of duration, cum is fraction of depth.
// Source: same tables as design_storm.py.

// SCS 241-point source — sampled at indices 0, 12, 24, ..., 240 (every 12th point)
// giving ~21 points at 10% of duration spacing.
const scsSample1 = [
    0.0000, 0.0174, 0.0350, 0.0545, 0.0760, 0.1000, 0.1250, 0.1560, 0.1940,
    0.2540, 0.5150, 0.6230, 0.6840, 0.7320, 0.7700, 0.8020, 0.8320, 0.8600,
    0.8860, 0.9100, 0.9320, 0.9520, 0.9700, 0.9860, 1.0000
];

const scsSample1a = [
    0.0000, 0.0220, 0.0510, 0.0830, 0.1160, 0.1560, 0.2040, 0.2680, 0.3100,
    0.4250, 0.4800, 0.5500, 0.6010, 0.6440, 0.6830, 0.7190, 0.7530, 0.7850,
    0.8150, 0.8440, 0.8710, 0.8960, 0.9200, 0.9440, 1.0000
];

const scsSample2 = [
    0.0000, 0.0105, 0.0220, 0.0345, 0.0480, 0.0630, 0.0800, 0.1000, 0.1200,
    0.1470, 0.1810, 0.2350, 0.6630, 0.7220, 0.7720, 0.8200, 0.8535, 0.8800,
    0.9018, 0.9210, 0.9402, 0.9558, 0.9700, 0.9830, 1.0000
];

const scsSample3 = [
    0.0000, 0.0090, 0.0180, 0.0276, 0.0380, 0.0500, 0.0642, 0.0824, 0.1064,
    0.1392, 0.1830, 0.2490, 0.3600, 0.5080, 0.6870, 0.7990, 0.8610, 0.9040,
    0.9340, 0.9540, 0.9690, 0.9800, 0.9880, 0.9940, 1.0000
];

// Huff Q2 — 11 points at 10% of duration spacing (representative 6-12h storm)
const huffQ2Points = [0.00, 0.15, 0.28, 0.43, 0.58, 0.71, 0.81, 0.89, 0.94, 0.97, 1.00];

/**
 * Convert a uniformly-sampled cumulative array to {t, cum} chart data.
 * t values are fraction of duration from 0 to 1.
 */
function toCurveData(samples) {
    const n = samples.length - 1;
    return samples.map((cum, i) => ({t: parseFloat((i / n).toFixed(3)), cum}));
}

const CURVE_DATA = {
    [SCS_TYPE_I]: toCurveData(scsSample1),
    [SCS_TYPE_IA]: toCurveData(scsSample1a),
    [SCS_TYPE_II]: toCurveData(scsSample2),
    [SCS_TYPE_III]: toCurveData(scsSample3),
    // HUFF auto-preview: show Q2 (representative 6-12h storm)
    [HUFF]: toCurveData(huffQ2Points)
};

/**
 * Get the normalised cumulative preview curve for a pattern key.
 * Returns null for 'alternating_block' (IDF-dependent — no fixed curve).
 * Returns null for 'custom' (user-defined — live preview from table data).
 *
 * @param {string} patternKey
 * @returns {{t: number, cum: number}[]|null}
 */
export function getPreviewCurve(patternKey) {
    if (patternKey === ALTERNATING_BLOCK) return null;
    if (patternKey === CUSTOM) return null;  // TASK-1502 (W5): custom = live preview
    return CURVE_DATA[patternKey] || null;
}

// ---------------------------------------------------------------------------
// Geography-based suggestion
// ---------------------------------------------------------------------------
/**
 * Suggest a pattern family based on a project lat/lon.
 * Rule table from epic proposal §5 (geography → pattern map).
 *
 * US regions derived from approximate bounding boxes per TR-55/NEH-630.
 * South Africa: lat -35 to -22, lon 16 to 33.
 *
 * @param {number} lat - decimal degrees, + north
 * @param {number} lon - decimal degrees, + east
 * @returns {string} pattern key
 */
export function suggestPatternFromLatLon(lat, lon) {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
        return ALTERNATING_BLOCK;
    }
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        return ALTERNATING_BLOCK;
    }

    // Contiguous United States: lat 24-50, lon -130 to -60
    // NOTE (TASK-1498): South Africa (SCS-SA) removed from pattern set.
    const inUS = la >= 24 && la <= 50 && lo >= -130 && lo <= -60;
    if (inUS) {
        // US Pacific NW: OR, WA, N-CA coast — lat > 40, lon < -120
        if (la >= 40 && lo <= -120) return SCS_TYPE_IA;
        // US Pacific coast fringe (CA, lower PNW)
        if (lo <= -115 && la >= 32) return SCS_TYPE_I;
        // US Midwest: lon -100 to -80, lat 35-48
        if (lo >= -100 && lo <= -80 && la >= 35 && la <= 48) return HUFF;
        // US East/Gulf (east of -95, south of 40) → Type III
        if (lo >= -95 && la <= 40) return SCS_TYPE_III;
        // Everything else in US → Type II (most of CONUS)
        return SCS_TYPE_II;
    }

    // Everywhere else (India, Kenya, W-Africa, etc.) → alternating-block
    return ALTERNATING_BLOCK;
}

/**
 * Get the label for a suggested pattern key.
 * @param {string} patternKey
 * @returns {string}
 */
export function getSuggestionLabel(patternKey) {
    const family = PRESET_FAMILIES.find(f => f.id === patternKey);
    return family ? family.label : patternKey;
}

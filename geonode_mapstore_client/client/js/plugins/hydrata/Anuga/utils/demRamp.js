/**
 * TASK-1850 (epic 1814 W2) — Shared dynamic-DEM colour-ramp helpers.
 *
 * Single source of truth for the FE side of the dynamic-DEM colour ramp:
 *   - the 11 FIXED ramp colours (mirrored from the GeoServer SLD),
 *   - the 11 ordered GeoServer env() key names,
 *   - a pure FE re-implementation of the BE `_compute_dem_ramp_stops`
 *     (used by the demRescaleEpic full-range fallback and the legend), and
 *   - env-string <-> object parse helpers.
 *
 * The legend (DemRampLegend) and the rescale epic (demRescaleEpic) BOTH read
 * from here so they can never disagree about colours or stop ordering.
 */

/**
 * The 11 FIXED ramp colours, in elevation order (low -> high).
 *
 * ⚠️ KEEP IN SYNC with apps/gn_anuga/slds/dem_template.sld (the OTHER repo,
 * /opt/hydrata). These are the ColorMapEntry `color=` values of the dynamic
 * DEM ramp, SKIPPING the leading nodata entry (#aeefd5 @ -9999). GeoServer
 * renders these exact colours; the env() substitution only moves the
 * quantities (elevations), never the colours — so mirroring them here is safe.
 *
 *   dem_template.sld ColorMapEntry order:
 *     #aeefd5  nodata (-9999)        <- NOT in this list (transparent nodata)
 *     #aeefd5  elevMin   (zero)
 *     #f9fcb2  elevOne   (one)
 *     #15972f  elevTwo   (two)
 *     #a9a726  elevThree (three)
 *     #c04a02  elevFour  (four)
 *     #741504  elevFive  (five)
 *     #761002  elevSix   (six)
 *     #6c2a0a  elevSeven (seven)
 *     #8c654c  elevEight (eight)
 *     #b5b5b5  elevNine  (nine)
 *     #ebe9eb  elevMax   (ten)
 */
export const DEM_RAMP_COLORS = [
    '#aeefd5', // elevMin
    '#f9fcb2', // elevOne
    '#15972f', // elevTwo
    '#a9a726', // elevThree
    '#c04a02', // elevFour
    '#741504', // elevFive
    '#761002', // elevSix
    '#6c2a0a', // elevSeven
    '#8c654c', // elevEight
    '#b5b5b5', // elevNine
    '#ebe9eb'  // elevMax
];

/**
 * The 11 GeoServer env() key names, in the SAME elevation order as
 * DEM_RAMP_COLORS. Mirrors the BE env_key_map in
 * apps/gn_anuga/api_v2.py (TerrainBboxStatsView). GeoServer rejects a partial
 * env set ("Wrong values defined"), so callers must always emit ALL 11.
 */
export const DEM_ENV_KEYS = [
    'elevMin',
    'elevOne',
    'elevTwo',
    'elevThree',
    'elevFour',
    'elevFive',
    'elevSix',
    'elevSeven',
    'elevEight',
    'elevNine',
    'elevMax'
];

/**
 * Pure FE re-implementation of BE `_compute_dem_ramp_stops`
 * (apps/gn_anuga/tasks.py). Given a full-raster (or any) min/max, returns the
 * 11-key env_params object keyed by the GeoServer env() names (elevMin..elevMax).
 *
 * Mirrors the BE snapping so the FE fallback ramp matches what GeoServer would
 * render with the same stored min/max:
 *   sld_min = round(min / 10) * 10        (BE uses python round-half-to-even,
 *                                          but a min that already sits on a
 *                                          10-boundary — the common stored case
 *                                          — is unaffected; see note below)
 *   sld_max = ceil(max / 10) * 10
 *   step    = (sld_max - sld_min) / 10
 *
 * NOTE on rounding: the BE uses python's banker's rounding for sld_min. JS
 * Math.round is round-half-up. They differ only for an exact x.5*10 boundary
 * (rare for real DEM mins, and the stored dem_elev_min is itself already a
 * BE-snapped value in practice). This is the DEGRADED fallback path only — an
 * approximate full-range ramp that is strictly better than collapsing to green;
 * the live (non-degraded) ramp always comes from the BE endpoint verbatim.
 *
 * @param {number} statsMin
 * @param {number} statsMax
 * @returns {Object|null} {elevMin, elevOne, ..., elevMax} or null if inputs invalid
 */
export function computeDemRampStops(statsMin, statsMax) {
    const min = Number(statsMin);
    const max = Number(statsMax);
    if (!isFinite(min) || !isFinite(max)) {
        return null;
    }
    const buckets = 10;
    const sldMin = Math.round(min / buckets) * buckets;
    const sldMax = Math.ceil(max / buckets) * buckets;
    const increment = (sldMax - sldMin) / buckets;
    const env = {};
    DEM_ENV_KEYS.forEach((key, i) => {
        env[key] = sldMin + i * increment;
    });
    return env;
}

/**
 * Parse a GeoServer env= string ("elevMin:300.000;elevOne:320.000;...") back
 * into an object {elevMin: 300, ...}. Inverse of buildEnvString in
 * demRescaleEpic.js. Returns {} for a falsy/empty/garbage string. Non-numeric
 * values are dropped (NaN-safe).
 *
 * @param {string} envString
 * @returns {Object}
 */
export function parseEnvString(envString) {
    if (!envString || typeof envString !== 'string') {
        return {};
    }
    const out = {};
    envString.split(';').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx <= 0) return;
        const key = pair.slice(0, idx).trim();
        const value = parseFloat(pair.slice(idx + 1));
        if (key && isFinite(value)) {
            out[key] = value;
        }
    });
    return out;
}

/**
 * Build the legend rows: pair each FIXED ramp colour with its live elevation
 * stop. `envParams` is the {elevMin..elevMax} object (from the parsed live env
 * string, or computeDemRampStops for the fallback). Missing/unparseable stops
 * render with a null value (the legend shows "—").
 *
 * @param {Object} envParams - {elevMin, elevOne, ..., elevMax}
 * @returns {Array<{color: string, key: string, value: (number|null)}>}
 */
export function buildLegendStops(envParams) {
    const params = envParams || {};
    return DEM_ENV_KEYS.map((key, i) => {
        const raw = params[key];
        const value = isFinite(Number(raw)) ? Number(raw) : null;
        return { color: DEM_RAMP_COLORS[i], key, value };
    });
}

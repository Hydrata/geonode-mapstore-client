/*
 * TASK-1997 (W3.2) — Register raster types with READ-ONLY value-readout openers.
 *
 * Raster layers (friction rasters, terrain COG) produce a GFI feature with
 * id="" (empty) — the current buildCandidates filters these out.  W3.2 re-includes
 * them via the raster path in buildCandidates (empty featureId + _anugaLayerName
 * annotation added by the epic's classify$ stream).
 *
 * VALUE EXTRACTION (C5):
 *   GeoServer returns single-band rasters in application/json as a FeatureCollection
 *   with one feature: id="" and properties: {GRAY_INDEX: <float>}. This is standard
 *   GeoServer behaviour for single-band coverages. The band property is extracted as
 *   feature.properties.GRAY_INDEX, falling back to the first numeric property value.
 *   If GRAY_INDEX is absent (live GFI shape differs from standard), the subtitle
 *   reads "Value unavailable" and the opener shows the same. The value is encoded
 *   in the SYNTHETIC featureId used for the candidate so it survives the label→panel
 *   round-trip and can be read back by buildOpenActions at click time.
 *   NOTE: GFI raster property name (GRAY_INDEX) is assumed standard; live
 *   verification is recommended before the W3 gate pass (see novel_questions C5).
 *
 * C1 (perms-gate partition): both raster targets carry readOnly:true, routing them
 *   AROUND filterEditableCandidates in buildClickActions (visibility gate only).
 *
 * C2 (D6): all dispatched actions are plain objects.
 *   show({title,message}, level) → {type: SHOW_NOTIFICATION, title, message, uid: Number, level}
 *   structuredClone-safe.
 *
 * SYNTHETIC featureId: since raster features have id="", we create a synthetic id of
 *   the form "<layerName>#raster[=<value>]" that (a) is a unique React key for the panel
 *   row, (b) encodes the extracted band value so buildOpenActions can recover it at
 *   click time without needing to re-access the original feature or state.
 *
 * C4: mirrors anugaClickTargets.js / legacyClickTargets.js (register-in-loop, called
 *   explicitly by Anuga.js).
 */
import { registerClickTarget } from '../shared/clickTargetRegistry';
import { show } from '../../../../MapStore2/web/client/actions/notifications';

// Strip an optional leading workspace namespace.
const bareLayerName = (name) => String(name || '').replace(/^[^:./]+:/, '');

/**
 * Extract a numeric band value from a GFI raster feature's properties.
 *
 * GeoServer encodes single-band raster values as `{GRAY_INDEX: float}` (the
 * standard property name for single-band coverages in GeoServer WMS GFI with
 * info_format=application/json).  Falls back to the first numeric property in
 * case the band has a non-standard name.  Returns null if no numeric value found.
 *
 * @param {object|null} feature GFI feature (may have id="" for rasters)
 * @returns {number|null}
 */
export const extractBandValue = (feature) => {
    const props = feature && feature.properties;
    if (!props || typeof props !== 'object') { return null; }
    if (typeof props.GRAY_INDEX === 'number') { return props.GRAY_INDEX; }
    // Fallback: first numeric property value
    const firstNumeric = Object.values(props).find((v) => typeof v === 'number');
    return firstNumeric !== undefined ? firstNumeric : null;
};

/**
 * Format a numeric value to a readable string, stripping trailing zeros.
 * Returns null for null input.
 */
export const formatBandValue = (value, decimals = 3) => {
    if (value === null || value === undefined) { return null; }
    return Number(value).toFixed(decimals).replace(/\.?0+$/, '');
};

/**
 * Build the SYNTHETIC featureId used for a raster candidate.
 * Format: "<layerName>#raster[=<value>]"
 * The value (if present) is URL-safe: a float number string.
 *
 * @param {string} layerName bare layer name (no workspace prefix)
 * @param {number|null} value band value at the click point
 * @returns {string} synthetic featureId
 */
export const buildRasterFeatureId = (layerName, value) =>
    value !== null && value !== undefined
        ? `${layerName}#raster=${value}`
        : `${layerName}#raster`;

/**
 * Parse the band value from a synthetic raster featureId, or return null.
 *
 * @param {string} featureId synthetic id from buildRasterFeatureId
 * @returns {number|null}
 */
export const parseRasterFeatureId = (featureId) => {
    const s = String(featureId || '');
    const idx = s.indexOf('#raster=');
    if (idx === -1) { return null; }
    const v = parseFloat(s.slice(idx + 8));
    return Number.isFinite(v) ? v : null;
};

export const registerRasterClickTargets = () => {
    // -------------------------------------------------------------------------
    // fri_raster_ — Friction rasters (Mannings n coefficient raster, single-band)
    // -------------------------------------------------------------------------
    registerClickTarget('fri_raster_', {
        // Match friction raster layers.  Called with featureId='' from the raster
        // path in buildCandidates (empty-id annotation path, W3.2).
        match: (featureId, layerName) =>
            bareLayerName(layerName).startsWith('fri_raster_'),

        // label() is called at classify time with the ORIGINAL GFI feature
        // (which has properties.GRAY_INDEX).  The value is in the subtitle so the
        // panel row shows it to the user.
        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 3);
            return {
                title: 'Friction raster',
                subtitle: formatted !== null ? `Mannings n = ${formatted}` : 'Value unavailable',
                icon: 'check-circle'
            };
        },

        // buildOpenActions() is called either:
        //   (a) directly (1-candidate path) — feature is the original GFI feature
        //   (b) via resolveCandidateOpenActions (panel selection) — feature is
        //       {id: syntheticFeatureId} (the value is encoded in the id).
        // Both paths recover the value; (b) falls back to the encoded id.
        buildOpenActions: (feature) => {
            let value = extractBandValue(feature);
            if (value === null) {
                value = parseRasterFeatureId(feature && feature.id);
            }
            const formatted = formatBandValue(value, 3);
            const message = formatted !== null ? `Mannings n = ${formatted}` : 'Value unavailable';
            // show() → {type: SHOW_NOTIFICATION, title, message, uid: Number, level}
            // All fields are plain scalars — structuredClone-safe (D6 / C2).
            return [show({ title: 'Friction raster', message }, 'info')];
        },

        // W3 read-only tag: bypasses filterEditableCandidates in buildClickActions.
        readOnly: true
    });

    // -------------------------------------------------------------------------
    // terrain_raster — Terrain COG rasters (DEM, ele_*_cog naming pattern)
    // -------------------------------------------------------------------------
    registerClickTarget('terrain_raster', {
        // Match terrain COG layers (ele_<id>_..._cog).  The 'terrain_raster' kind
        // string (14 chars) is longer than the W3.1 'ele_' legacy kind (4 chars),
        // so resolveKind() longest-key rule ensures this wins for the raster path.
        // Called with featureId='' from the raster path in buildCandidates.
        match: (featureId, layerName) =>
            /ele_\d+.*cog/.test(bareLayerName(layerName)),

        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 2);
            return {
                title: 'Terrain elevation',
                subtitle: formatted !== null ? `${formatted} m` : 'Value unavailable',
                icon: 'signal'
            };
        },

        buildOpenActions: (feature, getState) => {
            let value = extractBandValue(feature);
            if (value === null) {
                value = parseRasterFeatureId(feature && feature.id);
            }
            // Final fallback: cursorElevation from state (updated by cursorElevationEpic
            // on mousemove — might be slightly stale relative to click position).
            if (value === null && typeof getState === 'function') {
                const stateValue = getState()?.anuga?.resources?.cursorElevation;
                if (typeof stateValue === 'number') { value = stateValue; }
            }
            const formatted = formatBandValue(value, 2);
            const message = formatted !== null ? `${formatted} m` : 'Value unavailable';
            return [show({ title: 'Terrain elevation', message }, 'info')];
        },

        readOnly: true
    });
};

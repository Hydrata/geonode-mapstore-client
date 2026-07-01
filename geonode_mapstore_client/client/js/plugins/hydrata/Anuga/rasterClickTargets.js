/*
 * TASK-1997 (W3.2) — Register raster types with READ-ONLY value-readout openers.
 *
 * TASK-2040 (F7, epic 2037 W2) — added the three ANUGA RESULT rasters
 * (depth_max / velocity_max / depth_integrated_velocity_max) so a modeller
 * can click a flood-output raster and read its value the same way they
 * already can for friction/terrain inputs (dogfood finding: clicking a
 * result layer did nothing — no value readout was registered for it at
 * all). Also split the hillshade layer OUT of the terrain_raster match —
 * it was silently matching /ele_\d+.*cog/ (its filename shares the `ele_`
 * prefix, see gn_anuga.utils.create_hillshade_from_terrain_tif +
 * upload_tif_file's COG suffix) and rendering as "Terrain elevation ... m",
 * but a hillshade is a 0-255 shading visualization, not an elevation value —
 * the "m" unit was actively wrong, not just missing.
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
 *   reads "Value unavailable". The value is shown in the panel ROW (label.subtitle).
 *   NOTE: GFI raster property name (GRAY_INDEX) is assumed standard; live
 *   verification is recommended (see novel_questions C5).
 *
 * READ-ONLY, NO ACTION (UAT 2026-06-30): the band value is already shown in the
 *   panel row (label.subtitle), so clicking a raster row dispatches NO action — the
 *   redundant value toast was distracting (terrain rasters are full-coverage, so a
 *   click almost always surfaces several). buildOpenActions returns []. A LONE raster
 *   click (1 candidate, no other object under the point) falls through to the default
 *   Identify popup — see clickDisambiguationEpic buildClickActions (empty-opener
 *   fallthrough). So the value is always visible: the panel row when >=2, MapStore's
 *   native GFI popup when it is the only thing under the click.
 *
 * C1 (perms-gate partition): both raster targets carry readOnly:true, routing them
 *   AROUND filterEditableCandidates in buildClickActions (visibility gate only).
 *
 * C2 (D6): a no-op opener ([]) is trivially structuredClone-safe — nothing is
 *   dispatched, so no function can ride an action.
 *
 * SYNTHETIC featureId: since raster features have id="", we create a synthetic id of
 *   the form "<layerName>#raster[=<value>]" that is a unique React key for the panel row.
 *
 * C4: mirrors anugaClickTargets.js / legacyClickTargets.js (register-in-loop, called
 *   explicitly by Anuga.js).
 */
import { registerClickTarget } from '../shared/clickTargetRegistry';

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

        // READ-ONLY value-readout: the Mannings n value is shown in the panel row
        // (label.subtitle above). Clicking is informational -> NO action (no toast).
        // A lone friction-raster click falls through to the default Identify popup.
        buildOpenActions: () => [],

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

        // READ-ONLY value-readout: the elevation is shown in the panel row
        // (label.subtitle above). Clicking is informational -> NO action (no toast;
        // the toast was distracting on full-coverage terrain). A lone terrain click
        // falls through to the default Identify popup.
        buildOpenActions: () => [],

        readOnly: true
    });

    // -------------------------------------------------------------------------
    // terrain_hillshade — Hillshade COG rasters (TASK-2040, F7)
    //
    // gn_anuga.utils.create_hillshade_from_terrain_tif names the file
    // `ele_<terrain_id>_hillshade_<token>.tif`, and upload_tif_file (called for
    // EVERY raster, hillshade included) always converts to COG and derives the
    // dataset name from the file basename — so the published hillshade layer is
    // `ele_<terrain_id>_hillshade_<token>_cog`, which ALSO matches terrain_raster's
    // /ele_\d+.*cog/ regex above. Without this target, a hillshade click was
    // silently classified as terrain_raster and rendered "Terrain elevation ...
    // <value> m" — actively wrong (a hillshade band is a 0-255 shading intensity,
    // not an elevation in metres).
    //
    // 'terrain_hillshade' (18 chars) is LONGER than 'terrain_raster' (14 chars),
    // so resolveKind()'s longest-kind-wins rule picks THIS target for any layer
    // whose name contains "hillshade" — no change to terrain_raster's regex
    // needed; true elevation layers (no "hillshade" token) still resolve there.
    registerClickTarget('terrain_hillshade', {
        match: (featureId, layerName) => {
            const name = bareLayerName(layerName);
            return /hillshade/.test(name) && /ele_\d+.*cog/.test(name);
        },

        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 0);
            // No unit — a hillshade band is a unitless 0-255 shading intensity,
            // not a physical elevation. Dropping the "m" was the F7 fix.
            return {
                title: 'Terrain hillshade',
                subtitle: formatted !== null ? `Shading: ${formatted}` : 'Value unavailable',
                icon: 'adjust'
            };
        },

        // READ-ONLY value-readout, same rationale as terrain_raster above.
        buildOpenActions: () => [],

        readOnly: true
    });

    // -------------------------------------------------------------------------
    // ANUGA result rasters (TASK-2040, F7) — depth_max / velocity_max /
    // depth_integrated_velocity_max ("Momentum Max" in the FE group label,
    // gn_anuga.services.RESULT_LAYER_SPECS / RESULTS_GROUP_MAP).
    //
    // Published dataset name is always `run<run.id>_<name_token>_cog`
    // (gn_anuga.services._idempotent_result_layer / _assert_result_owned_by_run
    // docstring) — anchored regexes below match that exactly, so a partial
    // substring match can never misclassify one result kind as another (e.g.
    // "depth_max" vs "depthintegratedvelocity_max" never collide).
    //
    // Before this target existed, clicking a flood-output raster dispatched NO
    // registered target -> fell through silently, so a modeller could not read
    // a depth/velocity/momentum value off the map at all (dogfood F7).
    // -------------------------------------------------------------------------
    registerClickTarget('depth_max', {
        match: (featureId, layerName) =>
            /^run\d+_depth_max_cog$/.test(bareLayerName(layerName)),

        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 2);
            return {
                title: 'Depth Max',
                subtitle: formatted !== null ? `Depth: ${formatted} m` : 'Value unavailable',
                icon: 'tint'
            };
        },

        buildOpenActions: () => [],
        readOnly: true
    });

    registerClickTarget('velocity_max', {
        match: (featureId, layerName) =>
            /^run\d+_velocity_max_cog$/.test(bareLayerName(layerName)),

        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 2);
            return {
                title: 'Velocity Max',
                subtitle: formatted !== null ? `Velocity: ${formatted} m/s` : 'Value unavailable',
                icon: 'flash'
            };
        },

        buildOpenActions: () => [],
        readOnly: true
    });

    // name_token is 'depthintegratedvelocity_max' (no separating underscore —
    // see gn_anuga.services.RESULT_LAYER_SPECS comment: it is the internal
    // RESULTS_GROUP_MAP routing token, not a display string).
    registerClickTarget('depth_integrated_velocity_max', {
        match: (featureId, layerName) =>
            /^run\d+_depthintegratedvelocity_max_cog$/.test(bareLayerName(layerName)),

        label: (feature) => {
            const value = extractBandValue(feature);
            const formatted = formatBandValue(value, 2);
            return {
                // "Momentum" matches the FE group-rename (pollingEpics.js:
                // Results.Depth Integrated Velocity -> Results.Momentum, TASK-1429).
                title: 'Momentum Max',
                subtitle: formatted !== null ? `Momentum: ${formatted} m²/s` : 'Value unavailable',
                icon: 'random'
            };
        },

        buildOpenActions: () => [],
        readOnly: true
    });
};

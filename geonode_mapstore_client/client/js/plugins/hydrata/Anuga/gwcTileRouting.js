/**
 * TASK-1323 (W2) — Centralized GWC WMTS tile-routing helper.
 *
 * Single enforcement point for the no-leak predicate:
 *   Route a layer to the SHARED GWC tile cache (WMTS) IFF ALL hold:
 *     1. The layer is registered as a shareable tile layer (raster or MVT).
 *     2. No per-session env= parameter (DEM colormap rescale).
 *     3. No per-user CQL_FILTER.
 *     4. No per-user style override.
 *   Else: stay on DIRECT /geoserver/ows WMS (untiled/ImageWMS).
 *
 * Gridset: EPSG:900913 fleet-wide (ADR — W1 confirmed, follow MeshWorkflow.js:223).
 * Endpoint: /geoserver/gwc/service/wmts (NOT /ows tiled=true — GeoServer 2.27.4 NPE).
 *
 * DEM/terrain layers (group 'Input Data.Terrain'):
 *   - DYNAMIC mode (params.env present): carry per-session env= colormap rescale
 *     (demRescaleEpic.js). MUST remain singleTile/direct/uncached. Rejected by the
 *     env= check (condition 2) — the PER_SESSION_GROUPS guard is no longer needed
 *     as a blunt instrument.
 *   - TRADITIONAL mode (no params.env): static literal-quantity colour-relief SLD
 *     (TASK-1719). GWC can safely cache tiles fleet-wide. SHAREABLE.
 *
 * Out-of-scope (W7 / TASK-1191/1192): SwammLayers.js, contourLayers.js,
 * epicsSwamm.js filterBmpEpic. Those layers carry per-user CQL_FILTER / per-user
 * style (group_profile BMP) and MUST NOT route to the shared cache. They are
 * correctly blocked by condition (3)/(4); do NOT route them via this helper yet.
 *
 * WMTS URL template reference (MeshWorkflow.js:223):
 *   /geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0
 *   &LAYER={name}&STYLE=&TILEMATRIXSET=EPSG:900913
 *   &TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}&FORMAT={format}
 */

/**
 * GWC WMTS base endpoint (no trailing slash).
 */
export const GWC_WMTS_ENDPOINT = '/geoserver/gwc/service/wmts';

/**
 * Direct WMS endpoint for non-cacheable (per-session) layers.
 */
export const DIRECT_WMS_ENDPOINT = '/geoserver/ows';

/**
 * Gridset used fleet-wide. MUST be EPSG:900913 (not 3857) — GWC maps 900913 to its
 * internal gridset and every tile would MISS if the wrong string were used.
 * W1 confirmed fleet-wide; MeshWorkflow.js:223 is the canonical source of truth.
 */
export const GWC_TILEMATRIXSET = 'EPSG:900913';

/**
 * Layer groups known to carry per-session env= rescale parameters.
 * Listed here for documentation; the actual enforcement is the params.env check
 * in isShareableTileLayer rather than this set — a terrain layer WITHOUT params.env
 * (Traditional static style, TASK-1719) is shareable and must NOT be blocked by
 * group membership alone.
 *
 * Keep this set updated if new per-session terrain groups are introduced; it serves
 * as the canonical inventory even though shareability is decided by param presence.
 */
/**
 * Determine whether a layer object is safe to serve from the shared GWC tile cache.
 *
 * A layer is SHAREABLE iff ALL conditions hold:
 *   1. It is of WMS type (type === 'wms') — only WMS layers can be GWC-cached.
 *   2. Its params contain NO env= value (per-session DEM colormap rescale).
 *   3. Its params contain NO CQL_FILTER (per-user row-level filter).
 *   4. It does NOT carry a per-user style override via params.SLD or params.SLD_BODY.
 *      (Note: layer.style is the default published style — acceptable on shared cache;
 *       dynamic per-user SLD injection via params is NOT.)
 *
 * TERRAIN LAYERS (group 'Input Data.Terrain') — TWO modes (TASK-1719):
 *   - Dynamic (params.env present): per-session colormap rescale via demRescaleEpic.js.
 *     Rejected by condition (2). MUST NOT be cached by GWC.
 *   - Traditional (no params.env): static literal-quantity colour-relief SLD.
 *     Passes all conditions → SHAREABLE. GWC can cache tiles fleet-wide.
 *
 * The PER_SESSION_GROUPS set documents which groups CAN carry env= params; the
 * group itself is NOT a disqualifier — params.env presence is.
 *
 * @param {Object} layer - A MapStore2 layer config object.
 * @returns {boolean}
 */
export function isShareableTileLayer(layer) {
    if (!layer || layer.type !== 'wms') return false;

    // Conditions 2-4: inspect layer.params for per-session / per-user parameters.
    // NOTE: terrain group membership is NOT checked here — a Traditional terrain
    // (no params.env) is shareable; only a Dynamic terrain (params.env set) is not.
    const params = layer.params || {};
    if (params.env) return false;
    if (params.CQL_FILTER) return false;
    if (params.SLD) return false;
    if (params.SLD_BODY) return false;

    return true;
}

/**
 * Build a GWC WMTS tileUrls array for a named layer and format.
 *
 * The returned array is intended for MapStore2 layer config's `tileUrls` field,
 * which the vectortiles / WMS plugin reads to request tiles via WMTS instead of OWS.
 *
 * TASK-1721 (W4): An optional `style` parameter allows specifying a named GeoServer
 * style (e.g. 'dem_contours') for layers that should use a non-default style via GWC.
 * When `style` is empty (default), the STYLE= parameter is left blank, which is the
 * existing behaviour preserved for all callers that omit the argument.
 *
 * @param {string} layerName - Fully-qualified GeoServer layer name (e.g. 'geonode:mesh_triangle_render').
 * @param {string} [format='image/png'] - MIME type for the tile request.
 * @param {string} [style=''] - Named GeoServer style (e.g. 'dem_contours'). Empty = default style.
 * @returns {string[]} Single-element array containing the WMTS URL template.
 */
export function buildGwcTileUrls(layerName, format = 'image/png', style = '') {
    const ts = GWC_TILEMATRIXSET;
    return [
        `${GWC_WMTS_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=${layerName}&STYLE=${style}` +
        `&TILEMATRIXSET=${ts}&TILEMATRIX=${ts}:{z}&TILEROW={y}&TILECOL={x}` +
        `&FORMAT=${format}`
    ];
}

/**
 * Build a MVT-specific GWC tileUrls array (application/vnd.mapbox-vector-tile).
 *
 * Convenience wrapper around buildGwcTileUrls for MVT layers.
 * Mirrors the existing MeshWorkflow.js:223 pattern so all MVT WMTS URLs
 * are generated from one place.
 *
 * @param {string} layerName - Fully-qualified GeoServer layer name.
 * @returns {string[]}
 */
export function buildGwcMvtTileUrls(layerName) {
    return buildGwcTileUrls(layerName, 'application/vnd.mapbox-vector-tile');
}

/**
 * Build a complete WMS layer config for a shareable raster tile layer routed
 * via GWC WMTS.
 *
 * Adds `tileUrls` (WMTS) to the base config and ensures the layer url points
 * to the GWC WMTS endpoint rather than /geoserver/ows.
 *
 * The caller is responsible for providing the base layer config; this function
 * only injects the GWC routing fields. Use `isShareableTileLayer` to guard
 * before calling this.
 *
 * @param {Object} baseConfig - Partial MapStore2 layer config (must include `name`).
 * @param {string} [format='image/png'] - Tile format.
 * @returns {Object} Updated layer config with GWC routing applied.
 */
export function applyGwcRouting(baseConfig, format = 'image/png') {
    const { name } = baseConfig;
    if (!name) {
        throw new Error('[gwcTileRouting] applyGwcRouting: layer config must include a `name` field');
    }
    return {
        ...baseConfig,
        url: GWC_WMTS_ENDPOINT,
        tileUrls: buildGwcTileUrls(name, format)
    };
}

/**
 * Route a layer config: apply GWC routing if shareable, leave direct otherwise.
 *
 * This is the primary entry point for callers that receive a layer config and
 * want to route it correctly without knowing the predicate details.
 *
 * - Shareable raster layers: url -> GWC_WMTS_ENDPOINT, tileUrls added.
 * - Non-shareable layers (DEM, per-user CQL, per-user SLD): returned unchanged.
 *
 * @param {Object} layerConfig - MapStore2 layer config.
 * @param {string} [format='image/png'] - Tile format (ignored for non-shareable).
 * @returns {Object} Possibly-modified layer config.
 */
export function routeLayerTileSource(layerConfig, format = 'image/png') {
    if (!isShareableTileLayer(layerConfig)) {
        return layerConfig;
    }
    return applyGwcRouting(layerConfig, format);
}

/**
 * Build the MapStore2 layer config for the mesh triangle render layer (W6 TASK-1423).
 *
 * Single source of truth for the authenticated GWC MVT layer config used by
 * both MeshTriangleLayerSection (manual add button) and _autoAddMeshLayerAndZoom
 * (auto-add on successful preview).  Extracted here so the two call sites share
 * identical params + tileUrl construction.
 *
 * WHY explicit token injection:
 *   GWC_WMTS_ENDPOINT is a relative URL (/geoserver/gwc/service/wmts).
 *   MapStore's authenticationRules match absolute GeoServer URLs
 *   (https://{site}/geoserver/.*), so addAuthenticationParameter() does NOT
 *   fire for relative URLs — the token must be injected explicitly here.
 *
 * @param {string|null} token - OAuth2 access token from SecurityUtils.getToken().
 *   When null/undefined the layer is built without access_token (anon session).
 * @returns {Object} MapStore2 WMS layer config ready to dispatch via addLayer().
 */
export function buildMeshTriangleLayer(token) {
    const LAYER_NAME = 'geonode:mesh_triangle_render';
    const params = {
        LAYERS: LAYER_NAME,
        FORMAT: 'image/png',
        TRANSPARENT: true,
        VERSION: '1.1.1',
        TILED: true,
        ...(token ? {access_token: token} : {})
    };
    const baseTileUrls = buildGwcMvtTileUrls(LAYER_NAME);
    const tileUrls = token
        ? baseTileUrls.map(u => u + '&access_token=' + encodeURIComponent(token))
        : baseTileUrls;
    return {
        type: 'wms',
        url: GWC_WMTS_ENDPOINT,
        name: LAYER_NAME,
        title: 'Mesh triangles',
        visibility: true,
        group: 'Input Data.Full Mesh',
        params,
        tileUrls
    };
}

/**
 * The DEM contour overlay is rendered on-the-fly by GeoServer's ``ras:Contour``
 * rendering transformation via the global ``dem_contours`` named style.
 *
 * CONVENTION: The FE knows the style name ``dem_contours`` — no API round-trip is
 * needed to discover it.  The caller provides the DEM coverage layer name (e.g.
 * ``'geonode:ele_7_grand_canyon_cog'``) which it already has from the terrain row.
 *
 * TASK-1829 (W2) supersedes the TASK-1721 GWC-cached variant: see buildContourLayer
 * below — transport is now DIRECT WMS with an adaptive FE-computed interval.
 */
export const DEM_CONTOUR_STYLE_NAME = 'dem_contours';

/**
 * TASK-1829 (W2): "nice" set of contour intervals (the classic 1-2-5 progression,
 * extended) the FE can snap a raw interval UP to. Targets a human-readable
 * contour spacing rather than an arbitrary decimal.
 */
const NICE_CONTOUR_INTERVALS = [
    0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000
];

/**
 * TASK-1829 (W2): Compute a FE-static "nice" contour interval from a DEM's relief.
 *
 * The interval is derived purely on the client from the terrain's stored
 * dem_elev_min / dem_elev_max (relief = max - min), so a low-relief flood DEM
 * (e.g. 75 m of relief) draws a sensible ~15 lines instead of zero lines at the
 * legacy fixed 100 m literal.
 *
 * Algorithm: aim for ~15 contour lines across the relief (raw = relief / 15),
 * then snap UP to the nearest "nice" number (1/2/5/10/20/25/50/100/...). When
 * the relief is unknown / non-positive, fall back to 100 (the legacy behaviour
 * and the SLD's env() default).
 *
 * @param {number} relief - Elevation range of the DEM in map units (metres).
 * @returns {number} A "nice" contour interval in the same units.
 */
export function niceContourInterval(relief) {
    const r = Number(relief);
    if (!isFinite(r) || r <= 0) {
        // Unknown / zero relief: keep today's behaviour (matches SLD env() default).
        return 100;
    }
    const TARGET_LINES = 15;
    const raw = r / TARGET_LINES;
    // Snap UP to the nearest nice number; clamp to the table's bounds.
    const snapped = NICE_CONTOUR_INTERVALS.find(n => n >= raw);
    return snapped !== undefined
        ? snapped
        : NICE_CONTOUR_INTERVALS[NICE_CONTOUR_INTERVALS.length - 1];
}

/**
 * TASK-1829 (W2): Build a MapStore2 layer config for the DEM contour overlay,
 * served via DIRECT WMS (NOT GWC) with an adaptive, FE-computed interval.
 *
 * WHY DIRECT WMS (not GWC):
 *   The previous GWC WMTS routing 400'd "Style invalid" — the ele_ GWC layer's
 *   styleParameterFilter has an empty defaultValue, so a non-default
 *   STYLES=dem_contours request is rejected by GWC. The render is also dynamic
 *   (per-DEM interval via env=) so it is intentionally non-cacheable. We therefore
 *   route to /geoserver/ows and let GeoServer render on the fly.
 *
 * WHY explicit token injection in params (no tileUrls):
 *   DIRECT_WMS_ENDPOINT is a relative URL (/geoserver/ows). MapStore's
 *   authenticationRules match absolute GeoServer URLs only, so
 *   addAuthenticationParameter() does NOT fire — the token must live in params
 *   (same caveat as buildMeshTriangleLayer). With tileUrls dropped there is no
 *   WMTS template to also stamp.
 *
 * The ras:Contour SLD reads env('contourInterval', 100) so the FE-computed interval
 * substitutes server-side. Sending params.env makes this layer FAIL isShareableTileLayer
 * (env() check) — CORRECT for a dynamic, non-cacheable render.
 *
 * TASK-1829 re-aim (operator UAT 2026-06-20): one uniform pure-white line, no
 * major/minor — so there is no contourMajor any more (the SLD lost its major rules).
 *
 * @param {string} demLayerName - Fully-qualified GeoServer coverage name (e.g. 'geonode:ele_7_...').
 * @param {string|null} [token] - OAuth2 access token. When null/undefined, no token injected.
 * @param {number} [interval=100] - Contour interval in map units (FE-computed from relief).
 * @returns {Object} MapStore2 WMS layer config for the contour overlay (direct WMS).
 */
export function buildContourLayer(demLayerName, token = null, interval = 100) {
    const params = {
        LAYERS: demLayerName,
        STYLES: DEM_CONTOUR_STYLE_NAME,
        FORMAT: 'image/png',
        TRANSPARENT: true,
        VERSION: '1.1.1',
        // env() substitutes the adaptive interval into the ras:Contour SLD.
        // Presence of params.env intentionally makes this layer non-shareable.
        env: `contourInterval:${interval}`,
        // Direct WMS is relative (/geoserver/ows) — addAuthenticationParameter does
        // NOT fire, so inject the token here explicitly (mirrors buildMeshTriangleLayer).
        ...(token ? {access_token: token} : {})
    };
    return {
        type: 'wms',
        url: DIRECT_WMS_ENDPOINT,
        name: demLayerName,
        // Unique id to distinguish contour overlay from the colormap layer.
        id: `${demLayerName}__contours`,
        title: 'Contours',
        visibility: true,
        // Place contour layer in the same terrain group, above the colormap.
        group: 'Input Data.Terrain',
        style: DEM_CONTOUR_STYLE_NAME,
        // singleTile lives at the layer level (MapStore reads it there) — a single
        // GetMap, not a WMTS tile grid. Required for the dynamic ras:Contour render.
        singleTile: true,
        params
    };
}

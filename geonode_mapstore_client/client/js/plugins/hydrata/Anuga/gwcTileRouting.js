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
 * DEM/terrain layers (group 'Input Data.Terrain') carry per-session env= colormap
 * rescale (demRescaleEpic.js). They MUST remain singleTile/direct/uncached and are
 * the canonical "must NOT share-cache" example. The shareability predicate REJECTS
 * them via the env= / group checks.
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
 * Layer groups that carry per-session env= rescale and MUST stay direct/uncached.
 * Extend this list if new per-session terrain groups are added.
 */
const PER_SESSION_GROUPS = new Set([
    'Input Data.Terrain'
]);

/**
 * Determine whether a layer object is safe to serve from the shared GWC tile cache.
 *
 * A layer is SHAREABLE iff ALL conditions hold:
 *   1. It is of WMS type (type === 'wms') — only WMS layers can be GWC-cached.
 *   2. It is NOT in a per-session group (i.e. not a DEM/terrain layer).
 *   3. Its params contain NO env= value (per-session DEM colormap rescale).
 *   4. Its params contain NO CQL_FILTER (per-user row-level filter).
 *   5. It does NOT carry a per-user style override via params.SLD or params.SLD_BODY.
 *      (Note: layer.style is the default published style — acceptable on shared cache;
 *       dynamic per-user SLD injection via params is NOT.)
 *
 * @param {Object} layer - A MapStore2 layer config object.
 * @returns {boolean}
 */
export function isShareableTileLayer(layer) {
    if (!layer || layer.type !== 'wms') return false;

    // Condition 2: reject per-session groups (DEM terrain -> env= rescale)
    if (layer.group && PER_SESSION_GROUPS.has(layer.group)) return false;

    // Conditions 3-5: inspect layer.params for per-session / per-user parameters
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
 * @param {string} layerName - Fully-qualified GeoServer layer name (e.g. 'geonode:mesh_triangle_render').
 * @param {string} [format='image/png'] - MIME type for the tile request.
 * @returns {string[]} Single-element array containing the WMTS URL template.
 */
export function buildGwcTileUrls(layerName, format = 'image/png') {
    const ts = GWC_TILEMATRIXSET;
    return [
        `${GWC_WMTS_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=${layerName}&STYLE=` +
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

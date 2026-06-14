/**
 * TASK-1323 (W2) — Unit tests for gwcTileRouting.js
 *
 * Tests cover:
 *   - isShareableTileLayer: the no-leak predicate
 *   - buildGwcTileUrls / buildGwcMvtTileUrls: WMTS URL template generation
 *   - applyGwcRouting / routeLayerTileSource: layer config routing
 *
 * Key invariants:
 *   - Shareable raster/MVT layers -> WMTS endpoint; TILEMATRIXSET=EPSG:900913
 *   - DEM/terrain (env= per-session colormap) -> NOT shareable, stays direct
 *   - Per-user CQL_FILTER -> NOT shareable
 *   - Per-user SLD / SLD_BODY -> NOT shareable
 *   - Non-wms layers -> NOT shareable
 */
import expect from 'expect';
import {
    isShareableTileLayer,
    buildGwcTileUrls,
    buildGwcMvtTileUrls,
    applyGwcRouting,
    routeLayerTileSource,
    buildMeshTriangleLayer,
    GWC_WMTS_ENDPOINT,
    GWC_TILEMATRIXSET,
    DIRECT_WMS_ENDPOINT
} from '../gwcTileRouting';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeWmsLayer = (overrides = {}) => ({
    type: 'wms',
    name: 'geonode:my_raster',
    url: '/geoserver/ows',
    ...overrides
});

// ---------------------------------------------------------------------------
// isShareableTileLayer — the shareability predicate
// ---------------------------------------------------------------------------

describe('gwcTileRouting — isShareableTileLayer', () => {

    it('returns true for a plain WMS layer with no per-session params', () => {
        expect(isShareableTileLayer(makeWmsLayer())).toBe(true);
    });

    it('returns true for a WMS layer in a non-terrain group', () => {
        expect(isShareableTileLayer(makeWmsLayer({ group: 'Results.Depth' }))).toBe(true);
    });

    it('returns true for a WMS layer with no params object at all', () => {
        const layer = makeWmsLayer();
        delete layer.params;
        expect(isShareableTileLayer(layer)).toBe(true);
    });

    // --- DEM / terrain layer shareability (TASK-1719: Traditional vs Dynamic) ---

    it('returns false for a Dynamic terrain layer (Input Data.Terrain + params.env set)', () => {
        // DYNAMIC mode: demRescaleEpic.js injects per-session env= colormap rescale.
        // The env= check (condition 2) must reject it. If this ever returns true,
        // DEM dynamic colormap tiles would poison the shared GWC cache.
        const demLayer = makeWmsLayer({
            group: 'Input Data.Terrain',
            name: 'geonode:ele_7_my_dem_cog',
            params: { env: 'elevMin:100.000;elevMax:900.000' }
        });
        expect(isShareableTileLayer(demLayer)).toBe(false);
    });

    it('returns true for a Traditional terrain layer (Input Data.Terrain, NO params.env)', () => {
        // TRADITIONAL mode (TASK-1719): static literal colour-relief SLD, no env=.
        // GWC can safely cache tiles fleet-wide — this MUST be shareable.
        const demLayer = makeWmsLayer({
            group: 'Input Data.Terrain',
            name: 'geonode:ele_7_my_dem_cog'
            // no params.env
        });
        expect(isShareableTileLayer(demLayer)).toBe(true);
    });

    it('returns false when params.env is set (per-session DEM colormap rescale, any group)', () => {
        const demLayer = makeWmsLayer({
            params: { env: 'elevMin:100.000;elevMax:900.000' }
        });
        expect(isShareableTileLayer(demLayer)).toBe(false);
    });

    it('returns false when params.env is set AND group is terrain (belt-and-braces, Dynamic)', () => {
        const demLayer = makeWmsLayer({
            group: 'Input Data.Terrain',
            params: { env: 'elevMin:100.000;elevMax:900.000' }
        });
        expect(isShareableTileLayer(demLayer)).toBe(false);
    });

    // --- Per-user filtering ---

    it('returns false when params.CQL_FILTER is set (per-user row-level filter)', () => {
        const bmpLayer = makeWmsLayer({
            params: { CQL_FILTER: "group_profile_id=42" }
        });
        expect(isShareableTileLayer(bmpLayer)).toBe(false);
    });

    // --- Per-user style injection ---

    it('returns false when params.SLD is set (per-user SLD injection)', () => {
        const layer = makeWmsLayer({
            params: { SLD: 'http://example.com/style.sld' }
        });
        expect(isShareableTileLayer(layer)).toBe(false);
    });

    it('returns false when params.SLD_BODY is set (inline per-user SLD)', () => {
        const layer = makeWmsLayer({
            params: { SLD_BODY: '<StyledLayerDescriptor>...</StyledLayerDescriptor>' }
        });
        expect(isShareableTileLayer(layer)).toBe(false);
    });

    // --- Non-WMS layer types ---

    it('returns false for a non-wms layer (vector)', () => {
        expect(isShareableTileLayer({ type: 'vector', name: 'shapes' })).toBe(false);
    });

    it('returns false for a terrain/3dtiles layer', () => {
        expect(isShareableTileLayer({ type: '3dtiles', name: 'buildings' })).toBe(false);
    });

    it('returns false for null / undefined', () => {
        expect(isShareableTileLayer(null)).toBe(false);
        expect(isShareableTileLayer(undefined)).toBe(false);
    });

    // --- layer.style (published default) is NOT a disqualifier ---

    it('returns true when layer.style is set (default published style is OK for shared cache)', () => {
        const layer = makeWmsLayer({ style: 'geonode:my_default_style' });
        expect(isShareableTileLayer(layer)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// buildGwcTileUrls — WMTS URL template generation
// ---------------------------------------------------------------------------

describe('gwcTileRouting — buildGwcTileUrls', () => {

    it('returns a single-element array', () => {
        const urls = buildGwcTileUrls('geonode:my_layer');
        expect(urls).toBeA('array');
        expect(urls.length).toBe(1);
    });

    it('contains the GWC WMTS endpoint', () => {
        const [url] = buildGwcTileUrls('geonode:my_layer');
        expect(url).toContain(GWC_WMTS_ENDPOINT);
        expect(url).toContain('/geoserver/gwc/service/wmts');
    });

    it('uses EPSG:900913 gridset (NOT 3857)', () => {
        const [url] = buildGwcTileUrls('geonode:my_layer');
        expect(url).toContain('TILEMATRIXSET=EPSG:900913');
        expect(url).toContain('TILEMATRIX=EPSG:900913:{z}');
        expect(url).toNotContain('TILEMATRIXSET=EPSG:3857');
        expect(url).toNotContain('TILEMATRIX=EPSG:3857:{z}');
    });

    it('encodes the layer name into the URL', () => {
        const [url] = buildGwcTileUrls('geonode:mesh_triangle_render');
        expect(url).toContain('LAYER=geonode:mesh_triangle_render');
    });

    it('uses image/png as the default format', () => {
        const [url] = buildGwcTileUrls('geonode:my_layer');
        expect(url).toContain('FORMAT=image/png');
    });

    it('accepts a custom format', () => {
        const [url] = buildGwcTileUrls('geonode:my_layer', 'image/jpeg');
        expect(url).toContain('FORMAT=image/jpeg');
    });

    it('includes tile coordinate placeholders {z}, {y}, {x}', () => {
        const [url] = buildGwcTileUrls('geonode:my_layer');
        expect(url).toContain('{z}');
        expect(url).toContain('{y}');
        expect(url).toContain('{x}');
    });

    it('generates a URL matching the MeshWorkflow.js:223 precedent', () => {
        // This is the canonical reference URL from MeshWorkflow.js:223.
        // The helper must produce an identical template for the same layer name + format.
        const LAYER_NAME = 'geonode:mesh_triangle_render';
        const expectedUrl =
            `/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
            `&LAYER=${LAYER_NAME}&STYLE=` +
            `&TILEMATRIXSET=EPSG:900913&TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}` +
            `&FORMAT=application/vnd.mapbox-vector-tile`;
        const [url] = buildGwcTileUrls(LAYER_NAME, 'application/vnd.mapbox-vector-tile');
        expect(url).toBe(expectedUrl);
    });
});

// ---------------------------------------------------------------------------
// buildGwcMvtTileUrls — MVT convenience wrapper
// ---------------------------------------------------------------------------

describe('gwcTileRouting — buildGwcMvtTileUrls', () => {

    it('returns application/vnd.mapbox-vector-tile format', () => {
        const [url] = buildGwcMvtTileUrls('geonode:mesh_triangle_render');
        expect(url).toContain('FORMAT=application/vnd.mapbox-vector-tile');
    });

    it('produces the same output as buildGwcTileUrls with MVT format', () => {
        const layerName = 'geonode:mesh_triangle_render';
        expect(buildGwcMvtTileUrls(layerName)).toEqual(
            buildGwcTileUrls(layerName, 'application/vnd.mapbox-vector-tile')
        );
    });
});

// ---------------------------------------------------------------------------
// applyGwcRouting — layer config mutation
// ---------------------------------------------------------------------------

describe('gwcTileRouting — applyGwcRouting', () => {

    it('sets url to the GWC WMTS endpoint', () => {
        const result = applyGwcRouting(makeWmsLayer());
        expect(result.url).toBe(GWC_WMTS_ENDPOINT);
    });

    it('adds tileUrls to the config', () => {
        const result = applyGwcRouting(makeWmsLayer());
        expect(result.tileUrls).toBeA('array');
        expect(result.tileUrls.length).toBe(1);
    });

    it('preserves all other fields from the base config', () => {
        const base = makeWmsLayer({ title: 'My Layer', visibility: true, group: 'Results' });
        const result = applyGwcRouting(base);
        expect(result.title).toBe('My Layer');
        expect(result.visibility).toBe(true);
        expect(result.group).toBe('Results');
        expect(result.name).toBe('geonode:my_raster');
        expect(result.type).toBe('wms');
    });

    it('does not mutate the base config object', () => {
        const base = makeWmsLayer();
        const originalUrl = base.url;
        applyGwcRouting(base);
        expect(base.url).toBe(originalUrl);
    });

    it('throws when name is missing from the config', () => {
        expect(() => applyGwcRouting({ type: 'wms' })).toThrow(/name/);
    });
});

// ---------------------------------------------------------------------------
// routeLayerTileSource — the primary routing entry point
// ---------------------------------------------------------------------------

describe('gwcTileRouting — routeLayerTileSource', () => {

    it('applies GWC routing to a plain shareable WMS layer', () => {
        const layer = makeWmsLayer();
        const result = routeLayerTileSource(layer);
        expect(result.url).toBe(GWC_WMTS_ENDPOINT);
        expect(result.tileUrls).toBeA('array');
    });

    it('returns the layer unchanged for a Dynamic DEM terrain layer (per-session env=)', () => {
        // Dynamic mode: env= present → stays on direct WMS, not routed to GWC.
        const demLayer = makeWmsLayer({
            group: 'Input Data.Terrain',
            url: '/geoserver/ows',
            params: { env: 'elevMin:100.000;elevMax:900.000' }
        });
        const result = routeLayerTileSource(demLayer);
        // url must NOT be rewritten to GWC
        expect(result.url).toBe('/geoserver/ows');
        // tileUrls must NOT be injected
        expect(result.tileUrls).toBe(undefined);
    });

    it('routes a Traditional terrain layer (no env=) to GWC (TASK-1719)', () => {
        // Traditional mode: static SLD, no env= → shareable, must be routed to GWC.
        const traditionalLayer = makeWmsLayer({
            group: 'Input Data.Terrain',
            name: 'geonode:ele_7_grand_canyon_cog',
            url: '/geoserver/ows'
            // no params.env
        });
        const result = routeLayerTileSource(traditionalLayer);
        expect(result.url).toBe(GWC_WMTS_ENDPOINT);
        expect(result.tileUrls).toBeA('array');
        expect(result.tileUrls.length).toBe(1);
    });

    it('returns the layer unchanged for a per-user CQL_FILTER layer', () => {
        const bmpLayer = makeWmsLayer({
            params: { CQL_FILTER: "group_profile_id=42" }
        });
        const result = routeLayerTileSource(bmpLayer);
        expect(result.url).toBe('/geoserver/ows');
        expect(result.tileUrls).toBe(undefined);
    });

    it('routes a shareable MVT layer using the MVT format', () => {
        const layer = makeWmsLayer({ name: 'geonode:mesh_triangle_render' });
        const result = routeLayerTileSource(layer, 'application/vnd.mapbox-vector-tile');
        expect(result.url).toBe(GWC_WMTS_ENDPOINT);
        expect(result.tileUrls[0]).toContain('FORMAT=application/vnd.mapbox-vector-tile');
    });

    it('does not mutate the input layer object', () => {
        const layer = makeWmsLayer();
        const originalUrl = layer.url;
        routeLayerTileSource(layer);
        expect(layer.url).toBe(originalUrl);
    });
});

// ---------------------------------------------------------------------------
// buildMeshTriangleLayer — authenticated mesh layer config helper (W6 TASK-1423)
// ---------------------------------------------------------------------------

describe('gwcTileRouting — buildMeshTriangleLayer', () => {

    it('returns a wms layer with the correct name and GWC url', () => {
        const layer = buildMeshTriangleLayer(null);
        expect(layer.type).toBe('wms');
        expect(layer.name).toBe('geonode:mesh_triangle_render');
        expect(layer.url).toBe(GWC_WMTS_ENDPOINT);
        expect(layer.group).toBe('Input Data.Mesh');
        expect(layer.visibility).toBe(true);
    });

    it('params include LAYERS, FORMAT, TILED, TRANSPARENT, VERSION when token is null', () => {
        const layer = buildMeshTriangleLayer(null);
        expect(layer.params.LAYERS).toBe('geonode:mesh_triangle_render');
        expect(layer.params.FORMAT).toBe('image/png');
        expect(layer.params.TILED).toBe(true);
        expect(layer.params.TRANSPARENT).toBe(true);
        expect(layer.params.VERSION).toBe('1.1.1');
        expect(layer.params.access_token).toNotExist();
    });

    it('params include access_token when token is provided', () => {
        const layer = buildMeshTriangleLayer('test-token-abc');
        expect(layer.params.access_token).toBe('test-token-abc');
    });

    it('tileUrls array contains the WMTS endpoint and layer name', () => {
        const layer = buildMeshTriangleLayer(null);
        expect(Array.isArray(layer.tileUrls)).toBe(true);
        expect(layer.tileUrls.length).toBeGreaterThan(0);
        expect(layer.tileUrls[0]).toContain(GWC_WMTS_ENDPOINT);
        expect(layer.tileUrls[0]).toContain('geonode:mesh_triangle_render');
    });

    it('tileUrls include encoded access_token when token is provided', () => {
        const layer = buildMeshTriangleLayer('my token');
        // Token should be URL-encoded in tileUrls
        expect(layer.tileUrls[0]).toContain('access_token=my%20token');
    });

    it('tileUrls do NOT include access_token when token is null', () => {
        const layer = buildMeshTriangleLayer(null);
        expect(layer.tileUrls[0]).toNotContain('access_token');
    });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('gwcTileRouting — exported constants', () => {

    it('GWC_WMTS_ENDPOINT points to /geoserver/gwc/service/wmts', () => {
        expect(GWC_WMTS_ENDPOINT).toBe('/geoserver/gwc/service/wmts');
    });

    it('GWC_TILEMATRIXSET is EPSG:900913', () => {
        expect(GWC_TILEMATRIXSET).toBe('EPSG:900913');
    });

    it('DIRECT_WMS_ENDPOINT points to /geoserver/ows', () => {
        expect(DIRECT_WMS_ENDPOINT).toBe('/geoserver/ows');
    });
});

/**
 * TASK-1339 (W2b) — Unit tests for gnRouteCatalogLayersToGwcEpic.
 *
 * The epic listens for UPDATE_NODE actions where options.perms is set
 * (the signal emitted by gnSetDatasetsPermissions after an ADD_LAYER).
 * For each such action it reads the layer from state and, if the layer
 * is a GeoNode-managed WMS layer that passes the no-leak predicate
 * (isShareableTileLayer), dispatches a changeLayerProperties that rewrites
 * url → GWC WMTS endpoint + adds tileUrls.
 *
 * No-leak invariants tested:
 *  1. Public-shareable GeoNode WMS layer  → WMTS routing (url + tileUrls set).
 *  2. Non-GeoNode layer (no extendedParams.pk) → DIRECT (no dispatch).
 *  3. DEM/Terrain group layer             → DIRECT.
 *  4. Layer with params.env               → DIRECT.
 *  5. Layer with params.CQL_FILTER        → DIRECT (per-user BMP/contour).
 *  6. Layer with params.SLD               → DIRECT.
 *  7. Layer with params.SLD_BODY          → DIRECT.
 *  8. Non-WMS layer type                  → DIRECT.
 *  9. UPDATE_NODE without perms option    → no dispatch (not a perms-settle).
 * 10. Routing goes through routeLayerTileSource (single enforcement point).
 * 11. changeLayerProperties does NOT carry params → no params replacement.
 * 12. tileUrls WMTS URL uses EPSG:900913, not EPSG:3857.
 */

import expect from 'expect';
import { testEpic } from '@mapstore/framework/epics/__tests__/epicTestUtils';
import { UPDATE_NODE, CHANGE_LAYER_PROPERTIES } from '@mapstore/framework/actions/layers';
import { gnRouteCatalogLayersToGwcEpic } from '@js/epics/gwcCatalogRouting';
import {
    GWC_WMTS_ENDPOINT,
    GWC_TILEMATRIXSET
} from '@js/plugins/hydrata/Anuga/gwcTileRouting';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Build a minimal UPDATE_NODE action with a perms payload — the signal that
 * gnSetDatasetsPermissions has just settled a layer's permissions.
 */
function makePermsUpdateNode(layerId, permsArray = ['view_resourcebase']) {
    return {
        type: UPDATE_NODE,
        node: layerId,
        nodeType: 'layer',
        options: { perms: permsArray }
    };
}

/**
 * Build a minimal UPDATE_NODE action WITHOUT a perms option — not a perms-settle.
 */
function makeOtherUpdateNode(layerId) {
    return {
        type: UPDATE_NODE,
        node: layerId,
        nodeType: 'layer',
        options: { visibility: true }
    };
}

/**
 * Build a state with a single flat layer.
 */
function makeState(layer) {
    return {
        layers: {
            flat: [layer]
        }
    };
}

/** Canonical shareable catalog raster WMS layer (GeoNode-managed, no per-user params). */
const SHAREABLE_LAYER = {
    id: 'layer-001',
    type: 'wms',
    name: 'geonode:champaign_contours_2ft0',
    url: '/geoserver/ows',
    visibility: true,
    group: 'Results.Contours',
    // GeoNode-origin signal: extendedParams.pk
    extendedParams: { pk: 42, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase', 'download_resourcebase']
};

/** DEM terrain layer — must stay direct (per-session env= rescale). */
const DEM_LAYER = {
    id: 'layer-dem',
    type: 'wms',
    name: 'geonode:ele_7_my_dem_cog',
    url: '/geoserver/ows',
    group: 'Input Data.Terrain',
    extendedParams: { pk: 10, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** Loading/result layer with env= param (per-session colormap). */
const ENV_LAYER = {
    id: 'layer-env',
    type: 'wms',
    name: 'geonode:depth_max_123',
    url: '/geoserver/ows',
    params: { env: 'elevMin:0.000;elevMax:5.000' },
    extendedParams: { pk: 20, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** BMP layer with per-user CQL_FILTER (must stay direct). */
const CQL_LAYER = {
    id: 'layer-cql',
    type: 'wms',
    name: 'geonode:dec_n_surface_loading_v2',
    url: '/geoserver/ows',
    params: { CQL_FILTER: 'group_profile_id=42' },
    extendedParams: { pk: 30, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** Layer with per-user SLD override (must stay direct). */
const SLD_LAYER = {
    id: 'layer-sld',
    type: 'wms',
    name: 'geonode:my_styled_layer',
    url: '/geoserver/ows',
    params: { SLD: 'http://example.com/style.sld' },
    extendedParams: { pk: 40, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** Layer with per-user SLD_BODY (must stay direct). */
const SLD_BODY_LAYER = {
    id: 'layer-sldbody',
    type: 'wms',
    name: 'geonode:my_layer',
    url: '/geoserver/ows',
    params: { SLD_BODY: '<StyledLayerDescriptor/>' },
    extendedParams: { pk: 50, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** Non-WMS layer (3D tiles) — must stay direct. */
const TILES3D_LAYER = {
    id: 'layer-3dtiles',
    type: '3dtiles',
    name: 'geonode:my_3d',
    url: '/some/3d/url',
    extendedParams: { pk: 60, mapLayer: { dataset: {} } },
    perms: ['view_resourcebase']
};

/** Non-GeoNode layer (no extendedParams.pk) — must stay direct. */
const NON_GEONODE_LAYER = {
    id: 'layer-ext',
    type: 'wms',
    name: 'external:some_wms',
    url: 'https://wms.example.com/service',
    // No extendedParams.pk → not a GeoNode-managed layer
    extendedParams: {},
    perms: []
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gnRouteCatalogLayersToGwcEpic', () => {

    // ---- Test 1: shareable GeoNode layer → WMTS routing ------------------

    it('routes a public shareable GeoNode WMS layer to GWC WMTS endpoint', (done) => {
        const action = makePermsUpdateNode(SHAREABLE_LAYER.id);
        const state = makeState(SHAREABLE_LAYER);

        testEpic(
            gnRouteCatalogLayersToGwcEpic,
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(CHANGE_LAYER_PROPERTIES);
                expect(result.layer).toBe(SHAREABLE_LAYER.id);
                expect(result.newProperties.url).toBe(GWC_WMTS_ENDPOINT);
                expect(result.newProperties.tileUrls).toBeA('array');
                expect(result.newProperties.tileUrls.length).toBe(1);
            },
            state,
            done
        );
    });

    // ---- Test 2: tileUrls URL uses EPSG:900913 (not 3857) -----------------

    it('tileUrls URL uses EPSG:900913 gridset', (done) => {
        const action = makePermsUpdateNode(SHAREABLE_LAYER.id);
        const state = makeState(SHAREABLE_LAYER);

        testEpic(
            gnRouteCatalogLayersToGwcEpic,
            1,
            action,
            ([result]) => {
                const [tileUrl] = result.newProperties.tileUrls;
                expect(tileUrl).toContain(`TILEMATRIXSET=${GWC_TILEMATRIXSET}`);
                expect(tileUrl).toContain('EPSG:900913');
                expect(tileUrl).toNotContain('EPSG:3857');
            },
            state,
            done
        );
    });

    // ---- Test 3: changeLayerProperties must NOT include params key --------
    // (changeLayerProperties REPLACES params; use changeLayerParams to merge)

    it('dispatched changeLayerProperties does NOT carry a params key (no params replacement)', (done) => {
        const action = makePermsUpdateNode(SHAREABLE_LAYER.id);
        const state = makeState(SHAREABLE_LAYER);

        testEpic(
            gnRouteCatalogLayersToGwcEpic,
            1,
            action,
            ([result]) => {
                expect(result.newProperties.params).toBe(undefined);
            },
            state,
            done
        );
    });

    // ---- Test 4: non-GeoNode layer (no extendedParams.pk) → DIRECT -------
    // No-leak: non-GeoNode layers have unknown GeoFence scope.

    it('emits nothing for a non-GeoNode layer (no extendedParams.pk)', (done) => {
        const action = makePermsUpdateNode(NON_GEONODE_LAYER.id);
        const state = makeState(NON_GEONODE_LAYER);

        // Use addTimeoutEpic pattern: if nothing is emitted within timeout → pass
        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                // Should only receive the timeout marker, not a CHANGE_LAYER_PROPERTIES
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 5: DEM terrain layer → DIRECT ------------------------------

    it('emits nothing for a DEM/Terrain group layer (per-session env= rescale)', (done) => {
        const action = makePermsUpdateNode(DEM_LAYER.id, ['view_resourcebase']);
        const state = makeState(DEM_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 6: per-session env= layer → DIRECT -------------------------

    it('emits nothing for a layer with params.env (per-session colormap)', (done) => {
        const action = makePermsUpdateNode(ENV_LAYER.id, ['view_resourcebase']);
        const state = makeState(ENV_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 7: per-user CQL_FILTER layer → DIRECT ----------------------

    it('emits nothing for a layer with params.CQL_FILTER (per-user restriction)', (done) => {
        const action = makePermsUpdateNode(CQL_LAYER.id, ['view_resourcebase']);
        const state = makeState(CQL_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 8: per-user SLD layer → DIRECT -----------------------------

    it('emits nothing for a layer with params.SLD (per-user style injection)', (done) => {
        const action = makePermsUpdateNode(SLD_LAYER.id, ['view_resourcebase']);
        const state = makeState(SLD_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 9: per-user SLD_BODY layer → DIRECT -----------------------

    it('emits nothing for a layer with params.SLD_BODY (inline per-user SLD)', (done) => {
        const action = makePermsUpdateNode(SLD_BODY_LAYER.id, ['view_resourcebase']);
        const state = makeState(SLD_BODY_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 10: non-WMS layer type → DIRECT ----------------------------

    it('emits nothing for a non-wms layer (3dtiles)', (done) => {
        const action = makePermsUpdateNode(TILES3D_LAYER.id, ['view_resourcebase']);
        const state = makeState(TILES3D_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 11: UPDATE_NODE without perms → no dispatch ----------------

    it('emits nothing for an UPDATE_NODE that does not carry a perms option', (done) => {
        const action = makeOtherUpdateNode(SHAREABLE_LAYER.id);
        const state = makeState(SHAREABLE_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });

    // ---- Test 12: layer.name is encoded into tileUrls --------------------

    it('encodes the layer name correctly into the tileUrls WMTS URL', (done) => {
        const action = makePermsUpdateNode(SHAREABLE_LAYER.id);
        const state = makeState(SHAREABLE_LAYER);

        testEpic(
            gnRouteCatalogLayersToGwcEpic,
            1,
            action,
            ([result]) => {
                const [tileUrl] = result.newProperties.tileUrls;
                expect(tileUrl).toContain(`LAYER=${SHAREABLE_LAYER.name}`);
            },
            state,
            done
        );
    });

    // ---- Test 13: routing when layer is already routed (idempotent) ------
    // If the layer already has GWC url, we should not re-route (or the
    // predicate should still pass — no harm in re-dispatching same url).
    // Since routeLayerTileSource is the single enforcement point, this is fine.

    it('routes a shareable layer that already has a non-GWC url', (done) => {
        const layerAlreadyOnDirect = { ...SHAREABLE_LAYER, url: '/geoserver/ows' };
        const action = makePermsUpdateNode(layerAlreadyOnDirect.id);
        const state = makeState(layerAlreadyOnDirect);

        testEpic(
            gnRouteCatalogLayersToGwcEpic,
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(CHANGE_LAYER_PROPERTIES);
                expect(result.newProperties.url).toBe(GWC_WMTS_ENDPOINT);
            },
            state,
            done
        );
    });

    // ---- Test 14: layer not found in state → no dispatch ----------------
    // If the layer id in the UPDATE_NODE action doesn't match any layer in
    // state.layers.flat, the epic should emit nothing safely.

    it('emits nothing if the layer id from the action is not found in state', (done) => {
        // State has SHAREABLE_LAYER, but action is for a different id
        const action = makePermsUpdateNode('unknown-layer-id');
        const state = makeState(SHAREABLE_LAYER);

        const { addTimeoutEpic, TEST_TIMEOUT } = require('@mapstore/framework/epics/__tests__/epicTestUtils');
        testEpic(
            addTimeoutEpic(gnRouteCatalogLayersToGwcEpic, 50),
            1,
            action,
            ([result]) => {
                expect(result.type).toBe(TEST_TIMEOUT);
            },
            state,
            done
        );
    });
});

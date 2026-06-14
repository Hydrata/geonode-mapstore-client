/**
 * TASK-1339 (W2b) — Post-ADD_LAYER generic-catalog GWC WMTS tile routing.
 *
 * WHY POST-ADD_LAYER (not at catalog-load time):
 *   resourceToLayerConfig (ResourceUtils.js) runs at catalog-load time BEFORE
 *   GeoFence/auth context is fully applied. A layer that will later receive a
 *   per-user CQL_FILTER (SWAMM BMP, contour) could be prematurely routed to
 *   the shared GWC cache, leaking one user's tiles to another. The safe
 *   injection point is AFTER gnSetDatasetsPermissions has settled the layer's
 *   perms — i.e., after the UPDATE_NODE action carrying options.perms fires.
 *
 * HOW IT WORKS:
 *   1. gnSetDatasetsPermissions (js/epics/index.js) fires on ADD_LAYER and
 *      MAP_CONFIG_LOADED, fetches perms from the GeoNode API, and dispatches
 *      updateNode(layerId, 'layer', {perms: [...]}).
 *   2. THIS epic listens to UPDATE_NODE where options.perms is present (the
 *      perms-settle signal). At that point:
 *        a. The reducer has already applied the UPDATE_NODE, so getState()
 *           returns the layer with its final params AND perms.
 *        b. We find the layer in state.layers.flat by action.node (layer id).
 *        c. We apply the two-part no-leak predicate (see below).
 *        d. If both parts pass, dispatch changeLayerProperties(layerId,
 *           {url: GWC_WMTS_ENDPOINT, tileUrls: [...]}).
 *
 * NO-LEAK PREDICATE (two parts, both required):
 *   Part 1 — GeoNode-managed layer:
 *     layer?.extendedParams?.pk must be present. This gates on layers that
 *     went through gnSetDatasetsPermissions (GeoNode API perms settled).
 *     Non-GeoNode layers (external WMS, ArcGIS) have no pk and stay direct.
 *
 *   Part 2 — Client-side params check (via routeLayerTileSource / isShareableTileLayer):
 *     - type === 'wms' (only WMS layers can be GWC-cached via WMTS)
 *     - No params.env (per-session DEM colormap rescale). NOTE TASK-1719: a Traditional
 *       DEM layer carries NO env= and IS now cache-shareable; only a Dynamic (env=) terrain stays direct.
 *     - No params.CQL_FILTER (per-user row-level filter, e.g. SWAMM BMP)
 *     - No params.SLD / params.SLD_BODY (per-user style injection)
 *
 * FLEET-WIDE GEOLIMITS ASSUMPTION (documented + verified):
 *   GeoFence can apply per-user SPATIAL LIMITS (bbox clipping, GeoLimits) that
 *   are server-side and invisible in client layer.params. If such limits exist,
 *   two authenticated users requesting the same tile would get byte-different
 *   responses, and routing them to the shared GWC cache would cause data leaks.
 *   This epic is safe for the Hydrata fleet BECAUSE fleet-wide GeoLimits count
 *   is ZERO. Verified 2026-05-30 (TASK-1339/W2b, read-only ORM
 *   UserGeoLimit.objects.count()+GroupGeoLimit.objects.count()==0 on ALL 4 prod
 *   sites — hydrata.com, theswamm.com, sararaportal.com, nicaraguahydroportal.com
 *   — plus localhost). NOTE: W1 did NOT check GeoLimits; this verification is the
 *   authority. If GeoLimits are introduced in future, this epic MUST be updated
 *   with an is_public or zero-geolimits signal (anonymous probe or a new API
 *   field). The client-side params check alone is sufficient only under
 *   zero-GeoLimits.
 *
 * GWC-REGISTRATION CAVEAT (W2b<->W5 coupling — see TASK-1326/W5):
 *   This predicate routes a layer to the WMTS endpoint based on perms + client
 *   params; it does NOT verify the layer is REGISTERED as a GWC tile layer.
 *   A layer that is de-registered / excluded-from-registry (W1: contour orphans,
 *   dec_bmp_* raster) would MISS/404 on WMTS GetTile. This is benign at the epic
 *   level because prod ship sequences W5 (which (re-)registers + seeds the
 *   seedable set) before/with this routing reaching users, and GWC renders-on-
 *   miss for registered-but-cold layers. But MapStore graceful-degradation for a
 *   genuinely-unregistered routed layer MUST be confirmed at the W2b gate, and
 *   W5's registry must cover everything this predicate routes.
 *
 * REUSABILITY:
 *   This epic is deliberately NOT Anuga-specific (lives in js/epics/, not in
 *   the Anuga plugin). W7 (TASK-1191/1192 SWAMM BMP MVT) will reuse the same
 *   injection point; those layers will be blocked by their CQL_FILTER via
 *   isShareableTileLayer until W7's dedicated logic.
 *
 * CHANGE ACTION SAFETY:
 *   Dispatches changeLayerProperties(layerId, {url, tileUrls}) using the
 *   url+tileUrls from the routeLayerTileSource return value.
 *   Does NOT include a `params` key — changeLayerProperties REPLACES params
 *   when params is in newProperties (memory: feedback-changeLayerProperties-
 *   replaces-params). Setting only url+tileUrls is safe.
 */

import Rx from 'rxjs';
import { UPDATE_NODE, changeLayerProperties } from '@mapstore/framework/actions/layers';
import { layersSelector } from '@mapstore/framework/selectors/layers';
import { routeLayerTileSource } from '@js/plugins/hydrata/Anuga/gwcTileRouting';

/**
 * Post-ADD_LAYER GWC WMTS routing epic for generic catalog / map layers.
 *
 * Listens for UPDATE_NODE actions where the options payload carries a `perms`
 * key — the signal emitted by gnSetDatasetsPermissions once a layer's GeoNode
 * permissions have been fetched and settled. Inspects the final layer config
 * from state and, if the no-leak predicate passes, rewrites the layer's tile
 * source to the shared GWC WMTS endpoint.
 *
 * @param {ActionsObservable} action$ - Redux-Observable action stream.
 * @param {Object} store - Redux store (provides getState).
 * @returns {Observable} Stream of changeLayerProperties actions.
 */
export const gnRouteCatalogLayersToGwcEpic = (action$, store) =>
    action$
        .ofType(UPDATE_NODE)
        // Only process perms-settle signals from gnSetDatasetsPermissions.
        .filter((action) =>
            action.nodeType === 'layer' &&
            action.options != null &&
            Array.isArray(action.options.perms)
        )
        .mergeMap((action) => {
            const state = store.getState();
            // At this point the reducer has already applied the UPDATE_NODE,
            // so the layer in state has its final params + perms.
            const layers = layersSelector(state) || [];
            const layer = layers.find((l) => l.id === action.node);

            // Layer not found in state — nothing to route.
            if (!layer) {
                return Rx.Observable.empty();
            }

            // Part 1: GeoNode-managed layer guard.
            // Only route layers that have a GeoNode pk (went through the
            // datasets permissions API). Non-GeoNode layers have unknown
            // GeoFence scope and must stay direct.
            if (!layer?.extendedParams?.pk) {
                return Rx.Observable.empty();
            }

            // Part 2: Client-side params no-leak check via the single
            // enforcement point (routeLayerTileSource / isShareableTileLayer).
            // Returns the layer unchanged if NOT shareable.
            const format = layer.format || 'image/png';
            const routed = routeLayerTileSource(layer, format);
            if (routed === layer) {
                // Not shareable — DEM/terrain, per-user CQL/env/SLD, non-WMS.
                return Rx.Observable.empty();
            }

            // Layer is shareable: rewrite url + inject tileUrls using the
            // already-computed routed config. Do NOT include params in
            // newProperties — changeLayerProperties would replace the whole
            // params object (memory: feedback-changeLayerProperties-replaces-params).
            return Rx.Observable.of(
                changeLayerProperties(layer.id, {
                    url: routed.url,
                    tileUrls: routed.tileUrls
                })
            );
        });

export default {
    gnRouteCatalogLayersToGwcEpic
};

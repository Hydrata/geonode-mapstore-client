/**
 * TASK-96 — Live DEM ramp rescale on map pan/zoom via GeoServer env() WMS.
 *
 * On each debounced CHANGE_MAP_VIEW, for every dynamic_dem terrain layer
 * currently visible in the map, this epic:
 *   1. Reads the current map bbox from the action payload.
 *   2. GETs the bbox-stats endpoint for the matching terrain resource (which
 *      returns windowed min/max + a ready-to-use env_params mapping).
 *   3. Dispatches changeLayerProperties with the WMS `env=` parameter set to
 *      the full 11-key GeoServer env() string. The SLD's
 *      `<ColorMapEntry quantity="${env('elevMin',…)}"/>` substitutions read
 *      directly from the request's `env=` parameter, so the colour ramp
 *      rescales to the visible window on every pan/zoom.
 *
 * VIEWPARAMS vs env (TASK-99 root-cause, verified on GeoServer 2.27.x):
 * GeoServer does NOT auto-map `VIEWPARAMS=` to `env()`. VIEWPARAMS is a
 * SQL-view substitution mechanism only; raster ColorMap `env()` lookups
 * read the dedicated `env=` request parameter. Empirical proof: a GetMap
 * with `VIEWPARAMS=elevMin:300;…;elevMax:500` returns a byte-identical
 * PNG to a GetMap with neither parameter (md5 matches the SLD-default
 * 770-1020 render), while `env=elevMin:300;…;elevMax:500` returns a
 * dramatically different PNG. So we forward env directly.
 *
 * `_v_` bump: `env` is NOT in MapStore2's WMSLayer.js refresh-trigger list
 * (`web/client/components/map/openlayers/plugins/WMSLayer.js:250` includes
 * VIEWPARAMS, SLD, CQL_FILTER, _v_ etc.; env is not). Without bumping `_v_`
 * the OL ImageWMS source ignores the new env values and serves the cached
 * image. Patching MapStore2 to add `env` to the trigger list would be a
 * cross-cutting change to a shared submodule for a Hydrata-only feature; a
 * monotonic `_v_` bump from this epic is the local fix.
 *
 * Contract: ALL 11 env keys must be forwarded together — GeoServer rejects
 * partial sets with "Wrong values defined". The BE computes the full set in
 * TerrainBboxStatsView and returns it as env_params, so the FE only
 * forwards it verbatim.
 *
 * Untiled rendering: DEM layers must be served via ImageWMS (singleTile:true)
 * so the env-bearing GetMap is a single fresh request per pan/zoom rather
 * than a grid of GWC tiles (which would multiply cardinality and cost).
 * Layers are stamped at addLayer time via the terrain-add sequence
 * (pollingEpics buildTerrainAddSequence stamps singleTile from the
 * mapstore_layer config); this epic also stamps singleTile:true on first
 * encounter for any layer loaded from the saved map blob before the config
 * was updated.
 *
 * AbortController: each new CHANGE_MAP_VIEW fires switchMap, cancelling any
 * in-flight stats requests for the previous pan — the axios cancel-token
 * pattern mirrors terrainBboxEpic.js.
 *
 * No GWC env parameter filter is registered — we rely on untiled
 * (singleTile:true) to bypass GWC entirely for DEM layers, avoiding the
 * cache explosion that would result from per-pixel env variation.
 */
import Rx from 'rxjs';
import { changeLayerParams, changeLayerProperties } from '../../../../../MapStore2/web/client/actions/layers';
import { CHANGE_MAP_VIEW } from '../../../../../MapStore2/web/client/actions/map';
import { reprojectBbox } from '../../../../../MapStore2/web/client/utils/CoordinatesUtils';
import { getProjectId } from '../selectorsAnuga';
import * as anugaApi from '../api/anugaApi';

/**
 * Convert env_params dict to a GeoServer env= string.
 * Format: "key1:val1;key2:val2;..." (semicolon-separated key:value pairs).
 * Values are rounded to 3 decimal places to keep query strings readable.
 *
 * This format also happens to be the VIEWPARAMS format — historically this
 * helper was named buildViewparams. The env= and VIEWPARAMS= encoding
 * grammars are identical (both are semicolon-joined key:value); only the
 * GeoServer-side semantics differ (see the file-header comment for why
 * env is required for raster ColorMap substitution).
 *
 * @param {Object} envParams - {elevMin, elevOne, ..., elevMax}
 * @returns {string} - GeoServer env= string
 */
export function buildEnvString(envParams) {
    return Object.entries(envParams)
        .map(([k, v]) => `${k}:${parseFloat(v).toFixed(3)}`)
        .join(';');
}

// Back-compat alias: the original TASK-96 helper was named buildViewparams.
// Keeping the alias so any external test/import that landed on origin/5.x
// keeps working through the renaming. New callers should use buildEnvString.
export const buildViewparams = buildEnvString;

/**
 * Extract a WGS84 bbox [minLon, minLat, maxLon, maxLat] from a CHANGE_MAP_VIEW
 * action.  The action.bbox.bounds object carries coordinates in bbox.crs (often
 * EPSG:3857 for Web Mercator maps).  This function reprojects them to EPSG:4326
 * before returning, since the bbox-stats endpoint requires WGS84 degrees.
 * Returns null when bbox is absent, crs is unknown, or reprojection fails.
 *
 * @param {Object} action - CHANGE_MAP_VIEW action
 * @returns {number[]|null}
 */
export function extractWgs84Bbox(action) {
    const bbox = action.bbox;
    if (!bbox || !bbox.bounds) return null;
    const { minx, miny, maxx, maxy } = bbox.bounds;
    if ([minx, miny, maxx, maxy].some((v) => v === undefined || v === null || isNaN(v))) {
        return null;
    }
    const sourceCrs = bbox.crs || 'EPSG:4326';
    if (sourceCrs === 'EPSG:4326') {
        return [minx, miny, maxx, maxy];
    }
    const reprojected = reprojectBbox([minx, miny, maxx, maxy], sourceCrs, 'EPSG:4326');
    if (!reprojected || reprojected.some((v) => v === null || v === undefined || isNaN(v))) {
        return null;
    }
    return reprojected;
}

/**
 * Find all dynamic-DEM layers in the map that have a corresponding terrain
 * resource.  Returns an array of {layer, terrain} pairs where:
 *   layer   — entry from state.layers.flat (type='wms', group='Input Data.Terrain')
 *   terrain — entry from state.anuga.resources.terrain with rendering_type='dynamic_dem'
 *
 * Matching is by gn_layer_name (the bare GeoServer layer name stored on the
 * Terrain resource row) vs. the layer name in state.layers.flat.
 *
 * @param {Object} state - Redux state
 * @returns {Array<{layer, terrain}>}
 */
export function findDynamicDemPairs(state) {
    const flatLayers = state?.layers?.flat || [];
    const terrains = state?.anuga?.resources?.terrain || [];

    // TASK-1720 (W3): Exclude non-dynamic terrains from the dynamic rescale
    // loop. Traditional terrains use a static literal-quantity colour-relief SLD
    // (published at terrain-create time) and are served from GWC WMTS tile cache —
    // they must NOT carry env= params or singleTile:true.
    // Absent/undefined styling_mode is treated as 'traditional' (excluded), matching
    // the W1 BE default, buildTerrainAddSequence (pollingEpics), and the toggle UI.
    const dynamicTerrains = terrains.filter(
        (t) => t?.rendering_type === 'dynamic_dem'
            && t?.gn_layer_name
            && t?.styling_mode === 'dynamic'
    );
    if (!dynamicTerrains.length) return [];

    const pairs = [];
    for (const terrain of dynamicTerrains) {
        // TASK-1721 (W4 review): exclude the contour overlay layer (<name>__contours)
        // — it shares the DEM name but is not a DEM coverage; stamping env=/singleTile
        // on it would break GWC cacheability and corrupt the overlay.
        const layer = flatLayers.find(
            (l) => l?.type === 'wms'
                && l?.group === 'Input Data.Terrain'
                && l?.name
                && !l?.id?.endsWith('__contours')
                && (l.name === terrain.gn_layer_name
                    || l.name === `geonode:${terrain.gn_layer_name}`)
        );
        if (layer) {
            pairs.push({ layer, terrain });
        }
    }
    return pairs;
}

/**
 * Epic: debounced DEM ramp rescale on map pan/zoom.
 *
 * Listens for CHANGE_MAP_VIEW, debounces by 300 ms, then for each
 * dynamic-DEM layer fetches the windowed bbox-stats and dispatches a
 * VIEWPARAMS param update via changeLayerProperties.
 *
 * Uses switchMap so in-flight requests are cancelled on rapid pans — only
 * the most recent pan's requests complete.
 */
export const demRescaleOnMoveEndEpic = (action$, store) =>
    action$.ofType(CHANGE_MAP_VIEW)
        .debounceTime(300)
        .switchMap((action) => {
            const state = store.getState();
            const projectId = getProjectId(state);
            if (!projectId) return Rx.Observable.empty();

            const bbox = extractWgs84Bbox(action);
            if (!bbox) return Rx.Observable.empty();

            const pairs = findDynamicDemPairs(state);
            if (!pairs.length) return Rx.Observable.empty();

            // Stamp singleTile:true on any DEM layer not yet configured untiled.
            // This must fire before the VIEWPARAMS update so the layer is already
            // in ImageWMS mode when the params change triggers a refresh.
            const singleTileStamps = pairs
                .filter(({ layer }) => layer.singleTile !== true)
                .map(({ layer }) =>
                    Rx.Observable.of(changeLayerProperties(layer.id, { singleTile: true }))
                );

            // Fan out one stats request per dynamic-DEM layer. switchMap cancels
            // all of them together if another CHANGE_MAP_VIEW fires before they
            // all complete.
            const statsRequests = pairs.map(({ layer, terrain }) =>
                Rx.Observable
                    .from(anugaApi.getTerrainBboxStats(projectId, terrain.id, bbox))
                    .mergeMap((response) => {
                        const envParams = response?.data?.env_params;
                        if (!envParams || Object.keys(envParams).length !== 11) {
                            // Unexpected shape — skip silently (no partial env).
                            return Rx.Observable.empty();
                        }
                        const envString = buildEnvString(envParams);
                        // `env=` carries the ColorMap substitution; `_v_` bump
                        // forces MapStore's WMSLayer to recognise the params
                        // change as a refresh trigger (env is not in its
                        // built-in trigger list). Both must be set together —
                        // see file-header for the empirical proof.
                        //
                        // Use changeLayerParams (not changeLayerProperties)
                        // so layer.params is MERGED, not replaced. The
                        // CHANGE_LAYER_PROPERTIES reducer treats
                        // newProperties.params as a top-level field and
                        // overwrites layer.params; CHANGE_LAYER_PARAMS
                        // takes the merge branch
                        // (MapStore2/web/client/reducers/layers.js#149).
                        return Rx.Observable.of(
                            changeLayerParams(layer.id, { env: envString, _v_: Date.now() })
                        );
                    })
                    .catch((err) => {
                        // Network error or bbox outside raster — skip, but warn so
                        // future failures are visible in the browser console.
                        // eslint-disable-next-line no-console
                        console.warn('[demRescaleEpic] bbox-stats request failed:', err && (err.message || err));
                        return Rx.Observable.empty();
                    })
            );

            return Rx.Observable.merge(
                ...singleTileStamps,
                ...statsRequests
            );
        });

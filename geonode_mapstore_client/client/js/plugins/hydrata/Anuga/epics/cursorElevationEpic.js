/**
 * TASK-1855 / TASK-1856 (epic 1814 W3.2) — cursorElevationEpic
 *
 * Listens to MOUSE_MOVE (OL map pointer-move, already in WGS84 from
 * Map.jsx:mouseMoveEvent via toLonLat), debounces 250ms (trailing only),
 * reads the active/best terrain DEM via findBestDemLayer, calls the W3.1
 * endpoint GET /api/v2/anuga/projects/.../terrain/.../elevation/?lon=&lat=,
 * and dispatches SET_TERRAIN_CURSOR_ELEVATION with the float elevation.
 *
 * Clears (dispatches null) on:
 *   - MOUSE_OUT  (cursor leaves the map)
 *   - No DEM loaded (terrain slice empty or no ready-with-layer terrain)
 *   - Endpoint returns null (nodata pixel, point outside raster)
 *   - Network / 4xx / 5xx error (silent: do not flash stale values)
 *
 * Position shape from MOUSE_MOVE: {x: float (lng), y: float (lat), crs: "EPSG:4326", ...}
 * No reprojection needed — OL's mouseMoveEvent already reprojects via toLonLat.
 *
 * "Project HAS a DEM" = state.anuga.resources.terrainLoaded &&
 *   terrain.some(t => t.status === 'ready' && t.gn_layer_name)
 * This matches the existing resourcesReducer.js:97-104,153-154 contract.
 *
 * API call: mirrors demRescaleEpic.js — uses anugaApi.getTerrainElevationPoint
 * which wraps the same MapStore2 axios instance (auth cookies + interceptors).
 *
 * The epic produces PURE DATA (karma-testable with MockAdapter).
 * It does NOT register as a MapStore plugin.
 */
import Rx from 'rxjs';
import { MOUSE_MOVE, MOUSE_OUT } from '../../../../../MapStore2/web/client/actions/map';
import { getProjectId } from '../selectorsAnuga';
import { setTerrainCursorElevation } from '../actionsAnuga';
import { findBestDemLayer, bareName } from './terrainEpics';
import * as anugaApi from '../api/anugaApi';

// Debounce interval in ms — long enough to avoid a request per pixel,
// short enough to feel responsive after the user pauses.
const DEBOUNCE_MS = 250;

/**
 * Whether the current state has a DEM ready for point queries.
 *
 * Checks the resources slice rather than the map layer list so we can be
 * sure the BE has a coveragestore URL (required for the elevation endpoint).
 *
 * @param {Object} state - Redux state
 * @returns {boolean}
 */
export function hasDemReady(state) {
    if (!state?.anuga?.resources?.terrainLoaded) return false;
    const terrain = state?.anuga?.resources?.terrain || [];
    return terrain.some(t => t?.status === 'ready' && t?.gn_layer_name);
}

/**
 * Find the terrain resource row that matches the best DEM map layer.
 *
 * Uses the same findBestDemLayer priority as the terrain 3D/rescale epics,
 * then matches the returned layer name against the terrain resource's
 * gn_layer_name. Returns null when no match is found.
 *
 * @param {Object} state - Redux state
 * @returns {{id: number, ...}|null} terrain resource row, or null
 */
export function findActiveTerrain(state) {
    const demLayer = findBestDemLayer(state);
    if (!demLayer) return null;
    const terrain = state?.anuga?.resources?.terrain || [];
    // Map-layer names carry the GeoServer workspace prefix (e.g.
    // "geonode:ele_42_utm_cog"); the terrain resource's gn_layer_name is bare
    // ("ele_42_utm_cog"). Compare the BARE names so the workspace prefix never
    // breaks the match. Found at live UAT (TASK-1856 W3): the exact-equality
    // compare silently no-matched every real terrain → readout never queried.
    // bareName is imported from terrainEpics.js (canonical source, W5.1/TASK-1866).
    const target = bareName(demLayer.name);
    return terrain.find(t => bareName(t?.gn_layer_name) === target) || null;
}

/**
 * cursorElevationEpic — debounced WGS84 cursor point → float elevation.
 *
 * PURE DATA epic: dispatches only SET_TERRAIN_CURSOR_ELEVATION.
 * The ElevationReadout component (W3.3) connects to state.anuga.resources.cursorElevation.
 */
export function cursorElevationEpic(action$, store) {
    // Stream 1: clear immediately when the cursor leaves the map.
    const clearOnMouseOut$ = action$
        .ofType(MOUSE_OUT)
        .mapTo(setTerrainCursorElevation(null));

    // Stream 2: debounced point-query on every mouse move.
    const elevation$ = action$
        .ofType(MOUSE_MOVE)
        .debounceTime(DEBOUNCE_MS)
        .switchMap((action) => {
            const state = store.getState();

            // No-op when no DEM is ready.
            if (!hasDemReady(state)) {
                return Rx.Observable.empty();
            }

            const projectId = getProjectId(state);
            if (!projectId) {
                return Rx.Observable.empty();
            }

            const activeTerrain = findActiveTerrain(state);
            if (!activeTerrain) {
                return Rx.Observable.of(setTerrainCursorElevation(null));
            }

            const position = action.position;
            // position.x = lng, position.y = lat (OL's toLonLat output via mouseMoveEvent)
            const lon = position && position.x;
            const lat = position && position.y;
            if (lon === undefined || lon === null || lat === undefined || lat === null) {
                return Rx.Observable.empty();
            }

            return Rx.Observable
                .from(anugaApi.getTerrainElevationPoint(projectId, activeTerrain.id, lon, lat))
                .map((response) => {
                    const elevation = response?.data?.elevation;
                    // null is valid: nodata pixel or point outside the raster.
                    return setTerrainCursorElevation(typeof elevation === 'number' ? elevation : null);
                })
                .catch(() => {
                    // Network / 4xx / 5xx: clear silently — do not flash a stale value.
                    return Rx.Observable.of(setTerrainCursorElevation(null));
                });
        });

    return Rx.Observable.merge(clearOnMouseOut$, elevation$);
}

export default cursorElevationEpic;

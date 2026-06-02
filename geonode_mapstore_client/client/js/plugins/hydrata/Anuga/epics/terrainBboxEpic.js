/**
 * TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker epics.
 *
 * Three epics:
 *   1. terrainBboxEndDrawingEpic — listens for MapStore's END_DRAWING on
 *      owner='terrain-bbox', computes the bbox [minLon, minLat, maxLon,
 *      maxLat] from the drawn rectangle, computes the geodesic area (turf),
 *      stashes the bbox + area, then OPENS the confirmation popup so the user
 *      reviews "selected area / estimated cells / estimated time" before any
 *      POST fires. Areas over the 40,000 km2 ceiling still open the popup (the
 *      popup disables Confirm and asks the user to re-select).
 *   2. createTerrainFromBboxEpic — catches CREATE_TERRAIN_FROM_BBOX (fired from
 *      the popup's Confirm) and POSTs to the BE endpoint shipped in TASK-929.
 *      On 202 the BE kicks off the async GLO-30 fetch on the anuga Celery pool;
 *      the new Terrain layer appears via the existing taskCompleteLayerEpic.
 *   3. createTerrainFromBboxErrorEpic — surfaces a BE rejection (e.g. the
 *      40,000 km2 backstop, perms, or any failure) as a VISIBLE error toast.
 *      Previously the error action was unhandled and the panel was already
 *      closed, so BE errors surfaced nowhere.
 *
 * The real gate is the geodesic area ceiling (MAX_AREA_KM2, identical to the
 * BE backstop). MAX_BBOX_SPAN_DEG is kept only as a coarse, cheap pre-check to
 * reject pathological / unreadable extents before the area math runs.
 */
import Rx from 'rxjs';
import area from '@turf/area';
import bboxPolygon from '@turf/bbox-polygon';
import {
    CREATE_TERRAIN_FROM_BBOX,
    CREATE_TERRAIN_FROM_BBOX_ERROR,
    createTerrainFromBboxSuccess,
    createTerrainFromBboxError,
    setTerrainBbox,
    setTerrainBboxError,
    setTerrainBboxConfirm
} from "../actionsAnuga";
import { END_DRAWING, changeDrawingStatus } from '../../../../../MapStore2/web/client/actions/draw';
import { reproject } from '../../../../../MapStore2/web/client/utils/CoordinatesUtils';
import { show } from '../../../../../MapStore2/web/client/actions/notifications';
// ISSUE 3 (TASK-1426): auto-open Task Manager when terrain download starts.
import {toggleTaskMonitorPanel} from '../../TaskMonitor/actionsTaskMonitor';
import * as anugaApi from '../api/anugaApi';
import { getProjectId } from "../selectorsAnuga";

// Coarse pre-check only — a box wider/taller than this in raw degrees is almost
// certainly a mis-draw. The authoritative gate is the geodesic area ceiling.
const MAX_BBOX_SPAN_DEG = 90;

/**
 * Geodesic area (km2) of a [minLon, minLat, maxLon, maxLat] WGS84 extent.
 * @turf/area returns m2; divide by 1e6 for km2.
 */
export function bboxAreaKm2(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return 0;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const areaM2 = area(bboxPolygon([minLon, minLat, maxLon, maxLat]));
    return areaM2 / 1e6;
}

/**
 * Pull a bbox out of an END_DRAWING action payload and reproject the corners
 * into EPSG:4326 if needed. MapStore's draw interaction usually emits BBOX
 * geometries as Polygons in map projection (typically EPSG:3857); we
 * normalise to lon/lat extents so the BE only ever sees WGS84.
 *
 * Returns [minLon, minLat, maxLon, maxLat] or null if the shape is unrecognised.
 */
export function extractBboxFromDrawAction(action) {
    if (!action || !action.geometry) return null;
    const geom = action.geometry;
    // BBOX usually arrives as { type: 'Polygon', coordinates: [[[x,y],...]] }
    // or wrapped inside a feature.
    const fromCrs = geom.projection
        || geom.featureProjection
        || 'EPSG:4326';
    let coords = null;
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        coords = geom.coordinates[0];
    } else if (Array.isArray(geom.features) && geom.features[0]?.geometry?.coordinates) {
        coords = geom.features[0].geometry.coordinates[0];
    } else if (Array.isArray(geom.coordinates) && Array.isArray(geom.coordinates[0])) {
        coords = geom.coordinates[0];
    }
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // Reproject each corner into lon/lat if the draw came back in 3857.
    // Fail the whole bbox if ANY corner can't be reprojected — a partial set
    // would silently mis-bound the extent.
    const reprojectXY = ([x, y]) => {
        if (fromCrs === 'EPSG:4326') return [x, y];
        try {
            const p = reproject([x, y], fromCrs, 'EPSG:4326');
            return [p.x, p.y];
        } catch (_e) {
            return null;
        }
    };
    const lonLats = coords.map(reprojectXY);
    if (lonLats.some((c) => c === null)) return null;
    if (lonLats.length < 2) return null;
    const lons = lonLats.map((p) => p[0]);
    const lats = lonLats.map((p) => p[1]);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Reset the MapStore draw interaction after a terrain-bbox draw completes.
 *
 * TASK-1406 (ISSUE 8): without this, MapStore's draw reducer retains
 * drawMethod='BBOX' / drawOwner='terrain-bbox' after END_DRAWING fires.
 * The next consumer (e.g. the boundary editor) sees the stale 'BBOX' drawMethod
 * and its own changeDrawingStatus('drawOrEdit') starts in rectangle mode instead
 * of the boundary's polygon/line geometry. Dispatching 'stop' clears the draw
 * state so owner-isolation is guaranteed: the terrain-bbox tool leaves no
 * residual drawMethod when it hands off to the next interaction.
 */
const TERRAIN_BBOX_DRAW_RESET = changeDrawingStatus('stop', '', 'terrain-bbox', [], {});

/**
 * Listen for END_DRAWING events tagged for 'terrain-bbox'. On a readable
 * extent, stash the bbox + its geodesic area and OPEN the confirmation popup
 * (setTerrainBboxConfirm) so the user reviews the selection before the create
 * POST fires. The popup itself decides whether Confirm is enabled (area must be
 * <= MAX_AREA_KM2). The coarse degree-span pre-check only rejects unreadable /
 * pathological extents up front; the real ceiling is enforced in the popup.
 *
 * TASK-1406: the draw interaction is stopped (changeDrawingStatus 'stop') on
 * EVERY END_DRAWING branch so the draw reducer is always clean when the next
 * map interaction starts.
 */
export const terrainBboxEndDrawingEpic = (action$) =>
    action$.ofType(END_DRAWING)
        .filter((a) => a.owner === 'terrain-bbox')
        .switchMap((action) => {
            const bbox = extractBboxFromDrawAction(action);
            if (!bbox) {
                return Rx.Observable.of(
                    TERRAIN_BBOX_DRAW_RESET,
                    setTerrainBboxError('hydrata.anuga.terrainBboxInvalid')
                );
            }
            const [minLon, minLat, maxLon, maxLat] = bbox;
            const spanLon = Math.abs(maxLon - minLon);
            const spanLat = Math.abs(maxLat - minLat);
            if (spanLon > MAX_BBOX_SPAN_DEG || spanLat > MAX_BBOX_SPAN_DEG) {
                // Almost certainly a mis-draw (e.g. spanning the antimeridian).
                // Stash the bbox so the user sees what they drew, plus the error.
                return Rx.Observable.of(
                    TERRAIN_BBOX_DRAW_RESET,
                    setTerrainBbox(bbox),
                    setTerrainBboxError('hydrata.anuga.terrainBboxInvalid')
                );
            }
            const areaKm2 = bboxAreaKm2(bbox);
            // Stash the bbox, clear any prior inline error, then open the popup
            // with the computed area. Confirm/Re-select live in the popup.
            // TASK-1406: always reset the draw interaction so the BBOX drawMethod
            // doesn't leak into the next tool (e.g. boundary editor).
            return Rx.Observable.of(
                TERRAIN_BBOX_DRAW_RESET,
                setTerrainBbox(bbox),
                setTerrainBboxError(null),
                setTerrainBboxConfirm(true, areaKm2)
            );
        });

/**
 * Pull a human-readable message out of an axios error. The DRF error body is
 * { error_code, detail }; prefer `detail`. Never return a raw object — the
 * error toast feeds this string straight to a notification message slot.
 */
export function extractCreateErrorMessage(err) {
    const data = err?.response?.data;
    if (data && typeof data === 'object') {
        if (typeof data.detail === 'string' && data.detail) return data.detail;
        if (typeof data.error === 'string' && data.error) return data.error;
    }
    if (typeof data === 'string' && data) return data;
    if (typeof err?.message === 'string' && err.message) return err.message;
    return 'create failed';
}

/**
 * POST CREATE_TERRAIN_FROM_BBOX to the BE GLO-30 ingest endpoint. On 202 we
 * dispatch success (no-op reducer; layer arrival is handled by the existing
 * taskCompleteLayerEpic via TaskMonitor). On failure dispatch the error action
 * with a clean message string, which createTerrainFromBboxErrorEpic surfaces
 * as a visible toast.
 */
export const createTerrainFromBboxEpic = (action$, store) =>
    action$.ofType(CREATE_TERRAIN_FROM_BBOX)
        .switchMap((action) => {
            const projectId = getProjectId(store.getState());
            if (!projectId || !Array.isArray(action.bbox) || action.bbox.length !== 4) {
                return Rx.Observable.of(createTerrainFromBboxError('missing project or bbox'));
            }
            return Rx.Observable
                .from(anugaApi.createTerrainFromBbox(projectId, {
                    title: action.title,
                    source: 'copernicus_glo30',
                    bbox: action.bbox
                }))
                .switchMap((response) => Rx.Observable.from([
                    // ISSUE 3 (TASK-1426): open Task Manager so the user sees the
                    // download progress immediately after the request is accepted.
                    toggleTaskMonitorPanel(true),
                    createTerrainFromBboxSuccess(response?.data)
                ]))
                .catch((err) => Rx.Observable.of(
                    createTerrainFromBboxError(extractCreateErrorMessage(err))
                ));
        });

/**
 * Surface a CREATE_TERRAIN_FROM_BBOX_ERROR as a visible error toast. The error
 * payload is always a clean string by the time it reaches here (see
 * extractCreateErrorMessage). We pass it via msgParams.detail so the i18n copy
 * owns the wording and only the BE-supplied detail is interpolated — the
 * `message` key resolves to a translation, never a raw object.
 */
export const createTerrainFromBboxErrorEpic = (action$) =>
    action$.ofType(CREATE_TERRAIN_FROM_BBOX_ERROR)
        .map((action) => {
            const detail = typeof action.error === 'string' && action.error
                ? action.error
                : 'create failed';
            return show({
                title: 'hydrata.anuga.terrainBboxCreateErrorTitle',
                message: 'hydrata.anuga.terrainBboxCreateErrorBody',
                values: { detail },
                position: 'tc',
                autoDismiss: 10,
                level: 'error'
            });
        });

/**
 * TASK-930 (W2-FE) — Global Copernicus GLO-30 DEM bbox-picker epics.
 *
 * Two epics:
 *   1. terrainBboxEndDrawingEpic — listens for MapStore's END_DRAWING on
 *      owner='terrain-bbox', computes the bbox [minLon, minLat, maxLon,
 *      maxLat] from the drawn rectangle, validates the 5x5° span, then
 *      either dispatches setTerrainBbox or setTerrainBboxError.
 *   2. createTerrainFromBboxEpic — catches CREATE_TERRAIN_FROM_BBOX and
 *      POSTs to the BE endpoint shipped in TASK-929. On 202 the BE kicks
 *      off the async GLO-30 fetch on the anuga Celery pool; the new
 *      Terrain layer appears via the existing taskCompleteLayerEpic.
 *
 * The 5x5° span cap is a defence-in-depth check on the FE side; the BE
 * applies its own cap inside the create-from-bbox view. Surfacing the
 * error INLINE (not toast) matches user preference [[feedback-…inline
 * validation]] — the user sees the error without losing modal context.
 */
import Rx from 'rxjs';
import {
    CREATE_TERRAIN_FROM_BBOX,
    createTerrainFromBboxSuccess,
    createTerrainFromBboxError,
    setTerrainBbox,
    setTerrainBboxError
} from "../actionsAnuga";
import { END_DRAWING } from '../../../../../MapStore2/web/client/actions/draw';
import { reproject } from '../../../../../MapStore2/web/client/utils/CoordinatesUtils';
import * as anugaApi from '../api/anugaApi';
import { getProjectId } from "../selectorsAnuga";

const MAX_BBOX_SPAN_DEG = 5;

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
 * Listen for END_DRAWING events tagged for 'terrain-bbox'. On valid extent,
 * dispatch setTerrainBbox; on > 5x5° span, dispatch setTerrainBboxError with
 * the i18n key so the panel can render inline.
 */
export const terrainBboxEndDrawingEpic = (action$) =>
    action$.ofType(END_DRAWING)
        .filter((a) => a.owner === 'terrain-bbox')
        .switchMap((action) => {
            const bbox = extractBboxFromDrawAction(action);
            if (!bbox) {
                return Rx.Observable.of(setTerrainBboxError('hydrata.anuga.terrainBboxInvalid'));
            }
            const [minLon, minLat, maxLon, maxLat] = bbox;
            const spanLon = Math.abs(maxLon - minLon);
            const spanLat = Math.abs(maxLat - minLat);
            if (spanLon > MAX_BBOX_SPAN_DEG || spanLat > MAX_BBOX_SPAN_DEG) {
                // Stash the bbox AND the error so the user can see what they drew
                // alongside the validation failure.
                return Rx.Observable.of(
                    setTerrainBbox(bbox),
                    setTerrainBboxError('hydrata.anuga.terrainBboxTooLarge')
                );
            }
            return Rx.Observable.of(setTerrainBbox(bbox));
        });

/**
 * POST CREATE_TERRAIN_FROM_BBOX to the BE GLO-30 ingest endpoint. On 202 we
 * dispatch success (no-op reducer; layer arrival is handled by the existing
 * taskCompleteLayerEpic via TaskMonitor). On failure dispatch the error
 * action; the reducer can surface that to a future per-panel error view.
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
                .switchMap((response) => Rx.Observable.of(createTerrainFromBboxSuccess(response?.data)))
                .catch((err) => Rx.Observable.of(
                    createTerrainFromBboxError(err?.response?.data || err?.message || 'create failed')
                ));
        });

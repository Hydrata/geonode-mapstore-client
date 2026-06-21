/**
 * TASK-1861 (epic 1814 W4.4) — profileEpic
 *
 * The depth/result line-profile tool. Two epics:
 *
 *   profileStartDrawEpic — on START_PROFILE_DRAW (the panel's "Draw profile
 *     line" button) flips the drawing flag, clears any stale samples/error, and
 *     starts a MapStore LineString DrawSupport interaction owned by
 *     'terrain-profile'.  Pattern mirrors the terrain-bbox tool
 *     (terrainBboxEpic.js / terrainBboxPanel.js).
 *
 *   profileEndDrawingEpic — on END_DRAWING(owner='terrain-profile') it:
 *     1. extracts the drawn LineString and reprojects each vertex to WGS84
 *        (DrawSupport emits coords in the map CRS — usually EPSG:3857);
 *     2. gates on a DEM being ready (reuses hasDemReady from cursorElevationEpic
 *        — no crash when no terrain/result is present, AC-5);
 *     3. discovers the layers to sample: the active terrain DEM ('dem') plus the
 *        SELECTED scenario's result rasters (depth_max / velocity_max /
 *        depthintegratedvelocity_max) from latest_run, with the geonode:
 *        workspace prefix STRIPPED to bare names (W3 LESSON: the BE
 *        resolve_coverage_vsi_path matches the bare coveragestore name);
 *     4. calls the W4.3 endpoint (anugaApi.getTerrainProfile) with the WKT line,
 *        the comma-joined layer set, and a fixed sample count;
 *     5. dispatches SET_PROFILE_SAMPLES(series, traces) on success or
 *        SET_PROFILE_ERROR on any failure (no DEM / bad line / network).
 *
 * PURE DATA epics (karma-testable with MockAdapter). The active-terrain id used
 * for the route is the W3 findActiveTerrain match; the result layers are passed
 * by NAME in the layers= param, so a single terrain route samples every raster.
 */
import Rx from 'rxjs';
import {
    END_DRAWING,
    changeDrawingStatus
} from '../../../../../MapStore2/web/client/actions/draw';
import { reproject } from '../../../../../MapStore2/web/client/utils/CoordinatesUtils';
import {
    START_PROFILE_DRAW,
    setProfileDrawing,
    setProfileLoading,
    setProfileSamples,
    setProfileError,
    clearProfile
} from '../actionsAnuga';
import { getProjectId, getSelectedScenario } from '../selectorsAnuga';
import { hasDemReady, findActiveTerrain } from './cursorElevationEpic';
import * as anugaApi from '../api/anugaApi';

// DrawSupport owner for this tool. Isolated so its drawMethod never leaks into
// the next interaction (the bbox tool uses 'terrain-bbox').
export const PROFILE_DRAW_OWNER = 'terrain-profile';
// Fixed sample density. The BE clamps to 2..200; 100 gives a smooth chart while
// bounding the /vsis3 read cost.
export const PROFILE_SAMPLES = 100;

// The three ANUGA result rasters exposed on latest_run, in chart order, with the
// human label used as the trace name. Keys map to the run serializer fields.
// `role` (TASK-1862, W4.5) lets the cross-section chart find the terrain + depth
// rasters UNAMBIGUOUSLY (water surface = terrain + DEPTH = stage) instead of
// sniffing the layer name: depth is role='depth', the rest role='other'.
const RESULT_LAYER_FIELDS = [
    { field: 'gn_layer_depth_max', label: 'Depth (max)', role: 'depth' },
    { field: 'gn_layer_velocity_max', label: 'Velocity (max)', role: 'other' },
    { field: 'gn_layer_depth_integrated_velocity_max', label: 'Momentum (max)', role: 'other' }
];

// Strip the GeoServer workspace prefix (geonode:foo -> foo). The BE resolves the
// coverage store by the BARE name; sending the prefixed name no-matches. (W3.)
const bareName = (n) => (n || '').split(':').pop();

/**
 * [[lon,lat],...] -> "LINESTRING(lon lat, ...)" WKT. Returns null for < 2 verts
 * (a point cannot define a profile).
 */
export function coordsToWkt(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const pairs = coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
    return `LINESTRING(${pairs})`;
}

/**
 * Pull the drawn LineString out of an END_DRAWING action and reproject every
 * vertex to EPSG:4326. DrawSupport emits coords in the map CRS (typically
 * EPSG:3857). Returns [[lon,lat],...] (>= 2) or null if unreadable / too short.
 * Fail the whole line if ANY vertex can't reproject (a partial line mis-bounds
 * the profile) — mirrors extractBboxFromDrawAction's all-or-nothing rule.
 */
export function extractLineFromDrawAction(action) {
    const geom = action && action.geometry;
    if (!geom || geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return null;
    const fromCrs = geom.projection || geom.featureProjection || 'EPSG:4326';
    const coords = geom.coordinates;
    if (coords.length < 2) return null;
    const toWgs84 = ([x, y]) => {
        if (fromCrs === 'EPSG:4326') return [x, y];
        try {
            const p = reproject([x, y], fromCrs, 'EPSG:4326');
            return [p.x, p.y];
        } catch (_e) {
            return null;
        }
    };
    const lonLats = coords.map(toWgs84);
    if (lonLats.some((c) => c === null)) return null;
    if (lonLats.length < 2) return null;
    return lonLats;
}

/**
 * Build the ordered {key,label} entries to sample: 'dem' first, then the
 * SELECTED scenario's result rasters (latest_run.gn_layer_*) as BARE layer
 * names.  The LABEL is sourced AUTHORITATIVELY from the run field (not from
 * sniffing the layer name) so it is correct regardless of how the coverage
 * is named — localhost result layers are temp-file-named (tmp*_cog) while prod
 * uses run_<…>_<token>_cog, and both must label as "Depth (max)" etc.
 * Returns [{key:'dem', label:'Elevation', role:'dem'}, {key:'<bare>',
 * label:'Depth (max)', role:'depth'}, …]. Always includes 'dem'. `role`
 * (TASK-1862) drives the cross-section chart (terrain=dem, water surface=depth).
 */
export function getProfileTraces(state) {
    const traces = [{ key: 'dem', label: 'Elevation', role: 'dem' }];
    const scenario = getSelectedScenario(state);
    const run = scenario && scenario.latest_run;
    if (run) {
        RESULT_LAYER_FIELDS.forEach(({ field, label, role }) => {
            const name = run[field] && run[field].name;
            const bare = bareName(name);
            if (bare && !traces.some(t => t.key === bare)) {
                traces.push({ key: bare, label, role });
            }
        });
    }
    return traces;
}

/**
 * Convenience: just the layer-key set (['dem', '<bare>', ...]) for the layers=
 * request param.  Derived from getProfileTraces so keys + labels never drift.
 */
export function getProfileLayers(state) {
    return getProfileTraces(state).map(t => t.key);
}

/**
 * profileStartDrawEpic — START_PROFILE_DRAW -> flip drawing flag + clear stale
 * samples + start the LineString DrawSupport interaction.
 */
export function profileStartDrawEpic(action$) {
    return action$.ofType(START_PROFILE_DRAW)
        .switchMap(() => Rx.Observable.of(
            clearProfile(),
            setProfileError(null),
            setProfileDrawing(true),
            changeDrawingStatus('start', 'LineString', PROFILE_DRAW_OWNER, [], {})
        ));
}

/**
 * profileEndDrawingEpic — END_DRAWING(owner=terrain-profile) -> sample + store.
 */
export function profileEndDrawingEpic(action$, store) {
    return action$.ofType(END_DRAWING)
        .filter((a) => a.owner === PROFILE_DRAW_OWNER)
        .switchMap((action) => {
            const state = store.getState();
            // Always stop the draw interaction so the LineString drawMethod can't
            // leak into the next tool (TASK-1406 lesson from the bbox tool).
            const stopDraw = changeDrawingStatus('stop', '', PROFILE_DRAW_OWNER, [], {});

            // AC-5: gate on a DEM being ready — no crash / no call when absent.
            if (!hasDemReady(state)) {
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileNoTerrain'));
            }
            const projectId = getProjectId(state);
            const activeTerrain = findActiveTerrain(state);
            if (!projectId || !activeTerrain) {
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileNoTerrain'));
            }

            const coords = extractLineFromDrawAction(action);
            const wkt = coordsToWkt(coords);
            if (!wkt) {
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileBadLine'));
            }

            // traces ({key,label}) are the single source of truth; the layers=
            // param is just their keys, so keys + chart labels never drift.
            const traces = getProfileTraces(state);

            return Rx.Observable.concat(
                Rx.Observable.of(stopDraw, setProfileLoading(true)),
                Rx.Observable
                    .from(anugaApi.getTerrainProfile(projectId, activeTerrain.id, {
                        line: wkt,
                        layers: traces.map(t => t.key).join(','),
                        samples: PROFILE_SAMPLES
                    }))
                    .map((response) => {
                        const samples = response && response.data && response.data.samples;
                        if (!Array.isArray(samples)) {
                            return setProfileError('hydrata.anuga.profileFailed');
                        }
                        return setProfileSamples(samples, traces);
                    })
                    .catch(() => Rx.Observable.of(setProfileError('hydrata.anuga.profileFailed')))
            );
        });
}

export default profileEndDrawingEpic;

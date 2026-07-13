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
 *        depthintegratedvelocity_max) from latest_complete_run (TASK-2078 —
 *        cross-section sampling is a RESULT consumer; a newer in-flight or
 *        errored latest_run must not blank/break the profile), with the
 *        geonode: workspace prefix STRIPPED to bare names (W3 LESSON: the BE
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
    SET_PROFILE_PANEL_VISIBLE,
    setProfileDrawing,
    setProfileLoading,
    setProfileSamples,
    setProfileError,
    clearProfile,
    setCheckedTerrains,
    setCheckedScenarios
} from '../actionsAnuga';
import { getProjectId, getSelectedScenario, getScenariosArray } from '../selectorsAnuga';
import { hasDemReady, findActiveTerrain } from './cursorElevationEpic';
import { bareName } from './terrainEpics';
import * as anugaApi from '../api/anugaApi';

// DrawSupport owner for this tool. Isolated so its drawMethod never leaks into
// the next interaction (the bbox tool uses 'terrain-bbox').
export const PROFILE_DRAW_OWNER = 'terrain-profile';
// Fixed sample density. The BE clamps to 2..200; 100 gives a smooth chart while
// bounding the /vsis3 read cost.
export const PROFILE_SAMPLES = 100;

// The three ANUGA result rasters exposed on a Run (read via latest_complete_run
// — TASK-2078), in chart order, with the human label used as the trace name.
// Keys map to the run serializer fields.
// `role` (TASK-1862, W4.5) lets the cross-section chart find the terrain + depth
// rasters UNAMBIGUOUSLY (water surface = terrain + DEPTH = stage) instead of
// sniffing the layer name: depth is role='depth', the rest role='other'.
const RESULT_LAYER_FIELDS = [
    { field: 'gn_layer_depth_max', label: 'Depth (max)', role: 'depth' },
    { field: 'gn_layer_velocity_max', label: 'Velocity (max)', role: 'other' },
    { field: 'gn_layer_depth_integrated_velocity_max', label: 'Momentum (max)', role: 'other' }
];

// bareName is imported from terrainEpics.js (canonical source, W5.1/TASK-1866).
// Strips the GeoServer workspace prefix (geonode:foo -> foo). The BE resolves the
// coverage store by the BARE name; sending the prefixed name no-matches. (W3.)

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
 * SELECTED scenario's result rasters (latest_complete_run.gn_layer_*) as BARE
 * layer names. TASK-2078: reads latest_complete_run, NOT latest_run — a newer
 * in-flight/errored run has no (or stale) result rasters, so sampling must
 * stay pinned to the last COMPLETE run's COGs. The LABEL is sourced
 * AUTHORITATIVELY from the run field (not from sniffing the layer name) so it
 * is correct regardless of how the coverage is named — localhost result
 * layers are temp-file-named (tmp*_cog) while prod uses run_<…>_<token>_cog,
 * and both must label as "Depth (max)" etc.
 * Returns [{key:'dem', label:'Elevation', role:'dem'}, {key:'<bare>',
 * label:'Depth (max)', role:'depth'}, …]. Always includes 'dem'. `role`
 * (TASK-1862) drives the cross-section chart (terrain=dem, water surface=depth).
 */
export function getProfileTraces(state) {
    const traces = [{ key: 'dem', label: 'Elevation', role: 'dem' }];
    const scenario = getSelectedScenario(state);
    const run = scenario && scenario.latest_complete_run;
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

// ── TASK-2254 (epic 2249 W2) — Cross-section PICKER series model ───────────
// Up to 3 terrain + 3 scenario-water-surface rows (LOCKED decisions #2/#6/#10).
// This is STATE + DATA only — the picker-as-legend UI component, palettes and
// fill rules are W3 (TASK-2256); these selectors expose enumerated status
// codes ('ready'/'no-run'/'no-stage'), never display text, so W3 owns every
// i18n string.

/**
 * Terrain picker rows: project Terrain resources with status='ready' AND a
 * gn_layer_name, in resource-list order (the BE-returned order — the same
 * stable order hasDemReady/findActiveTerrain already key off).  A not-ready
 * terrain is excluded entirely (no disabled state for terrain — only
 * scenarios have listed-disabled rows, LOCKED decision #10).
 */
export function getTerrainPickerRows(state) {
    const terrain = state?.anuga?.resources?.terrain || [];
    return terrain.filter(t => t?.status === 'ready' && t?.gn_layer_name);
}

/**
 * Scenario (water-surface) picker rows: non-archived scenarios in the
 * canonical scenarios-array order (getScenariosArray, id-ascending —
 * reused rather than re-deriving allIds order). Archived scenarios are
 * hidden entirely (never listed, even disabled). Each row carries a
 * checkability `status`:
 *   'no-run'   — no latest_complete_run at all.
 *   'no-stage' — a complete run exists but predates stage publication
 *                (no gn_layer_stage_max) — "Re-run to get a water surface".
 *   'ready'    — a published stage_max exists; checkable.
 */
export function getScenarioPickerRows(state) {
    return getScenariosArray(state)
        .filter(s => !s.archived_at)
        .map((scenario) => {
            const run = scenario.latest_complete_run;
            let status;
            if (!run) status = 'no-run';
            else if (!run.gn_layer_stage_max) status = 'no-stage';
            else status = 'ready';
            return { id: scenario.id, scenario, status };
        });
}

// A map layer counts as "visible" only when NOT explicitly hidden — mirrors
// the fleet convention (layer.visibility defaults true; only false hides it,
// see clickDisambiguationEpic.js / warmTilesEpic.js).
const isLayerVisible = (layer) => !!layer && layer.visibility !== false;

function isTerrainRowVisible(state, terrainRow) {
    const layers = state?.layers?.flat || [];
    const bare = bareName(terrainRow?.gn_layer_name);
    if (!bare) return false;
    return layers.some(l => bareName(l?.name) === bare && isLayerVisible(l));
}

// A scenario seeds if ANY of its latest_complete_run's result layers is
// visible on the map (name-match precedent: pollingEpics.js isScenarioLoaded
// — but OR across the 3 fields, not AND, per LOCKED decision #10). stage_max
// is NEVER a MapLayer (W1) so it is deliberately excluded from this check.
function isScenarioRowVisible(state, scenario) {
    const run = scenario && scenario.latest_complete_run;
    if (!run) return false;
    const layers = state?.layers?.flat || [];
    return RESULT_LAYER_FIELDS.some(({ field }) => {
        const bare = bareName(run[field] && run[field].name);
        if (!bare) return false;
        return layers.some(l => bareName(l?.name) === bare && isLayerVisible(l));
    });
}

/**
 * Seed the checked TERRAIN id set on panel open. Only rows visible on the map
 * are candidates (checkable rows only — getTerrainPickerRows already excludes
 * not-ready terrains). Overflow (>3 visible) takes the first 3 BY LIST ORDER,
 * not detection order. Nothing visible -> fall back to the active terrain
 * (findActiveTerrain — the same single-DEM resolution the cursor-elevation
 * readout uses), reproducing today's single-terrain default; that helper
 * does not itself check visibility, matching today's behaviour.
 */
export function seedCheckedTerrains(state) {
    const rows = getTerrainPickerRows(state);
    const visible = rows.filter(r => isTerrainRowVisible(state, r)).slice(0, 3).map(r => r.id);
    if (visible.length > 0) return visible;
    const active = findActiveTerrain(state);
    const rowIds = rows.map(r => r.id);
    return (active && rowIds.includes(active.id)) ? [active.id] : [];
}

/**
 * Seed the checked SCENARIO id set on panel open. Only 'ready' (checkable)
 * rows are candidates — a scenario with a visible depth layer but no
 * published stage can never be seeded, since it cannot be checked either.
 * Overflow (>3 visible) takes the first 3 BY LIST ORDER. Nothing visible ->
 * fall back to the selected scenario (today's single-water default), but
 * ONLY if it is itself checkable (never seed a disabled row).
 */
export function seedCheckedScenarios(state) {
    const rows = getScenarioPickerRows(state).filter(r => r.status === 'ready');
    const visible = rows.filter(r => isScenarioRowVisible(state, r.scenario)).slice(0, 3).map(r => r.id);
    if (visible.length > 0) return visible;
    const selected = getSelectedScenario(state);
    const rowIds = rows.map(r => r.id);
    return (selected && rowIds.includes(selected.id)) ? [selected.id] : [];
}

/**
 * Colour slot for a checked row: its index within the STABLE picker-list
 * order of the CURRENTLY CHECKED subset — NOT the order rows were checked in.
 * `rows` is any ordered array of {id}-shaped entries (terrain or scenario
 * rows); `checkedIds` is the checked-id array from redux state (any order).
 * Returns -1 when `id` is not currently checked.
 *
 * This is the anti-churn guarantee (LOCKED decision #6): unchecking and
 * rechecking an item, or checking the same set in a different click order,
 * never reassigns another row's colour — only which ids are checked (the
 * SET, not the sequence) determines slot assignment, and the assignment
 * itself always follows the picker list's own fixed order.
 */
export function getColorSlot(rows, checkedIds, id) {
    if (!Array.isArray(checkedIds) || !checkedIds.includes(id)) return -1;
    const checkedInListOrder = (rows || [])
        .filter(r => r && checkedIds.includes(r.id))
        .map(r => r.id);
    return checkedInListOrder.indexOf(id);
}

/**
 * pickerSeedEpic — on SET_PROFILE_PANEL_VISIBLE(true) (panel open) seed both
 * checked-id sets from current map visibility. Panel CLOSE is a no-op here:
 * the next open always reseeds, so there is nothing to reset on close.
 */
export function pickerSeedEpic(action$, store) {
    return action$.ofType(SET_PROFILE_PANEL_VISIBLE)
        .filter(a => a.visible)
        .switchMap(() => {
            const state = store.getState();
            return Rx.Observable.of(
                setCheckedTerrains(seedCheckedTerrains(state)),
                setCheckedScenarios(seedCheckedScenarios(state))
            );
        });
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

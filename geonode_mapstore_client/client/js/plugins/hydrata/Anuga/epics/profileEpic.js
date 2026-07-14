/**
 * TASK-1861 (epic 1814 W4.4) — profileEpic
 * TASK-2254/TASK-2255 (epic 2249 W2) — Cross-section rework: the picker
 * checked-id state (TASK-2254) + the multi-terrain/multi-scenario sampling
 * rework (TASK-2255) both live in this file alongside the original two epics.
 *
 * The Cross-section tool. Three epics:
 *
 *   pickerSeedEpic — on SET_PROFILE_PANEL_VISIBLE(true) (panel open) seeds
 *     state.anuga.ui.checkedTerrainIds/checkedScenarioIds from current map
 *     visibility (TASK-2254): overflow (>3) takes the first 3 by picker-list
 *     order; nothing visible falls back to the active terrain / selected
 *     scenario (today's single-terrain/single-water default).
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
 *     3. builds ONE trace per CHECKED terrain (its own bare gn_layer_name,
 *        role='dem' — the literal 'dem' token is gone) and ONE trace per
 *        CHECKED, stage-published scenario (its bare stage_max name,
 *        role='stage', LOCKED decision #3 — published stage is the ONLY
 *        water source, no terrain+depth derivation), with the geonode:
 *        workspace prefix STRIPPED to bare names (W3 LESSON: the BE
 *        resolve_coverage_vsi_path matches the bare coveragestore name);
 *     4. calls the endpoint (anugaApi.getTerrainProfile) ONCE with the WKT
 *        line, the deduped layer token set (dem + stage + depth-mask tokens),
 *        and a fixed sample count — the URL path terrain id is just the
 *        perms anchor (LOCKED decision #8), not a sampling selector;
 *     5. dry-masks the response (applyDryMask — depth<0.02m or null -> null
 *        stage, LOCKED decision #9) and dispatches SET_PROFILE_SAMPLES(series,
 *        traces) on success, or SET_PROFILE_ERROR on any failure (no DEM /
 *        nothing checked / bad line / network).
 *
 * PURE DATA epics (karma-testable with MockAdapter).
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
    CLEAR_PROFILE,
    CLEAR_PROFILE_LINE,
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

// The three ANUGA result rasters that DO become MapLayers (depth/velocity/
// momentum — stage_max NEVER does, W1). TASK-2255 note: this list now drives
// ONLY the "is this scenario visible on the map" check (TASK-2254,
// isScenarioRowVisible below) — the sampling epic no longer requests
// velocity/momentum at all (published stage_max is the sole water source,
// LOCKED decision #3).
const RESULT_LAYER_FIELDS = [
    { field: 'gn_layer_depth_max' },
    { field: 'gn_layer_velocity_max' },
    { field: 'gn_layer_depth_integrated_velocity_max' }
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

// ── TASK-2254 (epic 2249 W2) — Cross-section PICKER series model ───────────
// Up to 3 terrain + 3 scenario-water-surface rows (LOCKED decisions #2/#6/#10).
// This is STATE + DATA only — the picker-as-legend UI component, palettes and
// fill rules are W3 (TASK-2256); these selectors expose enumerated status
// codes ('ready'/'no-run'/'no-stage'), never display text, so W3 owns every
// i18n string.

/**
 * Terrain picker rows: project Terrain resources with status='ready' AND a
 * gn_layer_name, SORTED BY ID (mirrors getScenariosArray) — TerrainViewSetV2's
 * BE queryset has no explicit ORDER BY, so the raw fetch order is not
 * guaranteed stable across polls/refetches. Colour-slot assignment
 * (getColorSlot, LOCKED decision #6) depends on this list's order being
 * stable; an unsorted "whatever the BE returned this time" order would
 * silently reintroduce the exact colour-churn bug the slot design exists to
 * prevent, just relocated from check-order to fetch-order. A not-ready
 * terrain is excluded entirely (no disabled state for terrain — only
 * scenarios have listed-disabled rows, LOCKED decision #10).
 */
export function getTerrainPickerRows(state) {
    const terrain = state?.anuga?.resources?.terrain || [];
    return terrain
        .filter(t => t?.status === 'ready' && t?.gn_layer_name)
        .sort((a, b) => (a?.id || 0) - (b?.id || 0));
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

// ── TASK-2255 (epic 2249 W2) — sampling epic rework ─────────────────────────

/**
 * Build ONE trace per CHECKED terrain (role='dem', keyed by ITS OWN bare
 * gn_layer_name — the literal 'dem' token is DROPPED, LOCKED decision #8)
 * and ONE trace per CHECKED, stage-published scenario (role='stage', keyed
 * by its bare stage_max name). The water surface comes ONLY from the
 * published stage_max (LOCKED decision #3) — there is no 'depth'-role
 * terrain+depth derivation trace any more (AC4). Each stage trace carries
 * `maskKey` (its scenario's bare depth_max name) so the epic can dry-mask
 * the response (LOCKED decision #9) without ever combining the two values
 * arithmetically.
 *
 * Reads state.anuga.ui.checkedTerrainIds / checkedScenarioIds (TASK-2254) —
 * sampling is EXACTLY what is checked, nothing implicit/selected. A checked
 * id that no longer resolves to a checkable row (stale id, deleted terrain,
 * a scenario that lost its stage) is silently dropped, never crashes.
 *
 * Returns [{key, label, role:'dem', terrainId}, {key, label, role:'stage',
 * scenarioId, maskKey}, ...], deduped by key (first occurrence wins).
 */
export function getProfileTraces(state) {
    const checkedTerrainIds = state?.anuga?.ui?.checkedTerrainIds || [];
    const terrainTraces = getTerrainPickerRows(state)
        .filter(t => checkedTerrainIds.includes(t.id))
        .map((t) => ({
            key: bareName(t.gn_layer_name),
            label: t.title || t.name || t.gn_layer_name,
            role: 'dem',
            terrainId: t.id
        }))
        .filter(t => t.key);

    const checkedScenarioIds = state?.anuga?.ui?.checkedScenarioIds || [];
    const scenarioTraces = getScenarioPickerRows(state)
        .filter(r => r.status === 'ready' && checkedScenarioIds.includes(r.id))
        .map(({ scenario }) => {
            const run = scenario.latest_complete_run;
            const maskName = run.gn_layer_depth_max && run.gn_layer_depth_max.name;
            return {
                key: bareName(run.gn_layer_stage_max.name),
                label: scenario.name || `Scenario ${scenario.id}`,
                role: 'stage',
                scenarioId: scenario.id,
                maskKey: maskName ? bareName(maskName) : null
            };
        })
        .filter(t => t.key);

    const seen = new Set();
    return [...terrainTraces, ...scenarioTraces].filter((t) => {
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
    });
}

/**
 * The deduped request token set for a traces array: every trace's key, PLUS
 * every stage trace's maskKey (sampled so applyDryMask can read the paired
 * depth value — the mask key never appears in getProfileTraces' chart-facing
 * metadata as its own trace). Order-preserving dedup. Exported so a caller
 * that already HAS a traces array (profileEndDrawingEpic) never needs to
 * re-derive it via a second getProfileTraces(state) call.
 */
export function tokensFromTraces(traces) {
    const tokens = [];
    (traces || []).forEach((t) => {
        tokens.push(t.key);
        if (t.maskKey) tokens.push(t.maskKey);
    });
    return Array.from(new Set(tokens));
}

/**
 * Convenience: the deduped request token set for the layers= param, derived
 * from a FRESH getProfileTraces(state) call. Prefer tokensFromTraces directly
 * when the caller already has a traces array in hand.
 */
export function getProfileLayers(state) {
    return tokensFromTraces(getProfileTraces(state));
}

/**
 * TASK-2255 (LOCKED decision #9) — dry-mask epsilon: a stage sample whose
 * paired depth_max is null (nodata / out-of-raster) or < 0.02 m is set to
 * null (no water at that point) rather than left as a wet-looking value —
 * the epsilon kills kNN/IDW interpolation skirts at wet/dry fronts. This is
 * the ONLY arithmetic ever applied to a stage sample: a comparison against
 * the epsilon, never an addition to the terrain/bed value (AC4 — no code
 * path computes terrain+depth).
 *
 * `traces` is a getProfileTraces() array; only role='stage' entries with a
 * `maskKey` are maskable. Returns a NEW array (does not mutate `samples`).
 */
export function applyDryMask(samples, traces) {
    if (!Array.isArray(samples)) return samples;
    const maskable = (traces || []).filter(t => t && t.role === 'stage' && t.maskKey);
    if (maskable.length === 0) return samples;
    return samples.map((s) => {
        if (!s) return s;
        let next = s;
        maskable.forEach((t) => {
            const depth = s[t.maskKey];
            const isDry = typeof depth !== 'number' || depth < 0.02;
            if (isDry && s[t.key] !== null) {
                if (next === s) next = { ...s };
                next[t.key] = null;
            }
        });
        return next;
    });
}

/**
 * The URL-path terrain id — a perms anchor ONLY (LOCKED decision #8), not a
 * sampling selector: the endpoint authorizes layers= tokens against this
 * terrain's own project. Anchors to the first CHECKED terrain (stable
 * picker-list order); falls back to findActiveTerrain (today's single-DEM
 * resolution) when nothing is checked but a DEM is otherwise ready.
 */
function resolveAnchorTerrainId(state) {
    const checkedTerrainIds = state?.anuga?.ui?.checkedTerrainIds || [];
    if (checkedTerrainIds.length > 0) {
        const rows = getTerrainPickerRows(state);
        const anchor = rows.find(r => checkedTerrainIds.includes(r.id));
        if (anchor) return anchor.id;
    }
    const active = findActiveTerrain(state);
    return active ? active.id : null;
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
 * clearProfileLineEpic — CLEAR_PROFILE_LINE (the "Clear" button) -> remove
 * the drawn LineString from the map, but ONLY when it is safe to do so.
 *
 * TASK-2276 (W5 independent review): the panel used to dispatch
 * changeDrawingStatus('clean', '', PROFILE_DRAW_OWNER, [], {}) directly, but
 * MapStore's DrawSupport 'clean' case (this.clean()) honours NO owner — it
 * wipes ANY tool's in-progress draw + sketch layer, not just this one's.
 * profileEndDrawingEpic's own 'stop' dispatch has the same unguarded shape,
 * but it is inherently safe: it only ever fires from an END_DRAWING this
 * tool's OWN draw just produced. Clear has no such natural gate — the user
 * can click it at any time, including while another tool (e.g. terrain-bbox)
 * has an active draw — so the guard lives here instead: only dispatch the
 * actual 'clean' when state.draw.drawOwner is this tool's own
 * (PROFILE_DRAW_OWNER) or idle (falsy, no tool currently drawing).
 */
export function clearProfileLineEpic(action$, store) {
    return action$.ofType(CLEAR_PROFILE_LINE)
        .filter(() => {
            const owner = store.getState()?.draw?.drawOwner;
            return !owner || owner === PROFILE_DRAW_OWNER;
        })
        .map(() => changeDrawingStatus('clean', '', PROFILE_DRAW_OWNER, [], {}));
}

/**
 * profileEndDrawingEpic — END_DRAWING(owner=terrain-profile) -> ONE sample
 * call over every checked terrain + checked scenario, dry-masked, stored.
 *
 * TASK-2255: previously this sampled the single active terrain's DEM + the
 * single selected scenario's 3 result rasters. It now samples EVERY checked
 * terrain + EVERY checked, stage-published scenario in exactly ONE request
 * (LOCKED decision #8) — the layers= token set and the traces metadata come
 * from getProfileLayers/getProfileTraces (TASK-2254 checked-id state), and
 * the response is dry-masked (applyDryMask) before being stored.
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
            const anchorTerrainId = resolveAnchorTerrainId(state);
            if (!projectId || !anchorTerrainId) {
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileNoTerrain'));
            }

            const coords = extractLineFromDrawAction(action);
            const wkt = coordsToWkt(coords);
            if (!wkt) {
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileBadLine'));
            }

            // traces ({key,label,role}) are the single source of truth for BOTH
            // the request tokens and the chart metadata stored alongside the
            // samples — derive the tokens from THIS traces value (tokensFromTraces)
            // rather than a second getProfileLayers(state) call, which would
            // silently redo the same terrain/scenario derivation twice per draw.
            const traces = getProfileTraces(state);
            if (traces.length === 0) {
                // Nothing checked (or every checked row lost its stage/terrain
                // since being checked) — nothing to sample, no pointless call.
                return Rx.Observable.of(stopDraw, setProfileError('hydrata.anuga.profileNoTerrain'));
            }
            const layers = tokensFromTraces(traces);

            return Rx.Observable.concat(
                Rx.Observable.of(stopDraw, setProfileLoading(true)),
                Rx.Observable
                    .from(anugaApi.getTerrainProfile(projectId, anchorTerrainId, {
                        line: wkt,
                        layers: layers.join(','),
                        samples: PROFILE_SAMPLES
                    }))
                    .map((response) => {
                        const samples = response && response.data && response.data.samples;
                        if (!Array.isArray(samples)) {
                            return setProfileError('hydrata.anuga.profileFailed');
                        }
                        return setProfileSamples(applyDryMask(samples, traces), traces);
                    })
                    .catch(() => Rx.Observable.of(setProfileError('hydrata.anuga.profileFailed')))
                    // W5 review fix (TASK-2272): if the user hits "Clear" while
                    // this sample is in flight, cancel it — otherwise the late
                    // response repopulates the chart after the state + map line
                    // were already wiped, leaving chart/map inconsistent.
                    .takeUntil(action$.ofType(CLEAR_PROFILE))
            );
        });
}

export default profileEndDrawingEpic;

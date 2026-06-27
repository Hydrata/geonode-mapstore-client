/**
 * TASK-1930 W2.6 — map-OPEN GWC tile prefetch.
 *
 * Heavy ANUGA maps open with ~17 visible COG layers that fire a cold GetMap
 * "tile storm" (~300 tiles); cold renders serialise behind GeoServer ControlFlow
 * (getmap concurrency) and the first viewer waits ~45-90s (W1 verdict). The root
 * fix is seed-on-creation + result-seed-at-publish (W2.1-W2.5), but a layer can
 * still be cold at OPEN (LFU eviction, a map composed of layers from elsewhere,
 * or a result published before this code shipped). This epic anchors a warm to
 * the moment the storm fires: on map load it asks the BE to pre-warm the
 * currently-visible cacheable COG layers.
 *
 * Trigger: MAP_CONFIG_LOADED — the MapStore core map-open action. INIT_ANUGA is
 * deliberately NOT used: it is login-gated (permsEpics.js), so it MISSES the
 * anonymous viewers who are the predominant cold-storm victims.
 *
 * Fire-and-forget: the epic dispatches NO redux action (ignoreElements) and
 * never blocks — it must not regress the TASK-658 cold-anon interactive budget
 * that motivated avoiding work on MAP_CONFIG_LOADED. Debounced + deduped by
 * mapId (MAP_CONFIG_LOADED can fire repeatedly on map switch/reconfig).
 *
 * Hydrata-side only: this lives entirely under plugins/hydrata/Anuga and only
 * IMPORTS MapStore2 core symbols — no MapStore2 submodule edit (the submodule is
 * a fork; core edits are costly/lossy).
 *
 * Security: the BE warm-tiles endpoint validates every alternate against the
 * project's OWN seedable COGs and server-pins the gridset/zoom band, so the
 * FE-supplied list can only ever warm this project's own layers.
 */
import Rx from 'rxjs';
import { MAP_CONFIG_LOADED } from '../../../../../MapStore2/web/client/actions/config';
import { getProjectId } from '../selectorsAnuga';
import { isShareableTileLayer } from '../gwcTileRouting';
import { RESULT_LAYER_NAME_RE } from './pollingEpics';
import * as anugaApi from '../api/anugaApi';

// Terrain DEM / hillshade COG layer-name family (ele_<id>_..._cog). Combined
// with isShareableTileLayer (which rejects dynamic env()/CQL/SLD terrains), this
// selects only the static, GWC-cacheable terrain rasters — NOT dynamic terrains.
export const TERRAIN_COG_NAME_RE = /(^|:)ele_\d+_.+_cog$/;

// Warm each map at most once per page session (MAP_CONFIG_LOADED can re-fire).
const _warmedMapIds = new Set();

// Test-only: reset the per-session dedupe.
export const __resetWarmedMapIdsForTest = () => _warmedMapIds.clear();

/**
 * Collect the alternates (GeoServer layer names) of the currently-visible
 * cacheable COG layers worth pre-warming: terrain DEM/hillshade + ANUGA result
 * COGs. Excludes hidden layers, dynamic/CQL/SLD-parameterised layers
 * (isShareableTileLayer), and anything that is not a recognised COG.
 *
 * @param {Object} state - Redux state
 * @returns {string[]} de-duplicated layer alternates
 */
export function selectWarmableAlternates(state) {
    const flat = state?.layers?.flat || [];
    const seen = new Set();
    const out = [];
    for (const layer of flat) {
        if (!layer || layer.type !== 'wms') continue;
        if (layer.visibility === false) continue;
        if (!isShareableTileLayer(layer)) continue;
        const name = layer.name || '';
        if (!(RESULT_LAYER_NAME_RE.test(name) || TERRAIN_COG_NAME_RE.test(name))) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
}

export const warmTilesOnMapOpenEpic = (action$, store) =>
    action$.ofType(MAP_CONFIG_LOADED)
        .debounceTime(1000)
        .switchMap(() => {
            const state = store.getState();
            const mapId = state?.gnresource?.id;
            if (!mapId || _warmedMapIds.has(mapId)) {
                return Rx.Observable.empty();
            }
            const alternates = selectWarmableAlternates(state);
            if (!alternates.length) {
                return Rx.Observable.empty();
            }
            _warmedMapIds.add(mapId);

            // Resolve the project id: authenticated users have it in Redux; anon
            // viewers (the cold-storm victims) resolve it from the map id via the
            // AllowAny from-map endpoint.
            const known = getProjectId(state);
            const projectId$ = known
                ? Rx.Observable.of(known)
                : Rx.Observable.from(anugaApi.getProjectFromMapId(mapId))
                    .map(resp => resp?.data?.projectId)
                    .catch(() => Rx.Observable.of(null));

            return projectId$.switchMap((projectId) => {
                if (!projectId) {
                    return Rx.Observable.empty();
                }
                // Fire-and-forget: warm the tiles, emit NO redux action.
                return Rx.Observable.from(anugaApi.warmTiles(projectId, { alternates }))
                    .ignoreElements()
                    .catch(() => Rx.Observable.empty());
            });
        });

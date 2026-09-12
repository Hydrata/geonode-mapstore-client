/**
 * TASK-2973 — nothing result-shaped on map load, ever.
 *
 * Operator ruling 2026-09-11: no result raster paints when a map opens. The
 * three max-value COGs of EVERY run (store-backed or storeless, current or
 * superseded), the RunComparison diff rasters and the pre-`run{N}_` result
 * names all arrive `visibility:true` — hydrata's `create_maplayer_for_dataset`
 * writes the row that way, and `ResourceUtils.js::resourceToLayerConfig`
 * hard-codes `visibility: true` for a row-only layer regardless of what the
 * row says (proven inert on prod: rows 12947-12949 flipped False, still
 * painted). So the hide lives HERE, frontend-side and display-only, exactly
 * like the precedent `terrainEpics.js::supersededTerrainVisibilityEpic`.
 *
 * The peak view is reached on request instead: the playback bar's Max
 * envelope for a store-backed run. (TASK-3078 removed the session-only
 * per-row show/hide that used to live beside this epic — a storeless run,
 * or a store baked without an envelope, has no in-app peak view now;
 * operator ruling 2026-09-12, a new task if ever wanted.)
 *
 * Triggers, and why exactly these two:
 *   MAP_CONFIG_LOADED — row-only MapLayers are folded into the map config by
 *     `addMapLayers` BEFORE `configureMap` dispatches, and `state.layers.flat`
 *     is populated in that same reducer pass, so the twelve on map 1418 are
 *     already visible to the sweep here. NO ADD_LAYER fires for them.
 *   ADD_LAYER — the poll path (`pollAnugaScenarioEpic` addLayer()s
 *     `selectMaxResultLayers`), the 2981 stranger branch, the fallback add.
 *   NOT SET_ANUGA_POLLING_DATA: it fires every 8 s and would re-sweep the
 *   map on every tick.
 *
 * DISPLAY-ONLY: never saveDirectContent. `getGeoNodeMapLayers` persists
 * `layer.visibility` on any save, and saves fire from several epics; a save
 * while hidden writes false (fine), a save while shown writes true (the
 * status quo ante — this epic re-hides it on the next load).
 */
import Rx from 'rxjs';
import { ADD_LAYER, changeLayerProperties } from '../../../../../MapStore2/web/client/actions/layers';
import { MAP_CONFIG_LOADED } from '../../../../../MapStore2/web/client/actions/config';
import { getScenariosArray } from '../selectorsAnuga';
import { bareName } from './terrainEpics';

/**
 * The FE mirror of hydrata `apps/gn_anuga/utils.py::RESULTS_GROUP_MAP`
 * (`get_anuga_group`): a dataset whose name carries one of these lands in a
 * `Results.*` group. `_diff__` covers all three comparison spellings
 * (`depth_diff__`, `velocity_diff__`, `velocity_depth_diff__`).
 *
 * Deliberately NOT `RESULT_LAYER_NAME_RE` (`/(^|:)run\d+_.+_cog$/`): that
 * misses the pre-token names (`a__155_88_195_depth_max`) and picker-test's
 * `run_2_11_depth_max_cog` spelling. Pre-2026-05-27 `tmpXXXX_cog` rows in the
 * `Default` group carry no token and are out of scope (accepted).
 */
export const RESULT_NAME_TOKENS = ['_depth_max', '_velocity_max', '_depthintegratedvelocity_max', '_diff__'];

const RESULTS_GROUP_PREFIX = 'Results';

const groupOf = (layer) => layer.group
    || (layer.extendedParams && layer.extendedParams.mapLayer
        && layer.extendedParams.mapLayer.extra_params
        && layer.extendedParams.mapLayer.extra_params.anuga_group)
    || '';

/**
 * TRUE for anything result-shaped: a name carrying one of the four tokens, or
 * a layer whose group (or folded MapLayer row group) starts with `Results`.
 *
 * @param {object} layer an entry of state.layers.flat (or an ADD_LAYER payload)
 * @returns {boolean}
 */
export const isResultShapedLayer = (layer) => {
    if (!layer || typeof layer !== 'object') return false;
    const name = bareName(layer.name);
    if (name && RESULT_NAME_TOKENS.some((token) => name.includes(token))) return true;
    const group = groupOf(layer);
    return typeof group === 'string' && group.indexOf(RESULTS_GROUP_PREFIX) === 0;
};

/**
 * "Belongs to run R": the bare names of the three gn_layer_*_max dicts on the
 * scenario whose latest_complete_run.id === R (the same three dicts
 * `selectMaxResultLayers` reads), plus the `run{R}_` name prefix as a fallback
 * for when those dicts are absent or the layer predates the serializer field.
 * Run ids are global PKs, so the prefix is unambiguous.
 */
export const runLayerMatcher = (state, runId) => {
    if (runId === undefined || runId === null || runId === '') return () => false;
    const wanted = String(runId);
    const names = new Set();
    (getScenariosArray(state) || []).forEach((scenario) => {
        const run = scenario && scenario.latest_complete_run;
        if (!run || String(run.id) !== wanted) return;
        [run.gn_layer_depth_max, run.gn_layer_velocity_max, run.gn_layer_depth_integrated_velocity_max]
            .forEach((dict) => {
                const bare = bareName(dict && dict.name);
                if (bare) names.add(bare);
            });
    });
    const prefix = `run${wanted}_`;
    return (layer) => {
        const bare = bareName(layer && layer.name);
        return !!bare && (names.has(bare) || bare.indexOf(prefix) === 0);
    };
};

/**
 * Epic: hide every result-shaped layer that is still rendering, on
 * MAP_CONFIG_LOADED and ADD_LAYER (debounced, idempotent — silent on an
 * already-hidden map).
 *
 * EXEMPTIONS, exactly one (TASK-3078 removed the toggled-set exemption with
 * the toggle itself):
 *   E2 — the layer belongs to the active playback run,
 *        `state.anugaPlayback.runId`. Keyed on runId ALONE, not on status:
 *        `showFallbackEnvelope` (TASK-2986) emits its `visibility:true` /
 *        addLayer one synchronous emit BEFORE `playbackFallback` sets
 *        status 'fallback', so a status key would race it. No active run ⇒
 *        `runLayerMatcher` returns `() => false` ⇒ nothing is exempt.
 *
 * Dispatches on `layer.id` (a uuid distinct from `name`), never on name.
 */
export const resultRasterVisibilityEpic = (action$, store) =>
    action$.ofType(MAP_CONFIG_LOADED, ADD_LAYER)
        .debounceTime(300)
        .switchMap(() => {
            const state = store.getState();
            const exempt = [runLayerMatcher(state, state && state.anugaPlayback && state.anugaPlayback.runId)];
            const actions = ((state && state.layers && state.layers.flat) || [])
                .filter((layer) => layer && layer.id && layer.visibility !== false
                    && isResultShapedLayer(layer)
                    && !exempt.some((belongs) => belongs(layer)))
                .map((layer) => changeLayerProperties(layer.id, { visibility: false }));
            return actions.length ? Rx.Observable.from(actions) : Rx.Observable.empty();
        });

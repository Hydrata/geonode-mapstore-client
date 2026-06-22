import Rx from "rxjs";
import {
    addLayer,
    removeLayer,
    ADD_LAYER,
    REMOVE_LAYER
} from '../../../../../MapStore2/web/client/actions/layers';
import { VISUALIZATION_MODE_CHANGED } from '../../../../../MapStore2/web/client/actions/maptype';
import { isCesium } from '../../../../../MapStore2/web/client/selectors/maptype';
import { getConfigProp } from '../../../../../MapStore2/web/client/utils/ConfigUtils';
import { SET_ANUGA_TERRAIN_DATA } from '../actionsAnuga';

const TERRAIN_MAPTILER_ID = 'terrain-maptiler';
const TERRAIN_DEM_ID = 'terrain-dem';

/**
 * Strip the GeoServer workspace prefix from a layer name.
 * Map layers carry the "geonode:" prefix; terrain resource rows carry bare names.
 * Re-exported so callers (cursorElevationEpic, profileEpic) can import ONE
 * authoritative copy instead of defining it locally.
 *
 * @param {string} n - layer name, possibly prefixed (e.g. "geonode:ele_42")
 * @returns {string} bare name (e.g. "ele_42")
 */
export const bareName = (n) => (n || '').split(':').pop();

/**
 * Build a MapTiler quantized-mesh terrain layer config from localConfig.
 * Returns null if no hydrataConfig.defaultTerrain is configured.
 */
const buildMaptilerTerrain = () => {
    const hydrataConfig = getConfigProp('hydrataConfig');
    const cfg = hydrataConfig?.defaultTerrain;
    if (!cfg?.url) return null;
    return {
        id: TERRAIN_MAPTILER_ID,
        type: cfg.type || 'terrain',
        provider: cfg.provider || 'cesium',
        url: cfg.url,
        title: cfg.title || 'Global Terrain',
        group: 'background',
        visibility: true,
        options: cfg.options || { requestVertexNormals: true }
    };
};

/**
 * Build a WMS BIL terrain layer config from a map layer, optionally joining
 * per-DEM elevation bounds from the ANUGA terrain resource rows.
 *
 * The GeoServerBILTerrainProvider decode loop (GeoServerBILTerrainProvider.js:73)
 * zeroes any sample that falls outside the strict (lowest, highest) range —
 * including ALL nodata sentinels: -9999, -FLT_MAX-clipped, ±32768 (INT16_MIN/MAX).
 * Setting per-DEM bounds therefore both clips nodata to 0 m (sea level) and
 * narrows the valid range to the real DEM extent (D9, TASK-1867).
 *
 * CLAMP-TO-SEA-LEVEL SEMANTICS (D9): out-of-range samples are zeroed to 0 m.
 * This does NOT punch a transparent hole (that would require a core patch).
 * For elevated DEMs this means a nodata area renders as flat sea level (a visible
 * pit). This is the accepted trade-off per operator decision D9 (TASK-1867).
 * A future UAT can revisit if the sea-level pit is unacceptable for high-altitude
 * DEMs with widespread nodata — the fix would be a core GeoServerBILTerrainProvider
 * patch to clamp to the DEM minimum instead of 0.
 *
 * The epsilon of ±1 m is REQUIRED because the gate is STRICT (> / <), so
 * setting lowest = dem_elev_min exactly would reject the legitimate minimum
 * elevation sample.
 *
 * When no terrain row or no bounds are available the lowest/highest props are
 * OMITTED so the provider defaults (-500 / 12000) apply.
 *
 * @param {Object} layer - a layer from state.layers.flat with name and title
 * @param {Object} [state] - Redux state (optional; used for the bounds join)
 */
const buildDemTerrain = (layer, state) => {
    if (!layer?.name) return null;
    const name = layer.name.includes(':') ? layer.name : `geonode:${layer.name}`;
    const config = {
        id: TERRAIN_DEM_ID,
        type: 'terrain',
        provider: 'wms',
        url: '/geoserver/wms',
        name,
        title: layer.title || layer.name,
        group: 'background',
        visibility: true,
        littleEndian: false,
        crs: 'CRS:84'
    };

    // Join the matching terrain resource row to surface per-DEM elevation bounds.
    // The bareName helper strips the "geonode:" workspace prefix from map-layer names
    // so they match the bare gn_layer_name on the resource row (W3 gotcha).
    if (state) {
        const terrains = state?.anuga?.resources?.terrain || [];
        const target = bareName(layer.name);
        const row = terrains.find(t => bareName(t?.gn_layer_name) === target);
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (row && row.dem_elev_min != null && row.dem_elev_max != null) {
            // Widen by 1 m: the decode gate is STRICT (temp > lowest && temp < highest),
            // so exact min/max would be zeroed. The ±1 m epsilon keeps the true extremes.
            config.lowest = Math.floor(row.dem_elev_min - 1);
            config.highest = Math.ceil(row.dem_elev_max + 1);
        }
        // No row or no bounds → omit lowest/highest → provider defaults apply.
    }

    return config;
};

/**
 * Find the best DEM layer from the current map layers.
 * Priority:
 *   1. ANUGA terrain layer (group === 'Input Data.Terrain')
 *   2. Any visible layer with "DEM" in title (largest bbox area)
 *
 * Exported so cursorElevationEpic (W3.2) can reuse the same DEM-selection
 * logic without duplicating it.
 */
export const findBestDemLayer = (state) => {
    const layers = state?.layers?.flat || [];

    // Priority 1: ANUGA terrain layers
    const anugaTerrain = layers.filter(
        l => l.type === 'wms' && l.group === 'Input Data.Terrain'
    );
    if (anugaTerrain.length > 0) {
        return anugaTerrain[0];
    }

    // Priority 2: Any layer with "DEM" in title, pick largest bbox area
    const demLayers = layers.filter(
        l => l.type === 'wms' && l.group !== 'background' && l.title && /dem/i.test(l.title)
    );
    if (demLayers.length === 0) return null;

    return demLayers.reduce((best, current) => {
        const bboxArea = (b) => {
            const bounds = b?.bbox?.bounds;
            if (!bounds) return 0;
            return Math.abs((bounds.maxx - bounds.minx) * (bounds.maxy - bounds.miny));
        };
        return bboxArea(current) > bboxArea(best) ? current : best;
    }, demLayers[0]);
};

/**
 * Get the currently active terrain layer from the map state.
 */
const getExistingTerrain = (state) => {
    const layers = state?.layers?.flat || [];
    return layers.find(l => l.id === TERRAIN_DEM_ID || l.id === TERRAIN_MAPTILER_ID);
};

/**
 * Determine the desired terrain state and emit add/remove/change actions.
 * Returns an Observable of actions.
 */
const reconcileTerrain = (state) => {
    const existing = getExistingTerrain(state);
    const demLayer = findBestDemLayer(state);
    const actions = [];

    if (demLayer) {
        const demTerrain = buildDemTerrain(demLayer, state);
        if (!demTerrain) {
            // DEM layer has no valid name — fall through to MapTiler
        } else if (existing?.id === TERRAIN_DEM_ID) {
            // Already have a DEM terrain. Recreate it when the source layer or its
            // per-DEM bounds changed — but NOT otherwise (avoid a remove+add storm,
            // since this epic re-runs on every ADD_LAYER/REMOVE_LAYER, debounced).
            //
            // We MUST force provider recreation via remove+add (not
            // changeLayerProperties): core TerrainLayer.js:updateLayer keys provider
            // recreation off url/name/crs/version/provider/etc. and does NOT recreate
            // on a lowest/highest change. So a changeLayerProperties bounds update
            // would update Redux but silently leave the LIVE Cesium
            // GeoServerBILTerrainProvider on its construction-time defaults
            // (-500/12000) — the per-DEM nodata clamp would never activate on the
            // DOMINANT async path (bounds arrive via SET_ANUGA_TERRAIN_DATA AFTER the
            // terrain layer is first added with no bounds). remove+add reconstructs
            // the provider from buildDemTerrain's config (carrying the per-DEM
            // lowest/highest). Stays Hydrata-side (D9: no core patch); the
            // self-trigger guard already ignores terrain-dem add/remove. (A DEM
            // name-change effectively always co-occurs with a bounds-change — a
            // different DEM has a different elevation range — so one path covers both.)
            const nameChanged = existing.name !== demTerrain.name;
            const boundsChanged = existing.lowest !== demTerrain.lowest
                || existing.highest !== demTerrain.highest;
            if (nameChanged || boundsChanged) {
                actions.push(removeLayer(existing.id));
                actions.push(addLayer(demTerrain, false));
            }
            return Rx.Observable.from(actions);
        } else {
            // Remove existing MapTiler terrain, add DEM terrain
            if (existing) {
                actions.push(removeLayer(existing.id));
            }
            actions.push(addLayer(demTerrain, false));
            return Rx.Observable.from(actions);
        }
    }

    // No DEM available — use MapTiler fallback
    if (existing?.id === TERRAIN_MAPTILER_ID) {
        // Already have MapTiler terrain — nothing to do
        return Rx.Observable.empty();
    }

    const maptilerTerrain = buildMaptilerTerrain();
    if (!maptilerTerrain) {
        return Rx.Observable.empty();
    }

    // Remove any existing DEM terrain, add MapTiler
    if (existing) {
        actions.push(removeLayer(existing.id));
    }
    actions.push(addLayer(maptilerTerrain, false));
    return Rx.Observable.from(actions);
};

/**
 * Epic: manage terrain layers when switching to 3D mode.
 * Triggers on visualization mode change, layer add/remove, and ANUGA terrain data load.
 */
export const manageTerrain3DEpic = (action$, store) =>
    action$.ofType(VISUALIZATION_MODE_CHANGED, ADD_LAYER, REMOVE_LAYER, SET_ANUGA_TERRAIN_DATA)
        .debounceTime(300)
        .switchMap((action) => {
            const state = store.getState();

            // Only act in 3D/Cesium mode
            if (!isCesium(state)) {
                // Switching away from 3D — remove any terrain layers we added
                const existing = getExistingTerrain(state);
                if (existing) {
                    return Rx.Observable.of(removeLayer(existing.id));
                }
                return Rx.Observable.empty();
            }

            // Don't re-trigger on our own terrain layer additions/removals
            if (action.type === ADD_LAYER && (
                action.layer?.id === TERRAIN_MAPTILER_ID || action.layer?.id === TERRAIN_DEM_ID
            )) {
                return Rx.Observable.empty();
            }
            if (action.type === REMOVE_LAYER && (
                action.layerId === TERRAIN_MAPTILER_ID || action.layerId === TERRAIN_DEM_ID
            )) {
                return Rx.Observable.empty();
            }

            return reconcileTerrain(state);
        });

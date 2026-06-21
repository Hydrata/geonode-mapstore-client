import Rx from "rxjs";
import {
    addLayer,
    changeLayerProperties,
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
 * Build a WMS BIL terrain layer config from a map layer.
 * @param {Object} layer - a layer from state.layers.flat with name and title
 */
const buildDemTerrain = (layer) => {
    if (!layer?.name) return null;
    const name = layer.name.includes(':') ? layer.name : `geonode:${layer.name}`;
    return {
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
        const demTerrain = buildDemTerrain(demLayer);
        if (!demTerrain) {
            // DEM layer has no valid name — fall through to MapTiler
        } else if (existing?.id === TERRAIN_DEM_ID) {
            // Already have a DEM terrain — update if the source layer changed
            if (existing.name !== demTerrain.name) {
                actions.push(changeLayerProperties(TERRAIN_DEM_ID, {
                    name: demTerrain.name,
                    title: demTerrain.title
                }));
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

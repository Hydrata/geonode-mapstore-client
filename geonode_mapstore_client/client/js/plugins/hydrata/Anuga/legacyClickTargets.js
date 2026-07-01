/*
 * TASK-1996 (W3.1) — Register legacy FeatureGrid prefixes with READ-ONLY
 * view-attributes openers into the click-target registry.
 *
 * These prefixes (terrain_, ele_, cat_, nod_, lin_, full_mesh_, network_)
 * are not in ANUGA_FEATURE_CONFIG's VectorDraw paths — they use the legacy
 * FeatureGrid (browseData) for attribute viewing.  They are EXCLUDED from the
 * VectorDraw EDIT flow, so they get READ-ONLY openers here.
 *
 * C1 (perms-gate partition): tagging these targets with `readOnly: true`
 * causes the classifier epic to bypass filterEditableCandidates and instead
 * gate on layer visibility only — so the browse-data row appears even for
 * users who may not edit the layer.
 *
 * C2 (D6): every dispatched action is a plain object:
 *   closeFeatureGrid()       → {type: CLOSE_FEATURE_GRID, closer: undefined}
 *   selectFeatures([])       → {type: SELECT_FEATURES, features: []}
 *   setOpenMenuGroupId(null) → {type: SET_OPEN_MENU_GROUP_ID, openMenuGroupId: null}
 *   setPermission({…})       → {type: SET_PERMISSION, permission: {canEdit: true}}
 *   svSelectLayer(layer)     → {type: SV_SELECT_LAYER, layer}
 *   browseData(layer)        → {type: BROWSE_DATA, layer}
 * All are JSON-derived objects — structuredClone-safe.
 *
 * C4: mirrors anugaClickTargets.js (register-in-loop, same import paths, same
 * invocation pattern at module level in Anuga.js).
 */
import {
    registerClickTarget,
    parseFeatureId
} from '../shared/clickTargetRegistry';
import { browseData } from '../../../../MapStore2/web/client/actions/layers';
import {
    closeFeatureGrid,
    selectFeatures,
    setPermission
} from '../../../../MapStore2/web/client/actions/featuregrid';
import {
    svSelectLayer,
    setOpenMenuGroupId
} from '../SimpleView/actionsSimpleView';

// Strip an optional leading workspace namespace so bare and prefixed names compare equal.
const bareLayerName = (name) => String(name || '').replace(/^[^:./]+:/, '');

// The 7 non-VectorDraw legacy prefixes that fall through to browseData in
// simpleViewMenuRow.js (lines 736-745). Note that `ele_` covers both legacy
// elevation-vector layers AND terrain rasters (ele_*_cog); for the raster case
// the match() guard (!!featureId) prevents a false match (rasters have id="").
export const LEGACY_PREFIXES = [
    'terrain_', 'ele_', 'cat_', 'nod_', 'lin_', 'full_mesh_', 'network_'
];

const LEGACY_LABEL_TITLE = {
    'terrain_':   'Terrain',
    'ele_':       'Elevation',
    'cat_':       'Category',
    'nod_':       'Node',
    'lin_':       'Link',
    'full_mesh_': 'Mesh',
    'network_':   'Network'
};

/**
 * Register every legacy FeatureGrid prefix with the shared READ-ONLY
 * view-attributes opener.  Called explicitly by Anuga.js at module load —
 * kept out of this file's module scope so unit tests can cleanClickTargets()
 * freely without restoring anything.
 */
export const registerLegacyClickTargets = () => {
    LEGACY_PREFIXES.forEach((prefix) => {
        registerClickTarget(prefix, {
            // Only match vector (non-empty featureId) hits on this prefix.
            // Empty featureId = raster path (W3.2 rasterClickTargets.js handles
            // ele_ raster COGs); the `!!featureId` guard prevents the two paths
            // from colliding.
            match: (featureId, layerName) =>
                !!featureId && bareLayerName(layerName).startsWith(prefix),

            label: (feature) => ({
                title: LEGACY_LABEL_TITLE[prefix] || prefix,
                // Best-effort description from the feature's properties
                subtitle: (feature && (
                    feature.properties?.description ||
                    feature.properties?.name        ||
                    feature.properties?.title       ||
                    ''
                )) || '',
                icon: 'list'
            }),

            // Mirrors simpleViewMenuRow.js:737-745 (legacy FeatureGrid path).
            // All actions are plain objects → structuredClone-safe (C2 / D6).
            buildOpenActions: (feature, getState) => {
                const parsed = parseFeatureId(feature && feature.id);
                if (!parsed) { return []; }
                const state = getState();
                const flat = (state && state.layers && state.layers.flat) || [];
                const bareName = bareLayerName(parsed.layerName);
                const layer = flat.find(
                    (l) => l && bareLayerName(l.name) === bareName
                ) || null;
                if (!layer) { return []; }
                return [
                    closeFeatureGrid(),
                    selectFeatures([]),
                    setOpenMenuGroupId(null),
                    setPermission({ canEdit: true }),
                    svSelectLayer(layer),
                    browseData(layer)
                ];
            },

            // W3 read-only tag: routes this target AROUND filterEditableCandidates
            // in clickDisambiguationEpic (C1).
            readOnly: true
        });
    });
};

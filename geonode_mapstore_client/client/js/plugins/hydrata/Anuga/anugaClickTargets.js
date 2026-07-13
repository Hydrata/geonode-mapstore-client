/*
 * TASK-1992 (W1.3) — Register the 8 editable ANUGA vector prefixes into the
 * click-target registry with ONE shared startVectorDraw EDIT opener.
 *
 * A map click on a boundary / inflow / rainfall / friction / mesh-region /
 * structure / culvert / breakline feature becomes a SECOND route into the
 * SAME startVectorDraw EDIT flow as the SimpleView menu-row pencil
 * (simpleViewMenuRow.onEdit:725-735). The data-entry panel for all 8 vector
 * types is ONE component (VectorDraw/components/VectorDrawPopup.js) parameterised
 * by formConfig — so this is ONE shared opener built in a loop, NOT eight
 * (D4). Additive + low blast radius: the SimpleView pencil is untouched.
 *
 * EDIT branch (D3): startVectorDraw with featureId set + allowPick:false routes
 * vectorDrawStartEpic (epicsVectorDraw.js:85,229) into
 * describe -> loadFeature -> seedFormValues -> edit. The WFS featureID is the
 * full GML id "<typeName>.<fid>" (== the GFI feature.id) — exactly what the
 * existing pick->edit path passes (VectorDrawPopup.js:312 -> selectExistingFeature
 * -> loadFeature's featureID param). NOT properties.fid (that is Swamm's REST
 * BMP id, a different API).
 *
 * D6: buildOpenActions returns ONLY the plain startVectorDraw action; the
 * registry functions live module-side and never ride in a dispatched action.
 * The formConfigs are already structured-clone-safe (the 2026-06-23
 * DiscriminatorPicker fix — see VectorDraw/discriminatorRegistry.js).
 *
 * The editable vector prefixes are derived from ANUGA_FEATURE_CONFIG: every
 * entry with a non-null formConfig and a non-Raster geomType. This naturally
 * EXCLUDES 'fri_raster_' (geomType:'Raster', formConfig:null — rasters are
 * W3.2, not W1) and yields exactly the 8 vector prefixes.
 */
import {
    registerClickTarget,
    parseFeatureId
} from '../shared/clickTargetRegistry';
import {
    ANUGA_FEATURE_CONFIG,
    getAnugaPrefix
} from '../SimpleView/components/simpleViewMenuRow';
import { startVectorDraw } from '../VectorDraw/actionsVectorDraw';

// Strip an optional leading workspace namespace ("<ws>:") so a feature id /
// layer name that arrives workspace-qualified ("geonode:bdy_1_b.5") is reduced
// to the bare form GeoServer WFS GetFeature consumes. A bare id (no colon
// before the first '.'/'/') is returned unchanged. (TASK-1995 W2.3 carry-forward:
// GeoServer GeoJSON GetFeatureInfo ids are bare today — matching the WFS ids the
// existing pick->edit path passes — but this keeps the opener robust if a
// namespace ever shows up.)
const stripNamespace = (value) => String(value || '').replace(/^[^:./]+:/, '');

// Re-qualify a parsed layer name as the WFS typeName the existing EDIT flow uses
// (matches simpleViewMenuRow.onEdit's layer.name = 'geonode:...'). Namespace-
// tolerant: strips any leading "<ws>:" before re-prefixing the geonode workspace.
const qualifyTypeName = (layerName) =>
    `geonode:${stripNamespace(layerName)}`;

// Editable vector prefixes: non-Raster entries with a real form. Excludes
// 'fri_raster_' (the only Raster / formConfig:null entry).
export const ANUGA_VECTOR_PREFIXES = Object.keys(ANUGA_FEATURE_CONFIG)
    .filter((p) => ANUGA_FEATURE_CONFIG[p].geomType !== 'Raster'
        && !!ANUGA_FEATURE_CONFIG[p].formConfig);

/**
 * Register every editable ANUGA vector prefix with the shared EDIT opener.
 * Called explicitly by the live plugin wiring in W2.3 (TASK-1995); in W1 the
 * unit test drives it (no import-time side effect, so the registry stays clean
 * for other tests).
 */
export const registerAnugaClickTargets = () => {
    ANUGA_VECTOR_PREFIXES.forEach((prefix) => {
        const cfg = ANUGA_FEATURE_CONFIG[prefix];
        registerClickTarget(prefix, {
            // Delegate longest-prefix resolution to the existing helper, which
            // sorts prefixes by length descending — so 'fri_' and a future
            // 'fri_raster_' never both match the same layer (mutually exclusive).
            match: (featureId, layerName) => getAnugaPrefix(layerName) === prefix,
            label: (feature) => ({
                title: cfg.formConfig.title,
                // The per-feature human title disambiguates same-type features
                // in the chooser. PostGIS column is lowercase 'description';
                // Title-case fallback covers legacy rows (mirrors getProp).
                subtitle: feature?.properties?.description
                    || feature?.properties?.Description || '',
                icon: 'pencil'
            }),
            buildOpenActions: (feature) => {
                const parsed = parseFeatureId(feature && feature.id);
                if (!parsed) { return []; }
                return [startVectorDraw({
                    layerName: qualifyTypeName(parsed.layerName),
                    geomType: cfg.geomType,
                    // Bare GML id for the WFS featureID (matches the pick->edit
                    // path); namespace-tolerant if a "<ws>:" prefix is present.
                    featureId: stripNamespace(feature.id),
                    allowPick: false,        // EDIT branch (featureId set, no pick)
                    owner: 'anuga',
                    formConfig: cfg.formConfig,
                    onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE',
                    onCancel: 'ANUGA:VECTOR_DRAW_CANCELLED',
                    // layerName: consumed by vectorDrawRecalcBboxEpic
                    // (TASK-2165) to recalc the dataset bbox after the save.
                    meta: { prefix, source: 'map-click', layerName: qualifyTypeName(parsed.layerName) }
                })];
            }
        });
    });
};

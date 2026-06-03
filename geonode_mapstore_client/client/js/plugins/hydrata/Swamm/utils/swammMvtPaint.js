/**
 * TASK-1192 (W7c) — Client-side MVT cosmetic-paint helpers for the SWAMM BMP
 * working layers (outlet / footprint / watershed).
 *
 * WHY: epic 1321 serves the per-project BMP working view as a single MVT over
 * WMS GetMap. The type/priority/group-profile/status checkboxes must filter
 * features CLIENT-SIDE (cosmetic show/hide) so every project member shares ONE
 * render path within the project authz boundary — NO per-user CQL_FILTER on the
 * tile request (a per-user CQL fragments the cache and defeats sharing).
 *
 * The W5 work deletes BMP working layers from GWC, so these layers are served
 * via DIRECT WMS-MVT (gs-vectortiles GetMap) and MUST NOT be routed through
 * gwcTileRouting/applyGwcRouting (would 404 against the deleted WMTS layer).
 *
 * Mechanism (MapStore2 OL WMSLayer.js): when `options.format` is a vector mime
 * the layer is built as a VectorTileLayer and `options.vectorStyle` is applied
 * via VectorTileUtils.applyStyle() -> getStyle(). A geostyler-format vectorStyle
 * (`{format:'geostyler', styleObj:{rules:[{filter, symbolizers}]}}`) lets us
 * attach a per-rule `filter` (geoStylerStyleFilter, StyleParserUtils.js) that is
 * the show predicate. On every checkbox toggle we re-emit a NEW vectorStyle; the
 * WMSLayer `update` path re-applies it (deep-unequal) — no re-fetch of tiles.
 *
 * UX-PARITY with the old CQL path (filterBmpEpic): when ALL values in a
 * dimension are selected, that dimension is OMITTED from the predicate (a
 * fully-checked group shows everything); when a dimension is partial we OR over
 * its visible values; an empty/none-visible partial dimension yields an
 * impossible match (hides all features).
 */

/** MVT mime served by gs-vectortiles via WMS GetMap. */
export const MVT_FORMAT = 'application/vnd.mapbox-vector-tile';

/**
 * AC#5 TRADEOFF GUARD. A whole-layer MVT was ~3.3MB for dec_bmp_footprint. Above
 * this feature count the cheaper path is the server-side CQL_FILTER (smaller tiles
 * at the cost of per-user cache fragmentation), so we fall back to it. Below it,
 * client-side paint wins (one shared render path). Self-defaulted to the cheaper
 * option per the wave brief; the richer always-MVT path is recorded as a follow-up.
 */
export const BMP_MVT_FEATURE_THRESHOLD = 5000;

/**
 * @param {number|null|undefined} featureCount BMP footprint feature count for the
 *   project, if known. Unknown => default to client paint (cheaper, shared).
 * @returns {boolean} true => fall back to the server-side CQL_FILTER path.
 */
export function shouldUseServerSideCql(featureCount) {
    if (featureCount === null || featureCount === undefined) return false;
    return Number(featureCount) > BMP_MVT_FEATURE_THRESHOLD;
}

// A value no real BMP attribute will equal — makes a partial-but-empty dimension
// an impossible match so the layer renders nothing for that dimension.
const NEVER_MATCH = '__hydrata_none__';

/**
 * Build a single dimension's OR-clause, or null if the dimension should be omitted.
 *
 * @param {string} attribute geostyler feature property name (type/priority/group_profile/status)
 * @param {Array} items reference items with `visibility` + a value accessor
 * @param {(item:Object)=>*} valueOf maps an item to its filter value
 * @returns {Array|null} ['||', ['==', attribute, v], ...] | null (omit dimension)
 */
function buildDimensionClause(attribute, items, valueOf) {
    const list = items || [];
    // Empty reference list => nothing to filter on, omit (parity with old epic).
    if (list.length === 0) return null;
    const visible = list.filter(i => i?.visibility);
    // All selected => omit (show everything for this dimension).
    if (visible.length === list.length) return null;
    if (visible.length === 0) {
        // Partial-but-none-visible => impossible match (hide all).
        return ['||', ['==', attribute, NEVER_MATCH]];
    }
    return ['||', ...visible.map(i => ['==', attribute, valueOf(i)])];
}

/**
 * Build the geostyler show-filter predicate from the current checkbox selections.
 *
 * @param {Object} selections { bmpTypes, priorities, groupProfiles, statuses }
 * @returns {Array|null} ['&&', <clause>, ...] | null (show everything)
 */
export function buildBmpShowFilter(selections = {}) {
    const { bmpTypes, priorities, groupProfiles, statuses } = selections;
    const clauses = [
        buildDimensionClause('type', bmpTypes, i => i.id),
        buildDimensionClause('priority', priorities, i => i.id),
        buildDimensionClause('group_profile', groupProfiles, i => i.id),
        // status filters by NAME (server attribute), matching the old CQL path.
        buildDimensionClause('status', statuses, i => i.name)
    ].filter(Boolean);
    if (clauses.length === 0) return null;
    return ['&&', ...clauses];
}

// Cosmetic symbolizers per BMP geometry role. Cohesive with the SWAMM palette;
// the prod canary (operator test_gate) validates exact render — these are
// reasonable defaults, not the authoritative per-type/per-status styling (that
// stays server-side in the published GeoServer styles).
function symbolizersForRole(role) {
    switch (role) {
    case 'outlet':
        return [{
            kind: 'Mark',
            wellKnownName: 'Circle',
            color: '#54ACD2',
            radius: 5,
            strokeColor: '#1f6f8b',
            strokeWidth: 1
        }];
    case 'watershed':
        return [
            { kind: 'Fill', color: '#54ACD2', fillOpacity: 0.15 },
            { kind: 'Line', color: '#1f6f8b', width: 1 }
        ];
    case 'footprint':
    default:
        return [
            { kind: 'Fill', color: '#34de34', fillOpacity: 0.4 },
            { kind: 'Line', color: '#2a9d2a', width: 1 }
        ];
    }
}

/**
 * Build a MapStore2 geostyler `vectorStyle` for a BMP layer role with the
 * current selections folded into the rule filter.
 *
 * @param {('outlet'|'footprint'|'watershed')} role
 * @param {Object} selections { bmpTypes, priorities, groupProfiles, statuses }
 * @returns {Object} { format: 'geostyler', styleObj: { name, rules } }
 */
export function buildBmpVectorStyle(role, selections = {}) {
    const filter = buildBmpShowFilter(selections);
    const rule = {
        name: `bmp_${role}`,
        symbolizers: symbolizersForRole(role)
    };
    // Only attach a filter when partial — undefined means "match all features".
    if (filter) rule.filter = filter;
    return {
        format: 'geostyler',
        styleObj: {
            name: `bmp_${role}_paint`,
            rules: [rule]
        }
    };
}

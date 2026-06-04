/**
 * TASK-1192 (W7c) + TASK-1463 (W7d) — Client-side MVT cosmetic-paint helpers
 * for the SWAMM BMP working layers (outlet / footprint / watershed).
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
 *
 * TASK-1463: footprint uses OPERATIONAL symbology — Fill keyed on status (name),
 * Line keyed on priority (int) — rendered as separate layers of rules so OL
 * VectorTile applies all matching rules per feature:
 *   - Status fill rules (one per known status + a catch-all default)
 *   - Priority line rules (one per known priority + a catch-all default)
 * The show-filter (checkbox visibility) is AND-composed into every rule's filter
 * so it composes correctly with the symbolizer predicate.
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

// ---------------------------------------------------------------------------
// Footprint operational symbology (TASK-1463)
// custom_dec_bmp_footprint: Fill keyed on status name; Line keyed on priority int.
// Colours confirmed against TASK-1443 prod red-team; operator validates at gate.
// ---------------------------------------------------------------------------

// Fill colour by status name. Features whose status is NOT in this map receive no
// fill rule and will render transparent until the operator confirms the desired
// default at the W7d test_gate (tracked as a novel_question).
const STATUS_FILL = {
    Unknown: '#ffffff',
    Proposed: '#9BABB8',
    Hypothetical: '#9BABB8',
    Pending: '#9BABB8',
    Approved: '#9BABB8'
};

// Stroke colour + width by priority int. Features whose priority is NOT in this
// map receive no stroke rule (transparent stroke) pending operator gate confirmation.
const PRIORITY_STROKE = {
    0: { color: '#ffffff', width: 1 },
    1: { color: '#ff0000', width: 2 }, // critical
    2: { color: '#ffbf00', width: 2 }, // amber
    3: { color: '#ffffff', width: 1 }
};

/**
 * Compose a rule filter from the show-filter and an optional symbolizer predicate.
 *
 * @param {Array|null} showFilter the visibility AND-clause (or null = show all)
 * @param {Array|null} symFilter the per-rule symbolizer predicate (or null = match all)
 * @returns {Array|null} composed geostyler filter, or null (no filter = show all)
 */
function composeFilter(showFilter, symFilter) {
    // Both absent — no filter needed (show all features for this rule).
    // Both present — merge their clauses under a single '&&'.
    // showFilter is already ['&&', ...clauses]; symFilter is ['==', attr, val].
    // Flatten to avoid nested ['&&', ['&&', ...], ['==', ...]] — geostyler handles
    // nested '&&' correctly, but a flat form is cleaner.
    const showClauses = showFilter
        ? (showFilter[0] === '&&' ? showFilter.slice(1) : [showFilter])
        : [];
    const symClauses = symFilter ? [symFilter] : [];
    const all = [...showClauses, ...symClauses];
    if (all.length === 0) {
        return null;
    }
    if (all.length === 1) {
        return all[0];
    }
    return ['&&', ...all];
}

/**
 * Build the multi-rule operational style for the footprint role.
 * Emits Fill rules (keyed by status) followed by Line rules (keyed by priority).
 * OL VectorTile applies ALL matching rules per feature, so the fill from the
 * status rule and the stroke from the priority rule stack correctly.
 *
 * @param {Array|null} showFilter from buildBmpShowFilter (null = show everything)
 * @returns {Array} geostyler rule objects
 */
function buildFootprintRules(showFilter) {
    const rules = [];

    // 1. Status fill rules — one per named status.
    Object.entries(STATUS_FILL).forEach(([statusName, fillColor]) => {
        const symFilter = ['==', 'status', statusName];
        rules.push({
            name: `bmp_footprint_status_${statusName}`,
            symbolizers: [
                { kind: 'Fill', color: fillColor, fillOpacity: 0.5 }
            ],
            filter: composeFilter(showFilter, symFilter)
        });
    });

    // 2. Priority line rules — one per known priority int.
    // geostyler '==' with numeric priority: ['==', 'priority', <number>].
    // Features with null/unrecognised priority receive no stroke rule (transparent)
    // pending operator gate confirmation (tracked as a novel_question).
    Object.entries(PRIORITY_STROKE).forEach(([priorityStr, stroke]) => {
        const priorityVal = Number(priorityStr);
        const symFilter = ['==', 'priority', priorityVal];
        rules.push({
            name: `bmp_footprint_priority_${priorityVal}`,
            symbolizers: [
                { kind: 'Line', color: stroke.color, width: stroke.width }
            ],
            filter: composeFilter(showFilter, symFilter)
        });
    });

    return rules;
}

/**
 * Build symbolizers for the non-footprint roles (outlet / watershed).
 * These roles do not yet have a documented operational style separate from the
 * geostory style. The current cosmetic fallback is retained until the operator
 * confirms the desired symbology at the W7d test_gate.
 * Tracked as a novel_question for the gate.
 *
 * @param {('outlet'|'watershed')} role
 * @returns {Array} geostyler symbolizer objects
 */
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
    default:
        // Should not be reached for known roles.
        return [
            { kind: 'Fill', color: '#54ACD2', fillOpacity: 0.15 },
            { kind: 'Line', color: '#1f6f8b', width: 1 }
        ];
    }
}

/**
 * Build a MapStore2 geostyler `vectorStyle` for a BMP layer role with the
 * current selections folded into the rule filter.
 *
 * For the 'footprint' role: emits an operational multi-rule style (Fill per
 * status + Line per priority) so operators see each BMP's critical/status
 * symbology at a glance. The show-filter from checkbox selections is AND-composed
 * into every rule's filter.
 *
 * For 'outlet' / 'watershed': emits the existing single-rule cosmetic style until
 * an operational style is confirmed at the operator gate (see novel_questions).
 *
 * @param {('outlet'|'footprint'|'watershed')} role
 * @param {Object} selections { bmpTypes, priorities, groupProfiles, statuses }
 * @returns {Object} { format: 'geostyler', styleObj: { name, rules } }
 */
export function buildBmpVectorStyle(role, selections = {}) {
    const showFilter = buildBmpShowFilter(selections);

    if (role === 'footprint') {
        return {
            format: 'geostyler',
            styleObj: {
                name: 'bmp_footprint_paint',
                rules: buildFootprintRules(showFilter)
            }
        };
    }

    // outlet / watershed — single cosmetic rule, show-filter only.
    const rule = {
        name: `bmp_${role}`,
        symbolizers: symbolizersForRole(role)
    };
    // Only attach a filter when partial — undefined means "match all features".
    if (showFilter) rule.filter = showFilter;
    return {
        format: 'geostyler',
        styleObj: {
            name: `bmp_${role}_paint`,
            rules: [rule]
        }
    };
}

// Export colour maps for downstream consumers (e.g. legend components, unit tests).
export { STATUS_FILL, PRIORITY_STROKE };

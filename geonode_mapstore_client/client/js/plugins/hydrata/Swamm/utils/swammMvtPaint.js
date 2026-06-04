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
 * TASK-1463/TASK-1474: all three roles use OPERATIONAL symbology — fill keyed on
 * status (name), stroke keyed on priority (int) — instead of a flat cosmetic colour:
 *   - footprint / watershed (polygons): Fill rules per status + Line rules per
 *     priority, applied as separate rules so OL VectorTile stacks them per feature
 *     (watershed at a lower fill opacity so it sits under the overlying layers)
 *   - outlet (point): one circle Mark per feature, fill = status, stroke = priority,
 *     emitted as the status × priority cross product (a Mark can't stack fill+stroke
 *     as two independent rules)
 * TASK-1475: a status outside the known set gets a neutral fallback fill (all roles).
 * The show-filter (checkbox visibility) is AND-composed into every rule's filter so it
 * composes correctly with the symbolizer predicate, preserving the W7c show/hide UX.
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
// Operational symbology (TASK-1463 footprint -> TASK-1474 outlet + watershed)
// Fill keyed on status name; stroke keyed on priority int. Colours confirmed
// against TASK-1443 prod red-team; operator validates live on map 768.
// ---------------------------------------------------------------------------

// Fill colour by status name.
const STATUS_FILL = {
    Unknown: '#ffffff',
    Proposed: '#9BABB8',
    Hypothetical: '#9BABB8',
    Pending: '#9BABB8',
    Approved: '#9BABB8'
};

// TASK-1475: fallback FILL for any status NOT in STATUS_FILL. Operator-chosen
// (2026-06-04): a neutral light grey reads as "other / non-operational" — muted
// like the known fills (#ffffff, #9BABB8) but distinguishable, and leaves the loud
// red/amber reserved for the priority strokes. Replaces the previous transparent
// behaviour (features with an unrecognised status now always carry a fill). Applied
// to all three roles (footprint / outlet / watershed).
const STATUS_FILL_FALLBACK = '#cccccc';

// Stroke colour + width by priority int. Features whose priority is NOT in this
// map receive no stroke rule for the POLYGON roles (transparent boundary, as the
// validated footprint already behaves); the POINT outlet role instead falls back to
// the neutral cosmetic outline below so a marker can never lose its stroke.
const PRIORITY_STROKE = {
    0: { color: '#ffffff', width: 1 },
    1: { color: '#ff0000', width: 2 }, // critical
    2: { color: '#ffbf00', width: 2 }, // amber
    3: { color: '#ffffff', width: 1 }
};

// Outlet marker geometry + the fallback stroke for an unrecognised priority on the
// point role (keeps the pre-1474 cosmetic teal outline so a marker is always visible).
const OUTLET_MARK_RADIUS = 5;
const OUTLET_FALLBACK_STROKE = { color: '#1f6f8b', width: 1 };

/**
 * Compose a rule filter from the show-filter and an optional symbolizer predicate.
 *
 * @param {Array|null} showFilter the visibility AND-clause (or null = show all)
 * @param {Array|null} symFilter the per-rule symbolizer predicate (or null = match all).
 *   May itself be an '&&' clause (e.g. the outlet cross-product status&&priority, or the
 *   De-Morgan "status not in known set" fallback) — its sub-clauses are flattened in.
 * @returns {Array|null} composed geostyler filter, or null (no filter = show all)
 */
function composeFilter(showFilter, symFilter) {
    // Both absent — no filter needed (show all features for this rule).
    // Both present — merge their clauses under a single flat '&&'.
    // showFilter is already ['&&', ...clauses]; symFilter is ['==', attr, val] OR an
    // '&&' clause. Flatten any leading '&&' on either side so we never emit a nested
    // ['&&', ['&&', ...], ...] (geostyler handles nesting, but a flat form is cleaner
    // and keeps the unit-test predicate assertions simple).
    const flatten = (f) => f ? (f[0] === '&&' ? f.slice(1) : [f]) : [];
    const all = [...flatten(showFilter), ...flatten(symFilter)];
    if (all.length === 0) {
        return null;
    }
    if (all.length === 1) {
        return all[0];
    }
    return ['&&', ...all];
}

// ---------------------------------------------------------------------------
// Shared operational specs (TASK-1474 generalises TASK-1463 to all three roles).
// A "fill spec" maps a status predicate -> fill colour; a "stroke spec" maps a
// priority predicate -> stroke. footprint/watershed (polygons) consume them as
// separate Fill + Line rules that stack; outlet (point) consumes their CROSS
// PRODUCT as a single Mark per feature (fill = status, stroke = priority), so a
// marker carries BOTH operational cues on one circle.
// ---------------------------------------------------------------------------

// Predicate matching any status NOT in STATUS_FILL. The core geostyler evaluator's
// '!' negation operator is broken (StyleParserUtils.geoStylerStyleFilter case '!'),
// so we use the De-Morgan form: AND of '!=' over every known status name.
const unknownStatusPredicate = () =>
    ['&&', ...Object.keys(STATUS_FILL).map(name => ['!=', 'status', name])];

// Fill specs: one per known status + the TASK-1475 catch-all fallback.
const fillSpecs = () => [
    ...Object.entries(STATUS_FILL).map(([name, color]) => ({
        key: name, color, predicate: ['==', 'status', name]
    })),
    { key: 'other', color: STATUS_FILL_FALLBACK, predicate: unknownStatusPredicate() }
];

// Stroke specs for the POLYGON roles: one per known priority int. No fallback line
// (preserves the validated footprint behaviour — unrecognised priority = no boundary).
// '==' string-coerces in the core evaluator, so a numeric value matches a tile that
// serialises priority as either int or string (verified moot for TASK-1474 #2).
const priorityStrokeSpecs = () =>
    Object.entries(PRIORITY_STROKE).map(([p, stroke]) => ({
        key: p, stroke, predicate: ['==', 'priority', Number(p)]
    }));

/**
 * Build the multi-rule operational style for a POLYGON role (footprint / watershed).
 * Emits Fill rules (keyed by status, incl. the fallback) followed by Line rules
 * (keyed by priority). OL VectorTile applies ALL matching rules per feature, so the
 * status fill and the priority stroke stack correctly.
 *
 * @param {('footprint'|'watershed')} role
 * @param {Array|null} showFilter from buildBmpShowFilter (null = show everything)
 * @param {number} fillOpacity per-role fill opacity (footprint 0.5; watershed 0.25)
 * @returns {Array} geostyler rule objects
 */
function buildPolygonRules(role, showFilter, fillOpacity) {
    const rules = [];

    // 1. Status fill rules — one per named status + the fallback.
    fillSpecs().forEach(spec => {
        rules.push({
            name: `bmp_${role}_status_${spec.key}`,
            symbolizers: [
                { kind: 'Fill', color: spec.color, fillOpacity }
            ],
            filter: composeFilter(showFilter, spec.predicate)
        });
    });

    // 2. Priority line rules — one per known priority int.
    priorityStrokeSpecs().forEach(spec => {
        rules.push({
            name: `bmp_${role}_priority_${spec.key}`,
            symbolizers: [
                { kind: 'Line', color: spec.stroke.color, width: spec.stroke.width }
            ],
            filter: composeFilter(showFilter, spec.predicate)
        });
    });

    return rules;
}

/**
 * Build the multi-rule operational style for the POINT outlet role.
 * A circle Mark cannot stack fill and stroke as two independent rules (that would
 * paint two overlapping circles), so we emit the CROSS PRODUCT of status × priority:
 * each rule is one Mark whose FILL is driven by status and whose STROKE is driven by
 * priority (priority=1 -> red outline). Every feature matches exactly one rule, so the
 * marker carries both cues on a single circle. The status set includes the TASK-1475
 * fallback; the priority set includes a neutral cosmetic fallback so an outlet with an
 * unrecognised priority still gets an outline (a marker can never lose its stroke).
 *
 * @param {Array|null} showFilter from buildBmpShowFilter (null = show everything)
 * @returns {Array} geostyler rule objects
 */
function buildOutletRules(showFilter) {
    const fills = fillSpecs();
    const strokes = [
        ...priorityStrokeSpecs(),
        {
            key: 'other',
            stroke: OUTLET_FALLBACK_STROKE,
            // De-Morgan negation: priority not in the known set.
            predicate: ['&&', ...Object.keys(PRIORITY_STROKE).map(p => ['!=', 'priority', Number(p)])]
        }
    ];

    const rules = [];
    fills.forEach(f => {
        strokes.forEach(s => {
            const symFilter = ['&&', f.predicate, s.predicate];
            rules.push({
                name: `bmp_outlet_${f.key}_${s.key}`,
                symbolizers: [{
                    kind: 'Mark',
                    wellKnownName: 'Circle',
                    color: f.color,
                    radius: OUTLET_MARK_RADIUS,
                    strokeColor: s.stroke.color,
                    strokeWidth: s.stroke.width
                }],
                filter: composeFilter(showFilter, symFilter)
            });
        });
    });
    return rules;
}

/**
 * Build a MapStore2 geostyler `vectorStyle` for a BMP layer role with the
 * current selections folded into the rule filter.
 *
 * All three roles now use OPERATIONAL symbology (TASK-1474, generalising TASK-1463):
 *   - footprint (polygon): Fill per status + Line per priority, fill opacity 0.5
 *   - watershed (polygon): Fill per status + Line per priority, fill opacity 0.25 so
 *     it sits UNDER the footprints/outlets that overlay it
 *   - outlet (point): one circle Mark per feature, fill = status, stroke = priority
 * The show-filter from the checkbox selections is AND-composed into every rule's
 * filter, preserving the W7c show/hide UX.
 *
 * @param {('outlet'|'footprint'|'watershed')} role
 * @param {Object} selections { bmpTypes, priorities, groupProfiles, statuses }
 * @returns {Object} { format: 'geostyler', styleObj: { name, rules } }
 */
export function buildBmpVectorStyle(role, selections = {}) {
    const showFilter = buildBmpShowFilter(selections);

    let rules;
    if (role === 'outlet') {
        rules = buildOutletRules(showFilter);
    } else if (role === 'watershed') {
        rules = buildPolygonRules('watershed', showFilter, 0.25);
    } else {
        // footprint (default) — validated operational style, fill opacity 0.5.
        rules = buildPolygonRules('footprint', showFilter, 0.5);
    }

    return {
        format: 'geostyler',
        styleObj: {
            name: `bmp_${role}_paint`,
            rules
        }
    };
}

// Export colour maps for downstream consumers (e.g. legend components, unit tests).
export { STATUS_FILL, PRIORITY_STROKE };

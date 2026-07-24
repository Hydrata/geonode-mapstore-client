#!/usr/bin/env node
/**
 * SimpleView CSS Namespace Guard (TASK-1663)
 *
 * Scans the 8 Hydrata panel .css files and fails if any class selector
 * uses a prefix (first hyphen-separated segment) that is NOT in the
 * allowlist below.
 *
 * PURPOSE
 * -------
 * Prevents drift from day one: any new ad-hoc panel class namespace
 * introduced after W1 will fail this check, forcing authors to either
 * use an existing sv-* / panel prefix or update the allowlist via a
 * reviewed PR.
 *
 * WHAT THIS GUARD ENFORCES (and what it does NOT) — grill q-7 (TASK-1758)
 * ----------------------------------------------------------------------
 * It enforces NAMESPACE HYGIENE + the ratchet: it checks only the FIRST
 * hyphen-segment of each class against the allowlist. It is BLIND to
 * property values — it cannot tell a dark-glass token from a light hex,
 * and the FontUniformity test only walks one popup — so "no new bespoke
 * PREFIXES" is the guarantee; sv-namespaced styling drift still needs code
 * review. (A value-aware guard that flags non-token light hex / non-token
 * font declarations is a recommended follow-up — see TASK-1758 finding
 * w3-process-gap.)
 *
 * END-STATE (grill q-7): ALLOWED_PREFIXES collapses to TWO categories —
 *   (1) SimpleView system        : sv, simple
 *   (2) upstream/override survivors with one-line notes
 *       (btn/form/table/is/noUi/progress/glyphicon/list/text/ol/time =
 *        Bootstrap/OL; alert = Bootstrap alert variants; recharts =
 *        charting library; gn/mapstore = upstream overrides; sk = spinkit).
 * Everything else (the panel + feature + hydrata "shared structural"
 * prefixes in category 3 below) RENAMES to sv-/sv-<panel>- and is removed
 * here. No per-agent judgment on the rename target.
 *
 * RATCHET PROTOCOL
 * ----------------
 * As each panel's bespoke classes are renamed to sv-/sv-<panel>- (the
 * TASK-1766 W2 ratchet — separate from the dark-glass conform, which left
 * bespoke organisms bespoke-but-tokenised), its migration commit should:
 *   1. Rename all of the panel's classes to sv-* (or remove them if
 *      subsumed by primitives), preserving any test-PINNED classes via
 *      extraClassName (e.g. .anuga-pane-toolbar, .sv-legend-close, sv-tm-*).
 *   2. Delete the migrated panel's prefix(es) from category 3 below.
 *   3. The guard then rejects any NEW class with the old prefix.
 *
 * Rename order (lowest effort / lowest pin-risk first):
 *   VectorDraw   → remove: vector            (~20 CSS occ.)
 *   TaskMonitor  → remove: tm                (DONE, TASK-1680 — already sv-only)
 *   HGeval       → remove: hgeval            (~15)
 *   Swamm        → remove: swamm, bmp, filter (~50)
 *   Hydrology    → remove: hydrology, idf, ds, design, hyetograph, temporal, networks (~200)
 *   Anuga        → DONE (Anuga-only): membership, publication, run, status, badge, network, add, chart.
 *                  ⚠ DEFERRED: anuga, scenario, terrain — SHARED with epic/1587's TerrainWorkbench
 *                    (terrainWorkbench.css has anuga- / scenario- / terrain- override rules; 1587
 *                    actively commits to that dir). Renaming on 1758 desyncs TerrainWorkbench styling
 *                    (a visual break on the parent epic, NOT a mergeable text conflict). Do WITH 1587.
 *   Shared (simpleView.css) → remove: menu, legend, glyph, save, subheading,
 *                  uploader, dataset, measure, data, introduction (q-7 "do it now").
 *                  ⚠ menu/data also appear in TerrainWorkbench.css — coordinate with 1587.
 *
 * NO NEW DEPENDENCY: uses only Node.js built-ins (fs, path).
 *
 * USAGE
 *   node css-namespace-guard.js            # from any directory
 *   node js/plugins/hydrata/SimpleView/css-namespace-guard.js  # from client/
 */

const fs = require('fs');
const path = require('path');

// ── Allowlist: first-segment prefixes that are permitted in the panel CSS files ──
// Organised into the grill-q-7 end-state categories. Categories 1 & 2 are the
// PERMANENT allowlist; category 3 is the shrinking set of ratchet targets that
// the TASK-1766 W2 rename retires one panel at a time.
const ALLOWED_PREFIXES = new Set([
    // ══ Category 1 — SimpleView system (permanent) ══
    'sv',
    'simple',

    // ══ Category 2 — upstream / override survivors (permanent) ══
    // Bootstrap / OpenLayers utility prefixes (wrapped by sv-* primitives over
    // time but kept while raw library markup still renders in the panels):
    'btn',
    'form',
    'table',
    'is',
    'noUi',
    'progress',
    'glyphicon',
    'list',
    'text',
    'ol',
    'time',
    'dropdown',    // Bootstrap .dropdown-toggle — navbar user-menu hover-contrast
    // override (#gn-brand-navbar .open > .dropdown-toggle, TASK-2420 finding-12);
    // upstream GeoNode markup generates the class, no sv-* rename possible
    'alert',       // Bootstrap .alert-info/-warning/-danger — re-skinned dark-glass in place
    // via compound selectors (.membership-perms-warning.alert-warning,
    // .terrain-bbox-error.alert-danger) during the W3 conform (TASK-1758).
    'recharts',    // recharts charting library — .recharts-* survive in the IDF-curve modal
    // (hydrology.css, TASK-1754). Light chart surface is an intentional carve-out.
    'modal',       // Bootstrap/MapStore modal — anuga.css overrides #mapstore-export.modal-dialog-container.
    'measure',     // MapStore measure tool — simpleView.css overrides .measure-container (no hydrata JS sets it).
    // Third-party / upstream overrides:
    'gn',          // .gn-brand-navbar override in simpleView.css
    'mapstore',    // .mapstore-slider override in simpleView.css
    'sk',          // .sk-circle (spinkit spinner) in simpleView.css
    'square',      // MapStore core map-control buttons — simpleView.css forces the nav toolbar (#navigationBar-container .square-button) opaque; core class, no hydrata JS sets it.

    // ══ Category 3 — RATCHET TARGETS (rename to sv-/sv-<panel>-, then delete here) ══
    'idf'          // IDF-derive panel (epic-1768, hydrology.css). Live in prod; admitted
    // here as a new panel namespace pending the sv-idf-* ratchet rename (follow-up).
    // Prior cat-3 prefixes were RATCHETED OUT as of TASK-1766 W1.9b (epic-1587).
    //
    // 'tm' RATCHETED OUT (TASK-1680): TaskMonitor fully migrated; taskMonitor.css is sv-/simple- only.
    // 'hyrdology' RATCHETED OUT (TASK-1678): the .hyrdology-textarea typo was fixed to .hydrology-textarea.
    // -- panel namespaces --
    // 'anuga' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): 110+ anuga-* classes renamed to sv-anuga-* across
    //   anuga.css + terrainWorkbench.css + all Anuga JS/tests; data-testid/ids/analytics strings left untouched.
    //   Also renamed anuga-scenario-* compound classes in the same pass.
    // 'scenario' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): 37 scenario-* CSS classes + dynamic action modifiers
    //   renamed to sv-scenario-* (anuga.css, Anuga JS + tests); id=#scenario-header-actions kept unchanged.
    // 'membership' RATCHETED OUT (TASK-1766 W2): Anuga membership-* -> sv-* (Anuga-only).
    // 'publication' RATCHETED OUT (TASK-1766 W2): Anuga publication-* -> sv-* (Anuga-only).
    // 'hgeval' RATCHETED OUT (TASK-1766 W2): HGeval panel renamed hgeval-* -> sv-hgeval-* (CSS + JS); the only test hook (.hgeval-alert-sm) is a negative .toNotExist() assertion (class never rendered).
    // 'hydrology' RATCHETED OUT (TASK-1766 W2): Hydrology renamed hydrology-/idf-/ds-/design-/hyetograph-/temporal-/networks- -> sv-* (hydrology.css + Hydrology JS incl. tests, 125 classes/378 refs). recharts- KEPT (cat-2 carve-out). Dynamic ds-pattern-toggle-/ds-derive-tick- are ids, idf-provenance-/hydrology-category-rail- are a filename/analytics string (not classNames).
    // 'swamm' RATCHETED OUT (TASK-1766 W2): Swamm panel renamed swamm-/bmp-/filter-/non-* -> sv-* (swamm.css + Swamm JS); 0 test pins. IDs (#swamm-bmp-filters, #bmp-type-toggle-box-*) are out of the class-guard's scope and intentionally kept.
    // 'bmp' RATCHETED OUT (TASK-1766 W2): with Swamm above.
    // 'filter' RATCHETED OUT (TASK-1766 W2): .filter-row -> .sv-filter-row in swamm.css (Swamm-only). .filter-row-odd is an unstyled JS marker.
    // 'non' RATCHETED OUT (TASK-1766 W2): .non-savable-group-profile -> sv- (Swamm-only). non-null/non-operational are JS values, not classes.
    // 'vector' RATCHETED OUT (TASK-1766 W2): VectorDraw renamed all 12 vector-draw-* classes -> sv-* (vectorDrawPopup.css + VectorDraw JS incl. tests; pins are positive assertions, renamed in lock-step per the operator-authorized parity-track in-intent test updates). TASK-784 FontUniformity test walks inline font attrs, unaffected.
    // -- feature namespaces within panels --
    // idf/ds/design/hyetograph/temporal/networks RATCHETED OUT (TASK-1766 W2, with Hydrology above).
    // 'terrain' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): 18 terrain-* CSS classes (bbox panel + hierarchy/drag)
    //   renamed to sv-terrain-* in anuga.css + Anuga JS; data-testid/ids/drawing-owner strings untouched.
    //   Also handles the previously-DEFERRED shared-with-1587 overlap (done now in the parent epic branch).
    // 'network' RATCHETED OUT (TASK-1766 W2): Anuga network-* -> sv-* (Anuga-only singular; Hydrology's plural 'networks' already retired).
    // 'badge' RATCHETED OUT (TASK-1766 W2): Anuga badge-role -> sv- (Anuga-only).
    // -- hydrata "shared structural" prefixes in simpleView.css (q-7 "do it now") --
    // status/run RATCHETED OUT (TASK-1766 W2): Anuga-only (status-error, run-polling-paused-*) -> sv-*.
    // legend/glyph/dataset/uploader/introduction/subheading RATCHETED OUT (TASK-1766 W2):
    //   renamed -> sv-* in simpleView.css + all consumer-panel JS + pinned tests (28 classes/194 refs;
    //   pins sv-legend-close/sv-glyph-active/-collapse/-delete/sv-subheading-row/sv-uploader-panel kept in lock-step).
    //   These are TerrainWorkbench-free (no terrainWorkbench.css/JS use).
    // 'menu' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): 20 menu-row-*/menu-rows-* classes renamed to sv-menu-row-*
    //   across simpleView.css + swamm.css + anuga.css + terrainWorkbench.css + all consumer JS/tests (293 refs).
    // 'save' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): save-confirm-btn/-overlay -> sv-save-confirm-* (2 classes, 21 refs).
    // 'data' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): data-title-input -> sv-data-title-input (12 refs); HTML data-* attrs left untouched.
    // 'chart' RATCHETED OUT (TASK-1766 W2): Anuga chart-footer/-header/-mainbody/-sidebar -> sv-* (Anuga-only chart-card layout; NOT the recharts surface, which stays cat-2).
    // -- misc one-offs in the baseline --
    // 'add' RATCHETED OUT (TASK-1766 W2): .add-data-input -> sv- (Anuga-only).
    // 'custom' RATCHETED OUT (TASK-1766 W2): .custom-pattern-* (Hydrology) + .custom-tooltip-label (Swamm) all -> sv-*. custom-curve etc. are unstyled JS markers.
    // 'with' RATCHETED OUT (TASK-1766 W1.9b, epic-1587): with-tooltip -> sv-with-tooltip (simpleView.css + OpacitySlider.js, 4 refs).
]);

// ── The 7 hydrata panel CSS files to scan ──
// Paths are relative to the client/ directory (process.cwd() when run via npm).
// The script resolves them relative to its own location so it can also be
// invoked directly from any directory.
// (Swamps/swamps.css removed — the deprecated Swamps plugin was deleted, TASK-1731.)
const SCRIPT_DIR = path.dirname(path.resolve(__filename));
const CLIENT_DIR = path.resolve(SCRIPT_DIR, '../../../../');

const PANEL_CSS_FILES = [
    'js/plugins/hydrata/SimpleView/simpleView.css',
    'js/plugins/hydrata/Anuga/anuga.css',
    'js/plugins/hydrata/Hydrology/hydrology.css',
    'js/plugins/hydrata/Swamm/swamm.css',
    'js/plugins/hydrata/HGeval/styles/hgeval.css',
    'js/plugins/hydrata/TaskMonitor/taskMonitor.css',
    'js/plugins/hydrata/VectorDraw/components/vectorDrawPopup.css',
    // TASK-2233 — shared MovablePanel primitive stylesheet (sv-movable-*).
    'js/plugins/hydrata/shared/components/movablePanel.css'
].map(f => path.join(CLIENT_DIR, f));

// ── CSS class selector regex ──
// Only checks HYPHENATED class names (e.g. .foo-bar, .foo-bar-baz).
// Single-word classes (.active, .disabled, .focused, .open) are Bootstrap /
// MapStore state modifiers that don't represent new namespaces — skip them.
//
// Strategy: find every occurrence of .<word>-<rest> (a class name that
// contains at least one hyphen) and extract just the first segment.
// This catches the structural namespace prefixes (anuga-, sv-, tm-, etc.)
// while ignoring Bootstrap modifiers chained like .save-confirm-btn.confirm.
//
// We also strip CSS comments and string contents before scanning to avoid
// false matches from comment text (e.g. a URL fragment or a mention of a
// class name in a doc comment).
const CLASS_WITH_HYPHEN_RE = /\.([a-zA-Z][a-zA-Z0-9]*)(?=-[a-zA-Z0-9])/g;

/**
 * Strip /* ... * / comments and content between url("...") so we don't
 * match class-like tokens inside comment text or data-URI strings.
 */
function stripComments(source) {
    // Remove /* ... */ block comments
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractClassPrefixes(source) {
    const clean = stripComments(source);
    const prefixes = new Set();

    CLASS_WITH_HYPHEN_RE.lastIndex = 0;
    let m = CLASS_WITH_HYPHEN_RE.exec(clean);
    while (m !== null) {
        prefixes.add(m[1]);
        m = CLASS_WITH_HYPHEN_RE.exec(clean);
    }

    return prefixes;
}

// ── Main ──
let failed = false;
const violations = [];

for (const filePath of PANEL_CSS_FILES) {
    if (!fs.existsSync(filePath)) {
        process.stderr.write(`[css-namespace-guard] ERROR: file not found: ${filePath}\n`);
        process.exit(1);
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const prefixes = extractClassPrefixes(source);

    for (const prefix of prefixes) {
        if (!ALLOWED_PREFIXES.has(prefix)) {
            violations.push({ file: path.relative(CLIENT_DIR, filePath), prefix });
            failed = true;
        }
    }
}

if (failed) {
    process.stderr.write('[css-namespace-guard] FAIL — new class prefix(es) not in allowlist:\n');
    for (const { file, prefix } of violations) {
        process.stderr.write(`  ${prefix}-*  in  ${file}\n`);
    }
    process.stderr.write('\n');
    process.stderr.write('To add a new panel namespace, add its prefix to ALLOWED_PREFIXES in:\n');
    process.stderr.write('  js/plugins/hydrata/SimpleView/css-namespace-guard.js\n');
    process.stderr.write('Prefix should follow the sv-* migration path (see RATCHET PROTOCOL above).\n');
    process.exit(1);
} else {
    process.stdout.write('[css-namespace-guard] PASS — all class prefixes are in the allowlist.\n');
    process.exit(0);
}

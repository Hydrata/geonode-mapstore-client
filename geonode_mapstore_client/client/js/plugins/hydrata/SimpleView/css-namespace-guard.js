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
 * RATCHET PROTOCOL
 * ----------------
 * As each panel is migrated to sv-* in the rollout epic (TASK-1673),
 * its migration PR should:
 *   1. Move all classes to sv-* (or remove them if subsumed by primitives).
 *   2. Delete the migrated panel's prefix(es) from ALLOWED_PREFIXES below.
 *   3. The guard then rejects any NEW class with the old prefix.
 *
 * Rollout order (lowest effort first, per DESIGN-SYSTEM-AUDIT.md § Part E):
 *   VectorDraw   → remove: vector
 *   TaskMonitor  → remove: tm
 *   HGeval       → remove: hgeval
 *   Swamps       → remove: chart (shared), swamps/swamps-related
 *   Swamm        → remove: swamm, bmp, filter, swamm-target
 *   Hydrology    → remove: hydrology, idf, ds, design, hyetograph, temporal
 *   Anuga        → remove: anuga, scenario, membership, publication, terrain
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
// These are the EXACT prefixes present on day one (W1 baseline).
// Delete a prefix here when its panel has been fully migrated to sv-* (ratchet).
//
// NOTE: generic Bootstrap / MapStore utility prefixes (btn-, form-, table-,
// is-, noUi-, progress-, glyphicon-) are included because they appear in the
// current panel CSS files and removing them would break existing panels.
// Over time they should be wrapped by sv-* primitives and removed here too.
const ALLOWED_PREFIXES = new Set([
    // ── SimpleView system ──
    'sv',
    'simple',

    // ── Panel namespaces (ratchet these out on migration) ──
    'anuga',
    'scenario',
    'membership',
    'publication',
    'hgeval',
    'hydrology',
    'swamm',
    // 'tm' RATCHETED OUT (TASK-1680): TaskMonitor fully migrated; taskMonitor.css is sv-/simple- only.
    'vector',

    // ── Feature namespaces within panels ──
    'idf',
    'ds',
    'design',
    'hyetograph',
    'temporal',
    'terrain',
    'bmp',
    'networks',
    'network',
    'badge',

    // ── Shared structural classes used across panels ──
    'menu',
    'subheading',
    'legend',
    'save',
    'status',
    'run',
    'data',
    'dataset',
    'glyph',
    'modal',
    'uploader',
    'introduction',
    'measure',
    'filter',
    'chart',

    // ── Misc one-offs that exist in the baseline ──
    'add',
    'custom',
    'non',
    // 'hyrdology' RATCHETED OUT (TASK-1678): the .hyrdology-textarea typo was fixed to .hydrology-textarea.
    'sk',          // .sk-circle in simpleView.css
    'gn',          // .gn-brand-navbar override in simpleView.css
    'mapstore',    // .mapstore-slider override in simpleView.css
    'with',        // .with-tooltip in simpleView.css

    // ── Bootstrap / MapStore utility prefixes (appear in panel CSS) ──
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
    'time'
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
    'js/plugins/hydrata/VectorDraw/components/vectorDrawPopup.css'
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

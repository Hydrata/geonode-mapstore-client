#!/usr/bin/env node
/**
 * Paywall / compute-meter CSS coverage guard (TASK-2437, epic 2425 W2).
 *
 * Fails when a paywall or compute-meter component emits a className that has
 * NO matching rule in any stylesheet that can reach the bundle.
 *
 * WHY THIS EXISTS
 * ---------------
 * Epic 2425's dogfood found the same defect twice, independently: markup
 * shipped without its stylesheet. The compute-meter refusal modal rendered
 * below the fold of a non-scrollable document because every compute-meter-*
 * rule in the bundle was scoped `.msgapi .sv-account-billing-tab
 * .compute-meter-*` -- written for the Billing tab, never for the map mount.
 * The estimate over-balance badge had no rule at all. A paying customer met
 * the first one in production.
 *
 * Karma cannot catch this: jsdom has no layout engine and no cascade worth
 * testing against, so a component with zero applicable rules renders and
 * passes. The W0 browser tests catch it at runtime; this catches it at build
 * time, which is cheaper and earlier.
 *
 * SCOPE -- deliberately narrow (see TASK-2437's own guidance)
 * -----------------------------------------------------------
 * Watched prefixes, not whole files: a repo-wide check would drown in
 * MapStore2 upstream and dynamic classNames and be switched off within a
 * week. Only the three namespaces this epic owns are watched, and only in the
 * files that emit them.
 *
 * "NO RULE ANYWHERE" vs "A RULE I DID NOT PARSE"
 * ----------------------------------------------
 * The prod evidence for this epic came from walking ALL 8,854 loaded rules,
 * and that is the standard to match. This guard therefore parses every
 * stylesheet SOURCE that can reach the bundle -- Hydrata plugin CSS, the
 * GeoNode theme LESS, and MapStore2's upstream themes -- and prints the
 * parsed-source inventory with file counts on every run, so the boundary of
 * the claim is always visible rather than implied. See STYLE_ROOTS for why it
 * parses sources rather than the built artifact.
 *
 * CHECK 2: EVERY-RULE-ANCESTOR-SCOPED (W2 remediation)
 * ----------------------------------------------------
 * The W2 review broke check 1 on purpose and it held the door open: re-scope
 * all 23 meter.css rules to `.sv-account-billing-tab .compute-meter-*` --
 * byte-for-byte the shape of the production defect -- and check 1 still exits
 * 0, because every className still "has a rule". So a second, independent
 * check runs over the same parsed sources:
 *
 *   For each watched className, intersect the ancestor class tokens of EVERY
 *   rule that covers it. A non-empty intersection means there is no way to
 *   render that element outside those ancestors and get any styling at all.
 *
 * That is fully decidable from the stylesheets alone, and it is exactly the
 * fact nobody had written down before the outage. What is NOT decidable
 * statically is the follow-up question -- "is the required ancestor actually
 * present at this component's mount point?" -- because that needs the render
 * tree, and these components mount in two different places on purpose
 * (BalanceStrip is in the Billing tab AND was on the map). So the guard does
 * not guess: it FAILS until the class is declared in ANCESTOR_SCOPED with the
 * ancestor named and a one-line reason, turning an invisible property into a
 * reviewed one. A declaration whose ancestor set has drifted also fails, so
 * the reasons cannot rot.
 *
 * Fail-open cases, stated rather than implied:
 *   - LESS nesting (`.a { .b { } }`) is parsed flat, so `.b` looks unscoped.
 *     Every Hydrata paywall/meter stylesheet is plain CSS; the nested sources
 *     are upstream themes that do not define watched classes.
 *   - Extra classes in the SAME compound (`.a.b`) are co-requirements on one
 *     element, not ancestors, and are not checked here.
 *   - One bare rule anywhere clears the class, even a rule that only sets, say,
 *     a colour. Check 2 answers "could this ever be styled outside X", not
 *     "is it styled ENOUGH outside X".
 *
 * FALSE POSITIVES
 * ---------------
 * classNames are extracted from string AND template-literal AND conditional
 * forms, e.g. className={`a${x ? ' b' : ''}`} yields both `a` and `b`.
 * Interpolations themselves are dropped -- a fully computed name cannot be
 * checked statically, and pretending otherwise would produce noise.
 * For check 1 a match is "some rule's selector mentions this class". Neither
 * check answers "does the rule apply AT RUNTIME at this mount point" -- that
 * needs a layout engine and a real render tree, which is exactly what the
 * browser tests in tests/e2e/test_paywall_money_path.py are for. The three
 * layers are complementary; none replaces another.
 *
 * NO NEW DEPENDENCY: Node built-ins only (fs, path, child_process).
 *
 * USAGE
 *   node js/plugins/hydrata/Paywall/paywall-css-coverage-guard.js
 *   npm run guard:paywall-css
 *   node ... --root /path/to/another/client   # audit a different tree
 *   node ... --json                           # machine-readable report
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ───────────────────────────────────────────────────────────

/** Namespaces this guard owns. Anything else emitted by these files is ignored. */
const WATCHED_PREFIXES = [
    'paywall-',
    'compute-meter-',
    'sv-anuga-scenario-estimate-'
];

/** Files whose markup is checked, relative to the client root. */
const SOURCE_GLOBS = [
    { dir: 'js/plugins/hydrata/Paywall', recursive: true },
    { file: 'js/plugins/hydrata/Anuga/components/scenarioPane.js' }
];

/**
 * Stylesheet roots. Every one of these is walked in full, and the file counts
 * are printed on every run so the boundary of the claim is auditable.
 *
 * These are the SOURCES that compile into the bundle, not the built artifact.
 * That is a deliberate choice, and this epic is the reason: the compiled dist
 * on this workstation was two days stale, which is exactly what made the W0
 * browser gate misleading when pointed at the :8000 origin. A guard that
 * trusted a build artifact would let a stale build vouch for a rule that is no
 * longer in the source, or miss one that is -- reporting on something nobody
 * is editing. Parsing the sources means the guard answers a question about the
 * tree you are actually committing. (It is also 85MB and 620 minified chunks
 * cheaper, which is why this runs in ~1s like its sibling guard.)
 */
const STYLE_ROOTS = [
    { dir: 'js/plugins/hydrata', exts: ['.css', '.less'], label: 'Hydrata plugin stylesheets' },
    { dir: 'themes', exts: ['.css', '.less'], label: 'GeoNode theme (compiles to themes/geonode.css)' },
    // Present locally, ABSENT in CI: the guard's workflow job deliberately skips
    // `npm install` so it stays a ~1s check. That difference is safe and was
    // verified rather than assumed -- re-running with this root empty leaves
    // `unmatched` at 0, i.e. no watched className is covered ONLY by an upstream
    // rule. It is parsed anyway so that if one ever were, the local run says so
    // instead of the guard quietly claiming a gap that does not exist.
    { dir: 'node_modules/mapstore/web/client/themes', exts: ['.less', '.css'], label: 'MapStore2 upstream themes', optional: true }
];

/**
 * Genuinely rule-less classNames. EVERY entry needs a one-line reason
 * (AC#4) and is asserted to still be un-ruled -- a stale entry fails the
 * guard rather than rotting silently.
 */
const ALLOWLIST = {
    'compute-meter-balance-strip':
        'BEM base token: the only rendered instance is the Billing tab card, which also carries the styled --card modifier.',
    'compute-meter-recent-entries':
        'No app mount since TASK-2435 removed the on-map strip; BillingTabPanel deliberately does not pass recentEntries (it renders its own richer list).'
};

/**
 * Check 2's declarations: classNames for which EVERY covering rule sits under
 * the same ancestor, reviewed and accepted.
 *
 * `ancestors` must list exactly the intersection the guard computes (sorted) --
 * if a stylesheet edit widens or narrows it, this file has to be re-read, which
 * is the whole point. `reason` must say WHY the component can only ever render
 * inside that ancestor.
 */
const ANCESTOR_SCOPED = {
    // All five belong to BalanceStrip. Since TASK-2435 removed the on-map
    // balance strip, BillingTabPanel.js (variant="card") is its ONLY app
    // mount, and that mount is inside .sv-account-billing-tab by construction
    // — the tab renders the card, nothing else does. `grep -rn "<BalanceStrip"
    // js/` returns exactly one non-test hit. The inline variant reachable at
    // ComputeMeterPanel.js:95/100 is exported for direct karma rendering only.
    'compute-meter-balance': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip figure; only app mount is BillingTabPanel\'s card, inside the Billing tab.'
    },
    'compute-meter-balance-row': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'Card-variant-only layout row — emitted solely by BalanceStrip variant="card" (Billing tab).'
    },
    'compute-meter-balance-labelled': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'Card-variant-only label/value stack — same single mount as above.'
    },
    'compute-meter-balance-label': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'Card-variant-only "Compute balance" caption — same single mount as above.'
    },
    'compute-meter-packs': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip pack-button wrapper; the refusal modals use their own meter-buy-pack-cta-* row, not this one.'
    }
};

/**
 * Ancestors that are on <body> or the app root and therefore always present.
 * `msgapi` is package.json's themePrefix -- prepended at build time, so it does
 * not appear in these sources, but it is listed for the case where someone
 * writes it by hand.
 */
const UNIVERSAL_ANCESTORS = new Set(['msgapi']);

// ── Argument parsing ────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const rootFlag = argv.indexOf('--root');
const CLIENT_ROOT = rootFlag !== -1 && argv[rootFlag + 1]
    ? path.resolve(argv[rootFlag + 1])
    : path.resolve(__dirname, '..', '..', '..', '..');

// ── Helpers ─────────────────────────────────────────────────────────────────

function walk(dir, exts, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            walk(full, exts, out);
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
            out.push(full);
        }
    }
    return out;
}

function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Pull every statically-knowable className token out of a source file.
 * Handles: className="a b", className={'a'}, className={`a ${x} b`},
 * and conditional expressions with quoted branches.
 */
function extractClassNames(source) {
    const found = new Map(); // token -> Set of line numbers
    const text = stripComments(source);
    const re = /className\s*=\s*/g;
    for (;;) {
        const m = re.exec(text);
        if (m === null) break;
        const start = m.index + m[0].length;
        let expr;
        if (text[start] === '"' || text[start] === '\'') {
            const quote = text[start];
            const end = text.indexOf(quote, start + 1);
            if (end === -1) continue;
            expr = text.slice(start + 1, end);
        } else if (text[start] === '{') {
            // Read the balanced brace expression.
            let depth = 0;
            let i = start;
            for (; i < text.length; i++) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') { depth--; if (depth === 0) break; }
            }
            expr = text.slice(start + 1, i);
        } else {
            continue;
        }
        // Collect every literal string / template chunk inside the expression,
        // dropping ${...} interpolations (not statically knowable).
        const literals = [];
        if (!/["'`]/.test(expr)) {
            literals.push(expr);
        } else {
            const litRe = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
            for (;;) {
                const lm = litRe.exec(expr);
                if (lm === null) break;
                literals.push(lm[1] !== undefined ? lm[1] : lm[2] !== undefined ? lm[2] : lm[3]);
            }
        }
        const line = text.slice(0, m.index).split('\n').length;
        for (const lit of literals) {
            for (const token of lit.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
                if (!token) continue;
                if (!WATCHED_PREFIXES.some((p) => token.startsWith(p))) continue;
                if (!found.has(token)) found.set(token, new Set());
                found.get(token).add(line);
            }
        }
    }
    return found;
}

/** Every selector (comma-split) that introduces a rule in a stylesheet. */
function extractSelectors(text) {
    const out = [];
    const body = stripComments(text);
    // Selector = everything before a `{` that is not itself a declaration.
    const selRe = /([^{}();]+)\{/g;
    for (;;) {
        const m = selRe.exec(body);
        if (m === null) break;
        const sel = m[1];
        if (sel.includes('@')) continue;
        for (const part of sel.split(',')) {
            if (part.trim()) out.push(part.trim());
        }
    }
    return out;
}

/** Every class token mentioned by any selector in a stylesheet. */
function extractRuleClasses(text) {
    const classes = new Set();
    for (const sel of extractSelectors(text)) {
        const cls = sel.match(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g);
        if (cls) cls.forEach((c) => classes.add(c.slice(1)));
    }
    return classes;
}

/**
 * Split a selector into compounds (one per element in the descendant chain).
 * Combinators `>`, `+`, `~` are treated exactly like a space: all four mean
 * "a DIFFERENT element", which is what check 2 cares about.
 */
function compoundsOf(selector) {
    return selector
        .replace(/\s*[>+~]\s*/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

/** Class tokens in one compound, pseudo-classes/elements excluded. */
function classesOfCompound(compound) {
    const cls = compound.match(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g);
    return cls ? cls.map((c) => c.slice(1)) : [];
}

/**
 * For every class token in `text`, one entry per covering rule holding the set
 * of classes that rule requires on some ANCESTOR element. See check 2 in the
 * module docstring.
 *
 * @returns {Map<string, Array<Set<string>>>}
 */
function extractRuleAncestry(text) {
    const byClass = new Map();
    for (const sel of extractSelectors(text)) {
        const compounds = compoundsOf(sel);
        const ancestors = new Set();
        for (const compound of compounds) {
            const here = classesOfCompound(compound);
            for (const cls of here) {
                if (!byClass.has(cls)) byClass.set(cls, []);
                // Copy: later compounds must not mutate what we recorded.
                byClass.get(cls).push(new Set(ancestors));
            }
            for (const cls of here) ancestors.add(cls);
        }
    }
    return byClass;
}

// ── Collect ─────────────────────────────────────────────────────────────────

const emitted = new Map(); // token -> [ "file:line", ... ]
const sourceFiles = [];
for (const g of SOURCE_GLOBS) {
    if (g.file) {
        const p = path.join(CLIENT_ROOT, g.file);
        if (fs.existsSync(p)) sourceFiles.push(p);
    } else {
        walk(path.join(CLIENT_ROOT, g.dir), ['.js', '.jsx'], sourceFiles);
    }
}
for (const f of sourceFiles) {
    if (f.includes('__tests__')) continue;
    const rel = path.relative(CLIENT_ROOT, f);
    for (const [token, lines] of extractClassNames(fs.readFileSync(f, 'utf8'))) {
        if (!emitted.has(token)) emitted.set(token, []);
        for (const line of lines) emitted.get(token).push(`${rel}:${line}`);
    }
}

const ruled = new Set();
/** className -> [Set(ancestor classes), ...] across every parsed stylesheet. */
const ancestry = new Map();
const parsedSources = [];
for (const root of STYLE_ROOTS) {
    const dir = path.resolve(CLIENT_ROOT, root.dir);
    const files = walk(dir, root.exts, []);
    parsedSources.push({ label: root.label, dir: path.relative(CLIENT_ROOT, dir), files: files.length, optional: !!root.optional });
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        extractRuleClasses(text).forEach((c) => ruled.add(c));
        for (const [cls, sets] of extractRuleAncestry(text)) {
            if (!ancestry.has(cls)) ancestry.set(cls, []);
            ancestry.get(cls).push(...sets);
        }
    }
}

/**
 * The ancestor classes required by EVERY rule covering `cls` -- the
 * intersection. Empty means at least one rule can style the element wherever
 * it mounts. Universal ancestors (body/app-root) are not requirements.
 */
function requiredAncestors(cls) {
    const sets = ancestry.get(cls);
    if (!sets || sets.length === 0) return [];
    let acc = null;
    for (const s of sets) {
        const usable = [...s].filter((a) => !UNIVERSAL_ANCESTORS.has(a) && a !== cls);
        if (usable.length === 0) return [];
        if (acc === null) {
            acc = new Set(usable);
        } else {
            const kept = new Set();
            for (const a of usable) {
                if (acc.has(a)) kept.add(a);
            }
            acc = kept;
        }
        if (acc.size === 0) return [];
    }
    return [...acc].sort();
}

// ── Evaluate ────────────────────────────────────────────────────────────────

const unmatched = [];
const staleAllowlist = [];
for (const [token, sites] of [...emitted].sort()) {
    const covered = ruled.has(token);
    const allowed = Object.prototype.hasOwnProperty.call(ALLOWLIST, token);
    if (covered && allowed) {
        staleAllowlist.push(token);
    } else if (!covered && !allowed) {
        unmatched.push({ className: token, emittedAt: sites });
    }
}
const missingAllowlistTargets = Object.keys(ALLOWLIST).filter((k) => !emitted.has(k));

// ── Check 2: every-rule-ancestor-scoped ─────────────────────────────────────

const undeclaredScoped = [];   // scoped, but not declared in ANCESTOR_SCOPED
const driftedScoped = [];      // declared, but the ancestor set changed
const staleScoped = [];        // declared, but no longer scoped (or not emitted)
for (const [token, sites] of [...emitted].sort()) {
    const required = requiredAncestors(token);
    const declared = Object.prototype.hasOwnProperty.call(ANCESTOR_SCOPED, token)
        ? [...(ANCESTOR_SCOPED[token].ancestors || [])].sort()
        : null;
    if (required.length === 0) {
        if (declared) staleScoped.push({ className: token, declared });
        continue;
    }
    if (!declared) {
        undeclaredScoped.push({ className: token, required, emittedAt: sites });
    } else if (declared.join('|') !== required.join('|')) {
        driftedScoped.push({ className: token, required, declared });
    }
}
for (const k of Object.keys(ANCESTOR_SCOPED)) {
    if (!emitted.has(k)) {
        staleScoped.push({ className: k, declared: [...(ANCESTOR_SCOPED[k].ancestors || [])].sort() });
    }
}

// ── Report ──────────────────────────────────────────────────────────────────

if (asJson) {
    process.stdout.write(JSON.stringify({
        clientRoot: CLIENT_ROOT,
        emitted: emitted.size,
        covered: emitted.size - unmatched.length - Object.keys(ALLOWLIST).filter((k) => emitted.has(k)).length,
        allowlisted: Object.keys(ALLOWLIST).filter((k) => emitted.has(k)),
        unmatched,
        staleAllowlist,
        missingAllowlistTargets,
        undeclaredScoped,
        driftedScoped,
        staleScoped,
        parsedSources
    }, null, 2) + '\n');
} else {
    process.stdout.write('Paywall / compute-meter CSS coverage guard (TASK-2437)' + '\n');
    process.stdout.write(`  client root : ${CLIENT_ROOT}` + '\n');
    process.stdout.write(`  prefixes    : ${WATCHED_PREFIXES.join(', ')}` + '\n');
    process.stdout.write(`  markup files: ${sourceFiles.filter((f) => !f.includes('__tests__')).length}` + '\n');
    process.stdout.write('  stylesheet sources parsed (the boundary of "no rule anywhere"):' + '\n');
    for (const s of parsedSources) {
        const note = s.files === 0 && s.optional ? '  [absent — expected in CI, see STYLE_ROOTS]' : '';
        process.stdout.write(`      ${String(s.files).padStart(5)} files  ${s.label} (${s.dir})${note}` + '\n');
    }
    process.stdout.write(`  classNames emitted: ${emitted.size}` + '\n');
    const allowedPresent = Object.keys(ALLOWLIST).filter((k) => emitted.has(k));
    process.stdout.write(`  allowlisted       : ${allowedPresent.length}` + '\n');
    for (const k of allowedPresent) process.stdout.write(`      .${k} — ${ALLOWLIST[k]}` + '\n');
    process.stdout.write(`  unmatched         : ${unmatched.length}` + '\n');
    const declaredPresent = Object.keys(ANCESTOR_SCOPED).filter((k) => emitted.has(k));
    process.stdout.write(`  ancestor-scoped   : ${declaredPresent.length} declared, ${undeclaredScoped.length} undeclared` + '\n');
    for (const k of declaredPresent) {
        process.stdout.write(`      .${k} — under .${[...ANCESTOR_SCOPED[k].ancestors].sort().join(' .')} — ${ANCESTOR_SCOPED[k].reason}` + '\n');
    }
}

let failed = false;

if (unmatched.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: classNames emitted with NO matching rule in any parsed stylesheet.' + '\n');
        process.stderr.write('This is the epic-2425 defect class: markup shipped without its stylesheet.\n' + '\n');
        for (const u of unmatched) {
            process.stderr.write(`  .${u.className}` + '\n');
            for (const site of u.emittedAt) process.stderr.write(`        emitted at ${site}` + '\n');
        }
        process.stderr.write('\nFix by adding a rule, or -- if the class genuinely needs none --' + '\n');
        process.stderr.write('add it to ALLOWLIST in this file WITH a one-line reason.' + '\n');
    }
}

if (staleAllowlist.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: stale ALLOWLIST entries — these now HAVE rules, so the excuse no longer applies.' + '\n');
        for (const c of staleAllowlist) process.stderr.write(`  .${c}` + '\n');
        process.stderr.write('Remove them from ALLOWLIST.' + '\n');
    }
}

if (missingAllowlistTargets.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: ALLOWLIST entries for classNames no longer emitted anywhere.' + '\n');
        for (const c of missingAllowlistTargets) process.stderr.write(`  .${c}` + '\n');
        process.stderr.write('Remove them from ALLOWLIST.' + '\n');
    }
}

if (undeclaredScoped.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: EVERY rule covering these classNames requires an ancestor.' + '\n');
        process.stderr.write('This is the exact shape of the production defect: every compute-meter rule' + '\n');
        process.stderr.write('was scoped under .sv-account-billing-tab, so the SAME components rendered' + '\n');
        process.stderr.write('completely unstyled at their other mount point (the map).\n' + '\n');
        for (const u of undeclaredScoped) {
            process.stderr.write(`  .${u.className}  — every rule is under: .${u.required.join(' .')}` + '\n');
            for (const site of u.emittedAt) process.stderr.write(`        emitted at ${site}` + '\n');
        }
        process.stderr.write('\nFix by adding ONE rule that does not require those ancestors, or -- if this' + '\n');
        process.stderr.write('component genuinely only ever renders inside them -- declare it in' + '\n');
        process.stderr.write('ANCESTOR_SCOPED with the ancestor list and a one-line reason.' + '\n');
        process.stderr.write('This guard cannot tell whether the ancestor is present at the mount point;' + '\n');
        process.stderr.write('that is a human judgement and a browser test (tests/e2e/test_paywall_money_path.py).' + '\n');
    }
}

if (driftedScoped.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: ANCESTOR_SCOPED declarations no longer match the stylesheets.' + '\n');
        for (const d of driftedScoped) {
            process.stderr.write(`  .${d.className}  declared [${d.declared.join(', ')}]  now [${d.required.join(', ')}]` + '\n');
        }
        process.stderr.write('Re-read the reason, then update the declaration.' + '\n');
    }
}

if (staleScoped.length > 0) {
    failed = true;
    if (!asJson) {
        process.stderr.write('\nFAIL: stale ANCESTOR_SCOPED entries — no longer ancestor-scoped, or no longer emitted.' + '\n');
        for (const s of staleScoped) process.stderr.write(`  .${s.className}` + '\n');
        process.stderr.write('Remove them from ANCESTOR_SCOPED.' + '\n');
    }
}

if (failed) {
    process.exit(1);
}

if (!asJson) {
    process.stdout.write('\nOK: every watched className has a rule (or a justified allowlist entry),' + '\n');
    process.stdout.write('    and none is reachable ONLY through an undeclared ancestor.' + '\n');
}

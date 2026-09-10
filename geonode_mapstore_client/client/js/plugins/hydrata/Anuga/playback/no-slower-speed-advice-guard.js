/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-2988 (W2.2, epic 2981) AC6 — THE SLOWER-SPEED ADVICE IS GONE, IN EVERY
 * LANGUAGE AND IN THE SOURCE.
 *
 * WHY THIS IS A REPO CHECK AND NOT A KARMA SPEC. The advice had THREE homes and
 * AC3 originally named one, so a test could go green while it still shipped:
 *
 *   (a) messages.hydrata.playback.degraded        in each locale that defines
 *                                                 the playback namespace;
 *   (b) messages.hydrata.playback.degradedTooltip in those same files;
 *   (c) the inline English fallback passed to
 *       this.tr('hydrata.playback.degradedTooltip', '<the same advice>') in
 *       AnugaPlaybackControlBar.js.
 *
 * Home (c) is UNREACHABLE FROM KARMA BY CONSTRUCTION: it is a string literal in
 * the SOURCE, and a karma spec runs in a browser with no filesystem. Only a
 * source-reading gate can assert it — which is what i18n-literal-guard.js beside
 * this file already is, and why this belongs next to it rather than inside it.
 *
 * IT IS DELIBERATELY NOT FOLDED INTO THAT GUARD. The literal guard answers "is
 * any user-visible string hardcoded?" and it deliberately does NOT flag
 * `this.tr(id, fallback)`, because the fallback is REQUIRED — getMessageById
 * returns the msgId itself on a miss. This file answers a different question:
 * "is this SPECIFIC advice gone?" The two would fight if merged.
 *
 * WHY THE ADVICE HAD TO GO. TASK-2987 made playback pace itself against the
 * buffered runway, so it now does automatically what the copy was asking the
 * viewer to do by hand. Telling someone to pick a slower speed while the player
 * is already doing exactly that is worse than saying nothing.
 *
 * THREE THINGS THAT WOULD MAKE THIS GATE VACUOUS, AND WHAT STOPS EACH:
 *   1. A HARDCODED LIST OF FOUR FILENAMES would miss a fifth locale that gains
 *      the namespace later. The files are GLOBBED and selected by whether they
 *      define `messages.hydrata.playback`.
 *   2. A GLOB THAT MATCHES NOTHING would pass silently. Fewer than
 *      MINIMUM_LOCALES matches is a failure that says so.
 *   3. GREPPING ONE ENGLISH PHRASE would pass on three untranslated locales
 *      still carrying the advice. Every pattern below was derived by READING the
 *      value shipping in that language, and every pattern is applied to EVERY
 *      file, so the advice cannot hide behind a copy-paste into another locale.
 *   And a locale whose language has no registered pattern FAILS rather than
 *   being skipped: an unreadable file is not a clean file.
 *
 * Run: node js/plugins/hydrata/Anuga/playback/no-slower-speed-advice-guard.js
 * Not imported by anything, so it never reaches a bundle.
 */
const fs = require('fs');
const path = require('path');

// SIX levels up from js/plugins/hydrata/Anuga/playback lands on
// geonode_mapstore_client/, whose `static/` holds OUR translations. The sibling
// gn-translations/ and ms-translations/ directories are upstream — not ours to
// police and not ours to edit.
const LOCALE_DIR = path.join(
    __dirname, '..', '..', '..', '..', '..', '..', 'static', 'mapstore', 'hydrata-translations');
const BAR = path.join(__dirname, 'components', 'AnugaPlaybackControlBar.js');

/** The namespace whose copy this gate polices. */
const NAMESPACE = ['messages', 'hydrata', 'playback'];

/**
 * Four locales define the playback namespace today (en-US, es-ES, fr-FR,
 * ht-HT). Fewer than that means the glob, the path or the namespace check is
 * broken — not that the copy is clean.
 */
const MINIMUM_LOCALES = 4;

/**
 * ONE PATTERN PER SHIPPED LANGUAGE, each derived from the value that language
 * was actually carrying before TASK-2988 (quoted so a future reader can see the
 * pattern is not a guess):
 *
 *   en-US "Playback is waiting for data — try a slower speed"
 *   es-ES "La reproducción está esperando datos — pruebe una velocidad más lenta"
 *   fr-FR "La lecture attend des données — essayez une vitesse plus lente"
 *   ht-HT "Lekti a ap tann done — eseye yon vitès pi dousman"
 *
 * Each is the COMPARATIVE plus the SPEED NOUN, never the noun alone: every one
 * of these locales legitimately keeps a "Playback speed" label
 * (`hydrata.playback.speed`), and a bare /velocidad/ would flag it.
 */
const ADVICE_PATTERNS = [
    { locale: 'en-US', pattern: /\bslow(?:er)?\s+speed\b/i },
    { locale: 'es-ES', pattern: /velocidad\s+m[áa]s\s+lenta/i },
    { locale: 'fr-FR', pattern: /vitesse\s+plus\s+lente/i },
    { locale: 'ht-HT', pattern: /vit[èe]s\s+pi\s+dousman/i }
];

function localeCodeOf(file) {
    const match = path.basename(file).match(/^data\.(.+)\.json$/);
    return match ? match[1] : null;
}

function namespaceOf(json) {
    return NAMESPACE.reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), json);
}

/** Every advice pattern that matches `text`, by the language it came from. */
function matches(text) {
    return ADVICE_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => p.locale);
}

function localeFiles() {
    // A MISSING DIRECTORY IS A FAILURE, NOT AN EXCEPTION TRACE. If this path
    // ever drifts (it did once during authoring, by one `..`), the gate must say
    // what it could not find rather than dying with an ENOENT stack.
    if (!fs.existsSync(LOCALE_DIR)) {
        process.stderr.write(
            `[no-slower-speed-advice-guard] FAIL — the locale directory does not exist: ${LOCALE_DIR}\n`
            + '  A gate that cannot find the files it grades has graded nothing.\n');
        process.exit(1);
    }
    return fs.readdirSync(LOCALE_DIR)
        .filter((name) => /^data\..+\.json$/.test(name))
        .sort()
        .map((name) => path.join(LOCALE_DIR, name));
}

/**
 * @returns {{findings: object[], checked: object[]}} `checked` records every
 *   file and key looked at, so the output shows the gate's REACH and not only
 *   its verdict.
 */
function checkLocales(files) {
    const findings = [];
    const checked = [];
    const withNamespace = [];

    files.forEach((file) => {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            findings.push({ file, key: '(whole file)', text: String(err.message), why: 'unparseable' });
            return;
        }
        const namespace = namespaceOf(json);
        if (!namespace || typeof namespace !== 'object') {
            return;
        }
        withNamespace.push(file);
        const locale = localeCodeOf(file);
        const registered = ADVICE_PATTERNS.some((p) => p.locale === locale);
        if (!registered) {
            findings.push({
                file, key: '(whole namespace)', text: locale,
                why: 'no advice pattern registered for this language — add one to ADVICE_PATTERNS '
                    + 'rather than letting an unreadable locale pass'
            });
        }
        // EVERY string in the namespace, RECURSIVELY — not only `degraded` and
        // `degradedTooltip`. An AC that names two keys is an AC the advice can
        // escape by moving to a third, and the namespace has nested groups
        // (status.*, tickUnit.*) a flat Object.keys pass would walk straight
        // past.
        const walk = (node, trail) => {
            Object.keys(node).sort().forEach((key) => {
                const value = node[key];
                const where = trail ? `${trail}.${key}` : key;
                if (value && typeof value === 'object') {
                    walk(value, where);
                    return;
                }
                if (typeof value !== 'string') {
                    return;
                }
                checked.push({ file, key: where, locale });
                const hits = matches(value);
                if (hits.length) {
                    findings.push({
                        file, key: where, text: value,
                        why: `slower-speed advice (matched the ${hits.join('/')} pattern)`
                    });
                }
            });
        };
        walk(namespace, '');
    });

    if (withNamespace.length < MINIMUM_LOCALES) {
        findings.push({
            file: LOCALE_DIR, key: '(glob)', text: String(withNamespace.length),
            why: `only ${withNamespace.length} of ${files.length} files define `
                + `${NAMESPACE.join('.')} — expected at least ${MINIMUM_LOCALES}. A glob that `
                + 'matches nothing is the classic vacuous pass, so this is a FAILURE, not a skip'
        });
    }
    return { findings, checked, withNamespace };
}

/** Home (c) — the inline English fallback in the bar's own source. */
function checkSource(source) {
    const findings = [];
    source.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return;
        }
        const hits = matches(line);
        if (hits.length) {
            findings.push({
                file: BAR, key: `line ${i + 1}`, text: trimmed,
                why: `slower-speed advice in the SOURCE (matched the ${hits.join('/')} pattern) — `
                    + 'this is the home no karma spec can reach'
            });
        }
    });
    return findings;
}

function main() {
    const files = localeFiles();
    const { findings: localeFindings, checked, withNamespace } = checkLocales(files);
    const sourceFindings = checkSource(fs.readFileSync(BAR, 'utf8'));
    const findings = localeFindings.concat(sourceFindings);

    process.stdout.write(
        `[no-slower-speed-advice-guard] globbed ${files.length} locale files in `
        + `${path.relative(process.cwd(), LOCALE_DIR)}; `
        + `${withNamespace.length} define ${NAMESPACE.join('.')}:\n`);
    withNamespace.forEach((file) => {
        const keys = checked.filter((c) => c.file === file).length;
        process.stdout.write(`    ${path.basename(file)} — ${keys} string keys checked\n`);
    });
    process.stdout.write(
        `    ${path.basename(BAR)} — ${fs.readFileSync(BAR, 'utf8').split('\n').length} source lines checked\n`);
    process.stdout.write(
        `    patterns: ${ADVICE_PATTERNS.map((p) => `${p.locale} ${p.pattern}`).join(', ')}\n`);

    if (findings.length) {
        process.stderr.write(
            `[no-slower-speed-advice-guard] FAIL — ${findings.length} finding(s); the advice `
            + 'TASK-2988 retires is still shipping:\n');
        findings.forEach((f) => {
            process.stderr.write(
                `  ${path.basename(f.file)} ${f.key}: ${JSON.stringify(f.text)}\n      ${f.why}\n`);
        });
        process.exit(1);
    }
    process.stdout.write(
        '[no-slower-speed-advice-guard] PASS — no slower-speed advice in any locale that defines '
        + 'the playback namespace, nor in the bar source.\n');
}

module.exports = { checkLocales, checkSource, localeFiles, ADVICE_PATTERNS };

if (require.main === module) {
    main();
}

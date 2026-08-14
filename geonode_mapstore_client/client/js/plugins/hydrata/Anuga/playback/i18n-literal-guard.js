/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-2744 (AC10, epic 2706) — THE BAR MUST BE FULLY TRANSLATED.
 *
 * A repo check, not a karma spec: the AC asks for zero string literals in
 * user-visible positions of AnugaPlaybackControlBar.js, which is a question
 * about the SOURCE TEXT, not about a rendered tree. A karma assertion could
 * only ever prove that one code path produced English on this run.
 *
 * It fails on:
 *   - a bare string literal used as a `title=` or `aria-label=` attribute
 *     (`title="Pause"`), rather than `title={this.tr(...)}`;
 *   - a hardcoded JSX text child (`{'Wireframe'}` or literal prose between
 *     tags), rather than <Message> or this.tr().
 *
 * It deliberately does NOT flag `this.tr('id', 'English fallback')`: the
 * fallback is required — getMessageById returns the msgId ITSELF on a miss
 * (LocaleUtils.js:158-168), so without one an accessible name would read
 * `hydrata.playback.pause` aloud. The fallback is the safety net, not the
 * defect.
 *
 * Run: node js/plugins/hydrata/Anuga/playback/i18n-literal-guard.js
 * Not imported by anything, so it never reaches a bundle.
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, 'components', 'AnugaPlaybackControlBar.js');

// Glyphs and punctuation that are not words in any language.
const NON_LINGUISTIC = /^[\s—–\-—·:/|.,()[\]{}0-9%x×+]*$/;

function checkSource(source) {
    const violations = [];
    const lines = source.split('\n');

    lines.forEach((line, i) => {
        const lineNo = i + 1;
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return;
        }

        // title="..." / aria-label="..." / placeholder="..." with a literal
        const attr = line.match(/\b(title|aria-label|placeholder)\s*=\s*"([^"]*)"/);
        if (attr && !NON_LINGUISTIC.test(attr[2])) {
            violations.push({ line: lineNo, kind: `literal ${attr[1]}=`, text: attr[2] });
        }

        // a hardcoded JSX text child: {'Some Words'} or {"Some Words"}
        const child = line.match(/\{\s*(['"])([^'"]+)\1\s*\}/);
        if (child && !NON_LINGUISTIC.test(child[2]) && /[A-Za-z]{2,}/.test(child[2])) {
            // this.tr('id', 'fallback') and data-testid={'...'} are not JSX text
            if (!/this\.tr\(|data-testid|className|key=|msgId/.test(line)) {
                violations.push({ line: lineNo, kind: 'hardcoded JSX text', text: child[2] });
            }
        }
    });

    return violations;
}

function main() {
    const source = fs.readFileSync(TARGET, 'utf8');
    const violations = checkSource(source);
    if (violations.length) {
        process.stderr.write('[i18n-literal-guard] FAIL — untranslated user-visible strings:\n');
        violations.forEach((v) => {
            process.stderr.write(`  ${path.basename(TARGET)}:${v.line}  ${v.kind}: ${JSON.stringify(v.text)}\n`);
        });
        process.exit(1);
    }
    process.stdout.write('[i18n-literal-guard] PASS — no hardcoded user-visible strings in AnugaPlaybackControlBar.js\n');
}

module.exports = { checkSource };

if (require.main === module) {
    main();
}

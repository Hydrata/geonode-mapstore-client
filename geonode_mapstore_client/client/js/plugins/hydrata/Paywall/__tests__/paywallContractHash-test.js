/**
 * paywallContractHash-test.js — anti-drift hash guard for the embedded paywall
 * contract (TASK-1377, epic 2359).
 *
 * PURPOSE
 * -------
 * gmc's CONTRACT_FIXTURE (../paywallContract.js) is a verbatim copy of the
 * canonical source of truth in the hydrata repo:
 *     apps/gn_anuga/fixtures/paywall_contract.json
 * gmc CI has NO hydrata checkout, so we cannot diff the two repos at test time.
 * Instead each repo asserts its OWN copy hashes to a PINNED canonical hash.
 * This test fails the moment CONTRACT_FIXTURE drifts (states / payloads /
 * version / hard_contract_rules) from the pin.
 *
 * THE PIN
 * -------
 * PINNED_CONTRACT_HASH == sha256( canonicalize(paywall_contract.json) ) as of
 * 2026-07-22, where canonicalize() is the sorted-key, stable serialization
 * below. Because the JS copy is byte-verbatim to the JSON, the same function
 * over CONTRACT_FIXTURE yields the same hash. Bumping the pin is the EXPLICIT,
 * intentional sync act: when the canonical JSON legitimately changes, update
 * both copies AND re-pin here (re-derive with the identical algorithm).
 *
 * HOW IT RUNS IN CI (AC #2)
 * -------------------------
 * This is a standard Karma test file (name ends in -test.js). The gmc frontend
 * CI job (.github/workflows/test.yml -> `npm test` -> karma.conf.single-run.js)
 * globs every -test.js file under js/ (via tests-travis.webpack.js
 * require.context), so this guard runs in the existing Karma unit-test job with
 * no CI wiring changes.
 * SHA-256 uses the browser-native Web Crypto (window.crypto.subtle), available
 * in the ChromeHeadless-on-localhost karma context — no library dependency.
 */
import expect from 'expect';
import {CONTRACT_FIXTURE} from '../paywallContract';

// Pinned canonical hash — see header. Re-derive on an intentional contract bump.
const PINNED_CONTRACT_HASH =
    '13aa7dd6600920ef318de8a926c5196eafdfc0dde6c449a2cb85a4b5f6017811';

/**
 * Stable, sorted-key canonical serialization. Order-independent for object
 * keys so a re-ordering is not treated as drift; array order IS significant
 * (the states list is ordered). Identical to the pin-derivation algorithm.
 */
function canonicalize(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalize).join(',') + ']';
    }
    return '{' + Object.keys(value).sort()
        .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
        .join(',') + '}';
}

function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    return window.crypto.subtle.digest('SHA-256', bytes).then((buf) =>
        Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
    );
}

describe('TASK-1377 paywall contract anti-drift hash guard', () => {
    it('CONTRACT_FIXTURE matches the pinned canonical hash', () => {
        return sha256Hex(canonicalize(CONTRACT_FIXTURE)).then((hash) => {
            expect(hash).toBe(PINNED_CONTRACT_HASH);
        });
    });

    it('detects drift: any change to the contract breaks the pin', () => {
        // Deep clone + a single-field mutation must no longer match the pin,
        // proving the guard is sensitive to real drift (AC #1).
        const drifted = JSON.parse(JSON.stringify(CONTRACT_FIXTURE));
        drifted._meta.version = CONTRACT_FIXTURE._meta.version + '-drift';
        return sha256Hex(canonicalize(drifted)).then((hash) => {
            expect(hash).toNotBe(PINNED_CONTRACT_HASH);
        });
    });
});

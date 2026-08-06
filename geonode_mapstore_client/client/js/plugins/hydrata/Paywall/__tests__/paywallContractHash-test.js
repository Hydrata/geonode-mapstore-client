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
 * descriptions / version / hard_contract_rules) from the pin.
 *
 * "EACH REPO" BECAME TRUE ON 2026-07-27 (TASK-2501, epic 2425 W3d). Until then
 * this was the ONLY pin in the fleet, so the hydrata repo — which holds the
 * source of truth — could edit the contract and break nothing. The mirror pin
 * now lives at hydrata's
 *     apps/gn_anuga/tests/test_paywall_contract_pin.py
 * holding the SAME 64-hex literal, derived from the JSON.
 *
 * What that does and does not buy (be precise — the pins are linked only by
 * both literals being the same string, since neither can read the other tree):
 * editing either copy and FORGETTING to re-pin turns that repo red, which is
 * the common careless case. Editing one copy and re-pinning ONLY that repo
 * still leaves both suites green while the copies diverge — no automated check
 * anywhere catches that. It is merely made conspicuous, because it takes a
 * deliberate edit to a 64-hex constant that a reviewer can diff against the
 * other repo's.
 *
 * On any bump, re-pin BOTH — derive from the hydrata JSON first, then confirm
 * this copy reproduces it, never the reverse.
 *
 * THE PIN
 * -------
 * PINNED_CONTRACT_HASH == sha256( canonicalize(paywall_contract.json) ) as of
 * 2026-07-27, where canonicalize() is the sorted-key, stable serialization
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
//
// v1.0 -> v1.1 re-pin (TASK-2446, epic 2425 W2): TASK-2432 added the
// `paid_organization` state and widened past_due's backend_condition. The old
// pin was 13aa7dd6600920ef318de8a926c5196eafdfc0dde6c449a2cb85a4b5f6017811.
// NOTE when re-deriving offline: canonicalize() uses JS JSON.stringify, which
// does NOT \u-escape non-ASCII. A Python re-derivation must pass
// ensure_ascii=False or it will produce a different (wrong) digest — the
// fixture is full of em-dashes.
//
// v1.1 prose re-pin (TASK-2501, epic 2425 W3d): the fixture made two false
// claims. paid_private/paid_organization advertised a "manage-billing CTA"
// that TASK-2463 (W2.5) deleted, and _meta.note_on_v1.1 described this
// component's missing `paid_organization` case as an open gap when rendering
// null is now the DESIGNED behaviour for every state but upgrade_prompt.
// Prose-only, behaviour-free — nothing reads .description — but description
// strings ARE inside the hashed region, which is what forced this re-pin. The
// old pin was ea5d4ac7a4831430a117583a7ef881283bb394869c2549d6589839cc4f7043cb.
// _meta.version stays '1.1': the contract's SHAPE did not change.
//
// v1.1 re-pin (TASK-2646, epic 2635 W2): TASK-2639 (W1) changed the LIVE
// _check_private_entitlement_response (hydrata repo) to always return
// checkout_url: null for upgrade_prompt (Stripe TEST keys during beta make a
// real checkout_url an unpayable dead end) but did not update the fixture at
// the time. upgrade_prompt's payload.checkout_url is now null (was the
// placeholder string "<checkout-session-url>") and its description explains
// why. _meta.version stays '1.1' — a value correction to match already-
// shipped live behaviour, not a shape change. The superseded digest was
// eb1a72bdbe52ec6474f5329a3fd594f331b9f2c142e3777cf96a1a223c9d7cbd.
const PINNED_CONTRACT_HASH =
    'd1a699df98415fdb2274d0929dc30c37d4ece83d1df472a8c54e9cab4b0736bf';

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

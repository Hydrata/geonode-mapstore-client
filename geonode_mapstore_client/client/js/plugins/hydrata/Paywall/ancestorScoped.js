/**
 * Shared ANCESTOR-SCOPING declarations (TASK-2461, epic 2425 W3d).
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE GUARD
 * ----------------------------------------------
 * These tables have TWO consumers that cannot import each other:
 *
 *   1. `paywall-css-coverage-guard.js` — a `#!/usr/bin/env node` script that
 *      `require()`s `fs`/`path`, runs its checks at import time and calls
 *      `process.exit(1)`. It exports nothing and MUST NOT: it is a CLI.
 *   2. `__tests__/ancestorScoped-test.js` — a karma spec, bundled by webpack.
 *      The guard is un-importable there twice over: `process.exit` on import,
 *      and no `fs` fallback in the karma webpack resolve config
 *      (node_modules/@mapstore/project/types/standard/config/testConfig.js,
 *      which lists only timers/stream/http/https/zlib), so `import`ing it
 *      fails the bundle at "Can't resolve 'fs'".
 *
 * So the declarations live here, in the intersection of what both runtimes can
 * load: plain CommonJS, no Node built-ins, no JSX, no dependencies. The guard
 * `require()`s it; the karma spec `import`s it (webpack's CJS interop) and
 * derives its assertions from it, so a declaration cannot be ADDED without a
 * render proof, and a mount cannot be added without a declaration.
 *
 * Do not "modernise" this to ESM: `require()` from the Node guard would break.
 */

/**
 * Check 2's declarations: classNames for which EVERY covering rule sits under
 * the same ancestor, reviewed and accepted.
 *
 * `ancestors` must list exactly the intersection the guard computes (sorted) --
 * if a stylesheet edit widens or narrows it, this file has to be re-read, which
 * is the whole point. `reason` must say WHY the component can only ever render
 * inside that ancestor.
 *
 * Every entry here is ALSO proved at render time by
 * `__tests__/ancestorScoped-test.js`: adding a className to this table with no
 * matching element in the declared mount's render tree fails that spec.
 */
const ANCESTOR_SCOPED = {
    // All six belong to BalanceStrip, and since TASK-2458 deleted its inline
    // variant the argument is no longer a judgement call: BalanceStrip renders
    // one thing, `grep -rn "<BalanceStrip" js/` returns exactly one non-test
    // hit (BillingTabPanel.js), and that mount is inside .sv-account-billing-tab
    // by construction — the tab renders the card, nothing else does. There is
    // no second variant that could ever render these classes elsewhere.
    'compute-meter-balance-strip': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'The balance card root; BillingTabPanel is BalanceStrip\'s only caller and it renders inside the Billing tab.'
    },
    'compute-meter-balance': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip figure; only app mount is BillingTabPanel\'s card, inside the Billing tab.'
    },
    'compute-meter-balance-row': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip layout row — same single mount as above.'
    },
    'compute-meter-balance-labelled': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip label/value stack — same single mount as above.'
    },
    'compute-meter-balance-label': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip\'s "Compute balance" caption — same single mount as above.'
    },
    'compute-meter-packs': {
        ancestors: ['sv-account-billing-tab'],
        reason: 'BalanceStrip pack-button wrapper; the refusal modals use their own meter-buy-pack-cta-* row, not this one.'
    }
};

/**
 * The mounts the declarations above are ARGUED FROM: component name -> every
 * non-test source file allowed to render it, relative to the client root.
 *
 * This is the anti-rot half. Every `reason` in ANCESTOR_SCOPED rests on the
 * claim "BalanceStrip has exactly one app mount and it is inside the Billing
 * tab" — a claim about the whole source tree that a render test physically
 * cannot check, because a render test can only see the mounts it was written
 * to render. The guard's CHECK 3 scans all non-test sources under `js/` and
 * fails when the real mount set differs from this table in EITHER direction:
 *
 *   - a NEW mount (the outage shape: BalanceStrip rendered on the map, where
 *     .sv-account-billing-tab is nowhere above it, so every rule that styles
 *     it is inert) -> add the mount here and re-argue the reasons, or scope
 *     the mount under the ancestor;
 *   - a VANISHED mount -> the reasons now rest on a file that no longer
 *     renders the component, so they are stale and must be re-read.
 *
 * Keys are component names as written in JSX (`<BalanceStrip ...>`); paths use
 * forward slashes and are relative to geonode_mapstore_client/client.
 */
const DECLARED_MOUNTS = {
    // TASK-2435 removed the map-level mount and TASK-2458 deleted the inline
    // variant behind it, which is what collapsed this to a single entry. It is
    // exactly that collapse the guard now pins: re-adding a second mount is a
    // one-line edit somebody will make in good faith.
    BalanceStrip: ['js/plugins/hydrata/Paywall/account/components/BillingTabPanel.js']
};

module.exports = { ANCESTOR_SCOPED, DECLARED_MOUNTS };

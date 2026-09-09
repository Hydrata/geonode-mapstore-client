/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-3025 (W4.5, epic 2981) — WHERE THE THREE PLAYBACK MEMORY CONSTANTS COME
 * FROM AT RUNTIME.
 *
 * Epic 2981 freezes `APP_BASELINE_FLOOR_BYTES` (280 MiB),
 * `PLAN_TRANSIENT_EXCESS_BYTES` (680 MiB) and `PLAN_UNCAP_MAX_PEAK_BYTES`
 * (440 MiB) from a handful of rig runs on ONE laptop GPU under one throttling
 * profile. They are defensible estimates, not a measurement of the device
 * population, and the first real prod census on a phone, a 4 GiB Chromebook or
 * a 32 GiB workstation will disagree with at least one of them. Without a
 * runtime valve the cost of acting on that disagreement is: edit a constant,
 * compile the gmc bundle, raise a PR, wait for CI, promote_release.py, then
 * `make <site>` four times — which in practice means the constants never get
 * retuned and the epic ships an estimate as a permanent fact.
 *
 * This module RESOLVES the overrides. It does not apply them: the sanitising
 * band clamp lives beside the constants in `playbackMemoryPolicy.js`
 * (TASK-2984 RULE C clause 17), so no transport can bypass it, and this module
 * only ever proposes.
 *
 * TWO RUNGS, DELIBERATELY DIFFERENT.
 *
 * RUNG 1 — PER TESTER, PER TAB. URL query params on the map/results url,
 * never persisted (no localStorage, no sessionStorage, nothing written back).
 * Gated on the gn_anuga tester capability `state.anuga.ui
 * .canSelectComputeTarget` — NOT `is_staff`, which this project's own records
 * flag as too broad to be a tester flag, and which uiReducer.js already says
 * verbatim about this same flag. BOTH DIRECTIONS are allowed: a tester may
 * make playback more aggressive as well as more conservative, because the
 * blast radius is one tab. FAIL CLOSED: the flag arrives from an async fetch
 * dispatched on INIT_ANUGA and its initial value is `false`, so PLAYBACK_INIT
 * can and does precede it — an un-hydrated read must yield the shipped
 * constant, never an honoured override.
 *
 * RUNG 2 — PER SITE, EVERY VISITOR. A `SitePluginConfig.override_local_config`
 * row edited in the Django admin, read back as
 * `getConfigProp('hydrataConfig').playbackMemory`. SAFE DIRECTION ONLY: a site
 * value may only make playback MORE CONSERVATIVE than the shipped constant,
 * and a value in the aggressive direction is REJECTED and logged, never
 * silently clamped. The reason is structural, not a preference:
 * `context_processors.py`'s `site_plugin_config(request)` never reads
 * `request` — it keys only on `settings.JOB_NAME` — so the row reaches EVERY
 * visitor of that site INCLUDING anonymous ones, which is precisely the
 * population epic 2981 W4 opened results to.
 *
 * WHY THE RESOLUTION IS HERE AND NOT IN playbackMemoryPolicy.js: that module
 * must gain no `getConfigProp`, no `URLSearchParams`, no `window` read and no
 * module-level `let`. Karma runs every playback spec in ONE webpack bundle and
 * `playbackMemoryPolicy-test.js` makes byte-exact assertions with no reset
 * hooks, so a leaked module-level override there produces order-dependent
 * failures across ~30 specs. Read the url and the config HERE; pass values
 * down as arguments.
 *
 * @module plugins/hydrata/Anuga/playback/playbackPolicyOverrides
 */

import { SHIPPED_POLICY_CONSTANTS } from './playbackMemoryPolicy';

/** The console prefix every resolution line carries, so it is greppable. */
export const PLAYBACK_POLICY_OVERRIDE_PREFIX = '[playback] memory policy —';

/** The three tunable keys, in the order the log line prints them. */
export const POLICY_KEYS = [
    'appBaselineFloorBytes',
    'planTransientExcessBytes',
    'uncapMaxPeakBytes'
];

/**
 * RUNG 1's url query params. MiB in the transport, bytes in the plan: an
 * operator types `?pbUncapMaxPeakMiB=380`, not 398458880.
 */
export const URL_PARAM_BY_KEY = {
    appBaselineFloorBytes: 'pbAppBaselineFloorMiB',
    planTransientExcessBytes: 'pbPlanTransientExcessMiB',
    uncapMaxPeakBytes: 'pbUncapMaxPeakMiB'
};

/** RUNG 2's keys inside `hydrataConfig.playbackMemory`, same MiB units. */
export const SITE_KEY_BY_KEY = {
    appBaselineFloorBytes: 'appBaselineFloorMiB',
    planTransientExcessBytes: 'planTransientExcessMiB',
    uncapMaxPeakBytes: 'uncapMaxPeakMiB'
};

/**
 * Which way is MORE CONSERVATIVE, per constant — the only direction RUNG 2 may
 * move a value.
 *
 * `appBaselineFloorBytes` is subtracted from the heap offer, so a HIGHER floor
 * leaves playback less budget. `planTransientExcessBytes` is subtracted from
 * the window budget, so HIGHER means a shallower window.
 * `uncapMaxPeakBytes` caps the window budget outright, so LOWER means a
 * shallower window.
 */
export const SITE_SAFE_DIRECTION = {
    appBaselineFloorBytes: 'higher',
    planTransientExcessBytes: 'higher',
    uncapMaxPeakBytes: 'lower'
};

const BYTES_PER_MIB = 1024 * 1024;

/**
 * A positive, finite MiB value as BYTES, or null.
 *
 * Anything else — NaN, a negative, an empty string, a word, an array — is
 * null, and the caller records a rejection. Zero is refused on both transports
 * even though the module's own bands accept it: a typed `0` is a typo far more
 * often than it is a deliberate request to collapse a term.
 *
 * @param {*} raw the transport's value
 * @returns {number|null} bytes, or null if the value is not usable
 */
export function parseMiB(raw) {
    if (raw === null || raw === undefined || raw === '' || Array.isArray(raw)) {
        return null;
    }
    const mib = Number(raw);
    if (!isFinite(mib) || mib <= 0) {
        return null;
    }
    return Math.round(mib * BYTES_PER_MIB);
}

/**
 * Query params from BOTH halves of a MapStore hash url.
 *
 * The map lives at `/catalogue/#/map/<id>`, so an operator may hang the param
 * off either the document's own query string or the hash route's. Read both,
 * hash last, so the more specific one wins.
 *
 * @param {object|null} location a `window.location`-shaped object
 * @returns {object} plain `{param: value}` map
 */
export function readLocationParams(location) {
    const out = {};
    if (!location) {
        return out;
    }
    const chunks = [];
    if (location.search) {
        chunks.push(String(location.search).replace(/^\?/, ''));
    }
    if (location.hash) {
        const queryStart = String(location.hash).indexOf('?');
        if (queryStart > -1) {
            chunks.push(String(location.hash).slice(queryStart + 1));
        }
    }
    chunks.forEach((chunk) => {
        chunk.split('&').forEach((pair) => {
            if (!pair) {
                return;
            }
            const eq = pair.indexOf('=');
            const key = decodeURIComponent(eq > -1 ? pair.slice(0, eq) : pair);
            const value = eq > -1 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
            out[key] = value;
        });
    });
    return out;
}

/**
 * Resolve the runtime policy overrides for ONE playback run.
 *
 * @param {object} [options]
 * @param {object} [options.location] a `window.location`-shaped object (RUNG 1)
 * @param {object} [options.siteConfig] `getConfigProp('hydrataConfig')` (RUNG 2)
 * @param {boolean} [options.isTester] `state.anuga.ui.canSelectComputeTarget`
 * @returns {{overrides: object, sources: object, notes: string[],
 *   supplied: boolean}} `overrides` is the object to SPREAD into
 *   `resolvePlaybackHeapBudgetFromEnvironment` and both
 *   `computePlaybackMemoryPlan` calls — it carries only the keys that were
 *   accepted, plus `overrideSources` for the plan to echo. `notes` carries one
 *   line per rejection or refusal, for the console and for a spec to assert.
 */
export function resolvePlaybackPolicyOverrides({
    location = null,
    siteConfig = null,
    isTester = false
} = {}) {
    const values = {};
    const sources = {};
    const notes = [];
    let supplied = false;

    // --- RUNG 2 first, so a tester's own url wins on a conflict.
    const siteBlock = (siteConfig && siteConfig.playbackMemory) || null;
    POLICY_KEYS.forEach((key) => {
        if (!siteBlock || siteBlock[SITE_KEY_BY_KEY[key]] === undefined) {
            return;
        }
        supplied = true;
        const raw = siteBlock[SITE_KEY_BY_KEY[key]];
        const bytes = parseMiB(raw);
        if (bytes === null) {
            notes.push(`site ${SITE_KEY_BY_KEY[key]}=${JSON.stringify(raw)} IGNORED: not a positive number of MiB`);
            return;
        }
        const shipped = SHIPPED_POLICY_CONSTANTS[key];
        const conservative = SITE_SAFE_DIRECTION[key] === 'higher'
            ? bytes >= shipped
            : bytes <= shipped;
        if (!conservative) {
            // REJECTED, not clamped: a silently clamped value is
            // indistinguishable from one that was never read, which is the
            // unfalsifiable shape this epic has already been caught by twice.
            notes.push(
                `site ${SITE_KEY_BY_KEY[key]}=${Math.round(bytes / BYTES_PER_MIB)} REJECTED: a site value may only`
                + ` make playback MORE conservative (${SITE_SAFE_DIRECTION[key]} than the shipped`
                + ` ${Math.round(shipped / BYTES_PER_MIB)} MiB) — it reaches every visitor of this site,`
                + ' anonymous ones included'
            );
            return;
        }
        values[key] = bytes;
        sources[key] = 'site';
    });

    // --- RUNG 1, per tester, per tab. Both directions, gated FAIL CLOSED.
    const params = readLocationParams(location);
    POLICY_KEYS.forEach((key) => {
        const param = URL_PARAM_BY_KEY[key];
        if (params[param] === undefined) {
            return;
        }
        supplied = true;
        if (isTester !== true) {
            notes.push(
                `url ${param} IGNORED: the tester capability canSelectComputeTarget is not`
                + ' true in this tab (it hydrates asynchronously, so an early PLAYBACK_INIT reads false)'
            );
            return;
        }
        const bytes = parseMiB(params[param]);
        if (bytes === null) {
            notes.push(`url ${param}=${JSON.stringify(params[param])} IGNORED: not a positive number of MiB`);
            return;
        }
        values[key] = bytes;
        sources[key] = 'url';
    });

    return {
        overrides: { ...values, overrideSources: sources },
        sources,
        notes,
        supplied
    };
}

/**
 * The one-line resolution report: what each constant ended up as, where it came
 * from, and every value that was refused.
 *
 * AC7(iii)'s whole point — an operator must be able to tell "my override took"
 * from "my override was clamped away" in ONE console line, without a census.
 *
 * @param {object} resolution a :func:`resolvePlaybackPolicyOverrides` result
 * @returns {string}
 */
export function describePolicyOverrides(resolution) {
    const { overrides = {}, sources = {}, notes = [] } = resolution || {};
    const shown = POLICY_KEYS.map((key) => {
        const bytes = overrides[key] === undefined ? SHIPPED_POLICY_CONSTANTS[key] : overrides[key];
        const from = sources[key] || 'shipped';
        return `${key}=${(bytes / BYTES_PER_MIB).toFixed(1)} MiB (${from})`;
    }).join(', ');
    return notes.length ? `${shown} | ${notes.join(' | ')}` : shown;
}

/**
 * The tester gate, read off redux state. `=== true` is the whole point: an
 * un-hydrated read is `false`/`undefined` and must not honour anything.
 *
 * @param {object} state redux state
 * @returns {boolean}
 */
export function isPlaybackPolicyTester(state) {
    return !!(state && state.anuga && state.anuga.ui
        && state.anuga.ui.canSelectComputeTarget === true);
}

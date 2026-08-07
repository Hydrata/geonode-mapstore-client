/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getToken } from '@mapstore/framework/utils/SecurityUtils';

/**
 * TASK-2659 — authkey warm-up probe.
 *
 * Every FE tile URL carries ?access_token=<key>. GeoServer's authkey filter
 * (first in the default chain) maps key->user via an HTTP callback
 * (GET /api/o/v4/keyinfo) and caches the mapping for cacheTtlSeconds=300 with
 * NO request coalescing — so after any >=5-min idle, a map open fires ~130
 * concurrent tile requests that ALL miss that cache and each pays the full
 * ~0.4-1.4s cold-auth path even on fully GWC-cached tiles (15-20s paint,
 * proven live 2026-08-07). The cache is keyed on the token alone, so ONE
 * token-bearing request warms the whole session, private layers included.
 *
 * This module: (1) fires one minimal GetMap before the map mounts — awaited by
 * setupConfiguration on map-destined pages, fail-open, bounded by
 * PROBE_TIMEOUT_MS; (2) re-probes every KEEPALIVE_INTERVAL_MS — deliberately
 * just ABOVE the 300s cache clocks, so each idle-tab re-probe is a genuine
 * MISS that re-warms (see the constant's comment for the two-layer cache
 * semantics); (3) re-probes immediately when a hidden tab becomes visible,
 * because background-tab timers are throttled/frozen and cannot be trusted
 * across an idle-in-background gap. Anonymous sessions skip the authkey
 * filter entirely (no token on tile URLs), so no token means no probe.
 *
 * The operator explicitly rejected raising cacheTtlSeconds (revocation latency
 * must stay <=300s) and rejected dropping tokens from tile URLs (private
 * layers essential) — the probe is the chosen fix, not a workaround.
 *
 * Known residual (out of FE reach): during CONTINUOUS tile activity the
 * filter-level auth cache still hard-expires 600s after its last write, and
 * the first tile wave after that pays the rebuild itself — request coalescing
 * inside GeoServer is the only real cure for that one. The probe eliminates
 * the idle-then-open stampede, which is the case users actually hit.
 */

export const PROBE_ENDPOINT = '/geoserver/ows';
export const PROBE_TIMEOUT_MS = 2500;
// GeoServer holds TWO caches for a token and neither is extended by a HIT
// (verified against the fleet's gs-authkey/gs-main 2.27.4 bytecode in the
// TASK-2659 review): the authkey mapper cache is expire-after-WRITE at
// cacheTtlSeconds=300, and the filter-level auth cache (Guava) is idle=300 /
// HARD timeToLive=600 from creation, rewritten only when an authentication
// actually MISSes. A cadence BELOW 300s therefore only ever HITs — it writes
// nothing, both entries still die on schedule, and every ~720s an idle tab
// would sit in a ~120s fully-cold window while the keepalive "succeeds".
// Probing just ABOVE the 300s clocks makes each idle-tab probe a deliberate
// MISS that re-warms both layers, at the cost of exactly one keyinfo callback
// per probe (the Loki observable: one keyinfo per open tab per ~310s). Chrome
// throttling only ever fires timers LATE, which keeps probes on the MISS side.
export const KEEPALIVE_INTERVAL_MS = 310 * 1000;
// Focus flapping (alt-tab bursts) must not machine-gun probes.
export const MIN_PROBE_GAP_MS = 30 * 1000;
// A hung in-flight probe must not block the visibility re-probe forever: its
// 2.5s escape hatch is itself a timer, and hidden-tab timers can be frozen
// along with it. Past this age the in-flight flag is presumed stale.
export const STALE_PROBE_RESET_MS = PROBE_TIMEOUT_MS + 1000;

/**
 * Build the probe URL: a deliberately parameter-less GetMap. GeoServer answers
 * it with a small ServiceException, but the security filter chain (authkey
 * included) runs BEFORE the WMS dispatcher rejects it, which is all we need.
 *
 * REQUEST=GetMap is itself what gets the probe past prod nginx's proxy_cache
 * on `location /geoserver/ows`: the $arg_REQUEST bypass map caches ONLY
 * GetCapabilities — every GetMap is proxy_no_cache + proxy_cache_bypass
 * (cache_status=BYPASS in nginx-access), so probes always reach GeoServer.
 * The `_probe` timestamp is (a) the clean Loki log signature (|= "_probe")
 * that AC1/AC3 verification greps for, and (b) defense-in-depth should that
 * bypass map ever narrow to start caching GetMap responses.
 *
 * @param {string} token OAuth2 access token.
 * @param {number} [nowMs] timestamp for the cache-buster (defaults to now).
 * @returns {string} relative probe URL.
 */
export function buildProbeUrl(token, nowMs = Date.now()) {
    return `${PROBE_ENDPOINT}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap`
        + `&access_token=${encodeURIComponent(token)}&_probe=${nowMs}`;
}

/**
 * Fire one warm-up request and wait for it, fail-open. The returned promise
 * NEVER rejects and always settles within ~timeoutMs: a probe failure must
 * never be able to block or delay the map beyond the timeout.
 *
 * @param {string} token OAuth2 access token; falsy resolves false immediately.
 * @param {object} [options]
 * @param {number} [options.timeoutMs] settle deadline (default PROBE_TIMEOUT_MS).
 * @param {function} [options.fetchFn] injectable fetch (tests).
 * @param {string} [options.probeUrl] injectable URL override (tests).
 * @returns {Promise<boolean>} true when the probe round-tripped, false otherwise.
 */
export function warmupAuthkeyProbe(token, { timeoutMs = PROBE_TIMEOUT_MS, fetchFn, probeUrl } = {}) {
    if (!token) {
        return Promise.resolve(false);
    }
    const doFetch = fetchFn || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        let settled = false;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timer;
        const finish = (ok) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(ok);
            }
        };
        timer = setTimeout(() => {
            if (controller) {
                try {
                    controller.abort();
                } catch (e) {
                    // an exotic AbortController is not allowed to break fail-open
                }
            }
            finish(false);
        }, timeoutMs);
        try {
            // Bare fetch on purpose: the app axios instance carries the
            // TASK-1587 session-expiry response interceptor, which must never
            // be able to redirect the user because a PROBE saw a 401.
            // credentials:'omit' so a stray GeoServer JSESSIONID cannot
            // short-circuit the filter chain past the authkey mapper.
            doFetch(probeUrl || buildProbeUrl(token), {
                credentials: 'omit',
                cache: 'no-store',
                ...(controller ? { signal: controller.signal } : {})
            }).then(() => finish(true), () => finish(false));
        } catch (e) {
            finish(false);
        }
    });
}

/**
 * Keep the authkey mapping warm while the tab lives: re-probe on a cadence
 * inside the 300s TTL, and immediately when a hidden tab becomes visible
 * (Chrome freezes background-tab timers, so the interval alone cannot cover
 * the tab-switch-back case). At most one probe in flight at a time.
 *
 * @param {function} getTokenFn returns the CURRENT token at fire time (tokens
 *   can rotate); a falsy return skips that tick.
 * @param {object} [options]
 * @param {number} [options.intervalMs] cadence (default KEEPALIVE_INTERVAL_MS).
 * @param {function} [options.probeFn] injectable probe (tests).
 * @param {object} [options.doc] injectable document (tests — ChromeHeadless
 *   cannot fake visibilityState, same seam philosophy as pollingEpics).
 * @returns {function} stop() — clears the interval and the visibility hook.
 */
export function startAuthkeyKeepalive(getTokenFn, { intervalMs = KEEPALIVE_INTERVAL_MS, probeFn = warmupAuthkeyProbe, doc } = {}) {
    const target = doc || (typeof document !== 'undefined' ? document : null);
    let inFlight = false;
    let inFlightSince = 0;
    let lastFireAt = null;
    const fire = () => {
        const now = Date.now();
        // a hung probe's own timeout timer can be frozen with the hidden tab,
        // so a fresh in-flight blocks re-probes but a stale one is overridden
        if (inFlight && (now - inFlightSince) <= STALE_PROBE_RESET_MS) {
            return;
        }
        if (lastFireAt !== null && (now - lastFireAt) < MIN_PROBE_GAP_MS) {
            return;
        }
        const token = getTokenFn && getTokenFn();
        if (!token) {
            return;
        }
        inFlight = true;
        inFlightSince = now;
        lastFireAt = now;
        const clear = () => { inFlight = false; };
        probeFn(token).then(clear, clear);
    };
    const intervalId = setInterval(fire, intervalMs);
    const onVisibility = () => {
        if (target && target.visibilityState === 'visible') {
            fire();
        }
    };
    if (target && target.addEventListener) {
        target.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
        clearInterval(intervalId);
        if (target && target.removeEventListener) {
            target.removeEventListener('visibilitychange', onVisibility);
        }
    };
}

/**
 * Whether this page's boot should BLOCK on the warm-up. Map-destined pages
 * (viewer routes, map/dataset embeds) mount OL tile sources as soon as
 * plugins render, so they must await; homepage/search/document boots make no
 * GeoServer requests and must not pay a cold-auth wait before first render —
 * they still FIRE the probe (setupConfiguration always calls bootstrap), so
 * an SPA hop into a map minutes later starts warm.
 *
 * @param {object} [loc] `{hash, pathname}` — pass window.location's fields.
 * @returns {boolean} true when boot should await the probe.
 */
export function shouldAwaitAuthkeyWarmup({ hash, pathname } = {}) {
    const mapish = /\/(maps?|datasets?)\//;
    return mapish.test(hash || '') || mapish.test(pathname || '');
}

let keepaliveStopFn = null;

/**
 * The bootstrap entry point, called (and awaited) by setupConfiguration for
 * every app: probe once with the just-fetched account token, then start the
 * keepalive exactly once per page. NEVER rejects — the boot chain must not be
 * blockable from here.
 *
 * The keepalive reads the live redux token via SecurityUtils.getToken() once
 * the store exists, falling back to the bootstrap token before that.
 *
 * @param {string} token access token from getAccountInfo (user.info.access_token).
 * @param {object} [options] injectable probeFn/startKeepaliveFn/getTokenFn (tests).
 * @returns {Promise<boolean>} the initial probe's outcome.
 */
export function bootstrapAuthkeyWarmup(token, { probeFn = warmupAuthkeyProbe, startKeepaliveFn = startAuthkeyKeepalive, getTokenFn } = {}) {
    if (!token) {
        return Promise.resolve(false);
    }
    const liveTokenWithFallback = () => {
        try {
            return getToken() || token;
        } catch (e) {
            // no store yet (or an exotic state shape) — bootstrap token stands in
            return token;
        }
    };
    return probeFn(token)
        .then((ok) => {
            if (!keepaliveStopFn) {
                keepaliveStopFn = startKeepaliveFn(getTokenFn || liveTokenWithFallback);
            }
            return ok;
        })
        .catch(() => false);
}

/**
 * Test-only: stop a running keepalive and clear the once-per-page latch.
 */
export function _resetAuthkeyWarmupForTests() {
    if (keepaliveStopFn) {
        keepaliveStopFn();
        keepaliveStopFn = null;
    }
}

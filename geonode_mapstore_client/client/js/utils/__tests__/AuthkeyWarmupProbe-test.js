/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import withFakeTimers from '../../__tests__/helpers/withFakeTimers';
import {
    PROBE_TIMEOUT_MS,
    KEEPALIVE_INTERVAL_MS,
    MIN_PROBE_GAP_MS,
    STALE_PROBE_RESET_MS,
    buildProbeUrl,
    warmupAuthkeyProbe,
    startAuthkeyKeepalive,
    bootstrapAuthkeyWarmup,
    shouldAwaitAuthkeyWarmup,
    _resetAuthkeyWarmupForTests
} from '../AuthkeyWarmupProbe';

// TASK-2659 — authkey warm-up probe.
//
// GeoServer's authkey filter caches the token->user mapping for 300s with no
// request coalescing, so after any >=5-min idle EVERY concurrent tile request
// of a map open pays the ~0.4-1.4s cold-auth path (15-20s paint on cached
// tiles). One token-bearing request warms the whole session. These tests
// drive the probe module in isolation: fetch, timers, document and the
// keepalive collaborators are all injected (ChromeHeadless cannot fake
// document.visibilityState, so visibility is driven through a fake doc —
// same seam philosophy as pollingEpics' __setVisibilityForTests).
describe('AuthkeyWarmupProbe (TASK-2659)', () => {

    beforeEach(() => {
        _resetAuthkeyWarmupForTests();
    });

    const makeFakeDoc = (initialState = 'visible') => {
        const listeners = {};
        return {
            visibilityState: initialState,
            addEventListener: (type, handler) => {
                listeners[type] = (listeners[type] || []).concat(handler);
            },
            removeEventListener: (type, handler) => {
                listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
            },
            emit: (type) => {
                (listeners[type] || []).forEach((h) => h());
            },
            listenerCount: (type) => (listeners[type] || []).length
        };
    };

    describe('buildProbeUrl', () => {
        it('builds a minimal token-bearing GetMap against /geoserver/ows', () => {
            const u = buildProbeUrl('tok-123', 1000);
            expect(u.indexOf('/geoserver/ows?')).toBe(0);
            expect(u).toContain('SERVICE=WMS');
            expect(u).toContain('VERSION=1.3.0');
            expect(u).toContain('REQUEST=GetMap');
            expect(u).toContain('access_token=tok-123');
        });

        it('URL-encodes the token', () => {
            const u = buildProbeUrl('my token+/=', 1000);
            expect(u).toContain('access_token=my%20token%2B%2F%3D');
        });

        it('carries a per-call cache-buster timestamp (log signature + cache defense-in-depth)', () => {
            // The operative nginx-cache guard is REQUEST=GetMap matching the
            // $arg_REQUEST bypass map (only GetCapabilities is cached); _probe
            // is the Loki log signature for AC1/AC3 and insurance should that
            // map ever narrow. Distinct timestamps MUST yield distinct URLs.
            const u1 = buildProbeUrl('tok', 1000);
            const u2 = buildProbeUrl('tok', 2000);
            expect(u1).toContain('_probe=1000');
            expect(u2).toContain('_probe=2000');
            expect(u1 === u2).toBe(false);
        });
    });

    describe('cadence constants', () => {
        it('keepalive cadence sits ABOVE the 300s cache clocks (probe-as-deliberate-MISS)', () => {
            // GeoServer's mapper cache (expire-after-write, 300s) and filter
            // auth cache (idle 300s / hard 600s, rewritten only on MISS) are
            // never extended by a HIT — a sub-300s cadence writes nothing and
            // leaves a recurring ~120s cold window every ~720s. This tripwire
            // guards the load-bearing property, not the exact number.
            expect(KEEPALIVE_INTERVAL_MS).toBeGreaterThan(300 * 1000);
            expect(KEEPALIVE_INTERVAL_MS).toBeLessThan(360 * 1000);
        });
    });

    describe('shouldAwaitAuthkeyWarmup', () => {
        it('awaits on map-destined routes and embeds', () => {
            expect(shouldAwaitAuthkeyWarmup({ hash: '#/map/1418', pathname: '/catalogue/' })).toBe(true);
            expect(shouldAwaitAuthkeyWarmup({ hash: '#/dataset/geonode:x', pathname: '/catalogue/' })).toBe(true);
            expect(shouldAwaitAuthkeyWarmup({ hash: '', pathname: '/maps/6130/embed' })).toBe(true);
            expect(shouldAwaitAuthkeyWarmup({ hash: '', pathname: '/datasets/geonode:x/embed' })).toBe(true);
        });

        it('does not block homepage/search/document boots', () => {
            expect(shouldAwaitAuthkeyWarmup({ hash: '', pathname: '/' })).toBe(false);
            expect(shouldAwaitAuthkeyWarmup({ hash: '#/search/?f=dataset', pathname: '/catalogue/' })).toBe(false);
            expect(shouldAwaitAuthkeyWarmup({ hash: '', pathname: '/documents/123' })).toBe(false);
            expect(shouldAwaitAuthkeyWarmup({})).toBe(false);
        });
    });

    describe('warmupAuthkeyProbe', () => {
        it('resolves false without fetching when there is no token (anonymous skips the filter)', (done) => {
            let called = 0;
            const fetchFn = () => { called += 1; return Promise.resolve({ ok: true }); };
            warmupAuthkeyProbe(null, { fetchFn }).then((ok) => {
                expect(ok).toBe(false);
                expect(called).toBe(0);
                done();
            });
        });

        it('fires exactly one cookie-less GET carrying the token and resolves true', (done) => {
            const seen = [];
            const fetchFn = (u, opts) => {
                seen.push({ u, opts });
                return Promise.resolve({ ok: true, status: 200 });
            };
            warmupAuthkeyProbe('my token+', { fetchFn }).then((ok) => {
                expect(ok).toBe(true);
                expect(seen.length).toBe(1);
                expect(seen[0].u).toContain('/geoserver/ows?');
                expect(seen[0].u).toContain('access_token=my%20token%2B');
                // credentials omitted: the token in the URL is the whole point;
                // a stray JSESSIONID must not short-circuit the authkey mapper.
                expect(seen[0].opts.credentials).toBe('omit');
                expect(seen[0].opts.cache).toBe('no-store');
                done();
            });
        });

        it('resolves false (never rejects) when the fetch rejects', (done) => {
            const fetchFn = () => Promise.reject(new Error('network down'));
            warmupAuthkeyProbe('tok', { fetchFn }).then((ok) => {
                expect(ok).toBe(false);
                done();
            });
        });

        it('resolves false (never rejects) when the fetch throws synchronously', (done) => {
            const fetchFn = () => { throw new Error('boom'); };
            warmupAuthkeyProbe('tok', { fetchFn }).then((ok) => {
                expect(ok).toBe(false);
                done();
            });
        });

        it('resolves false after the timeout when the fetch hangs (fail-open)', (done) => {
            const clock = withFakeTimers();
            const hangingFetch = () => new Promise(() => {});
            const p = warmupAuthkeyProbe('tok', { fetchFn: hangingFetch });
            clock.tick(PROBE_TIMEOUT_MS);
            p.then((ok) => {
                expect(ok).toBe(false);
                done();
            });
        });

        it('honours a caller-supplied timeoutMs', (done) => {
            const clock = withFakeTimers();
            const hangingFetch = () => new Promise(() => {});
            const p = warmupAuthkeyProbe('tok', { fetchFn: hangingFetch, timeoutMs: 100 });
            clock.tick(100);
            p.then((ok) => {
                expect(ok).toBe(false);
                done();
            });
        });
    });

    describe('startAuthkeyKeepalive', () => {
        it('re-probes on the keepalive cadence with the token from getTokenFn', (done) => {
            const clock = withFakeTimers();
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const stop = startAuthkeyKeepalive(() => 'tok-a', { probeFn, doc: makeFakeDoc() });
            expect(calls.length).toBe(0);
            clock.tick(KEEPALIVE_INTERVAL_MS);
            expect(calls.length).toBe(1);
            expect(calls[0]).toBe('tok-a');
            // let the in-flight guard clear before the next interval fires
            Promise.resolve().then(() => {
                clock.tick(KEEPALIVE_INTERVAL_MS);
                expect(calls.length).toBe(2);
                stop();
                done();
            });
        });

        it('skips a tick when getTokenFn returns nothing (logged-out tab)', () => {
            const clock = withFakeTimers();
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const stop = startAuthkeyKeepalive(() => null, { probeFn, doc: makeFakeDoc() });
            clock.tick(KEEPALIVE_INTERVAL_MS);
            expect(calls.length).toBe(0);
            stop();
        });

        it('re-probes immediately when a hidden tab becomes visible', () => {
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const doc = makeFakeDoc('hidden');
            const stop = startAuthkeyKeepalive(() => 'tok-v', { probeFn, doc });
            expect(calls.length).toBe(0);
            doc.visibilityState = 'visible';
            doc.emit('visibilitychange');
            expect(calls.length).toBe(1);
            expect(calls[0]).toBe('tok-v');
            stop();
        });

        it('does NOT probe on visibilitychange to hidden', () => {
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const doc = makeFakeDoc('visible');
            const stop = startAuthkeyKeepalive(() => 'tok', { probeFn, doc });
            doc.visibilityState = 'hidden';
            doc.emit('visibilitychange');
            expect(calls.length).toBe(0);
            stop();
        });

        it('deduplicates: no second probe while one is still in flight', () => {
            const calls = [];
            const probeFn = (token) => { calls.push(token); return new Promise(() => {}); };
            const doc = makeFakeDoc('visible');
            const stop = startAuthkeyKeepalive(() => 'tok', { probeFn, doc });
            doc.emit('visibilitychange');
            doc.emit('visibilitychange');
            expect(calls.length).toBe(1);
            stop();
        });

        it('overrides a STALE in-flight probe on visibility (frozen-tab timer can never clear it)', () => {
            // a hidden tab can freeze the hung probe's own 2.5s escape-hatch
            // timer; past STALE_PROBE_RESET_MS the in-flight flag must not be
            // allowed to swallow the one probe the design guarantees: the
            // visibilitychange->visible re-probe.
            const clock = withFakeTimers();
            const calls = [];
            const probeFn = (token) => { calls.push(token); return new Promise(() => {}); };
            const doc = makeFakeDoc('visible');
            const stop = startAuthkeyKeepalive(() => 'tok', { probeFn, doc });
            doc.emit('visibilitychange');
            expect(calls.length).toBe(1);
            // past BOTH the stale threshold and the flap gap (a real frozen-tab
            // return is minutes later, well past both)
            clock.tick(MIN_PROBE_GAP_MS + STALE_PROBE_RESET_MS);
            doc.emit('visibilitychange');
            expect(calls.length).toBe(2);
            stop();
        });

        it('rate-limits focus flapping: a re-probe within MIN_PROBE_GAP_MS is skipped', (done) => {
            const clock = withFakeTimers();
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const doc = makeFakeDoc('visible');
            const stop = startAuthkeyKeepalive(() => 'tok', { probeFn, doc });
            doc.emit('visibilitychange');
            expect(calls.length).toBe(1);
            Promise.resolve().then(() => {
                // in-flight has cleared; only the gap can be suppressing now
                doc.emit('visibilitychange');
                expect(calls.length).toBe(1);
                clock.tick(MIN_PROBE_GAP_MS);
                doc.emit('visibilitychange');
                expect(calls.length).toBe(2);
                stop();
                done();
            });
        });

        it('stop() clears the interval and removes the visibility listener', () => {
            const clock = withFakeTimers();
            const calls = [];
            const probeFn = (token) => { calls.push(token); return Promise.resolve(true); };
            const doc = makeFakeDoc('visible');
            const stop = startAuthkeyKeepalive(() => 'tok', { probeFn, doc });
            expect(doc.listenerCount('visibilitychange')).toBe(1);
            stop();
            expect(doc.listenerCount('visibilitychange')).toBe(0);
            clock.tick(KEEPALIVE_INTERVAL_MS * 3);
            expect(calls.length).toBe(0);
        });
    });

    describe('bootstrapAuthkeyWarmup', () => {
        it('resolves false and starts nothing when there is no token', (done) => {
            let probeCalls = 0;
            let keepaliveStarts = 0;
            const probeFn = () => { probeCalls += 1; return Promise.resolve(true); };
            const startKeepaliveFn = () => { keepaliveStarts += 1; return () => {}; };
            bootstrapAuthkeyWarmup(undefined, { probeFn, startKeepaliveFn }).then((ok) => {
                expect(ok).toBe(false);
                expect(probeCalls).toBe(0);
                expect(keepaliveStarts).toBe(0);
                done();
            });
        });

        it('awaits the probe, then starts the keepalive (in that order)', (done) => {
            const sequence = [];
            const probeFn = (token) => {
                sequence.push(`probe:${token}`);
                return Promise.resolve(true);
            };
            const startKeepaliveFn = () => {
                sequence.push('keepalive');
                return () => {};
            };
            bootstrapAuthkeyWarmup('tok-boot', { probeFn, startKeepaliveFn }).then((ok) => {
                expect(ok).toBe(true);
                expect(sequence).toEqual(['probe:tok-boot', 'keepalive']);
                done();
            });
        });

        it('still starts the keepalive when the initial probe fails (cadence must survive a blip)', (done) => {
            let keepaliveStarts = 0;
            const probeFn = () => Promise.resolve(false);
            const startKeepaliveFn = () => { keepaliveStarts += 1; return () => {}; };
            bootstrapAuthkeyWarmup('tok', { probeFn, startKeepaliveFn }).then((ok) => {
                expect(ok).toBe(false);
                expect(keepaliveStarts).toBe(1);
                done();
            });
        });

        it('never rejects, even if an injected probe rejects', (done) => {
            const probeFn = () => Promise.reject(new Error('boom'));
            const startKeepaliveFn = () => () => {};
            bootstrapAuthkeyWarmup('tok', { probeFn, startKeepaliveFn }).then((ok) => {
                expect(ok).toBe(false);
                done();
            });
        });

        it('starts the keepalive only once across repeated bootstraps', (done) => {
            let keepaliveStarts = 0;
            const probeFn = () => Promise.resolve(true);
            const startKeepaliveFn = () => { keepaliveStarts += 1; return () => {}; };
            bootstrapAuthkeyWarmup('tok', { probeFn, startKeepaliveFn })
                .then(() => bootstrapAuthkeyWarmup('tok', { probeFn, startKeepaliveFn }))
                .then(() => {
                    expect(keepaliveStarts).toBe(1);
                    done();
                });
        });

        it('hands the keepalive a getTokenFn that yields the bootstrap token as fallback', (done) => {
            let capturedGetToken;
            const probeFn = () => Promise.resolve(true);
            const startKeepaliveFn = (getTokenFn) => {
                capturedGetToken = getTokenFn;
                return () => {};
            };
            bootstrapAuthkeyWarmup('tok-fallback', { probeFn, startKeepaliveFn }).then(() => {
                // outside a mounted app the redux store has no token, so the
                // bootstrap token must come back as the fallback
                expect(capturedGetToken()).toBe('tok-fallback');
                done();
            });
        });
    });
});

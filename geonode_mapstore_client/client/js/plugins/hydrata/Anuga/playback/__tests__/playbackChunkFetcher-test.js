/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2625 (W2.1, epic 2618) — PlaybackChunkFetcher tests: manifest fetch,
 * ranged GET -> gzip decode -> dequantize via the real fixture store, LRU
 * cache integration, 403 -> manifest-refresh, and the prefetch-window API
 * consumed by a stub playback controller.
 *
 * fetchImpl is always injected (constructor dependency) rather than
 * stubbing the global `fetch` — no sinon in this repo's karma deps, and DI
 * is the simpler/more explicit seam here anyway.
 */
import expect from 'expect';
import { PlaybackChunkFetcher, fetchPlaybackManifest } from '../playbackChunkFetcher';
import { PlaybackChunkCache } from '../playbackChunkCache';
import { dequantizeRow } from '../playbackDecode';
import {
    FIXTURE_STORE_FILES,
    FIXTURE_MANIFEST,
    FIXTURE_ARRAY_META,
    FIXTURE_PHYSICAL,
    FIXTURE_MESH
} from './fixtures/fixturePlaybackStore';

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// A fetchImpl backed by the fixture store's files: manifest.chunk_urls values
// are the relative keys themselves (see fixturePlaybackStore.js's generator),
// so "the URL" IS the lookup key here — exactly mirroring how the real
// fetcher never assumes an S3 origin, it just follows whatever URL string
// the manifest hands it.
function makeFixtureFetch({ spy } = {}) {
    return function fixtureFetch(url, options) {
        if (spy) {
            spy.push({ url, headers: options && options.headers });
        }
        const b64 = FIXTURE_STORE_FILES[url];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
}

describe('fetchPlaybackManifest', () => {
    it('GETs the manifest URL and parses the JSON body', (done) => {
        const manifestUrl = '/api/v2/anuga/runs/1/playback-manifest/';
        const fetchImpl = (url) => {
            expect(url).toBe(manifestUrl);
            return Promise.resolve(new Response(JSON.stringify(FIXTURE_MANIFEST), { status: 200 }));
        };
        fetchPlaybackManifest(manifestUrl, fetchImpl).then((manifest) => {
            expect(manifest.prefix).toBe(FIXTURE_MANIFEST.prefix);
            expect(Object.keys(manifest.chunk_urls).length).toBe(Object.keys(FIXTURE_MANIFEST.chunk_urls).length);
            done();
        }).catch(done);
    });

    it('rejects on a non-ok response (e.g. run has no playback store, 404)', (done) => {
        const fetchImpl = () => Promise.resolve(new Response(null, { status: 404 }));
        fetchPlaybackManifest('/whatever/', fetchImpl).then(
            () => done(new Error('expected rejection')),
            () => done()
        );
    });
});

describe('PlaybackChunkFetcher', () => {
    it('throws if constructed without a manifest', () => {
        expect(() => new PlaybackChunkFetcher({})).toThrow();
    });

    // TASK-2708 (W1.2, epic 2706) rewrote this spec's expectation, not its
    // subject: fetchAndDecodeChunk no longer dequantizes, it caches the
    // STORED uint16 and playbackDecode.dequantizeRow converts one frame's row
    // at slice time. The old assertion still passed after that change purely
    // because depth[0][0] is 0.0 and stored 0 dequantizes to 0.0 — a false
    // pass — so it now asserts the dtype explicitly and checks a NON-zero
    // sample through dequantizeRow.
    it('fetches, gunzips and decodes a real chunk end-to-end, caching it in the STORED uint16 form', (done) => {
        const spy = [];
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch({ spy })
        });
        const quantization = FIXTURE_ARRAY_META.depth.attributes;
        fetcher.fetchAndDecodeChunk('depth', [0, 0], { dtype: 'uint16', byteorder: quantization.byteorder, quantization })
            .then((stored) => {
                expect(stored.constructor).toBe(Uint16Array);
                expect(stored.length).toBe(10 * FIXTURE_MESH.nNode);
                const nNode = FIXTURE_MESH.nNode;
                const row = dequantizeRow(stored, 1 * nNode, nNode, quantization);
                expect(Math.abs(row[0] - FIXTURE_PHYSICAL.depth[1][0]) <= quantization.scale + 1e-6).toBe(true);
                expect(row[0] > 0).toBe(true);
                // The chunk was requested as a Range GET (TASK-2625 AC: "ranged GETs").
                expect(spy.length).toBe(1);
                expect(spy[0].url).toBe('depth/c/0/0');
                expect(spy[0].headers.Range).toBe('bytes=0-');
                done();
            }).catch(done);
    });

    it('serves a repeated request for the same chunk from cache without re-fetching', (done) => {
        const spy = [];
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch({ spy })
        });
        const opts = { dtype: 'float32', byteorder: 'little' };
        fetcher.fetchAndDecodeChunk('node_x', [0], opts)
            .then(() => fetcher.fetchAndDecodeChunk('node_x', [0], opts))
            .then(() => {
                expect(spy.length).toBe(1);
                done();
            }).catch(done);
    });

    it('collapses concurrent requests for the same not-yet-cached chunk into one fetch', (done) => {
        const spy = [];
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch({ spy })
        });
        const opts = { dtype: 'float32', byteorder: 'little' };
        Promise.all([
            fetcher.fetchAndDecodeChunk('node_y', [0], opts),
            fetcher.fetchAndDecodeChunk('node_y', [0], opts)
        ]).then(([a, b]) => {
            expect(spy.length).toBe(1);
            expect(a).toBe(b); // same in-flight promise resolved to both callers
            done();
        }).catch(done);
    });

    it('shares an externally-provided cache instance', (done) => {
        const cache = new PlaybackChunkCache({ maxBytes: 1024 * 1024 });
        const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, cache, fetchImpl: makeFixtureFetch() });
        fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32', byteorder: 'little' }).then(() => {
            expect(cache.has('node_x/c/0')).toBe(true);
            done();
        }).catch(done);
    });

    it('throws a clear error when the manifest has no chunk_urls entry for the requested chunk', (done) => {
        const fetcher = new PlaybackChunkFetcher({
            manifest: { chunk_urls: {} },
            fetchImpl: makeFixtureFetch()
        });
        fetcher.fetchAndDecodeChunk('depth', [0, 0], { dtype: 'uint16' }).then(
            () => done(new Error('expected rejection')),
            (err) => {
                expect(String(err)).toContain('depth/c/0/0');
                done();
            }
        );
    });

    describe('403 -> manifest refresh', () => {
        // Real chunk key ('node_x/c/0') throughout — the manifest's
        // chunk_urls are keyed by the SAME relative key fetchAndDecodeChunk
        // computes internally (chunkKey(arrayName, chunkIndices)), never by
        // the bare array name.
        it('on a 403, calls refreshManifest and retries once against the fresh URL', (done) => {
            const staleManifest = { chunk_urls: { 'node_x/c/0': 'expired-url' } };
            const freshManifest = { chunk_urls: { 'node_x/c/0': 'node_x/c/0' } };
            const calls = [];
            const fetchImpl = (url) => {
                calls.push(url);
                if (url === 'expired-url') {
                    return Promise.resolve(new Response(null, { status: 403 }));
                }
                const b64 = FIXTURE_STORE_FILES[url];
                return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
            };
            let refreshCalls = 0;
            const fetcher = new PlaybackChunkFetcher({
                manifest: staleManifest,
                fetchImpl,
                refreshManifest: () => {
                    refreshCalls++;
                    return Promise.resolve(freshManifest);
                }
            });
            fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32', byteorder: 'little' }).then((decoded) => {
                expect(refreshCalls).toBe(1);
                expect(calls).toEqual(['expired-url', 'node_x/c/0']);
                expect(decoded.length).toBe(FIXTURE_MESH.nNode);
                expect(fetcher.manifest).toBe(freshManifest);
                done();
            }).catch(done);
        });

        it('does not loop forever if the refreshed manifest ALSO 403s (retries exactly once)', (done) => {
            const fetchImpl = () => Promise.resolve(new Response(null, { status: 403 }));
            const fetcher = new PlaybackChunkFetcher({
                manifest: { chunk_urls: { 'node_x/c/0': 'always-expired' } },
                fetchImpl,
                refreshManifest: () => Promise.resolve({ chunk_urls: { 'node_x/c/0': 'always-expired' } })
            });
            fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32' }).then(
                () => done(new Error('expected rejection')),
                () => done()
            );
        });

        it('rejects immediately on 403 when no refreshManifest is configured', (done) => {
            const fetchImpl = () => Promise.resolve(new Response(null, { status: 403 }));
            const fetcher = new PlaybackChunkFetcher({ manifest: { chunk_urls: { 'node_x/c/0': 'url' } }, fetchImpl });
            fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32' }).then(
                () => done(new Error('expected rejection')),
                (err) => {
                    expect(String(err)).toContain('403');
                    done();
                }
            );
        });
    });

    describe('getPrefetchWindow', () => {
        const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: makeFixtureFetch() });

        it('returns a symmetric window around the center, clamped at 0', () => {
            expect(fetcher.getPrefetchWindow(0, 100, 2)).toEqual([0, 1, 2]);
        });

        it('returns a symmetric window clamped at totalChunks-1', () => {
            expect(fetcher.getPrefetchWindow(99, 100, 2)).toEqual([97, 98, 99]);
        });

        it('returns a full symmetric window in the interior', () => {
            expect(fetcher.getPrefetchWindow(50, 100, 2)).toEqual([48, 49, 50, 51, 52]);
        });

        it('returns [] for totalChunks <= 0', () => {
            expect(fetcher.getPrefetchWindow(0, 0, 2)).toEqual([]);
        });
    });

    describe('prefetchWindow (consumed by a stub playback controller)', () => {
        it('fetches every configured array across the whole window and reports {arrayName, chunkIndex, value}', (done) => {
            const spy = [];
            const fetcher = new PlaybackChunkFetcher({
                manifest: FIXTURE_MANIFEST,
                fetchImpl: makeFixtureFetch({ spy })
            });
            const depthQ = FIXTURE_ARRAY_META.depth.attributes;
            const xVelQ = FIXTURE_ARRAY_META.x_velocity.attributes;
            // A minimal stub standing in for the W2.2/W3 playback controller:
            // it only knows "I am at chunk 0 of 2, radius 1" and which arrays
            // it needs — it never touches fetch/cache/decode directly.
            const stubController = {
                currentChunkIndex: 0,
                totalChunks: 2,
                requestPrefetch(playbackFetcher) {
                    return playbackFetcher.prefetchWindow(
                        {
                            depth: { dtype: 'uint16', byteorder: depthQ.byteorder, quantization: depthQ },
                            x_velocity: { dtype: 'uint16', byteorder: xVelQ.byteorder, quantization: xVelQ }
                        },
                        this.currentChunkIndex,
                        this.totalChunks,
                        { windowRadius: 1 }
                    );
                }
            };
            stubController.requestPrefetch(fetcher).then((results) => {
                expect(results.length).toBe(4); // 2 arrays x 2 chunk indices (0,1 both within radius 1 of 0, clamped to totalChunks)
                const byKey = {};
                results.forEach((r) => {
                    expect(r.error).toBe(undefined);
                    byKey[`${r.arrayName}/${r.chunkIndex}`] = r.value;
                });
                expect(byKey['depth/0'].length).toBe(10 * FIXTURE_MESH.nNode);
                expect(byKey['depth/1']).toBeTruthy();
                expect(byKey['x_velocity/0']).toBeTruthy();
                expect(byKey['x_velocity/1']).toBeTruthy();
                // Requested exactly the 4 chunk objects, each exactly once.
                expect(spy.map((c) => c.url).sort()).toEqual([
                    'depth/c/0/0', 'depth/c/1/0', 'x_velocity/c/0/0', 'x_velocity/c/1/0'
                ]);
                done();
            }).catch(done);
        });

        it('one missing/failing array config degrades that slot to {error} without failing the others', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: makeFixtureFetch() });
            const depthQ = FIXTURE_ARRAY_META.depth.attributes;
            // 'depth' is a real time-chunked (2D) array present in the fixture
            // manifest; 'does_not_exist' has the SAME shape of config (also
            // 2D-chunked) but no manifest entry — proving the per-slot
            // degradation is about fetch/manifest failure, not a dimensionality
            // mismatch between the two configs.
            fetcher.prefetchWindow(
                {
                    depth: { dtype: 'uint16', byteorder: depthQ.byteorder, quantization: depthQ },
                    does_not_exist: { dtype: 'uint16', byteorder: 'little' }
                },
                0,
                1,
                { windowRadius: 0 }
            ).then((results) => {
                const ok = results.find((r) => r.arrayName === 'depth');
                const bad = results.find((r) => r.arrayName === 'does_not_exist');
                expect(ok.error).toBe(undefined);
                expect(ok.value).toBeTruthy();
                expect(bad.error).toBeTruthy();
                done();
            }).catch(done);
        });
    });
});

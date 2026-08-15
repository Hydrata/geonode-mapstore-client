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
import { computePlaybackMemoryPlan } from '../playbackMemoryPolicy';
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
        // TASK-2728 re-pointed this from the STATIC 'node_x' to the quantity
        // array 'depth'. The externally-provided cache is the time-series
        // window cache, and statics no longer enter it by construction
        // (playbackChunkFetcher._storeFor) — asserting node_x lands in it would
        // now be asserting the very thing 2728 removed. The contract under
        // proof here is unchanged: an injected cache is the one the fetcher
        // writes decoded QUANTITY chunks into.
        const cache = new PlaybackChunkCache({ maxBytes: 1024 * 1024 });
        const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, cache, fetchImpl: makeFixtureFetch() });
        const quantization = FIXTURE_ARRAY_META.depth.attributes;
        fetcher.fetchAndDecodeChunk('depth', [0, 0], { dtype: 'uint16', byteorder: quantization.byteorder, quantization }).then(() => {
            expect(cache.has('depth/c/0/0')).toBe(true);
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

        // TASK-2743 UAT-09 (W6, epic 2706) — per-chunk reporting.
        //
        // The batched prefetchWindow held EVERY chunk behind the window's
        // slowest member, so the controller's readiness gate (the one or two
        // chunks frame0/frame1 actually sit in) was never what it waited on.
        // Invisible at a 2-chunk window; a measured 7,954 ms cold load on map
        // 1461 once UAT-08's device-sized budget made the window 3 deep.
        describe('prefetchWindowByChunk (TASK-2743 UAT-09)', () => {
            const depthConfig = () => ({
                depth: {
                    dtype: 'uint16',
                    byteorder: FIXTURE_ARRAY_META.depth.attributes.byteorder,
                    quantization: FIXTURE_ARRAY_META.depth.attributes
                }
            });

            it('returns one group per window chunk, ascending — nearest the playhead first', () => {
                const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: makeFixtureFetch() });
                const groups = fetcher.prefetchWindowByChunk(depthConfig(), 0, 2, { windowRadius: 0, windowAhead: 1 });
                expect(groups.map((g) => g.chunkIndex)).toEqual([0, 1]);
                expect(typeof groups[0].promise.then).toBe('function');
            });

            it('a chunk resolves WITHOUT waiting for the rest of the window — the defect this fixes', (done) => {
                // chunk 1 is held open; chunk 0 must still settle. Under the
                // old Promise.all this could not resolve at all.
                let releaseChunk1 = null;
                const held = new Promise((resolve) => { releaseChunk1 = resolve; });
                const inner = makeFixtureFetch();
                const fetcher = new PlaybackChunkFetcher({
                    manifest: FIXTURE_MANIFEST,
                    fetchImpl: (url, opts) => (/\/c\/1\//.test(String(url))
                        ? held.then(() => inner(url, opts))
                        : inner(url, opts))
                });
                const groups = fetcher.prefetchWindowByChunk(depthConfig(), 0, 2, { windowRadius: 0, windowAhead: 1 });
                let chunk1Settled = false;
                groups[1].promise.then(() => { chunk1Settled = true; });
                groups[0].promise.then((results) => {
                    try {
                        expect(chunk1Settled).toBe(false);
                        expect(results.length).toBe(1);
                        expect(results[0].chunkIndex).toBe(0);
                        expect(results[0].value).toBeTruthy();
                        releaseChunk1();
                        done();
                    } catch (e) {
                        releaseChunk1();
                        done(e);
                    }
                }).catch((e) => { releaseChunk1(); done(e); });
            });

            it('prefetchWindow still returns the SAME flat, all-settled array it always did', (done) => {
                const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: makeFixtureFetch() });
                fetcher.prefetchWindow(depthConfig(), 0, 2, { windowRadius: 0, windowAhead: 1 }).then((results) => {
                    try {
                        expect(results.length).toBe(2);
                        expect(results.map((r) => r.chunkIndex)).toEqual([0, 1]);
                        expect(results.every((r) => r.arrayName === 'depth' && r.value)).toBe(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }).catch(done);
            });

            it('a failing array degrades ONLY its own chunk group', (done) => {
                const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: makeFixtureFetch() });
                const groups = fetcher.prefetchWindowByChunk(
                    { ...depthConfig(), does_not_exist: { dtype: 'uint16', byteorder: 'little' } },
                    0, 1, { windowRadius: 0 }
                );
                groups[0].promise.then((results) => {
                    try {
                        expect(results.find((r) => r.arrayName === 'depth').value).toBeTruthy();
                        expect(results.find((r) => r.arrayName === 'does_not_exist').error).toBeTruthy();
                        done();
                    } catch (e) {
                        done(e);
                    }
                }).catch(done);
            });
        });
    });
});

/*
 * TASK-2728 (W5, epic 2706) — the static mesh arrays must not share the
 * time-series LRU.
 *
 * loadPlaybackLayerOptions.fetchStaticArray routes node_x / node_y /
 * elevation / friction / inradius / face_node_connectivity through
 * fetchAndDecodeChunk, which caches every decoded array in the SAME
 * PlaybackChunkCache the playback window uses — but computePlaybackMemoryPlan
 * sizes that cache from QUANTITY chunks only (playbackMemoryPolicy.js:281),
 * counting the mesh bytes under fixedBytes instead. So inserting the mesh
 * evicts window chunks the playhead still needs, which are then re-downloaded.
 * The statics are strong-referenced by pb.mesh for the life of the layer
 * (playbackEpics.js threads loadPlaybackMesh's arrays into
 * playbackManifestLoaded), so an LRU over them can only ever lose.
 *
 * BYTE-ACCOUNTED STAND-INS: the window fill and the decoded static below are
 * `{byteLength}` objects rather than real typed arrays. PlaybackChunkCache
 * sizes every entry through byteLengthOf() (playbackChunkCache.js:33-38),
 * which reads ONLY `.byteLength`, and what is under proof here is WHERE a
 * decoded array is put, not what is in it. Allocating the real 407 MiB window
 * plus the real 81 MB connectivity array inside a karma browser buys no extra
 * proof and risks an OOM that takes the whole run with it. Each stand-in
 * names the real shape it stands for.
 */
describe('TASK-2728 — static mesh arrays stay out of the time-series window cache', () => {
    // run 1328's real store descriptor.
    const N_NODE = 3393075;
    const N_FACE = 6779432;
    // Int32Array(3 * nFace) — face_node_connectivity, 4 B per element.
    const FNC_BYTES = 12 * N_FACE; // 81,353,184

    function sized(byteLength) {
        return { byteLength };
    }

    // 3 quantities x `chunksPerQuantity` slots, inserted oldest-first so the
    // LRU's eviction order is the documented one.
    function fillWindow(cache, chunksPerQuantity, storedChunkBytes) {
        const keys = [];
        ['depth', 'x_velocity', 'y_velocity'].forEach((quantity) => {
            for (let t = 0; t < chunksPerQuantity; t++) {
                const key = `${quantity}/c/${t}/0`;
                cache.set(key, sized(storedChunkBytes));
                keys.push(key);
            }
        });
        return keys;
    }

    function meshFetcher(cache) {
        return new PlaybackChunkFetcher({
            manifest: { chunk_urls: { 'face_node_connectivity/c/0/0': 'fnc-url' } },
            cache,
            fetchImpl: () => Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
            decodeImpl: () => Promise.resolve(sized(FNC_BYTES))
        });
    }

    function loadTheMesh(fetcher) {
        return fetcher.fetchAndDecodeChunk('face_node_connectivity', [0, 0], { dtype: 'int32', byteorder: 'little' });
    }

    it('loading the mesh evicts nothing from the buffered window', (done) => {
        const plan = computePlaybackMemoryPlan({ nNode: N_NODE, nFace: N_FACE, chunkLengthT: 10, totalChunks: 4 });
        expect(plan.cacheMaxBytes).toBe(407169000);
        expect(plan.chunksPerQuantity).toBe(2);
        expect(plan.storedChunkBytes).toBe(67861500); // Uint16Array(10 * 3393075)

        const cache = new PlaybackChunkCache({ maxBytes: plan.cacheMaxBytes });
        const windowKeys = fillWindow(cache, plan.chunksPerQuantity, plan.storedChunkBytes);
        // A full window IS the ceiling, to the byte — there is no slack for a
        // mesh array to borrow.
        expect(cache.totalBytes).toBe(plan.cacheMaxBytes);
        expect(cache.lastEvictedKeys()).toEqual([]);

        loadTheMesh(meshFetcher(cache)).then((decoded) => {
            // positive control: the static really was fetched and decoded.
            expect(decoded.byteLength).toBe(FNC_BYTES);
            expect(cache.lastEvictedKeys()).toEqual([]);
            windowKeys.forEach((key) => {
                expect(cache.has(key)).toBe(true);
            });
            // and it did not merely fit — it is not in the window cache at all.
            expect(cache.has('face_node_connectivity/c/0/0')).toBe(false);
            expect(cache.totalBytes).toBe(plan.cacheMaxBytes);
            done();
        }).catch(done);
    });

    it('loading the mesh evicts nothing from the buffered window at chunk length 2 (the SHIP 2 regime)', (done) => {
        const plan = computePlaybackMemoryPlan({ nNode: N_NODE, nFace: N_FACE, chunkLengthT: 2, totalChunks: 16 });
        expect(plan.cacheMaxBytes).toBe(122150700);
        expect(plan.chunksPerQuantity).toBe(3);
        expect(plan.storedChunkBytes).toBe(13572300); // Uint16Array(2 * 3393075)

        const cache = new PlaybackChunkCache({ maxBytes: plan.cacheMaxBytes });
        const windowKeys = fillWindow(cache, plan.chunksPerQuantity, plan.storedChunkBytes);
        expect(cache.totalBytes).toBe(plan.cacheMaxBytes);

        loadTheMesh(meshFetcher(cache)).then((decoded) => {
            expect(decoded.byteLength).toBe(FNC_BYTES);
            expect(cache.lastEvictedKeys()).toEqual([]);
            windowKeys.forEach((key) => {
                expect(cache.has(key)).toBe(true);
            });
            expect(cache.has('face_node_connectivity/c/0/0')).toBe(false);
            expect(cache.totalBytes).toBe(plan.cacheMaxBytes);
            done();
        }).catch(done);
    });

    it('still serves a repeated static from memory and still collapses concurrent static fetches', (done) => {
        // The non-caching path must not become a re-download path: the statics
        // are fetched once per layer and the LRU was the only thing stopping a
        // second fetch. Both halves are pinned here because the shipped specs
        // above ('serves a repeated request...', 'collapses concurrent
        // requests...') drive node_x/node_y — real statics — and must stay green.
        let fetches = 0;
        const fetcher = new PlaybackChunkFetcher({
            manifest: { chunk_urls: { 'face_node_connectivity/c/0/0': 'fnc-url' } },
            fetchImpl: () => {
                fetches++;
                return Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 }));
            },
            decodeImpl: () => Promise.resolve(sized(FNC_BYTES))
        });
        Promise.all([loadTheMesh(fetcher), loadTheMesh(fetcher)])
            .then(([a, b]) => {
                expect(fetches).toBe(1);
                expect(a).toBe(b);
                return loadTheMesh(fetcher);
            })
            .then((again) => {
                expect(fetches).toBe(1);
                expect(again.byteLength).toBe(FNC_BYTES);
                done();
            })
            .catch(done);
    });

    it('releaseCaches() drops BOTH the window cache and the retained statics', (done) => {
        // disposeRun() releases the fetcher's chunks explicitly rather than
        // waiting for it to become unreachable, because they are the large
        // half. Now that the statics are outside the LRU they are a second
        // large half, and a fetcher that outlives its run (a pending decode
        // closure, a layer that outlived the run) would pin the whole mesh.
        const cache = new PlaybackChunkCache({ maxBytes: 1024 * 1024 * 1024 });
        const fetcher = meshFetcher(cache);
        cache.set('depth/c/0/0', sized(1024));
        loadTheMesh(fetcher).then(() => {
            expect(cache.has('depth/c/0/0')).toBe(true);
            expect(fetcher._staticArrays.size).toBe(1);
            fetcher.releaseCaches();
            expect(cache.has('depth/c/0/0')).toBe(false);
            expect(cache.totalBytes).toBe(0);
            expect(fetcher._staticArrays.size).toBe(0);
            done();
        }).catch(done);
    });
});

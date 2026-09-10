/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2625 (W2.1, epic 2618) — PlaybackChunkFetcher tests: manifest fetch,
 * whole-object GET -> gzip decode -> dequantize via the real fixture store,
 * LRU cache integration, 403 -> manifest-refresh, and the prefetch-window API
 * consumed by a stub playback controller. (TASK-2625 fetched every chunk with
 * `Range: bytes=0-`; TASK-2983 dropped that header — see the fetcher's module
 * docstring and the whole-object-GET spec below.)
 *
 * fetchImpl is always injected (constructor dependency) rather than
 * stubbing the global `fetch` — no sinon in this repo's karma deps, and DI
 * is the simpler/more explicit seam here anyway.
 */
import expect from 'expect';
import {
    PlaybackChunkFetcher, fetchPlaybackManifest, planWindow, farthestBehind,
    MAX_CONCURRENT_FILL_CHUNKS
} from '../playbackChunkFetcher';
import { QUANTITY_ARRAYS } from '../playbackChunkShape';
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
                // TASK-2983 DELIBERATELY REWROTE the next assertion. It read
                // `expect(spy[0].headers.Range).toBe('bytes=0-')` under the
                // comment 'TASK-2625 AC: "ranged GETs"'. Dropping the header
                // makes that pin false, so this end-to-end spec now pins the
                // URL it fetched and leaves the header shape to the dedicated
                // whole-object-GET spec below.
                expect(spy.length).toBe(1);
                expect(spy[0].url).toBe('depth/c/0/0');
                done();
            }).catch(done);
    });

    // TASK-2983 (epic 2981, W1) — subject: a whole-object fetch carries NO
    // `Range` header. The fetcher used to send `Range: 'bytes=0-'` on every
    // chunk GET; that range asks for the whole object anyway, so the only
    // thing it changed was the response status (206 instead of 200) and the
    // shape a network/cache audit of the playback data plane sees. This is an
    // INSTRUMENT-FIDELITY spec — it makes no user-facing claim; the measured
    // reload/cache differential was withdrawn, see report
    // 2026-09-08-q-2-task-2983-range-cache-premise-false.
    it('requests a whole-object chunk as a plain GET carrying no Range header', (done) => {
        const spy = [];
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch({ spy })
        });
        fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32', byteorder: 'little' })
            .then(() => {
                expect(spy.length).toBe(1);
                expect(spy[0].url).toBe('node_x/c/0');
                // `(spy[0].headers || {})` and not a bare dereference: the
                // fetcher passes NO options object at all now, so the spy
                // records `headers: undefined` rather than an empty object.
                expect((spy[0].headers || {}).Range).toBe(undefined);
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
            // TASK-3010 — ASSERT THE BOUND, DO NOT INSPECT IT. This spec used
            // to assert only that the promise rejects, which it does whatever
            // stops the loop; and since TASK-2754 the refresh is memoised in
            // `_refreshInFlight` with a memo that CLEARS ON SETTLE, so
            // `allowRefresh: false` on the recursive _fetchRawBytes call is
            // the ONLY thing standing between a permanently-403ing store and
            // an unbounded re-sign loop. One boolean argument, and nothing was
            // watching it. Counting both sides pins it: exactly one refresh,
            // exactly two chunk fetches (the original and the single retry).
            let fetchCalls = 0;
            let refreshCalls = 0;
            const fetchImpl = () => {
                fetchCalls++;
                return Promise.resolve(new Response(null, { status: 403 }));
            };
            const fetcher = new PlaybackChunkFetcher({
                manifest: { chunk_urls: { 'node_x/c/0': 'always-expired' } },
                fetchImpl,
                refreshManifest: () => {
                    refreshCalls++;
                    // THE RECURSION BOUND LIVES HERE, IN THE FAKE, not in the
                    // module: flipping the module's retry to
                    // `allowRefresh: true` must make this spec FAIL, not hang
                    // the runner (TASK-3010 AC2's reversible mutation).
                    if (refreshCalls > 3) {
                        return Promise.reject(new Error(`refresh bound tripped at ${refreshCalls}`));
                    }
                    return Promise.resolve({ chunk_urls: { 'node_x/c/0': 'always-expired' } });
                }
            });
            fetcher.fetchAndDecodeChunk('node_x', [0], { dtype: 'float32' }).then(
                () => done(new Error('expected rejection')),
                () => {
                    expect(refreshCalls).toBe(1);
                    expect(fetchCalls).toBe(2);
                    done();
                }
            ).catch(done);
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

/*
 * ===========================================================================
 * TASK-2985 (W1.2, epic 2981) — THE FILL QUEUE.
 *
 * prefetchWindowByChunk fires every array of every window chunk at once (a
 * measured maxInflight of 33 on an 11-slot window) into a cache whose only
 * eviction is oldest-first. TASK-2984 made 11-slot windows reachable, so this
 * is now the shipped shape, not a hypothetical one.
 *
 * Four properties are pinned here, and each of them is FALSE against the
 * unmodified fetcher: fill ORDER from the playhead, a concurrency BOUND,
 * RE-PRIORITISATION on a SEEK, and playhead-distance EVICTION.
 * ===========================================================================
 */
describe('playbackChunkFetcher — TASK-2985 the fill queue', () => {
    const QUANTITIES = QUANTITY_ARRAYS;
    const CHUNK_BYTES = 1024;

    function synthManifest(totalChunks) {
        const chunkUrls = {};
        QUANTITIES.forEach((q) => {
            for (let t = 0; t < totalChunks; t++) {
                chunkUrls[`${q}/c/${t}/0`] = `${q}/c/${t}/0`;
            }
        });
        return { chunk_urls: chunkUrls };
    }

    function configs() {
        const out = {};
        QUANTITIES.forEach((q) => {
            out[q] = { dtype: 'uint16', byteorder: 'little' };
        });
        return out;
    }

    /**
     * A fetchImpl that counts CONCURRENCY HONESTLY: it increments on CALL
     * ENTRY and decrements on SETTLE, never by counting resolved promises —
     * a harness that counts completions bounds its own assertion. Sound
     * because every request the queue issues is made synchronously inside its
     * own start, before the first microtask.
     */
    /**
     * Let the fetch -> Response.arrayBuffer -> decode -> deferred -> pump chain
     * run to quiescence. Response.arrayBuffer() is a REAL async operation, so
     * counting microtask turns is not enough and would make these specs
     * flakily green on a fast machine.
     */
    function flush(turns = 6) {
        let p = Promise.resolve();
        for (let i = 0; i < turns; i++) {
            p = p.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
        }
        return p;
    }

    function gatedFetch() {
        const calls = [];
        const gates = new Map();
        const rig = {
            calls,
            live: 0,
            peak: 0,
            fetchImpl(url) {
                calls.push(url);
                rig.live++;
                rig.peak = Math.max(rig.peak, rig.live);
                return new Promise((resolve) => {
                    gates.set(url, () => {
                        rig.live--;
                        resolve(new Response(new ArrayBuffer(8), { status: 200 }));
                    });
                });
            },
            settle(url) {
                const gate = gates.get(url);
                if (gate) {
                    gates.delete(url);
                    gate();
                }
                return flush();
            },
            settleChunk(t) {
                QUANTITIES.forEach((q) => {
                    const gate = gates.get(`${q}/c/${t}/0`);
                    if (gate) {
                        gates.delete(`${q}/c/${t}/0`);
                        gate();
                    }
                });
                return flush();
            },
            pending() {
                return Array.from(gates.keys());
            }
        };
        return rig;
    }

    function makeFetcher(rig, { totalChunks, memoryPlan, cache } = {}) {
        return new PlaybackChunkFetcher({
            manifest: synthManifest(totalChunks),
            fetchImpl: rig.fetchImpl,
            decodeImpl: () => Promise.resolve(new Uint16Array(CHUNK_BYTES / 2)),
            memoryPlan,
            cache
        });
    }

    const chunkOf = (url) => Number(String(url).split('/')[2]);

    it('planWindow ROLLS the window instead of clipping it — all four pinned cases', () => {
        // (1) AC3: centre 0, 3 slots, radius 1 -> start 0 -> [0,1,2].
        expect(planWindow(0, 16, { chunksPerQuantity: 3, bufferWindowRadius: 1 })).toEqual([0, 1, 2]);
        // (2) AC1: 11 slots on an 11-chunk store -> the whole store.
        expect(planWindow(0, 11, { chunksPerQuantity: 11, bufferWindowRadius: 1 }))
            .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        // (3) AC10's "wrap": centre 15 of 16 with 3 slots -> the window has
        // ROLLED BACKWARD to [13,14,15]. Playback does NOT loop — PLAYBACK_TICK
        // goes to PAUSED at end-of-timeline — so this is a rolled window, never
        // a wrapping playhead.
        expect(planWindow(15, 16, { chunksPerQuantity: 3, bufferWindowRadius: 1 })).toEqual([13, 14, 15]);
        // (4) the behind-slot survives wherever there is room for it.
        expect(planWindow(5, 16, { chunksPerQuantity: 3, bufferWindowRadius: 1 })).toEqual([4, 5, 6]);
        expect(planWindow(5, 16, { chunksPerQuantity: 3, bufferWindowRadius: 0 })).toEqual([5, 6, 7]);
        // and the degenerate inputs a real manifest can produce
        expect(planWindow(0, 0, { chunksPerQuantity: 3 })).toEqual([]);
        expect(planWindow(0, 1, { chunksPerQuantity: 3, bufferWindowRadius: 1 })).toEqual([0]);

        // THE RED THIS REPLACES, on the same inputs, from the method that is
        // still exported for its own specs: getPrefetchWindow CLIPS, so an
        // 11-slot plan at centre 0 buys 10 of the 11 chunks it paid for.
        const bare = new PlaybackChunkFetcher({ manifest: { chunk_urls: {} } });
        expect(bare.getPrefetchWindow(0, 11, 1, { ahead: 9 })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('AC1 — the whole plan is requested, 11 of 11 on the REAL 1412 plan at the shipped default budget', (done) => {
        // A REAL post-2984 plan, not a forced one: 145824 nodes / 290407 faces
        // / chunkLengthT 10 / 11 chunks at the module's own default 800 MiB
        // budget. The AC2 scale table's headline cell.
        const plan = computePlaybackMemoryPlan({
            nNode: 145824, nFace: 290407, chunkLengthT: 10, totalChunks: 11
        });
        expect(plan.chunksPerQuantity).toBe(11);
        const window = planWindow(0, 11, plan);
        expect(window.length).toBe(11);

        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 11, memoryPlan: plan });
        const groups = fetcher.fillTowards(window, 0, configs(), { totalChunks: 11 });
        expect(groups.map((g) => g.chunkIndex)).toEqual(window);

        // Drain the queue two chunks at a time and collect the requested set.
        const drain = (remaining) => {
            if (!remaining.length) {
                return Promise.resolve();
            }
            return rig.settleChunk(remaining[0]).then(() => drain(remaining.slice(1)));
        };
        drain(window).then(() => {
            const requested = Array.from(new Set(rig.calls.map(chunkOf))).sort((a, b) => a - b);
            expect(requested).toEqual(window);
            // and every array of every chunk, not just the first
            expect(rig.calls.length).toBe(11 * QUANTITIES.length);
            done();
        }).catch(done);
    });

    it('AC2 — at most 6 queue-issued requests in flight, and the FIRST one is the playhead chunk', (done) => {
        // A FORCED 3-slot plan over an 11-chunk store at CENTRE 5. The centre
        // matters: at centre 0 on a 3-slot plan HEAD's window is [0,1] =
        // exactly 6 requests and the first IS chunk 0, so both halves of this
        // AC pass against unmodified source and grade nothing.
        //
        // VERIFIED AT HEAD on this shape: peak concurrent fetchImpl = 9, first
        // call = depth chunk 4. HEAD is not "unbounded" here — with 2984's
        // monotone rule its worst case on this forced plan is 9 — it is simply
        // NOT BOUNDED BY ANYTHING THE CODE SAYS.
        const plan = { chunksPerQuantity: 3, bufferWindowRadius: 1, cacheMaxBytes: 3 * 3 * CHUNK_BYTES };
        const window = planWindow(5, 11, plan);
        expect(window).toEqual([4, 5, 6]);

        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 11, memoryPlan: plan });
        fetcher.fillTowards(window, 5, configs(), { totalChunks: 11 });

        // FIRST request issued is the playhead's own chunk, not the behind-slot.
        expect(chunkOf(rig.calls[0])).toBe(5);
        expect(rig.calls[0]).toBe('depth/c/5/0');
        // Assert against the EXPORTED constant, not a magic 6, so a change to
        // the bound has to change this line rather than slipping past it.
        expect(MAX_CONCURRENT_FILL_CHUNKS * QUANTITIES.length).toBe(6);
        expect(rig.peak).toBe(MAX_CONCURRENT_FILL_CHUNKS * QUANTITIES.length);
        expect(rig.live).toBe(MAX_CONCURRENT_FILL_CHUNKS * QUANTITIES.length);
        // the third chunk has NOT started — that is the bound doing its job
        expect(rig.calls.filter((u) => chunkOf(u) === 4).length).toBe(0);

        rig.settleChunk(5).then(() => {
            // the freed slot is taken by the next chunk in fill order, and the
            // bound still holds
            expect(rig.peak).toBe(MAX_CONCURRENT_FILL_CHUNKS * QUANTITIES.length);
            expect(rig.live).toBeLessThanOrEqualTo(MAX_CONCURRENT_FILL_CHUNKS * QUANTITIES.length);
            expect(Array.from(new Set(rig.calls.map(chunkOf)))).toEqual([5, 6, 4]);
            return rig.settleChunk(6).then(() => rig.settleChunk(4));
        }).then(() => {
            expect(rig.peak).toBe(6);
            expect(rig.calls.length).toBe(9);
            done();
        }).catch(done);
    });

    it('AC5 — a SEEK re-prioritises: the seeked chunk is the next request the queue STARTS', (done) => {
        // ON A PLAN WITH A BEHIND-SLOT. On a 2-slot plan getPrefetchWindow(9,
        // 16, 0, {ahead: 1}) is [9,10] and chunk 9 is already HEAD's first
        // request, so the AC could not fail. With radius 1 HEAD issues chunk 8
        // first (window [8,9,10]).
        const plan = { chunksPerQuantity: 3, bufferWindowRadius: 1, cacheMaxBytes: 3 * 3 * CHUNK_BYTES };
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan });

        // fill around chunk 0 first, so the queue is busy and has a tail
        fetcher.fillTowards(planWindow(0, 16, plan), 0, configs(), { totalChunks: 16 });
        const beforeSeek = rig.calls.length;
        expect(beforeSeek).toBe(6); // chunks 0 and 1 running, chunk 2 pending

        // ...now SEEK to chunk 9.
        const seekWindow = planWindow(9, 16, plan);
        expect(seekWindow).toEqual([8, 9, 10]);
        fetcher.fillTowards(seekWindow, 9, configs(), { totalChunks: 16 });

        // Requests already in flight are neither cancelled nor counted — an Rx
        // fromPromise unsubscribe does not cancel a fetch and this class has no
        // AbortController. Assert on the ORDER of what the queue STARTS NEXT.
        rig.settleChunk(0).then(() => {
            const started = rig.calls.slice(beforeSeek).map(chunkOf);
            expect(started.length).toBeGreaterThan(0);
            expect(started[0]).toBe(9);
            done();
        }).catch(done);
    });

    it('AC10 — fill ORDER over a window that has ROLLED BACKWARD at the end of the timeline', (done) => {
        const plan = { chunksPerQuantity: 3, bufferWindowRadius: 1, cacheMaxBytes: 3 * 3 * CHUNK_BYTES };
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan });
        const window = planWindow(15, 16, plan);
        expect(window).toEqual([13, 14, 15]);
        fetcher.fillTowards(window, 15, configs(), { totalChunks: 16 });
        // playhead FIRST even though it is the window's LAST index, then the
        // rolled-over tail. Playback does not loop, so 15 is terminal — the
        // wrap is in the FILL ORDER, never in the playhead.
        expect(chunkOf(rig.calls[0])).toBe(15);
        rig.settleChunk(15).then(() => {
            expect(Array.from(new Set(rig.calls.map(chunkOf)))).toEqual([15, 13, 14]);
            done();
        }).catch(done);
    });

    it('AC11 — a plan whose verdict is FALLBACK issues ZERO requests', () => {
        // The fetcher's half of TASK-2986's zero. A device that cannot hold the
        // store must not start downloading it: after the manifest, before any
        // geometry moves.
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, {
            totalChunks: 16,
            memoryPlan: { chunksPerQuantity: 2, bufferWindowRadius: 0, verdict: 'fallback',
                fallbackReason: 'fixed-mesh-exceeds-budget', cacheMaxBytes: 2 * 3 * CHUNK_BYTES }
        });
        const groups = fetcher.fillTowards([0, 1], 0, configs(), { totalChunks: 16 });
        expect(groups).toEqual([]);
        expect(rig.calls.length).toBe(0);
        // ...and the control: the SAME fetcher with verdict 'ok' does fetch.
        fetcher.memoryPlan = { ...fetcher.memoryPlan, verdict: 'ok' };
        fetcher.fillTowards([0, 1], 0, configs(), { totalChunks: 16 });
        expect(rig.calls.length).toBe(6);
    });

    it('AC4(a) — farthestBehind picks the chunk furthest BEHIND the playhead, wrap-aware', () => {
        // maximise (t - playhead + total) % total: one step BEHIND scores
        // total-1 and goes first; the chunk the playhead is IN scores 0 and is
        // the last thing standing.
        expect(farthestBehind([0, 1, 2, 3, 4], 2, 16)).toBe(1);
        expect(farthestBehind([2, 3, 4], 2, 16)).toBe(4);
        // WRAP-AWARE, and read it carefully: with the playhead at 0 the chunk
        // needed LAST is 15 — fifteen steps of forward travel away — so 15 is
        // "farthest behind" and goes first. 13 is only THIRTEEN steps away and
        // is therefore needed SOONER. Getting this backwards would evict the
        // chunk the playhead is about to reach.
        expect(farthestBehind([13, 14, 15, 0], 0, 16)).toBe(15);
        expect(farthestBehind([5], 5, 16)).toBe(5);
        expect(farthestBehind([], 5, 16)).toBe(null);
        expect(farthestBehind([1, 2], 1, 0)).toBe(null);
        // deterministic on a tie (lowest index wins)
        expect(farthestBehind([3, 3], 4, 8)).toBe(3);
    });

    it('AC4(b)/(c) — the queue evicts the chunk FARTHEST BEHIND, never the one being played', (done) => {
        // 12 slots on the 16-chunk shape is a DELIBERATELY FORCED unit-test
        // plan: the ruled TASK-2984 policy gives n=3 on this store (AC7). The
        // point is the ORDER, and the order is only reproducible under THIS
        // task's fill.
        //
        // The cache is sized ONE CHUNK SHORT of the fill on purpose, so an
        // eviction is forced during the fill rather than never happening.
        const slots = 12;
        const plan = {
            chunksPerQuantity: slots - 1,
            bufferWindowRadius: 1,
            cacheMaxBytes: (slots - 1) * QUANTITIES.length * CHUNK_BYTES
        };
        const cache = new PlaybackChunkCache({ maxBytes: plan.cacheMaxBytes });
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan, cache });

        const window = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        fetcher.fillTowards(window, 2, configs(), { totalChunks: 16 });
        // insert order is forward-from-playhead with wrap: 2,3,...,11,0,1
        const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
        const drain = (remaining) => remaining.length
            ? rig.settleChunk(remaining[0]).then(() => drain(remaining.slice(1)))
            : Promise.resolve();

        drain(order).then(() => {
            const resident = fetcher.residentChunkIndices(QUANTITIES);
            // (c) THE CURRENT AND NEXT CHUNK SURVIVE. This is the whole point,
            // and the assertion carries the evidence so the RED of AC4(b)'s
            // mutation NAMES the inversion instead of printing a bare -1.
            //
            // REVERSIBLE-MUTATION PROOF (AC4(b)), run 2026-09-08 and reverted:
            // delete the `_makeRoomFor` call from _runChunkArray so only the
            // byte LRU is left, and this spec goes RED with
            //   resident=[0,1,3,4,5,6,7,8,9,10,11]
            //   cache.lastEvictedKeys()=["y_velocity/c/2/0"]
            // i.e. depth|x_velocity|y_velocity /c/2/0 — THE CHUNK THE PLAYHEAD
            // IS IN — because the fill inserted it FIRST and oldest-first then
            // takes it out first. That eviction list is reproducible ONLY
            // under this task's own fill order; it is NOT what HEAD does, and
            // the old AC4 wrongly attributed it to HEAD.
            expect('resident=' + JSON.stringify(resident)
                + ' playheadChunk2=' + (resident.indexOf(2) !== -1)
                + ' nextChunk3=' + (resident.indexOf(3) !== -1))
                .toBe('resident=[1,2,3,4,5,6,7,8,9,10,11] playheadChunk2=true nextChunk3=true');
            // ...and what went instead is the chunk farthest BEHIND the
            // playhead among the residents at the moment room was needed.
            expect(resident.indexOf(0)).toBe(-1);
            expect(resident.length).toBe(slots - 1);
            done();
        }).catch(done);
    });

    it('AC9 — a direct fetchAndDecodeChunk for an ENQUEUED key RESOLVES, and is not made to wait for a fill slot', (done) => {
        // Load-bearing: fetchAndDecodeChunk hands that same promise to the
        // urgent frame path (loadPlaybackLayerOptions' loadPlaybackFrame). If
        // the queue satisfied its own _inflight entry through
        // fetchAndDecodeChunk it would return the queue's own promise to
        // itself, and an unsettled deferred here reproduces TASK-2754's
        // unrecoverable-promise failure exactly: a tab stuck in `buffering`.
        const plan = { chunksPerQuantity: 16, bufferWindowRadius: 1, cacheMaxBytes: 16 * 3 * CHUNK_BYTES };
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan });
        const window = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        fetcher.fillTowards(window, 0, configs(), { totalChunks: 16 });
        // the queue is saturated on chunks 0 and 1
        expect(Array.from(new Set(rig.calls.map(chunkOf)))).toEqual([0, 1]);

        // A DIRECT request for chunk 9 — enqueued, not started. It must start
        // immediately, PAST the two-chunk bound, and resolve without chunks
        // 2..8 completing first.
        const urgent = fetcher.fetchAndDecodeChunk('depth', [9, 0], { dtype: 'uint16' });
        expect(rig.calls.filter((u) => chunkOf(u) === 9).length).toBe(QUANTITIES.length);
        expect(rig.calls.filter((u) => chunkOf(u) === 5).length).toBe(0);

        rig.settleChunk(9).then(() => urgent).then((value) => {
            expect(value.length).toBe(CHUNK_BYTES / 2);
            const touched = Array.from(new Set(rig.calls.map(chunkOf)));
            expect(touched.indexOf(9)).toNotBe(-1);
            [2, 3, 4, 5, 6, 7, 8].forEach((t) => expect(touched.indexOf(t)).toBe(-1));
            done();
        }).catch(done);
    });

    it('AC9 — releaseCaches() SETTLES every enqueue-time deferred, stops the queue and refuses late writes', (done) => {
        const plan = { chunksPerQuantity: 16, bufferWindowRadius: 1, cacheMaxBytes: 16 * 3 * CHUNK_BYTES };
        const cache = new PlaybackChunkCache({ maxBytes: plan.cacheMaxBytes });
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan, cache });
        const groups = fetcher.fillTowards(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0, configs(), { totalChunks: 16 });
        expect(groups.length).toBe(16);
        const callsAtTeardown = rig.calls.length;
        expect(callsAtTeardown).toBe(6); // two chunks in flight

        fetcher.releaseCaches();

        // (i) EVERY promise fillTowards returned settles. A dropped deferred is
        // the TASK-2754 shape and it hangs the tab, not the test.
        Promise.all(groups.map((g) => g.promise)).then((all) => {
            expect(all.length).toBe(16);
            // the not-yet-started chunks carry the single stable cancellation
            const cancelled = all[15].filter((r) => r.error
                && String(r.error.message).indexOf('fill cancelled (run disposed)') !== -1);
            expect(cancelled.length).toBe(QUANTITIES.length);
            // (ii) NO FURTHER fetchImpl CALL is made
            expect(rig.calls.length).toBe(callsAtTeardown);
            // (iii) the in-flight decodes land, and the cache is STILL empty —
            // a disposed run must not repopulate the cache it just cleared.
            return rig.settleChunk(0).then(() => rig.settleChunk(1));
        }).then(() => {
            expect(rig.calls.length).toBe(callsAtTeardown);
            expect(cache.size).toBe(0);
            expect(cache.totalBytes).toBe(0);
            expect(fetcher._inflight.size).toBe(0);
            done();
        }).catch(done);
    });

    it('phase 1.7 — a DISPOSED fetcher enqueues NOTHING, so it cannot hand out an unsettleable promise', (done) => {
        // FOUND BY THIS WAVE'S CUMULATIVE REVIEW, not by an AC. releaseCaches()
        // sets `_disposed`, and _startFillEntry returns early on it — so a
        // fillTowards AFTER teardown used to register fresh `_inflight`
        // deferreds that nothing would ever start OR settle. That is the exact
        // TASK-2754 unrecoverable-promise shape (a tab stuck in `buffering`
        // for ever) re-created on the other side of the door AC9's teardown
        // clause closes.
        const plan = { chunksPerQuantity: 8, bufferWindowRadius: 1, cacheMaxBytes: 8 * 3 * CHUNK_BYTES };
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan });
        fetcher.releaseCaches();
        const callsAfterTeardown = rig.calls.length;
        const groups = fetcher.fillTowards([0, 1, 2, 3], 0, configs(), { totalChunks: 16 });
        expect(groups).toEqual([]);
        expect(rig.calls.length).toBe(callsAfterTeardown);
        // nothing was registered, so nothing is waiting on a promise that
        // cannot resolve
        expect(fetcher._inflight.size).toBe(0);
        expect(fetcher._fillPending.length).toBe(0);
        expect(fetcher._fillByChunk.size).toBe(0);
        done();
    });

    it('a chunk already enqueued returns the SAME promise, so the per-tick re-issue is idempotent', () => {
        const plan = { chunksPerQuantity: 3, bufferWindowRadius: 1, cacheMaxBytes: 3 * 3 * CHUNK_BYTES };
        const rig = gatedFetch();
        const fetcher = makeFetcher(rig, { totalChunks: 16, memoryPlan: plan });
        const first = fetcher.fillTowards([0, 1, 2], 0, configs(), { totalChunks: 16 });
        const second = fetcher.fillTowards([0, 1, 2], 0, configs(), { totalChunks: 16 });
        expect(second.length).toBe(first.length);
        first.forEach((g, i) => expect(second[i].promise).toBe(g.promise));
        // ...and it did NOT re-issue the network requests
        expect(rig.calls.length).toBe(6);
    });
});

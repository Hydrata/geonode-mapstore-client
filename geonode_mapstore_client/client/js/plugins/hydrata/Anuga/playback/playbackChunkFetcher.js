/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackChunkFetcher — the browser data plane for the TASK-2622/2623
 * playback store (epic 2618, W2.1/TASK-2625): manifest fetch -> ranged GET
 * -> gzip decode -> typed array -> dequantize, with an LRU cache and a
 * 403-triggered manifest refresh (presigned S3 URLs expire — TASK-2623's
 * Run.build_playback_manifest docstring: "the FE refreshes the manifest on
 * a 403 from a chunk URL rather than trusting expires_at alone").
 *
 * Every chunk object is fetched with an explicit Range request (rather than
 * a plain GET) — S3 presigned GET URLs honour Range on any object, and
 * issuing every chunk fetch through the same Range-request code path (a) is
 * what lets a future partial-chunk read reuse this exact function without a
 * second code path, and (b) makes the request trivially distinguishable
 * from a same-origin dev-store GET in a network-log/cache audit. An unbounded
 * `bytes=0-` range simply asks for "everything from the start" — S3 answers
 * with 206 Partial Content and the whole object.
 */

import { chunkKey } from './playbackDecode';
import { decodeChunkOffThread } from './playbackDecodeWorker';
import { PlaybackChunkCache } from './playbackChunkCache';

/**
 * TASK-2627 (W3.1) live-verify fix: a bare `fetchImpl = fetch` default
 * parameter captures a DETACHED reference to the native `fetch` — calling
 * it as `fetchImpl(url)` (a plain function call, not `window.fetch(url)`)
 * throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal
 * invocation` in a real browser (native fetch's WebIDL brand-check requires
 * the correct receiver; `this` is `undefined` in a strict-mode plain call).
 * Every karma test here injects its OWN fetchImpl (a plain function with no
 * receiver check), so this never surfaced until the real production epic
 * path (no injected fetchImpl -> this default) ran on a real page — see the
 * W3 wave report. Wrapping in an arrow function keeps `fetch(...)` as a
 * syntactic global-scope call (implicitly `globalThis.fetch(...)`), which
 * preserves the correct receiver.
 */
const defaultFetch = (...args) => fetch(...args);

/**
 * Fetch and parse the playback manifest (TASK-2623's `GET
 * .../runs/<id>/playback-manifest/` action, or an equivalent same-origin/dev
 * URL — this module never assumes an S3 origin, it only ever follows
 * whatever `chunk_urls` the manifest hands back).
 * @param {string} manifestUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<object>}
 */
export async function fetchPlaybackManifest(manifestUrl, fetchImpl = defaultFetch) {
    const response = await fetchImpl(manifestUrl, { credentials: 'same-origin' });
    if (!response.ok) {
        throw new Error(`playbackChunkFetcher.fetchPlaybackManifest: GET ${manifestUrl} failed with status ${response.status}`);
    }
    return response.json();
}

/**
 * @param {object} manifest a manifest as returned by fetchPlaybackManifest /
 *   Run.build_playback_manifest: {chunk_urls, schema_metadata, quantization, ...}
 * @param {string} relativeKey e.g. 'depth/c/0/0'
 */
function urlForRelativeKey(manifest, relativeKey) {
    const url = manifest && manifest.chunk_urls && manifest.chunk_urls[relativeKey];
    if (!url) {
        throw new Error(`playbackChunkFetcher: manifest has no chunk_urls entry for '${relativeKey}'`);
    }
    return url;
}

export class PlaybackChunkFetcher {
    /**
     * @param {object} options
     * @param {object} options.manifest initial manifest (chunk_urls/schema_metadata/quantization)
     * @param {() => Promise<object>} [options.refreshManifest] called on a 403;
     *   must resolve to a fresh manifest for the SAME run (new chunk_urls,
     *   same relative keys). Required unless the caller never expects 403s
     *   (e.g. same-origin dev fixtures with no expiry).
     * @param {PlaybackChunkCache} [options.cache]
     * @param {object} [options.memoryPlan] a
     *   playbackMemoryPolicy.computePlaybackMemoryPlan() result. TASK-2708
     *   (W1.2, epic 2706): WITHOUT this every fetcher got a fresh cache at the
     *   fixed 64 MiB DEFAULT_MAX_BYTES regardless of the run's size, so on a
     *   prod-scale store a single chunk was twice the whole ceiling and the
     *   LRU thrashed by construction. Optional only so a test/harness with no
     *   store descriptor still works; every production call site passes it.
     * @param {(compressed: ArrayBuffer, opts: object) => Promise<object>} [options.decodeImpl]
     *   overridable seam for the off-main-thread decoder (tests inject a
     *   same-thread one; production takes the worker).
     * @param {typeof fetch} [options.fetchImpl]
     */
    constructor({ manifest, refreshManifest, cache, memoryPlan, decodeImpl, fetchImpl = defaultFetch } = {}) {
        if (!manifest) {
            throw new Error('PlaybackChunkFetcher: manifest is required');
        }
        this.manifest = manifest;
        this.refreshManifest = refreshManifest || null;
        this.memoryPlan = memoryPlan || null;
        this.cache = cache || new PlaybackChunkCache(
            memoryPlan && memoryPlan.cacheMaxBytes > 0 ? { maxBytes: memoryPlan.cacheMaxBytes } : {}
        );
        this.decodeImpl = decodeImpl || decodeChunkOffThread;
        this.fetchImpl = fetchImpl;
        // Per-relativeKey in-flight promises so a burst of prefetch requests
        // for the same chunk (e.g. two overlapping prefetch windows) collapse
        // into one network request instead of racing duplicate fetches.
        this._inflight = new Map();
    }

    /**
     * Replace the manifest currently in use (e.g. after an external caller
     * already refreshed it) without going through refreshManifest().
     */
    setManifest(manifest) {
        this.manifest = manifest;
    }

    /**
     * Adopt a (re)computed memory plan — TASK-2708. Called a second time once
     * the mesh has landed and the EXACT triangle count is known, replacing
     * the manifest-time plan that had to estimate it (see
     * playbackMemoryPolicy.FACES_PER_NODE_ESTIMATE).
     * @param {object} memoryPlan
     */
    applyMemoryPlan(memoryPlan) {
        if (!memoryPlan || !(memoryPlan.cacheMaxBytes > 0)) {
            return this.memoryPlan;
        }
        this.memoryPlan = memoryPlan;
        this.cache.resize(memoryPlan.cacheMaxBytes);
        return this.memoryPlan;
    }

    async _fetchRawBytes(relativeKey, { allowRefresh = true } = {}) {
        const url = urlForRelativeKey(this.manifest, relativeKey);
        const response = await this.fetchImpl(url, { headers: { Range: 'bytes=0-' } });
        if (response.status === 403) {
            if (!allowRefresh || !this.refreshManifest) {
                throw new Error(`playbackChunkFetcher: 403 fetching '${relativeKey}' and no refreshManifest available to retry`);
            }
            this.manifest = await this.refreshManifest();
            return this._fetchRawBytes(relativeKey, { allowRefresh: false });
        }
        if (!response.ok && response.status !== 206) {
            throw new Error(`playbackChunkFetcher: fetch of '${relativeKey}' failed with status ${response.status}`);
        }
        return response.arrayBuffer();
    }

    /**
     * Fetch + decode + cache one chunk, in the store's OWN dtype. Concurrent
     * calls for the same key share one in-flight fetch.
     *
     * TASK-2708 (W1.2, epic 2706) CONTRACT CHANGE: a quantized array comes
     * back (and is cached) as the stored Uint16Array — this no longer
     * dequantizes. `decodeOpts.quantization` is accepted and ignored so the
     * existing call sites keep documenting which arrays are quantized, but
     * physical units are now produced one frame-row at a time by
     * playbackDecode.dequantizeRow (loadPlaybackFrame). Two reasons, both
     * load-bearing: caching Float32 doubled time-series residency (4 B vs
     * 2 B per element — 129.4 MiB vs 64.7 MiB for ONE run-1328 chunk), and a
     * dequantize-on-decode step in a cached path is one refactor away from
     * being applied twice to the same array, which renders a plausible flood
     * surface at `scale x` the true depth.
     *
     * The gunzip + typed-array decode itself runs in playbackDecode.worker.js
     * (with a same-thread fallback), so neither the decompression nor the
     * chunk-sized intermediate buffer lands on the main thread.
     *
     * @param {string} arrayName e.g. 'depth'
     * @param {number[]} chunkIndices e.g. [timeChunkIndex, 0]
     * @param {{dtype: string, byteorder?: string, quantization?: {scale:number, offset:number}}} decodeOpts
     * @returns {Promise<Uint16Array|Int32Array|Float32Array|Float64Array>} STILL QUANTIZED for uint16 arrays
     */
    async fetchAndDecodeChunk(arrayName, chunkIndices, decodeOpts) {
        const key = chunkKey(arrayName, chunkIndices);
        const cached = this.cache.get(key);
        if (cached) {
            return cached;
        }
        if (this._inflight.has(key)) {
            return this._inflight.get(key);
        }
        const { dtype, byteorder = 'little' } = decodeOpts || {};
        const task = (async() => {
            try {
                const compressed = await this._fetchRawBytes(key);
                const decoded = await this.decodeImpl(compressed, { dtype, byteorder });
                this.cache.set(key, decoded);
                return decoded;
            } finally {
                this._inflight.delete(key);
            }
        })();
        this._inflight.set(key, task);
        return task;
    }

    /**
     * The set of time-chunk indices to have in cache around `centerChunkIndex`
     * (the chunk the playhead is currently in), clamped to [0, totalChunks).
     * A pure function so the playback controller (W2.2/W3) can call it to
     * decide what to render without any fetch side effects.
     * TASK-2708 (W1.2, epic 2706) made the window ASYMMETRIC via `ahead`,
     * because playback runs forwards: on a prod-scale store the byte budget
     * only affords two chunk slots per quantity, and spending one of them
     * behind the playhead would leave no lookahead at all. `ahead` defaults to
     * `windowRadius` so every existing symmetric caller is unchanged.
     *
     * @param {number} centerChunkIndex
     * @param {number} totalChunks
     * @param {number} [windowRadius=2] chunks BEHIND the playhead
     * @param {{ahead?: number}} [options] chunks AHEAD (default: windowRadius)
     * @returns {number[]}
     */
    getPrefetchWindow(centerChunkIndex, totalChunks, windowRadius = 2, { ahead } = {}) {
        if (totalChunks <= 0) {
            return [];
        }
        const forward = ahead === undefined || ahead === null ? windowRadius : ahead;
        const lo = Math.max(0, centerChunkIndex - windowRadius);
        const hi = Math.min(totalChunks - 1, centerChunkIndex + forward);
        const indices = [];
        for (let i = lo; i <= hi; i++) {
            indices.push(i);
        }
        return indices;
    }

    /**
     * Kick off (non-blocking, best-effort) fetch+decode+cache for every
     * array in `arrayConfigs` across the prefetch window around
     * `centerChunkIndex`. A single chunk's failure never rejects the whole
     * call — it resolves to `{error}` in that slot so one bad/expired chunk
     * doesn't abort prefetching its neighbours.
     * @param {Record<string, {dtype: string, byteorder?: string, quantization?: object}>} arrayConfigs
     *   e.g. {depth: {dtype:'uint16', quantization:{...}}, node_x: {dtype:'float32'}}
     * @param {number} centerChunkIndex
     * @param {number} totalChunks
     * @param {{windowRadius?: number, windowAhead?: number, nodeChunkIndex?: number}} [options]
     * @returns {Promise<Array<{arrayName: string, chunkIndex: number, value?: object, error?: Error}>>}
     */
    async prefetchWindow(arrayConfigs, centerChunkIndex, totalChunks, { windowRadius = 2, windowAhead, nodeChunkIndex = 0 } = {}) {
        const window = this.getPrefetchWindow(centerChunkIndex, totalChunks, windowRadius, { ahead: windowAhead });
        const arrayNames = Object.keys(arrayConfigs || {});
        const tasks = [];
        arrayNames.forEach((arrayName) => {
            window.forEach((chunkIndex) => {
                tasks.push(
                    this.fetchAndDecodeChunk(arrayName, [chunkIndex, nodeChunkIndex], arrayConfigs[arrayName])
                        .then((value) => ({ arrayName, chunkIndex, value }))
                        .catch((error) => ({ arrayName, chunkIndex, error }))
                );
            });
        });
        return Promise.all(tasks);
    }
}

export default PlaybackChunkFetcher;

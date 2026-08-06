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

import { gunzip, decodeTypedArray, dequantize, chunkKey } from './playbackDecode';
import { PlaybackChunkCache } from './playbackChunkCache';

/**
 * Fetch and parse the playback manifest (TASK-2623's `GET
 * .../runs/<id>/playback-manifest/` action, or an equivalent same-origin/dev
 * URL — this module never assumes an S3 origin, it only ever follows
 * whatever `chunk_urls` the manifest hands back).
 * @param {string} manifestUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<object>}
 */
export async function fetchPlaybackManifest(manifestUrl, fetchImpl = fetch) {
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
     * @param {typeof fetch} [options.fetchImpl]
     */
    constructor({ manifest, refreshManifest, cache, fetchImpl = fetch } = {}) {
        if (!manifest) {
            throw new Error('PlaybackChunkFetcher: manifest is required');
        }
        this.manifest = manifest;
        this.refreshManifest = refreshManifest || null;
        this.cache = cache || new PlaybackChunkCache();
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
     * Fetch+decode+(optionally dequantize)+cache one chunk. Concurrent calls
     * for the same key share one in-flight fetch.
     * @param {string} arrayName e.g. 'depth'
     * @param {number[]} chunkIndices e.g. [timeChunkIndex, 0]
     * @param {{dtype: string, byteorder?: string, quantization?: {scale:number, offset:number}}} decodeOpts
     * @returns {Promise<Uint16Array|Int32Array|Float32Array|Float64Array>}
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
        const { dtype, byteorder = 'little', quantization } = decodeOpts || {};
        const task = (async () => {
            try {
                const compressed = await this._fetchRawBytes(key);
                const raw = await gunzip(compressed);
                const typed = decodeTypedArray(raw, dtype, byteorder);
                const decoded = quantization ? dequantize(typed, quantization) : typed;
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
     * @param {number} centerChunkIndex
     * @param {number} totalChunks
     * @param {number} [windowRadius=2]
     * @returns {number[]}
     */
    getPrefetchWindow(centerChunkIndex, totalChunks, windowRadius = 2) {
        if (totalChunks <= 0) {
            return [];
        }
        const lo = Math.max(0, centerChunkIndex - windowRadius);
        const hi = Math.min(totalChunks - 1, centerChunkIndex + windowRadius);
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
     * @param {{windowRadius?: number, nodeChunkIndex?: number}} [options]
     * @returns {Promise<Array<{arrayName: string, chunkIndex: number, value?: object, error?: Error}>>}
     */
    async prefetchWindow(arrayConfigs, centerChunkIndex, totalChunks, { windowRadius = 2, nodeChunkIndex = 0 } = {}) {
        const window = this.getPrefetchWindow(centerChunkIndex, totalChunks, windowRadius);
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

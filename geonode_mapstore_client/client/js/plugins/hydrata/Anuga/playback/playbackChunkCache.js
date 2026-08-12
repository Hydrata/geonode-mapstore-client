/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackChunkCache — an LRU cache of decoded playback-store chunks, sized
 * by cumulative decoded byte length rather than entry count (TASK-2625,
 * W2.1, epic 2618). A long scrub through a multi-hundred-MB run must not
 * grow unbounded — this is the eviction discipline call-out in review F4
 * (the Mapbox raster-array-source memory leak, gh mapbox-gl-js#13688, is the
 * cautionary tale: unbounded per-tile typed-array retention with no ceiling).
 *
 * Deliberately dependency-free (no lru-cache pkg) — a `Map` already
 * preserves insertion order, and re-inserting a key on every touch is
 * exactly the "move to the end = most-recently-used" primitive an LRU needs.
 */
/**
 * TASK-2708 (W1.2, epic 2706): this is a FALLBACK for a caller that has no
 * store to size itself against (a test, a harness), NOT the playback client's
 * ceiling any more. It used to be the ceiling, and that is precisely what
 * froze the tab: at 3,393,075 nodes one chunk is twice this number, so no
 * single element fit in its own cache and the LRU thrashed by construction.
 * The real ceiling comes from playbackMemoryPolicy.computePlaybackMemoryPlan,
 * derived from the store's own chunk footprint, and reaches this cache via
 * PlaybackChunkFetcher's `memoryPlan` option / `resize()`.
 */
export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB decoded, not compressed

function byteLengthOf(value) {
    // TypedArrays and ArrayBuffers both expose byteLength; anything else
    // (e.g. a plain object some future caller stuffs in here) counts as 0 so
    // a mis-typed value degrades to "no size pressure" instead of throwing.
    return value && typeof value.byteLength === 'number' ? value.byteLength : 0;
}

export class PlaybackChunkCache {
    /**
     * @param {{maxBytes?: number}} [options]
     */
    constructor({ maxBytes = DEFAULT_MAX_BYTES } = {}) {
        if (!(maxBytes > 0)) {
            throw new Error('PlaybackChunkCache: maxBytes must be > 0');
        }
        this.maxBytes = maxBytes;
        this._map = new Map(); // key -> decoded typed array; Map iteration order == LRU order (oldest first)
        this._totalBytes = 0;
        this._evictedKeys = []; // rolling debug log of the last eviction batch, for tests
    }

    get size() {
        return this._map.size;
    }

    /**
     * Re-ceiling an existing cache, evicting immediately if the new ceiling
     * is lower. TASK-2708: the plan is built twice — once at manifest-load
     * from the store's declared node count, then again with the exact face
     * count as soon as face_node_connectivity has landed — so the ceiling has
     * to be adjustable in place rather than only at construction.
     * @param {number} maxBytes
     */
    resize(maxBytes) {
        if (!(maxBytes > 0)) {
            throw new Error('PlaybackChunkCache.resize: maxBytes must be > 0');
        }
        this.maxBytes = maxBytes;
        this._evictToFit();
        return this.maxBytes;
    }

    get totalBytes() {
        return this._totalBytes;
    }

    /**
     * A snapshot of the resident keys, oldest-first (TASK-2744 AC20).
     *
     * Deliberately NOT `get(key)` in a loop: `get` promotes to MRU
     * (delete + re-set), so probing residency through it would reorder the
     * eviction queue just by observing it.
     */
    keys() {
        return Array.from(this._map.keys());
    }

    has(key) {
        return this._map.has(key);
    }

    /**
     * Read a cached value, promoting it to most-recently-used. Returns
     * undefined on a miss (never throws — a miss is the normal "go fetch it"
     * signal for a caller, not an error).
     */
    get(key) {
        let value;
        if (this._map.has(key)) {
            value = this._map.get(key);
            this._map.delete(key);
            this._map.set(key, value);
        }
        return value;
    }

    /**
     * Store a decoded chunk, evicting least-recently-used entries until the
     * cache is back under `maxBytes`. A single entry larger than `maxBytes`
     * is still stored (never silently dropped — the caller asked to cache
     * it) but immediately evicts every other entry to make room; the cache
     * degrades to holding just that one oversized entry rather than lying
     * about having cached something it discarded.
     */
    set(key, value) {
        if (this._map.has(key)) {
            this._totalBytes -= byteLengthOf(this._map.get(key));
            this._map.delete(key);
        }
        this._map.set(key, value);
        this._totalBytes += byteLengthOf(value);
        this._evictToFit();
        return value;
    }

    _evictToFit() {
        const evicted = [];
        while (this._totalBytes > this.maxBytes && this._map.size > 1) {
            const oldestKey = this._map.keys().next().value;
            const oldestValue = this._map.get(oldestKey);
            this._map.delete(oldestKey);
            this._totalBytes -= byteLengthOf(oldestValue);
            evicted.push(oldestKey);
        }
        this._evictedKeys = evicted;
        return evicted;
    }

    /** Keys evicted by the most recent set() call, oldest-evicted first. */
    lastEvictedKeys() {
        return this._evictedKeys.slice();
    }

    clear() {
        this._map.clear();
        this._totalBytes = 0;
        this._evictedKeys = [];
    }
}

export default PlaybackChunkCache;

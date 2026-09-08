/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackChunkFetcher — the browser data plane for the TASK-2622/2623
 * playback store (epic 2618, W2.1/TASK-2625): manifest fetch -> whole-object
 * GET -> gzip decode -> typed array -> dequantize, with an LRU cache and a
 * 403-triggered manifest refresh (presigned S3 URLs expire — TASK-2623's
 * Run.build_playback_manifest docstring: "the FE refreshes the manifest on
 * a 403 from a chunk URL rather than trusting expires_at alone").
 *
 * Every chunk object is fetched as a plain whole-object GET and the server
 * answers 200. TASK-2625 originally sent an unbounded `Range: bytes=0-` on
 * every chunk fetch; that range asks for "everything from the start", so S3
 * returned the whole object anyway and the only thing the header changed was
 * the response status (206 rather than 200) and therefore the shape a
 * network/cache audit of this data plane sees. TASK-2983 (epic 2981) dropped
 * it for INSTRUMENT FIDELITY ONLY — no user-facing benefit is claimed: the
 * reload/cache differential that originally motivated the change was measured
 * and withdrawn (with `public, max-age=31536000, immutable` on the store
 * objects a persistent profile re-downloads nothing on reload either way).
 * See report 2026-09-08-q-2-task-2983-range-cache-premise-false.
 * `_fetchRawBytes` still accepts a 206 (see its status guard) so a server or
 * proxy that answers partial anyway does not break the read path.
 */

import { chunkKey } from './playbackDecode';
import { decodeChunkOffThread } from './playbackDecodeWorker';
import { PlaybackChunkCache } from './playbackChunkCache';
import { QUANTITY_ARRAYS } from './playbackChunkShape';

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
 * TASK-2985 (W1.2, epic 2981) — how many CHUNKS the fill queue runs at once.
 * Three quantity arrays per chunk, so two chunks is six concurrent requests.
 *
 * THE BOUND IS ON QUEUE-ISSUED REQUESTS ONLY, never on the shared `_inflight`.
 * playbackInitEpic's mesh load (a Promise.all of six static-array fetches),
 * playbackEnvelopeFetchEpic and playbackSyncLayerEpic's per-frame
 * loadPlaybackFrame all call fetchAndDecodeChunk OUTSIDE the queue and must
 * not be throttled by it: the frame path is the one the user is waiting on.
 */
export const MAX_CONCURRENT_FILL_CHUNKS = 2;

/** The single stable rejection every cancelled fill deferred carries. */
export const FILL_CANCELLED_MESSAGE = 'playbackChunkFetcher: fill cancelled (run disposed)';

/**
 * The window the MEMORY PLAN buys, defined ONCE — TASK-2985 (W1.2, epic 2981).
 *
 * `plan.chunksPerQuantity` CONSECUTIVE indices starting at
 *   start = clamp(centreChunk - plan.bufferWindowRadius,
 *                 0, max(0, totalChunks - plan.chunksPerQuantity))
 * and the whole store when it has fewer chunks than the plan has slots.
 *
 * IT REPLACES getPrefetchWindow AS THE PRODUCTION WINDOW. getPrefetchWindow
 * spends `windowRadius` slots behind the playhead and CLIPS at both ends, so
 * at centre 0 with an 11-slot plan it returns only 10 of the 11 chunks the
 * budget just paid for — the behind-slot is spent on nothing. planWindow
 * ROLLS the window instead of clipping it, so a plan that can hold the whole
 * store holds the whole store.
 *
 * The behind-slot TASK-2984 computes (`bufferWindowRadius = min(1, floor(
 * (chunksPerQuantity - 1) / 2))`) is still honoured wherever one exists — it
 * is what makes a short scrub back a cache hit — it just cannot cost a slot
 * at the start of the timeline any more.
 *
 * NOTE WHAT "WRAP" MEANS HERE, because it is easy to over-read (AC10):
 * playback does NOT loop. PLAYBACK_TICK goes to PAUSED at end-of-timeline and
 * nextTimestep is min(currentTimestep + 1, nTime - 1). The window ROLLS
 * BACKWARD near the end of the timeline (centre 15 of 16 with 3 slots gives
 * [13,14,15]); the playhead never wraps.
 *
 * @param {number} centreChunk the chunk the playhead is in
 * @param {number} totalChunks
 * @param {{chunksPerQuantity?: number, bufferWindowRadius?: number}} plan
 * @returns {number[]} ascending, contiguous
 */
export function planWindow(centreChunk, totalChunks, plan) {
    const total = totalChunks > 0 ? Math.floor(totalChunks) : 0;
    if (total <= 0) {
        return [];
    }
    const requested = plan && plan.chunksPerQuantity > 0 ? Math.floor(plan.chunksPerQuantity) : 1;
    const slots = Math.min(total, Math.max(1, requested));
    const radius = plan && plan.bufferWindowRadius > 0 ? Math.floor(plan.bufferWindowRadius) : 0;
    const centre = centreChunk > 0 ? Math.floor(centreChunk) : 0;
    const start = Math.min(Math.max(0, centre - radius), total - slots);
    const indices = [];
    for (let i = 0; i < slots; i++) {
        indices.push(start + i);
    }
    return indices;
}

/**
 * planWindow's MIRROR: which resident chunk to give up — TASK-2985.
 *
 * Maximises `(t - playheadChunk + totalChunks) % totalChunks`, i.e. the
 * FORWARD distance from the playhead. A chunk one step behind the playhead is
 * `totalChunks - 1` away by that measure and is therefore the first to go; the
 * chunk the playhead is IN scores 0 and is the last thing standing.
 *
 * WHY THIS AND NOT THE BYTE LRU. Once the fill queue stops touching resident
 * chunks, the cache's insertion order IS the fill order, and the fill starts
 * at the playhead — so oldest-first evicts the chunk being played. That
 * inversion is unreachable at HEAD only because prefetchWindowByChunk maps
 * over the WHOLE window and fetchAndDecodeChunk opens with `store.get(key)`,
 * which re-PROMOTES every resident window chunk on every pass. This function
 * ships WITH the queue for exactly that reason.
 *
 * Ties resolve to the lowest index, so the choice is deterministic.
 *
 * @param {number[]} residentChunkIndices
 * @param {number} playheadChunk
 * @param {number} totalChunks
 * @returns {number|null} null when there is nothing to evict
 */
export function farthestBehind(residentChunkIndices, playheadChunk, totalChunks) {
    const total = totalChunks > 0 ? Math.floor(totalChunks) : 0;
    if (!residentChunkIndices || !residentChunkIndices.length || total <= 0) {
        return null;
    }
    let victim = null;
    let best = -1;
    residentChunkIndices.forEach((t) => {
        const distance = ((t - playheadChunk) % total + total) % total;
        if (distance > best) {
            best = distance;
            victim = t;
        }
    });
    return victim;
}

function deferred() {
    const box = {};
    box.promise = new Promise((resolve, reject) => {
        box.resolve = resolve;
        box.reject = reject;
    });
    return box;
}

/**
 * Rotate a plan window so it begins at the playhead — TASK-2985.
 *
 * The playhead's own chunk first, then forward through the plan, then the
 * plan's tail (the behind-slot, and everything the window rolled backward over
 * near the end of the timeline) last. A playhead that is not in the plan at
 * all starts at the first plan index at or after it, and at the plan's head if
 * it is past the end.
 */
function orderFromPlayhead(planChunkIndices, playheadChunk) {
    let pivot = planChunkIndices.indexOf(playheadChunk);
    if (pivot === -1) {
        pivot = planChunkIndices.findIndex((t) => t >= playheadChunk);
    }
    if (pivot <= 0) {
        return planChunkIndices.slice();
    }
    return planChunkIndices.slice(pivot).concat(planChunkIndices.slice(0, pivot));
}

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
     *   TASK-2754 (W0, epic 2981): invoked through the SINGLE-FLIGHT below,
     *   so concurrent 403s cost one call, not one call each.
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
    constructor({ manifest, refreshManifest, cache, memoryPlan, decodeImpl, fetchImpl = defaultFetch, onProgress } = {}) {
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
        // TASK-2744 (AC18, epic 2706) — optional `({key, bytes}) => void`,
        // invoked once per completed object at the single byte choke point
        // below. The UI has no other way to know that the ~100 s after a
        // manifest resolves is a mesh DOWNLOAD rather than a stuck request.
        // Never throws into the fetch path: a reporting failure must not fail
        // the load it is only describing.
        this.onProgress = typeof onProgress === 'function' ? onProgress : null;
        // Per-relativeKey in-flight promises so a burst of prefetch requests
        // for the same chunk (e.g. two overlapping prefetch windows) collapse
        // into one network request instead of racing duplicate fetches.
        this._inflight = new Map();
        // TASK-2754 (W0, epic 2981) — the manifest-refresh single-flight.
        // `_inflight` above keys on the CHUNK KEY, so it can only collapse
        // duplicate requests for the same chunk; it is structurally unable to
        // collapse a refresh across DISTINCT keys, which is the only shape a
        // credential rotation ever takes. Deliberately per-INSTANCE and never
        // module-global: a second fetcher serves a different run, whose urls
        // one run's re-sign says nothing about.
        this._refreshInFlight = null;
        // TASK-2728 (W5, epic 2706) — the static (non-time-chunked) mesh
        // arrays live HERE, not in the LRU above. See _storeFor().
        this._staticArrays = new Map();
        // TASK-2985 (W1.2, epic 2981) — THE FILL QUEUE.
        // `_fillPending` is the not-yet-started entries in fill order (it is
        // REBUILT on every fillTowards, which is how a SEEK re-prioritises);
        // `_fillRunning` is the entries currently issuing requests, bounded by
        // MAX_CONCURRENT_FILL_CHUNKS; `_fillByChunk` makes a re-enqueue of the
        // same chunk return the SAME promise, so the buffer epic's per-tick
        // switchMap re-issue is idempotent rather than a new fan-out.
        this._fillPending = [];
        this._fillRunning = new Set();
        this._fillByChunk = new Map();
        this._fillPlayhead = 0;
        this._fillTotalChunks = 0;
        // Set by releaseCaches(). A decode that was already in flight when the
        // run was disposed must NOT repopulate the cache it just cleared.
        this._disposed = false;
    }

    /**
     * Where a decoded array for `arrayName` belongs — TASK-2728 (W5, epic 2706).
     *
     * The time-series LRU's ceiling is sized from QUANTITY chunks only
     * (playbackMemoryPolicy.js: `quantityCount * chunksPerQuantity *
     * storedChunkBytes`); the static mesh arrays' bytes are accounted
     * separately, under fixedBytes. Putting the statics in the same cache
     * therefore made it govern a population it was never sized for, and the
     * LRU spent its one lever — eviction — on the wrong entries: on a
     * run-1328 chunk-10 store a full window IS the ceiling to the byte, so
     * inserting face_node_connectivity (Int32Array(3 * nFace) = 81,353,184 B)
     * evicted 2 of the 6 buffered chunks; at chunk length 2 it evicted 6 of 9.
     * Those chunks were then re-downloaded while the playhead still needed
     * them.
     *
     * Eviction could never pay here in the first place: loadPlaybackMesh's
     * arrays are threaded into playbackManifestLoaded and held on `pb.mesh`
     * for the life of the layer, so they are strong-referenced whether the
     * cache holds them or not. Evicting one frees nothing and costs a refetch.
     *
     * So the statics get a plain unbounded Map — fetched once per layer, held
     * for exactly as long as the fetcher itself, and released with it in
     * disposeRun(). The alternative (adding the mesh bytes to cacheMaxBytes)
     * was rejected deliberately: it inflates a heap ceiling this epic is
     * trying to hold down, and leaves the cache still describing two
     * populations at once. The ceiling should mean what it says — the window.
     *
     * `_inflight` is deliberately NOT split: concurrent-request collapsing is
     * about the network, not about residency, and both paths need it.
     */
    _storeFor(arrayName) {
        return QUANTITY_ARRAYS.indexOf(arrayName) === -1 ? this._staticArrays : this.cache;
    }

    /**
     * Drop everything this fetcher is holding — TASK-2728.
     *
     * disposeRun() already released the LRU explicitly rather than waiting for
     * the fetcher to become unreachable, on the stated grounds that "the cache
     * is the large half". Since 2728 the statics are the OTHER large half
     * (~100 MB on a prod-scale mesh) and they no longer live in that cache, so
     * they need the same explicit release: any surviving reference to the
     * fetcher — a pending decode closure, a layer that outlived its run —
     * would otherwise pin the whole mesh after the run was disposed.
     */
    releaseCaches() {
        // TASK-2985 (W1.2, epic 2981) — TEARDOWN IS EXPLICIT, and it happens
        // BEFORE the cache is cleared.
        //
        // Every key the queue registered in `_inflight` at ENQUEUE time is a
        // promise somebody may be awaiting: fetchAndDecodeChunk hands that same
        // promise to the urgent frame path (loadPlaybackLayerOptions'
        // loadPlaybackFrame). An enqueue-time deferred that is dropped without
        // settling reproduces TASK-2754's unrecoverable-promise failure exactly
        // — a tab stuck in `buffering` for ever. So: stop the queue, drop every
        // not-yet-started entry, reject every deferred with ONE stable error,
        // and clear `_inflight` of the keys the queue owns.
        //
        // Already-started requests are not cancellable (there is no
        // AbortController in this class, and unsubscribing an Rx fromPromise
        // does not cancel a fetch), so they are left to land — but `_disposed`
        // makes their `store.set` a no-op, so a disposed run cannot repopulate
        // the cache it just cleared.
        this._disposed = true;
        const cancelled = this._fillPending.concat(Array.from(this._fillRunning));
        this._fillPending = [];
        this._fillRunning.clear();
        this._fillByChunk.clear();
        cancelled.forEach((entry) => {
            entry.arrays.forEach((slot) => {
                if (slot.owned) {
                    this._inflight.delete(slot.key);
                    slot.deferred.reject(new Error(FILL_CANCELLED_MESSAGE));
                }
            });
        });
        if (this.cache && typeof this.cache.clear === 'function') {
            this.cache.clear();
        }
        this._staticArrays.clear();
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

    /**
     * TASK-2754 (W0, epic 2981) — ONE `?refresh=1` per rotation, not one per
     * expired url.
     *
     * A credential rotation (TASK-2064) does not expire a url; it invalidates
     * every presigned url in the cached manifest in the same instant. The
     * fan-out that meets it is already eight requests wide before the first
     * response lands (playbackInitEpic's
     * `Promise.all([mesh, time, dt])`, where the mesh load is itself a
     * `Promise.all` of six static-array fetches), and during playback
     * prefetchWindow fans quantities x window chunks. Each of those used to
     * reach `this.manifest = await this.refreshManifest()` independently —
     * the shared field is only assigned AFTER the await, so no caller could
     * ever observe another's result — and each therefore issued its own
     * `GET .../playback-manifest/?refresh=1`. That endpoint bypasses the
     * server cache by design and runs a full paginated `list_objects_v2` plus
     * a `generate_presigned_url` per object, so the recovery path stampeded
     * the most expensive endpoint in the application at exactly the moment
     * every viewer needed it, on N uwsgi workers at once, per viewer. Under
     * worker or PG-connection exhaustion any ONE of those N failing rejects
     * its chunk and fails the whole `Promise.all` with MANIFEST_FAILED,
     * converting the rotation TASK-2739 made recoverable back into a dead run.
     *
     * The memo CLEARS ON SETTLE — resolve and reject alike. A permanent memo
     * would make the second rotation of a long session unrecoverable, which is
     * strictly worse than the stampede it replaced; and the retry below is
     * already bounded by `allowRefresh: false`, so clearing cannot loop.
     *
     * @returns {Promise<object>} the refreshed manifest, shared by every
     *   concurrent 403 in this rotation.
     */
    _refreshManifestOnce() {
        if (this._refreshInFlight) {
            return this._refreshInFlight;
        }
        // TASK-2981 W0 phase-1.7 sweep — the call is DEFERRED to a microtask
        // (`Promise.resolve().then(...)`) rather than made inside a bare async
        // IIFE. The body of an async function runs SYNCHRONOUSLY up to its
        // first await, so a `refreshManifest` that throws synchronously ran
        // the clear-on-settle handler BEFORE the assignment below had
        // installed the memo: the clear hit an already-null field, and the
        // rejected promise was then memoised for the life of the fetcher, so
        // every later 403 reused that one rejection and the run could never
        // recover. `refreshManifest` is a caller-supplied option, so a
        // synchronous throw is a shape this class does not get to rule out.
        // Deferring makes clear-on-settle hold for resolve, async reject and
        // sync throw alike — which is what AC2 of TASK-2754 actually claims.
        const clear = () => {
            // Unconditional: while `_refreshInFlight` is non-null every caller
            // reuses it, so nothing else can have replaced it before this
            // settles.
            this._refreshInFlight = null;
        };
        const inFlight = Promise.resolve()
            .then(() => this.refreshManifest())
            .then(
                (manifest) => {
                    clear();
                    return manifest;
                },
                (error) => {
                    clear();
                    throw error;
                }
            );
        this._refreshInFlight = inFlight;
        return inFlight;
    }

    async _fetchRawBytes(relativeKey, { allowRefresh = true } = {}) {
        const url = urlForRelativeKey(this.manifest, relativeKey);
        const response = await this.fetchImpl(url);
        if (response.status === 403) {
            if (!allowRefresh || !this.refreshManifest) {
                throw new Error(`playbackChunkFetcher: 403 fetching '${relativeKey}' and no refreshManifest available to retry`);
            }
            this.manifest = await this._refreshManifestOnce();
            return this._fetchRawBytes(relativeKey, { allowRefresh: false });
        }
        if (!response.ok && response.status !== 206) {
            throw new Error(`playbackChunkFetcher: fetch of '${relativeKey}' failed with status ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (this.onProgress) {
            try {
                this.onProgress({ key: relativeKey, bytes: buffer.byteLength });
            } catch (e) {
                // deliberately swallowed — see the constructor note
            }
        }
        return buffer;
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
        const store = this._storeFor(arrayName);
        const cached = store.get(key);
        if (cached) {
            return cached;
        }
        if (this._inflight.has(key)) {
            // TASK-2985 — THE URGENT PATH MUST NEVER WAIT FOR A FILL SLOT.
            // If this key belongs to a queue entry that is enqueued but NOT
            // YET STARTED, start it now, bypassing MAX_CONCURRENT_FILL_CHUNKS.
            // The caller here is playbackSyncLayerEpic -> loadPlaybackFrame,
            // i.e. a frame the user is looking at; making it queue behind a
            // speculative pre-roll is the stall this epic exists to remove.
            this._startQueuedKeyNow(key);
            return this._inflight.get(key);
        }
        const task = (async() => {
            try {
                return await this._runChunkArray(arrayName, chunkIndices, decodeOpts);
            } finally {
                this._inflight.delete(key);
            }
        })();
        this._inflight.set(key, task);
        return task;
    }

    /**
     * fetch -> decode -> cache for ONE array of ONE chunk, with NO `_inflight`
     * bookkeeping of its own — TASK-2985 (W1.2, epic 2981).
     *
     * Lifted verbatim out of fetchAndDecodeChunk's task IIFE so the fill queue
     * can settle the deferred IT registered at enqueue time instead of going
     * back through fetchAndDecodeChunk, which would find the queue's own
     * `_inflight` entry and return it — a promise waiting on itself.
     *
     * Both callers own their `_inflight` entry and both must remove it; this
     * function deliberately owns neither.
     */
    async _runChunkArray(arrayName, chunkIndices, decodeOpts, fillChunkIndex) {
        const key = chunkKey(arrayName, chunkIndices);
        const store = this._storeFor(arrayName);
        const { dtype, byteorder = 'little' } = decodeOpts || {};
        const compressed = await this._fetchRawBytes(key);
        const decoded = await this.decodeImpl(compressed, { dtype, byteorder });
        // A decode that outlived releaseCaches() must not repopulate the cache
        // the disposed run just cleared (AC9's teardown clause). The value is
        // still RETURNED, so an awaiting frame path gets its data rather than a
        // hang; it is only the RESIDENCY that is refused.
        if (!this._disposed) {
            // ROOM IS MADE AT INSERT TIME, NOT AT CHUNK START. Making it at
            // start is a real bug and it was measured: with two chunks in
            // flight the decode lands long after the decision, so the resident
            // count the chooser saw is stale by then and the byte LRU gets
            // there first — evicting the chunk the playhead is IN, which is
            // precisely the inversion this task exists to remove.
            if (fillChunkIndex !== undefined) {
                this._makeRoomFor(fillChunkIndex, chunkIndices[1] || 0);
            }
            store.set(key, decoded);
        }
        return decoded;
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
    /**
     * Which time-chunk indices are ACTUALLY resident right now (TASK-2744
     * AC20).
     *
     * A chunk counts only when EVERY required array is present for it —
     * precisely the invariant playbackController's `bufferedChunks` comment
     * always claimed ("all 3 quantity arrays") but which nothing enforced
     * after eviction. Cache keys are `${arrayName}/c/${t}/${nodeChunk}`
     * (playbackDecode.chunkKey).
     *
     * Before this existed, `bufferedChunks` grew monotonically via
     * mergeBufferedChunks and NOTHING removed an index when the LRU evicted
     * it. Measured on map 1461: state claimed chunks [0,1,3] resident while
     * the plan afforded 2 — and worse, isWindowBuffered then trusted the
     * stale index, so a scrub to an evicted chunk never re-entered SEEKING
     * and never refetched.
     */
    residentChunkIndices(arrayNames, nodeChunkIndex = 0) {
        const names = arrayNames && arrayNames.length ? arrayNames : [];
        if (!names.length) {
            return [];
        }
        const counts = new Map();
        this.cache.keys().forEach((key) => {
            const parts = String(key).split('/');
            // arrayName / 'c' / t / nodeChunk
            if (parts.length !== 4 || parts[1] !== 'c') {
                return;
            }
            if (names.indexOf(parts[0]) === -1 || Number(parts[3]) !== nodeChunkIndex) {
                return;
            }
            const t = Number(parts[2]);
            if (!isFinite(t)) {
                return;
            }
            counts.set(t, (counts.get(t) || 0) + 1);
        });
        return Array.from(counts.entries())
            .filter(([, n]) => n >= names.length)
            .map(([t]) => t)
            .sort((a, b) => a - b);
    }

    /** Bytes the decoded-chunk cache currently holds (TASK-2744 AC20). */
    residentBytes() {
        return this.cache ? this.cache.totalBytes : 0;
    }

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
     *
     * NOT a production path since TASK-2985 — playbackBufferEpic fills through
     * fillTowards, which bounds concurrency and owns eviction. Calling this
     * bypasses both.
     *
     * @param {Record<string, {dtype: string, byteorder?: string, quantization?: object}>} arrayConfigs
     *   e.g. {depth: {dtype:'uint16', quantization:{...}}, node_x: {dtype:'float32'}}
     * @param {number} centerChunkIndex
     * @param {number} totalChunks
     * @param {{windowRadius?: number, windowAhead?: number, nodeChunkIndex?: number}} [options]
     * @returns {Promise<Array<{arrayName: string, chunkIndex: number, value?: object, error?: Error}>>}
     */
    async prefetchWindow(arrayConfigs, centerChunkIndex, totalChunks, options = {}) {
        const groups = this.prefetchWindowByChunk(arrayConfigs, centerChunkIndex, totalChunks, options);
        const settled = await Promise.all(groups.map((g) => g.promise));
        return settled.reduce((all, results) => all.concat(results), []);
    }

    /**
     * The same fetches, reported PER CHUNK instead of as one all-or-nothing
     * batch: `[{chunkIndex, promise}]`, ascending, each promise resolving when
     * that ONE chunk's arrays have all settled.
     *
     * TASK-2743 UAT-09 (W6, epic 2706) — WHY THIS EXISTS. prefetchWindow's
     * `Promise.all` meant the caller learned nothing until the whole window
     * landed, so the chunk the playhead is actually sitting on was withheld
     * behind its neighbours. The controller's own readiness gate
     * (requiredWindowFor -> the chunks frame0/frame1 need, usually ONE) was
     * therefore never the binding constraint: `ready` waited on the deepest
     * prefetch instead.
     *
     * Latent since W1.2 and invisible while the window was 2 chunks deep;
     * TASK-2743 UAT-08's device-sized budget made it 3 on a machine with
     * headroom and the cost became a measured 7,954 ms cold load on map 1461,
     * where chunk 0's own three arrays had landed seconds earlier.
     *
     * Ascending order matters: chunk `lo` is the one nearest (or at) the
     * playhead, so a caller that acts on the first resolution acts on the most
     * urgent chunk.
     *
     * NOT a production path since TASK-2985 — playbackBufferEpic fills through
     * fillTowards, which bounds concurrency and owns eviction. Calling this
     * bypasses both. The `[{chunkIndex, promise}]` shape documented below is
     * still the reference fillTowards reproduces, which is why it stays.
     *
     * @param {Record<string, {dtype: string, byteorder?: string, quantization?: object}>} arrayConfigs
     * @param {number} centerChunkIndex
     * @param {number} totalChunks
     * @param {{windowRadius?: number, windowAhead?: number, nodeChunkIndex?: number}} [options]
     * @returns {Array<{chunkIndex: number, promise: Promise<Array<{arrayName: string, chunkIndex: number, value?: object, error?: Error}>>}>}
     */
    /**
     * THE FILL QUEUE — TASK-2985 (W1.2, epic 2981).
     *
     * Enqueue every chunk of `planChunkIndices` that is not already resident,
     * in FORWARD ORDER FROM THE PLAYHEAD WITH WRAP (playhead first, then
     * forward through the plan, then the plan's tail behind the playhead), and
     * run at most MAX_CONCURRENT_FILL_CHUNKS of them at a time.
     *
     * WHAT IT REPLACES AND WHY. prefetchWindowByChunk fires every array of
     * every window chunk at once — measured maxInflight 33 on an 11-slot
     * window. That is not a pacing choice, it is the absence of one: on a slow
     * link 33 racing requests all finish late together, so the chunk the
     * playhead is about to enter arrives no sooner than the chunk ten steps
     * ahead of it. TASK-2984 made deep windows reachable, which made the
     * fan-out 11 chunks wide instead of 3 and turned a latent problem into the
     * shipped one.
     *
     * FOUR THINGS IT OWNS, none of which the old fan-out did:
     *  1. ORDER — the playhead's own chunk is the first request issued.
     *  2. A BOUND — two chunks, six requests, at any instant. On queue-issued
     *     requests ONLY; the mesh load, the envelope fetch and the per-frame
     *     loadPlaybackFrame all bypass it (see MAX_CONCURRENT_FILL_CHUNKS).
     *  3. RE-PRIORITISATION — a new playhead rebuilds the pending order, so a
     *     SEEK makes the seeked chunk the next request rather than the
     *     eleventh. In-flight requests are neither cancelled nor counted:
     *     unsubscribing an Rx fromPromise does not cancel a fetch and this
     *     class has no AbortController, so pretending otherwise would be a lie
     *     about the network.
     *  4. EVICTION — before a chunk's arrays go in, room is made by dropping
     *     the resident chunk farthest BEHIND the playhead (farthestBehind),
     *     not the oldest.
     *
     * `_inflight` IS REGISTERED AT ENQUEUE TIME, so the buffer epic's per-tick
     * switchMap re-issue and fetchAndDecodeChunk's own dedup both collapse onto
     * this queue instead of racing it. That is also why the queue settles its
     * own deferreds through _runChunkArray rather than calling
     * fetchAndDecodeChunk, which would find those entries and await itself.
     *
     * @param {number[]} planChunkIndices the window the plan bought (planWindow)
     * @param {number} playheadChunk the chunk the playhead is in
     * @param {Record<string, {dtype: string, byteorder?: string, quantization?: object}>} arrayConfigs
     * @param {{nodeChunkIndex?: number, totalChunks?: number}} [options]
     *   `totalChunks` is the modulus farthestBehind needs; it defaults to the
     *   plan's own extent, which is right whenever the plan reaches the end of
     *   the timeline and conservative otherwise.
     * @returns {Array<{chunkIndex: number, promise: Promise<Array<{arrayName: string, chunkIndex: number, value?: object, error?: Error}>>}>}
     *   in FILL ORDER, one entry per plan chunk that was not already resident,
     *   each promise resolving to the same shape prefetchWindowByChunk produces.
     */
    fillTowards(planChunkIndices, playheadChunk, arrayConfigs, { nodeChunkIndex = 0, totalChunks } = {}) {
        // AC11 — a run the device cannot hold does not get filled at all. This
        // is the fetcher's half of TASK-2986's zero: the fallback verdict must
        // stop the bytes BEFORE they move, not explain them afterwards.
        if (this.memoryPlan && this.memoryPlan.verdict === 'fallback') {
            return [];
        }
        const plan = (planChunkIndices || []).filter((t) => t >= 0);
        const arrayNames = Object.keys(arrayConfigs || {});
        if (!plan.length || !arrayNames.length) {
            return [];
        }
        const total = totalChunks > 0 ? Math.floor(totalChunks) : Math.max.apply(null, plan) + 1;
        // The chooser reads the LIVE playhead, not the one an entry was
        // enqueued under: a chunk whose decode lands after a SEEK must be
        // judged against where the playhead is NOW.
        this._fillPlayhead = playheadChunk;
        this._fillTotalChunks = total;
        const ordered = orderFromPlayhead(plan, playheadChunk);
        const groups = [];
        const claimed = [];
        ordered.forEach((chunkIndex) => {
            const existing = this._fillByChunk.get(chunkIndex);
            if (existing) {
                groups.push({ chunkIndex, promise: existing.promise });
                if (!existing.started) {
                    claimed.push(existing);
                }
                return;
            }
            const entry = this._enqueueChunk(chunkIndex, arrayNames, arrayConfigs, nodeChunkIndex);
            if (!entry) {
                return; // already fully resident — nothing to fetch
            }
            groups.push({ chunkIndex, promise: entry.promise });
            claimed.push(entry);
        });
        // REBUILD the pending order: this call's chunks first, in fill order,
        // then anything still pending from an earlier plan (its promises were
        // handed out and must still settle — AC9).
        const stale = this._fillPending.filter((e) => claimed.indexOf(e) === -1);
        this._fillPending = claimed.concat(stale);
        this._pumpFill();
        return groups;
    }

    /**
     * Build one chunk's queue entry, registering `_inflight` at ENQUEUE time.
     * Returns null when every array of the chunk is already resident.
     */
    _enqueueChunk(chunkIndex, arrayNames, arrayConfigs, nodeChunkIndex) {
        const arrays = arrayNames.map((arrayName) => {
            const key = chunkKey(arrayName, [chunkIndex, nodeChunkIndex]);
            const store = this._storeFor(arrayName);
            // NOT store.get(): that PROMOTES to MRU, and a queue that promotes
            // what it walks past re-creates the very LRU ordering this task
            // replaces. has() observes without reordering.
            if (store.has && store.has(key)) {
                return { arrayName, key, resident: true, owned: false, deferred: null };
            }
            if (this._inflight.has(key)) {
                // somebody else (the frame path, the mesh load) already owns it
                return { arrayName, key, resident: false, owned: false, deferred: null,
                    borrowed: this._inflight.get(key) };
            }
            const box = deferred();
            this._inflight.set(key, box.promise);
            return { arrayName, key, resident: false, owned: true, deferred: box };
        });
        if (arrays.every((slot) => slot.resident)) {
            return null;
        }
        const entry = { chunkIndex, arrays, arrayConfigs, nodeChunkIndex, started: false };
        entry.promise = Promise.all(arrays.map((slot) => {
            const source = slot.resident
                ? Promise.resolve(this._storeFor(slot.arrayName).get(slot.key))
                : (slot.owned ? slot.deferred.promise : slot.borrowed);
            return source
                .then((value) => ({ arrayName: slot.arrayName, chunkIndex, value }))
                .catch((error) => ({ arrayName: slot.arrayName, chunkIndex, error }));
        })).then((results) => {
            this._fillByChunk.delete(chunkIndex);
            return results;
        });
        this._fillByChunk.set(chunkIndex, entry);
        return entry;
    }

    /** Start pending entries until the concurrency bound is reached. */
    _pumpFill() {
        while (this._fillRunning.size < MAX_CONCURRENT_FILL_CHUNKS && this._fillPending.length) {
            this._startFillEntry(this._fillPending.shift());
        }
    }

    /**
     * A direct fetchAndDecodeChunk for a key the queue has enqueued but not
     * started: promote it and start it NOW, past the bound. See the call site
     * in fetchAndDecodeChunk for why the frame path may not wait.
     */
    _startQueuedKeyNow(key) {
        const pendingIndex = this._fillPending.findIndex(
            (entry) => entry.arrays.some((slot) => slot.key === key)
        );
        if (pendingIndex === -1) {
            return;
        }
        const entry = this._fillPending.splice(pendingIndex, 1)[0];
        this._startFillEntry(entry);
    }

    _startFillEntry(entry) {
        if (!entry || entry.started || this._disposed) {
            return;
        }
        entry.started = true;
        this._fillRunning.add(entry);
        const owned = entry.arrays.filter((slot) => slot.owned);
        const settled = owned.map((slot) => this
            ._runChunkArray(slot.arrayName, [entry.chunkIndex, entry.nodeChunkIndex],
                entry.arrayConfigs[slot.arrayName], entry.chunkIndex)
            .then(
                (value) => {
                    this._inflight.delete(slot.key);
                    slot.deferred.resolve(value);
                },
                (error) => {
                    this._inflight.delete(slot.key);
                    slot.deferred.reject(error);
                }
            ));
        Promise.all(settled).then(() => {
            this._fillRunning.delete(entry);
            this._pumpFill();
        });
    }

    /**
     * Make room for one chunk by evicting the resident chunk FARTHEST BEHIND
     * the playhead — TASK-2985's half of the LRU-inversion fix.
     *
     * Sized in slots rather than bytes on purpose: the plan's own ceiling IS
     * `quantityCount * chunksPerQuantity * storedChunkBytes`, so "the cache
     * holds chunksPerQuantity chunks" and "the cache holds cacheMaxBytes" are
     * the same statement, and the slot form is the one that can act BEFORE the
     * bytes arrive rather than after the byte LRU has already picked the wrong
     * victim. `_evictToFit` still runs underneath as the safety net.
     *
     * Never evicts a partially-resident chunk (residentChunkIndices requires
     * every array), and never evicts the chunk the playhead is in.
     */
    _makeRoomFor(incomingChunkIndex, nodeChunkIndex) {
        const slots = this.memoryPlan && this.memoryPlan.chunksPerQuantity > 0
            ? Math.floor(this.memoryPlan.chunksPerQuantity)
            : 0;
        const playhead = this._fillPlayhead;
        const total = this._fillTotalChunks;
        if (!(slots > 0) || !(total > 0)) {
            return;
        }
        let guard = 0;
        while (guard++ <= slots) {
            const resident = this.residentChunkIndices(QUANTITY_ARRAYS, nodeChunkIndex)
                .filter((t) => t !== incomingChunkIndex);
            if (resident.length + 1 <= slots) {
                return;
            }
            const victim = farthestBehind(resident, playhead, total);
            if (victim === null || victim === playhead) {
                return;
            }
            QUANTITY_ARRAYS.forEach((arrayName) => {
                this.cache.evict(chunkKey(arrayName, [victim, nodeChunkIndex]));
            });
        }
    }

    prefetchWindowByChunk(arrayConfigs, centerChunkIndex, totalChunks, { windowRadius = 2, windowAhead, nodeChunkIndex = 0 } = {}) {
        const window = this.getPrefetchWindow(centerChunkIndex, totalChunks, windowRadius, { ahead: windowAhead });
        const arrayNames = Object.keys(arrayConfigs || {});
        return window.map((chunkIndex) => ({
            chunkIndex,
            promise: Promise.all(arrayNames.map((arrayName) => this
                .fetchAndDecodeChunk(arrayName, [chunkIndex, nodeChunkIndex], arrayConfigs[arrayName])
                .then((value) => ({ arrayName, chunkIndex, value }))
                .catch((error) => ({ arrayName, chunkIndex, error }))))
        }));
    }
}

export default PlaybackChunkFetcher;

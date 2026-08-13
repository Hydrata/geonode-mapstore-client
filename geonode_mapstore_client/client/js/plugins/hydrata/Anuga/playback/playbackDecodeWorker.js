/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackDecodeWorker — the main-thread half of TASK-2708's off-main-thread
 * chunk decode (W1.2, epic 2706). One long-lived module worker, created
 * lazily on the first chunk and shared by every fetcher, with the SAME
 * graceful-degradation posture AnugaPlaybackLayer's reprojectMeshAsync
 * established: no `Worker` global, a constructor throw, a script that fails
 * to load, or a per-request error all degrade to the identical same-thread
 * decode rather than failing the load. The fallback runs
 * `decodeCompressedChunk` — the very function the worker itself imports — so
 * the two paths cannot produce different numbers.
 *
 * THE HANDSHAKE, AND WHY IT IS NOT OPTIONAL. The compressed bytes are
 * TRANSFERRED into the worker (a structured clone of every chunk would hand
 * back the copy this exists to avoid). A transfer is destructive: once it has
 * happened the main thread's buffer is detached, so discovering only THEN
 * that the worker script never loaded leaves nothing to fall back onto — the
 * request is unrecoverable and the frame is simply lost. Caught in karma,
 * which owns a `Worker` global but does not serve emitted worker chunks: the
 * first mesh array was transferred into a worker that then fired `onerror`.
 * So this module PROVES the worker answers (a ping/pong that transfers
 * nothing) before it hands over a single byte, and everything that arrives
 * during the handshake waits for its result rather than being decoded on the
 * main thread "just in case".
 *
 * Transfer discipline for the requests that do go through:
 *  - the COMPRESSED buffer is transferred IN. The caller must not read it
 *    again; PlaybackChunkFetcher hands over a buffer it has just received
 *    from `response.arrayBuffer()` and never touches.
 *  - the DECODED array is transferred BACK, so `result.buffer` arrives live
 *    on the main thread and detached in the worker.
 *  - a worker that dies AFTER the handshake rejects its in-flight requests
 *    (their bytes are genuinely gone) and marks itself unavailable, so the
 *    fetcher's next attempt at those chunks refetches and decodes inline.
 *    A rejected chunk surfaces as a chunk error, never as zeroed data.
 *
 * TASK-2730 (W3, epic 2706) closed the two holes in that last promise: it was
 * kept only for requests already in `pending`, and only for a death that
 * announced itself. A request racing disposal had not joined `pending` yet,
 * and a worker that dies silently announces nothing — `postMessage` on a dead
 * Worker is a no-op that does not throw. Both now settle: see the two guards
 * on decodeChunkOffThread below. GUARANTEED SETTLEMENT is the invariant this
 * module owes the fetcher, because a promise that never settles runs no
 * handler of any kind — then, catch or finally — so nothing downstream can
 * repair it.
 */
import { decodeCompressedChunk } from './playbackDecode';

/** How long to wait for the worker's pong before giving up on it entirely. */
export const WORKER_HANDSHAKE_TIMEOUT_MS = 5000;

/**
 * TASK-2730 (W3, epic 2706) — how long ONE decode request waits for its reply
 * before it gives up and rejects. The handshake timer above covers the
 * handshake and nothing else, so without this a worker that dies AFTER
 * postMessage without firing `onerror` (an OOM gunzipping a chunk is exactly
 * that shape) leaves its request hanging forever: `postMessage` on a dead
 * Worker is a SILENT no-op, no reply arrives, and a promise that never settles
 * means PlaybackChunkFetcher's `finally` never deletes the _inflight entry and
 * its `cache.set` — which sits after the awaited decode — never runs either.
 * The chunk becomes permanently unplayable with no error, no console line, no
 * retry and no network activity.
 *
 * Deliberately GENEROUS: a run-1328 chunk is 67,861,500 B (TASK-2708's
 * measured storedChunkBytes) and gunzipping it on a weak box is legitimately
 * slow. This is a last-resort liveness backstop, NOT a performance budget —
 * aborting a decode that would have succeeded is a worse outcome than waiting.
 * Callers may pass a smaller `timeoutMs` through the options bag (tests do);
 * the shipped default must stay >= 60000.
 */
export const WORKER_REQUEST_TIMEOUT_MS = 60000;

let worker = null;
let workerReadyPromise = null;
let nextRequestId = 1;
const pending = new Map();

function decodeInline(compressed, dtype, byteorder) {
    return decodeCompressedChunk(compressed, { dtype, byteorder });
}

function rejectAllPending(reason) {
    const entries = Array.from(pending.values());
    pending.clear();
    entries.forEach((entry) => entry.fail(reason));
}

/**
 * Drop the current worker and fail everything still waiting on it. The ONE
 * thing the two callers disagree about is what happens next, so it is the
 * only parameter: a resolved-to-null `nextReadyPromise` means "never retry"
 * (every later request goes straight inline), `null` means "re-probe from
 * scratch on the next request".
 */
function tearDownWorker(nextReadyPromise, reason) {
    const dead = worker;
    worker = null;
    workerReadyPromise = nextReadyPromise;
    if (dead) {
        try {
            dead.terminate();
        } catch (e) { /* already gone */ }
    }
    rejectAllPending(reason);
}

/** This worker is BROKEN (script failed, no pong, died mid-flight) — never retry it. */
function disposeWorker(reason) {
    tearDownWorker(Promise.resolve(null), reason);
}

function createWorker() {
    if (typeof Worker === 'undefined') {
        return Promise.resolve(null);
    }
    let created;
    try {
        created = new Worker(new URL('./playbackDecode.worker.js', import.meta.url));
    } catch (e) {
        return Promise.resolve(null);
    }
    worker = created;
    created.onmessage = (event) => {
        const { requestId, result, error } = event.data || {};
        const entry = pending.get(requestId);
        if (!entry) {
            return;
        }
        pending.delete(requestId);
        if (error || !result) {
            entry.fail(error || 'decode worker returned no result');
            return;
        }
        entry.resolve(result);
    };
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        timer = setTimeout(() => {
            // No pong: treat exactly like a load failure. Nothing has been
            // transferred yet, so this costs correctness nothing.
            disposeWorker('decode worker did not answer its handshake');
            finish(null);
        }, WORKER_HANDSHAKE_TIMEOUT_MS);
        created.onerror = () => {
            disposeWorker('decode worker script failed to load');
            finish(null);
        };
        const handshakeHandler = (event) => {
            if (!event.data || !event.data.pong) {
                return;
            }
            created.removeEventListener('message', handshakeHandler);
            finish(created);
        };
        created.addEventListener('message', handshakeHandler);
        try {
            created.postMessage({ requestId: 0, ping: true });
        } catch (e) {
            disposeWorker('decode worker rejected its handshake');
            finish(null);
        }
    });
}

function readyWorker() {
    if (!workerReadyPromise) {
        workerReadyPromise = createWorker();
    }
    return workerReadyPromise;
}

/**
 * gunzip + decode one chunk, off the main thread when that is possible.
 *
 * TASK-2730 (W3, epic 2706) — EVERY request settles, under every disposal
 * ordering. Two guards, both required, neither sufficient alone:
 *  (1) a SYNCHRONOUS `worker === active` re-check immediately before the
 *      postMessage. The body below runs one microtask AFTER `active` was
 *      captured, and anything calling tearDownWorker in that window fails
 *      only the requests already in `pending` — which this one has not joined
 *      yet. JS is single-threaded and tearDownWorker is synchronous, so a
 *      check with no await between it and the postMessage is airtight for
 *      THAT race. It does nothing for a worker that dies later.
 *  (2) a per-request timeout, which is the cover for a worker that dies AFTER
 *      the postMessage without firing `onerror`. On its own it would leave a
 *      request racing disposal hanging for the full timeout, which is why (1)
 *      is also there.
 *
 * @param {ArrayBuffer} compressed transferred to the worker — do not reuse it
 * @param {{dtype: string, byteorder?: string, timeoutMs?: number}} opts
 *   `timeoutMs` overrides WORKER_REQUEST_TIMEOUT_MS for this request only
 *   (an injection seam: the bundle is webpack ESM-harmony, so the exported
 *   constant is a getter-only binding no test can reassign).
 * @returns {Promise<Uint16Array|Int32Array|Float32Array|Float64Array>}
 */
export function decodeChunkOffThread(compressed, { dtype, byteorder = 'little', timeoutMs } = {}) {
    const requestTimeoutMs = typeof timeoutMs === 'number' && isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : WORKER_REQUEST_TIMEOUT_MS;
    return readyWorker().then((active) => {
        if (!active) {
            return decodeInline(compressed, dtype, byteorder);
        }
        return new Promise((resolve, reject) => {
            const requestId = nextRequestId++;
            let settled = false;
            let timer = null;
            const clearRequestTimer = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
            };
            pending.set(requestId, {
                resolve: (value) => {
                    if (!settled) {
                        settled = true;
                        clearRequestTimer();
                        resolve(value);
                    }
                },
                fail: (reason) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearRequestTimer();
                    reject(new Error(
                        `playbackDecodeWorker: off-thread decode of a '${dtype}' chunk failed ` +
                        `(${reason}). Its compressed bytes were transferred, so this chunk must ` +
                        'be refetched; the fetcher reports it as a chunk error rather than ' +
                        'handing the renderer an empty array.'
                    ));
                }
            });
            try {
                if (worker !== active) {
                    // (1) The worker was torn down in the microtask between
                    // readyWorker() resolving and this line. NOTHING has been
                    // transferred yet, so the buffer is still ours and the
                    // inline decoder — the same decodeCompressedChunk the
                    // worker itself runs — is an exact answer.
                    pending.delete(requestId);
                    settled = true;
                    decodeInline(compressed, dtype, byteorder).then(resolve, reject);
                    return;
                }
                active.postMessage({ requestId, compressed, dtype, byteorder }, [compressed]);
                if (!settled) {
                    // (2) The bytes are gone now, so there is no falling back:
                    // the only honest outcome for a worker that never answers
                    // is a rejection the fetcher reports as a chunk error.
                    // Armed AFTER the postMessage so a worker that answers (or
                    // dies) synchronously never leaves a timer behind.
                    timer = setTimeout(() => {
                        timer = null;
                        const entry = pending.get(requestId);
                        pending.delete(requestId);
                        if (entry) {
                            entry.fail(`no reply within ${requestTimeoutMs} ms`);
                        }
                    }, requestTimeoutMs);
                }
            } catch (e) {
                // postMessage threw synchronously (a non-transferable or
                // already-detached buffer) — the transfer did NOT happen, so
                // the buffer is still ours and inline decode is exact.
                pending.delete(requestId);
                settled = true;
                clearRequestTimer();
                decodeInline(compressed, dtype, byteorder).then(resolve, reject);
            }
        });
    });
}

/**
 * Drop the shared worker (test hygiene / a future "left the playback page"
 * cleanup). Safe to call when none was ever created; the next request
 * re-probes from scratch.
 */
export function terminatePlaybackDecodeWorker() {
    tearDownWorker(null, 'decode worker terminated');
}

export default decodeChunkOffThread;

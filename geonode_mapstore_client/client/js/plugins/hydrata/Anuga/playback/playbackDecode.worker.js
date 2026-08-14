/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackDecode.worker — off-main-thread gunzip + typed-array decode
 * (TASK-2708, W1.2, epic 2706). Deliberately thin, exactly like
 * playbackReproject.worker.js: the actual decode (and its correctness tests)
 * lives in playbackDecode.decodeCompressedChunk, which this worker imports
 * unchanged, so the worker and the same-thread fallback cannot drift.
 *
 * WHY. On run 1328 one depth chunk gunzips to 67,861,500 B and then walks
 * 33,930,750 elements. On the main thread that is a multi-second stall with
 * TWO chunk-sized allocations live at once (the raw buffer and the typed
 * array) — the measured 5,722 ms / 1,310 MiB step. In here, both the gzip
 * stream and the raw buffer are the WORKER's heap: the main thread only ever
 * sees the finished array, and only after it has been transferred.
 *
 * Unlike playbackReproject.worker (one-shot, terminated after a single mesh
 * load) this one is LONG-LIVED and multiplexed by `requestId` — chunk decode
 * happens continuously while playing, and paying worker startup per chunk
 * would hand back the latency this exists to remove. It is stateless between
 * messages, so out-of-order replies are fine.
 *
 * Message contract:
 *   in:  {requestId, ping: true}                                 (liveness handshake)
 *   out: {requestId, pong: true}
 *   in:  {requestId, compressed: ArrayBuffer, dtype, byteorder}  (compressed transferred)
 *   out: {requestId, result: TypedArray}   (success, result.buffer transferred)
 *     or {requestId, error: string}        (failure)
 *
 * The ping exists because the compressed bytes are TRANSFERRED: if the worker
 * script turns out not to load (webpack chunk missing — karma, a stale CDN,
 * a CSP), discovering that AFTER the transfer leaves nothing to fall back
 * onto. The main thread therefore proves this worker answers before it hands
 * over a single buffer (playbackDecodeWorker.js).
 */
import { decodeCompressedChunk } from './playbackDecode';

self.onmessage = function onPlaybackDecodeMessage(event) {
    const { requestId, ping, compressed, dtype, byteorder } = event.data || {};
    if (ping) {
        self.postMessage({ requestId, pong: true });
        return;
    }
    decodeCompressedChunk(compressed, { dtype, byteorder })
        .then((result) => {
            self.postMessage({ requestId, result }, [result.buffer]);
        })
        .catch((error) => {
            self.postMessage({ requestId, error: error && error.message ? error.message : String(error) });
        });
};

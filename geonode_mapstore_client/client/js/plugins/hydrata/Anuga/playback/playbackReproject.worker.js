/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackReproject.worker — off-main-thread wrapper around
 * reprojectMeshVertices (TASK-2626, W2.2, epic 2618). Deliberately thin: all
 * the actual math (and its correctness tests) lives in playbackReproject.js,
 * which this worker imports unchanged — a worker global is a fresh JS
 * realm, so it re-imports (webpack bundles it in) rather than sharing any
 * main-thread state.
 *
 * Message contract:
 *   in:  {requestId, localX: Float32Array, localY: Float32Array, epsg, xllcorner, yllcorner}
 *   out: {requestId, x: Float64Array, y: Float64Array}  (success, transferred)
 *     or {requestId, error: string}                     (failure)
 */
import { reprojectMeshVertices } from './playbackReproject';

self.onmessage = function onPlaybackReprojectMessage(event) {
    const { requestId, localX, localY, epsg, xllcorner, yllcorner } = event.data || {};
    try {
        const { x, y } = reprojectMeshVertices(localX, localY, { epsg, xllcorner, yllcorner });
        self.postMessage({ requestId, x, y }, [x.buffer, y.buffer]);
    } catch (error) {
        self.postMessage({ requestId, error: error && error.message ? error.message : String(error) });
    }
};

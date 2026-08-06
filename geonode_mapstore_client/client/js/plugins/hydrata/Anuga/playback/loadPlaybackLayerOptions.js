/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * loadPlaybackLayerOptions — glues the TASK-2625 chunk fetch/decode
 * pipeline (PlaybackChunkFetcher) to the TASK-2626 OL layer's `create()`/
 * `update()` options shape ({mesh, frame0, frame1, mixT, ...}), so a caller
 * (a dev/verification harness today; the W3 playback-controller UI later)
 * can go straight from a manifest to a ready-to-render AnugaPlaybackLayer
 * options object without hand-wiring the two subtasks' pieces together
 * every time.
 *
 * Deliberately NOT the "playback controller" itself — no timeline/scrub
 * state, no auto-advance, no prefetch scheduling policy (that is W3 scope,
 * per the epic's own layering: W2 = data plane + render surface, W3 =
 * playback UX on top of both). This is the one seam both already need.
 */
import { PlaybackChunkFetcher } from './playbackChunkFetcher';
import { chunkKey, decodeTypedArray, gunzip } from './playbackDecode';

const STATIC_ARRAYS = ['node_x', 'node_y', 'elevation', 'face_node_connectivity'];

async function fetchStaticArray(fetcher, arrayName, dtype) {
    return fetcher.fetchAndDecodeChunk(arrayName, arrayName === 'face_node_connectivity' ? [0, 0] : [0], { dtype, byteorder: 'little' });
}

/**
 * Build the mesh geometry object AnugaPlaybackLayer expects, from a
 * manifest's static (non-time-chunked) arrays.
 * @param {PlaybackChunkFetcher} fetcher
 * @returns {Promise<{nodeX: Float32Array, nodeY: Float32Array, elevation: Float32Array, faceNodeConnectivity: Int32Array, epsg: *, xllcorner: number, yllcorner: number}>}
 */
export async function loadPlaybackMesh(fetcher) {
    const [nodeX, nodeY, elevation, faceNodeConnectivity] = await Promise.all([
        fetchStaticArray(fetcher, 'node_x', 'float32'),
        fetchStaticArray(fetcher, 'node_y', 'float32'),
        fetchStaticArray(fetcher, 'elevation', 'float32'),
        fetchStaticArray(fetcher, 'face_node_connectivity', 'int32')
    ]);
    const meta = fetcher.manifest.schema_metadata || {};
    return {
        nodeX,
        nodeY,
        elevation,
        faceNodeConnectivity,
        epsg: meta.epsg,
        xllcorner: meta.xllcorner || 0,
        yllcorner: meta.yllcorner || 0
    };
}

/**
 * Fetch + dequantize one (depth, x_velocity, y_velocity) time-chunk-relative
 * "frame" — the AC's "two-buffer mix" primitive: the mesh renderer wants
 * one full frame per buffered timestep, not a whole time-chunk at once (a
 * time-chunk covers up to O1's 10 timesteps; the caller picks a specific
 * row inside it). This function decodes the chunk containing
 * `timestepIndex` and slices out that one row per vertex.
 * @param {PlaybackChunkFetcher} fetcher
 * @param {number} timestepIndex absolute timestep index
 * @param {number} nNode
 * @param {number} [chunkLengthT=10] must match the store's O1 time-chunk length
 * @returns {Promise<{depth: Float32Array, xVelocity: Float32Array, yVelocity: Float32Array}>}
 */
export async function loadPlaybackFrame(fetcher, timestepIndex, nNode, chunkLengthT = 10) {
    const chunkIndex = Math.floor(timestepIndex / chunkLengthT);
    const rowInChunk = timestepIndex % chunkLengthT;
    const quantization = fetcher.manifest.quantization || {};
    const [depthChunk, xVelChunk, yVelChunk] = await Promise.all([
        fetcher.fetchAndDecodeChunk('depth', [chunkIndex, 0], { dtype: 'uint16', byteorder: (quantization.depth || {}).byteorder, quantization: quantization.depth }),
        fetcher.fetchAndDecodeChunk('x_velocity', [chunkIndex, 0], { dtype: 'uint16', byteorder: (quantization.x_velocity || {}).byteorder, quantization: quantization.x_velocity }),
        fetcher.fetchAndDecodeChunk('y_velocity', [chunkIndex, 0], { dtype: 'uint16', byteorder: (quantization.y_velocity || {}).byteorder, quantization: quantization.y_velocity })
    ]);
    const start = rowInChunk * nNode;
    return {
        depth: depthChunk.slice(start, start + nNode),
        xVelocity: xVelChunk.slice(start, start + nNode),
        yVelocity: yVelChunk.slice(start, start + nNode)
    };
}

/**
 * Full convenience path: manifest -> {mesh, frame0, frame1, mixT:0} ready
 * to pass straight into `Layers.createLayer('anuga-playback', options)`.
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @param {object} [fetcherOptions] passed through to `new PlaybackChunkFetcher`
 * @param {number} [timestepIndex=0] which timestep to load as frame0 (frame1 is timestepIndex+1, clamped)
 * @returns {Promise<{id: string, mesh: object, frame0: object, frame1: object, mixT: number}>}
 */
export async function loadPlaybackLayerOptions(manifest, fetcherOptions = {}, timestepIndex = 0) {
    const fetcher = new PlaybackChunkFetcher({ manifest, ...fetcherOptions });
    const mesh = await loadPlaybackMesh(fetcher);
    const nNode = mesh.nodeX.length;
    const nTime = (manifest.schema_metadata && manifest.schema_metadata.n_time) || undefined;
    const nextIndex = nTime ? Math.min(timestepIndex + 1, nTime - 1) : timestepIndex + 1;
    const [frame0, frame1] = await Promise.all([
        loadPlaybackFrame(fetcher, timestepIndex, nNode),
        loadPlaybackFrame(fetcher, nextIndex, nNode)
    ]);
    return { mesh, frame0, frame1, mixT: 0 };
}

// Re-exported so a caller can pre-compute a chunk's cache key without
// duplicating the '<array>/c/<t>/<n>' template (e.g. for progress logging).
export { chunkKey, decodeTypedArray, gunzip };

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
import { chunkKey, decodeTypedArray, gunzip, dequantizeRow } from './playbackDecode';
import { computeVertexInradius } from './playbackMeshGeometry';
import { resolveChunkLengthT, isUsableChunkLength } from './playbackChunkShape';

async function fetchStaticArray(fetcher, arrayName, dtype) {
    return fetcher.fetchAndDecodeChunk(arrayName, arrayName === 'face_node_connectivity' ? [0, 0] : [0], { dtype, byteorder: 'little' });
}

function minMax(arr) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] < min) {
            min = arr[i];
        }
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return { min, max };
}

/**
 * Build the mesh geometry object AnugaPlaybackLayer expects, from a
 * manifest's static (non-time-chunked) arrays. TASK-2629 (W4.1) extends this
 * with `friction` (per-vertex Manning's n, schema §2 — needed by the shear
 * formula) and `inradius` (per-FACE, schema §2 — broadcast to per-vertex
 * `vertexInradius` here via playbackMeshGeometry.computeVertexInradius so
 * the renderer can treat it as a plain static vertex attribute like
 * elevation/friction; needed by the Courant formula), plus the run's own
 * elevation min/max (the `stage` quantity's per-run rescale range —
 * elevation is NOT quantized so it carries no valid_min/valid_max attr the
 * way depth/velocity do, schema §2).
 * @param {PlaybackChunkFetcher} fetcher
 * @returns {Promise<{nodeX: Float32Array, nodeY: Float32Array, elevation: Float32Array, friction: Float32Array, inradius: Float32Array, vertexInradius: Float32Array, faceNodeConnectivity: Int32Array, elevationMin: number, elevationMax: number, epsg: *, xllcorner: number, yllcorner: number}>}
 */
export async function loadPlaybackMesh(fetcher) {
    const [nodeX, nodeY, elevation, friction, inradius, faceNodeConnectivity] = await Promise.all([
        fetchStaticArray(fetcher, 'node_x', 'float32'),
        fetchStaticArray(fetcher, 'node_y', 'float32'),
        fetchStaticArray(fetcher, 'elevation', 'float32'),
        fetchStaticArray(fetcher, 'friction', 'float32'),
        fetchStaticArray(fetcher, 'inradius', 'float32'),
        fetchStaticArray(fetcher, 'face_node_connectivity', 'int32')
    ]);
    const meta = fetcher.manifest.schema_metadata || {};
    const vertexInradius = computeVertexInradius(faceNodeConnectivity, inradius, nodeX.length);
    const { min: elevationMin, max: elevationMax } = minMax(elevation);
    return {
        nodeX,
        nodeY,
        elevation,
        friction,
        inradius,
        vertexInradius,
        faceNodeConnectivity,
        elevationMin,
        elevationMax,
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
 * @param {number} chunkLengthT the STORE's own time-chunk length
 *        (resolveChunkLengthT(manifest)). REQUIRED — TASK-2724 deleted the
 *        `= 10` default: a wrong chunk length here is not an error, it is a
 *        plausible flood surface for the wrong timestep.
 *
 * TASK-2708 (W1.2, epic 2706): the fetcher now caches the STORED uint16
 * chunk, so this function — the one place that knows which single row of it
 * the renderer actually wants — is where `physical = offset + stored * scale`
 * happens. It is applied exactly once, to exactly nNode elements, and the
 * quantization block comes from the manifest (the store's own attrs), never
 * from anything the cache carries. Velocity is stored as VELOCITY (m/s,
 * `u = uh / (h + h0/h)`, schema attrs velocity_convention/velocity_formula) —
 * there is deliberately no momentum-to-velocity division here, and adding one
 * would divide by depth twice.
 *
 * @returns {Promise<{depth: Float32Array, xVelocity: Float32Array, yVelocity: Float32Array}>}
 */
export async function loadPlaybackFrame(fetcher, timestepIndex, nNode, chunkLengthT) {
    if (!isUsableChunkLength(chunkLengthT)) {
        throw new Error(
            `loadPlaybackFrame: chunkLengthT must be the store's own time-chunk length ` +
            `(a positive integer from resolveChunkLengthT), got ${chunkLengthT}. There is no ` +
            'safe default — assuming one reads the wrong row of the wrong chunk (TASK-2724).'
        );
    }
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
        depth: dequantizeRow(depthChunk, start, nNode, quantization.depth),
        xVelocity: dequantizeRow(xVelChunk, start, nNode, quantization.x_velocity),
        yVelocity: dequantizeRow(yVelChunk, start, nNode, quantization.y_velocity)
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
    // TASK-2724 — from the store's own chunk grid, never assumed. Throws on a
    // store that does not declare it (same contract as playbackInitEpic).
    const chunkLengthT = resolveChunkLengthT(manifest);
    const [frame0, frame1] = await Promise.all([
        loadPlaybackFrame(fetcher, timestepIndex, nNode, chunkLengthT),
        loadPlaybackFrame(fetcher, nextIndex, nNode, chunkLengthT)
    ]);
    return { mesh, frame0, frame1, mixT: 0 };
}

/**
 * Fetch + decode the store's `time` array (schema §1: 1D, single-chunk,
 * float64 simulation-seconds per output timestep) — TASK-2627 (W3.1)
 * extension of this seam: the playback controller's mixT/timestep advance
 * (playbackController.findTimestepBracket) needs REAL per-timestep sim time
 * (ANUGA output steps are not evenly spaced), not an assumed fixed cadence.
 * Not part of loadPlaybackLayerOptions's own {mesh, frame0, frame1, mixT}
 * convenience path (that stays scoped to a single already-known timestep
 * pair) — this is a separate static-array load a controller calls once at
 * init, alongside loadPlaybackMesh.
 * @param {PlaybackChunkFetcher} fetcher
 * @returns {Promise<Float64Array>}
 */
export async function loadPlaybackTime(fetcher) {
    return fetcher.fetchAndDecodeChunk('time', [0], { dtype: 'float64', byteorder: 'little' });
}

/**
 * Fetch + decode the store's `dt_ms` array (schema §1/§5 O2 — 1D,
 * single-chunk, float32 milliseconds per output timestep; `dt_ms[0]` is
 * ALWAYS invalid/NaN by convention) — TASK-2629 (W4.1) extension of this
 * seam: the Courant formula needs dt(t), and the store's own `has_dt` attr
 * (read by the caller from schema_metadata) is what gates whether this is
 * meaningful data or an all-NaN placeholder array (schema §5: "Absence is
 * first-class").
 * @param {PlaybackChunkFetcher} fetcher
 * @returns {Promise<Float32Array>}
 */
export async function loadPlaybackDt(fetcher) {
    return fetcher.fetchAndDecodeChunk('dt_ms', [0], { dtype: 'float32', byteorder: 'little' });
}

// Re-exported so a caller can pre-compute a chunk's cache key without
// duplicating the '<array>/c/<t>/<n>' template (e.g. for progress logging).
export { chunkKey, decodeTypedArray, gunzip };

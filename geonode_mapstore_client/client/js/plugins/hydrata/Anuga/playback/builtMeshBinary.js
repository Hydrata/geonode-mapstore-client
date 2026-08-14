/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * builtMeshBinary — TASK-2630 (W6.1, epic 2618) — fetch + decode the
 * pre-run Built-mesh binary export (`GET .../runs/<id>/built-mesh-binary/`,
 * Run.build_built_mesh_binary) and build ``anuga-playback`` OL layer
 * options in its already-supported WIREFRAME-ONLY mode, so a Built mesh
 * previews on the map at ANY size — lifting the MESH_RENDER_MAX_TRIANGLES
 * (150k) cap that gates the existing GeoServer MVT `mesh_triangle_render`
 * layer (buildMeshTriangleLayer in gwcTileRouting.js), which stays the
 * below-cap fallback (D2, review #11).
 *
 * Wire format (little-endian, matches Run.build_built_mesh_binary's
 * docstring exactly):
 *   uint32 node_count
 *   uint32 face_count
 *   float32[node_count] x   (absolute UTM metres — see below)
 *   float32[node_count] y
 *   int32[face_count*3] face_node_connectivity (flat n0,n1,n2 per face)
 *
 * Georeferencing: the BE source (Run.mesh_parquet, written by
 * gn_anuga.models.scenario._save_mesh_geoparquet from
 * anuga_mesh.tri_mesh.vertices) carries NO local-frame offset — unlike the
 * playback store's SWW-local convention (memory: reference-anuga-sww-
 * georef-xllcorner-not-false-easting), these x/y are already absolute UTM.
 * xllcorner/yllcorner are therefore passed as 0 into the mesh options below
 * — AnugaPlaybackLayer's loadMesh() -> reprojectMeshVertices() adds them
 * unconditionally, so an explicit 0 (not an omitted field) is required to
 * avoid the "silently falls back to some non-zero default" failure class
 * that memory entry warns about.
 *
 * No quantity data exists pre-run (no SWW — review F9), so this feeds the
 * SAME renderer with `wireframe: true` and all-zero frame0/frame1 buffers
 * (matching packQuantityVec3's shape) — the mesh-fill shader's
 * `wet = step(uWetThreshold, 0)` therefore evaluates false everywhere,
 * rendering the flat "dry ground" tint (playbackShaders.js) with the
 * wireframe edges on top: a plain geometry-only view, no renderer changes
 * needed (AnugaPlaybackRenderer.setMesh already treats `elevation` as the
 * only non-optional per-vertex array; zero-filled is a well-formed value).
 *
 * TASK-2788 — that tint is no longer opaque by default, so this module now
 * asks for it explicitly (`backgroundOpacity: 1` below). This preview is the
 * one caller for which "dry" is the subject rather than the background.
 */

const HEADER_BYTES = 8; // uint32 node_count + uint32 face_count

/**
 * @param {ArrayBuffer} buffer
 * @returns {{nodeCount: number, faceCount: number, nodeX: Float32Array, nodeY: Float32Array, faceNodeConnectivity: Int32Array}}
 */
export function decodeBuiltMeshBinary(buffer) {
    if (!buffer || buffer.byteLength < HEADER_BYTES) {
        throw new Error('builtMeshBinary.decodeBuiltMeshBinary: buffer too short for header');
    }
    const dv = new DataView(buffer);
    const nodeCount = dv.getUint32(0, true);
    const faceCount = dv.getUint32(4, true);

    const expectedBytes = HEADER_BYTES + nodeCount * 4 * 2 + faceCount * 3 * 4;
    if (buffer.byteLength !== expectedBytes) {
        throw new Error(
            `builtMeshBinary.decodeBuiltMeshBinary: buffer length ${buffer.byteLength} does not match header-implied length ${expectedBytes} (nodeCount=${nodeCount}, faceCount=${faceCount})`
        );
    }

    // .slice() (NOT `new Float32Array(buffer, offset, count)`) so each typed
    // array gets its OWN backing ArrayBuffer rather than three zero-copy
    // views sharing ONE buffer. This matters beyond memory hygiene:
    // AnugaPlaybackLayer.reprojectMeshAsync's Worker path transfers
    // `[mesh.nodeX.buffer, mesh.nodeY.buffer]` — listing the SAME
    // ArrayBuffer twice in a postMessage transfer list throws a
    // synchronous DataCloneError (uncaught there — only `new Worker()`
    // itself is try/caught, see that module's header), which silently
    // rejects the reprojection promise and leaves the mesh loading forever
    // (caught live via this module's own karma GL smoke test hanging at
    // mocha's default 2000ms timeout — see the W6 wave report). Every
    // OTHER existing caller (loadPlaybackLayerOptions.js) already gets
    // independent buffers for free because node_x/node_y are separate
    // network-fetched chunks; this single-response binary format is the
    // first caller to produce co-located arrays, so it must copy.
    let offset = HEADER_BYTES;
    const nodeX = new Float32Array(buffer.slice(offset, offset + nodeCount * 4));
    offset += nodeCount * 4;
    const nodeY = new Float32Array(buffer.slice(offset, offset + nodeCount * 4));
    offset += nodeCount * 4;
    const faceNodeConnectivity = new Int32Array(buffer.slice(offset, offset + faceCount * 3 * 4));

    return { nodeCount, faceCount, nodeX, nodeY, faceNodeConnectivity };
}

/**
 * Same detached-`fetch`-reference trap as playbackChunkFetcher.js's
 * defaultFetch — see that module's header for why the arrow wrapper is
 * required rather than a bare `fetchImpl = fetch` default parameter.
 */
const defaultFetch = (...args) => fetch(...args);

/**
 * @param {number|string} runId
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{nodeCount: number, faceCount: number, nodeX: Float32Array, nodeY: Float32Array, faceNodeConnectivity: Int32Array, epsg: string}>}
 */
export async function fetchBuiltMeshBinary(runId, fetchImpl = defaultFetch) {
    const url = `/api/v2/anuga/runs/${runId}/built-mesh-binary/`;
    const response = await fetchImpl(url, { credentials: 'same-origin' });
    if (!response.ok) {
        throw new Error(`builtMeshBinary.fetchBuiltMeshBinary: GET ${url} failed with status ${response.status}`);
    }
    const epsg = response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('X-Mesh-Epsg')
        : null;
    const buffer = await response.arrayBuffer();
    return { ...decodeBuiltMeshBinary(buffer), epsg };
}

/**
 * Build the `anuga-playback` OL layer options object
 * (AnugaPlaybackLayer.create/update's `options` shape), ready to pass
 * straight to `Layers.createLayer('anuga-playback', options)` or
 * dispatch(addLayer(options)) — the SAME generic dispatcher
 * anugaInputMenu.js's existing `onAddMeshLayer` already uses for the MVT
 * mesh_triangle_render layer, so no new Redux plumbing is needed.
 * @param {{nodeCount:number, faceCount:number, nodeX:Float32Array, nodeY:Float32Array, faceNodeConnectivity:Int32Array, epsg:string}} decoded
 * @param {{id?:string, title?:string}} [opts]
 * @returns {object}
 */
export function buildBuiltMeshLayerOptions(decoded, opts = {}) {
    const { nodeCount, nodeX, nodeY, faceNodeConnectivity, epsg } = decoded;
    const zero = new Float32Array(nodeCount);
    const zeroFrame = { depth: zero, xVelocity: zero, yVelocity: zero };
    return {
        type: 'anuga-playback',
        id: opts.id || 'anuga-built-mesh-preview',
        name: opts.id || 'anuga-built-mesh-preview',
        title: opts.title || 'Built mesh preview (WebGL)',
        visibility: true,
        wireframe: true,
        mesh: {
            nodeX,
            nodeY,
            epsg,
            xllcorner: 0,
            yllcorner: 0,
            elevation: zero,
            faceNodeConnectivity
        },
        // A frame pair is required so AnugaPlaybackRenderer's qty0Buf/qty1Buf
        // are sized to nodeCount (see this module's header) — every value
        // is 0, which the mesh-fill shader treats as "dry" everywhere.
        frame0: zeroFrame,
        frame1: zeroFrame,
        // TASK-2788 — OPAQUE, explicitly. The playback layer's dry-ground sheet
        // is transparent by default now, which is right for a results run where
        // the dry part of the domain is just context. It is exactly wrong here:
        // this preview is 100% dry by construction (see the zero frames above),
        // so that sheet IS the whole picture. At the default this layer would
        // render nothing but its wireframe, and nothing could put the fill back
        // — the Background opacity slider dispatches against the playback run's
        // own layer id, and this preview is a different layer with no bar.
        backgroundOpacity: 1
    };
}

/**
 * Convenience one-shot: run id -> ready-to-dispatch layer options.
 * @param {number|string} runId
 * @param {typeof fetch} [fetchImpl]
 * @param {{id?:string, title?:string}} [opts]
 * @returns {Promise<object>}
 */
export async function loadBuiltMeshLayerOptions(runId, fetchImpl = defaultFetch, opts = {}) {
    const decoded = await fetchBuiltMeshBinary(runId, fetchImpl);
    return buildBuiltMeshLayerOptions(decoded, opts);
}

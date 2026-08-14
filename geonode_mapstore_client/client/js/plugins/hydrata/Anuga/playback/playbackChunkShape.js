/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackChunkShape — TASK-2724 (W1.3, epic 2706).
 *
 * The store's OWN time-chunk length, read from its metadata. Never a
 * constant, never a default.
 *
 * WHY THIS FILE EXISTS. Until TASK-2724 the playback client pinned its
 * time-chunk length to a module constant in playbackEpics, and defaulted the
 * same number in loadPlaybackFrame's own signature, because every store the
 * exporter had ever written used ten. That is a plausible constant standing in
 * for a fact the store already knows — and it fails in the worst way this
 * product can fail. Against a store chunked at any other length, a client that
 * assumes 10 computes `chunkIndex = floor(t/10)` and `rowInChunk = t % 10`:
 * it fetches a DIFFERENT chunk and slices a DIFFERENT row out of it. There
 * is no exception, no 404, no NaN — just a fully-formed, plausible flood
 * surface for the wrong timestep, on a map an engineer will believe.
 * (Proof, against the two real run-1328 fixtures: at timestep 28 both stores
 * hold 6128 at node 616089; a chunk-length-10 client reading the chunk-1
 * store lands in `depth/c/2/0`, which holds timestep 2 — 1889.)
 *
 * So: read it, and REFUSE the store if it is not there. A store that does
 * not declare its own chunk grid is a store we cannot index into, and
 * "assume 10" is exactly the assumption that armed the landmine.
 *
 * The value comes from each array's `chunk_grid.configuration.chunk_shape[0]`
 * — a SIBLING of `attributes`, which is why the manifest's `quantization`
 * block (`attributes` verbatim, schema §3) never carried it. The backend
 * folds it into `manifest.chunk_shapes` (Run.build_playback_manifest,
 * TASK-2724) rather than the FE making a second round-trip per array.
 */

/**
 * The three quantized per-timestep arrays. Shared with playbackEpics so the
 * "which arrays must agree" list and the "which arrays get fetched" list can
 * never drift apart.
 */
export const QUANTITY_ARRAYS = ['depth', 'x_velocity', 'y_velocity'];

/**
 * The one definition of "a chunk length we can index with": a finite positive
 * integer. Shared by every guard in the playback chain (loadPlaybackFrame's
 * argument check, playbackController.timestepToChunkIndex's pre-manifest
 * guard, and resolveChunkLengthT below) so they cannot drift into disagreeing
 * about what counts as usable.
 * @param {*} value
 * @returns {boolean}
 */
export function isUsableChunkLength(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 1;
}

/**
 * One dimension of each quantity array's declared chunk shape.
 *
 * The chunk grid is [chunk_length_t, node_extent], and the client has to stop
 * trusting BOTH: TASK-2724 did dim 0, TASK-2729 did dim 1. They are the same
 * read with a different index, so they are the same function — keeping them
 * as one is what stops the two guards drifting into disagreeing about what a
 * declared value even is.
 *
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @param {number} dim 0 = timesteps per chunk, 1 = nodes per chunk
 * @returns {object} {arrayName: number|undefined} — undefined where the store
 *          declared nothing usable
 */
function readChunkDimByArray(manifest, dim) {
    const shapes = (manifest && manifest.chunk_shapes) || {};
    const values = {};
    QUANTITY_ARRAYS.forEach((name) => {
        const shape = shapes[name];
        const value = Array.isArray(shape) ? shape[dim] : undefined;
        values[name] = isUsableChunkLength(value) ? value : undefined;
    });
    return values;
}

/**
 * The quantity arrays whose declared value contradicts `reference`, and a
 * ready-to-print rendering of them. An UNDECLARED value is never a
 * disagreement — every guard here has to pass stores that declare nothing,
 * because that is what the stores we already serve look like.
 *
 * @param {object} declared {arrayName: number|undefined}
 * @param {number} reference the number they must all match
 * @returns {{names: string[], detail: string}}
 */
function disagreementWith(declared, reference) {
    const names = QUANTITY_ARRAYS.filter(
        (name) => declared[name] !== undefined && declared[name] !== reference
    );
    return {names, detail: names.map((name) => `${name}=${declared[name]}`).join(', ')};
}

/**
 * Per-array time-chunk length as the STORE declares it, for diagnostics and
 * for the cross-quantity agreement check.
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @returns {object} {arrayName: number|undefined} — undefined where the store
 *          declared nothing usable
 */
export function readChunkLengthsByArray(manifest) {
    return readChunkDimByArray(manifest, 0);
}

/**
 * Per-array NODE EXTENT as the store declares it — dim 1 of the chunk grid.
 *
 * TASK-2729. Deliberately the dim-1 mirror of readChunkLengthsByArray above,
 * and deliberately PER ARRAY rather than a single number: depth, x_velocity
 * and y_velocity are separate zarr arrays with independent chunk grids, so
 * "the store's node extent" is only meaningful once they are shown to agree.
 * playbackMemoryPolicy.readNodeCount takes the FIRST usable one, which is fine
 * for sizing a cache and is NOT fine for a guard — a store where only
 * y_velocity is node-chunked would sail straight past it.
 *
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @returns {object} {arrayName: number|undefined} — undefined where the store
 *          declared no usable extent (a 1-D chunk_shape, or a junk value)
 */
export function readNodeExtentsByArray(manifest) {
    return readChunkDimByArray(manifest, 1);
}

/**
 * Refuse a store whose declared chunk node extent disagrees with the node
 * count the mesh actually has — TASK-2729, the dim-1 twin of TASK-2724.
 *
 * `chunk_shapes[q][1]` is the chunk's node EXTENT, not the array's node count.
 * It equals the node count on every store written so far only because the
 * exporter writes a SINGLE node chunk (run_anuga/playback_store.py,
 * `t_chunks = (CHUNK_LENGTH_T, n_node)`). That is precisely the "every store
 * we have ever written does X" invariant TASK-2724 exists to stop trusting,
 * one dimension over.
 *
 * WHY THIS IS WORSE THAN THE DIM-0 CASE, and therefore worth a hard refusal:
 * loadPlaybackFrame slices with `start = rowInChunk * nNode` where nNode is
 * the MESH's count. Against a chunk laid out in Nc-wide rows with Nc < nNode,
 * dequantizeRow's `start + length > storedArray.length` bounds check does not
 * fire for the low rows, so the call RESOLVES and returns a full-length,
 * finite, entirely plausible flood surface welded together from two different
 * timesteps. A wrong chunk length at least sometimes throws. This never does.
 *
 * ABSENCE IS NOT DISAGREEMENT. A store that declares no usable extent is
 * passed, not refused: 1-D chunk_shapes are legal and refusing them would
 * refuse stores we already serve. Only a declared-and-different extent stops
 * playback.
 *
 * @param {object} manifest
 * @param {number} meshNodeCount mesh.nodeX.length — the store's REAL node
 *        count (node_x is written single-chunk, `chunks=(n_node,)`)
 * @returns {number} meshNodeCount, so a caller can use this inline
 * @throws {Error} naming both numbers and every array that disagrees
 */
export function assertNodeExtentMatchesMesh(manifest, meshNodeCount) {
    const {names, detail} = disagreementWith(readNodeExtentsByArray(manifest), meshNodeCount);
    if (names.length) {
        throw new Error(
            `Playback store declares a chunk node extent of ${detail}, but the mesh it ` +
            `shipped has ${meshNodeCount} nodes. Refusing to play it: a frame is sliced at ` +
            `rowInChunk * ${meshNodeCount} against a chunk laid out in narrower rows, which ` +
            'does not fail — it returns a plausible surface stitched from two timesteps ' +
            '(TASK-2729).'
        );
    }
    return meshNodeCount;
}

/**
 * The manifest-time half of the same guard — TASK-2729 arm 2.
 *
 * PRESENCE-GATED, and that gate is the whole point. `schema_metadata.n_node`
 * has NEVER been written by the exporter (its group_attrs carry no such key),
 * so it is absent on every store in existence including run 1328's. A
 * fail-loud-on-absence check here would refuse the entire product. Once
 * TASK-2719 starts declaring it, this arm catches the disagreement at manifest
 * time — before the ~100 s mesh download — instead of after it.
 *
 * @param {object} manifest
 * @returns {number|undefined} the declared n_node, or undefined when the store
 *          declares none (the normal case today)
 * @throws {Error} only when n_node is declared AND an array's chunk node
 *         extent contradicts it
 */
export function assertDeclaredNodeCountAgrees(manifest) {
    const declared = ((manifest && manifest.schema_metadata) || {}).n_node;
    if (isUsableChunkLength(declared)) {
        const {names, detail} = disagreementWith(readNodeExtentsByArray(manifest), declared);
        if (names.length) {
            throw new Error(
                `Playback store's own metadata contradicts its chunk grid: schema_metadata.n_node ` +
                `is ${declared} but the chunk node extent is ${detail}. Refusing to play it — the ` +
                'store cannot be read consistently, and guessing which number is right renders a ' +
                'plausible surface stitched from two timesteps (TASK-2729).'
            );
        }
    }
    // undefined = "this store declares no n_node", the normal case today.
    return isUsableChunkLength(declared) ? declared : undefined;
}

/**
 * The one time-chunk length this store plays at.
 *
 * AC5 (cross-quantity safety) — depth / x_velocity / y_velocity are separate
 * zarr arrays and could in principle disagree. This REFUSES such a store
 * rather than tracking a length per array, because a single chunk index is
 * load-bearing across the whole playback data plane and a per-array length
 * would make it meaningless: `loadPlaybackFrame` fetches one `[chunkIndex, 0]`
 * for all three arrays and slices the SAME `rowInChunk` out of each to build
 * one frame; the controller's `bufferedChunks` / `totalChunks` /
 * `requiredChunkIndices` are all single-valued per chunk index ("chunk 5 is
 * buffered" has no meaning if chunk 5 spans different timesteps per
 * quantity). Supporting divergence would mean restructuring frame assembly
 * for a store the exporter has never written — so the honest move is to say
 * so out loud and stop, not to half-support it.
 *
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @returns {number} the store's time-chunk length (timesteps per chunk)
 * @throws {Error} if the store does not declare it, or the quantity arrays
 *         disagree — never falls back to a default
 */
export function resolveChunkLengthT(manifest) {
    const lengths = readChunkLengthsByArray(manifest);
    const missing = QUANTITY_ARRAYS.filter((name) => lengths[name] === undefined);
    if (missing.length) {
        throw new Error(
            `Playback store does not declare a time-chunk length for ${missing.join(', ')} ` +
            '(manifest.chunk_shapes[<array>][0], from the store\'s own ' +
            'chunk_grid.configuration.chunk_shape). Refusing to play it: guessing the chunk ' +
            'length renders the wrong timestep rather than failing (TASK-2724).'
        );
    }
    const distinct = QUANTITY_ARRAYS
        .map((name) => lengths[name])
        .filter((value, index, all) => all.indexOf(value) === index);
    if (distinct.length > 1) {
        const detail = QUANTITY_ARRAYS.map((name) => `${name}=${lengths[name]}`).join(', ');
        throw new Error(
            `Playback store's quantity arrays disagree on time-chunk length (${detail}). ` +
            'Refusing to play it: one frame is assembled from the same chunk index and row ' +
            'across all three arrays, so a per-array chunk grid would mix timesteps ' +
            '(TASK-2724).'
        );
    }
    return distinct[0];
}

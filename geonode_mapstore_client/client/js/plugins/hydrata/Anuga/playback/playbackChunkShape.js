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
 * Per-array time-chunk length as the STORE declares it, for diagnostics and
 * for the cross-quantity agreement check.
 * @param {object} manifest as returned by fetchPlaybackManifest
 * @returns {object} {arrayName: number|undefined} — undefined where the store
 *          declared nothing usable
 */
export function readChunkLengthsByArray(manifest) {
    const shapes = (manifest && manifest.chunk_shapes) || {};
    const lengths = {};
    QUANTITY_ARRAYS.forEach((name) => {
        const shape = shapes[name];
        const t = Array.isArray(shape) ? shape[0] : undefined;
        lengths[name] = isUsableChunkLength(t) ? t : undefined;
    });
    return lengths;
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

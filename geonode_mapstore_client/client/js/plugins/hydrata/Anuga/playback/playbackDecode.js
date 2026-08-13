/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackDecode — pure browser-side decode/dequantize primitives for the
 * TASK-2622/2623 (epic 2618) playback store (Zarr v3, gzip+bytes codec chain,
 * chunk_key_encoding {name:'default', separator:'/'}).
 *
 * No fetch/cache/network concerns live here (see playbackChunkFetcher.js) —
 * every export is a pure function over ArrayBuffers/TypedArrays so it is
 * trivially karma-testable headlessly against byte fixtures (TASK-2625, W2.1).
 *
 * On-disk contract (schema doc `docs/reports/2026-08-04-task-2619-playback-
 * store-schema.html`, v1, mirrored by run_anuga/playback_store.py):
 *   - every array's codec chain is [BytesCodec(endian), GzipCodec] — i.e. the
 *     object bytes fetched from S3/HTTP are a gzip stream; decompressing it
 *     yields the array's raw (possibly multi-dimensional, C-order) bytes in
 *     the codec's declared endianness (schema always writes 'little', but
 *     each array's zarr.json/manifest quantization block carries its own
 *     'byteorder' attr — this module honours whatever it is told, never
 *     hardcodes 'little', so a future big-endian store decodes correctly too).
 *   - quantized arrays (depth, x_velocity, y_velocity) are uint16 with
 *     `scale`/`offset` attrs: physical = offset + stored * scale.
 */

// name -> {bytesPerElement, TypedArrayCtor, read(dataView, byteOffset, littleEndian)}
const DTYPE_READERS = {
    uint16: {
        bytesPerElement: 2,
        TypedArrayCtor: Uint16Array,
        read: (dv, off, little) => dv.getUint16(off, little)
    },
    int32: {
        bytesPerElement: 4,
        TypedArrayCtor: Int32Array,
        read: (dv, off, little) => dv.getInt32(off, little)
    },
    float32: {
        bytesPerElement: 4,
        TypedArrayCtor: Float32Array,
        read: (dv, off, little) => dv.getFloat32(off, little)
    },
    float64: {
        bytesPerElement: 8,
        TypedArrayCtor: Float64Array,
        read: (dv, off, little) => dv.getFloat64(off, little)
    }
};

export const SUPPORTED_DTYPES = Object.keys(DTYPE_READERS);

/**
 * This host's own byte order, measured (never assumed). TASK-2708 (W1.2,
 * epic 2706): decodeTypedArray's DataView loop is correct for every
 * host/store endianness combination, but it is also a per-element JS loop —
 * at 33,930,750 elements (one run-1328 depth chunk) that loop plus its
 * second full-size allocation was a multi-second main-thread stall. When the
 * store's byte order already MATCHES the host's, the raw buffer is already
 * in the exact layout the typed array wants, so a zero-copy view over it is
 * bit-identical to what the loop would have produced — and costs nothing.
 * The loop stays as the correct general path for the mismatched case.
 */
export const HOST_IS_LITTLE_ENDIAN = (() => {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 1, true);
    return new Uint8Array(probe)[0] === 1;
})();

/**
 * True when this browser can gunzip via the Streams API (Chrome 105+, all
 * evergreen browsers as of the 2618 epic). The fetcher checks this once and
 * fails loudly rather than silently mis-decoding.
 */
export function isGunzipSupported() {
    return typeof DecompressionStream !== 'undefined';
}

/**
 * Gzip-decompress an ArrayBuffer (a fetched chunk object's raw bytes) into
 * its raw (bytes-codec) ArrayBuffer, via the native DecompressionStream.
 * @param {ArrayBuffer} compressedBuffer
 * @returns {Promise<ArrayBuffer>}
 */
export function gunzip(compressedBuffer) {
    if (!isGunzipSupported()) {
        return Promise.reject(new Error(
            'playbackDecode.gunzip: DecompressionStream is not available in this browser'
        ));
    }
    const stream = new Blob([compressedBuffer]).stream()
        .pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
}

/**
 * Decode a raw (already gunzipped) ArrayBuffer into a typed array, honouring
 * an explicit byteorder ('little' | 'big', default 'little' — matches the
 * schema's group/array attrs).
 *
 * COPY-VS-ALIAS CONTRACT (TASK-2731) — the two paths differ in OWNERSHIP, not
 * in the values they produce:
 *   (a) when the store's byteorder MATCHES this host's (HOST_IS_LITTLE_ENDIAN,
 *       measured above), the raw bytes are already in the layout the typed
 *       array wants, so the return value is a ZERO-COPY VIEW that ALIASES
 *       rawBuffer: `decodeTypedArray(raw, ...).buffer === raw`. This is the
 *       branch taken on every production decode today (the schema writes
 *       'little' and every browser we ship to is little-endian), added by
 *       TASK-2708 (W1, epic 2706) to kill a multi-second main-thread stall.
 *   (b) otherwise the return value is a FRESH COPY, read element-by-element
 *       via DataView.getX(offset, littleEndian) — the only construct that is
 *       correct regardless of host/store endianness, which is what keeps the
 *       "big-endian aware" requirement (TASK-2625 AC) true. rawBuffer is left
 *       untouched and the result does NOT alias it.
 * Both paths are value-identical (pinned by playbackMemoryPolicy-test.js, 'the
 * zero-copy fast path is bit-identical to the DataView loop, both byte
 * orders'); the identity difference is pinned by playbackDecode-test.js,
 * 'documents its copy-vs-alias contract: ...'.
 *
 * WHY THE ALIAS IS SAFE TODAY — an invariant of the CALLERS, not of this
 * function. The only two in-tree callers are decodeCompressedChunk and
 * decodeChunk, both defined later in this module: each hands over a buffer it
 * created itself with `await gunzip(...)` in the same call and never reads it
 * again. That still holds off-thread — playbackDecode.worker.js and
 * playbackDecodeWorker.js reach this function only through
 * decodeCompressedChunk, so the gunzip happens inside the worker too, and the
 * aliased `result.buffer` is then TRANSFERRED back to the main thread, which
 * detaches the worker's own reference. A NEW caller inherits that duty; this
 * function does not enforce it.
 *
 * @param {ArrayBuffer} rawBuffer OWNERSHIP IS HANDED OVER TO THIS CALL. The
 * caller must not retain, reuse or mutate rawBuffer afterwards: on path (a)
 * the returned array aliases it, so a later write through either one silently
 * mutates live decoded playback data seen by the other. If you need to keep
 * the bytes, pass a copy (`raw.slice(0)`) and hand THAT over.
 * @param {string} dtype one of SUPPORTED_DTYPES
 * @param {string} [byteorder='little']
 * @returns {Uint16Array|Int32Array|Float32Array|Float64Array} a zero-copy view
 * aliasing rawBuffer when byteorder matches the host, else a fresh copy.
 */
export function decodeTypedArray(rawBuffer, dtype, byteorder = 'little') {
    const info = DTYPE_READERS[dtype];
    if (!info) {
        throw new Error(`playbackDecode.decodeTypedArray: unsupported dtype '${dtype}' (expected one of ${SUPPORTED_DTYPES.join(', ')})`);
    }
    if (byteorder !== 'little' && byteorder !== 'big') {
        throw new Error(`playbackDecode.decodeTypedArray: unsupported byteorder '${byteorder}' (expected 'little' or 'big')`);
    }
    const littleEndian = byteorder === 'little';
    const { bytesPerElement, TypedArrayCtor, read } = info;
    if (rawBuffer.byteLength % bytesPerElement !== 0) {
        throw new Error(`playbackDecode.decodeTypedArray: buffer length ${rawBuffer.byteLength} is not a multiple of ${bytesPerElement} bytes (dtype '${dtype}')`);
    }
    const n = rawBuffer.byteLength / bytesPerElement;
    // TASK-2708 — see HOST_IS_LITTLE_ENDIAN. Same values, no copy, no loop.
    // Safe because `rawBuffer` is always a freshly-gunzipped buffer owned by
    // this call (gunzip() -> new Response(...).arrayBuffer(), or a transferred
    // buffer inside the decode worker), never a view onto shared memory.
    if (littleEndian === HOST_IS_LITTLE_ENDIAN) {
        return new TypedArrayCtor(rawBuffer);
    }
    const dv = new DataView(rawBuffer);
    const out = new TypedArrayCtor(n);
    for (let i = 0; i < n; i++) {
        out[i] = read(dv, i * bytesPerElement, littleEndian);
    }
    return out;
}

/**
 * Dequantize a uint16-stored array back to physical units:
 * `physical = offset + stored * scale` (schema §3 "Quantization contract",
 * run_anuga.playback_store.quantize's inverse). Matches numpy's
 * `offset + stored.astype(float32) * scale` bit-for-bit modulo float32
 * rounding (this returns a Float32Array for the same reason).
 * @param {Uint16Array} storedArray
 * @param {{scale: number, offset: number}} quantization
 * @returns {Float32Array}
 */
export function dequantize(storedArray, quantization) {
    const { scale, offset } = quantization || {};
    if (typeof scale !== 'number' || typeof offset !== 'number') {
        throw new Error('playbackDecode.dequantize: quantization must carry numeric {scale, offset}');
    }
    const out = new Float32Array(storedArray.length);
    for (let i = 0; i < storedArray.length; i++) {
        out[i] = offset + storedArray[i] * scale;
    }
    return out;
}

/**
 * Dequantize ONE ROW of a stored chunk — the TASK-2708 (W1.2, epic 2706)
 * residency primitive. The cache now holds the chunk in its stored uint16
 * form (2 B/element); a frame needs exactly one timestep's row of it
 * (`nNode` elements), so this is the only place a Float32Array the size of
 * the render surface is ever created.
 *
 * Identical arithmetic to dequantize() above, deliberately NOT implemented by
 * calling `dequantize(stored.subarray(...))` — a subarray would keep the whole
 * chunk's buffer alive through the slice, which is exactly the retention this
 * task exists to remove.
 *
 * A row that runs past the end of the stored array is a programming error
 * (wrong chunk length or wrong nNode), not a value to silently zero-fill:
 * that is the TASK-2724 failure mode — a plausible surface for the wrong
 * timestep — so it throws.
 *
 * @param {Uint16Array} storedArray a whole decoded chunk, still quantized
 * @param {number} start index of the row's first element (rowInChunk * nNode)
 * @param {number} length nNode
 * @param {{scale: number, offset: number}} quantization
 * @returns {Float32Array} length `length`, in physical units
 */
export function dequantizeRow(storedArray, start, length, quantization) {
    const { scale, offset } = quantization || {};
    if (typeof scale !== 'number' || typeof offset !== 'number') {
        throw new Error('playbackDecode.dequantizeRow: quantization must carry numeric {scale, offset}');
    }
    if (!(start >= 0) || !(length > 0) || start + length > storedArray.length) {
        throw new Error(
            `playbackDecode.dequantizeRow: row [${start}, ${start + length}) is outside the ` +
            `decoded chunk (${storedArray.length} elements). Refusing to read past it: a short ` +
            'row renders a plausible surface for the wrong timestep rather than failing.'
        );
    }
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        out[i] = offset + storedArray[start + i] * scale;
    }
    return out;
}

/**
 * gunzip -> typed array, with NO dequantization — the exact work TASK-2708
 * moves off the main thread (playbackDecode.worker.js calls THIS function, so
 * the worker and the same-thread fallback can never drift apart).
 *
 * Quantized arrays deliberately come back in their stored uint16 form: the
 * cache holds stored bytes and dequantizeRow() converts one frame's row at
 * slice time. Doing it here would (a) double the cache's footprint and (b)
 * make a second call on an already-decoded chunk apply `scale` twice.
 *
 * @param {ArrayBuffer} compressedBuffer
 * @param {{dtype: string, byteorder?: string}} opts
 * @returns {Promise<Uint16Array|Int32Array|Float32Array|Float64Array>}
 */
export async function decodeCompressedChunk(compressedBuffer, opts) {
    const { dtype, byteorder = 'little' } = opts || {};
    const raw = await gunzip(compressedBuffer);
    return decodeTypedArray(raw, dtype, byteorder);
}

/**
 * The zarr v3 "default" chunk-key-encoding path for one array's chunk, e.g.
 * `depth/c/0/0` (2D, time-chunked) or `node_x/c/0` (1D, single chunk) — see
 * run_anuga.playback_store._write_zarr_v3_store's
 * chunk_key_encoding={name:'default', configuration:{separator:'/'}}.
 * @param {string} arrayName
 * @param {number[]} chunkIndices one index per array dimension
 * @returns {string}
 */
export function chunkKey(arrayName, chunkIndices) {
    if (!Array.isArray(chunkIndices) || chunkIndices.length === 0) {
        throw new Error('playbackDecode.chunkKey: chunkIndices must be a non-empty array');
    }
    return [arrayName, 'c', ...chunkIndices].join('/');
}

/**
 * Full decode pipeline for one already-fetched (still-compressed) chunk:
 * gunzip -> typed array -> (optional) dequantize. Kept as one entry point so
 * the fetcher (playbackChunkFetcher.js) has a single seam to call per chunk.
 * @param {ArrayBuffer} compressedBuffer
 * @param {{dtype: string, byteorder?: string, quantization?: {scale:number, offset:number}}} opts
 * @returns {Promise<Uint16Array|Int32Array|Float32Array|Float64Array>}
 */
export async function decodeChunk(compressedBuffer, opts) {
    const { dtype, byteorder = 'little', quantization } = opts || {};
    const raw = await gunzip(compressedBuffer);
    const typed = decodeTypedArray(raw, dtype, byteorder);
    return quantization ? dequantize(typed, quantization) : typed;
}

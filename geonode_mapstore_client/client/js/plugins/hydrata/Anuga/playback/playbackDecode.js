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
 * schema's group/array attrs). Always reads via DataView rather than handing
 * back a zero-copy view over the buffer, because a zero-copy Uint16Array/etc
 * view is only byte-order-correct on a little-endian host reading a
 * little-endian buffer — DataView.getX(offset, littleEndian) is the only
 * construct that is correct regardless of host/store endianness, which is
 * the "big-endian aware" requirement (TASK-2625 AC).
 * @param {ArrayBuffer} rawBuffer
 * @param {string} dtype one of SUPPORTED_DTYPES
 * @param {string} [byteorder='little']
 * @returns {Uint16Array|Int32Array|Float32Array|Float64Array}
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

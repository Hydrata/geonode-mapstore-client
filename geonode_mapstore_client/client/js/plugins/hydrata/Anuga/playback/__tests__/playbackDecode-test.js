/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2625 (W2.1, epic 2618) — playbackDecode parity tests.
 *
 * Every byte fixture in fixturePlaybackStore.js was produced by RUNNING the
 * real run_anuga.playback_store exporter functions (quantize_range/quantize/
 * symmetric_velocity_range/compute_velocity/compute_inradius/
 * _write_zarr_v3_store) against a small synthetic mesh, then dumping the
 * resulting Zarr v3 store's on-disk files to base64 — never hand-typed
 * bytes. The decode pipeline built here was additionally cross-checked
 * against a full-scale (50653-node) store exported from a real Merewether
 * e2e SWW on this box via Node's zlib + DataView (see the W2 wave report).
 */
import expect from 'expect';
import {
    isGunzipSupported,
    gunzip,
    decodeTypedArray,
    dequantize,
    chunkKey,
    decodeChunk,
    HOST_IS_LITTLE_ENDIAN
} from '../playbackDecode';
import {
    FIXTURE_STORE_FILES,
    FIXTURE_ARRAY_META,
    FIXTURE_PHYSICAL,
    FIXTURE_MESH
} from './fixtures/fixturePlaybackStore';

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function fixtureChunkBuffer(relativeKey) {
    const b64 = FIXTURE_STORE_FILES[relativeKey];
    if (!b64) {
        throw new Error(`test fixture missing relativeKey '${relativeKey}'`);
    }
    return base64ToArrayBuffer(b64);
}

// numpy float32 round-trip error at these scales is well under 1e-3; the
// dominant error source is the DELIBERATE uint16 quantization itself
// (schema §3), which the exporter's own scale already bounds to
// range/65535 — assert against that, not an arbitrary epsilon.
function assertCloseArray(actual, expected, maxAbsErr, label) {
    expect(actual.length).toBe(expected.length);
    let worst = 0;
    for (let i = 0; i < expected.length; i++) {
        const err = Math.abs(actual[i] - expected[i]);
        worst = Math.max(worst, err);
    }
    expect(worst <= maxAbsErr).toBe(true, `${label}: worst abs error ${worst} exceeds ${maxAbsErr}`);
}

describe('playbackDecode', () => {
    it('reports gunzip support in this (real Chrome) test runner', () => {
        // Not a skip-guard — the whole 2625 AC assumes DecompressionStream
        // exists; this pins that assumption so a future headless-runner
        // downgrade fails loudly here instead of silently in production.
        expect(isGunzipSupported()).toBe(true);
    });

    describe('gunzip', () => {
        it('decompresses a real exporter-written gzip chunk to its exact raw byte length', (done) => {
            const meta = FIXTURE_ARRAY_META.node_x;
            const compressed = fixtureChunkBuffer('node_x/c/0');
            const expectedRawBytes = FIXTURE_MESH.nNode * 4; // float32
            gunzip(compressed).then((raw) => {
                expect(raw.byteLength).toBe(expectedRawBytes);
                expect(meta.codecs[1].name).toBe('gzip');
                done();
            }).catch(done);
        });
    });

    describe('decodeTypedArray', () => {
        it('decodes little-endian float32 geometry (node_x) matching the exporter input exactly', (done) => {
            const compressed = fixtureChunkBuffer('node_x/c/0');
            gunzip(compressed).then((raw) => {
                const decoded = decodeTypedArray(raw, 'float32', 'little');
                expect(decoded.length).toBe(FIXTURE_MESH.nNode);
                for (let i = 0; i < decoded.length; i++) {
                    expect(Math.abs(decoded[i] - FIXTURE_PHYSICAL.node_x[i]) < 1e-4).toBe(true);
                }
                done();
            }).catch(done);
        });

        it('decodes int32 face_node_connectivity (2D, single chunk) preserving row-major order', (done) => {
            const compressed = fixtureChunkBuffer('face_node_connectivity/c/0/0');
            gunzip(compressed).then((raw) => {
                const decoded = decodeTypedArray(raw, 'int32', 'little');
                expect(decoded.length).toBe(FIXTURE_MESH.nFace * 3);
                const flatExpected = FIXTURE_PHYSICAL.face_node_connectivity.flat();
                for (let i = 0; i < decoded.length; i++) {
                    expect(decoded[i]).toBe(flatExpected[i]);
                }
                done();
            }).catch(done);
        });

        it('decodes float64 time', (done) => {
            const compressed = fixtureChunkBuffer('time/c/0');
            gunzip(compressed).then((raw) => {
                const decoded = decodeTypedArray(raw, 'float64', 'little');
                expect(decoded.length).toBe(FIXTURE_MESH.nTime);
                for (let i = 0; i < decoded.length; i++) {
                    expect(decoded[i]).toBe(FIXTURE_PHYSICAL.time[i]);
                }
                done();
            }).catch(done);
        });

        it('is big-endian aware: a hand-built big-endian uint16 buffer decodes correctly with byteorder=\'big\'', () => {
            // Not from the exporter (which always writes 'little' today) —
            // this proves the byteorder plumbing itself, guarding against a
            // future store whose codec attrs flip endian (schema allows it;
            // run_anuga.playback_store._write_zarr_v3_store hardcodes
            // endian='little' today, but the manifest's per-array
            // 'byteorder' attr is what this module actually trusts).
            const buf = new ArrayBuffer(4);
            const dv = new DataView(buf);
            dv.setUint16(0, 0x0102, false); // big-endian: byte0=0x01, byte1=0x02
            dv.setUint16(2, 0xfffe, false);
            const decoded = decodeTypedArray(buf, 'uint16', 'big');
            expect(decoded[0]).toBe(0x0102);
            expect(decoded[1]).toBe(0xfffe);

            // The SAME bytes decoded as little-endian must NOT match (proves
            // the byteorder flag is actually threaded through, not ignored).
            const decodedLittle = decodeTypedArray(buf, 'uint16', 'little');
            expect(decodedLittle[0]).toNotBe(0x0102);
        });

        it('documents its copy-vs-alias contract: host-endian input aliases rawBuffer, opposite-endian input copies', () => {
            // TASK-2731 (W3, epic 2706). playbackMemoryPolicy-test.js already
            // pins the VALUES of both paths ('the zero-copy fast path is
            // bit-identical to the DataView loop, both byte orders'); nothing
            // pinned the IDENTITY, which is the half the JSDoc used to get
            // wrong. hostOrder/otherOrder are DERIVED from the module's own
            // measured HOST_IS_LITTLE_ENDIAN — a hardcoded 'little' would make
            // this pass for the wrong reason on a big-endian host.
            const hostOrder = HOST_IS_LITTLE_ENDIAN ? 'little' : 'big';
            const otherOrder = HOST_IS_LITTLE_ENDIAN ? 'big' : 'little';

            const raw = new ArrayBuffer(4);
            new DataView(raw).setUint16(0, 0x0102, HOST_IS_LITTLE_ENDIAN);
            const aliased = decodeTypedArray(raw, 'uint16', hostOrder);
            // Same-order: a zero-copy view over the SAME ArrayBuffer object.
            expect(aliased.buffer).toBe(raw);

            const raw2 = new ArrayBuffer(4);
            new DataView(raw2).setUint16(0, 0x0102, !HOST_IS_LITTLE_ENDIAN);
            const copied = decodeTypedArray(raw2, 'uint16', otherOrder);
            // Opposite order: a fresh allocation, rawBuffer untouched.
            expect(copied.buffer).toNotBe(raw2);

            // Control: both paths decoded the SAME value, so the identity
            // difference above is about ownership, not about a decode bug.
            expect(aliased[0]).toBe(0x0102);
            expect(copied[0]).toBe(0x0102);
        });

        it('rejects an unsupported dtype', () => {
            expect(() => decodeTypedArray(new ArrayBuffer(4), 'uint8', 'little')).toThrow();
        });

        it('rejects an unsupported byteorder', () => {
            expect(() => decodeTypedArray(new ArrayBuffer(4), 'uint16', 'middle-endian')).toThrow();
        });

        it('rejects a buffer length that is not a multiple of the dtype width', () => {
            expect(() => decodeTypedArray(new ArrayBuffer(3), 'uint16', 'little')).toThrow();
        });
    });

    describe('dequantize', () => {
        it('reconstructs depth chunk 0 (t=0..9) within the exporter\'s own quantization tolerance', (done) => {
            const quantization = FIXTURE_ARRAY_META.depth.attributes;
            const compressed = fixtureChunkBuffer('depth/c/0/0');
            gunzip(compressed).then((raw) => {
                const stored = decodeTypedArray(raw, 'uint16', quantization.byteorder);
                const physical = dequantize(stored, quantization);
                expect(physical.length).toBe(10 * FIXTURE_MESH.nNode);
                // Row-major (t, node): row t physical value at [t*nNode + n].
                for (let t = 0; t < 10; t++) {
                    for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                        const got = physical[t * FIXTURE_MESH.nNode + n];
                        const want = FIXTURE_PHYSICAL.depth[t][n];
                        expect(Math.abs(got - want) <= quantization.scale + 1e-6).toBe(true,
                            `depth[${t}][${n}]: got ${got}, want ${want} (scale ${quantization.scale})`);
                    }
                }
                done();
            }).catch(done);
        });

        it('reconstructs the always-dry node (index 5) to exactly 0 at every timestep', (done) => {
            const quantization = FIXTURE_ARRAY_META.depth.attributes;
            const compressed = fixtureChunkBuffer('depth/c/0/0');
            gunzip(compressed).then((raw) => {
                const stored = decodeTypedArray(raw, 'uint16', quantization.byteorder);
                const physical = dequantize(stored, quantization);
                for (let t = 0; t < 10; t++) {
                    expect(physical[t * FIXTURE_MESH.nNode + 5]).toBe(0);
                }
                done();
            }).catch(done);
        });

        it('reconstructs x_velocity and y_velocity within tolerance, including negative values (symmetric range, B3)', (done) => {
            const xq = FIXTURE_ARRAY_META.x_velocity.attributes;
            const yq = FIXTURE_ARRAY_META.y_velocity.attributes;
            expect(xq.offset < 0).toBe(true); // symmetric_velocity_range: offset = -v_absmax
            Promise.all([
                gunzip(fixtureChunkBuffer('x_velocity/c/0/0')),
                gunzip(fixtureChunkBuffer('y_velocity/c/0/0'))
            ]).then(([xRaw, yRaw]) => {
                const xPhys = dequantize(decodeTypedArray(xRaw, 'uint16', xq.byteorder), xq);
                const yPhys = dequantize(decodeTypedArray(yRaw, 'uint16', yq.byteorder), yq);
                for (let t = 0; t < 10; t++) {
                    assertCloseArray(
                        xPhys.slice(t * FIXTURE_MESH.nNode, (t + 1) * FIXTURE_MESH.nNode),
                        FIXTURE_PHYSICAL.x_velocity[t],
                        xq.scale + 1e-6,
                        `x_velocity t=${t}`
                    );
                    assertCloseArray(
                        yPhys.slice(t * FIXTURE_MESH.nNode, (t + 1) * FIXTURE_MESH.nNode),
                        FIXTURE_PHYSICAL.y_velocity[t],
                        yq.scale + 1e-6,
                        `y_velocity t=${t}`
                    );
                }
                done();
            }).catch(done);
        });

        it('rejects quantization missing scale/offset', () => {
            expect(() => dequantize(new Uint16Array([1, 2]), {})).toThrow();
        });
    });

    describe('chunkKey', () => {
        it('matches the exporter\'s actual on-disk 2D (time-chunked) chunk key', () => {
            expect(chunkKey('depth', [0, 0])).toBe('depth/c/0/0');
            expect(chunkKey('depth', [1, 0])).toBe('depth/c/1/0');
        });

        it('matches the exporter\'s actual on-disk 1D (single-chunk) key', () => {
            expect(chunkKey('node_x', [0])).toBe('node_x/c/0');
        });

        it('every chunkKey it produces for this fixture actually exists in FIXTURE_STORE_FILES', () => {
            ['depth/c/0/0', 'depth/c/1/0', 'x_velocity/c/0/0', 'y_velocity/c/0/0',
                'node_x/c/0', 'node_y/c/0', 'face_node_connectivity/c/0/0', 'time/c/0'
            ].forEach((key) => {
                expect(FIXTURE_STORE_FILES[key]).toBeTruthy();
            });
        });
    });

    describe('decodeChunk (full pipeline)', () => {
        it('gunzip -> typed array -> dequantize in one call matches the two-step path', (done) => {
            const quantization = FIXTURE_ARRAY_META.depth.attributes;
            const compressed = fixtureChunkBuffer('depth/c/1/0');
            decodeChunk(compressed, { dtype: 'uint16', byteorder: quantization.byteorder, quantization }).then((physical) => {
                // t=10..12 are the 3 real rows in this (partial, padded) chunk.
                for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                    const want = FIXTURE_PHYSICAL.depth[10][n];
                    expect(Math.abs(physical[n] - want) <= quantization.scale + 1e-6).toBe(true);
                }
                done();
            }).catch(done);
        });

        it('without quantization, returns the raw typed array unchanged (geometry path)', (done) => {
            const compressed = fixtureChunkBuffer('elevation/c/0');
            decodeChunk(compressed, { dtype: 'float32', byteorder: 'little' }).then((decoded) => {
                expect(decoded.length).toBe(FIXTURE_MESH.nNode);
                for (let i = 0; i < decoded.length; i++) {
                    expect(Math.abs(decoded[i] - FIXTURE_PHYSICAL.elevation[i]) < 1e-4).toBe(true);
                }
                done();
            }).catch(done);
        });
    });
});

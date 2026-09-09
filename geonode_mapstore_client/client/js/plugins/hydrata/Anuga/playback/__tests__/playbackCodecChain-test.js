/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2991 (W3.3, epic 2981) — the codec chain reaches the decoder.
 *
 * THE FAILURE MODE THIS FILE EXISTS FOR. A format_version 3 store's three
 * time-series arrays carry `temporal_delta` in front of bytes+gzip. A client
 * that does not invert it DOES NOT FAIL: the gunzip succeeds, the buffer is
 * exactly the right length, every value is in range, and the renderer draws a
 * field of running differences as depth. No exception, no 404, no console
 * line — the same silent-wrong-water shape TASK-2724's chunk length had, which
 * is why the first spec below asserts the two ACTUAL water values rather than
 * "it throws".
 *
 * Both fixtures are generated, never hand-written:
 * fixturePlaybackStore.js by the real exporter, fixturePlaybackStoreV3.js by
 * deploy/scripts/playback-rig/make_v3_js_fixture.py running the REAL
 * run_anuga.playback_codecs.TemporalDeltaCodec over it. Same mesh, same
 * physical values, same quantization attrs — so "v3 decodes like v2" is an
 * exact array equality, not an approximation.
 */
import expect from 'expect';
import { decodeCompressedChunk } from '../playbackDecode';
import { decodeChunkOffThread, terminatePlaybackDecodeWorker } from '../playbackDecodeWorker';
import { assertCodecsAreSupported, codecChainFor, SUPPORTED_CODEC_NAMES } from '../playbackChunkShape';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST } from './fixtures/fixturePlaybackStore';
import { FIXTURE_STORE_FILES_V3, FIXTURE_MANIFEST_V3 } from './fixtures/fixturePlaybackStoreV3';

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function v2Chunk(key) {
    return base64ToArrayBuffer(FIXTURE_STORE_FILES[key]);
}
function v3Chunk(key) {
    return base64ToArrayBuffer(FIXTURE_STORE_FILES_V3[key]);
}

const NODE_EXTENT = FIXTURE_MANIFEST_V3.chunk_shapes.depth[1];
const CHUNK_LENGTH_T = FIXTURE_MANIFEST_V3.chunk_shapes.depth[0];
const DEPTH_CODECS = FIXTURE_MANIFEST_V3.codecs.depth;

function fixtureFetch(files) {
    return function fetchImpl(url) {
        const b64 = files[url];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
}

describe('TASK-2991 the v3 fixture really is delta-coded', () => {
    it('decoded WITHOUT the chain, a v3 chunk holds different water from its v2 twin', (done) => {
        // This is AC1's RED, kept as a permanent guard: if it ever passes
        // trivially, the "v3 decodes like v2" spec below has become vacuous
        // because the fixture stopped carrying a codec at all.
        Promise.all([
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v3Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' })
        ]).then(([v2, naive]) => {
            expect(v2.length).toBe(naive.length);
            // Row 0 is stored raw by the codec, so it must MATCH — anything
            // else would mean the fixture differs for some other reason.
            for (let i = 0; i < NODE_EXTENT; i++) {
                expect(naive[i]).toBe(v2[i]);
            }
            // Row 1 onward is a difference, so it must NOT.
            const differing = [];
            for (let row = 1; row < CHUNK_LENGTH_T; row++) {
                for (let node = 0; node < NODE_EXTENT; node++) {
                    const i = row * NODE_EXTENT + node;
                    if (naive[i] !== v2[i]) {
                        differing.push({ row, node, naive: naive[i], correct: v2[i] });
                    }
                }
            }
            expect(differing.length > 0).toBe(true);
            done();
        }).catch(done);
    });
});

describe('TASK-2991 decodeCompressedChunk inverts temporal_delta', () => {
    it('AC1: a v3 chunk decoded WITH its chain equals its v2 twin, every row and node', (done) => {
        Promise.all([
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v3Chunk('depth/c/0/0'), {
                dtype: 'uint16', byteorder: 'little',
                codecs: DEPTH_CODECS, nodeExtent: NODE_EXTENT
            })
        ]).then(([v2, v3]) => {
            expect(v3.length).toBe(v2.length);
            for (let i = 0; i < v2.length; i++) {
                expect(v3[i]).toBe(v2[i]);
            }
            done();
        }).catch(done);
    });

    it('AC1: the same holds for x_velocity, whose values are signed around 32767', (done) => {
        Promise.all([
            decodeCompressedChunk(v2Chunk('x_velocity/c/0/0'), { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v3Chunk('x_velocity/c/0/0'), {
                dtype: 'uint16', byteorder: 'little',
                codecs: FIXTURE_MANIFEST_V3.codecs.x_velocity, nodeExtent: NODE_EXTENT
            })
        ]).then(([v2, v3]) => {
            for (let i = 0; i < v2.length; i++) {
                expect(v3[i]).toBe(v2[i]);
            }
            done();
        }).catch(done);
    });

    it('AC4: a v2 chain (bytes+gzip) decodes exactly as before', (done) => {
        Promise.all([
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), {
                dtype: 'uint16', byteorder: 'little',
                codecs: FIXTURE_MANIFEST.codecs ? FIXTURE_MANIFEST.codecs.depth : [
                    { name: 'bytes', configuration: { endian: 'little' } },
                    { name: 'gzip', configuration: { level: 6 } }
                ],
                nodeExtent: NODE_EXTENT
            })
        ]).then(([before, after]) => {
            for (let i = 0; i < before.length; i++) {
                expect(after[i]).toBe(before[i]);
            }
            done();
        }).catch(done);
    });

    it('refuses to invert a delta without a usable node extent rather than guessing', (done) => {
        decodeCompressedChunk(v3Chunk('depth/c/0/0'), {
            dtype: 'uint16', byteorder: 'little', codecs: DEPTH_CODECS
        }).then(() => {
            done(new Error('expected a throw: the row length is not derivable from the buffer'));
        }).catch((error) => {
            expect(/node extent/i.test(error.message)).toBe(true);
            done();
        });
    });
});

describe('TASK-2991 the off-thread and same-thread paths agree', () => {
    afterEach(() => {
        terminatePlaybackDecodeWorker();
    });

    it('AC3: decodeChunkOffThread produces identical numbers to the inline decode', (done) => {
        Promise.all([
            decodeChunkOffThread(v3Chunk('depth/c/0/0'), {
                dtype: 'uint16', byteorder: 'little',
                codecs: DEPTH_CODECS, nodeExtent: NODE_EXTENT, timeoutMs: 20000
            }),
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' })
        ]).then(([offThread, expected]) => {
            expect(offThread.length).toBe(expected.length);
            for (let i = 0; i < expected.length; i++) {
                expect(offThread[i]).toBe(expected[i]);
            }
            done();
        }).catch(done);
    });
});

describe('TASK-2991 the store guard refuses a codec it cannot invert', () => {
    it('AC2: an unknown codec name refuses the store, naming the array and the codec', () => {
        const manifest = {
            ...FIXTURE_MANIFEST_V3,
            codecs: {
                ...FIXTURE_MANIFEST_V3.codecs,
                depth: [{ name: 'zstd', configuration: { level: 3 } },
                    { name: 'bytes', configuration: { endian: 'little' } }]
            }
        };
        let thrown = null;
        try {
            assertCodecsAreSupported(manifest);
        } catch (error) {
            thrown = error;
        }
        expect(thrown === null).toBe(false);
        expect(thrown.message.indexOf('depth') > -1).toBe(true);
        expect(thrown.message.indexOf('zstd') > -1).toBe(true);
    });

    it('passes the v3 fixture, whose every chain is understood', () => {
        expect(assertCodecsAreSupported(FIXTURE_MANIFEST_V3)).toBe(true);
    });

    it('ABSENCE IS NOT DISAGREEMENT: a manifest with no codecs block passes', () => {
        // Every store already on S3 predates TASK-2990's block. Refusing on
        // absence would refuse the entire product.
        expect(assertCodecsAreSupported({ chunk_shapes: {} })).toBe(true);
        expect(assertCodecsAreSupported(FIXTURE_MANIFEST)).toBe(true);
    });

    it('the supported set is exactly what the decoder can actually invert', () => {
        expect(SUPPORTED_CODEC_NAMES.slice().sort()).toEqual(
            ['bytes', 'gzip', 'temporal_delta']);
    });
});

describe('TASK-2991 every fetch path carries the chain, not just the prefetcher', () => {
    it('AC1: fetchAndDecodeChunk decodes a v3 chunk correctly when the CALLER passes no codecs', (done) => {
        // THE DESIGN TEST. loadPlaybackFrame, loadPlaybackMesh and
        // loadPlaybackEnvelope all call fetchAndDecodeChunk with only
        // {dtype, byteorder, quantization}. If the chain had to come from the
        // call site, any one of them forgetting would leave a delta-coded
        // chunk in the SHARED cache and every later reader of that chunk —
        // including the ones that did remember — would render running
        // differences. So the fetcher resolves the chain from its own
        // manifest, and this spec is what proves it.
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST_V3,
            fetchImpl: fixtureFetch(FIXTURE_STORE_FILES_V3)
        });
        Promise.all([
            fetcher.fetchAndDecodeChunk('depth', [0, 0], { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' })
        ]).then(([decoded, expected]) => {
            expect(decoded.length).toBe(expected.length);
            for (let i = 0; i < expected.length; i++) {
                expect(decoded[i]).toBe(expected[i]);
            }
            done();
        }).catch(done);
    });

    it('AC4: a v2 manifest still decodes exactly as before through the same path', (done) => {
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: fixtureFetch(FIXTURE_STORE_FILES)
        });
        Promise.all([
            fetcher.fetchAndDecodeChunk('depth', [0, 0], { dtype: 'uint16', byteorder: 'little' }),
            decodeCompressedChunk(v2Chunk('depth/c/0/0'), { dtype: 'uint16', byteorder: 'little' })
        ]).then(([decoded, expected]) => {
            for (let i = 0; i < expected.length; i++) {
                expect(decoded[i]).toBe(expected[i]);
            }
            done();
        }).catch(done);
    });

    it('codecChainFor reads the store, and answers undefined where it declares nothing', () => {
        expect(codecChainFor(FIXTURE_MANIFEST_V3, 'depth')).toEqual(DEPTH_CODECS);
        expect(codecChainFor(FIXTURE_MANIFEST_V3, 'node_x')).toEqual(
            FIXTURE_MANIFEST_V3.codecs.node_x);
        expect(codecChainFor(FIXTURE_MANIFEST, 'depth')).toBe(undefined);
        expect(codecChainFor({}, 'depth')).toBe(undefined);
    });
});

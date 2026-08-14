/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2708 (W1.2, epic 2706) — the playback memory rework.
 *
 * PROOF 1 (memory budget) and PROOF 3 (correctness) live here, both
 * parameterised by time-chunk length so every claim is made at chunk 10 (what
 * prod writes today) AND chunk 1 (what TASK-2719 would write).
 *
 * PROOF 1 is written to FAIL against the pre-fix constants, on purpose and in
 * four independent ways, so it can never be satisfied by a plan object that
 * nothing reads:
 *   1. the ceiling the LIVE PlaybackChunkFetcher gives its cache,
 *   2. the window the LIVE reducer puts in state after MANIFEST_LOADED,
 *   3. the dtype the LIVE cache ends up holding,
 *   4. peak resident bytes recomputed from (1)+(2)+(3) — not from the plan.
 * At HEAD those are 64 MiB, radius 2, Float32 and ~2,265 MiB respectively.
 *
 * The prod-scale descriptor is run 1328's real shape, read from the store's
 * own metadata on 2026-08-10 (s3://anuga-result-storage/playback/741_410_1328):
 * depth shape [31, 3393075], chunk_shape [10, 3393075], 6,779,432 triangles.
 * No fixture at that size can exist in a browser test, so PROOF 1's arithmetic
 * runs against the descriptor while PROOF 1's WIRING and all of PROOF 3 run
 * against the real byte fixtures through the real production code path.
 */
import expect from 'expect';
import {
    computePlaybackMemoryPlan,
    fixedResidencyBytes,
    readNodeCount,
    describePlan,
    PLAYBACK_HEAP_BUDGET_BYTES,
    STORED_BYTES_PER_ELEMENT,
    PHYSICAL_BYTES_PER_ELEMENT,
    MIN_CHUNKS_PER_QUANTITY,
    MAX_CHUNKS_PER_QUANTITY,
    // TASK-2743 UAT-08 (W6, epic 2706) — size the budget to the machine.
    resolvePlaybackHeapBudget,
    resolvePlaybackHeapBudgetFromEnvironment,
    PLAYBACK_HEAP_BUDGET_MAX_BYTES,
    MAX_CHUNKS_PER_QUANTITY_CEILING,
    HEAP_LIMIT_BUDGET_FRACTION,
    DEVICE_MEMORY_BUDGET_FRACTION
} from '../playbackMemoryPolicy';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { PlaybackChunkCache, DEFAULT_MAX_BYTES } from '../playbackChunkCache';
import { decodeCompressedChunk, decodeTypedArray, dequantize, dequantizeRow, HOST_IS_LITTLE_ENDIAN } from '../playbackDecode';
import { decodeChunkOffThread } from '../playbackDecodeWorker';
import { loadPlaybackFrame } from '../loadPlaybackLayerOptions';
import { QUANTITY_ARRAYS, resolveChunkLengthT } from '../playbackChunkShape';
import { playbackControllerReducer } from '../playbackController';
import { playbackManifestLoaded, playbackInit } from '../actions/playbackActions';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST, FIXTURE_PHYSICAL, FIXTURE_MESH, FIXTURE_ARRAY_META } from './fixtures/fixturePlaybackStore';
import { FIXTURE_STORE_FILES_CHUNK1, FIXTURE_MANIFEST_CHUNK1 } from './fixtures/fixturePlaybackStoreChunk1';

// Run 1328, from the store's own zarr.json — the mesh that froze the tab.
const RUN_1328 = { nNode: 3393075, nFace: 6779432, nTime: 31 };
const MIB = 1024 * 1024;
// Epic 2706 AC2's two budgets: the honest chunk-10 number, and what the
// re-chunked store must come in under.
const BUDGET_CHUNK10 = 800 * MIB;
const BUDGET_CHUNK1 = 400 * MIB;

const STORES = [
    {
        label: 'chunk-10 (the shape prod writes today)',
        chunkLengthT: 10,
        manifest: FIXTURE_MANIFEST,
        files: FIXTURE_STORE_FILES,
        budgetBytes: BUDGET_CHUNK10
    },
    {
        label: 'chunk-1 (TASK-2719\'s re-chunked store)',
        chunkLengthT: 1,
        manifest: FIXTURE_MANIFEST_CHUNK1,
        files: FIXTURE_STORE_FILES_CHUNK1,
        budgetBytes: BUDGET_CHUNK1
    }
];

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function fetchFrom(files) {
    return (url) => {
        const b64 = files[url];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
}

function planFor(chunkLengthT, budgetBytes) {
    return computePlaybackMemoryPlan({
        nNode: RUN_1328.nNode,
        nFace: RUN_1328.nFace,
        chunkLengthT,
        totalChunks: Math.ceil(RUN_1328.nTime / chunkLengthT),
        budgetBytes
    });
}

describe('playbackMemoryPolicy — TASK-2708 PROOF 1 (memory budget)', () => {
    it('prices the mesh-fixed terms from the store shape, not a constant', () => {
        const fixed = fixedResidencyBytes(RUN_1328);
        // 5 x Float32 per node (node_x/node_y/elevation/friction/vertexInradius)
        // + 4 B/face inradius + 12 B/face connectivity.
        expect(fixed.geometryBytes).toBe(20 * RUN_1328.nNode + 16 * RUN_1328.nFace);
        expect(fixed.geometryBytes).toBe(176332412);
        // layer nodeX/nodeY clone + reprojected Float64 pair + frame0/frame1.
        expect(fixed.renderBytes).toBe(48 * RUN_1328.nNode);
        expect(fixed.total).toBe(339200012);
        // Identify's own reprojection is stated, not hidden — it is allocated
        // on the first Inspect click, never during load/play/scrub.
        expect(fixed.onDemandIdentifyBytes).toBe(16 * RUN_1328.nNode);
    });

    it('estimates the face count when the manifest cannot declare it, within 0.1% of the real mesh', () => {
        const estimated = fixedResidencyBytes({ nNode: RUN_1328.nNode });
        const exact = fixedResidencyBytes(RUN_1328);
        const drift = Math.abs(estimated.total - exact.total) / exact.total;
        expect(drift < 0.001).toBe(true);
    });

    it('reads the node count from the store\'s own chunk_shapes', () => {
        expect(readNodeCount(FIXTURE_MANIFEST)).toBe(FIXTURE_MESH.nNode);
        expect(readNodeCount(FIXTURE_MANIFEST_CHUNK1)).toBe(FIXTURE_MESH.nNode);
        expect(readNodeCount({})).toBe(undefined);
    });

    it('refuses to plan without the store\'s own nNode/chunkLengthT (no guessed footprint)', () => {
        expect(() => computePlaybackMemoryPlan({ chunkLengthT: 10 })).toThrow();
        expect(() => computePlaybackMemoryPlan({ nNode: RUN_1328.nNode })).toThrow();
    });

    it('keeps peak resident bytes inside the budget at chunk 10 (AC2: <= 800 MiB)', () => {
        const plan = planFor(10, BUDGET_CHUNK10);
        expect(plan.storedChunkBytes).toBe(10 * RUN_1328.nNode * STORED_BYTES_PER_ELEMENT);
        expect(plan.storedChunkBytes).toBe(67861500);
        expect(plan.chunksPerQuantity).toBe(2);
        expect(plan.bufferWindowRadius).toBe(0);
        expect(plan.bufferWindowAhead).toBe(1);
        expect(plan.cacheMaxBytes).toBe(407169000);
        expect(plan.peakResidentBytes).toBe(746369012);
        expect(plan.withinBudget).toBe(true);
        // ...and the structural floor the review named (3 quantities, current
        // chunk + next-chunk prefetch) is exactly what it buys.
        expect(plan.cacheMaxBytes).toBe(QUANTITY_ARRAYS.length * 2 * plan.storedChunkBytes);
    });

    it('keeps peak resident bytes inside the budget at chunk 1 (AC2: <= 400 MiB)', () => {
        const plan = planFor(1, BUDGET_CHUNK1);
        expect(plan.storedChunkBytes).toBe(6786150);
        expect(plan.chunksPerQuantity).toBe(3);
        expect(plan.bufferWindowRadius).toBe(1);
        expect(plan.bufferWindowAhead).toBe(1);
        expect(plan.peakResidentBytes).toBe(400275362);
        expect(plan.withinBudget).toBe(true);
    });

    it('MUST FAIL PRE-FIX: the shipped constants (64 MiB cache, radius 2, Float32 residency) blow both budgets', () => {
        // The SAME arithmetic, priced with the pre-fix shape: a dequantized
        // Float32 chunk, and a symmetric radius-2 window = 5 chunks.
        const preFix10 = computePlaybackMemoryPlan({
            ...RUN_1328,
            chunkLengthT: 10,
            budgetBytes: BUDGET_CHUNK10,
            bytesPerResidentElement: PHYSICAL_BYTES_PER_ELEMENT,
            forceChunksPerQuantity: 5
        });
        expect(preFix10.storedChunkBytes).toBe(135723000); // 129.4 MiB — ONE chunk
        expect(preFix10.peakResidentBytes).toBe(2375045012); // 2,265 MiB
        expect(preFix10.withinBudget).toBe(false);
        expect(preFix10.peakResidentBytes > BUDGET_CHUNK10).toBe(true);

        const preFix1 = computePlaybackMemoryPlan({
            ...RUN_1328,
            chunkLengthT: 1,
            budgetBytes: BUDGET_CHUNK1,
            bytesPerResidentElement: PHYSICAL_BYTES_PER_ELEMENT,
            forceChunksPerQuantity: 5
        });
        expect(preFix1.withinBudget).toBe(false);

        // And the reason the LRU thrashed rather than merely overflowed: a
        // single element did not fit in its own cache.
        expect(DEFAULT_MAX_BYTES < preFix10.storedChunkBytes).toBe(true);
        expect(DEFAULT_MAX_BYTES * 2 < preFix10.storedChunkBytes).toBe(true);
        // Even the STORED chunk was over the fixed ceiling.
        expect(DEFAULT_MAX_BYTES < planFor(10, BUDGET_CHUNK10).storedChunkBytes).toBe(true);
    });

    it('MUST FAIL PRE-FIX: the LIVE fetcher takes its ceiling from the store, not DEFAULT_MAX_BYTES', () => {
        const plan = planFor(10, BUDGET_CHUNK10);
        const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, memoryPlan: plan });
        expect(fetcher.cache.maxBytes).toBe(plan.cacheMaxBytes);
        expect(fetcher.cache.maxBytes).toNotBe(DEFAULT_MAX_BYTES);
        // Whatever the ceiling is, one chunk of all three quantities must fit
        // inside it — otherwise the LRU evicts the chunk it is reading.
        expect(fetcher.cache.maxBytes >= QUANTITY_ARRAYS.length * plan.storedChunkBytes).toBe(true);
        // ...and it is adjustable in place, because the plan is refined once
        // the exact triangle count lands.
        const refined = planFor(1, BUDGET_CHUNK1);
        fetcher.applyMemoryPlan(refined);
        expect(fetcher.cache.maxBytes).toBe(refined.cacheMaxBytes);
    });

    it('MUST FAIL PRE-FIX: the LIVE reducer takes its window from the plan, not DEFAULT_WINDOW_RADIUS', () => {
        const plan = planFor(10, BUDGET_CHUNK10);
        const initial = playbackControllerReducer(undefined, playbackInit(7, 'playback-layer', '/m'));
        expect(initial.bufferWindowRadius).toBe(2); // the pre-manifest default survives
        const loaded = playbackControllerReducer(initial, playbackManifestLoaded({
            runId: 7, manifest: FIXTURE_MANIFEST, mesh: null, time: null, dtMs: null,
            quantization: FIXTURE_MANIFEST.quantization, nTime: RUN_1328.nTime, nNode: RUN_1328.nNode,
            chunkLengthT: 10, totalChunks: 4, memoryPlan: plan
        }));
        expect(loaded.bufferWindowRadius).toBe(0);
        expect(loaded.bufferWindowAhead).toBe(1);
        expect(loaded.memoryPlan.cacheMaxBytes).toBe(plan.cacheMaxBytes);

        // The window the epic will actually ask for, from the LIVE fetcher.
        const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, memoryPlan: plan });
        const window = fetcher.getPrefetchWindow(1, 4, loaded.bufferWindowRadius, { ahead: loaded.bufferWindowAhead });
        expect(window).toEqual([1, 2]);
        expect(window.length).toBe(plan.chunksPerQuantity);

        // PROOF 1's headline assertion, recomputed from LIVE values rather
        // than from the plan: what the fetcher's cache allows + what the mesh
        // costs must fit the budget. At HEAD this is
        // 339,200,012 + 3 x 5 x 135,723,000 = 2,375,045,012 (2,265 MiB).
        const liveWindowChunks = window.length;
        const liveResidentBytes = QUANTITY_ARRAYS.length * liveWindowChunks
            * plan.chunkLengthT * RUN_1328.nNode * plan.bytesPerResidentElement;
        const livePeak = fixedResidencyBytes(RUN_1328).total + liveResidentBytes;
        expect(livePeak <= BUDGET_CHUNK10).toBe(true);
        expect(describePlan(plan)).toContain('peak=711.8 MiB');
    });

    it('never plans below the structural floor of one chunk per quantity plus its neighbour', () => {
        // A budget far too small for this mesh still yields the floor, and
        // says so rather than pretending it fits.
        const starved = computePlaybackMemoryPlan({ ...RUN_1328, chunkLengthT: 10, budgetBytes: 64 * MIB });
        expect(starved.chunksPerQuantity).toBe(MIN_CHUNKS_PER_QUANTITY);
        expect(starved.withinBudget).toBe(false);
        // A store with a single chunk cannot be given two.
        const oneChunk = computePlaybackMemoryPlan({ nNode: 1000, chunkLengthT: 10, totalChunks: 1 });
        expect(oneChunk.chunksPerQuantity).toBe(1);
        expect(oneChunk.bufferWindowRadius).toBe(0);
        expect(oneChunk.bufferWindowAhead).toBe(0);
        // A tiny mesh gets the deeper window, capped by the policy.
        const small = computePlaybackMemoryPlan({ nNode: 253000, chunkLengthT: 10, totalChunks: 40 });
        expect(small.chunksPerQuantity).toBe(MAX_CHUNKS_PER_QUANTITY);
        expect(small.peakResidentBytes < PLAYBACK_HEAP_BUDGET_BYTES).toBe(true);
    });

    STORES.forEach(({ label, chunkLengthT, manifest, files }) => {
        it(`holds the STORED uint16, not Float32, through the real fetch path — ${label}`, (done) => {
            const plan = computePlaybackMemoryPlan({
                nNode: FIXTURE_MESH.nNode, chunkLengthT, totalChunks: Math.ceil(13 / chunkLengthT)
            });
            const fetcher = new PlaybackChunkFetcher({ manifest, memoryPlan: plan, fetchImpl: fetchFrom(files) });
            expect(resolveChunkLengthT(manifest)).toBe(chunkLengthT);
            fetcher.fetchAndDecodeChunk('depth', [0, 0], {
                dtype: 'uint16',
                byteorder: 'little',
                quantization: manifest.quantization.depth
            }).then((chunk) => {
                expect(chunk.constructor).toBe(Uint16Array);
                expect(chunk.BYTES_PER_ELEMENT).toBe(STORED_BYTES_PER_ELEMENT);
                expect(chunk.length).toBe(chunkLengthT * FIXTURE_MESH.nNode);
                // The cache's accounting is in STORED bytes, so the ceiling
                // the plan computed is the ceiling that is actually enforced.
                expect(fetcher.cache.totalBytes).toBe(chunkLengthT * FIXTURE_MESH.nNode * STORED_BYTES_PER_ELEMENT);
                done();
            }).catch(done);
        });
    });

    it('evicts to the store-derived ceiling instead of thrashing on an oversized single entry', () => {
        // The pre-fix pathology, reproduced at fixture scale: an entry bigger
        // than the whole cache. The cache still stores it (never silently
        // drops), but every other entry goes — which is why the ceiling has to
        // come from the store.
        const cache = new PlaybackChunkCache({ maxBytes: 1024 });
        cache.set('a', new Uint16Array(256)); // 512 B
        cache.set('b', new Uint16Array(2048)); // 4096 B — 4x the ceiling
        expect(cache.size).toBe(1);
        expect(cache.lastEvictedKeys()).toEqual(['a']);
        // Resized to fit both, nothing is evicted.
        cache.resize(8192);
        cache.set('a', new Uint16Array(256));
        expect(cache.size).toBe(2);
        expect(() => cache.resize(0)).toThrow();
    });
});

describe('playbackMemoryPolicy — TASK-2708 PROOF 3 (correctness of the moved decode)', () => {
    STORES.forEach(({ label, chunkLengthT, manifest, files }) => {
        describe(label, () => {
            const nNode = FIXTURE_MESH.nNode;
            const plan = computePlaybackMemoryPlan({
                nNode, chunkLengthT, totalChunks: Math.ceil(13 / chunkLengthT)
            });
            const newFetcher = () => new PlaybackChunkFetcher({
                manifest, memoryPlan: plan, fetchImpl: fetchFrom(files)
            });

            // A NAMED vertex and timestep, in the SECOND time chunk of the
            // chunk-10 store (so the chunk index and the row offset are both
            // non-zero and a mis-slice cannot hide).
            const TIMESTEP = 11;
            const VERTEX = 3;

            it('reproduces the store\'s own scale/offset dequantization at timestep 11, vertex 3', (done) => {
                const q = manifest.quantization;
                loadPlaybackFrame(newFetcher(), TIMESTEP, nNode, chunkLengthT).then((frame) => {
                    // Tolerance is the store's own quantization step — the
                    // most the round trip can lose by construction.
                    expect(Math.abs(frame.depth[VERTEX] - FIXTURE_PHYSICAL.depth[TIMESTEP][VERTEX]))
                        .toBeLessThan(q.depth.scale + 1e-7);
                    expect(Math.abs(frame.xVelocity[VERTEX] - FIXTURE_PHYSICAL.x_velocity[TIMESTEP][VERTEX]))
                        .toBeLessThan(q.x_velocity.scale + 1e-7);
                    expect(Math.abs(frame.yVelocity[VERTEX] - FIXTURE_PHYSICAL.y_velocity[TIMESTEP][VERTEX]))
                        .toBeLessThan(q.y_velocity.scale + 1e-7);
                    // Not accidentally zero/dry — a mis-slice that landed on
                    // an all-zero row would otherwise pass a tolerance test.
                    expect(frame.depth[VERTEX] > 0.3).toBe(true);
                    expect(frame.yVelocity[VERTEX] < -0.19).toBe(true);
                    expect(frame.depth.constructor).toBe(Float32Array);
                    done();
                }).catch(done);
            });

            it('never applies scale twice — a second read of the cached chunk is identical, not scaled again', (done) => {
                const fetcher = newFetcher();
                loadPlaybackFrame(fetcher, TIMESTEP, nNode, chunkLengthT).then((first) => {
                    // The chunk is now cached (still quantized). Reading it
                    // again must not re-dequantize an already-dequantized
                    // array — the classic double-scale, which at
                    // scale=5.49e-6 would render ~180,000x too shallow and
                    // still look like a plausible dry-ish surface.
                    return loadPlaybackFrame(fetcher, TIMESTEP, nNode, chunkLengthT).then((second) => {
                        expect(Array.from(second.depth)).toEqual(Array.from(first.depth));
                        expect(second.depth[VERTEX]).toBe(first.depth[VERTEX]);
                        // A DIFFERENT row out of the SAME cached chunk is also
                        // correct — proving the cache holds stored units.
                        return loadPlaybackFrame(fetcher, TIMESTEP - 1, nNode, chunkLengthT).then((prev) => {
                            expect(Math.abs(prev.depth[VERTEX] - FIXTURE_PHYSICAL.depth[TIMESTEP - 1][VERTEX]))
                                .toBeLessThan(manifest.quantization.depth.scale + 1e-7);
                            expect(prev.depth[VERTEX]).toNotBe(first.depth[VERTEX]);
                            done();
                        });
                    });
                }).catch(done);
            });

            it('leaves the cached chunk live — no detached transferable behind the frame slice', (done) => {
                const fetcher = newFetcher();
                loadPlaybackFrame(fetcher, TIMESTEP, nNode, chunkLengthT).then((frame) => {
                    const chunkIndex = Math.floor(TIMESTEP / chunkLengthT);
                    const cached = fetcher.cache.get(`depth/c/${chunkIndex}/0`);
                    // A detached ArrayBuffer reports byteLength 0 and reads
                    // back as undefined — the silent way a transfer bug turns
                    // real water into dry ground.
                    expect(cached.buffer.byteLength).toBe(chunkLengthT * nNode * STORED_BYTES_PER_ELEMENT);
                    expect(cached.length).toBe(chunkLengthT * nNode);
                    const row = (TIMESTEP % chunkLengthT) * nNode;
                    expect(cached[row + VERTEX]).toBeGreaterThan(0);
                    // The frame's own buffer is independent of the chunk's —
                    // dequantizeRow copies, it does not subarray, so the
                    // chunk can be evicted without zeroing a live frame.
                    expect(frame.depth.buffer).toNotBe(cached.buffer);
                    expect(frame.depth.byteLength).toBe(nNode * PHYSICAL_BYTES_PER_ELEMENT);
                    done();
                }).catch(done);
            });

            it('keeps velocity as VELOCITY — no momentum-to-velocity division sneaks into the moved decode', (done) => {
                loadPlaybackFrame(newFetcher(), TIMESTEP, nNode, chunkLengthT).then((frame) => {
                    const expected = FIXTURE_PHYSICAL.x_velocity[TIMESTEP][VERTEX];
                    const depth = FIXTURE_PHYSICAL.depth[TIMESTEP][VERTEX];
                    expect(Math.abs(frame.xVelocity[VERTEX] - expected)).toBeLessThan(1e-5);
                    // If anything divided by (or multiplied by) depth on the
                    // way through, this is what it would read instead. depth
                    // here is 0.33, so the two are ~3x apart — a plausible,
                    // wrong flood.
                    const ifTreatedAsMomentum = expected / depth;
                    expect(Math.abs(frame.xVelocity[VERTEX] - ifTreatedAsMomentum) > 0.5).toBe(true);
                    done();
                }).catch(done);
            });

            it('the off-thread decoder and the same-thread decoder return identical bytes', (done) => {
                const key = `depth/c/${Math.floor(TIMESTEP / chunkLengthT)}/0`;
                const opts = { dtype: 'uint16', byteorder: 'little' };
                Promise.all([
                    decodeCompressedChunk(base64ToArrayBuffer(files[key]), opts),
                    decodeChunkOffThread(base64ToArrayBuffer(files[key]), opts)
                ]).then(([inline, offThread]) => {
                    expect(offThread.constructor).toBe(Uint16Array);
                    expect(offThread.length).toBe(inline.length);
                    expect(Array.from(offThread)).toEqual(Array.from(inline));
                    done();
                }).catch(done);
            });
        });
    });

    it('the zero-copy fast path is bit-identical to the DataView loop, both byte orders', () => {
        const values = [0, 1, 255, 256, 4095, 32767, 65535];
        const buffer = new ArrayBuffer(values.length * 2);
        const dv = new DataView(buffer);
        values.forEach((v, i) => dv.setUint16(i * 2, v, HOST_IS_LITTLE_ENDIAN));
        const hostOrder = HOST_IS_LITTLE_ENDIAN ? 'little' : 'big';
        const otherOrder = HOST_IS_LITTLE_ENDIAN ? 'big' : 'little';
        // Host order: the fast path (a view over the buffer).
        expect(Array.from(decodeTypedArray(buffer.slice(0), 'uint16', hostOrder))).toEqual(values);
        // Opposite order: the byte-swapping loop must still be taken, and
        // must NOT produce the same numbers (that would mean the fast path
        // leaked into the mismatched case).
        const swapped = Array.from(decodeTypedArray(buffer.slice(0), 'uint16', otherOrder));
        expect(swapped).toNotEqual(values);
        // ...and swapping twice round-trips.
        const reswap = new ArrayBuffer(values.length * 2);
        const rdv = new DataView(reswap);
        swapped.forEach((v, i) => rdv.setUint16(i * 2, v, !HOST_IS_LITTLE_ENDIAN));
        expect(Array.from(decodeTypedArray(reswap, 'uint16', hostOrder))).toEqual(values);
    });

    it('dequantizeRow matches whole-array dequantize element for element', () => {
        const q = FIXTURE_ARRAY_META.depth.attributes;
        const stored = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        const whole = dequantize(stored, q);
        const row = dequantizeRow(stored, 6, 3, q);
        expect(Array.from(row)).toEqual([whole[6], whole[7], whole[8]]);
        expect(row.constructor).toBe(Float32Array);
        // A row that would read past the chunk is refused, not zero-filled —
        // the TASK-2724 failure mode (a plausible surface, silently wrong).
        expect(() => dequantizeRow(stored, 10, 3, q)).toThrow();
        expect(() => dequantizeRow(stored, 0, 3, {})).toThrow();
    });
});

/*
 * TASK-2728 (W5, epic 2706) NAMED PROOF 3 — guard the guard.
 *
 * This is a PIN, not a defect proof: it is green at HEAD and stays green.
 * It exists because TASK-2728's whole argument rests on one piece of D5
 * arithmetic — that the floor of 2 chunks per quantity is what makes the
 * cache ceiling large enough to hold face_node_connectivity at all — and
 * nothing else in the suite would notice if a future edit to
 * MIN_CHUNKS_PER_QUANTITY / MAX_CHUNKS_PER_QUANTITY silently took that away.
 *
 * budgetBytes is spelled out in BOTH calls on purpose. At the 800 MiB default
 * the chunk-2 ceiling is 122,150,700, not 81,433,800 — the numbers below are
 * the 400 MiB ones and only reproduce when the budget is passed.
 */
describe('playbackMemoryPolicy — TASK-2728 the floor-2 ceiling is the one that can hold face_node_connectivity', () => {
    const N_NODE = 3393075;
    const N_FACE = 6779432;
    const FNC_BYTES = 12 * N_FACE; // Int32Array(3 * nFace) = 81,353,184

    it('at chunk length 1 the ceiling is BELOW face_node_connectivity, at chunk length 2 it is above', () => {
        const chunk1 = computePlaybackMemoryPlan({
            nNode: N_NODE, nFace: N_FACE, chunkLengthT: 1, budgetBytes: 400 * 1024 * 1024
        });
        expect(chunk1.cacheMaxBytes).toBe(61075350);
        expect(chunk1.cacheMaxBytes < FNC_BYTES).toBe(true);

        const chunk2 = computePlaybackMemoryPlan({
            nNode: N_NODE, nFace: N_FACE, chunkLengthT: 2, budgetBytes: 400 * 1024 * 1024
        });
        expect(chunk2.cacheMaxBytes).toBe(81433800);
        expect(chunk2.cacheMaxBytes > FNC_BYTES).toBe(true);
        // The margin is 80,616 B (0.099%) and it is NOT a coincidence: the only
        // invariant is nFace <= 2 * nNode (Euler, F = 2V - 2 - B), so the
        // margin is exactly 12 * (B + 2) bytes of boundary. It is thin enough
        // that it must be pinned rather than relied on.
        expect(chunk2.cacheMaxBytes - FNC_BYTES).toBe(80616);
        // and the floor is what produced it — not affordability.
        expect(chunk2.affordableChunksPerQuantity < chunk2.chunksPerQuantity).toBe(true);
        expect(chunk2.chunksPerQuantity).toBe(2);
    });
});

describe('TASK-2743 UAT-08 — the heap budget is sized to the MACHINE, and can only ever go up', () => {
    // Run 1328's real shape (the same descriptor PROOF 1 uses, above) plus
    // the store's own time chunking: 31 timesteps at chunk_length_t 10 = 4
    // chunks, read from the manifest on 2026-08-14.
    const STORE_1328 = { ...RUN_1328, chunkLengthT: 10, totalChunks: 4 };

    it('a browser that reports NOTHING gets the shipped constants, byte for byte', () => {
        const r = resolvePlaybackHeapBudget();
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(r.maxChunksPerQuantity).toBe(MAX_CHUNKS_PER_QUANTITY);
        expect(r.source).toBe('default');
        // and the plan it produces is the one PROOF 1 pinned: 2 slots,
        // 0 behind / 1 ahead.
        const plan = computePlaybackMemoryPlan({
            ...STORE_1328, budgetBytes: r.budgetBytes, maxChunksPerQuantity: r.maxChunksPerQuantity
        });
        expect(plan.chunksPerQuantity).toBe(2);
        expect(plan.bufferWindowRadius).toBe(0);
        expect(plan.bufferWindowAhead).toBe(1);
    });

    it('a SMALL machine cannot shrink the budget below the shipped floor', () => {
        // 512 MiB heap ceiling, 2 GiB device: both offers are under 800 MiB.
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 512 * 1024 * 1024, deviceMemoryGiB: 2
        });
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(r.maxChunksPerQuantity).toBe(MAX_CHUNKS_PER_QUANTITY);
    });

    it('THIS workstation (measured live: jsHeapSizeLimit 4192 MiB, deviceMemory 32) buys the whole store', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 4192 * 1024 * 1024, deviceMemoryGiB: 32
        });
        // min(4192 x 0.45, 32768 x 0.20) = min(1886.4, 6553.6) MiB
        expect(Math.round(r.budgetBytes / 1048576)).toBe(1886);
        expect(r.source).toBe('heap+device');
        expect(r.maxChunksPerQuantity).toBe(4);
        const plan = computePlaybackMemoryPlan({
            ...STORE_1328, budgetBytes: r.budgetBytes, maxChunksPerQuantity: r.maxChunksPerQuantity
        });
        // run 1328 IS 4 chunks, so the whole store goes resident: 1 behind,
        // current, 2 ahead. That is the operator's "pre-load more
        // aggressively" — and it stays inside the budget it was derived from.
        expect(plan.chunksPerQuantity).toBe(4);
        expect(plan.bufferWindowRadius).toBe(1);
        expect(plan.bufferWindowAhead).toBe(2);
        expect(plan.withinBudget).toBe(true);
        expect(plan.peakResidentBytes <= r.budgetBytes).toBe(true);
    });

    it('takes the PESSIMISTIC signal — a big heap ceiling on a small device does not win', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 8192 * 1024 * 1024, deviceMemoryGiB: 6
        });
        expect(r.budgetBytes).toBe(Math.floor(6 * 1024 * 1024 * 1024 * DEVICE_MEMORY_BUDGET_FRACTION));
        expect(r.budgetBytes < Math.floor(8192 * 1024 * 1024 * HEAP_LIMIT_BUDGET_FRACTION)).toBe(true);
    });

    it('is bounded at both ends — no machine talks it past the ceiling or the window cap', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 64 * 1024 * 1024 * 1024, deviceMemoryGiB: 512
        });
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_MAX_BYTES);
        expect(r.maxChunksPerQuantity <= MAX_CHUNKS_PER_QUANTITY_CEILING).toBe(true);
    });

    it('computePlaybackMemoryPlan clamps a caller-supplied maxChunksPerQuantity into the legal band', () => {
        const huge = computePlaybackMemoryPlan({
            ...STORE_1328, budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES, maxChunksPerQuantity: 99
        });
        expect(huge.maxChunksPerQuantity).toBe(MAX_CHUNKS_PER_QUANTITY_CEILING);
        const tiny = computePlaybackMemoryPlan({ ...STORE_1328, maxChunksPerQuantity: 0 });
        // 0 is not a request for zero slots; it falls back to the default.
        expect(tiny.maxChunksPerQuantity).toBe(MAX_CHUNKS_PER_QUANTITY);
    });

    it('a store with FEWER chunks than the window still never over-buys', () => {
        const plan = computePlaybackMemoryPlan({
            ...STORE_1328, totalChunks: 2,
            budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES, maxChunksPerQuantity: 6
        });
        expect(plan.chunksPerQuantity).toBe(2);
    });

    it('the environment reader returns a well-formed plan input whatever this browser reports', () => {
        const r = resolvePlaybackHeapBudgetFromEnvironment();
        expect(r.budgetBytes >= PLAYBACK_HEAP_BUDGET_BYTES).toBe(true);
        expect(r.budgetBytes <= PLAYBACK_HEAP_BUDGET_MAX_BYTES).toBe(true);
        expect(r.maxChunksPerQuantity >= MAX_CHUNKS_PER_QUANTITY).toBe(true);
        expect(r.maxChunksPerQuantity <= MAX_CHUNKS_PER_QUANTITY_CEILING).toBe(true);
    });
});

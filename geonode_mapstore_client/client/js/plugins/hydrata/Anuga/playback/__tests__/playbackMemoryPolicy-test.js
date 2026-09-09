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
    // TASK-2984 (W1.1, epic 2981) renamed MAX_CHUNKS_PER_QUANTITY: 3 is no
    // longer a cap, it is the FLOOR window.
    FLOOR_WINDOW_CHUNKS_PER_QUANTITY,
    // TASK-2743 UAT-08 (W6, epic 2706) — size the budget to the machine.
    resolvePlaybackHeapBudget,
    resolvePlaybackHeapBudgetFromEnvironment,
    PLAYBACK_HEAP_BUDGET_MAX_BYTES,
    HEAP_HEADROOM_BUDGET_FRACTION,
    DEVICE_MEMORY_BUDGET_FRACTION,
    // TASK-2984 (W1.1, epic 2981) — the deepening rule, the downward device
    // path and the runtime-tunable seam.
    isCoarsePhoneClass,
    APP_BASELINE_FLOOR_BYTES,
    PLAN_TRANSIENT_EXCESS_BYTES,
    PLAN_UNCAP_MAX_PEAK_BYTES,
    SMALL_DEVICE_MEMORY_GIB,
    SMALL_DEVICE_MIN_BUDGET_BYTES,
    PHONE_CLASS_BUDGET_BYTES,
    PLAN_TRANSIENT_EXCESS_BAND_BYTES,
    PLAN_UNCAP_MAX_PEAK_BAND_BYTES,
    APP_BASELINE_FLOOR_BAND_BYTES
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
        // A tiny mesh gets the deeper window.
        //
        // RE-BASED BY TASK-2984 (W1.1, epic 2981), 2026-09-08. This asserted
        // MAX_CHUNKS_PER_QUANTITY (3) and is one of the three specs the
        // deepening rule deliberately inverts. At the shipped constants this
        // shape now plans 6: fixed 24.1 MiB, per-chunk-across-quantities
        // 14.5 MiB, window budget min(800 - 680, 440) = 120.0 MiB, so
        // floor((120.0 - 24.1) / 14.5) = 6, well inside totalChunks 40.
        //
        // RE-BASED AGAIN 2026-09-08 by the operator's E ruling (decision
        // `2026-09-08-w1-e-overrun`, PLAN_TRANSIENT_EXCESS_BYTES 566 -> 680
        // MiB): 14 -> 6. This is a SYNTHETIC shape, not a row of the AC2 scale
        // table — every AC2 cell is unchanged at 680 — so it is free to move,
        // and it moves in the conservative direction.
        //
        // *** DO NOT restore a clamp to FLOOR_WINDOW_CHUNKS_PER_QUANTITY to
        // make this pass. That is clause 14's INERT TRAP and it silently
        // no-ops this whole task while every other test stays green. ***
        const small = computePlaybackMemoryPlan({ nNode: 253000, chunkLengthT: 10, totalChunks: 40 });
        expect(small.chunksPerQuantity).toBe(6);
        expect(small.chunksPerQuantity > FLOOR_WINDOW_CHUNKS_PER_QUANTITY).toBe(true);
        expect(small.peakResidentBytes < PLAYBACK_HEAP_BUDGET_BYTES).toBe(true);
        // and it is the CEILING, not the slot count, that bounds it.
        expect(small.peakResidentBytes <= PLAN_UNCAP_MAX_PEAK_BYTES).toBe(true);
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
 * MIN_CHUNKS_PER_QUANTITY / FLOOR_WINDOW_CHUNKS_PER_QUANTITY silently took
 * that away.
 *
 * RE-BASED BY TASK-2984 (W1.1, epic 2981), 2026-09-08 — WHAT NOW GUARANTEES
 * IT. The numbers below are unchanged, because both calls omit `totalChunks`
 * and the deepening rule only runs when the store declares one. But the
 * guarantee is now STRONGER than "the floor of 2 produced it", and it is
 * worth stating because a reader meeting the deepening rule will ask:
 * `chunksPerQuantity = max(todaysN, deepN)` is MONOTONE and `deepN` is itself
 * clamped below by MIN_CHUNKS_PER_QUANTITY, so no budget and no in-band
 * runtime override can ever plan FEWER than 2 chunks per quantity on a store
 * with 2 or more. `cacheMaxBytes` is linear in that count, so it can only ever
 * be LARGER than the floor-2 ceiling asserted here — never smaller. The
 * chunk-2 margin over face_node_connectivity is therefore a floor on the
 * margin, not a knife-edge that a deeper window could fall off.
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

describe('TASK-2743 UAT-08 / TASK-2984 W1.1 — the heap budget is sized to the MACHINE, and can now go DOWN as well as up', () => {
    // Run 1328's real shape (the same descriptor PROOF 1 uses, above) plus
    // the store's own time chunking: 31 timesteps at chunk_length_t 10 = 4
    // chunks, read from the manifest on 2026-08-14.
    const STORE_1328 = { ...RUN_1328, chunkLengthT: 10, totalChunks: 4 };

    it('a browser that reports NOTHING gets the shipped constants, byte for byte', () => {
        const r = resolvePlaybackHeapBudget();
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(r.source).toBe('default');
        // and the plan it produces is the one PROOF 1 pinned: 2 slots,
        // 0 behind / 1 ahead.
        const plan = computePlaybackMemoryPlan({ ...STORE_1328, budgetBytes: r.budgetBytes });
        expect(plan.chunksPerQuantity).toBe(2);
        expect(plan.bufferWindowRadius).toBe(0);
        expect(plan.bufferWindowAhead).toBe(1);
    });

    it('a SMALL machine now CAN shrink the budget below the shipped floor — that is the point of the downward path', () => {
        // INVERTED BY TASK-2984 (W1.1, epic 2981), 2026-09-08. The SAME input
        // signals as the spec this replaces ('a SMALL machine cannot shrink
        // the budget below the shipped floor'), so the RED/GREEN pair is
        // visible in the diff. It used to assert PLAYBACK_HEAP_BUDGET_BYTES.
        //
        // WHY THAT WAS THE DEFECT: clamp()'s lo is a FLOOR, so min(offers) was
        // floored UP to 800 MiB and a 2 GiB Android phone whose own signals
        // offered 163 MiB was handed 800 — then downloaded 63 MB of geometry
        // and held 440 MiB of typed arrays.
        //
        // 128, NOT 163: usedJSHeapSize is absent here, so the heap offer
        // charges APP_BASELINE_FLOOR_BYTES instead —
        // (512 - 280) x 0.45 = 104.4 MiB — which the small-device path floors
        // at SMALL_DEVICE_MIN_BUDGET_BYTES.
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 512 * 1024 * 1024, deviceMemoryGiB: 2
        });
        expect(r.budgetBytes).toBe(SMALL_DEVICE_MIN_BUDGET_BYTES);
        expect(r.budgetBytes).toBe(128 * MIB);
        expect(r.source).toBe('small-device');
        expect(r.budgetBytes < PLAYBACK_HEAP_BUDGET_BYTES).toBe(true);
    });

    it('...but the floor still applies to a machine that is NOT small — the guard is narrowed, not removed', () => {
        // The sibling of the spec above. Same starved heap signals, a device
        // that says 8 GiB, no phone-class signal: the ordinary floored path.
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 512 * 1024 * 1024, deviceMemoryGiB: 8,
            uaMobile: false, maxTouchPoints: 0, viewportMinPx: 1500
        });
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(r.source).toBe('heap+device');
    });

    it('a tab that is ALREADY full gets the floor, not a share of a ceiling someone else occupies', () => {
        // The bug UAT caught: spending 45% of a 4,192 MiB LIMIT while the tab
        // already held ~1.1 GiB produced a 1,886.4 MiB budget, a 4-slot window,
        // a plan claiming withinBudget, and a renderer at 3.4 GB RSS that
        // stopped answering CDP. Headroom is the quantity a MARGINAL plan is
        // spent out of.
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 4192 * 1024 * 1024,
            usedJSHeapSize: 4000 * 1024 * 1024,
            deviceMemoryGiB: 32
        });
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
    });

    it('THIS workstation at playback-load time (measured live: limit 4192 MiB, used 1146 MiB, deviceMemory 32) buys one more slot', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 4192 * 1024 * 1024,
            usedJSHeapSize: 1146 * 1024 * 1024,
            deviceMemoryGiB: 32
        });
        // min((4192 - 1146) x 0.45, 32768 x 0.20) = min(1370.7, 6553.6) MiB, rounded 1371
        expect(Math.round(r.budgetBytes / 1048576)).toBe(1371);
        expect(r.source).toBe('heap+device');
        const plan = computePlaybackMemoryPlan({ ...STORE_1328, budgetBytes: r.budgetBytes });
        // 2 slots -> 3: one behind, current, one ahead. The scrub-back slot
        // this store never had, and the lookahead it already had.
        expect(plan.chunksPerQuantity).toBe(3);
        expect(plan.bufferWindowRadius).toBe(1);
        expect(plan.bufferWindowAhead).toBe(1);
        expect(plan.withinBudget).toBe(true);
        expect(plan.peakResidentBytes <= r.budgetBytes).toBe(true);
        // and the marginal spend is what the budget is actually about
        expect(Math.round(plan.peakResidentBytes / 1048576)).toBe(906);
    });

    it('takes the PESSIMISTIC signal — a big heap headroom on a small device does not win', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 8192 * 1024 * 1024, usedJSHeapSize: 0, deviceMemoryGiB: 6
        });
        expect(r.budgetBytes).toBe(Math.floor(6 * 1024 * 1024 * 1024 * DEVICE_MEMORY_BUDGET_FRACTION));
        expect(r.budgetBytes < Math.floor(8192 * 1024 * 1024 * HEAP_HEADROOM_BUDGET_FRACTION)).toBe(true);
    });

    it('is bounded above — no machine talks the budget past the ceiling', () => {
        const r = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 64 * 1024 * 1024 * 1024, usedJSHeapSize: 0, deviceMemoryGiB: 512
        });
        expect(r.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_MAX_BYTES);
    });

    it('NO budget, however large, buys THIS store a window deeper than 3 — but it is the PEAK CEILING that stops it now, not a slot cap', () => {
        // RE-BASED BY TASK-2984 (W1.1, epic 2981), 2026-09-08. Every assertion
        // below still holds, but the REASON changed and the title used to
        // state a claim that is now false in general: on the 813_417_1412
        // shape a big budget DOES buy 11 slots (see the TASK-2984 describe
        // below). What holds run 1328's chunk-10 shape at 3 is
        // PLAN_UNCAP_MAX_PEAK_BYTES: the window budget can never exceed
        // 440.0 MiB, and 440.0 - 323.5 MiB of fixed mesh leaves 116.5 MiB
        // against a 194.2 MiB per-chunk cost, so deepN clamps to the
        // structural floor and the monotone max() returns HEAD's 3.
        const huge = computePlaybackMemoryPlan({
            ...STORE_1328, budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES, maxChunksPerQuantity: 99
        });
        expect(huge.affordableChunksPerQuantity > FLOOR_WINDOW_CHUNKS_PER_QUANTITY).toBe(true);
        expect(huge.maxChunksPerQuantity).toBe(FLOOR_WINDOW_CHUNKS_PER_QUANTITY);
        expect(huge.chunksPerQuantity).toBe(FLOOR_WINDOW_CHUNKS_PER_QUANTITY);
        // and the ceiling is demonstrably the binding term, not the slot count
        expect(huge.deepChunksPerQuantity).toBe(MIN_CHUNKS_PER_QUANTITY);
        expect(huge.windowBudgetBytes).toBe(PLAN_UNCAP_MAX_PEAK_BYTES);
        const tiny = computePlaybackMemoryPlan({ ...STORE_1328, maxChunksPerQuantity: 0 });
        // 0 is not a request for zero slots; it falls back to the floor window.
        expect(tiny.maxChunksPerQuantity).toBe(FLOOR_WINDOW_CHUNKS_PER_QUANTITY);
    });

    it('a caller MAY ask for a shallower window — the clamp is one-directional', () => {
        const shallow = computePlaybackMemoryPlan({
            ...STORE_1328, budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES, maxChunksPerQuantity: 2
        });
        expect(shallow.chunksPerQuantity).toBe(2);
    });

    it('a store with FEWER chunks than the window still never over-buys', () => {
        const plan = computePlaybackMemoryPlan({
            ...STORE_1328, totalChunks: 2,
            budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES, maxChunksPerQuantity: 6
        });
        expect(plan.chunksPerQuantity).toBe(2);
    });

    it('the environment reader returns a well-formed plan input whatever this browser reports', () => {
        // RE-BASED BY TASK-2984 (W1.1, epic 2981), 2026-09-08. This asserted
        // `budgetBytes >= PLAYBACK_HEAP_BUDGET_BYTES` (800 MiB), which the new
        // 'small-device' and 'phone-class' paths deliberately violate. The
        // REAL invariant is the one below.
        const r = resolvePlaybackHeapBudgetFromEnvironment();
        expect(typeof r.budgetBytes).toBe('number');
        expect(r.budgetBytes > 0).toBe(true);
        expect(r.budgetBytes >= SMALL_DEVICE_MIN_BUDGET_BYTES).toBe(true);
        expect(r.budgetBytes <= PLAYBACK_HEAP_BUDGET_MAX_BYTES).toBe(true);
        // FIVE known sources, not four and not six. 'default', 'heap+device'
        // and 'partial' exist at HEAD — 'partial' is what a browser exposing
        // only ONE of the two offers gets, i.e. every non-Chromium browser and
        // much of the phone class this epic targets — and TASK-2984 adds
        // 'small-device' and 'phone-class'.
        expect(['default', 'heap+device', 'partial', 'small-device', 'phone-class'])
            .toContain(r.source);
        // saveData rides on the same read (clause 11) and is always a boolean.
        expect(typeof r.saveData).toBe('boolean');
    });
});

/*
 * ===========================================================================
 * TASK-2984 (W1.1, epic 2981) — DEEPEN AS FAR AS A MEASURED BUDGET HOLDS.
 *
 * Every figure in this block was computed against the REAL module on
 * 2026-09-08 at the three constants the operator FROZE that day
 * (ruling "ABA" plus the same-day ceiling ruling):
 *   APP_BASELINE_FLOOR_BYTES    = 280 MiB — FLOORS the usedJSHeapSize READING
 *                                 inside the heap offer; NEVER subtracted from
 *                                 the budget (that would charge the idle tab
 *                                 twice, since the offer already nets live
 *                                 usage and E is frozen net of baseline).
 *   PLAN_TRANSIENT_EXCESS_BYTES = 680 MiB, NET of the idle baseline. RAISED
 *                                 from 566 on 2026-09-08 by the operator's
 *                                 ruling on decision `2026-09-08-w1-e-overrun`,
 *                                 after AC15's live calibration measured 589.3
 *                                 and 597.4 MiB net on 741_410_1328_chunk2 and
 *                                 a HEAD control on the SAME leg burned 664.1.
 *                                 EVERY CELL OF THE AC2 SCALE TABLE BELOW IS
 *                                 UNCHANGED by that raise; the three sweep
 *                                 literals that move are named where they sit.
 *   PLAN_UNCAP_MAX_PEAK_BYTES   = 440 MiB — the only plan 741_410_1328_chunk2
 *                                 has ever survived (W0.4 @cap3072). NOT
 *                                 implicated by the E raise: no leg died.
 *
 * The store shapes are real: 813_417_1412 and the three re-chunkings of
 * 741_410_1328 that exist on disk at /home/david/hydrata/playback-fixtures/.
 * ===========================================================================
 */
describe('playbackMemoryPolicy — TASK-2984 (W1.1, epic 2981) the deepening rule', () => {
    const SHAPE_1412 = { nNode: 145824, nFace: 290407, chunkLengthT: 10, totalChunks: 11 };
    const SHAPE_PROD = { nNode: 3393075, nFace: 6779432, chunkLengthT: 10, totalChunks: 4 };
    const SHAPE_CHUNK2 = { nNode: 3393075, nFace: 6779432, chunkLengthT: 2, totalChunks: 16 };
    const SHAPE_CHUNK1 = { nNode: 3393075, nFace: 6779432, chunkLengthT: 1, totalChunks: 31 };
    const SHAPE_L2_51 = { nNode: 3393075, nFace: 6779432, chunkLengthT: 2, totalChunks: 51 };
    const SYNTHETIC = { nNode: 14582400, chunkLengthT: 2 };

    /*
     * HEAD's plan at the same budget, reproduced through the SHIPPED module
     * rather than copied out of it — collapsing the window budget (E at its
     * band maximum, ceiling 0) makes deepN clamp to MIN, so clause 9's max()
     * returns `todaysN` verbatim. That is the definition of monotonicity's
     * baseline, and computing it this way means it cannot drift away from the
     * real todaysN the way a hand-copied formula would.
     */
    const headPlan = (shape, budgetBytes) => computePlaybackMemoryPlan({
        ...shape,
        budgetBytes,
        planTransientExcessBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES,
        uncapMaxPeakBytes: 0
    });
    const newPlan = (shape, budgetBytes, extra) => computePlaybackMemoryPlan({
        ...shape, budgetBytes, ...(extra || {})
    });
    const BUDGETS_MIB = [128, 163, 256, 384, 800, 1371, 2048];

    it('AC1 — the SHIPPED DEFAULT 800 MiB budget buys 813_417_1412 its WHOLE store, 11 of 11', () => {
        // THE HEADLINE. The spec this inverts read "NO budget, however large,
        // can buy a window deeper than MAX_CHUNKS_PER_QUANTITY"; unmodified
        // HEAD returns 3 at 800, 1371 AND 2048 MiB.
        [800, 1371, 2048].forEach((mib) => {
            expect(headPlan(SHAPE_1412, mib * MIB).chunksPerQuantity).toBe(3);
            expect(newPlan(SHAPE_1412, mib * MIB).chunksPerQuantity).toBe(11);
        });
        const plan = newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES);
        expect(plan.chunksPerQuantity).toBe(plan.wholeStorePeakBytes && 11);
        expect(Math.round(plan.peakResidentBytes / MIB)).toBe(106);
        expect(plan.peakResidentBytes).toBe(plan.wholeStorePeakBytes);
    });

    it('AC2 — THE SCALE TABLE, every cell, from a REAL budget and never from forceChunksPerQuantity', () => {
        // budget MiB -> [HEAD n, NEW n, rounded plan peak MiB]
        const TABLE = [
            ['813_417_1412', SHAPE_1412, {
                128: [3, 3, 39], 163: [3, 3, 39], 256: [3, 3, 39], 384: [3, 3, 39],
                800: [3, 11, 106], 1371: [3, 11, 106], 2048: [3, 11, 106]
            }],
            // IDENTICAL to HEAD at every budget, by design — the ceiling binds.
            ['741_410_1328 PROD L10/4', SHAPE_PROD, {
                128: [2, 2, 712], 163: [2, 2, 712], 256: [2, 2, 712], 384: [2, 2, 712],
                800: [2, 2, 712], 1371: [3, 3, 906], 2048: [3, 3, 906]
            }],
            // HYPOTHETICAL SHAPE — no 51-chunk store exists or can be made (the
            // source has 31 timesteps, so an L2 rechunk caps at 16). Kept
            // because at a 440 MiB ceiling it is cell-for-cell identical to the
            // real chunk-2 row: it is the CEILING, not the chunk count, that
            // holds a big L2 store at 3. Graded as PLAN ARITHMETIC only.
            ['741_410_1328 re-export L2/51', SHAPE_L2_51, {
                128: [2, 2, 401], 163: [2, 2, 401], 256: [2, 2, 401], 384: [2, 2, 401],
                800: [3, 3, 440], 1371: [3, 3, 440], 2048: [3, 3, 440]
            }],
            ['741_410_1328_chunk2 L2/16', SHAPE_CHUNK2, {
                128: [2, 2, 401], 163: [2, 2, 401], 256: [2, 2, 401], 384: [2, 2, 401],
                800: [3, 3, 440], 1371: [3, 3, 440], 2048: [3, 3, 440]
            }],
            // THE PARTIAL-DEEPENING WITNESS: 6 of 31, neither the floor nor the
            // whole store, on a fixture that actually exists on disk.
            ['741_410_1328_chunk1 L1/31', SHAPE_CHUNK1, {
                128: [2, 2, 362], 163: [2, 2, 362], 256: [2, 2, 362], 384: [3, 3, 382],
                800: [3, 3, 382], 1371: [3, 6, 440], 2048: [3, 6, 440]
            }]
        ];
        TABLE.forEach(([label, shape, row]) => {
            BUDGETS_MIB.forEach((mib) => {
                const [wantHead, wantNew, wantPeak] = row[mib];
                const head = headPlan(shape, mib * MIB);
                const now = newPlan(shape, mib * MIB);
                expect(`${label}@${mib}: ${head.chunksPerQuantity}->${now.chunksPerQuantity} (${Math.round(now.peakResidentBytes / MIB)})`)
                    .toBe(`${label}@${mib}: ${wantHead}->${wantNew} (${wantPeak})`);
            });
        });
    });

    it('AC2 sweep — the first budget at which each shape deepens, and the deepest window it ever reaches', () => {
        // 1 MiB steps over the whole resolvable range. Named numbers, so a
        // change to any constant moves a value here rather than passing
        // silently.
        const sweep = (shape) => {
            let first = null;
            let max = 0;
            for (let mib = 128; mib <= 2048; mib++) {
                const head = headPlan(shape, mib * MIB).chunksPerQuantity;
                const now = newPlan(shape, mib * MIB).chunksPerQuantity;
                if (first === null && now > head) {
                    first = mib;
                }
                if (now > max) {
                    max = now;
                }
            }
            return [first, max];
        };
        // RE-BASED 2026-09-08 by the operator's E ruling (decision
        // `2026-09-08-w1-e-overrun`, PLAN_TRANSIENT_EXCESS_BYTES 566 -> 680
        // MiB). TWO of the ruling's THREE moving literals live here:
        //   1412   first deepening 614 -> 728 MiB   (727 gives 3, 728 gives 4)
        //   chunk1 first deepening 968 -> 1082 MiB  (1081 gives 3, 1082 gives 4)
        // Every max-n is UNCHANGED (1412 11, chunk1 6, PROD/chunk2/L2x51 3),
        // and so is every cell of the AC2 scale table above.
        expect(sweep(SHAPE_1412)).toEqual([728, 11]);
        expect(sweep(SHAPE_CHUNK1)).toEqual([1082, 6]);
        expect(sweep(SHAPE_PROD)).toEqual([null, 3]);
        expect(sweep(SHAPE_CHUNK2)).toEqual([null, 3]);
        expect(sweep(SHAPE_L2_51)).toEqual([null, 3]);
    });

    it('AC3 — THE FREEZE PLAN IS UNREACHABLE: the prod chunk-10 shape never reaches 4 slots at ANY budget', () => {
        // A SWEEP, not examples. n = 4 on this shape is the documented freeze
        // plan: whole-store peak 1,100.1 MiB, the plan that drove a renderer to
        // 3.4 GB RSS and stopped answering CDP (TASK-2743 UAT-08).
        let max = 0;
        for (let b = SMALL_DEVICE_MIN_BUDGET_BYTES; b <= PLAYBACK_HEAP_BUDGET_MAX_BYTES; b += MIB) {
            max = Math.max(max, newPlan(SHAPE_PROD, b).chunksPerQuantity);
        }
        expect(max).toBe(3);
        // ...and it is the ceiling that does it. Lift the ceiling out of the
        // way (RULE C's own seam, in band) and the sweep reaches 4 at a
        // 1781 MiB budget with a plan peak of 1,100.1 MiB.
        //
        // RE-BASED 2026-09-08 by the operator's E ruling (566 -> 680 MiB):
        // this threshold is `fixed + 4 * perChunk + E`, so it slides by
        // exactly the 114 MiB E moved, 1667 -> 1781. THE CLAIM ABOVE DID NOT
        // MOVE: at the SHIPPED 440 MiB ceiling the sweep's max is still 3, so
        // AC3's actual property is unchanged and only this mutation witness
        // re-bases.
        const unbounded = newPlan(SHAPE_PROD, 1781 * MIB, { uncapMaxPeakBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES });
        expect(unbounded.chunksPerQuantity).toBe(4);
        expect(Math.round(unbounded.peakResidentBytes / MIB)).toBe(1100);
        // 1780 MiB is still 3 — 1781 is the exact threshold.
        expect(newPlan(SHAPE_PROD, 1780 * MIB, { uncapMaxPeakBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES }).chunksPerQuantity).toBe(3);
    });

    it('AC4 — BOTH bounds in the window budget are load-bearing, one mutation each', () => {
        // (a) WITHOUT the additive excess E, a PHONE-class budget buys the
        // whole store: 1412 at 256 MiB goes 3 -> 11 and the plan peak 38.9 ->
        // 105.7 MiB. That is the safety direction failing.
        [128, 163, 256, 384].forEach((mib) => {
            expect(newPlan(SHAPE_1412, mib * MIB).chunksPerQuantity).toBe(3);
            expect(newPlan(SHAPE_1412, mib * MIB, { planTransientExcessBytes: 0 }).chunksPerQuantity).toBe(11);
        });
        expect(Math.round(newPlan(SHAPE_1412, 256 * MIB).peakResidentBytes / MIB)).toBe(39);
        expect(Math.round(newPlan(SHAPE_1412, 256 * MIB, { planTransientExcessBytes: 0 }).peakResidentBytes / MIB)).toBe(106);
        // second witness: chunk1 at 800 MiB moves 3 -> 6 without E.
        expect(newPlan(SHAPE_CHUNK1, 800 * MIB).chunksPerQuantity).toBe(3);
        expect(newPlan(SHAPE_CHUNK1, 800 * MIB, { planTransientExcessBytes: 0 }).chunksPerQuantity).toBe(6);

        // (b) WITHOUT the ceiling, chunk2 at 2048 MiB goes 3 -> 16 and the plan
        // peak 440.0 -> 944.8 MiB: precisely the fill the ceiling ruling
        // forbids. 944.8 MiB of typed arrays is a fill this project has never
        // observed a browser survive.
        expect(newPlan(SHAPE_CHUNK2, 2048 * MIB).chunksPerQuantity).toBe(3);
        const noCeil = newPlan(SHAPE_CHUNK2, 2048 * MIB, { uncapMaxPeakBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES });
        expect(noCeil.chunksPerQuantity).toBe(16);
        expect(Math.round(noCeil.peakResidentBytes / MIB)).toBe(945);
        expect(Math.round(newPlan(SHAPE_CHUNK2, 2048 * MIB).peakResidentBytes / MIB)).toBe(440);
    });

    it('AC5 — MONOTONE SAFETY: no shape, at any of the table budgets, plans SHALLOWER than HEAD', () => {
        // Monotonicity is a property of the plan function AT A FIXED BUDGET.
        // The downward device path changes the BUDGET, not the plan-at-a-
        // budget, so it cannot violate this and is not evidence about it.
        [SHAPE_1412, SHAPE_PROD, SHAPE_CHUNK2, SHAPE_CHUNK1, SHAPE_L2_51].forEach((shape) => {
            BUDGETS_MIB.forEach((mib) => {
                const head = headPlan(shape, mib * MIB).chunksPerQuantity;
                const now = newPlan(shape, mib * MIB).chunksPerQuantity;
                expect(now >= head).toBe(true);
            });
        });
    });

    it('AC6 — THE DOWNWARD PATH: a device that says it is small gets a budget that reflects it', () => {
        const HEAP = { jsHeapSizeLimit: 512 * MIB, usedJSHeapSize: 150 * MIB };
        // (a) deviceMemory exactly at the threshold. The raw heap offer is
        // (512 - 280) x 0.45 = 104.4 MiB — the reading 150 MiB is FLOORED to
        // 280 MiB — and the small-device path floors THAT at 128 MiB.
        // HEAD returns exactly 800 MiB, 'heap+device'.
        const a = resolvePlaybackHeapBudget({ ...HEAP, deviceMemoryGiB: SMALL_DEVICE_MEMORY_GIB });
        expect(a.budgetBytes).toBe(SMALL_DEVICE_MIN_BUDGET_BYTES);
        expect(a.source).toBe('small-device');
        // (b) a 2 GiB device, same heap signals.
        const b = resolvePlaybackHeapBudget({ ...HEAP, deviceMemoryGiB: 2 });
        expect(b.budgetBytes).toBe(SMALL_DEVICE_MIN_BUDGET_BYTES);
        expect(b.source).toBe('small-device');
        // (c) THE UPWARD PATH MUST NOT MOVE. 700 MiB used is above the floor,
        // so the floor is inert here — assert that too, by driving the same
        // signals with the floor overridden to 0.
        const c = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 4192 * MIB, usedJSHeapSize: 700 * MIB, deviceMemoryGiB: 16
        });
        expect(Math.round(c.budgetBytes / MIB * 10) / 10).toBe(1571.4);
        expect(c.source).toBe('heap+device');
        expect(c.budgetBytes).toBe(resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 4192 * MIB, usedJSHeapSize: 700 * MIB, deviceMemoryGiB: 16,
            appBaselineFloorBytes: 0
        }).budgetBytes);
        // (d) near-zero headroom on a small device floors at the structural
        // minimum, not at zero.
        const d = resolvePlaybackHeapBudget({
            jsHeapSizeLimit: 300 * MIB, usedJSHeapSize: 290 * MIB, deviceMemoryGiB: 2
        });
        expect(d.budgetBytes).toBe(SMALL_DEVICE_MIN_BUDGET_BYTES);
        expect(d.source).toBe('small-device');
        // (e) NO signals at all + the coarse phone class: iOS Safari.
        const e = resolvePlaybackHeapBudget({ uaMobile: true });
        expect(e.budgetBytes).toBe(PHONE_CLASS_BUDGET_BYTES);
        expect(e.source).toBe('phone-class');
        // (f) no signals, not a phone: desktop Firefox must not regress.
        const f = resolvePlaybackHeapBudget();
        expect(f.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(f.source).toBe('default');
    });

    it('AC7 — THE ANDROID HOLE: a modern phone reports deviceMemory 8, so deviceMemory alone never fires for it', () => {
        const HEAP = { jsHeapSizeLimit: 512 * MIB, usedJSHeapSize: 150 * MIB };
        // (a) Chrome on any Android device with >= 6 GB RAM reports 8. HEAD
        // returns 800 'heap+device' — and so did the earlier draft of this
        // task, which consulted the phone class ONLY when signals were absent.
        // Both are wrong, and this is the disjunct that fixes it.
        const android = resolvePlaybackHeapBudget({ ...HEAP, deviceMemoryGiB: 8, uaMobile: true });
        expect(android.budgetBytes).toBe(SMALL_DEVICE_MIN_BUDGET_BYTES);
        expect(android.source).toBe('small-device');
        // (b) the same signals on a TOUCHSCREEN DESKTOP take the ordinary
        // floored path, unchanged.
        const desktop = resolvePlaybackHeapBudget({
            ...HEAP, deviceMemoryGiB: 8, uaMobile: false, maxTouchPoints: 10, viewportMinPx: 1500
        });
        expect(desktop.budgetBytes).toBe(PLAYBACK_HEAP_BUDGET_BYTES);
        expect(desktop.source).toBe('heap+device');
        // (c) END TO END — THE CRITERION THAT FAILS IF A PHONE STILL
        // DOWNLOADS THE STORE. At the phone's 128 MiB budget the 323.5 MiB
        // fixed mesh alone overflows, so the FIRST term is what refuses it.
        const plan = newPlan(SHAPE_CHUNK2, android.budgetBytes);
        expect(plan.verdict).toBe('fallback');
        expect(plan.fallbackReason).toBe('fixed-mesh-exceeds-budget');
    });

    it('AC8 — the coarse phone predicate, BOTH clauses, plus a pin on THIS test browser', () => {
        expect(isCoarsePhoneClass({ uaMobile: true })).toBe(true);
        // the iOS Safari case: no userAgentData, touch points and a narrow
        // viewport.
        expect(isCoarsePhoneClass({ maxTouchPoints: 5, viewportMinPx: 390 })).toBe(true);
        // a touchscreen LAPTOP — the box this epic was built on. maxTouchPoints
        // alone must not fire.
        expect(isCoarsePhoneClass({ maxTouchPoints: 10, viewportMinPx: 1500 })).toBe(false);
        // a narrow desktop window: viewport alone must not fire either.
        expect(isCoarsePhoneClass({ maxTouchPoints: 0, viewportMinPx: 390 })).toBe(false);
        expect(isCoarsePhoneClass({})).toBe(false);
        expect(isCoarsePhoneClass()).toBe(false);

        // AND PIN THE TEST ENVIRONMENT ITSELF. karma runs ChromeHeadlessCI
        // with no --window-size, so `viewportMinPx <= 600` is ALREADY TRUE
        // here and only `maxTouchPoints === 0` keeps the predicate false. If a
        // future runner change gives the test browser touch points, this is the
        // ONE named failure you want — not five unrelated budget specs going
        // red for a reason nobody can see.
        const live = isCoarsePhoneClass({
            uaMobile: navigator.userAgentData ? navigator.userAgentData.mobile : undefined,
            maxTouchPoints: navigator.maxTouchPoints,
            viewportMinPx: Math.min(window.innerWidth, window.innerHeight)
        });
        expect(live).toBe(false);
    });

    it('AC9 — FALLBACK REACHABILITY, and the verdict/deepening asymmetry that goes with it', () => {
        // (a) chunk2 on the phone-class budget. ASSERT THE REASON STRING: the
        // 323.5 MiB fixed mesh alone overflows 256 MiB, so clause 12's FIRST
        // branch fires — NOT 'floor-window-exceeds-budget'. No budget between
        // 323.5 and 401.1 MiB is reachable on the phone-class path at all (it
        // is a constant), so that other reason is only observable on the
        // small-device path; TASK-2986 AC1 owns that coverage.
        const phone = newPlan(SHAPE_CHUNK2, PHONE_CLASS_BUDGET_BYTES);
        expect(phone.verdict).toBe('fallback');
        expect(phone.fallbackReason).toBe('fixed-mesh-exceeds-budget');
        // (b) THE SMALL STORE MUST STILL PLAY ON A PHONE. A rule that refuses
        // everything is not adaptation.
        const small = newPlan(SHAPE_1412, PHONE_CLASS_BUDGET_BYTES);
        expect(small.verdict).toBe('ok');
        expect(small.chunksPerQuantity >= headPlan(SHAPE_1412, PHONE_CLASS_BUDGET_BYTES).chunksPerQuantity).toBe(true);
        expect(Math.round(small.floorWindowPlanPeakBytes / MIB * 10) / 10).toBe(30.6);
        // (c) the 14.6 M-node synthetic: 1,390.7 MiB of fixed mesh alone.
        const synth = newPlan(SYNTHETIC, PLAYBACK_HEAP_BUDGET_BYTES);
        expect(synth.verdict).toBe('fallback');
        expect(synth.fallbackReason).toBe('fixed-mesh-exceeds-budget');
        // (d) THE SAME synthetic at 1,849 MiB is NOT refused — its floor-window
        // peak of 1,724.5 MiB fits. Epic AC4 and the superseded TASK-2986 AC2
        // both asserted it IS refused there; an AC asserting refusal fails
        // against a correct implementation.
        const synthBig = newPlan(SYNTHETIC, 1849 * MIB);
        expect(synthBig.verdict).toBe('ok');
        expect(synthBig.fallbackReason).toBe(null);
        expect(synthBig.chunksPerQuantity).toBe(2);
        expect(Math.round(synthBig.floorWindowPlanPeakBytes / MIB * 10) / 10).toBe(1724.5);
        // (e) THE ASYMMETRY, PINNED so a later reader cannot mistake it for a
        // bug. The verdict is judged against the GROSS budget; the deepening
        // against budget - E. W0.4 measured 741_410_1328_chunk2 in EXACTLY
        // this configuration — 800 MiB budget, verdict 'ok', floor-window peak
        // 401.1 MiB, HEAD's 3-chunk window at 440.0 MiB — reaching 1078.2 MiB
        // of heap and DYING inside a 1536 MiB cgroup.
        //   verdict 'ok' means THE PLAN FITS THE BUDGET.
        //   It does NOT mean THE TAB WILL SURVIVE.
        const chunk2 = newPlan(SHAPE_CHUNK2, PLAYBACK_HEAP_BUDGET_BYTES);
        expect(chunk2.verdict).toBe('ok');
        expect(chunk2.floorWindowPlanPeakBytes + chunk2.planTransientExcessBytes > chunk2.budgetBytes).toBe(true);
        // 401.1 + 680.0 = 1081.1 MiB against an 800 MiB budget. RE-BASED
        // 2026-09-08 by the operator's E ruling (566 -> 680): the pessimistic
        // total moves with E by construction, and the INEQUALITY above — the
        // thing this AC actually pins — was true at 566 and is more true at
        // 680.
        expect(Math.round((chunk2.floorWindowPlanPeakBytes + chunk2.planTransientExcessBytes) / MIB * 10) / 10).toBe(1081.1);
    });

    it('AC10 — saveData holds the plan at the floor window, and is not a no-op', () => {
        // `grep -rn saveData` over the playback tree returned ZERO hits at HEAD
        // (gmc 126b4ab28, 2026-09-08).
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { saveData: true }).chunksPerQuantity).toBe(3);
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { saveData: false }).chunksPerQuantity).toBe(11);
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES).chunksPerQuantity).toBe(11);
        // it is echoed on the plan, always as a boolean
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { saveData: true }).saveData).toBe(true);
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES).saveData).toBe(false);
        // and it is exactly clause 9's guard and nothing else: the deepening
        // arithmetic still ran and still reports what it WOULD have bought.
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { saveData: true }).deepChunksPerQuantity).toBe(11);
    });

    it('AC11 — an undeclared chunk count does NOT deepen, and a 1-chunk store gets 1 slot', () => {
        // A REAL PRODUCTION PATH, not a defensive branch: playbackEpics's
        // `totalChunks0` is undefined for every format_version-1 store
        // (741_410_1328/zarr.json declares n_time null). An unbounded ceiling
        // here would plan ~2.3 million slots on the karma fixture.
        const undeclared = computePlaybackMemoryPlan({
            nNode: 145824, nFace: 290407, chunkLengthT: 10, budgetBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES
        });
        expect(undeclared.chunksPerQuantity).toBe(3);
        expect(undeclared.deepChunksPerQuantity).toBe(null);
        // Asserted on the VALUE, not on the absence of a throw.
        expect(undeclared.chunksPerQuantity).toBe(headPlan(
            { nNode: 145824, nFace: 290407, chunkLengthT: 10 }, PLAYBACK_HEAP_BUDGET_MAX_BYTES
        ).chunksPerQuantity);

        // A 1-chunk store gets 1, not 2. THIS DEPENDS ON clamp() RESOLVING hi
        // OVER lo WHEN THE BOUNDS INVERT (`Math.min(hi, Math.max(lo, value))`):
        // deepN's clamp is clamp(x, MIN = 2, min(totalChunks = 1, ...)), i.e.
        // lo 2 > hi 1. A future tidy of clamp() to
        // `Math.max(lo, Math.min(hi, value))` would silently plan 2 slots on a
        // 1-chunk store, so it is pinned rather than assumed.
        const one = computePlaybackMemoryPlan({ nNode: 1000, chunkLengthT: 10, totalChunks: 1 });
        expect(one.chunksPerQuantity).toBe(1);
        expect(one.deepChunksPerQuantity).toBe(1);
    });

    it('AC12 — THE INERT TRAP: a plan legitimately exceeds 3 from budget arithmetic alone, with NO argument passed', () => {
        // TRAP 1 (clause 14): renaming the cap but leaving the old
        // `clamp(..., MIN, MAX)` in the chunksPerQuantity path holds every plan
        // at <= 3, silently no-ops this whole task, and leaves every existing
        // test passing.
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES).chunksPerQuantity > FLOOR_WINDOW_CHUNKS_PER_QUANTITY).toBe(true);

        // TRAP 2 (clause 7b): the DEFAULT-PARAMETER form. Both production call
        // sites OMIT maxChunksPerQuantity, so a default of
        // FLOOR_WINDOW_CHUNKS_PER_QUANTITY would make `callerUpperBound` 3 for
        // every real caller and deepN could never exceed 3. A test that always
        // passes the argument explicitly CANNOT SEE THIS TRAP — so this call
        // has no such key at all.
        const noKey = computePlaybackMemoryPlan({
            nNode: 145824, nFace: 290407, chunkLengthT: 10, totalChunks: 11,
            budgetBytes: PLAYBACK_HEAP_BUDGET_BYTES
        });
        expect(noKey.chunksPerQuantity).toBe(11);
    });

    it('AC13 — maxChunksPerQuantity still bounds from ABOVE, on a shape that would otherwise deepen', () => {
        // TASK-2743's documented shallower-window capability survives, and is
        // never clamped to the floor window on the deepening path.
        expect(newPlan(SHAPE_1412, 2048 * MIB, { maxChunksPerQuantity: 2 }).chunksPerQuantity).toBe(2);
        expect(newPlan(SHAPE_PROD, 2048 * MIB, { maxChunksPerQuantity: 2 }).chunksPerQuantity).toBe(2);
        // and it can ask for MORE than the floor window on a store the budget
        // can hold — 5 of 11 rather than 3 or 11.
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { maxChunksPerQuantity: 5 }).chunksPerQuantity).toBe(5);
    });

    it('AC17 — the big-device path is ARITHMETICALLY REACHABLE with the constants actually shipped', () => {
        // (a) THERE EXISTS a budget <= PLAYBACK_HEAP_BUDGET_MAX_BYTES at which
        // 813_417_1412 plans its whole store. The minimum is 786 MiB
        // (680 E + 13.9 fixed + 91.8 for 11 chunks); the shipped 800 MiB
        // default clears it with 14.3 MiB to spare, and it is the witness.
        //
        // RE-BASED 2026-09-08 by the operator's E ruling (566 -> 680 MiB).
        // The other TWO of the ruling's three moving literals are here:
        // 672 -> 786 (785 gives 10, 786 gives 11) and 614 -> 728. Breakeven
        // is 694.3 MiB — the largest E at which the shipped 800 MiB default
        // still buys all 11 — so 680 keeps the epic's headline with 14.3 MiB
        // of margin, and an E past 694 fails THIS spec loudly.
        let firstWhole = null;
        let firstDeeper = null;
        for (let mib = 128; mib <= 2048; mib++) {
            const n = newPlan(SHAPE_1412, mib * MIB).chunksPerQuantity;
            if (firstDeeper === null && n > 3) {
                firstDeeper = mib;
            }
            if (firstWhole === null && n === 11) {
                firstWhole = mib;
            }
        }
        expect(firstWhole).toBe(786);
        // reported separately so the two are never confused: 728 MiB is where
        // it first deepens beyond HEAD at all, where it plans 4.
        expect(firstDeeper).toBe(728);
        expect(newPlan(SHAPE_1412, 728 * MIB).chunksPerQuantity).toBe(4);
        expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES).chunksPerQuantity).toBe(11);

        // (b) THERE EXISTS a real store that plans a PARTIAL window, strictly
        // between the floor and the whole store. This is what stops a future
        // edit collapsing the rule back to all-or-nothing.
        const partial = newPlan(SHAPE_CHUNK1, 1371 * MIB);
        expect(partial.chunksPerQuantity).toBe(6);
        expect(partial.chunksPerQuantity > MIN_CHUNKS_PER_QUANTITY).toBe(true);
        expect(partial.chunksPerQuantity < SHAPE_CHUNK1.totalChunks).toBe(true);

        // (c) restated here so (a) and (b) cannot be satisfied by raising the
        // ceiling: the prod chunk-10 shape still never reaches 4.
        expect(newPlan(SHAPE_PROD, PLAYBACK_HEAP_BUDGET_MAX_BYTES).chunksPerQuantity).toBe(3);
    });

    describe('AC18 — the runtime-tunable seam is LIVE, not ornamental (RULE C)', () => {
        it('(a) a NON-DEFAULT input MOVES a cell, and BOTH named inputs are shown live', () => {
            // A seam is trivially buildable dead — clause 7b exists because a
            // default parameter once made this whole task a silent no-op with
            // every existing test still green.
            // planTransientExcessBytes, in the CONSERVATIVE direction: the
            // AC2(a) headline cell moves 11 -> 3, peak 105.7 -> 38.9 MiB.
            const tighter = newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { planTransientExcessBytes: 800 * MIB });
            expect(tighter.chunksPerQuantity).toBe(3);
            expect(Math.round(tighter.peakResidentBytes / MIB)).toBe(39);
            expect(tighter.overrideSource).toBe('override');
            // uncapMaxPeakBytes, in the OTHER direction: chunk1 at 1371 MiB
            // moves 6 -> 18, peak 440.0 -> 673.0 MiB.
            //
            // RE-BASED 2026-09-08 by the operator's E ruling (566 -> 680 MiB).
            // With the ceiling lifted to 1024 MiB it is E that binds here, so
            // the override's REACH shrinks by exactly the 114 MiB E moved:
            // window budget min(1371 - 680, 1024) = 691 MiB, and
            // floor((691 - 323.5) / 19.4) = 18. What this AC pins — that the
            // named input MOVES the cell, in the OTHER direction from the
            // first — is untouched: 18 is still well above the shipped 6.
            const looser = newPlan(SHAPE_CHUNK1, 1371 * MIB, { uncapMaxPeakBytes: 1024 * MIB });
            expect(looser.chunksPerQuantity).toBe(18);
            expect(Math.round(looser.peakResidentBytes / MIB * 10) / 10).toBe(673.0);
            expect(looser.overrideSource).toBe('override');
        });

        it('(b) THE CONVERSE, byte-identical: no overrides == the three shipped constants passed explicitly', () => {
            // This is what makes RULE C's defaults SAFE where clause 7b's was
            // not: 7b's default sat on a CAP that CLAMPED the result, so an
            // omitting caller silently killed the rule. RULE C's defaults ARE
            // the shipped constants, so an omitting caller gets exactly the
            // intended arithmetic.
            [SHAPE_1412, SHAPE_CHUNK1, SHAPE_CHUNK2].forEach((shape) => {
                const bare = newPlan(shape, PLAYBACK_HEAP_BUDGET_BYTES);
                const explicit = newPlan(shape, PLAYBACK_HEAP_BUDGET_BYTES, {
                    planTransientExcessBytes: PLAN_TRANSIENT_EXCESS_BYTES,
                    uncapMaxPeakBytes: PLAN_UNCAP_MAX_PEAK_BYTES,
                    appBaselineFloorBytes: APP_BASELINE_FLOOR_BYTES
                });
                expect(bare).toEqual(explicit);
                expect(bare.overrideSource).toBe('shipped');
                expect(explicit.overrideSource).toBe('shipped');
            });
        });

        it('(c) SANITISATION: an out-of-band value falls back to the shipped constant, and the echo says so', () => {
            const JUNK = [-1, NaN, Infinity, -Infinity, '800', null, {}, PLAYBACK_HEAP_BUDGET_MAX_BYTES + 1];
            JUNK.forEach((junk) => {
                const p = newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, {
                    planTransientExcessBytes: junk, uncapMaxPeakBytes: junk, appBaselineFloorBytes: junk
                });
                // the ECHOED field reports the SHIPPED value, not the rejected
                // one — a census that could not tell those apart could not
                // falsify its own result.
                expect(p.planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BYTES);
                expect(p.uncapMaxPeakBytes).toBe(PLAN_UNCAP_MAX_PEAK_BYTES);
                expect(p.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
                expect(p.overrideSource).toBe('shipped');
                expect(p.chunksPerQuantity).toBe(11);
            });
            // the band's hi is honoured, its hi+1 is not
            expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, {
                planTransientExcessBytes: PLAN_TRANSIENT_EXCESS_BAND_BYTES[1]
            }).planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BAND_BYTES[1]);
            expect(PLAN_UNCAP_MAX_PEAK_BAND_BYTES).toEqual([0, PLAYBACK_HEAP_BUDGET_MAX_BYTES]);
            expect(APP_BASELINE_FLOOR_BAND_BYTES).toEqual([0, PLAYBACK_HEAP_BUDGET_BYTES]);
            // ZERO IS IN BAND AND IS SAFE, not dangerous: it collapses the
            // window budget so the monotone max() returns HEAD's own plan.
            expect(newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, { uncapMaxPeakBytes: 0 }).chunksPerQuantity).toBe(3);
            // and the same discipline on the budget resolver
            const junkFloor = resolvePlaybackHeapBudget({
                jsHeapSizeLimit: 512 * MIB, usedJSHeapSize: 150 * MIB, deviceMemoryGiB: 4,
                appBaselineFloorBytes: 'not a number'
            });
            const noFloor = resolvePlaybackHeapBudget({
                jsHeapSizeLimit: 512 * MIB, usedJSHeapSize: 150 * MIB, deviceMemoryGiB: 4
            });
            expect(junkFloor).toEqual(noFloor);
            expect(junkFloor.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
        });

        it('(d) THE HARD INVARIANT no in-band override may breach, as a sweep', () => {
            // This preserves the q-3 ruling verbatim: the ceiling is a SAFETY
            // control, and a future admin knob must not become a way to
            // re-create the documented renderer freeze.
            const SHAPES = [SHAPE_1412, SHAPE_PROD, SHAPE_CHUNK2, SHAPE_CHUNK1, SHAPE_L2_51];
            const EXCESS = [0, 100 * MIB, PLAN_TRANSIENT_EXCESS_BYTES, PLAYBACK_HEAP_BUDGET_MAX_BYTES];
            const CEILINGS = [0, PLAN_UNCAP_MAX_PEAK_BYTES, 1024 * MIB, PLAYBACK_HEAP_BUDGET_MAX_BYTES];
            let deeperSeen = 0;
            let breaches = 0;
            SHAPES.forEach((shape) => {
                [128, 256, 800, 1371, 2048].forEach((mib) => {
                    EXCESS.forEach((e) => {
                        CEILINGS.forEach((ceiling) => {
                            const p = newPlan(shape, mib * MIB, {
                                planTransientExcessBytes: e, uncapMaxPeakBytes: ceiling
                            });
                            if (p.chunksPerQuantity > headPlan(shape, mib * MIB).chunksPerQuantity) {
                                deeperSeen++;
                                if (p.peakResidentBytes > ceiling
                                    || p.peakResidentBytes > PLAYBACK_HEAP_BUDGET_MAX_BYTES
                                    || p.chunksPerQuantity < MIN_CHUNKS_PER_QUANTITY
                                    || p.chunksPerQuantity > shape.totalChunks) {
                                    breaches++;
                                }
                            }
                        });
                    });
                });
            });
            // the sweep must actually EXERCISE the invariant, not vacuously
            // satisfy it by never producing a deeper plan.
            expect(deeperSeen > 0).toBe(true);
            expect(breaches).toBe(0);
        });

        it('(e) the module keeps NO settable state — karma runs every playback spec in ONE bundle', () => {
            // playbackMemoryPolicy-test.js has zero reset hooks under
            // byte-exact assertions, so a leaked module-level override would
            // produce order-dependent failures across ~30 specs. The seam is
            // therefore parameters-only: no getConfigProp, no URLSearchParams,
            // no localStorage, no window/store read, and no module-level `let`.
            //
            // Driven as a PROPERTY rather than a source grep (a grep cannot run
            // here): the same call, made twice with an override in between,
            // must return byte-identical plans.
            const before = newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES);
            newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES, {
                planTransientExcessBytes: 0, uncapMaxPeakBytes: PLAYBACK_HEAP_BUDGET_MAX_BYTES,
                appBaselineFloorBytes: 0
            });
            resolvePlaybackHeapBudget({ appBaselineFloorBytes: 0, jsHeapSizeLimit: 512 * MIB, deviceMemoryGiB: 2 });
            const after = newPlan(SHAPE_1412, PLAYBACK_HEAP_BUDGET_BYTES);
            expect(after).toEqual(before);
            expect(after.overrideSource).toBe('shipped');
        });
    });
});

/*
 * ===========================================================================
 * TASK-3032 (W4.x, epic 2981) — resolvePlaybackHeapBudget must say WHERE its
 * appBaselineFloorBytes came from.
 *
 * The budget resolver already echoes the EFFECTIVE appBaselineFloorBytes, so a
 * census can see the value that was used. It could not see whether that value
 * came from the caller or from the shipped constant — and the one case where
 * that matters most is the case where they are byte-identical: an override
 * REJECTED by the band clamp resolves to exactly APP_BASELINE_FLOOR_BYTES,
 * which reads the same as no override at all.
 *
 * That is three different bugs with one symptom for the W4.5 tester rung
 * (TASK-3025): the transport failed, the parameter name was wrong, or the
 * clamp rejected the value. computePlaybackMemoryPlan has answered this since
 * TASK-2984 clause 20; this is the same answer on the other half of the seam.
 * ===========================================================================
 */
describe('playbackMemoryPolicy — TASK-3032 (W4.x, epic 2981) the budget resolver reports its override source', () => {
    const MIB_3032 = 1024 * 1024;
    // Signals that force the 'heap+device' branch, so AC3's independence
    // assertion has a non-'default' source to sit beside.
    const HEAP_DEVICE_SIGNALS = { jsHeapSizeLimit: 4096 * MIB_3032, deviceMemoryGiB: 8 };

    it('AC1(a) no override supplied -> overrideSource "shipped"', () => {
        const r = resolvePlaybackHeapBudget({});
        expect(r.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
        expect(r.overrideSource).toBe('shipped');
    });

    it('AC1(b) an OUT-OF-BAND override -> "shipped", because the clamp rejected it', () => {
        // THIS IS THE CASE THE FIELD EXISTS FOR. The band is
        // APP_BASELINE_FLOOR_BAND_BYTES = [0, PLAYBACK_HEAP_BUDGET_BYTES], so
        // a value above 800 MiB is discarded and the resolver falls back to
        // the shipped constant. Without overrideSource the census reads the
        // shipped number and cannot tell a rejected override from no override.
        const tooBig = resolvePlaybackHeapBudget({
            appBaselineFloorBytes: PLAYBACK_HEAP_BUDGET_BYTES + 1
        });
        expect(tooBig.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
        expect(tooBig.overrideSource).toBe('shipped');
        // A non-numeric value takes the same path.
        const nonsense = resolvePlaybackHeapBudget({ appBaselineFloorBytes: 'lots' });
        expect(nonsense.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
        expect(nonsense.overrideSource).toBe('shipped');
    });

    it('AC1(c) an IN-BAND, non-default override -> "override"', () => {
        const honoured = resolvePlaybackHeapBudget({ appBaselineFloorBytes: 120 * MIB_3032 });
        expect(honoured.appBaselineFloorBytes).toBe(120 * MIB_3032);
        expect(honoured.overrideSource).toBe('override');
    });

    it('AC1(d) an in-band override EQUAL to the shipped constant reads "shipped"', () => {
        // Deliberate and documented: the field reports whether the EFFECTIVE
        // value differs from the shipped one, exactly as
        // computePlaybackMemoryPlan computes it. Setting the floor to the
        // number it already had changes nothing, so there is nothing for a
        // census to distinguish.
        const same = resolvePlaybackHeapBudget({
            appBaselineFloorBytes: APP_BASELINE_FLOOR_BYTES
        });
        expect(same.overrideSource).toBe('shipped');
    });

    it('AC1(e) it is reported on EVERY branch, not just the one with no signals', () => {
        const branches = [
            ['default', resolvePlaybackHeapBudget({ appBaselineFloorBytes: 120 * MIB_3032 })],
            ['heap+device', resolvePlaybackHeapBudget({
                ...HEAP_DEVICE_SIGNALS, appBaselineFloorBytes: 120 * MIB_3032
            })],
            ['partial', resolvePlaybackHeapBudget({
                jsHeapSizeLimit: 4096 * MIB_3032, appBaselineFloorBytes: 120 * MIB_3032
            })],
            ['small-device', resolvePlaybackHeapBudget({
                jsHeapSizeLimit: 4096 * MIB_3032, deviceMemoryGiB: 2,
                appBaselineFloorBytes: 120 * MIB_3032
            })],
            ['phone-class', resolvePlaybackHeapBudget({
                uaMobile: true, maxTouchPoints: 5, viewportMinPx: 400,
                appBaselineFloorBytes: 120 * MIB_3032
            })]
        ];
        branches.forEach(([expectedSource, resolved]) => {
            expect(resolved.source).toBe(expectedSource);
            expect(resolved.overrideSource).toBe('override');
        });
    });

    it('AC2 resolvePlaybackHeapBudgetFromEnvironment carries it through', () => {
        const shipped = resolvePlaybackHeapBudgetFromEnvironment();
        expect(shipped.overrideSource).toBe('shipped');
        const overridden = resolvePlaybackHeapBudgetFromEnvironment({
            appBaselineFloorBytes: 120 * MIB_3032
        });
        expect(overridden.overrideSource).toBe('override');
        // And a rejected one still reads 'shipped' through the environment
        // reader — the whole point of the seam being falsifiable end to end.
        const rejected = resolvePlaybackHeapBudgetFromEnvironment({
            appBaselineFloorBytes: -1
        });
        expect(rejected.overrideSource).toBe('shipped');
    });

    it('AC3 overrideSource is a SEPARATE field: `source` keeps its five values', () => {
        const r = resolvePlaybackHeapBudget({
            ...HEAP_DEVICE_SIGNALS, appBaselineFloorBytes: 120 * MIB_3032
        });
        // Both fields asserted independently on ONE call — a sixth `source`
        // value would break every consumer that switches on it.
        expect(r.source).toBe('heap+device');
        expect(r.overrideSource).toBe('override');
        expect(['default', 'heap+device', 'partial', 'small-device', 'phone-class'])
            .toContain(r.source);
        expect(['shipped', 'override']).toContain(r.overrideSource);
    });

    it('AC4 no module-level state: an override leaks nothing into the next call', () => {
        // RULE C clause 21 — the specs share ONE webpack bundle with no reset
        // hooks, so this is driven as a property: the same call before and
        // after an overridden one must be byte-identical.
        const before = resolvePlaybackHeapBudget(HEAP_DEVICE_SIGNALS);
        resolvePlaybackHeapBudget({ ...HEAP_DEVICE_SIGNALS, appBaselineFloorBytes: 1 });
        const after = resolvePlaybackHeapBudget(HEAP_DEVICE_SIGNALS);
        expect(after).toEqual(before);
        expect(after.overrideSource).toBe('shipped');
    });
});

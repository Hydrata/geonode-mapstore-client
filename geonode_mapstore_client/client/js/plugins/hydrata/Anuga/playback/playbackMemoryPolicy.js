/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackMemoryPolicy — TASK-2708 (W1.2, epic 2706). THE module that owns
 * the playback client's residency policy. Nothing else in the playback
 * chain is allowed to invent a memory constant: the chunk cache's ceiling,
 * the prefetch window's depth and the dtype the cache holds are all derived
 * HERE, from the store's own declared shape.
 *
 * ============================================================================
 * PROOF 4 — THE RESIDENCY POLICY, STATED
 * ============================================================================
 *
 * WHAT WENT WRONG. The shipped 2618 client sized its chunk cache with a fixed
 * constant (playbackChunkCache.DEFAULT_MAX_BYTES = 64 MiB) and its prefetch
 * window with a fixed chunk COUNT (playbackController's radius 2). Neither
 * scales with the mesh. On run 1328 — 3,393,075 nodes, 6,779,432 triangles,
 * time-chunked at 10 — one DEQUANTIZED chunk is
 *     10 x 3,393,075 x 4 B (Float32) = 135,723,000 B = 129.4 MiB
 * i.e. TWICE the entire cache ceiling. A single element that cannot fit in its
 * own cache makes the LRU thrash by construction, and radius 2 asks for
 * 3 quantities x 5 chunks = 1,941 MiB of simultaneously-live decoded arrays.
 * Measured on prod: heap 81 -> 2,876 MiB, 6-8 main-thread stalls totalling
 * ~8 s (worst 5,722 ms), every fetch COMPLETED, player never rendered.
 *
 * THE POLICY, IN ONE SENTENCE. Hold the three quantity arrays for the
 * current time-chunk plus a bounded lookahead, in their STORED uint16 form,
 * inside a cache whose ceiling is computed from the store's own chunk
 * footprint against a total heap budget — and dequantize one frame's row at
 * a time, off the main thread.
 *
 * 1. WHICH QUANTITIES STAY RESIDENT: all three (depth, x_velocity,
 *    y_velocity), always. This is NOT negotiable and was explicitly
 *    re-litigated and rejected during review. playbackEpics requires all
 *    three before a chunk counts as playable; playbackShaders' vertex shader
 *    binds aQty0/aQty1 as vec3 (depth, xVel, yVel) and computes
 *    `length(q.yz)` on every vertex regardless of uColorMode; playbackFlowViz
 *    and playbackParticles read the SAME velocity attributes while depth is
 *    the displayed colour. "Hold only the active quantity" would silently
 *    regress shipped 2618 flow-viz and particles. quantityCount is therefore
 *    a constant of the render contract, not a tuning knob.
 *
 * 2. RESIDENCY DTYPE: the cache holds the STORED uint16, never the
 *    dequantized Float32 (TASK-2708 change (c)). Dequantization is
 *    `physical = offset + stored * scale`, exact and cheap, and is applied to
 *    one frame's row (nNode elements) at slice time in
 *    loadPlaybackFrame — not to a whole chunk at decode time. This alone
 *    halves time-series residency (2 B/element instead of 4 B) and is
 *    lossless: the same Float32 values reach the renderer, just later and in
 *    1/chunkLengthT of the volume.
 *
 * 3. HOW THE CEILING IS DERIVED FROM THE STORE:
 *      storedChunkBytes   = chunkLengthT x nNode x 2          (uint16)
 *      fixedBytes         = geometryBytes + renderBytes       (see below)
 *      timeSeriesBudget   = budgetBytes - fixedBytes
 *      chunksPerQuantity  = clamp(floor(timeSeriesBudget /
 *                                (quantityCount x storedChunkBytes)),
 *                                MIN_CHUNKS_PER_QUANTITY,
 *                                MAX_CHUNKS_PER_QUANTITY)
 *      cacheMaxBytes      = quantityCount x chunksPerQuantity x storedChunkBytes
 *    Everything on the right-hand side except the two clamps comes from the
 *    store's own metadata. A bigger mesh gets a bigger cache and a shallower
 *    window; a smaller mesh gets a deeper window. The next mesh being bigger
 *    again does not need a code change.
 *
 * 4. PREFETCH DEPTH: asymmetric, because playback runs forwards. Of the
 *    chunksPerQuantity slots, at most ONE is spent behind the playhead (so a
 *    short scrub-back is still a cache hit) and the rest ahead:
 *      bufferWindowRadius = min(1, floor((chunksPerQuantity - 1) / 2))
 *      bufferWindowAhead  = chunksPerQuantity - 1 - bufferWindowRadius
 *    MIN_CHUNKS_PER_QUANTITY = 2 is a STRUCTURAL floor, not a preference: a
 *    zarr chunk is the atomic decompress unit, and loadPlaybackFrame needs
 *    frame0 and frame1, which straddle two chunks at every chunk boundary. A
 *    1-chunk cache would evict the chunk it is still reading at every
 *    boundary crossing — the same thrash, one order of magnitude down.
 *    MAX_CHUNKS_PER_QUANTITY = 3 (one behind, current, one ahead) is the
 *    point past which lookahead stops buying anything: the controller clock
 *    is 20 Hz and even a chunk-1 store's third slot is already 3 timesteps of
 *    runway, while each extra slot costs a whole chunk x 3 quantities.
 *
 * 5. THE ARITHMETIC, AGAINST THE REVIEW'S OWN FLOORS (run 1328:
 *    nNode 3,393,075, nFace 6,779,432). fixedBytes is what the shipped
 *    renderer holds for this mesh no matter what the time-series policy is:
 *      geometry  20 x nNode + 16 x nFace  = 176,332,412 B  (168.2 MiB)
 *        node_x/node_y/elevation/friction/vertexInradius Float32 = 20 x nNode
 *        inradius Float32 (per FACE) 4 x nFace + face_node_connectivity
 *        Int32 3-per-face 12 x nFace = 16 x nFace
 *      render    48 x nNode            = 162,867,600 B  (155.3 MiB)
 *        layer's private nodeX/nodeY clone (Float32, 8 x nNode — the worker
 *        transfer would otherwise detach Redux's copy, playbackEpics:271),
 *        reprojected x3857/y3857 (Float64, 16 x nNode, retained by the
 *        flow-viz overlay, AnugaPlaybackRenderer:250-255), and frame0+frame1
 *        (each {depth,xVelocity,yVelocity} Float32 = 12 x nNode -> 24 x nNode)
 *      fixedBytes                        = 339,200,012 B  (323.5 MiB)
 *
 *    chunk-10 (what prod writes today), budget 800 MiB:
 *      storedChunkBytes 67,861,500 B (64.7 MiB); timeSeriesBudget 499,660,788
 *      -> floor(499,660,788 / 203,584,500) = 2 chunks/quantity
 *      -> cacheMaxBytes 407,169,000 B (388.3 MiB); radius 0, ahead 1
 *      -> peak 746,369,012 B = 711.8 MiB   <= 800 MiB budget. A 3.9x
 *         reduction against the 2,876 MiB measured on prod.
 *      The review's floors are met exactly: this IS "3 quantities x 1 chunk
 *      + next-chunk prefetch on all three", which the review priced at
 *      ~530 MiB before the derived-buffer terms it had omitted.
 *
 *    chunk-1 (TASK-2719's re-chunked store), budget 400 MiB:
 *      storedChunkBytes 6,786,150 B; the affordable count (24) is clamped by
 *      MAX_CHUNKS_PER_QUANTITY to 3 -> cacheMaxBytes 61,075,350 B (58.2 MiB);
 *      radius 1, ahead 1
 *      -> peak 400,275,362 B = 381.7 MiB   <= 400 MiB budget.
 *
 *    NOT COUNTED, deliberately, and why: (a) gunzip transients and the raw
 *    decoded buffer now live in the DECODE WORKER's heap, not the main
 *    thread's (TASK-2708 change (d)) — the main thread only ever receives the
 *    finished uint16 via a transfer; (b) packQuantityVec3's Float32Array(3n)
 *    and AnugaPlaybackRenderer.setMesh's Float32Array(2n) are function-local
 *    and released the moment gl.bufferData copies them to the GPU; (c) the
 *    identify path's own reprojection (16 x nNode = 51.8 MiB,
 *    playbackEpics.getReprojectedMesh) is allocated lazily on the FIRST
 *    Inspect click and never during load/play/scrub, which is what PROOF 2a/2b
 *    measure. It is reported as `onDemandIdentifyBytes` so it is stated
 *    rather than hidden.
 *
 * 6. WHAT THIS POLICY DOES NOT FIX. On a chunk-10 store the smallest
 *    residency granule is 10 timesteps x 3 quantities = 194 MiB, so the
 *    600 MiB figure floated in the 2026-08-10 draft is unreachable there by
 *    construction, whatever the cache does. That is the entire argument for
 *    TASK-2719 (export at chunk 1), and this module's own numbers are the
 *    evidence: the same budget buys 3 slots of lookahead at chunk 1 and 2 at
 *    chunk 10, for a sixth of the bytes.
 */

import { QUANTITY_ARRAYS } from './playbackChunkShape';

/** The stored dtype of every quantized array in the schema (schema Section 3). */
export const STORED_BYTES_PER_ELEMENT = 2; // uint16
/** What the RENDERER receives per element, after per-frame dequantization. */
export const PHYSICAL_BYTES_PER_ELEMENT = 4; // Float32

/**
 * Total main-thread heap the playback client is allowed to add above the
 * pre-selection baseline, for a legacy chunk-10 store. Epic 2706 AC2's
 * "honest number": ~3.6x below the 2,876 MiB measured on prod, and the most a
 * chunk-10 store can be squeezed to without changing the export (TASK-2719).
 */
export const PLAYBACK_HEAP_BUDGET_BYTES = 800 * 1024 * 1024;

/** See PROOF 4 note 4 — a structural floor (frame0/frame1 straddle a boundary). */
export const MIN_CHUNKS_PER_QUANTITY = 2;
/** See PROOF 4 note 4 — one behind, current, one ahead. */
export const MAX_CHUNKS_PER_QUANTITY = 3;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

// ============================================================================
// TASK-2743 UAT-08 (W6, epic 2706) — SIZE THE BUDGET TO THE MACHINE.
//
// The operator, on the playback stall: "Is there a way to pre-load this a bit
// more aggressively, or safely in response to available memory somehow?"
//
// PLAYBACK_HEAP_BUDGET_BYTES above is a single 800 MiB constant, chosen for
// the worst machine we are willing to support. On run 1328 it buys exactly 2
// chunk slots per quantity, which the asymmetric split turns into 0 behind
// and 1 ahead — a lookahead of ONE chunk, started only as the playhead
// crosses into the previous one. That is the shallowest window the policy can
// express, and it is handed to a 32 GiB workstation and a 4 GiB laptop alike.
//
// The browser will tell us, if asked. `performance.memory.jsHeapSizeLimit` is
// the V8 heap ceiling for THIS tab (4,192 MiB on the workstation, measured);
// `navigator.deviceMemory` is a coarse, deliberately-quantised GiB figure with
// a spec-mandated cap of 8 that every modern browser reports. Take the more
// pessimistic of the two, spend a fixed fraction, and clamp.
//
// Three properties make this safe to ship into a policy that was tuned by
// measuring a tab freeze:
//   1. It can only ever RAISE the budget. The clamp's lower bound IS the
//      existing 800 MiB constant, so no machine gets a smaller window than it
//      has today, and a browser that reports NOTHING gets today's numbers
//      byte-for-byte — including every existing test, and karma, where
//      neither signal exists.
//   2. The fractions are of what the browser says it can give this tab, not
//      of physical RAM. jsHeapSizeLimit is the number an allocation actually
//      dies against.
//   3. MAX_CHUNKS_PER_QUANTITY stops being a constant and becomes what it
//      always meant: how deep a window this budget can pay for. Its old
//      justification — "the point past which lookahead stops buying
//      anything", argued from a 20 Hz clock — assumed the fetch keeps up.
//      Measured on map 1461 it does not: chunk 2's body read took 1,087 ms
//      against a 161 ms frame budget once the main thread was saturated.
// ============================================================================

/** The share of this tab's OWN heap ceiling playback may plan against. */
export const HEAP_LIMIT_BUDGET_FRACTION = 0.45;
/** The share of the device's reported RAM playback may plan against. */
export const DEVICE_MEMORY_BUDGET_FRACTION = 0.20;
/**
 * The ceiling on the derived budget. 2 GiB is not a memory limit so much as a
 * statement about diminishing returns: past it the plan is already holding
 * every chunk of every store we produce, and the extra slots buy nothing.
 */
export const PLAYBACK_HEAP_BUDGET_MAX_BYTES = 2048 * 1024 * 1024;
/**
 * The deepest window any budget may buy. Distinct from
 * MAX_CHUNKS_PER_QUANTITY (which stays the default for an unknown machine):
 * this is the hard stop, so a future browser reporting an enormous heap
 * cannot talk the policy into an unbounded window.
 */
export const MAX_CHUNKS_PER_QUANTITY_CEILING = 6;

/**
 * The heap budget and window depth THIS machine can pay for.
 *
 * Both inputs are optional and both are absent in karma and in every browser
 * that does not implement them; with neither, this returns exactly
 * `{budgetBytes: PLAYBACK_HEAP_BUDGET_BYTES, maxChunksPerQuantity:
 * MAX_CHUNKS_PER_QUANTITY}` — the shipped values.
 *
 * @param {object} [signals]
 * @param {number} [signals.jsHeapSizeLimit] performance.memory.jsHeapSizeLimit, bytes
 * @param {number} [signals.deviceMemoryGiB] navigator.deviceMemory, GiB
 * @returns {{budgetBytes: number, maxChunksPerQuantity: number, source: string}}
 */
export function resolvePlaybackHeapBudget({ jsHeapSizeLimit, deviceMemoryGiB } = {}) {
    const offers = [];
    if (jsHeapSizeLimit > 0) {
        offers.push(jsHeapSizeLimit * HEAP_LIMIT_BUDGET_FRACTION);
    }
    if (deviceMemoryGiB > 0) {
        offers.push(deviceMemoryGiB * 1024 * 1024 * 1024 * DEVICE_MEMORY_BUDGET_FRACTION);
    }
    if (!offers.length) {
        return {
            budgetBytes: PLAYBACK_HEAP_BUDGET_BYTES,
            maxChunksPerQuantity: MAX_CHUNKS_PER_QUANTITY,
            source: 'default'
        };
    }
    const budgetBytes = clamp(
        Math.floor(Math.min(...offers)),
        PLAYBACK_HEAP_BUDGET_BYTES,
        PLAYBACK_HEAP_BUDGET_MAX_BYTES
    );
    // One extra slot per whole extra base-budget of headroom. Integer by
    // construction, so the default budget yields exactly the default depth.
    const extraSlots = Math.floor(budgetBytes / PLAYBACK_HEAP_BUDGET_BYTES) - 1;
    const maxChunksPerQuantity = clamp(
        MAX_CHUNKS_PER_QUANTITY + Math.max(0, extraSlots),
        MAX_CHUNKS_PER_QUANTITY,
        MAX_CHUNKS_PER_QUANTITY_CEILING
    );
    return { budgetBytes, maxChunksPerQuantity, source: offers.length === 2 ? 'heap+device' : 'partial' };
}

/**
 * The same, read off the live browser. Split from the pure function above so
 * every test drives the arithmetic directly and nothing has to stub a global.
 * @returns {{budgetBytes: number, maxChunksPerQuantity: number, source: string}}
 */
export function resolvePlaybackHeapBudgetFromEnvironment() {
    const perf = typeof performance !== 'undefined' ? performance : null;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    return resolvePlaybackHeapBudget({
        jsHeapSizeLimit: perf && perf.memory ? perf.memory.jsHeapSizeLimit : undefined,
        deviceMemoryGiB: nav ? nav.deviceMemory : undefined
    });
}

/**
 * Per-node bytes the shipped mesh path holds for the store's static arrays:
 * node_x, node_y, elevation, friction, vertexInradius — five Float32.
 */
const GEOMETRY_BYTES_PER_NODE = 5 * 4;
/**
 * Per-face bytes: inradius (Float32, per face) + face_node_connectivity
 * (Int32, three per face).
 */
const GEOMETRY_BYTES_PER_FACE = 4 + 3 * 4;
/**
 * Per-node bytes the shipped RENDER path holds once the mesh is live: the
 * layer's private nodeX/nodeY clone (2 x Float32), the reprojected
 * x3857/y3857 the flow-viz overlay retains (2 x Float64), and frame0+frame1
 * (2 frames x 3 quantities x Float32).
 */
const RENDER_BYTES_PER_NODE = 2 * 4 + 2 * 8 + 2 * 3 * 4;
/** Identify's own lazily-built reprojection (2 x Float64), first Inspect click only. */
const IDENTIFY_BYTES_PER_NODE = 2 * 8;

/**
 * A planar triangulation has very close to two triangles per node (Euler);
 * run 1328 measures 6,779,432 / 3,393,075 = 1.998. Used ONLY when the caller
 * cannot yet know the real face count — the manifest declares chunk_shapes
 * for the quantized arrays (hence nNode) but not the mesh arrays' shapes, so
 * the plan is built at manifest-load from this estimate and REBUILT with the
 * exact nFace as soon as face_node_connectivity has landed
 * (playbackEpics -> PlaybackChunkFetcher.applyMemoryPlan).
 */
export const FACES_PER_NODE_ESTIMATE = 2;


/**
 * The node EXTENT of one chunk, from the quantized arrays' chunk_shapes
 * ([chunk_length_t, node_extent], TASK-2724's manifest block). Returns
 * undefined rather than guessing when the store declared nothing usable — the
 * caller falls back to the mesh's own length, which is only known later.
 *
 * NOT the array's node count, despite the name — TASK-2729. The two are equal
 * only because the exporter writes a SINGLE node chunk; on a node-chunked
 * store this is Nc, not N. That is fine HERE, because the only consumer sizes
 * a cache and a too-small chunk estimate is a conservative one. It is NOT fine
 * as a guard: this takes the FIRST usable value across QUANTITY_ARRAYS, so a
 * store where only y_velocity is node-chunked returns depth's value and looks
 * healthy. The guard lives in playbackChunkShape.assertNodeExtentMatchesMesh
 * and compares EVERY array; do not build one on this function.
 *
 * @param {object} manifest
 * @returns {number|undefined}
 */
export function readNodeCount(manifest) {
    const shapes = (manifest && manifest.chunk_shapes) || {};
    return QUANTITY_ARRAYS
        .map((name) => (Array.isArray(shapes[name]) ? shapes[name][1] : undefined))
        .find((n) => typeof n === 'number' && isFinite(n) && n > 0);
}

/**
 * The bytes this mesh costs no matter what the time-series policy is — see
 * PROOF 4 note 5. Split out so a test (and a future reviewer) can see each
 * term rather than one opaque total.
 * @param {{nNode: number, nFace?: number}} store
 */
export function fixedResidencyBytes({ nNode, nFace }) {
    const faces = nFace > 0 ? nFace : Math.round(nNode * FACES_PER_NODE_ESTIMATE);
    const geometryBytes = GEOMETRY_BYTES_PER_NODE * nNode + GEOMETRY_BYTES_PER_FACE * faces;
    const renderBytes = RENDER_BYTES_PER_NODE * nNode;
    return {
        nFace: faces,
        geometryBytes,
        renderBytes,
        onDemandIdentifyBytes: IDENTIFY_BYTES_PER_NODE * nNode,
        total: geometryBytes + renderBytes
    };
}

/**
 * THE plan. Everything the data plane needs to know about how much of this
 * store it may hold, derived from the store's own shape.
 *
 * `bytesPerResidentElement` and `chunksPerQuantity`/`windowChunks` are
 * overridable ONLY so a test can price the pre-fix shape (Float32 residency,
 * a fixed 64 MiB ceiling, radius 2) with the same arithmetic as the fix and
 * show it blowing the same budget — see playbackMemoryPolicy-test.js PROOF 1.
 * Production never passes them.
 *
 * @param {object} store
 * @param {number} store.nNode nodes per timestep (manifest.chunk_shapes[q][1])
 * @param {number} [store.nFace] triangles; estimated from nNode when unknown
 * @param {number} store.chunkLengthT the store's own time-chunk length (resolveChunkLengthT)
 * @param {number} [store.totalChunks] caps the window on a store with few chunks
 * @param {number} [store.budgetBytes=PLAYBACK_HEAP_BUDGET_BYTES]
 * @param {number} [store.quantityCount=QUANTITY_ARRAYS.length]
 * @param {number} [store.bytesPerResidentElement=STORED_BYTES_PER_ELEMENT]
 * @param {number} [store.forceChunksPerQuantity] test-only override
 * @returns {object} the plan
 */
export function computePlaybackMemoryPlan({
    nNode,
    nFace,
    chunkLengthT,
    totalChunks,
    budgetBytes = PLAYBACK_HEAP_BUDGET_BYTES,
    quantityCount = QUANTITY_ARRAYS.length,
    bytesPerResidentElement = STORED_BYTES_PER_ELEMENT,
    // TASK-2743 UAT-08 — the window depth this budget may buy. Defaults to
    // the old constant, so a caller that passes neither this nor budgetBytes
    // gets the pre-TASK-2743 plan exactly.
    maxChunksPerQuantity = MAX_CHUNKS_PER_QUANTITY,
    forceChunksPerQuantity
} = {}) {
    if (!(nNode > 0) || !(chunkLengthT > 0)) {
        throw new Error(
            `computePlaybackMemoryPlan: needs the store's own nNode and chunkLengthT ` +
            `(got nNode=${nNode}, chunkLengthT=${chunkLengthT}). There is no default — a ` +
            'guessed footprint is how the fixed 64 MiB ceiling froze the tab (TASK-2708).'
        );
    }
    const fixed = fixedResidencyBytes({ nNode, nFace });
    const storedChunkBytes = chunkLengthT * nNode * bytesPerResidentElement;
    const perChunkAcrossQuantities = quantityCount * storedChunkBytes;
    const timeSeriesBudget = Math.max(0, budgetBytes - fixed.total);
    const affordable = Math.floor(timeSeriesBudget / perChunkAcrossQuantities);
    // A store with only one chunk cannot be given two, and asking for more
    // chunks than exist just wastes ceiling.
    const requestedMax = clamp(
        maxChunksPerQuantity > 0 ? Math.floor(maxChunksPerQuantity) : MAX_CHUNKS_PER_QUANTITY,
        MIN_CHUNKS_PER_QUANTITY,
        MAX_CHUNKS_PER_QUANTITY_CEILING
    );
    const hardMax = totalChunks > 0
        ? Math.min(requestedMax, totalChunks)
        : requestedMax;
    const chunksPerQuantity = forceChunksPerQuantity > 0
        ? forceChunksPerQuantity
        : clamp(affordable, Math.min(MIN_CHUNKS_PER_QUANTITY, hardMax), hardMax);
    const bufferWindowRadius = Math.min(1, Math.floor((chunksPerQuantity - 1) / 2));
    const bufferWindowAhead = chunksPerQuantity - 1 - bufferWindowRadius;
    const cacheMaxBytes = quantityCount * chunksPerQuantity * storedChunkBytes;
    const peakResidentBytes = fixed.total + cacheMaxBytes;
    return {
        nNode,
        nFace: fixed.nFace,
        chunkLengthT,
        quantityCount,
        bytesPerResidentElement,
        storedChunkBytes,
        geometryBytes: fixed.geometryBytes,
        renderBytes: fixed.renderBytes,
        onDemandIdentifyBytes: fixed.onDemandIdentifyBytes,
        fixedBytes: fixed.total,
        timeSeriesBudget,
        affordableChunksPerQuantity: affordable,
        maxChunksPerQuantity: requestedMax,
        chunksPerQuantity,
        bufferWindowRadius,
        bufferWindowAhead,
        cacheMaxBytes,
        peakResidentBytes,
        budgetBytes,
        withinBudget: peakResidentBytes <= budgetBytes
    };
}

/** Human-readable one-liner for a log line or a test failure message. */
export function describePlan(plan) {
    const mib = (b) => `${(b / 1048576).toFixed(1)} MiB`;
    return [
        `nNode=${plan.nNode} nFace=${plan.nFace} chunkLengthT=${plan.chunkLengthT}`,
        `chunk=${mib(plan.storedChunkBytes)} x ${plan.quantityCount} quantities`,
        `slots=${plan.chunksPerQuantity} (behind ${plan.bufferWindowRadius}, ahead ${plan.bufferWindowAhead})`,
        `cache=${mib(plan.cacheMaxBytes)} fixed=${mib(plan.fixedBytes)}`,
        `peak=${mib(plan.peakResidentBytes)} / budget ${mib(plan.budgetBytes)}`
    ].join(' | ');
}

/**
 * The stable, greppable prefix every "this plan does not fit" breadcrumb
 * carries (TASK-2732, W3, epic 2706).
 *
 * ONE definition, so the emitted line, the spec that asserts it and W4's
 * telemetry work (TASK-2712..2714) all read the same string rather than each
 * carrying its own regex over prose. It keeps the `[playback] ` convention the
 * TASK-2744 AC20 score line already uses — so both console breadcrumbs grep
 * together — while `memory plan OVER BUDGET` stays unique to this one, which
 * is what makes a prefix-filtered warn count unambiguous.
 *
 * The POLICY stays pure: it defines the string, it never emits it. The warn
 * lives at playbackEpics.js's manifest-time plan seam, the only production
 * caller of computePlaybackMemoryPlan.
 */
export const PLAYBACK_BUDGET_WARN_PREFIX = '[playback] memory plan OVER BUDGET —';

export default computePlaybackMemoryPlan;
